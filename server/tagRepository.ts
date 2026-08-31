import { migrateAccountTagsData } from "~/services/tags/migrations/accountTagsDataMigration"
import {
  createDefaultTagStore,
  generateTagId,
  listTagsSorted,
  mergeTagStoresAndRemapAccounts,
  normalizeTagNameForUniqueness,
  sanitizeTagStore,
} from "~/services/tags/tagStoreUtils"
import type { AccountStorageConfig, Tag, TagStore } from "~/types"
import type {
  WebTagDeleteResponse,
  WebTagListResponse,
  WebTagMutationInput,
} from "~/web/contracts"

import {
  ACCOUNTS_DOCUMENT_KEY,
  normalizeAccountsDocument,
  normalizeAccountsForPersistence,
  type VersionedAccountsDocument,
} from "./accountsRepository"
import {
  API_CREDENTIAL_PROFILES_DOCUMENT_KEY,
  createEmptyApiCredentialProfilesDocument,
  mergeApiCredentialProfilesDocuments,
  normalizeApiCredentialProfilesDocument,
  normalizeExtensionApiCredentialProfiles,
} from "./apiCredentialProfileRepository"
import {
  AUTOMATION_DOCUMENT_KEY,
  createDefaultAutomationSettings,
  normalizeAutomationDocument,
  normalizeExtensionAutomationPatch,
  type AutomationSettingsRepository,
} from "./automationSettingsRepository"
import {
  normalizeChannelConfigSnapshot,
  WEB_CHANNEL_CONFIG_DOCUMENT_KEY,
} from "./channelConfigRepository"
import type { ChannelConfigRepository } from "./channelConfigRepository"
import {
  RevisionConflictError,
  type EncryptedDocumentStore,
  type VersionedDocument,
} from "./encryptedDocumentStore"
import {
  createDefaultWebPreferencesDocument,
  extractExtensionPreferences,
  normalizeWebPreferencesDocument,
  WEB_PREFERENCES_DOCUMENT_KEY,
  type WebPreferencesRepository,
} from "./preferencesRepository"

const TAGS_DOCUMENT_KEY = "tags"

export class TagNotFoundError extends Error {
  constructor() {
    super("Tag not found")
    this.name = "TagNotFoundError"
  }
}

export class InvalidTagNameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidTagNameError"
  }
}

export class UnknownTagIdsError extends Error {
  constructor(readonly tagIds: string[]) {
    super("Unknown tag ids")
    this.name = "UnknownTagIdsError"
  }
}

const toResponse = (
  document: VersionedDocument<TagStore>,
): WebTagListResponse => ({
  tags: listTagsSorted(document.data),
  revision: document.revision,
})

const normalizeMutationName = (name: string) => {
  const normalized = normalizeTagNameForUniqueness(name)
  if (!normalized) throw new InvalidTagNameError("Tag name cannot be empty")
  return normalized
}

const assertUniqueName = (
  store: TagStore,
  normalizedKey: string,
  excludedId?: string,
) => {
  const duplicate = Object.values(store.tagsById).some((tag) => {
    if (tag.id === excludedId) return false
    return (
      normalizeTagNameForUniqueness(tag.name)?.normalizedKey === normalizedKey
    )
  })
  if (duplicate) throw new InvalidTagNameError("Tag name already exists")
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const asAccountStorageConfig = (
  value: unknown,
): AccountStorageConfig | undefined => {
  if (Array.isArray(value)) {
    return { accounts: value } as AccountStorageConfig
  }
  if (!isRecord(value)) return undefined
  if (
    !Array.isArray(value.accounts) &&
    !Array.isArray(value.bookmarks) &&
    !Array.isArray(value.pinnedAccountIds) &&
    !Array.isArray(value.orderedAccountIds)
  ) {
    return undefined
  }
  return value as unknown as AccountStorageConfig
}

const extractExtensionAccountImport = (raw: unknown) => {
  const preferenceSection = extractExtensionPreferences(raw)
  const channelConfigSection = isRecord(raw)
    ? Object.prototype.hasOwnProperty.call(raw, "channelConfigs")
      ? { present: true, value: raw.channelConfigs }
      : isRecord(raw.data) &&
          Object.prototype.hasOwnProperty.call(raw.data, "channelConfigs")
        ? { present: true, value: raw.data.channelConfigs }
        : { present: false, value: undefined }
    : { present: false, value: undefined }
  if (!isRecord(raw)) {
    return {
      accounts: raw,
      tagStore: undefined,
      apiCredentialProfiles: undefined,
      hasApiCredentialProfiles: false,
      preferences: preferenceSection,
      channelConfigs: channelConfigSection,
    }
  }
  const nestedData = isRecord(raw.data) ? raw.data : undefined
  const accounts =
    asAccountStorageConfig(raw) ??
    asAccountStorageConfig(raw.accounts) ??
    asAccountStorageConfig(nestedData) ??
    asAccountStorageConfig(nestedData?.accounts) ??
    raw
  return {
    accounts,
    tagStore: raw.tagStore ?? nestedData?.tagStore,
    apiCredentialProfiles:
      raw.apiCredentialProfiles ?? nestedData?.apiCredentialProfiles,
    hasApiCredentialProfiles:
      Object.prototype.hasOwnProperty.call(raw, "apiCredentialProfiles") ||
      Boolean(
        nestedData &&
          Object.prototype.hasOwnProperty.call(
            nestedData,
            "apiCredentialProfiles",
          ),
      ),
    preferences: preferenceSection,
    channelConfigs: channelConfigSection,
  }
}

const retainKnownTagIds = <T extends { tagIds?: string[] }>(
  entities: T[],
  knownTagIds: Set<string>,
): T[] =>
  entities.map((entity) => ({
    ...entity,
    tagIds: (entity.tagIds ?? []).filter((tagId) => knownTagIds.has(tagId)),
  }))

export class TagRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  list(): WebTagListResponse {
    return toResponse(
      this.store.read(
        TAGS_DOCUMENT_KEY,
        createDefaultTagStore,
        sanitizeTagStore,
      ),
    )
  }

  assertTagIdsExist(tagIds: string[]) {
    const uniqueIds = Array.from(
      new Set(tagIds.map((id) => id.trim()).filter(Boolean)),
    )
    if (uniqueIds.length === 0) return
    const store = this.store.read(
      TAGS_DOCUMENT_KEY,
      createDefaultTagStore,
      sanitizeTagStore,
    ).data
    const missingIds = uniqueIds.filter((id) => !store.tagsById[id])
    if (missingIds.length > 0) throw new UnknownTagIdsError(missingIds)
  }

  importExtensionData(
    raw: unknown,
    expectedAccountsRevision?: number,
    options?: {
      preferencesRepository?: WebPreferencesRepository
      channelConfigRepository?: ChannelConfigRepository
      automationSettingsRepository?: AutomationSettingsRepository
    },
  ): VersionedAccountsDocument {
    const extracted = extractExtensionAccountImport(raw)
    const importedAccounts = normalizeAccountsDocument(extracted.accounts)
    const migratedImport = migrateAccountTagsData({
      accounts: importedAccounts.accounts,
      tagStore: sanitizeTagStore(extracted.tagStore ?? createDefaultTagStore()),
    })
    const importedCredentialProfiles = extracted.hasApiCredentialProfiles
      ? normalizeExtensionApiCredentialProfiles(extracted.apiCredentialProfiles)
      : createEmptyApiCredentialProfilesDocument()
    const importedPreferences = extracted.preferences.present
      ? options?.preferencesRepository?.normalizeExtensionImport(
          extracted.preferences.value,
        )
      : null
    const importedChannelConfigs = extracted.channelConfigs.present
      ? options?.channelConfigRepository?.normalizeExtensionImport(raw)
      : null
    const importedAutomationPatch = extracted.preferences.present
      ? normalizeExtensionAutomationPatch(extracted.preferences.value)
      : {}

    return this.store.transaction((transaction) => {
      const currentAccounts = transaction.read(
        ACCOUNTS_DOCUMENT_KEY,
        () => normalizeAccountsDocument(undefined),
        normalizeAccountsDocument,
      )
      if (
        expectedAccountsRevision !== undefined &&
        currentAccounts.revision !== expectedAccountsRevision
      ) {
        throw new RevisionConflictError(
          expectedAccountsRevision,
          currentAccounts.revision,
        )
      }
      const currentTags = transaction.read(
        TAGS_DOCUMENT_KEY,
        createDefaultTagStore,
        sanitizeTagStore,
      )
      const currentCredentialProfiles = transaction.read(
        API_CREDENTIAL_PROFILES_DOCUMENT_KEY,
        createEmptyApiCredentialProfilesDocument,
        normalizeApiCredentialProfilesDocument,
      )
      const merged = mergeTagStoresAndRemapAccounts({
        localTagStore: currentTags.data,
        remoteTagStore: migratedImport.tagStore,
        localAccounts: currentAccounts.data.accounts,
        remoteAccounts: migratedImport.accounts,
        localBookmarks: currentAccounts.data.bookmarks,
        remoteBookmarks: importedAccounts.bookmarks,
        localTaggables: currentCredentialProfiles.data.profiles,
        remoteTaggables: importedCredentialProfiles.profiles,
      })
      const knownTagIds = new Set(Object.keys(merged.tagStore.tagsById))
      const writtenAccounts = transaction.write(
        ACCOUNTS_DOCUMENT_KEY,
        normalizeAccountsForPersistence({
          ...importedAccounts,
          accounts: retainKnownTagIds(merged.remoteAccounts, knownTagIds),
          bookmarks: retainKnownTagIds(merged.remoteBookmarks, knownTagIds),
        }),
        expectedAccountsRevision,
      )
      transaction.write(
        TAGS_DOCUMENT_KEY,
        merged.tagStore,
        currentTags.revision,
      )
      if (extracted.hasApiCredentialProfiles) {
        transaction.write(
          API_CREDENTIAL_PROFILES_DOCUMENT_KEY,
          mergeApiCredentialProfilesDocuments(
            {
              profiles: retainKnownTagIds(merged.localTaggables, knownTagIds),
            },
            {
              profiles: retainKnownTagIds(merged.remoteTaggables, knownTagIds),
            },
          ),
          currentCredentialProfiles.revision,
        )
      }
      if (importedPreferences) {
        const currentPreferences = transaction.read(
          WEB_PREFERENCES_DOCUMENT_KEY,
          createDefaultWebPreferencesDocument,
          normalizeWebPreferencesDocument,
        )
        transaction.write(
          WEB_PREFERENCES_DOCUMENT_KEY,
          importedPreferences,
          currentPreferences.revision,
        )
      }
      if (importedChannelConfigs) {
        const currentChannelConfigs = transaction.read(
          WEB_CHANNEL_CONFIG_DOCUMENT_KEY,
          () => ({ schemaVersion: 1 as const, configs: {} }),
          normalizeChannelConfigSnapshot,
        )
        transaction.write(
          WEB_CHANNEL_CONFIG_DOCUMENT_KEY,
          importedChannelConfigs,
          currentChannelConfigs.revision,
        )
      }
      if (Object.keys(importedAutomationPatch).length > 0) {
        const currentAutomation = transaction.read(
          AUTOMATION_DOCUMENT_KEY,
          createDefaultAutomationSettings,
          normalizeAutomationDocument,
        )
        transaction.write(
          AUTOMATION_DOCUMENT_KEY,
          normalizeAutomationDocument({
            ...currentAutomation.data,
            settings: {
              ...currentAutomation.data.settings,
              ...importedAutomationPatch,
            },
          }),
          currentAutomation.revision,
        )
      }
      return writtenAccounts
    })
  }

  create(input: WebTagMutationInput): WebTagListResponse {
    const normalized = normalizeMutationName(input.name)
    const document = this.store.mutate(
      TAGS_DOCUMENT_KEY,
      createDefaultTagStore,
      sanitizeTagStore,
      (store) => {
        assertUniqueName(store, normalized.normalizedKey)
        const now = Date.now()
        const tag: Tag = {
          id: generateTagId(),
          name: normalized.displayName,
          createdAt: now,
          updatedAt: now,
        }
        return {
          ...store,
          tagsById: { ...store.tagsById, [tag.id]: tag },
        }
      },
      input.expectedRevision,
    )
    return toResponse(document)
  }

  rename(tagId: string, input: WebTagMutationInput): WebTagListResponse {
    const normalized = normalizeMutationName(input.name)
    const document = this.store.mutate(
      TAGS_DOCUMENT_KEY,
      createDefaultTagStore,
      sanitizeTagStore,
      (store) => {
        const current = store.tagsById[tagId]
        if (!current) throw new TagNotFoundError()
        assertUniqueName(store, normalized.normalizedKey, tagId)
        return {
          ...store,
          tagsById: {
            ...store.tagsById,
            [tagId]: {
              ...current,
              name: normalized.displayName,
              updatedAt: Date.now(),
            },
          },
        }
      },
      input.expectedRevision,
    )
    return toResponse(document)
  }

  delete(
    tagId: string,
    expectedTagRevision?: number,
    expectedAccountsRevision?: number,
  ): WebTagDeleteResponse {
    return this.store.transaction((transaction) => {
      const tagDocument = transaction.read(
        TAGS_DOCUMENT_KEY,
        createDefaultTagStore,
        sanitizeTagStore,
      )
      const accountsDocument = transaction.read(
        ACCOUNTS_DOCUMENT_KEY,
        () => normalizeAccountsDocument(undefined),
        normalizeAccountsDocument,
      )
      const credentialProfilesDocument = transaction.read(
        API_CREDENTIAL_PROFILES_DOCUMENT_KEY,
        createEmptyApiCredentialProfilesDocument,
        normalizeApiCredentialProfilesDocument,
      )
      if (
        expectedAccountsRevision !== undefined &&
        expectedAccountsRevision !== accountsDocument.revision
      ) {
        throw new RevisionConflictError(
          expectedAccountsRevision,
          accountsDocument.revision,
        )
      }
      if (!tagDocument.data.tagsById[tagId]) throw new TagNotFoundError()

      const { [tagId]: _deleted, ...remainingTags } = tagDocument.data.tagsById
      const writtenTags = transaction.write(
        TAGS_DOCUMENT_KEY,
        { ...tagDocument.data, tagsById: remainingTags },
        expectedTagRevision,
      )

      let updatedAccounts = 0
      let updatedBookmarks = 0
      let updatedCredentialProfiles = 0
      const nextAccounts = accountsDocument.data.accounts.map((account) => {
        if (!account.tagIds.includes(tagId)) return account
        updatedAccounts++
        return {
          ...account,
          tagIds: account.tagIds.filter((id) => id !== tagId),
        }
      })
      const nextBookmarks = accountsDocument.data.bookmarks.map((bookmark) => {
        if (!bookmark.tagIds.includes(tagId)) return bookmark
        updatedBookmarks++
        return {
          ...bookmark,
          tagIds: bookmark.tagIds.filter((id) => id !== tagId),
        }
      })
      const nextCredentialProfiles =
        credentialProfilesDocument.data.profiles.map((profile) => {
          if (!profile.tagIds.includes(tagId)) return profile
          updatedCredentialProfiles++
          return {
            ...profile,
            tagIds: profile.tagIds.filter((id) => id !== tagId),
            updatedAt: Date.now(),
          }
        })

      const writtenAccounts =
        updatedAccounts > 0 || updatedBookmarks > 0
          ? transaction.write(
              ACCOUNTS_DOCUMENT_KEY,
              normalizeAccountsForPersistence({
                ...accountsDocument.data,
                accounts: nextAccounts,
                bookmarks: nextBookmarks,
              }),
              accountsDocument.revision,
            )
          : accountsDocument
      const writtenCredentialProfiles =
        updatedCredentialProfiles > 0
          ? transaction.write(
              API_CREDENTIAL_PROFILES_DOCUMENT_KEY,
              { profiles: nextCredentialProfiles },
              credentialProfilesDocument.revision,
            )
          : credentialProfilesDocument

      return {
        ...toResponse(writtenTags),
        accountsRevision: writtenAccounts.revision,
        credentialProfilesRevision: writtenCredentialProfiles.revision,
        updatedAccounts,
        updatedBookmarks,
        updatedCredentialProfiles,
      }
    })
  }
}

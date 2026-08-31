import { UI_CONSTANTS } from "~/constants/ui"
import {
  canonicalizeAccountStorageConfig,
  createDefaultAccountStorageConfig,
  normalizeAccountStorageConfigForWrite,
  normalizeSiteAccount,
} from "~/services/accounts/accountDefaults"
import {
  DELETED_ENTRY_KIND,
  type AccountStorageConfig,
  type SiteAccount,
  type SiteBookmark,
} from "~/types"
import { safeRandomUUID } from "~/utils/core/identifier"
import type {
  WebAccountBulkAction,
  WebAccountSummary,
  WebBookmarkCreateInput,
  WebBookmarkListResponse,
  WebBookmarkPatchInput,
  WebBookmarkSummary,
} from "~/web/contracts"

import {
  RevisionConflictError,
  type EncryptedDocumentStore,
  type VersionedDocument,
} from "./encryptedDocumentStore"

export const ACCOUNTS_DOCUMENT_KEY = "accounts"

export type VersionedAccountsDocument = VersionedDocument<AccountStorageConfig>
export { RevisionConflictError }

export class BookmarkNotFoundError extends Error {
  constructor() {
    super("Bookmark not found")
    this.name = "BookmarkNotFoundError"
  }
}

export class AccountNotFoundError extends Error {
  constructor(readonly accountIds: string[] = []) {
    super("Account not found")
    this.name = "AccountNotFoundError"
  }
}

export class InvalidAccountOrderError extends Error {
  constructor() {
    super("Account order must include every account exactly once")
    this.name = "InvalidAccountOrderError"
  }
}

export const normalizeAccountsDocument = (raw: unknown) => {
  const { config } = canonicalizeAccountStorageConfig(
    raw as AccountStorageConfig | undefined,
  )
  return {
    ...config,
    bookmarks: normalizeBookmarks(config.bookmarks),
  }
}

export const normalizeAccountsForPersistence = (
  next: AccountStorageConfig,
): AccountStorageConfig =>
  normalizeAccountStorageConfigForWrite({
    ...next,
    accounts: next.accounts.map(normalizeSiteAccount),
    bookmarks: normalizeBookmarks(next.bookmarks),
  })

export class AccountsRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  /** Shares the document store with repositories that must commit imports atomically. */
  getDocumentStore(): EncryptedDocumentStore {
    return this.store
  }

  getAccounts(): VersionedAccountsDocument {
    return this.readAccountsDocument()
  }

  getBookmarks(): VersionedAccountsDocument {
    return this.readAccountsDocument()
  }

  createBookmark(input: WebBookmarkCreateInput): VersionedAccountsDocument {
    return this.mutateAccounts((current) => {
      const now = Date.now()
      const existingIds = new Set([
        ...current.accounts.map((account) => account.id),
        ...current.bookmarks.map((bookmark) => bookmark.id),
      ])
      let id = safeRandomUUID("web-bookmark")
      while (existingIds.has(id)) id = safeRandomUUID("web-bookmark")
      const bookmark: SiteBookmark = {
        id,
        name: input.name.trim(),
        url: input.url.trim(),
        tagIds: normalizeBookmarkTagIds(input.tagIds),
        notes: input.notes?.trim() ?? "",
        created_at: now,
        updated_at: now,
      }
      return {
        ...current,
        bookmarks: [bookmark, ...current.bookmarks],
        orderedAccountIds: [
          id,
          ...current.orderedAccountIds.filter((entryId) => entryId !== id),
        ],
      }
    }, input.expectedRevision)
  }

  updateBookmark(
    id: string,
    input: WebBookmarkPatchInput,
  ): VersionedAccountsDocument {
    return this.mutateAccounts((current) => {
      const index = current.bookmarks.findIndex(
        (bookmark) => bookmark.id === id,
      )
      if (index < 0) throw new BookmarkNotFoundError()
      const now = Date.now()
      const bookmarks = [...current.bookmarks]
      const previous = bookmarks[index]
      bookmarks[index] = {
        ...previous,
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.url === undefined ? {} : { url: input.url.trim() }),
        ...(input.tagIds === undefined
          ? {}
          : { tagIds: normalizeBookmarkTagIds(input.tagIds) }),
        ...(input.notes === undefined ? {} : { notes: input.notes.trim() }),
        updated_at: now,
      }
      const pinnedAccountIds =
        input.pinned === true
          ? [
              id,
              ...current.pinnedAccountIds.filter((entryId) => entryId !== id),
            ]
          : input.pinned === false
            ? current.pinnedAccountIds.filter((entryId) => entryId !== id)
            : current.pinnedAccountIds
      return {
        ...current,
        bookmarks,
        pinnedAccountIds,
      }
    }, input.expectedRevision)
  }

  deleteBookmark(
    id: string,
    expectedRevision?: number,
  ): VersionedAccountsDocument {
    return this.mutateAccounts((current) => {
      const bookmark = current.bookmarks.find((item) => item.id === id)
      if (!bookmark) throw new BookmarkNotFoundError()
      const now = Date.now()
      return {
        ...current,
        bookmarks: current.bookmarks.filter((item) => item.id !== id),
        pinnedAccountIds: current.pinnedAccountIds.filter(
          (entryId) => entryId !== id,
        ),
        orderedAccountIds: current.orderedAccountIds.filter(
          (entryId) => entryId !== id,
        ),
        deletedEntryRecords: {
          ...current.deletedEntryRecords,
          [id]: {
            kind: DELETED_ENTRY_KIND.BOOKMARK,
            deletedAt: now,
            entryUpdatedAt: bookmark.updated_at,
          },
        },
      }
    }, expectedRevision)
  }

  mutateAccountStates(
    accountIds: string[],
    action: WebAccountBulkAction,
    expectedRevision?: number,
  ): VersionedAccountsDocument {
    return this.mutateAccounts((current) => {
      const selectedIds = new Set(accountIds)
      const existingIds = new Set(current.accounts.map((account) => account.id))
      const missingIds = accountIds.filter((id) => !existingIds.has(id))
      if (missingIds.length > 0) throw new AccountNotFoundError(missingIds)

      const now = Date.now()
      if (action !== "delete") {
        const disabled = action === "disable"
        return {
          ...current,
          accounts: current.accounts.map((account) =>
            selectedIds.has(account.id)
              ? {
                  ...account,
                  disabled,
                  updated_at: now,
                  user_updated_at: now,
                }
              : account,
          ),
        }
      }

      const deletedEntryRecords = { ...current.deletedEntryRecords }
      for (const account of current.accounts) {
        if (!selectedIds.has(account.id)) continue
        deletedEntryRecords[account.id] = {
          kind: DELETED_ENTRY_KIND.ACCOUNT,
          deletedAt: now,
          entryUpdatedAt: account.user_updated_at,
        }
      }

      return {
        ...current,
        accounts: current.accounts.filter(
          (account) => !selectedIds.has(account.id),
        ),
        pinnedAccountIds: current.pinnedAccountIds.filter(
          (id) => !selectedIds.has(id),
        ),
        orderedAccountIds: current.orderedAccountIds.filter(
          (id) => !selectedIds.has(id),
        ),
        deletedEntryRecords,
      }
    }, expectedRevision)
  }

  reorderAccounts(
    accountIds: string[],
    expectedRevision?: number,
  ): VersionedAccountsDocument {
    return this.mutateAccounts((current) => {
      const currentAccountIds = current.accounts.map((account) => account.id)
      const requestedIds = new Set(accountIds)
      if (
        accountIds.length !== currentAccountIds.length ||
        requestedIds.size !== accountIds.length ||
        currentAccountIds.some((id) => !requestedIds.has(id))
      ) {
        throw new InvalidAccountOrderError()
      }

      const accountIdSet = new Set(currentAccountIds)
      let nextAccountIndex = 0
      const orderedAccountIds = current.orderedAccountIds.map((id) =>
        accountIdSet.has(id) ? accountIds[nextAccountIndex++] : id,
      )
      orderedAccountIds.push(...accountIds.slice(nextAccountIndex))
      return { ...current, orderedAccountIds }
    }, expectedRevision)
  }

  replaceAccounts(
    raw: unknown,
    expectedRevision?: number,
  ): VersionedAccountsDocument {
    const { config } = canonicalizeAccountStorageConfig(
      raw as AccountStorageConfig | undefined,
    )
    return this.store.write(
      ACCOUNTS_DOCUMENT_KEY,
      normalizeAccountsForPersistence(config),
      expectedRevision,
    )
  }

  mutateAccounts(
    mutation: (current: AccountStorageConfig) => AccountStorageConfig,
    expectedRevision?: number,
  ): VersionedAccountsDocument {
    return this.store.mutate(
      ACCOUNTS_DOCUMENT_KEY,
      createDefaultAccountStorageConfig,
      normalizeAccountsDocument,
      (current) => normalizeAccountsForPersistence(mutation(current)),
      expectedRevision,
    )
  }

  private readAccountsDocument(): VersionedAccountsDocument {
    return this.store.read(
      ACCOUNTS_DOCUMENT_KEY,
      createDefaultAccountStorageConfig,
      normalizeAccountsDocument,
    )
  }
}

export function toWebAccountSummary(
  account: SiteAccount,
  pinned: boolean,
): WebAccountSummary {
  const normalized = normalizeSiteAccount(account)
  const balanceUsd =
    normalized.account_info.quota / UI_CONSTANTS.EXCHANGE_RATE.CONVERSION_FACTOR
  const todayConsumptionUsd =
    normalized.account_info.today_quota_consumption /
    UI_CONSTANTS.EXCHANGE_RATE.CONVERSION_FACTOR
  const todayIncomeUsd =
    normalized.account_info.today_income /
    UI_CONSTANTS.EXCHANGE_RATE.CONVERSION_FACTOR

  return {
    id: normalized.id,
    name: normalized.site_name,
    baseUrl: normalized.site_url,
    siteType: normalized.site_type,
    authType: normalized.authType,
    username: normalized.account_info.username,
    userId: normalized.account_info.id,
    disabled: normalized.disabled,
    pinned,
    tagIds: normalized.tagIds,
    notes: normalized.notes,
    health: normalized.health,
    balance: {
      USD: balanceUsd,
      CNY: balanceUsd * normalized.exchange_rate,
    },
    todayConsumption: {
      USD: todayConsumptionUsd,
      CNY: todayConsumptionUsd * normalized.exchange_rate,
    },
    todayIncome: {
      USD: todayIncomeUsd,
      CNY: todayIncomeUsd * normalized.exchange_rate,
    },
    lastSyncTime: normalized.last_sync_time,
    createdAt: normalized.created_at,
    exchangeRate: normalized.exchange_rate,
  }
}

export function toWebBookmarkSummary(
  bookmark: SiteBookmark,
  pinned: boolean,
): WebBookmarkSummary {
  return {
    id: bookmark.id,
    name: bookmark.name,
    url: bookmark.url,
    tagIds: normalizeBookmarkTagIds(bookmark.tagIds),
    notes: bookmark.notes,
    pinned,
    createdAt: bookmark.created_at,
    updatedAt: bookmark.updated_at,
  }
}

export function toWebBookmarkListResponse(
  document: VersionedAccountsDocument,
): WebBookmarkListResponse {
  const position = new Map(
    document.data.orderedAccountIds.map((id, index) => [id, index]),
  )
  const pinnedSet = new Set(document.data.pinnedAccountIds)
  const bookmarks = document.data.bookmarks
    .map((bookmark) =>
      toWebBookmarkSummary(bookmark, pinnedSet.has(bookmark.id)),
    )
    .sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
      const leftPosition = position.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightPosition = position.get(right.id) ?? Number.MAX_SAFE_INTEGER
      return leftPosition - rightPosition || left.name.localeCompare(right.name)
    })

  return {
    bookmarks,
    pinnedBookmarkIds: bookmarks
      .filter((bookmark) => bookmark.pinned)
      .map((bookmark) => bookmark.id),
    revision: document.revision,
    lastUpdated: document.data.last_updated,
  }
}

const normalizeBookmarkTagIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      )
    : []

const isHttpUrl = (value: string): boolean => {
  try {
    const protocol = new URL(value).protocol
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

function normalizeBookmarks(value: unknown): SiteBookmark[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const normalized: SiteBookmark[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const candidate = item as Partial<SiteBookmark>
    const id = typeof candidate.id === "string" ? candidate.id.trim() : ""
    const name = typeof candidate.name === "string" ? candidate.name.trim() : ""
    const url = typeof candidate.url === "string" ? candidate.url.trim() : ""
    if (!id || !name || !isHttpUrl(url) || seen.has(id)) continue
    seen.add(id)
    const createdAt =
      typeof candidate.created_at === "number" &&
      Number.isFinite(candidate.created_at)
        ? candidate.created_at
        : 0
    const updatedAt =
      typeof candidate.updated_at === "number" &&
      Number.isFinite(candidate.updated_at)
        ? candidate.updated_at
        : createdAt
    normalized.push({
      id,
      name,
      url,
      tagIds: normalizeBookmarkTagIds(candidate.tagIds),
      notes: typeof candidate.notes === "string" ? candidate.notes : "",
      created_at: createdAt,
      updated_at: updatedAt,
    })
  }
  return normalized
}

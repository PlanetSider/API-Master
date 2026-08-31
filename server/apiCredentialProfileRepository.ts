import { randomUUID } from "node:crypto"

import { API_TYPES } from "~/services/verification/aiApiVerification"
import type { ApiVerificationApiType } from "~/services/verification/aiApiVerification"
import {
  normalizeGoogleFamilyBaseUrl,
  normalizeOpenAiFamilyBaseUrl,
} from "~/services/verification/webAiApiCheck/credentialExtraction/baseUrlCandidates"
import { API_CREDENTIAL_PROFILES_CONFIG_VERSION } from "~/types/apiCredentialProfiles"
import type {
  WebApiCredentialProfileCreateInput,
  WebApiCredentialProfileListResponse,
  WebApiCredentialProfileSummary,
  WebApiCredentialProfileUpdateInput,
} from "~/web/contracts"

import type { EncryptedDocumentStore } from "./encryptedDocumentStore"

export const API_CREDENTIAL_PROFILES_DOCUMENT_KEY = "api-credential-profiles"

export interface StoredApiCredentialProfile {
  id: string
  name: string
  apiType: ApiVerificationApiType
  baseUrl: string
  apiKey: string
  tagIds: string[]
  notes: string
  expiresAt?: number
  createdAt: number
  updatedAt: number
}

export interface ApiCredentialProfilesDocument {
  profiles: StoredApiCredentialProfile[]
}

export class UnsupportedApiCredentialProfilesVersionError extends Error {
  constructor(readonly version: number) {
    super(`API credential profile backup version ${version} is not supported`)
    this.name = "UnsupportedApiCredentialProfilesVersionError"
  }
}

export const createEmptyApiCredentialProfilesDocument =
  (): ApiCredentialProfilesDocument => ({ profiles: [] })

const isApiType = (value: unknown): value is ApiVerificationApiType =>
  Object.values(API_TYPES).includes(value as ApiVerificationApiType)

const normalizeBaseUrl = (
  apiType: ApiVerificationApiType,
  value: string,
): string => {
  const normalized =
    apiType === API_TYPES.GOOGLE
      ? normalizeGoogleFamilyBaseUrl(value)
      : normalizeOpenAiFamilyBaseUrl(value)
  if (!normalized) throw new Error("Base URL is invalid")
  return normalized
}

const normalizeExpiresAt = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expiration date is invalid")
  }
  return Math.round(parsed)
}

const normalizeTagIds = (value: unknown): string[] =>
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

export const normalizeApiCredentialProfilesDocument = (
  value: unknown,
): ApiCredentialProfilesDocument => {
  if (!value || typeof value !== "object") {
    return createEmptyApiCredentialProfilesDocument()
  }
  const rawProfiles = (value as Partial<ApiCredentialProfilesDocument>).profiles
  if (!Array.isArray(rawProfiles)) {
    return createEmptyApiCredentialProfilesDocument()
  }

  const profiles: StoredApiCredentialProfile[] = []
  for (const item of rawProfiles) {
    if (!item || typeof item !== "object") continue
    const candidate = item as Partial<StoredApiCredentialProfile>
    if (
      !isApiType(candidate.apiType) ||
      typeof candidate.baseUrl !== "string" ||
      typeof candidate.apiKey !== "string" ||
      !candidate.apiKey.trim()
    ) {
      continue
    }
    let baseUrl: string
    try {
      baseUrl = normalizeBaseUrl(candidate.apiType, candidate.baseUrl)
    } catch {
      continue
    }
    const id =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : randomUUID()
    profiles.push({
      id,
      name:
        typeof candidate.name === "string" && candidate.name.trim()
          ? candidate.name.trim()
          : baseUrl,
      apiType: candidate.apiType,
      baseUrl,
      apiKey: candidate.apiKey.trim(),
      tagIds: normalizeTagIds(candidate.tagIds),
      notes: typeof candidate.notes === "string" ? candidate.notes.trim() : "",
      ...(typeof candidate.expiresAt === "number" && candidate.expiresAt > 0
        ? { expiresAt: Math.round(candidate.expiresAt) }
        : {}),
      createdAt:
        typeof candidate.createdAt === "number"
          ? candidate.createdAt
          : Date.now(),
      updatedAt:
        typeof candidate.updatedAt === "number"
          ? candidate.updatedAt
          : Date.now(),
    })
  }
  return { profiles }
}

export const normalizeExtensionApiCredentialProfiles = (
  value: unknown,
): ApiCredentialProfilesDocument => {
  if (value && typeof value === "object") {
    const version = (value as { version?: unknown }).version
    if (
      typeof version === "number" &&
      version > API_CREDENTIAL_PROFILES_CONFIG_VERSION
    ) {
      throw new UnsupportedApiCredentialProfilesVersionError(version)
    }
  }
  return normalizeApiCredentialProfilesDocument(value)
}

const getProfileIdentity = (profile: StoredApiCredentialProfile) =>
  `${profile.apiType}\u0000${profile.baseUrl}\u0000${profile.apiKey}`

export const mergeApiCredentialProfilesDocuments = (
  local: ApiCredentialProfilesDocument,
  incoming: ApiCredentialProfilesDocument,
): ApiCredentialProfilesDocument => {
  const profiles: StoredApiCredentialProfile[] = []
  const identityToIndex = new Map<string, number>()
  const usedIds = new Set<string>()

  for (const candidate of [...local.profiles, ...incoming.profiles]) {
    const identity = getProfileIdentity(candidate)
    const existingIndex = identityToIndex.get(identity)
    if (existingIndex !== undefined) {
      const existing = profiles[existingIndex]
      const newer =
        candidate.updatedAt >= existing.updatedAt ? candidate : existing
      const older = newer === candidate ? existing : candidate
      profiles[existingIndex] = {
        ...newer,
        id: existing.id,
        createdAt:
          Math.min(newer.createdAt || 0, older.createdAt || 0) ||
          newer.createdAt,
        tagIds: normalizeTagIds([...newer.tagIds, ...older.tagIds]),
      }
      continue
    }

    const profile = usedIds.has(candidate.id)
      ? { ...candidate, id: randomUUID() }
      : candidate
    usedIds.add(profile.id)
    identityToIndex.set(identity, profiles.length)
    profiles.push(profile)
  }

  return { profiles }
}

const maskApiKey = (apiKey: string) => {
  const value = apiKey.trim()
  if (value.length <= 8) return "••••••••"
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

export const toWebApiCredentialProfile = (
  profile: StoredApiCredentialProfile,
): WebApiCredentialProfileSummary => ({
  id: profile.id,
  name: profile.name,
  apiType: profile.apiType,
  baseUrl: profile.baseUrl,
  apiKeyMasked: maskApiKey(profile.apiKey),
  tagIds: profile.tagIds,
  notes: profile.notes,
  ...(profile.expiresAt !== undefined ? { expiresAt: profile.expiresAt } : {}),
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
})

export class ApiCredentialProfileRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  private readDocument() {
    return this.store.read(
      API_CREDENTIAL_PROFILES_DOCUMENT_KEY,
      createEmptyApiCredentialProfilesDocument,
      normalizeApiCredentialProfilesDocument,
    )
  }

  list(): WebApiCredentialProfileListResponse {
    const document = this.readDocument()
    return {
      profiles: document.data.profiles.map(toWebApiCredentialProfile),
      revision: document.revision,
    }
  }

  get(id: string): StoredApiCredentialProfile | undefined {
    return this.readDocument().data.profiles.find(
      (profile) => profile.id === id,
    )
  }

  create(input: WebApiCredentialProfileCreateInput) {
    const now = Date.now()
    const apiKey = input.apiKey.trim()
    if (!apiKey) throw new Error("API key is required")
    const profile: StoredApiCredentialProfile = {
      id: randomUUID(),
      name: input.name.trim(),
      apiType: input.apiType,
      baseUrl: normalizeBaseUrl(input.apiType, input.baseUrl),
      apiKey,
      tagIds: normalizeTagIds(input.tagIds),
      notes: input.notes?.trim() ?? "",
      ...(normalizeExpiresAt(input.expiresAt) !== undefined
        ? { expiresAt: normalizeExpiresAt(input.expiresAt) }
        : {}),
      createdAt: now,
      updatedAt: now,
    }
    this.store.mutate(
      API_CREDENTIAL_PROFILES_DOCUMENT_KEY,
      createEmptyApiCredentialProfilesDocument,
      normalizeApiCredentialProfilesDocument,
      (document) => ({ profiles: [...document.profiles, profile] }),
    )
    return this.list()
  }

  update(id: string, input: WebApiCredentialProfileUpdateInput) {
    const current = this.get(id)
    if (!current) throw new Error("API credential profile not found")
    const apiType = input.apiType ?? current.apiType
    const apiKey = input.apiKey?.trim() || current.apiKey
    const nextExpiresAt = normalizeExpiresAt(
      input.expiresAt === undefined ? current.expiresAt : input.expiresAt,
    )
    const next: StoredApiCredentialProfile = {
      ...current,
      name: input.name?.trim() || current.name,
      apiType,
      baseUrl: normalizeBaseUrl(apiType, input.baseUrl ?? current.baseUrl),
      apiKey,
      tagIds:
        input.tagIds === undefined
          ? current.tagIds
          : normalizeTagIds(input.tagIds),
      notes: input.notes === undefined ? current.notes : input.notes.trim(),
      ...(nextExpiresAt !== undefined ? { expiresAt: nextExpiresAt } : {}),
      updatedAt: Date.now(),
    }
    this.store.mutate(
      API_CREDENTIAL_PROFILES_DOCUMENT_KEY,
      createEmptyApiCredentialProfilesDocument,
      normalizeApiCredentialProfilesDocument,
      (document) => ({
        profiles: document.profiles.map((profile) =>
          profile.id === id ? next : profile,
        ),
      }),
    )
    return this.list()
  }

  delete(id: string) {
    this.store.mutate(
      API_CREDENTIAL_PROFILES_DOCUMENT_KEY,
      createEmptyApiCredentialProfilesDocument,
      normalizeApiCredentialProfilesDocument,
      (document) => ({
        profiles: document.profiles.filter((profile) => profile.id !== id),
      }),
    )
    return this.list()
  }
}

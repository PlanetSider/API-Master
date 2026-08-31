import type {
  WebDisplayPreferences,
  WebPreferencesPatch,
  WebPreferencesResponse,
  WebSortField,
  WebThemeMode,
} from "~/web/contracts"
import {
  WEB_CURRENCY_TYPES,
  WEB_SORT_FIELDS,
  WEB_SORT_ORDERS,
  WEB_THEME_MODES,
} from "~/web/contracts"

import type {
  EncryptedDocumentStore,
  VersionedDocument,
} from "./encryptedDocumentStore"

export const WEB_PREFERENCES_DOCUMENT_KEY = "web-preferences"

export interface WebPreferencesDocument {
  preferences: WebDisplayPreferences
  unsupportedExtensionKeys: string[]
}

const DEFAULT_WEB_PREFERENCES: WebDisplayPreferences = {
  themeMode: "system",
  currencyType: "USD",
  showTodayCashflow: true,
  sortField: "balance",
  sortOrder: "desc",
  showHealthStatus: true,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const isOneOf = <T>(value: unknown, values: readonly T[]): value is T =>
  values.includes(value as T)

const normalizeUnsupportedKeys = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter((item) => item.length > 0 && item.length <= 128),
        ),
      ).slice(0, 256)
    : []

const SUPPORTED_EXTENSION_KEYS = new Set([
  "themeMode",
  "language",
  "currencyType",
  "showTodayCashflow",
  "sortField",
  "sortOrder",
  "showHealthStatus",
  // These extension preferences are migrated into automation-settings.
  "accountAutoRefresh",
  "autoRefresh",
  "refreshInterval",
  "autoCheckin",
  "balanceHistory",
  "usageHistory",
  "siteAnnouncementNotifications",
])

const normalizePreferencesValue = (value: unknown): WebDisplayPreferences => {
  const source = isRecord(value) ? value : {}
  const sortField = isOneOf(source.sortField, WEB_SORT_FIELDS)
    ? (source.sortField as WebSortField)
    : DEFAULT_WEB_PREFERENCES.sortField
  const themeMode = isOneOf(source.themeMode, WEB_THEME_MODES)
    ? (source.themeMode as WebThemeMode)
    : DEFAULT_WEB_PREFERENCES.themeMode

  return {
    themeMode,
    ...(typeof source.language === "string" && source.language.trim()
      ? { language: source.language.trim().slice(0, 64) }
      : {}),
    currencyType: isOneOf(source.currencyType, WEB_CURRENCY_TYPES)
      ? source.currencyType
      : DEFAULT_WEB_PREFERENCES.currencyType,
    showTodayCashflow: source.showTodayCashflow !== false,
    sortField,
    sortOrder: isOneOf(source.sortOrder, WEB_SORT_ORDERS)
      ? source.sortOrder
      : DEFAULT_WEB_PREFERENCES.sortOrder,
    showHealthStatus: source.showHealthStatus !== false,
  }
}

const extractPreferenceObject = (raw: unknown): Record<string, unknown> => {
  if (!isRecord(raw)) return {}
  if (isRecord(raw.preferences)) return raw.preferences
  if (isRecord(raw.data) && isRecord(raw.data.preferences)) {
    return raw.data.preferences
  }
  return raw
}

/** Locates extension preferences without reading extension storage APIs. */
export function extractExtensionPreferences(raw: unknown): {
  present: boolean
  value: Record<string, unknown>
} {
  if (!isRecord(raw)) return { present: false, value: {} }
  if (Object.prototype.hasOwnProperty.call(raw, "preferences")) {
    return { present: true, value: extractPreferenceObject(raw.preferences) }
  }
  if (
    isRecord(raw.data) &&
    Object.prototype.hasOwnProperty.call(raw.data, "preferences")
  ) {
    return { present: true, value: extractPreferenceObject(raw.data) }
  }
  if (raw.type === "preferences") {
    return { present: true, value: extractPreferenceObject(raw) }
  }
  return { present: false, value: {} }
}

/** Normalizes a raw document while retaining only non-secret diagnostic keys. */
export const normalizeWebPreferencesDocument = (
  value: unknown,
): WebPreferencesDocument => {
  const source = isRecord(value) ? value : {}
  const rawPreferences = isRecord(source.preferences)
    ? source.preferences
    : source
  const unsupported = normalizeUnsupportedKeys(source.unsupportedExtensionKeys)
  return {
    preferences: normalizePreferencesValue(rawPreferences),
    unsupportedExtensionKeys: unsupported,
  }
}

export const createDefaultWebPreferencesDocument =
  (): WebPreferencesDocument => ({
    preferences: { ...DEFAULT_WEB_PREFERENCES },
    unsupportedExtensionKeys: [],
  })

const toResponse = (
  document: VersionedDocument<WebPreferencesDocument>,
): WebPreferencesResponse => ({
  preferences: document.data.preferences,
  revision: document.revision,
  updatedAt: document.updatedAt,
  unsupportedExtensionKeys: document.data.unsupportedExtensionKeys,
})

export type VersionedWebPreferences = VersionedDocument<WebPreferencesDocument>

export class WebPreferencesRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  get(): WebPreferencesResponse {
    return toResponse(this.getDocument())
  }

  getDocument(): VersionedWebPreferences {
    return this.store.read(
      WEB_PREFERENCES_DOCUMENT_KEY,
      createDefaultWebPreferencesDocument,
      normalizeWebPreferencesDocument,
    )
  }

  update(input: WebPreferencesPatch): WebPreferencesResponse {
    const document = this.store.mutate(
      WEB_PREFERENCES_DOCUMENT_KEY,
      createDefaultWebPreferencesDocument,
      normalizeWebPreferencesDocument,
      (current) => ({
        ...current,
        preferences: normalizePreferencesValue({
          ...current.preferences,
          ...input,
        }),
      }),
      input.expectedRevision,
    )
    return toResponse(document)
  }

  /** Builds an import document and records ignored extension-only fields. */
  normalizeExtensionImport(raw: unknown): WebPreferencesDocument {
    const preferences = extractPreferenceObject(raw)
    return {
      preferences: normalizePreferencesValue(preferences),
      unsupportedExtensionKeys: Object.keys(preferences)
        .filter((key) => !SUPPORTED_EXTENSION_KEYS.has(key))
        .sort()
        .slice(0, 256),
    }
  }
}

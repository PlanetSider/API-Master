import { isManagedSiteType } from "~/constants/siteType"
import { sanitizeChannelFiltersForStorage } from "~/services/managedSites/channelModelFilterRules"
import {
  CHANNEL_CONFIG_SNAPSHOT_VERSION,
  type ChannelConfigSnapshot,
  type ChannelResourceConfig,
} from "~/types/channelConfig"
import {
  createManagedUpstreamResourceRef,
  getManagedUpstreamResourceRefKey,
  normalizeManagedUpstreamResourceScopeKey,
  type ManagedUpstreamResourceRef,
} from "~/types/managedUpstreamResource"
import type {
  WebChannelConfigPatch,
  WebChannelConfigResponse,
} from "~/web/contracts"

import type {
  EncryptedDocumentStore,
  VersionedDocument,
} from "./encryptedDocumentStore"

export const WEB_CHANNEL_CONFIG_DOCUMENT_KEY = "channel-configs"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const positiveTimestamp = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback

const normalizeResourceRef = (
  value: unknown,
): ManagedUpstreamResourceRef | null => {
  if (!isRecord(value)) return null
  if (
    !isManagedSiteType(value.managedSiteType) ||
    typeof value.scopeKey !== "string" ||
    !value.scopeKey.trim() ||
    (typeof value.resourceId !== "string" &&
      typeof value.resourceId !== "number")
  ) {
    return null
  }
  const resourceId = String(value.resourceId).trim()
  if (!resourceId) return null
  return createManagedUpstreamResourceRef({
    managedSiteType: value.managedSiteType,
    scopeKey: normalizeManagedUpstreamResourceScopeKey(value.scopeKey),
    resourceId,
  })
}

const normalizeResourceConfig = (
  value: unknown,
  fallbackTimestamp = Date.now(),
): ChannelResourceConfig | null => {
  if (!isRecord(value)) return null
  const resourceRef = normalizeResourceRef(value.resourceRef)
  if (!resourceRef) return null
  const createdAt = positiveTimestamp(value.createdAt, fallbackTimestamp)
  const updatedAt = Math.max(
    createdAt,
    positiveTimestamp(value.updatedAt, fallbackTimestamp),
  )
  const settings = isRecord(value.modelFilterSettings)
    ? value.modelFilterSettings
    : {}
  const rules = sanitizeChannelFiltersForStorage(settings.rules, {
    idPrefix: "channel-filter",
    now: fallbackTimestamp,
  })
  const ruleUpdatedAt = rules.reduce(
    (latest, rule) => Math.max(latest, rule.updatedAt),
    fallbackTimestamp,
  )
  const channelId =
    typeof value.channelId === "number" &&
    Number.isSafeInteger(value.channelId) &&
    value.channelId > 0
      ? value.channelId
      : undefined
  return {
    resourceRef,
    ...(channelId === undefined ? {} : { channelId }),
    modelFilterSettings: {
      rules,
      updatedAt: Math.max(
        positiveTimestamp(settings.updatedAt, fallbackTimestamp),
        ruleUpdatedAt,
      ),
    },
    createdAt,
    updatedAt: Math.max(updatedAt, ruleUpdatedAt),
  }
}

const readRawConfigs = (raw: unknown): unknown[] => {
  if (!isRecord(raw)) return []
  if (isRecord(raw.configs)) return Object.values(raw.configs)
  return Object.values(raw)
}

/** Validates and canonically rekeys scoped channel configurations. */
export const normalizeChannelConfigSnapshot = (
  raw: unknown,
): ChannelConfigSnapshot => {
  const fallbackTimestamp = Date.now()
  const configs: Record<string, ChannelResourceConfig> = {}
  for (const value of readRawConfigs(raw)) {
    const config = normalizeResourceConfig(value, fallbackTimestamp)
    if (!config) continue
    configs[getManagedUpstreamResourceRefKey(config.resourceRef)] = config
  }
  return {
    schemaVersion: CHANNEL_CONFIG_SNAPSHOT_VERSION,
    configs,
  }
}

/** Strict import check: reject malformed current snapshots, accept old empty maps. */
export const coerceChannelConfigSnapshot = (
  raw: unknown,
): ChannelConfigSnapshot | null => {
  if (!isRecord(raw)) return null
  if (
    raw.schemaVersion !== undefined &&
    raw.schemaVersion !== CHANNEL_CONFIG_SNAPSHOT_VERSION
  ) {
    return null
  }
  const values = readRawConfigs(raw)
  if (
    raw.schemaVersion === CHANNEL_CONFIG_SNAPSHOT_VERSION &&
    !isRecord(raw.configs)
  ) {
    return null
  }
  const snapshot = normalizeChannelConfigSnapshot(raw)
  if (
    raw.schemaVersion === CHANNEL_CONFIG_SNAPSHOT_VERSION &&
    values.length > 0 &&
    Object.keys(snapshot.configs).length === 0
  ) {
    return null
  }
  return snapshot
}

const normalizeDocument = (value: unknown): ChannelConfigSnapshot =>
  coerceChannelConfigSnapshot(value) ?? {
    schemaVersion: CHANNEL_CONFIG_SNAPSHOT_VERSION,
    configs: {},
  }

const createDefaultSnapshot = (): ChannelConfigSnapshot => ({
  schemaVersion: CHANNEL_CONFIG_SNAPSHOT_VERSION,
  configs: {},
})

export type VersionedChannelConfigDocument =
  VersionedDocument<ChannelConfigSnapshot>

const toResponse = (
  document: VersionedChannelConfigDocument,
): WebChannelConfigResponse => ({
  snapshot: document.data,
  revision: document.revision,
  updatedAt: document.updatedAt,
})

export class ChannelConfigRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  get(): WebChannelConfigResponse {
    return toResponse(this.getDocument())
  }

  getDocument(): VersionedChannelConfigDocument {
    return this.store.read(
      WEB_CHANNEL_CONFIG_DOCUMENT_KEY,
      createDefaultSnapshot,
      normalizeDocument,
    )
  }

  replaceSnapshot(
    snapshot: ChannelConfigSnapshot,
    expectedRevision?: number,
  ): WebChannelConfigResponse {
    const normalized = coerceChannelConfigSnapshot(snapshot)
    if (!normalized) throw new Error("Channel config snapshot is invalid")
    return toResponse(
      this.store.write(
        WEB_CHANNEL_CONFIG_DOCUMENT_KEY,
        normalized,
        expectedRevision,
      ),
    )
  }

  upsert(input: WebChannelConfigPatch): WebChannelConfigResponse {
    const resourceRef = createManagedUpstreamResourceRef({
      managedSiteType: input.managedSiteType,
      scopeKey: input.scopeKey,
      resourceId: input.resourceId,
    })
    const fallback = Date.now()
    const currentConfig = normalizeResourceConfig(
      {
        resourceRef,
        channelId: input.channelId,
        modelFilterSettings: { rules: input.rules, updatedAt: fallback },
        createdAt: fallback,
        updatedAt: fallback,
      },
      fallback,
    )
    if (!currentConfig) throw new Error("Channel config is invalid")
    const key = getManagedUpstreamResourceRefKey(resourceRef)
    return toResponse(
      this.store.mutate(
        WEB_CHANNEL_CONFIG_DOCUMENT_KEY,
        createDefaultSnapshot,
        normalizeDocument,
        (current) => ({
          schemaVersion: CHANNEL_CONFIG_SNAPSHOT_VERSION,
          configs: { ...current.configs, [key]: currentConfig },
        }),
        input.expectedRevision,
      ),
    )
  }

  /** Builds a canonical snapshot for extension-backup import. */
  normalizeExtensionImport(raw: unknown): ChannelConfigSnapshot | null {
    if (!isRecord(raw)) return null
    const section = Object.prototype.hasOwnProperty.call(raw, "channelConfigs")
      ? raw.channelConfigs
      : isRecord(raw.data) &&
          Object.prototype.hasOwnProperty.call(raw.data, "channelConfigs")
        ? raw.data.channelConfigs
        : undefined
    if (section === undefined) return null
    return coerceChannelConfigSnapshot(section)
  }
}

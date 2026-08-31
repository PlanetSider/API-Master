import { createHash } from "node:crypto"

import {
  isAccountSiteType,
  SITE_TYPES,
  type AccountSiteType,
} from "~/constants/siteType"
import type {
  SiteAnnouncementIdentityMarker,
  SiteAnnouncementProviderId,
  SiteAnnouncementRecord,
  SiteAnnouncementRecordInput,
  SiteAnnouncementSiteState,
  SiteAnnouncementStatus,
  SiteAnnouncementStoreState,
} from "~/types/siteAnnouncements"
import {
  SITE_ANNOUNCEMENT_PROVIDER_IDS,
  SITE_ANNOUNCEMENT_STATUS,
} from "~/types/siteAnnouncements"
import { safeRandomUUID } from "~/utils/core/identifier"
import type {
  WebSiteAnnouncementListResponse,
  WebSiteAnnouncementRecord,
  WebSiteAnnouncementSiteState,
} from "~/web/contracts"

import type {
  EncryptedDocumentStore,
  VersionedDocument,
} from "./encryptedDocumentStore"

const DOCUMENT_KEY = "site-announcements"
const SCHEMA_VERSION = 2
const MAX_RECORDS_PER_SITE = 100
const MAX_IDENTITIES_PER_SITE = 1_000
const MAX_IDENTITIES_TOTAL = 10_000

export type VersionedSiteAnnouncements =
  VersionedDocument<SiteAnnouncementStoreState>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const providerId = (value: unknown): SiteAnnouncementProviderId =>
  value === SITE_ANNOUNCEMENT_PROVIDER_IDS.Sub2Api
    ? SITE_ANNOUNCEMENT_PROVIDER_IDS.Sub2Api
    : SITE_ANNOUNCEMENT_PROVIDER_IDS.Common

const siteType = (value: unknown): AccountSiteType =>
  isAccountSiteType(value) ? value : SITE_TYPES.UNKNOWN

const status = (value: unknown): SiteAnnouncementStatus =>
  value === SITE_ANNOUNCEMENT_STATUS.Success ||
  value === SITE_ANNOUNCEMENT_STATUS.Error ||
  value === SITE_ANNOUNCEMENT_STATUS.Unsupported
    ? value
    : SITE_ANNOUNCEMENT_STATUS.Never

const createEmptyState = (): SiteAnnouncementStoreState => ({
  schemaVersion: SCHEMA_VERSION,
  sites: {},
  identityLedger: {},
})

const normalizeRecord = (value: unknown): SiteAnnouncementRecord | null => {
  if (!isRecord(value)) return null
  const id = typeof value.id === "string" ? value.id.trim() : ""
  const siteKey = typeof value.siteKey === "string" ? value.siteKey.trim() : ""
  const fingerprint =
    typeof value.fingerprint === "string" ? value.fingerprint.trim() : ""
  if (!id || !siteKey || !fingerprint) return null

  const firstSeenAt = finite(value.firstSeenAt) ? value.firstSeenAt : Date.now()
  const lastSeenAt = finite(value.lastSeenAt) ? value.lastSeenAt : firstSeenAt
  const readAt = finite(value.readAt) ? value.readAt : undefined
  return {
    id,
    siteKey,
    siteName: typeof value.siteName === "string" ? value.siteName : "",
    siteType: siteType(value.siteType),
    baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : "",
    accountId: typeof value.accountId === "string" ? value.accountId : "",
    providerId: providerId(value.providerId),
    upstreamId:
      typeof value.upstreamId === "string" ? value.upstreamId : undefined,
    title: typeof value.title === "string" ? value.title : "",
    content: typeof value.content === "string" ? value.content : "",
    fingerprint,
    firstSeenAt,
    lastSeenAt,
    createdAt: finite(value.createdAt) ? value.createdAt : undefined,
    updatedAt: finite(value.updatedAt) ? value.updatedAt : undefined,
    notifiedAt: finite(value.notifiedAt) ? value.notifiedAt : undefined,
    notificationError:
      typeof value.notificationError === "string"
        ? value.notificationError
        : undefined,
    read: value.read === true || readAt !== undefined,
    readAt,
  }
}

const normalizeSite = (
  key: string,
  value: unknown,
): SiteAnnouncementSiteState | null => {
  if (!key || !isRecord(value)) return null
  const records = Array.isArray(value.records)
    ? value.records
        .map(normalizeRecord)
        .filter((record): record is SiteAnnouncementRecord => Boolean(record))
        .slice(0, MAX_RECORDS_PER_SITE)
    : []
  return {
    siteKey: key,
    siteName: typeof value.siteName === "string" ? value.siteName : "",
    siteType: siteType(value.siteType),
    baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : "",
    accountId: typeof value.accountId === "string" ? value.accountId : "",
    providerId: providerId(value.providerId),
    status: status(value.status),
    lastCheckedAt: finite(value.lastCheckedAt)
      ? value.lastCheckedAt
      : undefined,
    lastSuccessAt: finite(value.lastSuccessAt)
      ? value.lastSuccessAt
      : undefined,
    lastError:
      typeof value.lastError === "string" ? value.lastError : undefined,
    lastNotifiedFingerprint:
      typeof value.lastNotifiedFingerprint === "string"
        ? value.lastNotifiedFingerprint
        : undefined,
    records,
  }
}

const normalizeMarker = (
  value: unknown,
): SiteAnnouncementIdentityMarker | null => {
  if (
    !isRecord(value) ||
    !finite(value.firstSeenAt) ||
    !finite(value.lastSeenAt)
  ) {
    return null
  }
  return {
    firstSeenAt: value.firstSeenAt,
    lastSeenAt: value.lastSeenAt,
    ...(finite(value.readAt) ? { readAt: value.readAt } : {}),
  }
}

const normalizeState = (value: unknown): SiteAnnouncementStoreState => {
  if (!isRecord(value)) return createEmptyState()
  const sites: Record<string, SiteAnnouncementSiteState> = {}
  if (isRecord(value.sites)) {
    for (const [key, item] of Object.entries(value.sites)) {
      const normalized = normalizeSite(key, item)
      if (normalized) sites[key] = normalized
    }
  }

  const identityLedger: SiteAnnouncementStoreState["identityLedger"] = {}
  if (isRecord(value.identityLedger)) {
    for (const [siteKey, rawMarkers] of Object.entries(value.identityLedger)) {
      if (!isRecord(rawMarkers)) continue
      const markers: Record<string, SiteAnnouncementIdentityMarker> = {}
      for (const [digest, marker] of Object.entries(rawMarkers)) {
        const normalized = normalizeMarker(marker)
        if (normalized && /^[0-9a-f]{64}$/u.test(digest)) {
          markers[digest] = normalized
        }
      }
      if (Object.keys(markers).length > 0) identityLedger[siteKey] = markers
    }
  }

  // Rebuild missing identity entries so read state survives record retention.
  for (const [siteKey, site] of Object.entries(sites)) {
    const markers = (identityLedger[siteKey] ??= {})
    for (const record of site.records) {
      const digest = digestFingerprint(record.fingerprint)
      const current = markers[digest]
      markers[digest] = {
        firstSeenAt: current?.firstSeenAt ?? record.firstSeenAt,
        lastSeenAt: Math.max(current?.lastSeenAt ?? 0, record.lastSeenAt),
        ...(current?.readAt !== undefined || record.readAt !== undefined
          ? { readAt: current?.readAt ?? record.readAt }
          : {}),
      }
      const readAt = markers[digest].readAt
      if (readAt !== undefined) {
        record.read = true
        record.readAt = readAt
      }
    }
  }

  return { schemaVersion: SCHEMA_VERSION, sites, identityLedger }
}

const digestFingerprint = (fingerprint: string) =>
  createHash("sha256").update(fingerprint, "utf8").digest("hex")

const pruneLedger = (ledger: SiteAnnouncementStoreState["identityLedger"]) => {
  const result: SiteAnnouncementStoreState["identityLedger"] = {}
  const all: Array<{
    siteKey: string
    digest: string
    marker: SiteAnnouncementIdentityMarker
  }> = []
  for (const [siteKey, markers] of Object.entries(ledger)) {
    const entries = Object.entries(markers)
      .sort(([, left], [, right]) => left.lastSeenAt - right.lastSeenAt)
      .slice(-MAX_IDENTITIES_PER_SITE)
    for (const [digest, marker] of entries) {
      all.push({ siteKey, digest, marker })
    }
  }
  for (const entry of all
    .sort((left, right) => left.marker.lastSeenAt - right.marker.lastSeenAt)
    .slice(-MAX_IDENTITIES_TOTAL)) {
    ;(result[entry.siteKey] ??= {})[entry.digest] = entry.marker
  }
  return result
}

const toWebRecord = (
  record: SiteAnnouncementRecord,
): WebSiteAnnouncementRecord => ({
  ...record,
})

const toWebSite = (
  site: SiteAnnouncementSiteState,
): WebSiteAnnouncementSiteState => ({
  ...site,
  records: site.records.map(toWebRecord),
})

export class SiteAnnouncementRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  get(): VersionedSiteAnnouncements {
    return this.store.read(DOCUMENT_KEY, createEmptyState, normalizeState)
  }

  toResponse(
    document: VersionedSiteAnnouncements = this.get(),
  ): WebSiteAnnouncementListResponse {
    const sites = Object.values(document.data.sites)
      .map(toWebSite)
      .sort(
        (left, right) => (right.lastCheckedAt ?? 0) - (left.lastCheckedAt ?? 0),
      )
    const records = sites
      .flatMap((site) => site.records)
      .sort((left, right) => right.firstSeenAt - left.firstSeenAt)
    return {
      sites,
      records,
      unreadCount: records.filter((record) => !record.read).length,
      revision: document.revision,
      lastUpdated: document.updatedAt,
    }
  }

  upsertSiteStatus(site: Omit<SiteAnnouncementSiteState, "records">) {
    return this.store.mutate(
      DOCUMENT_KEY,
      createEmptyState,
      normalizeState,
      (current) => ({
        ...current,
        sites: {
          ...current.sites,
          [site.siteKey]: {
            ...current.sites[site.siteKey],
            ...site,
            records: current.sites[site.siteKey]?.records ?? [],
          },
        },
      }),
    )
  }

  upsertDiscoveredRecords(params: {
    site: Omit<SiteAnnouncementSiteState, "records">
    records: SiteAnnouncementRecordInput[]
    now?: number
  }): {
    document: VersionedSiteAnnouncements
    created: SiteAnnouncementRecord[]
  } {
    const now = params.now ?? Date.now()
    const created: SiteAnnouncementRecord[] = []
    const document = this.store.mutate(
      DOCUMENT_KEY,
      createEmptyState,
      normalizeState,
      (current) => {
        const site = current.sites[params.site.siteKey]
        const records = [...(site?.records ?? [])]
        const markers = (current.identityLedger[params.site.siteKey] ??= {})
        for (const input of params.records) {
          if (!input.fingerprint) continue
          const digest = digestFingerprint(input.fingerprint)
          const marker = markers[digest]
          const existing = records.find(
            (record) => record.fingerprint === input.fingerprint,
          )
          if (marker) {
            marker.lastSeenAt = Math.max(marker.lastSeenAt, now)
            const target = existing
            if (target) {
              Object.assign(target, input, {
                id: target.id,
                firstSeenAt: marker.firstSeenAt,
                lastSeenAt: marker.lastSeenAt,
                read: marker.readAt !== undefined,
                readAt: marker.readAt,
              })
            } else {
              records.push({
                ...input,
                id: safeRandomUUID("site-announcement"),
                firstSeenAt: marker.firstSeenAt,
                lastSeenAt: marker.lastSeenAt,
                read: marker.readAt !== undefined,
                readAt: marker.readAt,
              })
            }
            continue
          }

          const readAt = input.readAt
          markers[digest] = {
            firstSeenAt: now,
            lastSeenAt: now,
            ...(readAt !== undefined ? { readAt } : {}),
          }
          const record: SiteAnnouncementRecord = {
            ...input,
            id: safeRandomUUID("site-announcement"),
            firstSeenAt: now,
            lastSeenAt: now,
            read: readAt !== undefined,
            readAt,
          }
          records.push(record)
          if (readAt === undefined) created.push(record)
        }
        records.sort((left, right) => right.firstSeenAt - left.firstSeenAt)
        current.sites[params.site.siteKey] = {
          ...site,
          ...params.site,
          records: records.slice(0, MAX_RECORDS_PER_SITE),
        }
        current.identityLedger = pruneLedger(current.identityLedger)
        return current
      },
    )
    return { document, created }
  }

  getRecord(recordId: string): SiteAnnouncementRecord | undefined {
    return Object.values(this.get().data.sites)
      .flatMap((site) => site.records)
      .find((record) => record.id === recordId)
  }

  markRead(recordId: string) {
    return this.store.mutate(
      DOCUMENT_KEY,
      createEmptyState,
      normalizeState,
      (current) => {
        for (const site of Object.values(current.sites)) {
          const record = site.records.find((item) => item.id === recordId)
          if (!record || record.read) continue
          const now = Date.now()
          record.read = true
          record.readAt = now
          const markers = (current.identityLedger[site.siteKey] ??= {})
          const marker = (markers[digestFingerprint(record.fingerprint)] ??= {
            firstSeenAt: record.firstSeenAt,
            lastSeenAt: record.lastSeenAt,
          })
          marker.readAt = now
          return current
        }
        return current
      },
    )
  }

  markAllRead(siteKey?: string) {
    return this.store.mutate(
      DOCUMENT_KEY,
      createEmptyState,
      normalizeState,
      (current) => {
        const now = Date.now()
        for (const [key, site] of Object.entries(current.sites)) {
          if (siteKey && key !== siteKey) continue
          const markers = (current.identityLedger[key] ??= {})
          for (const record of site.records) {
            record.read = true
            record.readAt = record.readAt ?? now
            const marker = (markers[digestFingerprint(record.fingerprint)] ??= {
              firstSeenAt: record.firstSeenAt,
              lastSeenAt: record.lastSeenAt,
            })
            marker.readAt = record.readAt
          }
        }
        return current
      },
    )
  }
}

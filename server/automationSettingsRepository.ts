import type {
  WebAutomationRunSummary,
  WebAutomationSettings,
  WebAutomationSettingsPatch,
  WebCheckInRunSummary,
} from "~/web/contracts"

import type {
  EncryptedDocumentStore,
  VersionedDocument,
} from "./encryptedDocumentStore"

export const AUTOMATION_DOCUMENT_KEY = "automation-settings"
const MIN_REFRESH_INTERVAL_MINUTES = 5
const MAX_REFRESH_INTERVAL_MINUTES = 24 * 60
const MIN_SITE_ANNOUNCEMENT_INTERVAL_MINUTES = 15
const MAX_SITE_ANNOUNCEMENT_INTERVAL_MINUTES = 24 * 60

export interface AutomationSettingsDocument {
  settings: WebAutomationSettings
  lastRun?: WebAutomationRunSummary
  lastCheckInRun?: WebCheckInRunSummary
}

export type VersionedAutomationSettings =
  VersionedDocument<AutomationSettingsDocument>

export const createDefaultAutomationSettings =
  (): AutomationSettingsDocument => ({
    settings: {
      autoRefreshEnabled: false,
      autoRefreshIntervalMinutes: 30,
      includeTodayCashflow: true,
      autoCheckinEnabled: false,
      autoCheckinTime: "09:00",
      balanceHistoryEnabled: true,
      balanceHistoryRetentionDays: 365,
      usageHistoryEnabled: true,
      usageHistoryRetentionDays: 7,
      usageHistoryAfterRefresh: true,
      siteAnnouncementsEnabled: false,
      siteAnnouncementsIntervalMinutes: 360,
      siteAnnouncementNotificationsEnabled: true,
    },
  })

const normalizeInterval = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 30
  return Math.min(
    MAX_REFRESH_INTERVAL_MINUTES,
    Math.max(MIN_REFRESH_INTERVAL_MINUTES, Math.round(value)),
  )
}

const normalizeRunSummary = (
  value: unknown,
): WebAutomationRunSummary | undefined => {
  if (!value || typeof value !== "object") return undefined
  const summary = value as Partial<WebAutomationRunSummary>
  const validStatus = ["completed", "revision_conflict", "failed"].includes(
    summary.status ?? "",
  )
  const validTrigger = ["manual", "scheduled"].includes(summary.trigger ?? "")
  if (
    !validStatus ||
    !validTrigger ||
    typeof summary.startedAt !== "number" ||
    typeof summary.finishedAt !== "number"
  ) {
    return undefined
  }

  return {
    trigger: summary.trigger as WebAutomationRunSummary["trigger"],
    status: summary.status as WebAutomationRunSummary["status"],
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    total: Number(summary.total) || 0,
    succeeded: Number(summary.succeeded) || 0,
    failed: Number(summary.failed) || 0,
    skipped: Number(summary.skipped) || 0,
  }
}

export const normalizeAutomationDocument = (
  value: unknown,
): AutomationSettingsDocument => {
  const raw =
    value && typeof value === "object"
      ? (value as Partial<AutomationSettingsDocument>)
      : {}
  const settings = raw.settings ?? ({} as Partial<WebAutomationSettings>)

  return {
    settings: {
      autoRefreshEnabled: settings.autoRefreshEnabled === true,
      autoRefreshIntervalMinutes: normalizeInterval(
        settings.autoRefreshIntervalMinutes,
      ),
      includeTodayCashflow: settings.includeTodayCashflow !== false,
      autoCheckinEnabled: settings.autoCheckinEnabled === true,
      autoCheckinTime:
        typeof settings.autoCheckinTime === "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/u.test(settings.autoCheckinTime)
          ? settings.autoCheckinTime
          : "09:00",
      balanceHistoryEnabled: settings.balanceHistoryEnabled !== false,
      balanceHistoryRetentionDays:
        typeof settings.balanceHistoryRetentionDays === "number" &&
        Number.isFinite(settings.balanceHistoryRetentionDays)
          ? Math.min(
              3650,
              Math.max(7, Math.round(settings.balanceHistoryRetentionDays)),
            )
          : 365,
      usageHistoryEnabled: settings.usageHistoryEnabled !== false,
      usageHistoryRetentionDays:
        typeof settings.usageHistoryRetentionDays === "number" &&
        Number.isFinite(settings.usageHistoryRetentionDays)
          ? Math.min(
              365,
              Math.max(1, Math.round(settings.usageHistoryRetentionDays)),
            )
          : 7,
      usageHistoryAfterRefresh: settings.usageHistoryAfterRefresh !== false,
      siteAnnouncementsEnabled: settings.siteAnnouncementsEnabled === true,
      siteAnnouncementsIntervalMinutes:
        typeof settings.siteAnnouncementsIntervalMinutes === "number" &&
        Number.isFinite(settings.siteAnnouncementsIntervalMinutes)
          ? Math.min(
              MAX_SITE_ANNOUNCEMENT_INTERVAL_MINUTES,
              Math.max(
                MIN_SITE_ANNOUNCEMENT_INTERVAL_MINUTES,
                Math.round(settings.siteAnnouncementsIntervalMinutes),
              ),
            )
          : 360,
      siteAnnouncementNotificationsEnabled:
        settings.siteAnnouncementNotificationsEnabled !== false,
    },
    ...(normalizeRunSummary(raw.lastRun)
      ? { lastRun: normalizeRunSummary(raw.lastRun) }
      : {}),
    ...(raw.lastCheckInRun ? { lastCheckInRun: raw.lastCheckInRun } : {}),
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const asFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined

const asTime = (value: unknown): string | undefined =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/u.test(value)
    ? value
    : undefined

/**
 * Converts extension-only preference names into the server scheduler contract.
 * Secrets and browser-specific settings are intentionally ignored.
 */
export const normalizeExtensionAutomationPatch = (
  raw: unknown,
): WebAutomationSettingsPatch => {
  if (!isRecord(raw)) return {}

  const accountAutoRefresh = isRecord(raw.accountAutoRefresh)
    ? raw.accountAutoRefresh
    : {}
  const usageHistory = isRecord(raw.usageHistory) ? raw.usageHistory : {}
  const balanceHistory = isRecord(raw.balanceHistory) ? raw.balanceHistory : {}
  const autoCheckin = isRecord(raw.autoCheckin) ? raw.autoCheckin : {}
  const announcements = isRecord(raw.siteAnnouncementNotifications)
    ? raw.siteAnnouncementNotifications
    : {}
  const patch: WebAutomationSettingsPatch = {}

  const autoRefreshEnabled =
    asBoolean(accountAutoRefresh.enabled) ?? asBoolean(raw.autoRefresh)
  if (autoRefreshEnabled !== undefined) {
    patch.autoRefreshEnabled = autoRefreshEnabled
  }
  const refreshSeconds =
    asFiniteNumber(accountAutoRefresh.interval) ??
    asFiniteNumber(raw.refreshInterval)
  if (refreshSeconds !== undefined) {
    patch.autoRefreshIntervalMinutes = Math.round(refreshSeconds / 60)
  }

  const showTodayCashflow = asBoolean(raw.showTodayCashflow)
  if (showTodayCashflow !== undefined) {
    patch.includeTodayCashflow = showTodayCashflow
  }

  const autoCheckinEnabled = asBoolean(autoCheckin.globalEnabled)
  if (autoCheckinEnabled !== undefined) {
    patch.autoCheckinEnabled = autoCheckinEnabled
  }
  const autoCheckinTime =
    asTime(autoCheckin.deterministicTime) ?? asTime(autoCheckin.windowStart)
  if (autoCheckinTime !== undefined) {
    patch.autoCheckinTime = autoCheckinTime
  }

  const balanceHistoryEnabled = asBoolean(balanceHistory.enabled)
  if (balanceHistoryEnabled !== undefined) {
    patch.balanceHistoryEnabled = balanceHistoryEnabled
  }
  const balanceRetentionDays = asFiniteNumber(balanceHistory.retentionDays)
  if (balanceRetentionDays !== undefined) {
    patch.balanceHistoryRetentionDays = Math.round(balanceRetentionDays)
  }

  const usageHistoryEnabled = asBoolean(usageHistory.enabled)
  if (usageHistoryEnabled !== undefined) {
    patch.usageHistoryEnabled = usageHistoryEnabled
  }
  const usageRetentionDays = asFiniteNumber(usageHistory.retentionDays)
  if (usageRetentionDays !== undefined) {
    patch.usageHistoryRetentionDays = Math.round(usageRetentionDays)
  }
  if (usageHistory.scheduleMode === "afterRefresh") {
    patch.usageHistoryAfterRefresh = true
  } else if (
    usageHistory.scheduleMode === "manual" ||
    usageHistory.scheduleMode === "alarm"
  ) {
    patch.usageHistoryAfterRefresh = false
  }

  const announcementsEnabled = asBoolean(announcements.enabled)
  if (announcementsEnabled !== undefined) {
    patch.siteAnnouncementsEnabled = announcementsEnabled
  }
  const announcementInterval = asFiniteNumber(announcements.intervalMinutes)
  if (announcementInterval !== undefined) {
    patch.siteAnnouncementsIntervalMinutes = Math.round(announcementInterval)
  }
  const announcementNotifications = asBoolean(announcements.notificationEnabled)
  if (announcementNotifications !== undefined) {
    patch.siteAnnouncementNotificationsEnabled = announcementNotifications
  }

  return patch
}

export class AutomationSettingsRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  get(): VersionedAutomationSettings {
    return this.store.read(
      AUTOMATION_DOCUMENT_KEY,
      createDefaultAutomationSettings,
      normalizeAutomationDocument,
    )
  }

  update(patch: WebAutomationSettingsPatch): VersionedAutomationSettings {
    return this.store.mutate(
      AUTOMATION_DOCUMENT_KEY,
      createDefaultAutomationSettings,
      normalizeAutomationDocument,
      (current) =>
        normalizeAutomationDocument({
          ...current,
          settings: { ...current.settings, ...patch },
        }),
      patch.expectedRevision,
    )
  }

  recordRun(summary: WebAutomationRunSummary): VersionedAutomationSettings {
    return this.store.mutate(
      AUTOMATION_DOCUMENT_KEY,
      createDefaultAutomationSettings,
      normalizeAutomationDocument,
      (current) => ({ ...current, lastRun: summary }),
    )
  }

  recordCheckInRun(summary: WebCheckInRunSummary): VersionedAutomationSettings {
    return this.store.mutate(
      AUTOMATION_DOCUMENT_KEY,
      createDefaultAutomationSettings,
      normalizeAutomationDocument,
      (current) => ({ ...current, lastCheckInRun: summary }),
    )
  }
}

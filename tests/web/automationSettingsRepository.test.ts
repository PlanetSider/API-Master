import { describe, expect, it } from "vitest"

import {
  normalizeAutomationDocument,
  normalizeExtensionAutomationPatch,
} from "~~/server/automationSettingsRepository"

describe("automation settings migration", () => {
  it("maps extension scheduler preferences to Web settings", () => {
    const patch = normalizeExtensionAutomationPatch({
      accountAutoRefresh: { enabled: true, interval: 900 },
      showTodayCashflow: false,
      autoCheckin: {
        globalEnabled: true,
        deterministicTime: "08:30",
      },
      balanceHistory: { enabled: true, retentionDays: 30 },
      usageHistory: {
        enabled: true,
        retentionDays: 14,
        scheduleMode: "afterRefresh",
      },
      siteAnnouncementNotifications: {
        enabled: true,
        notificationEnabled: false,
        intervalMinutes: 120,
      },
    })

    expect(patch).toEqual({
      autoRefreshEnabled: true,
      autoRefreshIntervalMinutes: 15,
      includeTodayCashflow: false,
      autoCheckinEnabled: true,
      autoCheckinTime: "08:30",
      balanceHistoryEnabled: true,
      balanceHistoryRetentionDays: 30,
      usageHistoryEnabled: true,
      usageHistoryRetentionDays: 14,
      usageHistoryAfterRefresh: true,
      siteAnnouncementsEnabled: true,
      siteAnnouncementsIntervalMinutes: 120,
      siteAnnouncementNotificationsEnabled: false,
    })
  })

  it("normalizes migrated values and keeps scheduler records intact", () => {
    const normalized = normalizeAutomationDocument({
      settings: normalizeExtensionAutomationPatch({
        accountAutoRefresh: { interval: 1 },
        autoCheckin: { windowStart: "07:00" },
      }),
      lastRun: {
        trigger: "manual",
        status: "completed",
        startedAt: 1,
        finishedAt: 2,
        total: 1,
        succeeded: 1,
        failed: 0,
        skipped: 0,
      },
    })

    expect(normalized.settings.autoRefreshIntervalMinutes).toBe(5)
    expect(normalized.settings.autoCheckinTime).toBe("07:00")
    expect(normalized.lastRun?.finishedAt).toBe(2)
  })
})

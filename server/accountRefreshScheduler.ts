import type {
  WebAutomationRunSummary,
  WebAutomationSettingsResponse,
} from "~/web/contracts"

import { type AccountRefreshService } from "./accountRefreshService"
import {
  RevisionConflictError,
  type AccountsRepository,
} from "./accountsRepository"
import {
  type AutomationSettingsRepository,
  type VersionedAutomationSettings,
} from "./automationSettingsRepository"
import { type BalanceHistoryRepository } from "./balanceHistoryRepository"
import { type NotificationService } from "./notificationService"
import { type UsageHistoryService } from "./usageHistoryService"

const MIN_TIMER_DELAY_MS = 1_000

export class AccountRefreshScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined
  private inFlight: Promise<WebAutomationRunSummary> | undefined
  private nextRunAt: number | undefined

  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly settingsRepository: AutomationSettingsRepository,
    private readonly refreshService: AccountRefreshService,
    private readonly balanceHistoryRepository: BalanceHistoryRepository,
    private readonly usageHistoryService: UsageHistoryService,
    private readonly notificationService: NotificationService,
  ) {}

  start() {
    this.reschedule()
  }

  stop() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.nextRunAt = undefined
  }

  reschedule() {
    this.stop()
    const document = this.settingsRepository.get()
    if (!document.data.settings.autoRefreshEnabled) return

    const intervalMs =
      document.data.settings.autoRefreshIntervalMinutes * 60 * 1_000
    const target = document.data.lastRun
      ? document.data.lastRun.finishedAt + intervalMs
      : Date.now() + intervalMs
    const delay = Math.max(MIN_TIMER_DELAY_MS, target - Date.now())
    this.nextRunAt = Date.now() + delay
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.nextRunAt = undefined
      void this.runNow("scheduled")
    }, delay)
  }

  getResponse(
    document: VersionedAutomationSettings = this.settingsRepository.get(),
  ): WebAutomationSettingsResponse {
    return {
      settings: document.data.settings,
      revision: document.revision,
      ...(document.data.lastRun ? { lastRun: document.data.lastRun } : {}),
      ...(document.data.lastCheckInRun
        ? { lastCheckInRun: document.data.lastCheckInRun }
        : {}),
      runtime: {
        running: Boolean(this.inFlight),
        ...(this.nextRunAt ? { nextRunAt: this.nextRunAt } : {}),
      },
    }
  }

  runNow(trigger: WebAutomationRunSummary["trigger"]) {
    if (this.inFlight) return this.inFlight
    this.inFlight = this.execute(trigger).finally(() => {
      this.inFlight = undefined
      this.reschedule()
    })
    return this.inFlight
  }

  private async execute(
    trigger: WebAutomationRunSummary["trigger"],
  ): Promise<WebAutomationRunSummary> {
    const startedAt = Date.now()
    const settings = this.settingsRepository.get().data.settings
    const accounts = this.accountsRepository.getAccounts()

    try {
      const refreshed = await this.refreshService.refreshAccounts(
        accounts.data.accounts,
        settings.includeTodayCashflow,
      )
      this.accountsRepository.mutateAccounts(
        (current) => ({ ...current, accounts: refreshed.accounts }),
        accounts.revision,
      )
      if (settings.balanceHistoryEnabled) {
        const capturedAccounts = refreshed.accounts.filter((account) =>
          refreshed.refreshedAccountIds.includes(account.id),
        )
        if (capturedAccounts.length > 0) {
          this.balanceHistoryRepository.capture(
            capturedAccounts,
            trigger === "scheduled" ? "alarm" : "refresh",
            settings.balanceHistoryRetentionDays,
          )
        }
      }
      if (settings.usageHistoryEnabled && settings.usageHistoryAfterRefresh) {
        const usageAccounts = refreshed.accounts.filter((account) =>
          refreshed.refreshedAccountIds.includes(account.id),
        )
        if (usageAccounts.length > 0) {
          await this.usageHistoryService.syncAccounts(
            usageAccounts,
            settings.usageHistoryRetentionDays,
          )
        }
      }
      return this.recordSummary({
        trigger,
        startedAt,
        finishedAt: Date.now(),
        total: refreshed.total,
        succeeded: refreshed.succeeded,
        failed: refreshed.failed,
        skipped: refreshed.skipped,
        status: "completed",
      })
    } catch (error) {
      return this.recordSummary({
        trigger,
        startedAt,
        finishedAt: Date.now(),
        total: accounts.data.accounts.length,
        succeeded: 0,
        failed: error instanceof RevisionConflictError ? 0 : 1,
        skipped: 0,
        status:
          error instanceof RevisionConflictError
            ? "revision_conflict"
            : "failed",
      })
    }
  }

  private recordSummary(summary: WebAutomationRunSummary) {
    this.settingsRepository.recordRun(summary)
    this.notificationService.notify({
      task: "account_refresh",
      status:
        summary.status !== "completed" || summary.failed > 0
          ? summary.succeeded > 0
            ? "partial_success"
            : "failure"
          : "success",
      counts: {
        total: summary.total,
        success: summary.succeeded,
        failed: summary.failed,
        skipped: summary.skipped,
      },
    })
    return summary
  }
}

import type { WebCheckInRunSummary } from "~/web/contracts"

import {
  RevisionConflictError,
  type AccountsRepository,
} from "./accountsRepository"
import { type AutomationSettingsRepository } from "./automationSettingsRepository"
import { type CheckInService } from "./checkInService"
import { type NotificationService } from "./notificationService"

const MIN_TIMER_DELAY_MS = 1_000

const getNextDailyRun = (time: string, lastRunAt?: number) => {
  const [hours, minutes] = time.split(":").map(Number)
  const now = new Date()
  const candidate = new Date(now)
  candidate.setHours(hours ?? 9, minutes ?? 0, 0, 0)

  const lastRun = lastRunAt ? new Date(lastRunAt) : undefined
  const alreadyRanToday =
    lastRun &&
    lastRun.getFullYear() === now.getFullYear() &&
    lastRun.getMonth() === now.getMonth() &&
    lastRun.getDate() === now.getDate()
  if (candidate.getTime() <= now.getTime() || alreadyRanToday) {
    candidate.setDate(candidate.getDate() + 1)
  }

  return candidate.getTime()
}

export class CheckInScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined
  private inFlight: Promise<WebCheckInRunSummary> | undefined
  private nextRunAt: number | undefined

  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly settingsRepository: AutomationSettingsRepository,
    private readonly checkInService: CheckInService,
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
    if (!document.data.settings.autoCheckinEnabled) return

    const target = getNextDailyRun(
      document.data.settings.autoCheckinTime,
      document.data.lastCheckInRun?.finishedAt,
    )
    const delay = Math.max(MIN_TIMER_DELAY_MS, target - Date.now())
    this.nextRunAt = Date.now() + delay
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.nextRunAt = undefined
      void this.runNow("scheduled")
    }, delay)
  }

  getStatus() {
    return {
      checkInRunning: Boolean(this.inFlight),
      ...(this.nextRunAt ? { nextCheckInAt: this.nextRunAt } : {}),
    }
  }

  runNow(trigger: WebCheckInRunSummary["trigger"]) {
    if (this.inFlight) return this.inFlight
    this.inFlight = this.execute(trigger).finally(() => {
      this.inFlight = undefined
      this.reschedule()
    })
    return this.inFlight
  }

  private async execute(trigger: WebCheckInRunSummary["trigger"]) {
    const accounts = this.accountsRepository.getAccounts()
    const execution = await this.checkInService.run(
      accounts.data.accounts,
      trigger,
    )
    let summary: WebCheckInRunSummary

    try {
      this.accountsRepository.mutateAccounts(
        (current) => ({ ...current, accounts: execution.accounts }),
        accounts.revision,
      )
      summary = { ...execution.summary, persistence: "persisted" }
    } catch (error) {
      summary = {
        ...execution.summary,
        persistence:
          error instanceof RevisionConflictError
            ? "revision_conflict"
            : "failed",
      }
    }

    this.settingsRepository.recordCheckInRun(summary)
    this.notificationService.notify({
      task: "auto_checkin",
      status:
        summary.failed > 0 ||
        summary.browserRequired > 0 ||
        summary.persistence !== "persisted"
          ? summary.succeeded + summary.alreadyChecked > 0
            ? "partial_success"
            : "failure"
          : "success",
      counts: {
        total: summary.total,
        success: summary.succeeded + summary.alreadyChecked,
        failed: summary.failed + summary.browserRequired,
        skipped: summary.skipped,
      },
    })
    return summary
  }
}

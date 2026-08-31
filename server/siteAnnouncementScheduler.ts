import type { WebSiteAnnouncementSyncResponse } from "~/web/contracts"

import type { AutomationSettingsRepository } from "./automationSettingsRepository"
import type { SiteAnnouncementService } from "./siteAnnouncementService"

const MIN_TIMER_DELAY_MS = 1_000

/** Keeps site-announcement polling alive in the server process. */
export class SiteAnnouncementScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined
  private inFlight: Promise<WebSiteAnnouncementSyncResponse> | undefined
  private nextRunAt: number | undefined

  constructor(
    private readonly service: SiteAnnouncementService,
    private readonly settingsRepository: AutomationSettingsRepository,
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
    const settings = this.settingsRepository.get().data.settings
    if (!settings.siteAnnouncementsEnabled) return
    const delay = Math.max(
      MIN_TIMER_DELAY_MS,
      settings.siteAnnouncementsIntervalMinutes * 60_000,
    )
    this.nextRunAt = Date.now() + delay
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.nextRunAt = undefined
      void this.runNow("scheduled")
    }, delay)
  }

  getStatus() {
    return {
      siteAnnouncementsRunning: Boolean(this.inFlight),
      ...(this.nextRunAt ? { nextSiteAnnouncementsAt: this.nextRunAt } : {}),
    }
  }

  runNow(_trigger: "manual" | "scheduled") {
    if (this.inFlight) return this.inFlight
    this.inFlight = this.service.runNow().finally(() => {
      this.inFlight = undefined
      this.reschedule()
    })
    return this.inFlight
  }
}

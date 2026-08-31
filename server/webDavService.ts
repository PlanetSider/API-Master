import { toSanitizedErrorSummary } from "~/services/verification/aiApiVerification/utils"
import type {
  WebBackup,
  WebDavRunSummary,
  WebDavSettingsInput,
} from "~/web/contracts"

import { parseWebBackup, type BackupService } from "./backupService"
import type { NotificationService } from "./notificationService"
import {
  webDavClient,
  type WebDavClient,
  type WebDavClientConfig,
} from "./webDavClient"
import {
  type StoredWebDavSettings,
  type WebDavRepository,
} from "./webDavRepository"

const MIN_TIMER_DELAY_MS = 1_000

const toClientConfig = (settings: StoredWebDavSettings): WebDavClientConfig => {
  if (!settings.configured)
    throw new Error("WebDAV configuration is incomplete")
  if (settings.encryptionEnabled && !settings.encryptionPassword.trim()) {
    throw new Error("WebDAV encryption password is required")
  }
  return {
    url: settings.url,
    username: settings.username,
    password: settings.password,
    encryptionEnabled: settings.encryptionEnabled,
    encryptionPassword: settings.encryptionPassword,
  }
}

export class WebDavService {
  private timer: ReturnType<typeof setTimeout> | undefined
  private inFlight: Promise<WebDavRunSummary> | undefined
  private nextRunAt: number | undefined

  constructor(
    private readonly repository: WebDavRepository,
    private readonly backupService: BackupService,
    private readonly client: WebDavClient = webDavClient,
    private readonly notificationService?: NotificationService,
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
    const document = this.repository.get()
    const settings = document.data.settings
    if (!settings.autoBackupEnabled || !settings.configured) return

    const intervalMs = settings.intervalMinutes * 60 * 1_000
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

  getResponse() {
    return this.repository.toResponse({
      running: Boolean(this.inFlight),
      ...(this.nextRunAt ? { nextRunAt: this.nextRunAt } : {}),
    })
  }

  update(input: WebDavSettingsInput) {
    toClientConfig(this.repository.previewUpdate(input))
    this.repository.update(input)
    this.reschedule()
    return this.getResponse()
  }

  async testConnection() {
    await this.client.test(toClientConfig(this.repository.getStoredSettings()))
    return this.getResponse()
  }

  runNow(trigger: WebDavRunSummary["trigger"]) {
    if (this.inFlight) return this.inFlight
    this.inFlight = this.executeUpload(trigger).finally(() => {
      this.inFlight = undefined
      this.reschedule()
    })
    return this.inFlight
  }

  async download(): Promise<WebBackup> {
    const content = await this.client.download(
      toClientConfig(this.repository.getStoredSettings()),
    )
    return parseWebBackup(JSON.parse(content) as unknown)
  }

  private async executeUpload(
    trigger: WebDavRunSummary["trigger"],
  ): Promise<WebDavRunSummary> {
    const startedAt = Date.now()
    let summary: WebDavRunSummary
    try {
      const backup = this.backupService.export()
      await this.client.upload(
        toClientConfig(this.repository.getStoredSettings()),
        JSON.stringify(backup),
      )
      summary = {
        trigger,
        status: "success",
        startedAt,
        finishedAt: Date.now(),
      }
    } catch (error) {
      summary = {
        trigger,
        status: "failed",
        startedAt,
        finishedAt: Date.now(),
        error:
          toSanitizedErrorSummary(error, [
            this.repository.getStoredSettings().password,
            this.repository.getStoredSettings().encryptionPassword,
          ]) || "WebDAV backup failed",
      }
    }
    this.repository.recordRun(summary)
    this.notificationService?.notify({
      task: "webdav_backup",
      status: summary.status === "success" ? "success" : "failure",
      ...(summary.error ? { message: summary.error } : {}),
    })
    return summary
  }
}

import type {
  WebExternalNotificationChannel,
  WebExternalNotificationSettingsInput,
  WebNotificationRecord,
} from "~/web/contracts"
import { WEB_EXTERNAL_NOTIFICATION_CHANNELS } from "~/web/contracts"

import {
  externalNotificationDelivery,
  type ExternalNotificationDelivery,
  type ExternalNotificationPayload,
} from "./externalNotificationDelivery"
import {
  isExternalNotificationChannelConfigured,
  type ExternalNotificationRepository,
  type StoredExternalNotificationSettings,
} from "./externalNotificationRepository"

const assertEnabledChannelsConfigured = (
  settings: StoredExternalNotificationSettings,
) => {
  for (const channel of WEB_EXTERNAL_NOTIFICATION_CHANNELS) {
    const config = settings.channels[channel]
    if (
      config.enabled &&
      !isExternalNotificationChannelConfigured(channel, config)
    ) {
      throw new Error(`${channel} notification configuration is incomplete`)
    }
  }
}

export class ExternalNotificationService {
  constructor(
    private readonly repository: ExternalNotificationRepository,
    private readonly delivery: ExternalNotificationDelivery = externalNotificationDelivery,
  ) {}

  getResponse() {
    return this.repository.toResponse()
  }

  update(input: WebExternalNotificationSettingsInput) {
    assertEnabledChannelsConfigured(this.repository.previewUpdate(input))
    this.repository.update(input)
    return this.getResponse()
  }

  async test(channel: WebExternalNotificationChannel) {
    const config = this.repository.get().data.channels[channel]
    if (!isExternalNotificationChannelConfigured(channel, config)) {
      throw new Error(`${channel} notification configuration is incomplete`)
    }
    await this.delivery.send(
      channel,
      {
        task: "account_refresh",
        status: "success",
        title: "All API Hub 通知测试",
        message: "外部通知渠道连接正常。",
      },
      config,
    )
    return this.getResponse()
  }

  async deliver(
    payload: Pick<
      WebNotificationRecord,
      "task" | "status" | "title" | "message" | "counts"
    >,
  ) {
    const settings = this.repository.get().data
    if (!settings.enabled || settings.tasks[payload.task] === false) {
      return { attempted: 0, succeeded: 0, failed: 0 }
    }

    const selected = WEB_EXTERNAL_NOTIFICATION_CHANNELS.filter((channel) => {
      const config = settings.channels[channel]
      return (
        config.enabled &&
        isExternalNotificationChannelConfigured(channel, config)
      )
    })
    const results = await Promise.allSettled(
      selected.map((channel) =>
        this.delivery.send(
          channel,
          payload as ExternalNotificationPayload,
          settings.channels[channel],
        ),
      ),
    )
    const succeeded = results.filter(
      (result) => result.status === "fulfilled",
    ).length
    return {
      attempted: results.length,
      succeeded,
      failed: results.length - succeeded,
    }
  }
}

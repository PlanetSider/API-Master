import type {
  WebExternalNotificationChannel,
  WebExternalNotificationChannelInput,
  WebExternalNotificationSettingsInput,
  WebExternalNotificationSettingsResponse,
  WebNotificationTask,
} from "~/web/contracts"
import { WEB_EXTERNAL_NOTIFICATION_CHANNELS } from "~/web/contracts"

import type { EncryptedDocumentStore } from "./encryptedDocumentStore"

const KEY = "external-notification-settings"

export interface StoredExternalNotificationChannel
  extends WebExternalNotificationChannelInput {
  enabled: boolean
  botToken: string
  chatId: string
  webhookKey: string
  secret: string
  topicUrl: string
  accessToken: string
  url: string
}

export interface StoredExternalNotificationSettings {
  enabled: boolean
  tasks: Record<WebNotificationTask, boolean>
  channels: Record<
    WebExternalNotificationChannel,
    StoredExternalNotificationChannel
  >
}

const DEFAULT_TASKS: Record<WebNotificationTask, boolean> = {
  account_refresh: true,
  auto_checkin: true,
  usage_history: true,
  balance_history: true,
  webdav_backup: true,
  site_announcements: true,
}

const emptyChannel = (): StoredExternalNotificationChannel => ({
  enabled: false,
  botToken: "",
  chatId: "",
  webhookKey: "",
  secret: "",
  topicUrl: "",
  accessToken: "",
  url: "",
})

const createDefault = (): StoredExternalNotificationSettings => ({
  enabled: true,
  tasks: { ...DEFAULT_TASKS },
  channels: Object.fromEntries(
    WEB_EXTERNAL_NOTIFICATION_CHANNELS.map((channel) => [
      channel,
      emptyChannel(),
    ]),
  ) as StoredExternalNotificationSettings["channels"],
})

const normalizeChannel = (
  value: unknown,
): StoredExternalNotificationChannel => {
  const candidate =
    value && typeof value === "object"
      ? (value as Partial<StoredExternalNotificationChannel>)
      : {}
  const text = (field: keyof StoredExternalNotificationChannel) =>
    typeof candidate[field] === "string"
      ? (candidate[field] as string).trim()
      : ""
  return {
    enabled: candidate.enabled === true,
    botToken: text("botToken"),
    chatId: text("chatId"),
    webhookKey: text("webhookKey"),
    secret: text("secret"),
    topicUrl: text("topicUrl"),
    accessToken: text("accessToken"),
    url: text("url"),
  }
}

const normalize = (value: unknown): StoredExternalNotificationSettings => {
  const candidate =
    value && typeof value === "object"
      ? (value as Partial<StoredExternalNotificationSettings>)
      : {}
  const tasks = candidate.tasks ?? ({} as Partial<typeof DEFAULT_TASKS>)
  const channels =
    candidate.channels ??
    ({} as Partial<StoredExternalNotificationSettings["channels"]>)
  return {
    enabled: candidate.enabled !== false,
    tasks: Object.fromEntries(
      Object.keys(DEFAULT_TASKS).map((task) => [
        task,
        tasks[task as WebNotificationTask] !== false,
      ]),
    ) as Record<WebNotificationTask, boolean>,
    channels: Object.fromEntries(
      WEB_EXTERNAL_NOTIFICATION_CHANNELS.map((channel) => [
        channel,
        normalizeChannel(channels[channel]),
      ]),
    ) as StoredExternalNotificationSettings["channels"],
  }
}

export const isExternalNotificationChannelConfigured = (
  channel: WebExternalNotificationChannel,
  config: StoredExternalNotificationChannel,
) => {
  switch (channel) {
    case "telegram":
      return Boolean(config.botToken && config.chatId)
    case "feishu":
    case "dingtalk":
    case "wecom":
      return Boolean(config.webhookKey)
    case "ntfy":
      return Boolean(config.topicUrl)
    case "webhook":
      return Boolean(config.url)
  }
}

const mergeChannel = (
  current: StoredExternalNotificationChannel,
  input: WebExternalNotificationChannelInput,
) =>
  normalizeChannel({
    ...current,
    enabled: input.enabled,
    ...Object.fromEntries(
      Object.entries(input).filter(
        ([key, value]) => key === "enabled" || Boolean(String(value).trim()),
      ),
    ),
  })

const resolveSettingsUpdate = (
  current: StoredExternalNotificationSettings,
  input: WebExternalNotificationSettingsInput,
): StoredExternalNotificationSettings => ({
  enabled: input.enabled,
  tasks: { ...input.tasks },
  channels: Object.fromEntries(
    WEB_EXTERNAL_NOTIFICATION_CHANNELS.map((channel) => [
      channel,
      mergeChannel(current.channels[channel], input.channels[channel]),
    ]),
  ) as StoredExternalNotificationSettings["channels"],
})

export class ExternalNotificationRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  get() {
    return this.store.read(KEY, createDefault, normalize)
  }

  previewUpdate(input: WebExternalNotificationSettingsInput) {
    return resolveSettingsUpdate(this.get().data, input)
  }

  update(input: WebExternalNotificationSettingsInput) {
    return this.store.mutate(
      KEY,
      createDefault,
      normalize,
      (current) => resolveSettingsUpdate(current, input),
      input.expectedRevision,
    )
  }

  toResponse(): WebExternalNotificationSettingsResponse {
    const document = this.get()
    return {
      enabled: document.data.enabled,
      tasks: document.data.tasks,
      channels: Object.fromEntries(
        WEB_EXTERNAL_NOTIFICATION_CHANNELS.map((channel) => [
          channel,
          {
            enabled: document.data.channels[channel].enabled,
            configured: isExternalNotificationChannelConfigured(
              channel,
              document.data.channels[channel],
            ),
          },
        ]),
      ) as WebExternalNotificationSettingsResponse["channels"],
      revision: document.revision,
    }
  }
}

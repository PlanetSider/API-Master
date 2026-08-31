import { createHmac } from "node:crypto"

import type {
  WebExternalNotificationChannel,
  WebNotificationRecord,
} from "~/web/contracts"

import type { StoredExternalNotificationChannel } from "./externalNotificationRepository"
import { assertSafeUpstreamUrl } from "./ssrfGuard"

export type ExternalNotificationPayload = Pick<
  WebNotificationRecord,
  "task" | "status" | "title" | "message" | "counts"
>

export interface ExternalNotificationDelivery {
  send(
    channel: WebExternalNotificationChannel,
    payload: ExternalNotificationPayload,
    config: StoredExternalNotificationChannel,
  ): Promise<void>
}

const FEISHU_PREFIX = "https://open.feishu.cn/open-apis/bot/v2/hook/"
const DINGTALK_PREFIX = "https://oapi.dingtalk.com/robot/send?access_token="
const WECOM_PREFIX = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key="
const NTFY_DEFAULT_URL = "https://ntfy.sh"
const WEBHOOK_TEMPLATE_PATTERN =
  /(?:\{|%7b)(title|message|task|status|total|success|failed|skipped)(?:\}|%7d)/giu

const parseHttpUrl = (value: string, label: string) => {
  const url = new URL(value)
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    throw new Error(`${label} URL must use HTTP or HTTPS without credentials`)
  }
  return url
}

const assertResponse = async (response: Response, label: string) => {
  if (!response.ok) {
    throw new Error(`${label} delivery failed with status ${response.status}`)
  }
}

const fetchSafely = async (
  url: URL | string,
  init: RequestInit,
  label: string,
) => {
  try {
    await assertSafeUpstreamUrl(String(url), label)
    return await fetch(url, init)
  } catch {
    throw new Error(`${label} delivery failed`)
  }
}

const messageText = (payload: ExternalNotificationPayload) =>
  `${payload.title}\n${payload.message}`

const sendTelegram = async (
  payload: ExternalNotificationPayload,
  config: StoredExternalNotificationChannel,
) => {
  if (!config.botToken || !config.chatId) {
    throw new Error("Telegram configuration is incomplete")
  }
  const response = await fetchSafely(
    `https://api.telegram.org/bot${encodeURIComponent(config.botToken)}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: messageText(payload).slice(0, 4096),
        disable_web_page_preview: true,
      }),
    },
    "Telegram",
  )
  await assertResponse(response, "Telegram")
}

const resolveWebhookUrl = (input: string, prefix: string, label: string) =>
  parseHttpUrl(
    input.startsWith("http://") || input.startsWith("https://")
      ? input
      : `${prefix}${encodeURIComponent(input)}`,
    label,
  )

const sendFeishu = async (
  payload: ExternalNotificationPayload,
  config: StoredExternalNotificationChannel,
) => {
  if (!config.webhookKey) throw new Error("Feishu configuration is incomplete")
  const response = await fetchSafely(
    resolveWebhookUrl(config.webhookKey, FEISHU_PREFIX, "Feishu"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: { text: messageText(payload) },
      }),
    },
    "Feishu",
  )
  await assertResponse(response, "Feishu")
  const body = (await response.json().catch(() => null)) as {
    code?: unknown
    StatusCode?: unknown
  } | null
  const code = typeof body?.code === "number" ? body.code : body?.StatusCode
  if (code !== 0) throw new Error("Feishu rejected the notification")
}

const sendDingtalk = async (
  payload: ExternalNotificationPayload,
  config: StoredExternalNotificationChannel,
) => {
  if (!config.webhookKey) {
    throw new Error("DingTalk configuration is incomplete")
  }
  const url = resolveWebhookUrl(config.webhookKey, DINGTALK_PREFIX, "DingTalk")
  if (config.secret) {
    const timestamp = Date.now().toString()
    const sign = createHmac("sha256", config.secret)
      .update(`${timestamp}\n${config.secret}`)
      .digest("base64")
    url.searchParams.set("timestamp", timestamp)
    url.searchParams.set("sign", sign)
  }
  const response = await fetchSafely(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify({
        msgtype: "text",
        text: { content: messageText(payload) },
        at: { isAtAll: false },
      }),
    },
    "DingTalk",
  )
  await assertResponse(response, "DingTalk")
  const body = (await response.json().catch(() => null)) as {
    errcode?: unknown
  } | null
  if (Number(body?.errcode) !== 0) {
    throw new Error("DingTalk rejected the notification")
  }
}

const sendWecom = async (
  payload: ExternalNotificationPayload,
  config: StoredExternalNotificationChannel,
) => {
  if (!config.webhookKey) throw new Error("WeCom configuration is incomplete")
  const response = await fetchSafely(
    resolveWebhookUrl(config.webhookKey, WECOM_PREFIX, "WeCom"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "text",
        text: { content: messageText(payload) },
      }),
    },
    "WeCom",
  )
  await assertResponse(response, "WeCom")
  const body = (await response.json().catch(() => null)) as {
    errcode?: unknown
  } | null
  if (body?.errcode !== 0) throw new Error("WeCom rejected the notification")
}

const encodeHeader = (value: string) =>
  /^[\x20-\x7e]*$/u.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`

const resolveNtfyUrl = (input: string) => {
  const trimmed = input.trim().replace(/^\/+/, "")
  const url =
    input.startsWith("http://") || input.startsWith("https://")
      ? parseHttpUrl(input, "ntfy")
      : trimmed.includes("/")
        ? parseHttpUrl(`https://${trimmed}`, "ntfy")
        : new URL(encodeURIComponent(trimmed), `${NTFY_DEFAULT_URL}/`)
  if (!url.pathname.replace(/^\/+/, "").trim()) {
    throw new Error("ntfy topic URL is invalid")
  }
  return url
}

const sendNtfy = async (
  payload: ExternalNotificationPayload,
  config: StoredExternalNotificationChannel,
) => {
  if (!config.topicUrl) throw new Error("ntfy configuration is incomplete")
  const response = await fetchSafely(
    resolveNtfyUrl(config.topicUrl),
    {
      method: "POST",
      headers: {
        Title: encodeHeader(payload.title),
        Priority: "default",
        Tags: "bell",
        ...(config.accessToken
          ? { Authorization: `Bearer ${config.accessToken}` }
          : {}),
      },
      body: payload.message,
    },
    "ntfy",
  )
  await assertResponse(response, "ntfy")
}

const renderWebhookUrl = (
  template: string,
  payload: ExternalNotificationPayload,
) => {
  const values = {
    title: payload.title,
    message: payload.message,
    task: payload.task,
    status: payload.status,
    total: payload.counts?.total?.toString() ?? "",
    success: payload.counts?.success?.toString() ?? "",
    failed: payload.counts?.failed?.toString() ?? "",
    skipped: payload.counts?.skipped?.toString() ?? "",
  }
  return template.replace(WEBHOOK_TEMPLATE_PATTERN, (_, key: string) =>
    encodeURIComponent(values[key.toLowerCase() as keyof typeof values]),
  )
}

const sendWebhook = async (
  payload: ExternalNotificationPayload,
  config: StoredExternalNotificationChannel,
) => {
  if (!config.url) throw new Error("Webhook configuration is incomplete")
  const response = await fetchSafely(
    parseHttpUrl(renderWebhookUrl(config.url, payload), "Webhook"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "all-api-hub",
        title: payload.title,
        message: payload.message,
        task: payload.task,
        status: payload.status,
        counts: payload.counts ?? null,
      }),
    },
    "Webhook",
  )
  await assertResponse(response, "Webhook")
}

export const externalNotificationDelivery: ExternalNotificationDelivery = {
  async send(channel, payload, config) {
    switch (channel) {
      case "telegram":
        return await sendTelegram(payload, config)
      case "feishu":
        return await sendFeishu(payload, config)
      case "dingtalk":
        return await sendDingtalk(payload, config)
      case "wecom":
        return await sendWecom(payload, config)
      case "ntfy":
        return await sendNtfy(payload, config)
      case "webhook":
        return await sendWebhook(payload, config)
    }
  },
}

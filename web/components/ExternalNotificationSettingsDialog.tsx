import { Check, Send } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import type {
  WebExternalNotificationChannel,
  WebExternalNotificationChannelInput,
  WebExternalNotificationSettingsInput,
  WebExternalNotificationSettingsResponse,
  WebNotificationTask,
} from "~/web/contracts"
import { WEB_EXTERNAL_NOTIFICATION_CHANNELS } from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface Props {
  open: boolean
  busy: boolean
  settings: WebExternalNotificationSettingsResponse | null
  onClose: () => void
  onSave: (input: WebExternalNotificationSettingsInput) => Promise<void>
  onTest: (channel: WebExternalNotificationChannel) => Promise<void>
}

type ChannelDraft = WebExternalNotificationChannelInput
type Drafts = Record<WebExternalNotificationChannel, ChannelDraft>

const taskLabels: Record<WebNotificationTask, string> = {
  account_refresh: "账户刷新",
  auto_checkin: "自动签到",
  usage_history: "用量历史同步",
  balance_history: "余额历史采集",
  webdav_backup: "WebDAV 备份",
  site_announcements: "网站公告",
}

const channelLabels: Record<WebExternalNotificationChannel, string> = {
  telegram: "Telegram",
  feishu: "飞书",
  dingtalk: "钉钉",
  wecom: "企业微信",
  ntfy: "ntfy",
  webhook: "通用 Webhook",
}

const fieldLabels: Record<
  WebExternalNotificationChannel,
  Array<{
    key: keyof ChannelDraft
    label: string
    type?: string
    placeholder: string
  }>
> = {
  telegram: [
    {
      key: "botToken",
      label: "Bot Token",
      type: "password",
      placeholder: "留空保持不变",
    },
    { key: "chatId", label: "Chat ID", placeholder: "例如：-1001234567890" },
  ],
  feishu: [
    {
      key: "webhookKey",
      label: "Webhook Key 或完整 URL",
      type: "password",
      placeholder: "留空保持不变",
    },
  ],
  dingtalk: [
    {
      key: "webhookKey",
      label: "Webhook Token 或完整 URL",
      type: "password",
      placeholder: "留空保持不变",
    },
    {
      key: "secret",
      label: "加签 Secret（可选）",
      type: "password",
      placeholder: "留空保持不变",
    },
  ],
  wecom: [
    {
      key: "webhookKey",
      label: "Webhook Key 或完整 URL",
      type: "password",
      placeholder: "留空保持不变",
    },
  ],
  ntfy: [
    {
      key: "topicUrl",
      label: "Topic 或完整 URL",
      placeholder: "例如：my-topic 或 https://ntfy.example/my-topic",
    },
    {
      key: "accessToken",
      label: "访问 Token（可选）",
      type: "password",
      placeholder: "留空保持不变",
    },
  ],
  webhook: [
    {
      key: "url",
      label: "Webhook URL",
      placeholder: "https://hooks.example.com/{status}",
    },
  ],
}

const createDrafts = (): Drafts =>
  Object.fromEntries(
    WEB_EXTERNAL_NOTIFICATION_CHANNELS.map((channel) => [
      channel,
      { enabled: false },
    ]),
  ) as Drafts

export function ExternalNotificationSettingsDialog({
  open,
  busy,
  settings,
  onClose,
  onSave,
  onTest,
}: Props) {
  const [enabled, setEnabled] = useState(true)
  const [tasks, setTasks] = useState<Record<WebNotificationTask, boolean>>({
    account_refresh: true,
    auto_checkin: true,
    usage_history: true,
    balance_history: true,
    webdav_backup: true,
    site_announcements: true,
  })
  const [drafts, setDrafts] = useState<Drafts>(createDrafts)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !settings) return
    setEnabled(settings.enabled)
    setTasks({ ...settings.tasks })
    setDrafts(
      Object.fromEntries(
        WEB_EXTERNAL_NOTIFICATION_CHANNELS.map((channel) => [
          channel,
          { enabled: settings.channels[channel].enabled },
        ]),
      ) as Drafts,
    )
    setError(null)
  }, [open, settings])

  const updateChannel = (
    channel: WebExternalNotificationChannel,
    patch: Partial<ChannelDraft>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [channel]: { ...current[channel], ...patch },
    }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!settings) return
    setError(null)
    try {
      await onSave({
        enabled,
        tasks,
        channels: drafts,
        expectedRevision: settings.revision,
      })
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "外部通知设置保存失败",
      )
    }
  }

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="外部通知"
      description="由服务端向第三方渠道发送任务结果。凭据只写入服务端，不会回显。"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            取消
          </button>
          <button
            type="submit"
            form="external-notification-settings-form"
            disabled={busy || !settings}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "正在保存..." : "保存设置"}
          </button>
        </>
      }
    >
      <form
        id="external-notification-settings-form"
        onSubmit={submit}
        className="space-y-5"
      >
        <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
          <span>
            <span className="block text-sm font-medium">启用外部通知</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              任务完成后向已启用的渠道发送成功、部分成功或失败结果
            </span>
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 accent-blue-600"
          />
        </label>

        <section>
          <h3 className="text-sm font-semibold">通知事件</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(Object.keys(taskLabels) as WebNotificationTask[]).map((task) => (
              <label
                key={task}
                className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
              >
                <input
                  type="checkbox"
                  checked={tasks[task]}
                  onChange={(event) =>
                    setTasks((current) => ({
                      ...current,
                      [task]: event.target.checked,
                    }))
                  }
                  className="size-4 accent-blue-600"
                />
                {taskLabels[task]}
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">通知渠道</h3>
          {WEB_EXTERNAL_NOTIFICATION_CHANNELS.map((channel) => {
            const state = settings?.channels[channel]
            const draft = drafts[channel]
            return (
              <div
                key={channel}
                className="rounded-md border border-gray-200 p-3 dark:border-gray-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={(event) =>
                        updateChannel(channel, {
                          enabled: event.target.checked,
                        })
                      }
                      className="size-4 accent-blue-600"
                    />
                    {channelLabels[channel]}
                  </label>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {state?.configured ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3.5" />
                        已配置
                      </span>
                    ) : (
                      <span>未配置</span>
                    )}
                    <button
                      type="button"
                      disabled={busy || !state?.configured}
                      onClick={() => void onTest(channel)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      <Send className="size-3.5" />
                      测试
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {fieldLabels[channel].map((field) => (
                    <label
                      key={field.key}
                      className="block text-xs font-medium"
                    >
                      {field.label}
                      <input
                        type={field.type ?? "text"}
                        value={String(draft[field.key] ?? "")}
                        onChange={(event) =>
                          updateChannel(channel, {
                            [field.key]: event.target.value,
                          })
                        }
                        placeholder={field.placeholder}
                        className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </section>

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </form>
    </WebDialog>
  )
}

import { Clock3 } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import type {
  WebAutomationSettingsPatch,
  WebAutomationSettingsResponse,
} from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface AutomationSettingsDialogProps {
  open: boolean
  busy: boolean
  automation: WebAutomationSettingsResponse | null
  title?: string
  onClose: () => void
  onSave: (patch: WebAutomationSettingsPatch) => Promise<void>
}

const formatTime = (value?: number) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "暂无"

export function AutomationSettingsDialog({
  open,
  busy,
  automation,
  title = "自动刷新",
  onClose,
  onSave,
}: AutomationSettingsDialogProps) {
  const [enabled, setEnabled] = useState(false)
  const [intervalMinutes, setIntervalMinutes] = useState(30)
  const [includeTodayCashflow, setIncludeTodayCashflow] = useState(true)
  const [autoCheckinEnabled, setAutoCheckinEnabled] = useState(false)
  const [autoCheckinTime, setAutoCheckinTime] = useState("09:00")
  const [usageHistoryEnabled, setUsageHistoryEnabled] = useState(true)
  const [usageHistoryRetentionDays, setUsageHistoryRetentionDays] = useState(7)
  const [usageHistoryAfterRefresh, setUsageHistoryAfterRefresh] = useState(true)
  const [siteAnnouncementsEnabled, setSiteAnnouncementsEnabled] =
    useState(false)
  const [
    siteAnnouncementsIntervalMinutes,
    setSiteAnnouncementsIntervalMinutes,
  ] = useState(360)
  const [
    siteAnnouncementNotificationsEnabled,
    setSiteAnnouncementNotificationsEnabled,
  ] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !automation) return
    setEnabled(automation.settings.autoRefreshEnabled)
    setIntervalMinutes(automation.settings.autoRefreshIntervalMinutes)
    setIncludeTodayCashflow(automation.settings.includeTodayCashflow)
    setAutoCheckinEnabled(automation.settings.autoCheckinEnabled)
    setAutoCheckinTime(automation.settings.autoCheckinTime)
    setUsageHistoryEnabled(automation.settings.usageHistoryEnabled)
    setUsageHistoryRetentionDays(automation.settings.usageHistoryRetentionDays)
    setUsageHistoryAfterRefresh(automation.settings.usageHistoryAfterRefresh)
    setSiteAnnouncementsEnabled(automation.settings.siteAnnouncementsEnabled)
    setSiteAnnouncementsIntervalMinutes(
      automation.settings.siteAnnouncementsIntervalMinutes,
    )
    setSiteAnnouncementNotificationsEnabled(
      automation.settings.siteAnnouncementNotificationsEnabled,
    )
    setError(null)
  }, [automation, open])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!automation) return
    setError(null)
    try {
      await onSave({
        autoRefreshEnabled: enabled,
        autoRefreshIntervalMinutes: intervalMinutes,
        includeTodayCashflow,
        autoCheckinEnabled,
        autoCheckinTime,
        usageHistoryEnabled,
        usageHistoryRetentionDays,
        usageHistoryAfterRefresh,
        siteAnnouncementsEnabled,
        siteAnnouncementsIntervalMinutes,
        siteAnnouncementNotificationsEnabled,
        expectedRevision: automation.revision,
      })
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "自动化设置保存失败",
      )
    }
  }

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title={title}
      description="由服务端调度账户刷新，浏览器关闭后仍会继续运行。"
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
            form="automation-settings-form"
            disabled={busy || !automation}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "正在保存..." : "保存设置"}
          </button>
        </>
      }
    >
      <form
        id="automation-settings-form"
        onSubmit={submit}
        className="space-y-5"
      >
        <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
          <span>
            <span className="block text-sm font-medium">启用自动刷新</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              按设定间隔刷新所有已启用账户
            </span>
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 accent-blue-600"
          />
        </label>

        <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
          <h3 className="text-sm font-semibold">每日签到</h3>
          <div className="mt-3 space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
              <span>
                <span className="block text-sm font-medium">启用自动签到</span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  对已配置签到方法的账户执行每日签到
                </span>
              </span>
              <input
                type="checkbox"
                checked={autoCheckinEnabled}
                onChange={(event) =>
                  setAutoCheckinEnabled(event.target.checked)
                }
                className="size-4 accent-blue-600"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">签到时间</span>
              <input
                type="time"
                required
                disabled={!autoCheckinEnabled}
                value={autoCheckinTime}
                onChange={(event) => setAutoCheckinTime(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
          <h3 className="text-sm font-semibold">用量历史</h3>
          <div className="mt-3 space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
              <span>
                <span className="block text-sm font-medium">启用用量历史</span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  增量保存消费日志聚合，不保存原始请求内容
                </span>
              </span>
              <input
                type="checkbox"
                checked={usageHistoryEnabled}
                onChange={(event) =>
                  setUsageHistoryEnabled(event.target.checked)
                }
                className="size-4 accent-blue-600"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">保留天数</span>
              <input
                type="number"
                min={1}
                max={365}
                disabled={!usageHistoryEnabled}
                value={usageHistoryRetentionDays}
                onChange={(event) =>
                  setUsageHistoryRetentionDays(Number(event.target.value))
                }
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
              <span className="text-sm font-medium">账户刷新后自动同步</span>
              <input
                type="checkbox"
                disabled={!usageHistoryEnabled}
                checked={usageHistoryAfterRefresh}
                onChange={(event) =>
                  setUsageHistoryAfterRefresh(event.target.checked)
                }
                className="size-4 accent-blue-600"
              />
            </label>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
          <h3 className="text-sm font-semibold">网站公告</h3>
          <div className="mt-3 space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
              <span>
                <span className="block text-sm font-medium">
                  自动检查网站公告
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  服务端按间隔检查已启用账户的站点公告
                </span>
              </span>
              <input
                type="checkbox"
                checked={siteAnnouncementsEnabled}
                onChange={(event) =>
                  setSiteAnnouncementsEnabled(event.target.checked)
                }
                className="size-4 accent-blue-600"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">检查间隔（分钟）</span>
              <input
                type="number"
                min={15}
                max={1440}
                required
                disabled={!siteAnnouncementsEnabled}
                value={siteAnnouncementsIntervalMinutes}
                onChange={(event) =>
                  setSiteAnnouncementsIntervalMinutes(
                    Number(event.target.value),
                  )
                }
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
              <span>
                <span className="block text-sm font-medium">
                  发现新公告时发送通知
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  同时写入站内通知，并按外部通知设置投递
                </span>
              </span>
              <input
                type="checkbox"
                checked={siteAnnouncementNotificationsEnabled}
                onChange={(event) =>
                  setSiteAnnouncementNotificationsEnabled(event.target.checked)
                }
                className="size-4 accent-blue-600"
              />
            </label>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">刷新间隔（分钟）</span>
          <input
            type="number"
            min={5}
            max={1440}
            required
            disabled={!enabled}
            value={intervalMinutes}
            onChange={(event) => setIntervalMinutes(Number(event.target.value))}
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950"
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
          <span>
            <span className="block text-sm font-medium">采集今日明细</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              同步今日消费、收入、Token 和请求统计
            </span>
          </span>
          <input
            type="checkbox"
            checked={includeTodayCashflow}
            onChange={(event) => setIncludeTodayCashflow(event.target.checked)}
            className="size-4 accent-blue-600"
          />
        </label>

        <div className="grid gap-3 rounded-md bg-gray-50 p-4 text-sm sm:grid-cols-2 dark:bg-gray-800/60">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock3 className="size-3.5" />
              上次运行
            </div>
            <div className="mt-1 font-medium">
              {formatTime(automation?.lastRun?.finishedAt)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock3 className="size-3.5" />
              上次签到
            </div>
            <div className="mt-1 font-medium">
              {formatTime(automation?.lastCheckInRun?.finishedAt)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock3 className="size-3.5" />
              下次签到
            </div>
            <div className="mt-1 font-medium">
              {formatTime(automation?.runtime.nextCheckInAt)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock3 className="size-3.5" />
              下次运行
            </div>
            <div className="mt-1 font-medium">
              {formatTime(automation?.runtime.nextRunAt)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock3 className="size-3.5" />
              下次公告检查
            </div>
            <div className="mt-1 font-medium">
              {formatTime(automation?.runtime.nextSiteAnnouncementsAt)}
            </div>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </form>
    </WebDialog>
  )
}

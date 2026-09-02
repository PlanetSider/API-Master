import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  MoreHorizontal,
  Play,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react"
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
  onRun?: () => Promise<void>
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
  onRun,
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

  if (title === "自动签到") {
    const run = automation?.lastCheckInRun
    const results = run?.results ?? []
    const successCount = results.filter(
      (item) => item.status === "success" || item.status === "already_checked",
    ).length
    const failedCount = results.filter(
      (item) => item.status === "failed" || item.status === "browser_required",
    ).length
    const skippedCount = results.filter(
      (item) => item.status === "skipped",
    ).length
    const statusLabel = (status: (typeof results)[number]["status"]) => {
      if (status === "success" || status === "already_checked") return "成功"
      if (status === "failed" || status === "browser_required") return "失败"
      return "已跳过"
    }

    return (
      <WebDialog
        open={open}
        onClose={onClose}
        title="自动签到"
        description="在每天的指定时间窗口内，自动为符合条件的账号执行签到；下方结果列表显示已执行的签到记录，不是待签到队列。"
      >
        <section className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-sm text-gray-500">最近运行</div>
              <div className="mt-1 font-semibold">
                {formatTime(run?.startedAt)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">下次每日计划</div>
              <div className="mt-1 font-semibold">
                {formatTime(automation?.runtime.nextCheckInAt)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">下次重试计划</div>
              <div className="mt-1 font-semibold">无待重试</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">执行结果</div>
              <span
                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${failedCount ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
              >
                {failedCount ? "部分成功" : run ? "成功" : "尚未执行"}
              </span>
            </div>
          </div>
          <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-700">
            <div className="mb-3 text-sm text-gray-500">执行统计</div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[
                ["可参与", run?.total ?? 0],
                ["已执行", results.length],
                ["成功", successCount],
                ["失败", failedCount],
                ["跳过", skippedCount],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="mt-1 font-semibold tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
            <button
              type="button"
              disabled={busy || !onRun}
              onClick={() => void onRun?.()}
              className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Play className="size-4" />
              {busy ? "执行中..." : "立即执行"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium dark:border-gray-700"
            >
              <RefreshCw className="size-4" />
              刷新
            </button>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium dark:border-gray-700"
            >
              <ExternalLink className="size-4" />
              打开全部失败账号的签到页
            </button>
          </div>
        </section>

        <div className="mt-4 inline-flex rounded-lg bg-gray-100 p-1 text-sm dark:bg-gray-800">
          <button
            type="button"
            className="flex items-center gap-2 rounded-md bg-white px-4 py-2 font-medium shadow-sm dark:bg-gray-900"
          >
            执行结果
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
              {failedCount}
            </span>
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-4 py-2 text-gray-600 dark:text-gray-300"
          >
            <CircleAlert className="size-4 text-amber-500" />
            账号准备状态
          </button>
        </div>

        <section className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-3 dark:border-gray-700">
            <label className="relative block min-w-64 flex-1 sm:max-w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="搜索账号名称、ID 或结果信息..."
                className="h-9 w-full rounded-md border border-gray-300 pr-3 pl-9 text-sm dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                className="rounded-md border border-blue-500 bg-blue-50 px-3 py-2 text-blue-600"
              >
                全部 {results.length}
              </button>
              <button
                type="button"
                className="rounded-md bg-gray-100 px-3 py-2 text-gray-600 dark:bg-gray-800"
              >
                失败或未执行 {failedCount}
              </button>
              <button
                type="button"
                className="rounded-md bg-gray-100 px-3 py-2 text-gray-600 dark:bg-gray-800"
              >
                成功 {successCount}
              </button>
              <button
                type="button"
                className="rounded-md bg-gray-100 px-3 py-2 text-gray-600 dark:bg-gray-800"
              >
                已跳过 {skippedCount}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">账号名称</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">消息</th>
                  <th className="px-5 py-3 font-medium">时间</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {results.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-gray-500"
                    >
                      暂无执行记录
                    </td>
                  </tr>
                ) : (
                  results.map((item) => {
                    const success =
                      item.status === "success" ||
                      item.status === "already_checked"
                    const skipped = item.status === "skipped"
                    return (
                      <tr key={item.accountId}>
                        <td className="px-5 py-4 font-medium text-blue-600">
                          {item.accountName} ↗
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${success ? "bg-emerald-100 text-emerald-700" : skipped ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                          >
                            {success ? (
                              <CheckCircle2 className="size-3.5" />
                            ) : skipped ? (
                              <CircleAlert className="size-3.5" />
                            ) : (
                              <XCircle className="size-3.5" />
                            )}
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                          {item.message || item.reason || "-"}
                        </td>
                        <td className="px-5 py-4 text-gray-500">
                          {formatTime(run?.finishedAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            aria-label="更多操作"
                            title="更多操作"
                            className="inline-flex size-8 items-center justify-center rounded-md hover:bg-gray-100"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </WebDialog>
    )
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

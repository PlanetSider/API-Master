import { BarChart3, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import type {
  WebAccountSummary,
  WebUsageAnalyticsQuery,
  WebUsageAnalyticsResponse,
} from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface UsageAnalyticsDialogProps {
  open: boolean
  busy: boolean
  accounts: WebAccountSummary[]
  analytics: WebUsageAnalyticsResponse | null
  onClose: () => void
  onRefresh: (query: WebUsageAnalyticsQuery) => Promise<void>
}

const numberFormat = new Intl.NumberFormat("zh-CN")
const moneyFormat = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
})

const formatNumber = (value: number) => numberFormat.format(Math.round(value))

export function UsageAnalyticsDialog({
  open,
  busy,
  accounts,
  analytics,
  onClose,
  onRefresh,
}: UsageAnalyticsDialogProps) {
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [startDay, setStartDay] = useState("")
  const [endDay, setEndDay] = useState("")

  useEffect(() => {
    if (!open || !analytics) return
    setSelectedAccountIds(analytics.selection.accountIds)
    setStartDay(analytics.selection.startDay)
    setEndDay(analytics.selection.endDay)
  }, [analytics, open])

  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  )

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds((current) =>
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId],
    )
  }

  const submit = () => {
    void onRefresh({
      accountIds: selectedAccountIds,
      startDay: startDay || undefined,
      endDay: endDay || undefined,
    })
  }

  const totals = analytics?.totals
  const rangeLabel = analytics
    ? `${analytics.selection.startDay} 至 ${analytics.selection.endDay}`
    : "选择日期范围后加载"

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="用量分析"
      description="按账户、日期和模型查看服务端保存的聚合用量，不包含原始请求内容。"
      footer={
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "正在加载..." : "应用筛选"}
        </button>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 rounded-md border border-gray-200 p-3 sm:grid-cols-[1fr_1fr_auto] dark:border-gray-700">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-gray-500">开始日期</span>
            <input
              type="date"
              value={startDay}
              max={endDay || undefined}
              onChange={(event) => setStartDay(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-gray-500">结束日期</span>
            <input
              type="date"
              value={endDay}
              min={startDay || undefined}
              onChange={(event) => setEndDay(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              setSelectedAccountIds(accounts.map((account) => account.id))
            }
            className="self-end text-left text-sm text-blue-600 hover:text-blue-700 sm:pb-2"
          >
            全选账户
          </button>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">账户筛选</legend>
          <div className="grid max-h-28 gap-2 overflow-y-auto rounded-md border border-gray-200 p-3 sm:grid-cols-2 dark:border-gray-700">
            {accounts.length === 0 ? (
              <p className="text-sm text-gray-500">暂无账户</p>
            ) : (
              accounts.map((account) => (
                <label
                  key={account.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedAccountIds.includes(account.id)}
                    onChange={() => toggleAccount(account.id)}
                    className="size-4 accent-blue-600"
                  />
                  <span className="truncate">{account.name}</span>
                </label>
              ))
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            不选择账户时使用服务端保存的全部历史账户。
          </p>
        </fieldset>

        {!analytics ? (
          <div className="flex min-h-40 flex-col items-center justify-center text-sm text-gray-500">
            <BarChart3 className="size-8 text-gray-300" />
            <p className="mt-2">点击“应用筛选”加载分析数据</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>统计区间：{rangeLabel}</span>
              <span>{analytics.selection.accountIds.length} 个账户</span>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200 sm:grid-cols-4 dark:border-gray-700 dark:bg-gray-700">
              {[
                ["请求", formatNumber(totals?.requests ?? 0)],
                ["总 Token", formatNumber(totals?.totalTokens ?? 0)],
                ["输入 Token", formatNumber(totals?.promptTokens ?? 0)],
                ["消费", moneyFormat.format(totals?.consumedUsd ?? 0)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="bg-white px-3 py-3 dark:bg-gray-900"
                >
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="mt-1 text-base font-semibold tabular-nums">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <section>
                <h3 className="mb-2 text-sm font-semibold">按账户</h3>
                <div className="max-h-52 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
                  {analytics.accounts.map((row) => (
                    <div
                      key={row.accountId}
                      className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-0 dark:border-gray-800"
                    >
                      <span className="min-w-0 truncate">
                        {accountNameById.get(row.accountId) ?? row.accountName}
                      </span>
                      <span className="shrink-0 text-gray-600 tabular-nums dark:text-gray-300">
                        {formatNumber(row.aggregate.totalTokens)}
                      </span>
                    </div>
                  ))}
                  {analytics.accounts.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">暂无数据</p>
                  ) : null}
                </div>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold">按模型</h3>
                <div className="max-h-52 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
                  {analytics.models.map((row) => (
                    <div
                      key={row.model}
                      className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-0 dark:border-gray-800"
                    >
                      <span className="min-w-0 truncate" title={row.model}>
                        {row.model}
                      </span>
                      <span className="shrink-0 text-gray-600 tabular-nums dark:text-gray-300">
                        {formatNumber(row.aggregate.totalTokens)}
                      </span>
                    </div>
                  ))}
                  {analytics.models.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">暂无数据</p>
                  ) : null}
                </div>
              </section>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold">每日趋势</h3>
              <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800">
                    <tr>
                      <th className="w-[31%] px-2 py-2 font-medium sm:px-3">
                        日期
                      </th>
                      <th className="w-[21%] px-2 py-2 text-right font-medium sm:px-3">
                        请求
                      </th>
                      <th className="w-[24%] px-2 py-2 text-right font-medium sm:px-3">
                        Token
                      </th>
                      <th className="w-[24%] px-2 py-2 text-right font-medium sm:px-3">
                        消费
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {analytics.daily.slice(-31).map((row) => (
                      <tr key={row.day}>
                        <td className="truncate px-2 py-2 sm:px-3">
                          {row.day}
                        </td>
                        <td className="truncate px-2 py-2 text-right tabular-nums sm:px-3">
                          {formatNumber(row.requests)}
                        </td>
                        <td className="truncate px-2 py-2 text-right tabular-nums sm:px-3">
                          {formatNumber(row.totalTokens)}
                        </td>
                        <td className="truncate px-2 py-2 text-right tabular-nums sm:px-3">
                          {moneyFormat.format(row.consumedUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {analytics.daily.length === 0 ? (
                  <p className="p-3 text-center text-sm text-gray-500">
                    暂无数据
                  </p>
                ) : null}
              </div>
            </section>

            <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/70 dark:text-gray-300">
              响应速度：平均 {analytics.latency.averageSeconds.toFixed(2)}{" "}
              秒，最大 {analytics.latency.maxSeconds.toFixed(2)} 秒；慢请求{" "}
              {formatNumber(analytics.latency.slowCount)} 条。
            </div>
          </>
        )}
      </div>
    </WebDialog>
  )
}

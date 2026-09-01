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
  const modelMax = Math.max(
    ...(analytics?.models ?? []).map((row) => row.aggregate.totalTokens),
    1,
  )
  const accountMax = Math.max(
    ...(analytics?.accounts ?? []).map((row) => row.aggregate.totalTokens),
    1,
  )
  const modelCostMax = Math.max(
    ...(analytics?.models ?? []).map((row) => row.aggregate.consumedUsd),
    0.0001,
  )
  const rangeLabel = analytics
    ? `${analytics.selection.startDay} 至 ${analytics.selection.endDay}`
    : "选择日期范围后加载"

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="用量分析"
      description="同步并可视化服务端聚合的用量历史。"
      inlineActions={
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

            <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">每日总览</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    多指标趋势，按天汇总请求、Token 与额度消耗
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  {analytics.daily.length} 天
                </span>
              </div>
              {analytics.daily.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  暂无趋势数据
                </p>
              ) : (
                <div className="flex h-40 items-end gap-1 overflow-x-auto border-b border-gray-200 pb-1 dark:border-gray-700">
                  {analytics.daily.slice(-31).map((row) => {
                    const max = Math.max(
                      ...analytics.daily.map((item) => item.totalTokens),
                      1,
                    )
                    const height = Math.max(
                      4,
                      Math.round((row.totalTokens / max) * 100),
                    )
                    return (
                      <div
                        key={row.day}
                        className="group flex h-full min-w-5 flex-1 flex-col justify-end"
                        title={`${row.day}: ${formatNumber(row.totalTokens)} Token`}
                      >
                        <div
                          className="w-full rounded-t bg-blue-500/80 transition-colors group-hover:bg-blue-600"
                          style={{ height: `${height}%` }}
                        />
                        <span className="mt-1 truncate text-center text-[9px] text-gray-400">
                          {row.day.slice(5)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <section>
                <h3 className="mb-2 text-sm font-semibold">账号对比</h3>
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
                <h3 className="mb-2 text-sm font-semibold">模型明细</h3>
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

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">模型分布</h3>
                  <span className="text-xs text-gray-500">按总 Token</span>
                </div>
                <div className="space-y-3">
                  {analytics.models.slice(0, 8).map((row) => (
                    <div
                      key={row.model}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div
                          className="truncate text-gray-600 dark:text-gray-300"
                          title={row.model}
                        >
                          {row.model}
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{
                              width: `${Math.max(3, (row.aggregate.totalTokens / modelMax) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-gray-500 tabular-nums">
                        {formatNumber(row.aggregate.totalTokens)}
                      </span>
                    </div>
                  ))}
                  {analytics.models.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无数据</p>
                  ) : null}
                </div>
              </section>
              <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">账户对比</h3>
                  <span className="text-xs text-gray-500">按 Token</span>
                </div>
                <div className="space-y-3">
                  {analytics.accounts.slice(0, 8).map((row) => (
                    <div
                      key={row.accountId}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-gray-600 dark:text-gray-300">
                          {accountNameById.get(row.accountId) ??
                            row.accountName}
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${Math.max(3, (row.aggregate.totalTokens / accountMax) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-gray-500 tabular-nums">
                        {formatNumber(row.aggregate.totalTokens)}
                      </span>
                    </div>
                  ))}
                  {analytics.accounts.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无数据</p>
                  ) : null}
                </div>
              </section>
              <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">模型花费分布</h3>
                  <span className="text-xs text-gray-500">USD</span>
                </div>
                <div className="space-y-3">
                  {analytics.models.slice(0, 8).map((row) => (
                    <div
                      key={row.model}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div
                          className="truncate text-gray-600 dark:text-gray-300"
                          title={row.model}
                        >
                          {row.model}
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{
                              width: `${Math.max(3, (row.aggregate.consumedUsd / modelCostMax) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-gray-500 tabular-nums">
                        {moneyFormat.format(row.aggregate.consumedUsd)}
                      </span>
                    </div>
                  ))}
                  {analytics.models.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无数据</p>
                  ) : null}
                </div>
              </section>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">延迟分布</h3>
                  <span className="text-xs text-gray-500">
                    {formatNumber(analytics.latency.count)} 次请求
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200 dark:border-gray-700 dark:bg-gray-700">
                  {[
                    [
                      "平均延迟",
                      `${analytics.latency.averageSeconds.toFixed(2)} s`,
                    ],
                    [
                      "最大延迟",
                      `${analytics.latency.maxSeconds.toFixed(2)} s`,
                    ],
                    ["慢请求", formatNumber(analytics.latency.slowCount)],
                    ["未知延迟", formatNumber(analytics.latency.unknownCount)],
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
              </section>
              <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">延迟趋势</h3>
                  <span className="text-xs text-gray-500">每日请求量</span>
                </div>
                <div className="flex h-28 items-end gap-1 border-b border-gray-200 pb-1 dark:border-gray-700">
                  {analytics.daily.slice(-31).map((row) => {
                    const max = Math.max(
                      ...analytics.daily.map((item) => item.requests),
                      1,
                    )
                    return (
                      <div
                        key={row.day}
                        className="group flex h-full min-w-3 flex-1 flex-col justify-end"
                        title={`${row.day}: ${formatNumber(row.requests)} 次请求`}
                      >
                        <div
                          className="w-full rounded-t bg-emerald-500/80 group-hover:bg-emerald-600"
                          style={{
                            height: `${Math.max(4, (row.requests / max) * 100)}%`,
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold">使用时间热点</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    按日期与请求量展示近期使用强度
                  </p>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {analytics.daily.slice(-35).map((row) => {
                    const intensity = Math.min(
                      5,
                      Math.max(
                        1,
                        Math.ceil(
                          (row.totalTokens /
                            Math.max(
                              ...analytics.daily.map(
                                (item) => item.totalTokens,
                              ),
                              1,
                            )) *
                            5,
                        ),
                      ),
                    )
                    const intensityClass = [
                      "bg-blue-100 dark:bg-blue-950",
                      "bg-blue-200 dark:bg-blue-900",
                      "bg-blue-300 dark:bg-blue-800",
                      "bg-blue-400 dark:bg-blue-700",
                      "bg-blue-500 dark:bg-blue-600",
                    ][intensity - 1]
                    return (
                      <div
                        key={row.day}
                        title={`${row.day}: ${formatNumber(row.totalTokens)} Token`}
                        className={`aspect-square rounded-sm ${intensityClass}`}
                      />
                    )
                  })}
                </div>
              </section>
              <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold">模型 × 日期热力图</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Top 模型在统计区间内的 Token 强度
                  </p>
                </div>
                <div className="space-y-2">
                  {analytics.models.slice(0, 6).map((model) => (
                    <div
                      key={model.model}
                      className="grid grid-cols-[minmax(5rem,8rem)_repeat(7,minmax(0,1fr))] items-center gap-1 text-[10px]"
                    >
                      <span
                        className="truncate text-gray-500"
                        title={model.model}
                      >
                        {model.model}
                      </span>
                      {analytics.daily.slice(-7).map((row) => (
                        <span
                          key={row.day}
                          title={`${row.day}: ${formatNumber(model.aggregate.totalTokens)} Token`}
                          className="aspect-square rounded-sm bg-blue-200 dark:bg-blue-800"
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold">每日明细</h3>
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

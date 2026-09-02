import { BarChart3, Download, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { EChart } from "~/components/charts/EChart"
import type { EChartsOption } from "~/components/charts/echarts"
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
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
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

  const exportAnalytics = () => {
    if (!analytics) return
    const blob = new Blob([JSON.stringify(analytics, null, 2)], {
      type: "application/json;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `usage-analytics-${analytics.selection.startDay}-${analytics.selection.endDay}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const totals = analytics?.totals
  const dailyOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "axis" },
      legend: {
        top: 0,
        data: ["请求数", "输入 Token", "输出 Token", "总 Token"],
      },
      grid: { left: 20, right: 28, top: 42, bottom: 30, containLabel: true },
      xAxis: {
        type: "category",
        data: (analytics?.daily ?? []).map((row) => row.day),
      },
      yAxis: [
        { type: "value", name: "请求" },
        { type: "value", name: "Tokens" },
      ],
      series: [
        {
          name: "请求数",
          type: "line",
          smooth: true,
          data: (analytics?.daily ?? []).map((row) => row.requests),
        },
        {
          name: "输入 Token",
          type: "line",
          smooth: true,
          yAxisIndex: 1,
          areaStyle: { opacity: 0.08 },
          data: (analytics?.daily ?? []).map((row) => row.promptTokens),
        },
        {
          name: "输出 Token",
          type: "line",
          smooth: true,
          yAxisIndex: 1,
          data: (analytics?.daily ?? []).map((row) => row.completionTokens),
        },
        {
          name: "总 Token",
          type: "line",
          smooth: true,
          yAxisIndex: 1,
          data: (analytics?.daily ?? []).map((row) => row.totalTokens),
        },
      ],
    }),
    [analytics?.daily],
  )
  const buildPieOption = (
    data: Array<{ name: string; value: number }>,
  ): EChartsOption => ({
    tooltip: { trigger: "item" },
    legend: { type: "scroll", bottom: 0 },
    series: [
      {
        type: "pie",
        radius: ["48%", "72%"],
        center: ["50%", "45%"],
        label: { show: false },
        data,
      },
    ],
  })
  const modelPieOption = buildPieOption(
    (analytics?.models ?? []).slice(0, 8).map((row) => ({
      name: row.model,
      value: row.aggregate.totalTokens,
    })),
  )
  const accountPieOption = buildPieOption(
    (analytics?.accounts ?? []).slice(0, 8).map((row) => ({
      name: accountNameById.get(row.accountId) ?? row.accountName,
      value: row.aggregate.totalTokens,
    })),
  )
  const modelCostPieOption = buildPieOption(
    (analytics?.models ?? []).slice(0, 8).map((row) => ({
      name: row.model,
      value: row.aggregate.consumedUsd,
    })),
  )
  const rangeLabel = analytics
    ? `${analytics.selection.startDay} 至 ${analytics.selection.endDay}`
    : "选择日期范围后加载"

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="用量分析"
      description="同步并可视化本地聚合的用量历史，支持导出。"
      inlineActions={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            aria-label="应用筛选"
            className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
            {busy ? "刷新中..." : "刷新"}
          </button>
          <button
            type="button"
            disabled={!analytics}
            onClick={exportAnalytics}
            className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Download className="size-4" />
            导出
          </button>
        </>
      }
      footer={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
            {busy ? "刷新中..." : "刷新"}
          </button>
          <button
            type="button"
            disabled={!analytics}
            onClick={exportAnalytics}
            className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Download className="size-4" />
            导出
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-700">
          <fieldset>
            <legend className="text-sm font-medium">站点</legend>
            <p className="mt-1 text-xs text-gray-500">
              同步端保存的站点（不选择表示全部）。
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedAccountIds(accounts.map((account) => account.id))
                }
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${selectedAccountIds.length === accounts.length ? "bg-emerald-500 text-white" : "border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"}`}
              >
                全部站点
              </button>
              {accounts.map((account) => (
                <button
                  key={`site-${account.id}`}
                  type="button"
                  role="checkbox"
                  aria-checked={selectedAccountIds.includes(account.id)}
                  aria-pressed={selectedAccountIds.includes(account.id)}
                  onClick={() => toggleAccount(account.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${selectedAccountIds.includes(account.id) ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}
                >
                  {account.name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">账号</legend>
            <p className="mt-1 text-xs text-gray-500">
              同步端保存的账号（不选择表示全部历史账号）。
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedAccountIds(accounts.map((account) => account.id))
                }
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${selectedAccountIds.length === accounts.length ? "bg-emerald-500 text-white" : "border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"}`}
              >
                全部账号
              </button>
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  aria-pressed={selectedAccountIds.includes(account.id)}
                  onClick={() => toggleAccount(account.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${selectedAccountIds.includes(account.id) ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}
                >
                  {account.name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">API Token</legend>
            <p className="mt-1 text-xs text-gray-500">
              可按模型标识缩小前端图表范围。
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedModelIds([])}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${selectedModelIds.length === 0 ? "bg-emerald-500 text-white" : "border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"}`}
              >
                全部 Token
              </button>
              {(analytics?.models ?? []).slice(0, 8).map((model) => (
                <button
                  key={model.model}
                  type="button"
                  aria-pressed={selectedModelIds.includes(model.model)}
                  onClick={() =>
                    setSelectedModelIds((current) =>
                      current.includes(model.model)
                        ? current.filter((item) => item !== model.model)
                        : [...current, model.model],
                    )
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs ${selectedModelIds.includes(model.model) ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}
                >
                  {model.model} ({formatNumber(model.aggregate.requests)})
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </div>

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
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200 sm:grid-cols-5 dark:border-gray-700 dark:bg-gray-700">
              {[
                ["输入 Token", formatNumber(totals?.promptTokens ?? 0)],
                ["输出 Token", formatNumber(totals?.completionTokens ?? 0)],
                ["Token 总量", formatNumber(totals?.totalTokens ?? 0)],
                ["请求数", formatNumber(totals?.requests ?? 0)],
                ["花费", moneyFormat.format(totals?.consumedUsd ?? 0)],
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
                <EChart option={dailyOption} className="h-72" />
              )}
            </section>

            <div className="flex flex-col gap-5">
              <div className="order-0 grid gap-5 lg:grid-cols-2">
                <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">模型分布</h3>
                    <span className="text-xs text-gray-500">按总 Token</span>
                  </div>
                  {analytics.models.length > 0 ? (
                    <EChart option={modelPieOption} className="h-72" />
                  ) : (
                    <p className="py-20 text-center text-sm text-gray-500">
                      暂无数据
                    </p>
                  )}
                </section>
                <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">模型花费分布</h3>
                    <span className="text-xs text-gray-500">USD</span>
                  </div>
                  {analytics.models.length > 0 ? (
                    <EChart option={modelCostPieOption} className="h-72" />
                  ) : (
                    <p className="py-20 text-center text-sm text-gray-500">
                      暂无数据
                    </p>
                  )}
                </section>
                <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">账号对比</h3>
                    <span className="text-xs text-gray-500">按 Token</span>
                  </div>
                  {analytics.accounts.length > 0 ? (
                    <EChart option={accountPieOption} className="h-72" />
                  ) : (
                    <p className="py-20 text-center text-sm text-gray-500">
                      暂无数据
                    </p>
                  )}
                </section>
              </div>

              <div className="order-2 grid gap-5 lg:grid-cols-2">
                <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">延迟分布</h3>
                    <span className="text-xs text-gray-500">
                      {formatNumber(analytics.latency.count)} 次请求
                    </span>
                  </div>
                  <div className="grid min-h-64 grid-cols-2 content-center gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200 dark:border-gray-700 dark:bg-gray-700">
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
                      [
                        "未知延迟",
                        formatNumber(analytics.latency.unknownCount),
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="bg-white px-3 py-3 dark:bg-gray-900"
                      >
                        <div className="text-xs text-gray-500">{label}</div>
                        <div className="mt-1 text-base font-semibold tabular-nums">
                          {label === "平均延迟" ? (
                            <>
                              {value}
                              <span className="sr-only">
                                平均{" "}
                                {analytics.latency.averageSeconds.toFixed(2)} 秒
                              </span>
                            </>
                          ) : (
                            value
                          )}
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
                  <div className="flex h-64 items-end gap-1 border-b border-gray-200 pb-1 dark:border-gray-700">
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

              <div className="order-1 grid gap-5">
                <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold">使用时间热点</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      按日期与请求量展示近期使用强度
                    </p>
                  </div>
                  <div className="grid min-h-64 grid-cols-7 content-center gap-1">
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
                  <div className="min-h-64 space-y-2">
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
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold">模型延迟分布</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    按模型展示请求服务时延。
                  </p>
                </div>
                <div className="flex h-72 items-center justify-center text-sm text-gray-500">
                  当前服务端未提供按模型拆分的延迟数据
                </div>
              </section>
              <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold">模型 Token 排行</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    当前统计区间内最多的 API Token。
                  </p>
                </div>
                {analytics.models.length > 0 ? (
                  <EChart option={modelPieOption} className="h-72" />
                ) : (
                  <p className="py-20 text-center text-sm text-gray-500">
                    暂无数据
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </WebDialog>
  )
}

import { RefreshCw, Scissors } from "lucide-react"
import { useMemo, useState } from "react"

import { EChart } from "~/components/charts/EChart"
import {
  buildAccountBreakdownPieOption,
  buildMultiSeriesTrendOption,
} from "~/features/BalanceHistory/echartsOptions"
import type { WebBalanceHistoryResponse } from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface BalanceHistoryDialogProps {
  open: boolean
  history: WebBalanceHistoryResponse | null
  onClose: () => void
  onRefresh?: () => Promise<void>
}

const money = (value: number | null) =>
  value === null
    ? "-"
    : new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)

export function BalanceHistoryDialog({
  open,
  history,
  onClose,
  onRefresh,
}: BalanceHistoryDialogProps) {
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [startDay, setStartDay] = useState("")
  const [endDay, setEndDay] = useState("")

  const accounts = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of history?.entries ?? []) {
      map.set(entry.accountId, entry.accountName)
    }
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [history?.entries])

  const days = useMemo(
    () =>
      Array.from(
        new Set((history?.entries ?? []).map((entry) => entry.day)),
      ).sort(),
    [history?.entries],
  )
  const rangeStart = startDay || days[0] || ""
  const rangeEnd = endDay || days.at(-1) || ""
  const effectiveIds =
    selectedAccountIds.length > 0
      ? selectedAccountIds
      : accounts.map((account) => account.id)

  const filteredEntries = useMemo(
    () =>
      (history?.entries ?? []).filter(
        (entry) =>
          effectiveIds.includes(entry.accountId) &&
          (!rangeStart || entry.day >= rangeStart) &&
          (!rangeEnd || entry.day <= rangeEnd),
      ),
    [effectiveIds, history?.entries, rangeEnd, rangeStart],
  )

  const summaries = useMemo(
    () =>
      accounts
        .filter((account) => effectiveIds.includes(account.id))
        .map((account) => {
          const entries = filteredEntries
            .filter((entry) => entry.accountId === account.id)
            .sort((a, b) => a.day.localeCompare(b.day))
          const start = entries[0]?.balanceUsd ?? null
          const end = entries.at(-1)?.balanceUsd ?? null
          const incomeValues = entries.flatMap((entry) =>
            entry.incomeUsd === null ? [] : [entry.incomeUsd],
          )
          const outcomeValues = entries.flatMap((entry) =>
            entry.consumptionUsd === null ? [] : [entry.consumptionUsd],
          )
          return {
            ...account,
            start,
            end,
            change: start === null || end === null ? null : end - start,
            income:
              incomeValues.length > 0
                ? incomeValues.reduce((sum, value) => sum + value, 0)
                : null,
            outcome:
              outcomeValues.length > 0
                ? outcomeValues.reduce((sum, value) => sum + value, 0)
                : null,
            coverage: entries.length,
          }
        }),
    [accounts, effectiveIds, filteredEntries],
  )

  const totals = useMemo(
    () => ({
      end: summaries.some((item) => item.end !== null)
        ? summaries.reduce((sum, item) => sum + (item.end ?? 0), 0)
        : null,
      change: summaries.some((item) => item.change !== null)
        ? summaries.reduce((sum, item) => sum + (item.change ?? 0), 0)
        : null,
      income: summaries.some((item) => item.income !== null)
        ? summaries.reduce((sum, item) => sum + (item.income ?? 0), 0)
        : null,
      outcome: summaries.some((item) => item.outcome !== null)
        ? summaries.reduce((sum, item) => sum + (item.outcome ?? 0), 0)
        : null,
    }),
    [summaries],
  )

  const trendOption = useMemo(() => {
    const series = summaries.map((account) => {
      const valuesByDay = new Map(
        filteredEntries
          .filter((entry) => entry.accountId === account.id)
          .map((entry) => [entry.day, entry.balanceUsd]),
      )
      return {
        name: account.name,
        values: days
          .filter(
            (day) =>
              (!rangeStart || day >= rangeStart) &&
              (!rangeEnd || day <= rangeEnd),
          )
          .map((day) => valuesByDay.get(day) ?? null),
      }
    })
    return buildMultiSeriesTrendOption({
      dayKeys: days.filter(
        (day) =>
          (!rangeStart || day >= rangeStart) && (!rangeEnd || day <= rangeEnd),
      ),
      series,
      chartType: "line",
      yAxisLabel: "余额 ($)",
      axisLabelFormatter: (value) => String(value),
      valueFormatter: (value) => money(Number(value)),
    })
  }, [days, filteredEntries, rangeEnd, rangeStart, summaries])

  const breakdownRows = summaries.filter((item) => item.end !== null)
  const breakdownOption = useMemo(
    () =>
      buildAccountBreakdownPieOption({
        categories: breakdownRows.map((item) => item.name),
        values: breakdownRows.map((item) => item.end ?? 0),
        valueLabel: "余额 ($)",
        valueFormatter: (value) => money(Number(value)),
      }),
    [breakdownRows],
  )

  const setQuickRange = (daysBack: number) => {
    const max = rangeEnd || new Date().toISOString().slice(0, 10)
    const start = new Date(`${max}T00:00:00`)
    start.setDate(start.getDate() - daysBack + 1)
    setStartDay(start.toISOString().slice(0, 10))
    setEndDay(max)
  }

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="余额历史"
      description="记录每日余额与收支快照，并可视化趋势。"
      inlineActions={
        <>
          <button
            type="button"
            onClick={() => void onRefresh?.()}
            disabled={!onRefresh}
            className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium disabled:opacity-50 dark:border-gray-700"
          >
            <RefreshCw className="size-4" />
            立即刷新
          </button>
          <button
            type="button"
            disabled
            className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium disabled:opacity-50 dark:border-gray-700"
            title="Web 服务暂未提供历史清理接口"
          >
            <Scissors className="size-4" />
            立即清理
          </button>
        </>
      }
    >
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        <div>
          <div className="text-sm font-medium">标签</div>
          <p className="mt-1 text-xs text-gray-500">按标签过滤账户。</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-white"
            >
              全部标签
            </button>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm font-medium">账户</div>
          <p className="mt-1 text-xs text-gray-500">选择要纳入图表的账户。</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedAccountIds([])}
              className={`rounded-full px-3 py-1 text-xs font-medium ${selectedAccountIds.length === 0 ? "bg-emerald-500 text-white" : "border border-gray-200"}`}
            >
              全部账户
            </button>
            {accounts.map((account) => {
              const selected = selectedAccountIds.includes(account.id)
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() =>
                    setSelectedAccountIds((current) =>
                      selected
                        ? current.filter((id) => id !== account.id)
                        : [...current, account.id],
                    )
                  }
                  className={`rounded-full px-3 py-1 text-xs font-medium ${selected ? "bg-emerald-500 text-white" : "border border-gray-200"}`}
                >
                  {account.name}
                </button>
              )
            })}
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm font-medium">货币单位</div>
          <div className="mt-2 inline-flex rounded-lg bg-gray-100 p-1 text-xs dark:bg-gray-800">
            <button
              type="button"
              className="rounded-md bg-white px-3 py-1.5 shadow-sm dark:bg-gray-900"
            >
              美元 ($)
            </button>
            <button type="button" className="px-3 py-1.5 text-gray-500">
              人民币 (¥)
            </button>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm font-medium">时间范围</div>
          <p className="mt-1 text-xs text-gray-500">
            受保留窗口限制（365 天）。
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              开始时间
              <input
                type="date"
                value={rangeStart}
                onChange={(event) => setStartDay(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
            <label className="text-xs">
              结束时间
              <input
                type="date"
                value={rangeEnd}
                onChange={(event) => setEndDay(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              [7, "近7天"],
              [30, "近30天"],
              [90, "近90天"],
              [180, "近180天"],
              [365, "近1年"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setQuickRange(Number(value))}
                className="h-8 rounded-md border border-gray-200 px-3 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        <h2 className="text-sm font-semibold">概览</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["结束余额", totals.end],
            ["区间净变化", totals.change],
            ["区间收入", totals.income],
            ["区间支出", totals.outcome],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md bg-gray-50 p-3 dark:bg-gray-800/60"
            >
              <div className="text-xs text-gray-500">{label}</div>
              <div className="mt-1 text-lg font-semibold">
                {money(value as number | null)}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {summaries.filter((item) => item.end !== null).length}/
                {summaries.length} 个账户
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
          <div className="mb-2 text-sm font-semibold">账户分布：余额</div>
          {breakdownRows.length > 0 ? (
            <EChart option={breakdownOption} className="h-72" />
          ) : (
            <div className="flex h-72 items-center justify-center text-sm text-gray-500">
              该分布暂无可展示的数据。
            </div>
          )}
        </section>
        <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
          <div className="mb-2 text-sm font-semibold">趋势：余额</div>
          {filteredEntries.length > 0 ? (
            <EChart option={trendOption} className="h-72" />
          ) : (
            <div className="flex h-72 items-center justify-center text-sm text-gray-500">
              暂无趋势数据
            </div>
          )}
        </section>
      </div>

      <section className="mt-5 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-5 pt-5 text-sm font-semibold">账户汇总</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800">
              <tr>
                <th className="px-5 py-3">账户</th>
                <th className="px-5 py-3">开始余额</th>
                <th className="px-5 py-3">结束余额</th>
                <th className="px-5 py-3">区间净变化</th>
                <th className="px-5 py-3">区间收入</th>
                <th className="px-5 py-3">区间支出</th>
                <th className="px-5 py-3">快照覆盖</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {summaries.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3 font-medium text-blue-600">
                    {item.name} ↗
                  </td>
                  <td className="px-5 py-3">{money(item.start)}</td>
                  <td className="px-5 py-3">{money(item.end)}</td>
                  <td className="px-5 py-3">{money(item.change)}</td>
                  <td className="px-5 py-3">{money(item.income)}</td>
                  <td className="px-5 py-3">{money(item.outcome)}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {item.coverage}/{days.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </WebDialog>
  )
}

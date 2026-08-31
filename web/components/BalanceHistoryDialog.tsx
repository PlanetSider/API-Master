import type { WebBalanceHistoryResponse } from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface BalanceHistoryDialogProps {
  open: boolean
  history: WebBalanceHistoryResponse | null
  onClose: () => void
}

const money = (value: number | null) =>
  value === null
    ? "--"
    : new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "USD",
      }).format(value)

export function BalanceHistoryDialog({
  open,
  history,
  onClose,
}: BalanceHistoryDialogProps) {
  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="余额历史"
      description="成功刷新账户后自动记录每日快照。"
    >
      {!history || history.entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">暂无历史快照</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 font-medium">日期</th>
                <th className="px-3 py-2 font-medium">账户</th>
                <th className="px-3 py-2 text-right font-medium">余额</th>
                <th className="px-3 py-2 text-right font-medium">收入</th>
                <th className="px-3 py-2 text-right font-medium">消费</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {history.entries.map((entry) => (
                <tr key={`${entry.accountId}:${entry.day}`}>
                  <td className="px-3 py-2">{entry.day}</td>
                  <td className="px-3 py-2 font-medium">{entry.accountName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(entry.balanceUsd)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(entry.incomeUsd)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(entry.consumptionUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WebDialog>
  )
}

import type { WebUsageHistoryResponse } from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface UsageHistoryDialogProps {
  open: boolean
  busy: boolean
  history: WebUsageHistoryResponse | null
  onClose: () => void
  onSync: () => Promise<void>
}

const integer = new Intl.NumberFormat("zh-CN")
const money = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "USD",
})

export function UsageHistoryDialog({
  open,
  busy,
  history,
  onClose,
  onSync,
}: UsageHistoryDialogProps) {
  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="用量历史"
      description="从站点消费日志增量同步并生成隐私安全的聚合统计。"
      footer={
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSync()}
          className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "正在同步..." : "立即同步"}
        </button>
      }
    >
      {history?.statuses.some((status) => status.state === "error") ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          部分账户同步失败，请检查账户健康状态或上游日志接口。
        </div>
      ) : null}
      {!history || history.entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">暂无用量记录</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 font-medium">日期</th>
                <th className="px-3 py-2 font-medium">账户</th>
                <th className="px-3 py-2 text-right font-medium">请求</th>
                <th className="px-3 py-2 text-right font-medium">输入 Token</th>
                <th className="px-3 py-2 text-right font-medium">输出 Token</th>
                <th className="px-3 py-2 text-right font-medium">消费</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {history.entries.map((entry) => (
                <tr key={`${entry.accountId}:${entry.day}`}>
                  <td className="px-3 py-2">{entry.day}</td>
                  <td className="px-3 py-2 font-medium">{entry.accountName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {integer.format(entry.requests)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {integer.format(entry.promptTokens)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {integer.format(entry.completionTokens)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money.format(entry.consumedUsd)}
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

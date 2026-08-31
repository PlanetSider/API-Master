import { useMemo, useState } from "react"

import type { WebAllModelCatalogResponse } from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface AllModelCatalogDialogProps {
  open: boolean
  busy: boolean
  catalog: WebAllModelCatalogResponse | null
  onClose: () => void
  onRefresh: () => Promise<void>
}

const statusLabels = {
  success: "已加载",
  error: "加载失败",
  unsupported: "暂不支持",
  skipped: "已停用",
} as const

export function AllModelCatalogDialog({
  open,
  busy,
  catalog,
  onClose,
  onRefresh,
}: AllModelCatalogDialogProps) {
  const [search, setSearch] = useState("")
  const [accountId, setAccountId] = useState("")

  const models = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (catalog?.models ?? []).filter((model) => {
      const inAccount =
        !accountId ||
        model.accounts.some((account) => account.accountId === accountId)
      const matchesSearch =
        !query ||
        `${model.id} ${model.vendor ?? ""}`.toLowerCase().includes(query)
      return inAccount && matchesSearch
    })
  }, [accountId, catalog?.models, search])

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="模型总览"
      description="并发读取启用账户的模型目录，并显示每个模型的来源账户。"
      footer={
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRefresh()}
          className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "正在加载..." : "重新加载"}
        </button>
      }
    >
      {catalog ? (
        <div className="mb-4 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-5 dark:text-gray-300">
          <span>模型 {catalog.summary.modelCount}</span>
          <span>成功 {catalog.summary.succeeded}</span>
          <span>失败 {catalog.summary.failed}</span>
          <span>不支持 {catalog.summary.unsupported}</span>
          <span>停用 {catalog.summary.skipped}</span>
        </div>
      ) : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索模型或供应方"
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
        />
        <select
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          aria-label="按账户筛选"
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">全部账户</option>
          {(catalog?.accounts ?? []).map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {account.accountName} · {statusLabels[account.status]}
            </option>
          ))}
        </select>
      </div>
      {catalog?.accounts.some((account) => account.status === "error") ? (
        <div className="mb-4 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {catalog.accounts
            .filter((account) => account.status === "error")
            .map((account) => (
              <div key={account.accountId}>
                {account.accountName}: {account.error || "模型目录加载失败"}
              </div>
            ))}
        </div>
      ) : null}
      {models.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">暂无匹配模型</p>
      ) : (
        <div className="max-h-[55vh] divide-y divide-gray-200 overflow-y-auto rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {models.map((model) => (
            <div
              key={model.id}
              className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium break-all">{model.id}</div>
                {model.vendor ? (
                  <div className="text-xs text-gray-500">{model.vendor}</div>
                ) : null}
              </div>
              <div className="shrink-0 text-xs text-gray-500">
                {model.accounts
                  .map((account) => account.accountName)
                  .join("、")}
              </div>
            </div>
          ))}
        </div>
      )}
    </WebDialog>
  )
}

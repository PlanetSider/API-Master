import { RefreshCw } from "lucide-react"
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
  const [vendor, setVendor] = useState("")
  const [sort, setSort] = useState<"name" | "sources">("name")

  const vendors = useMemo(
    () =>
      Array.from(
        new Set(
          (catalog?.models ?? [])
            .map((model) => model.vendor)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [catalog?.models],
  )

  const models = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = (catalog?.models ?? []).filter((model) => {
      const inAccount =
        !accountId ||
        model.accounts.some((account) => account.accountId === accountId)
      const matchesSearch =
        !query ||
        `${model.id} ${model.vendor ?? ""}`.toLowerCase().includes(query)
      return inAccount && matchesSearch && (!vendor || model.vendor === vendor)
    })
    return [...filtered].sort((left, right) =>
      sort === "sources"
        ? right.accounts.length - left.accounts.length ||
          left.id.localeCompare(right.id)
        : left.id.localeCompare(right.id),
    )
  }, [accountId, catalog?.models, search, sort, vendor])

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="模型列表"
      description="查看和管理可用的 AI 模型。"
      inlineActions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRefresh()}
          className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "正在加载..." : "重新加载"}
        </button>
      }
      footer={
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRefresh()}
          className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <RefreshCw
            className={`mr-2 inline size-4 ${busy ? "animate-spin" : ""}`}
          />
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
      {vendors.length > 0 ? (
        <div
          role="tablist"
          aria-label="模型供应商"
          className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!vendor}
            onClick={() => setVendor("")}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${!vendor ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"}`}
          >
            全部供应商
          </button>
          {vendors.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={vendor === item}
              onClick={() => setVendor(item)}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${vendor === item ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"}`}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
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
        <select
          value={vendor}
          onChange={(event) => setVendor(event.target.value)}
          aria-label="按供应商筛选"
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">全部供应商</option>
          {vendors.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as "name" | "sources")
          }
          aria-label="模型排序"
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="name">按名称排序</option>
          <option value="sources">按来源数量排序</option>
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
        <div className="space-y-2">
          <div className="text-xs text-gray-500">
            显示 {models.length} / {catalog?.models.length ?? 0} 个模型
          </div>
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {models.map((model) => (
              <div
                key={model.id}
                className="flex min-h-24 flex-col justify-between gap-2 rounded-md border border-gray-200 bg-white p-3 transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-700"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium break-all">
                    {model.id}
                  </div>
                  {model.vendor ? (
                    <div className="text-xs text-gray-500">{model.vendor}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1 text-xs text-gray-500">
                  {model.accounts.map((account) => (
                    <span
                      key={account.accountId}
                      className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800"
                    >
                      {account.accountName}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </WebDialog>
  )
}

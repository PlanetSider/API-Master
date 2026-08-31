import { useMemo, useState } from "react"

import type { WebModelCatalogResponse } from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface ModelCatalogDialogProps {
  open: boolean
  catalog: WebModelCatalogResponse | null
  onClose: () => void
}

export function ModelCatalogDialog({
  open,
  catalog,
  onClose,
}: ModelCatalogDialogProps) {
  const [search, setSearch] = useState("")
  const models = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query
      ? (catalog?.models ?? []).filter((model) =>
          `${model.id} ${model.vendor ?? ""}`.toLowerCase().includes(query),
        )
      : catalog?.models ?? []
  }, [catalog?.models, search])

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title={catalog ? `${catalog.accountName} · 模型列表` : "模型列表"}
      description={
        catalog?.supported === false
          ? "当前站点尚未提供可复用的服务端模型目录。"
          : `共 ${catalog?.models.length ?? 0} 个可用模型`
      }
    >
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="搜索模型"
        className="mb-4 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
      />
      {models.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">暂无模型</p>
      ) : (
        <div className="max-h-[55vh] divide-y divide-gray-200 overflow-y-auto rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {models.map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <span className="min-w-0 text-sm font-medium break-all">
                {model.id}
              </span>
              {model.vendor ? (
                <span className="shrink-0 text-xs text-gray-500">
                  {model.vendor}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </WebDialog>
  )
}

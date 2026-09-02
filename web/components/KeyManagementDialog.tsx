import {
  CheckCircle2,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
} from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"

import type { WebAccountSummary, WebApiKeyListResponse } from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface KeyManagementDialogProps {
  open: boolean
  busy: boolean
  keys: WebApiKeyListResponse | null
  createdSecret: string | null
  title?: string
  accounts?: WebAccountSummary[]
  onClose: () => void
  onCreate: (name: string) => Promise<void>
  onDelete: (tokenId: number | string) => Promise<void>
  onUpdate: (tokenId: number | string, name: string) => Promise<void>
  onSelectAccount?: (account: WebAccountSummary) => Promise<void>
  onRefresh?: () => Promise<void>
}

const formatQuota = (value: number) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const formatExpiration = (value: number) => {
  if (!value || value < 0) return "永不过期"
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(
    value > 10_000_000_000 ? value : value * 1000,
  )
}

export function KeyManagementDialog({
  open,
  busy,
  keys,
  createdSecret,
  title = "密钥管理",
  accounts = [],
  onClose,
  onCreate,
  onDelete,
  onUpdate,
  onSelectAccount,
  onRefresh,
}: KeyManagementDialogProps) {
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState<number | string | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([])

  const visibleKeys = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return keys?.keys ?? []
    return (keys?.keys ?? []).filter((key) =>
      [key.name, key.group, key.modelLimits, String(key.id)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    )
  }, [keys?.keys, search])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    if (editingId === null) await onCreate(name.trim())
    else await onUpdate(editingId, name.trim())
    setName("")
    setEditingId(null)
    setCreating(false)
  }

  const headerActions = (
    <>
      <button
        type="button"
        disabled={busy || !keys?.supported}
        onClick={() => {
          setCreating(true)
          setEditingId(null)
          setName("")
        }}
        className="flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <Plus className="size-4" />
        添加 API 密钥
      </button>
      <button
        type="button"
        disabled={busy || !keys}
        className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        <Wrench className="size-4" />
        密钥检查
      </button>
      <button
        type="button"
        disabled={busy || !keys}
        onClick={() => void onRefresh?.()}
        className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        <RefreshCw className="size-4" />
        刷新管理站点渠道状态
      </button>
      <button
        type="button"
        disabled={busy || !keys}
        onClick={() => void onRefresh?.()}
        className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <RefreshCw className="size-4" />
        刷新密钥列表
      </button>
    </>
  )

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title={title}
      description="此页面显示所有账号的 API 密钥信息，包括使用情况和过期时间。请妥善保管您的 API 密钥，避免泄露给他人。"
      inlineActions={headerActions}
      footer={headerActions}
    >
      <p className="-mt-6 mb-7 text-sm text-gray-600 dark:text-gray-300">
        将账号 Key 一键导入自建 AI 网关后，多个 Key 即可通过同一个 AI API
        使用；直接导出到客户端工具仍是网关路径。
      </p>

      <div className="mb-5">
        <label className="mb-2 block text-base font-semibold">选择账号</label>
        <select
          value={keys?.accountId ?? ""}
          disabled={busy || accounts.length === 0}
          onChange={(event) => {
            const account = accounts.find(
              (item) => item.id === event.target.value,
            )
            if (account) void onSelectAccount?.(account)
          }}
          className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          {accounts.length === 0 ? <option value="">暂无账号</option> : null}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <div className="mt-2 flex flex-wrap gap-6 text-sm text-gray-500">
          <span>总计 {keys?.keys.length ?? 0} 个密钥</span>
          <span>
            启用 {(keys?.keys ?? []).filter((key) => key.status !== 0).length}{" "}
            个
          </span>
          <span>显示 {visibleKeys.length} 个</span>
        </div>
      </div>

      {creating || editingId !== null ? (
        <form
          onSubmit={submit}
          className="mb-4 flex gap-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20"
        >
          <input
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="密钥名称"
            className="h-9 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
          />
          <button
            type="submit"
            disabled={busy || !keys?.supported}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {editingId === null ? "创建" : "更新"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false)
              setEditingId(null)
              setName("")
            }}
            className="h-9 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700"
          >
            取消
          </button>
        </form>
      ) : null}

      {createdSecret ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
            新密钥秘密（仅显示一次）
          </div>
          <code className="mt-1 block text-sm break-all">{createdSecret}</code>
        </div>
      ) : null}

      <label className="relative mb-4 block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索密钥名称..."
          className="h-10 w-full rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
        />
      </label>

      <div className="mb-4 flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 px-3 dark:border-gray-700">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={
              visibleKeys.length > 0 &&
              selectedIds.length === visibleKeys.length
            }
            onChange={(event) =>
              setSelectedIds(
                event.target.checked ? visibleKeys.map((key) => key.id) : [],
              )
            }
          />
          当前可见已选 {selectedIds.length}/{visibleKeys.length}
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="h-8 rounded-md border px-3 text-sm disabled:opacity-40"
            disabled={!selectedIds.length}
          >
            清空选择
          </button>
          <button
            type="button"
            className="h-8 rounded-md border px-3 text-sm disabled:opacity-40"
            disabled={!selectedIds.length}
          >
            批量导入到 CLIProxyAPI（{selectedIds.length}）
          </button>
          <button
            type="button"
            className="h-8 rounded-md border px-3 text-sm disabled:opacity-40"
            disabled={!selectedIds.length}
          >
            保存到 API 凭据库（{selectedIds.length}）
          </button>
          <button
            type="button"
            className="h-8 rounded-md bg-blue-500 px-3 text-sm text-white disabled:opacity-40"
            disabled={!selectedIds.length}
          >
            批量导入到 New API（{selectedIds.length}）
          </button>
        </div>
      </div>

      {!keys || visibleKeys.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">
          {keys ? "暂无匹配密钥" : "正在加载密钥..."}
        </p>
      ) : (
        <div className="space-y-3">
          {visibleKeys.map((key) => (
            <article
              key={key.id}
              className="rounded-lg border border-gray-200 px-4 py-4 dark:border-gray-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(key.id)}
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, key.id]
                          : current.filter((id) => id !== key.id),
                      )
                    }
                  />
                  <h3 className="font-semibold">{key.name}</h3>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                    已启用
                  </span>
                  <span className="rounded-full border px-2 py-0.5 text-xs">
                    {keys.accountName}
                  </span>
                  <span className="rounded-full border px-2 py-0.5 text-xs">
                    {key.group || "default"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <button
                    type="button"
                    aria-label="查看密钥"
                    title="查看密钥"
                    className="flex size-8 items-center justify-center rounded-md hover:bg-gray-100"
                  >
                    <Eye className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="检查密钥"
                    title="检查密钥"
                    className="flex size-8 items-center justify-center rounded-md hover:bg-gray-100"
                  >
                    <CheckCircle2 className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="编辑密钥"
                    title="编辑密钥"
                    onClick={() => {
                      setEditingId(key.id)
                      setCreating(false)
                      setName(key.name)
                    }}
                    className="flex size-8 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="删除密钥"
                    title="删除密钥"
                    disabled={busy}
                    onClick={() => void onDelete(key.id)}
                    className="flex size-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 text-sm text-gray-500">
                <span>密钥：</span>
                <code className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
                  sk-{String(key.id).slice(0, 4)}****************
                </code>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="inline text-gray-500">分组：</dt>
                  <dd className="inline font-medium">
                    {key.group || "default"}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-gray-500">已用额度：</dt>
                  <dd className="inline font-medium">
                    {formatQuota(key.usedQuota)}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-gray-500">剩余额度：</dt>
                  <dd className="inline font-medium">
                    {key.unlimitedQuota
                      ? "无限额度"
                      : formatQuota(key.remainingQuota)}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-gray-500">过期时间：</dt>
                  <dd className="inline font-medium">
                    {formatExpiration(key.expiresAt)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="font-medium">注意事项</div>
        <div className="mt-1">请妥善保管 API 密钥，避免泄露。</div>
      </div>
    </WebDialog>
  )
}

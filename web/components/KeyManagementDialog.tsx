import { Pencil, Trash2 } from "lucide-react"
import { useState, type FormEvent } from "react"

import type { WebApiKeyListResponse } from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface KeyManagementDialogProps {
  open: boolean
  busy: boolean
  keys: WebApiKeyListResponse | null
  createdSecret: string | null
  title?: string
  onClose: () => void
  onCreate: (name: string) => Promise<void>
  onDelete: (tokenId: number | string) => Promise<void>
  onUpdate: (tokenId: number | string, name: string) => Promise<void>
}

export function KeyManagementDialog({
  open,
  busy,
  keys,
  createdSecret,
  title,
  onClose,
  onCreate,
  onDelete,
  onUpdate,
}: KeyManagementDialogProps) {
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState<number | string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (editingId === null) await onCreate(name)
    else await onUpdate(editingId, name)
    setName("")
    setEditingId(null)
  }

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title={title ?? (keys ? `${keys.accountName} · API 密钥` : "API 密钥")}
      description="密钥列表只显示元数据；新秘密仅在供应方创建响应允许时显示一次。"
    >
      <form onSubmit={submit} className="mb-4 flex gap-2">
        <input
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
      </form>
      {createdSecret ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
            新密钥秘密
          </div>
          <code className="mt-1 block text-sm break-all">{createdSecret}</code>
        </div>
      ) : null}
      {!keys || keys.keys.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">暂无密钥</p>
      ) : (
        <div className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {keys.keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{key.name}</div>
                <div className="text-xs text-gray-500">
                  ID {key.id} ·{" "}
                  {key.unlimitedQuota
                    ? "无限额度"
                    : `剩余额度 ${key.remainingQuota}`}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="编辑密钥"
                  title="编辑密钥"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(key.id)
                    setName(key.name)
                  }}
                  className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="删除密钥"
                  title="删除密钥"
                  disabled={busy}
                  onClick={() => void onDelete(key.id)}
                  className="flex size-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </WebDialog>
  )
}

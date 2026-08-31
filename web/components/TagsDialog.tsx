import { Check, Pencil, Plus, Tag, Trash2, X } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import type { WebTagListResponse, WebTagSummary } from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface TagsDialogProps {
  open: boolean
  loading: boolean
  data: WebTagListResponse
  onClose: () => void
  onCreate: (name: string) => Promise<void>
  onRename: (tagId: string, name: string) => Promise<void>
  onDelete: (tag: WebTagSummary) => Promise<void>
}

const inputClassName =
  "h-9 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"

export function TagsDialog({
  open,
  loading,
  data,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: TagsDialogProps) {
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<WebTagSummary | null>(null)

  useEffect(() => {
    if (!open) {
      setNewName("")
      setEditingId(null)
      setEditingName("")
      setDeleteTarget(null)
    }
  }, [open])

  const submitNewTag = async (event: FormEvent) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    await onCreate(name)
    setNewName("")
  }

  const submitRename = async (tagId: string) => {
    const name = editingName.trim()
    if (!name) return
    await onRename(tagId, name)
    setEditingId(null)
    setEditingName("")
  }

  return (
    <>
      <WebDialog
        open={open}
        onClose={onClose}
        title="标签管理"
        description={`共 ${data.tags.length} 个标签`}
      >
        <form onSubmit={submitNewTag} className="flex gap-2">
          <label className="sr-only" htmlFor="web-new-tag-name">
            新标签名称
          </label>
          <input
            id="web-new-tag-name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            maxLength={80}
            placeholder="新标签名称"
            className={inputClassName}
          />
          <button
            type="submit"
            disabled={loading || !newName.trim()}
            className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="size-4" />
            创建
          </button>
        </form>

        <div className="mt-4 divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {data.tags.length === 0 ? (
            <div className="flex min-h-28 flex-col items-center justify-center text-sm text-gray-500">
              <Tag className="mb-2 size-5" />
              暂无标签
            </div>
          ) : (
            data.tags.map((tag) => (
              <div
                key={tag.id}
                className="flex min-h-12 items-center gap-2 py-2"
              >
                {editingId === tag.id ? (
                  <>
                    <label className="sr-only" htmlFor={`tag-name-${tag.id}`}>
                      标签名称
                    </label>
                    <input
                      id={`tag-name-${tag.id}`}
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      maxLength={80}
                      className={inputClassName}
                    />
                    <button
                      type="button"
                      disabled={loading || !editingName.trim()}
                      aria-label={`保存标签 ${tag.name}`}
                      title="保存"
                      onClick={() => void submitRename(tag.id)}
                      className="flex size-8 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:hover:bg-blue-950/40"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      aria-label={`取消重命名 ${tag.name}`}
                      title="取消"
                      onClick={() => {
                        setEditingId(null)
                        setEditingName("")
                      }}
                      className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {tag.name}
                    </span>
                    <button
                      type="button"
                      disabled={loading}
                      aria-label={`重命名标签 ${tag.name}`}
                      title="重命名"
                      onClick={() => {
                        setEditingId(tag.id)
                        setEditingName(tag.name)
                      }}
                      className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-white"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      aria-label={`删除标签 ${tag.name}`}
                      title="删除"
                      onClick={() => setDeleteTarget(tag)}
                      className="flex size-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </WebDialog>

      <WebDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="删除标签"
        description={
          deleteTarget ? `将删除标签“${deleteTarget.name}”。` : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              type="button"
              disabled={loading || !deleteTarget}
              onClick={async () => {
                if (!deleteTarget) return
                await onDelete(deleteTarget)
                setDeleteTarget(null)
              }}
              className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              确认删除
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          账户和 API 凭据中的该标签引用会一并移除。
        </p>
      </WebDialog>
    </>
  )
}

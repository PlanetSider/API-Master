import { Bookmark, ExternalLink, Pencil, Pin, Plus, Trash2 } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import { Checkbox } from "~/components/ui"
import type {
  WebBookmarkCreateInput,
  WebBookmarkListResponse,
  WebBookmarkPatchInput,
  WebBookmarkSummary,
  WebTagSummary,
} from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface Props {
  open: boolean
  busy: boolean
  bookmarks: WebBookmarkListResponse
  tags: WebTagSummary[]
  onClose: () => void
  onCreate: (input: WebBookmarkCreateInput) => Promise<void>
  onUpdate: (id: string, input: WebBookmarkPatchInput) => Promise<void>
  onDelete: (bookmark: WebBookmarkSummary) => Promise<void>
}

const emptyForm = { name: "", url: "", notes: "" }

export function BookmarksDialog({
  open,
  busy,
  bookmarks,
  tags,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState<WebBookmarkSummary | null>(null)
  const [name, setName] = useState(emptyForm.name)
  const [url, setUrl] = useState(emptyForm.url)
  const [notes, setNotes] = useState(emptyForm.notes)
  const [tagIds, setTagIds] = useState<string[]>([])

  useEffect(() => {
    if (!open) {
      setEditing(null)
      setName(emptyForm.name)
      setUrl(emptyForm.url)
      setNotes(emptyForm.notes)
      setTagIds([])
    }
  }, [open])

  const beginCreate = () => {
    setEditing(null)
    setName(emptyForm.name)
    setUrl(emptyForm.url)
    setNotes(emptyForm.notes)
    setTagIds([])
  }

  const beginEdit = (bookmark: WebBookmarkSummary) => {
    setEditing(bookmark)
    setName(bookmark.name)
    setUrl(bookmark.url)
    setNotes(bookmark.notes)
    setTagIds(bookmark.tagIds)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (editing) {
      await onUpdate(editing.id, { name, url, tagIds, notes })
    } else {
      await onCreate({ name, url, tagIds, notes })
    }
    beginCreate()
  }

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="书签"
      description="保存常用站点地址，在浏览器中直接打开。"
    >
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">名称</span>
            <input
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：生产控制台"
              className="h-9 rounded-md border border-gray-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">网址</span>
            <input
              required
              type="url"
              maxLength={2048}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              className="h-9 rounded-md border border-gray-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-300">备注</span>
          <textarea
            maxLength={4000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="可选"
            className="resize-y rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm text-gray-600 dark:text-gray-300">
            标签
          </legend>
          {tags.length === 0 ? (
            <p className="text-sm text-gray-500">暂无可用标签</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const checked = tagIds.includes(tag.id)
                return (
                  <label
                    key={tag.id}
                    className="flex h-8 items-center gap-2 rounded-md border border-gray-300 px-2.5 text-sm dark:border-gray-700"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) =>
                        setTagIds((current) =>
                          nextChecked === true
                            ? Array.from(new Set([...current, tag.id]))
                            : current.filter((id) => id !== tag.id),
                        )
                      }
                    />
                    {tag.name}
                  </label>
                )
              })}
            </div>
          )}
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2">
          {editing ? (
            <button
              type="button"
              onClick={beginCreate}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              取消编辑
            </button>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {editing ? (
              <Pencil className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            {editing ? "保存修改" : "添加书签"}
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-2" aria-label="书签列表">
        {bookmarks.bookmarks.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700">
            <Bookmark className="mx-auto size-6 text-gray-400" />
            <p className="mt-2">暂无书签</p>
          </div>
        ) : (
          bookmarks.bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="flex items-start gap-3 rounded-md border border-gray-200 px-3 py-3 dark:border-gray-700"
            >
              <Bookmark
                className={`mt-0.5 size-4 shrink-0 ${bookmark.pinned ? "fill-blue-600 text-blue-600" : "text-gray-400"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {bookmark.name}
                  </span>
                  {bookmark.pinned ? (
                    <span className="shrink-0 text-xs text-blue-600">
                      已置顶
                    </span>
                  ) : null}
                </div>
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {bookmark.url}
                </a>
                {bookmark.tagIds.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {bookmark.tagIds.map((tagId) => {
                      const tag = tags.find(
                        (candidate) => candidate.id === tagId,
                      )
                      return tag ? (
                        <span
                          key={tag.id}
                          className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {tag.name}
                        </span>
                      ) : null
                    })}
                  </div>
                ) : null}
                {bookmark.notes ? (
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                    {bookmark.notes}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label="打开书签"
                  title="打开书签"
                  onClick={() =>
                    window.open(bookmark.url, "_blank", "noopener,noreferrer")
                  }
                  className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                >
                  <ExternalLink className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={bookmark.pinned ? "取消置顶" : "置顶书签"}
                  title={bookmark.pinned ? "取消置顶" : "置顶书签"}
                  disabled={busy}
                  onClick={() =>
                    void onUpdate(bookmark.id, { pinned: !bookmark.pinned })
                  }
                  className={`flex size-8 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 ${bookmark.pinned ? "text-blue-600" : "text-gray-500"}`}
                >
                  <Pin className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="编辑书签"
                  title="编辑书签"
                  onClick={() => beginEdit(bookmark)}
                  className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="删除书签"
                  title="删除书签"
                  disabled={busy}
                  onClick={() => void onDelete(bookmark)}
                  className="flex size-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </WebDialog>
  )
}

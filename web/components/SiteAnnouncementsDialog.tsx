import { Bell, CheckCheck, ExternalLink, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"

import type { WebSiteAnnouncementListResponse } from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface Props {
  open: boolean
  busy: boolean
  announcements: WebSiteAnnouncementListResponse | null
  onClose: () => void
  onSync: () => Promise<void>
  onMarkRead: (recordId: string) => Promise<void>
  onMarkAllRead: (siteKey?: string) => Promise<void>
}

const formatTime = (value?: number) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "尚未检查"

export function SiteAnnouncementsDialog({
  open,
  busy,
  announcements,
  onClose,
  onSync,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  const [siteKey, setSiteKey] = useState<string>("")
  const [siteType, setSiteType] = useState<string>("")
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all")
  const siteTypeOptions = useMemo(
    () =>
      [
        ...new Set(
          (announcements?.records ?? []).map((record) => record.siteType),
        ),
      ].sort(),
    [announcements?.records],
  )
  const records = useMemo(
    () =>
      (announcements?.records ?? []).filter(
        (record) =>
          (!siteKey || record.siteKey === siteKey) &&
          (!siteType || record.siteType === siteType) &&
          (readFilter === "all" ||
            (readFilter === "read" ? record.read : !record.read)),
      ),
    [announcements?.records, readFilter, siteKey, siteType],
  )

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="网站公告"
      description="自动抓取和展示各站点的重要公告，包括维护通知、开站优惠、费率调整等。"
      inlineActions={
        <>
          <button
            type="button"
            disabled={busy || !announcements?.unreadCount}
            onClick={() => void onMarkAllRead(siteKey || undefined)}
            className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <CheckCheck className="size-4" />
            全部已读
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSync()}
            className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <RefreshCw className="size-4" />
            {busy ? "正在检查..." : "立即检查"}
          </button>
        </>
      }
      footer={
        <>
          <button
            type="button"
            disabled={busy || !announcements?.unreadCount}
            onClick={() => void onMarkAllRead(siteKey || undefined)}
            className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <CheckCheck className="size-4" />
            全部已读
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSync()}
            className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <RefreshCw className="size-4" />
            {busy ? "正在检查..." : "立即检查"}
          </button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          ["公告总数", announcements?.records.length ?? 0, "text-blue-600"],
          ["未读公告", announcements?.unreadCount ?? 0, "text-amber-600"],
          ["站点数量", announcements?.sites.length ?? 0, "text-gray-700"],
        ].map(([label, value, tone]) => (
          <div
            key={label}
            className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
          >
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="sr-only">站点</span>
          <select
            value={siteKey}
            onChange={(event) => setSiteKey(event.target.value)}
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950"
          >
            <option value="">全部站点</option>
            {(announcements?.sites ?? []).map((site) => (
              <option key={site.siteKey} value={site.siteKey}>
                {site.siteName || site.baseUrl}
              </option>
            ))}
          </select>
        </label>
        <select
          value={siteType}
          onChange={(event) => setSiteType(event.target.value)}
          className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">全部类型</option>
          {siteTypeOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={readFilter}
          onChange={(event) =>
            setReadFilter(event.target.value as typeof readFilter)
          }
          className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="all">全部状态</option>
          <option value="unread">仅未读</option>
          <option value="read">已读</option>
        </select>
      </div>

      {announcements?.sites.some((site) => site.lastError) ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          部分站点检查失败或暂不支持公告接口。详情请查看对应站点状态。
        </div>
      ) : null}

      {records.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-gray-500">
          <Bell className="size-7 text-gray-400" />
          <p>{announcements ? "暂无公告" : "公告尚未加载"}</p>
          <p className="text-xs">可以点击“立即检查”读取最新内容。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <article
              key={record.id}
              className={`rounded-lg border border-gray-200 p-4 dark:border-gray-700 ${record.read ? "opacity-75" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      {record.title || "站点公告"}
                    </h3>
                    {!record.read ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        未读
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                        已读
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {record.siteName || record.baseUrl} ·{" "}
                    {formatTime(record.createdAt ?? record.firstSeenAt)}
                  </div>
                </div>
                {!record.read ? (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label="标记公告已读"
                    title="标记公告已读"
                    onClick={() => void onMarkRead(record.id)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-white"
                  >
                    <CheckCheck className="size-4" />
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {record.content || "暂无正文"}
              </p>
              <a
                href={record.baseUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                <ExternalLink className="size-3.5" />
                打开站点
              </a>
            </article>
          ))}
        </div>
      )}
    </WebDialog>
  )
}

import {
  CheckCircle2,
  Columns3,
  ExternalLink,
  Filter,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"

import type {
  WebManagedChannelInput,
  WebManagedChannelListResponse,
  WebManagedModelSyncInput,
  WebManagedModelSyncResponse,
  WebManagedSiteConnectionListResponse,
} from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface ManagedSitesDashboardProps {
  mode: "channels" | "sync"
  busy: boolean
  connections: WebManagedSiteConnectionListResponse | null
  channels: WebManagedChannelListResponse | null
  onLoadChannels: (id: string) => Promise<void>
  onDeleteChannel: (id: string, channelId: number) => Promise<void>
  onCreateChannel: (id: string, input: WebManagedChannelInput) => Promise<void>
  onSyncModels: (
    id: string,
    input?: WebManagedModelSyncInput,
  ) => Promise<WebManagedModelSyncResponse>
  onClose: () => void
}

const formatTime = (value?: number) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(value)
    : "从未执行"

export function ManagedSitesDashboard({
  mode,
  busy,
  connections,
  channels,
  onLoadChannels,
  onDeleteChannel,
  onCreateChannel,
  onSyncModels,
  onClose,
}: ManagedSitesDashboardProps) {
  const [selectedConnectionId, setSelectedConnectionId] = useState("")
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [channelName, setChannelName] = useState("")
  const [channelType, setChannelType] = useState("1")
  const [channelCredential, setChannelCredential] = useState("")
  const [channelBaseUrl, setChannelBaseUrl] = useState("")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [syncResult, setSyncResult] =
    useState<WebManagedModelSyncResponse | null>(null)
  const loadedConnectionRef = useRef("")

  const availableConnections = connections?.connections ?? []
  const effectiveConnectionId =
    selectedConnectionId ||
    channels?.connection.id ||
    availableConnections[0]?.id ||
    ""

  useEffect(() => {
    if (
      !effectiveConnectionId ||
      loadedConnectionRef.current === effectiveConnectionId
    )
      return
    loadedConnectionRef.current = effectiveConnectionId
    setSelectedConnectionId(effectiveConnectionId)
    void onLoadChannels(effectiveConnectionId)
  }, [effectiveConnectionId, onLoadChannels])

  const visibleChannels = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const source =
      channels?.connection.id === effectiveConnectionId ? channels.channels : []
    if (!keyword) return source
    return source.filter((channel) =>
      [channel.name, channel.baseUrl, channel.id, channel.type]
        .map(String)
        .some((value) => value.toLowerCase().includes(keyword)),
    )
  }, [channels, effectiveConnectionId, search])

  const submitChannel = async (event: FormEvent) => {
    event.preventDefault()
    if (!effectiveConnectionId) return
    await onCreateChannel(effectiveConnectionId, {
      name: channelName,
      type: Number(channelType) || channelType,
      credential: channelCredential,
      baseUrl: channelBaseUrl,
      models: [],
      groups: ["default"],
      priority: 0,
      weight: 0,
      enabled: true,
    })
    setShowCreate(false)
    setChannelName("")
    setChannelCredential("")
    setChannelBaseUrl("")
    await onLoadChannels(effectiveConnectionId)
  }

  const connectionSelect = (
    <select
      aria-label="选择管理站点"
      value={effectiveConnectionId}
      disabled={busy || availableConnections.length === 0}
      onChange={(event) => {
        const id = event.target.value
        setSelectedConnectionId(id)
        void onLoadChannels(id)
      }}
      className="h-9 min-w-44 rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
    >
      {availableConnections.length === 0 ? (
        <option value="">New API</option>
      ) : null}
      {availableConnections.map((connection) => (
        <option key={connection.id} value={connection.id}>
          {connection.name}
        </option>
      ))}
    </select>
  )

  if (mode === "channels") {
    return (
      <WebDialog
        open
        onClose={onClose}
        title="渠道管理"
        description="管理自建 AI 网关中的渠道，把多个账号 Key 或 API Key 汇总成一个统一 AI API。外部客户端不需要使用此网关签发的调用 Key。"
        titleActions={
          <button
            type="button"
            aria-label="打开外部管理"
            title="打开外部管理"
            className="flex size-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 dark:border-gray-700"
          >
            <ExternalLink className="size-4" />
          </button>
        }
        inlineActions={
          <>
            <button
              type="button"
              disabled={busy || !effectiveConnectionId}
              onClick={() => void onLoadChannels(effectiveConnectionId)}
              className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium disabled:opacity-50 dark:border-gray-700"
            >
              <RefreshCw className="size-4" />
              刷新
            </button>
            {connectionSelect}
          </>
        }
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap gap-3">
            <label className="relative min-w-64 flex-1 sm:max-w-96">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="按名称、URL 或分组搜索"
                className="h-9 w-full rounded-md border border-gray-300 pr-3 pl-9 text-sm dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700"
            >
              <Filter className="size-4" />
              状态
            </button>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700"
            >
              <Columns3 className="size-4" />
              显示列
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={selectedIds.length === 0}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm text-gray-500 disabled:opacity-40 dark:border-gray-700"
            >
              删除所选
            </button>
            <button
              type="button"
              disabled={!effectiveConnectionId}
              onClick={() => setShowCreate(true)}
              className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus className="size-4" />
              新增渠道
            </button>
          </div>
        </div>

        {showCreate ? (
          <form
            onSubmit={submitChannel}
            className="mb-5 grid gap-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4 sm:grid-cols-2 dark:border-blue-900 dark:bg-blue-950/20"
          >
            <input
              required
              value={channelName}
              onChange={(event) => setChannelName(event.target.value)}
              placeholder="渠道名称"
              className="h-9 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              required
              value={channelType}
              onChange={(event) => setChannelType(event.target.value)}
              placeholder="渠道类型"
              className="h-9 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              required
              type="password"
              value={channelCredential}
              onChange={(event) => setChannelCredential(event.target.value)}
              placeholder="渠道密钥"
              className="h-9 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              value={channelBaseUrl}
              onChange={(event) => setChannelBaseUrl(event.target.value)}
              placeholder="渠道地址"
              className="h-9 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
            <div className="flex gap-2 sm:col-span-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="h-9 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700"
              >
                取消
              </button>
              <button
                disabled={busy}
                className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white"
              >
                创建渠道
              </button>
            </div>
          </form>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        visibleChannels.length > 0 &&
                        selectedIds.length === visibleChannels.length
                      }
                      onChange={(event) =>
                        setSelectedIds(
                          event.target.checked
                            ? visibleChannels.map((item) => item.id)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">渠道</th>
                  <th className="px-4 py-3">类型</th>
                  <th className="px-4 py-3">模型数量</th>
                  <th className="px-4 py-3">可用分组</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">优先级</th>
                  <th className="px-4 py-3">权重</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {visibleChannels.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-10 text-center">
                      <Layers3 className="mx-auto size-8 text-gray-300" />
                      <div className="mt-3 font-medium">
                        还没有自建 AI 网关渠道
                      </div>
                      <p className="mx-auto mt-1 max-w-xl text-sm text-gray-500">
                        当前自建 AI 网关还没有渠道。请先导入账号 Key 或 API
                        Key，之后这个网关即可作为统一 AI API
                        提供给外部客户端使用。
                      </p>
                      <div className="mt-4 flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            window.location.hash = "#keys"
                          }}
                          className="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white"
                        >
                          从账号 Key 导入渠道
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.hash = "#apiCredentialProfiles"
                          }}
                          className="h-9 rounded-md border border-gray-300 px-3 text-sm font-medium dark:border-gray-700"
                        >
                          从 API 凭据库导入渠道
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleChannels.map((channel) => (
                    <tr key={channel.id}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(channel.id)}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, channel.id]
                                : current.filter((id) => id !== channel.id),
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3">{channel.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{channel.name}</div>
                        <div className="max-w-56 truncate text-xs text-gray-500">
                          {channel.baseUrl || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{channel.type}</td>
                      <td className="px-4 py-3">{channel.modelCount}</td>
                      <td className="px-4 py-3">
                        {channel.groups.join(", ") || "default"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${channel.enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                        >
                          {channel.enabled ? "启用" : "停用"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{channel.priority}</td>
                      <td className="px-4 py-3">{channel.weight}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void onDeleteChannel(
                              effectiveConnectionId,
                              channel.id,
                            )
                          }
                          className="text-sm text-red-500"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        <div className="mt-5 flex items-center justify-between text-sm text-gray-500">
          <label>
            每页行数{" "}
            <select className="ml-2 h-8 rounded-md border border-gray-300 px-2 dark:border-gray-700 dark:bg-gray-950">
              <option>10</option>
            </select>
          </label>
          <span>
            {visibleChannels.length
              ? `共 ${visibleChannels.length} 条`
              : "暂无数据"}
          </span>
        </div>
      </WebDialog>
    )
  }

  const resultItems = syncResult?.items ?? []
  const successCount = resultItems.filter((item) => item.ok).length
  const failureCount = resultItems.length - successCount
  const duration = syncResult
    ? Math.max(0, syncResult.finishedAt - syncResult.startedAt) / 1000
    : 0

  const runSync = async (channelIds?: number[]) => {
    if (!effectiveConnectionId) return
    setSyncResult(
      await onSyncModels(
        effectiveConnectionId,
        channelIds ? { channelIds } : undefined,
      ),
    )
  }

  return (
    <WebDialog
      open
      onClose={onClose}
      title="模型列表同步执行"
      description="自动更新自建 AI 网关中的模型列表，减少手动维护；渠道创建后可按需开启。"
      inlineActions={connectionSelect}
    >
      <p className="-mt-5 mb-7 text-sm text-gray-600 dark:text-gray-300">
        模型同步可自动更新网关模型列表、映射或路由，减少手动维护；它是渠道创建后的增强功能，不影响已有渠道作为统一
        AI API 使用。
      </p>
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <div className="text-sm text-gray-500">自动同步</div>
            <div className="mt-2">
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                已启用
              </span>
              <span className="ml-2 text-sm">每 1 小时</span>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">下次计划时间</div>
            <div className="mt-2 text-lg font-semibold">尚未排期</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">上次运行</div>
            <div className="mt-2 text-lg font-semibold">
              {formatTime(syncResult?.finishedAt)}
            </div>
          </div>
        </div>
      </section>
      <section className="mt-5 rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        <h2 className="text-xl font-semibold">上一次执行</h2>
        <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {[
            ["渠道总数", resultItems.length, ""],
            ["成功数量", successCount, "text-emerald-600"],
            ["失败数量", failureCount, "text-red-600"],
            ["耗时", `${duration.toFixed(1)}s`, ""],
          ].map(([label, value, tone]) => (
            <div key={label}>
              <div className="text-sm text-gray-500">{label}</div>
              <div className={`mt-1 text-2xl font-semibold ${tone}`}>
                {value}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-between border-t border-gray-200 pt-4 text-sm text-gray-500 dark:border-gray-700">
          <span>开始时间: {formatTime(syncResult?.startedAt)}</span>
          <span>结束时间: {formatTime(syncResult?.finishedAt)}</span>
        </div>
      </section>
      <div className="mt-5 grid grid-cols-2 rounded-lg bg-gray-100 p-1 text-center text-sm dark:bg-gray-800">
        <button
          type="button"
          className="rounded-md bg-white px-3 py-2 font-medium text-blue-600 shadow-sm dark:bg-gray-900"
        >
          执行记录
        </button>
        <button type="button" className="px-3 py-2">
          手动执行
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !effectiveConnectionId}
          onClick={() => void runSync()}
          className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-50"
        >
          <RefreshCw className="size-4" />
          执行全部
        </button>
        <button
          type="button"
          disabled={busy || selectedIds.length === 0}
          onClick={() => void runSync(selectedIds)}
          className="h-9 rounded-md border border-gray-300 px-3 text-sm disabled:opacity-40 dark:border-gray-700"
        >
          执行所选（{selectedIds.length}）
        </button>
        <button
          type="button"
          disabled={busy || failureCount === 0}
          onClick={() =>
            void runSync(
              resultItems
                .filter((item) => !item.ok)
                .map((item) => item.channelId),
            )
          }
          className="h-9 rounded-md border border-gray-300 px-3 text-sm disabled:opacity-40 dark:border-gray-700"
        >
          仅重试失败项
        </button>
        <button
          type="button"
          onClick={() => void onLoadChannels(effectiveConnectionId)}
          className="flex h-9 items-center gap-2 px-3 text-sm"
        >
          <RefreshCw className="size-4" />
          刷新结果
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white"
        >
          全部 {resultItems.length}
        </button>
        <button
          type="button"
          className="rounded-md bg-gray-100 px-3 py-2 text-sm dark:bg-gray-800"
        >
          成功 {successCount}
        </button>
        <button
          type="button"
          className="rounded-md bg-gray-100 px-3 py-2 text-sm dark:bg-gray-800"
        >
          失败 {failureCount}
        </button>
        <label className="relative min-w-64 flex-1 sm:max-w-96">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="按渠道名称、ID 或错误信息搜索..."
            className="h-9 w-full rounded-md border border-gray-300 pr-3 pl-9 text-sm dark:border-gray-700 dark:bg-gray-950"
          />
        </label>
      </div>
      <section className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input type="checkbox" />
                </th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">渠道 ID</th>
                <th className="px-4 py-3">渠道名称</th>
                <th className="px-4 py-3">错误信息</th>
                <th className="px-4 py-3">尝试次数</th>
                <th className="px-4 py-3">完成时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {resultItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    暂无执行记录
                  </td>
                </tr>
              ) : (
                resultItems
                  .filter(
                    (item) =>
                      !search ||
                      `${item.channelName} ${item.channelId} ${item.message ?? ""}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((item) => (
                    <tr key={item.channelId}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.channelId)}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, item.channelId]
                                : current.filter((id) => id !== item.channelId),
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        {item.ok ? (
                          <CheckCircle2 className="size-5 text-emerald-600" />
                        ) : (
                          <XCircle className="size-5 text-red-600" />
                        )}
                      </td>
                      <td className="px-4 py-3">{item.channelId}</td>
                      <td className="px-4 py-3 font-medium text-blue-600">
                        {item.channelName} ↗
                      </td>
                      <td className="px-4 py-3">
                        {item.ok ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                            成功
                          </span>
                        ) : (
                          <>
                            <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
                              失败
                            </span>
                            <div className="mt-1 text-xs">{item.message}</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">{item.attempts}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatTime(item.finishedAt)}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </WebDialog>
  )
}

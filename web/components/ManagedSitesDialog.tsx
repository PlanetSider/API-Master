import { Pencil, SlidersHorizontal, Trash2 } from "lucide-react"
import { useState, type FormEvent } from "react"

import type {
  WebChannelConfigPatch,
  WebChannelConfigResponse,
  WebManagedChannelInput,
  WebManagedChannelListResponse,
  WebManagedModelSyncInput,
  WebManagedModelSyncResponse,
  WebManagedSiteConnectionInput,
  WebManagedSiteConnectionListResponse,
} from "~/web/contracts"

import { ChannelFiltersDialog } from "./ChannelFiltersDialog"
import { WebDialog } from "./WebDialog"

interface Props {
  open: boolean
  busy: boolean
  connections: WebManagedSiteConnectionListResponse | null
  channels: WebManagedChannelListResponse | null
  title?: string
  onClose: () => void
  onCreate: (input: WebManagedSiteConnectionInput) => Promise<void>
  onLoadChannels: (id: string) => Promise<void>
  onDeleteConnection: (id: string) => Promise<void>
  onDeleteChannel: (id: string, channelId: number) => Promise<void>
  onCreateChannel: (id: string, input: WebManagedChannelInput) => Promise<void>
  onUpdateChannel: (
    id: string,
    channelId: number,
    input: WebManagedChannelInput,
  ) => Promise<void>
  onSyncModels: (
    id: string,
    input?: WebManagedModelSyncInput,
  ) => Promise<WebManagedModelSyncResponse>
  channelConfigs?: WebChannelConfigResponse | null
  onUpdateChannelConfig?: (input: WebChannelConfigPatch) => Promise<void>
}

export function ManagedSitesDialog(props: Props) {
  const [name, setName] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [adminToken, setAdminToken] = useState("")
  const [userId, setUserId] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [siteType, setSiteType] =
    useState<WebManagedSiteConnectionInput["siteType"]>("new-api")
  const [deleteChannelId, setDeleteChannelId] = useState<number | null>(null)
  const [editingChannelId, setEditingChannelId] = useState<number | null>(null)
  const [channelName, setChannelName] = useState("")
  const [channelType, setChannelType] = useState("1")
  const [channelCredential, setChannelCredential] = useState("")
  const [channelBaseUrl, setChannelBaseUrl] = useState("")
  const [channelModels, setChannelModels] = useState("")
  const [channelGroups, setChannelGroups] = useState("default")
  const [channelPriority, setChannelPriority] = useState(0)
  const [channelWeight, setChannelWeight] = useState(0)
  const [channelEnabled, setChannelEnabled] = useState(true)
  const [modelSyncResult, setModelSyncResult] =
    useState<WebManagedModelSyncResponse | null>(null)
  const [filterChannelId, setFilterChannelId] = useState<number | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await props.onCreate({
      name,
      baseUrl,
      adminToken,
      userId,
      siteType,
      username,
      password,
      email,
    })
    setName("")
    setBaseUrl("")
    setAdminToken("")
    setUserId("")
    setUsername("")
    setPassword("")
    setEmail("")
  }

  const submitChannel = async (event: FormEvent) => {
    event.preventDefault()
    if (!props.channels) return
    const numericType = Number(channelType)
    const input: WebManagedChannelInput = {
      name: channelName,
      type: Number.isFinite(numericType) ? numericType : channelType,
      credential: channelCredential,
      baseUrl: channelBaseUrl,
      models: channelModels
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      groups: channelGroups
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      priority: channelPriority,
      weight: channelWeight,
      enabled: channelEnabled,
    }
    if (editingChannelId === null)
      await props.onCreateChannel(props.channels.connection.id, input)
    else
      await props.onUpdateChannel(
        props.channels.connection.id,
        editingChannelId,
        input,
      )
    setEditingChannelId(null)
    setChannelName("")
    setChannelCredential("")
  }

  return (
    <>
      <WebDialog
        open={props.open}
        onClose={props.onClose}
        title={props.title ?? "托管站点"}
        description="管理员凭据加密保存在服务端，不会返回到连接列表。"
      >
        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2">
          <input
            required
            aria-label="连接名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="连接名称"
            className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
          />
          <select
            aria-label="站点类型"
            value={siteType}
            onChange={(e) => setSiteType(e.target.value as typeof siteType)}
            className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
          >
            <option value="new-api">New API</option>
            <option value="Veloera">Veloera</option>
            <option value="done-hub">DoneHub</option>
            <option value="octopus">Octopus</option>
            <option value="sub2api">Sub2API</option>
            <option value="axonhub">AxonHub</option>
            <option value="claude-code-hub">Claude Code Hub</option>
          </select>
          <input
            required
            aria-label="站点地址"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="站点地址"
            className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
          />
          {siteType === "octopus" ? (
            <>
              <input
                required
                aria-label="管理员用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="管理员用户名"
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
              <input
                required
                aria-label="管理员密码"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="管理员密码"
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
            </>
          ) : siteType === "axonhub" ? (
            <>
              <input
                required
                aria-label="管理员邮箱"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="管理员邮箱"
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
              <input
                required
                aria-label="管理员密码"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="管理员密码"
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
            </>
          ) : (
            <>
              {siteType !== "sub2api" && siteType !== "claude-code-hub" ? (
                <input
                  required
                  aria-label="管理员用户 ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="管理员用户 ID"
                  className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
                />
              ) : null}
              <input
                required
                aria-label={
                  siteType === "sub2api" ? "Admin API Key" : "管理员 Token"
                }
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder={
                  siteType === "sub2api"
                    ? "Admin API Key"
                    : siteType === "claude-code-hub"
                      ? "Admin Token"
                      : "管理员 Token"
                }
                className="h-9 rounded-md border px-3 text-sm sm:col-span-2 dark:bg-gray-950"
              />
            </>
          )}
          <button
            disabled={props.busy}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white sm:col-span-2"
          >
            添加连接
          </button>
        </form>
        <div className="mt-5 space-y-2">
          {props.connections?.connections.map((connection) => (
            <div
              key={connection.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <button
                onClick={() => void props.onLoadChannels(connection.id)}
                className="min-w-0 text-left"
              >
                <div className="truncate text-sm font-medium">
                  {connection.name}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {connection.siteType} · {connection.baseUrl}
                </div>
              </button>
              <button
                aria-label="删除连接"
                title="删除连接"
                onClick={() => void props.onDeleteConnection(connection.id)}
                className="flex size-8 items-center justify-center text-red-500"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        {props.channels ? (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                渠道（{props.channels.total}）
              </h3>
              <button
                type="button"
                disabled={props.busy}
                onClick={async () => {
                  setModelSyncResult(
                    await props.onSyncModels(props.channels!.connection.id),
                  )
                }}
                className="h-9 rounded-md border border-blue-300 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40"
              >
                同步上游模型
              </button>
            </div>
            {modelSyncResult ? (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/60">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>成功 {modelSyncResult.summary.succeeded}</span>
                  <span>失败 {modelSyncResult.summary.failed}</span>
                  <span>更新 {modelSyncResult.summary.changed}</span>
                </div>
                {modelSyncResult.items.some((item) => !item.ok) ? (
                  <div className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-400">
                    {modelSyncResult.items
                      .filter((item) => !item.ok)
                      .map((item) => (
                        <div key={item.channelId}>
                          {item.channelName}：{item.message || "同步失败"}
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <form
              onSubmit={submitChannel}
              className="grid gap-2 rounded-md border p-3 sm:grid-cols-2"
            >
              <input
                required
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="渠道名称"
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
              <input
                required
                value={channelType}
                onChange={(e) => setChannelType(e.target.value)}
                placeholder="渠道类型"
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
              <input
                required={editingChannelId === null}
                type="password"
                value={channelCredential}
                onChange={(e) => setChannelCredential(e.target.value)}
                placeholder={
                  editingChannelId === null
                    ? "渠道密钥"
                    : "渠道密钥（留空不修改）"
                }
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
              <input
                value={channelBaseUrl}
                onChange={(e) => setChannelBaseUrl(e.target.value)}
                placeholder="渠道地址"
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
              <input
                value={channelModels}
                onChange={(e) => setChannelModels(e.target.value)}
                placeholder="模型，逗号分隔"
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
              <input
                value={channelGroups}
                onChange={(e) => setChannelGroups(e.target.value)}
                placeholder="分组，逗号分隔"
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
              <input
                type="number"
                value={channelPriority}
                onChange={(e) => setChannelPriority(Number(e.target.value))}
                placeholder="优先级"
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
              <input
                type="number"
                value={channelWeight}
                onChange={(e) => setChannelWeight(Number(e.target.value))}
                placeholder="权重"
                className="h-9 rounded-md border px-3 text-sm dark:bg-gray-950"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={channelEnabled}
                  onChange={(e) => setChannelEnabled(e.target.checked)}
                />
                启用渠道
              </label>
              <button
                disabled={props.busy}
                className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white"
              >
                {editingChannelId === null ? "创建渠道" : "更新渠道"}
              </button>
            </form>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2">渠道</th>
                    <th className="px-3 py-2">类型</th>
                    <th className="px-3 py-2">模型</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {props.channels.channels.map((channel) => (
                    <tr key={channel.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{channel.name}</div>
                        <div className="text-xs text-gray-500">
                          {channel.baseUrl}
                        </div>
                      </td>
                      <td className="px-3 py-2">{channel.type}</td>
                      <td className="px-3 py-2">{channel.modelCount}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          aria-label="编辑模型过滤"
                          title="编辑模型过滤"
                          onClick={() => setFilterChannelId(channel.id)}
                          className="mr-3 text-gray-500"
                        >
                          <SlidersHorizontal className="size-4" />
                        </button>
                        <button
                          aria-label="编辑渠道"
                          title="编辑渠道"
                          onClick={() => {
                            setEditingChannelId(channel.id)
                            setChannelName(channel.name)
                            setChannelType(String(channel.type))
                            setChannelBaseUrl(channel.baseUrl)
                            setChannelModels(channel.models.join(","))
                            setChannelGroups(channel.groups.join(","))
                            setChannelPriority(channel.priority)
                            setChannelWeight(channel.weight)
                            setChannelEnabled(channel.enabled)
                            setChannelCredential("")
                          }}
                          className="mr-3 text-gray-500"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          aria-label="删除渠道"
                          title="删除渠道"
                          onClick={() => setDeleteChannelId(channel.id)}
                          className="text-red-500"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </WebDialog>
      <ChannelFiltersDialog
        open={filterChannelId !== null}
        busy={props.busy}
        connection={props.channels?.connection ?? null}
        channelId={filterChannelId}
        channelName={
          props.channels?.channels.find((item) => item.id === filterChannelId)
            ?.name
        }
        config={props.channelConfigs ?? null}
        onClose={() => setFilterChannelId(null)}
        onSave={async (input) => {
          if (!props.onUpdateChannelConfig) return
          await props.onUpdateChannelConfig(input)
        }}
      />
      <WebDialog
        open={deleteChannelId !== null}
        onClose={() => setDeleteChannelId(null)}
        title="删除渠道"
        description="此操作会删除上游托管站点中的渠道。"
        footer={
          <button
            onClick={async () => {
              if (deleteChannelId !== null && props.channels)
                await props.onDeleteChannel(
                  props.channels.connection.id,
                  deleteChannelId,
                )
              setDeleteChannelId(null)
            }}
            className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white"
          >
            确认删除
          </button>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          删除后无法从 Web 服务恢复，请确认上游渠道不再需要。
        </p>
      </WebDialog>
    </>
  )
}

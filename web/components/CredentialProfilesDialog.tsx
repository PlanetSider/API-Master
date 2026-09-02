import {
  Download,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Checkbox } from "~/components/ui"
import type {
  WebApiCredentialProfileCreateInput,
  WebApiCredentialProfileListResponse,
  WebApiCredentialProfileModelCatalogResponse,
  WebApiCredentialProfileSummary,
  WebApiCredentialProfileUpdateInput,
  WebApiCredentialProfileVerificationResponse,
  WebCredentialExportFormat,
  WebTagSummary,
} from "~/web/contracts"

import { ModelCatalogDialog } from "./ModelCatalogDialog"
import { WebDialog } from "./WebDialog"

interface CredentialProfilesDialogProps {
  open: boolean
  busy: boolean
  profiles: WebApiCredentialProfileListResponse | null
  tags: WebTagSummary[]
  onClose: () => void
  onCreate: (input: WebApiCredentialProfileCreateInput) => Promise<void>
  onUpdate: (
    id: string,
    input: WebApiCredentialProfileUpdateInput,
  ) => Promise<void>
  onDelete: (profile: WebApiCredentialProfileSummary) => Promise<void>
  onExport?: (
    profile: WebApiCredentialProfileSummary,
    format: WebCredentialExportFormat,
  ) => Promise<void>
  onLoadModels: (
    profile: WebApiCredentialProfileSummary,
  ) => Promise<WebApiCredentialProfileModelCatalogResponse>
  onVerify: (
    profile: WebApiCredentialProfileSummary,
    modelId?: string,
  ) => Promise<WebApiCredentialProfileVerificationResponse>
}

type FormState = {
  name: string
  apiType: WebApiCredentialProfileSummary["apiType"]
  baseUrl: string
  apiKey: string
  tagIds: string[]
  notes: string
  expiresAt: string
}

const emptyForm: FormState = {
  name: "",
  apiType: "openai-compatible",
  baseUrl: "",
  apiKey: "",
  tagIds: [],
  notes: "",
  expiresAt: "",
}

const maskForDisplay = (value: string) => value || "未设置"
const formatDateInput = (timestamp?: number) => {
  if (!timestamp || timestamp <= 0) return ""
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ""
  const year = String(date.getFullYear()).padStart(4, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const parseDateInput = (value: string) => {
  if (!value) return null
  const timestamp = new Date(`${value}T00:00:00`).getTime()
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null
}

const formatExpiration = (timestamp?: number) => {
  if (!timestamp || timestamp <= 0) return "未设置到期"
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return "未设置到期"
  return `${date.toLocaleDateString("zh-CN")} 到期`
}

export function CredentialProfilesDialog({
  open,
  busy,
  profiles,
  tags,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onExport = async () => {},
  onLoadModels,
  onVerify,
}: CredentialProfilesDialogProps) {
  const [editing, setEditing] = useState<WebApiCredentialProfileSummary | null>(
    null,
  )
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formOpen, setFormOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [models, setModels] =
    useState<WebApiCredentialProfileModelCatalogResponse | null>(null)
  const [modelOpen, setModelOpen] = useState(false)
  const [verifying, setVerifying] =
    useState<WebApiCredentialProfileSummary | null>(null)
  const [verification, setVerification] =
    useState<WebApiCredentialProfileVerificationResponse | null>(null)
  const [modelId, setModelId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [apiTypeFilter, setApiTypeFilter] = useState("")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [selectedBaseUrl, setSelectedBaseUrl] = useState("")

  useEffect(() => {
    if (!open) return
    setError(null)
  }, [open])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setRevealed(false)
    setError(null)
    setFormOpen(true)
  }

  const openEdit = (profile: WebApiCredentialProfileSummary) => {
    setEditing(profile)
    setForm({
      name: profile.name,
      apiType: profile.apiType,
      baseUrl: profile.baseUrl,
      apiKey: "",
      tagIds: profile.tagIds,
      notes: profile.notes,
      expiresAt: formatDateInput(profile.expiresAt),
    })
    setRevealed(false)
    setError(null)
    setFormOpen(true)
  }

  const submitForm = async () => {
    setError(null)
    try {
      if (editing) {
        const patch: WebApiCredentialProfileUpdateInput = {
          name: form.name,
          apiType: form.apiType,
          baseUrl: form.baseUrl,
          tagIds: form.tagIds,
          notes: form.notes,
          expiresAt: parseDateInput(form.expiresAt),
          ...(form.apiKey.trim() ? { apiKey: form.apiKey } : {}),
        }
        await onUpdate(editing.id, patch)
      } else {
        const expiresAt = parseDateInput(form.expiresAt)
        await onCreate({
          name: form.name,
          apiType: form.apiType,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          tagIds: form.tagIds,
          notes: form.notes,
          ...(expiresAt !== null ? { expiresAt } : {}),
        })
      }
      setFormOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败")
    }
  }

  const showModels = async (profile: WebApiCredentialProfileSummary) => {
    setError(null)
    try {
      setModels(await onLoadModels(profile))
      setModelOpen(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "模型列表加载失败")
    }
  }

  const showVerification = (profile: WebApiCredentialProfileSummary) => {
    setVerifying(profile)
    setVerification(null)
    setModelId("")
    setError(null)
  }

  const runVerification = async () => {
    if (!verifying) return
    setError(null)
    try {
      setVerification(await onVerify(verifying, modelId.trim() || undefined))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "验证失败")
    }
  }

  const exportProfile = async (
    profile: WebApiCredentialProfileSummary,
    format: WebCredentialExportFormat,
  ) => {
    if (
      !window.confirm(
        `导出“${profile.name}”的明文凭据？下载文件包含 API 密钥，请只保存到可信位置。`,
      )
    ) {
      return
    }
    setError(null)
    try {
      await onExport(profile, format)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出失败")
    }
  }

  const visibleProfiles = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (profiles?.profiles ?? []).filter((profile) => {
      const matchesSearch =
        !query ||
        `${profile.name} ${profile.baseUrl} ${profile.apiType} ${profile.notes}`
          .toLowerCase()
          .includes(query)
      return (
        matchesSearch &&
        (!apiTypeFilter || profile.apiType === apiTypeFilter) &&
        (selectedTagIds.length === 0 ||
          selectedTagIds.some((tagId) => profile.tagIds.includes(tagId)))
      )
    })
  }, [apiTypeFilter, profiles?.profiles, search, selectedTagIds])

  const endpointGroups = useMemo(() => {
    const groups = new Map<string, WebApiCredentialProfileSummary[]>()
    for (const profile of visibleProfiles) {
      const current = groups.get(profile.baseUrl)
      if (current) current.push(profile)
      else groups.set(profile.baseUrl, [profile])
    }
    return Array.from(groups, ([baseUrl, groupProfiles]) => ({
      baseUrl,
      profiles: groupProfiles,
    }))
  }, [visibleProfiles])

  useEffect(() => {
    if (
      !selectedBaseUrl ||
      !endpointGroups.some((group) => group.baseUrl === selectedBaseUrl)
    ) {
      setSelectedBaseUrl(endpointGroups[0]?.baseUrl ?? "")
    }
  }, [endpointGroups, selectedBaseUrl])

  const selectedEndpointProfiles =
    endpointGroups.find((group) => group.baseUrl === selectedBaseUrl)
      ?.profiles ?? []

  return (
    <>
      <WebDialog
        open={open}
        onClose={onClose}
        title="API 凭据库"
        description="集中保存常用 API Base URL 与 API Key，用于快速验证接口和查看模型。"
        inlineActions={
          <button
            type="button"
            aria-label="新增凭据"
            disabled={busy}
            onClick={openCreate}
            className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus className="size-4" />
            添加 API 凭据
          </button>
        }
        footer={
          <button
            type="button"
            aria-label="新增凭据"
            disabled={busy}
            onClick={openCreate}
            className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus className="size-4" />
            添加 API 凭据
          </button>
        }
      >
        {error ? (
          <p
            role="alert"
            className="mb-3 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        ) : null}
        {(profiles?.profiles ?? []).length === 0 ? (
          <div className="mx-auto max-w-md py-10 text-center text-sm text-gray-500">
            <KeyRound className="mx-auto mb-3 size-8 text-gray-300" />
            <p className="font-medium text-gray-700 dark:text-gray-200">
              暂无 API 凭据
            </p>
            <p className="mt-1">新增后可直接查看模型、验证接口并复用密钥。</p>
          </div>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
              <label className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="按名称、Base URL、标签或备注搜索"
                  aria-label="搜索 API 凭据"
                  className="h-9 w-full rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
                />
              </label>
              <select
                value={apiTypeFilter}
                onChange={(event) => setApiTypeFilter(event.target.value)}
                aria-label="按 API 类型筛选"
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
              >
                <option value="">全部 API 类型</option>
                <option value="openai-compatible">OpenAI 兼容</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google / Gemini</option>
              </select>
            </div>
            {tags.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-medium text-gray-500">
                  标签
                </span>
                <button
                  type="button"
                  aria-pressed={selectedTagIds.length === 0}
                  onClick={() => setSelectedTagIds([])}
                  className={`rounded-md border px-2 py-1 text-xs ${selectedTagIds.length === 0 ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                >
                  全部标签
                </button>
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id)
                  const count = (profiles?.profiles ?? []).filter((profile) =>
                    profile.tagIds.includes(tag.id),
                  ).length
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setSelectedTagIds((current) =>
                          selected
                            ? current.filter((id) => id !== tag.id)
                            : [...current, tag.id],
                        )
                      }
                      className={`rounded-md border px-2 py-1 text-xs ${selected ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                    >
                      {tag.name} ({count})
                    </button>
                  )
                })}
              </div>
            ) : null}
            {visibleProfiles.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                暂无匹配凭据
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <div
                  className={
                    endpointGroups.length > 1
                      ? "grid md:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)]"
                      : ""
                  }
                >
                  {endpointGroups.length > 1 ? (
                    <aside className="hidden border-r border-gray-200 bg-gray-50/70 p-2 md:block dark:border-gray-700 dark:bg-gray-950/40">
                      <div className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                        Base URL
                      </div>
                      <div className="space-y-1">
                        {endpointGroups.map((group) => {
                          const active = group.baseUrl === selectedBaseUrl
                          return (
                            <button
                              key={group.baseUrl}
                              type="button"
                              onClick={() => setSelectedBaseUrl(group.baseUrl)}
                              className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${active ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-transparent text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-900"}`}
                            >
                              <span
                                className="block truncate text-sm font-medium"
                                title={group.baseUrl}
                              >
                                {group.baseUrl}
                              </span>
                              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                                {group.profiles.length} 份凭据
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </aside>
                  ) : null}
                  <div className="min-w-0">
                    {endpointGroups.length > 1 ? (
                      <div className="border-b border-gray-200 bg-gray-50/70 p-3 md:hidden dark:border-gray-700 dark:bg-gray-950/40">
                        <label className="mb-1.5 block text-xs font-medium text-gray-500">
                          Base URL
                        </label>
                        <select
                          value={selectedBaseUrl}
                          onChange={(event) =>
                            setSelectedBaseUrl(event.target.value)
                          }
                          aria-label="选择 Base URL"
                          className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
                        >
                          {endpointGroups.map((group) => (
                            <option key={group.baseUrl} value={group.baseUrl}>
                              {group.baseUrl} · {group.profiles.length} 份凭据
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                      <div
                        className="truncate font-mono text-xs font-semibold sm:text-sm"
                        title={selectedBaseUrl}
                      >
                        {selectedBaseUrl}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {selectedEndpointProfiles.length} 份 API 凭据
                      </div>
                    </div>
                    <div className="grid gap-3 p-3">
                      {selectedEndpointProfiles.map((profile) => (
                        <div
                          key={profile.id}
                          className="flex flex-col justify-between gap-3 rounded-md border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-700"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                              <KeyRound className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {profile.name}
                              </div>
                              <div className="truncate text-xs text-gray-500">
                                {profile.baseUrl}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {profile.apiType} ·{" "}
                                {maskForDisplay(profile.apiKeyMasked)}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {formatExpiration(profile.expiresAt)}
                              </div>
                              {profile.tagIds.length > 0 ? (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {profile.tagIds.map((tagId) => {
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
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              aria-label="查看模型"
                              title="查看模型"
                              onClick={() => void showModels(profile)}
                              className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                            >
                              <Eye className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              aria-label="验证凭据"
                              title="验证凭据"
                              onClick={() => showVerification(profile)}
                              className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                            >
                              <ShieldCheck className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              aria-label="导出 JSON"
                              title="导出 JSON"
                              onClick={() =>
                                void exportProfile(profile, "json")
                              }
                              className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                            >
                              <Download className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              aria-label="导出 .env"
                              title="导出 .env"
                              onClick={() => void exportProfile(profile, "env")}
                              className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                            >
                              <Download className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              aria-label="编辑凭据"
                              title="编辑凭据"
                              onClick={() => openEdit(profile)}
                              className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              aria-label="删除凭据"
                              title="删除凭据"
                              onClick={() => void onDelete(profile)}
                              className="flex size-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/40"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </WebDialog>

      <WebDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "编辑 API 凭据" : "新增 API 凭据"}
        footer={
          <>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitForm()}
              className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              保存
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">名称</span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">API 类型</span>
            <select
              value={form.apiType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  apiType: event.target.value as FormState["apiType"],
                }))
              }
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="openai-compatible">OpenAI 兼容</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google / Gemini</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">基础地址</span>
            <input
              required
              type="url"
              value={form.baseUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  baseUrl: event.target.value,
                }))
              }
              placeholder="https://api.example.com"
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">
              API 密钥{editing ? "（留空则保留原密钥）" : ""}
            </span>
            <div className="relative">
              <input
                required={!editing}
                type={revealed ? "text" : "password"}
                value={form.apiKey}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    apiKey: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-gray-300 bg-white pr-10 pl-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
              />
              <button
                type="button"
                aria-label={revealed ? "隐藏密钥" : "显示密钥"}
                title={revealed ? "隐藏密钥" : "显示密钥"}
                onClick={() => setRevealed((value) => !value)}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Eye className="size-4" />
              </button>
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">备注</span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">到期日</span>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  expiresAt: event.target.value,
                }))
              }
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
            />
            <span className="text-xs text-gray-500">
              可选，用于记录这枚密钥预计失效的日期。
            </span>
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">标签</legend>
            {tags.length === 0 ? (
              <p className="text-sm text-gray-500">暂无可用标签</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const checked = form.tagIds.includes(tag.id)
                  return (
                    <label
                      key={tag.id}
                      className="flex h-8 items-center gap-2 rounded-md border border-gray-300 px-2.5 text-sm dark:border-gray-700"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(nextChecked) =>
                          setForm((current) => ({
                            ...current,
                            tagIds:
                              nextChecked === true
                                ? Array.from(
                                    new Set([...current.tagIds, tag.id]),
                                  )
                                : current.tagIds.filter((id) => id !== tag.id),
                          }))
                        }
                      />
                      {tag.name}
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>
        </div>
      </WebDialog>

      <ModelCatalogDialog
        open={modelOpen}
        catalog={
          models
            ? {
                accountId: models.profileId,
                accountName: models.profileName,
                supported: models.supported,
                models: models.models,
              }
            : null
        }
        onClose={() => setModelOpen(false)}
      />

      <WebDialog
        open={verifying !== null}
        onClose={() => setVerifying(null)}
        title={verifying ? `${verifying.name} · 凭据验证` : "凭据验证"}
        description="验证请求由服务端发起，结果会自动脱敏。"
        footer={
          <button
            type="button"
            disabled={busy}
            onClick={() => void runVerification()}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            开始验证
          </button>
        }
      >
        <div className="space-y-4">
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">模型（可选）</span>
            <input
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              placeholder="留空则自动选择模型"
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          {verification ? (
            <div className="space-y-2">
              <div className="text-xs text-gray-500">
                验证耗时{" "}
                {verification.report.finishedAt - verification.report.startedAt}{" "}
                ms · 模型 {verification.report.modelId || "未选择"}
              </div>
              <div className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                {verification.report.results.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-start justify-between gap-3 px-3 py-2.5"
                  >
                    <div>
                      <div className="text-sm font-medium">{result.id}</div>
                      <div className="text-xs text-gray-500">
                        {result.summary}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium ${result.status === "pass" ? "text-emerald-600" : result.status === "unsupported" ? "text-amber-600" : "text-red-600"}`}
                    >
                      {result.status === "pass"
                        ? "通过"
                        : result.status === "unsupported"
                          ? "不支持"
                          : "失败"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </WebDialog>
    </>
  )
}

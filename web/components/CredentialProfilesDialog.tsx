import {
  Download,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"

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
}

const emptyForm: FormState = {
  name: "",
  apiType: "openai-compatible",
  baseUrl: "",
  apiKey: "",
  tagIds: [],
  notes: "",
}

const maskForDisplay = (value: string) => value || "未设置"

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
          ...(form.apiKey.trim() ? { apiKey: form.apiKey } : {}),
        }
        await onUpdate(editing.id, patch)
      } else {
        await onCreate({ ...form, apiKey: form.apiKey })
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

  return (
    <>
      <WebDialog
        open={open}
        onClose={onClose}
        title="API 凭据库"
        description="集中保存可复用的 API 地址和密钥。密钥仅在服务端加密保存。"
        footer={
          <button
            type="button"
            disabled={busy}
            onClick={openCreate}
            className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus className="size-4" />
            新增凭据
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
          <div className="py-10 text-center text-sm text-gray-500">
            暂无 API 凭据。新增后可直接查看模型并运行连通性验证。
          </div>
        ) : (
          <div className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {profiles?.profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex flex-wrap items-center gap-3 px-3 py-3"
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
                      {profile.apiType} · {maskForDisplay(profile.apiKeyMasked)}
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
                    onClick={() => void exportProfile(profile, "json")}
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

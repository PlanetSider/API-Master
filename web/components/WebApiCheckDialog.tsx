import { Eye, KeyRound, RefreshCw, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"

import { API_TYPES } from "~/services/verification/aiApiVerification"
import type {
  ApiVerificationApiType,
  ApiVerificationReport,
} from "~/services/verification/aiApiVerification"
import { extractApiCheckCredentialsFromText } from "~/services/verification/webAiApiCheck/extractCredentials"
import type {
  WebApiCredentialProfileCreateInput,
  WebApiVerificationInput,
  WebApiVerificationModelsResponse,
  WebApiVerificationResponse,
} from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface WebApiCheckDialogProps {
  open: boolean
  busy: boolean
  onClose: () => void
  onFetchModels: (
    input: WebApiVerificationInput,
  ) => Promise<WebApiVerificationModelsResponse>
  onRunVerification: (
    input: WebApiVerificationInput,
  ) => Promise<WebApiVerificationResponse>
  onSaveProfile?: (input: WebApiCredentialProfileCreateInput) => Promise<void>
}

const apiTypeLabels: Record<ApiVerificationApiType, string> = {
  [API_TYPES.OPENAI_COMPATIBLE]: "OpenAI 兼容",
  [API_TYPES.OPENAI]: "OpenAI",
  [API_TYPES.ANTHROPIC]: "Anthropic",
  [API_TYPES.GOOGLE]: "Google / Gemini",
}

const resultStatusLabels = {
  pass: { label: "通过", className: "text-emerald-600" },
  fail: { label: "失败", className: "text-red-600" },
  unsupported: { label: "不支持", className: "text-amber-600" },
} as const

const emptyReport: ApiVerificationReport | null = null

export function WebApiCheckDialog({
  open,
  busy,
  onClose,
  onFetchModels,
  onRunVerification,
  onSaveProfile,
}: WebApiCheckDialogProps) {
  const [sourceText, setSourceText] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [apiType, setApiType] = useState<ApiVerificationApiType>(
    API_TYPES.OPENAI_COMPATIBLE,
  )
  const [modelId, setModelId] = useState("")
  const [models, setModels] = useState<string[]>([])
  const [report, setReport] = useState<ApiVerificationReport | null>(
    emptyReport,
  )
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [profileName, setProfileName] = useState("")
  const [profileNotes, setProfileNotes] = useState("")

  useEffect(() => {
    if (!open) return
    setError(null)
    setNotice(null)
  }, [open])

  const reextract = () => {
    const extracted = extractApiCheckCredentialsFromText(sourceText)
    if (extracted.baseUrl) setBaseUrl(extracted.baseUrl)
    if (extracted.apiKey) setApiKey(extracted.apiKey)
    setNotice(
      `已提取 ${extracted.baseUrlCandidates.length} 个地址、${extracted.apiKeyCandidates.length} 个密钥候选。`,
    )
    setError(null)
  }

  const validateInput = () => {
    if (!baseUrl.trim()) {
      setError("请输入 API 基础地址。")
      return null
    }
    if (!apiKey.trim()) {
      setError("请输入 API 密钥。")
      return null
    }
    return {
      apiType,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      ...(modelId.trim() ? { modelId: modelId.trim() } : {}),
    } satisfies WebApiVerificationInput
  }

  const fetchModels = async () => {
    const input = validateInput()
    if (!input) return
    setError(null)
    setNotice(null)
    try {
      const response = await onFetchModels(input)
      setModels(response.modelIds)
      if (!modelId.trim() && response.modelIds[0]) {
        setModelId(response.modelIds[0])
      }
      setNotice(`已获取 ${response.modelIds.length} 个模型。`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "模型列表获取失败")
    }
  }

  const runVerification = async () => {
    const input = validateInput()
    if (!input) return
    setError(null)
    setNotice(null)
    try {
      const response = await onRunVerification(input)
      setReport(response.report)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "API 验证失败")
    }
  }

  const saveProfile = async () => {
    if (!onSaveProfile) return
    const input = validateInput()
    if (!input) return
    if (!profileName.trim()) {
      setError("请输入保存名称。")
      return
    }
    setError(null)
    setNotice(null)
    try {
      await onSaveProfile({
        name: profileName.trim(),
        apiType: input.apiType,
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        notes: profileNotes.trim(),
      })
      setNotice(`已保存“${profileName.trim()}”到 API 凭据库。`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存到 API 凭据库失败")
    }
  }

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="AI API 功能可用性测试"
      description="AI API 功能可用性测试。API Key 默认隐藏，除非主动保存到凭据库，否则不会持久化。"
      inlineActions={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => void fetchModels()}
            className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className="size-4" />
            获取模型
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runVerification()}
            className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <ShieldCheck className="size-4" />
            开始检测
          </button>
          {onSaveProfile ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveProfile()}
              className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <KeyRound className="size-4" />
              保存到 API 凭据库
            </button>
          ) : null}
        </>
      }
      footer={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => void fetchModels()}
            className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className="size-4" />
            获取模型
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runVerification()}
            className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <ShieldCheck className="size-4" />
            开始检测
          </button>
          {onSaveProfile ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveProfile()}
              className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <KeyRound className="size-4" />
              保存到 API 凭据库
            </button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="text-sm text-emerald-600 dark:text-emerald-400"
          >
            {notice}
          </p>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">粘贴配置文本（可选）</span>
          <textarea
            aria-label="粘贴配置文本"
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="例如：base_url=https://api.example.com，api_key=sk-..."
            rows={3}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
          />
          <button
            type="button"
            disabled={!sourceText.trim() || busy}
            onClick={reextract}
            className="flex h-8 items-center gap-2 rounded-md border border-gray-300 px-2.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className="size-3.5" />
            重新提取
          </button>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">基础地址</span>
            <input
              aria-label="基础地址"
              required
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.example.com"
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">API 类型</span>
            <select
              aria-label="API 类型"
              value={apiType}
              onChange={(event) => {
                setApiType(event.target.value as ApiVerificationApiType)
                setModels([])
                setReport(null)
              }}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              {Object.entries(apiTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">模型（可选）</span>
            <input
              aria-label="模型"
              list="web-api-check-models"
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              placeholder="获取模型后选择，或手动输入"
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
            <datalist id="web-api-check-models">
              {models.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">API 密钥</span>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
            <input
              aria-label="API 密钥"
              required
              type={revealed ? "text" : "password"}
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="h-10 w-full rounded-md border border-gray-300 bg-white pr-10 pl-9 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
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

        {onSaveProfile ? (
          <fieldset className="space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <legend className="px-1 text-sm font-medium">
              保存选项（可选）
            </legend>
            <p className="text-xs text-gray-500">
              标签、备注和名称不会影响测试结果，仅用于保存到 API 凭据库。
            </p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">凭据名称</span>
              <input
                aria-label="凭据名称"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="例如：OpenAI 主账号"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">备注</span>
              <textarea
                aria-label="凭据备注"
                value={profileNotes}
                onChange={(event) => setProfileNotes(event.target.value)}
                rows={2}
                placeholder="可选备注"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950"
              />
            </label>
          </fieldset>
        ) : null}

        {report ? (
          <div className="space-y-2">
            <div className="text-xs text-gray-500">
              {apiTypeLabels[report.apiType]} · 模型{" "}
              {report.modelId || "未选择"} · 耗时{" "}
              {report.finishedAt - report.startedAt} ms
            </div>
            <div className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              {report.results.map((result) => {
                const status = resultStatusLabels[result.status]
                return (
                  <div
                    key={result.id}
                    className="flex items-start justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{result.id}</div>
                      <div className="text-xs text-gray-500">
                        {result.summary}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </WebDialog>
  )
}

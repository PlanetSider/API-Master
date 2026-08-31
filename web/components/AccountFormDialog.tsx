import { useEffect, useState, type FormEvent } from "react"

import { Checkbox } from "~/components/ui"
import type { AccountSiteType } from "~/constants/siteType"
import { ACCOUNT_SITE_TYPE_VALUES, SITE_TYPES } from "~/constants/siteType"
import { AuthTypeEnum } from "~/types"
import type {
  WebAccountPatchInput,
  WebAccountDetectionInput,
  WebAccountDetectionResponse,
  WebAccountSummary,
  WebCreateAccountInput,
  WebTagSummary,
} from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface AccountFormDialogProps {
  open: boolean
  loading: boolean
  revision: number
  onClose: () => void
  onCreate?: (input: WebCreateAccountInput) => Promise<void>
  onUpdate?: (accountId: string, input: WebAccountPatchInput) => Promise<void>
  onDetect?: (
    input: WebAccountDetectionInput,
  ) => Promise<WebAccountDetectionResponse>
  account?: WebAccountSummary | null
  tags: WebTagSummary[]
}

const fieldClassName =
  "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"

export function AccountFormDialog({
  open,
  loading,
  revision,
  onClose,
  onCreate,
  onUpdate,
  onDetect,
  account,
  tags,
}: AccountFormDialogProps) {
  const [name, setName] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [siteType, setSiteType] = useState<AccountSiteType>(SITE_TYPES.NEW_API)
  const [authType, setAuthType] = useState<AuthTypeEnum>(
    AuthTypeEnum.AccessToken,
  )
  const [credential, setCredential] = useState("")
  const [userId, setUserId] = useState("")
  const [username, setUsername] = useState("")
  const [exchangeRate, setExchangeRate] = useState(7.2)
  const [notes, setNotes] = useState("")
  const [tagIds, setTagIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(account?.name ?? "")
    setBaseUrl(account?.baseUrl ?? "")
    setSiteType(account?.siteType ?? SITE_TYPES.NEW_API)
    setAuthType(account?.authType ?? AuthTypeEnum.AccessToken)
    setCredential("")
    setUserId(account?.userId ?? "")
    setUsername(account?.username ?? "")
    setExchangeRate(account?.exchangeRate ?? 7.2)
    setNotes(account?.notes ?? "")
    setTagIds(account?.tagIds ?? [])
    setError(null)
  }, [account, open])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      if (account && onUpdate) {
        await onUpdate(account.id, {
          name,
          baseUrl,
          authType,
          ...(credential
            ? authType === AuthTypeEnum.AccessToken
              ? { accessToken: credential }
              : { sessionCookie: credential }
            : {}),
          userId,
          username,
          exchangeRate,
          tagIds,
          notes,
          expectedRevision: revision,
        })
      } else if (onCreate) {
        await onCreate({
          name,
          baseUrl,
          siteType,
          authType,
          ...(authType === AuthTypeEnum.AccessToken
            ? { accessToken: credential }
            : authType === AuthTypeEnum.Cookie
              ? { sessionCookie: credential }
              : {}),
          userId,
          username,
          exchangeRate,
          tagIds,
          notes,
          expectedRevision: revision,
        })
      }
      onClose()
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : account
            ? "账户更新失败"
            : "账户创建失败",
      )
    }
  }

  const handleDetect = async () => {
    if (!onDetect || account || !baseUrl.trim()) return
    setError(null)
    setDetecting(true)
    try {
      const detected = await onDetect({
        baseUrl,
        // The initial New API value is only a form default, not a detection
        // constraint. A user-selected alternative remains a useful hint.
        ...(siteType === SITE_TYPES.NEW_API ? {} : { siteType }),
        authType,
        ...(credential && authType === AuthTypeEnum.AccessToken
          ? { accessToken: credential }
          : {}),
        ...(credential && authType === AuthTypeEnum.Cookie
          ? { sessionCookie: credential }
          : {}),
      })
      setBaseUrl(detected.baseUrl)
      setSiteType(detected.siteType)
      setName((current) => current || detected.siteName)
      setUserId(detected.userId)
      setUsername(detected.username)
      setExchangeRate(detected.exchangeRate)
      setAuthType(detected.authType)
    } catch (detectError) {
      setError(
        detectError instanceof Error ? detectError.message : "账户自动识别失败",
      )
    } finally {
      setDetecting(false)
    }
  }

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title={account ? "编辑账户" : "添加账户"}
      description={
        account
          ? "留空凭据字段将保留当前值；修改地址或凭据后建议重新刷新账户。"
          : "账户凭据只会发送到当前 Web 服务，并加密写入持久化存储。"
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            取消
          </button>
          <button
            type="submit"
            form="web-account-form"
            disabled={loading}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "正在保存..." : account ? "保存修改" : "保存账户"}
          </button>
        </>
      }
    >
      <form id="web-account-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">账户名称</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClassName}
              placeholder="主账户"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">站点类型</span>
            <select
              value={siteType}
              onChange={(event) =>
                setSiteType(event.target.value as AccountSiteType)
              }
              disabled={Boolean(account)}
              className={fieldClassName}
            >
              {ACCOUNT_SITE_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">站点地址</span>
          <input
            required
            type="url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            className={fieldClassName}
            placeholder="https://api.example.com"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">认证方式</span>
            <select
              value={authType}
              onChange={(event) => {
                setAuthType(event.target.value as AuthTypeEnum)
                setCredential("")
              }}
              className={fieldClassName}
            >
              <option value={AuthTypeEnum.AccessToken}>Access Token</option>
              <option value={AuthTypeEnum.Cookie}>Cookie Session</option>
              <option value={AuthTypeEnum.None}>无需认证</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">
              {authType === AuthTypeEnum.AccessToken
                ? "Access Token"
                : authType === AuthTypeEnum.Cookie
                  ? "Session Cookie"
                  : "无需凭据"}
            </span>
            <input
              required={!account && authType !== AuthTypeEnum.None}
              disabled={authType === AuthTypeEnum.None}
              type="password"
              autoComplete="off"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              placeholder={account ? "留空保持不变" : undefined}
              className={fieldClassName}
            />
          </label>
          {!account && onDetect ? (
            <button
              type="button"
              onClick={() => void handleDetect()}
              disabled={
                detecting ||
                !baseUrl.trim() ||
                authType === AuthTypeEnum.None
              }
              className="h-9 rounded-md border border-blue-300 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              {detecting ? "识别中..." : "自动识别并回填"}
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">用户 ID</span>
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">汇率（CNY / USD）</span>
            <input
              required
              type="number"
              min={0.0001}
              max={10000}
              step="any"
              value={exchangeRate}
              onChange={(event) => setExchangeRate(Number(event.target.value))}
              className={fieldClassName}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">备注</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">标签</legend>
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

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </form>
    </WebDialog>
  )
}

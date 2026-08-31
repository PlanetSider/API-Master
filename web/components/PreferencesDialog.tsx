import { Palette, SlidersHorizontal } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import type {
  WebCurrencyType,
  WebPreferencesPatch,
  WebPreferencesResponse,
  WebSortField,
  WebSortOrder,
  WebThemeMode,
} from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface PreferencesDialogProps {
  open: boolean
  busy: boolean
  settings: WebPreferencesResponse | null
  onClose: () => void
  onSave: (patch: WebPreferencesPatch) => Promise<void>
}

const themeOptions: Array<{ value: WebThemeMode; label: string }> = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
]

const sortOptions: Array<{ value: WebSortField; label: string }> = [
  { value: null, label: "默认顺序" },
  { value: "balance", label: "余额" },
  { value: "consumption", label: "今日消费" },
  { value: "income", label: "今日收入" },
  { value: "created_at", label: "创建时间" },
]

export function PreferencesDialog({
  open,
  busy,
  settings,
  onClose,
  onSave,
}: PreferencesDialogProps) {
  const [themeMode, setThemeMode] = useState<WebThemeMode>("system")
  const [currencyType, setCurrencyType] = useState<WebCurrencyType>("USD")
  const [showTodayCashflow, setShowTodayCashflow] = useState(true)
  const [showHealthStatus, setShowHealthStatus] = useState(true)
  const [sortField, setSortField] = useState<WebSortField>("balance")
  const [sortOrder, setSortOrder] = useState<WebSortOrder>("desc")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !settings) return
    setThemeMode(settings.preferences.themeMode)
    setCurrencyType(settings.preferences.currencyType)
    setShowTodayCashflow(settings.preferences.showTodayCashflow)
    setShowHealthStatus(settings.preferences.showHealthStatus)
    setSortField(settings.preferences.sortField)
    setSortOrder(settings.preferences.sortOrder)
    setError(null)
  }, [open, settings])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!settings) return
    setError(null)
    try {
      await onSave({
        themeMode,
        currencyType,
        showTodayCashflow,
        showHealthStatus,
        sortField,
        sortOrder,
        expectedRevision: settings.revision,
      })
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "偏好设置保存失败",
      )
    }
  }

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="显示偏好"
      description="这些设置保存在 Web 服务端，会随完整备份迁移。"
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
            form="web-preferences-form"
            disabled={busy || !settings}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "正在保存..." : "保存设置"}
          </button>
        </>
      }
    >
      <form id="web-preferences-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Palette className="size-4 text-gray-500" />
              主题
            </span>
            <select
              value={themeMode}
              onChange={(event) =>
                setThemeMode(event.target.value as WebThemeMode)
              }
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              {themeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">金额单位</span>
            <select
              value={currencyType}
              onChange={(event) =>
                setCurrencyType(event.target.value as WebCurrencyType)
              }
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="USD">美元（USD）</option>
              <option value="CNY">人民币（CNY）</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="size-4 text-gray-500" />
              账户排序字段
            </span>
            <select
              value={sortField ?? ""}
              onChange={(event) =>
                setSortField((event.target.value || null) as WebSortField)
              }
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              {sortOptions.map((option) => (
                <option
                  key={option.value ?? "default"}
                  value={option.value ?? ""}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">排序方向</span>
            <select
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as WebSortOrder)
              }
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
          </label>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
            <span>
              <span className="block text-sm font-medium">
                显示今日消费与收入
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                隐藏后也会减少刷新时的今日明细请求
              </span>
            </span>
            <input
              type="checkbox"
              aria-label="显示今日消费与收入"
              checked={showTodayCashflow}
              onChange={(event) => setShowTodayCashflow(event.target.checked)}
              className="size-4 accent-blue-600"
            />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
            <span>
              <span className="block text-sm font-medium">显示健康状态</span>
              <span className="mt-0.5 block text-xs text-gray-500">
                关闭后仅隐藏状态列，不会停止服务端检测
              </span>
            </span>
            <input
              type="checkbox"
              aria-label="显示健康状态"
              checked={showHealthStatus}
              onChange={(event) => setShowHealthStatus(event.target.checked)}
              className="size-4 accent-blue-600"
            />
          </label>
        </div>

        {settings?.unsupportedExtensionKeys.length ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            扩展备份中的浏览器专属设置未导入：
            {settings.unsupportedExtensionKeys.join("、")}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </form>
    </WebDialog>
  )
}

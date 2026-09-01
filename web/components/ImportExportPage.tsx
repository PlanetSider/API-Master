import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  FileJson,
} from "lucide-react"
import { useRef, useState } from "react"

import type {
  WebBackup,
  WebDavSettingsInput,
  WebDavSettingsResponse,
} from "~/web/contracts"

import { WebDavSettingsDialog } from "./WebDavSettingsDialog"
import { WebDialogInlineProvider } from "./WebDialog"

interface ImportExportPageProps {
  busy: boolean
  onExportBackup: () => Promise<WebBackup>
  onExportAccounts: () => Promise<unknown>
  onImportAccounts: (data: unknown) => Promise<void>
  onRestoreBackup: (backup: WebBackup) => Promise<void>
  webDavSettings: WebDavSettingsResponse | null
  onSaveWebDavSettings: (input: WebDavSettingsInput) => Promise<void>
  onTestWebDav: () => Promise<void>
  onUploadWebDav: () => Promise<void>
  onRestoreWebDav: () => Promise<void>
}

const downloadJson = (value: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ImportExportPage({
  busy,
  onExportBackup,
  onExportAccounts,
  onImportAccounts,
  onRestoreBackup,
  webDavSettings,
  onSaveWebDavSettings,
  onTestWebDav,
  onUploadWebDav,
  onRestoreWebDav,
}: ImportExportPageProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [fileMode, setFileMode] = useState<"backup" | "accounts">("backup")

  const exportBackup = async () => {
    setError(null)
    try {
      downloadJson(
        await onExportBackup(),
        `all-api-hub-backup-${Date.now()}.json`,
      )
      setStatus("完整备份已下载。")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "备份导出失败")
    }
  }

  const exportAccounts = async () => {
    setError(null)
    try {
      downloadJson(
        await onExportAccounts(),
        `all-api-hub-accounts-${Date.now()}.json`,
      )
      setStatus("账户数据已下载。")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账户导出失败")
    }
  }

  const importBackup = async (file: File) => {
    setError(null)
    setStatus(null)
    try {
      const parsed = JSON.parse(await file.text()) as Partial<WebBackup>
      if (
        parsed.type !== "all-api-hub-web-backup" ||
        parsed.version !== 1 ||
        !Array.isArray(parsed.documents)
      ) {
        throw new Error("文件不是有效的 Web 备份。")
      }
      if (!window.confirm("导入备份会覆盖当前 Web 配置，是否继续？")) return
      await onRestoreBackup(parsed as WebBackup)
      setStatus("备份已恢复，页面数据已刷新。")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "备份导入失败")
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const importAccounts = async (file: File) => {
    setError(null)
    setStatus(null)
    try {
      const parsed = JSON.parse(await file.text())
      if (!parsed || !Array.isArray(parsed.accounts)) {
        throw new Error("文件中没有有效的账户数据。")
      }
      if (!window.confirm("导入账户会合并到当前账户列表，是否继续？")) return
      await onImportAccounts(parsed)
      setStatus("账户数据已导入。")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账户导入失败")
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-6" data-testid="import-export-page">
      <div className="flex items-start gap-3">
        <ArrowLeftRight className="mt-1 size-6 shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">导入/导出</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            管理账户、凭据和 Web
            设置的本地备份。导出的文件包含敏感信息，请妥善保管。
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {status ? (
        <p
          role="status"
          className="text-sm text-emerald-600 dark:text-emerald-400"
        >
          {status}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <ArrowDownToLine className="size-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold">导出数据</h2>
              <p className="mt-1 text-sm text-gray-500">
                下载可迁移到其他 Web 实例的 JSON 文件。
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void exportBackup()}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <FileJson className="size-4" />
              完整备份
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void exportAccounts()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <ArrowDownToLine className="size-4" />
              账户数据
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFileMode("accounts")
                inputRef.current?.click()
              }}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <ArrowUpFromLine className="size-4" />
              导入账户
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <ArrowUpFromLine className="size-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold">导入备份</h2>
              <p className="mt-1 text-sm text-gray-500">
                从之前导出的完整备份恢复 Web 配置。
              </p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                if (fileMode === "accounts") void importAccounts(file)
                else void importBackup(file)
              }
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setFileMode("backup")
              inputRef.current?.click()
            }}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <ArrowUpFromLine className="size-4" />
            选择备份文件
          </button>
        </section>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        导入会覆盖同名服务端配置；浏览器扩展专属设置不会被 Web
        服务执行。涉及密钥的导出文件应在使用后及时删除。
      </div>

      <WebDialogInlineProvider>
        {webDavSettings ? (
          <WebDavSettingsDialog
            open
            busy={busy}
            settings={webDavSettings}
            onClose={() => undefined}
            onSave={onSaveWebDavSettings}
            onTest={onTestWebDav}
            onUpload={onUploadWebDav}
            onRestore={onRestoreWebDav}
          />
        ) : (
          <div className="rounded-lg border border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700">
            正在加载 WebDAV 设置...
          </div>
        )}
      </WebDialogInlineProvider>
    </div>
  )
}

import { CloudDownload, CloudUpload, PlugZap, Save } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import type {
  WebDavSettingsInput,
  WebDavSettingsResponse,
} from "~/web/contracts"

import { WebDialog, WebDialogModalProvider } from "./WebDialog"

interface Props {
  open: boolean
  busy: boolean
  settings: WebDavSettingsResponse | null
  onClose: () => void
  onSave: (input: WebDavSettingsInput) => Promise<void>
  onTest: () => Promise<void>
  onUpload: () => Promise<void>
  onRestore: () => Promise<void>
}

const formatTime = (value?: number) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "尚未运行"

export function WebDavSettingsDialog(props: Props) {
  const [url, setUrl] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false)
  const [intervalMinutes, setIntervalMinutes] = useState(60)
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)
  const [encryptionPassword, setEncryptionPassword] = useState("")
  const [restoreConfirmationOpen, setRestoreConfirmationOpen] = useState(false)

  useEffect(() => {
    if (!props.open || !props.settings) return
    setUrl(props.settings.settings.url)
    setUsername(props.settings.settings.username)
    setAutoBackupEnabled(props.settings.settings.autoBackupEnabled)
    setIntervalMinutes(props.settings.settings.intervalMinutes)
    setEncryptionEnabled(props.settings.settings.encryptionEnabled)
    setPassword("")
    setEncryptionPassword("")
  }, [props.open, props.settings])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await props.onSave({
      url,
      username,
      password: password || undefined,
      autoBackupEnabled,
      intervalMinutes,
      encryptionEnabled,
      encryptionPassword: encryptionPassword || undefined,
      expectedRevision: props.settings?.revision,
    })
    setPassword("")
    setEncryptionPassword("")
  }

  const configured = props.settings?.settings.configured === true
  const lastRun = props.settings?.lastRun

  return (
    <>
      <WebDialog
        open={props.open}
        onClose={props.onClose}
        title="WebDAV 备份"
        description="远端凭据加密保存在服务端，浏览器不会读取已保存的密码。"
      >
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">
            WebDAV 地址
            <input
              required
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://dav.example.com/backups/"
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm dark:bg-gray-950"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              用户名
              <input
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm dark:bg-gray-950"
              />
            </label>
            <label className="block text-sm font-medium">
              密码
              <input
                required={!configured}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={configured ? "留空保持不变" : "WebDAV 密码"}
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm dark:bg-gray-950"
              />
            </label>
          </div>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              <span className="block font-medium">加密远端备份</span>
              <span className="text-xs text-gray-500">
                使用独立密码加密后再上传
              </span>
            </span>
            <input
              type="checkbox"
              checked={encryptionEnabled}
              onChange={(event) => setEncryptionEnabled(event.target.checked)}
              className="size-4"
            />
          </label>
          {encryptionEnabled ? (
            <label className="block text-sm font-medium">
              备份加密密码
              <input
                required={!props.settings?.settings.encryptionEnabled}
                type="password"
                value={encryptionPassword}
                onChange={(event) => setEncryptionPassword(event.target.value)}
                placeholder={
                  props.settings?.settings.encryptionEnabled
                    ? "留空保持不变"
                    : "独立于登录密码"
                }
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm dark:bg-gray-950"
              />
            </label>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium">自动备份</span>
              <input
                type="checkbox"
                checked={autoBackupEnabled}
                onChange={(event) => setAutoBackupEnabled(event.target.checked)}
                className="size-4"
              />
            </label>
            <label className="block text-sm font-medium">
              间隔（分钟）
              <input
                required
                type="number"
                min={15}
                max={10080}
                value={intervalMinutes}
                onChange={(event) =>
                  setIntervalMinutes(Number(event.target.value))
                }
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm dark:bg-gray-950"
              />
            </label>
          </div>
          <div className="rounded-md border px-3 py-2 text-xs text-gray-500">
            <div>
              上次运行：{formatTime(lastRun?.finishedAt)}
              {lastRun
                ? ` · ${lastRun.status === "success" ? "成功" : "失败"}`
                : ""}
            </div>
            {props.settings?.runtime.nextRunAt ? (
              <div className="mt-1">
                下次运行：{formatTime(props.settings.runtime.nextRunAt)}
              </div>
            ) : null}
            {lastRun?.error ? (
              <div className="mt-1 text-red-600 dark:text-red-400">
                {lastRun.error}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4 dark:border-gray-700">
            <button
              type="button"
              disabled={props.busy || !configured}
              onClick={() => void props.onTest()}
              className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium disabled:opacity-60"
            >
              <PlugZap className="size-4" />
              测试连接
            </button>
            <button
              type="button"
              disabled={props.busy || !configured}
              onClick={() => void props.onUpload()}
              className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium disabled:opacity-60"
            >
              <CloudUpload className="size-4" />
              立即备份
            </button>
            <button
              type="button"
              disabled={props.busy || !configured}
              onClick={() => setRestoreConfirmationOpen(true)}
              className="flex h-9 items-center gap-2 rounded-md border border-red-300 px-3 text-sm font-medium text-red-600 disabled:opacity-60 dark:border-red-900"
            >
              <CloudDownload className="size-4" />
              恢复
            </button>
            <button
              disabled={props.busy}
              className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-60"
            >
              <Save className="size-4" />
              保存
            </button>
          </div>
        </form>
      </WebDialog>

      <WebDialogModalProvider>
        <WebDialog
          open={restoreConfirmationOpen}
          onClose={() => setRestoreConfirmationOpen(false)}
          title="从 WebDAV 恢复"
          footer={
            <>
              <button
                type="button"
                onClick={() => setRestoreConfirmationOpen(false)}
                className="h-9 rounded-md border px-4 text-sm font-medium"
              >
                取消
              </button>
              <button
                type="button"
                disabled={props.busy}
                onClick={async () => {
                  await props.onRestore()
                  setRestoreConfirmationOpen(false)
                }}
                className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                确认恢复
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600 dark:text-gray-300">
            远端完整备份将替换当前账户、设置、历史、通知和托管站点连接。此操作无法撤销。
          </p>
        </WebDialog>
      </WebDialogModalProvider>
    </>
  )
}

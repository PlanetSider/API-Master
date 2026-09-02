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
  presentation?: "modal" | "page"
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

  if (props.presentation === "page") {
    return (
      <div className="space-y-5">
        <section className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-start gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <CloudUpload className="mt-0.5 size-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold">WebDAV 同步</h2>
              <p className="mt-1 text-sm text-gray-500">
                配置 WebDAV
                以同步共享数据。部分设备本地设置不会上传，也不会被远端覆盖。
              </p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4 p-4">
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              <span className="font-medium">同步范围说明</span>
              <br />
              WebDAV
              主要用于同步共享数据，不等同于完整设备备份。浏览器扩展专属设置不会上传，也不会被远端覆盖。
            </div>
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
            <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-800/60">
              <div className="font-medium">同步数据</div>
              <p className="mt-1 text-xs text-gray-500">
                选择需要通过 WebDAV 同步的共享数据类型。
              </p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {["账号", "书签", "API 凭据库", "偏好设置"].map((label) => (
                  <label key={label} className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-md border p-3 dark:border-gray-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">WebDAV 数据加密</div>
                  <p className="mt-1 text-xs text-gray-500">
                    可选：使用独立密码加密 WebDAV 备份。
                  </p>
                </div>
                <input
                  type="checkbox"
                  aria-label="加密远端备份"
                  checked={encryptionEnabled}
                  onChange={(event) =>
                    setEncryptionEnabled(event.target.checked)
                  }
                  className="size-4"
                />
              </div>
              {encryptionEnabled ? (
                <label className="mt-3 block text-sm font-medium">
                  加密密码
                  <input
                    required={!props.settings?.settings.encryptionEnabled}
                    type="password"
                    value={encryptionPassword}
                    onChange={(event) =>
                      setEncryptionPassword(event.target.value)
                    }
                    placeholder={
                      props.settings?.settings.encryptionEnabled
                        ? "留空保持不变"
                        : "独立于登录密码"
                    }
                    className="mt-1 h-9 w-full rounded-md border px-3 text-sm dark:bg-gray-950"
                  />
                </label>
              ) : null}
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              配置已保存后，可测试连接、上传到 WebDAV 或从 WebDAV 导入。
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <button
                type="submit"
                disabled={props.busy}
                className="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-60 sm:col-span-1"
              >
                <Save className="mr-1 inline size-4" /> 保存配置
              </button>
              <button
                type="button"
                disabled={props.busy || !configured}
                onClick={() => void props.onTest()}
                className="h-9 rounded-md border px-3 text-sm font-medium disabled:opacity-60"
              >
                <PlugZap className="mr-1 inline size-4" /> 测试连接
              </button>
              <button
                type="button"
                disabled={props.busy || !configured}
                onClick={() => void props.onUpload()}
                className="h-9 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-60"
              >
                <CloudUpload className="mr-1 inline size-4" /> 上传到 WebDAV
              </button>
              <button
                type="button"
                disabled={props.busy || !configured}
                onClick={() => {
                  if (
                    window.confirm("确定从 WebDAV 导入并覆盖当前共享数据吗？")
                  ) {
                    void props.onRestore()
                  }
                }}
                className="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-60"
              >
                <CloudDownload className="mr-1 inline size-4" /> 从 WebDAV 导入
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <CloudUpload className="mt-0.5 size-5 text-blue-600" />
              <div>
                <h2 className="text-base font-semibold">WebDAV 自动同步</h2>
                <p className="mt-1 text-sm text-gray-500">
                  配置自动同步共享数据；设备本地设置仍保留在当前设备。
                </p>
              </div>
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {autoBackupEnabled ? "已启用" : "未同步"}
            </span>
          </div>
          <div className="space-y-4 p-4">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                <span className="block font-medium">启用自动同步</span>
                <span className="text-xs text-gray-500">
                  开启后将按设定间隔自动与 WebDAV 同步共享数据。
                </span>
              </span>
              <input
                type="checkbox"
                aria-label="自动备份"
                checked={autoBackupEnabled}
                onChange={(event) => setAutoBackupEnabled(event.target.checked)}
                className="size-4"
              />
            </label>
            <label className="block text-sm font-medium">
              同步间隔（秒）
              <input
                required
                aria-label="间隔（分钟）"
                type="number"
                min={900}
                max={604800}
                value={intervalMinutes * 60}
                onChange={(event) =>
                  setIntervalMinutes(
                    Math.max(15, Math.round(Number(event.target.value) / 60)),
                  )
                }
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm dark:bg-gray-950"
              />
              <span className="mt-1 block text-xs text-gray-500">
                约 {Math.round(intervalMinutes / 60)} 小时
              </span>
            </label>
            <div className="rounded-md border px-3 py-2 text-xs text-gray-500">
              上次运行：{formatTime(lastRun?.finishedAt)}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={props.busy}
                onClick={() =>
                  void props.onSave({
                    url,
                    username,
                    password: password || undefined,
                    autoBackupEnabled,
                    intervalMinutes,
                    encryptionEnabled,
                    encryptionPassword: encryptionPassword || undefined,
                    expectedRevision: props.settings?.revision,
                  })
                }
                className="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-60"
              >
                保存设置
              </button>
              <button
                type="button"
                disabled={props.busy || !configured}
                onClick={() => void props.onUpload()}
                className="h-9 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-60"
              >
                立即同步
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <>
      <WebDialog
        open={props.open}
        onClose={props.onClose}
        title="WebDAV 同步"
        description="配置 WebDAV 以同步共享数据。部分设备本地设置不会上传，也不会被远端覆盖。"
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
          <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-800/60">
            <div className="font-medium">同步数据</div>
            <p className="mt-1 text-xs text-gray-500">
              选择需要通过 WebDAV 同步的共享数据类型。
            </p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {["账号", "书签", "API 凭据库", "偏好设置"].map((label) => (
                <label key={label} className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              <span className="block font-medium">WebDAV 数据加密</span>
              <span className="text-xs text-gray-500">
                使用独立密码加密后再上传
              </span>
            </span>
            <input
              type="checkbox"
              aria-label="加密远端备份"
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
                aria-label="备份加密密码"
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
              <span className="font-medium">启用自动同步</span>
              <input
                type="checkbox"
                aria-label="自动备份"
                checked={autoBackupEnabled}
                onChange={(event) => setAutoBackupEnabled(event.target.checked)}
                className="size-4"
              />
            </label>
            <label className="block text-sm font-medium">
              同步间隔（分钟）
              <input
                required
                aria-label="间隔（分钟）"
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

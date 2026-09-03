import {
  Activity,
  Bell,
  Bookmark,
  Boxes,
  ChartNoAxesCombined,
  Cpu,
  KeyRound,
  LineChart,
  Palette,
  RefreshCw,
  ServerCog,
  Settings2,
  ShieldCheck,
  TimerReset,
  X,
  type LucideIcon,
} from "lucide-react"
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react"

const WebDialogInlineContext = createContext(false)

export function WebDialogInlineProvider({ children }: { children: ReactNode }) {
  return (
    <WebDialogInlineContext.Provider value>
      {children}
    </WebDialogInlineContext.Provider>
  )
}

export function WebDialogModalProvider({ children }: { children: ReactNode }) {
  return (
    <WebDialogInlineContext.Provider value={false}>
      {children}
    </WebDialogInlineContext.Provider>
  )
}

interface WebDialogProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  titleActions?: ReactNode
  inlineActions?: ReactNode
  footer?: ReactNode
  size?: "default" | "wide"
  onClose: () => void
}

const inlineTitleIcons: Record<string, LucideIcon> = {
  书签管理: Bookmark,
  用量分析: ChartNoAxesCombined,
  网站公告: Bell,
  余额历史: LineChart,
  模型列表: Cpu,
  模型总览: Boxes,
  自动刷新: TimerReset,
  自动签到: TimerReset,
  运行能力: Activity,
  外部通知: Bell,
  "API 凭据库": KeyRound,
  密钥管理: KeyRound,
  "API 检测": ShieldCheck,
  "API 连通性检测": ShieldCheck,
  "AI API 功能可用性测试": ShieldCheck,
  显示偏好: Palette,
  "WebDAV 设置": ServerCog,
  托管站点: ServerCog,
  渠道管理: ServerCog,
  模型同步: RefreshCw,
  模型列表同步执行: RefreshCw,
  通知中心: Bell,
}

const inlineSettingsTitles = new Set([
  "账户管理",
  "余额历史",
  "用量分析",
  "网站公告",
  "自动签到",
  "密钥管理",
  "渠道管理",
  "模型同步",
  "模型列表同步执行",
])

export function WebDialog({
  open,
  title,
  description,
  children,
  titleActions,
  inlineActions,
  footer,
  size = "default",
  onClose,
}: WebDialogProps) {
  const inline = useContext(WebDialogInlineContext)
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const instanceId = useId()
  const titleId = `web-dialog-title-${instanceId}`
  const descriptionId = `web-dialog-description-${instanceId}`

  onCloseRef.current = onClose

  useEffect(() => {
    if (!open || inline) return

    const previousFocus = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      previousFocus?.focus()
    }
  }, [inline, open])

  if (!open) return null

  if (inline) {
    const Icon = inlineTitleIcons[title] ?? Settings2
    const resolvedTitleActions =
      titleActions ??
      (inlineSettingsTitles.has(title) ? (
        <button
          type="button"
          aria-label={`${title}设置`}
          title={`${title}设置`}
          onClick={() => {
            window.location.hash = "#basic"
          }}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <Settings2 className="size-4" />
        </button>
      ) : null)
    return (
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="w-full outline-none"
      >
        <div className="[container-type:inline-size] mb-8">
          <div className="flex flex-col gap-2 [@container(min-width:42rem)]:flex-row [@container(min-width:42rem)]:items-start [@container(min-width:42rem)]:justify-between [@container(min-width:42rem)]:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Icon className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="flex min-w-0 items-center gap-2">
                <h1
                  id={titleId}
                  className="min-w-0 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white"
                >
                  {title}
                </h1>
                {resolvedTitleActions}
              </div>
            </div>
            {inlineActions ? (
              <div className="flex w-full min-w-0 flex-wrap items-center gap-3 [@container(min-width:42rem)]:w-auto [@container(min-width:42rem)]:flex-1 [@container(min-width:42rem)]:justify-end">
                {inlineActions}
              </div>
            ) : null}
          </div>
          {description ? (
            <p
              id={descriptionId}
              className="mt-2 text-sm text-gray-600 dark:text-gray-300"
            >
              {description}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">{children}</div>
        {footer && !inlineActions ? (
          <div className="mt-8 flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
            {footer}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-xl outline-none dark:border-gray-700 dark:bg-gray-900 ${
          size === "wide" ? "max-w-7xl" : "max-w-xl"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              {titleActions}
            </div>
            {description ? (
              <p
                id={descriptionId}
                className="mt-1 text-sm text-gray-500 dark:text-gray-400"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="关闭"
            title="关闭"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

import { AlertTriangle, CheckCircle2, ServerCog } from "lucide-react"

import type {
  WebRuntimeCapabilitiesResponse,
  WebRuntimeCapabilityId,
} from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface RuntimeCapabilitiesDialogProps {
  open: boolean
  capabilities: WebRuntimeCapabilitiesResponse | null
  onClose: () => void
}

const capabilityCopy: Record<
  WebRuntimeCapabilityId,
  { title: string; description: string }
> = {
  standard_http: {
    title: "标准 HTTP/API 请求",
    description: "由服务端直接访问上游接口，适用于 Token 和标准会话认证。",
  },
  saved_cookie_header: {
    title: "已保存 Cookie 请求",
    description:
      "可发送用户手工保存的 Cookie，但不能访问本机浏览器 Cookie 仓库。",
  },
  waf_challenge: {
    title: "WAF 挑战处理",
    description: "需要可渲染页面并保留浏览器会话的隔离工作节点。",
  },
  turnstile: {
    title: "Turnstile 验证",
    description: "需要浏览器工作节点渲染验证页面并获取临时令牌。",
  },
  active_tab_detection: {
    title: "当前标签页检测",
    description: "普通 Web 服务无法读取用户浏览器中的活动标签页。",
  },
  page_session_read: {
    title: "页面会话读取",
    description: "需要受控浏览器上下文读取页面存储或登录会话。",
  },
  page_native_action: {
    title: "页面原生操作",
    description: "签到按钮点击等页面动作需要浏览器工作节点执行。",
  },
}

const stateCopy = {
  available: { label: "可用", className: "bg-emerald-100 text-emerald-700" },
  limited: { label: "受限", className: "bg-amber-100 text-amber-700" },
  requires_worker: {
    label: "需要工作节点",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
} as const

export function RuntimeCapabilitiesDialog({
  open,
  capabilities,
  onClose,
}: RuntimeCapabilitiesDialogProps) {
  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="运行能力"
      description="查看当前 Web 服务能够直接执行的流程及浏览器工作节点依赖。"
    >
      {!capabilities ? (
        <p className="py-8 text-center text-sm text-gray-500">正在加载...</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <ServerCog className="mt-0.5 size-5 text-gray-500" />
            <div className="min-w-0">
              <div className="text-sm font-medium">浏览器工作节点</div>
              <div className="mt-1 text-xs text-gray-500">
                {capabilities.browserWorker.connected
                  ? "已连接"
                  : capabilities.browserWorker.configured
                    ? "已配置但未连接"
                    : "尚未配置；依赖页面渲染的流程会明确报告不可用。"}
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {capabilities.capabilities.map((capability) => {
              const copy = capabilityCopy[capability.id]
              const state = stateCopy[capability.state]
              const AvailableIcon =
                capability.state === "available" ? CheckCircle2 : AlertTriangle
              return (
                <div key={capability.id} className="flex gap-3 px-3 py-3">
                  <AvailableIcon
                    className={`mt-0.5 size-4 shrink-0 ${
                      capability.state === "available"
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{copy.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${state.className}`}
                      >
                        {state.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {copy.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </WebDialog>
  )
}

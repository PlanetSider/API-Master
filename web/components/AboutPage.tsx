import { Code2, ExternalLink, Github, Info, ShieldCheck } from "lucide-react"

import iconImage from "~/assets/icon.png"

export function AboutPage() {
  return (
    <div className="space-y-6" data-testid="about-page">
      <div className="flex items-start gap-3">
        <Info className="mt-1 size-6 shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">关于</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            All API Hub Web Console，统一管理账户、模型和 API 凭据。
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-start gap-4">
          <img
            src={iconImage}
            alt="All API Hub"
            className="size-14 rounded-xl"
          />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">All API Hub</h2>
            <p className="mt-1 text-sm text-gray-500">
              Web 管理系统与浏览器扩展的统一数据层。
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">
                Web Console
              </span>
              <span className="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">
                React + TypeScript
              </span>
              <span className="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">
                服务端加密存储
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <Github className="size-5" />
            <h2 className="font-semibold">项目资源</h2>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <a
              href="https://github.com/qixing-jk/all-api-hub"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 hover:border-blue-400 dark:border-gray-700"
            >
              <span className="flex items-center gap-2">
                <Code2 className="size-4" />
                GitHub 源码
              </span>
              <ExternalLink className="size-4 text-gray-400" />
            </a>
            <a
              href="https://github.com/qixing-jk/all-api-hub/issues"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 hover:border-blue-400 dark:border-gray-700"
            >
              <span>问题反馈与建议</span>
              <ExternalLink className="size-4 text-gray-400" />
            </a>
          </div>
        </section>
        <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-emerald-600" />
            <h2 className="font-semibold">隐私与安全</h2>
          </div>
          <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
            API 密钥由服务端加密保存，仅在明确的验证或导出操作中使用。Web
            界面不会读取浏览器扩展存储或页面 Cookie。
          </p>
        </section>
      </div>

      <div className="border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-700">
        上游项目：qixing-jk/all-api-hub
      </div>
    </div>
  )
}

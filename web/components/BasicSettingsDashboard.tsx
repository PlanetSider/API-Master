import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock3,
  Eye,
  FileText,
  Globe2,
  Languages,
  Megaphone,
  Monitor,
  MousePointerClick,
  RefreshCw,
  RotateCcw,
  Sun,
  Terminal,
} from "lucide-react"
import { useState, type ReactNode } from "react"

import type { WebPreferencesResponse } from "~/web/contracts"

interface BasicSettingsDashboardProps {
  preferences: WebPreferencesResponse
  onNavigate: (
    page:
      | "preferences"
      | "externalNotifications"
      | "accounts"
      | "automation"
      | "balanceHistory"
      | "usageAnalytics"
      | "apiCheck"
      | "managedSiteChannels"
      | "importExport",
  ) => void
}

function SectionTitle({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}

function SettingsList({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      {children}
    </div>
  )
}

function SettingsRow({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="flex min-h-16 items-center gap-4 border-b border-gray-200 px-4 py-3 last:border-0 dark:border-gray-700">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-gray-500">
          {description}
        </span>
      </span>
      <span className="shrink-0">{action}</span>
    </div>
  )
}

function Segmented({
  options,
  active,
  onClick,
}: {
  options: string[]
  active: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex rounded-lg bg-gray-100 p-1 text-xs dark:bg-gray-800"
    >
      {options.map((option) => (
        <span
          key={option}
          className={`rounded-md px-3 py-1.5 ${option === active ? "bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white" : "text-gray-500"}`}
        >
          {option}
        </span>
      ))}
    </button>
  )
}

function SwitchButton({
  checked,
  onClick,
}: {
  checked: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  )
}

export function BasicSettingsDashboard({
  preferences,
  onNavigate,
}: BasicSettingsDashboardProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const current = preferences.preferences
  const openPreferences = () => onNavigate("preferences")
  const tabs = [
    ["通用", undefined],
    ["通知", "externalNotifications"],
    ["账号管理", "accounts"],
    ["数据刷新", "automation"],
    ["签到与兑换", "automation"],
    ["余额历史", "balanceHistory"],
    ["账号用量", "usageAnalytics"],
    ["AI API 测试", "apiCheck"],
    ["自建 AI 网关", "managedSiteChannels"],
    ["CLIProxyAPI", undefined],
    ["Claude Code Router", undefined],
  ] as const

  return (
    <div className="space-y-7">
      <div className="flex items-start gap-3">
        <Monitor className="mt-1 size-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold">设置</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            管理插件的基本配置选项
          </p>
        </div>
      </div>
      <div className="scrollbar-hide relative -mx-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        <div className="flex min-w-max gap-2 px-1 pr-12">
          {tabs.map(([label, page], index) => (
            <button
              key={label}
              type="button"
              disabled={!page && index !== 0}
              onClick={() => page && onNavigate(page)}
              title={
                !page && index !== 0 ? "Web 端暂未提供此设置页" : undefined
              }
              className={`border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${index === 0 ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400" : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"}`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            aria-label="更多设置"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((value) => !value)}
            className="absolute right-0 bottom-0 z-10 flex items-center gap-1 border-b-2 border-transparent bg-white px-3 py-3 text-sm font-medium whitespace-nowrap text-gray-600 shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.3)] hover:text-gray-900 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            更多
            <ChevronDown
              className={`size-4 transition-transform ${moreOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {moreOpen ? (
          <div className="absolute right-0 bottom-[-1px] z-20 w-56 translate-y-full rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              title="Web 端暂未提供此设置页"
              disabled
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-gray-400 disabled:cursor-not-allowed"
            >
              权限管理
            </button>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false)
                onNavigate("importExport")
              }}
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              数据与备份
            </button>
          </div>
        ) : null}
      </div>

      <section className="space-y-4">
        <SectionTitle
          title="显示设置"
          description="自定义插件的外观和显示偏好"
        />
        <SettingsList>
          <SettingsRow
            icon={<Globe2 className="size-5 text-emerald-600" />}
            title="货币单位"
            description="设置余额和收支显示的默认货币单位"
            action={
              <Segmented
                options={["美元 ($)", "人民币 (¥)"]}
                active={
                  current.currencyType === "CNY" ? "人民币 (¥)" : "美元 ($)"
                }
                onClick={openPreferences}
              />
            }
          />
          <SettingsRow
            icon={<CalendarDays className="size-5 text-amber-600" />}
            title="显示今日收支"
            description="控制是否显示并获取今日消耗/收入等统计。关闭后将隐藏今日统计，并在刷新时跳过相关数据请求。"
            action={
              <SwitchButton
                checked={current.showTodayCashflow}
                onClick={openPreferences}
              />
            }
          />
          <SettingsRow
            icon={<Eye className="size-5 text-blue-600" />}
            title="默认标签页"
            description="设置插件启动时显示的默认标签页"
            action={
              <Segmented
                options={["今日收支", "总余额"]}
                active="总余额"
                onClick={openPreferences}
              />
            }
          />
        </SettingsList>
      </section>

      <section className="space-y-4">
        <SectionTitle title="外观" description="自定义插件的外观和显示偏好" />
        <SettingsList>
          <SettingsRow
            icon={<Sun className="size-5 text-amber-500" />}
            title="外观"
            description={`选择一个外观主题；当前：${current.themeMode === "system" ? "跟随系统" : current.themeMode === "dark" ? "深色" : "浅色"}`}
            action={
              <Segmented
                options={["浅色", "深色", "跟随系统"]}
                active={
                  current.themeMode === "dark"
                    ? "深色"
                    : current.themeMode === "light"
                      ? "浅色"
                      : "跟随系统"
                }
                onClick={openPreferences}
              />
            }
          />
          <SettingsRow
            icon={<Languages className="size-5 text-violet-600" />}
            title="语言"
            description="选择您偏好的显示语言"
            action={
              <button
                type="button"
                onClick={openPreferences}
                className="h-9 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700"
              >
                简体中文⌄
              </button>
            }
          />
        </SettingsList>
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="点击扩展图标"
          description="设置浏览器工具栏中扩展图标的打开方式。"
        />
        <SettingsList>
          <SettingsRow
            icon={<MousePointerClick className="size-5 text-blue-600" />}
            title="默认打开内容"
            description="选择点击工具栏图标后打开弹窗、侧边栏或完整选项页。"
            action={
              <Segmented
                options={["弹窗", "侧边栏", "选项页"]}
                active="侧边栏"
                onClick={openPreferences}
              />
            }
          />
        </SettingsList>
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="网站公告"
          description="控制是否在后台定时抓取已启用账号所属站点的网站公告。"
        />
        <SettingsList>
          <SettingsRow
            icon={<Megaphone className="size-5 text-sky-600" />}
            title="启用网站公告抓取"
            description="关闭后会停止后台定时抓取，已保存的本地公告记录仍会保留，公告页面仍可手动检查。"
            action={
              <SwitchButton checked onClick={() => onNavigate("automation")} />
            }
          />
          <SettingsRow
            icon={<Clock3 className="size-5 text-sky-600" />}
            title="抓取间隔"
            description="设置后台抓取网站公告的分钟间隔，支持 15 到 1440 分钟。"
            action={
              <button
                type="button"
                onClick={() => onNavigate("automation")}
                className="h-9 w-24 rounded-md border border-gray-300 px-3 text-left text-sm dark:border-gray-700"
              >
                360
              </button>
            }
          />
          <SettingsRow
            icon={<ExternalLinkIcon />}
            title="公告页面"
            description="当前每 360 分钟后台检查一次，也可以手动立即检查。"
            action={
              <button
                type="button"
                onClick={() => {
                  window.location.hash = "#siteAnnouncements"
                }}
                className="h-9 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700"
              >
                查看公告
              </button>
            }
          />
        </SettingsList>
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="更新日志"
          description="控制插件更新完成后，首次打开插件界面时是否在插件内显示更新内容。"
        />
        <SettingsList>
          <SettingsRow
            icon={<FileText className="size-5 text-violet-600" />}
            title="更新后自动显示更新内容"
            description="开启后，插件更新完成后首次打开插件界面时，会在插件内弹出更新内容。"
            action={<SwitchButton checked onClick={openPreferences} />}
          />
        </SettingsList>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <SectionTitle
            title="日志"
            description="控制是否在浏览器控制台输出日志，用于排查问题。"
          />
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700"
          >
            <RefreshCw className="size-4" />
            重置
          </button>
        </div>
        <SettingsList>
          <SettingsRow
            icon={<Terminal className="size-5 text-gray-600" />}
            title="启用控制台日志"
            description="关闭后，All API Hub 不会在浏览器控制台输出任何日志（包括错误）。"
            action={<SwitchButton checked onClick={openPreferences} />}
          />
          <SettingsRow
            icon={<RotateCcw className="size-5 text-gray-600" />}
            title="最小日志级别"
            description="启用控制台日志后，仅输出不低于该级别的日志。"
            action={
              <button
                type="button"
                className="h-9 w-40 rounded-md border border-gray-300 px-3 text-left text-sm dark:border-gray-700"
              >
                信息⌄
              </button>
            }
          />
        </SettingsList>
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="匿名产品统计"
          description="帮助我们更快发现常见问题、改进常用流程并提升兼容性的匿名统计。我们不会收集 API Key、Cookie、账号 URL、余额、请求内容或用户输入。"
        />
        <SettingsList>
          <SettingsRow
            icon={<BarChart3 className="size-5 text-gray-500" />}
            title="启用匿名产品统计"
            description="允许发送有限的功能使用情况、错误类别和粗略站点类型统计，用于优先改进最影响体验的部分。"
            action={<SwitchButton checked={false} onClick={openPreferences} />}
          />
        </SettingsList>
      </section>

      <section className="space-y-4">
        <SectionTitle title="危险操作" description="" />
        <div className="flex items-center gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/20">
          <RotateCcw className="size-5 text-red-600" />
          <span className="flex-1">
            <span className="block text-sm font-medium text-red-700">
              重置所有设置
            </span>
            <span className="mt-0.5 block text-xs text-red-600/80">
              将所有配置重置为默认值，此操作不可撤销
            </span>
          </span>
          <button
            type="button"
            onClick={openPreferences}
            className="h-9 rounded-md bg-red-600 px-3 text-sm font-medium text-white"
          >
            重置设置
          </button>
        </div>
      </section>
    </div>
  )
}

function ExternalLinkIcon() {
  return <span className="text-lg leading-none text-sky-600">↗</span>
}

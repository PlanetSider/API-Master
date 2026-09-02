import {
  Activity,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Bell,
  Bookmark,
  Boxes,
  CalendarCheck2,
  ChartLine,
  ChartNoAxesCombined,
  ChevronsLeft,
  ChevronsRight,
  Cpu,
  Database,
  Ellipsis,
  ExternalLink,
  History,
  Info,
  KeyRound,
  Languages,
  Layers3,
  LayoutDashboard,
  LibraryBig,
  ListOrdered,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Monitor,
  Palette,
  Pencil,
  Pin,
  Plus,
  Power,
  RefreshCw,
  Search,
  Settings,
  Settings2,
  ShieldCheck,
  Tags,
  TimerReset,
  Trash2,
  User,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import iconImage from "~/assets/icon.png"
import { Checkbox } from "~/components/ui"
import { SiteHealthStatus } from "~/types"
import type {
  WebAccountBulkAction,
  WebAccountCheckInStatus,
  WebAccountDetectionInput,
  WebAccountDetectionResponse,
  WebAccountListResponse,
  WebAccountPatchInput,
  WebAccountSummary,
  WebAllModelCatalogResponse,
  WebApiCredentialProfileCreateInput,
  WebApiCredentialProfileListResponse,
  WebApiCredentialProfileModelCatalogResponse,
  WebApiCredentialProfileSummary,
  WebApiCredentialProfileUpdateInput,
  WebApiCredentialProfileVerificationResponse,
  WebApiKeyListResponse,
  WebApiVerificationInput,
  WebApiVerificationModelsResponse,
  WebApiVerificationResponse,
  WebAutomationSettingsPatch,
  WebAutomationSettingsResponse,
  WebBackup,
  WebBalanceHistoryResponse,
  WebBookmarkCreateInput,
  WebBookmarkListResponse,
  WebBookmarkPatchInput,
  WebBookmarkSummary,
  WebChannelConfigPatch,
  WebChannelConfigResponse,
  WebCreateAccountInput,
  WebCredentialExportFormat,
  WebCurrencyType,
  WebDavSettingsInput,
  WebDavSettingsResponse,
  WebExternalNotificationChannel,
  WebExternalNotificationSettingsInput,
  WebExternalNotificationSettingsResponse,
  WebManagedChannelInput,
  WebManagedChannelListResponse,
  WebManagedModelSyncInput,
  WebManagedModelSyncResponse,
  WebManagedSiteConnectionInput,
  WebManagedSiteConnectionListResponse,
  WebModelCatalogResponse,
  WebNotificationListResponse,
  WebPreferencesPatch,
  WebPreferencesResponse,
  WebRuntimeCapabilitiesResponse,
  WebSiteAnnouncementListResponse,
  WebTagListResponse,
  WebTagSummary,
  WebUsageAnalyticsQuery,
  WebUsageAnalyticsResponse,
  WebUsageHistoryResponse,
} from "~/web/contracts"

import { AboutPage } from "./AboutPage"
import { AccountFormDialog } from "./AccountFormDialog"
import { AllModelCatalogDialog } from "./AllModelCatalogDialog"
import { AutomationSettingsDialog } from "./AutomationSettingsDialog"
import { BalanceHistoryDialog } from "./BalanceHistoryDialog"
import { BasicSettingsDashboard } from "./BasicSettingsDashboard"
import { BookmarksDialog } from "./BookmarksDialog"
import { CredentialProfilesDialog } from "./CredentialProfilesDialog"
import { ExternalNotificationSettingsDialog } from "./ExternalNotificationSettingsDialog"
import { ImportExportPage } from "./ImportExportPage"
import { KeyManagementDialog } from "./KeyManagementDialog"
import { ManagedSitesDashboard } from "./ManagedSitesDashboard"
import { ManagedSitesDialog } from "./ManagedSitesDialog"
import { ModelCatalogDialog } from "./ModelCatalogDialog"
import { NotificationCenterDialog } from "./NotificationCenterDialog"
import { PreferencesDialog } from "./PreferencesDialog"
import { RuntimeCapabilitiesDialog } from "./RuntimeCapabilitiesDialog"
import { SiteAnnouncementsDialog } from "./SiteAnnouncementsDialog"
import { TagsDialog } from "./TagsDialog"
import { UsageAnalyticsDialog } from "./UsageAnalyticsDialog"
import { UsageHistoryDialog } from "./UsageHistoryDialog"
import { WebApiCheckDialog } from "./WebApiCheckDialog"
import { WebDavSettingsDialog } from "./WebDavSettingsDialog"
import { WebDialog, WebDialogInlineProvider } from "./WebDialog"

interface AccountDashboardProps {
  data: WebAccountListResponse
  bookmarks?: WebBookmarkListResponse | null
  tags: WebTagListResponse
  siteAnnouncements: WebSiteAnnouncementListResponse
  automation: WebAutomationSettingsResponse | null
  history: WebBalanceHistoryResponse | null
  usageHistory: WebUsageHistoryResponse | null
  usageAnalytics: WebUsageAnalyticsResponse | null
  notifications: WebNotificationListResponse | null
  runtimeCapabilities: WebRuntimeCapabilitiesResponse | null
  modelCatalog: WebModelCatalogResponse | null
  allModelCatalog: WebAllModelCatalogResponse | null
  apiKeys: WebApiKeyListResponse | null
  credentialProfiles?: WebApiCredentialProfileListResponse | null
  createdKeySecret: string | null
  managedSites: WebManagedSiteConnectionListResponse | null
  managedChannels: WebManagedChannelListResponse | null
  webDavSettings: WebDavSettingsResponse | null
  externalNotifications: WebExternalNotificationSettingsResponse | null
  preferences?: WebPreferencesResponse | null
  channelConfigs?: WebChannelConfigResponse | null
  busy: boolean
  message: { kind: "error" | "success"; text: string } | null
  onCreate: (input: WebCreateAccountInput) => Promise<void>
  onLoadBookmarks?: () => Promise<void>
  onCreateBookmark?: (input: WebBookmarkCreateInput) => Promise<void>
  onUpdateBookmark?: (id: string, input: WebBookmarkPatchInput) => Promise<void>
  onDeleteBookmark?: (bookmark: WebBookmarkSummary) => Promise<void>
  onDetectAccount?: (
    input: WebAccountDetectionInput,
  ) => Promise<WebAccountDetectionResponse>
  onUpdate: (accountId: string, input: WebAccountPatchInput) => Promise<void>
  onLoadSiteAnnouncements: () => Promise<void>
  onSyncSiteAnnouncements: () => Promise<void>
  onMarkSiteAnnouncementRead: (recordId: string) => Promise<void>
  onMarkSiteAnnouncementsRead: (siteKey?: string) => Promise<void>
  onCreateTag: (name: string) => Promise<void>
  onRenameTag: (tagId: string, name: string) => Promise<void>
  onDeleteTag: (tag: WebTagSummary) => Promise<void>
  onToggleDisabled: (account: WebAccountSummary) => Promise<void>
  onBulkAction: (
    accountIds: string[],
    action: WebAccountBulkAction,
  ) => Promise<void>
  onTogglePinned: (account: WebAccountSummary) => Promise<void>
  onReorder: (accountIds: string[]) => Promise<void>
  onRefresh: (account: WebAccountSummary) => Promise<void>
  onRefreshAll: () => Promise<void>
  onRunCheckIn: () => Promise<void>
  onSaveAutomation: (patch: WebAutomationSettingsPatch) => Promise<void>
  onLoadPreferences?: () => Promise<void>
  onSavePreferences?: (patch: WebPreferencesPatch) => Promise<void>
  onUpdateChannelConfig?: (input: WebChannelConfigPatch) => Promise<void>
  onLoadHistory: () => Promise<void>
  onLoadUsageHistory: () => Promise<void>
  onLoadUsageAnalytics: (query?: WebUsageAnalyticsQuery) => Promise<void>
  onSyncUsageHistory: () => Promise<void>
  onLoadNotifications: () => Promise<void>
  onLoadRuntimeCapabilities: () => Promise<void>
  onMarkNotificationsRead: () => Promise<void>
  onLoadModels: (account: WebAccountSummary) => Promise<void>
  onLoadAllModels: () => Promise<void>
  onLoadKeys: (account: WebAccountSummary) => Promise<void>
  onCreateKey: (name: string) => Promise<void>
  onDeleteKey: (tokenId: number | string) => Promise<void>
  onUpdateKey: (tokenId: number | string, name: string) => Promise<void>
  onLoadCredentialProfiles?: () => Promise<void>
  onCreateCredentialProfile?: (
    input: WebApiCredentialProfileCreateInput,
  ) => Promise<void>
  onUpdateCredentialProfile?: (
    id: string,
    input: WebApiCredentialProfileUpdateInput,
  ) => Promise<void>
  onDeleteCredentialProfile?: (
    profile: WebApiCredentialProfileSummary,
  ) => Promise<void>
  onExportCredentialProfile: (
    profile: WebApiCredentialProfileSummary,
    format: WebCredentialExportFormat,
  ) => Promise<void>
  onLoadCredentialProfileModels?: (
    profile: WebApiCredentialProfileSummary,
  ) => Promise<WebApiCredentialProfileModelCatalogResponse>
  onVerifyCredentialProfile?: (
    profile: WebApiCredentialProfileSummary,
    modelId?: string,
  ) => Promise<WebApiCredentialProfileVerificationResponse>
  onFetchVerificationModels: (
    input: WebApiVerificationInput,
  ) => Promise<WebApiVerificationModelsResponse>
  onRunVerification: (
    input: WebApiVerificationInput,
  ) => Promise<WebApiVerificationResponse>
  onLoadManagedSites: () => Promise<void>
  onCreateManagedSite: (input: WebManagedSiteConnectionInput) => Promise<void>
  onDeleteManagedSite: (id: string) => Promise<void>
  onLoadManagedChannels: (id: string) => Promise<void>
  onDeleteManagedChannel: (id: string, channelId: number) => Promise<void>
  onCreateManagedChannel: (
    id: string,
    input: WebManagedChannelInput,
  ) => Promise<void>
  onUpdateManagedChannel: (
    id: string,
    channelId: number,
    input: WebManagedChannelInput,
  ) => Promise<void>
  onSyncManagedSiteModels: (
    id: string,
    input?: WebManagedModelSyncInput,
  ) => Promise<WebManagedModelSyncResponse>
  onLoadWebDavSettings: () => Promise<void>
  onSaveWebDavSettings: (input: WebDavSettingsInput) => Promise<void>
  onTestWebDav: () => Promise<void>
  onUploadWebDavBackup: () => Promise<void>
  onRestoreWebDavBackup: () => Promise<void>
  onExportBackup?: () => Promise<WebBackup>
  onExportAccounts?: () => Promise<unknown>
  onImportAccounts?: (data: unknown) => Promise<void>
  onRestoreBackup?: (backup: WebBackup) => Promise<void>
  onLoadExternalNotifications: () => Promise<void>
  onSaveExternalNotifications: (
    input: WebExternalNotificationSettingsInput,
  ) => Promise<void>
  onTestExternalNotification: (
    channel: WebExternalNotificationChannel,
  ) => Promise<void>
  onDelete: (account: WebAccountSummary) => Promise<void>
  onLogout: () => Promise<void>
}

const formatMoney = (value: number, currency: WebCurrencyType = "USD") =>
  `${currency === "USD" ? "$" : "¥"}${value.toLocaleString(
    currency === "USD" ? "en-US" : "zh-CN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`

const getHealthPresentation = (account: WebAccountSummary) => {
  if (account.disabled) {
    return { label: "已停用", className: "bg-gray-100 text-gray-600" }
  }
  if (account.health.status === SiteHealthStatus.Healthy) {
    return { label: "正常", className: "bg-emerald-100 text-emerald-700" }
  }
  if (account.health.status === SiteHealthStatus.Error) {
    return { label: "异常", className: "bg-red-100 text-red-700" }
  }
  return { label: "待检测", className: "bg-amber-100 text-amber-700" }
}

type AccountRefreshFilter =
  | "never-synced"
  | "healthy"
  | "warning"
  | "error"
  | "unknown"

const getAccountRefreshFilter = (
  account: WebAccountSummary,
): AccountRefreshFilter => {
  if (!Number.isFinite(account.lastSyncTime) || account.lastSyncTime <= 0) {
    return "never-synced"
  }
  return account.health.status
}

const getAccountCheckInFilter = (
  account: WebAccountSummary,
): WebAccountCheckInStatus => account.checkInStatus ?? "status-unavailable"

const accountCheckInFilterLabels: Record<WebAccountCheckInStatus, string> = {
  "checked-in": "已签到",
  "not-checked-in": "未签到",
  outdated: "状态过期",
  "status-unavailable": "状态不可读取",
  unsupported: "不支持",
}

type DashboardPage =
  | "overview"
  | "accounts"
  | "bookmarks"
  | "basicSettings"
  | "balanceHistory"
  | "keys"
  | "managedSiteChannels"
  | "managedSiteModelSync"
  | "importExport"
  | "about"
  | "usageAnalytics"
  | "siteAnnouncements"
  | "models"
  | "automation"
  | "runtimeCapabilities"
  | "externalNotifications"
  | "credentialProfiles"
  | "apiCheck"
  | "preferences"

const dashboardPages: Record<DashboardPage, string> = {
  overview: "overview",
  accounts: "account",
  bookmarks: "bookmark",
  basicSettings: "basic",
  balanceHistory: "balanceHistory",
  keys: "keys",
  managedSiteChannels: "managedSiteChannels",
  managedSiteModelSync: "managedSiteModelSync",
  importExport: "importExport",
  about: "about",
  usageAnalytics: "usageAnalytics",
  siteAnnouncements: "siteAnnouncements",
  models: "models",
  automation: "autoCheckin",
  runtimeCapabilities: "runtime-capabilities",
  externalNotifications: "external-notifications",
  credentialProfiles: "apiCredentialProfiles",
  apiCheck: "api-check",
  preferences: "preferences",
}

const pageFromHash = (): DashboardPage => {
  if (typeof window === "undefined") return "overview"
  const hash = window.location.hash.replace(/^#/, "")
  const entry = Object.entries(dashboardPages).find(
    ([, value]) => value === hash,
  )
  if (entry) return entry[0] as DashboardPage

  const legacyHashes: Record<string, DashboardPage> = {
    accounts: "accounts",
    bookmarks: "bookmarks",
    "balance-history": "balanceHistory",
    "managed-site-channels": "managedSiteChannels",
    "managed-site-model-sync": "managedSiteModelSync",
    "import-export": "importExport",
    "usage-analytics": "usageAnalytics",
    "site-announcements": "siteAnnouncements",
    "credential-profiles": "credentialProfiles",
    automation: "automation",
  }
  const legacyPage = legacyHashes[hash]
  if (legacyPage) return legacyPage
  return "overview"
}

interface OverviewPageProps {
  activeAccounts: WebAccountSummary[]
  totalBalance: number
  healthyAccounts: number
  accountCount: number
  credentialCount: number
  unreadAnnouncements: number
  usageHistory: WebUsageHistoryResponse | null
  runtimeCapabilities: WebRuntimeCapabilitiesResponse | null
  onNavigate: (page: DashboardPage) => void
}

interface BasicSettingsPageProps {
  preferences: WebPreferencesResponse | null | undefined
  onNavigate: (page: DashboardPage) => void
}

function BasicSettingsPage({
  preferences,
  onNavigate,
}: BasicSettingsPageProps) {
  const settingsTabs: Array<{
    label: string
    page?: DashboardPage
    status?: string
  }> = [
    { label: "通用", page: "preferences" },
    { label: "通知", page: "externalNotifications" },
    { label: "账号管理", page: "accounts" },
    { label: "数据刷新", page: "automation" },
    { label: "签到与兑换", page: "automation" },
    { label: "余额历史", page: "balanceHistory" },
    { label: "账号用量", page: "usageAnalytics" },
    { label: "AI API 测试", page: "apiCheck" },
    { label: "自建 AI 网关", page: "managedSiteChannels" },
    { label: "CLIProxyAPI", status: "Web 端暂未提供" },
    { label: "Claude Code Router", status: "Web 端暂未提供" },
    { label: "数据与备份", page: "importExport" },
  ]
  const cards = [
    {
      title: "显示偏好",
      description: "主题、金额单位、账户排序和健康状态显示。",
      page: "preferences" as const,
      icon: Palette,
      detail: preferences
        ? `${preferences.preferences.currencyType} · ${preferences.preferences.themeMode === "system" ? "跟随系统" : preferences.preferences.themeMode === "dark" ? "深色" : "浅色"}`
        : "尚未加载",
    },
    {
      title: "自动刷新",
      description: "配置账户自动刷新和失败重试策略。",
      page: "automation" as const,
      icon: TimerReset,
      detail: "服务端调度",
    },
    {
      title: "外部通知",
      description: "连接 Telegram、飞书、钉钉或 Webhook 通知渠道。",
      page: "externalNotifications" as const,
      icon: Bell,
      detail: "可选配置",
    },
    {
      title: "运行能力",
      description: "查看服务端和浏览器工作节点可执行的流程。",
      page: "runtimeCapabilities" as const,
      icon: Activity,
      detail: "能力诊断",
    },
    {
      title: "API 检测",
      description: "验证 API 地址、密钥和模型的连通性。",
      page: "apiCheck" as const,
      icon: ShieldCheck,
      detail: "连接测试",
    },
    {
      title: "账户管理",
      description: "账户排序、添加时自动填充和重复账户提醒。",
      page: "accounts" as const,
      icon: UserRound,
      detail: "账户偏好",
    },
    {
      title: "余额历史",
      description: "余额快照采集与历史数据保留策略。",
      page: "balanceHistory" as const,
      icon: History,
      detail: "数据采集",
    },
    {
      title: "用量历史",
      description: "消费日志同步和聚合统计设置。",
      page: "usageAnalytics" as const,
      icon: ChartNoAxesCombined,
      detail: "同步设置",
    },
    {
      title: "网站公告",
      description: "公告检查频率和未读通知显示。",
      page: "siteAnnouncements" as const,
      icon: Bell,
      detail: "公告设置",
    },
  ]

  if (preferences) {
    return (
      <BasicSettingsDashboard
        preferences={preferences}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <div className="space-y-8">
      <div className="[container-type:inline-size]">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-1 size-6 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
              设置
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              管理 Web 控制台的基本配置选项。
            </p>
          </div>
        </div>
      </div>

      <section aria-labelledby="basic-settings-sections">
        <div className="-mx-1 mb-6 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          <div className="flex min-w-max gap-1 px-1">
            {settingsTabs.map(({ label, page, status }, index) => (
              <button
                key={`${label}-${index}`}
                type="button"
                onClick={() => {
                  if (page) onNavigate(page)
                }}
                disabled={!page}
                title={status}
                className={`border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${index === 0 ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400" : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            id="basic-settings-sections"
            className="text-sm font-semibold text-gray-900 dark:text-white"
          >
            设置项
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            选择一项继续
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(({ title, description, page, icon: Icon, detail }) => (
            <button
              key={title}
              type="button"
              onClick={() => onNavigate(page)}
              className="group flex min-h-28 items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {title}
                  </span>
                  <ChevronsRight className="size-4 shrink-0 text-gray-300 transition-colors group-hover:text-blue-600 dark:text-gray-600" />
                </span>
                <span className="mt-1 block text-xs leading-5 text-gray-500 dark:text-gray-400">
                  {description}
                </span>
                <span className="mt-2 block text-xs font-medium text-blue-600 dark:text-blue-400">
                  {detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm leading-6 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-100">
        Web 配置保存在服务端。涉及浏览器页面会话、WAF 或 Turnstile
        的能力，请在“运行能力”中确认工作节点状态。CLIProxyAPI 和 Claude Code
        Router 目前请使用浏览器扩展中的对应设置。
      </div>
    </div>
  )
}

function OverviewPage({
  activeAccounts,
  healthyAccounts,
  accountCount,
  credentialCount,
  unreadAnnouncements,
  usageHistory,
  onNavigate,
}: OverviewPageProps) {
  const problemAccounts = Math.max(0, activeAccounts.length - healthyAccounts)
  const recentUsage = (usageHistory?.entries ?? []).reduce(
    (totals, entry) => ({
      requests: totals.requests + entry.requests,
      tokens: totals.tokens + entry.totalTokens,
      consumedUsd: totals.consumedUsd + entry.consumedUsd,
    }),
    { requests: 0, tokens: 0, consumedUsd: 0 },
  )
  const attentionItems = [
    ...(accountCount === 0
      ? [
          {
            label: "尚未添加账户",
            detail: "添加账户后才能汇总余额和用量。",
            page: "accounts" as const,
          },
        ]
      : []),
    ...(problemAccounts > 0
      ? [
          {
            label: `${problemAccounts} 个账户需要关注`,
            detail: "账户健康检查未通过或尚未完成。",
            page: "accounts" as const,
          },
        ]
      : []),
    ...(unreadAnnouncements > 0
      ? [
          {
            label: `${unreadAnnouncements} 条网站公告未读`,
            detail: "查看站点最近发布的公告。",
            page: "siteAnnouncements" as const,
          },
        ]
      : []),
  ]

  const statusItems = [
    {
      label: "账号",
      value: accountCount,
      page: "accounts" as const,
      tone: "bg-emerald-500 shadow-emerald-500/30",
    },
    {
      label: "凭据库",
      value: credentialCount,
      page: "credentialProfiles" as const,
      tone: "bg-blue-500 shadow-blue-500/30",
    },
    {
      label: "今日用量",
      value: recentUsage.requests,
      page: "usageAnalytics" as const,
      tone: "bg-blue-500 shadow-blue-500/30",
    },
    {
      label: "待处理",
      value: attentionItems.length,
      page: attentionItems[0]?.page ?? ("accounts" as const),
      tone: attentionItems.length
        ? "bg-amber-500 shadow-amber-500/30"
        : "bg-emerald-500 shadow-emerald-500/30",
    },
  ]

  const actionItems = [
    {
      title: "账号基础",
      detail: "账号、余额与健康状态，是其他能力的基础。",
      rows: [{ label: "账号管理", page: "accounts" as const }],
      configured: accountCount > 0,
    },
    {
      title: "凭据资产",
      detail: "API 凭据与账号密钥是否已经准备好。",
      rows: [
        { label: "API 凭据", page: "credentialProfiles" as const },
        { label: "API 密钥", page: "keys" as const },
      ],
      configured: credentialCount > 0,
    },
    {
      title: "自动化",
      detail: "自动签到与公告抓取是否处于可用状态。",
      rows: [
        { label: "自动签到", page: "automation" as const },
        { label: "网站公告", page: "siteAnnouncements" as const },
      ],
      configured: true,
    },
    {
      title: "数据历史",
      detail: "用量与余额历史是否已有可查看数据。",
      rows: [
        { label: "用量分析", page: "usageAnalytics" as const },
        { label: "余额历史", page: "balanceHistory" as const },
      ],
      configured: Boolean(usageHistory?.entries.length),
    },
    {
      title: "备份同步",
      detail: "本地数据备份与跨设备同步配置。",
      rows: [
        { label: "WebDAV 手动备份", page: "importExport" as const },
        { label: "WebDAV 自动同步", page: "importExport" as const },
      ],
      configured: true,
    },
    {
      title: "自建 AI 网关",
      detail: "自建 AI 网关的渠道管理与模型同步能力。",
      rows: [
        { label: "渠道管理", page: "managedSiteChannels" as const },
        { label: "模型同步", page: "managedSiteModelSync" as const },
      ],
      configured: true,
    },
  ]

  return (
    <div className="space-y-6" data-testid="web-options-overview">
      <div className="flex items-start gap-3">
        <LayoutDashboard className="mt-1 size-6 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            总览
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            查看账号、密钥、用量和自动任务的当前状态。
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200/70 md:grid-cols-4 md:divide-y-0 dark:divide-white/10">
          {statusItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.page)}
              className="group flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/85 dark:hover:bg-white/[0.04]"
            >
              <span className="flex min-w-0 items-center gap-3.5">
                <span
                  className={`size-2 shrink-0 rounded-full shadow-[0_0_0_4px] ${item.tone}`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-slate-500 uppercase dark:text-gray-400">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-base leading-none font-semibold text-slate-950 tabular-nums dark:text-white">
                    {item.value}
                  </span>
                </span>
              </span>
              <ChevronsRight className="size-4 shrink-0 text-slate-300 group-hover:text-blue-600 dark:text-gray-600" />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="sr-only">开始使用</h2>
        <h2 className="mb-3 text-xs font-semibold text-gray-500 uppercase">
          统一 API 设置
        </h2>
        <div className="grid gap-4 rounded-md border border-gray-200 p-4 lg:grid-cols-[minmax(0,1fr)_350px] dark:border-gray-700">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                账号 + 凭据
              </span>
              <h3 className="text-base font-semibold">
                将多个账号 Key 或 API Key 汇总成一个统一 AI API
              </h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
              已完成过网关渠道创建或导入。前往渠道管理确认当前状态，并获取外部客户端需要的
              API 地址和调用密钥。
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                [
                  "1",
                  "准备数据源",
                  "添加可读取 Key 的账号或保存 API 凭据。",
                  accountCount + credentialCount > 0,
                ],
                [
                  "2",
                  "保存网关设置",
                  "填写自建 AI 网关的管理员连接信息。",
                  true,
                ],
                [
                  "3",
                  "创建网关渠道",
                  "导入至少一个账号 Key 或已保存的 API 凭据。",
                  true,
                ],
                [
                  "4",
                  "连接客户端",
                  "获取网关 API 地址和客户端调用密钥。",
                  false,
                ],
              ].map(([number, label, detail, ready]) => (
                <button
                  key={String(number)}
                  type="button"
                  onClick={() =>
                    onNavigate(
                      number === "1" ? "accounts" : "managedSiteChannels",
                    )
                  }
                  className={`flex min-h-16 items-start gap-3 rounded-md border p-3 text-left ${ready ? "border-gray-200" : "border-blue-400 bg-blue-50/60"} dark:border-gray-700 dark:bg-gray-900`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${ready ? "bg-emerald-100 text-emerald-700" : "bg-blue-600 text-white"}`}
                  >
                    {number}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {label}
                      <span className="text-[11px] font-normal text-gray-500">
                        {ready ? "已完成" : "当前步骤"}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      {detail}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-500">
              All API Hub
              负责管理和导入配置，不代理模型请求；外部客户端实际调用的是你的自建
              AI 网关。
            </p>
          </div>
          <div className="flex flex-col justify-between rounded-md border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-950/40">
            <button
              type="button"
              onClick={() => onNavigate("managedSiteChannels")}
              className="flex h-10 items-center justify-between rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              管理渠道
              <ChevronsRight className="size-4" />
            </button>
            <div className="mt-24 border-t border-gray-200 pt-3 dark:border-gray-700">
              <div className="mb-2 text-xs text-gray-500">可选维护</div>
              <button
                type="button"
                onClick={() => onNavigate("managedSiteModelSync")}
                className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                打开模型同步
                <ChevronsRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section>
          <h2 className="mb-3 text-xs font-semibold text-gray-500 uppercase">
            需要处理
          </h2>
          <div className="min-h-56 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
            {(attentionItems.length
              ? attentionItems
              : [
                  {
                    label: "当前状态正常",
                    detail: "暂无需要立即处理的项目。",
                    page: "accounts" as const,
                  },
                ]
            ).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.page)}
                className="flex w-full items-center gap-3 border-b border-gray-200 px-4 py-4 text-left last:border-0 dark:border-gray-700"
              >
                <span
                  className={`rounded-full px-2 py-1 text-[11px] ${attentionItems.length ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                >
                  {attentionItems.length ? "警告" : "正常"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {item.label}
                  </span>
                  <span className="mt-1 block truncate text-xs text-gray-500">
                    {item.detail}
                  </span>
                </span>
                <span className="rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-700">
                  打开 ↗
                </span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-xs font-semibold text-gray-500 uppercase">
            自动化执行
          </h2>
          <div className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-gray-700">
            {[
              ["自动签到", "部分成功", "automation"],
              [
                "网站公告抓取",
                unreadAnnouncements
                  ? `${unreadAnnouncements} 条未读`
                  : "已启用",
                "siteAnnouncements",
              ],
              ["托管站点模型同步", "已启用", "managedSiteModelSync"],
              ["WebDAV 备份同步", "已启用", "importExport"],
            ].map(([label, value, page]) => (
              <button
                key={label}
                type="button"
                onClick={() => onNavigate(page as DashboardPage)}
                className="flex h-14 w-full items-center gap-3 rounded-md border border-gray-200 px-3 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <RefreshCw className="size-4 text-gray-500" />
                <span className="min-w-0 flex-1 text-sm font-semibold">
                  {label}
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] text-emerald-700">
                  {value}
                </span>
                <ChevronsRight className="size-4 text-gray-400" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold text-gray-500 uppercase">
          近期使用
        </h2>
        <div className="grid gap-4 rounded-md border border-blue-200 p-4 md:grid-cols-[1.15fr_2fr_1.35fr] dark:border-blue-900">
          <div className="flex min-h-40 flex-col justify-between">
            <div>
              <div className="text-xs text-gray-500">今日消费</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">
                {formatMoney(recentUsage.consumedUsd)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("usageAnalytics")}
              className="w-fit rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
            >
              打开 ↗
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["今日请求", recentUsage.requests.toLocaleString("zh-CN")],
              ["今日 Token", recentUsage.tokens.toLocaleString("zh-CN")],
              ["近 7 日请求", recentUsage.requests.toLocaleString("zh-CN")],
              ["近 7 日 Token", recentUsage.tokens.toLocaleString("zh-CN")],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-md border border-gray-200 p-3 dark:border-gray-700"
              >
                <div className="text-xs text-gray-500">{label}</div>
                <div className="mt-2 text-base font-semibold tabular-nums">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
            <h3 className="text-sm font-semibold">近期趋势</h3>
            <p className="mt-1 text-xs text-gray-500">今日在近 7 日中的占比</p>
            <div className="mt-5 space-y-4 text-xs text-gray-500">
              <div>
                <div className="mb-2 flex justify-between">
                  <span>请求占比</span>
                  <span>0%</span>
                </div>
                <div className="h-1.5 rounded-full bg-blue-100" />
              </div>
              <div>
                <div className="mb-2 flex justify-between">
                  <span>Token 占比</span>
                  <span>0%</span>
                </div>
                <div className="h-1.5 rounded-full bg-blue-100" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold text-gray-500 uppercase">
          配置概览
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {actionItems.map((item) => (
            <div
              key={item.title}
              className="rounded-md border border-gray-200 p-4 dark:border-gray-700"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                  {item.configured ? "已配置" : "待配置"}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-500">{item.detail}</p>
              <div className="mt-4 space-y-2">
                {item.rows.map((row) => (
                  <button
                    key={row.label}
                    type="button"
                    onClick={() => onNavigate(row.page)}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 px-3 text-sm dark:border-gray-700"
                  >
                    {row.label}
                    <span className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                        已配置
                      </span>
                      ↗
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function AccountDashboard({
  data,
  bookmarks = null,
  tags,
  siteAnnouncements,
  automation,
  history,
  usageHistory,
  usageAnalytics,
  notifications,
  runtimeCapabilities,
  modelCatalog,
  allModelCatalog,
  apiKeys,
  credentialProfiles = null,
  createdKeySecret,
  managedSites,
  managedChannels,
  webDavSettings,
  externalNotifications,
  preferences = null,
  channelConfigs = null,
  busy,
  message,
  onCreate,
  onLoadBookmarks = async () => {},
  onCreateBookmark = async () => {},
  onUpdateBookmark = async () => {},
  onDeleteBookmark = async () => {},
  onDetectAccount,
  onUpdate,
  onLoadSiteAnnouncements,
  onSyncSiteAnnouncements,
  onMarkSiteAnnouncementRead,
  onMarkSiteAnnouncementsRead,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  onToggleDisabled,
  onBulkAction,
  onTogglePinned,
  onReorder,
  onRefresh,
  onRefreshAll,
  onRunCheckIn,
  onSaveAutomation,
  onLoadPreferences = async () => {},
  onSavePreferences = async () => {},
  onUpdateChannelConfig = async () => {},
  onLoadHistory,
  onLoadUsageAnalytics,
  onSyncUsageHistory,
  onLoadNotifications,
  onLoadRuntimeCapabilities,
  onMarkNotificationsRead,
  onLoadModels,
  onLoadAllModels,
  onLoadKeys,
  onCreateKey,
  onDeleteKey,
  onUpdateKey,
  onLoadCredentialProfiles = async () => {},
  onCreateCredentialProfile = async () => {},
  onUpdateCredentialProfile = async () => {},
  onDeleteCredentialProfile = async () => {},
  onExportCredentialProfile,
  onLoadCredentialProfileModels = async () => ({
    profileId: "",
    profileName: "",
    supported: false,
    models: [],
  }),
  onVerifyCredentialProfile = async () => {
    throw new Error("凭据验证不可用")
  },
  onFetchVerificationModels,
  onRunVerification,
  onLoadManagedSites,
  onCreateManagedSite,
  onDeleteManagedSite,
  onLoadManagedChannels,
  onDeleteManagedChannel,
  onCreateManagedChannel,
  onUpdateManagedChannel,
  onSyncManagedSiteModels,
  onLoadWebDavSettings,
  onSaveWebDavSettings,
  onTestWebDav,
  onUploadWebDavBackup,
  onRestoreWebDavBackup,
  onExportBackup = async () => ({
    type: "all-api-hub-web-backup",
    version: 1,
    createdAt: Date.now(),
    documents: [],
  }),
  onExportAccounts = async () => ({}),
  onImportAccounts = async () => {},
  onRestoreBackup = async () => {},
  onLoadExternalNotifications,
  onSaveExternalNotifications,
  onTestExternalNotification,
  onDelete,
  onLogout,
}: AccountDashboardProps) {
  const [search, setSearch] = useState("")
  const [accountStatusFilter, setAccountStatusFilter] = useState("all")
  const [siteTypeFilter, setSiteTypeFilter] = useState("all")
  const [refreshStatusFilter, setRefreshStatusFilter] = useState("all")
  const [checkInStatusFilter, setCheckInStatusFilter] = useState("all")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [activePage, setActivePage] = useState<DashboardPage>(pageFromHash)
  const [addOpen, setAddOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [siteAnnouncementsOpen, setSiteAnnouncementsOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<WebAccountSummary | null>(null)
  const [automationOpen, setAutomationOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [usageHistoryOpen, setUsageHistoryOpen] = useState(false)
  const [usageAnalyticsOpen, setUsageAnalyticsOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [runtimeCapabilitiesOpen, setRuntimeCapabilitiesOpen] = useState(false)
  const [modelsOpen, setModelsOpen] = useState(false)
  const [allModelsOpen, setAllModelsOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)
  const [credentialProfilesOpen, setCredentialProfilesOpen] = useState(false)
  const [apiCheckOpen, setApiCheckOpen] = useState(false)
  const [managedSitesOpen, setManagedSitesOpen] = useState(false)
  const [webDavOpen, setWebDavOpen] = useState(false)
  const [externalNotificationsOpen, setExternalNotificationsOpen] =
    useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [accountBulkMode, setAccountBulkMode] = useState(false)
  const [accountReorderMode, setAccountReorderMode] = useState(false)
  const [accountMenuId, setAccountMenuId] = useState<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WebAccountSummary | null>(
    null,
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const syncPageFromUrl = () => setActivePage(pageFromHash())
    window.addEventListener("hashchange", syncPageFromUrl)
    window.addEventListener("popstate", syncPageFromUrl)
    return () => {
      window.removeEventListener("hashchange", syncPageFromUrl)
      window.removeEventListener("popstate", syncPageFromUrl)
    }
  }, [])

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileNavOpen])

  const navigateToPage = (page: DashboardPage) => {
    const hash = `#${dashboardPages[page]}`
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash)
    }
    setActivePage(page)
    setMobileNavOpen(false)
  }

  const loadPageData = useCallback(
    async (page: DashboardPage) => {
      switch (page) {
        case "bookmarks":
          await onLoadBookmarks()
          break
        case "credentialProfiles":
          await onLoadCredentialProfiles()
          break
        case "models":
          await onLoadAllModels()
          break
        case "keys": {
          const account = data.accounts[0]
          if (account) await onLoadKeys(account)
          break
        }
        case "siteAnnouncements":
          await onLoadSiteAnnouncements()
          break
        case "balanceHistory":
          await onLoadHistory()
          break
        case "usageAnalytics":
          await onLoadUsageAnalytics()
          break
        case "managedSiteChannels":
        case "managedSiteModelSync":
          await onLoadManagedSites()
          break
        case "basicSettings":
        case "preferences":
          await onLoadPreferences()
          break
        case "runtimeCapabilities":
          await onLoadRuntimeCapabilities()
          break
        case "externalNotifications":
          await onLoadExternalNotifications()
          break
        case "importExport":
          await onLoadWebDavSettings()
          break
        default:
          break
      }
    },
    [
      data.accounts,
      onLoadAllModels,
      onLoadBookmarks,
      onLoadCredentialProfiles,
      onLoadHistory,
      onLoadKeys,
      onLoadManagedSites,
      onLoadPreferences,
      onLoadRuntimeCapabilities,
      onLoadSiteAnnouncements,
      onLoadUsageAnalytics,
      onLoadWebDavSettings,
      onLoadExternalNotifications,
    ],
  )

  const loadedPageRef = useRef<DashboardPage | null>(null)
  useEffect(() => {
    if (loadedPageRef.current === activePage) return
    loadedPageRef.current = activePage
    void loadPageData(activePage)
  }, [activePage, loadPageData])

  const tagNameById = useMemo(
    () => new Map(tags.tags.map((tag) => [tag.id, tag.name])),
    [tags.tags],
  )

  const siteTypeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const account of data.accounts) {
      counts.set(account.siteType, (counts.get(account.siteType) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort(([left], [right]) =>
      left.localeCompare(right),
    )
  }, [data.accounts])

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    const matching = data.accounts.filter((account) => {
      const tagNames = account.tagIds.flatMap((id) => {
        const name = tagNameById.get(id)
        return name ? [name] : []
      })
      const matchesSearch =
        !query ||
        [
          account.name,
          account.baseUrl,
          account.siteType,
          account.username,
          ...tagNames,
        ].some((value) => value.toLocaleLowerCase().includes(query))
      const matchesAccountStatus =
        accountStatusFilter === "all" ||
        (accountStatusFilter === "disabled"
          ? account.disabled
          : !account.disabled)
      const matchesSiteType =
        siteTypeFilter === "all" || account.siteType === siteTypeFilter
      const matchesRefresh =
        refreshStatusFilter === "all" ||
        getAccountRefreshFilter(account) === refreshStatusFilter
      const matchesCheckIn =
        checkInStatusFilter === "all" ||
        getAccountCheckInFilter(account) === checkInStatusFilter
      const matchesTags =
        selectedTagIds.length === 0 ||
        selectedTagIds.some((tagId) => account.tagIds.includes(tagId))

      return (
        matchesSearch &&
        matchesAccountStatus &&
        matchesSiteType &&
        matchesRefresh &&
        matchesCheckIn &&
        matchesTags
      )
    })

    const sortField = preferences?.preferences.sortField
    if (!sortField) return matching
    const currency = preferences?.preferences.currencyType ?? "USD"
    const direction = preferences?.preferences.sortOrder === "asc" ? 1 : -1
    const originalPosition = new Map(
      data.accounts.map((account, index) => [account.id, index]),
    )
    const valueFor = (account: WebAccountSummary) => {
      switch (sortField) {
        case "consumption":
          return account.todayConsumption[currency]
        case "income":
          return (account.todayIncome ?? { USD: 0, CNY: 0 })[currency]
        case "balance":
          return account.balance[currency]
        case "created_at":
          return account.createdAt
        case "cashflow":
          return (
            account.todayConsumption[currency] -
            (account.todayIncome ?? { USD: 0, CNY: 0 })[currency]
          )
        default:
          return 0
      }
    }
    return [...matching].sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
      const difference = (valueFor(left) - valueFor(right)) * direction
      return (
        difference ||
        (originalPosition.get(left.id) ?? 0) -
          (originalPosition.get(right.id) ?? 0)
      )
    })
  }, [
    accountStatusFilter,
    checkInStatusFilter,
    data.accounts,
    preferences,
    refreshStatusFilter,
    search,
    selectedTagIds,
    siteTypeFilter,
    tagNameById,
  ])

  useEffect(() => {
    const existingIds = new Set(data.accounts.map((account) => account.id))
    setSelectedAccountIds((current) => {
      const next = current.filter((id) => existingIds.has(id))
      return next.length === current.length ? current : next
    })
  }, [data.accounts])

  const selectedIdSet = useMemo(
    () => new Set(selectedAccountIds),
    [selectedAccountIds],
  )
  const allFilteredSelected =
    filteredAccounts.length > 0 &&
    filteredAccounts.every((account) => selectedIdSet.has(account.id))
  const someFilteredSelected = filteredAccounts.some((account) =>
    selectedIdSet.has(account.id),
  )

  const setAccountSelected = (accountId: string, selected: boolean) => {
    setSelectedAccountIds((current) => {
      const next = new Set(current)
      if (selected) next.add(accountId)
      else next.delete(accountId)
      return Array.from(next)
    })
  }

  const setFilteredAccountsSelected = (selected: boolean) => {
    setSelectedAccountIds((current) => {
      const next = new Set(current)
      for (const account of filteredAccounts) {
        if (selected) next.add(account.id)
        else next.delete(account.id)
      }
      return Array.from(next)
    })
  }

  const runBulkAction = async (action: WebAccountBulkAction) => {
    if (selectedAccountIds.length === 0) return false
    try {
      await onBulkAction(selectedAccountIds, action)
      setSelectedAccountIds([])
      return true
    } catch {
      return false
    }
  }

  const moveAccount = (accountId: string, direction: -1 | 1) => {
    const currentIndex = data.accounts.findIndex(
      (account) => account.id === accountId,
    )
    const targetIndex = currentIndex + direction
    const current = data.accounts[currentIndex]
    const target = data.accounts[targetIndex]
    if (!current || !target || current.pinned !== target.pinned) return

    const accountIds = data.accounts.map((account) => account.id)
    ;[accountIds[currentIndex], accountIds[targetIndex]] = [
      accountIds[targetIndex],
      accountIds[currentIndex],
    ]
    void onReorder(accountIds)
  }

  const updateAccountSort = (
    sortField: "created_at" | "balance" | "consumption" | "income",
  ) => {
    if (!onSavePreferences) return
    const currentField = preferences?.preferences.sortField
    const currentOrder = preferences?.preferences.sortOrder ?? "desc"
    void onSavePreferences({
      sortField,
      sortOrder:
        currentField === sortField && currentOrder === "desc" ? "asc" : "desc",
      expectedRevision: preferences?.revision,
    })
  }

  const clearAccountSort = () => {
    if (!onSavePreferences) return
    void onSavePreferences({
      sortField: null,
      expectedRevision: preferences?.revision,
    })
  }

  const activeAccounts = data.accounts.filter((account) => !account.disabled)
  const totalBalance = activeAccounts.reduce(
    (sum, account) =>
      sum + account.balance[preferences?.preferences.currencyType ?? "USD"],
    0,
  )
  const healthyAccounts = activeAccounts.filter(
    (account) => account.health.status === SiteHealthStatus.Healthy,
  ).length

  const navigationItems: Array<{
    label: string
    icon: LucideIcon
    category: string
    page: DashboardPage
    badge?: number
    onClick: () => void | Promise<void>
  }> = [
    {
      label: "总览",
      icon: LayoutDashboard,
      category: "常规",
      page: "overview",
      onClick: () => navigateToPage("overview"),
    },
    {
      label: "账户管理",
      icon: Users,
      category: "常规",
      page: "accounts",
      onClick: () => navigateToPage("accounts"),
    },
    {
      label: "API 凭据库",
      icon: LibraryBig,
      category: "常规",
      page: "credentialProfiles",
      onClick: () => navigateToPage("credentialProfiles"),
    },
    {
      label: "书签管理",
      icon: Bookmark,
      category: "常规",
      page: "bookmarks",
      onClick: () => navigateToPage("bookmarks"),
    },
    {
      label: "模型列表",
      icon: Cpu,
      category: "接口",
      page: "models",
      onClick: () => navigateToPage("models"),
    },
    {
      label: "密钥管理",
      icon: KeyRound,
      category: "接口",
      page: "keys",
      onClick: () => navigateToPage("keys"),
    },
    {
      label: "自动签到",
      icon: CalendarCheck2,
      category: "自动化",
      page: "automation",
      onClick: () => navigateToPage("automation"),
    },
    {
      label: "网站公告",
      icon: Megaphone,
      category: "自动化",
      page: "siteAnnouncements",
      badge: siteAnnouncements.unreadCount,
      onClick: () => navigateToPage("siteAnnouncements"),
    },
    {
      label: "余额历史",
      icon: ChartLine,
      category: "洞察",
      page: "balanceHistory",
      onClick: () => navigateToPage("balanceHistory"),
    },
    {
      label: "用量分析",
      icon: ChartNoAxesCombined,
      category: "洞察",
      page: "usageAnalytics",
      onClick: () => navigateToPage("usageAnalytics"),
    },
    {
      label: "渠道管理",
      icon: Layers3,
      category: "站点管理",
      page: "managedSiteChannels",
      onClick: () => navigateToPage("managedSiteChannels"),
    },
    {
      label: "模型同步",
      icon: RefreshCw,
      category: "站点管理",
      page: "managedSiteModelSync",
      onClick: () => navigateToPage("managedSiteModelSync"),
    },
    {
      label: "设置",
      icon: Settings,
      category: "系统",
      page: "basicSettings",
      onClick: () => navigateToPage("basicSettings"),
    },
    {
      label: "导入/导出",
      icon: ArrowLeftRight,
      category: "系统",
      page: "importExport",
      onClick: () => navigateToPage("importExport"),
    },
    {
      label: "关于",
      icon: Info,
      category: "系统",
      page: "about",
      onClick: () => navigateToPage("about"),
    },
  ]

  // 设置页中的子页面仍属于上游的“设置”分组，保持侧栏选中状态稳定。
  const activeNavigationPage: DashboardPage = [
    "preferences",
    "runtimeCapabilities",
    "externalNotifications",
    "apiCheck",
  ].includes(activePage)
    ? "basicSettings"
    : activePage

  const renderNavigation = (ariaLabel: string, collapsed = false) => (
    <nav
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-4"
      aria-label={ariaLabel}
    >
      <ul className="space-y-1 px-2">
        {navigationItems.map(
          ({ label, icon: Icon, page, badge, onClick, category }, index) => {
            const isNewCategory =
              index === 0 || navigationItems[index - 1]?.category !== category
            const active = activeNavigationPage === page
            return (
              <li key={label}>
                {isNewCategory && !collapsed ? (
                  <div className="mt-4 mb-2 px-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    {category}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void onClick()}
                  title={collapsed ? label : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : ""} ${active ? "bg-blue-600 text-white dark:bg-blue-500" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"}`}
                >
                  <Icon
                    className={`size-5 shrink-0 ${active ? "text-white" : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-white"}`}
                  />
                  {!collapsed ? (
                    <span className="min-w-0 flex-1 truncate text-base">
                      {label}
                    </span>
                  ) : null}
                  {badge && !collapsed ? (
                    <span
                      className={`ml-auto text-xs ${active ? "text-white/80" : "text-gray-400"}`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          },
        )}
      </ul>
    </nav>
  )

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950 dark:bg-gray-950 dark:text-gray-100">
      <header className="sticky top-0 z-30 h-[3.75rem] border-b border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="relative mx-auto h-full px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="flex h-full items-center gap-2">
            <button
              type="button"
              aria-label="打开主导航"
              title="打开主导航"
              onClick={() => setMobileNavOpen(true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Menu className="size-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <img
                src={iconImage}
                alt="All API Hub"
                className="size-[30px] rounded-lg shadow-sm sm:size-[34px]"
              />
              <div className="min-w-0">
                <div className="truncate text-sm leading-tight font-semibold sm:text-lg">
                  All API Hub
                </div>
                <div className="mt-0.5 w-fit rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] leading-none text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  v3.59.0
                </div>
              </div>
            </div>
            <div className="ml-3 hidden min-w-0 flex-1 md:flex">
              <button
                type="button"
                aria-label="打开搜索"
                onClick={() => searchInputRef.current?.focus()}
                className="flex h-10 w-full max-w-md items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 text-left text-sm text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
              >
                <Search className="size-4 shrink-0" />
                <span className="truncate">搜索设置...</span>
                <span className="ml-auto rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900">
                  Ctrl+K
                </span>
              </button>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                aria-label="网站公告"
                title="网站公告"
                onClick={() => navigateToPage("siteAnnouncements")}
                className="relative flex size-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Megaphone className="size-4" />
                {siteAnnouncements.unreadCount ? (
                  <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-red-600 px-1 text-[10px] leading-4 text-white">
                    {Math.min(99, siteAnnouncements.unreadCount)}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                aria-label="外观设置"
                title="外观设置"
                onClick={() => navigateToPage("preferences")}
                className="hidden size-8 items-center justify-center rounded-md border border-violet-200 text-violet-600 hover:bg-violet-50 sm:flex dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/30"
              >
                <Monitor className="size-4" />
              </button>
              <button
                type="button"
                aria-label="通知中心"
                title="通知中心"
                onClick={async () => {
                  await onLoadNotifications()
                  setNotificationsOpen(true)
                }}
                className="relative hidden size-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 sm:flex dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <MessageSquare className="size-4" />
                {notifications?.unreadCount ? (
                  <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-red-600 px-1 text-[10px] leading-4 text-white">
                    {Math.min(99, notifications.unreadCount)}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                aria-label="语言"
                title="语言"
                onClick={() => navigateToPage("preferences")}
                className="hidden size-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 sm:flex dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Languages className="size-4" />
              </button>
              <button
                type="button"
                aria-label="打开搜索"
                title="打开搜索"
                onClick={() => searchInputRef.current?.focus()}
                className="flex size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Search className="size-5" />
              </button>
              <button
                type="button"
                aria-label="退出登录"
                title="退出登录"
                onClick={() => void onLogout()}
                className="flex size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <LogOut className="size-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.75rem)]">
        <aside
          className={`fixed top-[3.75rem] bottom-0 left-0 z-20 hidden shrink-0 border-r border-gray-200 bg-white md:flex md:flex-col dark:border-gray-800 dark:bg-gray-900 ${sidebarCollapsed ? "w-16" : "w-64"}`}
        >
          <div
            className={`flex h-16 items-center px-3 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}
          >
            {!sidebarCollapsed ? (
              <div className="truncate px-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
                设置选项
              </div>
            ) : null}
            <button
              type="button"
              aria-label={sidebarCollapsed ? "展开导航" : "折叠导航"}
              title={sidebarCollapsed ? "展开导航" : "折叠导航"}
              onClick={() => setSidebarCollapsed((value) => !value)}
              className="flex size-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {sidebarCollapsed ? (
                <ChevronsRight className="size-4" />
              ) : (
                <ChevronsLeft className="size-4" />
              )}
            </button>
          </div>
          <div className="mx-3 border-t border-gray-200 dark:border-gray-800" />
          {renderNavigation("设置选项", sidebarCollapsed)}
          <div className="mx-3 border-t border-gray-200 dark:border-gray-800" />
          <div
            className={`flex min-h-12 items-center px-3 py-3 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}
          >
            {!sidebarCollapsed ? (
              <span className="px-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                设置
              </span>
            ) : null}
          </div>
        </aside>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              aria-label="关闭主导航"
              className="absolute inset-0 h-full w-full bg-black/20"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside
              aria-label="移动端主导航"
              className="relative flex h-full w-64 flex-col border-r border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex h-16 items-center justify-between px-3">
                <div className="px-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
                  设置选项
                </div>
                <button
                  type="button"
                  aria-label="关闭主导航"
                  title="关闭主导航"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex size-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mx-3 border-t border-gray-200 dark:border-gray-800" />
              {renderNavigation("移动端主导航")}
              <div className="mx-3 border-t border-gray-200 dark:border-gray-800" />
              <div className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false)
                    void onLogout()
                  }}
                  className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                >
                  <LogOut className="size-5" />
                  退出登录
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        <div
          className={`min-w-0 flex-1 ${sidebarCollapsed ? "md:pl-16" : "md:pl-64"}`}
        >
          <main className="mx-auto w-full max-w-7xl px-2 py-3 sm:px-4 sm:py-5 md:px-6 md:py-6">
            <div className="min-h-[400px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:min-h-[600px] dark:border-gray-800 dark:bg-gray-900">
              <div
                className={
                  activePage === "overview" || activePage === "accounts"
                    ? "space-y-5 p-4 sm:p-6"
                    : "p-4 sm:p-6"
                }
              >
                {activePage === "overview" ? (
                  <OverviewPage
                    activeAccounts={activeAccounts}
                    totalBalance={totalBalance}
                    healthyAccounts={healthyAccounts}
                    accountCount={data.accounts.length}
                    credentialCount={credentialProfiles?.profiles.length ?? 0}
                    unreadAnnouncements={siteAnnouncements.unreadCount}
                    usageHistory={usageHistory}
                    runtimeCapabilities={runtimeCapabilities}
                    onNavigate={navigateToPage}
                  />
                ) : activePage === "accounts" ? (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <Users className="mt-1 size-6 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                              账户管理
                            </h1>
                            <button
                              type="button"
                              aria-label="账户管理设置"
                              title="账户管理设置"
                              onClick={() => navigateToPage("basicSettings")}
                              className="flex size-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                            >
                              <Settings2 className="size-4" />
                            </button>
                          </div>
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                            集中管理站点账号，查看余额、健康状态、API Key
                            与使用情况。
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                        <button
                          type="button"
                          disabled={busy || data.accounts.length === 0}
                          onClick={() => void onRefreshAll()}
                          className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                          <RefreshCw className="size-4" />
                          刷新
                        </button>
                        <button
                          type="button"
                          disabled={busy || data.accounts.length === 0}
                          onClick={() => void onRefreshAll()}
                          className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                          <RefreshCw className="size-4" />
                          刷新已禁用账号
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void onLoadBookmarks()
                            navigateToPage("bookmarks")
                          }}
                          className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                          <Bookmark className="size-4" />
                          从书签批量导入
                        </button>
                        <button
                          type="button"
                          disabled={busy || data.accounts.length < 2}
                          className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                          <Search className="size-4" />
                          扫描重复账号
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setAddOpen(true)}
                          className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          <Plus className="size-4" />
                          新增账号
                        </button>
                      </div>
                    </div>
                    {message ? (
                      <div
                        role={message.kind === "error" ? "alert" : "status"}
                        className={`rounded-md border px-4 py-3 text-sm ${
                          message.kind === "error"
                            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                      >
                        {message.text}
                      </div>
                    ) : null}

                    <section className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                      <div className="space-y-2 border-b border-gray-200 p-3 dark:border-gray-800">
                        <div className="flex flex-col gap-2 2xl:flex-row 2xl:items-center">
                          <div className="relative min-w-0 2xl:w-[310px] 2xl:shrink-0">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                            <input
                              ref={searchInputRef}
                              value={search}
                              onChange={(event) =>
                                setSearch(event.target.value)
                              }
                              placeholder="搜索名称、站点或类型"
                              className="h-9 w-full rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
                            />
                          </div>
                          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
                            <select
                              value={siteTypeFilter}
                              onChange={(event) =>
                                setSiteTypeFilter(event.target.value)
                              }
                              aria-label="站点类型"
                              className="h-9 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                            >
                              <option value="all">全部站点类型</option>
                              {siteTypeCounts.map(([type, count]) => (
                                <option key={type} value={type}>
                                  {type} ({count})
                                </option>
                              ))}
                            </select>
                            <select
                              value={checkInStatusFilter}
                              onChange={(event) =>
                                setCheckInStatusFilter(event.target.value)
                              }
                              aria-label="签到状态"
                              className="h-9 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                            >
                              <option value="all">全部签到状态</option>
                              {Object.entries(accountCheckInFilterLabels).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                            <select
                              value={refreshStatusFilter}
                              onChange={(event) =>
                                setRefreshStatusFilter(event.target.value)
                              }
                              aria-label="刷新状态"
                              className="h-9 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                            >
                              <option value="all">全部刷新状态</option>
                              <option value="never-synced">未同步</option>
                              <option value="healthy">健康</option>
                              <option value="warning">警告</option>
                              <option value="error">错误</option>
                              <option value="unknown">未知</option>
                            </select>
                            <select
                              value={accountStatusFilter}
                              onChange={(event) =>
                                setAccountStatusFilter(event.target.value)
                              }
                              aria-label="账号状态"
                              className="h-9 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                            >
                              <option value="all">全部账号</option>
                              <option value="enabled">已启用</option>
                              <option value="disabled">已停用</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedTagIds([])}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${selectedTagIds.length === 0 ? "bg-emerald-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                          >
                            全部&nbsp; {data.accounts.length}
                          </button>
                          {tags.tags.map((tag) => {
                            const selected = selectedTagIds.includes(tag.id)
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                aria-pressed={selected}
                                aria-label={tag.name}
                                onClick={() =>
                                  setSelectedTagIds((current) =>
                                    selected
                                      ? current.filter((id) => id !== tag.id)
                                      : [...current, tag.id],
                                  )
                                }
                                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${selected ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                              >
                                {tag.name}&nbsp;{" "}
                                {
                                  data.accounts.filter((account) =>
                                    account.tagIds.includes(tag.id),
                                  ).length
                                }
                              </button>
                            )
                          })}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setTagsOpen(true)}
                            className="sr-only"
                          >
                            <Tags className="size-3.5" />
                            管理标签
                          </button>
                        </div>
                      </div>

                      {selectedAccountIds.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950/50">
                          <span className="mr-auto text-sm font-medium">
                            已选择 {selectedAccountIds.length} 个账户
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void runBulkAction("enable")}
                            className="flex h-8 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-white disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            <Power className="size-4" />
                            批量启用
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void runBulkAction("disable")}
                            className="flex h-8 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-white disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            <Power className="size-4" />
                            批量停用
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setBulkDeleteOpen(true)}
                            className="flex h-8 items-center gap-2 rounded-md border border-red-300 px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="size-4" />
                            批量删除
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setSelectedAccountIds([])}
                            className="h-8 px-2 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-50 dark:hover:text-white"
                          >
                            清除选择
                          </button>
                        </div>
                      ) : null}

                      {filteredAccounts.length === 0 ? (
                        <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                          <Database className="size-8 text-gray-300 dark:text-gray-600" />
                          <p className="mt-3 text-sm font-medium">
                            {data.accounts.length === 0
                              ? "暂无账户"
                              : "没有匹配的账户"}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {data.accounts.length === 0
                              ? "添加账户以开始管理。"
                              : "尝试调整搜索条件。"}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex min-h-11 items-center gap-3 border-b border-gray-200 bg-gray-50/70 px-4 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-300">
                            <div className={accountBulkMode ? "" : "sr-only"}>
                              <Checkbox
                                aria-label="全选筛选结果"
                                checked={
                                  allFilteredSelected
                                    ? true
                                    : someFilteredSelected
                                      ? "indeterminate"
                                      : false
                                }
                                disabled={busy}
                                onCheckedChange={(checked) =>
                                  setFilteredAccountsSelected(checked === true)
                                }
                              />
                            </div>
                            <div className="flex min-w-0 flex-1 items-center gap-4">
                              <span className="font-medium">账号</span>
                              <button
                                type="button"
                                onClick={() => updateAccountSort("created_at")}
                                className="hover:text-blue-600"
                              >
                                创建时间
                              </button>
                              <span className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                              {[
                                ["balance", "余额"],
                                ["consumption", "今日消费"],
                                ["income", "今日收入"],
                              ].map(([field, label]) => (
                                <button
                                  key={field}
                                  type="button"
                                  onClick={() =>
                                    updateAccountSort(
                                      field as
                                        | "balance"
                                        | "consumption"
                                        | "income",
                                    )
                                  }
                                  className={`rounded px-2 py-1 ${preferences?.preferences.sortField === field ? "bg-blue-100 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "hover:text-blue-600"}`}
                                >
                                  {label}
                                  {preferences?.preferences.sortField === field
                                    ? preferences.preferences.sortOrder ===
                                      "asc"
                                      ? " ↑"
                                      : " ↓"
                                    : ""}
                                </button>
                              ))}
                              {preferences?.preferences.sortField ? (
                                <button
                                  type="button"
                                  onClick={clearAccountSort}
                                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-100"
                                >
                                  ×&nbsp; 清除排序
                                </button>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-gray-500">
                              共 {filteredAccounts.length} 个账号
                            </span>
                            <button
                              type="button"
                              aria-pressed={accountReorderMode}
                              onClick={() => {
                                setAccountReorderMode((value) => !value)
                                setAccountMenuId(null)
                              }}
                              className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-medium ${accountReorderMode ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900"}`}
                            >
                              <ListOrdered className="size-3.5" />
                              调整顺序
                            </button>
                            <button
                              type="button"
                              aria-pressed={accountBulkMode}
                              onClick={() => {
                                setAccountBulkMode((value) => !value)
                                setSelectedAccountIds([])
                              }}
                              className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-medium ${accountBulkMode ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900"}`}
                            >
                              <Settings2 className="size-3.5" />
                              批量操作
                            </button>
                          </div>

                          <div className="divide-y divide-gray-200 dark:divide-gray-800">
                            {filteredAccounts.map((account) => {
                              const accountIndex = data.accounts.findIndex(
                                (item) => item.id === account.id,
                              )
                              const previousAccount =
                                data.accounts[accountIndex - 1]
                              const nextAccount =
                                data.accounts[accountIndex + 1]
                              const currency =
                                preferences?.preferences.currencyType ?? "USD"
                              const tagNames = account.tagIds.flatMap(
                                (tagId) => {
                                  const tagName = tagNameById.get(tagId)
                                  return tagName ? [tagName] : []
                                },
                              )
                              const statusDot = account.disabled
                                ? "bg-rose-300"
                                : account.health.status ===
                                    SiteHealthStatus.Healthy
                                  ? "bg-emerald-500"
                                  : account.health.status ===
                                      SiteHealthStatus.Error
                                    ? "bg-red-500"
                                    : "bg-amber-400"

                              return (
                                <div
                                  key={account.id}
                                  className={`relative grid min-h-[78px] grid-cols-[minmax(0,1fr)_220px_160px] items-center gap-3 px-4 py-2.5 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 ${account.disabled ? "text-gray-400" : ""}`}
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span
                                      className={`size-2 shrink-0 rounded-full ${statusDot}`}
                                      title={
                                        getHealthPresentation(account).label
                                      }
                                    />
                                    <div
                                      className={
                                        accountBulkMode ? "" : "sr-only"
                                      }
                                    >
                                      <Checkbox
                                        aria-label={`选择账户 ${account.name}`}
                                        checked={selectedIdSet.has(account.id)}
                                        disabled={busy}
                                        onCheckedChange={(checked) =>
                                          setAccountSelected(
                                            account.id,
                                            checked === true,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        {account.disabled ? (
                                          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">
                                            已禁用
                                          </span>
                                        ) : null}
                                        <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300">
                                          {account.siteType}
                                        </span>
                                        <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                                          {account.name}
                                        </span>
                                      </div>
                                      <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-gray-500">
                                        <User className="size-3 shrink-0" />
                                        <span className="truncate">
                                          {account.username ||
                                            account.userId ||
                                            "未命名账号"}
                                        </span>
                                      </div>
                                      <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-gray-400">
                                        <Tags className="size-3 shrink-0" />
                                        <span className="truncate">
                                          {tagNames.length > 0
                                            ? tagNames.join("、")
                                            : account.baseUrl}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="relative flex items-center justify-center gap-2">
                                    {accountReorderMode ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={
                                            busy ||
                                            !previousAccount ||
                                            previousAccount.pinned !==
                                              account.pinned
                                          }
                                          aria-label={`上移账户 ${account.name}`}
                                          title="上移账户"
                                          onClick={() =>
                                            moveAccount(account.id, -1)
                                          }
                                          className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
                                        >
                                          <ArrowUp className="size-4" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={
                                            busy ||
                                            !nextAccount ||
                                            nextAccount.pinned !==
                                              account.pinned
                                          }
                                          aria-label={`下移账户 ${account.name}`}
                                          title="下移账户"
                                          onClick={() =>
                                            moveAccount(account.id, 1)
                                          }
                                          className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
                                        >
                                          <ArrowDown className="size-4" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          aria-label={`打开站点 ${account.name}`}
                                          title="打开站点"
                                          onClick={() =>
                                            window.open(
                                              account.baseUrl,
                                              "_blank",
                                              "noopener,noreferrer",
                                            )
                                          }
                                          className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                                        >
                                          <ExternalLink className="size-4" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          aria-label="管理密钥"
                                          title="管理密钥"
                                          onClick={async () => {
                                            await onLoadKeys(account)
                                            setKeysOpen(true)
                                          }}
                                          className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-40 dark:hover:bg-gray-800"
                                        >
                                          <KeyRound className="size-4" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          aria-label="编辑账户"
                                          title="编辑账户"
                                          onClick={() => setEditTarget(account)}
                                          className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-40 dark:hover:bg-gray-800"
                                        >
                                          <Pencil className="size-4" />
                                        </button>
                                        <button
                                          type="button"
                                          aria-label={`更多账户操作 ${account.name}`}
                                          title="更多操作"
                                          onClick={() =>
                                            setAccountMenuId((current) =>
                                              current === account.id
                                                ? null
                                                : account.id,
                                            )
                                          }
                                          className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                                        >
                                          <Ellipsis className="size-4" />
                                        </button>
                                      </>
                                    )}

                                    {accountMenuId === account.id ? (
                                      <div className="absolute top-9 right-0 z-20 w-44 rounded-md border border-gray-200 bg-white p-1 text-left text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void onTogglePinned(account)
                                            setAccountMenuId(null)
                                          }}
                                          className="flex h-8 w-full items-center gap-2 rounded px-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                                        >
                                          <Pin className="size-4" />
                                          {account.pinned
                                            ? "取消置顶"
                                            : "置顶账户"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            await onLoadModels(account)
                                            setModelsOpen(true)
                                            setAccountMenuId(null)
                                          }}
                                          className="flex h-8 w-full items-center gap-2 rounded px-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                                        >
                                          <Boxes className="size-4" />
                                          查看模型
                                        </button>
                                        <button
                                          type="button"
                                          disabled={busy || account.disabled}
                                          onClick={() => {
                                            void onRefresh(account)
                                            setAccountMenuId(null)
                                          }}
                                          className="flex h-8 w-full items-center gap-2 rounded px-2 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                                        >
                                          <RefreshCw className="size-4" />
                                          刷新账户
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void onToggleDisabled(account)
                                            setAccountMenuId(null)
                                          }}
                                          className="flex h-8 w-full items-center gap-2 rounded px-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                                        >
                                          <Power className="size-4" />
                                          {account.disabled
                                            ? "启用账户"
                                            : "停用账户"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeleteTarget(account)
                                            setAccountMenuId(null)
                                          }}
                                          className="flex h-8 w-full items-center gap-2 rounded px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                        >
                                          <Trash2 className="size-4" />
                                          删除账户
                                        </button>
                                      </div>
                                    ) : null}

                                    <div className="sr-only">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        aria-label={
                                          account.pinned
                                            ? "取消置顶账户"
                                            : "置顶账户"
                                        }
                                        onClick={() =>
                                          void onTogglePinned(account)
                                        }
                                      />
                                      <button
                                        type="button"
                                        disabled={
                                          busy ||
                                          !previousAccount ||
                                          previousAccount.pinned !==
                                            account.pinned
                                        }
                                        aria-label={`上移账户 ${account.name}`}
                                        onClick={() =>
                                          moveAccount(account.id, -1)
                                        }
                                      />
                                      <button
                                        type="button"
                                        disabled={
                                          busy ||
                                          !nextAccount ||
                                          nextAccount.pinned !== account.pinned
                                        }
                                        aria-label={`下移账户 ${account.name}`}
                                        onClick={() =>
                                          moveAccount(account.id, 1)
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="text-right tabular-nums">
                                    <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                                      {formatMoney(
                                        account.balance[currency],
                                        currency,
                                      )}
                                    </div>
                                    {preferences?.preferences
                                      .showTodayCashflow !== false ? (
                                      <div className="mt-1 flex justify-end gap-1.5 text-xs">
                                        <span
                                          className={
                                            account.todayConsumption[currency] >
                                            0
                                              ? "text-emerald-500"
                                              : "text-gray-400"
                                          }
                                        >
                                          -
                                          {formatMoney(
                                            account.todayConsumption[currency],
                                            currency,
                                          )}
                                        </span>
                                        <span className="text-gray-400">
                                          +
                                          {formatMoney(
                                            (account.todayIncome ?? {
                                              USD: 0,
                                              CNY: 0,
                                            })[currency],
                                            currency,
                                          )}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                ) : activePage === "basicSettings" ? (
                  <BasicSettingsPage
                    preferences={preferences}
                    onNavigate={navigateToPage}
                  />
                ) : activePage === "bookmarks" ? (
                  <WebDialogInlineProvider>
                    <BookmarksDialog
                      open
                      busy={busy}
                      bookmarks={
                        bookmarks ?? {
                          bookmarks: [],
                          pinnedBookmarkIds: [],
                          revision: 0,
                          lastUpdated: 0,
                        }
                      }
                      tags={tags.tags}
                      onClose={() => navigateToPage("overview")}
                      onCreate={onCreateBookmark}
                      onUpdate={onUpdateBookmark}
                      onDelete={onDeleteBookmark}
                    />
                  </WebDialogInlineProvider>
                ) : activePage === "balanceHistory" ? (
                  <WebDialogInlineProvider>
                    <BalanceHistoryDialog
                      open
                      history={history}
                      onClose={() => navigateToPage("overview")}
                      onRefresh={onLoadHistory}
                    />
                  </WebDialogInlineProvider>
                ) : activePage === "keys" ? (
                  <WebDialogInlineProvider>
                    <KeyManagementDialog
                      open
                      busy={busy}
                      keys={apiKeys}
                      createdSecret={createdKeySecret}
                      title="密钥管理"
                      accounts={data.accounts}
                      onClose={() => navigateToPage("overview")}
                      onCreate={onCreateKey}
                      onDelete={onDeleteKey}
                      onUpdate={onUpdateKey}
                      onSelectAccount={onLoadKeys}
                      onRefresh={async () => {
                        const account = data.accounts.find(
                          (item) => item.id === apiKeys?.accountId,
                        )
                        if (account) await onLoadKeys(account)
                      }}
                    />
                  </WebDialogInlineProvider>
                ) : activePage === "managedSiteChannels" ||
                  activePage === "managedSiteModelSync" ? (
                  <WebDialogInlineProvider>
                    <ManagedSitesDashboard
                      mode={
                        activePage === "managedSiteChannels"
                          ? "channels"
                          : "sync"
                      }
                      busy={busy}
                      connections={managedSites}
                      channels={managedChannels}
                      onClose={() => navigateToPage("overview")}
                      onLoadChannels={onLoadManagedChannels}
                      onDeleteChannel={onDeleteManagedChannel}
                      onCreateChannel={onCreateManagedChannel}
                      onSyncModels={onSyncManagedSiteModels}
                    />
                  </WebDialogInlineProvider>
                ) : activePage === "importExport" ? (
                  <ImportExportPage
                    busy={busy}
                    onExportBackup={onExportBackup}
                    onExportAccounts={onExportAccounts}
                    onImportAccounts={onImportAccounts}
                    onRestoreBackup={onRestoreBackup}
                    webDavSettings={webDavSettings}
                    onSaveWebDavSettings={onSaveWebDavSettings}
                    onTestWebDav={onTestWebDav}
                    onUploadWebDav={onUploadWebDavBackup}
                    onRestoreWebDav={onRestoreWebDavBackup}
                  />
                ) : activePage === "about" ? (
                  <AboutPage />
                ) : (
                  <WebDialogInlineProvider>
                    {activePage === "usageAnalytics" ? (
                      <UsageAnalyticsDialog
                        open
                        busy={busy}
                        accounts={data.accounts}
                        analytics={usageAnalytics}
                        onClose={() => navigateToPage("overview")}
                        onRefresh={onLoadUsageAnalytics}
                      />
                    ) : activePage === "siteAnnouncements" ? (
                      <SiteAnnouncementsDialog
                        open
                        busy={busy}
                        announcements={siteAnnouncements}
                        onClose={() => navigateToPage("overview")}
                        onSync={onSyncSiteAnnouncements}
                        onMarkRead={onMarkSiteAnnouncementRead}
                        onMarkAllRead={onMarkSiteAnnouncementsRead}
                      />
                    ) : activePage === "models" ? (
                      <AllModelCatalogDialog
                        open
                        busy={busy}
                        catalog={allModelCatalog}
                        profiles={credentialProfiles?.profiles ?? []}
                        onClose={() => navigateToPage("overview")}
                        onRefresh={onLoadAllModels}
                        onLoadProfileModels={onLoadCredentialProfileModels}
                        onVerifyProfile={onVerifyCredentialProfile}
                        onOpenAccountKeys={(accountId) => {
                          const account = data.accounts.find(
                            (item) => item.id === accountId,
                          )
                          if (!account) return
                          void (async () => {
                            await onLoadKeys(account)
                            navigateToPage("keys")
                          })()
                        }}
                      />
                    ) : activePage === "automation" ? (
                      <AutomationSettingsDialog
                        open
                        busy={busy}
                        automation={automation}
                        title="自动签到"
                        onClose={() => navigateToPage("overview")}
                        onSave={onSaveAutomation}
                        onRun={onRunCheckIn}
                      />
                    ) : activePage === "runtimeCapabilities" ? (
                      <RuntimeCapabilitiesDialog
                        open
                        capabilities={runtimeCapabilities}
                        onClose={() => navigateToPage("overview")}
                      />
                    ) : activePage === "externalNotifications" ? (
                      <ExternalNotificationSettingsDialog
                        open
                        busy={busy}
                        settings={externalNotifications}
                        onClose={() => navigateToPage("overview")}
                        onSave={onSaveExternalNotifications}
                        onTest={onTestExternalNotification}
                      />
                    ) : activePage === "credentialProfiles" ? (
                      <CredentialProfilesDialog
                        open
                        busy={busy}
                        profiles={credentialProfiles}
                        tags={tags.tags}
                        onClose={() => navigateToPage("overview")}
                        onCreate={onCreateCredentialProfile}
                        onUpdate={onUpdateCredentialProfile}
                        onDelete={onDeleteCredentialProfile}
                        onExport={onExportCredentialProfile}
                        onLoadModels={onLoadCredentialProfileModels}
                        onVerify={onVerifyCredentialProfile}
                      />
                    ) : activePage === "apiCheck" ? (
                      <WebApiCheckDialog
                        open
                        busy={busy}
                        onClose={() => navigateToPage("overview")}
                        onFetchModels={onFetchVerificationModels}
                        onRunVerification={onRunVerification}
                        onSaveProfile={onCreateCredentialProfile}
                      />
                    ) : (
                      <PreferencesDialog
                        open
                        busy={busy}
                        settings={preferences}
                        onClose={() => navigateToPage("overview")}
                        onSave={onSavePreferences}
                      />
                    )}
                  </WebDialogInlineProvider>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      <AccountFormDialog
        open={addOpen}
        loading={busy}
        revision={data.revision}
        tags={tags.tags}
        onClose={() => setAddOpen(false)}
        onCreate={onCreate}
        onDetect={onDetectAccount}
      />
      <AccountFormDialog
        open={editTarget !== null}
        loading={busy}
        revision={data.revision}
        account={editTarget}
        tags={tags.tags}
        onClose={() => setEditTarget(null)}
        onUpdate={onUpdate}
      />

      <TagsDialog
        open={tagsOpen}
        loading={busy}
        data={tags}
        onClose={() => setTagsOpen(false)}
        onCreate={onCreateTag}
        onRename={onRenameTag}
        onDelete={onDeleteTag}
      />

      <SiteAnnouncementsDialog
        open={siteAnnouncementsOpen}
        busy={busy}
        announcements={siteAnnouncements}
        onClose={() => setSiteAnnouncementsOpen(false)}
        onSync={onSyncSiteAnnouncements}
        onMarkRead={onMarkSiteAnnouncementRead}
        onMarkAllRead={onMarkSiteAnnouncementsRead}
      />

      <AutomationSettingsDialog
        open={automationOpen}
        busy={busy}
        automation={automation}
        onClose={() => setAutomationOpen(false)}
        onSave={onSaveAutomation}
      />
      <BalanceHistoryDialog
        open={historyOpen}
        history={history}
        onClose={() => setHistoryOpen(false)}
        onRefresh={onLoadHistory}
      />
      <UsageHistoryDialog
        open={usageHistoryOpen}
        busy={busy}
        history={usageHistory}
        onClose={() => setUsageHistoryOpen(false)}
        onSync={onSyncUsageHistory}
      />
      <UsageAnalyticsDialog
        open={usageAnalyticsOpen}
        busy={busy}
        accounts={data.accounts}
        analytics={usageAnalytics}
        onClose={() => setUsageAnalyticsOpen(false)}
        onRefresh={onLoadUsageAnalytics}
      />
      <NotificationCenterDialog
        open={notificationsOpen}
        notifications={notifications}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllRead={onMarkNotificationsRead}
      />
      <RuntimeCapabilitiesDialog
        open={runtimeCapabilitiesOpen}
        capabilities={runtimeCapabilities}
        onClose={() => setRuntimeCapabilitiesOpen(false)}
      />
      <ModelCatalogDialog
        open={modelsOpen}
        catalog={modelCatalog}
        onClose={() => setModelsOpen(false)}
      />
      <AllModelCatalogDialog
        open={allModelsOpen}
        busy={busy}
        catalog={allModelCatalog}
        profiles={credentialProfiles?.profiles ?? []}
        onClose={() => setAllModelsOpen(false)}
        onRefresh={onLoadAllModels}
        onLoadProfileModels={onLoadCredentialProfileModels}
        onVerifyProfile={onVerifyCredentialProfile}
        onOpenAccountKeys={(accountId) => {
          const account = data.accounts.find((item) => item.id === accountId)
          if (!account) return
          void (async () => {
            await onLoadKeys(account)
            setAllModelsOpen(false)
            setKeysOpen(true)
          })()
        }}
      />
      <KeyManagementDialog
        open={keysOpen}
        busy={busy}
        keys={apiKeys}
        createdSecret={createdKeySecret}
        accounts={data.accounts}
        onClose={() => setKeysOpen(false)}
        onCreate={onCreateKey}
        onDelete={onDeleteKey}
        onUpdate={onUpdateKey}
        onSelectAccount={onLoadKeys}
        onRefresh={async () => {
          const account = data.accounts.find(
            (item) => item.id === apiKeys?.accountId,
          )
          if (account) await onLoadKeys(account)
        }}
      />
      <CredentialProfilesDialog
        open={credentialProfilesOpen}
        busy={busy}
        profiles={credentialProfiles}
        tags={tags.tags}
        onClose={() => setCredentialProfilesOpen(false)}
        onCreate={onCreateCredentialProfile}
        onUpdate={onUpdateCredentialProfile}
        onDelete={onDeleteCredentialProfile}
        onExport={onExportCredentialProfile}
        onLoadModels={onLoadCredentialProfileModels}
        onVerify={onVerifyCredentialProfile}
      />
      <WebApiCheckDialog
        open={apiCheckOpen}
        busy={busy}
        onClose={() => setApiCheckOpen(false)}
        onFetchModels={onFetchVerificationModels}
        onRunVerification={onRunVerification}
        onSaveProfile={onCreateCredentialProfile}
      />
      <ManagedSitesDialog
        open={managedSitesOpen}
        busy={busy}
        connections={managedSites}
        channels={managedChannels}
        onClose={() => setManagedSitesOpen(false)}
        onCreate={onCreateManagedSite}
        onDeleteConnection={onDeleteManagedSite}
        onLoadChannels={onLoadManagedChannels}
        onDeleteChannel={onDeleteManagedChannel}
        onCreateChannel={onCreateManagedChannel}
        onUpdateChannel={onUpdateManagedChannel}
        onSyncModels={onSyncManagedSiteModels}
        channelConfigs={channelConfigs}
        onUpdateChannelConfig={onUpdateChannelConfig}
      />
      <WebDavSettingsDialog
        open={webDavOpen}
        busy={busy}
        settings={webDavSettings}
        onClose={() => setWebDavOpen(false)}
        onSave={onSaveWebDavSettings}
        onTest={onTestWebDav}
        onUpload={onUploadWebDavBackup}
        onRestore={onRestoreWebDavBackup}
      />
      <ExternalNotificationSettingsDialog
        open={externalNotificationsOpen}
        busy={busy}
        settings={externalNotifications}
        onClose={() => setExternalNotificationsOpen(false)}
        onSave={onSaveExternalNotifications}
        onTest={onTestExternalNotification}
      />
      <PreferencesDialog
        open={preferencesOpen}
        busy={busy}
        settings={preferences}
        onClose={() => setPreferencesOpen(false)}
        onSave={onSavePreferences}
      />

      <WebDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title="批量删除账户"
        description={`将删除选中的 ${selectedAccountIds.length} 个账户及其本地凭据。`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(false)}
              className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy || selectedAccountIds.length === 0}
              onClick={async () => {
                if (await runBulkAction("delete")) setBulkDeleteOpen(false)
              }}
              className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              确认批量删除
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          此操作会为每个账户写入删除记录，防止后续同步恢复。已有导出备份不会自动删除。
        </p>
      </WebDialog>

      <WebDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="删除账户"
        description={
          deleteTarget
            ? `将删除“${deleteTarget.name}”及其本地凭据。`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy || !deleteTarget}
              onClick={async () => {
                if (!deleteTarget) return
                await onDelete(deleteTarget)
                setDeleteTarget(null)
              }}
              className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              确认删除
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          此操作会写入删除记录，防止后续同步恢复已删除账户。已有导出备份不会自动删除。
        </p>
      </WebDialog>
    </div>
  )
}

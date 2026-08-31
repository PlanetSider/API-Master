import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bell,
  Bookmark,
  Boxes,
  CalendarCheck2,
  ChartNoAxesCombined,
  CircleDollarSign,
  Cloud,
  Database,
  Download,
  Globe2,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Pin,
  Plus,
  Power,
  RefreshCw,
  Search,
  ServerCog,
  Settings2,
  ShieldCheck,
  Tags,
  TimerReset,
  Trash2,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Checkbox } from "~/components/ui"
import { SiteHealthStatus } from "~/types"
import type {
  WebAccountBulkAction,
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
  WebBalanceHistoryResponse,
  WebBookmarkCreateInput,
  WebBookmarkListResponse,
  WebBookmarkPatchInput,
  WebBookmarkSummary,
  WebChannelConfigPatch,
  WebChannelConfigResponse,
  WebCreateAccountInput,
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
  WebCredentialExportFormat,
} from "~/web/contracts"

import { AccountFormDialog } from "./AccountFormDialog"
import { AllModelCatalogDialog } from "./AllModelCatalogDialog"
import { AutomationSettingsDialog } from "./AutomationSettingsDialog"
import { BalanceHistoryDialog } from "./BalanceHistoryDialog"
import { BookmarksDialog } from "./BookmarksDialog"
import { CredentialProfilesDialog } from "./CredentialProfilesDialog"
import { ExternalNotificationSettingsDialog } from "./ExternalNotificationSettingsDialog"
import { KeyManagementDialog } from "./KeyManagementDialog"
import { ManagedSitesDialog } from "./ManagedSitesDialog"
import { ModelCatalogDialog } from "./ModelCatalogDialog"
import { NotificationCenterDialog } from "./NotificationCenterDialog"
import { PreferencesDialog } from "./PreferencesDialog"
import { RuntimeCapabilitiesDialog } from "./RuntimeCapabilitiesDialog"
import { SiteAnnouncementsDialog } from "./SiteAnnouncementsDialog"
import { TagsDialog } from "./TagsDialog"
import { UsageAnalyticsDialog } from "./UsageAnalyticsDialog"
import { UsageHistoryDialog } from "./UsageHistoryDialog"
import { WebDavSettingsDialog } from "./WebDavSettingsDialog"
import { WebDialog } from "./WebDialog"
import { WebApiCheckDialog } from "./WebApiCheckDialog"

interface AccountDashboardProps {
  data: WebAccountListResponse
  tags: WebTagListResponse
  bookmarks: WebBookmarkListResponse
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
  onDetectAccount?: (
    input: WebAccountDetectionInput,
  ) => Promise<WebAccountDetectionResponse>
  onUpdate: (accountId: string, input: WebAccountPatchInput) => Promise<void>
  onLoadBookmarks: () => Promise<void>
  onLoadSiteAnnouncements: () => Promise<void>
  onSyncSiteAnnouncements: () => Promise<void>
  onMarkSiteAnnouncementRead: (recordId: string) => Promise<void>
  onMarkSiteAnnouncementsRead: (siteKey?: string) => Promise<void>
  onCreateBookmark: (input: WebBookmarkCreateInput) => Promise<void>
  onUpdateBookmark: (id: string, input: WebBookmarkPatchInput) => Promise<void>
  onDeleteBookmark: (bookmark: WebBookmarkSummary) => Promise<void>
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
  onLoadExternalNotifications: () => Promise<void>
  onSaveExternalNotifications: (
    input: WebExternalNotificationSettingsInput,
  ) => Promise<void>
  onTestExternalNotification: (
    channel: WebExternalNotificationChannel,
  ) => Promise<void>
  onDelete: (account: WebAccountSummary) => Promise<void>
  onImport: (file: File) => Promise<void>
  onExport: () => Promise<void>
  onLogout: () => Promise<void>
}

const formatMoney = (value: number, currency: WebCurrencyType = "USD") =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const formatTime = (value: number) =>
  value > 0
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "尚未同步"

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

export function AccountDashboard({
  data,
  tags,
  bookmarks,
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
  onDetectAccount,
  onUpdate,
  onLoadBookmarks,
  onLoadSiteAnnouncements,
  onSyncSiteAnnouncements,
  onMarkSiteAnnouncementRead,
  onMarkSiteAnnouncementsRead,
  onCreateBookmark,
  onUpdateBookmark,
  onDeleteBookmark,
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
  onLoadUsageHistory,
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
  onLoadExternalNotifications,
  onSaveExternalNotifications,
  onTestExternalNotification,
  onDelete,
  onImport,
  onExport,
  onLogout,
}: AccountDashboardProps) {
  const [search, setSearch] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
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
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WebAccountSummary | null>(
    null,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tagNameById = useMemo(
    () => new Map(tags.tags.map((tag) => [tag.id, tag.name])),
    [tags.tags],
  )

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    const matching = !query
      ? data.accounts
      : data.accounts.filter((account) => {
          const tagNames = account.tagIds.flatMap((id) => {
            const name = tagNameById.get(id)
            return name ? [name] : []
          })
          return [
            account.name,
            account.baseUrl,
            account.siteType,
            account.username,
            ...tagNames,
          ].some((value) => value.toLocaleLowerCase().includes(query))
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
  }, [data.accounts, preferences, search, tagNameById])

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
    active?: boolean
    badge?: number
    onClick: () => void | Promise<void>
  }> = [
    {
      label: "账户总览",
      icon: LayoutDashboard,
      active: true,
      onClick: () => setMobileNavOpen(false),
    },
    {
      label: "书签",
      icon: Bookmark,
      badge: bookmarks.bookmarks.length,
      onClick: async () => {
        await onLoadBookmarks()
        setBookmarksOpen(true)
        setMobileNavOpen(false)
      },
    },
    {
      label: "用量分析",
      icon: ChartNoAxesCombined,
      onClick: async () => {
        await onLoadUsageAnalytics()
        setUsageAnalyticsOpen(true)
        setMobileNavOpen(false)
      },
    },
    {
      label: "网站公告",
      icon: Bell,
      badge: siteAnnouncements.unreadCount,
      onClick: async () => {
        await onLoadSiteAnnouncements()
        setSiteAnnouncementsOpen(true)
        setMobileNavOpen(false)
      },
    },
    {
      label: "数据迁移",
      icon: Database,
      onClick: () => {
        fileInputRef.current?.click()
        setMobileNavOpen(false)
      },
    },
    {
      label: "模型总览",
      icon: Boxes,
      onClick: async () => {
        await onLoadAllModels()
        setAllModelsOpen(true)
        setMobileNavOpen(false)
      },
    },
    {
      label: "自动刷新",
      icon: TimerReset,
      onClick: () => {
        setAutomationOpen(true)
        setMobileNavOpen(false)
      },
    },
    {
      label: "运行能力",
      icon: Activity,
      onClick: async () => {
        await onLoadRuntimeCapabilities()
        setRuntimeCapabilitiesOpen(true)
        setMobileNavOpen(false)
      },
    },
    {
      label: "外部通知",
      icon: Bell,
      onClick: async () => {
        await onLoadExternalNotifications()
        setExternalNotificationsOpen(true)
        setMobileNavOpen(false)
      },
    },
    {
      label: "API 凭据库",
      icon: KeyRound,
      onClick: async () => {
        await onLoadCredentialProfiles()
        setCredentialProfilesOpen(true)
        setMobileNavOpen(false)
      },
    },
    {
      label: "API 检测",
      icon: ShieldCheck,
      onClick: () => {
        setApiCheckOpen(true)
        setMobileNavOpen(false)
      },
    },
    {
      label: "显示偏好",
      icon: Settings2,
      onClick: async () => {
        await onLoadPreferences()
        setPreferencesOpen(true)
        setMobileNavOpen(false)
      },
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950 dark:bg-gray-950 dark:text-gray-100">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-gray-200 bg-white lg:flex lg:flex-col dark:border-gray-800 dark:bg-gray-900">
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5 dark:border-gray-800">
          <div className="flex size-9 items-center justify-center rounded-md bg-blue-600 text-white">
            <Globe2 className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">All API Hub</div>
            <div className="text-xs text-gray-500">Web Console</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="主导航">
          {navigationItems.map(
            ({ label, icon: Icon, active, badge, onClick }) => (
              <button
                key={label}
                onClick={() => void onClick()}
                className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm ${
                  active
                    ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="size-4" />
                {label}
                {badge ? (
                  <span className="ml-auto text-xs text-gray-400">{badge}</span>
                ) : null}
              </button>
            ),
          )}
        </nav>
        <div className="border-t border-gray-200 p-3 dark:border-gray-800">
          <button
            onClick={() => void onLogout()}
            className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <LogOut className="size-4" />
            退出登录
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="打开主导航"
              title="打开主导航"
              onClick={() => setMobileNavOpen(true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 lg:hidden dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Menu className="size-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-semibold sm:text-lg">账户总览</h1>
              <p className="text-xs text-gray-500 sm:text-sm">
                集中管理站点账户和加密凭据
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="通知中心"
              title="通知中心"
              onClick={async () => {
                await onLoadNotifications()
                setNotificationsOpen(true)
              }}
              className="relative flex size-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Bell className="size-4" />
              {notifications?.unreadCount ? (
                <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-red-600 px-1 text-[10px] leading-4 text-white">
                  {Math.min(99, notifications.unreadCount)}
                </span>
              ) : null}
            </button>
            <button
              aria-label="退出登录"
              title="退出登录"
              onClick={() => void onLogout()}
              className="flex size-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 lg:hidden dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="关闭主导航"
              className="absolute inset-0 h-full w-full bg-black/30"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside
              aria-label="移动端主导航"
              className="relative flex h-full w-[min(20rem,88vw)] flex-col border-r border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-blue-600 text-white">
                    <Globe2 className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">All API Hub</div>
                    <div className="text-xs text-gray-500">Web 管理系统</div>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="关闭主导航"
                  title="关闭主导航"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex size-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <X className="size-4" />
                </button>
              </div>
              <nav
                className="flex-1 space-y-1 overflow-y-auto p-3"
                aria-label="移动端主导航"
              >
                {navigationItems.map(
                  ({ label, icon: Icon, active, badge, onClick }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => void onClick()}
                      className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm ${
                        active
                          ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                          : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                    >
                      <Icon className="size-4" />
                      {label}
                      {badge ? (
                        <span className="ml-auto text-xs text-gray-400">
                          {badge}
                        </span>
                      ) : null}
                    </button>
                  ),
                )}
              </nav>
              <div className="border-t border-gray-200 p-3 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false)
                    void onLogout()
                  }}
                  className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <LogOut className="size-4" />
                  退出登录
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        <main className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6">
          <section className="grid grid-cols-2 border-y border-gray-200 bg-white sm:grid-cols-4 dark:border-gray-800 dark:bg-gray-900">
            {[
              {
                label: "总余额",
                value: formatMoney(
                  totalBalance,
                  preferences?.preferences.currencyType ?? "USD",
                ),
                icon: CircleDollarSign,
              },
              {
                label: "账户",
                value: String(data.accounts.length),
                icon: Users,
              },
              {
                label: "启用",
                value: String(activeAccounts.length),
                icon: Power,
              },
              {
                label: "健康",
                value: String(healthyAccounts),
                icon: ShieldCheck,
              },
            ].map(({ label, value, icon: Icon }, index) => (
              <div
                key={label}
                className={`flex min-h-24 items-center gap-3 px-4 py-4 ${
                  index % 2 === 0 ? "border-r" : ""
                } ${index < 2 ? "border-b sm:border-b-0" : ""} border-gray-200 sm:border-r sm:last:border-r-0 dark:border-gray-800`}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="mt-1 truncate text-lg font-semibold tabular-nums">
                    {value}
                  </div>
                </div>
              </div>
            ))}
          </section>

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
            <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:flex-row md:items-center md:justify-between dark:border-gray-800">
              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索名称、站点或类型"
                  className="h-9 w-full rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (file) setPendingImport(file)
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onLoadBookmarks()
                    setBookmarksOpen(true)
                  }}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Bookmark className="size-4" />
                  书签
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setTagsOpen(true)}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Tags className="size-4" />
                  标签
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onLoadUsageAnalytics()
                    setUsageAnalyticsOpen(true)
                  }}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <ChartNoAxesCombined className="size-4" />
                  用量分析
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onLoadSiteAnnouncements()
                    setSiteAnnouncementsOpen(true)
                  }}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Bell className="size-4" />
                  网站公告
                  {siteAnnouncements.unreadCount > 0 ? (
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[11px] text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      {siteAnnouncements.unreadCount}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onLoadAllModels()
                    setAllModelsOpen(true)
                  }}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Boxes className="size-4" />
                  模型总览
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onLoadManagedSites()
                    setManagedSitesOpen(true)
                  }}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <ServerCog className="size-4" />
                  托管站点
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onLoadWebDavSettings()
                    setWebDavOpen(true)
                  }}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Cloud className="size-4" />
                  WebDAV
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onLoadUsageHistory()
                    setUsageHistoryOpen(true)
                  }}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <ChartNoAxesCombined className="size-4" />
                  用量历史
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onLoadHistory()
                    setHistoryOpen(true)
                  }}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <History className="size-4" />
                  余额历史
                </button>
                <button
                  type="button"
                  disabled={busy || data.accounts.length === 0}
                  onClick={() => void onRunCheckIn()}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <CalendarCheck2 className="size-4" />
                  签到全部
                </button>
                <button
                  type="button"
                  disabled={busy || !automation}
                  onClick={() => setAutomationOpen(true)}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <TimerReset className="size-4" />
                  自动化
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onLoadRuntimeCapabilities()
                    setRuntimeCapabilitiesOpen(true)
                  }}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Activity className="size-4" />
                  运行能力
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onLoadExternalNotifications()
                    setExternalNotificationsOpen(true)
                  }}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Bell className="size-4" />
                  外部通知
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onLoadCredentialProfiles()
                    setCredentialProfilesOpen(true)
                  }}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <KeyRound className="size-4" />
                  API 凭据库
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setApiCheckOpen(true)}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <ShieldCheck className="size-4" />
                  API 检测
                </button>
                <button
                  type="button"
                  disabled={busy || data.accounts.length === 0}
                  onClick={() => void onRefreshAll()}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <RefreshCw className="size-4" />
                  刷新全部
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Upload className="size-4" />
                  导入
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onExport()}
                  className="flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Download className="size-4" />
                  导出
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAddOpen(true)}
                  className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Plus className="size-4" />
                  添加账户
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
                  {data.accounts.length === 0 ? "暂无账户" : "没有匹配的账户"}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {data.accounts.length === 0
                    ? "添加账户或导入扩展备份以开始管理。"
                    : "尝试调整搜索条件。"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-950/60">
                    <tr>
                      <th className="w-12 px-4 py-3 font-medium">
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
                      </th>
                      <th className="px-4 py-3 font-medium">账户</th>
                      <th className="px-4 py-3 font-medium">类型</th>
                      <th className="px-4 py-3 font-medium">余额</th>
                      <th className="px-4 py-3 font-medium">今日消费</th>
                      {preferences?.preferences.showHealthStatus !== false ? (
                        <th className="px-4 py-3 font-medium">状态</th>
                      ) : null}
                      <th className="px-4 py-3 font-medium">最后同步</th>
                      <th className="px-4 py-3 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {filteredAccounts.map((account) => {
                      const health = getHealthPresentation(account)
                      const accountIndex = data.accounts.findIndex(
                        (item) => item.id === account.id,
                      )
                      const previousAccount = data.accounts[accountIndex - 1]
                      const nextAccount = data.accounts[accountIndex + 1]
                      return (
                        <tr
                          key={account.id}
                          className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              aria-label={`选择账户 ${account.name}`}
                              checked={selectedIdSet.has(account.id)}
                              disabled={busy}
                              onCheckedChange={(checked) =>
                                setAccountSelected(account.id, checked === true)
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{account.name}</div>
                            <div className="mt-0.5 max-w-64 truncate text-xs text-gray-500">
                              {account.baseUrl}
                            </div>
                            {account.tagIds.length > 0 ? (
                              <div className="mt-1.5 flex max-w-64 flex-wrap gap-1">
                                {account.tagIds.flatMap((tagId) => {
                                  const tagName = tagNameById.get(tagId)
                                  return tagName ? (
                                    <span
                                      key={tagId}
                                      className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                    >
                                      {tagName}
                                    </span>
                                  ) : (
                                    []
                                  )
                                })}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div>{account.siteType}</div>
                            <div className="text-xs text-gray-500">
                              {account.authType}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium tabular-nums">
                            {formatMoney(
                              account.balance[
                                preferences?.preferences.currencyType ?? "USD"
                              ],
                              preferences?.preferences.currencyType ?? "USD",
                            )}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {preferences?.preferences.showTodayCashflow !==
                            false
                              ? formatMoney(
                                  account.todayConsumption[
                                    preferences?.preferences.currencyType ??
                                      "USD"
                                  ],
                                  preferences?.preferences.currencyType ??
                                    "USD",
                                )
                              : "已隐藏"}
                          </td>
                          {preferences?.preferences.showHealthStatus !==
                          false ? (
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${health.className}`}
                              >
                                {health.label}
                              </span>
                            </td>
                          ) : null}
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {formatTime(account.lastSyncTime)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                disabled={busy}
                                aria-label={
                                  account.pinned ? "取消置顶账户" : "置顶账户"
                                }
                                title={
                                  account.pinned ? "取消置顶账户" : "置顶账户"
                                }
                                onClick={() => void onTogglePinned(account)}
                                className={`flex size-8 items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800 ${account.pinned ? "text-blue-600" : "text-gray-500"}`}
                              >
                                <Pin
                                  className={`size-4 ${account.pinned ? "fill-current" : ""}`}
                                />
                              </button>
                              <button
                                type="button"
                                disabled={
                                  busy ||
                                  !previousAccount ||
                                  previousAccount.pinned !== account.pinned
                                }
                                aria-label={`上移账户 ${account.name}`}
                                title="上移账户"
                                onClick={() => moveAccount(account.id, -1)}
                                className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-white"
                              >
                                <ArrowUp className="size-4" />
                              </button>
                              <button
                                type="button"
                                disabled={
                                  busy ||
                                  !nextAccount ||
                                  nextAccount.pinned !== account.pinned
                                }
                                aria-label={`下移账户 ${account.name}`}
                                title="下移账户"
                                onClick={() => moveAccount(account.id, 1)}
                                className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-white"
                              >
                                <ArrowDown className="size-4" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                aria-label="编辑账户"
                                title="编辑账户"
                                onClick={() => setEditTarget(account)}
                                className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-white"
                              >
                                <Pencil className="size-4" />
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
                                className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-white"
                              >
                                <KeyRound className="size-4" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                aria-label="查看模型"
                                title="查看模型"
                                onClick={async () => {
                                  await onLoadModels(account)
                                  setModelsOpen(true)
                                }}
                                className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-white"
                              >
                                <Boxes className="size-4" />
                              </button>
                              <button
                                type="button"
                                disabled={busy || account.disabled}
                                aria-label="刷新账户"
                                title="刷新账户"
                                onClick={() => void onRefresh(account)}
                                className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-white"
                              >
                                <RefreshCw className="size-4" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                aria-label={
                                  account.disabled ? "启用账户" : "停用账户"
                                }
                                title={
                                  account.disabled ? "启用账户" : "停用账户"
                                }
                                onClick={() => void onToggleDisabled(account)}
                                className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-white"
                              >
                                <Power className="size-4" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                aria-label="删除账户"
                                title="删除账户"
                                onClick={() => setDeleteTarget(account)}
                                className="flex size-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
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

      <BookmarksDialog
        open={bookmarksOpen}
        busy={busy}
        bookmarks={bookmarks}
        tags={tags.tags}
        onClose={() => setBookmarksOpen(false)}
        onCreate={onCreateBookmark}
        onUpdate={onUpdateBookmark}
        onDelete={onDeleteBookmark}
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
        onClose={() => setAllModelsOpen(false)}
        onRefresh={onLoadAllModels}
      />
      <KeyManagementDialog
        open={keysOpen}
        busy={busy}
        keys={apiKeys}
        createdSecret={createdKeySecret}
        onClose={() => setKeysOpen(false)}
        onCreate={onCreateKey}
        onDelete={onDeleteKey}
        onUpdate={onUpdateKey}
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
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="恢复备份"
        description={pendingImport?.name}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingImport(null)}
              className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy || !pendingImport}
              onClick={async () => {
                if (!pendingImport) return
                await onImport(pendingImport)
                setPendingImport(null)
              }}
              className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              确认恢复
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          完整 Web
          备份会替换账户、自动化设置、历史、通知和托管站点连接；扩展备份仅替换账户。恢复前建议先导出当前完整备份。
        </p>
      </WebDialog>

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

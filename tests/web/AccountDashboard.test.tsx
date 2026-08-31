import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"

import { SITE_TYPES } from "~/constants/siteType"
import { AuthTypeEnum, SiteHealthStatus } from "~/types"
import type { WebAccountSummary } from "~/web/contracts"
import { AccountDashboard } from "~~/web/components/AccountDashboard"

const asyncHandler = () => vi.fn().mockResolvedValue(undefined)

const createAccount = (
  id: string,
  name: string,
  disabled = false,
): WebAccountSummary => ({
  id,
  name,
  baseUrl: `https://${id}.example.com`,
  siteType: SITE_TYPES.NEW_API,
  authType: AuthTypeEnum.AccessToken,
  username: name.toLowerCase(),
  userId: id,
  disabled,
  pinned: false,
  tagIds: [],
  notes: "",
  health: { status: SiteHealthStatus.Unknown },
  balance: { USD: 0, CNY: 0 },
  todayConsumption: { USD: 0, CNY: 0 },
  lastSyncTime: 0,
  createdAt: 0,
  exchangeRate: 7,
})

const createProps = (): ComponentProps<typeof AccountDashboard> => ({
  data: { accounts: [], revision: 0, lastUpdated: 0 },
  tags: { tags: [], revision: 0 },
  siteAnnouncements: {
    records: [],
    sites: [],
    unreadCount: 0,
    revision: 0,
    lastUpdated: 0,
  },
  automation: null,
  history: null,
  usageHistory: null,
  usageAnalytics: null,
  notifications: null,
  runtimeCapabilities: null,
  modelCatalog: null,
  allModelCatalog: null,
  apiKeys: null,
  createdKeySecret: null,
  managedSites: null,
  managedChannels: null,
  webDavSettings: null,
  externalNotifications: null,
  busy: false,
  message: null,
  onCreate: asyncHandler(),
  onUpdate: asyncHandler(),
  onLoadSiteAnnouncements: asyncHandler(),
  onSyncSiteAnnouncements: asyncHandler(),
  onMarkSiteAnnouncementRead: asyncHandler(),
  onMarkSiteAnnouncementsRead: asyncHandler(),
  onCreateTag: asyncHandler(),
  onRenameTag: asyncHandler(),
  onDeleteTag: asyncHandler(),
  onToggleDisabled: asyncHandler(),
  onBulkAction: asyncHandler(),
  onTogglePinned: asyncHandler(),
  onReorder: asyncHandler(),
  onRefresh: asyncHandler(),
  onRefreshAll: asyncHandler(),
  onRunCheckIn: asyncHandler(),
  onSaveAutomation: asyncHandler(),
  onLoadHistory: asyncHandler(),
  onLoadUsageHistory: asyncHandler(),
  onLoadUsageAnalytics: asyncHandler(),
  onSyncUsageHistory: asyncHandler(),
  onLoadNotifications: asyncHandler(),
  onLoadRuntimeCapabilities: asyncHandler(),
  onMarkNotificationsRead: asyncHandler(),
  onLoadModels: asyncHandler(),
  onLoadAllModels: asyncHandler(),
  onLoadKeys: asyncHandler(),
  onCreateKey: asyncHandler(),
  onDeleteKey: asyncHandler(),
  onUpdateKey: asyncHandler(),
  onExportCredentialProfile: asyncHandler(),
  onFetchVerificationModels: async () => ({ modelIds: [] }),
  onRunVerification: async () => ({
    report: {
      baseUrl: "https://example.com",
      apiType: "openai-compatible",
      startedAt: 0,
      finishedAt: 0,
      results: [],
    },
  }),
  onLoadManagedSites: asyncHandler(),
  onCreateManagedSite: asyncHandler(),
  onDeleteManagedSite: asyncHandler(),
  onLoadManagedChannels: asyncHandler(),
  onDeleteManagedChannel: asyncHandler(),
  onCreateManagedChannel: asyncHandler(),
  onUpdateManagedChannel: asyncHandler(),
  onSyncManagedSiteModels: async () => ({
    connection: {
      id: "",
      name: "",
      siteType: "new-api",
      baseUrl: "https://example.com",
      userId: "",
      createdAt: 0,
    },
    startedAt: 0,
    finishedAt: 0,
    items: [],
    summary: { total: 0, succeeded: 0, failed: 0, changed: 0 },
  }),
  onLoadWebDavSettings: asyncHandler(),
  onSaveWebDavSettings: asyncHandler(),
  onTestWebDav: asyncHandler(),
  onUploadWebDavBackup: asyncHandler(),
  onRestoreWebDavBackup: asyncHandler(),
  onLoadExternalNotifications: asyncHandler(),
  onSaveExternalNotifications: asyncHandler(),
  onTestExternalNotification: asyncHandler(),
  onDelete: asyncHandler(),
  onLogout: asyncHandler(),
})

const openAccountManagement = async (
  user: ReturnType<typeof userEvent.setup>,
) => {
  await user.click(screen.getByRole("button", { name: "账户管理" }))
}

beforeEach(() => {
  window.history.replaceState(null, "", "#overview")
})

describe("AccountDashboard bulk account management", () => {
  it("selects the filtered accounts and applies a bulk status action", async () => {
    const user = userEvent.setup()
    const props = createProps()
    props.data = {
      accounts: [
        createAccount("alpha", "Alpha"),
        createAccount("beta", "Beta"),
      ],
      revision: 2,
      lastUpdated: 0,
    }
    render(<AccountDashboard {...props} />)
    await openAccountManagement(user)

    await user.type(
      screen.getByPlaceholderText("搜索名称、站点或类型"),
      "Alpha",
    )
    await user.click(screen.getByRole("checkbox", { name: "全选筛选结果" }))
    await user.click(screen.getByRole("button", { name: "批量停用" }))

    expect(props.onBulkAction).toHaveBeenCalledWith(["alpha"], "disable")
    expect(screen.queryByText("已选择 1 个账户")).not.toBeInTheDocument()
  })

  it("pins accounts and reorders entries within the same pin group", async () => {
    const user = userEvent.setup()
    const props = createProps()
    props.data = {
      accounts: [
        createAccount("alpha", "Alpha"),
        createAccount("beta", "Beta"),
      ],
      revision: 2,
      lastUpdated: 0,
    }
    render(<AccountDashboard {...props} />)
    await openAccountManagement(user)

    await user.click(screen.getAllByRole("button", { name: "置顶账户" })[0])
    expect(props.onTogglePinned).toHaveBeenCalledWith(
      expect.objectContaining({ id: "alpha" }),
    )

    await user.click(screen.getByRole("button", { name: "下移账户 Alpha" }))
    expect(props.onReorder).toHaveBeenCalledWith(["beta", "alpha"])
  })

  it("requires confirmation before deleting selected accounts", async () => {
    const user = userEvent.setup()
    const props = createProps()
    props.data = {
      accounts: [createAccount("alpha", "Alpha")],
      revision: 1,
      lastUpdated: 0,
    }
    render(<AccountDashboard {...props} />)
    await openAccountManagement(user)

    await user.click(screen.getByRole("checkbox", { name: "选择账户 Alpha" }))
    await user.click(screen.getByRole("button", { name: "批量删除" }))

    expect(
      screen.getByRole("dialog", { name: "批量删除账户" }),
    ).toBeInTheDocument()
    expect(props.onBulkAction).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "确认批量删除" }))
    expect(props.onBulkAction).toHaveBeenCalledWith(["alpha"], "delete")
  })
})

describe("AccountDashboard mobile navigation", () => {
  it("renders the upstream-style overview as the default page", () => {
    render(<AccountDashboard {...createProps()} />)

    expect(screen.getByTestId("web-options-overview")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "账户总览" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "开始使用" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "配置中心" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("switches sidebar entries into inline pages instead of dialogs", async () => {
    const user = userEvent.setup()
    const props = createProps()
    render(<AccountDashboard {...props} />)

    await user.click(screen.getByRole("button", { name: "自动刷新" }))

    expect(window.location.hash).toBe("#automation")
    expect(
      screen.getByRole("heading", { name: "自动刷新" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("does not expose bookmark or data migration entries", async () => {
    const user = userEvent.setup()
    render(<AccountDashboard {...createProps()} />)

    expect(
      screen.queryByRole("button", { name: "书签" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "数据迁移" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "导入" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "导出" }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "打开主导航" }))
    const navigation = screen.getByRole("navigation", {
      name: "移动端主导航",
    })
    expect(within(navigation).queryByText("书签")).not.toBeInTheDocument()
    expect(within(navigation).queryByText("数据迁移")).not.toBeInTheDocument()
  })

  it("opens every management entry from the compact navigation drawer", async () => {
    const user = userEvent.setup()
    const props = createProps()
    render(<AccountDashboard {...props} />)

    await user.click(screen.getByRole("button", { name: "打开主导航" }))
    const navigation = screen.getByRole("navigation", {
      name: "移动端主导航",
    })
    await user.click(
      within(navigation).getByRole("button", { name: "模型总览" }),
    )

    expect(props.onLoadAllModels).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole("navigation", { name: "移动端主导航" }),
    ).not.toBeInTheDocument()
  })
})

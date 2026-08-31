import { useCallback, useEffect, useState } from "react"

import type {
  WebAccountBulkAction,
  WebAccountDetectionInput,
  WebAccountDetectionResponse,
  WebAccountListResponse,
  WebAccountPatchInput,
  WebAccountSummary,
  WebAllModelCatalogResponse,
  WebApiCredentialProfileCreateInput,
  WebApiCredentialProfileExportResponse,
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
  WebChannelConfigPatch,
  WebChannelConfigResponse,
  WebCreateAccountInput,
  WebCredentialExportFormat,
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

import { webApi, WebApiClientError } from "./api"
import { AccountDashboard } from "./components/AccountDashboard"
import { LoginView } from "./components/LoginView"

type Notice = { kind: "error" | "success"; text: string } | null

const emptyAccountList: WebAccountListResponse = {
  accounts: [],
  revision: 0,
  lastUpdated: 0,
}

const emptySiteAnnouncementList: WebSiteAnnouncementListResponse = {
  records: [],
  sites: [],
  unreadCount: 0,
  revision: 0,
  lastUpdated: 0,
}

const emptyTagList: WebTagListResponse = {
  tags: [],
  revision: 0,
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [accounts, setAccounts] =
    useState<WebAccountListResponse>(emptyAccountList)
  const [tags, setTags] = useState<WebTagListResponse>(emptyTagList)
  const [siteAnnouncements, setSiteAnnouncements] =
    useState<WebSiteAnnouncementListResponse>(emptySiteAnnouncementList)
  const [automation, setAutomation] =
    useState<WebAutomationSettingsResponse | null>(null)
  const [history, setHistory] = useState<WebBalanceHistoryResponse | null>(null)
  const [usageHistory, setUsageHistory] =
    useState<WebUsageHistoryResponse | null>(null)
  const [usageAnalytics, setUsageAnalytics] =
    useState<WebUsageAnalyticsResponse | null>(null)
  const [notifications, setNotifications] =
    useState<WebNotificationListResponse | null>(null)
  const [runtimeCapabilities, setRuntimeCapabilities] =
    useState<WebRuntimeCapabilitiesResponse | null>(null)
  const [modelCatalog, setModelCatalog] =
    useState<WebModelCatalogResponse | null>(null)
  const [allModelCatalog, setAllModelCatalog] =
    useState<WebAllModelCatalogResponse | null>(null)
  const [apiKeys, setApiKeys] = useState<WebApiKeyListResponse | null>(null)
  const [credentialProfiles, setCredentialProfiles] =
    useState<WebApiCredentialProfileListResponse | null>(null)
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null)
  const [managedSites, setManagedSites] =
    useState<WebManagedSiteConnectionListResponse | null>(null)
  const [managedChannels, setManagedChannels] =
    useState<WebManagedChannelListResponse | null>(null)
  const [webDavSettings, setWebDavSettings] =
    useState<WebDavSettingsResponse | null>(null)
  const [externalNotifications, setExternalNotifications] =
    useState<WebExternalNotificationSettingsResponse | null>(null)
  const [preferences, setPreferences] = useState<WebPreferencesResponse | null>(
    null,
  )
  const [channelConfigs, setChannelConfigs] =
    useState<WebChannelConfigResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const handleApiError = useCallback((error: unknown, fallback: string) => {
    if (error instanceof WebApiClientError && error.status === 401) {
      setAuthenticated(false)
      setLoginError("会话已失效，请重新登录。")
      return
    }

    setNotice({
      kind: "error",
      text: error instanceof Error ? error.message : fallback,
    })
  }, [])

  const loadAccounts = useCallback(async () => {
    const response = await webApi.getAccounts()
    setAccounts(response)
  }, [])

  const loadPreferences = useCallback(async () => {
    setPreferences(await webApi.getPreferences())
  }, [])

  const savePreferences = async (input: WebPreferencesPatch) => {
    setBusy(true)
    setNotice(null)
    try {
      setPreferences(await webApi.updatePreferences(input))
      setNotice({ kind: "success", text: "显示偏好已保存。" })
    } catch (error) {
      handleApiError(error, "显示偏好保存失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const updateChannelConfig = async (input: WebChannelConfigPatch) => {
    setBusy(true)
    setNotice(null)
    try {
      setChannelConfigs(await webApi.updateChannelConfig(input))
      setNotice({ kind: "success", text: "模型过滤规则已保存。" })
    } catch (error) {
      handleApiError(error, "模型过滤保存失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const loadSiteAnnouncements = useCallback(async () => {
    setSiteAnnouncements(await webApi.getSiteAnnouncements())
  }, [])

  const syncSiteAnnouncements = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.syncSiteAnnouncements()
      setSiteAnnouncements(response)
      setNotice({
        kind: response.sync.failed > 0 ? "error" : "success",
        text: `公告检查完成：检查 ${response.sync.checked} 个站点，新增 ${response.sync.created} 条，失败 ${response.sync.failed} 个。`,
      })
    } catch (error) {
      handleApiError(error, "公告检查失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const markSiteAnnouncementRead = async (recordId: string) => {
    setSiteAnnouncements(await webApi.markSiteAnnouncementRead(recordId))
  }

  const markSiteAnnouncementsRead = async (siteKey?: string) => {
    setSiteAnnouncements(await webApi.markSiteAnnouncementsRead(siteKey))
  }

  const createTag = async (name: string) => {
    setBusy(true)
    setNotice(null)
    try {
      setTags(await webApi.createTag({ name, expectedRevision: tags.revision }))
      setNotice({ kind: "success", text: "标签已创建。" })
    } catch (error) {
      handleApiError(error, "标签创建失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const renameTag = async (tagId: string, name: string) => {
    setBusy(true)
    setNotice(null)
    try {
      setTags(
        await webApi.renameTag(tagId, {
          name,
          expectedRevision: tags.revision,
        }),
      )
      setNotice({ kind: "success", text: "标签已重命名。" })
    } catch (error) {
      handleApiError(error, "标签重命名失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const deleteTag = async (tag: WebTagSummary) => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.deleteTag(
        tag.id,
        tags.revision,
        accounts.revision,
      )
      setTags({ tags: response.tags, revision: response.revision })
      await Promise.all([loadAccounts(), loadCredentialProfiles()])
      setNotice({
        kind: "success",
        text: `标签已删除，并清理 ${response.updatedAccounts} 个账户和 ${response.updatedCredentialProfiles} 个 API 凭据的引用。`,
      })
    } catch (error) {
      handleApiError(error, "标签删除失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const loadDashboard = useCallback(async () => {
    const [
      accountResponse,
      automationResponse,
      externalNotificationResponse,
      credentialProfileResponse,
      siteAnnouncementResponse,
      tagResponse,
      preferencesResponse,
      channelConfigResponse,
    ] = await Promise.all([
      webApi.getAccounts(),
      webApi.getAutomationSettings(),
      webApi.getExternalNotificationSettings(),
      webApi.getCredentialProfiles(),
      webApi.getSiteAnnouncements(),
      webApi.getTags(),
      webApi.getPreferences(),
      webApi.getChannelConfigs(),
    ])
    setAccounts(accountResponse)
    setAutomation(automationResponse)
    setExternalNotifications(externalNotificationResponse)
    setCredentialProfiles(credentialProfileResponse)
    setSiteAnnouncements(siteAnnouncementResponse)
    setTags(tagResponse)
    setPreferences(preferencesResponse)
    setChannelConfigs(channelConfigResponse)
  }, [])

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      try {
        const session = await webApi.getSession()
        if (cancelled) return
        setAuthenticated(session.authenticated)
        if (session.authenticated) {
          const [
            accountResponse,
            automationResponse,
            externalNotificationResponse,
            credentialProfileResponse,
            siteAnnouncementResponse,
            tagResponse,
            preferencesResponse,
            channelConfigResponse,
          ] = await Promise.all([
            webApi.getAccounts(),
            webApi.getAutomationSettings(),
            webApi.getExternalNotificationSettings(),
            webApi.getCredentialProfiles(),
            webApi.getSiteAnnouncements(),
            webApi.getTags(),
            webApi.getPreferences(),
            webApi.getChannelConfigs(),
          ])
          if (!cancelled) {
            setAccounts(accountResponse)
            setAutomation(automationResponse)
            setExternalNotifications(externalNotificationResponse)
            setCredentialProfiles(credentialProfileResponse)
            setSiteAnnouncements(siteAnnouncementResponse)
            setTags(tagResponse)
            setPreferences(preferencesResponse)
            setChannelConfigs(channelConfigResponse)
          }
        }
      } catch (error) {
        if (!cancelled) {
          setAuthenticated(false)
          setLoginError(
            error instanceof Error ? error.message : "无法连接 Web 服务",
          )
        }
      }
    }

    void initialize()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const mode = preferences?.preferences.themeMode ?? "system"
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const applyTheme = () => {
      const dark = mode === "dark" || (mode === "system" && media.matches)
      document.documentElement.classList.toggle("dark", dark)
    }
    applyTheme()
    if (mode !== "system") return
    media.addEventListener("change", applyTheme)
    return () => media.removeEventListener("change", applyTheme)
  }, [preferences])

  const login = async (password: string) => {
    setBusy(true)
    setLoginError(null)
    try {
      const session = await webApi.login(password)
      setAuthenticated(session.authenticated)
      await loadDashboard()
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "登录失败")
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    try {
      await webApi.logout()
    } finally {
      setAuthenticated(false)
      setAccounts(emptyAccountList)
      setSiteAnnouncements(emptySiteAnnouncementList)
      setAutomation(null)
      setHistory(null)
      setUsageHistory(null)
      setUsageAnalytics(null)
      setNotifications(null)
      setExternalNotifications(null)
      setPreferences(null)
      setChannelConfigs(null)
      setCredentialProfiles(null)
      setModelCatalog(null)
      setAllModelCatalog(null)
      setApiKeys(null)
      setManagedSites(null)
      setManagedChannels(null)
      setWebDavSettings(null)
      setNotice(null)
      setBusy(false)
    }
  }

  const createAccount = async (input: WebCreateAccountInput) => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.createAccount(input)
      setAccounts(response)
      setNotice({ kind: "success", text: "账户已保存。" })
    } catch (error) {
      handleApiError(error, "账户创建失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const detectAccount = async (
    input: WebAccountDetectionInput,
  ): Promise<WebAccountDetectionResponse> => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.detectAccount(input)
      setNotice({ kind: "success", text: "账户信息已识别并回填。" })
      return response
    } catch (error) {
      handleApiError(error, "账户自动识别失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const toggleDisabled = async (account: WebAccountSummary) => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.patchAccount(account.id, {
        disabled: !account.disabled,
        expectedRevision: accounts.revision,
      })
      setAccounts(response)
      setNotice({
        kind: "success",
        text: account.disabled ? "账户已启用。" : "账户已停用。",
      })
    } catch (error) {
      handleApiError(error, "账户状态更新失败")
    } finally {
      setBusy(false)
    }
  }

  const bulkMutateAccounts = async (
    accountIds: string[],
    action: WebAccountBulkAction,
  ) => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.bulkMutateAccounts({
        accountIds,
        action,
        expectedRevision: accounts.revision,
      })
      setAccounts(response)
      const actionLabel =
        action === "enable" ? "启用" : action === "disable" ? "停用" : "删除"
      setNotice({
        kind: "success",
        text: `已${actionLabel} ${accountIds.length} 个账户。`,
      })
    } catch (error) {
      handleApiError(error, "批量账户操作失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const togglePinned = async (account: WebAccountSummary) => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.patchAccount(account.id, {
        pinned: !account.pinned,
        expectedRevision: accounts.revision,
      })
      setAccounts(response)
      setNotice({
        kind: "success",
        text: account.pinned ? "已取消置顶账户。" : "账户已置顶。",
      })
    } catch (error) {
      handleApiError(error, "账户置顶状态更新失败")
    } finally {
      setBusy(false)
    }
  }

  const reorderAccounts = async (accountIds: string[]) => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.reorderAccounts({
        accountIds,
        expectedRevision: accounts.revision,
      })
      setAccounts(response)
      setNotice({ kind: "success", text: "账户顺序已更新。" })
    } catch (error) {
      handleApiError(error, "账户顺序更新失败")
    } finally {
      setBusy(false)
    }
  }

  const updateAccount = async (
    accountId: string,
    input: WebAccountPatchInput,
  ) => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.patchAccount(accountId, input)
      setAccounts(response)
      setNotice({ kind: "success", text: "账户修改已保存。" })
    } catch (error) {
      handleApiError(error, "账户修改失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const refreshAccount = async (account: WebAccountSummary) => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.refreshAccount(
        account.id,
        accounts.revision,
      )
      setAccounts(response)
      setNotice({
        kind: response.refresh.success ? "success" : "error",
        text: response.refresh.success
          ? `“${account.name}”已刷新。`
          : response.refresh.health.reason || `“${account.name}”刷新失败。`,
      })
    } catch (error) {
      handleApiError(error, "账户刷新失败")
    } finally {
      setBusy(false)
    }
  }

  const refreshAccounts = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.refreshAccounts(accounts.revision)
      setAccounts(response)
      setAutomation(await webApi.getAutomationSettings())
      setNotice({
        kind: response.refresh.failed > 0 ? "error" : "success",
        text: `刷新完成：成功 ${response.refresh.succeeded}，失败 ${response.refresh.failed}，跳过 ${response.refresh.skipped}。`,
      })
    } catch (error) {
      handleApiError(error, "批量刷新失败")
    } finally {
      setBusy(false)
    }
  }

  const saveAutomation = async (patch: WebAutomationSettingsPatch) => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.updateAutomationSettings(patch)
      setAutomation(response)
      setNotice({ kind: "success", text: "自动化设置已保存。" })
    } catch (error) {
      handleApiError(error, "自动化设置保存失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const loadExternalNotifications = async () => {
    setExternalNotifications(await webApi.getExternalNotificationSettings())
  }

  const saveExternalNotifications = async (
    input: WebExternalNotificationSettingsInput,
  ) => {
    setBusy(true)
    setNotice(null)
    try {
      setExternalNotifications(
        await webApi.updateExternalNotificationSettings(input),
      )
      setNotice({ kind: "success", text: "外部通知设置已保存。" })
    } catch (error) {
      handleApiError(error, "外部通知设置保存失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const testExternalNotification = async (
    channel: WebExternalNotificationChannel,
  ) => {
    setBusy(true)
    setNotice(null)
    try {
      setExternalNotifications(await webApi.testExternalNotification(channel))
      setNotice({ kind: "success", text: "测试通知已发送。" })
    } catch (error) {
      handleApiError(error, "测试通知发送失败")
    } finally {
      setBusy(false)
    }
  }

  const loadHistory = async () => {
    setBusy(true)
    try {
      setHistory(await webApi.getBalanceHistory())
    } catch (error) {
      handleApiError(error, "余额历史加载失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const loadUsageHistory = async () => {
    setBusy(true)
    try {
      setUsageHistory(await webApi.getUsageHistory())
    } catch (error) {
      handleApiError(error, "用量历史加载失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const loadUsageAnalytics = async (query: WebUsageAnalyticsQuery = {}) => {
    setBusy(true)
    try {
      setUsageAnalytics(await webApi.getUsageAnalytics(query))
    } catch (error) {
      handleApiError(error, "用量分析加载失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const syncUsageHistory = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.syncUsageHistory()
      setUsageHistory(response)
      setNotice({
        kind: response.sync.failed > 0 ? "error" : "success",
        text: `用量同步完成：成功 ${response.sync.succeeded}，失败 ${response.sync.failed}，摄取 ${response.sync.ingested} 条。`,
      })
    } catch (error) {
      handleApiError(error, "用量历史同步失败")
    } finally {
      setBusy(false)
    }
  }

  const loadNotifications = async () => {
    setNotifications(await webApi.getNotifications())
  }

  const loadRuntimeCapabilities = async () => {
    try {
      setRuntimeCapabilities(await webApi.getRuntimeCapabilities())
    } catch (error) {
      handleApiError(error, "运行能力加载失败")
      throw error
    }
  }

  const markNotificationsRead = async () => {
    setNotifications(await webApi.markNotificationsRead())
  }

  const fetchVerificationModels = async (
    input: WebApiVerificationInput,
  ): Promise<WebApiVerificationModelsResponse> => {
    setBusy(true)
    try {
      return await webApi.fetchVerificationModels(input)
    } catch (error) {
      handleApiError(error, "模型列表获取失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const runVerification = async (
    input: WebApiVerificationInput,
  ): Promise<WebApiVerificationResponse> => {
    setBusy(true)
    try {
      return await webApi.runVerification(input)
    } catch (error) {
      handleApiError(error, "API 验证失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const loadModels = async (account: WebAccountSummary) => {
    setBusy(true)
    try {
      setModelCatalog(await webApi.getAccountModels(account.id))
    } catch (error) {
      handleApiError(error, "模型列表加载失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const loadAllModels = async () => {
    setBusy(true)
    try {
      setAllModelCatalog(await webApi.getAllModels())
    } catch (error) {
      handleApiError(error, "模型总览加载失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const loadKeys = async (account: WebAccountSummary) => {
    setBusy(true)
    try {
      setCreatedKeySecret(null)
      setApiKeys(await webApi.getAccountKeys(account.id))
    } catch (error) {
      handleApiError(error, "密钥列表加载失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const loadCredentialProfiles = async () => {
    const response = await webApi.getCredentialProfiles()
    setCredentialProfiles(response)
  }

  const createCredentialProfile = async (
    input: WebApiCredentialProfileCreateInput,
  ) => {
    setBusy(true)
    setNotice(null)
    try {
      setCredentialProfiles(await webApi.createCredentialProfile(input))
      setNotice({ kind: "success", text: "API 凭据已保存。" })
    } catch (error) {
      handleApiError(error, "API 凭据保存失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const updateCredentialProfile = async (
    id: string,
    input: WebApiCredentialProfileUpdateInput,
  ) => {
    setBusy(true)
    setNotice(null)
    try {
      setCredentialProfiles(await webApi.updateCredentialProfile(id, input))
      setNotice({ kind: "success", text: "API 凭据已更新。" })
    } catch (error) {
      handleApiError(error, "API 凭据更新失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const deleteCredentialProfile = async (
    profile: WebApiCredentialProfileSummary,
  ) => {
    if (!window.confirm(`确认删除凭据“${profile.name}”？`)) return
    setBusy(true)
    setNotice(null)
    try {
      setCredentialProfiles(await webApi.deleteCredentialProfile(profile.id))
      setNotice({ kind: "success", text: "API 凭据已删除。" })
    } catch (error) {
      handleApiError(error, "API 凭据删除失败")
    } finally {
      setBusy(false)
    }
  }

  const exportCredentialProfile = async (
    profile: WebApiCredentialProfileSummary,
    format: WebCredentialExportFormat,
  ) => {
    setBusy(true)
    setNotice(null)
    try {
      const response: WebApiCredentialProfileExportResponse =
        await webApi.exportCredentialProfile(profile.id, format)
      const blob = new Blob([response.content], { type: response.contentType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = response.filename
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice({
        kind: "success",
        text: `已导出 ${profile.name} 的 ${format === "json" ? "JSON" : ".env"} 配置。请妥善保管明文密钥。`,
      })
    } catch (error) {
      handleApiError(error, "凭据导出失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const loadCredentialProfileModels = async (
    profile: WebApiCredentialProfileSummary,
  ): Promise<WebApiCredentialProfileModelCatalogResponse> => {
    setBusy(true)
    try {
      return await webApi.getCredentialProfileModels(profile.id)
    } catch (error) {
      handleApiError(error, "API 凭据模型加载失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const verifyCredentialProfile = async (
    profile: WebApiCredentialProfileSummary,
    modelId?: string,
  ): Promise<WebApiCredentialProfileVerificationResponse> => {
    setBusy(true)
    try {
      return await webApi.verifyCredentialProfile(profile.id, modelId)
    } catch (error) {
      handleApiError(error, "API 凭据验证失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const createKey = async (name: string) => {
    if (!apiKeys) return
    setBusy(true)
    try {
      const response = await webApi.createAccountKey(apiKeys.accountId, {
        name,
        remainingQuota: 0,
        expiresAt: -1,
        unlimitedQuota: true,
        modelLimitsEnabled: false,
        modelLimits: "",
        allowIps: "",
        group: "",
      })
      setApiKeys(response)
      setCreatedKeySecret(response.createdSecret ?? null)
    } finally {
      setBusy(false)
    }
  }

  const deleteKey = async (tokenId: number | string) => {
    if (!apiKeys) return
    setBusy(true)
    try {
      setApiKeys(await webApi.deleteAccountKey(apiKeys.accountId, tokenId))
    } finally {
      setBusy(false)
    }
  }

  const updateKey = async (tokenId: number | string, name: string) => {
    if (!apiKeys) return
    const key = apiKeys.keys.find((item) => item.id === tokenId)
    if (!key) return
    setBusy(true)
    try {
      setApiKeys(
        await webApi.updateAccountKey(apiKeys.accountId, tokenId, {
          name,
          remainingQuota: key.remainingQuota,
          expiresAt: key.expiresAt,
          unlimitedQuota: key.unlimitedQuota,
          modelLimitsEnabled: Boolean(key.modelLimits),
          modelLimits: key.modelLimits ?? "",
          allowIps: key.allowIps ?? "",
          group: key.group ?? "",
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  const loadManagedSites = async () => {
    setManagedSites(await webApi.getManagedSites())
  }

  const createManagedSite = async (input: WebManagedSiteConnectionInput) => {
    setManagedSites(await webApi.createManagedSite(input))
  }

  const deleteManagedSite = async (id: string) => {
    setManagedSites(await webApi.deleteManagedSite(id))
    setManagedChannels(null)
  }

  const loadManagedChannels = async (id: string) => {
    setBusy(true)
    try {
      setManagedChannels(await webApi.getManagedChannels(id))
    } finally {
      setBusy(false)
    }
  }

  const deleteManagedChannel = async (id: string, channelId: number) => {
    setManagedChannels(await webApi.deleteManagedChannel(id, channelId))
  }

  const createManagedChannel = async (
    id: string,
    input: WebManagedChannelInput,
  ) => {
    setManagedChannels(await webApi.createManagedChannel(id, input))
  }

  const updateManagedChannel = async (
    id: string,
    channelId: number,
    input: WebManagedChannelInput,
  ) => {
    setManagedChannels(await webApi.updateManagedChannel(id, channelId, input))
  }

  const syncManagedSiteModels = async (
    id: string,
    input: WebManagedModelSyncInput = {},
  ): Promise<WebManagedModelSyncResponse> => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.syncManagedSiteModels(id, input)
      setManagedChannels(await webApi.getManagedChannels(id))
      setNotice({
        kind: response.summary.failed > 0 ? "error" : "success",
        text: `模型同步完成：成功 ${response.summary.succeeded}，失败 ${response.summary.failed}，更新 ${response.summary.changed} 个渠道。`,
      })
      return response
    } catch (error) {
      handleApiError(error, "模型同步失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const loadWebDavSettings = async () => {
    setWebDavSettings(await webApi.getWebDavSettings())
  }

  const saveWebDavSettings = async (input: WebDavSettingsInput) => {
    setBusy(true)
    setNotice(null)
    try {
      setWebDavSettings(await webApi.updateWebDavSettings(input))
      setNotice({ kind: "success", text: "WebDAV 设置已保存。" })
    } catch (error) {
      handleApiError(error, "WebDAV 设置保存失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const testWebDav = async () => {
    setBusy(true)
    setNotice(null)
    try {
      setWebDavSettings(await webApi.testWebDav())
      setNotice({ kind: "success", text: "WebDAV 连接正常。" })
    } catch (error) {
      handleApiError(error, "WebDAV 连接测试失败")
    } finally {
      setBusy(false)
    }
  }

  const uploadWebDavBackup = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.uploadWebDavBackup()
      setWebDavSettings(response)
      setNotice({
        kind: response.lastRun?.status === "failed" ? "error" : "success",
        text:
          response.lastRun?.status === "failed"
            ? response.lastRun.error || "WebDAV 备份失败"
            : "完整备份已上传到 WebDAV。",
      })
    } catch (error) {
      handleApiError(error, "WebDAV 备份失败")
    } finally {
      setBusy(false)
    }
  }

  const restoreWebDavBackup = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const restored = await webApi.restoreWebDavBackup()
      await loadDashboard()
      setHistory(null)
      setUsageHistory(null)
      setUsageAnalytics(null)
      setNotifications(null)
      setRuntimeCapabilities(null)
      setModelCatalog(null)
      setApiKeys(null)
      setManagedSites(null)
      setManagedChannels(null)
      await loadWebDavSettings()
      setNotice({
        kind: "success",
        text: `WebDAV 备份已恢复，共恢复 ${restored.restoredDocuments} 个数据文档。`,
      })
    } catch (error) {
      handleApiError(error, "WebDAV 恢复失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  const runCheckIn = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await webApi.runCheckIn(accounts.revision)
      setAccounts(response)
      setAutomation(await webApi.getAutomationSettings())
      const summary = response.checkIn
      setNotice({
        kind:
          summary.failed > 0 ||
          summary.browserRequired > 0 ||
          summary.persistence !== "persisted"
            ? "error"
            : "success",
        text: `签到完成：成功 ${summary.succeeded}，已签到 ${summary.alreadyChecked}，失败 ${summary.failed}，跳过 ${summary.skipped}，需浏览器 ${summary.browserRequired}。`,
      })
    } catch (error) {
      handleApiError(error, "签到执行失败")
    } finally {
      setBusy(false)
    }
  }

  const deleteAccount = async (account: WebAccountSummary) => {
    setBusy(true)
    setNotice(null)
    try {
      await webApi.deleteAccount(account.id, accounts.revision)
      await loadAccounts()
      setNotice({ kind: "success", text: "账户已删除。" })
    } catch (error) {
      handleApiError(error, "账户删除失败")
      throw error
    } finally {
      setBusy(false)
    }
  }

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500 dark:bg-gray-950">
        正在连接 Web 服务...
      </div>
    )
  }

  if (!authenticated) {
    return <LoginView loading={busy} error={loginError} onLogin={login} />
  }

  return (
    <AccountDashboard
      data={accounts}
      tags={tags}
      siteAnnouncements={siteAnnouncements}
      automation={automation}
      history={history}
      usageHistory={usageHistory}
      usageAnalytics={usageAnalytics}
      notifications={notifications}
      runtimeCapabilities={runtimeCapabilities}
      modelCatalog={modelCatalog}
      allModelCatalog={allModelCatalog}
      apiKeys={apiKeys}
      credentialProfiles={credentialProfiles}
      createdKeySecret={createdKeySecret}
      managedSites={managedSites}
      managedChannels={managedChannels}
      webDavSettings={webDavSettings}
      externalNotifications={externalNotifications}
      preferences={preferences}
      channelConfigs={channelConfigs}
      busy={busy}
      message={notice}
      onCreate={createAccount}
      onDetectAccount={detectAccount}
      onUpdate={updateAccount}
      onLoadSiteAnnouncements={loadSiteAnnouncements}
      onSyncSiteAnnouncements={syncSiteAnnouncements}
      onMarkSiteAnnouncementRead={markSiteAnnouncementRead}
      onMarkSiteAnnouncementsRead={markSiteAnnouncementsRead}
      onCreateTag={createTag}
      onRenameTag={renameTag}
      onDeleteTag={deleteTag}
      onToggleDisabled={toggleDisabled}
      onBulkAction={bulkMutateAccounts}
      onTogglePinned={togglePinned}
      onReorder={reorderAccounts}
      onRefresh={refreshAccount}
      onRefreshAll={refreshAccounts}
      onRunCheckIn={runCheckIn}
      onSaveAutomation={saveAutomation}
      onLoadPreferences={loadPreferences}
      onSavePreferences={savePreferences}
      onUpdateChannelConfig={updateChannelConfig}
      onLoadHistory={loadHistory}
      onLoadUsageHistory={loadUsageHistory}
      onLoadUsageAnalytics={loadUsageAnalytics}
      onSyncUsageHistory={syncUsageHistory}
      onLoadNotifications={loadNotifications}
      onLoadRuntimeCapabilities={loadRuntimeCapabilities}
      onMarkNotificationsRead={markNotificationsRead}
      onLoadModels={loadModels}
      onLoadAllModels={loadAllModels}
      onLoadKeys={loadKeys}
      onCreateKey={createKey}
      onDeleteKey={deleteKey}
      onUpdateKey={updateKey}
      onLoadCredentialProfiles={loadCredentialProfiles}
      onCreateCredentialProfile={createCredentialProfile}
      onUpdateCredentialProfile={updateCredentialProfile}
      onDeleteCredentialProfile={deleteCredentialProfile}
      onExportCredentialProfile={exportCredentialProfile}
      onLoadCredentialProfileModels={loadCredentialProfileModels}
      onVerifyCredentialProfile={verifyCredentialProfile}
      onFetchVerificationModels={fetchVerificationModels}
      onRunVerification={runVerification}
      onLoadManagedSites={loadManagedSites}
      onCreateManagedSite={createManagedSite}
      onDeleteManagedSite={deleteManagedSite}
      onLoadManagedChannels={loadManagedChannels}
      onDeleteManagedChannel={deleteManagedChannel}
      onCreateManagedChannel={createManagedChannel}
      onUpdateManagedChannel={updateManagedChannel}
      onSyncManagedSiteModels={syncManagedSiteModels}
      onLoadWebDavSettings={loadWebDavSettings}
      onSaveWebDavSettings={saveWebDavSettings}
      onTestWebDav={testWebDav}
      onUploadWebDavBackup={uploadWebDavBackup}
      onRestoreWebDavBackup={restoreWebDavBackup}
      onLoadExternalNotifications={loadExternalNotifications}
      onSaveExternalNotifications={saveExternalNotifications}
      onTestExternalNotification={testExternalNotification}
      onDelete={deleteAccount}
      onLogout={logout}
    />
  )
}

export default App

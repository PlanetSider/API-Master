import type { AccountStorageConfig } from "~/types"
import type {
  WebAccountBulkMutationInput,
  WebAccountDetectionInput,
  WebAccountDetectionResponse,
  WebAccountListResponse,
  WebAccountOrderInput,
  WebAccountPatchInput,
  WebAccountRefreshResponse,
  WebAllModelCatalogResponse,
  WebApiCredentialProfileCreateInput,
  WebApiCredentialProfileExportResponse,
  WebApiCredentialProfileListResponse,
  WebApiCredentialProfileModelCatalogResponse,
  WebApiCredentialProfileUpdateInput,
  WebApiCredentialProfileVerificationResponse,
  WebApiErrorPayload,
  WebApiKeyListResponse,
  WebApiKeyMutationInput,
  WebApiKeyMutationResponse,
  WebApiVerificationInput,
  WebApiVerificationModelsResponse,
  WebApiVerificationResponse,
  WebAutomationSettingsPatch,
  WebAutomationSettingsResponse,
  WebBackup,
  WebBackupRestoreResponse,
  WebBalanceHistoryResponse,
  WebBatchAccountRefreshResponse,
  WebBookmarkCreateInput,
  WebBookmarkListResponse,
  WebBookmarkPatchInput,
  WebChannelConfigPatch,
  WebChannelConfigResponse,
  WebCheckInRunResponse,
  WebCreateAccountInput,
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
  WebMutationResponse,
  WebNotificationListResponse,
  WebPreferencesPatch,
  WebPreferencesResponse,
  WebRuntimeCapabilitiesResponse,
  WebSessionState,
  WebSiteAnnouncementListResponse,
  WebSiteAnnouncementSyncResponse,
  WebTagDeleteResponse,
  WebTagListResponse,
  WebTagMutationInput,
  WebUsageAnalyticsResponse,
  WebUsageHistoryResponse,
  WebUsageHistorySyncResponse,
  WebCredentialExportFormat,
} from "~/web/contracts"

export class WebApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = "WebApiClientError"
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => null)) as WebApiErrorPayload | null
    throw new WebApiClientError(
      payload?.error || `Request failed with status ${response.status}`,
      response.status,
      payload?.code,
    )
  }

  return (await response.json()) as T
}

export const webApi = {
  getSession: () => request<WebSessionState>("/api/session"),

  getRuntimeCapabilities: () =>
    request<WebRuntimeCapabilitiesResponse>("/api/runtime/capabilities"),

  fetchVerificationModels: (input: WebApiVerificationInput) =>
    request<WebApiVerificationModelsResponse>("/api/verification/models", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  runVerification: (input: WebApiVerificationInput) =>
    request<WebApiVerificationResponse>("/api/verification/run", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (password: string) =>
    request<WebSessionState>("/api/session", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  logout: () => request<WebSessionState>("/api/session", { method: "DELETE" }),

  getAccounts: () => request<WebAccountListResponse>("/api/accounts"),

  detectAccount: (input: WebAccountDetectionInput) =>
    request<WebAccountDetectionResponse>("/api/accounts/detect", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getTags: () => request<WebTagListResponse>("/api/tags"),

  createTag: (input: WebTagMutationInput) =>
    request<WebTagListResponse>("/api/tags", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  renameTag: (tagId: string, input: WebTagMutationInput) =>
    request<WebTagListResponse>(`/api/tags/${encodeURIComponent(tagId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteTag: (tagId: string, revision: number, accountsRevision: number) =>
    request<WebTagDeleteResponse>(
      `/api/tags/${encodeURIComponent(tagId)}?revision=${revision}&accountsRevision=${accountsRevision}`,
      { method: "DELETE" },
    ),

  getBookmarks: () => request<WebBookmarkListResponse>("/api/bookmarks"),

  getSiteAnnouncements: () =>
    request<WebSiteAnnouncementListResponse>("/api/site-announcements"),

  syncSiteAnnouncements: (accountIds?: string[]) =>
    request<WebSiteAnnouncementSyncResponse>("/api/site-announcements/sync", {
      method: "POST",
      body: JSON.stringify(accountIds ? { accountIds } : {}),
    }),

  markSiteAnnouncementRead: (recordId: string) =>
    request<WebSiteAnnouncementListResponse>(
      `/api/site-announcements/${encodeURIComponent(recordId)}/read`,
      { method: "POST" },
    ),

  markSiteAnnouncementsRead: (siteKey?: string) =>
    request<WebSiteAnnouncementListResponse>(
      "/api/site-announcements/read-all",
      { method: "POST", body: JSON.stringify(siteKey ? { siteKey } : {}) },
    ),

  createBookmark: (input: WebBookmarkCreateInput) =>
    request<WebBookmarkListResponse>("/api/bookmarks", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateBookmark: (bookmarkId: string, input: WebBookmarkPatchInput) =>
    request<WebBookmarkListResponse>(
      `/api/bookmarks/${encodeURIComponent(bookmarkId)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),

  deleteBookmark: (bookmarkId: string, revision: number) =>
    request<WebBookmarkListResponse>(
      `/api/bookmarks/${encodeURIComponent(bookmarkId)}?revision=${revision}`,
      { method: "DELETE" },
    ),

  getCredentialProfiles: () =>
    request<WebApiCredentialProfileListResponse>("/api/credential-profiles"),

  createCredentialProfile: (input: WebApiCredentialProfileCreateInput) =>
    request<WebApiCredentialProfileListResponse>("/api/credential-profiles", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateCredentialProfile: (
    profileId: string,
    input: WebApiCredentialProfileUpdateInput,
  ) =>
    request<WebApiCredentialProfileListResponse>(
      `/api/credential-profiles/${encodeURIComponent(profileId)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),

  deleteCredentialProfile: (profileId: string) =>
    request<WebApiCredentialProfileListResponse>(
      `/api/credential-profiles/${encodeURIComponent(profileId)}`,
      { method: "DELETE" },
    ),

  exportCredentialProfile: (
    profileId: string,
    format: WebCredentialExportFormat,
  ) =>
    request<WebApiCredentialProfileExportResponse>(
      `/api/credential-profiles/${encodeURIComponent(profileId)}/export`,
      { method: "POST", body: JSON.stringify({ format }) },
    ),

  getCredentialProfileModels: (profileId: string) =>
    request<WebApiCredentialProfileModelCatalogResponse>(
      `/api/credential-profiles/${encodeURIComponent(profileId)}/models`,
    ),

  verifyCredentialProfile: (profileId: string, modelId?: string) =>
    request<WebApiCredentialProfileVerificationResponse>(
      `/api/credential-profiles/${encodeURIComponent(profileId)}/verify`,
      {
        method: "POST",
        body: JSON.stringify(modelId ? { modelId } : {}),
      },
    ),

  getAccountModels: (accountId: string) =>
    request<WebModelCatalogResponse>(
      `/api/accounts/${encodeURIComponent(accountId)}/models`,
    ),

  getAllModels: (concurrency = 3) =>
    request<WebAllModelCatalogResponse>(
      `/api/models?concurrency=${encodeURIComponent(String(concurrency))}`,
    ),

  getAccountKeys: (accountId: string) =>
    request<WebApiKeyListResponse>(
      `/api/accounts/${encodeURIComponent(accountId)}/keys`,
    ),

  createAccountKey: (accountId: string, input: WebApiKeyMutationInput) =>
    request<WebApiKeyMutationResponse>(
      `/api/accounts/${encodeURIComponent(accountId)}/keys`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  deleteAccountKey: (accountId: string, tokenId: number | string) =>
    request<WebApiKeyListResponse>(
      `/api/accounts/${encodeURIComponent(accountId)}/keys/${tokenId}`,
      { method: "DELETE" },
    ),

  updateAccountKey: (
    accountId: string,
    tokenId: number | string,
    input: WebApiKeyMutationInput,
  ) =>
    request<WebApiKeyListResponse>(
      `/api/accounts/${encodeURIComponent(accountId)}/keys/${tokenId}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),

  getAutomationSettings: () =>
    request<WebAutomationSettingsResponse>("/api/settings/automation"),

  getPreferences: () =>
    request<WebPreferencesResponse>("/api/settings/preferences"),

  updatePreferences: (input: WebPreferencesPatch) =>
    request<WebPreferencesResponse>("/api/settings/preferences", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  getChannelConfigs: () =>
    request<WebChannelConfigResponse>("/api/channel-configs"),

  updateChannelConfig: (input: WebChannelConfigPatch) =>
    request<WebChannelConfigResponse>("/api/channel-configs", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  getWebDavSettings: () =>
    request<WebDavSettingsResponse>("/api/settings/webdav"),

  getExternalNotificationSettings: () =>
    request<WebExternalNotificationSettingsResponse>(
      "/api/settings/external-notifications",
    ),

  updateExternalNotificationSettings: (
    input: WebExternalNotificationSettingsInput,
  ) =>
    request<WebExternalNotificationSettingsResponse>(
      "/api/settings/external-notifications",
      { method: "PUT", body: JSON.stringify(input) },
    ),

  testExternalNotification: (channel: WebExternalNotificationChannel) =>
    request<WebExternalNotificationSettingsResponse>(
      "/api/settings/external-notifications/test",
      { method: "POST", body: JSON.stringify({ channel }) },
    ),

  updateWebDavSettings: (input: WebDavSettingsInput) =>
    request<WebDavSettingsResponse>("/api/settings/webdav", {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  testWebDav: () =>
    request<WebDavSettingsResponse>("/api/settings/webdav/test", {
      method: "POST",
    }),

  uploadWebDavBackup: () =>
    request<WebDavSettingsResponse>("/api/settings/webdav/upload", {
      method: "POST",
    }),

  restoreWebDavBackup: () =>
    request<WebBackupRestoreResponse>("/api/settings/webdav/restore", {
      method: "POST",
    }),

  getBalanceHistory: () =>
    request<WebBalanceHistoryResponse>("/api/history/balance"),

  getUsageHistory: () => request<WebUsageHistoryResponse>("/api/history/usage"),

  getUsageAnalytics: (
    input: {
      accountIds?: string[]
      startDay?: string
      endDay?: string
    } = {},
  ) => {
    const params = new URLSearchParams()
    if (input.accountIds?.length)
      params.set("accountIds", input.accountIds.join(","))
    if (input.startDay) params.set("startDay", input.startDay)
    if (input.endDay) params.set("endDay", input.endDay)
    const query = params.toString()
    return request<WebUsageAnalyticsResponse>(
      `/api/history/usage/analytics${query ? `?${query}` : ""}`,
    )
  },

  syncUsageHistory: () =>
    request<WebUsageHistorySyncResponse>("/api/history/usage/sync", {
      method: "POST",
      body: JSON.stringify({ retentionDays: 7 }),
    }),

  getNotifications: () =>
    request<WebNotificationListResponse>("/api/notifications"),

  markNotificationsRead: () =>
    request<WebNotificationListResponse>("/api/notifications/read-all", {
      method: "POST",
    }),

  getManagedSites: () =>
    request<WebManagedSiteConnectionListResponse>("/api/managed-sites"),

  createManagedSite: (input: WebManagedSiteConnectionInput) =>
    request<WebManagedSiteConnectionListResponse>("/api/managed-sites", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  deleteManagedSite: (id: string) =>
    request<WebManagedSiteConnectionListResponse>(
      `/api/managed-sites/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),

  getManagedChannels: (id: string) =>
    request<WebManagedChannelListResponse>(
      `/api/managed-sites/${encodeURIComponent(id)}/channels`,
    ),

  syncManagedSiteModels: (id: string, input: WebManagedModelSyncInput = {}) =>
    request<WebManagedModelSyncResponse>(
      `/api/managed-sites/${encodeURIComponent(id)}/model-sync`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  deleteManagedChannel: (id: string, channelId: number) =>
    request<WebManagedChannelListResponse>(
      `/api/managed-sites/${encodeURIComponent(id)}/channels/${channelId}`,
      { method: "DELETE" },
    ),

  createManagedChannel: (id: string, input: WebManagedChannelInput) =>
    request<WebManagedChannelListResponse>(
      `/api/managed-sites/${encodeURIComponent(id)}/channels`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  updateManagedChannel: (
    id: string,
    channelId: number,
    input: WebManagedChannelInput,
  ) =>
    request<WebManagedChannelListResponse>(
      `/api/managed-sites/${encodeURIComponent(id)}/channels/${channelId}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),

  updateAutomationSettings: (input: WebAutomationSettingsPatch) =>
    request<WebAutomationSettingsResponse>("/api/settings/automation", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  createAccount: (input: WebCreateAccountInput) =>
    request<WebAccountListResponse>("/api/accounts", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  patchAccount: (accountId: string, input: WebAccountPatchInput) =>
    request<WebAccountListResponse>(
      `/api/accounts/${encodeURIComponent(accountId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    ),

  bulkMutateAccounts: (input: WebAccountBulkMutationInput) =>
    request<WebAccountListResponse>("/api/accounts/bulk", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  reorderAccounts: (input: WebAccountOrderInput) =>
    request<WebAccountListResponse>("/api/accounts/order", {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  refreshAccount: (accountId: string, expectedRevision: number) =>
    request<WebAccountRefreshResponse>(
      `/api/accounts/${encodeURIComponent(accountId)}/refresh`,
      {
        method: "POST",
        body: JSON.stringify({ expectedRevision }),
      },
    ),

  refreshAccounts: (expectedRevision: number) =>
    request<WebBatchAccountRefreshResponse>("/api/accounts/refresh", {
      method: "POST",
      body: JSON.stringify({ expectedRevision, concurrency: 3 }),
    }),

  runCheckIn: (expectedRevision: number) =>
    request<WebCheckInRunResponse>("/api/checkin/run", {
      method: "POST",
      body: JSON.stringify({ expectedRevision }),
    }),

  deleteAccount: (accountId: string, revision: number) =>
    request<WebMutationResponse>(
      `/api/accounts/${encodeURIComponent(accountId)}?revision=${revision}`,
      { method: "DELETE" },
    ),

  importAccounts: (data: unknown, expectedRevision: number) =>
    request<WebAccountListResponse>("/api/accounts/import", {
      method: "POST",
      body: JSON.stringify({ data, expectedRevision }),
    }),

  restoreBackup: (backup: WebBackup) =>
    request<WebBackupRestoreResponse>("/api/backup/restore", {
      method: "POST",
      body: JSON.stringify(backup),
    }),

  exportBackup: async () => {
    const response = await fetch("/api/backup", {
      credentials: "same-origin",
    })
    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => null)) as WebApiErrorPayload | null
      throw new WebApiClientError(
        payload?.error || "Backup export failed",
        response.status,
        payload?.code,
      )
    }

    return (await response.json()) as WebBackup
  },

  exportAccounts: async () => {
    const response = await fetch("/api/accounts/export", {
      credentials: "same-origin",
    })
    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => null)) as WebApiErrorPayload | null
      throw new WebApiClientError(
        payload?.error || "Export failed",
        response.status,
        payload?.code,
      )
    }

    return (await response.json()) as AccountStorageConfig
  },
}

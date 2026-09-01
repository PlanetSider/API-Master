import type { AccountSiteType, ManagedSiteType } from "~/constants/siteType"
import type {
  ApiVerificationApiType,
  ApiVerificationReport,
} from "~/services/verification/aiApiVerification"
import type { AuthTypeEnum, HealthStatus } from "~/types"
import type { ChannelConfigSnapshot } from "~/types/channelConfig"
import type { ChannelModelFilterRule } from "~/types/channelModelFilters"

export interface WebSessionState {
  authenticated: boolean
}

export const WEB_RUNTIME_CAPABILITY_IDS = [
  "standard_http",
  "saved_cookie_header",
  "waf_challenge",
  "turnstile",
  "active_tab_detection",
  "page_session_read",
  "page_native_action",
] as const

export type WebRuntimeCapabilityId = (typeof WEB_RUNTIME_CAPABILITY_IDS)[number]

export type WebRuntimeCapabilityState =
  | "available"
  | "limited"
  | "requires_worker"

export interface WebRuntimeCapabilitiesResponse {
  runtime: "web"
  browserWorker: {
    configured: boolean
    connected: boolean
  }
  capabilities: Array<{
    id: WebRuntimeCapabilityId
    state: WebRuntimeCapabilityState
    executor: "server" | "browser_worker"
  }>
}

/** Inputs for one-time API checks initiated from the Web console. */
export interface WebApiVerificationInput {
  apiType: ApiVerificationApiType
  baseUrl: string
  apiKey: string
  modelId?: string
}

/** Model discovery response for a transient API credential. */
export interface WebApiVerificationModelsResponse {
  modelIds: string[]
}

/** Verification report for a transient API credential. */
export interface WebApiVerificationResponse {
  report: ApiVerificationReport
}

export const WEB_THEME_MODES = ["system", "light", "dark"] as const
export type WebThemeMode = (typeof WEB_THEME_MODES)[number]

export const WEB_CURRENCY_TYPES = ["USD", "CNY"] as const
export type WebCurrencyType = (typeof WEB_CURRENCY_TYPES)[number]

export const WEB_SORT_FIELDS = [
  null,
  "cashflow",
  "consumption",
  "income",
  "balance",
  "created_at",
] as const
export type WebSortField = (typeof WEB_SORT_FIELDS)[number]

export const WEB_SORT_ORDERS = ["asc", "desc"] as const
export type WebSortOrder = (typeof WEB_SORT_ORDERS)[number]

/** Preferences that affect the browser UI or server-side account presentation. */
export interface WebDisplayPreferences {
  themeMode: WebThemeMode
  language?: string
  currencyType: WebCurrencyType
  showTodayCashflow: boolean
  sortField: WebSortField
  sortOrder: WebSortOrder
  showHealthStatus: boolean
}

export interface WebPreferencesResponse {
  preferences: WebDisplayPreferences
  revision: number
  updatedAt: number
  /** Names of extension-only fields ignored during the last import. */
  unsupportedExtensionKeys: string[]
}

export interface WebPreferencesPatch extends Partial<WebDisplayPreferences> {
  expectedRevision?: number
}

export interface WebChannelConfigResponse {
  snapshot: ChannelConfigSnapshot
  revision: number
  updatedAt: number
}

export interface WebChannelConfigPatch {
  managedSiteType: ManagedSiteType
  scopeKey: string
  resourceId: string | number
  channelId?: number
  rules: ChannelModelFilterRule[]
  expectedRevision?: number
}

export interface WebAccountSummary {
  id: string
  name: string
  baseUrl: string
  siteType: AccountSiteType
  authType: AuthTypeEnum
  username: string
  userId: string
  disabled: boolean
  pinned: boolean
  tagIds: string[]
  notes: string
  health: HealthStatus
  /** Derived daily check-in state used by the web account-list filter. */
  checkInStatus?: WebAccountCheckInStatus
  balance: {
    USD: number
    CNY: number
  }
  todayConsumption: {
    USD: number
    CNY: number
  }
  todayIncome?: {
    USD: number
    CNY: number
  }
  lastSyncTime: number
  createdAt: number
  exchangeRate: number
}

export type WebAccountCheckInStatus =
  | "checked-in"
  | "not-checked-in"
  | "outdated"
  | "status-unavailable"
  | "unsupported"

export interface WebAccountListResponse {
  accounts: WebAccountSummary[]
  revision: number
  lastUpdated: number
}

export interface WebBookmarkSummary {
  id: string
  name: string
  url: string
  tagIds: string[]
  notes: string
  pinned: boolean
  createdAt: number
  updatedAt: number
}

export interface WebBookmarkListResponse {
  bookmarks: WebBookmarkSummary[]
  pinnedBookmarkIds: string[]
  revision: number
  lastUpdated: number
}

export interface WebBookmarkCreateInput {
  name: string
  url: string
  tagIds?: string[]
  notes?: string
  expectedRevision?: number
}

export interface WebBookmarkPatchInput {
  name?: string
  url?: string
  tagIds?: string[]
  notes?: string
  pinned?: boolean
  expectedRevision?: number
}

export interface WebMutationResponse {
  revision: number
  lastUpdated: number
}

export interface WebAccountRefreshResponse extends WebAccountListResponse {
  refresh: {
    accountId: string
    success: boolean
    health: HealthStatus
  }
}

export interface WebBatchAccountRefreshResponse extends WebAccountListResponse {
  refresh: {
    total: number
    succeeded: number
    failed: number
    skipped: number
  }
}

export interface WebAutomationSettings {
  autoRefreshEnabled: boolean
  autoRefreshIntervalMinutes: number
  includeTodayCashflow: boolean
  autoCheckinEnabled: boolean
  autoCheckinTime: string
  balanceHistoryEnabled: boolean
  balanceHistoryRetentionDays: number
  usageHistoryEnabled: boolean
  usageHistoryRetentionDays: number
  usageHistoryAfterRefresh: boolean
  siteAnnouncementsEnabled: boolean
  siteAnnouncementsIntervalMinutes: number
  siteAnnouncementNotificationsEnabled: boolean
}

export interface WebAutomationRunSummary {
  trigger: "manual" | "scheduled"
  startedAt: number
  finishedAt: number
  total: number
  succeeded: number
  failed: number
  skipped: number
  status: "completed" | "revision_conflict" | "failed"
}

export interface WebAutomationSettingsResponse {
  settings: WebAutomationSettings
  revision: number
  lastRun?: WebAutomationRunSummary
  lastCheckInRun?: WebCheckInRunSummary
  runtime: {
    running: boolean
    nextRunAt?: number
    checkInRunning?: boolean
    nextCheckInAt?: number
    siteAnnouncementsRunning?: boolean
    nextSiteAnnouncementsAt?: number
  }
}

export interface WebAutomationSettingsPatch {
  autoRefreshEnabled?: boolean
  autoRefreshIntervalMinutes?: number
  includeTodayCashflow?: boolean
  autoCheckinEnabled?: boolean
  autoCheckinTime?: string
  balanceHistoryEnabled?: boolean
  balanceHistoryRetentionDays?: number
  usageHistoryEnabled?: boolean
  usageHistoryRetentionDays?: number
  usageHistoryAfterRefresh?: boolean
  siteAnnouncementsEnabled?: boolean
  siteAnnouncementsIntervalMinutes?: number
  siteAnnouncementNotificationsEnabled?: boolean
  expectedRevision?: number
}

export interface WebSiteAnnouncementRecord {
  id: string
  siteKey: string
  siteName: string
  siteType: AccountSiteType
  baseUrl: string
  accountId: string
  providerId: "common" | "sub2api"
  upstreamId?: string
  title: string
  content: string
  fingerprint: string
  firstSeenAt: number
  lastSeenAt: number
  createdAt?: number
  updatedAt?: number
  notifiedAt?: number
  notificationError?: string
  read: boolean
  readAt?: number
}

export interface WebSiteAnnouncementSiteState {
  siteKey: string
  siteName: string
  siteType: AccountSiteType
  baseUrl: string
  accountId: string
  providerId: "common" | "sub2api"
  status: "never" | "success" | "error" | "unsupported"
  lastCheckedAt?: number
  lastSuccessAt?: number
  lastError?: string
  records: WebSiteAnnouncementRecord[]
}

export interface WebSiteAnnouncementListResponse {
  records: WebSiteAnnouncementRecord[]
  sites: WebSiteAnnouncementSiteState[]
  unreadCount: number
  revision: number
  lastUpdated: number
}

export interface WebSiteAnnouncementSyncResponse
  extends WebSiteAnnouncementListResponse {
  sync: {
    checked: number
    created: number
    failed: number
    unsupported: number
    skipped: number
  }
}

export interface WebSiteAnnouncementSyncInput {
  accountIds?: string[]
}

export interface WebSiteAnnouncementReadInput {
  siteKey?: string
}

export interface WebCheckInAccountResult {
  accountId: string
  accountName: string
  methodId?: string
  status:
    | "success"
    | "already_checked"
    | "failed"
    | "skipped"
    | "browser_required"
  message?: string
  reason?: string
}

export interface WebCheckInRunSummary {
  trigger: "manual" | "scheduled"
  startedAt: number
  finishedAt: number
  total: number
  succeeded: number
  alreadyChecked: number
  failed: number
  skipped: number
  browserRequired: number
  results: WebCheckInAccountResult[]
  persistence?: "persisted" | "revision_conflict" | "failed"
}

export interface WebCheckInRunResponse extends WebAccountListResponse {
  checkIn: WebCheckInRunSummary
}

export interface WebBalanceHistoryEntry {
  accountId: string
  accountName: string
  day: string
  balanceUsd: number
  incomeUsd: number | null
  consumptionUsd: number | null
  capturedAt: number
  source: "refresh" | "alarm"
}

export interface WebBalanceHistoryResponse {
  entries: WebBalanceHistoryEntry[]
  revision: number
}

export interface WebUsageHistoryEntry {
  accountId: string
  accountName: string
  day: string
  requests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  consumedUsd: number
}

export interface WebUsageHistoryResponse {
  entries: WebUsageHistoryEntry[]
  revision: number
  statuses: Array<{
    accountId: string
    accountName: string
    state: "never" | "success" | "error" | "unsupported"
    lastSyncAt?: number
    error?: string
  }>
}

export interface WebUsageHistorySyncResponse extends WebUsageHistoryResponse {
  sync: {
    total: number
    succeeded: number
    failed: number
    ingested: number
    partial: number
  }
}

export interface WebUsageAnalyticsQuery {
  accountIds?: string[]
  startDay?: string
  endDay?: string
}

export interface WebUsageAnalyticsAggregate {
  requests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  consumedUsd: number
}

export interface WebUsageAnalyticsResponse {
  selection: {
    accountIds: string[]
    startDay: string
    endDay: string
  }
  availableRange: {
    minDay?: string
    maxDay?: string
  }
  totals: WebUsageAnalyticsAggregate
  daily: Array<{ day: string } & WebUsageAnalyticsAggregate>
  accounts: Array<{
    accountId: string
    accountName: string
    aggregate: WebUsageAnalyticsAggregate
  }>
  models: Array<{
    model: string
    aggregate: WebUsageAnalyticsAggregate
  }>
  latency: {
    count: number
    averageSeconds: number
    maxSeconds: number
    slowCount: number
    unknownCount: number
  }
  statuses: WebUsageHistoryResponse["statuses"]
  revision: number
}

export type WebNotificationTask =
  | "account_refresh"
  | "auto_checkin"
  | "usage_history"
  | "balance_history"
  | "webdav_backup"
  | "site_announcements"

export const WEB_EXTERNAL_NOTIFICATION_CHANNELS = [
  "telegram",
  "feishu",
  "dingtalk",
  "wecom",
  "ntfy",
  "webhook",
] as const

export type WebExternalNotificationChannel =
  (typeof WEB_EXTERNAL_NOTIFICATION_CHANNELS)[number]

export interface WebExternalNotificationChannelState {
  enabled: boolean
  configured: boolean
}

export interface WebExternalNotificationSettingsResponse {
  enabled: boolean
  tasks: Record<WebNotificationTask, boolean>
  channels: Record<
    WebExternalNotificationChannel,
    WebExternalNotificationChannelState
  >
  revision: number
}

export interface WebExternalNotificationChannelInput {
  enabled: boolean
  botToken?: string
  chatId?: string
  webhookKey?: string
  secret?: string
  topicUrl?: string
  accessToken?: string
  url?: string
}

export interface WebExternalNotificationSettingsInput {
  enabled: boolean
  tasks: Record<WebNotificationTask, boolean>
  channels: Record<
    WebExternalNotificationChannel,
    WebExternalNotificationChannelInput
  >
  expectedRevision?: number
}

export interface WebExternalNotificationTestInput {
  channel: WebExternalNotificationChannel
}

export interface WebNotificationRecord {
  id: string
  task: WebNotificationTask
  status: "success" | "partial_success" | "failure"
  title: string
  message: string
  createdAt: number
  readAt?: number
  counts?: {
    total?: number
    success?: number
    failed?: number
    skipped?: number
  }
}

export interface WebNotificationListResponse {
  notifications: WebNotificationRecord[]
  unreadCount: number
  revision: number
}

export interface WebModelCatalogPrice {
  billingMode: "token" | "per-call"
  group?: string
  groupRatio: number
  precision?: "exact" | "estimated" | "unavailable"
  source?:
    | "none"
    | "official-rate-estimate"
    | "channel-pricing"
    | "provider-catalog"
  unavailableReason?: string
  inputUsdPerMillionTokens?: number
  outputUsdPerMillionTokens?: number
  cacheReadUsdPerMillionTokens?: number
  cacheWriteUsdPerMillionTokens?: number
  usdPerCall?: number | { input: number; output: number }
}

export interface WebModelCatalogModel {
  id: string
  displayName?: string
  vendor?: string
  description?: string
  enableGroups?: string[]
  supportedEndpointTypes?: string[]
  prices?: WebModelCatalogPrice[]
}

export interface WebModelCatalogResponse {
  accountId: string
  accountName: string
  supported: boolean
  supportsPricing?: boolean
  models: WebModelCatalogModel[]
}

export type WebAccountModelCatalogStatus =
  | "success"
  | "error"
  | "unsupported"
  | "skipped"

export interface WebAccountModelCatalogResult {
  accountId: string
  accountName: string
  siteType: AccountSiteType
  disabled: boolean
  status: WebAccountModelCatalogStatus
  supportsPricing?: boolean
  models: WebModelCatalogModel[]
  error?: string
}

export interface WebAllModelCatalogOffer
  extends Omit<WebModelCatalogModel, "id"> {
  accountId: string
  accountName: string
  siteType: AccountSiteType
  exchangeRate?: number
}

export interface WebAllModelCatalogResponse {
  accounts: WebAccountModelCatalogResult[]
  models: Array<{
    id: string
    displayName?: string
    vendor?: string
    description?: string
    accounts: WebAllModelCatalogOffer[]
  }>
  startedAt: number
  finishedAt: number
  summary: {
    total: number
    succeeded: number
    failed: number
    unsupported: number
    skipped: number
    modelCount: number
  }
}

/** Public, masked representation of a standalone API credential profile. */
export interface WebApiCredentialProfileSummary {
  id: string
  name: string
  apiType: "openai-compatible" | "openai" | "anthropic" | "google"
  baseUrl: string
  apiKeyMasked: string
  tagIds: string[]
  notes: string
  expiresAt?: number
  createdAt: number
  updatedAt: number
}

export interface WebApiCredentialProfileListResponse {
  profiles: WebApiCredentialProfileSummary[]
  revision: number
}

export interface WebApiCredentialProfileCreateInput {
  name: string
  apiType: WebApiCredentialProfileSummary["apiType"]
  baseUrl: string
  apiKey: string
  tagIds?: string[]
  notes?: string
  expiresAt?: number | null
}

export interface WebApiCredentialProfileUpdateInput {
  name?: string
  apiType?: WebApiCredentialProfileSummary["apiType"]
  baseUrl?: string
  /** Empty values preserve the existing secret; a non-empty value rotates it. */
  apiKey?: string
  tagIds?: string[]
  notes?: string
  expiresAt?: number | null
}

export const WEB_CREDENTIAL_EXPORT_FORMATS = ["json", "env"] as const
export type WebCredentialExportFormat =
  (typeof WEB_CREDENTIAL_EXPORT_FORMATS)[number]

/** Plaintext client configuration returned only for an explicit export action. */
export interface WebApiCredentialProfileExportResponse {
  filename: string
  contentType: "application/json" | "text/plain"
  content: string
}

export interface WebApiCredentialProfileModelCatalogResponse {
  profileId: string
  profileName: string
  supported: boolean
  models: Array<{ id: string }>
}

export interface WebApiCredentialProfileVerificationResponse {
  profileId: string
  profileName: string
  report: {
    baseUrl: string
    apiType: WebApiCredentialProfileSummary["apiType"]
    modelId?: string
    startedAt: number
    finishedAt: number
    results: Array<{
      id: string
      status: "pass" | "fail" | "unsupported"
      latencyMs: number
      summary: string
      summaryKey?: string
      summaryParams?: Record<string, unknown>
      input?: unknown
      output?: unknown
      details?: Record<string, unknown>
    }>
  }
}

export interface WebApiKeySummary {
  id: number | string
  name: string
  status: number
  createdAt: number
  accessedAt: number
  expiresAt: number
  remainingQuota: number
  usedQuota: number
  unlimitedQuota: boolean
  group?: string
  modelLimits?: string
  allowIps?: string
}

export interface WebApiKeyListResponse {
  accountId: string
  accountName: string
  supported: boolean
  keys: WebApiKeySummary[]
}

export interface WebApiKeyMutationInput {
  name: string
  remainingQuota: number
  expiresAt: number
  unlimitedQuota: boolean
  modelLimitsEnabled: boolean
  modelLimits: string
  allowIps: string
  group: string
}

export interface WebApiKeyMutationResponse extends WebApiKeyListResponse {
  createdSecret?: string
}

export interface WebManagedSiteConnection {
  id: string
  name: string
  siteType:
    | "new-api"
    | "Veloera"
    | "done-hub"
    | "octopus"
    | "sub2api"
    | "axonhub"
    | "claude-code-hub"
  baseUrl: string
  userId: string
  createdAt: number
}

export interface WebManagedSiteConnectionInput {
  name: string
  siteType: WebManagedSiteConnection["siteType"]
  baseUrl: string
  adminToken: string
  userId: string
  username?: string
  password?: string
  email?: string
}

export interface WebManagedSiteConnectionListResponse {
  connections: WebManagedSiteConnection[]
  revision: number
}

export interface WebManagedChannelSummary {
  id: number
  name: string
  type: number | string
  status: number
  baseUrl: string
  modelCount: number
  models: string[]
  groups: string[]
  priority: number
  weight: number
  enabled: boolean
}

export interface WebManagedChannelListResponse {
  connection: WebManagedSiteConnection
  channels: WebManagedChannelSummary[]
  total: number
}

export interface WebManagedModelSyncItem {
  channelId: number
  channelName: string
  ok: boolean
  attempts: number
  finishedAt: number
  oldModels: string[]
  newModels?: string[]
  httpStatus?: number
  message?: string
}

export interface WebManagedModelSyncResponse {
  connection: WebManagedSiteConnection
  startedAt: number
  finishedAt: number
  items: WebManagedModelSyncItem[]
  summary: {
    total: number
    succeeded: number
    failed: number
    changed: number
  }
}

export interface WebManagedModelSyncInput {
  channelIds?: number[]
  concurrency?: number
  maxRetries?: number
}

export interface WebManagedChannelInput {
  name: string
  type: number | string
  credential: string
  baseUrl: string
  models: string[]
  groups: string[]
  priority: number
  weight: number
  enabled: boolean
}

export const WEB_BACKUP_TYPE = "all-api-hub-web-backup" as const
export const WEB_BACKUP_VERSION = 1 as const

export interface WebBackupDocument {
  key: string
  data: unknown
  revision: number
  updatedAt: number
}

export interface WebBackup {
  type: typeof WEB_BACKUP_TYPE
  version: typeof WEB_BACKUP_VERSION
  createdAt: number
  documents: WebBackupDocument[]
}

export interface WebBackupRestoreResponse {
  restoredDocuments: number
}

export interface WebDavRunSummary {
  trigger: "manual" | "scheduled"
  status: "success" | "failed"
  startedAt: number
  finishedAt: number
  error?: string
}

export interface WebDavSettings {
  url: string
  username: string
  configured: boolean
  autoBackupEnabled: boolean
  intervalMinutes: number
  encryptionEnabled: boolean
}

export interface WebDavSettingsResponse {
  settings: WebDavSettings
  revision: number
  lastRun?: WebDavRunSummary
  runtime: {
    running: boolean
    nextRunAt?: number
  }
}

export interface WebDavSettingsInput {
  url: string
  username: string
  password?: string
  autoBackupEnabled: boolean
  intervalMinutes: number
  encryptionEnabled: boolean
  encryptionPassword?: string
  expectedRevision?: number
}

export interface WebCreateAccountInput {
  name: string
  baseUrl: string
  siteType: AccountSiteType
  authType: AuthTypeEnum
  accessToken?: string
  sessionCookie?: string
  userId?: string
  username?: string
  exchangeRate?: number
  tagIds?: string[]
  notes?: string
  expectedRevision?: number
}

/** Credentials supplied transiently to the Web account auto-detect endpoint. */
export interface WebAccountDetectionInput {
  baseUrl: string
  siteType?: AccountSiteType
  authType: AuthTypeEnum
  accessToken?: string
  sessionCookie?: string
}

/** Sanitized account details returned by a Web auto-detect request. */
export interface WebAccountDetectionResponse {
  baseUrl: string
  siteType: AccountSiteType
  siteName: string
  userId: string
  username: string
  exchangeRate: number
  authType: AuthTypeEnum
}

export interface WebAccountPatchInput {
  name?: string
  baseUrl?: string
  authType?: AuthTypeEnum
  accessToken?: string
  sessionCookie?: string
  userId?: string
  username?: string
  exchangeRate?: number
  disabled?: boolean
  pinned?: boolean
  tagIds?: string[]
  notes?: string
  expectedRevision?: number
}

export const WEB_ACCOUNT_BULK_ACTIONS = ["enable", "disable", "delete"] as const

export type WebAccountBulkAction = (typeof WEB_ACCOUNT_BULK_ACTIONS)[number]

export interface WebAccountBulkMutationInput {
  accountIds: string[]
  action: WebAccountBulkAction
  expectedRevision?: number
}

export interface WebAccountOrderInput {
  accountIds: string[]
  expectedRevision?: number
}

export interface WebTagSummary {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface WebTagListResponse {
  tags: WebTagSummary[]
  revision: number
}

export interface WebTagMutationInput {
  name: string
  expectedRevision?: number
}

export interface WebTagDeleteResponse extends WebTagListResponse {
  accountsRevision: number
  credentialProfilesRevision: number
  updatedAccounts: number
  updatedBookmarks: number
  updatedCredentialProfiles: number
}

export interface WebImportAccountsInput {
  data: unknown
  expectedRevision?: number
}

export interface WebApiErrorPayload {
  error: string
  code?: string
  details?: unknown
}

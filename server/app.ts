import { existsSync } from "node:fs"
import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { csrf } from "hono/csrf"
import { secureHeaders } from "hono/secure-headers"
import { z } from "zod"

import { isAccountSiteType } from "~/constants/siteType"
import { normalizeAccountSiteUrlForStorage } from "~/services/accounts/utils/siteUrlNormalization"
import { API_TYPES } from "~/services/verification/aiApiVerification"
import type { ApiVerificationApiType } from "~/services/verification/aiApiVerification"
import { toSanitizedErrorSummary } from "~/services/verification/aiApiVerification/utils"
import { AuthTypeEnum, SiteHealthStatus } from "~/types"
import {
  WEB_ACCOUNT_BULK_ACTIONS,
  WEB_CURRENCY_TYPES,
  WEB_SORT_ORDERS,
  WEB_THEME_MODES,
  type WebAccountBulkMutationInput,
  type WebAccountListResponse,
  type WebAccountOrderInput,
  type WebAccountPatchInput,
  type WebAccountRefreshResponse,
  type WebApiErrorPayload,
  type WebApiCredentialProfileExportResponse,
  type WebApiVerificationResponse,
  type WebAutomationSettingsPatch,
  type WebBackup,
  type WebBatchAccountRefreshResponse,
  type WebBookmarkCreateInput,
  type WebBookmarkPatchInput,
  type WebChannelConfigPatch,
  type WebCheckInRunResponse,
  type WebCreateAccountInput,
  type WebDavSettingsInput,
  type WebExternalNotificationSettingsInput,
  type WebManagedChannelInput,
  type WebManagedModelSyncInput,
  type WebManagedSiteConnectionInput,
  type WebMutationResponse,
  type WebPreferencesPatch,
  type WebTagDeleteResponse,
  type WebTagMutationInput,
  type WebUsageHistorySyncResponse,
} from "~/web/contracts"

import { createWebAccount } from "./accountFactory"
import { AccountDetectionService } from "./accountDetectionService"
import type { AccountRefreshScheduler } from "./accountRefreshScheduler"
import {
  AccountRefreshService,
  AccountRefreshUnavailableError,
} from "./accountRefreshService"
import {
  AccountNotFoundError,
  BookmarkNotFoundError,
  InvalidAccountOrderError,
  RevisionConflictError,
  toWebAccountSummary,
  toWebBookmarkListResponse,
} from "./accountsRepository"
import type { AccountsRepository } from "./accountsRepository"
import { UnsupportedApiCredentialProfilesVersionError } from "./apiCredentialProfileRepository"
import type { ApiCredentialProfileRepository } from "./apiCredentialProfileRepository"
import {
  clearWebSession,
  createWebSession,
  hasValidWebSession,
  LoginAttemptLimiter,
  verifyAdminPassword,
} from "./auth"
import type { AutomationSettingsRepository } from "./automationSettingsRepository"
import { webBackupSchema } from "./backupService"
import type { BackupService } from "./backupService"
import type { BalanceHistoryRepository } from "./balanceHistoryRepository"
import {
  ChannelConfigRepository,
  coerceChannelConfigSnapshot,
} from "./channelConfigRepository"
import type { CheckInScheduler } from "./checkInScheduler"
import type { WebServerConfig } from "./config"
import type { ExternalNotificationService } from "./externalNotificationService"
import type { KeyManagementService } from "./keyManagementService"
import type { ManagedSiteRepository } from "./managedSiteRepository"
import type { ManagedSiteService } from "./managedSiteService"
import type { ModelCatalogService } from "./modelCatalogService"
import type { NotificationRepository } from "./notificationRepository"
import type { NotificationService } from "./notificationService"
import { WebPreferencesRepository } from "./preferencesRepository"
import { getWebRuntimeCapabilities } from "./runtimeCapabilities"
import type { SiteAnnouncementScheduler } from "./siteAnnouncementScheduler"
import type { SiteAnnouncementService } from "./siteAnnouncementService"
import { assertSafeUpstreamUrl, UnsafeUpstreamUrlError } from "./ssrfGuard"
import {
  InvalidTagNameError,
  TagNotFoundError,
  UnknownTagIdsError,
} from "./tagRepository"
import type { TagRepository } from "./tagRepository"
import type { UsageHistoryRepository } from "./usageHistoryRepository"
import type { UsageHistoryService } from "./usageHistoryService"
import type { WebDavService } from "./webDavService"

const MAX_IMPORT_BYTES = 50 * 1024 * 1024

const isHttpUrl = (value: string) => {
  try {
    const protocol = new URL(value).protocol
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const isApiPath = (path: string) => path === "/api" || path.startsWith("/api/")

const loginSchema = z.object({
  password: z.string().min(1).max(4096),
})

const optionalRevisionSchema = z.number().int().nonnegative().optional()

const webPreferencesPatchSchema = z
  .object({
    themeMode: z.enum(WEB_THEME_MODES).optional(),
    language: z.string().trim().max(64).optional(),
    currencyType: z.enum(WEB_CURRENCY_TYPES).optional(),
    showTodayCashflow: z.boolean().optional(),
    sortField: z
      .union([
        z.literal(null),
        z.literal("cashflow"),
        z.literal("consumption"),
        z.literal("income"),
        z.literal("balance"),
        z.literal("created_at"),
      ])
      .optional(),
    sortOrder: z.enum(WEB_SORT_ORDERS).optional(),
    showHealthStatus: z.boolean().optional(),
    expectedRevision: optionalRevisionSchema,
  })
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) =>
          key !== "expectedRevision" &&
          value[key as keyof typeof value] !== undefined,
      ),
    "At least one preference field is required",
  )

const channelConfigPatchSchema = z.object({
  managedSiteType: z.string().trim().min(1).max(128),
  scopeKey: z.string().trim().min(1).max(2048),
  resourceId: z.union([
    z.string().trim().min(1).max(256),
    z.number().int().positive(),
  ]),
  channelId: z.number().int().positive().optional(),
  rules: z.array(z.unknown()).max(1000),
  expectedRevision: optionalRevisionSchema,
})

const tagIdsSchema = z
  .array(z.string().trim().min(1).max(128))
  .max(128)
  .refine(
    (tagIds) => new Set(tagIds).size === tagIds.length,
    "Tag ids must be unique",
  )

const createAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    baseUrl: z
      .url()
      .max(2048)
      .refine(isHttpUrl, "Only HTTP and HTTPS account URLs are supported"),
    siteType: z.string().refine(isAccountSiteType, "Unknown account site type"),
    authType: z.enum([
      AuthTypeEnum.AccessToken,
      AuthTypeEnum.Cookie,
      AuthTypeEnum.None,
    ]),
    accessToken: z.string().max(100_000).optional(),
    sessionCookie: z.string().max(200_000).optional(),
    userId: z.string().max(256).optional(),
    username: z.string().max(256).optional(),
    exchangeRate: z.number().positive().max(10_000).optional(),
    tagIds: tagIdsSchema.optional(),
    notes: z.string().max(4000).optional(),
    expectedRevision: optionalRevisionSchema,
  })
  .superRefine((value, context) => {
    if (
      value.authType === AuthTypeEnum.AccessToken &&
      !value.accessToken?.trim()
    ) {
      context.addIssue({
        code: "custom",
        message: "Access token is required for access-token authentication",
        path: ["accessToken"],
      })
    }
    if (
      value.authType === AuthTypeEnum.Cookie &&
      !value.sessionCookie?.trim()
    ) {
      context.addIssue({
        code: "custom",
        message: "Session cookie is required for cookie authentication",
        path: ["sessionCookie"],
      })
    }
  })

const accountDetectionSchema = z
  .object({
    baseUrl: z
      .url()
      .max(2048)
      .refine(isHttpUrl, "Only HTTP and HTTPS account URLs are supported"),
    siteType: z
      .string()
      .trim()
      .optional()
      .refine((value) => value === undefined || isAccountSiteType(value), {
        message: "Unknown account site type",
      }),
    authType: z.enum([
      AuthTypeEnum.AccessToken,
      AuthTypeEnum.Cookie,
      AuthTypeEnum.None,
    ]),
    accessToken: z.string().max(100_000).optional(),
    sessionCookie: z.string().max(200_000).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.authType === AuthTypeEnum.AccessToken &&
      !value.accessToken?.trim()
    ) {
      context.addIssue({
        code: "custom",
        message: "Access token is required for account detection",
        path: ["accessToken"],
      })
    }
    if (
      value.authType === AuthTypeEnum.Cookie &&
      !value.sessionCookie?.trim()
    ) {
      context.addIssue({
        code: "custom",
        message: "Session cookie is required for account detection",
        path: ["sessionCookie"],
      })
    }
  })

const patchAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    baseUrl: z
      .url()
      .max(2048)
      .refine(isHttpUrl, "Only HTTP and HTTPS account URLs are supported")
      .optional(),
    authType: z
      .enum([AuthTypeEnum.AccessToken, AuthTypeEnum.Cookie, AuthTypeEnum.None])
      .optional(),
    accessToken: z.string().max(100_000).optional(),
    sessionCookie: z.string().max(200_000).optional(),
    userId: z.string().max(256).optional(),
    username: z.string().max(256).optional(),
    exchangeRate: z.number().positive().max(10_000).optional(),
    disabled: z.boolean().optional(),
    pinned: z.boolean().optional(),
    tagIds: tagIdsSchema.optional(),
    notes: z.string().max(4000).optional(),
    expectedRevision: optionalRevisionSchema,
  })
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) =>
          key !== "expectedRevision" &&
          value[key as keyof typeof value] !== undefined,
      ),
    "At least one account field is required",
  )

const bulkAccountMutationSchema = z.object({
  accountIds: z
    .array(z.string().trim().min(1).max(256))
    .min(1)
    .max(1000)
    .refine(
      (accountIds) => new Set(accountIds).size === accountIds.length,
      "Account ids must be unique",
    ),
  action: z.enum(WEB_ACCOUNT_BULK_ACTIONS),
  expectedRevision: optionalRevisionSchema,
})

const accountOrderSchema = z.object({
  accountIds: z.array(z.string().trim().min(1).max(256)).max(1000),
  expectedRevision: optionalRevisionSchema,
})

const importSchema = z.object({
  data: z.unknown(),
  expectedRevision: optionalRevisionSchema,
})

const bookmarkCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z
    .url()
    .max(2048)
    .refine(isHttpUrl, "Only HTTP and HTTPS bookmark URLs are supported"),
  tagIds: tagIdsSchema.optional(),
  notes: z.string().max(4000).optional(),
  expectedRevision: optionalRevisionSchema,
})

const bookmarkPatchSchema = bookmarkCreateSchema
  .omit({ expectedRevision: true })
  .partial()
  .extend({
    pinned: z.boolean().optional(),
    expectedRevision: optionalRevisionSchema,
  })
  .refine(
    (value) =>
      Object.values(value).some(
        (item) => item !== undefined && item !== value.expectedRevision,
      ),
    "At least one bookmark field is required",
  )

const deleteQuerySchema = z.object({
  revision: z.coerce.number().int().nonnegative().optional(),
})

const tagMutationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  expectedRevision: optionalRevisionSchema,
})

const tagDeleteQuerySchema = z.object({
  revision: z.coerce.number().int().nonnegative().optional(),
  accountsRevision: z.coerce.number().int().nonnegative().optional(),
})

const refreshAccountSchema = z.object({
  expectedRevision: optionalRevisionSchema,
  includeTodayCashflow: z.boolean().optional(),
})

const refreshAccountsSchema = refreshAccountSchema.extend({
  concurrency: z.number().int().min(1).max(8).optional(),
})

const automationSettingsPatchSchema = z.object({
  autoRefreshEnabled: z.boolean().optional(),
  autoRefreshIntervalMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60)
    .optional(),
  includeTodayCashflow: z.boolean().optional(),
  autoCheckinEnabled: z.boolean().optional(),
  autoCheckinTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/u)
    .optional(),
  balanceHistoryEnabled: z.boolean().optional(),
  balanceHistoryRetentionDays: z.number().int().min(7).max(3650).optional(),
  usageHistoryEnabled: z.boolean().optional(),
  usageHistoryRetentionDays: z.number().int().min(1).max(365).optional(),
  usageHistoryAfterRefresh: z.boolean().optional(),
  siteAnnouncementsEnabled: z.boolean().optional(),
  siteAnnouncementsIntervalMinutes: z
    .number()
    .int()
    .min(15)
    .max(24 * 60)
    .optional(),
  siteAnnouncementNotificationsEnabled: z.boolean().optional(),
  expectedRevision: optionalRevisionSchema,
})

const checkInRunSchema = z.object({
  expectedRevision: optionalRevisionSchema,
})

const usageHistorySyncSchema = z.object({
  accountIds: z.array(z.string().min(1)).max(500).optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
})

const usageAnalyticsQuerySchema = z.object({
  accountIds: z.string().trim().max(20_000).optional(),
  startDay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .optional(),
  endDay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .optional(),
})

const siteAnnouncementSyncSchema = z.object({
  accountIds: z.array(z.string().min(1)).max(500).optional(),
})

const siteAnnouncementReadSchema = z.object({
  siteKey: z.string().trim().min(1).max(2048).optional(),
})

const allModelsQuerySchema = z.object({
  concurrency: z.coerce.number().int().min(1).max(8).optional(),
})

const keyMutationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  remainingQuota: z.number().nonnegative(),
  expiresAt: z.number().int(),
  unlimitedQuota: z.boolean(),
  modelLimitsEnabled: z.boolean(),
  modelLimits: z.string().max(20_000),
  allowIps: z.string().max(20_000),
  group: z.string().max(256),
})

const managedConnectionSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    siteType: z.enum([
      "new-api",
      "Veloera",
      "done-hub",
      "octopus",
      "sub2api",
      "axonhub",
      "claude-code-hub",
    ]),
    baseUrl: z
      .url()
      .max(2048)
      .refine(isHttpUrl, "Only HTTP and HTTPS managed-site URLs are supported"),
    adminToken: z.string().trim().max(100_000),
    userId: z.string().trim().max(256),
    username: z.string().trim().max(256).optional(),
    password: z.string().max(100_000).optional(),
    email: z.string().trim().email().max(320).optional(),
  })
  .superRefine((value, context) => {
    if (value.siteType === "octopus") {
      if (!value.username)
        context.addIssue({
          code: "custom",
          path: ["username"],
          message: "Username is required",
        })
      if (!value.password)
        context.addIssue({
          code: "custom",
          path: ["password"],
          message: "Password is required",
        })
    } else if (value.siteType === "axonhub") {
      if (!value.email)
        context.addIssue({
          code: "custom",
          path: ["email"],
          message: "Email is required",
        })
      if (!value.password)
        context.addIssue({
          code: "custom",
          path: ["password"],
          message: "Password is required",
        })
    } else {
      if (!value.adminToken)
        context.addIssue({
          code: "custom",
          path: ["adminToken"],
          message: "Admin token is required",
        })
      if (
        value.siteType !== "sub2api" &&
        value.siteType !== "claude-code-hub" &&
        !value.userId
      )
        context.addIssue({
          code: "custom",
          path: ["userId"],
          message: "User id is required",
        })
    }
  })

const managedChannelSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.union([z.number().int(), z.string().trim().min(1)]),
  credential: z.string().max(200_000),
  baseUrl: z.string().max(2048),
  models: z.array(z.string().trim().min(1)).max(10_000),
  groups: z.array(z.string().trim().min(1)).max(1_000),
  priority: z.number().int(),
  weight: z.number().int(),
  enabled: z.boolean(),
})

const managedModelSyncSchema = z.object({
  channelIds: z.array(z.number().int().positive()).max(10_000).optional(),
  concurrency: z.number().int().min(1).max(8).optional(),
  maxRetries: z.number().int().min(0).max(3).optional(),
})

const webDavSettingsSchema = z.object({
  url: z
    .url()
    .max(2048)
    .refine(isHttpUrl, "Only HTTP and HTTPS WebDAV URLs are supported"),
  username: z.string().trim().min(1).max(512),
  password: z.string().max(100_000).optional(),
  autoBackupEnabled: z.boolean(),
  intervalMinutes: z
    .number()
    .int()
    .min(15)
    .max(7 * 24 * 60),
  encryptionEnabled: z.boolean(),
  encryptionPassword: z.string().max(100_000).optional(),
  expectedRevision: optionalRevisionSchema,
})

const externalNotificationChannelSchema = z.object({
  enabled: z.boolean(),
  botToken: z.string().max(100_000).optional(),
  chatId: z.string().max(1024).optional(),
  webhookKey: z.string().max(4096).optional(),
  secret: z.string().max(100_000).optional(),
  topicUrl: z.string().max(4096).optional(),
  accessToken: z.string().max(100_000).optional(),
  url: z.string().max(4096).optional(),
})

const externalNotificationSettingsSchema = z.object({
  enabled: z.boolean(),
  tasks: z.object({
    account_refresh: z.boolean(),
    auto_checkin: z.boolean(),
    usage_history: z.boolean(),
    balance_history: z.boolean(),
    webdav_backup: z.boolean(),
    site_announcements: z.boolean().optional().default(true),
  }),
  channels: z.object({
    telegram: externalNotificationChannelSchema,
    feishu: externalNotificationChannelSchema,
    dingtalk: externalNotificationChannelSchema,
    wecom: externalNotificationChannelSchema,
    ntfy: externalNotificationChannelSchema,
    webhook: externalNotificationChannelSchema,
  }),
  expectedRevision: optionalRevisionSchema,
})

const externalNotificationTestSchema = z.object({
  channel: z.enum([
    "telegram",
    "feishu",
    "dingtalk",
    "wecom",
    "ntfy",
    "webhook",
  ]),
})

const apiCredentialProfileApiTypeSchema = z.enum([
  API_TYPES.OPENAI_COMPATIBLE,
  API_TYPES.OPENAI,
  API_TYPES.ANTHROPIC,
  API_TYPES.GOOGLE,
])

const createApiCredentialProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  apiType: apiCredentialProfileApiTypeSchema,
  baseUrl: z
    .url()
    .max(2048)
    .refine(isHttpUrl, "Only HTTP and HTTPS profile URLs are supported"),
  apiKey: z.string().trim().min(1).max(200_000),
  tagIds: tagIdsSchema.optional(),
  notes: z.string().max(4000).optional(),
  expiresAt: z.number().int().positive().nullable().optional(),
})

const updateApiCredentialProfileSchema = createApiCredentialProfileSchema
  .omit({ apiKey: true })
  .partial()
  .extend({
    apiKey: z.string().trim().max(200_000).optional(),
    expiresAt: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one profile field is required",
  )

const verifyApiCredentialProfileSchema = z.object({
  modelId: z.string().trim().max(512).optional(),
})

const exportApiCredentialProfileSchema = z.object({
  format: z.enum(["json", "env"]).default("json"),
})

const webApiVerificationSchema = z.object({
  apiType: apiCredentialProfileApiTypeSchema,
  baseUrl: z
    .url()
    .max(2048)
    .refine(isHttpUrl, "Only HTTP and HTTPS verification URLs are supported"),
  apiKey: z.string().trim().min(1).max(200_000),
  modelId: z.string().trim().max(512).optional(),
})

class InvalidAccountPatchError extends Error {}

const apiError = (
  error: string,
  status: 400 | 401 | 404 | 409 | 413 | 429 | 500,
  code?: string,
  details?: unknown,
) => ({
  payload: { error, code, details } satisfies WebApiErrorPayload,
  status,
})

const toSafeExportStem = (value: string) => {
  const stem = value
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fff._-]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
  return stem || "api-credential"
}

const quoteEnvValue = (value: string) =>
  `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\r", "\\r").replaceAll("\n", "\\n")}"`

const toAccountListResponse = (
  document: ReturnType<AccountsRepository["getAccounts"]>,
): WebAccountListResponse => {
  const position = new Map(
    document.data.orderedAccountIds.map((id, index) => [id, index]),
  )
  const pinnedIds = new Set(document.data.pinnedAccountIds)
  const accounts = document.data.accounts
    .map((account) => toWebAccountSummary(account, pinnedIds.has(account.id)))
    .sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
      const leftPosition = position.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightPosition = position.get(right.id) ?? Number.MAX_SAFE_INTEGER
      return leftPosition - rightPosition || left.name.localeCompare(right.name)
    })

  return {
    accounts,
    revision: document.revision,
    lastUpdated: document.data.last_updated,
  }
}

export interface CreateWebAppOptions {
  config: WebServerConfig
  accountsRepository: AccountsRepository
  accountDetectionService?: AccountDetectionService
  accountRefreshService?: AccountRefreshService
  automationSettingsRepository: AutomationSettingsRepository
  accountRefreshScheduler: AccountRefreshScheduler
  checkInScheduler: CheckInScheduler
  balanceHistoryRepository: BalanceHistoryRepository
  usageHistoryRepository: UsageHistoryRepository
  usageHistoryService: UsageHistoryService
  notificationRepository: NotificationRepository
  notificationService: NotificationService
  modelCatalogService: ModelCatalogService
  keyManagementService: KeyManagementService
  managedSiteRepository: ManagedSiteRepository
  managedSiteService: ManagedSiteService
  backupService: BackupService
  webDavService: WebDavService
  externalNotificationService: ExternalNotificationService
  apiCredentialProfileRepository?: ApiCredentialProfileRepository
  siteAnnouncementService?: SiteAnnouncementService
  siteAnnouncementScheduler?: SiteAnnouncementScheduler
  tagRepository: TagRepository
  preferencesRepository?: WebPreferencesRepository
  channelConfigRepository?: ChannelConfigRepository
}

export function createWebApp({
  config,
  accountsRepository,
  accountDetectionService = new AccountDetectionService(),
  accountRefreshService = new AccountRefreshService(),
  automationSettingsRepository,
  accountRefreshScheduler,
  checkInScheduler,
  balanceHistoryRepository,
  usageHistoryRepository,
  usageHistoryService,
  notificationRepository,
  notificationService,
  modelCatalogService,
  keyManagementService,
  managedSiteRepository,
  managedSiteService,
  backupService,
  webDavService,
  externalNotificationService,
  apiCredentialProfileRepository,
  siteAnnouncementService,
  siteAnnouncementScheduler,
  tagRepository,
  preferencesRepository: providedPreferencesRepository,
  channelConfigRepository: providedChannelConfigRepository,
}: CreateWebAppOptions) {
  const app = new Hono()
  const loginAttemptLimiter = new LoginAttemptLimiter()
  const preferencesRepository =
    providedPreferencesRepository ??
    new WebPreferencesRepository(accountsRepository.getDocumentStore())
  const channelConfigRepository =
    providedChannelConfigRepository ??
    new ChannelConfigRepository(accountsRepository.getDocumentStore())
  const announcements = siteAnnouncementService
  const announcementScheduler = siteAnnouncementScheduler

  const getAutomationResponse = () => {
    const response = accountRefreshScheduler.getResponse()
    return {
      ...response,
      runtime: {
        ...response.runtime,
        ...checkInScheduler.getStatus(),
        ...(announcementScheduler?.getStatus() ?? {}),
      },
    }
  }

  app.use("*", secureHeaders())
  app.use("/api/*", async (context, next) => {
    context.header("Cache-Control", "no-store")
    await next()
  })
  app.use("/api/*", csrf())
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: MAX_IMPORT_BYTES,
      onError: (context) => {
        const error = apiError(
          "Request body is too large",
          413,
          "REQUEST_TOO_LARGE",
        )
        return context.json(error.payload, error.status)
      },
    }),
  )

  app.use("/api/*", async (context, next) => {
    const publicPath =
      context.req.path === "/api/health" || context.req.path === "/api/session"
    if (publicPath || (await hasValidWebSession(context, config))) {
      await next()
      return
    }

    const error = apiError("Authentication required", 401, "UNAUTHORIZED")
    return context.json(error.payload, error.status)
  })

  app.get("/api/health", (context) =>
    context.json({ status: "ok", runtime: "web" }),
  )

  app.get("/api/session", async (context) =>
    context.json({
      authenticated: await hasValidWebSession(context, config),
    }),
  )

  app.post("/api/session", async (context) => {
    const retryAfter = loginAttemptLimiter.getRetryAfterSeconds()
    if (retryAfter > 0) {
      context.header("Retry-After", String(retryAfter))
      const error = apiError(
        "Too many failed login attempts; try again later",
        429,
        "LOGIN_RATE_LIMITED",
      )
      return context.json(error.payload, error.status)
    }

    const parsed = loginSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid login request",
        400,
        "INVALID_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    if (!verifyAdminPassword(parsed.data.password, config.adminPassword)) {
      loginAttemptLimiter.recordFailure()
      const error = apiError(
        "Invalid administrator password",
        401,
        "INVALID_CREDENTIALS",
      )
      return context.json(error.payload, error.status)
    }

    loginAttemptLimiter.reset()
    await createWebSession(context, config)
    return context.json({ authenticated: true })
  })

  app.delete("/api/session", (context) => {
    clearWebSession(context, config)
    return context.json({ authenticated: false })
  })

  app.get("/api/accounts", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(toAccountListResponse(accountsRepository.getAccounts()))
  })

  app.post("/api/accounts/detect", async (context) => {
    const parsed = accountDetectionSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid account detection request",
        400,
        "INVALID_ACCOUNT_DETECTION",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    try {
      const detected = await accountDetectionService.detect(parsed.data)
      return context.json(detected)
    } catch (error) {
      const safeMessage = toSanitizedErrorSummary(error, [
        parsed.data.accessToken ?? "",
        parsed.data.sessionCookie ?? "",
      ])
      const response = apiError(
        safeMessage || "账户自动识别失败",
        400,
        "ACCOUNT_DETECTION_FAILED",
      )
      return context.json(response.payload, response.status)
    }
  })

  app.get("/api/tags", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(tagRepository.list())
  })

  app.get("/api/settings/preferences", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(preferencesRepository.get())
  })

  app.patch("/api/settings/preferences", async (context) => {
    const parsed = webPreferencesPatchSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid Web preference payload",
        400,
        "INVALID_WEB_PREFERENCES",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    context.header("Cache-Control", "no-store")
    return context.json(
      preferencesRepository.update(parsed.data as WebPreferencesPatch),
    )
  })

  app.get("/api/channel-configs", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(channelConfigRepository.get())
  })

  app.put("/api/channel-configs", async (context) => {
    const payload = await context.req.json()
    const snapshot = coerceChannelConfigSnapshot(
      isRecord(payload) && "snapshot" in payload ? payload.snapshot : payload,
    )
    const expectedRevision =
      isRecord(payload) && typeof payload.expectedRevision === "number"
        ? payload.expectedRevision
        : undefined
    if (!snapshot) {
      const error = apiError(
        "Invalid channel config snapshot",
        400,
        "INVALID_CHANNEL_CONFIGS",
      )
      return context.json(error.payload, error.status)
    }
    context.header("Cache-Control", "no-store")
    return context.json(
      channelConfigRepository.replaceSnapshot(snapshot, expectedRevision),
    )
  })

  app.patch("/api/channel-configs", async (context) => {
    const parsed = channelConfigPatchSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid channel config payload",
        400,
        "INVALID_CHANNEL_CONFIG",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    context.header("Cache-Control", "no-store")
    return context.json(
      channelConfigRepository.upsert(parsed.data as WebChannelConfigPatch),
    )
  })

  app.get("/api/runtime/capabilities", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(getWebRuntimeCapabilities())
  })

  /**
   * Run transient API checks from the Web console. The credential is accepted
   * only for this request and is never included in the response or persisted.
   */
  app.post("/api/verification/models", async (context) => {
    const parsed = webApiVerificationSchema.safeParse(
      await context.req.json(),
    )
    if (!parsed.success) {
      const error = apiError(
        "Invalid API verification request",
        400,
        "INVALID_VERIFICATION_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    try {
      await assertSafeUpstreamUrl(parsed.data.baseUrl, "Verification")
      const {
        fetchApiCredentialModelIds,
        normalizeApiCredentialModelIds,
      } = await import("~/services/apiCredentialProfiles/modelCatalog")
      const modelIds = normalizeApiCredentialModelIds(
        await fetchApiCredentialModelIds({
          apiType: parsed.data.apiType,
          baseUrl: parsed.data.baseUrl,
          apiKey: parsed.data.apiKey,
        }),
      )
      context.header("Cache-Control", "no-store")
      return context.json({ modelIds })
    } catch (error) {
      const safeMessage = toSanitizedErrorSummary(error, [parsed.data.apiKey])
      const response = apiError(
        safeMessage || "API 模型列表获取失败",
        400,
        "VERIFICATION_MODELS_FAILED",
      )
      return context.json(response.payload, response.status)
    }
  })

  app.post("/api/verification/run", async (context) => {
    const parsed = webApiVerificationSchema.safeParse(
      await context.req.json(),
    )
    if (!parsed.success) {
      const error = apiError(
        "Invalid API verification request",
        400,
        "INVALID_VERIFICATION_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    try {
      await assertSafeUpstreamUrl(parsed.data.baseUrl, "Verification")
      const { runApiVerification } = await import(
        "~/services/verification/aiApiVerification"
      )
      const report = await runApiVerification({
        baseUrl: parsed.data.baseUrl,
        apiType: parsed.data.apiType,
        apiKey: parsed.data.apiKey,
        modelId: parsed.data.modelId,
      })
      const response = {
        report,
      } satisfies WebApiVerificationResponse
      context.header("Cache-Control", "no-store")
      return context.json(response)
    } catch (error) {
      const safeMessage = toSanitizedErrorSummary(error, [parsed.data.apiKey])
      const response = apiError(
        safeMessage || "API 验证失败",
        400,
        "VERIFICATION_FAILED",
      )
      return context.json(response.payload, response.status)
    }
  })

  app.get("/api/bookmarks", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(
      toWebBookmarkListResponse(accountsRepository.getBookmarks()),
    )
  })

  app.post("/api/bookmarks", async (context) => {
    const parsed = bookmarkCreateSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid bookmark payload",
        400,
        "INVALID_BOOKMARK",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    tagRepository.assertTagIdsExist(parsed.data.tagIds ?? [])
    const document = accountsRepository.createBookmark(
      parsed.data as WebBookmarkCreateInput,
    )
    context.header("Cache-Control", "no-store")
    return context.json(toWebBookmarkListResponse(document), 201)
  })

  app.patch("/api/bookmarks/:id", async (context) => {
    const parsed = bookmarkPatchSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid bookmark update",
        400,
        "INVALID_BOOKMARK_PATCH",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    if (parsed.data.tagIds !== undefined) {
      tagRepository.assertTagIdsExist(parsed.data.tagIds)
    }
    const document = accountsRepository.updateBookmark(
      context.req.param("id"),
      parsed.data as WebBookmarkPatchInput,
    )
    context.header("Cache-Control", "no-store")
    return context.json(toWebBookmarkListResponse(document))
  })

  app.delete("/api/bookmarks/:id", (context) => {
    const parsed = deleteQuerySchema.safeParse(context.req.query())
    if (!parsed.success) {
      const error = apiError(
        "Invalid revision query",
        400,
        "INVALID_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    const document = accountsRepository.deleteBookmark(
      context.req.param("id"),
      parsed.data.revision,
    )
    context.header("Cache-Control", "no-store")
    return context.json(toWebBookmarkListResponse(document))
  })

  app.get("/api/site-announcements", (context) => {
    if (!announcements) {
      const error = apiError(
        "Site announcements are unavailable",
        500,
        "SITE_ANNOUNCEMENTS_UNAVAILABLE",
      )
      return context.json(error.payload, error.status)
    }
    context.header("Cache-Control", "no-store")
    return context.json(announcements.getResponse())
  })

  app.post("/api/site-announcements/sync", async (context) => {
    if (!announcements || !announcementScheduler) {
      const error = apiError(
        "Site announcements are unavailable",
        500,
        "SITE_ANNOUNCEMENTS_UNAVAILABLE",
      )
      return context.json(error.payload, error.status)
    }
    const parsed = siteAnnouncementSyncSchema.safeParse(
      await context.req.json(),
    )
    if (!parsed.success) {
      const error = apiError(
        "Invalid site-announcement sync request",
        400,
        "INVALID_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    context.header("Cache-Control", "no-store")
    return context.json(await announcements.runNow(parsed.data.accountIds))
  })

  app.post("/api/site-announcements/:id/read", async (context) => {
    if (!announcements) {
      const error = apiError(
        "Site announcements are unavailable",
        500,
        "SITE_ANNOUNCEMENTS_UNAVAILABLE",
      )
      return context.json(error.payload, error.status)
    }
    context.header("Cache-Control", "no-store")
    return context.json(await announcements.markRead(context.req.param("id")))
  })

  app.post("/api/site-announcements/read-all", async (context) => {
    if (!announcements) {
      const error = apiError(
        "Site announcements are unavailable",
        500,
        "SITE_ANNOUNCEMENTS_UNAVAILABLE",
      )
      return context.json(error.payload, error.status)
    }
    const parsed = siteAnnouncementReadSchema.safeParse(
      await context.req.json(),
    )
    if (!parsed.success) {
      const error = apiError(
        "Invalid site-announcement read request",
        400,
        "INVALID_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    context.header("Cache-Control", "no-store")
    return context.json(announcements.markAllRead(parsed.data.siteKey))
  })

  app.get("/api/managed-sites", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(managedSiteRepository.list())
  })

  app.post("/api/managed-sites", async (context) => {
    const parsed = managedConnectionSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid managed-site connection",
        400,
        "INVALID_MANAGED_SITE",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    await assertSafeUpstreamUrl(parsed.data.baseUrl, "Managed site")
    return context.json(
      managedSiteRepository.create(
        parsed.data as WebManagedSiteConnectionInput,
      ),
      201,
    )
  })

  app.get("/api/managed-sites/:id/channels", async (context) => {
    const connection = managedSiteRepository.get(context.req.param("id"))
    if (!connection) {
      const error = apiError(
        "Managed site not found",
        404,
        "MANAGED_SITE_NOT_FOUND",
      )
      return context.json(error.payload, error.status)
    }
    context.header("Cache-Control", "no-store")
    return context.json(await managedSiteService.listChannels(connection))
  })

  app.post("/api/managed-sites/:id/model-sync", async (context) => {
    const connection = managedSiteRepository.get(context.req.param("id"))
    const parsed = managedModelSyncSchema.safeParse(await context.req.json())
    if (!connection || !parsed.success) {
      const error = apiError(
        "Invalid managed-site model sync request",
        400,
        "INVALID_MODEL_SYNC",
        parsed.success ? undefined : parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    context.header("Cache-Control", "no-store")
    return context.json(
      await managedSiteService.syncModels(
        connection,
        parsed.data as WebManagedModelSyncInput,
      ),
    )
  })

  app.post("/api/managed-sites/:id/channels", async (context) => {
    const connection = managedSiteRepository.get(context.req.param("id"))
    const parsed = managedChannelSchema.safeParse(await context.req.json())
    if (!connection || !parsed.success) {
      const error = apiError("Invalid managed channel", 400, "INVALID_CHANNEL")
      return context.json(error.payload, error.status)
    }
    return context.json(
      await managedSiteService.createChannel(
        connection,
        parsed.data as WebManagedChannelInput,
      ),
      201,
    )
  })

  app.put("/api/managed-sites/:id/channels/:channelId", async (context) => {
    const connection = managedSiteRepository.get(context.req.param("id"))
    const channelId = Number(context.req.param("channelId"))
    const parsed = managedChannelSchema.safeParse(await context.req.json())
    if (!connection || !Number.isInteger(channelId) || !parsed.success) {
      const error = apiError("Invalid managed channel", 400, "INVALID_CHANNEL")
      return context.json(error.payload, error.status)
    }
    return context.json(
      await managedSiteService.updateChannel(
        connection,
        channelId,
        parsed.data as WebManagedChannelInput,
      ),
    )
  })

  app.delete("/api/managed-sites/:id", (context) => {
    return context.json(managedSiteRepository.delete(context.req.param("id")))
  })

  app.delete("/api/managed-sites/:id/channels/:channelId", async (context) => {
    const connection = managedSiteRepository.get(context.req.param("id"))
    const channelId = Number(context.req.param("channelId"))
    if (!connection || !Number.isInteger(channelId)) {
      const error = apiError(
        "Managed channel not found",
        404,
        "CHANNEL_NOT_FOUND",
      )
      return context.json(error.payload, error.status)
    }
    return context.json(
      await managedSiteService.deleteChannel(connection, channelId),
    )
  })

  app.get("/api/accounts/:id/models", async (context) => {
    const account = accountsRepository
      .getAccounts()
      .data.accounts.find((item) => item.id === context.req.param("id"))
    if (!account) throw new AccountNotFoundError()
    context.header("Cache-Control", "no-store")
    return context.json(await modelCatalogService.fetch(account))
  })

  app.get("/api/models", async (context) => {
    const parsed = allModelsQuerySchema.safeParse(context.req.query())
    if (!parsed.success) {
      const error = apiError(
        "Invalid model catalog query",
        400,
        "INVALID_MODEL_QUERY",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    context.header("Cache-Control", "no-store")
    return context.json(
      await modelCatalogService.fetchMany(
        accountsRepository.getAccounts().data.accounts,
        parsed.data,
      ),
    )
  })

  app.get("/api/credential-profiles", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(
      apiCredentialProfileRepository?.list() ?? { profiles: [], revision: 0 },
    )
  })

  app.post("/api/credential-profiles", async (context) => {
    const parsed = createApiCredentialProfileSchema.safeParse(
      await context.req.json(),
    )
    if (!parsed.success) {
      const error = apiError(
        "Invalid API credential profile",
        400,
        "INVALID_CREDENTIAL_PROFILE",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    await assertSafeUpstreamUrl(parsed.data.baseUrl, "Profile")
    tagRepository.assertTagIdsExist(parsed.data.tagIds ?? [])
    try {
      context.header("Cache-Control", "no-store")
      if (!apiCredentialProfileRepository) {
        const response = apiError(
          "Credential profile storage is unavailable",
          500,
          "PROFILE_STORAGE_UNAVAILABLE",
        )
        return context.json(response.payload, response.status)
      }
      return context.json(
        apiCredentialProfileRepository.create(parsed.data),
        201,
      )
    } catch (error) {
      const response = apiError(
        error instanceof Error
          ? error.message
          : "Invalid API credential profile",
        400,
        "INVALID_CREDENTIAL_PROFILE",
      )
      return context.json(response.payload, response.status)
    }
  })

  app.patch("/api/credential-profiles/:id", async (context) => {
    const parsed = updateApiCredentialProfileSchema.safeParse(
      await context.req.json(),
    )
    if (!parsed.success) {
      const error = apiError(
        "Invalid API credential profile update",
        400,
        "INVALID_CREDENTIAL_PROFILE",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    if (parsed.data.baseUrl !== undefined) {
      await assertSafeUpstreamUrl(parsed.data.baseUrl, "Profile")
    }
    if (parsed.data.tagIds !== undefined) {
      tagRepository.assertTagIdsExist(parsed.data.tagIds)
    }
    try {
      if (!apiCredentialProfileRepository) {
        const response = apiError(
          "Credential profile storage is unavailable",
          500,
          "PROFILE_STORAGE_UNAVAILABLE",
        )
        return context.json(response.payload, response.status)
      }
      context.header("Cache-Control", "no-store")
      return context.json(
        apiCredentialProfileRepository.update(
          context.req.param("id"),
          parsed.data,
        ),
      )
    } catch (error) {
      const response = apiError(
        error instanceof Error
          ? error.message
          : "Invalid API credential profile",
        400,
        "INVALID_CREDENTIAL_PROFILE",
      )
      return context.json(response.payload, response.status)
    }
  })

  app.delete("/api/credential-profiles/:id", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(
      apiCredentialProfileRepository?.delete(context.req.param("id")) ?? {
        profiles: [],
        revision: 0,
      },
    )
  })

  app.post("/api/credential-profiles/:id/export", async (context) => {
    const parsed = exportApiCredentialProfileSchema.safeParse(
      await context.req.json(),
    )
    if (!parsed.success) {
      const error = apiError(
        "Invalid credential export request",
        400,
        "INVALID_CREDENTIAL_EXPORT",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    const profile = apiCredentialProfileRepository?.get(context.req.param("id"))
    if (!profile) {
      const error = apiError(
        "API credential profile not found",
        404,
        "CREDENTIAL_PROFILE_NOT_FOUND",
      )
      return context.json(error.payload, error.status)
    }

    const stem = toSafeExportStem(profile.name)
    const payload = {
      name: profile.name,
      apiType: profile.apiType,
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      ...(profile.notes ? { notes: profile.notes } : {}),
      ...(profile.expiresAt !== undefined
        ? { expiresAt: profile.expiresAt }
        : {}),
    }
    const response = {
      filename:
        parsed.data.format === "json" ? `${stem}.json` : `${stem}.env`,
      contentType:
        parsed.data.format === "json"
          ? "application/json"
          : "text/plain",
      content:
        parsed.data.format === "json"
          ? `${JSON.stringify(payload, null, 2)}\n`
          : [
              `API_NAME=${quoteEnvValue(profile.name)}`,
              `API_TYPE=${quoteEnvValue(profile.apiType)}`,
              `API_BASE_URL=${quoteEnvValue(profile.baseUrl)}`,
              `API_KEY=${quoteEnvValue(profile.apiKey)}`,
              ...(profile.notes
                ? [`API_NOTES=${quoteEnvValue(profile.notes)}`]
                : []),
              ...(profile.expiresAt !== undefined
                ? [`API_EXPIRES_AT=${profile.expiresAt}`]
                : []),
              "",
            ].join("\n"),
    } satisfies WebApiCredentialProfileExportResponse
    context.header("Cache-Control", "no-store")
    return context.json(response)
  })

  app.get("/api/credential-profiles/:id/models", async (context) => {
    const profile = apiCredentialProfileRepository?.get(context.req.param("id"))
    if (!profile) {
      const error = apiError(
        "API credential profile not found",
        404,
        "CREDENTIAL_PROFILE_NOT_FOUND",
      )
      return context.json(error.payload, error.status)
    }
    try {
      await assertSafeUpstreamUrl(profile.baseUrl, "Profile")
      const { fetchApiCredentialModelIds, normalizeApiCredentialModelIds } =
        await import("~/services/apiCredentialProfiles/modelCatalog")
      const ids = normalizeApiCredentialModelIds(
        await fetchApiCredentialModelIds({
          apiType: profile.apiType,
          baseUrl: profile.baseUrl,
          apiKey: profile.apiKey,
        }),
      )
      context.header("Cache-Control", "no-store")
      return context.json({
        profileId: profile.id,
        profileName: profile.name,
        supported: true,
        models: ids.map((id) => ({ id })),
      })
    } catch (error) {
      const safeMessage = toSanitizedErrorSummary(error, [profile.apiKey])
      const response = apiError(
        safeMessage || "Unable to load profile models",
        400,
        "PROFILE_MODEL_FETCH_FAILED",
      )
      return context.json(response.payload, response.status)
    }
  })

  app.post("/api/credential-profiles/:id/verify", async (context) => {
    const profile = apiCredentialProfileRepository?.get(context.req.param("id"))
    if (!profile) {
      const error = apiError(
        "API credential profile not found",
        404,
        "CREDENTIAL_PROFILE_NOT_FOUND",
      )
      return context.json(error.payload, error.status)
    }
    const parsed = verifyApiCredentialProfileSchema.safeParse(
      await context.req.json(),
    )
    if (!parsed.success) {
      const error = apiError(
        "Invalid profile verification request",
        400,
        "INVALID_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    try {
      await assertSafeUpstreamUrl(profile.baseUrl, "Profile")
      const { runApiVerification } = await import(
        "~/services/verification/aiApiVerification"
      )
      const report = await runApiVerification({
        baseUrl: profile.baseUrl,
        apiType: profile.apiType as ApiVerificationApiType,
        apiKey: profile.apiKey,
        modelId: parsed.data.modelId,
      })
      context.header("Cache-Control", "no-store")
      return context.json({
        profileId: profile.id,
        profileName: profile.name,
        report,
      })
    } catch (error) {
      const safeMessage = toSanitizedErrorSummary(error, [profile.apiKey])
      const response = apiError(
        safeMessage || "Profile verification failed",
        400,
        "PROFILE_VERIFICATION_FAILED",
      )
      return context.json(response.payload, response.status)
    }
  })

  const getAccountForResource = (accountId: string) => {
    const account = accountsRepository
      .getAccounts()
      .data.accounts.find((item) => item.id === accountId)
    if (!account) throw new AccountNotFoundError()
    return account
  }

  app.get("/api/accounts/:id/keys", async (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(
      await keyManagementService.list(
        getAccountForResource(context.req.param("id")),
      ),
    )
  })

  app.post("/api/accounts/:id/keys", async (context) => {
    const parsed = keyMutationSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid API key payload",
        400,
        "INVALID_KEY_PAYLOAD",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    return context.json(
      await keyManagementService.create(
        getAccountForResource(context.req.param("id")),
        parsed.data,
      ),
      201,
    )
  })

  app.put("/api/accounts/:id/keys/:tokenId", async (context) => {
    const parsed = keyMutationSchema.safeParse(await context.req.json())
    const rawTokenId = context.req.param("tokenId").trim()
    const numericTokenId = Number(rawTokenId)
    const tokenId = Number.isInteger(numericTokenId)
      ? numericTokenId
      : rawTokenId
    if (!parsed.success || !rawTokenId) {
      const error = apiError(
        "Invalid API key update",
        400,
        "INVALID_KEY_PAYLOAD",
      )
      return context.json(error.payload, error.status)
    }
    return context.json(
      await keyManagementService.update(
        getAccountForResource(context.req.param("id")),
        tokenId,
        parsed.data,
      ),
    )
  })

  app.delete("/api/accounts/:id/keys/:tokenId", async (context) => {
    const rawTokenId = context.req.param("tokenId").trim()
    const numericTokenId = Number(rawTokenId)
    const tokenId = Number.isInteger(numericTokenId)
      ? numericTokenId
      : rawTokenId
    if (!rawTokenId) {
      const error = apiError("Invalid API key id", 400, "INVALID_KEY_ID")
      return context.json(error.payload, error.status)
    }
    return context.json(
      await keyManagementService.delete(
        getAccountForResource(context.req.param("id")),
        tokenId,
      ),
    )
  })

  app.get("/api/history/balance", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(
      balanceHistoryRepository.toWebResponse(
        accountsRepository.getAccounts().data.accounts,
      ),
    )
  })

  app.get("/api/history/usage", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(
      usageHistoryRepository.toWebResponse(
        accountsRepository.getAccounts().data.accounts,
      ),
    )
  })

  app.get("/api/history/usage/analytics", (context) => {
    const parsed = usageAnalyticsQuerySchema.safeParse(context.req.query())
    if (!parsed.success) {
      const error = apiError(
        "Invalid usage analytics query",
        400,
        "INVALID_USAGE_ANALYTICS_QUERY",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    const accounts = accountsRepository.getAccounts().data.accounts
    const requestedAccountIds = parsed.data.accountIds
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean)
    const accountIds = requestedAccountIds
      ? Array.from(new Set(requestedAccountIds)).filter((id) =>
          accounts.some((account) => account.id === id),
        )
      : accounts
          .filter((account) => !account.disabled)
          .map((account) => account.id)

    if (
      parsed.data.startDay &&
      parsed.data.endDay &&
      parsed.data.startDay > parsed.data.endDay
    ) {
      const error = apiError(
        "Usage analytics start day must not be after end day",
        400,
        "INVALID_USAGE_ANALYTICS_RANGE",
      )
      return context.json(error.payload, error.status)
    }

    context.header("Cache-Control", "no-store")
    return context.json(
      usageHistoryRepository.toAnalyticsResponse(accounts, {
        accountIds,
        startDay: parsed.data.startDay ?? "",
        endDay: parsed.data.endDay ?? "",
      }),
    )
  })

  app.get("/api/notifications", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(notificationRepository.get())
  })

  app.post("/api/notifications/read-all", (context) => {
    notificationRepository.markAllRead()
    return context.json(notificationRepository.get())
  })

  app.get("/api/settings/external-notifications", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(externalNotificationService.getResponse())
  })

  app.put("/api/settings/external-notifications", async (context) => {
    const parsed = externalNotificationSettingsSchema.safeParse(
      await context.req.json(),
    )
    if (!parsed.success) {
      const error = apiError(
        "Invalid external-notification settings",
        400,
        "INVALID_EXTERNAL_NOTIFICATION_SETTINGS",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    try {
      return context.json(
        externalNotificationService.update(
          parsed.data as WebExternalNotificationSettingsInput,
        ),
      )
    } catch (error) {
      const response = apiError(
        error instanceof Error
          ? error.message
          : "Invalid external-notification settings",
        400,
        "INVALID_EXTERNAL_NOTIFICATION_SETTINGS",
      )
      return context.json(response.payload, response.status)
    }
  })

  app.post("/api/settings/external-notifications/test", async (context) => {
    const parsed = externalNotificationTestSchema.safeParse(
      await context.req.json(),
    )
    if (!parsed.success) {
      const error = apiError(
        "Invalid external-notification test",
        400,
        "INVALID_EXTERNAL_NOTIFICATION_TEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    try {
      return context.json(
        await externalNotificationService.test(parsed.data.channel),
      )
    } catch (error) {
      const response = apiError(
        error instanceof Error
          ? error.message
          : "External-notification test failed",
        500,
        "EXTERNAL_NOTIFICATION_TEST_FAILED",
      )
      return context.json(response.payload, response.status)
    }
  })

  app.post("/api/history/usage/sync", async (context) => {
    const parsed = usageHistorySyncSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid usage-history sync request",
        400,
        "INVALID_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    const accounts = accountsRepository.getAccounts().data.accounts
    const selected = parsed.data.accountIds
      ? accounts.filter((account) =>
          parsed.data.accountIds!.includes(account.id),
        )
      : accounts
    const sync = await usageHistoryService.syncAccounts(
      selected,
      parsed.data.retentionDays ?? 7,
    )
    notificationService.notify({
      task: "usage_history",
      status:
        sync.failed === 0
          ? "success"
          : sync.succeeded > 0
            ? "partial_success"
            : "failure",
      counts: {
        total: sync.total,
        success: sync.succeeded,
        failed: sync.failed,
        skipped: 0,
      },
    })
    return context.json({
      ...usageHistoryRepository.toWebResponse(accounts),
      sync: {
        total: sync.total,
        succeeded: sync.succeeded,
        failed: sync.failed,
        ingested: sync.ingested,
        partial: sync.partial,
      },
    } satisfies WebUsageHistorySyncResponse)
  })

  app.get("/api/settings/automation", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(getAutomationResponse())
  })

  app.patch("/api/settings/automation", async (context) => {
    const parsed = automationSettingsPatchSchema.safeParse(
      await context.req.json(),
    )
    if (!parsed.success) {
      const error = apiError(
        "Invalid automation settings",
        400,
        "INVALID_AUTOMATION_SETTINGS",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    const document = automationSettingsRepository.update(
      parsed.data as WebAutomationSettingsPatch,
    )
    accountRefreshScheduler.reschedule()
    checkInScheduler.reschedule()
    announcementScheduler?.reschedule()
    const response = accountRefreshScheduler.getResponse(document)
    return context.json({
      ...response,
      runtime: {
        ...response.runtime,
        ...checkInScheduler.getStatus(),
        ...(announcementScheduler?.getStatus() ?? {}),
      },
    })
  })

  app.post("/api/checkin/run", async (context) => {
    const parsed = checkInRunSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid check-in request",
        400,
        "INVALID_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    const current = accountsRepository.getAccounts()
    if (
      parsed.data.expectedRevision !== undefined &&
      parsed.data.expectedRevision !== current.revision
    ) {
      throw new RevisionConflictError(
        parsed.data.expectedRevision,
        current.revision,
      )
    }

    const summary = await checkInScheduler.runNow("manual")
    const document = accountsRepository.getAccounts()
    return context.json({
      ...toAccountListResponse(document),
      checkIn: summary,
    } satisfies WebCheckInRunResponse)
  })

  app.get("/api/accounts/export", (context) => {
    const document = accountsRepository.getAccounts()
    context.header("Cache-Control", "no-store")
    context.header(
      "Content-Disposition",
      `attachment; filename="all-api-hub-web-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    )
    return context.json(document.data)
  })

  app.get("/api/backup", (context) => {
    context.header("Cache-Control", "no-store")
    context.header(
      "Content-Disposition",
      `attachment; filename="all-api-hub-web-full-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    )
    return context.json(backupService.export())
  })

  app.get("/api/settings/webdav", (context) => {
    context.header("Cache-Control", "no-store")
    return context.json(webDavService.getResponse())
  })

  app.put("/api/settings/webdav", async (context) => {
    const parsed = webDavSettingsSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid WebDAV settings",
        400,
        "INVALID_WEBDAV_SETTINGS",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    await assertSafeUpstreamUrl(parsed.data.url, "WebDAV")
    try {
      return context.json(
        webDavService.update(parsed.data as WebDavSettingsInput),
      )
    } catch (error) {
      const response = apiError(
        error instanceof Error ? error.message : "Invalid WebDAV settings",
        400,
        "INVALID_WEBDAV_SETTINGS",
      )
      return context.json(response.payload, response.status)
    }
  })

  app.post("/api/settings/webdav/test", async (context) => {
    return context.json(await webDavService.testConnection())
  })

  app.post("/api/settings/webdav/upload", async (context) => {
    await webDavService.runNow("manual")
    return context.json(webDavService.getResponse())
  })

  app.post("/api/settings/webdav/restore", async (context) => {
    const refreshRuntime = accountRefreshScheduler.getResponse().runtime
    const checkInRuntime = checkInScheduler.getStatus()
    const webDavRuntime = webDavService.getResponse().runtime
    const announcementRuntime = announcementScheduler?.getStatus()
    if (
      refreshRuntime.running ||
      checkInRuntime.checkInRunning ||
      webDavRuntime.running ||
      announcementRuntime?.siteAnnouncementsRunning
    ) {
      const error = apiError(
        "WebDAV restore is unavailable while an automation task is running",
        409,
        "AUTOMATION_RUNNING",
      )
      return context.json(error.payload, error.status)
    }

    accountRefreshScheduler.stop()
    checkInScheduler.stop()
    webDavService.stop()
    announcementScheduler?.stop()
    try {
      return context.json(backupService.restore(await webDavService.download()))
    } finally {
      accountRefreshScheduler.reschedule()
      checkInScheduler.reschedule()
      webDavService.reschedule()
      announcementScheduler?.reschedule()
    }
  })

  app.post("/api/backup/restore", async (context) => {
    const parsed = webBackupSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid Web backup",
        400,
        "INVALID_WEB_BACKUP",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    const refreshRuntime = accountRefreshScheduler.getResponse().runtime
    const checkInRuntime = checkInScheduler.getStatus()
    const webDavRuntime = webDavService.getResponse().runtime
    const announcementRuntime = announcementScheduler?.getStatus()
    if (
      refreshRuntime.running ||
      checkInRuntime.checkInRunning ||
      webDavRuntime.running ||
      announcementRuntime?.siteAnnouncementsRunning
    ) {
      const error = apiError(
        "Backup restore is unavailable while an automation task is running",
        409,
        "AUTOMATION_RUNNING",
      )
      return context.json(error.payload, error.status)
    }

    accountRefreshScheduler.stop()
    checkInScheduler.stop()
    webDavService.stop()
    announcementScheduler?.stop()
    try {
      return context.json(backupService.restore(parsed.data as WebBackup))
    } finally {
      accountRefreshScheduler.reschedule()
      checkInScheduler.reschedule()
      webDavService.reschedule()
      announcementScheduler?.reschedule()
    }
  })

  app.post("/api/accounts/import", async (context) => {
    const parsed = importSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid import payload",
        400,
        "INVALID_IMPORT",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    const document = tagRepository.importExtensionData(
      parsed.data.data,
      parsed.data.expectedRevision,
      {
        preferencesRepository,
        channelConfigRepository,
        automationSettingsRepository,
      },
    )
    // Imports may replace scheduler preferences; refresh timers immediately so
    // the running Web process reflects the imported configuration.
    accountRefreshScheduler.reschedule()
    checkInScheduler.reschedule()
    announcementScheduler?.reschedule()
    return context.json(toAccountListResponse(document))
  })

  app.post("/api/accounts", async (context) => {
    const parsed = createAccountSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid account payload",
        400,
        "INVALID_ACCOUNT",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    await assertSafeUpstreamUrl(parsed.data.baseUrl, "Account")
    tagRepository.assertTagIdsExist(parsed.data.tagIds ?? [])
    const account = createWebAccount(parsed.data as WebCreateAccountInput)
    const document = accountsRepository.mutateAccounts(
      (current) => ({
        ...current,
        accounts: [...current.accounts, account],
        orderedAccountIds: [
          account.id,
          ...current.orderedAccountIds.filter((id) => id !== account.id),
        ],
      }),
      parsed.data.expectedRevision,
    )

    return context.json(toAccountListResponse(document), 201)
  })

  app.post("/api/accounts/bulk", async (context) => {
    const parsed = bulkAccountMutationSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid bulk account request",
        400,
        "INVALID_BULK_ACCOUNT_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    const input = parsed.data as WebAccountBulkMutationInput
    const document = accountsRepository.mutateAccountStates(
      input.accountIds,
      input.action,
      input.expectedRevision,
    )
    return context.json(toAccountListResponse(document))
  })

  app.post("/api/tags", async (context) => {
    const parsed = tagMutationSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid tag payload",
        400,
        "INVALID_TAG",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    return context.json(
      tagRepository.create(parsed.data as WebTagMutationInput),
      201,
    )
  })

  app.patch("/api/tags/:id", async (context) => {
    const parsed = tagMutationSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid tag payload",
        400,
        "INVALID_TAG",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    return context.json(
      tagRepository.rename(
        context.req.param("id"),
        parsed.data as WebTagMutationInput,
      ),
    )
  })

  app.delete("/api/tags/:id", (context) => {
    const parsed = tagDeleteQuerySchema.safeParse(context.req.query())
    if (!parsed.success) {
      const error = apiError(
        "Invalid tag revision query",
        400,
        "INVALID_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }
    return context.json(
      tagRepository.delete(
        context.req.param("id"),
        parsed.data.revision,
        parsed.data.accountsRevision,
      ) satisfies WebTagDeleteResponse,
    )
  })

  app.put("/api/accounts/order", async (context) => {
    const parsed = accountOrderSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid account order request",
        400,
        "INVALID_ACCOUNT_ORDER",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    const input = parsed.data as WebAccountOrderInput
    const document = accountsRepository.reorderAccounts(
      input.accountIds,
      input.expectedRevision,
    )
    return context.json(toAccountListResponse(document))
  })

  app.patch("/api/accounts/:id", async (context) => {
    const parsed = patchAccountSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid account patch",
        400,
        "INVALID_ACCOUNT_PATCH",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    if (parsed.data.baseUrl !== undefined) {
      await assertSafeUpstreamUrl(parsed.data.baseUrl, "Account")
    }
    tagRepository.assertTagIdsExist(parsed.data.tagIds ?? [])
    const accountId = context.req.param("id")
    const document = accountsRepository.mutateAccounts((current) => {
      let found = false
      const accounts = current.accounts.map((account) => {
        if (account.id !== accountId) return account
        found = true
        const now = Date.now()
        const patch = parsed.data as WebAccountPatchInput
        const nextAuthType = patch.authType ?? account.authType
        if (
          (nextAuthType === AuthTypeEnum.AccessToken &&
            patch.sessionCookie?.trim()) ||
          (nextAuthType === AuthTypeEnum.Cookie && patch.accessToken?.trim()) ||
          (nextAuthType === AuthTypeEnum.None &&
            (patch.accessToken?.trim() || patch.sessionCookie?.trim()))
        ) {
          throw new InvalidAccountPatchError(
            "Credential field does not match the selected authentication mode",
          )
        }
        const credentialChanged = Boolean(
          patch.accessToken?.trim() ||
            patch.sessionCookie?.trim() ||
            (patch.authType !== undefined &&
              patch.authType !== account.authType),
        )

        if (
          nextAuthType === AuthTypeEnum.AccessToken &&
          !(
            patch.accessToken?.trim() ||
            (account.authType === nextAuthType &&
              nextAuthType === AuthTypeEnum.AccessToken &&
              account.account_info.access_token.trim())
          )
        ) {
          throw new InvalidAccountPatchError(
            "Access token is required for access-token authentication",
          )
        }
        if (
          nextAuthType === AuthTypeEnum.Cookie &&
          !(
            patch.sessionCookie?.trim() ||
            (account.authType === nextAuthType &&
              nextAuthType === AuthTypeEnum.Cookie &&
              account.cookieAuth?.sessionCookie.trim())
          )
        ) {
          throw new InvalidAccountPatchError(
            "Session cookie is required for cookie authentication",
          )
        }

        const nextSiteUrl = patch.baseUrl
          ? normalizeAccountSiteUrlForStorage({
              siteType: account.site_type,
              url: patch.baseUrl,
            })
          : account.site_url
        const nextUserId =
          patch.userId === undefined
            ? account.account_info.id
            : patch.userId.trim()
        const nextAccessToken =
          nextAuthType === AuthTypeEnum.AccessToken
            ? patch.accessToken?.trim() ||
              (account.authType === AuthTypeEnum.AccessToken
                ? account.account_info.access_token
                : "")
            : ""
        const nextCookie =
          nextAuthType === AuthTypeEnum.Cookie
            ? patch.sessionCookie?.trim() ||
              (account.authType === AuthTypeEnum.Cookie
                ? account.cookieAuth?.sessionCookie || ""
                : "")
            : ""
        const siteTargetChanged =
          patch.baseUrl !== undefined && nextSiteUrl !== account.site_url
        const nextAccountInfo = {
          ...account.account_info,
          ...(patch.username === undefined
            ? {}
            : { username: patch.username.trim() }),
          ...(patch.userId === undefined ? {} : { id: nextUserId }),
          ...(patch.accessToken === undefined && patch.authType === undefined
            ? {}
            : { access_token: nextAccessToken }),
        }
        const next = {
          ...account,
          ...(patch.name === undefined ? {} : { site_name: patch.name.trim() }),
          ...(patch.baseUrl === undefined ? {} : { site_url: nextSiteUrl }),
          ...(patch.authType === undefined ? {} : { authType: nextAuthType }),
          account_info: nextAccountInfo,
          ...(patch.sessionCookie === undefined && patch.authType === undefined
            ? {}
            : nextAuthType === AuthTypeEnum.Cookie
              ? { cookieAuth: { sessionCookie: nextCookie } }
              : { cookieAuth: undefined }),
          ...(patch.exchangeRate === undefined
            ? {}
            : { exchange_rate: patch.exchangeRate }),
          ...(parsed.data.disabled === undefined
            ? {}
            : { disabled: parsed.data.disabled }),
          ...(parsed.data.notes === undefined
            ? {}
            : { notes: parsed.data.notes.trim() }),
          ...(parsed.data.tagIds === undefined
            ? {}
            : { tagIds: parsed.data.tagIds }),
          updated_at: now,
          user_updated_at: now,
        }
        if (credentialChanged || siteTargetChanged) {
          next.health = { status: SiteHealthStatus.Unknown }
          next.last_sync_time = 0
        }
        return next
      })
      if (!found) throw new AccountNotFoundError()
      const pinnedAccountIds =
        parsed.data.pinned === true
          ? [
              accountId,
              ...current.pinnedAccountIds.filter((id) => id !== accountId),
            ]
          : parsed.data.pinned === false
            ? current.pinnedAccountIds.filter((id) => id !== accountId)
            : current.pinnedAccountIds
      return { ...current, accounts, pinnedAccountIds }
    }, parsed.data.expectedRevision)

    return context.json(toAccountListResponse(document))
  })

  app.post("/api/accounts/refresh", async (context) => {
    const parsed = refreshAccountsSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid batch refresh request",
        400,
        "INVALID_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    const current = accountsRepository.getAccounts()
    if (
      parsed.data.expectedRevision !== undefined &&
      parsed.data.expectedRevision !== current.revision
    ) {
      throw new RevisionConflictError(
        parsed.data.expectedRevision,
        current.revision,
      )
    }

    const refreshed = await accountRefreshScheduler.runNow("manual")
    const document = accountsRepository.getAccounts()
    const response = {
      ...toAccountListResponse(document),
      refresh: {
        total: refreshed.total,
        succeeded: refreshed.succeeded,
        failed: refreshed.failed,
        skipped: refreshed.skipped,
      },
    } satisfies WebBatchAccountRefreshResponse
    return context.json(response)
  })

  app.post("/api/accounts/:id/refresh", async (context) => {
    const parsed = refreshAccountSchema.safeParse(await context.req.json())
    if (!parsed.success) {
      const error = apiError(
        "Invalid account refresh request",
        400,
        "INVALID_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    const current = accountsRepository.getAccounts()
    if (
      parsed.data.expectedRevision !== undefined &&
      parsed.data.expectedRevision !== current.revision
    ) {
      throw new RevisionConflictError(
        parsed.data.expectedRevision,
        current.revision,
      )
    }

    const accountId = context.req.param("id")
    const account = current.data.accounts.find((item) => item.id === accountId)
    if (!account) throw new AccountNotFoundError()

    const refreshed = await accountRefreshService.refreshAccount(
      account,
      parsed.data.includeTodayCashflow,
    )
    const document = accountsRepository.mutateAccounts(
      (latest) => ({
        ...latest,
        accounts: latest.accounts.map((item) =>
          item.id === accountId ? refreshed.account : item,
        ),
      }),
      current.revision,
    )
    const historySettings = automationSettingsRepository.get().data.settings
    if (refreshed.success && historySettings.balanceHistoryEnabled) {
      balanceHistoryRepository.capture(
        [refreshed.account],
        "refresh",
        historySettings.balanceHistoryRetentionDays,
      )
    }
    if (
      refreshed.success &&
      historySettings.usageHistoryEnabled &&
      historySettings.usageHistoryAfterRefresh
    ) {
      await usageHistoryService.syncAccount(
        refreshed.account,
        historySettings.usageHistoryRetentionDays,
      )
    }
    const response = {
      ...toAccountListResponse(document),
      refresh: {
        accountId,
        success: refreshed.success,
        health: refreshed.account.health,
      },
    } satisfies WebAccountRefreshResponse
    return context.json(response)
  })

  app.delete("/api/accounts/:id", (context) => {
    const parsed = deleteQuerySchema.safeParse(context.req.query())
    if (!parsed.success) {
      const error = apiError(
        "Invalid revision query",
        400,
        "INVALID_REQUEST",
        parsed.error.flatten(),
      )
      return context.json(error.payload, error.status)
    }

    const document = accountsRepository.mutateAccountStates(
      [context.req.param("id")],
      "delete",
      parsed.data.revision,
    )

    return context.json({
      revision: document.revision,
      lastUpdated: document.data.last_updated,
    } satisfies WebMutationResponse)
  })

  app.onError((error, context) => {
    if (error instanceof UnsafeUpstreamUrlError) {
      const response = apiError(error.message, 400, "UNSAFE_UPSTREAM_URL")
      return context.json(response.payload, response.status)
    }

    if (error instanceof SyntaxError) {
      const response = apiError(
        "Request body must be valid JSON",
        400,
        "INVALID_JSON",
      )
      return context.json(response.payload, response.status)
    }

    if (error instanceof RevisionConflictError) {
      const response = apiError(
        "Account data changed; reload before retrying",
        409,
        "REVISION_CONFLICT",
        {
          expectedRevision: error.expectedRevision,
          actualRevision: error.actualRevision,
        },
      )
      return context.json(response.payload, response.status)
    }

    if (error instanceof AccountNotFoundError) {
      const response = apiError(
        "Account not found",
        404,
        "ACCOUNT_NOT_FOUND",
        error.accountIds.length > 0
          ? { accountIds: error.accountIds }
          : undefined,
      )
      return context.json(response.payload, response.status)
    }

    if (error instanceof InvalidAccountOrderError) {
      const response = apiError(error.message, 400, "INVALID_ACCOUNT_ORDER")
      return context.json(response.payload, response.status)
    }

    if (error instanceof TagNotFoundError) {
      const response = apiError("Tag not found", 404, "TAG_NOT_FOUND")
      return context.json(response.payload, response.status)
    }

    if (error instanceof InvalidTagNameError) {
      const response = apiError(error.message, 400, "INVALID_TAG")
      return context.json(response.payload, response.status)
    }

    if (error instanceof UnknownTagIdsError) {
      const response = apiError(error.message, 400, "UNKNOWN_TAG_IDS", {
        tagIds: error.tagIds,
      })
      return context.json(response.payload, response.status)
    }

    if (error instanceof UnsupportedApiCredentialProfilesVersionError) {
      const response = apiError(
        error.message,
        400,
        "UNSUPPORTED_CREDENTIAL_PROFILE_VERSION",
        { version: error.version },
      )
      return context.json(response.payload, response.status)
    }

    if (error instanceof BookmarkNotFoundError) {
      const response = apiError("Bookmark not found", 404, "BOOKMARK_NOT_FOUND")
      return context.json(response.payload, response.status)
    }

    if (error instanceof InvalidAccountPatchError) {
      const response = apiError(error.message, 400, "INVALID_ACCOUNT_PATCH")
      return context.json(response.payload, response.status)
    }

    if (error instanceof AccountRefreshUnavailableError) {
      const response = apiError(
        error.message,
        400,
        error.reason === "account_disabled"
          ? "ACCOUNT_DISABLED"
          : "REFRESH_UNSUPPORTED",
      )
      return context.json(response.payload, response.status)
    }

    console.error("Web API request failed", {
      name: error.name,
      message: error.message,
    })
    const response = apiError("Internal server error", 500, "INTERNAL_ERROR")
    return context.json(response.payload, response.status)
  })

  if (existsSync(config.staticDirectory)) {
    app.use(
      "/assets/*",
      serveStatic({ root: config.staticDirectory, precompressed: true }),
    )
    app.get("*", async (context, next) => {
      // Keep unknown API paths on the JSON not-found boundary instead of
      // treating them as client-side routes and returning index.html.
      if (isApiPath(context.req.path)) {
        await next()
        return
      }

      return await serveStatic({
        root: config.staticDirectory,
        rewriteRequestPath: () => "/index.html",
      })(context, next)
    })
  }

  app.notFound((context) => {
    if (isApiPath(context.req.path)) {
      const response = apiError("API route not found", 404, "NOT_FOUND")
      return context.json(response.payload, response.status)
    }
    return context.text("Web client has not been built yet", 404)
  })

  return app
}

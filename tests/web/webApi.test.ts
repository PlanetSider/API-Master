import { http, HttpResponse } from "msw"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { SITE_TYPES } from "~/constants/siteType"
import { createEmptyUsageHistoryAccountStore } from "~/services/history/usageHistory/core"
import { AuthTypeEnum, SiteHealthStatus } from "~/types"
import { AccountRefreshScheduler } from "~~/server/accountRefreshScheduler"
import { AccountRefreshService } from "~~/server/accountRefreshService"
import { AccountsRepository } from "~~/server/accountsRepository"
import { ApiCredentialProfileRepository } from "~~/server/apiCredentialProfileRepository"
import { createWebApp } from "~~/server/app"
import { AutomationSettingsRepository } from "~~/server/automationSettingsRepository"
import { BackupService } from "~~/server/backupService"
import { BalanceHistoryRepository } from "~~/server/balanceHistoryRepository"
import { CheckInScheduler } from "~~/server/checkInScheduler"
import { CheckInService } from "~~/server/checkInService"
import type { WebServerConfig } from "~~/server/config"
import { EncryptedDocumentStore } from "~~/server/encryptedDocumentStore"
import type { ExternalNotificationDelivery } from "~~/server/externalNotificationDelivery"
import { ExternalNotificationRepository } from "~~/server/externalNotificationRepository"
import { ExternalNotificationService } from "~~/server/externalNotificationService"
import { KeyManagementService } from "~~/server/keyManagementService"
import { ManagedSiteRepository } from "~~/server/managedSiteRepository"
import { ManagedSiteService } from "~~/server/managedSiteService"
import { ModelCatalogService } from "~~/server/modelCatalogService"
import { NotificationRepository } from "~~/server/notificationRepository"
import { NotificationService } from "~~/server/notificationService"
import type { SiteAnnouncementScheduler } from "~~/server/siteAnnouncementScheduler"
import { TagRepository } from "~~/server/tagRepository"
import { UsageHistoryRepository } from "~~/server/usageHistoryRepository"
import { UsageHistoryService } from "~~/server/usageHistoryService"
import type { WebDavClient } from "~~/server/webDavClient"
import { WebDavRepository } from "~~/server/webDavRepository"
import { WebDavService } from "~~/server/webDavService"
import { server as mockServer } from "~~/tests/msw/server"

const origin = "http://localhost"
const config: WebServerConfig = {
  host: "127.0.0.1",
  port: 8787,
  databasePath: ":memory:",
  staticDirectory: "missing-web-build",
  adminPassword: "test-password",
  sessionSecret: "test-session-secret-that-is-long-enough",
  encryptionSecret: "test-encryption-secret",
  secureCookies: false,
  sessionTtlSeconds: 3600,
}

const jsonRequest = (method: string, body?: unknown, cookie?: string) => ({
  method,
  headers: {
    Origin: origin,
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(cookie ? { Cookie: cookie } : {}),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

describe("Web API", () => {
  let repository: AccountsRepository
  let tagRepository: TagRepository
  let apiCredentialProfileRepository: ApiCredentialProfileRepository
  let documentStore: EncryptedDocumentStore
  let automationSettingsRepository: AutomationSettingsRepository
  let accountRefreshScheduler: AccountRefreshScheduler
  let checkInScheduler: CheckInScheduler
  let balanceHistoryRepository: BalanceHistoryRepository
  let usageHistoryRepository: UsageHistoryRepository
  let usageHistoryService: UsageHistoryService
  let notificationRepository: NotificationRepository
  let notificationService: NotificationService
  let externalNotificationRepository: ExternalNotificationRepository
  let externalNotificationDelivery: ExternalNotificationDelivery
  let externalNotificationService: ExternalNotificationService
  let modelCatalogService: ModelCatalogService
  let keyManagementService: KeyManagementService
  let managedSiteRepository: ManagedSiteRepository
  let managedSiteService: ManagedSiteService
  let backupService: BackupService
  let webDavRepository: WebDavRepository
  let webDavClient: WebDavClient
  let webDavService: WebDavService
  let app: ReturnType<typeof createWebApp>

  beforeEach(() => {
    documentStore = new EncryptedDocumentStore(
      ":memory:",
      config.encryptionSecret,
    )
    repository = new AccountsRepository(documentStore)
    tagRepository = new TagRepository(documentStore)
    apiCredentialProfileRepository = new ApiCredentialProfileRepository(
      documentStore,
    )
    automationSettingsRepository = new AutomationSettingsRepository(
      documentStore,
    )
    balanceHistoryRepository = new BalanceHistoryRepository(documentStore)
    usageHistoryRepository = new UsageHistoryRepository(documentStore)
    usageHistoryService = new UsageHistoryService(usageHistoryRepository)
    notificationRepository = new NotificationRepository(documentStore)
    externalNotificationRepository = new ExternalNotificationRepository(
      documentStore,
    )
    externalNotificationDelivery = {
      send: vi.fn().mockResolvedValue(undefined),
    }
    externalNotificationService = new ExternalNotificationService(
      externalNotificationRepository,
      externalNotificationDelivery,
    )
    notificationService = new NotificationService(
      notificationRepository,
      externalNotificationService,
    )
    modelCatalogService = new ModelCatalogService()
    keyManagementService = new KeyManagementService()
    managedSiteRepository = new ManagedSiteRepository(documentStore)
    managedSiteService = new ManagedSiteService()
    backupService = new BackupService(documentStore)
    webDavRepository = new WebDavRepository(documentStore)
    webDavClient = {
      test: vi.fn().mockResolvedValue(undefined),
      upload: vi.fn().mockResolvedValue(undefined),
      download: vi.fn(),
    }
    webDavService = new WebDavService(
      webDavRepository,
      backupService,
      webDavClient,
    )
    accountRefreshScheduler = new AccountRefreshScheduler(
      repository,
      automationSettingsRepository,
      new AccountRefreshService(),
      balanceHistoryRepository,
      usageHistoryService,
      notificationService,
    )
    checkInScheduler = new CheckInScheduler(
      repository,
      automationSettingsRepository,
      new CheckInService(),
      notificationService,
    )
    app = createWebApp({
      config,
      accountsRepository: repository,
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
      tagRepository,
    })
  })

  afterEach(() => {
    accountRefreshScheduler.stop()
    checkInScheduler.stop()
    webDavService.stop()
    documentStore.close()
  })

  const login = async () => {
    const response = await app.request(
      `${origin}/api/session`,
      jsonRequest("POST", { password: config.adminPassword }),
    )
    expect(response.status).toBe(200)
    const setCookie = response.headers.get("set-cookie")
    expect(setCookie).toContain("aah_web_session=")
    return setCookie!.split(";", 1)[0]
  }

  it("requires authentication for account data", async () => {
    const response = await app.request(`${origin}/api/accounts`)
    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })

  it("rate-limits repeated administrator password failures", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.request(
        `${origin}/api/session`,
        jsonRequest("POST", { password: "wrong-password" }),
      )
      expect(response.status).toBe(401)
    }

    const limited = await app.request(
      `${origin}/api/session`,
      jsonRequest("POST", { password: config.adminPassword }),
    )
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0)
    await expect(limited.json()).resolves.toMatchObject({
      code: "LOGIN_RATE_LIMITED",
    })
  })

  it("returns a stable 400 error for malformed JSON bodies", async () => {
    const response = await app.request(`${origin}/api/session`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: "{malformed",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_JSON",
    })
  })

  it("reports extension-only browser automation as unavailable without a worker", async () => {
    const cookie = await login()
    const response = await app.request(`${origin}/api/runtime/capabilities`, {
      headers: { Cookie: cookie },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      runtime: "web",
      browserWorker: { configured: false, connected: false },
      capabilities: expect.arrayContaining([
        {
          id: "standard_http",
          state: "available",
          executor: "server",
        },
        {
          id: "saved_cookie_header",
          state: "limited",
          executor: "server",
        },
        {
          id: "waf_challenge",
          state: "requires_worker",
          executor: "browser_worker",
        },
        {
          id: "turnstile",
          state: "requires_worker",
          executor: "browser_worker",
        },
      ]),
    })
  })

  it("requires authentication for transient API verification", async () => {
    const response = await app.request(
      `${origin}/api/verification/models`,
      jsonRequest("POST", {
        apiType: "openai-compatible",
        baseUrl: "https://verification.example.com",
        apiKey: "transient-secret",
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })

  it("discovers transient API models without persisting or returning the key", async () => {
    const cookie = await login()
    const apiKey = "transient-secret"
    mockServer.use(
      http.get("https://verification.example.com/v1/models", ({ request }) => {
        expect(request.headers.get("authorization")).toBe(`Bearer ${apiKey}`)
        return HttpResponse.json({
          data: [{ id: "gpt-web" }, { id: "gpt-web-mini" }],
        })
      }),
    )

    const response = await app.request(
      `${origin}/api/verification/models`,
      jsonRequest(
        "POST",
        {
          apiType: "openai-compatible",
          baseUrl: "https://verification.example.com",
          apiKey,
        },
        cookie,
      ),
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({ modelIds: ["gpt-web", "gpt-web-mini"] })
    expect(JSON.stringify(payload)).not.toContain(apiKey)
    expect(JSON.stringify(repository.getAccounts())).not.toContain(apiKey)
  })

  it("redacts transient API keys from verification failures", async () => {
    const cookie = await login()
    const apiKey = "transient-secret"
    mockServer.use(
      http.get("https://verification.example.com/v1/models", () =>
        HttpResponse.json(
          { error: `invalid key ${apiKey}` },
          { status: 401 },
        ),
      ),
    )

    const response = await app.request(
      `${origin}/api/verification/models`,
      jsonRequest(
        "POST",
        {
          apiType: "openai-compatible",
          baseUrl: "https://verification.example.com",
          apiKey,
        },
        cookie,
      ),
    )

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(JSON.stringify(payload)).not.toContain(apiKey)
    expect(payload).toMatchObject({ code: "VERIFICATION_MODELS_FAILED" })
  })

  it("serves an aggregated model catalog without exposing account credentials", async () => {
    const cookie = await login()
    const created = await app.request(
      `${origin}/api/accounts`,
      jsonRequest(
        "POST",
        {
          name: "Catalog account",
          baseUrl: "https://catalog.example.com",
          siteType: SITE_TYPES.NEW_API,
          authType: AuthTypeEnum.AccessToken,
          accessToken: "catalog-secret",
          expectedRevision: 0,
        },
        cookie,
      ),
    )
    const createdPayload = await created.json()
    const accountId = createdPayload.accounts[0].id as string
    const fetchMany = vi
      .spyOn(modelCatalogService, "fetchMany")
      .mockResolvedValue({
        accounts: [
          {
            accountId,
            accountName: "Catalog account",
            siteType: SITE_TYPES.NEW_API,
            disabled: false,
            status: "success",
            models: [{ id: "gpt-4o-mini" }],
          },
        ],
        models: [
          {
            id: "gpt-4o-mini",
            accounts: [{ accountId, accountName: "Catalog account" }],
          },
        ],
        startedAt: 1,
        finishedAt: 2,
        summary: {
          total: 1,
          succeeded: 1,
          failed: 0,
          unsupported: 0,
          skipped: 0,
          modelCount: 1,
        },
      })

    const response = await app.request(`${origin}/api/models?concurrency=2`, {
      headers: { Cookie: cookie },
    })
    expect(response.status).toBe(200)
    const responsePayload = await response.json()
    expect(responsePayload).toMatchObject({
      summary: { total: 1, modelCount: 1 },
      models: [{ id: "gpt-4o-mini" }],
    })
    expect(fetchMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: accountId })]),
      { concurrency: 2 },
    )
    expect(JSON.stringify(responsePayload)).not.toContain("catalog-secret")
    fetchMany.mockRestore()
  })

  it("rejects private account targets before persisting them in production", async () => {
    const cookie = await login()
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AAH_WEB_ALLOW_PRIVATE_UPSTREAMS", "false")

    try {
      const response = await app.request(
        `${origin}/api/accounts`,
        jsonRequest(
          "POST",
          {
            name: "Private target",
            baseUrl: "http://127.0.0.1:8080",
            siteType: SITE_TYPES.NEW_API,
            authType: AuthTypeEnum.None,
          },
          cookie,
        ),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({
        code: "UNSAFE_UPSTREAM_URL",
      })
      expect(repository.getAccounts().data.accounts).toHaveLength(0)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it("serves filtered usage analytics from privacy-safe aggregates", async () => {
    const cookie = await login()
    const created = await app.request(
      `${origin}/api/accounts`,
      jsonRequest(
        "POST",
        {
          name: "Analytics account",
          baseUrl: "https://analytics.example.com",
          siteType: SITE_TYPES.NEW_API,
          authType: AuthTypeEnum.AccessToken,
          accessToken: "analytics-secret",
          expectedRevision: 0,
        },
        cookie,
      ),
    )
    const createdPayload = await created.json()
    const accountId = createdPayload.accounts[0].id as string
    const accountStore = createEmptyUsageHistoryAccountStore()
    accountStore.status = { state: "success", lastSyncAt: 123 }
    accountStore.daily["2026-08-29"] = {
      requests: 2,
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      quotaConsumed: 250_000,
    }
    accountStore.daily["2026-08-30"] = {
      requests: 3,
      promptTokens: 200,
      completionTokens: 75,
      totalTokens: 275,
      quotaConsumed: 500_000,
    }
    accountStore.dailyByModel["gpt-4o-mini"] = {
      "2026-08-29": accountStore.daily["2026-08-29"],
      "2026-08-30": accountStore.daily["2026-08-30"],
    }
    accountStore.latencyDaily["2026-08-30"] = {
      count: 2,
      sum: 3,
      max: 2,
      slowCount: 0,
      unknownCount: 0,
      buckets: [0, 0, 0, 0, 0, 0],
    }
    usageHistoryRepository.saveAccount(accountId, accountStore, "2026-08-01")

    const response = await app.request(
      `${origin}/api/history/usage/analytics?accountIds=${encodeURIComponent(accountId)}&startDay=2026-08-30&endDay=2026-08-30`,
      { headers: { Cookie: cookie } },
    )
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      selection: {
        accountIds: [accountId],
        startDay: "2026-08-30",
        endDay: "2026-08-30",
      },
      totals: {
        requests: 3,
        promptTokens: 200,
        completionTokens: 75,
        totalTokens: 275,
        consumedUsd: 1,
      },
      daily: [{ day: "2026-08-30", totalTokens: 275 }],
      accounts: [
        {
          accountId,
          accountName: "Analytics account",
          aggregate: { totalTokens: 275 },
        },
      ],
      models: [{ model: "gpt-4o-mini", aggregate: { totalTokens: 275 } }],
      latency: { count: 2, averageSeconds: 1.5, maxSeconds: 2 },
    })
    expect(JSON.stringify(payload)).not.toContain("analytics-secret")

    const invalid = await app.request(
      `${origin}/api/history/usage/analytics?startDay=2026-08-31&endDay=2026-08-01`,
      { headers: { Cookie: cookie } },
    )
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toMatchObject({
      code: "INVALID_USAGE_ANALYTICS_RANGE",
    })
  })

  it("manages browser bookmarks with optimistic revisions", async () => {
    const cookie = await login()
    const created = await app.request(
      `${origin}/api/bookmarks`,
      jsonRequest(
        "POST",
        {
          name: "Production console",
          url: "https://console.example.com/projects/1",
          notes: "Open from the web dashboard",
          expectedRevision: 0,
        },
        cookie,
      ),
    )
    expect(created.status).toBe(201)
    const createdPayload = await created.json()
    expect(createdPayload).toMatchObject({
      revision: 1,
      bookmarks: [
        {
          name: "Production console",
          url: "https://console.example.com/projects/1",
          notes: "Open from the web dashboard",
          pinned: false,
        },
      ],
    })

    const bookmarkId = createdPayload.bookmarks[0].id as string
    const pinned = await app.request(
      `${origin}/api/bookmarks/${bookmarkId}`,
      jsonRequest("PATCH", { pinned: true, expectedRevision: 1 }, cookie),
    )
    expect(pinned.status).toBe(200)
    await expect(pinned.json()).resolves.toMatchObject({
      revision: 2,
      pinnedBookmarkIds: [bookmarkId],
      bookmarks: [{ id: bookmarkId, pinned: true }],
    })

    const stale = await app.request(
      `${origin}/api/bookmarks/${bookmarkId}`,
      jsonRequest("PATCH", { name: "Stale", expectedRevision: 1 }, cookie),
    )
    expect(stale.status).toBe(409)
    await expect(stale.json()).resolves.toMatchObject({
      code: "REVISION_CONFLICT",
    })

    const deleted = await app.request(
      `${origin}/api/bookmarks/${bookmarkId}?revision=2`,
      jsonRequest("DELETE", undefined, cookie),
    )
    expect(deleted.status).toBe(200)
    await expect(deleted.json()).resolves.toMatchObject({
      revision: 3,
      bookmarks: [],
      pinnedBookmarkIds: [],
    })
  })

  it("manages global tags and removes references atomically", async () => {
    const cookie = await login()
    const createdTagResponse = await app.request(
      `${origin}/api/tags`,
      jsonRequest("POST", { name: "Production", expectedRevision: 0 }, cookie),
    )
    expect(createdTagResponse.status).toBe(201)
    const createdTagPayload = await createdTagResponse.json()
    const tagId = createdTagPayload.tags[0].id as string
    expect(createdTagPayload).toMatchObject({
      revision: 1,
      tags: [{ name: "Production" }],
    })

    const duplicate = await app.request(
      `${origin}/api/tags`,
      jsonRequest(
        "POST",
        { name: " production ", expectedRevision: 1 },
        cookie,
      ),
    )
    expect(duplicate.status).toBe(400)
    await expect(duplicate.json()).resolves.toMatchObject({
      code: "INVALID_TAG",
    })

    const accountResponse = await app.request(
      `${origin}/api/accounts`,
      jsonRequest(
        "POST",
        {
          name: "Tagged account",
          baseUrl: "https://tagged.example.com",
          siteType: SITE_TYPES.NEW_API,
          authType: AuthTypeEnum.None,
          tagIds: [tagId],
          expectedRevision: 0,
        },
        cookie,
      ),
    )
    expect(accountResponse.status).toBe(201)
    await expect(accountResponse.json()).resolves.toMatchObject({
      revision: 1,
      accounts: [{ tagIds: [tagId] }],
    })

    const bookmarkResponse = await app.request(
      `${origin}/api/bookmarks`,
      jsonRequest(
        "POST",
        {
          name: "Tagged bookmark",
          url: "https://tagged.example.com/console",
          tagIds: [tagId],
          expectedRevision: 1,
        },
        cookie,
      ),
    )
    expect(bookmarkResponse.status).toBe(201)

    const credentialProfile = apiCredentialProfileRepository.create({
      name: "Tagged credential",
      apiType: "openai-compatible",
      baseUrl: "https://api.tagged.example.com",
      apiKey: "tagged-credential-secret",
      tagIds: [tagId],
    })
    const credentialProfileId = credentialProfile.profiles[0].id

    const renamed = await app.request(
      `${origin}/api/tags/${encodeURIComponent(tagId)}`,
      jsonRequest("PATCH", { name: "Critical", expectedRevision: 1 }, cookie),
    )
    expect(renamed.status).toBe(200)
    await expect(renamed.json()).resolves.toMatchObject({
      revision: 2,
      tags: [{ id: tagId, name: "Critical" }],
    })

    const staleDelete = await app.request(
      `${origin}/api/tags/${encodeURIComponent(tagId)}?revision=2&accountsRevision=1`,
      jsonRequest("DELETE", undefined, cookie),
    )
    expect(staleDelete.status).toBe(409)
    expect(tagRepository.list()).toMatchObject({
      revision: 2,
      tags: [{ id: tagId }],
    })

    const deleted = await app.request(
      `${origin}/api/tags/${encodeURIComponent(tagId)}?revision=2&accountsRevision=2`,
      jsonRequest("DELETE", undefined, cookie),
    )
    expect(deleted.status).toBe(200)
    await expect(deleted.json()).resolves.toMatchObject({
      revision: 3,
      accountsRevision: 3,
      credentialProfilesRevision: 2,
      updatedAccounts: 1,
      updatedBookmarks: 1,
      updatedCredentialProfiles: 1,
      tags: [],
    })
    expect(repository.getAccounts()).toMatchObject({
      revision: 3,
      data: {
        accounts: [{ tagIds: [] }],
        bookmarks: [{ tagIds: [] }],
      },
    })
    expect(
      apiCredentialProfileRepository.get(credentialProfileId)?.tagIds,
    ).toEqual([])
  })

  it("rejects invalid bookmark URLs, tag ids, and bookmark ids", async () => {
    const cookie = await login()
    const invalid = await app.request(
      `${origin}/api/bookmarks`,
      jsonRequest(
        "POST",
        { name: "Local file", url: "file:///tmp/secret", expectedRevision: 0 },
        cookie,
      ),
    )
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toMatchObject({
      code: "INVALID_BOOKMARK",
    })

    const unknownCreateTag = await app.request(
      `${origin}/api/bookmarks`,
      jsonRequest(
        "POST",
        {
          name: "Unknown tag",
          url: "https://example.com",
          tagIds: ["missing-tag"],
          expectedRevision: 0,
        },
        cookie,
      ),
    )
    expect(unknownCreateTag.status).toBe(400)
    await expect(unknownCreateTag.json()).resolves.toMatchObject({
      code: "UNKNOWN_TAG_IDS",
      details: { tagIds: ["missing-tag"] },
    })

    const created = await app.request(
      `${origin}/api/bookmarks`,
      jsonRequest(
        "POST",
        {
          name: "Valid bookmark",
          url: "https://example.com",
          expectedRevision: 0,
        },
        cookie,
      ),
    )
    expect(created.status).toBe(201)
    const createdPayload = await created.json()
    const bookmarkId = createdPayload.bookmarks[0].id

    const unknownPatchTag = await app.request(
      `${origin}/api/bookmarks/${encodeURIComponent(bookmarkId)}`,
      jsonRequest(
        "PATCH",
        { tagIds: ["missing-tag"], expectedRevision: 1 },
        cookie,
      ),
    )
    expect(unknownPatchTag.status).toBe(400)
    await expect(unknownPatchTag.json()).resolves.toMatchObject({
      code: "UNKNOWN_TAG_IDS",
    })

    const missing = await app.request(
      `${origin}/api/bookmarks/missing`,
      jsonRequest("PATCH", { name: "Missing", expectedRevision: 1 }, cookie),
    )
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toMatchObject({
      code: "BOOKMARK_NOT_FOUND",
    })
  })

  it("sanitizes malformed imported bookmarks before exposing them", async () => {
    const cookie = await login()
    const imported = await app.request(
      `${origin}/api/accounts/import`,
      jsonRequest(
        "POST",
        {
          expectedRevision: 0,
          data: {
            bookmarks: [
              { id: "good", name: " Good ", url: "https://example.com" },
              { id: "", name: "ignored", url: "https://invalid.example" },
              {
                id: "good",
                name: "duplicate",
                url: "https://duplicate.example",
              },
              { id: "unsafe", name: "unsafe", url: "javascript:alert(1)" },
              null,
            ],
          },
        },
        cookie,
      ),
    )
    expect(imported.status).toBe(200)

    const listed = await app.request(`${origin}/api/bookmarks`, {
      headers: { Cookie: cookie },
    })
    expect(listed.status).toBe(200)
    await expect(listed.json()).resolves.toMatchObject({
      bookmarks: [
        {
          id: "good",
          name: "Good",
          url: "https://example.com",
          tagIds: [],
          pinned: false,
        },
      ],
    })
  })

  it("manages encrypted API credential profiles without returning secrets", async () => {
    const cookie = await login()
    const tagId = tagRepository.create({ name: "API", expectedRevision: 0 })
      .tags[0].id
    const created = await app.request(
      `${origin}/api/credential-profiles`,
      jsonRequest(
        "POST",
        {
          name: "Primary API",
          apiType: "openai-compatible",
          baseUrl: "https://api.example.test/v1?source=web",
          apiKey: "sk-web-profile-secret",
          tagIds: [tagId],
          notes: "used by the web console",
        },
        cookie,
      ),
    )
    expect(created.status).toBe(201)
    const createdPayload = await created.json()
    expect(createdPayload).toMatchObject({
      revision: 1,
      profiles: [
        {
          name: "Primary API",
          baseUrl: "https://api.example.test",
          apiType: "openai-compatible",
          apiKeyMasked: "sk-w••••cret",
          tagIds: [tagId],
        },
      ],
    })
    expect(JSON.stringify(createdPayload)).not.toContain(
      "sk-web-profile-secret",
    )

    const profileId = createdPayload.profiles[0].id as string
    const updated = await app.request(
      `${origin}/api/credential-profiles/${profileId}`,
      jsonRequest("PATCH", { name: "Renamed API", tagIds: [] }, cookie),
    )
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      revision: 2,
      profiles: [{ id: profileId, name: "Renamed API", tagIds: [] }],
    })
    expect(apiCredentialProfileRepository.get(profileId)?.apiKey).toBe(
      "sk-web-profile-secret",
    )

    const deleted = await app.request(
      `${origin}/api/credential-profiles/${profileId}`,
      jsonRequest("DELETE", undefined, cookie),
    )
    expect(deleted.status).toBe(200)
    await expect(deleted.json()).resolves.toMatchObject({
      revision: 3,
      profiles: [],
    })
  })

  it("exports a saved credential only on explicit request", async () => {
    const cookie = await login()
    const created = apiCredentialProfileRepository.create({
      name: "生产 / Primary",
      apiType: "openai-compatible",
      baseUrl: "https://api.example.com/v1",
      apiKey: "export-secret",
      notes: "keep private",
    })
    const profileId = created.profiles[0].id

    const jsonResponse = await app.request(
      `${origin}/api/credential-profiles/${profileId}/export`,
      jsonRequest("POST", { format: "json" }, cookie),
    )
    expect(jsonResponse.status).toBe(200)
    const jsonPayload = await jsonResponse.json()
    expect(jsonPayload).toMatchObject({
      filename: "生产-Primary.json",
      contentType: "application/json",
    })
    expect(JSON.parse(jsonPayload.content)).toMatchObject({
      name: "生产 / Primary",
      baseUrl: "https://api.example.com",
      apiKey: "export-secret",
    })
    expect(jsonResponse.headers.get("cache-control")).toBe("no-store")

    const envResponse = await app.request(
      `${origin}/api/credential-profiles/${profileId}/export`,
      jsonRequest("POST", { format: "env" }, cookie),
    )
    expect(envResponse.status).toBe(200)
    const envPayload = await envResponse.json()
    expect(envPayload.filename).toBe("生产-Primary.env")
    expect(envPayload.content).toContain('API_KEY="export-secret"')
    expect(envPayload.content).toContain(
      'API_BASE_URL="https://api.example.com"',
    )
    expect(JSON.stringify(apiCredentialProfileRepository.list())).not.toContain(
      "export-secret",
    )
  })

  it("rejects invalid API credential profile input", async () => {
    const cookie = await login()
    const response = await app.request(
      `${origin}/api/credential-profiles`,
      jsonRequest(
        "POST",
        {
          name: "Invalid",
          apiType: "openai-compatible",
          baseUrl: "not-a-url",
          apiKey: "",
        },
        cookie,
      ),
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_CREDENTIAL_PROFILE",
    })

    const unknownTag = await app.request(
      `${origin}/api/credential-profiles`,
      jsonRequest(
        "POST",
        {
          name: "Unknown tag",
          apiType: "openai-compatible",
          baseUrl: "https://api.example.com",
          apiKey: "secret",
          tagIds: ["missing-tag"],
        },
        cookie,
      ),
    )
    expect(unknownTag.status).toBe(400)
    await expect(unknownTag.json()).resolves.toMatchObject({
      code: "UNKNOWN_TAG_IDS",
    })
  })

  it("rejects an invalid administrator password", async () => {
    const response = await app.request(
      `${origin}/api/session`,
      jsonRequest("POST", { password: "wrong" }),
    )
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_CREDENTIALS",
    })
  })

  it("persists automation settings and schedules the next refresh", async () => {
    const cookie = await login()
    const initialResponse = await app.request(
      `${origin}/api/settings/automation`,
      { headers: { Cookie: cookie } },
    )
    expect(initialResponse.status).toBe(200)
    await expect(initialResponse.json()).resolves.toMatchObject({
      revision: 0,
      settings: {
        autoRefreshEnabled: false,
        autoRefreshIntervalMinutes: 30,
        includeTodayCashflow: true,
      },
      runtime: { running: false },
    })

    const updateResponse = await app.request(
      `${origin}/api/settings/automation`,
      jsonRequest(
        "PATCH",
        {
          autoRefreshEnabled: true,
          autoRefreshIntervalMinutes: 15,
          includeTodayCashflow: false,
          autoCheckinEnabled: true,
          autoCheckinTime: "23:59",
          expectedRevision: 0,
        },
        cookie,
      ),
    )
    expect(updateResponse.status).toBe(200)
    const updated = await updateResponse.json()
    expect(updated).toMatchObject({
      revision: 1,
      settings: {
        autoRefreshEnabled: true,
        autoRefreshIntervalMinutes: 15,
        includeTodayCashflow: false,
        autoCheckinEnabled: true,
        autoCheckinTime: "23:59",
      },
      runtime: { running: false },
    })
    expect(updated.runtime.nextRunAt).toBeGreaterThan(Date.now())
    expect(updated.runtime.nextCheckInAt).toBeGreaterThan(Date.now())
  })

  it("runs the server check-in scheduler and records its summary", async () => {
    const cookie = await login()
    const response = await app.request(
      `${origin}/api/checkin/run`,
      jsonRequest("POST", { expectedRevision: 0 }, cookie),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      checkIn: {
        trigger: "manual",
        total: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        browserRequired: 0,
        persistence: "persisted",
      },
    })

    const settingsResponse = await app.request(
      `${origin}/api/settings/automation`,
      { headers: { Cookie: cookie } },
    )
    await expect(settingsResponse.json()).resolves.toMatchObject({
      lastCheckInRun: {
        trigger: "manual",
        persistence: "persisted",
      },
    })
  })

  it("exposes usage-history state and manual synchronization", async () => {
    const cookie = await login()
    const initial = await app.request(`${origin}/api/history/usage`, {
      headers: { Cookie: cookie },
    })
    expect(initial.status).toBe(200)
    await expect(initial.json()).resolves.toMatchObject({
      revision: 0,
      entries: [],
      statuses: [],
    })

    const synced = await app.request(
      `${origin}/api/history/usage/sync`,
      jsonRequest("POST", { retentionDays: 7 }, cookie),
    )
    expect(synced.status).toBe(200)
    await expect(synced.json()).resolves.toMatchObject({
      sync: { total: 0, succeeded: 0, failed: 0, ingested: 0 },
    })

    const notifications = await app.request(`${origin}/api/notifications`, {
      headers: { Cookie: cookie },
    })
    await expect(notifications.json()).resolves.toMatchObject({
      unreadCount: 1,
      notifications: [{ task: "usage_history", status: "success" }],
    })

    const markedRead = await app.request(
      `${origin}/api/notifications/read-all`,
      jsonRequest("POST", undefined, cookie),
    )
    await expect(markedRead.json()).resolves.toMatchObject({ unreadCount: 0 })
  })

  it("stores managed-site credentials without exposing the admin token", async () => {
    const cookie = await login()
    const created = await app.request(
      `${origin}/api/managed-sites`,
      jsonRequest(
        "POST",
        {
          name: "Managed New API",
          siteType: "new-api",
          baseUrl: "https://managed.example.com",
          adminToken: "admin-secret",
          userId: "1",
        },
        cookie,
      ),
    )
    expect(created.status).toBe(201)
    const payload = await created.json()
    expect(payload).toMatchObject({
      revision: 1,
      connections: [
        {
          name: "Managed New API",
          siteType: "new-api",
          baseUrl: "https://managed.example.com",
        },
      ],
    })
    expect(JSON.stringify(payload)).not.toContain("admin-secret")

    const listed = await app.request(`${origin}/api/managed-sites`, {
      headers: { Cookie: cookie },
    })
    expect(JSON.stringify(await listed.json())).not.toContain("admin-secret")
  })

  it("validates provider-specific managed-site credentials", async () => {
    const cookie = await login()
    const createManagedSite = (input: Record<string, unknown>) =>
      app.request(
        `${origin}/api/managed-sites`,
        jsonRequest(
          "POST",
          {
            name: "Managed site",
            baseUrl: "https://managed.example.com",
            adminToken: "",
            userId: "",
            ...input,
          },
          cookie,
        ),
      )

    const invalidAxonHub = await createManagedSite({
      siteType: "axonhub",
      password: "axon-secret",
    })
    expect(invalidAxonHub.status).toBe(400)

    const axonHub = await createManagedSite({
      siteType: "axonhub",
      email: "admin@example.com",
      password: "axon-secret",
    })
    expect(axonHub.status).toBe(201)
    expect(JSON.stringify(await axonHub.json())).not.toContain("axon-secret")

    const claudeCodeHub = await createManagedSite({
      siteType: "claude-code-hub",
      adminToken: "claude-secret",
    })
    expect(claudeCodeHub.status).toBe(201)
    expect(JSON.stringify(await claudeCodeHub.json())).not.toContain(
      "claude-secret",
    )

    const invalidClaudeCodeHub = await createManagedSite({
      siteType: "claude-code-hub",
    })
    expect(invalidClaudeCodeHub.status).toBe(400)
  })

  it("exports and transactionally restores all Web documents", async () => {
    const cookie = await login()
    automationSettingsRepository.update({ includeTodayCashflow: false })
    const connections = managedSiteRepository.create({
      name: "Backup target",
      siteType: "new-api",
      baseUrl: "https://managed.example.com",
      adminToken: "backup-admin-secret",
      userId: "1",
    })
    notificationRepository.add({
      id: "backup-notification",
      task: "account_refresh",
      status: "success",
      title: "Backup notification",
      message: "Stored with the backup",
      createdAt: 1,
    })

    const exported = await app.request(`${origin}/api/backup`, {
      headers: { Cookie: cookie },
    })
    expect(exported.status).toBe(200)
    expect(exported.headers.get("cache-control")).toBe("no-store")
    const backup = await exported.json()
    expect(backup).toMatchObject({
      type: "all-api-hub-web-backup",
      version: 1,
    })
    expect(backup.documents.map((item: { key: string }) => item.key)).toEqual(
      expect.arrayContaining([
        "automation-settings",
        "managed-site-connections",
        "notifications",
      ]),
    )

    let announcementRunning = true
    const announcementScheduler = {
      getStatus: vi.fn(() => ({
        siteAnnouncementsRunning: announcementRunning,
      })),
      stop: vi.fn(),
      reschedule: vi.fn(),
    } as unknown as SiteAnnouncementScheduler
    app = createWebApp({
      config,
      accountsRepository: repository,
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
      siteAnnouncementScheduler: announcementScheduler,
      tagRepository,
    })

    const blockedRestore = await app.request(
      `${origin}/api/backup/restore`,
      jsonRequest("POST", backup, cookie),
    )
    expect(blockedRestore.status).toBe(409)
    announcementRunning = false

    automationSettingsRepository.update({ includeTodayCashflow: true })
    managedSiteRepository.delete(connections.connections[0]!.id)
    notificationRepository.markAllRead()

    const restored = await app.request(
      `${origin}/api/backup/restore`,
      jsonRequest("POST", backup, cookie),
    )
    expect(restored.status).toBe(200)
    await expect(restored.json()).resolves.toEqual({
      restoredDocuments: backup.documents.length,
    })
    expect(
      automationSettingsRepository.get().data.settings.includeTodayCashflow,
    ).toBe(false)
    expect(
      managedSiteRepository.get(connections.connections[0]!.id)?.adminToken,
    ).toBe("backup-admin-secret")
    expect(notificationRepository.get().unreadCount).toBe(1)
    for (const document of backup.documents as Array<{
      key: string
      revision: number
    }>) {
      expect(
        documentStore
          .exportDocuments()
          .find((item) => item.key === document.key)?.revision,
      ).toBeGreaterThan(document.revision)
    }
    expect(announcementScheduler.stop).toHaveBeenCalledOnce()
    expect(announcementScheduler.reschedule).toHaveBeenCalledOnce()
  })

  it("rejects duplicate document keys in a Web backup", async () => {
    const cookie = await login()
    const duplicate = {
      key: "accounts",
      data: {},
      revision: 1,
      updatedAt: 1,
    }
    const response = await app.request(
      `${origin}/api/backup/restore`,
      jsonRequest(
        "POST",
        {
          type: "all-api-hub-web-backup",
          version: 1,
          createdAt: 1,
          documents: [duplicate, duplicate],
        },
        cookie,
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_WEB_BACKUP",
    })
  })

  it("stores redacted WebDAV settings and uploads a full backup", async () => {
    const cookie = await login()
    const invalid = await app.request(
      `${origin}/api/settings/webdav`,
      jsonRequest(
        "PUT",
        {
          url: "https://dav.example.com/backups/",
          username: "backup-user",
          autoBackupEnabled: false,
          intervalMinutes: 60,
          encryptionEnabled: false,
          expectedRevision: 0,
        },
        cookie,
      ),
    )
    expect(invalid.status).toBe(400)
    expect(webDavRepository.get().revision).toBe(0)

    const saved = await app.request(
      `${origin}/api/settings/webdav`,
      jsonRequest(
        "PUT",
        {
          url: "https://dav.example.com/backups/",
          username: "backup-user",
          password: "dav-secret",
          autoBackupEnabled: true,
          intervalMinutes: 30,
          encryptionEnabled: true,
          encryptionPassword: "backup-encryption-secret",
          expectedRevision: 0,
        },
        cookie,
      ),
    )
    expect(saved.status).toBe(200)
    const savedPayload = await saved.json()
    expect(savedPayload).toMatchObject({
      settings: {
        configured: true,
        autoBackupEnabled: true,
        intervalMinutes: 30,
        encryptionEnabled: true,
      },
      runtime: { running: false },
    })
    expect(savedPayload.runtime.nextRunAt).toBeGreaterThan(Date.now())
    expect(JSON.stringify(savedPayload)).not.toContain("dav-secret")
    expect(JSON.stringify(savedPayload)).not.toContain(
      "backup-encryption-secret",
    )
    expect(webDavRepository.getStoredSettings()).toMatchObject({
      password: "dav-secret",
      encryptionPassword: "backup-encryption-secret",
    })

    const tested = await app.request(
      `${origin}/api/settings/webdav/test`,
      jsonRequest("POST", undefined, cookie),
    )
    expect(tested.status).toBe(200)
    expect(webDavClient.test).toHaveBeenCalledWith(
      expect.objectContaining({ password: "dav-secret" }),
    )

    const uploaded = await app.request(
      `${origin}/api/settings/webdav/upload`,
      jsonRequest("POST", undefined, cookie),
    )
    expect(uploaded.status).toBe(200)
    await expect(uploaded.json()).resolves.toMatchObject({
      lastRun: { trigger: "manual", status: "success" },
    })
    expect(webDavClient.upload).toHaveBeenCalledOnce()
    const uploadedContent = vi.mocked(webDavClient.upload).mock.calls[0]?.[1]
    expect(JSON.parse(uploadedContent ?? "null")).toMatchObject({
      type: "all-api-hub-web-backup",
      version: 1,
    })
  })

  it("stores redacted external-notification settings and tests a channel", async () => {
    const cookie = await login()
    const disabledChannel = { enabled: false }
    const baseSettings = {
      enabled: true,
      tasks: {
        account_refresh: true,
        auto_checkin: true,
        usage_history: true,
        balance_history: true,
        webdav_backup: true,
      },
      channels: {
        telegram: disabledChannel,
        feishu: disabledChannel,
        dingtalk: disabledChannel,
        wecom: disabledChannel,
        ntfy: disabledChannel,
        webhook: disabledChannel,
      },
      expectedRevision: 0,
    }

    const invalid = await app.request(
      `${origin}/api/settings/external-notifications`,
      jsonRequest(
        "PUT",
        {
          ...baseSettings,
          channels: {
            ...baseSettings.channels,
            telegram: { enabled: true },
          },
        },
        cookie,
      ),
    )
    expect(invalid.status).toBe(400)
    expect(externalNotificationRepository.get().revision).toBe(0)

    const saved = await app.request(
      `${origin}/api/settings/external-notifications`,
      jsonRequest(
        "PUT",
        {
          ...baseSettings,
          channels: {
            ...baseSettings.channels,
            webhook: {
              enabled: true,
              url: "https://hooks.example.invalid/task/{status}",
            },
          },
        },
        cookie,
      ),
    )
    expect(saved.status).toBe(200)
    const payload = await saved.json()
    expect(payload).toMatchObject({
      enabled: true,
      channels: { webhook: { enabled: true, configured: true } },
      revision: 1,
    })
    expect(JSON.stringify(payload)).not.toContain("hooks.example.invalid")

    const tested = await app.request(
      `${origin}/api/settings/external-notifications/test`,
      jsonRequest("POST", { channel: "webhook" }, cookie),
    )
    expect(tested.status).toBe(200)
    expect(externalNotificationDelivery.send).toHaveBeenCalledWith(
      "webhook",
      expect.objectContaining({ title: "All API Hub 通知测试" }),
      expect.objectContaining({
        url: "https://hooks.example.invalid/task/{status}",
      }),
    )

    vi.mocked(externalNotificationDelivery.send).mockClear()
    notificationService.notify({
      task: "account_refresh",
      status: "success",
    })
    await vi.waitFor(() =>
      expect(externalNotificationDelivery.send).toHaveBeenCalledWith(
        "webhook",
        expect.objectContaining({ task: "account_refresh" }),
        expect.any(Object),
      ),
    )
  })

  it("imports extension data and returns redacted account summaries", async () => {
    const cookie = await login()
    const response = await app.request(
      `${origin}/api/accounts/import`,
      jsonRequest(
        "POST",
        {
          expectedRevision: 0,
          data: {
            accounts: [
              {
                id: "account-1",
                site_name: "Imported account",
                site_url: "https://example.com",
                site_type: SITE_TYPES.NEW_API,
                authType: AuthTypeEnum.AccessToken,
                account_info: {
                  id: "42",
                  username: "tester",
                  access_token: "secret-token",
                  quota: 1_000_000,
                },
              },
            ],
          },
        },
        cookie,
      ),
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      revision: 1,
      accounts: [
        {
          id: "account-1",
          name: "Imported account",
          balance: { USD: 2 },
        },
      ],
    })
    expect(JSON.stringify(payload)).not.toContain("secret-token")
  })

  it("imports extension tags and remaps account and bookmark references atomically", async () => {
    const cookie = await login()
    const localTags = tagRepository.create({
      name: "Production",
      expectedRevision: 0,
    })
    const localProductionId = localTags.tags[0].id
    const backup = {
      version: "4.0",
      timestamp: 1,
      accounts: {
        accounts: [
          {
            id: "tagged-account",
            site_name: "Tagged account",
            site_url: "https://tagged.example.com",
            site_type: SITE_TYPES.NEW_API,
            authType: AuthTypeEnum.AccessToken,
            tagIds: ["remote-production", "orphan-tag"],
            account_info: { access_token: "tagged-secret" },
          },
          {
            id: "legacy-account",
            site_name: "Legacy account",
            site_url: "https://legacy.example.com",
            site_type: SITE_TYPES.NEW_API,
            authType: AuthTypeEnum.AccessToken,
            tags: ["Legacy"],
            account_info: { access_token: "legacy-secret" },
          },
        ],
        bookmarks: [
          {
            id: "tagged-bookmark",
            name: "Tagged bookmark",
            url: "https://bookmark.example.com",
            tagIds: ["remote-production"],
            notes: "",
            created_at: 1,
            updated_at: 1,
          },
        ],
        pinnedAccountIds: [],
        orderedAccountIds: [
          "tagged-account",
          "legacy-account",
          "tagged-bookmark",
        ],
        last_updated: 1,
      },
      tagStore: {
        version: 1,
        tagsById: {
          "remote-production": {
            id: "remote-production",
            name: " production ",
            createdAt: 1,
            updatedAt: 1,
          },
        },
      },
      apiCredentialProfiles: {
        version: 6,
        profiles: [
          {
            id: "remote-profile",
            name: "Imported API",
            apiType: "openai-compatible",
            baseUrl: "https://api.imported.example.com/v1",
            apiKey: "sk-imported-secret",
            tagIds: ["remote-production"],
            notes: "imported",
            createdAt: 1,
            updatedAt: 2,
          },
        ],
        links: [],
        linkTombstones: [],
        lastUpdated: 2,
      },
    }

    const response = await app.request(
      `${origin}/api/accounts/import`,
      jsonRequest("POST", { data: backup, expectedRevision: 0 }, cookie),
    )
    expect(response.status).toBe(200)
    const imported = await response.json()
    expect(imported.revision).toBe(1)
    expect(imported.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tagged-account",
          tagIds: [localProductionId],
        }),
        expect.objectContaining({
          id: "legacy-account",
          tagIds: [expect.any(String)],
        }),
      ]),
    )

    const importedTags = tagRepository.list()
    expect(importedTags.revision).toBe(2)
    expect(importedTags.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: localProductionId,
          name: "Production",
        }),
        expect.objectContaining({ name: "Legacy" }),
      ]),
    )
    const bookmarks = await app.request(`${origin}/api/bookmarks`, {
      headers: { Cookie: cookie },
    })
    await expect(bookmarks.json()).resolves.toMatchObject({
      revision: 1,
      bookmarks: [{ id: "tagged-bookmark", tagIds: [localProductionId] }],
    })
    const profiles = apiCredentialProfileRepository.list()
    expect(profiles.profiles).toHaveLength(1)
    expect(profiles.profiles[0]).toMatchObject({
      name: "Imported API",
      tagIds: [localProductionId],
      apiKeyMasked: "sk-i••••cret",
    })
    expect(JSON.stringify(profiles)).not.toContain("sk-imported-secret")

    const stale = await app.request(
      `${origin}/api/accounts/import`,
      jsonRequest("POST", { data: backup, expectedRevision: 0 }, cookie),
    )
    expect(stale.status).toBe(409)
    expect(tagRepository.list()).toEqual(importedTags)
    expect(apiCredentialProfileRepository.list()).toEqual(profiles)
  })

  it("rejects credential backups newer than the Web importer without partial writes", async () => {
    const cookie = await login()
    const response = await app.request(
      `${origin}/api/accounts/import`,
      jsonRequest(
        "POST",
        {
          expectedRevision: 0,
          data: {
            accounts: [],
            apiCredentialProfiles: {
              version: 999,
              profiles: [],
            },
          },
        },
        cookie,
      ),
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "UNSUPPORTED_CREDENTIAL_PROFILE_VERSION",
      details: { version: 999 },
    })
    expect(repository.getAccounts().revision).toBe(0)
    expect(tagRepository.list().revision).toBe(0)
    expect(apiCredentialProfileRepository.list().revision).toBe(0)
  })

  it("creates and deletes an account with optimistic revisions", async () => {
    const cookie = await login()
    const createResponse = await app.request(
      `${origin}/api/accounts`,
      jsonRequest(
        "POST",
        {
          name: "Web account",
          baseUrl: "https://api.example.com",
          siteType: SITE_TYPES.NEW_API,
          authType: AuthTypeEnum.AccessToken,
          accessToken: "web-secret",
          userId: "7",
          username: "web-user",
          expectedRevision: 0,
        },
        cookie,
      ),
    )

    expect(createResponse.status).toBe(201)
    const created = await createResponse.json()
    expect(created.revision).toBe(1)
    expect(created.accounts).toHaveLength(1)

    const accountId = created.accounts[0].id as string
    const deleteResponse = await app.request(
      `${origin}/api/accounts/${encodeURIComponent(accountId)}?revision=1`,
      jsonRequest("DELETE", undefined, cookie),
    )
    expect(deleteResponse.status).toBe(200)

    const listResponse = await app.request(`${origin}/api/accounts`, {
      headers: { Cookie: cookie },
    })
    const list = await listResponse.json()
    expect(list.accounts).toHaveLength(0)
    expect(list.revision).toBe(2)
  })

  it("mutates selected accounts atomically and preserves deletion records", async () => {
    const cookie = await login()
    const createAccount = async (name: string, expectedRevision: number) => {
      const response = await app.request(
        `${origin}/api/accounts`,
        jsonRequest(
          "POST",
          {
            name,
            baseUrl: `https://${name.toLowerCase()}.example.com`,
            siteType: SITE_TYPES.NEW_API,
            authType: AuthTypeEnum.AccessToken,
            accessToken: `${name}-secret`,
            expectedRevision,
          },
          cookie,
        ),
      )
      expect(response.status).toBe(201)
      return response.json()
    }

    const firstCreated = await createAccount("Alpha", 0)
    const secondCreated = await createAccount("Beta", 1)
    const accountIds = secondCreated.accounts.map(
      (account: { id: string }) => account.id,
    ) as string[]
    expect(firstCreated.accounts).toHaveLength(1)

    repository.mutateAccounts(
      (current) => ({
        ...current,
        pinnedAccountIds: [...accountIds],
        orderedAccountIds: [...accountIds],
      }),
      2,
    )

    const disabled = await app.request(
      `${origin}/api/accounts/bulk`,
      jsonRequest(
        "POST",
        { accountIds, action: "disable", expectedRevision: 3 },
        cookie,
      ),
    )
    expect(disabled.status).toBe(200)
    await expect(disabled.json()).resolves.toMatchObject({
      revision: 4,
      accounts: [{ disabled: true }, { disabled: true }],
    })

    const missingAccount = await app.request(
      `${origin}/api/accounts/bulk`,
      jsonRequest(
        "POST",
        {
          accountIds: [accountIds[0], "missing-account"],
          action: "delete",
          expectedRevision: 4,
        },
        cookie,
      ),
    )
    expect(missingAccount.status).toBe(404)
    await expect(missingAccount.json()).resolves.toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
      details: { accountIds: ["missing-account"] },
    })
    expect(repository.getAccounts()).toMatchObject({
      revision: 4,
      data: { accounts: [{ disabled: true }, { disabled: true }] },
    })

    const deleted = await app.request(
      `${origin}/api/accounts/bulk`,
      jsonRequest(
        "POST",
        { accountIds, action: "delete", expectedRevision: 4 },
        cookie,
      ),
    )
    expect(deleted.status).toBe(200)
    await expect(deleted.json()).resolves.toMatchObject({
      revision: 5,
      accounts: [],
    })

    const stored = repository.getAccounts().data
    expect(stored.pinnedAccountIds).toEqual([])
    expect(stored.orderedAccountIds).toEqual([])
    expect(Object.keys(stored.deletedEntryRecords ?? {})).toEqual(
      expect.arrayContaining(accountIds),
    )
  })

  it("pins accounts and persists a validated manual order", async () => {
    const cookie = await login()
    const createAccount = async (name: string, expectedRevision: number) => {
      const response = await app.request(
        `${origin}/api/accounts`,
        jsonRequest(
          "POST",
          {
            name,
            baseUrl: `https://${name.toLowerCase()}.example.com`,
            siteType: SITE_TYPES.NEW_API,
            authType: AuthTypeEnum.None,
            expectedRevision,
          },
          cookie,
        ),
      )
      expect(response.status).toBe(201)
      return response.json()
    }

    const alphaCreated = await createAccount("Alpha", 0)
    const alphaId = alphaCreated.accounts[0].id as string
    const betaCreated = await createAccount("Beta", 1)
    const betaId = betaCreated.accounts.find(
      (account: { name: string }) => account.name === "Beta",
    ).id as string

    const pinned = await app.request(
      `${origin}/api/accounts/${encodeURIComponent(alphaId)}`,
      jsonRequest("PATCH", { pinned: true, expectedRevision: 2 }, cookie),
    )
    expect(pinned.status).toBe(200)
    await expect(pinned.json()).resolves.toMatchObject({
      revision: 3,
      accounts: [
        { id: alphaId, pinned: true },
        { id: betaId, pinned: false },
      ],
    })

    const ordered = await app.request(
      `${origin}/api/accounts/order`,
      jsonRequest(
        "PUT",
        { accountIds: [betaId, alphaId], expectedRevision: 3 },
        cookie,
      ),
    )
    expect(ordered.status).toBe(200)
    expect(repository.getAccounts().data.orderedAccountIds).toEqual([
      betaId,
      alphaId,
    ])

    const unpinned = await app.request(
      `${origin}/api/accounts/${encodeURIComponent(alphaId)}`,
      jsonRequest("PATCH", { pinned: false, expectedRevision: 4 }, cookie),
    )
    await expect(unpinned.json()).resolves.toMatchObject({
      revision: 5,
      accounts: [
        { id: betaId, pinned: false },
        { id: alphaId, pinned: false },
      ],
    })

    const invalid = await app.request(
      `${origin}/api/accounts/order`,
      jsonRequest(
        "PUT",
        { accountIds: [alphaId], expectedRevision: 5 },
        cookie,
      ),
    )
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toMatchObject({
      code: "INVALID_ACCOUNT_ORDER",
    })
    expect(repository.getAccounts().revision).toBe(5)
  })

  it("edits account metadata and rotates credentials without returning secrets", async () => {
    const cookie = await login()
    const createResponse = await app.request(
      `${origin}/api/accounts`,
      jsonRequest(
        "POST",
        {
          name: "Editable account",
          baseUrl: "https://editable.example.com",
          siteType: SITE_TYPES.NEW_API,
          authType: AuthTypeEnum.AccessToken,
          accessToken: "original-secret",
          userId: "1",
          username: "before",
          expectedRevision: 0,
        },
        cookie,
      ),
    )
    const created = await createResponse.json()
    const accountId = created.accounts[0].id as string

    const metadataResponse = await app.request(
      `${origin}/api/accounts/${encodeURIComponent(accountId)}`,
      jsonRequest(
        "PATCH",
        {
          name: "Renamed account",
          baseUrl: "https://new-editable.example.com/api",
          authType: AuthTypeEnum.AccessToken,
          userId: "2",
          username: "after",
          exchangeRate: 7.5,
          notes: "updated from web",
          expectedRevision: 1,
        },
        cookie,
      ),
    )
    expect(metadataResponse.status).toBe(200)
    const metadata = await metadataResponse.json()
    expect(metadata).toMatchObject({
      revision: 2,
      accounts: [
        {
          id: accountId,
          name: "Renamed account",
          baseUrl: "https://new-editable.example.com/api",
          userId: "2",
          username: "after",
          exchangeRate: 7.5,
          notes: "updated from web",
        },
      ],
    })
    expect(JSON.stringify(metadata)).not.toContain("original-secret")
    expect(
      repository.getAccounts().data.accounts[0]?.account_info.access_token,
    ).toBe("original-secret")

    const invalidRotation = await app.request(
      `${origin}/api/accounts/${encodeURIComponent(accountId)}`,
      jsonRequest(
        "PATCH",
        { authType: AuthTypeEnum.Cookie, expectedRevision: 2 },
        cookie,
      ),
    )
    expect(invalidRotation.status).toBe(400)
    expect(repository.getAccounts().revision).toBe(2)

    const rotated = await app.request(
      `${origin}/api/accounts/${encodeURIComponent(accountId)}`,
      jsonRequest(
        "PATCH",
        {
          authType: AuthTypeEnum.Cookie,
          sessionCookie: "session-cookie",
          expectedRevision: 2,
        },
        cookie,
      ),
    )
    expect(rotated.status).toBe(200)
    expect(repository.getAccounts().data.accounts[0]?.authType).toBe(
      AuthTypeEnum.Cookie,
    )
    expect(
      repository.getAccounts().data.accounts[0]?.cookieAuth?.sessionCookie,
    ).toBe("session-cookie")
    expect(
      repository.getAccounts().data.accounts[0]?.account_info.access_token,
    ).toBe("")
  })

  it("refreshes an account through the shared adapter contract", async () => {
    let usageHistoryRequestCount = 0
    mockServer.use(
      http.get("https://refresh.example.com/api/log/self", ({ request }) => {
        const url = new URL(request.url)
        usageHistoryRequestCount += 1
        expect(url.searchParams.getAll("p")).toEqual(["1"])
        expect(url.search.slice(1)).not.toContain("?")
        return HttpResponse.json({
          success: true,
          data: { items: [], total: 0 },
        })
      }),
    )
    const accountRefreshService = new AccountRefreshService(() => ({
      refreshAccount: async (request) => ({
        success: true,
        healthStatus: {
          status: SiteHealthStatus.Healthy,
          message: "healthy",
        },
        data: {
          quota: 1_500_000,
          today_prompt_tokens: 10,
          today_completion_tokens: 20,
          today_quota_consumption: 250_000,
          today_requests_count: 3,
          today_income: 0,
          checkIn: request.checkIn,
        },
      }),
    }))
    accountRefreshScheduler.stop()
    accountRefreshScheduler = new AccountRefreshScheduler(
      repository,
      automationSettingsRepository,
      accountRefreshService,
      balanceHistoryRepository,
      usageHistoryService,
      notificationService,
    )
    app = createWebApp({
      config,
      accountsRepository: repository,
      accountRefreshService,
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
      tagRepository,
    })
    const cookie = await login()
    const createResponse = await app.request(
      `${origin}/api/accounts`,
      jsonRequest(
        "POST",
        {
          name: "Refresh account",
          baseUrl: "https://refresh.example.com",
          siteType: SITE_TYPES.NEW_API,
          authType: AuthTypeEnum.AccessToken,
          accessToken: "refresh-secret",
          expectedRevision: 0,
        },
        cookie,
      ),
    )
    const created = await createResponse.json()
    const accountId = created.accounts[0].id as string

    const refreshResponse = await app.request(
      `${origin}/api/accounts/${encodeURIComponent(accountId)}/refresh`,
      jsonRequest("POST", { expectedRevision: 1 }, cookie),
    )
    expect(refreshResponse.status).toBe(200)
    const refreshed = await refreshResponse.json()
    expect(refreshed).toMatchObject({
      revision: 2,
      refresh: {
        accountId,
        success: true,
        health: { status: SiteHealthStatus.Healthy },
      },
      accounts: [
        {
          id: accountId,
          balance: { USD: 3 },
          todayConsumption: { USD: 0.5 },
        },
      ],
    })
    expect(JSON.stringify(refreshed)).not.toContain("refresh-secret")

    const historyResponse = await app.request(`${origin}/api/history/balance`, {
      headers: { Cookie: cookie },
    })
    expect(historyResponse.status).toBe(200)
    await expect(historyResponse.json()).resolves.toMatchObject({
      revision: 1,
      entries: [
        {
          accountId,
          accountName: "Refresh account",
          balanceUsd: 3,
          source: "refresh",
        },
      ],
    })

    const batchResponse = await app.request(
      `${origin}/api/accounts/refresh`,
      jsonRequest("POST", { expectedRevision: 2, concurrency: 2 }, cookie),
    )
    expect(batchResponse.status).toBe(200)
    await expect(batchResponse.json()).resolves.toMatchObject({
      revision: 3,
      refresh: {
        total: 1,
        succeeded: 1,
        failed: 0,
        skipped: 0,
      },
    })

    const automationResponse = await app.request(
      `${origin}/api/settings/automation`,
      { headers: { Cookie: cookie } },
    )
    await expect(automationResponse.json()).resolves.toMatchObject({
      revision: 1,
      lastRun: {
        trigger: "manual",
        status: "completed",
        succeeded: 1,
      },
    })
    expect(usageHistoryRequestCount).toBe(2)
    expect(usageHistoryRepository.getAccount(accountId).status.state).toBe(
      "success",
    )
  })

  it("manages Web display preferences and scoped channel filters", async () => {
    const cookie = await login()
    const initialPreferences = await app.request(
      `${origin}/api/settings/preferences`,
      { headers: { Cookie: cookie } },
    )
    expect(initialPreferences.status).toBe(200)
    const initial = await initialPreferences.json()

    const updatedPreferences = await app.request(
      `${origin}/api/settings/preferences`,
      jsonRequest(
        "PATCH",
        {
          themeMode: "dark",
          currencyType: "CNY",
          sortField: "created_at",
          sortOrder: "asc",
          expectedRevision: initial.revision,
        },
        cookie,
      ),
    )
    expect(updatedPreferences.status).toBe(200)
    await expect(updatedPreferences.json()).resolves.toMatchObject({
      revision: 1,
      preferences: {
        themeMode: "dark",
        currencyType: "CNY",
        sortField: "created_at",
        sortOrder: "asc",
      },
    })

    const channelUpdate = await app.request(
      `${origin}/api/channel-configs`,
      jsonRequest(
        "PATCH",
        {
          managedSiteType: "new-api",
          scopeKey: "https://managed.example.com/admin/",
          resourceId: 7,
          channelId: 7,
          rules: [
            {
              id: "include-gpt",
              name: "GPT",
              kind: "pattern",
              pattern: "gpt-",
              isRegex: false,
              action: "include",
              enabled: true,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
        cookie,
      ),
    )
    expect(channelUpdate.status).toBe(200)
    await expect(channelUpdate.json()).resolves.toMatchObject({
      revision: 1,
      snapshot: { schemaVersion: 1 },
    })

    const imported = await app.request(
      `${origin}/api/accounts/import`,
      jsonRequest(
        "POST",
        {
          expectedRevision: 0,
          data: {
            accounts: [],
            preferences: {
              themeMode: "light",
              currencyType: "USD",
              accountAutoRefresh: { enabled: true, interval: 900 },
              showTodayCashflow: false,
              autoCheckin: { globalEnabled: true, deterministicTime: "08:30" },
              usageHistory: {
                enabled: true,
                retentionDays: 14,
                scheduleMode: "afterRefresh",
              },
              browserOnlySetting: "do-not-store",
            },
            channelConfigs: { schemaVersion: 1, configs: {} },
          },
        },
        cookie,
      ),
    )
    expect(imported.status).toBe(200)
    const importedPreferences = await app.request(
      `${origin}/api/settings/preferences`,
      { headers: { Cookie: cookie } },
    )
    await expect(importedPreferences.json()).resolves.toMatchObject({
      preferences: { themeMode: "light", currencyType: "USD" },
      unsupportedExtensionKeys: ["browserOnlySetting"],
    })
    const importedAutomation = await app.request(
      `${origin}/api/settings/automation`,
      { headers: { Cookie: cookie } },
    )
    await expect(importedAutomation.json()).resolves.toMatchObject({
      settings: {
        autoRefreshEnabled: true,
        autoRefreshIntervalMinutes: 15,
        includeTodayCashflow: false,
        autoCheckinEnabled: true,
        autoCheckinTime: "08:30",
        usageHistoryEnabled: true,
        usageHistoryRetentionDays: 14,
        usageHistoryAfterRefresh: true,
      },
    })
  })
})

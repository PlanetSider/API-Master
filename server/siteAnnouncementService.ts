import type { ApiServiceRequest } from "~/services/apiTransport/type"
import { getSiteAnnouncementProvider } from "~/services/siteAnnouncements/providers"
import {
  fingerprintAnnouncement,
  normalizeAnnouncementText,
} from "~/services/siteAnnouncements/text"
import { toSanitizedErrorSummary } from "~/services/verification/aiApiVerification/utils"
import type { SiteAccount } from "~/types"
import {
  SITE_ANNOUNCEMENT_PROVIDER_IDS,
  SITE_ANNOUNCEMENT_STATUS,
  type SiteAnnouncement,
  type SiteAnnouncementProvider,
  type SiteAnnouncementProviderRequest,
  type SiteAnnouncementRecordInput,
  type SiteAnnouncementSiteState,
} from "~/types/siteAnnouncements"
import type {
  WebSiteAnnouncementListResponse,
  WebSiteAnnouncementSyncResponse,
} from "~/web/contracts"

import type { AccountsRepository } from "./accountsRepository"
import type { AutomationSettingsRepository } from "./automationSettingsRepository"
import type { NotificationService } from "./notificationService"
import type { SiteAnnouncementRepository } from "./siteAnnouncementRepository"
import { assertSafeUpstreamUrl } from "./ssrfGuard"

export interface SiteAnnouncementSyncSummary {
  checked: number
  created: number
  failed: number
  unsupported: number
  skipped: number
}

const createProviderRequest = (
  account: SiteAccount,
  provider: SiteAnnouncementProvider,
): SiteAnnouncementProviderRequest => {
  const apiRequest: ApiServiceRequest = {
    baseUrl: account.site_url,
    accountId: account.id,
    auth: {
      authType: account.authType,
      userId: account.account_info.id,
      accessToken: account.account_info.access_token,
      cookie: account.cookieAuth?.sessionCookie,
      refreshToken: account.sub2apiAuth?.refreshToken,
      tokenExpiresAt: account.sub2apiAuth?.tokenExpiresAt,
    },
  }
  return {
    accountId: account.id,
    siteName: account.site_name,
    siteType: account.site_type,
    baseUrl: account.site_url,
    providerId: provider.id,
    apiRequest,
  }
}

const dedupeAccounts = (accounts: SiteAccount[]) => {
  const seen = new Set<string>()
  return accounts.filter((account) => {
    if (account.disabled) return false
    const provider = getSiteAnnouncementProvider(account.site_type)
    if (account.site_type === "sub2api") return true
    const key = provider.createSiteKey({
      accountId: account.id,
      siteType: account.site_type,
      baseUrl: account.site_url,
    })
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const createRecordInput = (params: {
  account: SiteAccount
  provider: SiteAnnouncementProvider
  siteKey: string
  announcement: SiteAnnouncement
}): SiteAnnouncementRecordInput => {
  const title = normalizeAnnouncementText(params.announcement.title)
  const content = normalizeAnnouncementText(params.announcement.content)
  const fingerprint =
    params.announcement.fingerprint ??
    fingerprintAnnouncement([
      params.announcement.id ?? "",
      title,
      content,
      params.announcement.createdAt ?? "",
      params.announcement.updatedAt ?? "",
    ])
  return {
    siteKey: params.siteKey,
    siteName: params.account.site_name,
    siteType: params.account.site_type,
    baseUrl: params.account.site_url,
    accountId: params.account.id,
    providerId: params.provider.id,
    upstreamId: params.announcement.id,
    title,
    content,
    createdAt: params.announcement.createdAt,
    updatedAt: params.announcement.updatedAt,
    readAt: params.announcement.readAt,
    fingerprint,
  }
}

const createSiteState = (params: {
  account: SiteAccount
  provider: SiteAnnouncementProvider
  siteKey: string
  status: SiteAnnouncementSiteState["status"]
  error?: string
  now: number
}): Omit<SiteAnnouncementSiteState, "records"> => ({
  siteKey: params.siteKey,
  siteName: params.account.site_name,
  siteType: params.account.site_type,
  baseUrl: params.account.site_url,
  accountId: params.account.id,
  providerId: params.provider.id,
  status: params.status,
  lastCheckedAt: params.now,
  ...(params.status === SITE_ANNOUNCEMENT_STATUS.Success
    ? { lastSuccessAt: params.now }
    : {}),
  ...(params.error ? { lastError: params.error } : {}),
})

const getSafeErrorMessage = (error: unknown, account: SiteAccount) =>
  toSanitizedErrorSummary(error, [
    account.account_info.access_token,
    account.cookieAuth?.sessionCookie ?? "",
    account.sub2apiAuth?.refreshToken ?? "",
  ]) || "Site announcement sync failed"

export class SiteAnnouncementService {
  private inFlight: Promise<WebSiteAnnouncementSyncResponse> | undefined

  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly repository: SiteAnnouncementRepository,
    private readonly settingsRepository: AutomationSettingsRepository,
    private readonly notificationService: NotificationService,
  ) {}

  getResponse(): WebSiteAnnouncementListResponse {
    return this.repository.toResponse()
  }

  runNow(accountIds?: string[]) {
    if (this.inFlight) return this.inFlight
    this.inFlight = this.execute(accountIds).finally(() => {
      this.inFlight = undefined
    })
    return this.inFlight
  }

  async markRead(recordId: string) {
    const record = this.repository.getRecord(recordId)
    if (!record) return this.getResponse()

    if (
      record.providerId === SITE_ANNOUNCEMENT_PROVIDER_IDS.Sub2Api &&
      record.upstreamId
    ) {
      const account = this.accountsRepository
        .getAccounts()
        .data.accounts.find((item) => item.id === record.accountId)
      if (account) {
        const provider = getSiteAnnouncementProvider(account.site_type)
        await provider.markRead?.(createProviderRequest(account, provider), [
          { id: record.upstreamId },
        ])
      }
    }

    this.repository.markRead(recordId)
    return this.getResponse()
  }

  markAllRead(siteKey?: string) {
    this.repository.markAllRead(siteKey)
    return this.getResponse()
  }

  private async execute(
    accountIds?: string[],
  ): Promise<WebSiteAnnouncementSyncResponse> {
    const allAccounts = this.accountsRepository.getAccounts().data.accounts
    const selected = accountIds
      ? allAccounts.filter((account) => accountIds.includes(account.id))
      : allAccounts
    const accounts = dedupeAccounts(selected)
    const summary: SiteAnnouncementSyncSummary = {
      checked: 0,
      created: 0,
      failed: 0,
      unsupported: 0,
      skipped: Math.max(0, selected.length - accounts.length),
    }

    for (const account of accounts) {
      const provider = getSiteAnnouncementProvider(account.site_type)
      const request = createProviderRequest(account, provider)
      const siteKey = provider.createSiteKey({
        accountId: account.id,
        siteType: account.site_type,
        baseUrl: account.site_url,
      })
      const now = Date.now()
      summary.checked += 1

      try {
        await assertSafeUpstreamUrl(account.site_url, "Account")
        const result = await provider.fetch(request)
        if (result.status === SITE_ANNOUNCEMENT_STATUS.Error)
          summary.failed += 1
        if (result.status === SITE_ANNOUNCEMENT_STATUS.Unsupported)
          summary.unsupported += 1

        const upserted = this.repository.upsertDiscoveredRecords({
          site: createSiteState({
            account,
            provider,
            siteKey,
            status: result.status,
            error: result.error,
            now,
          }),
          records: result.announcements.map((announcement) =>
            createRecordInput({ account, provider, siteKey, announcement }),
          ),
          now,
        })
        summary.created += upserted.created.length

        if (
          upserted.created.length > 0 &&
          this.settingsRepository.get().data.settings
            .siteAnnouncementNotificationsEnabled
        ) {
          this.notificationService.notify({
            task: "site_announcements",
            status: "success",
            message: `${account.site_name || account.site_url} 发现 ${upserted.created.length} 条新公告`,
            counts: {
              total: upserted.created.length,
              success: upserted.created.length,
              failed: 0,
              skipped: 0,
            },
          })
          await provider.markRead?.(request, result.announcements)
        }
      } catch (error) {
        summary.failed += 1
        this.repository.upsertSiteStatus(
          createSiteState({
            account,
            provider,
            siteKey,
            status: SITE_ANNOUNCEMENT_STATUS.Error,
            error: getSafeErrorMessage(error, account),
            now,
          }),
        )
      }
    }

    const response = this.repository.toResponse()
    return {
      ...response,
      sync: summary,
    }
  }

  shouldRunAutomatically() {
    return this.settingsRepository.get().data.settings.siteAnnouncementsEnabled
  }
}

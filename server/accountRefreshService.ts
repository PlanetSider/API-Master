import { UI_CONSTANTS } from "~/constants/ui"
import type { RefreshAccountResult } from "~/services/accounts/accountDataModel"
import {
  AccountUpdateUserTimestampMode,
  applySiteAccountUpdates,
} from "~/services/accounts/accountDefaults"
import { normalizeAccountSiteSupplementalAuth } from "~/services/accounts/accountSiteProfile"
import type { AccountRefreshCapability } from "~/services/apiAdapters/contracts/accountRefresh"
import { mergeRefreshedCheckInStatus } from "~/services/checkin/autoCheckin/state"
import { toSanitizedErrorSummary } from "~/services/verification/aiApiVerification/utils"
import { SiteHealthStatus, type SiteAccount } from "~/types"

import { resolveServerAccountRefresh } from "./accountRefreshRegistry"
import { assertSafeUpstreamUrl } from "./ssrfGuard"

type AccountRefreshResolver = (
  siteType: SiteAccount["site_type"],
) =>
  | AccountRefreshCapability
  | undefined
  | Promise<AccountRefreshCapability | undefined>

export interface WebAccountRefreshResult {
  account: SiteAccount
  success: boolean
}

export interface WebBatchAccountRefreshResult {
  accounts: SiteAccount[]
  refreshedAccountIds: string[]
  total: number
  succeeded: number
  failed: number
  skipped: number
}

export class AccountRefreshUnavailableError extends Error {
  constructor(public readonly reason: "account_disabled" | "adapter_missing") {
    super(
      reason === "account_disabled"
        ? "Disabled accounts cannot be refreshed"
        : "Account refresh is not supported for this site type",
    )
    this.name = "AccountRefreshUnavailableError"
  }
}

const defaultRefreshResolver: AccountRefreshResolver =
  resolveServerAccountRefresh

const normalizeBaseUrl = (value: string) => {
  const url = new URL(value)
  return url.origin
}

const resolveManualQuota = (account: SiteAccount) => {
  const value = account.manualBalanceUsd?.trim()
  if (!value) return undefined
  const amount = Number.parseFloat(value)
  if (!Number.isFinite(amount) || amount < 0) return undefined
  return Math.round(amount * UI_CONSTANTS.EXCHANGE_RATE.CONVERSION_FACTOR)
}

const getAccountSecrets = (account: SiteAccount) => [
  account.account_info.access_token,
  account.cookieAuth?.sessionCookie ?? "",
  account.sub2apiAuth?.refreshToken ?? "",
]

const applyRefreshResult = (
  account: SiteAccount,
  result: RefreshAccountResult,
  now: number,
) => {
  const updates: Partial<SiteAccount> = {
    health: {
      status: result.healthStatus.status,
      ...(result.healthStatus.message
        ? {
            reason:
              toSanitizedErrorSummary(
                result.healthStatus.message,
                getAccountSecrets(account),
              ) || undefined,
          }
        : {}),
      code: result.healthStatus.code,
    },
    last_sync_time: now,
  }

  let checkIn = account.checkIn
  if (result.success) {
    const manualQuota = resolveManualQuota(account)
    checkIn = mergeRefreshedCheckInStatus({
      latest: account.checkIn,
      refreshed: result.data.checkIn,
    })
    updates.account_info = {
      ...account.account_info,
      quota: manualQuota ?? result.data.quota,
      today_prompt_tokens: result.data.today_prompt_tokens,
      today_completion_tokens: result.data.today_completion_tokens,
      today_quota_consumption: result.data.today_quota_consumption,
      today_requests_count: result.data.today_requests_count,
      today_income: result.data.today_income,
      todayStatsAvailability: result.data.todayStatsAvailability,
      usage: result.data.usage,
      subscription: result.data.subscription,
      recentUsageRecords: result.data.recentUsageRecords,
    }

    const authUpdate = result.authUpdate
    if (authUpdate) {
      updates.account_info = {
        ...updates.account_info,
        ...(authUpdate.accessToken?.trim()
          ? { access_token: authUpdate.accessToken.trim() }
          : {}),
        ...(authUpdate.userId?.trim() ? { id: authUpdate.userId.trim() } : {}),
        ...(authUpdate.username?.trim()
          ? { username: authUpdate.username.trim() }
          : {}),
      }
      const supplementalAuth = normalizeAccountSiteSupplementalAuth({
        siteType: account.site_type,
        sub2apiAuth: authUpdate.sub2apiAuth,
      })
      if (supplementalAuth.sub2apiAuth) {
        updates.sub2apiAuth = supplementalAuth.sub2apiAuth
      }
    }
  }

  return applySiteAccountUpdates({
    account,
    updates: { ...updates, checkIn },
    now,
    userTimestampMode: AccountUpdateUserTimestampMode.Preserve,
  })
}

export class AccountRefreshService {
  constructor(
    private readonly resolveRefresh: AccountRefreshResolver = defaultRefreshResolver,
    private readonly validateUpstreamUrl: typeof assertSafeUpstreamUrl = assertSafeUpstreamUrl,
  ) {}

  async refreshAccount(
    account: SiteAccount,
    includeTodayCashflow = true,
  ): Promise<WebAccountRefreshResult> {
    if (account.disabled) {
      throw new AccountRefreshUnavailableError("account_disabled")
    }

    const capability = await this.resolveRefresh(account.site_type)
    if (!capability) {
      throw new AccountRefreshUnavailableError("adapter_missing")
    }

    let result: RefreshAccountResult
    try {
      await this.validateUpstreamUrl(account.site_url, "Account")
      result = await capability.refreshAccount({
        baseUrl: normalizeBaseUrl(account.site_url),
        accountId: account.id,
        siteType: account.site_type,
        checkIn: account.checkIn,
        exchangeRate: account.exchange_rate,
        includeTodayCashflow,
        includeCheckInStatus: false,
        auth: {
          authType: account.authType,
          userId: account.account_info.id,
          accessToken: account.account_info.access_token,
          cookie: account.cookieAuth?.sessionCookie,
          refreshToken: account.sub2apiAuth?.refreshToken,
          tokenExpiresAt: account.sub2apiAuth?.tokenExpiresAt,
        },
      })
    } catch (error) {
      result = {
        success: false,
        healthStatus: {
          status: SiteHealthStatus.Unknown,
          message:
            error instanceof Error ? error.message : "Account refresh failed",
        },
      }
    }

    return {
      account: applyRefreshResult(account, result, Date.now()),
      success: result.success,
    }
  }

  async refreshAccounts(
    accounts: SiteAccount[],
    includeTodayCashflow = true,
    concurrency = 3,
  ): Promise<WebBatchAccountRefreshResult> {
    const refreshed = new Map<string, SiteAccount>()
    const refreshedAccountIds: string[] = []
    let cursor = 0
    let succeeded = 0
    let failed = 0
    let skipped = 0

    const worker = async () => {
      while (cursor < accounts.length) {
        const account = accounts[cursor]
        cursor += 1
        if (!account) continue
        if (account.disabled) {
          skipped += 1
          continue
        }

        try {
          const result = await this.refreshAccount(
            account,
            includeTodayCashflow,
          )
          refreshed.set(account.id, result.account)
          if (result.success) {
            succeeded += 1
            refreshedAccountIds.push(account.id)
          } else failed += 1
        } catch (error) {
          if (error instanceof AccountRefreshUnavailableError) {
            skipped += 1
          } else {
            failed += 1
          }
        }
      }
    }

    const workerCount = Math.max(
      1,
      Math.min(Math.floor(concurrency), accounts.length || 1),
    )
    await Promise.all(Array.from({ length: workerCount }, () => worker()))

    return {
      accounts: accounts.map((account) => refreshed.get(account.id) ?? account),
      refreshedAccountIds,
      total: accounts.length,
      succeeded,
      failed,
      skipped,
    }
  }
}

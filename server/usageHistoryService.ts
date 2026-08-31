import { REQUEST_CONFIG } from "~/services/apiTransport/constant"
import type { ApiServiceRequest } from "~/services/apiTransport/type"
import { USAGE_HISTORY_LIMITS } from "~/services/history/usageHistory/constants"
import {
  computeRetentionCutoffDayKey,
  ingestConsumeLogItems,
} from "~/services/history/usageHistory/core"
import { LogType } from "~/services/history/usageHistory/usageLogModel"
import type {
  LogItem,
  LogResponseData,
} from "~/services/history/usageHistory/usageLogModel"
import { toSanitizedErrorSummary } from "~/services/verification/aiApiVerification/utils"
import type { SiteAccount } from "~/types"

import { assertSafeUpstreamUrl } from "./ssrfGuard"
import { type UsageHistoryRepository } from "./usageHistoryRepository"

export interface WebUsageHistorySyncResult {
  accountId: string
  status: "success" | "error"
  ingestedCount: number
  pagesFetched: number
  partial: boolean
  error?: string
}

const createRequest = (account: SiteAccount): ApiServiceRequest => ({
  baseUrl: new URL(account.site_url).origin,
  accountId: account.id,
  auth: {
    authType: account.authType,
    userId: account.account_info.id,
    accessToken: account.account_info.access_token,
    cookie: account.cookieAuth?.sessionCookie,
    refreshToken: account.sub2apiAuth?.refreshToken,
    tokenExpiresAt: account.sub2apiAuth?.tokenExpiresAt,
  },
})

const getAccountSecrets = (account: SiteAccount) => [
  account.account_info.access_token,
  account.cookieAuth?.sessionCookie ?? "",
  account.sub2apiAuth?.refreshToken ?? "",
]

const fetchPage = async (
  request: ApiServiceRequest,
  page: number,
  startTimestamp: number,
  endTimestamp: number,
) => {
  const { fetchApiData } = await import("~/services/apiTransport/request")
  const query = new URLSearchParams({
    p: String(page),
    page_size: String(REQUEST_CONFIG.DEFAULT_PAGE_SIZE),
    type: String(LogType.Consume),
    token_name: "",
    model_name: "",
    start_timestamp: String(startTimestamp),
    end_timestamp: String(endTimestamp),
    group: "",
  })
  return fetchApiData<LogResponseData>(request, {
    endpoint: `/api/log/self?${query.toString()}`,
  })
}

export class UsageHistoryService {
  constructor(private readonly repository: UsageHistoryRepository) {}

  async syncAccount(
    account: SiteAccount,
    retentionDays: number,
  ): Promise<WebUsageHistorySyncResult> {
    const nowMs = Date.now()
    const endTimestamp = Math.floor(nowMs / 1000)
    const retentionStart = Math.max(
      0,
      endTimestamp - Math.max(1, retentionDays) * 86_400,
    )
    const store = this.repository.getAccount(account.id)
    const startTimestamp = Math.max(
      store.cursor.lastSeenCreatedAt,
      retentionStart,
    )
    const startCursor = structuredClone(store.cursor)
    let cursorCandidate = structuredClone(startCursor)
    let pagesFetched = 0
    let ingestedCount = 0
    let partial = false

    try {
      await assertSafeUpstreamUrl(account.site_url, "Account")
      const request = createRequest(account)
      const firstPage = await fetchPage(
        request,
        1,
        startTimestamp,
        endTimestamp,
      )
      const total = Number(firstPage.total) || 0
      const totalPages = Math.min(
        USAGE_HISTORY_LIMITS.maxPages,
        Math.max(1, Math.ceil(total / REQUEST_CONFIG.DEFAULT_PAGE_SIZE)),
      )
      partial = Math.ceil(total / REQUEST_CONFIG.DEFAULT_PAGE_SIZE) > totalPages

      for (let page = totalPages; page >= 1; page -= 1) {
        const response =
          page === 1
            ? firstPage
            : await fetchPage(request, page, startTimestamp, endTimestamp)
        pagesFetched += 1
        const items = Array.isArray(response.items)
          ? response.items.slice(0, USAGE_HISTORY_LIMITS.maxItems)
          : []
        const ingested = ingestConsumeLogItems({
          accountStore: store,
          items: items as LogItem[],
          startCursor,
          cursorCandidate,
        })
        cursorCandidate = ingested.cursorCandidate
        ingestedCount += ingested.ingestedCount
      }

      store.cursor = cursorCandidate
      store.status = {
        state: "success",
        lastSyncAt: nowMs,
        lastSuccessAt: nowMs,
        ...(partial ? { lastWarning: "History page limit reached" } : {}),
      }
      this.repository.saveAccount(
        account.id,
        store,
        computeRetentionCutoffDayKey(retentionDays, endTimestamp),
      )
      return {
        accountId: account.id,
        status: "success",
        ingestedCount,
        pagesFetched,
        partial,
      }
    } catch (error) {
      const message =
        toSanitizedErrorSummary(error, getAccountSecrets(account)) ||
        "Usage sync failed"
      store.status = { state: "error", lastSyncAt: nowMs, lastError: message }
      this.repository.saveAccount(
        account.id,
        store,
        computeRetentionCutoffDayKey(retentionDays, endTimestamp),
      )
      return {
        accountId: account.id,
        status: "error",
        ingestedCount: 0,
        pagesFetched,
        partial: false,
        error: message,
      }
    }
  }

  async syncAccounts(accounts: SiteAccount[], retentionDays: number) {
    const results: WebUsageHistorySyncResult[] = []
    for (const account of accounts) {
      if (account.disabled) continue
      results.push(await this.syncAccount(account, retentionDays))
    }
    return {
      results,
      total: results.length,
      succeeded: results.filter((result) => result.status === "success").length,
      failed: results.filter((result) => result.status === "error").length,
      ingested: results.reduce((sum, result) => sum + result.ingestedCount, 0),
      partial: results.filter((result) => result.partial).length,
    }
  }
}

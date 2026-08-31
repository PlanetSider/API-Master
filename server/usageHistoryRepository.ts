import { UI_CONSTANTS } from "~/constants/ui"
import { computeUsageHistoryExport } from "~/services/history/usageHistory/analytics"
import {
  createEmptyUsageHistoryAccountStore,
  pruneUsageHistoryAccountStore,
} from "~/services/history/usageHistory/core"
import type { SiteAccount } from "~/types"
import type {
  UsageHistoryAggregate,
  UsageHistoryExportSelection,
  UsageHistoryLatencyAggregate,
} from "~/types/usageHistory"
import {
  USAGE_HISTORY_STORE_SCHEMA_VERSION,
  type UsageHistoryAccountStore,
  type UsageHistoryStore,
} from "~/types/usageHistory"
import type {
  WebUsageAnalyticsResponse,
  WebUsageHistoryResponse,
} from "~/web/contracts"

import type {
  EncryptedDocumentStore,
  VersionedDocument,
} from "./encryptedDocumentStore"

const USAGE_HISTORY_DOCUMENT_KEY = "usage-history"

const createEmptyStore = (): UsageHistoryStore => ({
  schemaVersion: USAGE_HISTORY_STORE_SCHEMA_VERSION,
  accounts: {},
})

const normalizeStore = (value: unknown): UsageHistoryStore => {
  if (!value || typeof value !== "object") return createEmptyStore()
  const candidate = value as Partial<UsageHistoryStore>
  if (
    candidate.schemaVersion !== USAGE_HISTORY_STORE_SCHEMA_VERSION ||
    !candidate.accounts ||
    typeof candidate.accounts !== "object"
  ) {
    return createEmptyStore()
  }
  return candidate as UsageHistoryStore
}

export class UsageHistoryRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  get(): VersionedDocument<UsageHistoryStore> {
    return this.store.read(
      USAGE_HISTORY_DOCUMENT_KEY,
      createEmptyStore,
      normalizeStore,
    )
  }

  getAccount(accountId: string): UsageHistoryAccountStore {
    return (
      this.get().data.accounts[accountId] ??
      createEmptyUsageHistoryAccountStore()
    )
  }

  saveAccount(
    accountId: string,
    accountStore: UsageHistoryAccountStore,
    cutoffDayKey: string,
  ) {
    return this.store.mutate(
      USAGE_HISTORY_DOCUMENT_KEY,
      createEmptyStore,
      normalizeStore,
      (history) => {
        pruneUsageHistoryAccountStore(accountStore, cutoffDayKey)
        history.accounts[accountId] = accountStore
        return history
      },
    )
  }

  toWebResponse(accounts: SiteAccount[]): WebUsageHistoryResponse {
    const document = this.get()
    const names = new Map(
      accounts.map((account) => [account.id, account.site_name]),
    )
    const entries: WebUsageHistoryResponse["entries"] = []
    const statuses: WebUsageHistoryResponse["statuses"] = []

    for (const [accountId, history] of Object.entries(document.data.accounts)) {
      const accountName = names.get(accountId) ?? accountId
      statuses.push({
        accountId,
        accountName,
        state: history.status.state,
        ...(history.status.lastSyncAt
          ? { lastSyncAt: history.status.lastSyncAt }
          : {}),
        ...(history.status.lastError
          ? { error: history.status.lastError }
          : {}),
      })
      for (const [day, aggregate] of Object.entries(history.daily)) {
        entries.push({
          accountId,
          accountName,
          day,
          requests: aggregate.requests,
          promptTokens: aggregate.promptTokens,
          completionTokens: aggregate.completionTokens,
          totalTokens: aggregate.totalTokens,
          consumedUsd:
            aggregate.quotaConsumed /
            UI_CONSTANTS.EXCHANGE_RATE.CONVERSION_FACTOR,
        })
      }
    }
    entries.sort((left, right) =>
      left.day === right.day
        ? left.accountName.localeCompare(right.accountName)
        : right.day.localeCompare(left.day),
    )
    return { entries, statuses, revision: document.revision }
  }

  /**
   * Return a compact, browser-oriented projection of the detailed aggregate
   * store. Raw request logs and token secrets never leave the server.
   */
  toAnalyticsResponse(
    accounts: SiteAccount[],
    selection: UsageHistoryExportSelection,
  ): WebUsageAnalyticsResponse {
    const document = this.get()
    const accountNames = new Map(
      accounts.map((account) => [account.id, account.site_name]),
    )
    const resolvedAccountIds =
      selection.accountIds.length > 0
        ? selection.accountIds
        : Object.keys(document.data.accounts)
    const availableDays = resolvedAccountIds
      .flatMap((accountId) =>
        Object.keys(document.data.accounts[accountId]?.daily ?? {}),
      )
      .sort()
    const fallbackDay = new Date().toISOString().slice(0, 10)
    const startDay = selection.startDay || availableDays[0] || fallbackDay
    const endDay = selection.endDay || availableDays.at(-1) || startDay
    const resolvedSelection: UsageHistoryExportSelection = {
      accountIds: resolvedAccountIds,
      startDay,
      endDay,
    }
    const exportData = computeUsageHistoryExport({
      store: document.data,
      selection: resolvedSelection,
    })

    const toAggregate = (aggregate?: UsageHistoryAggregate) => ({
      requests: aggregate?.requests ?? 0,
      promptTokens: aggregate?.promptTokens ?? 0,
      completionTokens: aggregate?.completionTokens ?? 0,
      totalTokens: aggregate?.totalTokens ?? 0,
      consumedUsd:
        (aggregate?.quotaConsumed ?? 0) /
        UI_CONSTANTS.EXCHANGE_RATE.CONVERSION_FACTOR,
    })

    const addAggregate = (
      target: UsageHistoryAggregate,
      source: UsageHistoryAggregate,
    ) => {
      target.requests += source.requests
      target.promptTokens += source.promptTokens
      target.completionTokens += source.completionTokens
      target.totalTokens += source.totalTokens
      target.quotaConsumed += source.quotaConsumed
    }

    const sumDaily = (
      daily: Record<string, UsageHistoryAggregate>,
    ): UsageHistoryAggregate =>
      Object.values(daily).reduce(
        (sum, aggregate) => {
          addAggregate(sum, aggregate)
          return sum
        },
        {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          quotaConsumed: 0,
        },
      )

    const accountIds = resolvedSelection.accountIds
    const accountRows = accountIds.map((accountId) => ({
      accountId,
      accountName: accountNames.get(accountId) ?? accountId,
      aggregate: toAggregate(
        sumDaily(exportData.accounts[accountId]?.daily ?? {}),
      ),
    }))
    const modelRows = Object.entries(exportData.fused.byModel)
      .map(([model, aggregate]) => ({
        model,
        aggregate: toAggregate(aggregate),
      }))
      .sort(
        (left, right) =>
          right.aggregate.totalTokens - left.aggregate.totalTokens,
      )

    const totalsRaw = sumDaily(exportData.fused.daily)
    const daily = Object.entries(exportData.fused.daily)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([day, aggregate]) => ({ day, ...toAggregate(aggregate) }))

    const latency = Object.values(exportData.fused.latencyDaily).reduce(
      (sum, aggregate: UsageHistoryLatencyAggregate) => ({
        count: sum.count + aggregate.count,
        sumSeconds: sum.sumSeconds + aggregate.sum,
        maxSeconds: Math.max(sum.maxSeconds, aggregate.max),
        slowCount: sum.slowCount + aggregate.slowCount,
        unknownCount: sum.unknownCount + aggregate.unknownCount,
      }),
      { count: 0, sumSeconds: 0, maxSeconds: 0, slowCount: 0, unknownCount: 0 },
    )

    const statuses = accountIds.map((accountId) => {
      const status = document.data.accounts[accountId]?.status
      return {
        accountId,
        accountName: accountNames.get(accountId) ?? accountId,
        state: status?.state ?? ("never" as const),
        ...(status?.lastSyncAt ? { lastSyncAt: status.lastSyncAt } : {}),
        ...(status?.lastError ? { error: status.lastError } : {}),
      }
    })

    return {
      selection: resolvedSelection,
      availableRange: {
        ...(availableDays[0] ? { minDay: availableDays[0] } : {}),
        ...(availableDays.at(-1) ? { maxDay: availableDays.at(-1) } : {}),
      },
      totals: toAggregate(totalsRaw),
      daily,
      accounts: accountRows,
      models: modelRows,
      latency: {
        count: latency.count,
        averageSeconds:
          latency.count > 0 ? latency.sumSeconds / latency.count : 0,
        maxSeconds: latency.maxSeconds,
        slowCount: latency.slowCount,
        unknownCount: latency.unknownCount,
      },
      statuses,
      revision: document.revision,
    }
  }
}

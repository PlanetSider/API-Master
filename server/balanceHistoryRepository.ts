import { UI_CONSTANTS } from "~/constants/ui"
import {
  isAccountTodayMetricComplete,
  normalizeAccountTodayStatsAvailability,
} from "~/services/accounts/accountTodayStats"
import {
  computeRetentionCutoffDayKey,
  getDayKeyFromUnixSeconds,
  parseDayKey,
} from "~/services/history/dailyBalanceHistory/dayKeys"
import type { SiteAccount } from "~/types"
import {
  DAILY_BALANCE_HISTORY_STORE_SCHEMA_VERSION,
  type DailyBalanceHistoryCaptureSource,
  type DailyBalanceHistoryStore,
  type DailyBalanceSnapshot,
} from "~/types/dailyBalanceHistory"
import type {
  WebBalanceHistoryEntry,
  WebBalanceHistoryResponse,
} from "~/web/contracts"

import {
  type EncryptedDocumentStore,
  type VersionedDocument,
} from "./encryptedDocumentStore"

const BALANCE_HISTORY_DOCUMENT_KEY = "balance-history"

const createEmptyStore = (): DailyBalanceHistoryStore => ({
  schemaVersion: DAILY_BALANCE_HISTORY_STORE_SCHEMA_VERSION,
  snapshotsByAccountId: {},
})

const normalizeSnapshot = (value: unknown): DailyBalanceSnapshot | null => {
  if (!value || typeof value !== "object") return null
  const snapshot = value as Partial<DailyBalanceSnapshot>
  if (
    typeof snapshot.quota !== "number" ||
    !Number.isFinite(snapshot.quota) ||
    typeof snapshot.capturedAt !== "number" ||
    !Number.isFinite(snapshot.capturedAt) ||
    (snapshot.source !== "refresh" && snapshot.source !== "alarm")
  ) {
    return null
  }
  return {
    quota: snapshot.quota,
    today_income:
      typeof snapshot.today_income === "number" &&
      Number.isFinite(snapshot.today_income)
        ? snapshot.today_income
        : null,
    today_quota_consumption:
      typeof snapshot.today_quota_consumption === "number" &&
      Number.isFinite(snapshot.today_quota_consumption)
        ? snapshot.today_quota_consumption
        : null,
    capturedAt: snapshot.capturedAt,
    source: snapshot.source,
  }
}

const normalizeStore = (value: unknown): DailyBalanceHistoryStore => {
  const result = createEmptyStore()
  if (!value || typeof value !== "object") return result
  const raw = (value as Partial<DailyBalanceHistoryStore>).snapshotsByAccountId
  if (!raw || typeof raw !== "object") return result

  for (const [accountId, days] of Object.entries(raw)) {
    if (!accountId || !days || typeof days !== "object") continue
    for (const [day, candidate] of Object.entries(days)) {
      if (!parseDayKey(day)) continue
      const snapshot = normalizeSnapshot(candidate)
      if (!snapshot) continue
      result.snapshotsByAccountId[accountId] ??= {}
      result.snapshotsByAccountId[accountId][day] = snapshot
    }
  }
  return result
}

const prune = (store: DailyBalanceHistoryStore, retentionDays: number) => {
  const cutoff = computeRetentionCutoffDayKey({
    retentionDays,
    nowUnixSeconds: Math.floor(Date.now() / 1000),
  })
  for (const [accountId, days] of Object.entries(store.snapshotsByAccountId)) {
    for (const day of Object.keys(days)) {
      if (day < cutoff) delete days[day]
    }
    if (Object.keys(days).length === 0)
      delete store.snapshotsByAccountId[accountId]
  }
  return store
}

export class BalanceHistoryRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  get(): VersionedDocument<DailyBalanceHistoryStore> {
    return this.store.read(
      BALANCE_HISTORY_DOCUMENT_KEY,
      createEmptyStore,
      normalizeStore,
    )
  }

  capture(
    accounts: SiteAccount[],
    source: DailyBalanceHistoryCaptureSource,
    retentionDays: number,
  ) {
    const capturedAt = Date.now()
    const day = getDayKeyFromUnixSeconds(Math.floor(capturedAt / 1000))
    return this.store.mutate(
      BALANCE_HISTORY_DOCUMENT_KEY,
      createEmptyStore,
      normalizeStore,
      (history) => {
        for (const account of accounts) {
          const availability = normalizeAccountTodayStatsAvailability(
            account.account_info.todayStatsAvailability,
          )
          history.snapshotsByAccountId[account.id] ??= {}
          history.snapshotsByAccountId[account.id][day] = {
            quota: account.account_info.quota,
            today_income: isAccountTodayMetricComplete(availability.income)
              ? account.account_info.today_income
              : null,
            today_quota_consumption: isAccountTodayMetricComplete(
              availability.consumption,
            )
              ? account.account_info.today_quota_consumption
              : null,
            capturedAt,
            source,
          }
        }
        return prune(history, retentionDays)
      },
    )
  }

  toWebResponse(accounts: SiteAccount[]): WebBalanceHistoryResponse {
    const document = this.get()
    const names = new Map(
      accounts.map((account) => [account.id, account.site_name]),
    )
    const entries: WebBalanceHistoryEntry[] = []
    for (const [accountId, days] of Object.entries(
      document.data.snapshotsByAccountId,
    )) {
      for (const [day, snapshot] of Object.entries(days)) {
        entries.push({
          accountId,
          accountName: names.get(accountId) ?? accountId,
          day,
          balanceUsd:
            snapshot.quota / UI_CONSTANTS.EXCHANGE_RATE.CONVERSION_FACTOR,
          incomeUsd:
            snapshot.today_income === null
              ? null
              : snapshot.today_income /
                UI_CONSTANTS.EXCHANGE_RATE.CONVERSION_FACTOR,
          consumptionUsd:
            snapshot.today_quota_consumption === null
              ? null
              : snapshot.today_quota_consumption /
                UI_CONSTANTS.EXCHANGE_RATE.CONVERSION_FACTOR,
          capturedAt: snapshot.capturedAt,
          source: snapshot.source,
        })
      }
    }
    entries.sort((left, right) => right.capturedAt - left.capturedAt)
    return { entries, revision: document.revision }
  }
}

import { CHECK_IN_METHOD_EXECUTION_RESULT_KINDS } from "~/constants/checkIn"
import {
  createAutomaticProtectionBypassExecution,
  PROTECTION_BYPASS_AUTOMATIC_TRIGGERS,
  PROTECTION_BYPASS_FEATURES,
} from "~/services/protectionBypass/contracts"
import { toSanitizedErrorSummary } from "~/services/verification/aiApiVerification/utils"
import { SiteHealthStatus, type SiteAccount } from "~/types"
import { CHECKIN_RESULT_STATUS } from "~/types/autoCheckin"
import { TEMP_WINDOW_REQUEST_SOURCES } from "~/types/tempWindowFetch"
import type {
  WebCheckInAccountResult,
  WebCheckInRunSummary,
} from "~/web/contracts"

import { assertSafeUpstreamUrl } from "./ssrfGuard"

const BROWSER_REQUIRED_PATTERN =
  /(turnstile|temp.?window|browser|permission|cloudflare|waf)/iu

const isBrowserRequired = (message: string | undefined) =>
  Boolean(message && BROWSER_REQUIRED_PATTERN.test(message))

const getResultMessage = (result: {
  rawMessage?: string
  messageKey?: string
  reasonCode?: string
}) => result.rawMessage || result.messageKey || result.reasonCode

const getAccountSecrets = (account: SiteAccount) => [
  account.account_info.access_token,
  account.cookieAuth?.sessionCookie ?? "",
  account.sub2apiAuth?.refreshToken ?? "",
]

const sanitizeAccountMessage = (account: SiteAccount, message?: string) =>
  message
    ? toSanitizedErrorSummary(message, getAccountSecrets(account)) || undefined
    : undefined

export interface WebCheckInExecution {
  accounts: SiteAccount[]
  summary: WebCheckInRunSummary
}

export class CheckInService {
  async run(
    accounts: SiteAccount[],
    trigger: WebCheckInRunSummary["trigger"],
  ): Promise<WebCheckInExecution> {
    const startedAt = Date.now()
    const updated = new Map<string, SiteAccount>()
    const results: WebCheckInAccountResult[] = []

    for (const account of accounts) {
      const outcome = await this.runAccount(account, trigger)
      results.push(outcome.result)
      if (outcome.account !== account) updated.set(account.id, outcome.account)
    }

    const summary: WebCheckInRunSummary = {
      trigger,
      startedAt,
      finishedAt: Date.now(),
      total: accounts.length,
      succeeded: results.filter((item) => item.status === "success").length,
      alreadyChecked: results.filter(
        (item) => item.status === "already_checked",
      ).length,
      failed: results.filter((item) => item.status === "failed").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      browserRequired: results.filter(
        (item) => item.status === "browser_required",
      ).length,
      results,
    }

    return {
      accounts: accounts.map((account) => updated.get(account.id) ?? account),
      summary,
    }
  }

  private async runAccount(
    account: SiteAccount,
    trigger: WebCheckInRunSummary["trigger"],
  ): Promise<{ account: SiteAccount; result: WebCheckInAccountResult }> {
    const base = { accountId: account.id, accountName: account.site_name }
    try {
      await assertSafeUpstreamUrl(account.site_url, "Account")
      const { executeSelectedCheckIn, markSelectedCheckInExecuted } =
        await import("~/services/checkin/autoCheckin/methods")
      const execution = await executeSelectedCheckIn({
        account,
        globalAutomaticExecutionEnabled: true,
        context: {
          tempWindowRequestSource: TEMP_WINDOW_REQUEST_SOURCES.Options,
          protectionBypassExecution: createAutomaticProtectionBypassExecution(
            PROTECTION_BYPASS_FEATURES.Checkin,
            trigger === "scheduled"
              ? PROTECTION_BYPASS_AUTOMATIC_TRIGGERS.Scheduled
              : PROTECTION_BYPASS_AUTOMATIC_TRIGGERS.UiLifecycle,
            TEMP_WINDOW_REQUEST_SOURCES.Options,
          ),
        },
      })

      if (execution.kind === CHECK_IN_METHOD_EXECUTION_RESULT_KINDS.Skipped) {
        return {
          account,
          result: { ...base, status: "skipped", reason: execution.reason },
        }
      }

      const message = getResultMessage(execution.result)
      const safeMessage = sanitizeAccountMessage(account, message)
      if (execution.result.status === CHECKIN_RESULT_STATUS.SUCCESS) {
        return {
          account: {
            ...account,
            checkIn: markSelectedCheckInExecuted({
              config: account.checkIn,
              siteType: account.site_type,
              observedAt: Date.now(),
            }),
          },
          result: {
            ...base,
            methodId: execution.methodId,
            status: "success",
            ...(safeMessage ? { message: safeMessage } : {}),
          },
        }
      }
      if (execution.result.status === CHECKIN_RESULT_STATUS.ALREADY_CHECKED) {
        return {
          account,
          result: {
            ...base,
            methodId: execution.methodId,
            status: "already_checked",
            ...(safeMessage ? { message: safeMessage } : {}),
          },
        }
      }

      return {
        account,
        result: {
          ...base,
          methodId: execution.methodId,
          status: isBrowserRequired(message) ? "browser_required" : "failed",
          ...(message ? { message } : {}),
        },
      }
    } catch (error) {
      const message = sanitizeAccountMessage(
        account,
        error instanceof Error ? error.message : "Check-in failed",
      )
      return {
        account: {
          ...account,
          health: {
            status: SiteHealthStatus.Unknown,
            ...(message ? { reason: message } : {}),
          },
        },
        result: {
          ...base,
          status: isBrowserRequired(message) ? "browser_required" : "failed",
          ...(message ? { message } : {}),
        },
      }
    }
  }
}

import { isAccountSiteType, type AccountSiteType } from "~/constants/siteType"
import { UI_CONSTANTS } from "~/constants/ui"
import { createPersistedSiteAccount } from "~/services/accounts/accountDefaults"
import {
  createCompatibilityCheckInConfig,
  getNewAccountAutomaticExecutionDefault,
  hasNewAccountCompatibilityRegistration,
} from "~/services/checkin/autoCheckin/compatibilityConfig"
import { AuthTypeEnum, SiteHealthStatus, type SiteAccount } from "~/types"
import { safeRandomUUID } from "~/utils/core/identifier"
import type { WebCreateAccountInput } from "~/web/contracts"

export function isSupportedAccountSiteType(
  value: unknown,
): value is AccountSiteType {
  return typeof value === "string" && isAccountSiteType(value)
}

export function createWebAccount(input: WebCreateAccountInput): SiteAccount {
  const now = Date.now()
  const account = {
    site_name: input.name.trim(),
    site_url: input.baseUrl.trim(),
    site_type: input.siteType,
    authType: input.authType,
    exchange_rate: input.exchangeRate ?? UI_CONSTANTS.EXCHANGE_RATE.DEFAULT,
    health: { status: SiteHealthStatus.Unknown },
    checkIn: createCompatibilityCheckInConfig({
      siteType: input.siteType,
      supported: hasNewAccountCompatibilityRegistration(input.siteType),
      automaticExecutionEnabled: getNewAccountAutomaticExecutionDefault(
        input.siteType,
      ),
    }),
    account_info: {
      id: input.userId?.trim() || "",
      username: input.username?.trim() || "",
      access_token:
        input.authType === AuthTypeEnum.AccessToken
          ? input.accessToken?.trim() || ""
          : "",
      quota: 0,
      today_prompt_tokens: 0,
      today_completion_tokens: 0,
      today_quota_consumption: 0,
      today_requests_count: 0,
      today_income: 0,
    },
    ...(input.authType === AuthTypeEnum.Cookie && input.sessionCookie?.trim()
      ? { cookieAuth: { sessionCookie: input.sessionCookie.trim() } }
      : {}),
    last_sync_time: 0,
    notes: input.notes?.trim() || "",
    tagIds: Array.from(
      new Set((input.tagIds ?? []).map((id) => id.trim()).filter(Boolean)),
    ),
    disabled: false,
    excludeFromTotalBalance: false,
    excludeFromTodayIncome: false,
  } as unknown as Parameters<typeof createPersistedSiteAccount>[0]["account"]

  return createPersistedSiteAccount({
    account,
    id: safeRandomUUID("web-account"),
    now,
  })
}

import { UI_CONSTANTS } from "~/constants/ui"
import { isAccountSiteType, SITE_TYPES, type AccountSiteType } from "~/constants/siteType"
import { getSiteName } from "~/services/accounts/siteName"
import { normalizeAccountIdentity } from "~/services/accounts/accountIdentity"
import { getSiteTypeCapabilities } from "~/services/apiAdapters/registry"
import type { ApiServiceRequest } from "~/services/apiTransport/type"
import { AuthTypeEnum } from "~/types"
import type {
  WebAccountDetectionInput,
  WebAccountDetectionResponse,
} from "~/web/contracts"

import { assertSafeUpstreamUrl } from "./ssrfGuard"

/**
 * Performs account detection using only server-side HTTP requests.
 *
 * The Web console cannot inspect the user's browser tabs or cookie store, so
 * callers must explicitly provide a Token or Cookie for this one request.
 * Secrets are never copied into the returned DTO.
 */
export class AccountDetectionService {
  async detect(
    input: WebAccountDetectionInput,
  ): Promise<WebAccountDetectionResponse> {
    const safeUrl = await assertSafeUpstreamUrl(input.baseUrl, "Account")
    const siteType = await this.resolveSiteType(safeUrl.toString(), input.siteType)
    if (siteType === SITE_TYPES.UNKNOWN) {
      throw new Error("Unable to identify the account site type")
    }

    const bootstrap = getSiteTypeCapabilities(siteType).account?.bootstrap
    if (!bootstrap) {
      throw new Error(`Account auto-detect is unsupported for ${siteType}`)
    }

    const accessToken = input.accessToken?.trim() || undefined
    const sessionCookie = input.sessionCookie?.trim() || undefined
    if (input.authType === AuthTypeEnum.AccessToken && !accessToken) {
      throw new Error("Access token is required for account detection")
    }
    if (input.authType === AuthTypeEnum.Cookie && !sessionCookie) {
      throw new Error("Session cookie is required for account detection")
    }

    const request: ApiServiceRequest = {
      baseUrl: safeUrl.toString(),
      auth: {
        authType: input.authType,
        ...(accessToken ? { accessToken } : {}),
        ...(sessionCookie ? { cookie: sessionCookie } : {}),
      },
    }
    const userInfo = await bootstrap.fetchUserInfo(request)
    const userId = normalizeAccountIdentity(userInfo.id)
    if (!userId) throw new Error("The upstream response did not include a user ID")

    const siteStatus = await bootstrap.fetchSiteStatus({
      baseUrl: safeUrl.toString(),
      auth: { authType: AuthTypeEnum.None },
    })
    const siteName = await getSiteName(safeUrl.toString(), siteType, siteStatus)

    return {
      baseUrl: safeUrl.toString(),
      siteType,
      siteName,
      userId: String(userId),
      username: userInfo.username?.trim() || String(userId),
      exchangeRate:
        bootstrap.extractDefaultExchangeRate(siteStatus) ??
        UI_CONSTANTS.EXCHANGE_RATE.DEFAULT,
      authType: input.authType,
    }
  }

  private async resolveSiteType(
    baseUrl: string,
    hint: AccountSiteType | undefined,
  ): Promise<AccountSiteType> {
    if (hint && isAccountSiteType(hint)) return hint
    const { getAccountSiteType } = await import("~/services/siteDetection/detectSiteType")
    return await getAccountSiteType(baseUrl)
  }
}

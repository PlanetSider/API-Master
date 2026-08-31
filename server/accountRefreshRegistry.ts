import { SITE_TYPES, type AccountSiteType } from "~/constants/siteType"
import {
  ACCOUNT_SITE_ADAPTER_FAMILIES,
  getAccountSiteDefinition,
} from "~/services/accountSiteDefinitions"
import type { AccountRefreshCapability } from "~/services/apiAdapters/contracts/accountRefresh"

/** Resolves only account-refresh capabilities that can execute in the Web server. */
export async function resolveServerAccountRefresh(
  siteType: AccountSiteType,
): Promise<AccountRefreshCapability | undefined> {
  if (siteType === SITE_TYPES.SUB2API) {
    return (await import("~/services/apiAdapters/sub2api/accountRefresh"))
      .sub2ApiAccountRefresh
  }
  if (siteType === SITE_TYPES.VO_API_V2) {
    return (await import("~/services/apiAdapters/voapiV2/accountRefresh"))
      .voApiV2AccountRefresh
  }
  if (siteType === SITE_TYPES.AIHUBMIX) {
    return (await import("~/services/apiAdapters/aihubmix/accountRefresh"))
      .aihubmixAccountRefresh
  }
  if (siteType === SITE_TYPES.SHAREDCHAT) {
    return (await import("~/services/apiAdapters/sharedchat/accountRefresh"))
      .sharedChatAccountRefresh
  }
  if (siteType === SITE_TYPES.OPENROUTER) {
    return (await import("~/services/apiAdapters/openrouter/accountRefresh"))
      .openRouterAccountRefresh
  }

  const definition = getAccountSiteDefinition(siteType)
  if (
    definition?.adapterFamily === ACCOUNT_SITE_ADAPTER_FAMILIES.NewApiFamily
  ) {
    const { createNewApiAccountRefresh } = await import(
      "~/services/apiAdapters/newApi/accountRefresh"
    )
    return createNewApiAccountRefresh(siteType)
  }

  return undefined
}

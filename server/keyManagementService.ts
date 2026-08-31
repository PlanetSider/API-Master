import { SITE_TYPES } from "~/constants/siteType"
import {
  ACCOUNT_SITE_ADAPTER_FAMILIES,
  getAccountSiteDefinition,
} from "~/services/accountSiteDefinitions"
import type { KeyManagementCapability } from "~/services/apiAdapters/contracts/keyManagement"
import type { ApiServiceRequest } from "~/services/apiTransport/type"
import type { SiteAccount } from "~/types"
import type {
  WebApiKeyListResponse,
  WebApiKeyMutationInput,
  WebApiKeyMutationResponse,
} from "~/web/contracts"

import { assertSafeUpstreamUrl } from "./ssrfGuard"

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

const resolveCapability = async (account: SiteAccount) => {
  if (account.site_type === SITE_TYPES.SUB2API) {
    return (await import("~/services/apiAdapters/sub2api/keyManagement"))
      .sub2ApiKeyManagement
  }
  if (account.site_type === SITE_TYPES.VO_API_V2) {
    return (await import("~/services/apiAdapters/voapiV2/keyManagement"))
      .voApiV2KeyManagement
  }
  if (account.site_type === SITE_TYPES.AIHUBMIX) {
    return (await import("~/services/apiAdapters/aihubmix/keyManagement"))
      .aihubmixKeyManagement
  }
  const definition = getAccountSiteDefinition(account.site_type)
  if (
    definition?.adapterFamily === ACCOUNT_SITE_ADAPTER_FAMILIES.NewApiFamily
  ) {
    const { createNewApiKeyManagement } = await import(
      "~/services/apiAdapters/newApi/keyManagement"
    )
    return createNewApiKeyManagement(account.site_type)
  }
  return undefined
}

const tokenInput = (input: WebApiKeyMutationInput) => ({
  name: input.name.trim(),
  remain_quota: input.remainingQuota,
  expired_time: input.expiresAt,
  unlimited_quota: input.unlimitedQuota,
  model_limits_enabled: input.modelLimitsEnabled,
  model_limits: input.modelLimits.trim(),
  allow_ips: input.allowIps.trim(),
  group: input.group.trim(),
})

export class KeyManagementService {
  async list(account: SiteAccount): Promise<WebApiKeyListResponse> {
    await assertSafeUpstreamUrl(account.site_url, "Account")
    if (account.site_type === SITE_TYPES.OPENROUTER) {
      return this.listOpenRouter(account)
    }
    const capability = await resolveCapability(account)
    if (!capability) {
      return {
        accountId: account.id,
        accountName: account.site_name,
        supported: false,
        keys: [],
      }
    }
    return this.listWithCapability(account, capability)
  }

  async create(
    account: SiteAccount,
    input: WebApiKeyMutationInput,
  ): Promise<WebApiKeyMutationResponse> {
    await assertSafeUpstreamUrl(account.site_url, "Account")
    if (account.site_type === SITE_TYPES.OPENROUTER) {
      const { createOpenRouterKey } = await import(
        "~/services/apiService/openrouter/keyManagement"
      )
      const created = await createOpenRouterKey(createRequest(account), {
        name: input.name.trim(),
        limit: input.unlimitedQuota ? null : input.remainingQuota,
      })
      return {
        ...(await this.listOpenRouter(account)),
        createdSecret: created.plaintextKey,
      }
    }
    const capability = await this.requireCapability(account)
    const result = await capability.createToken(
      createRequest(account),
      tokenInput(input),
    )
    const list = await this.listWithCapability(account, capability)
    return {
      ...list,
      ...(typeof result === "object" && result.key?.trim()
        ? { createdSecret: result.key.trim() }
        : {}),
    }
  }

  async update(
    account: SiteAccount,
    tokenId: number | string,
    input: WebApiKeyMutationInput,
  ) {
    await assertSafeUpstreamUrl(account.site_url, "Account")
    if (account.site_type === SITE_TYPES.OPENROUTER) {
      const { updateOpenRouterKey } = await import(
        "~/services/apiService/openrouter/keyManagement"
      )
      await updateOpenRouterKey(createRequest(account), String(tokenId), {
        name: input.name.trim(),
        limit: input.unlimitedQuota ? null : input.remainingQuota,
      })
      return this.listOpenRouter(account)
    }
    if (typeof tokenId !== "number") throw new Error("Invalid numeric key id")
    const capability = await this.requireCapability(account)
    await capability.updateToken({
      request: createRequest(account),
      tokenId,
      tokenData: tokenInput(input),
    })
    return this.listWithCapability(account, capability)
  }

  async delete(account: SiteAccount, tokenId: number | string) {
    await assertSafeUpstreamUrl(account.site_url, "Account")
    if (account.site_type === SITE_TYPES.OPENROUTER) {
      const { deleteOpenRouterKey } = await import(
        "~/services/apiService/openrouter/keyManagement"
      )
      await deleteOpenRouterKey(createRequest(account), String(tokenId))
      return this.listOpenRouter(account)
    }
    if (typeof tokenId !== "number") throw new Error("Invalid numeric key id")
    const capability = await this.requireCapability(account)
    await capability.deleteToken({ request: createRequest(account), tokenId })
    return this.listWithCapability(account, capability)
  }

  private async requireCapability(account: SiteAccount) {
    const capability = await resolveCapability(account)
    if (!capability) throw new Error("Key management is unsupported")
    return capability
  }

  private async listWithCapability(
    account: SiteAccount,
    capability: KeyManagementCapability,
  ): Promise<WebApiKeyListResponse> {
    const tokens = await capability.fetchTokens(createRequest(account))
    return {
      accountId: account.id,
      accountName: account.site_name,
      supported: true,
      keys: tokens.map((token) => ({
        id: token.id,
        name: token.name,
        status: token.status,
        createdAt: token.created_time,
        accessedAt: token.accessed_time,
        expiresAt: token.expired_time,
        remainingQuota: token.remain_quota,
        usedQuota: token.used_quota,
        unlimitedQuota: token.unlimited_quota,
        ...(token.group ? { group: token.group } : {}),
        ...(token.model_limits || token.models
          ? { modelLimits: token.model_limits || token.models }
          : {}),
        ...(token.allow_ips ? { allowIps: token.allow_ips } : {}),
      })),
    }
  }

  private async listOpenRouter(
    account: SiteAccount,
  ): Promise<WebApiKeyListResponse> {
    const { fetchOpenRouterKeys } = await import(
      "~/services/apiService/openrouter/keyManagement"
    )
    const keys = await fetchOpenRouterKeys(createRequest(account), {
      includeDisabled: true,
    })
    return {
      accountId: account.id,
      accountName: account.site_name,
      supported: true,
      keys: keys.map((key) => ({
        id: key.hash,
        name: key.name || key.label,
        status: key.disabled ? 0 : 1,
        createdAt: Math.floor(new Date(key.created_at).getTime() / 1000),
        accessedAt: 0,
        expiresAt: key.expires_at
          ? Math.floor(new Date(key.expires_at).getTime() / 1000)
          : -1,
        remainingQuota: key.limit_remaining ?? 0,
        usedQuota: key.usage,
        unlimitedQuota: key.limit === null,
      })),
    }
  }
}

import { SITE_TYPES } from "~/constants/siteType"
import {
  ACCOUNT_SITE_ADAPTER_FAMILIES,
  getAccountSiteDefinition,
} from "~/services/accountSiteDefinitions"
import type { ApiServiceRequest } from "~/services/apiTransport/type"
import type { ModelDescriptor } from "~/services/models/modelDescriptor"
import { toSanitizedErrorSummary } from "~/services/verification/aiApiVerification/utils"
import type { SiteAccount } from "~/types"
import type {
  WebAccountModelCatalogResult,
  WebAllModelCatalogResponse,
  WebModelCatalogResponse,
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

const toResponse = (
  account: SiteAccount,
  descriptors: ModelDescriptor[] | string[],
): WebModelCatalogResponse => ({
  accountId: account.id,
  accountName: account.site_name,
  supported: true,
  models: Array.from(
    new Map(
      descriptors.map((value) => {
        const model =
          typeof value === "string"
            ? { id: value }
            : {
                id: value.id,
                ...(value.vendorEvidence?.name
                  ? { vendor: value.vendorEvidence.name }
                  : {}),
              }
        return [model.id, model] as const
      }),
    ).values(),
  ).sort((left, right) => left.id.localeCompare(right.id)),
})

export class ModelCatalogService {
  async fetch(account: SiteAccount): Promise<WebModelCatalogResponse> {
    await assertSafeUpstreamUrl(account.site_url, "Account")
    const request = createRequest(account)
    if (account.site_type === SITE_TYPES.OPENROUTER) {
      const { openRouterProviderModelCatalog } = await import(
        "~/services/apiAdapters/openrouter/providerModelCatalog"
      )
      const personalized = openRouterProviderModelCatalog.personalized
      if (!personalized) {
        return {
          accountId: account.id,
          accountName: account.site_name,
          supported: false,
          models: [],
        }
      }
      const pricing = await personalized.fetchPricing({
        accountId: account.id,
        credential: account.account_info.access_token,
      })
      return {
        accountId: account.id,
        accountName: account.site_name,
        supported: true,
        models: Array.from(
          new Map(
            pricing.data.map((model) => [
              model.model_name,
              {
                id: model.model_name,
                ...(model.vendorEvidence?.name
                  ? { vendor: model.vendorEvidence.name }
                  : {}),
              },
            ]),
          ).values(),
        ).sort((left, right) => left.id.localeCompare(right.id)),
      }
    }
    if (account.site_type === SITE_TYPES.SUB2API) {
      const { sub2ApiModelCatalog } = await import(
        "~/services/apiAdapters/sub2api/modelCatalog"
      )
      return toResponse(
        account,
        await sub2ApiModelCatalog.fetchModels({
          ...request,
          auth: { ...request.auth, apiKey: request.auth.accessToken ?? "" },
        }),
      )
    }
    if (account.site_type === SITE_TYPES.SHAREDCHAT) {
      const { sharedChatModelCatalog } = await import(
        "~/services/apiAdapters/sharedchat/modelCatalog"
      )
      return toResponse(
        account,
        await sharedChatModelCatalog.fetchModels({
          ...request,
          auth: { ...request.auth, apiKey: request.auth.accessToken ?? "" },
        }),
      )
    }
    if (account.site_type === SITE_TYPES.VO_API_V2) {
      const { voApiV2KeyManagement } = await import(
        "~/services/apiAdapters/voapiV2/keyManagement"
      )
      return toResponse(
        account,
        await voApiV2KeyManagement.fetchAvailableModels(request),
      )
    }
    if (account.site_type === SITE_TYPES.AIHUBMIX) {
      const { aihubmixKeyManagement } = await import(
        "~/services/apiAdapters/aihubmix/keyManagement"
      )
      return toResponse(
        account,
        await aihubmixKeyManagement.fetchAvailableModels(request),
      )
    }
    const definition = getAccountSiteDefinition(account.site_type)
    if (
      definition?.adapterFamily === ACCOUNT_SITE_ADAPTER_FAMILIES.NewApiFamily
    ) {
      const { createNewApiKeyManagement } = await import(
        "~/services/apiAdapters/newApi/keyManagement"
      )
      return toResponse(
        account,
        await createNewApiKeyManagement(account.site_type).fetchAvailableModels(
          request,
        ),
      )
    }
    return {
      accountId: account.id,
      accountName: account.site_name,
      supported: false,
      models: [],
    }
  }

  /** Fetches account catalogs concurrently while preserving per-account failures. */
  async fetchMany(
    accounts: SiteAccount[],
    options: { concurrency?: number } = {},
  ): Promise<WebAllModelCatalogResponse> {
    const startedAt = Date.now()
    const results: WebAccountModelCatalogResult[] = Array(accounts.length)
    const concurrency = Math.max(
      1,
      Math.min(8, Math.round(options.concurrency ?? 3)),
    )
    let nextIndex = 0

    const fetchOne = async (account: SiteAccount) => {
      if (account.disabled) {
        return {
          accountId: account.id,
          accountName: account.site_name,
          siteType: account.site_type,
          disabled: true,
          status: "skipped",
          models: [],
        } satisfies WebAccountModelCatalogResult
      }

      try {
        const catalog = await this.fetch(account)
        return {
          accountId: account.id,
          accountName: account.site_name,
          siteType: account.site_type,
          disabled: false,
          status: catalog.supported ? "success" : "unsupported",
          models: catalog.models,
        } satisfies WebAccountModelCatalogResult
      } catch (error) {
        const errorMessage = toSanitizedErrorSummary(error, [
          account.account_info.access_token,
          account.cookieAuth?.sessionCookie ?? "",
          account.sub2apiAuth?.refreshToken ?? "",
        ])
        return {
          accountId: account.id,
          accountName: account.site_name,
          siteType: account.site_type,
          disabled: false,
          status: "error",
          models: [],
          error: errorMessage || "模型目录加载失败",
        } satisfies WebAccountModelCatalogResult
      }
    }

    const worker = async () => {
      while (true) {
        const index = nextIndex++
        const account = accounts[index]
        if (!account) return
        results[index] = await fetchOne(account)
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(concurrency, accounts.length || 1) },
        worker,
      ),
    )

    const modelMap = new Map<
      string,
      {
        id: string
        vendor?: string
        accounts: Array<{ accountId: string; accountName: string }>
      }
    >()
    for (const account of results) {
      for (const model of account.models) {
        const existing = modelMap.get(model.id)
        if (existing) {
          existing.accounts.push({
            accountId: account.accountId,
            accountName: account.accountName,
          })
          if (!existing.vendor && model.vendor) existing.vendor = model.vendor
          continue
        }
        modelMap.set(model.id, {
          id: model.id,
          ...(model.vendor ? { vendor: model.vendor } : {}),
          accounts: [
            {
              accountId: account.accountId,
              accountName: account.accountName,
            },
          ],
        })
      }
    }

    const succeeded = results.filter((item) => item.status === "success").length
    const failed = results.filter((item) => item.status === "error").length
    const unsupported = results.filter(
      (item) => item.status === "unsupported",
    ).length
    const skipped = results.filter((item) => item.status === "skipped").length

    return {
      accounts: results,
      models: Array.from(modelMap.values()).sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      startedAt,
      finishedAt: Date.now(),
      summary: {
        total: results.length,
        succeeded,
        failed,
        unsupported,
        skipped,
        modelCount: modelMap.size,
      },
    }
  }
}

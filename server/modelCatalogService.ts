import { SITE_TYPES } from "~/constants/siteType"
import {
  ACCOUNT_SITE_ADAPTER_FAMILIES,
  getAccountSiteDefinition,
} from "~/services/accountSiteDefinitions"
import { getSiteTypeCapabilities } from "~/services/apiAdapters/registry"
import type { ApiServiceRequest } from "~/services/apiTransport/type"
import {
  MODEL_PRICE_PRECISION_KINDS,
  type ModelPricing,
  type PricingResponse,
} from "~/services/modelList/pricingModel"
import type { ModelDescriptor } from "~/services/models/modelDescriptor"
import { modelMetadataService } from "~/services/models/modelMetadata"
import { toSanitizedErrorSummary } from "~/services/verification/aiApiVerification/utils"
import type { SiteAccount } from "~/types"
import type {
  WebAccountModelCatalogResult,
  WebAllModelCatalogResponse,
  WebModelCatalogModel,
  WebModelCatalogPrice,
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
  supportsPricing: false,
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

const NEW_API_RATIO_BASE_USD_PER_MILLION_TOKENS = 2
const DONE_HUB_TOKEN_TO_CALL_RATIO = 0.002

const isFiniteNonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0

const toUnavailablePrice = (
  model: ModelPricing,
  group?: string,
  groupRatio = 1,
  unavailableReason?: string,
): WebModelCatalogPrice => ({
  billingMode: model.quota_type === 0 ? "token" : "per-call",
  ...(group ? { group } : {}),
  groupRatio,
  precision: "unavailable",
  ...(model.price_metadata?.source
    ? { source: model.price_metadata.source }
    : {}),
  ...(unavailableReason ? { unavailableReason } : {}),
})

const calculatePrice = (
  model: ModelPricing,
  group: string | undefined,
  groupRatio: number,
): WebModelCatalogPrice => {
  if (
    model.price_metadata?.precision === MODEL_PRICE_PRECISION_KINDS.UNAVAILABLE
  ) {
    return toUnavailablePrice(
      model,
      group,
      groupRatio,
      model.price_metadata.unavailable_reason,
    )
  }

  const metadata = {
    ...(group ? { group } : {}),
    groupRatio,
    ...(model.price_metadata?.precision
      ? { precision: model.price_metadata.precision }
      : {}),
    ...(model.price_metadata?.source
      ? { source: model.price_metadata.source }
      : {}),
  }

  if (model.quota_type === 0) {
    const ratioInput =
      model.model_ratio * NEW_API_RATIO_BASE_USD_PER_MILLION_TOKENS * groupRatio
    const directInput = model.token_price_usd_per_million?.input
    const directOutput = model.token_price_usd_per_million?.output
    const input = isFiniteNonnegative(directInput) ? directInput : ratioInput
    const output = isFiniteNonnegative(directOutput)
      ? directOutput
      : input * model.completion_ratio

    if (!isFiniteNonnegative(input) || !isFiniteNonnegative(output)) {
      return toUnavailablePrice(model, group, groupRatio, "invalid-price")
    }

    const directCacheRead = model.token_price_usd_per_million?.cache_read
    const directCacheWrite = model.token_price_usd_per_million?.cache_write
    const cacheReadRatio = model.token_price_ratios_to_input?.cache_read
    const cacheWriteRatio = model.token_price_ratios_to_input?.cache_write
    const cacheRead = isFiniteNonnegative(directCacheRead)
      ? directCacheRead
      : isFiniteNonnegative(cacheReadRatio)
        ? input * cacheReadRatio
        : undefined
    const cacheWrite = isFiniteNonnegative(directCacheWrite)
      ? directCacheWrite
      : isFiniteNonnegative(cacheWriteRatio)
        ? input * cacheWriteRatio
        : undefined

    return {
      billingMode: "token",
      ...metadata,
      inputUsdPerMillionTokens: input,
      outputUsdPerMillionTokens: output,
      ...(cacheRead === undefined
        ? {}
        : { cacheReadUsdPerMillionTokens: cacheRead }),
      ...(cacheWrite === undefined
        ? {}
        : { cacheWriteUsdPerMillionTokens: cacheWrite }),
    }
  }

  if (typeof model.model_price === "number") {
    if (!isFiniteNonnegative(model.model_price)) {
      return toUnavailablePrice(model, group, groupRatio, "invalid-price")
    }
    return {
      billingMode: "per-call",
      ...metadata,
      usdPerCall: model.model_price * groupRatio,
    }
  }

  if (
    !isFiniteNonnegative(model.model_price.input) ||
    !isFiniteNonnegative(model.model_price.output)
  ) {
    return toUnavailablePrice(model, group, groupRatio, "invalid-price")
  }

  return {
    billingMode: "per-call",
    ...metadata,
    usdPerCall: {
      input:
        model.model_price.input * groupRatio * DONE_HUB_TOKEN_TO_CALL_RATIO,
      output:
        model.model_price.output * groupRatio * DONE_HUB_TOKEN_TO_CALL_RATIO,
    },
  }
}

const resolveModelPrices = (
  model: ModelPricing,
  pricing: PricingResponse,
): WebModelCatalogPrice[] => {
  const groupRatios = new Map(
    Object.entries(pricing.group_ratio ?? {}).filter((entry) =>
      isFiniteNonnegative(entry[1]),
    ) as Array<[string, number]>,
  )
  if (groupRatios.size === 0) {
    return [calculatePrice(model, undefined, 1)]
  }

  const usableGroups = new Set(Object.keys(pricing.usable_group ?? {}))
  const modelGroups = Array.from(new Set(model.enable_groups ?? []))
  const candidates = (modelGroups.length > 0 ? modelGroups : [...usableGroups])
    .filter((group) => usableGroups.size === 0 || usableGroups.has(group))
    .flatMap((group) => {
      const ratio = groupRatios.get(group)
      return ratio === undefined ? [] : [{ group, ratio }]
    })

  if (candidates.length === 0) {
    return [toUnavailablePrice(model, undefined, 1, "group-ratio-unavailable")]
  }

  return candidates.map(({ group, ratio }) =>
    calculatePrice(model, group, ratio),
  )
}

const toPricedResponse = (
  account: SiteAccount,
  pricing: PricingResponse,
): WebModelCatalogResponse => {
  const models = Array.from(
    new Map(
      pricing.data.map((model) => {
        const item: WebModelCatalogModel = {
          id: model.model_name,
          ...(model.display_name ? { displayName: model.display_name } : {}),
          ...(model.vendorEvidence?.name
            ? { vendor: model.vendorEvidence.name }
            : {}),
          ...(model.model_description
            ? { description: model.model_description }
            : {}),
          enableGroups: Array.from(new Set(model.enable_groups ?? [])).sort(),
          supportedEndpointTypes: Array.from(
            new Set(model.supported_endpoint_types ?? []),
          ).sort(),
          prices: resolveModelPrices(model, pricing),
        }
        return [item.id, item] as const
      }),
    ).values(),
  ).sort((left, right) => left.id.localeCompare(right.id))

  return {
    accountId: account.id,
    accountName: account.site_name,
    supported: true,
    supportsPricing: models.some((model) =>
      model.prices?.some((price) => price.precision !== "unavailable"),
    ),
    models,
  }
}

export class ModelCatalogService {
  async fetch(account: SiteAccount): Promise<WebModelCatalogResponse> {
    await assertSafeUpstreamUrl(account.site_url, "Account")
    const request = createRequest(account)
    const accountCapabilities = getSiteTypeCapabilities(
      account.site_type,
    ).account

    if (accountCapabilities?.providerModelCatalog) {
      const catalog = accountCapabilities.providerModelCatalog
      const pricing = catalog.personalized
        ? await catalog.personalized.fetchPricing({
            accountId: account.id,
            credential: account.account_info.access_token,
          })
        : await catalog.fetchPricing({})
      return toPricedResponse(account, pricing)
    }

    if (accountCapabilities?.modelPricing) {
      try {
        return toPricedResponse(
          account,
          await accountCapabilities.modelPricing.fetchPricing(request),
        )
      } catch {
        // Keep runtime model discovery available when a site's pricing route
        // is missing or temporarily unavailable.
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
    await modelMetadataService.initialize()
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
          supportsPricing: catalog.supportsPricing,
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
        displayName?: string
        vendor?: string
        description?: string
        accounts: WebAllModelCatalogResponse["models"][number]["accounts"]
      }
    >()
    for (const account of results) {
      for (const model of account.models) {
        const metadataResult = modelMetadataService.resolveModelIdentity(
          model.id,
        )
        const metadata =
          metadataResult.state === "resolved"
            ? {
                ...(metadataResult.metadata.capabilities
                  ? {
                      capabilities: {
                        ...metadataResult.metadata.capabilities,
                      },
                    }
                  : {}),
                ...(metadataResult.metadata.modalities
                  ? {
                      modalities: {
                        input: [...metadataResult.metadata.modalities.input],
                        output: [...metadataResult.metadata.modalities.output],
                      },
                    }
                  : {}),
                ...(metadataResult.metadata.limits
                  ? { limits: { ...metadataResult.metadata.limits } }
                  : {}),
              }
            : undefined
        const existing = modelMap.get(model.id)
        const { id: _id, ...modelDetails } = model
        const offer = {
          accountId: account.accountId,
          accountName: account.accountName,
          siteType: account.siteType,
          sourceUrl: accounts.find((item) => item.id === account.accountId)
            ?.site_url,
          exchangeRate: accounts.find((item) => item.id === account.accountId)
            ?.exchange_rate,
          ...modelDetails,
          ...(metadata ? { metadata } : {}),
        }
        if (existing) {
          existing.accounts.push(offer)
          if (!existing.displayName && model.displayName) {
            existing.displayName = model.displayName
          }
          if (!existing.vendor && model.vendor) existing.vendor = model.vendor
          if (!existing.description && model.description) {
            existing.description = model.description
          }
          continue
        }
        modelMap.set(model.id, {
          id: model.id,
          ...(model.displayName ? { displayName: model.displayName } : {}),
          ...(model.vendor ? { vendor: model.vendor } : {}),
          ...(model.description ? { description: model.description } : {}),
          accounts: [offer],
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

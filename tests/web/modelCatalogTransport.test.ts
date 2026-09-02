import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { http, passthrough } from "msw"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SITE_TYPES } from "~/constants/siteType"
import { AuthTypeEnum } from "~/types"
import type { WebModelCatalogResponse } from "~/web/contracts"
import { createWebAccount } from "~~/server/accountFactory"
import { ModelCatalogService } from "~~/server/modelCatalogService"
import { server as mockServer } from "~~/tests/msw/server"

describe("Web model catalog transport", () => {
  let upstream: Server
  let baseUrl: string
  let pricingPayload: unknown

  beforeEach(async () => {
    pricingPayload = undefined
    upstream = createServer((request, response) => {
      response.setHeader("Content-Type", "application/json")
      if (request.url === "/api/pricing" && pricingPayload) {
        response.end(JSON.stringify(pricingPayload))
        return
      }
      if (request.url === "/api/user/models") {
        response.end(
          JSON.stringify({
            success: true,
            data: ["gpt-4o-mini", "claude-3-5-sonnet", "gpt-4o-mini"],
          }),
        )
        return
      }
      response.statusCode = 404
      response.end(JSON.stringify({ success: false }))
    })
    await new Promise<void>((resolve) =>
      upstream.listen(0, "127.0.0.1", resolve),
    )
    const address = upstream.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
    mockServer.use(http.get(`${baseUrl}/*`, () => passthrough()))
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      upstream.close((error) => (error ? reject(error) : resolve())),
    )
  })

  it("loads and sorts a New API account model list", async () => {
    const account = createWebAccount({
      name: "Model account",
      baseUrl,
      siteType: SITE_TYPES.NEW_API,
      authType: AuthTypeEnum.AccessToken,
      accessToken: "model-token",
    })
    const result = await new ModelCatalogService().fetch(account)

    expect(result).toMatchObject({
      supported: true,
      models: [{ id: "claude-3-5-sonnet" }, { id: "gpt-4o-mini" }],
    })
  })

  it("returns account-specific prices for Web price comparison", async () => {
    pricingPayload = {
      success: true,
      data: [
        {
          model_name: "GLM-5.2-Base",
          display_name: "GLM 5.2 Base",
          model_description: "Comparable model",
          vendor_id: 7,
          quota_type: 0,
          model_ratio: 1,
          model_price: 0,
          completion_ratio: 2,
          enable_groups: ["default", "vip"],
          supported_endpoint_types: ["/v1/chat/completions"],
        },
      ],
      group_ratio: { default: 1, vip: 0.5 },
      usable_group: { default: {}, vip: {} },
      vendors: [{ id: 7, name: "智谱 AI" }],
    }
    const account = createWebAccount({
      name: "Priced account",
      baseUrl,
      siteType: SITE_TYPES.NEW_API,
      authType: AuthTypeEnum.AccessToken,
      accessToken: "pricing-token",
    })

    const service = new ModelCatalogService()
    const result = await service.fetch(account)

    expect(result).toMatchObject({
      supported: true,
      supportsPricing: true,
      models: [
        {
          id: "GLM-5.2-Base",
          displayName: "GLM 5.2 Base",
          vendor: "智谱 AI",
          enableGroups: ["default", "vip"],
          supportedEndpointTypes: ["/v1/chat/completions"],
          prices: [
            {
              billingMode: "token",
              group: "default",
              groupRatio: 1,
              inputUsdPerMillionTokens: 2,
              outputUsdPerMillionTokens: 4,
            },
            {
              billingMode: "token",
              group: "vip",
              groupRatio: 0.5,
              inputUsdPerMillionTokens: 1,
              outputUsdPerMillionTokens: 2,
            },
          ],
        },
      ],
    })

    const aggregate = await service.fetchMany([account])
    expect(aggregate.models[0]?.accounts[0]).toMatchObject({
      accountId: account.id,
      accountName: "Priced account",
      exchangeRate: account.exchange_rate,
      prices: expect.any(Array),
    })
  })

  it("aggregates account catalogs and keeps disabled and failed states", async () => {
    const first = createWebAccount({
      name: "First",
      baseUrl,
      siteType: SITE_TYPES.NEW_API,
      authType: AuthTypeEnum.AccessToken,
      accessToken: "first-secret",
    })
    const second = createWebAccount({
      name: "Second",
      baseUrl,
      siteType: SITE_TYPES.NEW_API,
      authType: AuthTypeEnum.AccessToken,
      accessToken: "second-secret",
    })
    const disabled = createWebAccount({
      name: "Disabled",
      baseUrl,
      siteType: SITE_TYPES.NEW_API,
      authType: AuthTypeEnum.AccessToken,
      accessToken: "disabled-secret",
    })
    disabled.disabled = true

    const service = new ModelCatalogService()
    vi.spyOn(service, "fetch").mockImplementation(
      async (account): Promise<WebModelCatalogResponse> => {
        if (account.id === second.id)
          throw new Error("upstream second-secret failed")
        return {
          accountId: account.id,
          accountName: account.site_name,
          supported: true,
          models: [{ id: "shared-model" }, { id: account.site_name }],
        }
      },
    )

    const result = await service.fetchMany([first, second, disabled], {
      concurrency: 2,
    })

    expect(result.summary).toMatchObject({
      total: 3,
      succeeded: 1,
      failed: 1,
      skipped: 1,
      modelCount: 2,
    })
    expect(result.accounts.map((account) => account.status)).toEqual([
      "success",
      "error",
      "skipped",
    ])
    expect(result.accounts[1]?.error).not.toContain("second-secret")
    expect(result.models).toEqual([
      {
        id: "First",
        accounts: [
          {
            accountId: first.id,
            accountName: "First",
            siteType: SITE_TYPES.NEW_API,
            exchangeRate: first.exchange_rate,
            sourceUrl: first.site_url,
          },
        ],
      },
      {
        id: "shared-model",
        accounts: [
          {
            accountId: first.id,
            accountName: "First",
            siteType: SITE_TYPES.NEW_API,
            exchangeRate: first.exchange_rate,
            sourceUrl: first.site_url,
          },
        ],
      },
    ])
  })
})

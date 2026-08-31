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

  beforeEach(async () => {
    upstream = createServer((request, response) => {
      response.setHeader("Content-Type", "application/json")
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
        accounts: [{ accountId: first.id, accountName: "First" }],
      },
      {
        id: "shared-model",
        accounts: [{ accountId: first.id, accountName: "First" }],
      },
    ])
  })
})

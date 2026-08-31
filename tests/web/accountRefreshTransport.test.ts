import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { http, passthrough } from "msw"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { SITE_TYPES } from "~/constants/siteType"
import { AuthTypeEnum, SiteHealthStatus } from "~/types"
import { createWebAccount } from "~~/server/accountFactory"
import { AccountRefreshService } from "~~/server/accountRefreshService"
import { server as mockServer } from "~~/tests/msw/server"

describe("Web account refresh transport", () => {
  let upstream: Server
  let baseUrl: string

  beforeEach(async () => {
    upstream = createServer((request, response) => {
      if (request.url === "/api/user/self") {
        response.writeHead(200, { "Content-Type": "application/json" })
        response.end(
          JSON.stringify({
            success: true,
            data: { quota: 2_500_000 },
          }),
        )
        return
      }

      response.writeHead(404, { "Content-Type": "application/json" })
      response.end(JSON.stringify({ success: false, message: "not found" }))
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

  it("refreshes a New API account with standard server-side fetch", async () => {
    const account = createWebAccount({
      name: "Local New API",
      baseUrl,
      siteType: SITE_TYPES.NEW_API,
      authType: AuthTypeEnum.AccessToken,
      accessToken: "local-test-token",
      userId: "1",
    })
    const service = new AccountRefreshService()

    const result = await service.refreshAccount(account, false)

    expect(result.success).toBe(true)
    expect(result.account.account_info.quota).toBe(2_500_000)
    expect(result.account.health.status).toBe(SiteHealthStatus.Healthy)
    expect(result.account.last_sync_time).toBeGreaterThan(0)
  })
})

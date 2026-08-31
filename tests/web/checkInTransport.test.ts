import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { CHECK_IN_METHOD_STATUS_OUTCOMES } from "~/constants/checkIn"
import { SITE_TYPES } from "~/constants/siteType"
import { AuthTypeEnum } from "~/types"
import { createWebAccount } from "~~/server/accountFactory"
import { CheckInService } from "~~/server/checkInService"

describe("Web check-in transport", () => {
  let upstream: Server
  let baseUrl: string
  let requestedPaths: string[]

  beforeEach(async () => {
    requestedPaths = []
    upstream = createServer((request, response) => {
      requestedPaths.push(`${request.method} ${request.url}`)
      response.setHeader("Content-Type", "application/json")

      if (request.url === "/api/status") {
        response.end(
          JSON.stringify({ success: true, data: { check_in_enabled: true } }),
        )
        return
      }
      if (request.url === "/api/user/check_in_status") {
        response.end(
          JSON.stringify({ success: true, data: { can_check_in: true } }),
        )
        return
      }
      if (request.url === "/api/user/check_in" && request.method === "POST") {
        response.end(JSON.stringify({ success: true, message: "checked" }))
        return
      }

      response.statusCode = 404
      response.end(JSON.stringify({ success: false, message: "not found" }))
    })
    await new Promise<void>((resolve) =>
      upstream.listen(0, "127.0.0.1", resolve),
    )
    const address = upstream.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      upstream.close((error) => (error ? reject(error) : resolve())),
    )
  })

  it("runs a configured Veloera check-in without browser APIs", async () => {
    const account = createWebAccount({
      name: "Local Veloera",
      baseUrl,
      siteType: SITE_TYPES.VELOERA,
      authType: AuthTypeEnum.AccessToken,
      accessToken: "check-in-token",
      userId: "1",
    })

    const execution = await new CheckInService().run([account], "manual")

    expect(execution.summary).toMatchObject({
      total: 1,
      succeeded: 1,
      failed: 0,
      browserRequired: 0,
      results: [
        {
          accountId: account.id,
          status: "success",
          methodId: "veloera:daily-checkin",
        },
      ],
    })
    expect(requestedPaths).toEqual([
      "GET /api/status",
      "GET /api/user/check_in_status",
      "POST /api/user/check_in",
    ])
    const selectedMethodId = execution.accounts[0]?.checkIn.selection
      .methodId as "veloera:daily-checkin" | undefined
    expect(
      selectedMethodId
        ? execution.accounts[0]?.checkIn.methodKnowledge.methods[
            selectedMethodId
          ]?.status?.outcome
        : undefined,
    ).toBe(CHECK_IN_METHOD_STATUS_OUTCOMES.Known)
  })
})

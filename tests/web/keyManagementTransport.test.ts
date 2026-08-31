import { createServer, type IncomingMessage, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { http, passthrough } from "msw"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { SITE_TYPES } from "~/constants/siteType"
import { AuthTypeEnum, type ApiToken } from "~/types"
import { createWebAccount } from "~~/server/accountFactory"
import { KeyManagementService } from "~~/server/keyManagementService"
import { server as mockServer } from "~~/tests/msw/server"

const readJson = async (request: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
    string,
    unknown
  >
}

const createToken = (id: number, name: string): ApiToken => ({
  id,
  user_id: 1,
  key: `secret-${id}`,
  status: 1,
  name,
  created_time: 1,
  accessed_time: 0,
  expired_time: -1,
  remain_quota: 0,
  unlimited_quota: true,
  used_quota: 0,
})

describe("Web key management transport", () => {
  let upstream: Server
  let baseUrl: string
  let tokens: ApiToken[]

  beforeEach(async () => {
    tokens = [createToken(1, "Initial")]
    upstream = createServer(async (request, response) => {
      response.setHeader("Content-Type", "application/json")
      if (request.url?.startsWith("/api/token/?") && request.method === "GET") {
        response.end(
          JSON.stringify({
            success: true,
            data: {
              items: tokens,
              page: 1,
              page_size: 100,
              total: tokens.length,
            },
          }),
        )
        return
      }
      if (request.url === "/api/token/" && request.method === "POST") {
        const body = await readJson(request)
        tokens.push(createToken(2, String(body.name)))
        response.end(JSON.stringify({ success: true }))
        return
      }
      if (request.url === "/api/token/" && request.method === "PUT") {
        const body = await readJson(request)
        tokens = tokens.map((token) =>
          token.id === Number(body.id)
            ? { ...token, name: String(body.name) }
            : token,
        )
        response.end(JSON.stringify({ success: true }))
        return
      }
      const match = /^\/api\/token\/(\d+)$/u.exec(request.url ?? "")
      if (match && request.method === "DELETE") {
        tokens = tokens.filter((token) => token.id !== Number(match[1]))
        response.end(JSON.stringify({ success: true }))
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
    mockServer.use(http.all(`${baseUrl}/*`, () => passthrough()))
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      upstream.close((error) => (error ? reject(error) : resolve())),
    )
  })

  it("lists, creates, updates and deletes keys without exposing secrets", async () => {
    const account = createWebAccount({
      name: "Key account",
      baseUrl,
      siteType: SITE_TYPES.NEW_API,
      authType: AuthTypeEnum.AccessToken,
      accessToken: "account-token",
    })
    const service = new KeyManagementService()
    const input = {
      name: "Created",
      remainingQuota: 0,
      expiresAt: -1,
      unlimitedQuota: true,
      modelLimitsEnabled: false,
      modelLimits: "",
      allowIps: "",
      group: "",
    }

    expect(JSON.stringify(await service.list(account))).not.toContain("secret-")
    const created = await service.create(account, input)
    expect(created.keys.map((key) => key.name)).toEqual(["Initial", "Created"])
    const updated = await service.update(account, 2, {
      ...input,
      name: "Updated",
    })
    expect(updated.keys.map((key) => key.name)).toContain("Updated")
    const deleted = await service.delete(account, 2)
    expect(deleted.keys.map((key) => key.id)).toEqual([1])
    expect(JSON.stringify({ created, updated, deleted })).not.toContain(
      "secret-",
    )
  })
})

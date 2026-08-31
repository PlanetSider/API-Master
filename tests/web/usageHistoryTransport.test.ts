import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { http, passthrough } from "msw"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { SITE_TYPES } from "~/constants/siteType"
import { LogType } from "~/services/history/usageHistory/usageLogModel"
import { AuthTypeEnum } from "~/types"
import { createWebAccount } from "~~/server/accountFactory"
import { EncryptedDocumentStore } from "~~/server/encryptedDocumentStore"
import { UsageHistoryRepository } from "~~/server/usageHistoryRepository"
import { UsageHistoryService } from "~~/server/usageHistoryService"
import { server as mockServer } from "~~/tests/msw/server"

describe("Web usage-history transport", () => {
  let upstream: Server
  let baseUrl: string
  let documentStore: EncryptedDocumentStore
  let requestedUrls: string[]

  beforeEach(async () => {
    requestedUrls = []
    upstream = createServer((request, response) => {
      requestedUrls.push(request.url ?? "")
      response.setHeader("Content-Type", "application/json")

      if (request.url?.startsWith("/api/log/self?")) {
        const createdAt = Math.floor(Date.now() / 1000) - 10
        response.end(
          JSON.stringify({
            success: true,
            data: {
              total: 1,
              items: [
                {
                  id: 1,
                  user_id: 1,
                  created_at: createdAt,
                  type: LogType.Consume,
                  content: "",
                  username: "web-user",
                  token_name: "web-key",
                  model_name: "gpt-4o-mini",
                  quota: 500_000,
                  prompt_tokens: 12,
                  completion_tokens: 8,
                  use_time: 1.25,
                  is_stream: false,
                  channel_id: 1,
                  channel_name: "default",
                  token_id: 7,
                  group: "default",
                  ip: "",
                  other: "",
                },
              ],
            },
          }),
        )
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
    mockServer.use(http.get(`${baseUrl}/*`, () => passthrough()))
    documentStore = new EncryptedDocumentStore(
      ":memory:",
      "usage-history-transport-test-secret",
    )
  })

  afterEach(async () => {
    documentStore.close()
    await new Promise<void>((resolve, reject) =>
      upstream.close((error) => (error ? reject(error) : resolve())),
    )
  })

  it("sends one canonical query and persists aggregate-only history", async () => {
    const account = createWebAccount({
      name: "Usage account",
      baseUrl,
      siteType: SITE_TYPES.NEW_API,
      authType: AuthTypeEnum.AccessToken,
      accessToken: "usage-secret",
      userId: "1",
    })
    const repository = new UsageHistoryRepository(documentStore)

    const result = await new UsageHistoryService(repository).syncAccount(
      account,
      7,
    )

    expect(result).toMatchObject({
      status: "success",
      pagesFetched: 1,
      ingestedCount: 1,
      partial: false,
    })
    expect(requestedUrls).toHaveLength(1)

    const requestedUrl = new URL(requestedUrls[0]!, baseUrl)
    expect(requestedUrl.pathname).toBe("/api/log/self")
    expect(requestedUrl.searchParams.getAll("p")).toEqual(["1"])
    expect(requestedUrl.search.slice(1)).not.toContain("?")
    expect(Object.fromEntries(requestedUrl.searchParams)).toMatchObject({
      p: "1",
      page_size: "100",
      type: String(LogType.Consume),
      token_name: "",
      model_name: "",
      group: "",
    })

    const history = repository.getAccount(account.id)
    expect(history.status.state).toBe("success")
    expect(Object.values(history.daily)).toEqual([
      {
        requests: 1,
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
        quotaConsumed: 500_000,
      },
    ])
    expect(JSON.stringify(history)).not.toContain("usage-secret")
  })
})

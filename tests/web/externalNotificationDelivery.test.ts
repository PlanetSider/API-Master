import type { WebExternalNotificationChannel } from "~/web/contracts"
import {
  externalNotificationDelivery,
  type ExternalNotificationPayload,
} from "~~/server/externalNotificationDelivery"
import type { StoredExternalNotificationChannel } from "~~/server/externalNotificationRepository"

const payload: ExternalNotificationPayload = {
  task: "account_refresh",
  status: "partial_success",
  title: "刷新结果",
  message: "成功 2，失败 1",
  counts: { total: 3, success: 2, failed: 1 },
}

const config = (
  channel: WebExternalNotificationChannel,
): StoredExternalNotificationChannel => ({
  enabled: true,
  botToken: channel === "telegram" ? "bot/token" : "",
  chatId: channel === "telegram" ? "-100123" : "",
  webhookKey:
    channel === "feishu"
      ? "feishu-key"
      : channel === "dingtalk"
        ? "ding-key"
        : channel === "wecom"
          ? "wecom-key"
          : "",
  secret: channel === "dingtalk" ? "ding-secret" : "",
  topicUrl: channel === "ntfy" ? "alerts" : "",
  accessToken: channel === "ntfy" ? "ntfy-token" : "",
  url:
    channel === "webhook"
      ? "https://hooks.example.test/{status}/{message}"
      : "",
})

describe("external notification delivery", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ["telegram", "https://api.telegram.org/botbot%2Ftoken/sendMessage"],
    ["feishu", "https://open.feishu.cn/open-apis/bot/v2/hook/feishu-key"],
    ["wecom", "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=wecom-key"],
  ] as const)("sends %s using its provider protocol", async (channel, url) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify(channel === "feishu" ? { code: 0 } : { errcode: 0 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    )

    await externalNotificationDelivery.send(channel, payload, config(channel))

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? []
    expect(String(requestUrl)).toBe(url)
    expect(requestInit).toEqual(expect.objectContaining({ method: "POST" }))
    expect(JSON.parse(String(requestInit?.body))).toMatchObject(
      channel === "telegram"
        ? { chat_id: "-100123", text: "刷新结果\n成功 2，失败 1" }
        : channel === "feishu"
          ? { msg_type: "text", content: { text: "刷新结果\n成功 2，失败 1" } }
          : { msgtype: "text", text: { content: "刷新结果\n成功 2，失败 1" } },
    )
  })

  it("adds a DingTalk signature and sends ntfy authentication", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ errcode: 0 }), { status: 200 }),
      )

    await externalNotificationDelivery.send(
      "dingtalk",
      payload,
      config("dingtalk"),
    )
    const dingUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(dingUrl.searchParams.get("access_token")).toBe("ding-key")
    expect(dingUrl.searchParams.get("timestamp")).toBeTruthy()
    expect(dingUrl.searchParams.get("sign")).toBeTruthy()

    fetchMock.mockResolvedValue(new Response("", { status: 200 }))
    await externalNotificationDelivery.send("ntfy", payload, config("ntfy"))
    const [ntfyUrl, ntfyInit] = fetchMock.mock.calls.at(-1) ?? []
    expect(String(ntfyUrl)).toBe("https://ntfy.sh/alerts")
    expect(ntfyInit).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer ntfy-token",
          Title: "=?UTF-8?B?5Yi35paw57uT5p6c?=",
        }),
        body: "成功 2，失败 1",
      }),
    )
  })

  it("renders and URI-encodes webhook templates", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }))

    await externalNotificationDelivery.send(
      "webhook",
      payload,
      config("webhook"),
    )

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? []
    expect(String(requestUrl)).toBe(
      "https://hooks.example.test/partial_success/%E6%88%90%E5%8A%9F%202%EF%BC%8C%E5%A4%B1%E8%B4%A5%201",
    )
    expect(requestInit).toEqual(expect.objectContaining({ method: "POST" }))
  })

  it("rejects non-HTTP webhook URLs", async () => {
    vi.spyOn(globalThis, "fetch")
    await expect(
      externalNotificationDelivery.send("webhook", payload, {
        ...config("webhook"),
        url: "javascript:alert(1)",
      }),
    ).rejects.toThrow("URL must use HTTP or HTTPS")
  })
})

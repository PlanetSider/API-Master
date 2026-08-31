import {
  assertSafeUpstreamUrl,
  createSafeServerFetch,
} from "~~/server/ssrfGuard"

describe("SSRF guard", () => {
  it("rejects private literal addresses when private targets are disabled", async () => {
    await expect(
      assertSafeUpstreamUrl("http://127.0.0.1:8787/api", "Upstream", {
        allowPrivate: false,
      }),
    ).rejects.toThrow("private network address")
  })

  it("rejects hostnames that resolve to any private address", async () => {
    await expect(
      assertSafeUpstreamUrl("https://example.test", "Upstream", {
        allowPrivate: false,
        lookup: async () => [
          { address: "203.0.113.20", family: 4 },
          { address: "10.0.0.4", family: 4 },
        ],
      }),
    ).rejects.toThrow("private network address")
  })

  it("allows public targets and rejects credentials in URLs", async () => {
    await expect(
      assertSafeUpstreamUrl("https://example.test/api", "Upstream", {
        allowPrivate: false,
        lookup: async () => [{ address: "203.0.113.20", family: 4 }],
      }),
    ).resolves.toMatchObject({ protocol: "https:" })
    await expect(
      assertSafeUpstreamUrl("https://user:pass@example.test/api", "Upstream", {
        allowPrivate: false,
      }),
    ).rejects.toThrow("without credentials")
  })

  it("forces callers to reject redirects after the destination is validated", async () => {
    const nativeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("ok", { status: 200 }))
    const safeFetch = createSafeServerFetch(nativeFetch, {
      allowPrivate: false,
      lookup: async () => [{ address: "203.0.113.20", family: 4 }],
    })

    await safeFetch("https://example.test/api", { redirect: "follow" })

    expect(nativeFetch).toHaveBeenCalledWith(
      "https://example.test/api",
      expect.objectContaining({ redirect: "error" }),
    )
  })
})

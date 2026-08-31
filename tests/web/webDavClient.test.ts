import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { http, passthrough } from "msw"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { webDavClient, type WebDavClientConfig } from "~~/server/webDavClient"
import { server as mockServer } from "~~/tests/msw/server"

describe("Web DAV client", () => {
  let upstream: Server
  let baseUrl: string
  let files: Map<string, string>
  let validAuthorization: string

  beforeEach(async () => {
    files = new Map()
    validAuthorization = `Basic ${Buffer.from("backup-user:dav-secret").toString("base64")}`
    upstream = createServer(async (request, response) => {
      if (request.headers.authorization !== validAuthorization) {
        response.statusCode = 401
        response.end()
        return
      }

      const path = request.url ?? "/"
      if (request.method === "PROPFIND") {
        response.statusCode = 207
        response.end()
        return
      }
      if (request.method === "MKCOL") {
        response.statusCode = 201
        response.end()
        return
      }
      if (request.method === "PUT") {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        files.set(path, Buffer.concat(chunks).toString("utf8"))
        response.statusCode = 201
        response.end()
        return
      }
      if (request.method === "GET") {
        const content = files.get(path)
        if (content === undefined) {
          response.statusCode = 404
          response.end()
          return
        }
        response.statusCode = 200
        response.setHeader("Content-Type", "application/json")
        response.end(content)
        return
      }
      if (request.method === "MOVE") {
        const destination = request.headers.destination
        const content = files.get(path)
        if (!destination || content === undefined) {
          response.statusCode = 400
          response.end()
          return
        }
        const destinationUrl = Array.isArray(destination)
          ? destination[0]
          : destination
        if (!destinationUrl) {
          response.statusCode = 400
          response.end()
          return
        }
        files.set(new URL(destinationUrl).pathname, content)
        files.delete(path)
        response.statusCode = 201
        response.end()
        return
      }
      if (request.method === "DELETE") {
        files.delete(path)
        response.statusCode = 204
        response.end()
        return
      }

      response.statusCode = 405
      response.end()
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

  const createConfig = (
    overrides: Partial<WebDavClientConfig> = {},
  ): WebDavClientConfig => ({
    url: `${baseUrl}/dav/`,
    username: "backup-user",
    password: "dav-secret",
    encryptionEnabled: false,
    encryptionPassword: "",
    ...overrides,
  })

  it("tests, uploads, verifies and downloads a backup", async () => {
    const config = createConfig()
    const content = JSON.stringify({ type: "test-backup", value: 1 })

    await expect(webDavClient.test(config)).resolves.toBeUndefined()
    await expect(webDavClient.upload(config, content)).resolves.toBeUndefined()
    await expect(webDavClient.download(config)).resolves.toBe(content)
    expect(files.get("/dav/all-api-hub-backup/all-api-hub-web-1.json")).toBe(
      content,
    )
    expect([...files.keys()].some((path) => path.endsWith(".tmp"))).toBe(false)
  })

  it("encrypts a remote backup and decrypts it on download", async () => {
    const config = createConfig({
      encryptionEnabled: true,
      encryptionPassword: "encryption-secret",
    })
    const content = JSON.stringify({ secret: "portable-secret" })

    await webDavClient.upload(config, content)

    const remote = files.get("/dav/all-api-hub-backup/all-api-hub-web-1.json")
    expect(remote).toContain("all-api-hub-webdav-backup-encrypted")
    expect(remote).not.toContain("portable-secret")
    await expect(webDavClient.download(config)).resolves.toBe(content)
  })

  it("rejects invalid WebDAV credentials", async () => {
    await expect(
      webDavClient.test(createConfig({ password: "wrong" })),
    ).rejects.toThrow("authentication failed")
  })
})

import { randomUUID } from "node:crypto"

import {
  decryptWebdavBackupEnvelope,
  encryptWebdavBackupContent,
  tryParseEncryptedWebdavBackupEnvelope,
} from "~/services/webdav/webdavBackupEncryption"

import { assertSafeUpstreamUrl } from "./ssrfGuard"

export interface WebDavClientConfig {
  url: string
  username: string
  password: string
  encryptionEnabled: boolean
  encryptionPassword: string
}

export interface WebDavClient {
  test(config: WebDavClientConfig): Promise<void>
  upload(config: WebDavClientConfig, content: string): Promise<void>
  download(config: WebDavClientConfig): Promise<string>
}

const authHeaders = (config: WebDavClientConfig) => ({
  Authorization: `Basic ${Buffer.from(
    `${config.username}:${config.password}`,
    "utf8",
  ).toString("base64")}`,
})

const resolveUrls = (rawUrl: string) => {
  const configured = new URL(rawUrl)
  if (configured.protocol !== "http:" && configured.protocol !== "https:") {
    throw new Error("WebDAV URL must use HTTP or HTTPS")
  }
  configured.hash = ""
  const explicitFile = configured.pathname.toLowerCase().endsWith(".json")
  const target = new URL(configured)
  if (!explicitFile) {
    target.search = ""
    target.pathname = `${target.pathname.replace(/\/+$/u, "")}/all-api-hub-backup/all-api-hub-web-1.json`
  }
  const collection = new URL(target)
  collection.search = ""
  collection.pathname = collection.pathname.replace(/[^/]+$/u, "")
  return { configured, target, collection, explicitFile }
}

const assertAuthStatus = (response: Response) => {
  if (response.status === 401 || response.status === 403) {
    throw new Error("WebDAV authentication failed")
  }
}

const assertSuccess = (response: Response, operation: string) => {
  assertAuthStatus(response)
  if (!response.ok) {
    throw new Error(`${operation} failed with status ${response.status}`)
  }
}

const put = async (config: WebDavClientConfig, url: URL, content: string) => {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...authHeaders(config),
      "Content-Type": "application/json",
    },
    body: content,
  })
  assertSuccess(response, "WebDAV upload")
}

const get = async (config: WebDavClientConfig, url: URL) => {
  const response = await fetch(url, {
    headers: { ...authHeaders(config), Accept: "application/json" },
  })
  assertSuccess(response, "WebDAV download")
  return await response.text()
}

const removeBestEffort = async (config: WebDavClientConfig, url: URL) => {
  await fetch(url, { method: "DELETE", headers: authHeaders(config) }).catch(
    () => undefined,
  )
}

const ensureCollection = async (
  config: WebDavClientConfig,
  collection: URL,
) => {
  const response = await fetch(collection, {
    method: "MKCOL",
    headers: authHeaders(config),
  })
  assertAuthStatus(response)
  if (
    response.ok ||
    response.status === 301 ||
    response.status === 302 ||
    response.status === 405
  ) {
    return
  }
  throw new Error(
    `WebDAV collection preparation failed with status ${response.status}`,
  )
}

const prepareContent = async (config: WebDavClientConfig, content: string) => {
  if (!config.encryptionEnabled) return content
  if (!config.encryptionPassword.trim()) {
    throw new Error("WebDAV encryption password is required")
  }
  return JSON.stringify(
    await encryptWebdavBackupContent({
      content,
      password: config.encryptionPassword,
    }),
  )
}

export const webDavClient: WebDavClient = {
  async test(config) {
    await assertSafeUpstreamUrl(config.url, "WebDAV")
    const { configured, explicitFile } = resolveUrls(config.url)
    const response = await fetch(configured, {
      method: explicitFile ? "GET" : "PROPFIND",
      headers: {
        ...authHeaders(config),
        ...(explicitFile ? {} : { Depth: "0" }),
      },
    })
    assertAuthStatus(response)
    if (response.status >= 500) {
      throw new Error(`WebDAV connection failed with status ${response.status}`)
    }
  },

  async upload(config, content) {
    await assertSafeUpstreamUrl(config.url, "WebDAV")
    const { target, collection, explicitFile } = resolveUrls(config.url)
    if (!explicitFile) await ensureCollection(config, collection)
    const contentToUpload = await prepareContent(config, content)
    const temporary = new URL(target)
    temporary.pathname = `${target.pathname}.${Date.now()}.${randomUUID()}.tmp`

    try {
      await put(config, temporary, contentToUpload)
      if ((await get(config, temporary)) !== contentToUpload) {
        throw new Error("WebDAV upload verification failed")
      }

      const moved = await fetch(temporary, {
        method: "MOVE",
        headers: {
          ...authHeaders(config),
          Destination: target.toString(),
          Overwrite: "T",
        },
      })
      assertAuthStatus(moved)
      if (!moved.ok) {
        await put(config, target, contentToUpload)
        if ((await get(config, target)) !== contentToUpload) {
          throw new Error("WebDAV upload verification failed")
        }
      }
    } finally {
      await removeBestEffort(config, temporary)
    }
  },

  async download(config) {
    await assertSafeUpstreamUrl(config.url, "WebDAV")
    const { target } = resolveUrls(config.url)
    const raw = await get(config, target)
    const envelope = tryParseEncryptedWebdavBackupEnvelope(raw)
    if (!envelope) return raw
    if (!config.encryptionPassword.trim()) {
      throw new Error("WebDAV encryption password is required")
    }
    try {
      return await decryptWebdavBackupEnvelope({
        envelope,
        password: config.encryptionPassword,
      })
    } catch {
      throw new Error("WebDAV backup decryption failed")
    }
  },
}

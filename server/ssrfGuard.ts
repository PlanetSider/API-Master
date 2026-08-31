import { lookup as dnsLookup } from "node:dns/promises"
import { isIP } from "node:net"
import { Agent } from "undici"

type ResolvedAddress = { address: string; family: number }

interface SsrfGuardOptions {
  allowPrivate?: boolean
  lookup?: (hostname: string) => Promise<ResolvedAddress[]>
}

type NodeLookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | Array<{ address: string; family: number }>,
  family?: number,
) => void

type NodeLookup = (
  hostname: string,
  options: { all?: boolean },
  callback: NodeLookupCallback,
) => void

export type ServerFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export class UnsafeUpstreamUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsafeUpstreamUrlError"
  }
}

const isPrivateIpv4 = (address: string) => {
  const octets = address.split(".").map(Number)
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return false
  }
  const [first, second] = octets
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  )
}

const isPrivateIpv6 = (address: string) => {
  const normalized = address.toLowerCase().replace(/^\[|\]$/gu, "")
  if (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true
  }
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/u)?.[1]
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false
}

const isPrivateAddress = (address: string) =>
  isIP(address) === 4 ? isPrivateIpv4(address) : isPrivateIpv6(address)

const isBlockedHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase().replace(/\.$/u, "")
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "metadata.google.internal" ||
    normalized === "metadata.google" ||
    normalized === "instance-data.ec2.internal"
  )
}

const defaultAllowPrivate = () =>
  process.env.NODE_ENV !== "production" ||
  process.env.AAH_WEB_ALLOW_PRIVATE_UPSTREAMS === "true"

interface SafeUpstreamResolution {
  url: URL
  addresses: ResolvedAddress[]
}

/**
 * Resolves and validates a target once. The same resolution is later supplied
 * to the HTTP connector so a hostname cannot be rebound between validation
 * and the socket connection.
 */
const resolveSafeUpstreamUrl = async (
  rawUrl: string,
  label: string,
  options: SsrfGuardOptions,
): Promise<SafeUpstreamResolution> => {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new UnsafeUpstreamUrlError(`${label} URL is invalid`)
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    throw new UnsafeUpstreamUrlError(
      `${label} URL must use HTTP or HTTPS without credentials`,
    )
  }

  if (options.allowPrivate ?? defaultAllowPrivate()) {
    return { url, addresses: [] }
  }

  if (isBlockedHostname(url.hostname) || isPrivateAddress(url.hostname)) {
    throw new UnsafeUpstreamUrlError(
      `${label} URL cannot target a private network address`,
    )
  }

  let addresses: ResolvedAddress[]
  try {
    addresses = await (
      options.lookup ??
      (async (hostname) => {
        return (await dnsLookup(hostname, {
          all: true,
          verbatim: true,
        })) as ResolvedAddress[]
      })
    )(url.hostname)
  } catch {
    throw new UnsafeUpstreamUrlError(
      `${label} hostname could not be resolved safely`,
    )
  }
  if (
    addresses.length === 0 ||
    addresses.some((item) => isPrivateAddress(item.address))
  ) {
    throw new UnsafeUpstreamUrlError(
      `${label} URL resolves to a private network address`,
    )
  }
  return { url, addresses }
}

/**
 * Validates an administrator-provided HTTP(S) target immediately before use.
 * Production resolves all host addresses to prevent DNS rebinding to private IPs.
 */
export async function assertSafeUpstreamUrl(
  rawUrl: string,
  label: string,
  options: SsrfGuardOptions = {},
) {
  return (await resolveSafeUpstreamUrl(rawUrl, label, options)).url
}

const MAX_PINNED_DISPATCHERS = 128
const pinnedDispatchers = new Map<
  string,
  { agent: Agent; lastUsedAt: number }
>()

const createPinnedLookup = (addresses: ResolvedAddress[]): NodeLookup => {
  const pinned = addresses.map((item) => ({
    address: item.address,
    family: item.family,
  }))
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, pinned)
      return
    }
    const first = pinned[0]
    if (!first) {
      callback(new Error("No validated upstream address"), "", 0)
      return
    }
    callback(null, first.address, first.family)
  }
}

/** Returns a bounded, reusable dispatcher whose DNS lookup is pinned. */
const getPinnedDispatcher = (url: URL, addresses: ResolvedAddress[]) => {
  const key = `${url.origin}|${addresses
    .map((item) => `${item.address}/${item.family}`)
    .join(",")}`
  const existing = pinnedDispatchers.get(key)
  if (existing) {
    existing.lastUsedAt = Date.now()
    return existing.agent
  }

  const agent = new Agent({
    connect: { lookup: createPinnedLookup(addresses) as never },
    pipelining: 0,
  })
  pinnedDispatchers.set(key, { agent, lastUsedAt: Date.now() })
  if (pinnedDispatchers.size > MAX_PINNED_DISPATCHERS) {
    const oldest = [...pinnedDispatchers.entries()].sort(
      (left, right) => left[1].lastUsedAt - right[1].lastUsedAt,
    )[0]
    if (oldest) {
      pinnedDispatchers.delete(oldest[0])
      void oldest[1].agent.close().catch(() => undefined)
    }
  }
  return agent
}

const getFetchTarget = (input: RequestInfo | URL): string => {
  if (input instanceof URL) return input.toString()
  if (typeof input === "string") return input
  return input.url
}

/**
 * Wraps the native fetch used by the Web server. User-configured upstreams
 * must be checked immediately before dispatch and may not redirect to a
 * second, unvalidated destination. Non-HTTP schemes are left to the native
 * implementation because they are not network targets configured by users.
 */
export const createSafeServerFetch = (
  nativeFetch: ServerFetch,
  options: SsrfGuardOptions = {},
): ServerFetch => {
  return async (input, init) => {
    const target = getFetchTarget(input)
    let parsed: URL
    try {
      parsed = new URL(target)
    } catch {
      return await nativeFetch(input, init)
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return await nativeFetch(input, init)
    }

    const resolution = await resolveSafeUpstreamUrl(target, "Upstream", options)
    const requestInit = {
      ...init,
      // A redirect can change the host after validation. Callers must opt into
      // an explicit redirect-aware client if a provider ever requires it.
      redirect: "error",
      ...(resolution.addresses.length > 0
        ? {
            dispatcher: getPinnedDispatcher(
              resolution.url,
              resolution.addresses,
            ),
          }
        : {}),
    } as RequestInit & { dispatcher?: Agent }
    return await nativeFetch(input, requestInit)
  }
}

/** Installs the guard once, before any server scheduler can issue requests. */
export const installServerFetchGuard = () => {
  const globals = globalThis as typeof globalThis & {
    __aahServerFetchGuardInstalled?: boolean
  }
  if (globals.__aahServerFetchGuardInstalled) return

  const nativeFetch = globalThis.fetch.bind(globalThis) as ServerFetch
  globalThis.fetch = createSafeServerFetch(nativeFetch) as typeof fetch
  globals.__aahServerFetchGuardInstalled = true
}

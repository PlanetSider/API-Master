import { createSafeServerFetch } from "./ssrfGuard"

const UNAVAILABLE_MESSAGE =
  "Browser transport is unavailable in the Web server runtime"

const nativeFetch = globalThis.fetch.bind(globalThis)
export const fetchUpstream = createSafeServerFetch(nativeFetch)

export const AUTH_MODE = {
  COOKIE_AUTH_MODE: "cookie",
  TOKEN_AUTH_MODE: "token",
} as const

export const COOKIE_AUTH_HEADER_NAME = ""
export const COOKIE_SESSION_OVERRIDE_HEADER_NAME = ""

export const addExtensionHeader = (headers: Record<string, string>) => headers

export const addAuthMethodHeader = async (headers: Record<string, string>) =>
  headers

export const normalizeRequestInitForMessage = (options: RequestInit) => options

export const isMessageReceiverUnavailableError = () => false

export async function sendTabMessageWithRetry(): Promise<never> {
  throw new Error(UNAVAILABLE_MESSAGE)
}

export async function executeWithTempWindowFallback(): Promise<never> {
  throw new Error(UNAVAILABLE_MESSAGE)
}

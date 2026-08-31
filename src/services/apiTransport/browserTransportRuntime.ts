export {
  addAuthMethodHeader,
  addExtensionHeader,
  AUTH_MODE,
  COOKIE_AUTH_HEADER_NAME,
  COOKIE_SESSION_OVERRIDE_HEADER_NAME,
} from "~/utils/browser/cookieHelper"
export {
  isMessageReceiverUnavailableError,
  sendTabMessageWithRetry,
} from "~/utils/browser/browserApi"
export { normalizeRequestInitForMessage } from "~/utils/browser/requestInitMessage"
export { executeWithTempWindowFallback } from "~/utils/browser/tempWindowFetch"

/** WebExtension runtime uses the browser's native fetch implementation. */
export const fetchUpstream = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, init)

import type { WebRuntimeCapabilitiesResponse } from "~/web/contracts"

/**
 * Describes the Web runtime as it exists today. Keeping this response explicit
 * prevents callers from treating extension-only browser automation as available.
 */
export const getWebRuntimeCapabilities =
  (): WebRuntimeCapabilitiesResponse => ({
    runtime: "web",
    browserWorker: {
      configured: false,
      connected: false,
    },
    capabilities: [
      { id: "standard_http", state: "available", executor: "server" },
      { id: "saved_cookie_header", state: "limited", executor: "server" },
      {
        id: "waf_challenge",
        state: "requires_worker",
        executor: "browser_worker",
      },
      {
        id: "turnstile",
        state: "requires_worker",
        executor: "browser_worker",
      },
      {
        id: "active_tab_detection",
        state: "requires_worker",
        executor: "browser_worker",
      },
      {
        id: "page_session_read",
        state: "requires_worker",
        executor: "browser_worker",
      },
      {
        id: "page_native_action",
        state: "requires_worker",
        executor: "browser_worker",
      },
    ],
  })

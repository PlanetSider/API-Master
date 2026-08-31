import { afterEach, describe, expect, it, vi } from "vitest"

import { loadWebServerConfig } from "~~/server/config"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("Web server production configuration", () => {
  it("requires a sufficiently strong administrator password", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AAH_WEB_ADMIN_PASSWORD", "short")
    vi.stubEnv("AAH_WEB_SESSION_SECRET", "session-secret-that-is-long-enough")
    vi.stubEnv(
      "AAH_WEB_ENCRYPTION_KEY",
      "encryption-secret-that-is-long-enough",
    )

    expect(() => loadWebServerConfig()).toThrow(
      "AAH_WEB_ADMIN_PASSWORD must contain at least 12 characters",
    )
  })

  it("requires separate session and encryption secrets", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AAH_WEB_ADMIN_PASSWORD", "administrator-password")
    vi.stubEnv(
      "AAH_WEB_SESSION_SECRET",
      "same-secret-that-is-long-enough-123456",
    )
    vi.stubEnv(
      "AAH_WEB_ENCRYPTION_KEY",
      "same-secret-that-is-long-enough-123456",
    )

    expect(() => loadWebServerConfig()).toThrow(
      "AAH_WEB_SESSION_SECRET and AAH_WEB_ENCRYPTION_KEY must be different",
    )
  })

  it("accepts valid production secrets", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AAH_WEB_ADMIN_PASSWORD", "administrator-password")
    vi.stubEnv(
      "AAH_WEB_SESSION_SECRET",
      "session-secret-that-is-long-enough-123456",
    )
    vi.stubEnv(
      "AAH_WEB_ENCRYPTION_KEY",
      "encryption-secret-that-is-long-enough-123456",
    )

    expect(loadWebServerConfig()).toMatchObject({
      adminPassword: "administrator-password",
      secureCookies: true,
    })
  })
})

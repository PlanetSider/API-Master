import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import type { Context } from "hono"
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie"

import type { WebServerConfig } from "./config"

const SESSION_COOKIE_NAME = "aah_web_session"
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1_000
const LOGIN_BLOCK_DURATION_MS = 30 * 1_000
const MAX_LOGIN_FAILURES = 5

export class LoginAttemptLimiter {
  private failureTimestamps: number[] = []
  private blockedUntil = 0

  getRetryAfterSeconds(now = Date.now()) {
    this.prune(now)
    return this.blockedUntil > now
      ? Math.max(1, Math.ceil((this.blockedUntil - now) / 1_000))
      : 0
  }

  recordFailure(now = Date.now()) {
    this.prune(now)
    this.failureTimestamps.push(now)
    if (this.failureTimestamps.length >= MAX_LOGIN_FAILURES) {
      this.blockedUntil = now + LOGIN_BLOCK_DURATION_MS
    }
  }

  reset() {
    this.failureTimestamps = []
    this.blockedUntil = 0
  }

  private prune(now: number) {
    const cutoff = now - LOGIN_ATTEMPT_WINDOW_MS
    this.failureTimestamps = this.failureTimestamps.filter(
      (timestamp) => timestamp > cutoff,
    )
    if (this.blockedUntil <= now) this.blockedUntil = 0
  }
}

const digest = (value: string) => createHash("sha256").update(value).digest()

export function verifyAdminPassword(candidate: string, expected: string) {
  return timingSafeEqual(digest(candidate), digest(expected))
}

export async function createWebSession(
  context: Context,
  config: WebServerConfig,
) {
  const expiresAt = Math.floor(Date.now() / 1000) + config.sessionTtlSeconds
  const value = `${expiresAt}.${randomUUID()}`

  await setSignedCookie(
    context,
    SESSION_COOKIE_NAME,
    value,
    config.sessionSecret,
    {
      path: "/",
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: "Strict",
      maxAge: config.sessionTtlSeconds,
    },
  )
}

export async function hasValidWebSession(
  context: Context,
  config: WebServerConfig,
) {
  const value = await getSignedCookie(
    context,
    config.sessionSecret,
    SESSION_COOKIE_NAME,
  )
  if (!value || typeof value !== "string") return false

  const expiresAt = Number(value.split(".", 1)[0])
  return Number.isFinite(expiresAt) && expiresAt > Math.floor(Date.now() / 1000)
}

export function clearWebSession(context: Context, config: WebServerConfig) {
  deleteCookie(context, SESSION_COOKIE_NAME, {
    path: "/",
    secure: config.secureCookies,
  })
}

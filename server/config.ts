import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export interface WebServerConfig {
  host: string
  port: number
  databasePath: string
  staticDirectory: string
  adminPassword: string
  sessionSecret: string
  encryptionSecret: string
  secureCookies: boolean
  sessionTtlSeconds: number
}

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const readRequiredProductionSecret = (
  name: string,
  developmentFallback: string,
  minimumProductionLength: number,
) => {
  const filePath = process.env[`${name}_FILE`]?.trim()
  const fileValue = filePath
    ? fs.readFileSync(path.resolve(filePath), "utf8").trim()
    : undefined
  const value = fileValue || process.env[name]
  const normalized = value?.trim()
  if (normalized) {
    if (
      process.env.NODE_ENV === "production" &&
      normalized.length < minimumProductionLength
    ) {
      throw new Error(
        `${name} must contain at least ${minimumProductionLength} characters in production`,
      )
    }
    return normalized
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`)
  }

  return developmentFallback
}

export function loadWebServerConfig(): WebServerConfig {
  const developmentSeed = createHash("sha256")
    .update(`all-api-hub-web-dev:${process.cwd()}`)
    .digest("hex")

  const config: WebServerConfig = {
    host: process.env.AAH_WEB_HOST?.trim() || "127.0.0.1",
    port: parsePositiveInteger(process.env.AAH_WEB_PORT, 8787),
    databasePath: path.resolve(
      process.env.AAH_WEB_DATABASE_PATH?.trim() ||
        path.join(".data", "all-api-hub.sqlite"),
    ),
    staticDirectory: path.resolve(
      process.env.AAH_WEB_STATIC_DIR?.trim() || path.join(".output", "web"),
    ),
    adminPassword: readRequiredProductionSecret(
      "AAH_WEB_ADMIN_PASSWORD",
      "admin",
      12,
    ),
    sessionSecret: readRequiredProductionSecret(
      "AAH_WEB_SESSION_SECRET",
      developmentSeed,
      32,
    ),
    encryptionSecret: readRequiredProductionSecret(
      "AAH_WEB_ENCRYPTION_KEY",
      developmentSeed,
      32,
    ),
    secureCookies:
      process.env.AAH_WEB_SECURE_COOKIES === "true" ||
      (process.env.NODE_ENV === "production" &&
        process.env.AAH_WEB_SECURE_COOKIES !== "false"),
    sessionTtlSeconds: parsePositiveInteger(
      process.env.AAH_WEB_SESSION_TTL_SECONDS,
      12 * 60 * 60,
    ),
  }

  if (
    process.env.NODE_ENV === "production" &&
    config.sessionSecret === config.encryptionSecret
  ) {
    throw new Error(
      "AAH_WEB_SESSION_SECRET and AAH_WEB_ENCRYPTION_KEY must be different in production",
    )
  }

  return config
}

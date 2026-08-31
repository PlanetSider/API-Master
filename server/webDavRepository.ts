import type {
  WebDavRunSummary,
  WebDavSettings,
  WebDavSettingsInput,
  WebDavSettingsResponse,
} from "~/web/contracts"

import {
  type EncryptedDocumentStore,
  type VersionedDocument,
} from "./encryptedDocumentStore"

const KEY = "webdav-settings"
const MIN_INTERVAL_MINUTES = 15
const MAX_INTERVAL_MINUTES = 7 * 24 * 60

export interface StoredWebDavSettings extends WebDavSettings {
  password: string
  encryptionPassword: string
}

interface WebDavDocument {
  settings: StoredWebDavSettings
  lastRun?: WebDavRunSummary
}

const createDefault = (): WebDavDocument => ({
  settings: {
    url: "",
    username: "",
    password: "",
    configured: false,
    autoBackupEnabled: false,
    intervalMinutes: 60,
    encryptionEnabled: false,
    encryptionPassword: "",
  },
})

const normalizeInterval = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 60
  return Math.min(
    MAX_INTERVAL_MINUTES,
    Math.max(MIN_INTERVAL_MINUTES, Math.round(value)),
  )
}

const normalize = (value: unknown): WebDavDocument => {
  if (!value || typeof value !== "object") return createDefault()
  const candidate = value as Partial<WebDavDocument>
  const settings = candidate.settings as
    | Partial<StoredWebDavSettings>
    | undefined
  const url = typeof settings?.url === "string" ? settings.url.trim() : ""
  const username =
    typeof settings?.username === "string" ? settings.username.trim() : ""
  const password =
    typeof settings?.password === "string" ? settings.password : ""
  const encryptionPassword =
    typeof settings?.encryptionPassword === "string"
      ? settings.encryptionPassword
      : ""

  return {
    settings: {
      url,
      username,
      password,
      configured: Boolean(url && username && password),
      autoBackupEnabled: settings?.autoBackupEnabled === true,
      intervalMinutes: normalizeInterval(settings?.intervalMinutes),
      encryptionEnabled: settings?.encryptionEnabled === true,
      encryptionPassword,
    },
    ...(candidate.lastRun ? { lastRun: candidate.lastRun } : {}),
  }
}

const toPublicSettings = ({
  password: _password,
  encryptionPassword: _encryptionPassword,
  ...settings
}: StoredWebDavSettings): WebDavSettings => settings

const resolveSettingsUpdate = (
  current: StoredWebDavSettings,
  input: WebDavSettingsInput,
) =>
  normalize({
    settings: {
      url: input.url,
      username: input.username,
      password: input.password?.trim() || current.password,
      autoBackupEnabled: input.autoBackupEnabled,
      intervalMinutes: input.intervalMinutes,
      encryptionEnabled: input.encryptionEnabled,
      encryptionPassword:
        input.encryptionPassword?.trim() || current.encryptionPassword,
    },
  }).settings

export class WebDavRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  get(): VersionedDocument<WebDavDocument> {
    return this.store.read(KEY, createDefault, normalize)
  }

  getStoredSettings() {
    return this.get().data.settings
  }

  previewUpdate(input: WebDavSettingsInput) {
    return resolveSettingsUpdate(this.getStoredSettings(), input)
  }

  update(input: WebDavSettingsInput) {
    return this.store.mutate(
      KEY,
      createDefault,
      normalize,
      (current) => ({
        ...current,
        settings: resolveSettingsUpdate(current.settings, input),
      }),
      input.expectedRevision,
    )
  }

  recordRun(summary: WebDavRunSummary) {
    return this.store.mutate(KEY, createDefault, normalize, (current) => ({
      ...current,
      lastRun: summary,
    }))
  }

  toResponse(runtime: WebDavSettingsResponse["runtime"]) {
    const document = this.get()
    return {
      settings: toPublicSettings(document.data.settings),
      revision: document.revision,
      ...(document.data.lastRun ? { lastRun: document.data.lastRun } : {}),
      runtime,
    } satisfies WebDavSettingsResponse
  }
}

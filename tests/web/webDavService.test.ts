import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BackupService } from "~~/server/backupService"
import { EncryptedDocumentStore } from "~~/server/encryptedDocumentStore"
import type { WebDavClient } from "~~/server/webDavClient"
import { WebDavRepository } from "~~/server/webDavRepository"
import { WebDavService } from "~~/server/webDavService"

describe("WebDavService scheduler", () => {
  let store: EncryptedDocumentStore
  let repository: WebDavRepository
  let client: WebDavClient
  let service: WebDavService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    store = new EncryptedDocumentStore(":memory:", "webdav-test-secret")
    repository = new WebDavRepository(store)
    client = {
      test: vi.fn().mockResolvedValue(undefined),
      upload: vi.fn().mockResolvedValue(undefined),
      download: vi.fn(),
    }
    service = new WebDavService(repository, new BackupService(store), client)
  })

  afterEach(() => {
    service.stop()
    store.close()
    vi.useRealTimers()
  })

  it("runs an automatic full backup at the configured interval", async () => {
    service.update({
      url: "https://dav.example.com/backups/",
      username: "backup-user",
      password: "dav-secret",
      autoBackupEnabled: true,
      intervalMinutes: 15,
      encryptionEnabled: false,
      expectedRevision: 0,
    })

    const scheduled = service.getResponse().runtime.nextRunAt
    expect(scheduled).toBe(Date.now() + 15 * 60 * 1000)
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000)

    expect(client.upload).toHaveBeenCalledOnce()
    const uploaded = vi.mocked(client.upload).mock.calls[0]?.[1]
    expect(JSON.parse(uploaded ?? "null")).toMatchObject({
      type: "all-api-hub-web-backup",
      version: 1,
    })
    expect(service.getResponse()).toMatchObject({
      lastRun: { trigger: "scheduled", status: "success" },
      runtime: { running: false },
    })
    expect(service.getResponse().runtime.nextRunAt).toBe(
      Date.now() + 15 * 60 * 1000,
    )
  })

  it("records a failed upload without rejecting the scheduler", async () => {
    vi.mocked(client.upload).mockRejectedValueOnce(new Error("remote offline"))
    service.update({
      url: "https://dav.example.com/backup.json",
      username: "backup-user",
      password: "dav-secret",
      autoBackupEnabled: false,
      intervalMinutes: 60,
      encryptionEnabled: false,
      expectedRevision: 0,
    })

    await expect(service.runNow("manual")).resolves.toMatchObject({
      status: "failed",
      error: "remote offline",
    })
    expect(service.getResponse()).toMatchObject({
      lastRun: { status: "failed", error: "remote offline" },
      runtime: { running: false },
    })
  })
})

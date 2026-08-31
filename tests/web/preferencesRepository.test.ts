import { describe, expect, it } from "vitest"

import { EncryptedDocumentStore } from "~~/server/encryptedDocumentStore"
import { WebPreferencesRepository } from "~~/server/preferencesRepository"

describe("WebPreferencesRepository", () => {
  it("stores display preferences with optimistic revisions", () => {
    const store = new EncryptedDocumentStore(":memory:", "preferences-secret")
    const repository = new WebPreferencesRepository(store)

    const initial = repository.get()
    expect(initial.preferences.currencyType).toBe("USD")
    expect(initial.revision).toBe(0)

    const updated = repository.update({
      themeMode: "dark",
      currencyType: "CNY",
      sortField: "created_at",
      sortOrder: "asc",
      expectedRevision: initial.revision,
    })
    expect(updated.preferences).toMatchObject({
      themeMode: "dark",
      currencyType: "CNY",
      sortField: "created_at",
      sortOrder: "asc",
    })
    expect(updated.revision).toBe(1)
    store.close()
  })

  it("normalizes extension imports and reports ignored keys without exposing values", () => {
    const store = new EncryptedDocumentStore(":memory:", "preferences-secret")
    const repository = new WebPreferencesRepository(store)
    const imported = repository.normalizeExtensionImport({
      themeMode: "light",
      currencyType: "CNY",
      managedSiteModelSync: { adminToken: "secret-token" },
    })

    expect(imported.preferences).toMatchObject({
      themeMode: "light",
      currencyType: "CNY",
    })
    expect(imported.unsupportedExtensionKeys).toEqual(["managedSiteModelSync"])
    expect(JSON.stringify(imported)).not.toContain("secret-token")
    store.close()
  })

  it("does not classify scheduler preferences as ignored extension settings", () => {
    const store = new EncryptedDocumentStore(":memory:", "preferences-secret")
    const repository = new WebPreferencesRepository(store)
    const imported = repository.normalizeExtensionImport({
      accountAutoRefresh: { enabled: true, interval: 900 },
      autoCheckin: { globalEnabled: true },
      balanceHistory: { enabled: true, retentionDays: 30 },
      usageHistory: { enabled: true, retentionDays: 14 },
      siteAnnouncementNotifications: { enabled: true },
    })

    expect(imported.unsupportedExtensionKeys).toEqual([])
    store.close()
  })
})

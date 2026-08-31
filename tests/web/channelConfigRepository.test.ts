import { describe, expect, it } from "vitest"

import { ChannelConfigRepository } from "~~/server/channelConfigRepository"
import { EncryptedDocumentStore } from "~~/server/encryptedDocumentStore"

describe("ChannelConfigRepository", () => {
  it("normalizes resource identity and persists model filters", () => {
    const store = new EncryptedDocumentStore(":memory:", "channel-secret")
    const repository = new ChannelConfigRepository(store)

    const response = repository.upsert({
      managedSiteType: "new-api",
      scopeKey: "https://managed.example.com/admin/",
      resourceId: 42,
      channelId: 42,
      rules: [
        {
          id: "include-openai",
          name: "OpenAI models",
          kind: "pattern",
          pattern: "gpt-",
          isRegex: false,
          action: "include",
          enabled: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    })

    expect(response.revision).toBe(1)
    const configs = Object.values(response.snapshot.configs)
    expect(configs).toHaveLength(1)
    expect(configs[0]?.resourceRef).toMatchObject({
      managedSiteType: "new-api",
      scopeKey: "https://managed.example.com",
      resourceId: "42",
    })
    expect(configs[0]?.modelFilterSettings.rules[0]).toMatchObject({
      pattern: "gpt-",
      action: "include",
    })
    store.close()
  })

  it("drops malformed rules and rejects malformed current snapshots", () => {
    const store = new EncryptedDocumentStore(":memory:", "channel-secret")
    const repository = new ChannelConfigRepository(store)
    const imported = repository.normalizeExtensionImport({
      channelConfigs: {
        schemaVersion: 1,
        configs: {
          invalid: { resourceRef: { managedSiteType: "unknown" } },
        },
      },
    })
    expect(imported).toBeNull()
    expect(
      repository.normalizeExtensionImport({
        channelConfigs: { schemaVersion: 99, configs: {} },
      }),
    ).toBeNull()
    store.close()
  })
})

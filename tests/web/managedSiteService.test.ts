import { ChannelConfigRepository } from "~~/server/channelConfigRepository"
import { EncryptedDocumentStore } from "~~/server/encryptedDocumentStore"
import type { StoredManagedSiteConnection } from "~~/server/managedSiteRepository"
import { ManagedSiteService } from "~~/server/managedSiteService"

const adapterMocks = vi.hoisted(() => ({
  axonHubList: vi.fn(),
  claudeCodeHubList: vi.fn(),
  newApiList: vi.fn(),
  newApiFetchModels: vi.fn(),
  newApiUpdateModels: vi.fn(),
}))

vi.mock(
  "~/services/apiAdapters/managedSites/axonHub",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("~/services/apiAdapters/managedSites/axonHub")
      >()
    return {
      ...actual,
      axonHubManagedSiteChannels: {
        ...actual.axonHubManagedSiteChannels,
        list: adapterMocks.axonHubList,
      },
    }
  },
)

vi.mock(
  "~/services/apiAdapters/managedSites/claudeCodeHub",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("~/services/apiAdapters/managedSites/claudeCodeHub")
      >()
    return {
      ...actual,
      claudeCodeHubManagedSiteChannels: {
        ...actual.claudeCodeHubManagedSiteChannels,
        list: adapterMocks.claudeCodeHubList,
      },
    }
  },
)

vi.mock(
  "~/services/apiAdapters/managedSites/newApi",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("~/services/apiAdapters/managedSites/newApi")
      >()
    return {
      ...actual,
      newApiManagedSiteChannels: {
        ...actual.newApiManagedSiteChannels,
        list: adapterMocks.newApiList,
        fetchModels: adapterMocks.newApiFetchModels,
        updateModels: adapterMocks.newApiUpdateModels,
      },
    }
  },
)

const emptyChannelList = () => ({ items: [], total: 0, type_counts: {} })

describe("ManagedSiteService", () => {
  beforeEach(() => {
    adapterMocks.axonHubList.mockReset().mockResolvedValue(emptyChannelList())
    adapterMocks.claudeCodeHubList
      .mockReset()
      .mockResolvedValue(emptyChannelList())
    adapterMocks.newApiList.mockReset().mockResolvedValue({
      items: [
        {
          id: 7,
          name: "channel",
          type: 1,
          status: 1,
          base_url: "https://upstream.example.com",
          models: "legacy-model",
          group: "default",
          priority: 0,
          weight: 1,
        },
      ],
      total: 1,
      type_counts: {},
    })
    adapterMocks.newApiFetchModels
      .mockReset()
      .mockResolvedValue(["gpt-4", "claude-3"])
    adapterMocks.newApiUpdateModels.mockReset().mockResolvedValue(undefined)
  })

  it("maps AxonHub credentials without returning private fields", async () => {
    const connection: StoredManagedSiteConnection = {
      id: "axonhub-1",
      name: "AxonHub",
      siteType: "axonhub",
      baseUrl: "https://axonhub.example.com",
      adminToken: "",
      userId: "",
      email: "admin@example.com",
      password: "axon-secret",
      createdAt: 1,
    }

    const result = await new ManagedSiteService().listChannels(connection)

    expect(adapterMocks.axonHubList).toHaveBeenCalledWith(
      {
        baseUrl: "https://axonhub.example.com",
        email: "admin@example.com",
        password: "axon-secret",
      },
      { requireCompleteInventory: true },
    )
    expect(result.connection).toEqual({
      id: "axonhub-1",
      name: "AxonHub",
      siteType: "axonhub",
      baseUrl: "https://axonhub.example.com",
      userId: "",
      createdAt: 1,
    })
  })

  it("maps Claude Code Hub credentials without requiring a user id", async () => {
    const connection: StoredManagedSiteConnection = {
      id: "claude-code-hub-1",
      name: "Claude Code Hub",
      siteType: "claude-code-hub",
      baseUrl: "https://claude.example.com",
      adminToken: "claude-secret",
      userId: "",
      createdAt: 2,
    }

    await new ManagedSiteService().listChannels(connection)

    expect(adapterMocks.claudeCodeHubList).toHaveBeenCalledWith(
      {
        baseUrl: "https://claude.example.com",
        adminToken: "claude-secret",
      },
      { requireCompleteInventory: true },
    )
  })

  it("rejects an unsafe managed-site URL before updating a channel", async () => {
    const connection: StoredManagedSiteConnection = {
      id: "new-api-unsafe",
      name: "Unsafe",
      siteType: "new-api",
      baseUrl: "file:///etc/passwd",
      adminToken: "secret",
      userId: "1",
      createdAt: 3,
    }

    await expect(
      new ManagedSiteService().updateChannel(connection, 1, {
        name: "channel",
        type: 1,
        credential: "credential",
        baseUrl: "https://upstream.example.com",
        models: ["model"],
        groups: ["default"],
        priority: 0,
        weight: 1,
        enabled: true,
      }),
    ).rejects.toThrow("HTTP or HTTPS")
  })

  it("applies persisted channel model filters before writing the upstream list", async () => {
    const store = new EncryptedDocumentStore(
      ":memory:",
      "channel-filter-secret",
    )
    const channelConfigRepository = new ChannelConfigRepository(store)
    channelConfigRepository.upsert({
      managedSiteType: "new-api",
      scopeKey: "https://managed.example.com/admin/",
      resourceId: 7,
      channelId: 7,
      rules: [
        {
          id: "include-gpt",
          name: "GPT only",
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
    const connection: StoredManagedSiteConnection = {
      id: "new-api-1",
      name: "New API",
      siteType: "new-api",
      baseUrl: "https://managed.example.com/admin",
      adminToken: "admin-secret",
      userId: "1",
      createdAt: 4,
    }

    const result = await new ManagedSiteService(
      channelConfigRepository,
    ).syncModels(connection)

    expect(result.summary).toMatchObject({ total: 1, succeeded: 1, changed: 1 })
    expect(adapterMocks.newApiUpdateModels).toHaveBeenCalledWith(
      {
        baseUrl: "https://managed.example.com/admin",
        adminToken: "admin-secret",
        userId: "1",
      },
      7,
      ["gpt-4"],
      { requireCompleteInventory: true },
    )
    expect(result.items[0]?.newModels).toEqual(["gpt-4"])
    store.close()
  })
})

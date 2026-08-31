import type { ManagedSiteChannelsCapability } from "~/services/apiAdapters/contracts/managedSiteCapabilities"
import {
  applyChannelModelFilters,
  getChannelModelFilterRulesForResource,
} from "~/services/models/modelSync/channelModelFilterEvaluator"
import { toSanitizedErrorSummary } from "~/services/verification/aiApiVerification/utils"
import { CHANNEL_MODE, CHANNEL_STATUS } from "~/types/managedSite"
import type {
  WebManagedChannelInput,
  WebManagedChannelListResponse,
  WebManagedModelSyncInput,
  WebManagedModelSyncResponse,
} from "~/web/contracts"

import type { ChannelConfigRepository } from "./channelConfigRepository"
import {
  toWebManagedSiteConnection,
  type StoredManagedSiteConnection,
} from "./managedSiteRepository"
import { assertSafeUpstreamUrl } from "./ssrfGuard"

const normalizeModels = (models: string[]) =>
  Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)))

const modelsEqual = (left: string[], right: string[]) => {
  const normalizedLeft = normalizeModels(left).sort()
  const normalizedRight = normalizeModels(right).sort()
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((model, index) => model === normalizedRight[index])
  )
}

const getErrorDetails = (
  error: unknown,
  connection: StoredManagedSiteConnection,
) => {
  const candidate = error as { statusCode?: unknown; status?: unknown }
  const statusCode =
    typeof candidate?.statusCode === "number"
      ? candidate.statusCode
      : typeof candidate?.status === "number"
        ? candidate.status
        : undefined
  return {
    ...(statusCode !== undefined ? { httpStatus: statusCode } : {}),
    message:
      toSanitizedErrorSummary(error, [
        connection.adminToken,
        connection.password ?? "",
      ]) || "Managed-site model synchronization failed",
  }
}

export class ManagedSiteService {
  constructor(
    private readonly channelConfigRepository?: ChannelConfigRepository,
  ) {}

  private async resolveCapability(
    connection: StoredManagedSiteConnection,
  ): Promise<ManagedSiteChannelsCapability<any>> {
    return connection.siteType === "octopus"
      ? (await import("~/services/apiAdapters/managedSites/octopus"))
          .octopusManagedSiteChannels
      : connection.siteType === "axonhub"
        ? (await import("~/services/apiAdapters/managedSites/axonHub"))
            .axonHubManagedSiteChannels
        : connection.siteType === "claude-code-hub"
          ? (await import("~/services/apiAdapters/managedSites/claudeCodeHub"))
              .claudeCodeHubManagedSiteChannels
          : connection.siteType === "sub2api"
            ? (await import("~/services/apiAdapters/managedSites/sub2api"))
                .sub2ApiManagedSiteChannels
            : connection.siteType === "new-api"
              ? (await import("~/services/apiAdapters/managedSites/newApi"))
                  .newApiManagedSiteChannels
              : connection.siteType === "Veloera"
                ? (await import("~/services/apiAdapters/managedSites/veloera"))
                    .veloeraManagedSiteChannels
                : (await import("~/services/apiAdapters/managedSites/doneHub"))
                    .doneHubManagedSiteChannels
  }

  private createConfig(connection: StoredManagedSiteConnection) {
    return connection.siteType === "octopus"
      ? {
          baseUrl: connection.baseUrl,
          username: connection.username ?? "",
          password: connection.password ?? "",
        }
      : connection.siteType === "axonhub"
        ? {
            baseUrl: connection.baseUrl,
            email: connection.email ?? "",
            password: connection.password ?? "",
          }
        : connection.siteType === "claude-code-hub"
          ? {
              baseUrl: connection.baseUrl,
              adminToken: connection.adminToken,
            }
          : connection.siteType === "sub2api"
            ? {
                baseUrl: connection.baseUrl,
                adminToken: connection.adminToken,
              }
            : {
                baseUrl: connection.baseUrl,
                adminToken: connection.adminToken,
                userId: connection.userId,
              }
  }

  async listChannels(
    connection: StoredManagedSiteConnection,
  ): Promise<WebManagedChannelListResponse> {
    await assertSafeUpstreamUrl(connection.baseUrl, "Managed site")
    const config = this.createConfig(connection)
    const capability = await this.resolveCapability(connection)
    const result = capability.list
      ? await capability.list(config, { requireCompleteInventory: true })
      : await capability.search(config, "", { requireCompleteInventory: true })
    const channels = result?.items ?? []
    return {
      connection: toWebManagedSiteConnection(connection),
      channels: channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        status: channel.status,
        baseUrl: channel.base_url,
        modelCount: channel.models
          ? channel.models.split(",").filter(Boolean).length
          : 0,
        models: channel.models ? channel.models.split(",").filter(Boolean) : [],
        groups: channel.group ? channel.group.split(",").filter(Boolean) : [],
        priority: channel.priority,
        weight: channel.weight,
        enabled: channel.status === CHANNEL_STATUS.Enable,
      })),
      total: result?.total ?? channels.length,
    }
  }

  async deleteChannel(
    connection: StoredManagedSiteConnection,
    channelId: number,
  ) {
    await assertSafeUpstreamUrl(connection.baseUrl, "Managed site")
    const capability = await this.resolveCapability(connection)
    await capability.delete(this.createConfig(connection), channelId)
    return this.listChannels(connection)
  }

  async createChannel(
    connection: StoredManagedSiteConnection,
    input: WebManagedChannelInput,
  ) {
    await assertSafeUpstreamUrl(connection.baseUrl, "Managed site")
    if (input.baseUrl.trim()) {
      await assertSafeUpstreamUrl(input.baseUrl, "Channel")
    }
    const capability = await this.resolveCapability(connection)
    await capability.create(this.createConfig(connection), {
      mode: CHANNEL_MODE.SINGLE,
      channel: {
        name: input.name.trim(),
        type: input.type,
        key: input.credential.trim(),
        base_url: input.baseUrl.trim(),
        models: input.models.join(","),
        group: input.groups.join(","),
        priority: input.priority,
        weight: input.weight,
        status: input.enabled
          ? CHANNEL_STATUS.Enable
          : CHANNEL_STATUS.ManuallyDisabled,
      },
    })
    return this.listChannels(connection)
  }

  async updateChannel(
    connection: StoredManagedSiteConnection,
    channelId: number,
    input: WebManagedChannelInput,
  ) {
    await assertSafeUpstreamUrl(connection.baseUrl, "Managed site")
    if (input.baseUrl.trim()) {
      await assertSafeUpstreamUrl(input.baseUrl, "Channel")
    }
    const capability = await this.resolveCapability(connection)
    await capability.update(this.createConfig(connection), {
      id: channelId,
      name: input.name.trim(),
      type: input.type,
      ...(input.credential.trim() ? { key: input.credential.trim() } : {}),
      base_url: input.baseUrl.trim(),
      models: input.models.join(","),
      group: input.groups.join(","),
      priority: input.priority,
      weight: input.weight,
      status: input.enabled
        ? CHANNEL_STATUS.Enable
        : CHANNEL_STATUS.ManuallyDisabled,
    })
    return this.listChannels(connection)
  }

  async syncModels(
    connection: StoredManagedSiteConnection,
    input: WebManagedModelSyncInput = {},
  ): Promise<WebManagedModelSyncResponse> {
    await assertSafeUpstreamUrl(connection.baseUrl, "Managed site")
    const capability = await this.resolveCapability(connection)
    if (!capability.fetchModels || !capability.updateModels) {
      throw new Error(
        `Managed-site model synchronization is unsupported for ${connection.siteType}`,
      )
    }

    const listed = await this.listChannels(connection)
    const selected = input.channelIds?.length
      ? listed.channels.filter((channel) =>
          input.channelIds?.includes(channel.id),
        )
      : listed.channels
    const startedAt = Date.now()
    const concurrency = Math.max(
      1,
      Math.min(8, Math.round(input.concurrency ?? 3)),
    )
    const maxRetries = Math.max(
      0,
      Math.min(3, Math.round(input.maxRetries ?? 1)),
    )
    const channelConfigs =
      this.channelConfigRepository?.getDocument().data.configs
    const results: WebManagedModelSyncResponse["items"] = []
    let nextIndex = 0

    const runChannel = async (channel: (typeof selected)[number]) => {
      const oldModels = normalizeModels(channel.models)
      let attempts = 0
      let lastError: unknown
      while (attempts <= maxRetries) {
        try {
          if (channel.baseUrl.trim()) {
            await assertSafeUpstreamUrl(channel.baseUrl, "Channel")
          }
          const upstreamModels = normalizeModels(
            await capability.fetchModels!(
              this.createConfig(connection),
              channel.id,
              { requireCompleteInventory: true },
            ),
          )
          const channelFilterRules = getChannelModelFilterRulesForResource(
            channelConfigs,
            {
              managedSiteType: connection.siteType,
              scopeKey: connection.baseUrl,
              resourceId: channel.id,
            },
          )
          const filteredModels = await applyChannelModelFilters(
            channelFilterRules,
            upstreamModels,
          )
          if (!modelsEqual(oldModels, filteredModels)) {
            const mutation = await capability.updateModels!(
              this.createConfig(connection),
              channel.id,
              filteredModels,
              { requireCompleteInventory: true },
            )
            if (
              mutation &&
              typeof mutation === "object" &&
              "outcome" in mutation &&
              mutation.outcome !== "succeeded"
            ) {
              const diagnostic =
                "diagnostic" in mutation &&
                mutation.diagnostic &&
                typeof mutation.diagnostic === "object" &&
                "message" in mutation.diagnostic
                  ? String(mutation.diagnostic.message)
                  : "上游拒绝了模型更新"
              throw new Error(diagnostic)
            }
          }
          results.push({
            channelId: channel.id,
            channelName: channel.name,
            ok: true,
            attempts: attempts + 1,
            finishedAt: Date.now(),
            oldModels,
            newModels: filteredModels,
          })
          return
        } catch (error) {
          lastError = error
          attempts += 1
          if (attempts <= maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, attempts * 250))
          }
        }
      }
      const details = getErrorDetails(lastError, connection)
      results.push({
        channelId: channel.id,
        channelName: channel.name,
        ok: false,
        attempts,
        finishedAt: Date.now(),
        oldModels,
        ...details,
      })
    }

    const worker = async () => {
      while (true) {
        const index = nextIndex++
        const channel = selected[index]
        if (!channel) return
        await runChannel(channel)
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, selected.length) }, worker),
    )
    results.sort((left, right) => left.channelId - right.channelId)
    const succeeded = results.filter((item) => item.ok)
    return {
      connection: toWebManagedSiteConnection(connection),
      startedAt,
      finishedAt: Date.now(),
      items: results,
      summary: {
        total: results.length,
        succeeded: succeeded.length,
        failed: results.length - succeeded.length,
        changed: succeeded.filter(
          (item) =>
            !modelsEqual(item.oldModels, item.newModels ?? item.oldModels),
        ).length,
      },
    }
  }
}

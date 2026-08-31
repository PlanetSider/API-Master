import { SlidersHorizontal } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import type { ChannelModelFilterRule } from "~/types/channelModelFilters"
import type {
  WebChannelConfigPatch,
  WebChannelConfigResponse,
  WebManagedSiteConnection,
} from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface Props {
  open: boolean
  busy: boolean
  connection: WebManagedSiteConnection | null
  channelId: number | null
  channelName?: string
  config: WebChannelConfigResponse | null
  onClose: () => void
  onSave: (input: WebChannelConfigPatch) => Promise<void>
}

const splitPatterns = (value: string) =>
  value
    .split(/[\n,]/u)
    .map((item) => item.trim())
    .filter(Boolean)

const makeRule = (
  action: "include" | "exclude",
  pattern: string,
  index: number,
): ChannelModelFilterRule => {
  const now = Date.now()
  return {
    id: `web-${action}-${now}-${index}`,
    name: `${action === "include" ? "包含" : "排除"} ${pattern}`,
    kind: "pattern",
    pattern,
    isRegex: false,
    action,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  }
}

export function ChannelFiltersDialog({
  open,
  busy,
  connection,
  channelId,
  channelName,
  config,
  onClose,
  onSave,
}: Props) {
  const [includePatterns, setIncludePatterns] = useState("")
  const [excludePatterns, setExcludePatterns] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const rules = config?.snapshot.configs
      ? Object.values(config.snapshot.configs).find(
          (item) =>
            item.resourceRef.managedSiteType === connection?.siteType &&
            item.resourceRef.scopeKey === connection?.baseUrl &&
            item.resourceRef.resourceId === String(channelId),
        )?.modelFilterSettings.rules ?? []
      : []
    setIncludePatterns(
      rules
        .filter((rule) => rule.action === "include" && rule.kind !== "probe")
        .map((rule) => ("pattern" in rule ? rule.pattern : ""))
        .filter(Boolean)
        .join("\n"),
    )
    setExcludePatterns(
      rules
        .filter((rule) => rule.action === "exclude" && rule.kind !== "probe")
        .map((rule) => ("pattern" in rule ? rule.pattern : ""))
        .filter(Boolean)
        .join("\n"),
    )
    setError(null)
  }, [channelId, config, connection, open])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!connection || channelId === null) return
    const include = splitPatterns(includePatterns)
    const exclude = splitPatterns(excludePatterns)
    if (include.length + exclude.length > 500) {
      setError("最多保存 500 条模式规则")
      return
    }
    try {
      const rules = [
        ...include.map((pattern, index) => makeRule("include", pattern, index)),
        ...exclude.map((pattern, index) => makeRule("exclude", pattern, index)),
      ]
      await onSave({
        managedSiteType: connection.siteType,
        scopeKey: connection.baseUrl,
        resourceId: channelId,
        channelId,
        rules,
        expectedRevision: config?.revision,
      })
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "模型过滤保存失败",
      )
    }
  }

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="模型过滤"
      description={`${channelName ?? "渠道"}：每行一个模式，匹配模型名称。`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            取消
          </button>
          <button
            type="submit"
            form="channel-filters-form"
            disabled={busy || !connection || channelId === null}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "正在保存..." : "保存规则"}
          </button>
        </>
      }
    >
      <form id="channel-filters-form" onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal className="size-4 text-gray-500" />
            包含模式
          </span>
          <textarea
            value={includePatterns}
            onChange={(event) => setIncludePatterns(event.target.value)}
            rows={5}
            placeholder="例如：gpt-4o\nclaude-3"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">排除模式</span>
          <textarea
            value={excludePatterns}
            onChange={(event) => setExcludePatterns(event.target.value)}
            rows={5}
            placeholder="例如：embedding\n不稳定"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </form>
    </WebDialog>
  )
}

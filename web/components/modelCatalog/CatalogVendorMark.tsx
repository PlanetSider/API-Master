import { ModelVendorMark } from "~/features/ModelList/components/ModelVendorMark"
import type { ResolvedModelVendor } from "~/services/models/modelMetadata/types"

const knownVendorPatterns: Array<[RegExp, string, string]> = [
  [/openai|gpt/i, "openai", "OpenAI"],
  [/anthropic|claude/i, "anthropic", "Anthropic"],
  [/google|gemini/i, "google", "Google"],
  [/deepseek|深度求索/i, "deepseek", "DeepSeek"],
  [/meta|llama/i, "meta", "Meta"],
  [/mistral/i, "mistral", "Mistral"],
  [/moonshot|kimi|月之暗面/i, "moonshot", "Moonshot"],
  [/zhipu|glm|智谱/i, "zhipu", "智谱 AI"],
  [/alibaba|qwen|通义|阿里/i, "alibaba", "阿里巴巴"],
  [/xai|grok/i, "xai", "xAI"],
  [/minimax|海螺/i, "minimax", "MiniMax"],
  [/cohere/i, "cohere", "Cohere"],
  [/tencent|hunyuan|腾讯|混元/i, "tencent", "腾讯"],
  [/baidu|ernie|百度|文心/i, "baidu", "百度"],
  [/baichuan|百川/i, "baichuan", "百川"],
  [/bytedance|doubao|字节|豆包/i, "bytedance", "字节跳动"],
  [/nvidia/i, "nvidia", "NVIDIA"],
  [/microsoft|azure/i, "microsoft", "Microsoft"],
]

export const resolveCatalogVendor = (vendor?: string): ResolvedModelVendor => {
  if (!vendor) return { state: "unknown" }
  const known = knownVendorPatterns.find(([pattern]) => pattern.test(vendor))
  if (known) {
    return {
      state: "resolved",
      kind: "known",
      key: `known:${known[1]}`,
      knownId: known[1],
      label: known[2],
      source: "curated-rule",
    }
  }
  return {
    state: "resolved",
    kind: "custom",
    key: `custom:${vendor.toLowerCase()}`,
    label: vendor,
    source: "publisher-evidence",
  }
}

export function CatalogVendorMark({
  vendor,
  variant,
}: {
  vendor?: string
  variant: "compact" | "badge"
}) {
  return (
    <ModelVendorMark vendor={resolveCatalogVendor(vendor)} variant={variant} />
  )
}

import { CircleHelp } from "lucide-react"
import { useEffect, useState } from "react"

import Tooltip from "~/components/Tooltip"
import { FormField, Input, SearchableSelect } from "~/components/ui"
import {
  MODEL_PRICE_COMPARISON_PRESET_IDS,
  MODEL_PRICE_COMPARISON_PRESETS,
  MODEL_PRICE_COMPARISON_WEIGHT_KEYS,
  type ModelPriceComparisonPresetId,
  type ModelPriceComparisonWeightKey,
  type ModelPriceComparisonWeights,
} from "~/features/ModelList/priceComparison"

const presetOptions = [
  {
    value: MODEL_PRICE_COMPARISON_PRESET_IDS.AZURE_CONVERSATION,
    label: "普通对话",
  },
  {
    value: MODEL_PRICE_COMPARISON_PRESET_IDS.MOONCAKE_TOOL_AGENT,
    label: "Tool / Agent",
  },
  {
    value: MODEL_PRICE_COMPARISON_PRESET_IDS.AZURE_CODE,
    label: "代码补全",
  },
  {
    value: MODEL_PRICE_COMPARISON_PRESET_IDS.TRACELAB_CODING_AGENT,
    label: "编码 Agent",
  },
  { value: MODEL_PRICE_COMPARISON_PRESET_IDS.CUSTOM, label: "自定义" },
]

const sourceDetails: Partial<Record<ModelPriceComparisonPresetId, string>> = {
  [MODEL_PRICE_COMPARISON_PRESET_IDS.AZURE_CONVERSATION]:
    "根据 Azure Conversation 公开数据计算；暂不计入缓存读取和写入。",
  [MODEL_PRICE_COMPARISON_PRESET_IDS.MOONCAKE_TOOL_AGENT]:
    "根据 Mooncake Tool and Agent 公开数据计算；暂不计入缓存读取和写入。",
  [MODEL_PRICE_COMPARISON_PRESET_IDS.AZURE_CODE]:
    "根据 Azure Code 公开数据计算；暂不计入缓存读取和写入。",
  [MODEL_PRICE_COMPARISON_PRESET_IDS.TRACELAB_CODING_AGENT]:
    "根据 TraceLab 编码 Agent 公开数据推算；缓存写入暂不单独计算。",
}

const weightLabels: Record<ModelPriceComparisonWeightKey, string> = {
  input: "输入占比",
  output: "输出占比",
  cacheRead: "缓存读取占比",
  cacheWrite: "缓存写入占比",
}

interface PriceComparisonControlsProps {
  presetId: ModelPriceComparisonPresetId
  weights: ModelPriceComparisonWeights
  onPresetIdChange: (presetId: ModelPriceComparisonPresetId) => void
  onWeightsChange: (weights: ModelPriceComparisonWeights) => void
}

export function PriceComparisonControls({
  presetId,
  weights,
  onPresetIdChange,
  onWeightsChange,
}: PriceComparisonControlsProps) {
  const [draftWeights, setDraftWeights] = useState<
    Record<ModelPriceComparisonWeightKey, string>
  >(
    () =>
      Object.fromEntries(
        MODEL_PRICE_COMPARISON_WEIGHT_KEYS.map((key) => [
          key,
          weights[key] === null ? "" : String(weights[key]),
        ]),
      ) as Record<ModelPriceComparisonWeightKey, string>,
  )

  useEffect(() => {
    setDraftWeights(
      Object.fromEntries(
        MODEL_PRICE_COMPARISON_WEIGHT_KEYS.map((key) => [
          key,
          weights[key] === null ? "" : String(weights[key]),
        ]),
      ) as Record<ModelPriceComparisonWeightKey, string>,
    )
  }, [weights])

  const handlePresetChange = (value: string) => {
    const nextPresetId = value as ModelPriceComparisonPresetId
    onPresetIdChange(nextPresetId)
    if (nextPresetId !== MODEL_PRICE_COMPARISON_PRESET_IDS.CUSTOM) {
      onWeightsChange({
        ...MODEL_PRICE_COMPARISON_PRESETS[nextPresetId].weights,
      })
    }
  }

  const handleWeightChange = (
    key: ModelPriceComparisonWeightKey,
    value: string,
  ) => {
    setDraftWeights((current) => ({ ...current, [key]: value }))
    if (value.trim() === "") {
      onPresetIdChange(MODEL_PRICE_COMPARISON_PRESET_IDS.CUSTOM)
      onWeightsChange({ ...weights, [key]: null })
      return
    }
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) return
    onPresetIdChange(MODEL_PRICE_COMPARISON_PRESET_IDS.CUSTOM)
    onWeightsChange({ ...weights, [key]: parsed })
  }

  const handleWeightBlur = (key: ModelPriceComparisonWeightKey) => {
    const value = draftWeights[key].trim()
    if (value === "") return
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return
    setDraftWeights((current) => ({
      ...current,
      [key]: weights[key] === null ? "" : String(weights[key]),
    }))
  }

  return (
    <section
      aria-labelledby="web-model-price-comparison-title"
      aria-describedby="web-model-price-comparison-description web-model-price-comparison-helper"
      className="mt-4 rounded-md border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-950/35"
    >
      <div className="space-y-1">
        <h3
          id="web-model-price-comparison-title"
          className="text-sm font-semibold text-gray-900 dark:text-white"
        >
          价格比较条件
        </h3>
        <p
          id="web-model-price-comparison-description"
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          设置各类用量占比，让模型价格比较更符合你的使用方式。选择场景会自动填入，也可以手动调整。
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 [@container(min-width:32rem)]:grid-cols-2 [@container(min-width:48rem)]:grid-cols-[minmax(11rem,1.25fr)_repeat(4,minmax(6rem,1fr))]">
        <div className="space-y-2 [@container(min-width:32rem)]:col-span-2 [@container(min-width:48rem)]:col-span-1">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="web-model-price-comparison-preset"
              className="text-sm font-medium"
            >
              使用场景
            </label>
            {sourceDetails[presetId] ? (
              <Tooltip
                content={sourceDetails[presetId]}
                wrapperClassName="inline-flex"
              >
                <button
                  type="button"
                  aria-label={sourceDetails[presetId]}
                  className="inline-flex size-4 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:hover:text-gray-300"
                >
                  <CircleHelp className="size-4" aria-hidden="true" />
                </button>
              </Tooltip>
            ) : null}
          </div>
          <SearchableSelect
            id="web-model-price-comparison-preset"
            value={presetId}
            options={presetOptions}
            aria-label="使用场景"
            onChange={handlePresetChange}
          />
        </div>

        {MODEL_PRICE_COMPARISON_WEIGHT_KEYS.map((key) => (
          <FormField
            key={key}
            label={weightLabels[key]}
            htmlFor={`web-model-price-comparison-weight-${key}`}
          >
            <Input
              id={`web-model-price-comparison-weight-${key}`}
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              aria-describedby="web-model-price-comparison-helper"
              placeholder="不计入"
              value={draftWeights[key]}
              onChange={(event) => handleWeightChange(key, event.target.value)}
              onBlur={() => handleWeightBlur(key)}
              onClear={() => handleWeightChange(key, "")}
              clearButtonLabel={`清除${weightLabels[key]}`}
            />
          </FormField>
        ))}

        <p
          id="web-model-price-comparison-helper"
          className="text-xs leading-5 text-gray-500 dark:text-gray-400 [@container(min-width:32rem)]:col-span-2 [@container(min-width:48rem)]:col-span-5"
        >
          留空不参与比较；填 0 表示占比为
          0。比较结果基于价格来源公开的数据估算，实际费用以站点账单为准；缺少的价格项不会按免费处理。
        </p>
      </div>
    </section>
  )
}

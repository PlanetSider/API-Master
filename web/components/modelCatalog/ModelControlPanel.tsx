import {
  CircleHelp,
  Copy,
  Cpu,
  FlaskConical,
  Search,
  TrendingDown,
} from "lucide-react"

import Tooltip from "~/components/Tooltip"
import {
  Alert,
  Button,
  Card,
  CardContent,
  CompactMultiSelect,
  FormField,
  Input,
  Label,
  SearchableSelect,
  Switch,
} from "~/components/ui"
import type {
  ModelPriceComparisonPresetId,
  ModelPriceComparisonWeights,
} from "~/features/ModelList/priceComparison"

import { PriceComparisonControls } from "./PriceComparisonControls"
import type {
  ModelCapabilityKey,
  ModelCatalogBillingMode,
  ModelCatalogSortMode,
  ModelVerificationFilter,
} from "./types"

const capabilityOptions: Array<{
  value: ModelCapabilityKey
  label: string
}> = [
  { value: "image-input", label: "图片理解" },
  { value: "image-output", label: "图片生成" },
  { value: "audio-input", label: "音频输入" },
  { value: "audio-output", label: "音频输出" },
  { value: "video-input", label: "视频输入" },
  { value: "video-output", label: "视频输出" },
  { value: "pdf", label: "PDF" },
  { value: "reasoning", label: "思考" },
  { value: "tool-call", label: "工具调用" },
  { value: "structured-output", label: "结构化输出" },
  { value: "attachment", label: "附件" },
]

interface ModelControlPanelProps {
  search: string
  sortMode: ModelCatalogSortMode
  billingMode: ModelCatalogBillingMode
  selectedGroups: string[]
  availableGroups: string[]
  selectedCapabilities: ModelCapabilityKey[]
  capabilityCounts: Partial<Record<ModelCapabilityKey, number>>
  selectedVerificationResults: ModelVerificationFilter[]
  showRealPrice: boolean
  showEndpointTypes: boolean
  supportsPricing: boolean
  supportsVerification: boolean
  supportsCapabilityFilter: boolean
  isAllAccountsSource: boolean
  isProfileSource: boolean
  totalCount: number
  filteredCount: number
  presetId: ModelPriceComparisonPresetId
  weights: ModelPriceComparisonWeights
  priceComparisonActive: boolean
  onSearchChange: (value: string) => void
  onSortModeChange: (value: ModelCatalogSortMode) => void
  onBillingModeChange: (value: ModelCatalogBillingMode) => void
  onSelectedGroupsChange: (value: string[]) => void
  onSelectedCapabilitiesChange: (value: ModelCapabilityKey[]) => void
  onSelectedVerificationResultsChange: (
    value: ModelVerificationFilter[],
  ) => void
  onShowRealPriceChange: (value: boolean) => void
  onShowEndpointTypesChange: (value: boolean) => void
  onPresetIdChange: (value: ModelPriceComparisonPresetId) => void
  onWeightsChange: (value: ModelPriceComparisonWeights) => void
  onCopyAllNames: () => void
  onBatchVerify?: () => void
  onEnablePriceComparison: () => void
}

export function ModelControlPanel({
  search,
  sortMode,
  billingMode,
  selectedGroups,
  availableGroups,
  selectedCapabilities,
  capabilityCounts,
  selectedVerificationResults,
  showRealPrice,
  showEndpointTypes,
  supportsPricing,
  supportsVerification,
  supportsCapabilityFilter,
  isAllAccountsSource,
  isProfileSource,
  totalCount,
  filteredCount,
  presetId,
  weights,
  priceComparisonActive,
  onSearchChange,
  onSortModeChange,
  onBillingModeChange,
  onSelectedGroupsChange,
  onSelectedCapabilitiesChange,
  onSelectedVerificationResultsChange,
  onShowRealPriceChange,
  onShowEndpointTypesChange,
  onPresetIdChange,
  onWeightsChange,
  onCopyAllNames,
  onBatchVerify,
  onEnablePriceComparison,
}: ModelControlPanelProps) {
  const sortOptions = [
    { value: "default", label: "默认顺序" },
    ...(supportsPricing
      ? [
          { value: "price-asc", label: "价格从低到高" },
          { value: "price-desc", label: "价格从高到低" },
        ]
      : []),
    ...(supportsVerification
      ? [
          {
            value: "verification-latency-asc",
            label: "测试延迟从低到高",
          },
        ]
      : []),
    ...(isAllAccountsSource && supportsPricing
      ? [
          {
            value: "model-cheapest-first",
            label: "同模型最低价优先",
          },
        ]
      : []),
  ]
  const pricedSortActive =
    sortMode === "price-asc" ||
    sortMode === "price-desc" ||
    sortMode === "model-cheapest-first"
  const groupSelectionHint =
    "留空表示所有分组；价格排序会在已选分组范围内自动取最优价"
  const modelCapabilityHint = "选择多个能力时，模型需要同时满足所有条件。"

  return (
    <Card className="mb-6" aria-label="模型筛选">
      <CardContent className="[container-type:inline-size]">
        {isProfileSource ? (
          <Alert
            variant="info"
            className="mb-4"
            title="API 凭据模型目录"
            description="已保存的 API 凭据仅支持模型发现与验证，不提供定价、分组筛选、账号概览或密钥兼容性能力。"
          />
        ) : null}
        <div className="space-y-4">
          <section
            aria-label="搜索模型"
            className="border-b border-gray-100 pb-4 dark:border-gray-700"
          >
            <div className="grid grid-cols-1 gap-3 [@container(min-width:32rem)]:grid-cols-[minmax(0,1fr)_minmax(12rem,0.55fr)] [@container(min-width:48rem)]:grid-cols-[minmax(0,1fr)_minmax(12rem,0.42fr)_auto] [@container(min-width:48rem)]:items-end">
              <FormField label="搜索模型">
                <Input
                  type="text"
                  aria-label="搜索模型"
                  placeholder="输入模型名称或描述..."
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  leftIcon={<Search className="size-4" />}
                  onClear={() => onSearchChange("")}
                  clearButtonLabel="清除"
                />
              </FormField>

              <FormField label="排序方式">
                <SearchableSelect
                  options={sortOptions}
                  value={sortMode}
                  aria-label="排序方式"
                  onChange={(value) =>
                    onSortModeChange(value as ModelCatalogSortMode)
                  }
                  placeholder="排序方式"
                />
              </FormField>

              <div className="flex h-9 items-center gap-3 self-end text-xs [@container(min-width:32rem)]:col-span-2 [@container(min-width:32rem)]:justify-end [@container(min-width:48rem)]:col-span-1">
                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <Cpu className="size-4" />
                  总计 {totalCount} 个模型
                </span>
                <span className="h-3 w-px bg-gray-300 dark:bg-gray-700" />
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  显示 {filteredCount} 个模型
                </span>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="web-model-list-filters-heading"
            className="border-b border-gray-100 pb-4 dark:border-gray-700"
          >
            <h3
              id="web-model-list-filters-heading"
              className="mb-3 text-sm font-semibold text-gray-900 dark:text-white"
            >
              筛选条件
            </h3>

            <div className="grid grid-cols-1 gap-4 [@container(min-width:32rem)]:grid-cols-2 [@container(min-width:48rem)]:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
              {supportsPricing ? (
                <FormField label="计费方式">
                  <SearchableSelect
                    value={billingMode}
                    aria-label="计费方式"
                    options={[
                      { value: "all", label: "所有计费方式" },
                      { value: "token", label: "按量计费" },
                      { value: "per-call", label: "按次计费" },
                    ]}
                    onChange={(value) =>
                      onBillingModeChange(value as ModelCatalogBillingMode)
                    }
                    placeholder="所有计费方式"
                  />
                </FormField>
              ) : null}

              {supportsPricing && !isAllAccountsSource ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label>用户分组</Label>
                    <Tooltip content={groupSelectionHint} anchorAsChild>
                      <button
                        type="button"
                        aria-label={groupSelectionHint}
                        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:hover:text-gray-300"
                      >
                        <CircleHelp className="size-4" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                  <CompactMultiSelect
                    options={availableGroups.map((group) => ({
                      value: group,
                      label: group,
                    }))}
                    selected={selectedGroups}
                    onChange={onSelectedGroupsChange}
                    aria-label="用户分组"
                    size="default"
                    displayMode="summary"
                    placeholder="所有分组"
                    emptyMessage="所有分组"
                  />
                </div>
              ) : null}

              {supportsCapabilityFilter || !isProfileSource ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label>模型能力</Label>
                    <Tooltip content={modelCapabilityHint} anchorAsChild>
                      <button
                        type="button"
                        aria-label={modelCapabilityHint}
                        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:hover:text-gray-300"
                      >
                        <CircleHelp className="size-4" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                  <CompactMultiSelect
                    options={capabilityOptions.map((option) => ({
                      ...option,
                      count: capabilityCounts[option.value] ?? 0,
                    }))}
                    selected={selectedCapabilities}
                    onChange={(values) =>
                      onSelectedCapabilitiesChange(
                        values as ModelCapabilityKey[],
                      )
                    }
                    aria-label="模型能力"
                    size="default"
                    displayMode="summary"
                    placeholder="全部能力"
                    emptyMessage="全部能力"
                  />
                </div>
              ) : null}

              <FormField label="测试结果">
                <CompactMultiSelect
                  options={[
                    { value: "pass", label: "成功" },
                    { value: "fail", label: "失败" },
                    { value: "unverified", label: "未测试" },
                  ]}
                  selected={selectedVerificationResults}
                  onChange={(values) =>
                    onSelectedVerificationResultsChange(
                      values as ModelVerificationFilter[],
                    )
                  }
                  aria-label="测试结果"
                  size="default"
                  displayMode="summary"
                  placeholder="全部测试结果"
                  emptyMessage="未选择测试结果"
                />
              </FormField>
            </div>

            {supportsPricing && pricedSortActive ? (
              <PriceComparisonControls
                presetId={presetId}
                weights={weights}
                onPresetIdChange={onPresetIdChange}
                onWeightsChange={onWeightsChange}
              />
            ) : null}
          </section>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <fieldset className="max-w-full shrink-0">
            <legend className="sr-only">显示内容</legend>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {supportsPricing ? (
                <label className="flex cursor-pointer items-center space-x-2">
                  <Switch
                    checked={showRealPrice}
                    onChange={onShowRealPriceChange}
                    size="sm"
                  />
                  <Label className="cursor-pointer">真实充值金额</Label>
                </label>
              ) : null}
              <label className="flex cursor-pointer items-center space-x-2">
                <Switch
                  checked={showEndpointTypes}
                  onChange={onShowEndpointTypesChange}
                  size="sm"
                />
                <Label className="cursor-pointer">端点类型</Label>
              </label>
            </div>
          </fieldset>

          <fieldset className="ml-auto max-w-full shrink-0">
            <legend className="sr-only">操作</legend>
            <div className="flex flex-wrap items-center gap-2 [@container(min-width:50rem)]:justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopyAllNames}
                leftIcon={<Copy className="size-4" />}
              >
                复制所有模型名称
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onBatchVerify?.()}
                disabled={filteredCount === 0}
                leftIcon={<FlaskConical className="size-4" />}
              >
                批量测试
              </Button>
              {supportsPricing && !priceComparisonActive ? (
                <Tooltip
                  content="清空当前筛选，切换到所有账号，并按同模型最低价优先排序。"
                  wrapperClassName="contents"
                >
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    title="清空当前筛选，切换到所有账号，并按同模型最低价优先排序。"
                    leftIcon={<TrendingDown className="size-4" />}
                    onClick={onEnablePriceComparison}
                  >
                    一键比价
                  </Button>
                </Tooltip>
              ) : null}
            </div>
          </fieldset>
        </div>
      </CardContent>
    </Card>
  )
}

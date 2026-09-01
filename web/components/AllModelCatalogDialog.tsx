import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Cpu,
  Info,
  LayoutGrid,
  RefreshCw,
  Search,
  TrendingDown,
} from "lucide-react"
import { useMemo, useRef, useState } from "react"

import {
  calculateWeightedTokenPrice,
  DEFAULT_MODEL_PRICE_COMPARISON_PRESET_ID,
  MODEL_PRICE_COMPARISON_PRESET_IDS,
  MODEL_PRICE_COMPARISON_PRESETS,
  type ModelPriceComparisonWeights,
} from "~/features/ModelList/priceComparison"
import type {
  WebAllModelCatalogOffer,
  WebAllModelCatalogResponse,
  WebModelCatalogPrice,
} from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface AllModelCatalogDialogProps {
  open: boolean
  busy: boolean
  catalog: WebAllModelCatalogResponse | null
  onClose: () => void
  onRefresh: () => Promise<void>
}

type SortMode = "default" | "price-asc" | "price-desc" | "model-cheapest-first"
type BillingMode = "all" | "token" | "per-call"
type PriceComparisonPresetId = keyof typeof MODEL_PRICE_COMPARISON_PRESETS
type AggregatedModel = WebAllModelCatalogResponse["models"][number]

interface ModelOfferRow {
  id: string
  displayName?: string
  vendor?: string
  description?: string
  offer: WebAllModelCatalogOffer
  selectedPrice: WebModelCatalogPrice | null
  priceScore: number | null
}

const statusLabels = {
  success: "已加载",
  error: "加载失败",
  unsupported: "暂未适配",
  skipped: "已停用",
} as const

const presetOptions: Array<{
  value: PriceComparisonPresetId
  label: string
}> = [
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
]

const formatMoney = (value: number, currency: "USD" | "CNY") => {
  const symbol = currency === "USD" ? "$" : "¥"
  if (value === 0) return `${symbol}0`
  if (value < 0.0001) return `${symbol}${value.toExponential(2)}`
  if (value < 0.01) return `${symbol}${value.toFixed(6)}`
  if (value < 1) return `${symbol}${value.toFixed(4)}`
  return `${symbol}${value.toFixed(2)}`
}

const getExchangeRate = (offer: WebAllModelCatalogOffer) =>
  typeof offer.exchangeRate === "number" &&
  Number.isFinite(offer.exchangeRate) &&
  offer.exchangeRate > 0
    ? offer.exchangeRate
    : 1

const toDisplayAmount = (
  value: number,
  offer: WebAllModelCatalogOffer,
  showRealPrice: boolean,
) => (showRealPrice ? value * getExchangeRate(offer) : value)

const getPriceScore = (
  price: WebModelCatalogPrice,
  weights: ModelPriceComparisonWeights,
  offer: WebAllModelCatalogOffer,
  showRealPrice: boolean,
): number | null => {
  if (price.precision === "unavailable") return null
  const exchangeFactor = showRealPrice ? getExchangeRate(offer) : 1

  if (price.billingMode === "token") {
    if (
      price.inputUsdPerMillionTokens === undefined ||
      price.outputUsdPerMillionTokens === undefined
    ) {
      return null
    }
    const score = calculateWeightedTokenPrice(
      {
        input: price.inputUsdPerMillionTokens,
        output: price.outputUsdPerMillionTokens,
        ...(price.cacheReadUsdPerMillionTokens === undefined
          ? {}
          : { cacheRead: price.cacheReadUsdPerMillionTokens }),
        ...(price.cacheWriteUsdPerMillionTokens === undefined
          ? {}
          : { cacheWrite: price.cacheWriteUsdPerMillionTokens }),
      },
      weights,
    )
    return score === null ? null : score * exchangeFactor
  }

  if (typeof price.usdPerCall === "number") {
    return Number.isFinite(price.usdPerCall)
      ? price.usdPerCall * exchangeFactor
      : null
  }
  if (!price.usdPerCall) return null

  const inputWeight = weights.input ?? 0
  const outputWeight = weights.output ?? 0
  const totalWeight = inputWeight + outputWeight
  if (totalWeight <= 0) return null
  return (
    ((price.usdPerCall.input * inputWeight +
      price.usdPerCall.output * outputWeight) /
      totalWeight) *
    exchangeFactor
  )
}

const selectBestPrice = (
  offer: WebAllModelCatalogOffer,
  billingMode: BillingMode,
  selectedGroup: string,
  weights: ModelPriceComparisonWeights,
  showRealPrice: boolean,
) => {
  const candidates = (offer.prices ?? []).filter(
    (price) =>
      (billingMode === "all" || price.billingMode === billingMode) &&
      (!selectedGroup || price.group === selectedGroup),
  )
  let bestPrice: WebModelCatalogPrice | null = null
  let bestScore: number | null = null

  for (const price of candidates) {
    const score = getPriceScore(price, weights, offer, showRealPrice)
    if (score !== null && (bestScore === null || score < bestScore)) {
      bestPrice = price
      bestScore = score
    } else if (!bestPrice) {
      bestPrice = price
    }
  }

  return { selectedPrice: bestPrice, priceScore: bestScore }
}

function PriceSummary({
  price,
  offer,
  showRealPrice,
}: {
  price: WebModelCatalogPrice | null
  offer: WebAllModelCatalogOffer
  showRealPrice: boolean
}) {
  if (!price || price.precision === "unavailable") {
    return (
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
        暂无可比较价格
      </span>
    )
  }

  const currency = showRealPrice ? "CNY" : "USD"
  if (price.billingMode === "per-call") {
    if (typeof price.usdPerCall === "number") {
      return (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-300">每次调用:</span>
          <span className="font-medium text-purple-600 dark:text-purple-400">
            {formatMoney(
              toDisplayAmount(price.usdPerCall, offer, showRealPrice),
              currency,
            )}
          </span>
        </div>
      )
    }
    if (price.usdPerCall) {
      return (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span className="text-gray-600 dark:text-gray-300">
            输入:{" "}
            <strong className="font-medium text-blue-600 dark:text-blue-400">
              {formatMoney(
                toDisplayAmount(price.usdPerCall.input, offer, showRealPrice),
                currency,
              )}
            </strong>
          </span>
          <span className="text-gray-600 dark:text-gray-300">
            输出:{" "}
            <strong className="font-medium text-emerald-600 dark:text-emerald-400">
              {formatMoney(
                toDisplayAmount(price.usdPerCall.output, offer, showRealPrice),
                currency,
              )}
            </strong>
          </span>
        </div>
      )
    }
  }

  const priceItems = [
    {
      key: "input",
      label: "输入:",
      amount: price.inputUsdPerMillionTokens,
      className: "text-blue-600 dark:text-blue-400",
    },
    {
      key: "output",
      label: "输出:",
      amount: price.outputUsdPerMillionTokens,
      className: "text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "cache-read",
      label: "缓存读取:",
      amount: price.cacheReadUsdPerMillionTokens,
      className: "text-amber-600 dark:text-amber-400",
    },
    {
      key: "cache-write",
      label: "缓存写入:",
      amount: price.cacheWriteUsdPerMillionTokens,
      className: "text-violet-600 dark:text-violet-400",
    },
  ].filter((item) => item.amount !== undefined)

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {priceItems.map((item) => (
        <span key={item.key} className="text-gray-600 dark:text-gray-300">
          {item.label}{" "}
          <strong className={`font-medium ${item.className}`}>
            {formatMoney(
              toDisplayAmount(item.amount ?? 0, offer, showRealPrice),
              currency,
            )}
            /M
          </strong>
        </span>
      ))}
    </div>
  )
}

function ModelOfferCard({
  row,
  showRealPrice,
  showEndpointTypes,
  isLowestPrice,
  comparisonOffer = false,
}: {
  row: ModelOfferRow
  showRealPrice: boolean
  showEndpointTypes: boolean
  isLowestPrice?: boolean
  comparisonOffer?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails =
    (row.offer.enableGroups?.length ?? 0) > 0 ||
    (showEndpointTypes && (row.offer.supportedEndpointTypes?.length ?? 0) > 0)
  const displayName = row.offer.displayName ?? row.displayName
  const vendor = row.offer.vendor ?? row.vendor
  const description = row.offer.description ?? row.description

  return (
    <article
      className={
        comparisonOffer
          ? "bg-transparent px-3 py-3 sm:px-4"
          : "rounded-md border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-700"
      }
    >
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 font-mono text-sm font-semibold break-all text-gray-900 dark:text-white">
              {row.id}
            </h3>
            {vendor ? (
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {vendor}
              </span>
            ) : null}
            {isLowestPrice ? (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                最低价
              </span>
            ) : null}
            {row.selectedPrice?.precision === "estimated" ? (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                估算价格
              </span>
            ) : null}
          </div>
          {displayName && displayName !== row.id ? (
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
              {displayName}
            </p>
          ) : null}
        </div>
        <div className="flex max-w-full shrink-0 items-center gap-1">
          <span
            className="max-w-48 truncate rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300"
            title={row.offer.accountName}
          >
            {row.offer.accountName}
          </span>
          <button
            type="button"
            title="复制模型名称"
            aria-label={`复制模型名称 ${row.id}`}
            onClick={() => void navigator.clipboard?.writeText(row.id)}
            className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <Copy className="size-3.5" />
          </button>
          {hasDetails ? (
            <button
              type="button"
              title={expanded ? "收起详细信息" : "展开详细信息"}
              aria-label={`${expanded ? "收起" : "展开"} ${row.id} 详细信息`}
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
              className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <ChevronDown
                className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          ) : null}
        </div>
      </div>

      {description ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
          {description}
        </p>
      ) : null}

      <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <PriceSummary
          price={row.selectedPrice}
          offer={row.offer}
          showRealPrice={showRealPrice}
        />
        <div className="flex shrink-0 flex-wrap items-center gap-1 text-xs">
          {row.selectedPrice?.group ? (
            <span className="rounded-md border border-gray-200 px-2 py-0.5 text-gray-600 dark:border-gray-700 dark:text-gray-300">
              {row.selectedPrice.group} · {row.selectedPrice.groupRatio}x
            </span>
          ) : null}
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            {row.selectedPrice?.billingMode === "per-call"
              ? "按次计费"
              : "按量计费"}
          </span>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-3 border-t border-gray-200 pt-3 text-xs dark:border-gray-700">
          {(row.offer.enableGroups?.length ?? 0) > 0 ? (
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-200">
                当前账号可用分组
              </span>
              <div className="mt-2 flex flex-wrap gap-1">
                {row.offer.enableGroups?.map((group) => (
                  <span
                    key={group}
                    className="rounded-md bg-gray-100 px-2 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {group}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {showEndpointTypes &&
          (row.offer.supportedEndpointTypes?.length ?? 0) > 0 ? (
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-200">
                端点类型
              </span>
              <div className="mt-2 flex flex-wrap gap-1">
                {row.offer.supportedEndpointTypes?.map((endpoint) => (
                  <code
                    key={endpoint}
                    className="rounded-md bg-gray-100 px-2 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {endpoint}
                  </code>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export function AllModelCatalogDialog({
  open,
  busy,
  catalog,
  onClose,
  onRefresh,
}: AllModelCatalogDialogProps) {
  const [search, setSearch] = useState("")
  const [accountId, setAccountId] = useState("")
  const [vendor, setVendor] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("default")
  const [billingMode, setBillingMode] = useState<BillingMode>("all")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [showRealPrice, setShowRealPrice] = useState(false)
  const [showEndpointTypes, setShowEndpointTypes] = useState(false)
  const [presetId, setPresetId] = useState<PriceComparisonPresetId>(
    DEFAULT_MODEL_PRICE_COMPARISON_PRESET_ID,
  )
  const providerTabsRef = useRef<HTMLDivElement>(null)
  const weights = MODEL_PRICE_COMPARISON_PRESETS[presetId].weights

  const allRows = useMemo(
    () =>
      (catalog?.models ?? []).flatMap((model) =>
        model.accounts.map((offer) => ({ model, offer })),
      ),
    [catalog?.models],
  )
  const hasPricing = useMemo(
    () =>
      allRows.some(({ offer }) =>
        offer.prices?.some((price) => price.precision !== "unavailable"),
      ),
    [allRows],
  )
  const availableGroups = useMemo(
    () =>
      Array.from(
        new Set(
          allRows
            .filter(({ offer }) => !accountId || offer.accountId === accountId)
            .flatMap(({ offer }) =>
              (offer.prices ?? []).flatMap((price) =>
                price.group ? [price.group] : [],
              ),
            ),
        ),
      ).sort(),
    [accountId, allRows],
  )

  const baseFilteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allRows.flatMap(({ model, offer }) => {
      if (accountId && offer.accountId !== accountId) return []
      if (
        query &&
        !`${model.id} ${offer.displayName ?? model.displayName ?? ""} ${offer.vendor ?? model.vendor ?? ""} ${offer.description ?? model.description ?? ""} ${offer.accountName}`
          .toLowerCase()
          .includes(query)
      ) {
        return []
      }

      const hasKnownPrices = (offer.prices?.length ?? 0) > 0
      const matchesBilling =
        billingMode === "all" ||
        !hasKnownPrices ||
        offer.prices?.some((price) => price.billingMode === billingMode)
      if (!matchesBilling) return []

      const matchesGroup =
        !selectedGroup ||
        !hasKnownPrices ||
        offer.prices?.some((price) => price.group === selectedGroup)
      if (!matchesGroup) return []

      const selected = selectBestPrice(
        offer,
        billingMode,
        selectedGroup,
        weights,
        showRealPrice,
      )
      return [
        {
          id: model.id,
          displayName: model.displayName,
          vendor: model.vendor,
          description: model.description,
          offer,
          ...selected,
        } satisfies ModelOfferRow,
      ]
    })
  }, [
    accountId,
    allRows,
    billingMode,
    search,
    selectedGroup,
    showRealPrice,
    weights,
  ])

  const vendorCatalog = useMemo(() => {
    const counts = new Map<string, number>()
    let unclassifiedCount = 0
    for (const row of baseFilteredRows) {
      const rowVendor = row.offer.vendor ?? row.vendor
      if (!rowVendor) {
        unclassifiedCount += 1
        continue
      }
      counts.set(rowVendor, (counts.get(rowVendor) ?? 0) + 1)
    }
    return {
      vendors: Array.from(counts, ([name, count]) => ({ name, count })).sort(
        (left, right) => left.name.localeCompare(right.name),
      ),
      unclassifiedCount,
    }
  }, [baseFilteredRows])
  const effectiveVendor =
    vendor === "__unclassified__" && vendorCatalog.unclassifiedCount > 0
      ? vendor
      : vendorCatalog.vendors.some((item) => item.name === vendor)
        ? vendor
        : ""

  const filteredRows = useMemo(() => {
    const rows = baseFilteredRows.filter((row) => {
      const rowVendor = row.offer.vendor ?? row.vendor
      return (
        !effectiveVendor ||
        (effectiveVendor === "__unclassified__"
          ? !rowVendor
          : rowVendor === effectiveVendor)
      )
    })

    return [...rows].sort((left, right) => {
      if (sortMode === "price-asc" || sortMode === "price-desc") {
        if (left.priceScore === null) return 1
        if (right.priceScore === null) return -1
        const difference = left.priceScore - right.priceScore
        if (difference !== 0) {
          return sortMode === "price-asc" ? difference : -difference
        }
      }
      return (
        left.id.localeCompare(right.id) ||
        left.offer.accountName.localeCompare(right.offer.accountName)
      )
    })
  }, [baseFilteredRows, effectiveVendor, sortMode])

  const comparisonGroups = useMemo(() => {
    if (sortMode !== "model-cheapest-first") return []
    const groups = new Map<
      string,
      {
        key: string
        model: AggregatedModel | undefined
        billingMode: "token" | "per-call"
        rows: ModelOfferRow[]
      }
    >()
    for (const row of filteredRows) {
      const rowBillingMode = row.selectedPrice?.billingMode ?? "token"
      const key = JSON.stringify([row.id.toLowerCase(), rowBillingMode])
      const group = groups.get(key) ?? {
        key,
        model: catalog?.models.find((model) => model.id === row.id),
        billingMode: rowBillingMode,
        rows: [],
      }
      group.rows.push(row)
      groups.set(key, group)
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((left, right) => {
          if (left.priceScore === null) return 1
          if (right.priceScore === null) return -1
          return (
            left.priceScore - right.priceScore ||
            left.offer.accountName.localeCompare(right.offer.accountName)
          )
        }),
      }))
      .sort((left, right) => {
        const leftBest =
          left.rows.find((row) => row.priceScore !== null)?.priceScore ??
          undefined
        const rightBest =
          right.rows.find((row) => row.priceScore !== null)?.priceScore ??
          undefined
        if (leftBest === undefined) return 1
        if (rightBest === undefined) return -1
        return leftBest - rightBest || left.key.localeCompare(right.key)
      })
  }, [catalog?.models, filteredRows, sortMode])

  const priceComparisonActive =
    !accountId &&
    sortMode === "model-cheapest-first" &&
    billingMode === "all" &&
    !selectedGroup &&
    showRealPrice
  const enablePriceComparison = () => {
    setAccountId("")
    setSortMode("model-cheapest-first")
    setBillingMode("all")
    setSelectedGroup("")
    setShowRealPrice(true)
  }

  const headerActions = (
    <>
      {hasPricing && !priceComparisonActive ? (
        <button
          type="button"
          title="清空价格筛选，切换到所有账号，并按同模型最低价优先排序。"
          onClick={enablePriceComparison}
          className="flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <TrendingDown className="size-4" />
          一键比价
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void onRefresh()}
        title="刷新数据"
        className="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
        {busy ? "加载中..." : "刷新数据"}
      </button>
    </>
  )

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="模型列表"
      description="查看和管理可用的AI模型"
      inlineActions={headerActions}
      footer={headerActions}
    >
      <section className="mb-6" aria-labelledby="model-source-heading">
        <h2
          id="model-source-heading"
          className="mb-3 text-base font-semibold text-gray-900 dark:text-white"
        >
          选择数据源
        </h2>
        <select
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          aria-label="选择数据源"
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">所有账号</option>
          {(catalog?.accounts ?? []).map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {account.accountName} · {statusLabels[account.status]}
            </option>
          ))}
        </select>
      </section>

      {!accountId && catalog && catalog.accounts.length > 0 ? (
        <section
          aria-label="账号概览"
          className="mb-6 border-y border-gray-200 py-3 dark:border-gray-700"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              账号概览
            </h2>
            <span className="text-xs text-gray-500">
              成功 {catalog.summary.succeeded} · 失败 {catalog.summary.failed}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {catalog.accounts.map((account) => (
              <button
                key={account.accountId}
                type="button"
                onClick={() => setAccountId(account.accountId)}
                className="flex min-w-36 shrink-0 items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-xs hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-700"
              >
                <span className="min-w-0 truncate font-medium text-gray-700 dark:text-gray-200">
                  {account.accountName}
                </span>
                <span
                  className={
                    account.status === "success"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : account.status === "error"
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-500"
                  }
                >
                  {account.status === "success"
                    ? `${account.models.length} 个`
                    : statusLabels[account.status]}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section
        aria-label="模型筛选"
        className="mb-6 rounded-md border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="grid gap-3 border-b border-gray-100 pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.42fr)_auto] sm:items-end dark:border-gray-800">
          <label className="block min-w-0 text-sm font-medium text-gray-700 dark:text-gray-200">
            搜索模型
            <span className="relative mt-2 block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="输入模型名称或描述..."
                className="h-9 w-full rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
              />
            </span>
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            排序方式
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              aria-label="排序方式"
              className="mt-2 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="default">默认顺序</option>
              {hasPricing ? (
                <>
                  <option value="price-asc">价格从低到高</option>
                  <option value="price-desc">价格从高到低</option>
                  <option value="model-cheapest-first">同模型最低价优先</option>
                </>
              ) : null}
            </select>
          </label>
          <div className="flex h-9 items-center justify-end gap-3 text-xs text-gray-600 dark:text-gray-300">
            <span className="flex items-center gap-1.5">
              <Cpu className="size-4" />
              总计 {allRows.length} 个模型
            </span>
            <span className="h-3 w-px bg-gray-300 dark:bg-gray-700" />
            <span className="font-medium text-blue-600 dark:text-blue-400">
              显示 {filteredRows.length} 个模型
            </span>
          </div>
        </div>

        <div className="border-b border-gray-100 py-4 dark:border-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            筛选条件
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              计费方式
              <select
                value={billingMode}
                onChange={(event) =>
                  setBillingMode(event.target.value as BillingMode)
                }
                aria-label="计费方式"
                className="mt-2 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
              >
                <option value="all">所有计费方式</option>
                <option value="token">按量计费</option>
                <option value="per-call">按次计费</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              用户分组
              <select
                value={selectedGroup}
                onChange={(event) => setSelectedGroup(event.target.value)}
                aria-label="用户分组"
                className="mt-2 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
              >
                <option value="">所有分组</option>
                {availableGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>
            {sortMode !== "default" ? (
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                使用场景
                <select
                  value={presetId}
                  onChange={(event) =>
                    setPresetId(event.target.value as PriceComparisonPresetId)
                  }
                  aria-label="价格比较使用场景"
                  className="mt-2 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-gray-700 dark:bg-gray-950"
                >
                  {presetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {sortMode !== "default" ? (
            <div className="mt-4 rounded-md bg-gray-50 p-3 dark:bg-gray-950/60">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-gray-500" />
                <div>
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    价格比较条件
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                    当前按“
                    {
                      presetOptions.find((item) => item.value === presetId)
                        ?.label
                    }
                    ”用量占比计算。同一模型会优先展示当前条件下价格最低的账号和分组，实际费用以站点账单为准。
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <fieldset className="flex flex-wrap items-center gap-4 text-sm">
            <legend className="sr-only">显示选项</legend>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={showRealPrice}
                onChange={(event) => setShowRealPrice(event.target.checked)}
                className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              真实充值金额
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={showEndpointTypes}
                onChange={(event) => setShowEndpointTypes(event.target.checked)}
                className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              端点类型
            </label>
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard?.writeText(
                  Array.from(new Set(filteredRows.map((row) => row.id))).join(
                    "\n",
                  ),
                )
              }
              className="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <Copy className="size-4" />
              复制所有模型名称
            </button>
            {hasPricing && !priceComparisonActive ? (
              <button
                type="button"
                onClick={enablePriceComparison}
                className="flex h-8 items-center gap-2 rounded-md border border-gray-300 px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <TrendingDown className="size-4" />
                一键比价
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mb-6 flex items-center gap-2">
        <button
          type="button"
          title="向左滚动厂商标签"
          aria-label="向左滚动厂商标签"
          onClick={() =>
            providerTabsRef.current?.scrollBy({
              left: -240,
              behavior: "smooth",
            })
          }
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div
          ref={providerTabsRef}
          role="tablist"
          aria-label="模型厂商"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-md bg-gray-100 p-1 dark:bg-gray-800"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!effectiveVendor}
            onClick={() => setVendor("")}
            className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${!effectiveVendor ? "bg-white text-blue-700 shadow-sm dark:bg-gray-900 dark:text-blue-400" : "text-gray-600 hover:bg-white/70 dark:text-gray-300 dark:hover:bg-gray-900/70"}`}
          >
            <LayoutGrid className="size-4" />
            所有厂商 ({baseFilteredRows.length})
          </button>
          {vendorCatalog.vendors.map((item) => (
            <button
              key={item.name}
              type="button"
              role="tab"
              aria-selected={effectiveVendor === item.name}
              onClick={() => setVendor(item.name)}
              className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors ${effectiveVendor === item.name ? "bg-white text-blue-700 shadow-sm dark:bg-gray-900 dark:text-blue-400" : "text-gray-600 hover:bg-white/70 dark:text-gray-300 dark:hover:bg-gray-900/70"}`}
            >
              {item.name} ({item.count})
            </button>
          ))}
          {vendorCatalog.unclassifiedCount > 0 ? (
            <button
              type="button"
              role="tab"
              aria-selected={effectiveVendor === "__unclassified__"}
              onClick={() => setVendor("__unclassified__")}
              className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors ${effectiveVendor === "__unclassified__" ? "bg-white text-blue-700 shadow-sm dark:bg-gray-900 dark:text-blue-400" : "text-gray-600 hover:bg-white/70 dark:text-gray-300 dark:hover:bg-gray-900/70"}`}
            >
              未分类 ({vendorCatalog.unclassifiedCount})
            </button>
          ) : null}
        </div>
        <button
          type="button"
          title="向右滚动厂商标签"
          aria-label="向右滚动厂商标签"
          onClick={() =>
            providerTabsRef.current?.scrollBy({
              left: 240,
              behavior: "smooth",
            })
          }
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {catalog?.accounts.some((account) => account.status === "error") ? (
        <div className="mb-4 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {catalog.accounts
            .filter((account) => account.status === "error")
            .map((account) => (
              <div key={account.accountId}>
                {account.accountName}: {account.error || "模型目录加载失败"}
              </div>
            ))}
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <div className="py-12 text-center">
          <Cpu className="mx-auto size-12 text-gray-300 dark:text-gray-700" />
          <p className="mt-3 text-sm text-gray-500">暂无匹配模型</p>
        </div>
      ) : sortMode === "model-cheapest-first" ? (
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {comparisonGroups.map((group) => {
            const comparableRows = group.rows.filter(
              (row) => row.priceScore !== null,
            )
            const notComparedRows = group.rows.filter(
              (row) => row.priceScore === null,
            )
            const lowestScore = comparableRows[0]?.priceScore
            return (
              <section
                key={group.key}
                className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2.5 sm:px-4 dark:border-gray-700 dark:bg-gray-950/50">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="min-w-0 font-mono text-sm font-semibold break-all text-gray-900 dark:text-white">
                      {group.model?.displayName ?? group.rows[0]?.id}
                    </h2>
                    <span className="rounded-md bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {group.billingMode === "token" ? "按量计费" : "按次计费"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                      可比较报价:{" "}
                      <strong className="text-emerald-700 dark:text-emerald-400">
                        {comparableRows.length}
                      </strong>
                    </span>
                    {notComparedRows.length > 0 ? (
                      <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                        未参与当前条件比较: {notComparedRows.length}
                      </span>
                    ) : null}
                  </div>
                </header>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {comparableRows.map((row) => (
                    <ModelOfferCard
                      key={`${row.offer.accountId}:${row.id}`}
                      row={row}
                      showRealPrice={showRealPrice}
                      showEndpointTypes={showEndpointTypes}
                      isLowestPrice={row.priceScore === lowestScore}
                      comparisonOffer
                    />
                  ))}
                  {notComparedRows.length > 0 ? (
                    <div className="bg-gray-50/70 dark:bg-gray-950/30">
                      <div className="flex gap-2 border-b border-dashed border-gray-300 px-3 py-2.5 text-xs text-gray-500 sm:px-4 dark:border-gray-700 dark:text-gray-400">
                        <Info className="mt-0.5 size-4 shrink-0" />
                        <span>
                          当前比较条件使用了价格来源未提供的价格项，因此以下报价未参与比较。
                        </span>
                      </div>
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {notComparedRows.map((row) => (
                          <ModelOfferCard
                            key={`${row.offer.accountId}:${row.id}`}
                            row={row}
                            showRealPrice={showRealPrice}
                            showEndpointTypes={showEndpointTypes}
                            comparisonOffer
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
          {filteredRows.map((row) => (
            <ModelOfferCard
              key={`${row.offer.accountId}:${row.id}`}
              row={row}
              showRealPrice={showRealPrice}
              showEndpointTypes={showEndpointTypes}
            />
          ))}
        </div>
      )}

      {hasPricing ? (
        <p className="mt-6 border-t border-gray-200 pt-4 text-xs leading-5 text-gray-500 dark:border-gray-700 dark:text-gray-400">
          模型价格来自各站点提供的接口。按量计费显示每 1M tokens
          的费用，真实费用及可用范围请以站点账单和实际调用结果为准。
        </p>
      ) : null}
    </WebDialog>
  )
}

import {
  Braces,
  Brain,
  ChevronDown,
  Copy,
  Eye,
  FileText,
  Image,
  Info,
  KeyRound,
  Paperclip,
  Server,
  Tag,
  Video,
  Volume2,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import type { WebModelCatalogPrice } from "~/web/contracts"

import { CatalogVendorMark } from "./CatalogVendorMark"
import { formatMoney, toDisplayAmount } from "./pricing"
import type { ModelCapabilityKey, ModelOfferRow } from "./types"

const capabilityPresentation: Record<
  ModelCapabilityKey,
  { label: string; group: "输入" | "输出" | "能力"; Icon: LucideIcon }
> = {
  "image-input": { label: "图片理解", group: "输入", Icon: Eye },
  "image-output": { label: "图片生成", group: "输出", Icon: Image },
  "audio-input": { label: "音频输入", group: "输入", Icon: Volume2 },
  "audio-output": { label: "音频输出", group: "输出", Icon: Volume2 },
  "video-input": { label: "视频输入", group: "输入", Icon: Video },
  "video-output": { label: "视频输出", group: "输出", Icon: Video },
  pdf: { label: "PDF", group: "输入", Icon: FileText },
  reasoning: { label: "思考", group: "能力", Icon: Brain },
  "tool-call": { label: "工具调用", group: "能力", Icon: Wrench },
  "structured-output": {
    label: "结构化输出",
    group: "能力",
    Icon: Braces,
  },
  attachment: { label: "附件", group: "能力", Icon: Paperclip },
}

const copyText = async (value: string) => {
  await navigator.clipboard?.writeText(value)
}

function IconAction({
  title,
  children,
  disabled,
  onClick,
}: {
  title: string
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-white"
    >
      {children}
    </button>
  )
}

function PriceSummary({
  price,
  row,
  showRealPrice,
  isLowestPrice,
  showsOptimalGroup,
}: {
  price: WebModelCatalogPrice | null
  row: ModelOfferRow
  showRealPrice: boolean
  isLowestPrice?: boolean
  showsOptimalGroup?: boolean
}) {
  if (!price || price.precision === "unavailable") {
    const reason = price?.unavailableReason
    const reasonText =
      reason === "group-ratio-unavailable"
        ? "价格不可用，因为当前可用分组没有分组倍率。"
        : reason === "official-price-missing"
          ? "此模型不在价格表中。"
          : reason === "model-list-only"
            ? "此来源可使用该模型，但价格不可用。"
            : "此来源的价格数据不可用。"
    return (
      <span className="block max-w-full text-xs leading-snug font-medium text-gray-600 sm:text-sm dark:text-gray-300">
        {reasonText}
      </span>
    )
  }

  const currency = showRealPrice ? "CNY" : "USD"
  const badges = (
    <div className="flex flex-wrap items-center gap-1.5">
      {showsOptimalGroup && price.group ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${
            isLowestPrice
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
          }`}
        >
          最优组: {price.group}
          {Number.isFinite(price.groupRatio) ? ` (${price.groupRatio}x)` : ""}
        </span>
      ) : isLowestPrice ? (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:text-xs dark:bg-emerald-900/40 dark:text-emerald-200">
          最低价
        </span>
      ) : null}
      {price.precision === "estimated" ? (
        <span
          title="基于官方价格表和当前分组倍率估算。"
          className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 sm:text-xs dark:bg-amber-900/40 dark:text-amber-200"
        >
          估算价
        </span>
      ) : null}
    </div>
  )

  if (price.billingMode === "per-call") {
    if (typeof price.usdPerCall === "number") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-600 sm:text-sm dark:text-gray-300">
            每次调用:
          </span>
          <strong className="text-xs font-medium text-purple-600 sm:text-sm dark:text-purple-400">
            {formatMoney(
              toDisplayAmount(price.usdPerCall, row.offer, showRealPrice),
              currency,
            )}
          </strong>
          {badges}
        </div>
      )
    }
    if (price.usdPerCall) {
      return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs sm:text-sm">
          <span className="text-gray-600 dark:text-gray-300">
            输入:{" "}
            <strong className="font-medium text-blue-600 dark:text-blue-400">
              {formatMoney(
                toDisplayAmount(
                  price.usdPerCall.input,
                  row.offer,
                  showRealPrice,
                ),
                currency,
              )}
            </strong>
          </span>
          <span className="text-gray-600 dark:text-gray-300">
            输出:{" "}
            <strong className="font-medium text-emerald-600 dark:text-emerald-400">
              {formatMoney(
                toDisplayAmount(
                  price.usdPerCall.output,
                  row.offer,
                  showRealPrice,
                ),
                currency,
              )}
            </strong>
          </span>
          {badges}
        </div>
      )
    }
  }

  const prices = [
    {
      label: "输入:",
      amount: price.inputUsdPerMillionTokens,
      className: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "输出:",
      amount: price.outputUsdPerMillionTokens,
      className: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "缓存读取:",
      amount: price.cacheReadUsdPerMillionTokens,
      className: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "缓存写入:",
      amount: price.cacheWriteUsdPerMillionTokens,
      className: "text-violet-600 dark:text-violet-400",
    },
  ].filter((item) => item.amount !== undefined)

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs sm:text-sm">
      {prices.map((item) => (
        <span key={item.label} className="text-gray-600 dark:text-gray-300">
          {item.label}{" "}
          <strong className={`font-medium ${item.className}`}>
            {formatMoney(
              toDisplayAmount(item.amount ?? 0, row.offer, showRealPrice),
              currency,
            )}
            /M
          </strong>
        </span>
      ))}
      {badges}
    </div>
  )
}

function CapabilityBadges({
  capabilities,
}: {
  capabilities: ModelCapabilityKey[]
}) {
  if (capabilities.length === 0) return null
  const groups = ["输入", "输出", "能力"] as const
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 sm:justify-end">
      {groups.map((group) => {
        const groupCapabilities = capabilities.filter(
          (capability) => capabilityPresentation[capability].group === group,
        )
        if (groupCapabilities.length === 0) return null
        return (
          <div
            key={group}
            className="flex min-w-0 flex-wrap items-center gap-1.5"
          >
            <span className="shrink-0 text-[10px] font-medium text-gray-500 sm:text-xs dark:text-gray-400">
              {group}:
            </span>
            {groupCapabilities.map((capability) => {
              const { label, Icon } = capabilityPresentation[capability]
              return (
                <span
                  key={capability}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 sm:text-xs dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200"
                >
                  <Icon className="size-3" />
                  {label}
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

interface ModelItemProps {
  row: ModelOfferRow
  showRealPrice: boolean
  showEndpointTypes: boolean
  isLowestPrice?: boolean
  showsOptimalGroup?: boolean
  comparisonOffer?: boolean
  verificationBusy?: boolean
  onFilterAccount?: (accountId: string) => void
  onOpenAccountKeys?: (accountId: string) => void
  onVerify?: (row: ModelOfferRow) => void
}

function ModelItem({
  row,
  showRealPrice,
  showEndpointTypes,
  isLowestPrice = false,
  showsOptimalGroup = false,
  comparisonOffer = false,
  verificationBusy = false,
  onFilterAccount,
  onOpenAccountKeys,
  onVerify,
}: ModelItemProps) {
  const [expanded, setExpanded] = useState(false)
  const displayName = row.offer.displayName ?? row.displayName ?? row.id
  const requestModelIdVisible = displayName.trim() !== row.id
  const vendor = row.offer.vendor ?? row.vendor
  const description = row.offer.description ?? row.description
  const groups = Array.from(
    new Set([
      ...(row.offer.enableGroups ?? []),
      ...(row.offer.prices ?? []).flatMap((price) =>
        price.group ? [price.group] : [],
      ),
    ]),
  )
  const endpointTypes = row.offer.supportedEndpointTypes ?? []
  const hasDetails =
    groups.length > 0 ||
    (showEndpointTypes && endpointTypes.length > 0) ||
    !!row.selectedPrice
  const groupSummary = groups.length
    ? `${groups[0]}${groups.length > 1 ? ` +${groups.length - 1}` : ""}`
    : null
  const sourceTitle =
    row.offer.sourceKind === "profile"
      ? `凭据：${row.offer.accountName}`
      : row.offer.accountName

  return (
    <article
      className={
        comparisonOffer
          ? "border-0 bg-transparent transition-colors hover:bg-gray-50/80 dark:hover:bg-white/[0.025]"
          : "rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-500/50"
      }
    >
      <div className="p-4">
        <div className="flex min-w-0 flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-[1_1_10rem] items-center gap-2 sm:gap-3">
                <CatalogVendorMark vendor={vendor ?? row.id} variant="badge" />
                <div className="min-w-0 flex-1">
                  <h3 className="min-w-0 truncate text-sm font-semibold text-gray-900 sm:text-base md:text-lg dark:text-white">
                    {displayName}
                  </h3>
                  {requestModelIdVisible ? (
                    <p
                      title={row.id}
                      className="mt-0.5 truncate font-mono text-[11px] text-gray-500 sm:text-xs dark:text-gray-400"
                    >
                      {row.id}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="ml-8 flex shrink-0 items-center gap-1 sm:ml-0">
                <IconAction
                  title="复制模型名称"
                  onClick={() => void copyText(row.id)}
                >
                  <Copy className="size-3.5" />
                </IconAction>
                {row.offer.sourceKind === "account" && onOpenAccountKeys ? (
                  <IconAction
                    title="模型对应密钥"
                    onClick={() => onOpenAccountKeys(row.offer.accountId)}
                  >
                    <KeyRound className="size-3.5 text-violet-600 dark:text-violet-400" />
                  </IconAction>
                ) : null}
                {onVerify ? (
                  <IconAction
                    title="验证接口"
                    disabled={verificationBusy}
                    onClick={() => onVerify(row)}
                  >
                    <Wrench
                      className={`size-3.5 text-emerald-600 dark:text-emerald-400 ${verificationBusy ? "animate-pulse" : ""}`}
                    />
                  </IconAction>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 sm:text-xs dark:bg-blue-900/40 dark:text-blue-200">
                  {row.selectedPrice?.billingMode === "per-call"
                    ? "按次计费"
                    : "按量计费"}
                </span>
                {groupSummary ? (
                  <span
                    title={`当前账号可用分组: ${groups.join(", ")}`}
                    className="max-w-36 truncate rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 sm:text-xs dark:bg-gray-800 dark:text-gray-200"
                  >
                    {groupSummary}
                  </span>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-1 sm:ml-auto">
                {onFilterAccount && row.offer.sourceKind === "account" ? (
                  <button
                    type="button"
                    title={sourceTitle}
                    onClick={() => onFilterAccount(row.offer.accountId)}
                    className="inline-flex h-7 max-w-48 min-w-0 items-center rounded-full border border-gray-300 px-2.5 text-xs font-semibold text-gray-700 hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                  >
                    <span className="truncate">{sourceTitle}</span>
                  </button>
                ) : (
                  <span
                    title={sourceTitle}
                    className="inline-flex h-7 max-w-48 min-w-0 items-center rounded-full border border-gray-300 px-2.5 text-xs font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200"
                  >
                    <span className="truncate">{sourceTitle}</span>
                  </span>
                )}
                {row.offer.sourceUrl ? (
                  <>
                    <IconAction
                      title="复制站点 URL"
                      onClick={() => void copyText(row.offer.sourceUrl ?? "")}
                    >
                      <Copy className="size-3.5" />
                    </IconAction>
                    <IconAction
                      title="打开站点"
                      onClick={() =>
                        window.open(
                          row.offer.sourceUrl,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      <Workflow className="size-3.5" />
                    </IconAction>
                  </>
                ) : null}
                {hasDetails ? (
                  <IconAction
                    title={expanded ? "收起详细信息" : "展开详细信息"}
                    onClick={() => setExpanded((current) => !current)}
                  >
                    <ChevronDown
                      className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                  </IconAction>
                ) : null}
              </div>
            </div>

            {row.verification ? (
              <div className="ml-8 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] sm:text-xs">
                <span
                  className={
                    row.verification.status === "pass"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {row.verification.status === "pass"
                    ? "最近测试成功"
                    : "最近测试失败"}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {row.verification.latencyMs} ms · {row.verification.summary}
                </span>
              </div>
            ) : onVerify ? (
              <div className="ml-8 text-[11px] text-gray-500 sm:text-xs dark:text-gray-400">
                未测试
              </div>
            ) : null}
          </div>
        </div>

        {description ? (
          <p
            title={description}
            className="mt-2 line-clamp-2 overflow-hidden text-sm leading-relaxed text-gray-600 dark:text-gray-300"
          >
            {description}
          </p>
        ) : null}

        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <PriceSummary
              price={row.selectedPrice}
              row={row}
              showRealPrice={showRealPrice}
              isLowestPrice={isLowestPrice}
              showsOptimalGroup={showsOptimalGroup}
            />
          </div>
          <div className="mt-1 sm:ml-auto sm:max-w-[48%]">
            <CapabilityBadges capabilities={row.capabilities} />
          </div>
        </div>

        {expanded ? (
          <div className="mt-4 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              {groups.length > 0 ? (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Tag className="size-4 text-gray-400" />
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      当前账号可用分组
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {groups.map((group) => {
                      const price = row.offer.prices?.find(
                        (item) => item.group === group,
                      )
                      return (
                        <span
                          key={group}
                          title={
                            price
                              ? `${group} 分组倍率: ${price.groupRatio}x`
                              : "分组倍率不可用"
                          }
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            group === row.selectedPrice?.group
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {group}
                          {price ? ` (${price.groupRatio}x)` : ""}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {showEndpointTypes ? (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Server className="size-4 text-gray-400" />
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      端点类型
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-gray-600 dark:text-gray-300">
                    {endpointTypes.length > 0
                      ? endpointTypes.map((endpoint) => (
                          <code
                            key={endpoint}
                            className="rounded-md bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800"
                          >
                            {endpoint}
                          </code>
                        ))
                      : "未提供端点类型"}
                  </div>
                </div>
              ) : null}
              {row.selectedPrice &&
              row.selectedPrice.precision !== "unavailable" ? (
                <div className="md:col-span-2">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex size-4 items-center justify-center text-gray-400">
                      $
                    </span>
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      详细定价
                    </span>
                  </div>
                  <DetailedPricing price={row.selectedPrice} row={row} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function DetailedPricing({
  price,
  row,
}: {
  price: WebModelCatalogPrice
  row: ModelOfferRow
}) {
  const details =
    price.billingMode === "token"
      ? [
          ["输入(1M tokens)", price.inputUsdPerMillionTokens],
          ["输出(1M tokens)", price.outputUsdPerMillionTokens],
          ["缓存读取(1M tokens)", price.cacheReadUsdPerMillionTokens],
          ["缓存写入(1M tokens)", price.cacheWriteUsdPerMillionTokens],
        ]
      : typeof price.usdPerCall === "number"
        ? [["每次调用", price.usdPerCall]]
        : [
            ["每次调用输入", price.usdPerCall?.input],
            ["每次调用输出", price.usdPerCall?.output],
          ]
  return (
    <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
      {details
        .filter((detail): detail is [string, number] => detail[1] !== undefined)
        .map(([label, amount]) => (
          <div key={label} className="space-y-1">
            <div className="text-gray-500 dark:text-gray-400">{label}</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              USD: {formatMoney(amount, "USD")}
            </div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              CNY:{" "}
              {formatMoney(toDisplayAmount(amount, row.offer, true), "CNY")}
            </div>
          </div>
        ))}
    </div>
  )
}

interface ModelDisplayProps {
  rows: ModelOfferRow[]
  showRealPrice: boolean
  showEndpointTypes: boolean
  showPriceComparisonGroups: boolean
  verifyingKeys: string[]
  onFilterAccount?: (accountId: string) => void
  onOpenAccountKeys?: (accountId: string) => void
  onVerify?: (row: ModelOfferRow) => void
}

export function ModelDisplay({
  rows,
  showRealPrice,
  showEndpointTypes,
  showPriceComparisonGroups,
  verifyingKeys,
  onFilterAccount,
  onOpenAccountKeys,
  onVerify,
}: ModelDisplayProps) {
  const comparisonGroups = useMemo(() => {
    if (!showPriceComparisonGroups) return []
    const groups = new Map<
      string,
      {
        key: string
        modelName: string
        billingMode: "token" | "per-call"
        comparable: ModelOfferRow[]
        notCompared: ModelOfferRow[]
      }
    >()
    for (const row of rows) {
      const billingMode = row.selectedPrice?.billingMode ?? "token"
      const key = JSON.stringify([row.id.toLowerCase(), billingMode])
      const group = groups.get(key) ?? {
        key,
        modelName: row.id,
        billingMode,
        comparable: [],
        notCompared: [],
      }
      if (row.priceScore === null) group.notCompared.push(row)
      else group.comparable.push(row)
      groups.set(key, group)
    }
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        comparable: [...group.comparable].sort(
          (left, right) =>
            (left.priceScore ?? Number.POSITIVE_INFINITY) -
              (right.priceScore ?? Number.POSITIVE_INFINITY) ||
            left.offer.accountName.localeCompare(right.offer.accountName),
        ),
      }))
      .sort((left, right) => {
        const leftBest = left.comparable[0]?.priceScore
        const rightBest = right.comparable[0]?.priceScore
        if (leftBest === null || leftBest === undefined) return 1
        if (rightBest === null || rightBest === undefined) return -1
        return leftBest - rightBest || left.key.localeCompare(right.key)
      })
  }, [rows, showPriceComparisonGroups])

  if (rows.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
        <Info className="size-10 text-gray-300 dark:text-gray-600" />
        <h3 className="mt-3 text-sm font-semibold">没有找到匹配的模型</h3>
      </div>
    )
  }

  const renderItem = (
    row: ModelOfferRow,
    comparisonOffer = false,
    lowest = false,
  ) => (
    <ModelItem
      key={row.key}
      row={row}
      showRealPrice={showRealPrice}
      showEndpointTypes={showEndpointTypes}
      comparisonOffer={comparisonOffer}
      isLowestPrice={lowest}
      showsOptimalGroup={showPriceComparisonGroups}
      verificationBusy={verifyingKeys.includes(row.key)}
      onFilterAccount={onFilterAccount}
      onOpenAccountKeys={onOpenAccountKeys}
      onVerify={onVerify}
    />
  )

  if (!showPriceComparisonGroups) {
    return (
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        <div className="space-y-3">{rows.map((row) => renderItem(row))}</div>
      </div>
    )
  }

  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
      {comparisonGroups.map((group) => (
        <section
          key={group.key}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-200 bg-gray-50/80 px-3 py-2.5 sm:px-4 dark:border-gray-700 dark:bg-gray-950/45">
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:flex-1">
              <h2 className="max-w-full min-w-0 font-mono text-sm font-semibold break-all">
                {group.modelName}
              </h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 sm:text-xs dark:bg-gray-800 dark:text-gray-200">
                {group.billingMode === "per-call" ? "按次计费" : "按量计费"}
              </span>
            </div>
            <div className="flex w-full flex-wrap items-center gap-1.5 text-xs lg:w-auto lg:shrink-0 lg:justify-end">
              <span className="rounded-full border border-gray-200 bg-white/80 px-2.5 py-1 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                可比较报价:{" "}
                <strong className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {group.comparable.length}
                </strong>
              </span>
              {group.notCompared.length > 0 ? (
                <span className="rounded-full border border-gray-200 bg-white/80 px-2.5 py-1 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  未参与当前条件比较:{" "}
                  <strong className="font-semibold">
                    {group.notCompared.length}
                  </strong>
                </span>
              ) : null}
            </div>
          </header>

          {group.comparable.length > 0 ? (
            <div className="divide-y divide-gray-200/80 dark:divide-gray-700">
              {group.comparable.map((row, index) =>
                renderItem(row, true, index === 0),
              )}
            </div>
          ) : null}

          {group.notCompared.length > 0 ? (
            <div
              className={`${group.comparable.length > 0 ? "border-t border-dashed border-gray-300 dark:border-gray-700" : ""} bg-gray-50/55 dark:bg-white/[0.018]`}
            >
              <div className="flex min-w-0 gap-2 border-b border-gray-200/80 px-3 py-2.5 sm:px-4 dark:border-gray-700">
                <Info className="mt-0.5 size-4 shrink-0 text-gray-500" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">未参与当前条件比较</p>
                  <p className="mt-0.5 text-xs leading-5 text-gray-600 dark:text-gray-400">
                    当前比较条件使用了价格来源未提供的价格项，因此此报价未参与比较。
                  </p>
                </div>
              </div>
              <div className="divide-y divide-gray-200/80 dark:divide-gray-700">
                {group.notCompared.map((row) => renderItem(row, true))}
              </div>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  )
}

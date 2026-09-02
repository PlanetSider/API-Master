import {
  calculateWeightedTokenPrice,
  type ModelPriceComparisonWeights,
} from "~/features/ModelList/priceComparison"
import type {
  WebModelCatalogPrice as ModelPrice,
  WebModelCatalogPrice,
} from "~/web/contracts"

import type { ModelCatalogBillingMode, ModelCatalogOffer } from "./types"

export const formatMoney = (value: number, currency: "USD" | "CNY") => {
  const symbol = currency === "USD" ? "$" : "¥"
  if (value === 0) return `${symbol}0`
  if (value < 0.0001) return `${symbol}${value.toExponential(2)}`
  if (value < 0.01) return `${symbol}${value.toFixed(6)}`
  if (value < 1) return `${symbol}${value.toFixed(4)}`
  return `${symbol}${value.toFixed(2)}`
}

export const getExchangeRate = (offer: ModelCatalogOffer) =>
  typeof offer.exchangeRate === "number" &&
  Number.isFinite(offer.exchangeRate) &&
  offer.exchangeRate > 0
    ? offer.exchangeRate
    : 1

export const toDisplayAmount = (
  value: number,
  offer: ModelCatalogOffer,
  showRealPrice: boolean,
) => (showRealPrice ? value * getExchangeRate(offer) : value)

export const getPriceScore = (
  price: ModelPrice,
  weights: ModelPriceComparisonWeights,
  offer: ModelCatalogOffer,
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

export const selectBestPrice = ({
  offer,
  billingMode,
  selectedGroups,
  excludedGroups,
  weights,
  showRealPrice,
}: {
  offer: ModelCatalogOffer
  billingMode: ModelCatalogBillingMode
  selectedGroups: string[]
  excludedGroups?: string[]
  weights: ModelPriceComparisonWeights
  showRealPrice: boolean
}) => {
  const excludedGroupSet = new Set(excludedGroups ?? [])
  const selectedGroupSet = new Set(selectedGroups)
  const candidates = (offer.prices ?? []).filter(
    (price) =>
      (billingMode === "all" || price.billingMode === billingMode) &&
      (selectedGroupSet.size === 0 ||
        (!!price.group && selectedGroupSet.has(price.group))) &&
      (!price.group || !excludedGroupSet.has(price.group)),
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

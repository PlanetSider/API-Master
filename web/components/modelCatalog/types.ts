import type {
  WebAllModelCatalogOffer,
  WebModelCatalogPrice,
} from "~/web/contracts"

export type ModelCatalogSortMode =
  | "default"
  | "price-asc"
  | "price-desc"
  | "verification-latency-asc"
  | "model-cheapest-first"

export type ModelCatalogBillingMode = "all" | "token" | "per-call"
export type ModelVerificationFilter = "pass" | "fail" | "unverified"

export type ModelCapabilityKey =
  | "image-input"
  | "image-output"
  | "audio-input"
  | "audio-output"
  | "video-input"
  | "video-output"
  | "pdf"
  | "reasoning"
  | "tool-call"
  | "structured-output"
  | "attachment"

export interface ModelCatalogOffer
  extends Omit<WebAllModelCatalogOffer, "siteType"> {
  sourceKind: "account" | "profile"
  siteType?: WebAllModelCatalogOffer["siteType"]
  profileId?: string
}

export interface ModelOfferRow {
  key: string
  id: string
  displayName?: string
  vendor?: string
  description?: string
  capabilities: ModelCapabilityKey[]
  offer: ModelCatalogOffer
  selectedPrice: WebModelCatalogPrice | null
  priceScore: number | null
  verification?: {
    status: "pass" | "fail"
    latencyMs: number
    summary: string
  }
}

export interface ProviderCatalogEntry {
  key: string
  label: string
  count: number
}

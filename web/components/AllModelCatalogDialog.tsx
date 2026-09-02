import {
  Cpu,
  Info,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  TrendingDown,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button, IconButton } from "~/components/ui"
import {
  DEFAULT_MODEL_PRICE_COMPARISON_PRESET_ID,
  DEFAULT_MODEL_PRICE_COMPARISON_WEIGHTS,
  MODEL_PRICE_COMPARISON_PRESET_IDS,
  MODEL_PRICE_COMPARISON_PRESETS,
  type ModelPriceComparisonPresetId,
  type ModelPriceComparisonWeights,
} from "~/features/ModelList/priceComparison"
import type {
  WebAllModelCatalogResponse,
  WebApiCredentialProfileModelCatalogResponse,
  WebApiCredentialProfileSummary,
  WebApiCredentialProfileVerificationResponse,
} from "~/web/contracts"

import { ModelControlPanel } from "./modelCatalog/ModelControlPanel"
import { ModelDisplay } from "./modelCatalog/ModelDisplay"
import {
  ALL_ACCOUNTS_SOURCE_VALUE,
  ModelSourceSection,
  toAccountSourceValue,
  toProfileSourceValue,
} from "./modelCatalog/ModelSourceSection"
import { selectBestPrice } from "./modelCatalog/pricing"
import { ProviderTabs } from "./modelCatalog/ProviderTabs"
import type {
  ModelCapabilityKey,
  ModelCatalogBillingMode,
  ModelCatalogOffer,
  ModelCatalogSortMode,
  ModelOfferRow,
  ModelVerificationFilter,
} from "./modelCatalog/types"
import { WebDialog } from "./WebDialog"

interface AllModelCatalogDialogProps {
  open: boolean
  busy: boolean
  catalog: WebAllModelCatalogResponse | null
  profiles?: WebApiCredentialProfileSummary[]
  onClose: () => void
  onRefresh: () => Promise<void>
  onLoadProfileModels?: (
    profile: WebApiCredentialProfileSummary,
  ) => Promise<WebApiCredentialProfileModelCatalogResponse>
  onVerifyProfile?: (
    profile: WebApiCredentialProfileSummary,
    modelId?: string,
  ) => Promise<WebApiCredentialProfileVerificationResponse>
  onOpenAccountKeys?: (accountId: string) => void
}

interface ProfileCatalogState {
  profileId: string
  status: "loading" | "success" | "error"
  catalog?: WebApiCredentialProfileModelCatalogResponse
  error?: string
}

const getCapabilities = (offer: ModelCatalogOffer): ModelCapabilityKey[] => {
  const metadata = offer.metadata
  if (!metadata) return []
  const capabilities: ModelCapabilityKey[] = []
  const inputModalities = new Set(metadata.modalities?.input ?? [])
  const outputModalities = new Set(metadata.modalities?.output ?? [])
  if (inputModalities.has("image")) capabilities.push("image-input")
  if (outputModalities.has("image")) capabilities.push("image-output")
  if (inputModalities.has("audio")) capabilities.push("audio-input")
  if (outputModalities.has("audio")) capabilities.push("audio-output")
  if (inputModalities.has("video")) capabilities.push("video-input")
  if (outputModalities.has("video")) capabilities.push("video-output")
  if (inputModalities.has("pdf")) capabilities.push("pdf")
  if (metadata.capabilities?.reasoning) capabilities.push("reasoning")
  if (metadata.capabilities?.toolCall) capabilities.push("tool-call")
  if (metadata.capabilities?.structuredOutput) {
    capabilities.push("structured-output")
  }
  if (metadata.capabilities?.attachment) capabilities.push("attachment")
  return capabilities
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "加载失败，请稍后重试。"

export function AllModelCatalogDialog({
  open,
  busy,
  catalog,
  profiles = [],
  onClose,
  onRefresh,
  onLoadProfileModels,
  onVerifyProfile,
  onOpenAccountKeys,
}: AllModelCatalogDialogProps) {
  const [selectedSourceValue, setSelectedSourceValue] = useState("")
  const [activeAccountIds, setActiveAccountIds] = useState<string[]>([])
  const [excludedGroupsByAccountId, setExcludedGroupsByAccountId] = useState<
    Record<string, string[]>
  >({})
  const [profileCatalogState, setProfileCatalogState] =
    useState<ProfileCatalogState | null>(null)
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<ModelCatalogSortMode>("default")
  const [billingMode, setBillingMode] = useState<ModelCatalogBillingMode>("all")
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [selectedCapabilities, setSelectedCapabilities] = useState<
    ModelCapabilityKey[]
  >([])
  const [selectedVerificationResults, setSelectedVerificationResults] =
    useState<ModelVerificationFilter[]>(["pass", "fail", "unverified"])
  const [showRealPrice, setShowRealPrice] = useState(false)
  const [showEndpointTypes, setShowEndpointTypes] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState("")
  const [presetId, setPresetId] = useState<ModelPriceComparisonPresetId>(
    DEFAULT_MODEL_PRICE_COMPARISON_PRESET_ID,
  )
  const [weights, setWeights] = useState<ModelPriceComparisonWeights>({
    ...DEFAULT_MODEL_PRICE_COMPARISON_WEIGHTS,
  })
  const [verifications, setVerifications] = useState<
    Record<
      string,
      { status: "pass" | "fail"; latencyMs: number; summary: string }
    >
  >({})
  const [verifyingKeys, setVerifyingKeys] = useState<string[]>([])

  useEffect(() => {
    if (!catalog && profiles.length === 0) return
    const sourceStillExists =
      selectedSourceValue === ALL_ACCOUNTS_SOURCE_VALUE
        ? (catalog?.accounts.length ?? 0) > 0
        : selectedSourceValue.startsWith("account:")
          ? catalog?.accounts.some(
              (account) =>
                toAccountSourceValue(account.accountId) === selectedSourceValue,
            )
          : profiles.some(
              (profile) =>
                toProfileSourceValue(profile.id) === selectedSourceValue,
            )
    if (!sourceStillExists) {
      setSelectedSourceValue(
        (catalog?.accounts.length ?? 0) > 0
          ? toAccountSourceValue(catalog!.accounts[0]!.accountId)
          : profiles[0]
            ? toProfileSourceValue(profiles[0].id)
            : "",
      )
    }
  }, [catalog, profiles, selectedSourceValue])

  const selectedProfile = selectedSourceValue.startsWith("profile:")
    ? profiles.find(
        (profile) => toProfileSourceValue(profile.id) === selectedSourceValue,
      )
    : undefined
  const selectedAccount = selectedSourceValue.startsWith("account:")
    ? catalog?.accounts.find(
        (account) =>
          toAccountSourceValue(account.accountId) === selectedSourceValue,
      )
    : undefined
  const isAllAccounts = selectedSourceValue === ALL_ACCOUNTS_SOURCE_VALUE

  const loadProfileCatalog = async (
    profile: WebApiCredentialProfileSummary,
  ) => {
    if (!onLoadProfileModels) return
    setProfileCatalogState({ profileId: profile.id, status: "loading" })
    try {
      const response = await onLoadProfileModels(profile)
      setProfileCatalogState({
        profileId: profile.id,
        status: "success",
        catalog: response,
      })
    } catch (error) {
      setProfileCatalogState({
        profileId: profile.id,
        status: "error",
        error: getErrorMessage(error),
      })
    }
  }

  const handleSourceChange = (value: string) => {
    setSelectedSourceValue(value)
    setActiveAccountIds([])
    setSelectedVendor("")
    if (value.startsWith("profile:")) {
      const profile = profiles.find(
        (item) => toProfileSourceValue(item.id) === value,
      )
      if (profile) void loadProfileCatalog(profile)
    }
  }

  const accountRows = useMemo(
    () =>
      (catalog?.models ?? []).flatMap((model) =>
        model.accounts.flatMap((rawOffer) => {
          if (
            selectedAccount &&
            rawOffer.accountId !== selectedAccount.accountId
          ) {
            return []
          }
          if (
            isAllAccounts &&
            activeAccountIds.length > 0 &&
            !activeAccountIds.includes(rawOffer.accountId)
          ) {
            return []
          }
          const offer: ModelCatalogOffer = {
            ...rawOffer,
            sourceKind: "account",
          }
          return [{ model, offer }]
        }),
      ),
    [activeAccountIds, catalog?.models, isAllAccounts, selectedAccount],
  )

  const profileRows = useMemo(() => {
    if (
      !selectedProfile ||
      profileCatalogState?.profileId !== selectedProfile.id ||
      profileCatalogState.status !== "success" ||
      !profileCatalogState.catalog
    ) {
      return []
    }
    return profileCatalogState.catalog.models.map((model) => {
      const offer: ModelCatalogOffer = {
        accountId: selectedProfile.id,
        profileId: selectedProfile.id,
        accountName: selectedProfile.name,
        sourceKind: "profile",
        sourceUrl: selectedProfile.baseUrl,
      }
      return { model, offer }
    })
  }, [profileCatalogState, selectedProfile])

  const sourceRows = selectedProfile ? profileRows : accountRows
  const supportsPricing = sourceRows.some(({ offer }) =>
    offer.prices?.some((price) => price.precision !== "unavailable"),
  )
  const supportsVerification = !!selectedProfile && !!onVerifyProfile
  const availableGroups = useMemo(
    () =>
      Array.from(
        new Set(
          sourceRows.flatMap(({ offer }) => [
            ...(offer.enableGroups ?? []),
            ...(offer.prices ?? []).flatMap((price) =>
              price.group ? [price.group] : [],
            ),
          ]),
        ),
      ).sort(),
    [sourceRows],
  )

  const unfilteredRows = useMemo(
    () =>
      sourceRows.map(({ model, offer }) => {
        const key = `${offer.sourceKind}:${offer.accountId}:${model.id}`
        return {
          key,
          id: model.id,
          displayName:
            "displayName" in model && typeof model.displayName === "string"
              ? model.displayName
              : undefined,
          vendor:
            "vendor" in model && typeof model.vendor === "string"
              ? model.vendor
              : undefined,
          description:
            "description" in model && typeof model.description === "string"
              ? model.description
              : undefined,
          capabilities: getCapabilities(offer),
          offer,
          ...selectBestPrice({
            offer,
            billingMode,
            selectedGroups,
            excludedGroups: excludedGroupsByAccountId[offer.accountId] ?? [],
            weights,
            showRealPrice,
          }),
          verification: verifications[key],
        } satisfies ModelOfferRow
      }),
    [
      billingMode,
      excludedGroupsByAccountId,
      selectedGroups,
      showRealPrice,
      sourceRows,
      verifications,
      weights,
    ],
  )

  const baseFilteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return unfilteredRows.filter((row) => {
      if (
        normalizedSearch &&
        !`${row.id} ${row.displayName ?? ""} ${row.offer.displayName ?? ""} ${row.vendor ?? ""} ${row.offer.vendor ?? ""} ${row.description ?? ""} ${row.offer.description ?? ""} ${row.offer.accountName}`
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        return false
      }
      const prices = row.offer.prices ?? []
      if (
        billingMode !== "all" &&
        prices.length > 0 &&
        !prices.some((price) => price.billingMode === billingMode)
      ) {
        return false
      }
      if (
        selectedGroups.length > 0 &&
        prices.length > 0 &&
        !prices.some(
          (price) => !!price.group && selectedGroups.includes(price.group),
        )
      ) {
        return false
      }
      if (
        selectedCapabilities.length > 0 &&
        !selectedCapabilities.every((capability) =>
          row.capabilities.includes(capability),
        )
      ) {
        return false
      }
      if (selectedVerificationResults.length > 0) {
        const status = row.verification?.status ?? "unverified"
        if (!selectedVerificationResults.includes(status)) return false
      }
      return true
    })
  }, [
    billingMode,
    search,
    selectedCapabilities,
    selectedGroups,
    selectedVerificationResults,
    unfilteredRows,
  ])

  const capabilityCounts = useMemo(() => {
    const counts: Partial<Record<ModelCapabilityKey, number>> = {}
    for (const row of unfilteredRows) {
      for (const capability of row.capabilities) {
        counts[capability] = (counts[capability] ?? 0) + 1
      }
    }
    return counts
  }, [unfilteredRows])

  const vendorCatalog = useMemo(() => {
    const counts = new Map<string, number>()
    let unclassifiedCount = 0
    for (const row of baseFilteredRows) {
      const vendor = row.offer.vendor ?? row.vendor
      if (!vendor) unclassifiedCount += 1
      else counts.set(vendor, (counts.get(vendor) ?? 0) + 1)
    }
    return {
      providers: Array.from(counts, ([label, count]) => ({
        key: label,
        label,
        count,
      })).sort((left, right) => left.label.localeCompare(right.label)),
      unclassifiedCount,
    }
  }, [baseFilteredRows])
  const effectiveVendor =
    selectedVendor === "__unclassified__" && vendorCatalog.unclassifiedCount > 0
      ? selectedVendor
      : vendorCatalog.providers.some(
            (provider) => provider.key === selectedVendor,
          )
        ? selectedVendor
        : ""

  const filteredRows = useMemo(() => {
    const rows = baseFilteredRows.filter((row) => {
      const vendor = row.offer.vendor ?? row.vendor
      return (
        !effectiveVendor ||
        (effectiveVendor === "__unclassified__"
          ? !vendor
          : vendor === effectiveVendor)
      )
    })
    return [...rows].sort((left, right) => {
      if (sortMode === "verification-latency-asc") {
        const leftLatency = left.verification?.latencyMs
        const rightLatency = right.verification?.latencyMs
        if (leftLatency === undefined) return 1
        if (rightLatency === undefined) return -1
        if (leftLatency !== rightLatency) return leftLatency - rightLatency
      }
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

  const priceComparisonActive =
    isAllAccounts &&
    sortMode === "model-cheapest-first" &&
    billingMode === "all" &&
    selectedGroups.length === 0 &&
    selectedCapabilities.length === 0 &&
    (selectedVerificationResults.length === 0 ||
      selectedVerificationResults.length === 3) &&
    search === "" &&
    showRealPrice

  const enablePriceComparison = () => {
    setSelectedSourceValue(ALL_ACCOUNTS_SOURCE_VALUE)
    setActiveAccountIds([])
    setExcludedGroupsByAccountId({})
    setSearch("")
    setSortMode("model-cheapest-first")
    setBillingMode("all")
    setSelectedGroups([])
    setSelectedCapabilities([])
    setSelectedVerificationResults(["pass", "fail", "unverified"])
    setSelectedVendor("")
    setShowRealPrice(true)
  }

  const handlePresetIdChange = (nextPresetId: ModelPriceComparisonPresetId) => {
    setPresetId(nextPresetId)
    if (nextPresetId !== MODEL_PRICE_COMPARISON_PRESET_IDS.CUSTOM) {
      setWeights({ ...MODEL_PRICE_COMPARISON_PRESETS[nextPresetId].weights })
    }
  }

  const handleAccountSummaryClick = (accountId: string) => {
    setActiveAccountIds((current) =>
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId],
    )
  }

  const handleVerify = async (row: ModelOfferRow) => {
    if (!selectedProfile || !onVerifyProfile) return
    setVerifyingKeys((current) => [...current, row.key])
    try {
      const response = await onVerifyProfile(selectedProfile, row.id)
      const relevantResults = response.report.results
      const failure = relevantResults.find((result) => result.status === "fail")
      const passed = relevantResults.some((result) => result.status === "pass")
      const status = failure || !passed ? "fail" : "pass"
      const representative = failure ?? relevantResults[0]
      setVerifications((current) => ({
        ...current,
        [row.key]: {
          status,
          latencyMs: Math.max(
            0,
            ...relevantResults.map((result) => result.latencyMs),
          ),
          summary:
            representative?.summary ??
            (status === "pass" ? "接口响应正常" : "接口验证失败"),
        },
      }))
    } catch (error) {
      setVerifications((current) => ({
        ...current,
        [row.key]: {
          status: "fail",
          latencyMs: 0,
          summary: getErrorMessage(error),
        },
      }))
    } finally {
      setVerifyingKeys((current) => current.filter((key) => key !== row.key))
    }
  }

  const handleBatchVerify = async () => {
    for (const row of filteredRows) {
      await handleVerify(row)
    }
  }

  const handleRefresh = async () => {
    if (selectedProfile) await loadProfileCatalog(selectedProfile)
    else await onRefresh()
  }

  const pageBusy =
    busy ||
    (selectedProfile &&
      profileCatalogState?.profileId === selectedProfile.id &&
      profileCatalogState.status === "loading")
  const hasSources = (catalog?.accounts.length ?? 0) + profiles.length > 0
  const selectedSourceStatus = selectedAccount?.status
  const sourceError =
    selectedProfile && profileCatalogState?.profileId === selectedProfile.id
      ? profileCatalogState.status === "error"
        ? profileCatalogState.error
        : profileCatalogState.status === "success" &&
            !profileCatalogState.catalog?.supported
          ? "该 API 凭据类型暂不支持模型发现。"
          : undefined
      : selectedSourceStatus === "error"
        ? selectedAccount?.error ?? "加载模型数据失败，请稍后重试。"
        : selectedSourceStatus === "unsupported"
          ? "该站点类型暂未适配模型列表。"
          : selectedSourceStatus === "skipped"
            ? "该账号已停用，未加载模型数据。"
            : undefined

  const shouldShowRefreshAction =
    Boolean(selectedSourceValue) && sourceRows.length > 0
  const shouldShowPriceComparisonAction =
    supportsPricing && !priceComparisonActive
  const shouldShowHeaderActions =
    shouldShowRefreshAction || shouldShowPriceComparisonAction
  const accountForKeyAction = selectedAccount ?? catalog?.accounts[0]
  const titleActions =
    accountForKeyAction && onOpenAccountKeys ? (
      <IconButton
        type="button"
        title="管理账号密钥"
        aria-label="管理账号密钥"
        onClick={() => onOpenAccountKeys(accountForKeyAction.accountId)}
        size="sm"
        variant="outline"
      >
        <KeyRound className="size-4" />
      </IconButton>
    ) : undefined
  const headerActions = shouldShowHeaderActions ? (
    <>
      {shouldShowRefreshAction ? (
        <Button
          onClick={() => void handleRefresh()}
          variant="secondary"
          leftIcon={<RefreshCw className="size-4" />}
          loading={pageBusy}
        >
          {pageBusy ? "刷新中..." : "刷新数据"}
        </Button>
      ) : null}
      {shouldShowPriceComparisonAction ? (
        <Button
          type="button"
          title="清空当前筛选，切换到所有账号，并按同模型最低价优先排序。"
          onClick={enablePriceComparison}
          variant="default"
          leftIcon={<TrendingDown className="size-4" />}
        >
          一键比价
        </Button>
      ) : null}
    </>
  ) : undefined

  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="模型列表"
      description="查看和管理可用的AI模型"
      titleActions={titleActions}
      inlineActions={headerActions}
      footer={headerActions}
      size="wide"
    >
      <ModelSourceSection
        value={selectedSourceValue}
        accounts={catalog?.accounts ?? []}
        profiles={profiles}
        activeAccountIds={activeAccountIds}
        excludedGroupsByAccountId={excludedGroupsByAccountId}
        onChange={handleSourceChange}
        onAccountSummaryClick={handleAccountSummaryClick}
        onExcludedGroupsChange={setExcludedGroupsByAccountId}
      />

      {!hasSources && !pageBusy ? (
        <EmptyState
          title="暂无可用数据源"
          description="请先添加站点账号或 API 凭据，然后查看模型列表。"
        />
      ) : !selectedSourceValue ? (
        <EmptyState
          title="请选择数据源"
          description="请先在上方选择一个数据源，然后查看模型列表。"
        />
      ) : pageBusy && sourceRows.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center text-center">
          <LoaderCircle className="size-10 animate-spin text-blue-600" />
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            正在加载模型数据...
          </p>
        </div>
      ) : sourceError ? (
        <StatusNotice
          title={
            selectedSourceStatus === "unsupported"
              ? "该站点类型暂未适配模型列表"
              : "加载模型数据失败"
          }
          description={sourceError}
          onRetry={() => void handleRefresh()}
        />
      ) : sourceRows.length === 0 ? (
        <EmptyState
          title="没有可显示的模型"
          description="当前来源没有返回模型数据，请刷新后重试。"
        />
      ) : (
        <>
          <ModelControlPanel
            search={search}
            sortMode={sortMode}
            billingMode={billingMode}
            selectedGroups={selectedGroups}
            availableGroups={availableGroups}
            selectedCapabilities={selectedCapabilities}
            capabilityCounts={capabilityCounts}
            selectedVerificationResults={selectedVerificationResults}
            isAllAccountsSource={isAllAccounts}
            isProfileSource={Boolean(selectedProfile)}
            supportsCapabilityFilter={unfilteredRows.some(
              (row) => row.capabilities.length > 0,
            )}
            showRealPrice={showRealPrice}
            showEndpointTypes={showEndpointTypes}
            supportsPricing={supportsPricing}
            supportsVerification={supportsVerification}
            totalCount={unfilteredRows.length}
            filteredCount={filteredRows.length}
            presetId={presetId}
            weights={weights}
            priceComparisonActive={priceComparisonActive}
            onSearchChange={setSearch}
            onSortModeChange={setSortMode}
            onBillingModeChange={setBillingMode}
            onSelectedGroupsChange={setSelectedGroups}
            onSelectedCapabilitiesChange={setSelectedCapabilities}
            onSelectedVerificationResultsChange={setSelectedVerificationResults}
            onShowRealPriceChange={setShowRealPrice}
            onShowEndpointTypesChange={setShowEndpointTypes}
            onPresetIdChange={handlePresetIdChange}
            onWeightsChange={setWeights}
            onCopyAllNames={() =>
              void navigator.clipboard?.writeText(
                Array.from(new Set(filteredRows.map((row) => row.id))).join(
                  "\n",
                ),
              )
            }
            onBatchVerify={
              supportsVerification ? () => void handleBatchVerify() : undefined
            }
            onEnablePriceComparison={enablePriceComparison}
          />

          <ProviderTabs
            providers={vendorCatalog.providers}
            value={effectiveVendor}
            totalCount={baseFilteredRows.length}
            unclassifiedCount={vendorCatalog.unclassifiedCount}
            onChange={setSelectedVendor}
          >
            <ModelDisplay
              rows={filteredRows}
              showRealPrice={showRealPrice}
              showEndpointTypes={showEndpointTypes}
              showPriceComparisonGroups={sortMode === "model-cheapest-first"}
              verifyingKeys={verifyingKeys}
              onFilterAccount={
                isAllAccounts
                  ? (accountId) => setActiveAccountIds([accountId])
                  : undefined
              }
              onOpenAccountKeys={onOpenAccountKeys}
              onVerify={supportsVerification ? handleVerify : undefined}
            />
          </ProviderTabs>

          {supportsPricing ? (
            <footer className="mt-8 flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
              <Info className="mt-0.5 size-4 shrink-0" />
              <div>
                <h4 className="mb-1 font-medium">模型定价说明</h4>
                <p className="text-sm leading-6">
                  价格信息来源于站点提供的 API
                  接口，实际费用以各站点公布的价格为准。按量计费模型的价格为每
                  1M tokens 的费用，按次计费模型显示每次调用的费用
                </p>
              </div>
            </footer>
          ) : null}
        </>
      )}
    </WebDialog>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
      <Cpu className="size-12 text-gray-300 dark:text-gray-600" />
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-lg text-sm leading-6 text-gray-500 dark:text-gray-400">
          {description}
        </p>
      ) : null}
    </div>
  )
}

function StatusNotice({
  title,
  description,
  onRetry,
}: {
  title: string
  description: string
  onRetry: () => void
}) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50/60 p-8 text-center dark:border-red-900 dark:bg-red-950/20">
      <Info className="size-10 text-red-500" />
      <h2 className="mt-4 text-base font-semibold text-red-900 dark:text-red-100">
        {title}
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-red-700 dark:text-red-300">
        {description}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
      >
        <RefreshCw className="size-4" />
        重新尝试加载
      </button>
    </div>
  )
}

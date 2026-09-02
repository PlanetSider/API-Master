import { Funnel } from "lucide-react"
import { useMemo, useState } from "react"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CompactMultiSelect,
  Heading3,
  SearchableSelect,
} from "~/components/ui"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { formatGroupLabel } from "~/features/ModelList/groupLabels"
import type {
  WebAccountModelCatalogResult,
  WebApiCredentialProfileSummary,
} from "~/web/contracts"

export const ALL_ACCOUNTS_SOURCE_VALUE = "all-accounts"
export const toAccountSourceValue = (accountId: string) =>
  `account:${accountId}`
export const toProfileSourceValue = (profileId: string) =>
  `profile:${profileId}`

const getStatusPresentation = (account: WebAccountModelCatalogResult) => {
  if (account.status === "success") {
    return {
      label: `${account.models.length} 个模型`,
      className: "text-emerald-600 dark:text-emerald-400",
    }
  }
  if (account.status === "error") {
    return {
      label: "加载失败",
      className: "text-red-500 dark:text-red-400",
      title: account.error,
    }
  }
  if (account.status === "unsupported") {
    return {
      label: "暂未适配",
      className: "text-blue-600 dark:text-blue-300",
    }
  }
  return {
    label: "已停用",
    className: "text-gray-500 dark:text-gray-400",
  }
}

interface ModelSourceSectionProps {
  value: string
  accounts: WebAccountModelCatalogResult[]
  profiles: WebApiCredentialProfileSummary[]
  activeAccountIds: string[]
  excludedGroupsByAccountId: Record<string, string[]>
  onChange: (value: string) => void
  onAccountSummaryClick: (accountId: string) => void
  onExcludedGroupsChange: (value: Record<string, string[]>) => void
}

export function ModelSourceSection({
  value,
  accounts,
  profiles,
  activeAccountIds,
  excludedGroupsByAccountId,
  onChange,
  onAccountSummaryClick,
  onExcludedGroupsChange,
}: ModelSourceSectionProps) {
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const isAllAccounts = value === ALL_ACCOUNTS_SOURCE_VALUE
  const groupsByAccountId = useMemo(
    () =>
      Object.fromEntries(
        accounts.map((account) => [
          account.accountId,
          Array.from(
            new Set(
              account.models.flatMap((model) => [
                ...(model.enableGroups ?? []),
                ...(model.prices ?? []).flatMap((price) =>
                  price.group ? [price.group] : [],
                ),
              ]),
            ),
          ).sort(),
        ]),
      ),
    [accounts],
  )
  const accountsWithGroups = accounts.filter(
    (account) => (groupsByAccountId[account.accountId]?.length ?? 0) > 0,
  )
  const activeFilteredAccountCount = accountsWithGroups.filter((account) =>
    (excludedGroupsByAccountId[account.accountId] ?? []).some((group) =>
      groupsByAccountId[account.accountId]?.includes(group),
    ),
  ).length
  const totalExcludedGroups = accountsWithGroups.reduce(
    (count, account) =>
      count +
      (excludedGroupsByAccountId[account.accountId] ?? []).filter((group) =>
        groupsByAccountId[account.accountId]?.includes(group),
      ).length,
    0,
  )

  const updateSelectedGroups = (accountId: string, selected: string[]) => {
    const available = groupsByAccountId[accountId] ?? []
    const selectedSet = new Set(selected)
    const excluded = available.filter((group) => !selectedSet.has(group))
    const next = { ...excludedGroupsByAccountId }
    if (excluded.length === 0) delete next[accountId]
    else next[accountId] = excluded
    onExcludedGroupsChange(next)
  }

  return (
    <section aria-labelledby="model-source-heading">
      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Heading3 id="model-source-heading" className="mb-0">
            选择数据源
          </Heading3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="min-w-0 flex-1">
            <SearchableSelect
              value={value}
              aria-label="选择数据源"
              searchPlaceholder="搜索账号或 API 凭据..."
              options={[
                ...(accounts.length > 0
                  ? [{ value: ALL_ACCOUNTS_SOURCE_VALUE, label: "所有账号" }]
                  : []),
                ...accounts.map((account) => ({
                  value: toAccountSourceValue(account.accountId),
                  label: account.accountName,
                })),
                ...profiles.map((profile) => {
                  let host = profile.baseUrl
                  try {
                    host = new URL(profile.baseUrl).hostname
                  } catch {
                    // Keep the saved URL visible when it cannot be parsed.
                  }
                  return {
                    value: toProfileSourceValue(profile.id),
                    label: `API 凭据：${profile.name} · ${host}`,
                  }
                }),
              ]}
              placeholder="请选择数据源"
              onChange={onChange}
            />
          </div>

          {isAllAccounts ? (
            <Popover open={groupMenuOpen} onOpenChange={setGroupMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant={totalExcludedGroups > 0 ? "secondary" : "outline"}
                  aria-label="筛选账号分组"
                  className="w-full justify-between px-3 sm:w-56"
                >
                  <span className="flex items-center gap-2">
                    <Funnel className="size-4" />
                    <span>筛选账号分组</span>
                  </span>
                  {activeFilteredAccountCount > 0 ? (
                    <Badge variant="info" size="sm">
                      {activeFilteredAccountCount} 个账号
                    </Badge>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[min(42rem,calc(100vw-2rem))] p-0"
              >
                <div className="border-b px-4 py-3 dark:border-gray-700">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        账号分组筛选
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        按账号分别排除不参与比价的分组；默认会保留每个账号自己的全部可用分组。
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onExcludedGroupsChange({})}
                      disabled={totalExcludedGroups === 0}
                    >
                      恢复全部
                    </Button>
                  </div>
                </div>

                <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
                  {accountsWithGroups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      当前没有可筛选的账号分组。
                    </div>
                  ) : (
                    accountsWithGroups.map((account) => {
                      const groups = groupsByAccountId[account.accountId] ?? []
                      const excluded = new Set(
                        excludedGroupsByAccountId[account.accountId] ?? [],
                      )
                      const selected = groups.filter(
                        (group) => !excluded.has(group),
                      )
                      return (
                        <section
                          key={account.accountId}
                          className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {account.accountName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                已选 {selected.length} / {groups.length}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={selected.length === groups.length}
                                onClick={() =>
                                  updateSelectedGroups(
                                    account.accountId,
                                    groups,
                                  )
                                }
                              >
                                全选
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={selected.length === 0}
                                onClick={() =>
                                  updateSelectedGroups(account.accountId, [])
                                }
                              >
                                清空
                              </Button>
                            </div>
                          </div>
                          <CompactMultiSelect
                            options={groups.map((group) => {
                              const price = account.models
                                .flatMap((model) => model.prices ?? [])
                                .find((item) => item.group === group)
                              return {
                                value: group,
                                label:
                                  price?.groupRatio === undefined
                                    ? group
                                    : formatGroupLabel(group, price.groupRatio),
                              }
                            })}
                            selected={selected}
                            onChange={(next) =>
                              updateSelectedGroups(account.accountId, next)
                            }
                            size="sm"
                            displayMode="summary"
                            placeholder={
                              selected.length === 0
                                ? "该账号当前未保留任何分组"
                                : "保留该账号的全部分组"
                            }
                          />
                        </section>
                      )
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

      {isAllAccounts && accounts.length > 0 ? (
        <Card className="mb-4">
          <CardContent className="py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                账号概览
              </div>
              <div className="flex flex-wrap gap-2">
                {accounts.map((account) => {
                  const status = getStatusPresentation(account)
                  const active = activeAccountIds.includes(account.accountId)
                  return (
                    <Badge
                      key={account.accountId}
                      variant={active ? "info" : "secondary"}
                      size="default"
                      className="cursor-pointer"
                      title={status.title}
                      aria-pressed={active}
                      onClick={() => onAccountSummaryClick(account.accountId)}
                    >
                      <span className="truncate font-medium">
                        {account.accountName}
                      </span>
                      <span className={`ml-2 ${status.className}`}>
                        {status.label}
                      </span>
                    </Badge>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}

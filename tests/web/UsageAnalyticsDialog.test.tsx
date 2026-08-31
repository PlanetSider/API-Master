import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SITE_TYPES } from "~/constants/siteType"
import { AuthTypeEnum, SiteHealthStatus } from "~/types"
import { UsageAnalyticsDialog } from "~~/web/components/UsageAnalyticsDialog"

describe("UsageAnalyticsDialog", () => {
  it("renders aggregates and submits account and date filters", async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(
      <UsageAnalyticsDialog
        open
        busy={false}
        onClose={vi.fn()}
        onRefresh={onRefresh}
        accounts={[
          {
            id: "account-1",
            name: "主账户",
            baseUrl: "https://example.com",
            siteType: SITE_TYPES.NEW_API,
            authType: AuthTypeEnum.AccessToken,
            username: "",
            userId: "",
            disabled: false,
            pinned: false,
            tagIds: [],
            notes: "",
            health: { status: SiteHealthStatus.Healthy },
            balance: { USD: 0, CNY: 0 },
            todayConsumption: { USD: 0, CNY: 0 },
            lastSyncTime: 0,
            createdAt: 0,
            exchangeRate: 7.2,
          },
        ]}
        analytics={{
          selection: {
            accountIds: ["account-1"],
            startDay: "2026-08-29",
            endDay: "2026-08-30",
          },
          availableRange: {
            minDay: "2026-08-29",
            maxDay: "2026-08-30",
          },
          totals: {
            requests: 3,
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            consumedUsd: 1.25,
          },
          daily: [
            {
              day: "2026-08-30",
              requests: 3,
              promptTokens: 100,
              completionTokens: 50,
              totalTokens: 150,
              consumedUsd: 1.25,
            },
          ],
          accounts: [
            {
              accountId: "account-1",
              accountName: "主账户",
              aggregate: {
                requests: 3,
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
                consumedUsd: 1.25,
              },
            },
          ],
          models: [
            {
              model: "gpt-4o-mini",
              aggregate: {
                requests: 3,
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
                consumedUsd: 1.25,
              },
            },
          ],
          latency: {
            count: 2,
            averageSeconds: 1.5,
            maxSeconds: 2,
            slowCount: 0,
            unknownCount: 0,
          },
          statuses: [],
          revision: 1,
        }}
      />,
    )

    expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument()
    expect(screen.getByText(/平均 1.50 秒/)).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "主账户" }))
    await user.click(screen.getByRole("button", { name: "应用筛选" }))
    expect(onRefresh).toHaveBeenCalledWith({
      accountIds: [],
      startDay: "2026-08-29",
      endDay: "2026-08-30",
    })
  })
})

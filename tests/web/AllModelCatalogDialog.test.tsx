import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SITE_TYPES } from "~/constants/siteType"
import type { WebAllModelCatalogResponse } from "~/web/contracts"
import { AllModelCatalogDialog } from "~~/web/components/AllModelCatalogDialog"

const catalog: WebAllModelCatalogResponse = {
  accounts: [
    {
      accountId: "expensive",
      accountName: "高价账号",
      siteType: SITE_TYPES.NEW_API,
      disabled: false,
      status: "success",
      supportsPricing: true,
      models: [],
    },
    {
      accountId: "cheap",
      accountName: "低价账号",
      siteType: SITE_TYPES.NEW_API,
      disabled: false,
      status: "success",
      supportsPricing: true,
      models: [],
    },
  ],
  models: [
    {
      id: "GLM-5.2-Base",
      vendor: "智谱 AI",
      description: "用于测试同模型报价比较。",
      accounts: [
        {
          accountId: "expensive",
          accountName: "高价账号",
          siteType: SITE_TYPES.NEW_API,
          exchangeRate: 7,
          enableGroups: ["default", "vip"],
          supportedEndpointTypes: ["/v1/chat/completions"],
          prices: [
            {
              billingMode: "token",
              group: "default",
              groupRatio: 1,
              inputUsdPerMillionTokens: 2,
              outputUsdPerMillionTokens: 8,
            },
            {
              billingMode: "token",
              group: "vip",
              groupRatio: 0.8,
              inputUsdPerMillionTokens: 1.6,
              outputUsdPerMillionTokens: 6.4,
            },
          ],
        },
        {
          accountId: "cheap",
          accountName: "低价账号",
          siteType: SITE_TYPES.NEW_API,
          exchangeRate: 7,
          enableGroups: ["default"],
          prices: [
            {
              billingMode: "token",
              group: "default",
              groupRatio: 1,
              inputUsdPerMillionTokens: 1,
              outputUsdPerMillionTokens: 4,
            },
          ],
        },
      ],
    },
    {
      id: "catalog-only-model",
      accounts: [
        {
          accountId: "cheap",
          accountName: "低价账号",
          siteType: SITE_TYPES.NEW_API,
        },
      ],
    },
  ],
  startedAt: 1,
  finishedAt: 2,
  summary: {
    total: 2,
    succeeded: 2,
    failed: 0,
    unsupported: 0,
    skipped: 0,
    modelCount: 2,
  },
}

describe("AllModelCatalogDialog", () => {
  it("renders the upstream-style model controls and account offers", () => {
    render(
      <AllModelCatalogDialog
        open
        busy={false}
        catalog={catalog}
        onClose={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "模型列表" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "选择数据源" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("搜索模型")).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "排序方式" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "计费方式" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "智谱 AI (2)" })).toBeInTheDocument()
    expect(screen.getAllByText("GLM-5.2-Base")).toHaveLength(2)
    expect(screen.getByText("catalog-only-model")).toBeInTheDocument()
    expect(screen.getByText("暂无可比较价格")).toBeInTheDocument()
  })

  it("enables all-account cheapest-first comparison with one click", async () => {
    const user = userEvent.setup()
    render(
      <AllModelCatalogDialog
        open
        busy={false}
        catalog={catalog}
        onClose={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.selectOptions(
      screen.getByRole("combobox", { name: "选择数据源" }),
      "expensive",
    )
    await user.selectOptions(
      screen.getByRole("combobox", { name: "用户分组" }),
      "vip",
    )
    await user.click(
      screen.getByTitle(
        "清空价格筛选，切换到所有账号，并按同模型最低价优先排序。",
      ),
    )

    expect(screen.getByRole("combobox", { name: "选择数据源" })).toHaveValue("")
    expect(screen.getByRole("combobox", { name: "排序方式" })).toHaveValue(
      "model-cheapest-first",
    )
    expect(screen.getByRole("combobox", { name: "计费方式" })).toHaveValue(
      "all",
    )
    expect(screen.getByRole("combobox", { name: "用户分组" })).toHaveValue("")
    expect(screen.getByRole("checkbox", { name: "真实充值金额" })).toBeChecked()
    expect(screen.getByText("价格比较条件")).toBeInTheDocument()
    expect(screen.getAllByText("可比较报价:").length).toBeGreaterThan(0)

    const lowestBadge = screen.getByText("最低价")
    const lowestOffer = lowestBadge.closest("article")
    expect(lowestOffer).not.toBeNull()
    expect(
      within(lowestOffer as HTMLElement).getByText("低价账号"),
    ).toBeInTheDocument()
  })
})

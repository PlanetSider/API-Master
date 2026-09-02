import { render, screen, waitFor, within } from "@testing-library/react"
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
          sourceUrl: "https://expensive.example.com",
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
          sourceUrl: "https://cheap.example.com",
          exchangeRate: 7,
          enableGroups: ["default"],
          metadata: {
            capabilities: { reasoning: true, toolCall: true },
            modalities: { input: ["text", "image"], output: ["text"] },
          },
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
  const chooseOption = async (
    user: ReturnType<typeof userEvent.setup>,
    label: string,
    option: RegExp | string,
  ) => {
    await user.click(screen.getByRole("combobox", { name: label }))
    await user.click(screen.getByRole("option", { name: option }))
  }

  it("renders the complete upstream-style controls and account offers", async () => {
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

    await chooseOption(user, "选择数据源", "所有账号")

    expect(
      screen.getByRole("heading", { name: "模型列表" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "选择数据源" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "搜索模型" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "排序方式" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "计费方式" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "模型能力" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "测试结果" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "端点类型" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "筛选账号分组" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "智谱 AI (2)" })).toBeInTheDocument()
    expect(screen.getAllByText("GLM-5.2-Base")).toHaveLength(2)
    expect(screen.getByText("catalog-only-model")).toBeInTheDocument()
    expect(screen.getByText("此来源的价格数据不可用。")).toBeInTheDocument()
    expect(screen.getByText("图片理解")).toBeInTheDocument()
    expect(screen.getByText("思考")).toBeInTheDocument()
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

    await chooseOption(user, "选择数据源", /高价账号/)
    await user.click(screen.getByRole("combobox", { name: "用户分组" }))
    await user.click(screen.getByRole("option", { name: "vip" }))
    await user.click(
      screen.getAllByTitle(
        "清空当前筛选，切换到所有账号，并按同模型最低价优先排序。",
      )[0],
    )

    expect(
      screen.getByRole("combobox", { name: "选择数据源" }),
    ).toHaveTextContent("所有账号")
    expect(
      screen.getByRole("combobox", { name: "排序方式" }),
    ).toHaveTextContent("同模型最低价优先")
    expect(
      screen.getByRole("combobox", { name: "计费方式" }),
    ).toHaveTextContent("所有计费方式")
    expect(
      screen.queryByRole("combobox", { name: "用户分组" }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "真实充值金额" })).toBeChecked()
    expect(screen.getByText("价格比较条件")).toBeInTheDocument()
    expect(screen.getAllByText(/可比较报价:/).length).toBeGreaterThan(0)

    const lowestBadge = screen.getAllByText(/最优组:/)[0]
    const lowestOffer = lowestBadge.closest("article")
    expect(lowestOffer).not.toBeNull()
    expect(
      within(lowestOffer as HTMLElement).getByText("低价账号"),
    ).toBeInTheDocument()
  })

  it("keeps all-account scope while account summary badges filter offers", async () => {
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

    await chooseOption(user, "选择数据源", "所有账号")

    const accountSummary = screen.getByText("账号概览").parentElement
    expect(accountSummary).not.toBeNull()
    await user.click(
      within(accountSummary as HTMLElement).getByText("高价账号"),
    )

    expect(
      screen.getByRole("combobox", { name: "选择数据源" }),
    ).toHaveTextContent("所有账号")
    expect(screen.getAllByRole("article")).toHaveLength(1)
    expect(screen.queryByText("catalog-only-model")).not.toBeInTheDocument()
  })

  it("supports the complete custom comparison weight editor", async () => {
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

    await chooseOption(user, "排序方式", "价格从低到高")
    await chooseOption(user, "使用场景", "自定义")
    await user.type(
      screen.getByRole("spinbutton", { name: "缓存写入占比" }),
      "12.5",
    )

    expect(screen.getByRole("spinbutton", { name: "输入占比" })).toBeVisible()
    expect(screen.getByRole("spinbutton", { name: "输出占比" })).toBeVisible()
    expect(
      screen.getByRole("spinbutton", { name: "缓存读取占比" }),
    ).toBeVisible()
    expect(
      screen.getByRole("spinbutton", { name: "缓存写入占比" }),
    ).toHaveValue(12.5)
    expect(
      screen.getByRole("combobox", { name: "使用场景" }),
    ).toHaveTextContent("自定义")
  })

  it("loads API credential sources and exposes supported verification actions", async () => {
    const user = userEvent.setup()
    const profile = {
      id: "profile-1",
      name: "OpenAI 生产凭据",
      apiType: "openai" as const,
      baseUrl: "https://api.openai.com/v1",
      apiKeyMasked: "sk-****",
      tagIds: [],
      notes: "",
      createdAt: 1,
      updatedAt: 1,
    }
    const onLoadProfileModels = vi.fn().mockResolvedValue({
      profileId: profile.id,
      profileName: profile.name,
      supported: true,
      models: [{ id: "gpt-5.2" }],
    })
    const onVerifyProfile = vi.fn().mockResolvedValue({
      profileId: profile.id,
      profileName: profile.name,
      report: {
        baseUrl: profile.baseUrl,
        apiType: profile.apiType,
        modelId: "gpt-5.2",
        startedAt: 1,
        finishedAt: 2,
        results: [
          {
            id: "chat",
            status: "pass",
            latencyMs: 42,
            summary: "响应正常",
          },
        ],
      },
    })
    render(
      <AllModelCatalogDialog
        open
        busy={false}
        catalog={catalog}
        profiles={[profile]}
        onClose={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onLoadProfileModels={onLoadProfileModels}
        onVerifyProfile={onVerifyProfile}
      />,
    )

    await chooseOption(user, "选择数据源", /API 凭据：OpenAI 生产凭据/)
    expect(await screen.findByText("gpt-5.2")).toBeInTheDocument()
    expect(screen.getByText("API 凭据模型目录")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "批量测试" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "验证接口" }))
    await waitFor(() =>
      expect(onVerifyProfile).toHaveBeenCalledWith(profile, "gpt-5.2"),
    )
    expect(await screen.findByText("最近测试成功")).toBeInTheDocument()
    expect(screen.getByText(/42 ms/)).toBeInTheDocument()
  })
})

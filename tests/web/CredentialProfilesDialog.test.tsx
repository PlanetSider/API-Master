import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type {
  WebApiCredentialProfileListResponse,
  WebApiCredentialProfileModelCatalogResponse,
  WebApiCredentialProfileVerificationResponse,
} from "~/web/contracts"
import { CredentialProfilesDialog } from "~~/web/components/CredentialProfilesDialog"

const profiles: WebApiCredentialProfileListResponse = {
  revision: 1,
  profiles: [
    {
      id: "profile-1",
      name: "测试凭据",
      apiType: "openai-compatible",
      baseUrl: "https://api.example.com",
      apiKeyMasked: "sk-t••••cret",
      tagIds: ["tag-1"],
      notes: "",
      createdAt: 1,
      updatedAt: 1,
    },
  ],
}

const models: WebApiCredentialProfileModelCatalogResponse = {
  profileId: "profile-1",
  profileName: "测试凭据",
  supported: true,
  models: [{ id: "gpt-4o-mini" }],
}

const verification: WebApiCredentialProfileVerificationResponse = {
  profileId: "profile-1",
  profileName: "测试凭据",
  report: {
    baseUrl: "https://api.example.com",
    apiType: "openai-compatible",
    modelId: "gpt-4o-mini",
    startedAt: 1,
    finishedAt: 31,
    results: [
      {
        id: "models",
        status: "pass",
        latencyMs: 30,
        summary: "Fetched 1 models",
      },
    ],
  },
}

describe("CredentialProfilesDialog", () => {
  it("keeps stored keys masked and supports model and verification actions", async () => {
    const user = userEvent.setup()
    const onLoadModels = vi.fn().mockResolvedValue(models)
    const onVerify = vi.fn().mockResolvedValue(verification)

    render(
      <CredentialProfilesDialog
        open
        busy={false}
        profiles={profiles}
        tags={[{ id: "tag-1", name: "生产", createdAt: 1, updatedAt: 1 }]}
        onClose={vi.fn()}
        onCreate={vi.fn().mockResolvedValue(undefined)}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onLoadModels={onLoadModels}
        onVerify={onVerify}
      />,
    )

    expect(screen.getByText(/sk-t/)).toBeInTheDocument()
    expect(screen.getByText("生产")).toBeInTheDocument()
    expect(screen.queryByText("sk-test-secret")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "查看模型" }))
    await waitFor(() =>
      expect(onLoadModels).toHaveBeenCalledWith(profiles.profiles[0]),
    )
    expect(await screen.findByText("gpt-4o-mini")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "验证凭据" }))
    await user.type(
      screen.getByRole("textbox", { name: "模型（可选）" }),
      "gpt-4o-mini",
    )
    await user.click(screen.getByRole("button", { name: "开始验证" }))
    await waitFor(() =>
      expect(onVerify).toHaveBeenCalledWith(
        profiles.profiles[0],
        "gpt-4o-mini",
      ),
    )
    expect(await screen.findByText("通过")).toBeInTheDocument()
  })

  it("creates a profile with the entered secret without rendering it after submit", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <CredentialProfilesDialog
        open
        busy={false}
        profiles={{ profiles: [], revision: 0 }}
        tags={[{ id: "tag-1", name: "生产", createdAt: 1, updatedAt: 1 }]}
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onLoadModels={vi.fn().mockResolvedValue(models)}
        onVerify={vi.fn().mockResolvedValue(verification)}
      />,
    )
    await user.click(screen.getByRole("button", { name: "新增凭据" }))
    await user.type(screen.getByRole("textbox", { name: "名称" }), "新凭据")
    await user.type(
      screen.getByRole("textbox", { name: "基础地址" }),
      "https://api.example.com/v1",
    )
    await user.type(screen.getByLabelText(/API 密钥/), "sk-new-secret")
    await user.click(screen.getByRole("checkbox", { name: "生产" }))
    await user.click(screen.getByRole("button", { name: "保存" }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "sk-new-secret",
          tagIds: ["tag-1"],
        }),
      ),
    )
    expect(screen.queryByText("sk-new-secret")).not.toBeInTheDocument()
  })
})

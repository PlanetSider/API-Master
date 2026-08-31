import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type {
  WebApiVerificationInput,
  WebApiVerificationModelsResponse,
  WebApiVerificationResponse,
} from "~/web/contracts"
import { WebApiCheckDialog } from "~~/web/components/WebApiCheckDialog"

const models: WebApiVerificationModelsResponse = {
  modelIds: ["gpt-web", "gpt-web-mini"],
}

const verification: WebApiVerificationResponse = {
  report: {
    baseUrl: "https://api.example.com",
    apiType: "openai-compatible",
    modelId: "gpt-web",
    startedAt: 1,
    finishedAt: 21,
    results: [
      {
        id: "models",
        status: "pass",
        latencyMs: 20,
        summary: "Fetched 2 models",
      },
    ],
  },
}

const renderDialog = (overrides: {
  onFetchModels?: (
    input: WebApiVerificationInput,
  ) => Promise<WebApiVerificationModelsResponse>
  onRunVerification?: (
    input: WebApiVerificationInput,
  ) => Promise<WebApiVerificationResponse>
} = {}) =>
  render(
    <WebApiCheckDialog
      open
      busy={false}
      onClose={vi.fn()}
      onFetchModels={
        overrides.onFetchModels ?? vi.fn().mockResolvedValue(models)
      }
      onRunVerification={
        overrides.onRunVerification ?? vi.fn().mockResolvedValue(verification)
      }
    />,
  )

describe("WebApiCheckDialog", () => {
  it("extracts a pasted URL and key, then discovers models", async () => {
    const user = userEvent.setup()
    const onFetchModels = vi.fn().mockResolvedValue(models)
    renderDialog({ onFetchModels })

    await user.type(
      screen.getByRole("textbox", { name: "粘贴配置文本" }),
      "base_url=https://api.example.com/v1 api_key=sk-pasted-secret",
    )
    await user.click(screen.getByRole("button", { name: "重新提取" }))
    expect(screen.getByRole("textbox", { name: "基础地址" })).toHaveValue(
      "https://api.example.com",
    )
    expect(screen.getByLabelText("API 密钥")).toHaveValue("sk-pasted-secret")

    await user.click(screen.getByRole("button", { name: "获取模型" }))
    await waitFor(() =>
      expect(onFetchModels).toHaveBeenCalledWith({
        apiType: "openai-compatible",
        baseUrl: "https://api.example.com",
        apiKey: "sk-pasted-secret",
      }),
    )
    expect(screen.getByLabelText("模型")).toHaveValue("gpt-web")
  })

  it("does not call the server when required fields are missing", async () => {
    const user = userEvent.setup()
    const onFetchModels = vi.fn().mockResolvedValue(models)
    renderDialog({ onFetchModels })

    await user.click(screen.getByRole("button", { name: "获取模型" }))

    expect(onFetchModels).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("请输入 API 基础地址")
  })

  it("keeps the key hidden by default and renders verification results", async () => {
    const user = userEvent.setup()
    const onRunVerification = vi.fn().mockResolvedValue(verification)
    renderDialog({ onRunVerification })

    await user.type(
      screen.getByRole("textbox", { name: "基础地址" }),
      "https://api.example.com",
    )
    await user.type(screen.getByLabelText("API 密钥"), "sk-secret")
    expect(screen.getByLabelText("API 密钥")).toHaveAttribute(
      "type",
      "password",
    )

    await user.click(screen.getByRole("button", { name: "开始检测" }))
    await waitFor(() =>
      expect(onRunVerification).toHaveBeenCalledWith({
        apiType: "openai-compatible",
        baseUrl: "https://api.example.com",
        apiKey: "sk-secret",
      }),
    )
    expect(await screen.findByText("通过")).toBeInTheDocument()
  })
})

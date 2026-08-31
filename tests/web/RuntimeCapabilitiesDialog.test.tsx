import { render, screen } from "@testing-library/react"

import { RuntimeCapabilitiesDialog } from "~~/web/components/RuntimeCapabilitiesDialog"

describe("RuntimeCapabilitiesDialog", () => {
  it("distinguishes server capabilities from browser-worker dependencies", () => {
    render(
      <RuntimeCapabilitiesDialog
        open
        onClose={vi.fn()}
        capabilities={{
          runtime: "web",
          browserWorker: { configured: false, connected: false },
          capabilities: [
            {
              id: "standard_http",
              state: "available",
              executor: "server",
            },
            {
              id: "saved_cookie_header",
              state: "limited",
              executor: "server",
            },
            {
              id: "turnstile",
              state: "requires_worker",
              executor: "browser_worker",
            },
          ],
        }}
      />,
    )

    expect(screen.getByRole("dialog", { name: "运行能力" })).toBeInTheDocument()
    expect(screen.getByText("标准 HTTP/API 请求")).toBeInTheDocument()
    expect(screen.getByText("已保存 Cookie 请求")).toBeInTheDocument()
    expect(screen.getByText("Turnstile 验证")).toBeInTheDocument()
    expect(screen.getByText("需要工作节点")).toBeInTheDocument()
    expect(
      screen.getByText(/尚未配置；依赖页面渲染的流程会明确报告不可用/),
    ).toBeInTheDocument()
  })
})

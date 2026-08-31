import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { WebExternalNotificationSettingsResponse } from "~/web/contracts"
import { ExternalNotificationSettingsDialog } from "~~/web/components/ExternalNotificationSettingsDialog"

const createSettings = (): WebExternalNotificationSettingsResponse => ({
  enabled: true,
  tasks: {
    account_refresh: true,
    auto_checkin: true,
    usage_history: true,
    balance_history: true,
    webdav_backup: true,
    site_announcements: true,
  },
  channels: {
    telegram: { enabled: false, configured: false },
    feishu: { enabled: false, configured: false },
    dingtalk: { enabled: false, configured: false },
    wecom: { enabled: false, configured: false },
    ntfy: { enabled: false, configured: false },
    webhook: { enabled: true, configured: true },
  },
  revision: 3,
})

describe("ExternalNotificationSettingsDialog", () => {
  it("submits task and channel settings without exposing saved secrets", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ExternalNotificationSettingsDialog
        open
        busy={false}
        settings={createSettings()}
        onClose={vi.fn()}
        onSave={onSave}
        onTest={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByText("已配置")).toBeInTheDocument()
    expect(
      screen.queryByDisplayValue(/hooks\.example/u),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: "自动签到" }))
    await user.click(screen.getByRole("checkbox", { name: "Telegram" }))
    await user.type(screen.getByRole("textbox", { name: "Chat ID" }), "-100123")
    await user.type(screen.getByLabelText("Bot Token"), "telegram-secret")
    await user.click(screen.getByRole("button", { name: "保存设置" }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          expectedRevision: 3,
          tasks: expect.objectContaining({ auto_checkin: false }),
          channels: expect.objectContaining({
            telegram: {
              enabled: true,
              botToken: "telegram-secret",
              chatId: "-100123",
            },
            webhook: { enabled: true },
          }),
        }),
      ),
    )
  })

  it("only enables test for configured channels", async () => {
    const user = userEvent.setup()
    const onTest = vi.fn().mockResolvedValue(undefined)
    render(
      <ExternalNotificationSettingsDialog
        open
        busy={false}
        settings={createSettings()}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onTest={onTest}
      />,
    )

    const testButtons = screen.getAllByRole("button", { name: "测试" })
    expect(testButtons[0]).toBeDisabled()
    expect(testButtons[5]).toBeEnabled()
    await user.click(testButtons[5])
    expect(onTest).toHaveBeenCalledWith("webhook")
  })
})

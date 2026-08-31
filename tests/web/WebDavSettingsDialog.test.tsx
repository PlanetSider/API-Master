import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { WebDavSettingsResponse } from "~/web/contracts"
import { WebDavSettingsDialog } from "~~/web/components/WebDavSettingsDialog"

const asyncHandler = () => vi.fn().mockResolvedValue(undefined)

const createSettings = (configured: boolean): WebDavSettingsResponse => ({
  settings: {
    url: configured ? "https://dav.example.com/backups/" : "",
    username: configured ? "backup-user" : "",
    configured,
    autoBackupEnabled: false,
    intervalMinutes: 60,
    encryptionEnabled: false,
  },
  revision: configured ? 2 : 0,
  runtime: { running: false },
})

describe("WebDavSettingsDialog", () => {
  it("submits new credentials and automatic encrypted backup settings", async () => {
    const user = userEvent.setup()
    const onSave = asyncHandler()
    render(
      <WebDavSettingsDialog
        open
        busy={false}
        settings={createSettings(false)}
        onClose={vi.fn()}
        onSave={onSave}
        onTest={asyncHandler()}
        onUpload={asyncHandler()}
        onRestore={asyncHandler()}
      />,
    )

    await user.type(
      screen.getByRole("textbox", { name: "WebDAV 地址" }),
      "https://dav.example.com/backups/",
    )
    await user.type(
      screen.getByRole("textbox", { name: "用户名" }),
      "backup-user",
    )
    await user.type(screen.getByLabelText("密码"), "dav-secret")
    await user.click(screen.getByRole("checkbox", { name: /加密远端备份/u }))
    await user.type(screen.getByLabelText("备份加密密码"), "encryption-secret")
    await user.click(screen.getByRole("checkbox", { name: "自动备份" }))
    const interval = screen.getByRole("spinbutton", { name: "间隔（分钟）" })
    await user.clear(interval)
    await user.type(interval, "30")
    await user.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        url: "https://dav.example.com/backups/",
        username: "backup-user",
        password: "dav-secret",
        autoBackupEnabled: true,
        intervalMinutes: 30,
        encryptionEnabled: true,
        encryptionPassword: "encryption-secret",
        expectedRevision: 0,
      }),
    )
  })

  it("requires confirmation before restoring a remote backup", async () => {
    const user = userEvent.setup()
    const onRestore = asyncHandler()
    render(
      <WebDavSettingsDialog
        open
        busy={false}
        settings={createSettings(true)}
        onClose={vi.fn()}
        onSave={asyncHandler()}
        onTest={asyncHandler()}
        onUpload={asyncHandler()}
        onRestore={onRestore}
      />,
    )

    await user.click(screen.getByRole("button", { name: "恢复" }))
    expect(onRestore).not.toHaveBeenCalled()
    expect(
      screen.getByRole("dialog", { name: "从 WebDAV 恢复" }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "确认恢复" }))
    expect(onRestore).toHaveBeenCalledOnce()
  })
})

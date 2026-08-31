import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ManagedSitesDialog } from "~~/web/components/ManagedSitesDialog"

const asyncHandler = () => vi.fn().mockResolvedValue(undefined)

describe("ManagedSitesDialog", () => {
  it("submits the credentials required by AxonHub and Claude Code Hub", async () => {
    const user = userEvent.setup()
    const onCreate = asyncHandler()

    render(
      <ManagedSitesDialog
        open
        busy={false}
        connections={null}
        channels={null}
        onClose={vi.fn()}
        onCreate={onCreate}
        onLoadChannels={asyncHandler()}
        onDeleteConnection={asyncHandler()}
        onDeleteChannel={asyncHandler()}
        onCreateChannel={asyncHandler()}
        onUpdateChannel={asyncHandler()}
        onSyncModels={asyncHandler()}
      />,
    )

    await user.selectOptions(
      screen.getByRole("combobox", { name: "站点类型" }),
      "axonhub",
    )
    expect(screen.getByLabelText("管理员邮箱")).toBeInTheDocument()
    expect(screen.queryByLabelText("管理员用户 ID")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("管理员 Token")).not.toBeInTheDocument()

    await user.type(screen.getByLabelText("连接名称"), "AxonHub")
    await user.type(
      screen.getByLabelText("站点地址"),
      "https://axonhub.example.com",
    )
    await user.type(screen.getByLabelText("管理员邮箱"), "admin@example.com")
    await user.type(screen.getByLabelText("管理员密码"), "axon-secret")
    await user.click(screen.getByRole("button", { name: "添加连接" }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          siteType: "axonhub",
          email: "admin@example.com",
          password: "axon-secret",
          adminToken: "",
          userId: "",
        }),
      ),
    )

    await user.selectOptions(
      screen.getByRole("combobox", { name: "站点类型" }),
      "claude-code-hub",
    )
    expect(screen.getByLabelText("管理员 Token")).toBeInTheDocument()
    expect(screen.queryByLabelText("管理员用户 ID")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("管理员邮箱")).not.toBeInTheDocument()

    await user.type(screen.getByLabelText("连接名称"), "Claude Code Hub")
    await user.type(
      screen.getByLabelText("站点地址"),
      "https://claude.example.com",
    )
    await user.type(screen.getByLabelText("管理员 Token"), "claude-secret")
    await user.click(screen.getByRole("button", { name: "添加连接" }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          siteType: "claude-code-hub",
          adminToken: "claude-secret",
          userId: "",
        }),
      ),
    )
  })
})

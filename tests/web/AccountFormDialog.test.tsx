import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AuthTypeEnum, SiteHealthStatus } from "~/types"
import type { WebAccountSummary } from "~/web/contracts"
import { AccountFormDialog } from "~~/web/components/AccountFormDialog"

const account: WebAccountSummary = {
  id: "account-1",
  name: "示例账户",
  baseUrl: "https://api.example.com",
  siteType: "new-api",
  authType: AuthTypeEnum.AccessToken,
  username: "user",
  userId: "7",
  disabled: false,
  pinned: false,
  tagIds: ["tag-1"],
  notes: "旧备注",
  health: { status: SiteHealthStatus.Healthy },
  balance: { USD: 1, CNY: 7.2 },
  todayConsumption: { USD: 0, CNY: 0 },
  lastSyncTime: 0,
  createdAt: 1,
  exchangeRate: 7.2,
}

describe("AccountFormDialog", () => {
  it("edits metadata while leaving a saved credential untouched", async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(
      <AccountFormDialog
        open
        loading={false}
        revision={4}
        account={account}
        tags={[
          { id: "tag-1", name: "生产", createdAt: 1, updatedAt: 1 },
          { id: "tag-2", name: "测试", createdAt: 1, updatedAt: 1 },
        ]}
        onClose={vi.fn()}
        onUpdate={onUpdate}
      />,
    )

    const name = screen.getByRole("textbox", { name: "账户名称" })
    await user.clear(name)
    await user.type(name, "新名称")
    await user.click(screen.getByRole("checkbox", { name: "测试" }))
    await user.click(screen.getByRole("button", { name: "保存修改" }))

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith("account-1", {
        name: "新名称",
        baseUrl: "https://api.example.com",
        authType: AuthTypeEnum.AccessToken,
        userId: "7",
        username: "user",
        exchangeRate: 7.2,
        tagIds: ["tag-1", "tag-2"],
        notes: "旧备注",
        expectedRevision: 4,
      }),
    )
  })
})

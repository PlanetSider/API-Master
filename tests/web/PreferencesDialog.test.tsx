import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PreferencesDialog } from "~~/web/components/PreferencesDialog"

describe("PreferencesDialog", () => {
  it("submits display, currency, and sorting preferences", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <PreferencesDialog
        open
        busy={false}
        settings={{
          preferences: {
            themeMode: "system",
            currencyType: "USD",
            showTodayCashflow: true,
            showHealthStatus: true,
            sortField: "balance",
            sortOrder: "desc",
          },
          revision: 3,
          updatedAt: 10,
          unsupportedExtensionKeys: ["activeTab"],
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    await user.selectOptions(screen.getByLabelText("主题"), "dark")
    await user.selectOptions(screen.getByLabelText("金额单位"), "CNY")
    await user.selectOptions(
      screen.getByLabelText("账户排序字段"),
      "created_at",
    )
    await user.selectOptions(screen.getByLabelText("排序方向"), "asc")
    await user.click(screen.getByRole("checkbox", { name: "显示健康状态" }))
    await user.click(screen.getByRole("button", { name: "保存设置" }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        themeMode: "dark",
        currencyType: "CNY",
        showTodayCashflow: true,
        showHealthStatus: false,
        sortField: "created_at",
        sortOrder: "asc",
        expectedRevision: 3,
      }),
    )
    expect(screen.getByText(/浏览器专属设置未导入/)).toBeInTheDocument()
  })
})

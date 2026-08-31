import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TagsDialog } from "~~/web/components/TagsDialog"

describe("TagsDialog", () => {
  it("creates and renames tags with accessible controls", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const onRename = vi.fn().mockResolvedValue(undefined)
    render(
      <TagsDialog
        open
        loading={false}
        data={{
          tags: [
            {
              id: "tag-1",
              name: "Production",
              createdAt: 1,
              updatedAt: 1,
            },
          ],
          revision: 1,
        }}
        onClose={vi.fn()}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.type(screen.getByRole("textbox", { name: "新标签名称" }), "Test")
    await user.click(screen.getByRole("button", { name: "创建" }))
    expect(onCreate).toHaveBeenCalledWith("Test")

    await user.click(
      screen.getByRole("button", { name: "重命名标签 Production" }),
    )
    const editInput = screen.getByRole("textbox", { name: "标签名称" })
    await user.clear(editInput)
    await user.type(editInput, "Critical")
    await user.click(
      screen.getByRole("button", { name: "保存标签 Production" }),
    )
    expect(onRename).toHaveBeenCalledWith("tag-1", "Critical")
  })

  it("requires confirmation before deleting a tag", async () => {
    const user = userEvent.setup()
    const tag = {
      id: "tag-1",
      name: "Production",
      createdAt: 1,
      updatedAt: 1,
    }
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(
      <TagsDialog
        open
        loading={false}
        data={{ tags: [tag], revision: 1 }}
        onClose={vi.fn()}
        onCreate={vi.fn().mockResolvedValue(undefined)}
        onRename={vi.fn().mockResolvedValue(undefined)}
        onDelete={onDelete}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "删除标签 Production" }),
    )
    expect(screen.getByRole("dialog", { name: "删除标签" })).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "确认删除" }))
    expect(onDelete).toHaveBeenCalledWith(tag)
  })
})

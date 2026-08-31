import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { WebBookmarkListResponse } from "~/web/contracts"
import { BookmarksDialog } from "~~/web/components/BookmarksDialog"

const emptyBookmarks: WebBookmarkListResponse = {
  bookmarks: [],
  pinnedBookmarkIds: [],
  revision: 0,
  lastUpdated: 0,
}

describe("BookmarksDialog", () => {
  it("creates a bookmark from the browser form", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <BookmarksDialog
        open
        busy={false}
        bookmarks={emptyBookmarks}
        tags={[{ id: "tag-1", name: "生产", createdAt: 1, updatedAt: 1 }]}
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText("名称"), "测试站点")
    await user.type(screen.getByLabelText("网址"), "https://example.com")
    await user.click(screen.getByRole("checkbox", { name: "生产" }))
    await user.click(screen.getByRole("button", { name: "添加书签" }))

    expect(onCreate).toHaveBeenCalledWith({
      name: "测试站点",
      url: "https://example.com",
      tagIds: ["tag-1"],
      notes: "",
    })
  })

  it("opens a bookmark and toggles its pinned state", async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    const bookmark = {
      id: "bookmark-1",
      name: "文档",
      url: "https://docs.example.com",
      tagIds: [],
      notes: "",
      pinned: false,
      createdAt: 1,
      updatedAt: 1,
    }
    render(
      <BookmarksDialog
        open
        busy={false}
        bookmarks={{
          ...emptyBookmarks,
          bookmarks: [bookmark],
        }}
        tags={[]}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "打开书签" }))
    await user.click(screen.getByRole("button", { name: "置顶书签" }))

    expect(openSpy).toHaveBeenCalledWith(
      "https://docs.example.com",
      "_blank",
      "noopener,noreferrer",
    )
    expect(onUpdate).toHaveBeenCalledWith("bookmark-1", { pinned: true })
    openSpy.mockRestore()
  })
})

import { EncryptedDocumentStore } from "~~/server/encryptedDocumentStore"

describe("EncryptedDocumentStore transactions", () => {
  it("commits multiple encrypted documents together", () => {
    const store = new EncryptedDocumentStore(":memory:", "transaction-secret")
    try {
      store.transaction((transaction) => {
        transaction.write("first", { value: 1 }, 0)
        transaction.write("second", { value: 2 }, 0)
      })

      expect(store.exportDocuments()).toMatchObject([
        { key: "first", data: { value: 1 }, revision: 1 },
        { key: "second", data: { value: 2 }, revision: 1 },
      ])
    } finally {
      store.close()
    }
  })

  it("rolls every document back when a transaction fails", () => {
    const store = new EncryptedDocumentStore(":memory:", "transaction-secret")
    try {
      store.write("second", { value: 1 })

      expect(() =>
        store.transaction((transaction) => {
          transaction.write("first", { value: 1 }, 0)
          transaction.write("second", { value: 2 }, 0)
        }),
      ).toThrow()

      expect(store.exportDocuments()).toMatchObject([
        { key: "second", data: { value: 1 }, revision: 1 },
      ])
    } finally {
      store.close()
    }
  })
})

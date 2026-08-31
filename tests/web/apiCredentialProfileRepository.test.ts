import { describe, expect, it } from "vitest"

import {
  ApiCredentialProfileRepository,
  toWebApiCredentialProfile,
} from "~~/server/apiCredentialProfileRepository"
import { EncryptedDocumentStore } from "~~/server/encryptedDocumentStore"

describe("API credential profile repository", () => {
  it("normalizes URLs and never exposes the stored key in the public view", () => {
    const store = new EncryptedDocumentStore(":memory:", "profile-test-secret")
    const repository = new ApiCredentialProfileRepository(store)

    const created = repository.create({
      name: "OpenAI profile",
      apiType: "openai-compatible",
      baseUrl: "https://api.example.test/v1/?ignored=true",
      apiKey: "sk-profile-secret",
      tagIds: ["tag-1", "tag-1", " "],
      notes: "production",
    })

    expect(created.profiles).toHaveLength(1)
    expect(created.profiles[0]).toMatchObject({
      name: "OpenAI profile",
      baseUrl: "https://api.example.test",
      apiKeyMasked: "sk-p••••cret",
      tagIds: ["tag-1"],
      notes: "production",
    })
    expect(JSON.stringify(created)).not.toContain("sk-profile-secret")
    expect(repository.get(created.profiles[0]!.id)?.apiKey).toBe(
      "sk-profile-secret",
    )

    store.close()
  })

  it("updates metadata and rotates a secret only when a new key is supplied", () => {
    const store = new EncryptedDocumentStore(":memory:", "profile-test-secret")
    const repository = new ApiCredentialProfileRepository(store)
    const created = repository.create({
      name: "Profile",
      apiType: "google",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "google-secret",
    })
    const id = created.profiles[0]!.id

    repository.update(id, {
      name: "Renamed",
      tagIds: ["tag-2"],
      notes: "updated",
    })
    expect(repository.get(id)).toMatchObject({
      name: "Renamed",
      tagIds: ["tag-2"],
      notes: "updated",
      apiKey: "google-secret",
      baseUrl: "https://generativelanguage.googleapis.com",
    })

    repository.update(id, { apiKey: "google-secret-2" })
    expect(repository.get(id)?.apiKey).toBe("google-secret-2")
    expect(repository.delete(id).profiles).toHaveLength(0)
    store.close()
  })

  it("rejects malformed profile URLs", () => {
    const store = new EncryptedDocumentStore(":memory:", "profile-test-secret")
    const repository = new ApiCredentialProfileRepository(store)
    expect(() =>
      repository.create({
        name: "Invalid",
        apiType: "openai",
        baseUrl: "not a url",
        apiKey: "secret",
      }),
    ).toThrow("Base URL is invalid")
    store.close()
  })

  it("masks short keys without retaining a reversible public value", () => {
    expect(
      toWebApiCredentialProfile({
        id: "id",
        name: "name",
        apiType: "openai",
        baseUrl: "https://example.test",
        apiKey: "short",
        tagIds: [],
        notes: "",
        createdAt: 1,
        updatedAt: 1,
      }).apiKeyMasked,
    ).toBe("••••••••")
  })
})

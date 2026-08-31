import { randomUUID } from "node:crypto"

import type {
  WebManagedSiteConnection,
  WebManagedSiteConnectionInput,
  WebManagedSiteConnectionListResponse,
} from "~/web/contracts"

import { type EncryptedDocumentStore } from "./encryptedDocumentStore"

const KEY = "managed-site-connections"

export interface StoredManagedSiteConnection extends WebManagedSiteConnection {
  adminToken: string
  username?: string
  password?: string
  email?: string
}

interface Document {
  connections: StoredManagedSiteConnection[]
}

const empty = (): Document => ({ connections: [] })
const normalize = (value: unknown): Document =>
  value &&
  typeof value === "object" &&
  Array.isArray((value as Partial<Document>).connections)
    ? (value as Document)
    : empty()

export const toWebManagedSiteConnection = ({
  id,
  name,
  siteType,
  baseUrl,
  userId,
  createdAt,
}: StoredManagedSiteConnection): WebManagedSiteConnection => ({
  id,
  name,
  siteType,
  baseUrl,
  userId,
  createdAt,
})

export class ManagedSiteRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  list(): WebManagedSiteConnectionListResponse {
    const document = this.store.read(KEY, empty, normalize)
    return {
      connections: document.data.connections.map(toWebManagedSiteConnection),
      revision: document.revision,
    }
  }

  get(id: string) {
    return this.store
      .read(KEY, empty, normalize)
      .data.connections.find((connection) => connection.id === id)
  }

  create(input: WebManagedSiteConnectionInput) {
    const connection: StoredManagedSiteConnection = {
      id: randomUUID(),
      name: input.name.trim(),
      siteType: input.siteType,
      baseUrl: new URL(input.baseUrl).origin,
      adminToken: input.adminToken.trim(),
      userId: input.userId.trim(),
      ...(input.username?.trim() ? { username: input.username.trim() } : {}),
      ...(input.password?.trim() ? { password: input.password.trim() } : {}),
      ...(input.email?.trim() ? { email: input.email.trim() } : {}),
      createdAt: Date.now(),
    }
    this.store.mutate(KEY, empty, normalize, (document) => ({
      connections: [...document.connections, connection],
    }))
    return this.list()
  }

  delete(id: string) {
    this.store.mutate(KEY, empty, normalize, (document) => ({
      connections: document.connections.filter(
        (connection) => connection.id !== id,
      ),
    }))
    return this.list()
  }
}

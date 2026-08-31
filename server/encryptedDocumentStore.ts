import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

import { StateCipher } from "./crypto"

type StateRow = {
  encrypted_value: string
  revision: number
  updated_at: number
}

type StateRowWithKey = StateRow & { key: string }

export interface PortableDocument {
  key: string
  data: unknown
  revision: number
  updatedAt: number
}

export interface VersionedDocument<T> {
  data: T
  revision: number
  updatedAt: number
}

export interface EncryptedDocumentTransaction {
  read<T>(
    key: string,
    createDefault: () => T,
    normalize: (raw: unknown) => T,
  ): VersionedDocument<T>
  write<T>(
    key: string,
    value: T,
    expectedRevision?: number,
  ): VersionedDocument<T>
}

export class RevisionConflictError extends Error {
  constructor(
    public readonly expectedRevision: number,
    public readonly actualRevision: number,
  ) {
    super("The persisted document changed before this request completed")
    this.name = "RevisionConflictError"
  }
}

export class EncryptedDocumentStore {
  private readonly database: DatabaseSync
  private readonly cipher: StateCipher

  constructor(databasePath: string, encryptionSecret: string) {
    if (databasePath !== ":memory:") {
      fs.mkdirSync(path.dirname(databasePath), { recursive: true })
    }

    this.database = new DatabaseSync(databasePath)
    this.cipher = new StateCipher(encryptionSecret)
    this.database.exec("PRAGMA journal_mode = WAL")
    this.database.exec("PRAGMA busy_timeout = 5000")
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS encrypted_documents (
        key TEXT PRIMARY KEY,
        encrypted_value TEXT NOT NULL,
        revision INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT
    `)
  }

  close() {
    this.database.close()
  }

  read<T>(
    key: string,
    createDefault: () => T,
    normalize: (raw: unknown) => T,
  ): VersionedDocument<T> {
    const row = this.readRow(key)
    if (!row) {
      return { data: createDefault(), revision: 0, updatedAt: 0 }
    }

    return {
      data: normalize(this.cipher.decrypt<unknown>(row.encrypted_value)),
      revision: row.revision,
      updatedAt: row.updated_at,
    }
  }

  write<T>(
    key: string,
    value: T,
    expectedRevision?: number,
  ): VersionedDocument<T> {
    return this.transaction((transaction) =>
      transaction.write(key, value, expectedRevision),
    )
  }

  mutate<T>(
    key: string,
    createDefault: () => T,
    normalize: (raw: unknown) => T,
    mutation: (current: T) => T,
    expectedRevision?: number,
  ): VersionedDocument<T> {
    return this.transaction((transaction) => {
      const current = transaction.read(key, createDefault, normalize)
      return transaction.write(
        key,
        mutation(structuredClone(current.data)),
        expectedRevision,
      )
    })
  }

  transaction<TResult>(
    callback: (transaction: EncryptedDocumentTransaction) => TResult,
  ): TResult {
    this.database.exec("BEGIN IMMEDIATE")
    try {
      const transaction: EncryptedDocumentTransaction = {
        read: <T>(
          key: string,
          createDefault: () => T,
          normalize: (raw: unknown) => T,
        ) => {
          const row = this.readRow(key)
          if (!row) {
            return { data: createDefault(), revision: 0, updatedAt: 0 }
          }
          return {
            data: normalize(this.cipher.decrypt<unknown>(row.encrypted_value)),
            revision: row.revision,
            updatedAt: row.updated_at,
          }
        },
        write: <T>(key: string, value: T, expectedRevision?: number) => {
          const currentRevision = this.readRow(key)?.revision ?? 0
          this.assertRevision(expectedRevision, currentRevision)
          return this.writeWithinTransaction(key, value, currentRevision)
        },
      }
      const result = callback(transaction)
      this.database.exec("COMMIT")
      return result
    } catch (error) {
      this.database.exec("ROLLBACK")
      throw error
    }
  }

  exportDocuments(): PortableDocument[] {
    const rows = this.database
      .prepare(
        `SELECT key, encrypted_value, revision, updated_at
         FROM encrypted_documents
         ORDER BY key`,
      )
      .all() as unknown as StateRowWithKey[]

    return rows.map((row) => ({
      key: row.key,
      data: this.cipher.decrypt<unknown>(row.encrypted_value),
      revision: row.revision,
      updatedAt: row.updated_at,
    }))
  }

  replaceDocuments(documents: PortableDocument[]) {
    this.database.exec("BEGIN IMMEDIATE")
    try {
      const currentRevisions = new Map(
        (
          this.database
            .prepare("SELECT key, revision FROM encrypted_documents")
            .all() as unknown as Array<{ key: string; revision: number }>
        ).map((row) => [row.key, row.revision]),
      )
      const insert = this.database.prepare(
        `INSERT INTO encrypted_documents
           (key, encrypted_value, revision, updated_at)
         VALUES (?, ?, ?, ?)`,
      )

      this.database.exec("DELETE FROM encrypted_documents")
      const restoredAt = Date.now()
      for (const document of documents) {
        const revision =
          Math.max(document.revision, currentRevisions.get(document.key) ?? 0) +
          1
        insert.run(
          document.key,
          this.cipher.encrypt(document.data),
          revision,
          restoredAt,
        )
      }
      this.database.exec("COMMIT")
    } catch (error) {
      this.database.exec("ROLLBACK")
      throw error
    }
  }

  private readRow(key: string) {
    return this.database
      .prepare(
        `SELECT encrypted_value, revision, updated_at
         FROM encrypted_documents
         WHERE key = ?`,
      )
      .get(key) as StateRow | undefined
  }

  private writeWithinTransaction<T>(
    key: string,
    value: T,
    currentRevision: number,
  ): VersionedDocument<T> {
    const now = Date.now()
    const revision = currentRevision + 1
    const encryptedValue = this.cipher.encrypt(value)

    this.database
      .prepare(
        `INSERT INTO encrypted_documents (key, encrypted_value, revision, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           encrypted_value = excluded.encrypted_value,
           revision = excluded.revision,
           updated_at = excluded.updated_at`,
      )
      .run(key, encryptedValue, revision, now)

    return { data: value, revision, updatedAt: now }
  }

  private assertRevision(expected: number | undefined, actual: number) {
    if (expected !== undefined && expected !== actual) {
      throw new RevisionConflictError(expected, actual)
    }
  }
}

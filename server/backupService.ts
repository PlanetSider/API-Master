import { z } from "zod"

import {
  WEB_BACKUP_TYPE,
  WEB_BACKUP_VERSION,
  type WebBackup,
} from "~/web/contracts"

import { type EncryptedDocumentStore } from "./encryptedDocumentStore"

export const webBackupSchema = z
  .object({
    type: z.literal(WEB_BACKUP_TYPE),
    version: z.literal(WEB_BACKUP_VERSION),
    createdAt: z.number().int().nonnegative(),
    documents: z
      .array(
        z.object({
          key: z
            .string()
            .min(1)
            .max(128)
            .regex(/^[a-z0-9][a-z0-9-]*$/u),
          data: z.unknown(),
          revision: z.number().int().positive(),
          updatedAt: z.number().int().nonnegative(),
        }),
      )
      .max(64),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>()
    value.documents.forEach((document, index) => {
      if (seen.has(document.key)) {
        context.addIssue({
          code: "custom",
          path: ["documents", index, "key"],
          message: "Backup document keys must be unique",
        })
      }
      seen.add(document.key)
    })
  })

export const parseWebBackup = (value: unknown): WebBackup =>
  webBackupSchema.parse(value) as WebBackup

export class BackupService {
  constructor(private readonly store: EncryptedDocumentStore) {}

  export(): WebBackup {
    return {
      type: WEB_BACKUP_TYPE,
      version: WEB_BACKUP_VERSION,
      createdAt: Date.now(),
      documents: this.store.exportDocuments(),
    }
  }

  restore(backup: WebBackup) {
    this.store.replaceDocuments(backup.documents)
    return { restoredDocuments: backup.documents.length }
  }
}

import type {
  WebNotificationListResponse,
  WebNotificationRecord,
} from "~/web/contracts"

import { type EncryptedDocumentStore } from "./encryptedDocumentStore"

const NOTIFICATION_DOCUMENT_KEY = "notifications"
const MAX_NOTIFICATIONS = 200

interface NotificationDocument {
  notifications: WebNotificationRecord[]
}

const createEmptyDocument = (): NotificationDocument => ({ notifications: [] })

const normalizeDocument = (value: unknown): NotificationDocument => {
  if (!value || typeof value !== "object") return createEmptyDocument()
  const notifications = (value as Partial<NotificationDocument>).notifications
  return {
    notifications: Array.isArray(notifications)
      ? notifications
          .filter(
            (item): item is WebNotificationRecord =>
              Boolean(item) &&
              typeof item.id === "string" &&
              typeof item.title === "string" &&
              typeof item.message === "string" &&
              typeof item.createdAt === "number",
          )
          .slice(0, MAX_NOTIFICATIONS)
      : [],
  }
}

export class NotificationRepository {
  constructor(private readonly store: EncryptedDocumentStore) {}

  get(): WebNotificationListResponse {
    const document = this.store.read(
      NOTIFICATION_DOCUMENT_KEY,
      createEmptyDocument,
      normalizeDocument,
    )
    return {
      notifications: document.data.notifications,
      unreadCount: document.data.notifications.filter((item) => !item.readAt)
        .length,
      revision: document.revision,
    }
  }

  add(notification: WebNotificationRecord) {
    return this.store.mutate(
      NOTIFICATION_DOCUMENT_KEY,
      createEmptyDocument,
      normalizeDocument,
      (document) => ({
        notifications: [notification, ...document.notifications].slice(
          0,
          MAX_NOTIFICATIONS,
        ),
      }),
    )
  }

  markAllRead() {
    const now = Date.now()
    return this.store.mutate(
      NOTIFICATION_DOCUMENT_KEY,
      createEmptyDocument,
      normalizeDocument,
      (document) => ({
        notifications: document.notifications.map((notification) =>
          notification.readAt ? notification : { ...notification, readAt: now },
        ),
      }),
    )
  }
}

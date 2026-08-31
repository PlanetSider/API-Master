import { randomUUID } from "node:crypto"

import type {
  WebNotificationRecord,
  WebNotificationTask,
} from "~/web/contracts"

import type { ExternalNotificationService } from "./externalNotificationService"
import type { NotificationRepository } from "./notificationRepository"

const TASK_NAMES: Record<WebNotificationTask, string> = {
  account_refresh: "账户刷新",
  auto_checkin: "自动签到",
  usage_history: "用量同步",
  balance_history: "余额历史",
  webdav_backup: "WebDAV 备份",
  site_announcements: "网站公告",
}

export type WebNotificationInput = Pick<
  WebNotificationRecord,
  "task" | "status" | "counts"
> & { message?: string }

export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly externalNotifications?: ExternalNotificationService,
  ) {}

  notify(input: WebNotificationInput) {
    const taskName = TASK_NAMES[input.task]
    const statusLabel =
      input.status === "success"
        ? "成功"
        : input.status === "partial_success"
          ? "部分成功"
          : "失败"
    const counts = input.counts
    const countMessage = counts
      ? `总计 ${counts.total ?? 0}，成功 ${counts.success ?? 0}，失败 ${counts.failed ?? 0}，跳过 ${counts.skipped ?? 0}`
      : ""
    const record: WebNotificationRecord = {
      id: randomUUID(),
      task: input.task,
      status: input.status,
      title: `${taskName}${statusLabel}`,
      message:
        input.message?.trim() || countMessage || `${taskName}${statusLabel}`,
      createdAt: Date.now(),
      ...(counts ? { counts } : {}),
    }
    this.repository.add(record)
    void this.externalNotifications?.deliver(record).catch(() => undefined)
    return record
  }
}

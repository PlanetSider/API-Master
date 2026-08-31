import type { WebNotificationListResponse } from "~/web/contracts"

import { WebDialog } from "./WebDialog"

interface NotificationCenterDialogProps {
  open: boolean
  notifications: WebNotificationListResponse | null
  onClose: () => void
  onMarkAllRead: () => Promise<void>
}

export function NotificationCenterDialog({
  open,
  notifications,
  onClose,
  onMarkAllRead,
}: NotificationCenterDialogProps) {
  return (
    <WebDialog
      open={open}
      onClose={onClose}
      title="通知中心"
      description="后台刷新、签到和同步任务的运行结果。"
      footer={
        <button
          type="button"
          disabled={!notifications?.unreadCount}
          onClick={() => void onMarkAllRead()}
          className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          全部标记已读
        </button>
      }
    >
      {!notifications || notifications.notifications.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">暂无通知</p>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {notifications.notifications.map((notification) => (
            <article
              key={notification.id}
              className="py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{notification.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {notification.message}
                  </p>
                </div>
                {!notification.readAt ? (
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-600" />
                ) : null}
              </div>
              <time className="mt-2 block text-xs text-gray-400">
                {new Intl.DateTimeFormat("zh-CN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(notification.createdAt)}
              </time>
            </article>
          ))}
        </div>
      )}
    </WebDialog>
  )
}

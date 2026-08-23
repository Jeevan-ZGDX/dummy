'use client'

import { useTranslation } from 'react-i18next'
import { Card, Button } from '@comp-dash/design-system'
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@comp-dash/api'
import { CheckCheck } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

export default function NotificationsPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { data, isLoading } = useNotifications({ limit: 50 })
  const { mutate: markAllRead } = useMarkAllNotificationsRead()
  const { mutate: markRead } = useMarkNotificationRead()

  const notifications = data?.data || []

  const timeAgo = (dateStr: string) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const handleMarkAllRead = () => {
    markAllRead(undefined, {
      onSuccess: () => toast('success', 'All notifications marked as read'),
    })
  }

  const handleMarkRead = (id: string) => {
    markRead(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-ink-primary">{t('sidebar.notifications')}</h1>
          {data && data.unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-1 dark:text-obsidian-faint">{data.unreadCount} unread</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
          <CheckCheck className="w-4 h-4 mr-2" />
          {t('notifications.markAllRead')}
        </Button>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse dark:bg-obsidian-hover" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-1/3 animate-pulse dark:bg-obsidian-hover" />
                    <div className="h-3 bg-gray-100 rounded w-2/3 animate-pulse dark:bg-obsidian-hover" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleMarkRead(notification.id)}
                className={`w-full text-left p-4 transition-colors hover:bg-gray-50 dark:hover:bg-obsidian-hover ${
                  !notification.isRead ? 'bg-accent/5' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      !notification.isRead ? 'bg-accent' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!notification.isRead ? 'font-semibold text-gray-900 dark:text-ink-primary' : 'font-medium text-gray-700 dark:text-ink-muted'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 dark:text-obsidian-faint">{notification.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1 dark:text-obsidian-faint">{timeAgo(notification.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-obsidian-faint">No notifications yet</div>
        )}
      </Card>
    </div>
  )
}

export type NotificationType = 'verification_update' | 'new_competition' | 'deadline_reminder' | 'registration_confirmed' | 'registration_rejected' | 'system' | 'winner_announced'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  data: Record<string, unknown> | null
  isRead: boolean
  createdAt: string
}

export interface NotificationListResponse {
  data: Notification[]
  total: number
  unreadCount: number
  page: number
  limit: number
}

export interface NotificationGroup {
  label: string
  notifications: Notification[]
}

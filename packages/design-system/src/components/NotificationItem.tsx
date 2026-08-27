import { cn } from '../utils/cn'
import { type NotificationType } from '@comp-dash/types'

interface NotificationItemProps {
  type: NotificationType
  title: string
  message: string
  time: string
  isRead: boolean
  onPress?: () => void
  className?: string
}

const typeColors: Record<NotificationType, { bg: string; icon: string }> = {
  verification_update: { bg: 'bg-success-light dark:bg-emerald-500/15', icon: 'text-success' },
  new_competition: { bg: 'bg-primary-100 dark:bg-uv/15', icon: 'text-primary-600 dark:text-uv' },
  deadline_reminder: { bg: 'bg-warning-light dark:bg-amber-500/15', icon: 'text-warning' },
  registration_confirmed: { bg: 'bg-info-light dark:bg-blue-500/15', icon: 'text-info' },
  registration_rejected: { bg: 'bg-error-light dark:bg-red-500/15', icon: 'text-error' },
  system: { bg: 'bg-gray-100 dark:bg-obsidian-hover', icon: 'text-gray-600 dark:text-ink-muted' },
  winner_announced: { bg: 'bg-accent-light dark:bg-striver/15', icon: 'text-accent dark:text-striver' },
}

const typeIcons: Record<NotificationType, string> = {
  verification_update: '✓',
  new_competition: '🏆',
  deadline_reminder: '⏰',
  registration_confirmed: '📋',
  registration_rejected: '✕',
  system: '⚙',
  winner_announced: '🎉',
}

export function NotificationItem({
  type,
  title,
  message,
  time,
  isRead,
  onPress,
  className,
}: NotificationItemProps) {
  const colors = typeColors[type]
  const icon = typeIcons[type]

  return (
    <button
      onClick={onPress}
      className={cn(
        'w-full flex items-start gap-3 p-4 text-left transition-colors duration-150',
        'hover:bg-gray-50 rounded-2xl dark:hover:bg-obsidian-hover',
        !isRead && 'bg-primary-50/50 dark:bg-gemini/10',
        className
      )}
    >
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-base', colors.bg, colors.icon)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium text-gray-900 dark:text-ink-primary', !isRead && 'font-semibold')}>
            {title}
          </p>
          {!isRead && (
            <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-ink-muted mt-0.5 line-clamp-2">{message}</p>
        <p className="text-xs text-gray-400 dark:text-obsidian-faint mt-1">{time}</p>
      </div>
    </button>
  )
}

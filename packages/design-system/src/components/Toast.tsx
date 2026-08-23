import { cn } from '../utils/cn'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

interface ToastProps {
  type?: 'success' | 'error' | 'warning' | 'info'
  message: string
  onClose?: () => void
  className?: string
}

const typeConfig = {
  success: { icon: CheckCircle, bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800/60', text: 'text-emerald-800 dark:text-emerald-300', iconColor: 'text-emerald-500 dark:text-emerald-400' },
  error: { icon: AlertCircle, bg: 'bg-red-50 border-red-200 dark:bg-red-950/60 dark:border-red-800/60', text: 'text-red-800 dark:text-red-300', iconColor: 'text-red-500 dark:text-red-400' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:border-amber-800/60', text: 'text-amber-800 dark:text-amber-300', iconColor: 'text-amber-500 dark:text-amber-400' },
  info: { icon: Info, bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:border-blue-800/60', text: 'text-blue-800 dark:text-blue-300', iconColor: 'text-blue-500 dark:text-blue-400' },
}

export function Toast({ type = 'info', message, onClose, className }: ToastProps) {
  const config = typeConfig[type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-2xl shadow-lg border',
        config.bg,
        config.text,
        className
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0', config.iconColor)} />
      <p className="text-sm font-medium flex-1">{message}</p>
      {onClose && (
        <button onClick={onClose} className="flex-shrink-0 opacity-70 hover:opacity-100" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

import { type ReactNode } from 'react'
import { cn } from '../utils/cn'
import { Card } from './Card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: ReactNode
  className?: string
}

export function StatCard({ title, value, change, changeLabel, icon, className }: StatCardProps) {
  return (
    <Card padding="lg" className={cn('', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500 dark:text-ink-muted">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-ink-primary tracking-tight">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5">
              {change > 0 ? (
                <TrendingUp className="w-4 h-4 text-success" />
              ) : change < 0 ? (
                <TrendingDown className="w-4 h-4 text-error" />
              ) : (
                <Minus className="w-4 h-4 text-gray-400 dark:text-obsidian-faint" />
              )}
              <span
                className={cn(
                  'text-sm font-medium',
                  change > 0 && 'text-success',
                  change < 0 && 'text-error',
                  change === 0 && 'text-gray-500'
                )}
              >
                {change > 0 ? '+' : ''}{change}%
              </span>
              {changeLabel && (
                <span className="text-sm text-gray-500 dark:text-ink-muted">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 dark:bg-gemini/10 dark:text-gemini">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}

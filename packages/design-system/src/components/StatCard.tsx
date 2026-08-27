import { type ReactNode } from 'react'
import { cn } from '../utils/cn'
import { Card, IconTile } from './Card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: ReactNode
  /** Tint of the icon tile. Use it to group related stats, not to decorate. */
  tone?: 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  className?: string
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  tone = 'accent',
  className,
}: StatCardProps) {
  const direction = change === undefined ? null : change > 0 ? 'up' : change < 0 ? 'down' : 'flat'

  return (
    <Card padding="lg" className={cn('', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium uppercase tracking-wide text-gray-500 dark:text-ink-muted">
            {title}
          </p>
          {/*
            The serif and tabular figures are what make a number read as a
            headline figure rather than as large body text, and stop it from
            reflowing as the value updates.
          */}
          <p className="mt-2 font-display text-[2rem] leading-none font-medium tracking-tight tabular text-gray-900 dark:text-ink-primary">
            {value}
          </p>
          {direction && (
            <div className="mt-3 flex items-center gap-1.5">
              {direction === 'up' && <TrendingUp className="w-4 h-4 text-success" aria-hidden="true" />}
              {direction === 'down' && <TrendingDown className="w-4 h-4 text-error" aria-hidden="true" />}
              {direction === 'flat' && <Minus className="w-4 h-4 text-gray-400" aria-hidden="true" />}
              <span
                className={cn(
                  'text-sm font-medium tabular',
                  direction === 'up' && 'text-success',
                  direction === 'down' && 'text-error',
                  direction === 'flat' && 'text-gray-500 dark:text-ink-muted'
                )}
              >
                {change! > 0 ? '+' : ''}
                {change}%
              </span>
              {changeLabel && (
                <span className="text-sm text-gray-500 dark:text-ink-muted">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <IconTile tone={tone} size="md" aria-hidden="true">
            {icon}
          </IconTile>
        )}
      </div>
    </Card>
  )
}

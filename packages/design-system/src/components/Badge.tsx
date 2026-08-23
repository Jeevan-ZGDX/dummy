import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-full font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-700 dark:bg-obsidian-hover dark:text-ink-muted',
        primary: 'bg-primary-100 text-primary-700 dark:bg-uv/15 dark:text-uv',
        accent: 'bg-accentLight text-accentDark dark:bg-striver/15 dark:text-striver',
        success: 'bg-successLight text-successDark dark:bg-emerald-500/15 dark:text-emerald-300',
        warning: 'bg-warningLight text-warningDark dark:bg-amber-500/15 dark:text-amber-300',
        danger: 'bg-errorLight text-errorDark dark:bg-red-500/15 dark:text-red-300',
        info: 'bg-infoLight text-infoDark dark:bg-blue-500/15 dark:text-blue-300',
        outline: 'border border-gray-200 bg-transparent text-gray-600 dark:border-obsidian-border dark:text-ink-muted',
      },
      size: {
        xs: 'px-2 py-0.5 text-[10px]',
        sm: 'px-2.5 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full mr-1.5',
            variant === 'success' && 'bg-success',
            variant === 'warning' && 'bg-warning',
            variant === 'danger' && 'bg-error',
            variant === 'info' && 'bg-info',
            variant === 'primary' && 'bg-primary-500',
            variant === 'accent' && 'bg-accent',
            (!variant || variant === 'default') && 'bg-gray-500'
          )}
        />
      )}
      {children}
    </span>
  )
}

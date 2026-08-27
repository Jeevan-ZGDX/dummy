import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils/cn'

/**
 * Status pills.
 *
 * Every tinted variant previously used a camelCase colour name that Tailwind
 * never generated, so these rendered as bare text on no background. The
 * hyphenated names below are the classes the theme actually produces.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-700 dark:bg-obsidian-hover dark:text-ink-muted',
        primary: 'bg-primary-100 text-primary-700 dark:bg-accent/15 dark:text-primary-300',
        accent: 'bg-accent-light text-accent-dark dark:bg-accent/15 dark:text-primary-300',
        success: 'bg-success-light text-success-dark dark:bg-success/20 dark:text-success',
        warning: 'bg-warning-light text-warning-dark dark:bg-warning/20 dark:text-warning',
        danger: 'bg-error-light text-error-dark dark:bg-error/20 dark:text-error',
        info: 'bg-info-light text-info-dark dark:bg-info/20 dark:text-info',
        outline: 'border border-gray-300 bg-transparent text-gray-600 dark:border-obsidian-border dark:text-ink-muted',
      },
      size: {
        xs: 'px-2 py-0.5 text-[10px] gap-1',
        sm: 'px-2.5 py-1 text-xs gap-1.5',
        md: 'px-3 py-1 text-sm gap-1.5',
        lg: 'px-3.5 py-1.5 text-sm gap-2',
      },
    },
    defaultVariants: { variant: 'default', size: 'sm' },
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
          aria-hidden="true"
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            variant === 'success' && 'bg-success',
            variant === 'warning' && 'bg-warning',
            variant === 'danger' && 'bg-error',
            variant === 'info' && 'bg-info',
            variant === 'primary' && 'bg-accent',
            variant === 'accent' && 'bg-accent',
            (!variant || variant === 'default' || variant === 'outline') && 'bg-gray-400'
          )}
        />
      )}
      {children}
    </span>
  )
}

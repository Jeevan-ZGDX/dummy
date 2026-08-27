import { forwardRef, type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils/cn'

/**
 * White surface on the cream page.
 *
 * The separation comes from a hairline border plus a very soft shadow rather
 * than a heavy drop shadow — on a warm background a strong grey shadow reads as
 * smudge. Radius is generous (22px) to match the card idiom used across the app.
 */
const cardVariants = cva(
  'bg-white text-gray-900 rounded-2xl dark:bg-obsidian-surface dark:text-ink-primary',
  {
    variants: {
      variant: {
        default: 'border border-gray-200 shadow-card dark:border-obsidian-border',
        elevated: 'border border-gray-200 shadow-elevated dark:border-obsidian-border',
        outlined: 'border border-gray-200 dark:border-obsidian-border',
        ghost: 'border-none shadow-none bg-transparent dark:bg-transparent',
        interactive:
          'border border-gray-200 shadow-card cursor-pointer transition-shadow duration-200 hover:shadow-cardHover dark:border-obsidian-border dark:hover:border-obsidian-hover',
      },
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-5',
        lg: 'p-6',
        xl: 'p-8',
      },
    },
    defaultVariants: { variant: 'default', padding: 'md' },
  }
)

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, padding, className }))} {...props} />
  )
)
Card.displayName = 'Card'

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

/** Section titles take the serif, which is what separates them from body text. */
export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'font-display text-lg font-medium tracking-tight text-gray-900 dark:text-ink-primary',
        className
      )}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm leading-relaxed text-gray-500 dark:text-ink-muted', className)} {...props} />
  )
)
CardDescription.displayName = 'CardDescription'

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('', className)} {...props} />
)
CardContent.displayName = 'CardContent'

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'

/**
 * The soft tinted square behind an icon — the motif that carries the card
 * layouts. Tints are held at ~10% so the icon, not the tile, is what reads.
 */
const iconTileVariants = cva(
  'inline-flex items-center justify-center shrink-0 rounded-xl',
  {
    variants: {
      tone: {
        accent: 'bg-accent-light text-accent-dark dark:bg-accent/15 dark:text-primary-300',
        info: 'bg-info-light text-info-dark dark:bg-info/15 dark:text-info',
        success: 'bg-success-light text-success-dark dark:bg-success/15 dark:text-success',
        warning: 'bg-warning-light text-warning-dark dark:bg-warning/15 dark:text-warning',
        danger: 'bg-error-light text-error-dark dark:bg-error/15 dark:text-error',
        neutral: 'bg-gray-100 text-gray-600 dark:bg-obsidian-hover dark:text-ink-muted',
      },
      size: {
        sm: 'w-8 h-8 rounded-lg',
        md: 'w-10 h-10',
        lg: 'w-12 h-12 rounded-2xl',
      },
    },
    defaultVariants: { tone: 'accent', size: 'md' },
  }
)

export interface IconTileProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconTileVariants> {}

export function IconTile({ className, tone, size, ...props }: IconTileProps) {
  return <div className={cn(iconTileVariants({ tone, size, className }))} {...props} />
}

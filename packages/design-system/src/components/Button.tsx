import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils/cn'

/**
 * Hover/active colours are spelled `accent-hover`, `error-dark` and so on:
 * Tailwind builds those class names from the nested keys in the theme. The
 * previous camelCase spellings matched no generated class at all, so primary and
 * destructive buttons silently had no hover state.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:opacity-45 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-white hover:bg-accent-hover active:bg-accent-dark shadow-sm',
        secondary:
          'bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300 dark:bg-obsidian-hover dark:text-ink-primary dark:hover:bg-obsidian-elevated',
        outline:
          'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 hover:border-gray-400 dark:border-obsidian-border dark:bg-transparent dark:text-ink-primary dark:hover:bg-obsidian-hover',
        ghost:
          'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-ink-muted dark:hover:bg-obsidian-hover dark:hover:text-ink-primary',
        danger: 'bg-error text-white hover:bg-error-dark',
        success: 'bg-success text-white hover:bg-success-dark',
        link: 'text-accent underline underline-offset-4 decoration-accent/30 hover:decoration-accent p-0 h-auto',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs rounded-md gap-1.5',
        sm: 'h-9 px-3.5 text-sm rounded-lg',
        md: 'h-10 px-4 text-sm rounded-lg',
        lg: 'h-11 px-5 text-[15px] rounded-xl',
        xl: 'h-12 px-6 text-base rounded-xl',
        icon: 'h-10 w-10 rounded-lg',
        'icon-sm': 'h-8 w-8 rounded-md',
        'icon-lg': 'h-11 w-11 rounded-xl',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

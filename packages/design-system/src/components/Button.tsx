import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-gemini/40 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accentHover shadow-sm hover:shadow-md dark:bg-striver dark:hover:bg-striver',
        secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-obsidian-hover dark:text-ink-primary dark:hover:bg-obsidian-surface',
        outline: 'border-2 border-gray-200 bg-transparent text-gray-700 hover:bg-gray-50 dark:border-obsidian-border dark:text-ink-primary dark:hover:bg-obsidian-hover',
        ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-ink-muted dark:hover:bg-obsidian-hover dark:hover:text-ink-primary',
        danger: 'bg-error text-white hover:bg-errorDark',
        success: 'bg-success text-white hover:bg-successDark',
        link: 'text-accent underline-offset-4 hover:underline p-0 h-auto dark:text-striver',
      },
      size: {
        xs: 'h-8 px-3 text-xs rounded-xl',
        sm: 'h-9 px-4 text-sm rounded-xl',
        md: 'h-11 px-6 text-base rounded-2xl',
        lg: 'h-12 px-8 text-base rounded-2xl',
        xl: 'h-14 px-10 text-lg rounded-2xl',
        icon: 'h-10 w-10 rounded-xl',
        'icon-sm': 'h-8 w-8 rounded-lg',
        'icon-lg': 'h-12 w-12 rounded-2xl',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
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
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

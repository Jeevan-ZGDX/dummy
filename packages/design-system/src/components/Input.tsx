import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-ink-muted mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-obsidian-faint">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-11 rounded-xl border bg-white px-4 text-base text-gray-900 placeholder:text-gray-400 dark:bg-obsidian-surface dark:border-obsidian-border dark:text-ink-primary dark:placeholder-obsidian-faint',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 dark:focus:ring-gemini/30',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-obsidian-canvas',
              error
                ? 'border-error focus:ring-error'
                : 'border-gray-200 hover:border-gray-300 dark:border-obsidian-border dark:hover:border-obsidian-hover',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-obsidian-faint">
              {rightIcon}
            </div>
          )}
        </div>
        {(error || helperText) && (
          <p className={cn(
            'mt-1.5 text-sm',
            error ? 'text-error' : 'text-gray-500 dark:text-ink-muted'
          )}>
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700 dark:text-ink-muted mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full min-h-[100px] rounded-xl border bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 dark:bg-obsidian-surface dark:border-obsidian-border dark:text-ink-primary dark:placeholder-obsidian-faint',
            'transition-all duration-200 resize-y',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 dark:focus:ring-gemini/30',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-obsidian-canvas',
            error
              ? 'border-error focus:ring-error'
              : 'border-gray-200 hover:border-gray-300 dark:border-obsidian-border dark:hover:border-obsidian-hover',
            className
          )}
          {...props}
        />
        {(error || helperText) && (
          <p className={cn(
            'mt-1.5 text-sm',
            error ? 'text-error' : 'text-gray-500 dark:text-ink-muted'
          )}>
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

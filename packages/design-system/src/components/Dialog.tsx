import { type ReactNode, useEffect, useCallback } from 'react'
import { cn } from '../utils/cn'
import { X } from 'lucide-react'
import { Button } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: ReactNode
  actions?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'danger'
    loading?: boolean
  }[]
  className?: string
}

export function Dialog({ open, onClose, title, description, children, actions, className }: DialogProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, handleEscape])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-xl text-gray-900 dark:bg-obsidian-elevated dark:border-obsidian-border dark:text-ink-primary',
          'animate-in fade-in zoom-in-95 duration-200',
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 dark:bg-obsidian-hover dark:hover:bg-obsidian-surface transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-500 dark:text-ink-muted" />
        </button>

        {(title || description) && (
          <div className="p-6 pb-0">
            {title && <h2 className="text-lg font-semibold text-gray-900 dark:text-ink-primary">{title}</h2>}
            {description && <p className="text-sm text-gray-500 dark:text-ink-muted mt-1">{description}</p>}
          </div>
        )}

        {children && <div className="p-6">{children}</div>}

        {actions && actions.length > 0 && (
          <div className="p-6 pt-0 flex gap-3 justify-end">
            {actions.map((action, i) => (
              <Button
                key={i}
                variant={action.variant || 'primary'}
                size="sm"
                onClick={action.onClick}
                isLoading={action.loading}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children?: ReactNode
  className?: string
}

export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div
        className={cn(
          'relative w-full max-w-lg bg-white border-t border-gray-200 rounded-t-3xl shadow-xl dark:bg-obsidian-elevated dark:border-obsidian-border',
          'animate-in slide-in-from-bottom duration-300',
          'max-h-[85vh] overflow-y-auto text-gray-900 dark:text-ink-primary',
          className
        )}
      >
        <div className="sticky top-0 bg-white dark:bg-obsidian-elevated px-6 pt-4 pb-2 border-b border-gray-100 dark:border-obsidian-border">
          <div className="w-10 h-1 bg-gray-300 dark:bg-obsidian-hover rounded-full mx-auto mb-3" />
          {title && <h2 className="text-lg font-semibold text-gray-900 dark:text-ink-primary">{title}</h2>}
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

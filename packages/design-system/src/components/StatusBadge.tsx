import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils/cn'

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium',
  {
    variants: {
      status: {
        pending: 'bg-warningLight text-warningDark dark:bg-amber-500/15 dark:text-amber-300',
        verified: 'bg-successLight text-successDark dark:bg-emerald-500/15 dark:text-emerald-300',
        completed: 'bg-infoLight text-infoDark dark:bg-blue-500/15 dark:text-blue-300',
        rejected: 'bg-errorLight text-errorDark dark:bg-red-500/15 dark:text-red-300',
        active: 'bg-successLight text-successDark dark:bg-emerald-500/15 dark:text-emerald-300',
        inactive: 'bg-gray-100 text-gray-600 dark:bg-obsidian-hover dark:text-ink-muted',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-1 text-xs',
        lg: 'px-3 py-1.5 text-sm',
      },
      dot: {
        true: '',
        false: '',
      },
    },
    defaultVariants: {
      status: 'pending',
      size: 'md',
      dot: true,
    },
  }
)

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  verified: 'Verified',
  completed: 'Completed',
  rejected: 'Rejected',
  active: 'Active',
  inactive: 'Inactive',
}

export interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  label?: string
  className?: string
}

export function StatusBadge({ status, size, dot, label, className }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ status, size, dot, className }))}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            status === 'pending' && 'bg-warning',
            status === 'verified' && 'bg-success',
            status === 'completed' && 'bg-info',
            status === 'rejected' && 'bg-error',
            status === 'active' && 'bg-success',
            status === 'inactive' && 'bg-gray-400'
          )}
        />
      )}
      {label || statusLabels[status || 'pending']}
    </span>
  )
}

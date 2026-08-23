import { type ImgHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils/cn'

const avatarVariants = cva(
  'relative inline-flex items-center justify-center overflow-hidden rounded-full bg-gray-100 border dark:bg-obsidian-hover dark:border-obsidian-border',
  {
    variants: {
      size: {
        xs: 'h-6 w-6 text-[10px]',
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-12 w-12 text-base',
        xl: 'h-16 w-16 text-lg',
        '2xl': 'h-20 w-20 text-xl',
        '3xl': 'h-24 w-24 text-2xl',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
)

export interface AvatarProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'size'>,
    VariantProps<typeof avatarVariants> {
  name?: string
  status?: 'online' | 'offline' | 'away'
}

export function Avatar({ className, size, src, alt, name, status, ...props }: AvatarProps) {
  const initials = name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className={cn('relative inline-flex', className)}>
      <div className={cn(avatarVariants({ size }))}>
        {src ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="h-full w-full object-cover"
            {...props}
          />
        ) : (
                    <span className="font-medium text-gray-500 dark:text-ink-muted select-none">
            {initials || '?'}
          </span>
        )}
      </div>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-white dark:ring-obsidian-elevated',
            status === 'online' && 'bg-success',
            status === 'offline' && 'bg-gray-400',
            status === 'away' && 'bg-warning',
            size === 'xs' && 'h-1.5 w-1.5',
            size === 'sm' && 'h-2 w-2',
            (!size || size === 'md' || size === 'lg') && 'h-2.5 w-2.5',
            size === 'xl' && 'h-3 w-3',
            (size === '2xl' || size === '3xl') && 'h-3.5 w-3.5'
          )}
        />
      )}
    </div>
  )
}

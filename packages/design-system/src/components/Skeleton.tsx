import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils/cn'

const skeletonVariants = cva('animate-pulse bg-gray-200 dark:bg-obsidian-hover rounded-xl', {
  variants: {
    variant: {
      text: 'h-4',
      heading: 'h-6',
      title: 'h-8',
      avatar: 'rounded-full',
      thumbnail: 'rounded-2xl',
      card: 'rounded-2xl',
      button: 'rounded-2xl',
    },
    width: {
      auto: 'w-auto',
      full: 'w-full',
      threequarters: 'w-3/4',
      half: 'w-1/2',
      third: 'w-1/3',
      twothirds: 'w-2/3',
      quarter: 'w-1/4',
      xs: 'w-16',
      sm: 'w-24',
      md: 'w-32',
      lg: 'w-48',
      '3xl': 'w-96',
    },
  },
  defaultVariants: {
    variant: 'text',
    width: 'full',
  },
})

export interface SkeletonProps extends VariantProps<typeof skeletonVariants> {
  className?: string
  count?: number
  height?: string | number
}

export function Skeleton({ className, variant, width, count = 1, height }: SkeletonProps) {
  if (count > 1) {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(skeletonVariants({ variant, width, className }))}
            style={height ? { height } : undefined}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(skeletonVariants({ variant, width, className }))}
      style={height ? { height } : undefined}
    />
  )
}

export function CompetitionCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden dark:bg-obsidian-surface dark:border-obsidian-border">
      <Skeleton variant="thumbnail" height={180} width="full" className="!rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton variant="heading" width="threequarters" />
        <Skeleton variant="text" width="half" />
        <div className="flex gap-4 pt-2">
          <Skeleton variant="text" width="quarter" />
          <Skeleton variant="text" width="quarter" />
          <Skeleton variant="text" width="quarter" />
        </div>
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 dark:bg-obsidian-surface dark:border-obsidian-border">
      <Skeleton variant="text" width="half" />
      <Skeleton variant="title" width="third" className="mt-2" />
      <Skeleton variant="text" width="twothirds" className="mt-2" />
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 dark:bg-obsidian-surface dark:border-obsidian-border">
          <Skeleton variant="avatar" width="lg" height={48} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="heading" width="threequarters" />
            <Skeleton variant="text" width="half" />
          </div>
          <Skeleton variant="button" width="lg" height={32} />
        </div>
      ))}
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center space-y-4 p-6">
      <Skeleton variant="avatar" width="3xl" height={96} />
      <Skeleton variant="heading" width="half" />
      <Skeleton variant="text" width="third" />
      <div className="flex gap-8 mt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="text-center space-y-1">
            <Skeleton variant="heading" width="xs" />
            <Skeleton variant="text" width="xs" />
          </div>
        ))}
      </div>
    </div>
  )
}

import { type ReactNode } from 'react'
import { cn } from '../utils/cn'
import { Card } from './Card'
import { Badge } from './Badge'
import { Bookmark, Users, Trophy, Calendar } from 'lucide-react'

interface CompetitionCardProps {
  imageUrl?: string | null
  category: string
  categoryColor?: 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
  title: string
  organizer: string
  organizerVerified?: boolean
  teamSize: string
  prizePool: string
  deadline: string
  bookmarked?: boolean
  onBookmark?: () => void
  onPress?: () => void
  className?: string
}

export function CompetitionCard({
  imageUrl,
  category,
  categoryColor = 'primary',
  title,
  organizer,
  organizerVerified = false,
  teamSize,
  prizePool,
  deadline,
  bookmarked = false,
  onBookmark,
  onPress,
  className,
}: CompetitionCardProps) {
  return (
    <Card
      variant="interactive"
      padding="none"
      className={cn('overflow-hidden', className)}
      onClick={onPress}
    >
      {/* Banner Image */}
      <div className="relative h-44 bg-gray-100 dark:bg-obsidian-hover overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200 dark:from-obsidian-hover dark:to-obsidian-hover">
            <Trophy className="w-12 h-12 text-primary-400 dark:text-ink-muted" />
          </div>
        )}
        <Badge
          variant={categoryColor}
          size="sm"
          className="absolute top-3 left-3 backdrop-blur-sm"
        >
          {category}
        </Badge>
        {onBookmark && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onBookmark()
            }}
            className={cn(
              'absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center',
              'backdrop-blur-sm transition-all duration-200',
              bookmarked ? 'bg-accent text-white' : 'bg-white/80 text-gray-600 hover:bg-white dark:bg-obsidian-elevated/80 dark:text-ink-muted dark:hover:bg-obsidian-elevated'
            )}
            aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            <Bookmark
              className="w-4 h-4"
              fill={bookmarked ? 'currentColor' : 'none'}
            />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight">
          {title}
        </h3>
        <div className="flex items-center gap-1">
          <p className="text-sm text-gray-500 dark:text-ink-muted">{organizer}</p>
          {organizerVerified && (
            <svg className="w-4 h-4 text-info" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="px-4 pb-4 flex items-center gap-4 text-xs text-gray-500 dark:text-ink-muted">
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          <span>{teamSize}</span>
        </div>
        <div className="flex items-center gap-1">
          <Trophy className="w-3.5 h-3.5" />
          <span>{prizePool}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{deadline}</span>
        </div>
      </div>
    </Card>
  )
}

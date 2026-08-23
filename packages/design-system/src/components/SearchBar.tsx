import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../utils/cn'
import { Search, X } from 'lucide-react'

export interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void
  showClear?: boolean
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ className, onClear, showClear = false, value, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-obsidian-faint" />
        <input
          ref={ref}
          type="text"
          value={value}
          className={cn(
            'w-full h-10 rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-900 dark:bg-obsidian-surface dark:border-obsidian-border dark:text-ink-primary',
            'placeholder:text-gray-400 dark:placeholder-obsidian-faint transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent dark:focus:ring-gemini/30 dark:focus:border-gemini/60',
            className
          )}
          {...props}
        />
        {(showClear || (typeof value === 'string' && value.length > 0)) && onClear && (
          <button
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 dark:bg-obsidian-hover dark:hover:bg-obsidian-surface transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5 text-gray-500 dark:text-ink-muted" />
          </button>
        )}
      </div>
    )
  }
)

SearchBar.displayName = 'SearchBar'

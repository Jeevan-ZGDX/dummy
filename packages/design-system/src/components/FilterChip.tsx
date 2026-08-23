import { cn } from '../utils/cn'

interface FilterChipProps {
  label: string
  active?: boolean
  onPress?: () => void
  count?: number
  className?: string
}

export function FilterChip({ label, active = false, onPress, count, className }: FilterChipProps) {
  return (
    <button
      onClick={onPress}
      className={cn(
        'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium',
        'transition-all duration-200 whitespace-nowrap',
        active
          ? 'bg-accent text-white shadow-sm dark:bg-striver dark:hover:bg-striver'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-obsidian-hover dark:text-ink-muted dark:hover:bg-obsidian-surface dark:hover:text-ink-primary',
        className
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            'text-xs',
            active ? 'text-white/80' : 'text-gray-400 dark:text-obsidian-faint'
          )}
        >
          ({count})
        </span>
      )}
    </button>
  )
}

interface FilterChipGroupProps {
  options: { label: string; value: string; count?: number }[]
  selected: string
  onSelect: (value: string) => void
  className?: string
}

export function FilterChipGroup({ options, selected, onSelect, className }: FilterChipGroupProps) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1', className)}>
      {options.map((option) => (
        <FilterChip
          key={option.value}
          label={option.label}
          active={selected === option.value}
          onPress={() => onSelect(option.value)}
          count={option.count}
        />
      ))}
    </div>
  )
}

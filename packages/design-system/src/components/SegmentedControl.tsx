import { cn } from '../utils/cn'

interface SegmentedControlProps {
  options: { label: string; value: string }[]
  selected: string
  onSelect: (value: string) => void
  className?: string
}

export function SegmentedControl({ options, selected, onSelect, className }: SegmentedControlProps) {
  return (
    <div className={cn('flex gap-1 p-1 bg-gray-100 dark:bg-obsidian-hover rounded-xl', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          className={cn(
            'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            selected === option.value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-obsidian-elevated dark:text-ink-primary dark:border dark:border-obsidian-border'
              : 'text-gray-500 hover:text-gray-700 dark:text-ink-muted dark:hover:text-ink-primary'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

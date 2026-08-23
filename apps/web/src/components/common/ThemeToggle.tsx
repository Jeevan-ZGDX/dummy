'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export function ThemeToggle() {
  const { isDark, mounted, toggleTheme } = useTheme()

  if (!mounted) {
    return (
      <button
        type="button"
        className="p-2 rounded-xl bg-transparent animate-pulse"
        aria-label="Loading theme"
      >
        <span className="block w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-600 dark:hover:bg-obsidian-hover dark:text-ink-muted dark:hover:text-ink-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gemini/40"
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-uv" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  )
}
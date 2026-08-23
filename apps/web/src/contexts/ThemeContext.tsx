'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  isDark: boolean
  mounted: boolean
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'theme'

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const initial: Theme = stored === 'dark' || stored === 'light' ? stored : 'system'
    setThemeState(initial)
    setMounted(true)
  }, [])

  const applyTheme = useCallback((t: ResolvedTheme) => {
    const root = document.documentElement
    if (t === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    const resolved: ResolvedTheme = theme === 'system' ? getSystemTheme() : theme
    applyTheme(resolved)

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme(getSystemTheme())
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme, mounted, applyTheme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    window.localStorage.setItem(STORAGE_KEY, t)
  }, [])

  const toggleTheme = useCallback(() => {
    const current: ResolvedTheme = theme === 'system' ? getSystemTheme() : theme
    setTheme(current === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark')

  return (
    <ThemeContext.Provider value={{ theme, isDark, mounted, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
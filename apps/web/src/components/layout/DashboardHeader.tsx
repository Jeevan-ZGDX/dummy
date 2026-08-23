'use client'

import { useRouter } from 'next/navigation'
import { Menu, Bell, Search, LogOut } from 'lucide-react'
// useUnreadNotificationCount hook missing, using stub
import { logoutUser } from '@/lib/auth'
import { ThemeToggle } from '@/components/common/ThemeToggle'

interface DashboardHeaderProps {
  onMenuToggle: () => void
}

export function DashboardHeader({ onMenuToggle }: DashboardHeaderProps) {
  const router = useRouter()
  const unreadCount = 0

  const handleLogout = () => {
    logoutUser()
    router.push('/sign-in')
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 dark:bg-obsidian-elevated dark:border-obsidian-border transition-colors">
      <div className="flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-obsidian-hover transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-ink-muted" />
          </button>
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-ink-muted" />
            <input
              type="text"
              placeholder="Search..."
              className="w-64 h-10 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 dark:bg-obsidian-surface dark:border-obsidian-border dark:text-ink-primary dark:placeholder-obsidian-faint focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent dark:focus:ring-gemini/30 dark:focus:border-gemini/60"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => router.push('/notifications')}
            className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-600 dark:hover:bg-obsidian-hover dark:text-ink-muted transition-colors"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-gray-600 dark:text-ink-muted" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 dark:text-ink-muted dark:hover:bg-obsidian-hover dark:hover:text-ink-primary transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  )
}


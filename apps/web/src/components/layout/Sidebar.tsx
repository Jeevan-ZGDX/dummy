'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@comp-dash/design-system'
import {
  LayoutDashboard,
  Trophy,
  ClipboardList,
  Users,
  GraduationCap,
  Building2,
  BarChart3,
  FileText,
  LogOut,
  History,
  Award,
  PlusCircle,
  Mail,
  CheckCircle,
} from 'lucide-react'
import { getCurrentUser, logoutUser } from '@/lib/auth'
import type { UserRole } from '@/lib/auth'

type NavItem = { label: string; icon: React.ComponentType<{ className?: string }>; href: string; roles: UserRole[] }

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['student', 'advisor', 'hod', 'super_admin'] },
  { label: 'Competitions', icon: Trophy, href: '/competitions', roles: ['student', 'advisor', 'hod', 'super_admin'] },
  { label: 'Email Verification', icon: Mail, href: '/email-verification', roles: ['student'] },
  { label: 'OD Granted', icon: CheckCircle, href: '/od-granted', roles: ['advisor', 'super_admin'] },
  { label: 'Leaderboard', icon: Award, href: '/leaderboard', roles: ['student', 'advisor', 'hod', 'super_admin'] },
  { label: 'History', icon: History, href: '/history', roles: ['student'] },
  { label: 'Verification Requests', icon: Mail, href: '/verification-requests', roles: ['advisor'] },
  { label: 'Create Competition', icon: PlusCircle, href: '/create-competition', roles: ['super_admin'] },
  { label: 'Registrations', icon: ClipboardList, href: '/registrations', roles: ['super_admin'] },
  { label: 'Students', icon: Users, href: '/students', roles: ['super_admin'] },
  { label: 'Advisors', icon: GraduationCap, href: '/advisors', roles: ['hod', 'super_admin'] },
  { label: 'Analytics', icon: BarChart3, href: '/analytics', roles: ['hod'] },
  ]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<{ email: string; role: UserRole; name: string; department: string } | null>(null)
  const [accessActive, setAccessActive] = useState(true)
  const [accessChecked, setAccessChecked] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
    if (user) {
      fetch(`/api/auth/check-access?email=${encodeURIComponent(user.email)}`)
        .then(r => r.json())
        .then(json => {
          const active = json.data?.active !== false
          setAccessActive(active)
          setAccessChecked(true)
          if (!active) router.push('/sign-in')
        })
        .catch(() => {
          setAccessActive(true)
          setAccessChecked(true)
        })
    }
  }, [router])

  const displayName = currentUser?.name || currentUser?.email?.split('@')[0] || 'User'
  const roleLabel = currentUser ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : ''

  const handleLogout = () => {
    logoutUser()
    router.push('/sign-in')
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transition-transform duration-300 dark:bg-obsidian-elevated dark:border-obsidian-border',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-obsidian-border">
          <div className="w-9 h-9 rounded-xl bg-accent/10 dark:bg-striver/15 flex items-center justify-center">
            <span className="text-lg font-bold text-accent dark:text-striver">C</span>
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-ink-primary">Comp-Dash</span>
        </div>

        {accessChecked && !accessActive && (
          <div className="mx-3 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-center dark:bg-red-950/40 dark:border-red-800/60">
            <p className="text-xs font-medium text-red-700 dark:text-red-300">Access Revoked</p>
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">Contact your administrator</p>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => currentUser && item.roles.includes(currentUser.role as UserRole))
            .map((item) => {
            const disabled = !accessActive
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={disabled ? '#' : item.href}
                onClick={disabled ? (e) => e.preventDefault() : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  disabled
                    ? 'text-gray-300 dark:text-obsidian-faint cursor-not-allowed'
                    : isActive
                      ? 'bg-accent/15 text-accent font-semibold border-l-2 border-accent dark:bg-striver/15 dark:text-striver dark:border-striver'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-ink-muted dark:hover:bg-obsidian-hover dark:hover:text-ink-primary'
                )}
              >
                <item.icon
                  className={cn('w-5 h-5', disabled ? 'text-gray-300 dark:text-obsidian-faint' : isActive ? 'text-accent dark:text-striver' : 'text-gray-400 dark:text-ink-muted')}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white dark:border-obsidian-border dark:bg-obsidian-elevated">
          <div className="flex items-center gap-3 p-2">
            <div className="w-9 h-9 rounded-full bg-gray-100 border flex items-center justify-center text-sm font-medium text-gray-600 dark:border-obsidian-border dark:bg-obsidian-hover dark:text-ink-muted">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-ink-primary truncate">{displayName}</p>
              <p className="text-xs text-gray-500 dark:text-ink-muted capitalize">{roleLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 dark:hover:bg-obsidian-hover dark:text-obsidian-faint dark:hover:text-ink-muted transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

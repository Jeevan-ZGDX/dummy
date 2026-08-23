'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import type { UserRole } from '@/lib/auth'
import AdminDashboard from '@/components/dashboard/AdminDashboard'
import HODDashboard from '@/components/dashboard/HODDashboard'
import COEDashboard from '@/components/dashboard/COEDashboard'
import AdvisorDashboard from '@/components/dashboard/AdvisorDashboard'
import StudentDashboard from '@/components/dashboard/StudentDashboard'

export default function DashboardPage() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const user = getCurrentUser()
    if (user) {
      setRole(user.role)
      fetch(`/api/auth/check-access?email=${encodeURIComponent(user.email)}`)
        .then(r => r.json())
        .then(json => {
          if (json.data?.active === false) {
            setAccessDenied(true)
            setTimeout(() => router.push('/sign-in'), 3000)
          }
        })
        .catch(() => {})
    }
  }, [router])

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center max-w-md">
          <p className="text-lg font-bold text-red-700">Access Revoked</p>
          <p className="text-sm text-red-500 mt-2">Your account access has been revoked by the administrator.</p>
          <p className="text-xs text-red-400 mt-2">Redirecting to sign-in...</p>
        </div>
      </div>
    )
  }

  if (!role) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  switch (role) {
    case 'student':
      return <StudentDashboard />
    case 'advisor':
      return <AdvisorDashboard />
    case 'hod':
      return <HODDashboard />
    case 'super_admin':
      return <COEDashboard />
    default:
      return <COEDashboard />
  }
}

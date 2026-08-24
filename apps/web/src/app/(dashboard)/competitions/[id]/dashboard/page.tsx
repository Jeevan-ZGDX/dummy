'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, Badge, Button, StatCard } from '@comp-dash/design-system'
import { useCompetitionDashboard, useCompetitionDashboardRealtime, useSendReminder, isFirestoreEnabled } from '@comp-dash/api'
import { Trophy, Users, UserCheck, UserX, Calendar, Building2, Send, Bell, Wifi, WifiOff } from 'lucide-react'

const statusConfig: Record<string, { variant: 'warning' | 'success' | 'info' | 'danger'; label: string }> = {
  pending_verification: { variant: 'warning', label: 'Pending' },
  verified: { variant: 'success', label: 'Verified' },
  completed: { variant: 'info', label: 'Completed' },
  rejected: { variant: 'danger', label: 'Rejected' },
}

export default function CompetitionDashboardPage() {
  const params = useParams()
  const id = params.id as string
  const { data, isLoading } = useCompetitionDashboard(id)
  const sendReminder = useSendReminder()
  const realtime = isFirestoreEnabled()
  const [isConnected, setIsConnected] = useState(false)

  useCompetitionDashboardRealtime(id)

  useEffect(() => {
    if (realtime) {
      setIsConnected(true)
    }
  }, [realtime])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-zinc-800/60 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-zinc-400">Competition not found</div>
    )
  }

  const { competition, registeredStudents, unregisteredStudents, totalRegistered, totalUnregistered, registrationsByDepartment } = data
  const maxDeptCount = Math.max(...registrationsByDepartment.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{competition.title}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-gray-400 dark:text-zinc-500" />{competition.organizer}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-gray-400 dark:text-zinc-500" />{new Date(competition.startDate).toLocaleDateString()} - {new Date(competition.endDate).toLocaleDateString()}</span>
            <Badge variant="accent" size="sm">{competition.mode}</Badge>
            <Badge variant="primary" size="sm">{competition.category}</Badge>
          </div>
          {competition.prizePool && (
            <p className="mt-2 text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              Prize Pool: {competition.prizePool}
            </p>
          )}
        </div>
        {realtime && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-xs text-emerald-700 dark:text-emerald-400 shadow-sm">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            {isConnected ? 'Live' : 'Connecting...'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Registered"
          value={totalRegistered}
          icon={<UserCheck className="w-5 h-5 text-emerald-500" />}
        />
        <StatCard
          title="Total Unregistered"
          value={totalUnregistered}
          icon={<UserX className="w-5 h-5 text-rose-500" />}
        />
        <StatCard
          title="Total Students"
          value={totalRegistered + totalUnregistered}
          icon={<Users className="w-5 h-5 text-accent" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white font-semibold text-lg">Registrations by Department</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-4">
            {registrationsByDepartment.length > 0 ? (
              registrationsByDepartment.map((dept) => (
                <div key={dept.department} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-zinc-200 font-medium">{dept.department}</span>
                    <span className="text-gray-500 dark:text-zinc-400 font-semibold">{dept.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${(dept.count / maxDeptCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-zinc-400 text-sm">No registration data</div>
            )}
          </div>
        </Card>

        <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white font-semibold text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-3">
            <Button
              variant="primary"
              className="w-full transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] gap-2"
              onClick={() => sendReminder.mutate(id)}
              isLoading={sendReminder.isPending}
              disabled={unregisteredStudents.length === 0}
            >
              <Send className="w-4 h-4" />
              Send Reminder ({unregisteredStudents.length} unregistered)
            </Button>
          </div>
        </Card>
      </div>

      <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white font-semibold text-lg">Registered Students ({registeredStudents.length})</CardTitle>
        </CardHeader>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400">
                <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Student</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Department</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium uppercase tracking-wider px-4 py-3">Registered At</th>
              </tr>
            </thead>
            <tbody>
              {registeredStudents.length > 0 ? (
                registeredStudents.map((reg) => {
                  const config = statusConfig[reg.status] || { variant: 'default' as const, label: reg.status }
                  return (
                    <tr key={reg.id} className="border-b border-gray-100 dark:border-zinc-800/60">
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white transition-transform duration-200 hover:scale-[1.02] origin-left cursor-pointer">
                          {reg.userName}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="primary" size="sm">{reg.department}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={config.variant} size="sm">{config.label}</Badge>
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-gray-500 dark:text-zinc-400">
                        {new Date(reg.registeredAt).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-zinc-400">No registered students</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900 dark:text-white font-semibold text-lg">Unregistered Students ({unregisteredStudents.length})</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendReminder.mutate(id)}
              isLoading={sendReminder.isPending}
              disabled={unregisteredStudents.length === 0}
              className="transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] gap-1.5"
            >
              <Bell className="w-4 h-4" />
              Send Reminder
            </Button>
          </div>
        </CardHeader>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400">
                <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Student</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Department</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Section</th>
              </tr>
            </thead>
            <tbody>
              {unregisteredStudents.length > 0 ? (
                unregisteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-gray-100 dark:border-zinc-800/60">
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white transition-transform duration-200 hover:scale-[1.02] origin-left cursor-pointer">
                        {student.name}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-zinc-400">{student.email}</td>
                    <td className="px-4 py-4">
                      <Badge variant="primary" size="sm">{student.department}</Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-zinc-300 font-medium">{student.section}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-zinc-400">All students are registered</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
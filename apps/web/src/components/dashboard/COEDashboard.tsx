'use client'

import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, StatCard, Button, Badge } from '@comp-dash/design-system'
import { useCoeDashboardStats, useCompetitions } from '@comp-dash/api'
import { Trophy, Users, UserCheck, UserCog, Building2, Plus, Calendar, ExternalLink, Mail, Send } from 'lucide-react'

export default function COEDashboard() {
  const router = useRouter()
  const { data: stats, isLoading } = useCoeDashboardStats()
  const { data: compsData } = useCompetitions({ limit: 5 })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const competitions = compsData?.data ?? []
  const registrations = stats?.registrations ?? []

  const deptCounts: Record<string, number> = {}
  registrations.forEach((r) => {
    const dept = r.department || r.competition?.title || 'Unknown'
    deptCounts[dept] = (deptCounts[dept] || 0) + 1
  })
  const deptData = Object.entries(deptCounts).map(([department, count]) => ({ department, count }))
  const maxDeptCount = Math.max(...deptData.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">College-wide overview and management</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" onClick={() => router.push('/create-competition')}>
            <Plus className="w-4 h-4" />
            Create Competition
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Competitions"
          value={compsData?.total ?? competitions.length}
          icon={<Trophy className="w-5 h-5" />}
        />
        <StatCard
          title="Total Students"
          value={stats?.totalRegistered || 0}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Total Registrations"
          value={registrations.length}
          icon={<UserCheck className="w-5 h-5" />}
        />
        <StatCard
          title="Total Advisors"
          value={0}
          icon={<UserCog className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Verification Requests</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-2">
            {(stats?.selfVerificationRequests?.length ?? 0) > 0 ? (
              stats!.selfVerificationRequests.map((vr: any) => (
                <div key={vr.id} className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{vr.studentName}</span>
                    <Badge variant="info" size="sm">Pending</Badge>
                  </div>
                  <p className="text-xs text-gray-500">{vr.department} · {vr.competitionTitle}</p>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center">
                <Mail className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-400">No pending requests</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrations by Department</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-3">
            {deptData.length > 0 ? (
              deptData.map((dept) => (
                <div key={dept.department} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">{dept.department}</span>
                    <span className="text-gray-500">{dept.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${(dept.count / maxDeptCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">No registration data</div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Competitions</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-1">
            {competitions.length > 0 ? (
              competitions.map((comp) => (
                <div
                  key={comp.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl hover:cursor-pointer transition-colors"
                  onClick={() => router.push(`/competitions/${comp.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white-900">{comp.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="primary" size="xs">{comp.category}</Badge>
                        <span className="text-xs text-gray-400">{comp.mode}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{new Date(comp.registrationDeadline).toLocaleDateString()}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">No competitions yet</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

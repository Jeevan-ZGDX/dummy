'use client'

import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, StatCard, Button, Badge } from '@comp-dash/design-system'
import { useCoeDashboardStats, useCompetitions } from '@comp-dash/api'
import { Trophy, Users, UserCheck, UserCog, Plus, ExternalLink, Mail } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

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

  const totalVerified = stats?.verifiedRegistrations ?? 0
  const totalPending = stats?.pendingRegistrations ?? 0
  const totalRejected = stats?.rejectedRegistrations ?? 0
  const registered = stats?.registered ?? 0
  const totalExpected = stats?.totalExpected ?? 0
  const unregistered = stats?.unregistered ?? 0

  // Pie chart data: registration distribution
  const pieData = [
    { name: 'Registered', value: registered },
    { name: 'Unregistered', value: unregistered },
  ].filter(d => d.value > 0)

  // Status breakdown pie data
  const statusPieData = [
    { name: 'Verified', value: totalVerified },
    { name: 'Pending', value: totalPending },
    { name: 'Rejected', value: totalRejected },
  ].filter(d => d.value > 0)

  // Trend data for line chart
  const trendData = stats?.registrationsOverTime ?? []
  const verificationTrendData = stats?.verificationTrend ?? []

  // Merge trend data for combined chart
  const mergedTrendData = trendData.map((item, i) => ({
    month: item.date,
    registrations: item.count,
    verifications: verificationTrendData[i]?.count ?? 0,
  }))

  // Department bar data
  const topDepartments = stats?.topDepartments ?? []

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
          title="Open Competitions"
          value={stats?.openCompetitions ?? 0}
          icon={<Trophy className="w-5 h-5" />}
        />
        <StatCard
          title="Registered"
          value={registered}
          icon={<UserCheck className="w-5 h-5" />}
        />
        <StatCard
          title="Unregistered"
          value={unregistered}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Total Expected"
          value={totalExpected}
          icon={<Trophy className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Registration Distribution</CardTitle>
          </CardHeader>
          <div className="mt-4 h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification Status</CardTitle>
          </CardHeader>
          <div className="mt-4 h-64">
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>
            )}
          </div>
        </Card>
      </div>

      {mergedTrendData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Registration & Verification Trend</CardTitle>
          </CardHeader>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="registrations" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="verifications" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Departments</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-3">
            {topDepartments.length > 0 ? (
              topDepartments.map((dept) => {
                const maxCount = Math.max(...topDepartments.map(d => d.count), 1)
                return (
                  <div key={dept.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">{dept.name}</span>
                      <span className="text-gray-500">{dept.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${(dept.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">No data</div>
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
                  className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors"
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
    </div>
  )
}

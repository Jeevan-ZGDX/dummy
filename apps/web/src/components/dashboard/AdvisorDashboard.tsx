'use client'
import { StatCard, Card, CardHeader, CardTitle, Badge } from '@comp-dash/design-system'
import { useAdvisorSummary } from '@comp-dash/api'
import { ClipboardList, Users, CheckCircle, XCircle, Trophy, AlertTriangle } from 'lucide-react'

const STATUS_VARIANT = {
  verified: 'success',
  pending: 'warning',
  rejected: 'danger',
} as const

const STATUS_LABEL = {
  verified: 'Verified',
  pending: 'Pending',
  rejected: 'Rejected',
} as const

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

export default function AdvisorDashboard() {
  const { data, isLoading, error } = useAdvisorSummary()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-zinc-800/60 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 dark:bg-zinc-800/60 rounded-2xl animate-pulse" />
      </div>
    )
  }

  // An unmapped account is the common cause of an all-zero dashboard, so say so
  // explicitly rather than rendering empty tables.
  if (error) {
    const err = (error as any)?.response?.data?.error
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Advisor Dashboard</h1>
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {err?.message || 'Could not load your dashboard'}
              </p>
              {err?.detail && (
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{err.detail}</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const { advisor, totals, sections, recentRegistrations, yearScope } = data
  const notRegistered = Math.max(totals.totalStudents - totals.registeredStudents, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Advisor Dashboard</h1>
        <p className="text-gray-500 dark:text-zinc-400 mt-1" data-testid="advisor-identity">
          {advisor.name} · {advisor.department} · {yearScope} · Section
          {advisor.assignedSections.length === 1 ? ' ' : 's '}
          {advisor.assignedSections.join(', ') || '—'}
        </p>
      </div>

      {advisor.assignedSections.length === 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                No sections are assigned to your account.
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                Ask an admin to set <code>assigned_sections</code> on advisor record {advisor.id}.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Students"
          value={totals.totalStudents}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Registered Students"
          value={totals.registeredStudents}
          changeLabel={`${notRegistered} not registered`}
          icon={<ClipboardList className="w-5 h-5" />}
        />
        <StatCard
          title="Verified Registrations"
          value={totals.verifiedRegistrations}
          changeLabel={`${totals.pendingRegistrations} pending`}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <StatCard
          title="Competitions Entered"
          value={totals.competitionsEntered}
          icon={<Trophy className="w-5 h-5" />}
        />
      </div>

      <Card data-testid="advisor-section-summary">
        <CardHeader>
          <CardTitle>My Sections</CardTitle>
        </CardHeader>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-zinc-400">
                <th className="py-2 pr-4 font-medium">Section</th>
                <th className="py-2 pr-4 font-medium">Students</th>
                <th className="py-2 pr-4 font-medium">Registered</th>
                <th className="py-2 pr-4 font-medium">Verified</th>
                <th className="py-2 pr-4 font-medium">Not registered</th>
                <th className="py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {sections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    No sections to show.
                  </td>
                </tr>
              ) : (
                sections.map((s) => {
                  const pct =
                    s.totalCount > 0 ? Math.round((s.registeredCount / s.totalCount) * 100) : 0
                  return (
                    <tr
                      key={s.section}
                      className="border-t border-gray-100 dark:border-zinc-800/60"
                      data-testid={`advisor-summary-section-${s.section}`}
                    >
                      <td className="py-2.5 pr-4 font-semibold text-gray-900 dark:text-white">
                        {s.section}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700 dark:text-zinc-300">{s.totalCount}</td>
                      <td className="py-2.5 pr-4 text-gray-700 dark:text-zinc-300">
                        {s.registeredCount}
                      </td>
                      <td className="py-2.5 pr-4 text-emerald-600 dark:text-emerald-400">
                        {s.verifiedCount}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500 dark:text-zinc-400">
                        {s.notRegisteredCount}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-gray-500 dark:text-zinc-400">
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card data-testid="advisor-recent-registrations">
        <CardHeader>
          <CardTitle>Recent Registrations</CardTitle>
        </CardHeader>
        <div className="mt-4 overflow-x-auto">
          {recentRegistrations.length === 0 ? (
            <div className="py-10 text-center">
              <XCircle className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-zinc-700" />
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                None of your students have registered for a competition yet.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">Student</th>
                  <th className="py-2 pr-4 font-medium">Sec</th>
                  <th className="py-2 pr-4 font-medium">Competition</th>
                  <th className="py-2 pr-4 font-medium">Registered</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRegistrations.map((r) => (
                  <tr
                    key={`${r.studentId}-${r.competitionId}`}
                    className="border-t border-gray-100 dark:border-zinc-800/60"
                    data-testid="advisor-recent-row"
                  >
                    <td className="py-2.5 pr-4">
                      <span className="text-gray-900 dark:text-white">{r.studentName}</span>
                      <span className="block text-xs text-gray-400">{r.studentEmail}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-700 dark:text-zinc-300">{r.section}</td>
                    <td className="py-2.5 pr-4 text-gray-700 dark:text-zinc-300">
                      {r.competitionName}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-zinc-400">
                      {formatDate(r.registeredAt)}
                    </td>
                    <td className="py-2.5">
                      <Badge variant={STATUS_VARIANT[r.status]} size="sm">
                        {STATUS_LABEL[r.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, Badge, Button } from '@comp-dash/design-system'
import { useAdvisorCompetitionRoster } from '@comp-dash/api'
import { exportToCSV } from '@/lib/export-csv'
import type { AdvisorStudentRow, AdvisorStudentStatus } from '@comp-dash/types'
import {
  Users,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Download,
  Search,
} from 'lucide-react'

const STATUS_META: Record<
  AdvisorStudentStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }
> = {
  verified: { label: 'Verified', variant: 'success' },
  registered: { label: 'Registered', variant: 'warning' },
  rejected: { label: 'Rejected', variant: 'danger' },
  not_registered: { label: 'Not registered', variant: 'default' },
}

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
      <div className={`flex items-center gap-2 ${tone}`}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}

export function AdvisorRosterPanel({ competitionId }: { competitionId: string }) {
  const { data, isLoading, error } = useAdvisorCompetitionRoster(competitionId)
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  if (isLoading) {
    return (
      <Card>
        <div className="space-y-3">
          <div className="h-5 w-56 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-zinc-800/60 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-32 bg-gray-100 dark:bg-zinc-800/60 rounded-xl animate-pulse" />
        </div>
      </Card>
    )
  }

  if (error) {
    // Surfaced rather than swallowed: an unmapped advisor account looks
    // identical to "no students" otherwise.
    const message =
      (error as any)?.response?.data?.error?.message ||
      (error as any)?.message ||
      'Could not load your roster'
    const detail = (error as any)?.response?.data?.error?.detail
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Students</CardTitle>
        </CardHeader>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 p-4">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{message}</p>
          {detail && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/80">{detail}</p>}
        </div>
      </Card>
    )
  }

  if (!data) return null

  const { advisor, totals, sections, yearScope, notEligible, eligibleYears, openToAllYears } = data

  const handleExport = () => {
    const headers = ['Section', 'Student', 'Email', 'Year', 'Status', 'Registered At', 'Verified At']
    const rows = sections.flatMap((s) =>
      s.students.map((st) => [
        st.section,
        st.name,
        st.email,
        st.year,
        STATUS_META[st.status].label,
        st.registeredAt ?? '',
        st.verifiedAt ?? '',
      ])
    )
    exportToCSV(`advisor-roster-${competitionId}`, headers, rows)
  }

  const matches = (st: AdvisorStudentRow) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return st.name.toLowerCase().includes(q) || st.email.toLowerCase().includes(q)
  }

  return (
    <Card data-testid="advisor-roster-panel">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>My Students</CardTitle>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
              {advisor.name} · {advisor.department} · {yearScope} · Section
              {advisor.assignedSections.length === 1 ? ' ' : 's '}
              {advisor.assignedSections.join(', ') || '—'}
            </p>
          </div>
          {totals.totalStudents > 0 && (
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
          )}
        </div>
      </CardHeader>

      {advisor.assignedSections.length === 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 p-4">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            No sections are assigned to your account, so there are no students to show.
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/80">
            Ask an admin to set <code>assigned_sections</code> on advisor record {advisor.id}.
          </p>
        </div>
      )}

      {notEligible && (
        <div className="mt-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/40 p-4">
          <p className="text-sm text-gray-700 dark:text-zinc-300">
            This competition is not open to {yearScope}.
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
            Eligible: {eligibleYears.length ? eligibleYears.join(', ') : 'unspecified'}
          </p>
        </div>
      )}

      {totals.totalStudents > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              label="Students"
              value={totals.totalStudents}
              icon={<Users className="w-4 h-4" />}
              tone="text-gray-500 dark:text-zinc-400"
            />
            <StatTile
              label="Registered"
              value={totals.registeredCount}
              icon={<CheckCircle2 className="w-4 h-4" />}
              tone="text-amber-600 dark:text-amber-400"
            />
            <StatTile
              label="Verified"
              value={totals.verifiedCount}
              icon={<ShieldCheck className="w-4 h-4" />}
              tone="text-emerald-600 dark:text-emerald-400"
            />
            <StatTile
              label="Not registered"
              value={totals.notRegisteredCount}
              icon={<XCircle className="w-4 h-4" />}
              tone="text-gray-500 dark:text-zinc-400"
            />
          </div>

          {openToAllYears && (
            <p className="mt-3 text-xs text-gray-500 dark:text-zinc-400">
              This competition lists no specific eligible year, so all years are treated as
              eligible.
            </p>
          )}

          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student by name or email…"
              aria-label="Search students"
              data-testid="advisor-roster-search"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder:text-gray-400"
            />
          </div>

          <div className="mt-4 space-y-2" data-testid="advisor-roster-sections">
            {sections.map((section) => {
              const isOpen = openSection === section.section
              const visible = section.students.filter(matches)
              const pct =
                section.totalCount > 0
                  ? Math.round((section.registeredCount / section.totalCount) * 100)
                  : 0

              return (
                <div
                  key={section.section}
                  className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden"
                  data-testid={`advisor-section-${section.section}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenSection(isOpen ? null : section.section)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Section {section.section}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-zinc-400">
                        {section.registeredCount} / {section.totalCount} registered
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:block w-28 h-1.5 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-gray-500 dark:text-zinc-400 w-9 text-right">
                        {pct}%
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-200 dark:border-zinc-800 overflow-x-auto">
                      {visible.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-center text-gray-400">
                          No students match “{query}”.
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-zinc-900/60">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-zinc-400">
                                Student
                              </th>
                              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-zinc-400">
                                Email
                              </th>
                              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-zinc-400">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map((st) => (
                              <tr
                                key={st.id}
                                className="border-t border-gray-100 dark:border-zinc-800/60"
                                data-testid="advisor-student-row"
                              >
                                <td className="px-4 py-2 text-gray-900 dark:text-white whitespace-nowrap">
                                  {st.name}
                                </td>
                                <td className="px-4 py-2 text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                                  {st.email}
                                </td>
                                <td className="px-4 py-2">
                                  <Badge variant={STATUS_META[st.status].variant} size="sm">
                                    {STATUS_META[st.status].label}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

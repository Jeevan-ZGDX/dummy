'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, Badge } from '@comp-dash/design-system'
import { ChevronDown, ChevronRight, Search, Users } from 'lucide-react'

/**
 * The signed-in advisor's students for one competition, grouped by section.
 *
 * Fetched with plain `fetch` rather than the shared axios client on purpose:
 * that client's interceptor turns any 401 into a hard redirect to /login, which
 * made a momentarily-unauthenticated roster look like the panel had silently
 * failed to render. Here a 401 is just an error message in place.
 */

interface RosterStudent {
  id: string
  name: string
  email: string
  section: string
  year: string
  status: 'not_registered' | 'registered' | 'verified' | 'rejected'
}

interface RosterSection {
  section: string
  totalCount: number
  registeredCount: number
  students: RosterStudent[]
}

interface RosterData {
  advisor: { id: string; name: string; email: string; assignedSections: string[] }
  yearScope: string
  sections: RosterSection[]
  notEligible?: boolean
  totals: {
    totalStudents: number
    registeredCount: number
    verifiedCount: number
    notRegisteredCount: number
  }
}

const STATUS_LABEL: Record<RosterStudent['status'], string> = {
  verified: 'Verified',
  registered: 'Registered',
  rejected: 'Rejected',
  not_registered: 'Not registered',
}

const STATUS_VARIANT = {
  verified: 'success',
  registered: 'warning',
  rejected: 'danger',
  not_registered: 'default',
} as const

export default function AdvisorRosterPanel({ competitionId }: { competitionId: string }) {
  const [data, setData] = useState<RosterData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)

    fetch(`/api/advisor/competitions/${competitionId}/roster`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(body?.error?.detail || body?.error?.message || 'Could not load your roster.')
          return
        }
        setData(body.data)
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message)
      })

    return () => {
      cancelled = true
    }
  }, [competitionId])

  const q = query.trim().toLowerCase()

  const sections = useMemo(() => {
    if (!data) return []
    return data.sections.map((s) => ({
      ...s,
      matches: q
        ? s.students.filter(
            (st) => st.name.toLowerCase().includes(q) || st.email.toLowerCase().includes(q)
          )
        : s.students,
    }))
  }, [data, q])

  function toggle(section: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  return (
    <Card padding="lg" data-testid="advisor-roster-panel" className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display tracking-tight text-lg font-medium text-gray-900 dark:text-ink-primary">
            My Students
          </h2>
          {data && (
            <p className="mt-1 text-sm text-gray-500 dark:text-ink-muted">
              {data.advisor.name} · Sections {data.advisor.assignedSections.join(', ') || '—'} ·{' '}
              {data.yearScope}
            </p>
          )}
        </div>
        {data && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-ink-muted">
            <Users className="w-4 h-4" aria-hidden="true" />
            <span className="tabular">
              {data.totals.registeredCount} of {data.totals.totalStudents} registered
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {data?.notEligible && (
        <p className="mt-4 text-sm text-gray-500 dark:text-ink-muted">
          This competition is not open to {data.yearScope}.
        </p>
      )}

      {data && !data.notEligible && (
        <>
          <div className="relative mt-4">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              aria-hidden="true"
            />
            <input
              data-testid="advisor-roster-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search students"
              className="w-full h-10 rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent dark:border-obsidian-border dark:bg-obsidian-surface dark:text-ink-primary"
            />
          </div>

          <div data-testid="advisor-roster-sections" className="mt-4 space-y-3">
            {sections.map((s) => {
              // A search opens every section: a filtered list the reader has to
              // expand section by section hides its own results.
              const expanded = q ? true : open.has(s.section)
              return (
                <div
                  key={s.section}
                  data-testid={`advisor-section-${s.section}`}
                  className="rounded-xl border border-gray-200 dark:border-obsidian-border"
                >
                  <button
                    type="button"
                    onClick={() => toggle(s.section)}
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="font-medium text-gray-900 dark:text-ink-primary">
                      Section {s.section}
                    </span>
                    <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-ink-muted">
                      <span className="tabular">
                        {s.registeredCount} / {s.totalCount} registered
                      </span>
                      {expanded ? (
                        <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      )}
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t border-gray-200 dark:border-obsidian-border">
                      {s.matches.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-ink-muted">
                          No students match that search.
                        </p>
                      ) : (
                        s.matches.map((st) => (
                          <div
                            key={st.email || st.id}
                            data-testid="advisor-student-row"
                            className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5 last:border-b-0 dark:border-obsidian-border/60"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900 dark:text-ink-primary">
                                {st.name}
                              </p>
                              <p className="truncate text-xs text-gray-500 dark:text-ink-muted">
                                {st.email}
                              </p>
                            </div>
                            <Badge variant={STATUS_VARIANT[st.status]} size="sm">
                              {STATUS_LABEL[st.status]}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {!data && !error && (
        <div className="mt-4 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-obsidian-hover" />
          ))}
        </div>
      )}
    </Card>
  )
}

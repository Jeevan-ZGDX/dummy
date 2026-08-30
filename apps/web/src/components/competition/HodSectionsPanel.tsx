'use client'

import { useEffect, useState } from 'react'
import { Card, Badge, Button } from '@comp-dash/design-system'
import { ArrowLeft, Users } from 'lucide-react'

/**
 * Department-wide, section-wise breakdown of one competition — the HOD view.
 *
 * HODs used to be shown the *advisor* roster, which resolves by session email;
 * `hod@citchennai.net` has no advisors row, so the panel rendered "no advisor
 * record is mapped to this account" instead of the department's numbers.
 *
 * Only student names and sections are rendered. The stored competition name is
 * deliberately never shown here — fixture rows carry a marker in that field, and
 * it has no business reaching a reader either way.
 */

interface SectionStudent {
  id: string
  name: string
  email: string
  section: string
  status: 'not_registered' | 'registered' | 'verified' | 'rejected'
}

interface SectionRow {
  section: string
  totalCount: number
  registeredCount: number
  verifiedCount: number
  registered: SectionStudent[]
}

interface SectionsData {
  eligibleYears: string[]
  sections: SectionRow[]
  notEligible?: boolean
  totals: { totalStudents: number; registeredCount: number }
}

const STATUS_LABEL: Record<SectionStudent['status'], string> = {
  verified: 'Verified',
  registered: 'Pending',
  rejected: 'Rejected',
  not_registered: 'Not registered',
}

const STATUS_VARIANT = {
  verified: 'success',
  registered: 'warning',
  rejected: 'danger',
  not_registered: 'default',
} as const

export default function HodSectionsPanel({ competitionId }: { competitionId: string }) {
  const [data, setData] = useState<SectionsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    setSelected(null)

    fetch(`/api/competitions/${competitionId}/sections`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(body?.error?.message || 'Could not load the section breakdown.')
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

  const current = data?.sections.find((s) => s.section === selected) ?? null

  return (
    <Card padding="lg" data-testid="hod-sections-panel" className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display tracking-tight text-lg font-medium text-gray-900 dark:text-ink-primary">
            Section-wise breakdown
          </h2>
          <p
            data-testid="hod-sections-scope"
            className="mt-1 text-sm text-gray-500 dark:text-ink-muted"
          >
            {data ? data.eligibleYears.join(', ') || 'No eligible cohort' : 'Loading…'}
          </p>
        </div>
        {data && !data.notEligible && (
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
          No cohort we hold data for is eligible for this competition.
        </p>
      )}

      {data && !data.notEligible && !current && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.sections.map((s) => (
            <button
              key={s.section}
              type="button"
              data-testid={`hod-section-card-${s.section}`}
              onClick={() => setSelected(s.section)}
              className="rounded-xl border border-gray-200 p-4 text-left transition-shadow hover:shadow-card dark:border-obsidian-border"
            >
              <p
                data-testid="hod-section-label"
                className="font-display text-2xl font-medium leading-none text-gray-900 dark:text-ink-primary"
              >
                {s.section}
              </p>
              <p className="mt-2 text-xs text-gray-500 tabular dark:text-ink-muted">
                {s.totalCount} students
              </p>
              <p className="mt-0.5 text-xs font-medium text-accent tabular">
                {s.registeredCount} registered
              </p>
            </button>
          ))}
        </div>
      )}

      {current && (
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="-ml-2">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to all sections
          </Button>

          <h3 className="font-display tracking-tight mt-3 text-base font-medium text-gray-900 dark:text-ink-primary">
            Section {current.section}
          </h3>
          <p className="mt-0.5 text-sm text-gray-500 tabular dark:text-ink-muted">
            {current.registeredCount} of {current.totalCount} registered
          </p>

          <div className="mt-3 rounded-xl border border-gray-200 dark:border-obsidian-border">
            {current.registered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-ink-muted">
                Nobody in this section has registered for this competition yet.
              </p>
            ) : (
              current.registered.map((st) => (
                <div
                  key={st.email || st.id}
                  data-testid="hod-section-student-row"
                  className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5 last:border-b-0 dark:border-obsidian-border/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-ink-primary">
                      {st.name}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-ink-muted">{st.email}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[st.status]} size="sm">
                    {STATUS_LABEL[st.status]}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {!data && !error && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-obsidian-hover" />
          ))}
        </div>
      )}
    </Card>
  )
}

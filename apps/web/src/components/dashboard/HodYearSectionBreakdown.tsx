'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, Badge, Button } from '@comp-dash/design-system'
import { exportToCSV } from '@/lib/export-csv'
import {
  GraduationCap,
  Users,
  Trophy,
  CheckCircle,
  Download,
  ArrowLeft,
  Search,
  Filter,
  Layers,
  AlertCircle,
  Loader2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'

interface StudentRegistration {
  id: string
  name: string
  email: string
  department: string
  section: string
  competitionId?: string
  competitionName?: string
  verificationStatus?: string
  registeredAt?: string
}

interface SectionData {
  section: string
  totalCount: number
  registeredCount: number
  verifiedCount: number
  coveragePercentage: number
  registeredStudents: StudentRegistration[]
}

interface YearSectionApiResponse {
  yearNumber: number
  yearLabel: string
  competitionId: string
  competitionTitle?: string
  totalStudents: number
  totalRegisteredStudents: number
  totalVerifiedCount: number
  overallCoveragePercentage: number
  availableCompetitions: Array<{ id: string; title: string }>
  sections: SectionData[]
}

const YEAR_OPTIONS = [
  { value: 2, label: 'Year 2', sublabel: '2nd Year' },
  { value: 3, label: 'Year 3', sublabel: '3rd Year' },
]

export function HodYearSectionBreakdown() {
  const [selectedYear, setSelectedYear] = useState<number>(3)
  const [selectedCompId, setSelectedCompId] = useState<string>('all')
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [studentSearch, setStudentSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<YearSectionApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.set('year', String(selectedYear))
    if (selectedCompId !== 'all') {
      params.set('competitionId', selectedCompId)
    }

    fetch(`/api/competitions/sections?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (!isMounted) return
        if (json.success && json.data) {
          setData(json.data)
        } else {
          setError(json.error?.message || 'Failed to load section data')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err.message || 'Error fetching data')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedYear, selectedCompId])

  const activeSection = useMemo(() => {
    if (!selectedSection || !data) return null
    return data.sections.find((s) => s.section === selectedSection) || null
  }, [selectedSection, data])

  const filteredStudents = useMemo(() => {
    if (!activeSection) return []
    const q = studentSearch.trim().toLowerCase()
    if (!q) return activeSection.registeredStudents
    return activeSection.registeredStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.competitionName && s.competitionName.toLowerCase().includes(q))
    )
  }, [activeSection, studentSearch])

  const handleExport = () => {
    if (!data) return
    const headers = [
      'Year',
      'Section',
      'Total Students',
      'Registered Students',
      'Verified Count',
      'Coverage %',
    ]
    const rows = data.sections.map((s) => [
      data.yearLabel,
      `Section ${s.section}`,
      String(s.totalCount),
      String(s.registeredCount),
      String(s.verifiedCount),
      `${s.coveragePercentage}%`,
    ])
    const filename = `hod-year-${data.yearNumber}-section-breakdown`
    exportToCSV(filename, headers, rows)
  }

  return (
    <Card className="bg-white dark:bg-obsidian-surface border border-gray-200 dark:border-obsidian-border rounded-2xl shadow-sm overflow-hidden p-6 md:p-8 space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-obsidian-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-accent/10 dark:bg-striver/10 flex items-center justify-center text-accent dark:text-striver">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-ink-primary">
              Department Section Breakdown
            </h2>
            <Badge variant="primary" size="sm">HOD View</Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-obsidian-faint">
            Class participation and section-wise performance for {data?.yearLabel || `Year ${selectedYear}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Year Selector Tabs */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-obsidian-elevated rounded-xl border border-gray-200 dark:border-obsidian-border">
            {YEAR_OPTIONS.map((y) => {
              const isSelected = selectedYear === y.value
              return (
                <button
                  key={y.value}
                  type="button"
                  onClick={() => {
                    setSelectedYear(y.value)
                    setSelectedSection(null)
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-accent dark:bg-striver text-white shadow-sm'
                      : 'text-gray-600 dark:text-ink-muted hover:text-gray-900 dark:hover:text-ink-primary'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{y.label}</span>
                  <span className="opacity-70 text-[10px]">({y.sublabel})</span>
                </button>
              )
            })}
          </div>

          {/* Competition Scope Selector */}
          <div className="relative">
            <select
              value={selectedCompId}
              onChange={(e) => {
                setSelectedCompId(e.target.value)
                setSelectedSection(null)
              }}
              className="h-9 px-3 pr-8 bg-gray-50 dark:bg-obsidian-elevated border border-gray-200 dark:border-obsidian-border rounded-xl text-xs font-medium text-gray-800 dark:text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
            >
              <option value="all">All Competitions (Cumulative)</option>
              {data?.availableCompetitions?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Export Action */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={!data || data.sections.length === 0}
            className="flex items-center gap-1.5 text-xs h-9 rounded-xl border-gray-200 dark:border-obsidian-border"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-obsidian-hover rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-28 bg-gray-100 dark:bg-obsidian-hover rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : !data || data.sections.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-gray-200 dark:border-obsidian-border">
          <GraduationCap className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-obsidian-faint" />
          <p className="text-sm font-semibold text-gray-800 dark:text-ink-primary">
            No Student Data for {data?.yearLabel || `Year ${selectedYear}`}
          </p>
          <p className="text-xs text-gray-500 dark:text-obsidian-faint mt-1">
            There are currently no students mapped to this academic year in the database.
          </p>
        </div>
      ) : (
        <>
          {/* Summary KPIs Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-obsidian-elevated/60 border border-gray-100 dark:border-obsidian-border flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-gemini flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-obsidian-faint">Total Students</p>
                <p className="text-lg font-bold text-gray-900 dark:text-ink-primary">
                  {data.totalStudents}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-obsidian-elevated/60 border border-gray-100 dark:border-obsidian-border flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-accent/10 dark:bg-striver/10 text-accent dark:text-striver flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-obsidian-faint">Registered</p>
                <p className="text-lg font-bold text-accent dark:text-striver">
                  {data.totalRegisteredStudents}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-obsidian-elevated/60 border border-gray-100 dark:border-obsidian-border flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-obsidian-faint">Verified</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {data.totalVerifiedCount}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-obsidian-elevated/60 border border-gray-100 dark:border-obsidian-border flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-uv flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-obsidian-faint">Participation Rate</p>
                <p className="text-lg font-bold text-purple-600 dark:text-uv">
                  {data.overallCoveragePercentage}%
                </p>
              </div>
            </div>
          </div>

          {/* Section-Wise Manner View */}
          {activeSection ? (
            /* Drilldown View for Selected Section */
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 dark:bg-obsidian-elevated/40 p-4 rounded-xl border border-gray-200 dark:border-obsidian-border">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedSection(null)}
                    className="p-1.5 rounded-lg bg-white dark:bg-obsidian-surface border border-gray-200 dark:border-obsidian-border text-gray-600 dark:text-ink-muted hover:text-gray-900 dark:hover:text-ink-primary transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900 dark:text-ink-primary">
                        Section {activeSection.section} Roster
                      </h3>
                      <Badge variant="default" size="sm">
                        {data.yearLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-obsidian-faint mt-0.5">
                      {activeSection.registeredCount} / {activeSection.totalCount} students registered ({activeSection.coveragePercentage}% coverage)
                    </p>
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-obsidian-faint" />
                  <input
                    type="text"
                    placeholder="Search student or competition.   .."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 bg-white dark:bg-obsidian-surface border border-gray-200 dark:border-obsidian-border rounded-lg text-xs text-gray-900 dark:text-ink-primary placeholder-gray-400 dark:placeholder-obsidian-faint focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {filteredStudents.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-obsidian-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-obsidian-elevated text-gray-600 dark:text-ink-muted border-b border-gray-200 dark:border-obsidian-border">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Student</th>
                        <th className="py-3 px-4 font-semibold">Email</th>
                        <th className="py-3 px-4 font-semibold">Competition</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-obsidian-border">
                      {filteredStudents.map((s, idx) => (
                        <tr
                          key={`${s.email}-${idx}`}
                          className="hover:bg-gray-50/60 dark:hover:bg-obsidian-hover/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-gray-900 dark:text-ink-primary">
                            {s.name}
                          </td>
                          <td className="py-3 px-4 text-gray-500 dark:text-obsidian-faint font-mono">
                            {s.email}
                          </td>
                          <td className="py-3 px-4 text-gray-700 dark:text-ink-muted">
                            {s.competitionName || 'General Competition'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                s.verificationStatus === 'verified' || s.verificationStatus === 'completed'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                              }`}
                            >
                              {s.verificationStatus === 'verified' || s.verificationStatus === 'completed'
                                ? 'Verified'
                                : 'Registered'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 rounded-xl border border-dashed border-gray-200 dark:border-obsidian-border">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-obsidian-faint" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-ink-primary">
                    {studentSearch
                      ? 'No registered students match your search'
                      : `No registrations found for Section ${activeSection.section}`}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-obsidian-faint mt-0.5">
                    {activeSection.totalCount} total students enrolled in this section.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-obsidian-faint">
                  Select a section to inspect student roster & details:
                </p>
                <span className="text-xs text-gray-400 dark:text-obsidian-faint font-semibold">
                  {data.sections.length} Sections Total
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                {data.sections.map((s) => {
                  const hasRegistrations = s.registeredCount > 0
                  return (
                    <button
                      key={s.section}
                      type="button"
                      onClick={() => setSelectedSection(s.section)}
                      className={`text-left p-5 md:p-6 rounded-2xl border transition-all duration-200 hover:scale-[1.02] cursor-pointer group flex flex-col justify-between min-h-[140px] shadow-sm ${
                        hasRegistrations
                          ? 'bg-accent/[0.04] dark:bg-obsidian-elevated/80 border-accent/30 dark:border-accent/40 hover:border-accent shadow-md'
                          : 'bg-gray-50/70 dark:bg-obsidian-elevated/40 border-gray-200 dark:border-obsidian-border hover:border-gray-300 dark:hover:border-obsidian-faint'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-bold text-gray-900 dark:text-ink-primary group-hover:text-accent dark:group-hover:text-striver transition-colors">
                            Section {s.section}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-obsidian-faint mt-1">
                            {s.totalCount} students enrolled
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            hasRegistrations
                              ? 'bg-accent/10 dark:bg-striver/10 text-accent dark:text-striver'
                              : 'bg-gray-100 dark:bg-obsidian-border text-gray-500 dark:text-obsidian-faint'
                          }`}
                        >
                          {s.coveragePercentage}%
                        </span>
                      </div>

                      <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-obsidian-faint">
                            Registered:
                          </span>
                          <span
                            className={`font-semibold ${
                              hasRegistrations
                                ? 'text-accent dark:text-striver'
                                : 'text-gray-400 dark:text-obsidian-faint'
                            }`}
                          >
                            {s.registeredCount} / {s.totalCount}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-gray-200 dark:bg-obsidian-border rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              s.coveragePercentage >= 50
                                ? 'bg-emerald-500'
                                : s.coveragePercentage > 0
                                ? 'bg-accent dark:bg-striver'
                                : 'bg-transparent'
                            }`}
                            style={{ width: `${Math.max(s.coveragePercentage, 2)}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

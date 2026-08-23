'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Card, Badge, Button } from '@comp-dash/design-system'
import { useCompetitions, isFirestoreEnabled } from '@comp-dash/api'
import { getCurrentUser } from '@/lib/auth'
import { HodYearSectionBreakdown } from '@/components/dashboard/HodYearSectionBreakdown'
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  ArrowRight,
  Search,
  Pencil,
  Trophy,
  Sparkles,
  ExternalLink,
  Filter,
  CheckCircle,
  Tag,
} from 'lucide-react'
import type { CompetitionCategory } from '@comp-dash/types'

const categoryOptions = [
  { label: 'All', value: 'all' },
  { label: 'Competition', value: 'competition' },
  { label: 'Hackathons', value: 'hackathon' },
]

const categoryGradients: Record<string, string> = {
  competition: 'from-violet-500 to-purple-600',
  'c + p': 'from-emerald-500 to-teal-600',
  'c + i': 'from-blue-500 to-cyan-600',
  'start-up': 'from-amber-500 to-orange-600',
  hackathon: 'from-pink-500 to-rose-600',
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CompetitionsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    setUser(getCurrentUser())
  }, [])

  const realtime = isFirestoreEnabled()

  const { data, isLoading } = useCompetitions({
    category: selectedCategory === 'all' ? undefined : (selectedCategory as CompetitionCategory),
    search: search || undefined,
  })

  const competitions = data?.data ?? []

  const stats = useMemo(() => {
    const total = competitions.length
    const active = competitions.filter((c: any) => {
      if (!c.registrationDeadline) return true
      return new Date(c.registrationDeadline) > new Date()
    }).length
    return { total, active }
  }, [competitions])

  const isHodOrAdmin = user?.role === 'hod' || user?.role === 'super_admin'

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* ─── Top Layer: Competitions Overview & Directory ─────────────────── */}
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-ink-primary">
                {t('sidebar.competitions') || 'Competitions Hub'}
              </h1>
              <Badge variant="primary" size="sm">
                Directory
              </Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-obsidian-faint mt-1">
              Explore national and global tech hackathons, coding challenges, and innovation competitions
            </p>
          </div>

          <div className="flex items-center gap-3">
            {realtime && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-xs text-emerald-700 dark:text-emerald-400 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </div>
            )}
            {user?.role === 'super_admin' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push('/create-competition')}
                className="text-xs h-9 rounded-xl shadow-sm"
              >
                + Add Competition
              </Button>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-obsidian-faint" />
            <input
              type="text"
              placeholder="Search by competition title, organizer, or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-obsidian-surface border border-gray-200 dark:border-obsidian-border rounded-xl text-sm text-gray-900 dark:text-ink-primary placeholder-gray-400 dark:placeholder-obsidian-faint focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap items-center overflow-x-auto pb-1 sm:pb-0">
            {categoryOptions.map((cat) => {
              const isSelected = selectedCategory === cat.value
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${isSelected
                      ? 'bg-accent dark:bg-striver text-white shadow-sm scale-105'
                      : 'bg-white dark:bg-obsidian-surface border border-gray-200 dark:border-obsidian-border text-gray-600 dark:text-ink-muted hover:bg-gray-50 dark:hover:bg-obsidian-hover hover:text-gray-900 dark:hover:text-ink-primary'
                    }`}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Competitions Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-64 bg-gray-100 dark:bg-obsidian-surface/60 rounded-2xl border border-gray-200 dark:border-obsidian-border animate-pulse"
              />
            ))}
          </div>
        ) : competitions.length === 0 ? (
          <Card className="bg-white dark:bg-obsidian-surface border border-gray-200 dark:border-obsidian-border rounded-2xl p-12 text-center">
            <div className="flex flex-col items-center justify-center text-gray-400 dark:text-obsidian-faint">
              <Calendar className="w-12 h-12 mb-3 text-gray-300 dark:text-obsidian-faint" />
              <p className="text-sm font-semibold text-gray-800 dark:text-ink-primary">
                {search ? 'No matching competitions found' : 'No competitions listed yet'}
              </p>
              <p className="text-xs text-gray-500 dark:text-obsidian-faint mt-1">
                {search ? 'Try clearing your search or category filter' : 'New competitions will appear here'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {competitions.map((comp: any) => {
              const deadline = comp.registrationDeadline ? new Date(comp.registrationDeadline) : null
              const isOpen = deadline ? deadline > new Date() : true
              const daysLeft = deadline
                ? Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null

              const categoryKey = String(comp.category || 'competition').toLowerCase()
              const stripeGradient =
                categoryGradients[categoryKey] || 'from-violet-500 to-purple-600'

              return (
                <div
                  key={comp.id}
                  onClick={() => router.push(`/competitions/${comp.id}`)}
                  className="bg-white dark:bg-obsidian-surface border border-gray-200 dark:border-obsidian-border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 hover:scale-[1.015] hover:border-accent/40 dark:hover:border-accent/50 cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    {/* Category Top Gradient Stripe */}
                    <div className={`h-1.5 bg-gradient-to-r ${stripeGradient}`} />

                    <div className="p-5">
                      {/* Badge & Days Left Tag */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-accent/10 dark:bg-accent/20 text-accent dark:text-uv border border-accent/20">
                          {comp.category || 'Competition'}
                        </span>
                        {daysLeft !== null && (
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${isOpen
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                              }`}
                          >
                            {isOpen ? (daysLeft > 0 ? `${daysLeft}d left` : 'Closing soon') : 'Closed'}
                          </span>
                        )}
                      </div>

                      {/* Competition Title */}
                      <h3 className="text-base font-bold text-gray-900 dark:text-ink-primary mb-2 line-clamp-2 group-hover:text-accent dark:group-hover:text-striver transition-colors">
                        {comp.title}
                      </h3>

                      {/* Eligibility Tag */}
                      {comp.eligibility?.yearOfStudy?.filter(Boolean).length > 0 && (
                        <div className="mb-3.5 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-gray-400 dark:text-obsidian-faint">Eligible:</span>
                          {comp.eligibility.yearOfStudy.filter(Boolean).map((yr: string) => (
                            <span
                              key={yr}
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-obsidian-elevated text-gray-700 dark:text-ink-muted"
                            >
                              {yr}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Details & Dates Metadata */}
                      <div className="space-y-1.5 mb-4 text-xs text-gray-500 dark:text-obsidian-faint">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-obsidian-faint shrink-0" />
                          <span>
                            {formatDate(comp.startDate) || 'TBA'}
                            {comp.endDate ? ` – ${formatDate(comp.endDate)}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-gray-400 dark:text-obsidian-faint shrink-0" />
                          <span className="truncate">{comp.organizer || 'Official Organizer'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Strip */}
                  <div className="p-5 pt-0">
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-obsidian-border">
                      <div>
                        <p className="text-[11px] text-gray-400 dark:text-obsidian-faint">Prize Pool</p>
                        <p className="text-sm font-bold text-accent dark:text-striver">
                          {comp.prizePool || 'N/A'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {(comp.registrationLink || comp.registrationUrl) && (
                          <a
                            href={comp.registrationLink || comp.registrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-3 py-1.5 bg-accent dark:bg-striver text-white rounded-lg text-xs font-semibold hover:bg-accent/90 dark:hover:bg-striver-hover transition-transform duration-200 hover:scale-105 active:scale-95 shadow-sm"
                          >
                            Register
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </a>
                        )}

                        {user?.role === 'super_admin' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/create-competition?edit=${comp.id}`)
                            }}
                            className="p-1.5 bg-gray-50 dark:bg-obsidian-elevated border border-gray-200 dark:border-obsidian-border rounded-lg text-gray-600 dark:text-ink-muted hover:text-accent dark:hover:text-striver transition-colors"
                            title="Edit Competition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className="flex items-center gap-1 text-xs font-semibold text-accent dark:text-uv group-hover:gap-1.5 transition-all">
                          Details <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Bottom Layer: HOD Departmental Year & Section Breakdown ─────── */}
      {isHodOrAdmin && (
        <div className="pt-4">
          <HodYearSectionBreakdown />
        </div>
      )}
    </div>
  )
}
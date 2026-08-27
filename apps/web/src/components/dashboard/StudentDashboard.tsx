'use client'

import { useTranslation } from 'react-i18next'
import { StatCard, Card, CardHeader, CardTitle, StatCardSkeleton } from '@comp-dash/design-system'
import { useStudentDashboardStats } from '@comp-dash/api'
import { Trophy, UserCheck, Target, Medal, Calendar, UserX } from 'lucide-react'

export default function StudentDashboard() {
  const { t } = useTranslation()
  const { data: stats, isLoading } = useStudentDashboardStats()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-64 bg-gray-100 rounded animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  const registered = stats?.totalRegistered ?? 0
  const verified = stats?.totalVerified ?? 0
  const pending = stats?.totalPending ?? 0
  const wins = stats?.totalWins ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary">{t('home.greeting', { name: 'Student' })}</h1>
        <p className="text-white-500 mt-1">{t('home.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('home.wins')}
          value={wins}
          change={0}
          changeLabel={t('dashboard.fromLastWeek')}
          icon={<Medal className="w-5 h-5" />}
        />
        <StatCard
          title={t('Registered')}
          value={registered}
          change={2}
          changeLabel={t('dashboard.fromLastWeek')}
          icon={<Trophy className="w-5 h-5" />}
        />
        <StatCard
          title={t('Unregistered')}
          value={stats?.unregisteredCount ?? 0}
          change={0}
          changeLabel={t('dashboard.fromLastWeek')}
          icon={<UserX className="w-5 h-5" />}
        />
        <StatCard
          title={t('home.verified')}
          value={verified}
          change={1}
          changeLabel={t('dashboard.fromLastWeek')}
          icon={<UserCheck className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('Upcoming Competitions')}</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-3">
            {(stats?.upcomingCompetitions?.length ?? 0) > 0 ? (
              stats!.upcomingCompetitions.map((comp) => (
                <div key={comp.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{comp.title}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(comp.startDate).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-center">
                <span className="text-sm text-gray-400">{t('home.noUpcoming')}</span>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('home.pending')}</CardTitle>
          </CardHeader>
          <div className="mt-4 space-y-3">
            {(stats?.registrations?.filter(r => r.status === 'pending_verification').length ?? 0) > 0 ? (
              stats!.registrations.filter(r => r.status === 'pending_verification').map((reg) => (
                <div key={reg.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Target className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{reg.competition?.title}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {reg.registeredAt ? new Date(reg.registeredAt).toLocaleDateString() : '-'}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-center">
                <span className="text-sm text-gray-400">{t('home.noPending')}</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

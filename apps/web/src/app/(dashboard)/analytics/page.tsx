'use client'

import { useTranslation } from 'react-i18next'
import {
  Card, CardHeader, CardTitle, StatCard, StatCardSkeleton, Button,
} from '@comp-dash/design-system'
import { useAdminAnalytics, useLeaderboardOverall } from '@comp-dash/api'
import { BarChart3, Users, TrendingUp, CheckCircle, Download } from 'lucide-react'
import { exportToCSV } from '@/lib/export-csv'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const { isDark } = useTheme()
  const { data: stats, isLoading } = useAdminAnalytics()
  const { data: leaderboard } = useLeaderboardOverall()

  const gridStroke = isDark ? '#333537' : '#E5E7EB'
  const axisColor = isDark ? '#9AA0A6' : '#6B7280'
  const tooltipBg = isDark ? '#1E1F20' : '#FFFFFF'
  const tooltipBorder = isDark ? '#333537' : '#E5E7EB'
  const tooltipText = isDark ? '#E3E3E3' : '#111827'
  const trendColor = isDark ? '#F97316' : '#6C4CF1'

  const classData = (leaderboard || []).reduce<Record<string, { section: string; points: number; wins: number; students: Set<string> }>>((acc, e) => {
    const section = e.section || 'Unknown'
    if (!acc[section]) acc[section] = { section, points: 0, wins: 0, students: new Set() }
    acc[section].points += e.points
    acc[section].wins += e.wins
    acc[section].students.add(e.email)
    return acc
  }, {})

  const classChartData = Object.values(classData)
    .map(c => ({ name: c.section, points: c.points, wins: c.wins, students: c.students.size }))
    .sort((a, b) => b.points - a.points)

  const handleExport = () => {
    if (!stats) return
    exportToCSV(
      'analytics',
      ['Metric', 'Value'],
      [
        ['Total Competitions', String(stats.totalCompetitions ?? 0)],
        ['Total Participants', String(stats.totalParticipants ?? 0)],
        ['Win Rate', `${stats.winRate ?? 0}%`],
        ['Verification Rate', `${stats.verificationRate ?? 0}%`],
        ['Trend Data Points', String(stats.competitionTrends?.length ?? 0)],
        ['Classes Tracked', String(classChartData.length)],
      ]
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary">{t('sidebar.analytics')}</h1>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Competitions"
            value={stats?.totalCompetitions?.toLocaleString() || '0'}
            change={12}
            changeLabel="from last month"
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <StatCard
            title="Total Participants"
            value={stats?.totalParticipants?.toLocaleString() || '0'}
            change={8}
            changeLabel="from last month"
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Win Rate"
            value={`${stats?.winRate || 0}%`}
            change={-2}
            changeLabel="from last month"
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            title="Verification Rate"
            value={`${stats?.verificationRate || 0}%`}
            change={5}
            changeLabel="from last month"
            icon={<CheckCircle className="w-5 h-5" />}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Competition Trends</CardTitle>
          </CardHeader>
          <div className="mt-4 h-64">
            {stats?.competitionTrends && stats.competitionTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.competitionTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="date" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      borderRadius: '12px',
                      color: tooltipText,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    itemStyle={{ color: tooltipText }}
                  />
                  <Line type="monotone" dataKey="count" stroke={trendColor} strokeWidth={2} dot={{ fill: trendColor, strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-obsidian-hover rounded-xl">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-gray-300 dark:text-obsidian-faint mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-ink-muted">No data available</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>Class-wise Performance</CardTitle>
          </CardHeader>
          <div className="mt-4 h-64">
            {classChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="name" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      borderRadius: '12px',
                      color: tooltipText,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    itemStyle={{ color: tooltipText }}
                  />
                  <Bar dataKey="points" name="Total Points" fill={trendColor} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-obsidian-hover rounded-xl">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-gray-300 dark:text-obsidian-faint mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-ink-muted">No data available</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <CardHeader>
          <CardTitle>Verification Rates</CardTitle>
        </CardHeader>
        <div className="mt-4 h-64">
          {stats?.verificationRateOverTime && stats.verificationRateOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.verificationRateOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '12px',
                    color: tooltipText,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  itemStyle={{ color: tooltipText }}
                  formatter={(value: number) => [`${value}%`, 'Rate']}
                />
                <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-xl">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No data available</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

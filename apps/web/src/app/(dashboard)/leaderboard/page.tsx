'use client'

import { useState } from 'react'
import { Card } from '@comp-dash/design-system'
import { usePrizeLeaderboard, useRecentWinners } from '@comp-dash/api'
import { Trophy, Award, Clock } from 'lucide-react'

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-white font-bold text-xs shadow-sm">1</span>
  if (rank === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-700 font-bold text-xs shadow-sm">2</span>
  if (rank === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white font-bold text-xs shadow-sm">3</span>
  return <span className="text-sm font-semibold text-gray-500 dark:text-zinc-400 pl-2">#{rank}</span>
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(2)} Cr`
  }
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(2)} L`
  }
  return `${amount.toLocaleString()}`
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'prize' | 'recent'>('prize')

  const { data: prizeData, isLoading: prizeLoading } = usePrizeLeaderboard()
  const { data: recentData, isLoading: recentLoading } = useRecentWinners()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-white">Leaderboard</h1>
      </div>

      <Card padding="none" className="overflow-hidden bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800">
        <div className="flex border-b border-gray-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('prize')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 ${
              activeTab === 'prize'
                ? 'text-accent border-b-2 border-accent bg-accent/5'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Top Achievers
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 ${
              activeTab === 'recent'
                ? 'text-accent border-b-2 border-accent bg-accent/5'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Winners
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'prize' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400">
                      <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Rank</th>
                      <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Student Name</th>
                      <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Email</th>
                      <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Section</th>
                      <th className="text-center text-xs font-medium uppercase tracking-wider px-4 py-3">Competitions Won</th>
                      <th className="text-right text-xs font-medium uppercase tracking-wider px-4 py-3">Total Prize Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prizeLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-zinc-800/50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="h-10 bg-gray-100 dark:bg-zinc-800/50 rounded animate-pulse" />
                          </td>
                        </tr>
                      ))
                    ) : prizeData && prizeData.length > 0 ? (
                      prizeData.map((entry) => (
                        <tr key={entry.rank} className="border-b border-gray-100 dark:border-zinc-800/60 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-4">
                            <RankBadge rank={entry.rank} />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.studentName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 dark:text-zinc-400 max-w-[250px] truncate">
                            {entry.email}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 dark:text-zinc-400">
                            {entry.section || '-'}
                          </td>
                          <td className="px-4 py-4 text-center text-sm font-medium text-gray-900 dark:text-white">
                            {entry.competitionsWon}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                              Rs.{entry.totalPrizeAmount}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-500 dark:text-zinc-500">No data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'recent' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                Recent winners
              </p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400">
                      <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">#</th>
                      <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Student Name</th>
                      <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Email</th>
                      <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Section</th>
                      <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Competition</th>
                      <th className="text-right text-xs font-medium uppercase tracking-wider px-4 py-3">Prize Amount</th>
                      <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-zinc-800/50">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="h-10 bg-gray-100 dark:bg-zinc-800/50 rounded animate-pulse" />
                          </td>
                        </tr>
                      ))
                    ) : recentData && recentData.length > 0 ? (
                      recentData.map((entry) => (
                        <tr key={entry.rank} className="border-b border-gray-100 dark:border-zinc-800/60 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-4">
                            <RankBadge rank={entry.rank} />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.studentName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 dark:text-zinc-400 max-w-[200px] truncate">
                            {entry.email}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 dark:text-zinc-400">
                            {entry.section || '-'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 dark:text-zinc-400 max-w-[250px] truncate">
                            {entry.competition}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-medium text-amber-600 dark:text-amber-400">
                            Rs.{entry.prize || '-'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500 dark:text-zinc-500">
                            {entry.date ? new Date(entry.date).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-500 dark:text-zinc-500">No recent winners</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
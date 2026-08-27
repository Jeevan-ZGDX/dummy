'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, Badge } from '@comp-dash/design-system'
import { useStudentHistory } from '@comp-dash/api'
import { Clock, CheckCircle, XCircle, FileCheck, Filter, Calendar, Award } from 'lucide-react'
import type { RegistrationStatus } from '@comp-dash/types'

type Tab = 'all' | 'pending_verification' | 'verified' | 'completed' | 'rejected'

const tabs: { key: Tab; label: string; icon: typeof Clock }[] = [
  { key: 'all', label: 'All', icon: Clock },
  { key: 'pending_verification', label: 'Pending', icon: Clock },
  { key: 'verified', label: 'Verified', icon: CheckCircle },
  { key: 'completed', label: 'Completed', icon: FileCheck },
  { key: 'rejected', label: 'Rejected', icon: XCircle },
]

const statusConfig: Record<RegistrationStatus, { variant: 'warning' | 'success' | 'info' | 'danger'; label: string }> = {
  pending_verification: { variant: 'warning', label: 'Pending' },
  verified: { variant: 'success', label: 'Verified' },
  completed: { variant: 'info', label: 'Completed' },
  rejected: { variant: 'danger', label: 'Rejected' },
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const { data: history, isLoading } = useStudentHistory()

  const filtered = !history
    ? []
    : activeTab === 'all'
      ? history
      : history.filter((h) => h.status === activeTab)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary">My History</h1>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-obsidian-border overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'text-accent border-b-2 border-accent bg-accent/5'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-obsidian-faint dark:hover:text-ink-muted dark:hover:bg-obsidian-hover'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {history && activeTab === 'all' && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full dark:bg-obsidian-hover dark:text-obsidian-faint">{history.length}</span>
                )}
                {history && activeTab !== 'all' && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full dark:bg-obsidian-hover dark:text-obsidian-faint">
                    {history.filter((h) => h.status === activeTab).length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 dark:bg-obsidian-hover rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((entry) => {
                const config = statusConfig[entry.status]
                return (
                  <div
                    key={entry.registration.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-shadow dark:bg-obsidian-surface dark:border-obsidian-border"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        entry.status === 'verified' || entry.status === 'completed'
                          ? 'bg-green-50 text-green-600'
                          : entry.status === 'rejected'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {entry.status === 'verified' || entry.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : entry.status === 'rejected' ? (
                          <XCircle className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-ink-primary">{entry.competition.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-obsidian-faint">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(entry.registration.registeredAt).toLocaleDateString()}
                          </span>
                          {entry.verifiedAt && (
                            <span className="flex items-center gap-1">
                              <FileCheck className="w-3 h-3" />
                              {new Date(entry.verifiedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {(entry.position || entry.prize) && (
                        <div className="flex items-center gap-1 text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">
                          <Award className="w-3 h-3" />
                          {entry.position && <span>{entry.position}</span>}
                          {entry.prize && <span>· {entry.prize}</span>}
                        </div>
                      )}
                      <Badge variant={config.variant} size="sm">{config.label}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-obsidian-hover rounded-full flex items-center justify-center">
                <Filter className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm dark:text-obsidian-faint">
                {activeTab === 'all'
                  ? 'No history entries yet'
                  : `No ${tabs.find(t => t.key === activeTab)?.label.toLowerCase() || ''} entries`}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

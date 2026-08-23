'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Card, Button, SearchBar, StatusBadge } from '@comp-dash/design-system'
import { useRegistrations, useVerifyRegistration } from '@comp-dash/api'
import { useToast } from '@/contexts/ToastContext'
import { exportToCSV } from '@/lib/export-csv'
import { Download, ExternalLink, CheckCircle2, XCircle, Loader2, Eye } from 'lucide-react'
import type { RegistrationStatus } from '@comp-dash/types'

const statusOptions = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending_verification' },
  { label: 'Verified', value: 'verified' },
  { label: 'Completed', value: 'completed' },
  { label: 'Rejected', value: 'rejected' },
]

export default function RegistrationsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [actionId, setActionId] = useState<string | null>(null)

  const { data, isLoading } = useRegistrations({
    status: selectedStatus === 'all' ? undefined : (selectedStatus as RegistrationStatus),
    page,
    limit: 10,
  })

  const { mutate: verify } = useVerifyRegistration()

  const handleVerify = (id: string, action: 'approve' | 'reject') => {
    setActionId(id)
    verify(
      { id, action },
      {
        onSuccess: () => {
          toast('success', action === 'approve' ? 'Registration approved' : 'Registration rejected')
          setActionId(null)
        },
        onError: () => {
          toast('error', 'Action failed')
          setActionId(null)
        },
      }
    )
  }

  const handleExport = () => {
    if (!data?.data) return
    exportToCSV(
      'registrations',
      ['Student ID', 'Competition', 'Status', 'Registered On', 'Verified On'],
      data.data.map(r => [
        r.userId,
        r.competition.title,
        r.status,
        new Date(r.registeredAt).toLocaleDateString(),
        r.verifiedAt ? new Date(r.verifiedAt).toLocaleDateString() : '-',
      ])
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-ink-primary">{t('sidebar.registrations')}</h1>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <Card padding="md">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchBar
              placeholder="Search registrations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>
          <div className="flex gap-2">
            {statusOptions.map((status) => (
              <button
                key={status.value}
                onClick={() => { setSelectedStatus(status.value); setPage(1) }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  selectedStatus === status.value
                    ? 'bg-accent text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-obsidian-hover dark:text-ink-muted'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-obsidian-border">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 dark:text-obsidian-faint">Student</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 dark:text-obsidian-faint">Competition</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 dark:text-obsidian-faint">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 dark:text-obsidian-faint">Registered On</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 dark:text-obsidian-faint">Verified On</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 dark:text-obsidian-faint">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-10 bg-gray-100 rounded animate-pulse dark:bg-obsidian-hover" />
                    </td>
                  </tr>
                ))
              ) : data?.data && data.data.length > 0 ? (
                data.data.map((reg) => {
                  const loading = actionId === reg.id
                  return (
                    <tr key={reg.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-ink-primary">{reg.userId}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-ink-muted">{reg.competition.title}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={reg.status as 'pending' | 'verified' | 'completed' | 'rejected'} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-ink-muted">
                        {new Date(reg.registeredAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-ink-muted">
                        {reg.verifiedAt ? new Date(reg.verifiedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {reg.status === 'pending_verification' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVerify(reg.id, 'reject')}
                                disabled={loading}
                              >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleVerify(reg.id, 'approve')}
                                disabled={loading}
                              >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Verify
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/registrations/${reg.id}`)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500 dark:text-obsidian-faint">No registrations found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 10 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-obsidian-border">
            <p className="text-sm text-gray-500 dark:text-obsidian-faint">
              Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(data.total / 10)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

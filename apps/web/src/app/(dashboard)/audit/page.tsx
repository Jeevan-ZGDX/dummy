'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Button, Badge } from '@comp-dash/design-system'
import { useAdminAuditLogs } from '@comp-dash/api'
import { Download, FileText } from 'lucide-react'
import { exportToCSV } from '@/lib/export-csv'

const actionColors: Record<string, 'success' | 'primary' | 'danger' | 'info'> = {
  Verified: 'success',
  Created: 'primary',
  Rejected: 'danger',
  Updated: 'info',
  Deleted: 'danger',
}

export default function AuditPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useAdminAuditLogs({ page, limit: 10 })

  const handleExport = () => {
    if (!data?.data) return
    exportToCSV(
      'audit-logs',
      ['Timestamp', 'User', 'Action', 'Resource', 'Details'],
      data.data.map(l => [l.timestamp, l.user, l.action, l.resource, l.details])
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-ink-primary">{t('sidebar.auditLogs')}</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export Logs
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-obsidian-border">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 dark:text-obsidian-faint">Timestamp</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 dark:text-obsidian-faint">User</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 dark:text-obsidian-faint">Action</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 dark:text-obsidian-faint">Resource</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 dark:text-obsidian-faint">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="h-10 bg-gray-100 rounded animate-pulse dark:bg-obsidian-hover" />
                    </td>
                  </tr>
                ))
              ) : data?.data && data.data.length > 0 ? (
                data.data.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono dark:text-ink-muted">{log.timestamp}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-ink-primary">{log.user}</td>
                    <td className="px-6 py-4">
                      <Badge variant={actionColors[log.action] || 'primary'} size="sm">{log.action}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400 dark:text-obsidian-faint" />
                        <span className="text-sm text-gray-600 dark:text-ink-muted">{log.resource}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-obsidian-faint">{log.details}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500 dark:text-obsidian-faint">
                    No audit logs found
                  </td>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(data.total / 10)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

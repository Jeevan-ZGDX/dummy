'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Button, SearchBar, Avatar, Badge } from '@comp-dash/design-system'
import { useAdminAdvisors } from '@comp-dash/api'
import { Plus, Download } from 'lucide-react'
import { exportToCSV } from '@/lib/export-csv'
import { useRouter } from 'next/navigation'

export default function AdvisorsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useAdminAdvisors({
    search: search || undefined,
    page,
    limit: 10,
  })

  const handleExport = () => {
    if (!data?.data) return
    exportToCSV(
      'advisors',
      ['Name', 'Email', 'Department', 'Assigned Sections', 'Pending Verifications'],
      data.data.map(a => [a.name, a.email, a.department, a.assignedSections.join(', '), String(a.pendingVerifications)])
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-white">{t('sidebar.advisors')}</h1>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            className="transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => router.push('/advisors/new')}
            className="transition-transform duration-200 hover:scale-105 active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Advisor
          </Button>
        </div>
      </div>

      <Card padding="md" className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm">
        <SearchBar
          placeholder="Search advisors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </Card>

      <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400">
                <th className="text-left text-xs font-medium uppercase tracking-wider px-6 py-3.5">Advisor</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider px-6 py-3.5">Department</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider px-6 py-3.5">Assigned Sections</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider px-6 py-3.5">Pending Verifications</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-zinc-800/60">
                    <td colSpan={4} className="px-6 py-4">
                      <div className="h-10 bg-gray-100 dark:bg-zinc-800/50 rounded-xl animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : data?.data && data.data.length > 0 ? (
                data.data.map((advisor) => (
                  <tr key={advisor.id} className="border-b border-gray-100 dark:border-zinc-800/60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={advisor.name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{advisor.name}</p>
                          <p className="text-xs text-gray-500 dark:text-zinc-400">{advisor.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="primary" size="sm">{advisor.department}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {advisor.assignedSections.map((section) => (
                          <Badge key={section} variant="info" size="sm">{section}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-zinc-300 font-medium">{advisor.pendingVerifications}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500 dark:text-zinc-400">
                    No advisors found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 10 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-zinc-800">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(data.total / 10)}
                className="transition-transform duration-200 hover:scale-105 active:scale-95"
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
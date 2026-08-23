'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Button, Avatar, Badge } from '@comp-dash/design-system'
import { useAdminWinners } from '@comp-dash/api'
import { Trophy, Download, Plus, X, CheckCircle } from 'lucide-react'
import { exportToCSV } from '@/lib/export-csv'
import { getCurrentUser } from '@/lib/auth'

const positionColors: Record<string, 'warning' | 'info' | 'accent'> = {
  '1st': 'warning',
  '2nd': 'info',
  '3rd': 'accent',
}

export default function WinnersPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ studentName: '', email: '', competition: '', department: 'CSE', position: '', prize: '' })

  const { data, isLoading, refetch } = useAdminWinners({ page, limit: 10 })

  const user = getCurrentUser()
  const canAdd = user && user.role === 'super_admin'

  const handleExport = () => {
    if (!data?.data) return
    exportToCSV(
      'winners',
      ['Student Name', 'Email', 'Competition', 'Department', 'Position', 'Prize', 'Date'],
      data.data.map(w => [w.studentName, w.email, w.competition, w.department, w.position, w.prize, new Date(w.date).toLocaleDateString()])
    )
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/winners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSuccess(true)
        setForm({ studentName: '', email: '', competition: '', department: 'CSE', position: '', prize: '' })
        refetch()
        setTimeout(() => { setShowModal(false); setSuccess(false) }, 1500)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-ink-primary">{t('sidebar.winners')}</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {canAdd && (
            <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Winner
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-obsidian-border">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-obsidian-faint uppercase tracking-wider px-6 py-3">Student</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-obsidian-faint uppercase tracking-wider px-6 py-3">Competition</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-obsidian-faint uppercase tracking-wider px-6 py-3">Department</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-obsidian-faint uppercase tracking-wider px-6 py-3">Position</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-obsidian-faint uppercase tracking-wider px-6 py-3">Prize</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-obsidian-faint uppercase tracking-wider px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-10 bg-gray-100 dark:bg-obsidian-hover rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : data?.data && data.data.length > 0 ? (
                data.data.map((winner: any) => (
                  <tr key={winner.id} className="border-b border-gray-50 hover:cursor-pointer transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={winner.studentName} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-ink-primary">{winner.studentName}</p>
                          <p className="text-xs text-gray-500 dark:text-obsidian-faint">{winner.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-gray-900 dark:text-ink-primary">{winner.competition}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="primary" size="sm">{winner.department}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={positionColors[winner.position] || 'primary'} size="sm">{winner.position}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-ink-primary">{winner.prize}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-ink-muted">
                      {new Date(winner.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500 dark:text-obsidian-faint">
                    No winners found
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
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(data.total / 10)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !submitting && setShowModal(false)}>
          <div className="bg-white dark:bg-obsidian-surface border rounded-2xl w-full max-w-lg p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-ink-primary">Add New Winner</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-obsidian-hover rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400 dark:text-obsidian-faint" />
              </button>
            </div>

            {success ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-base font-semibold text-gray-900 dark:text-ink-primary">Winner Added Successfully!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-ink-muted mb-1">Student Name</label>
                  <input type="text" value={form.studentName} onChange={e => setForm({ ...form, studentName: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-obsidian-hover border border-gray-200 dark:border-obsidian-border rounded-xl text-sm text-gray-900 dark:text-ink-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-ink-muted mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-obsidian-hover border border-gray-200 dark:border-obsidian-border rounded-xl text-sm text-gray-900 dark:text-ink-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-ink-muted mb-1">Competition</label>
                  <input type="text" value={form.competition} onChange={e => setForm({ ...form, competition: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-obsidian-hover border border-gray-200 dark:border-obsidian-border rounded-xl text-sm text-gray-900 dark:text-ink-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-ink-muted mb-1">Position</label>
                    <input type="text" placeholder="1st, 2nd, 3rd" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-obsidian-hover border border-gray-200 dark:border-obsidian-border rounded-xl text-sm text-gray-900 dark:text-ink-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-ink-muted mb-1">Prize</label>
                    <input type="text" placeholder="₹50,000 / Trophy" value={form.prize} onChange={e => setForm({ ...form, prize: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-obsidian-hover border border-gray-200 dark:border-obsidian-border rounded-xl text-sm text-gray-900 dark:text-ink-primary" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-obsidian-border">
                  <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={submitting}>Add Winner</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

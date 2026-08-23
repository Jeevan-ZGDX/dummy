'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, Badge, Button } from '@comp-dash/design-system'
import { useAdvisorCompetitionStats } from '@comp-dash/api'
import { getCurrentUser } from '@/lib/auth'
import { exportToCSV } from '@/lib/export-csv'
import { Download, ArrowLeft, Users, CheckCircle, UserX } from 'lucide-react'

export default function CompetitionReportPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [user, setUser] = useState<any>(null)

  useEffect(() => { setUser(getCurrentUser()) }, [])

  const { data: stats, isLoading } = useAdvisorCompetitionStats(id)

  const handleExport = () => {
    if (!stats) return
    const headers = ['Metric', 'Count']
    const rows = [
      ['Total Students', String(stats.totalStudents || 0)],
      ['Applied Students', String(stats.appliedStudents || 0)],
      ['Not Applied', String(stats.unregisteredStudents || 0)],
    ]
    if (stats.registrationsByDepartment?.length > 0) {
      headers.push('Department', 'Count')
      stats.registrationsByDepartment.forEach((dept: any) => {
        rows.push([dept.department, String(dept.count)])
      })
    }
    exportToCSV(`competition-${id}-report`, headers, rows)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="h-8 w-64 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-zinc-800/60 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-all duration-200 hover:scale-105 origin-left"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Competition Report</h1>
      </div>

      {user?.role === 'advisor' && (
        <div className="flex items-center justify-between">
          <Button 
            onClick={handleExport} 
            variant="primary" 
            size="sm" 
            className="flex items-center gap-2 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            Export CSV Report
          </Button>
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200 hover:scale-[1.02]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-800/50 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalStudents || 0}</p>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200 hover:scale-[1.02]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">Applied Students</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.appliedStudents || 0}</p>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200 hover:scale-[1.02]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-800/50 flex items-center justify-center flex-shrink-0">
                  <UserX className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">Not Applied</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unregisteredStudents || 0}</p>
                </div>
              </div>
            </Card>
          </div>

          {stats.registrationsByDepartment?.length > 0 && (
            <Card className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 shadow-sm transition-all duration-200">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white font-semibold text-lg">Registrations by Department</CardTitle>
              </CardHeader>
              <div className="mt-4 space-y-3">
                {stats.registrationsByDepartment.map((dept: any) => (
                  <div key={dept.department} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 dark:border-zinc-800/60 last:border-b-0">
                    <span className="text-gray-700 dark:text-zinc-200 font-medium">{dept.department}</span>
                    <span className="text-gray-900 dark:text-white font-semibold">{dept.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
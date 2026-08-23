'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Badge } from '@comp-dash/design-system'
import { getCurrentUser } from '@/lib/auth'
import { Mail, Search, CheckCircle, User, Building2, ChevronDown, ChevronUp, GraduationCap } from 'lucide-react'

const YEAR_ORDER = ['1st Year', '2nd Year', '3rd Year','4th year']

interface EmailProof {
  from: string
  to: string
  subject: string
  date: string
}

interface VerificationRequest {
  id: string
  registrationId: string | null
  studentId: string
  studentName: string
  studentEmail?: string
  department: string
  competitionTitle: string
  advisorNotified: boolean
  emailProof?: EmailProof | null
  status: 'pending' | 'verified'
  requestedAt: string
}

function YearSection({ year, requests, onVerify, verifyingId, expandedId, onToggle }: {
  year: string
  requests: (VerificationRequest & { section: string })[]
  onVerify: (id: string) => void
  verifyingId: string | null
  expandedId: string | null
  onToggle: (id: string) => void
}) {
  const sections = [...new Set(requests.map(r => r.section))].sort()
  const pending = requests.filter(r => r.status === 'pending').length
  const verified = requests.filter(r => r.status === 'verified').length

  return (
    <div className="space-y-3">
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-ink-primary">Class {year}</h2>
              <span className="text-xs text-gray-400 dark:text-obsidian-faint">({requests.length} student{requests.length !== 1 ? 's' : ''})</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {pending} pending
              </span>
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {verified} verified
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-obsidian-faint">
            <span className="font-medium">Sections:</span>
            {sections.map(s => (
              <span key={s} className="px-2 py-0.5 bg-gray-100 border text-gray-700 rounded-md font-medium dark:bg-obsidian-hover dark:border-obsidian-border dark:text-ink-muted">{year.charAt(0)}{s}</span>
            ))}
          </div>
        </div>
      </Card>

      {requests.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-obsidian-faint">
            <Mail className="w-8 h-8 mb-2" />
            <p className="text-xs">No requests from this year</p>
          </div>
        </Card>
      ) : (
        requests.map(vr => (
          <div key={vr.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden dark:bg-obsidian-surface dark:border-obsidian-border">
            <div
              className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => onToggle(vr.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-ink-primary">{vr.studentName}</span>
                      <Badge size="sm" variant={vr.status === 'verified' ? 'success' : 'warning'}>
                        {vr.status === 'verified' ? 'Verified' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-obsidian-faint">{vr.studentId}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-obsidian-faint">
                        <Building2 className="w-3 h-3" />
                        {vr.department}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400 dark:text-obsidian-faint">{new Date(vr.requestedAt).toLocaleDateString()}</span>
                  {expandedId === vr.id ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-obsidian-faint" /> : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-obsidian-faint" />}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2 ml-[52px] dark:text-obsidian-faint">
                <span className="font-medium text-gray-700 dark:text-ink-muted">Competition:</span> {vr.competitionTitle}
              </p>
            </div>

            {expandedId === vr.id && (
              <div className="border-t border-gray-100 bg-gray-50/50 dark:border-obsidian-border">
                <div className="p-4 space-y-4">
                  {vr.emailProof ? (
                    <>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-obsidian-faint">Email Metadata</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(vr as any).studentEmail && (
                            <div className="p-3 bg-white border border-gray-200 rounded-xl md:col-span-2 dark:bg-obsidian-surface dark:border-obsidian-border">
                              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 dark:text-obsidian-faint">Student Email</p>
                              <p className="text-sm font-medium text-accent break-all">{(vr as any).studentEmail}</p>
                            </div>
                          )}
                          <div className="p-3 bg-white border border-gray-200 rounded-xl dark:bg-obsidian-surface dark:border-obsidian-border">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 dark:text-obsidian-faint">From</p>
                            <p className="text-sm text-gray-900 font-mono text-xs break-all dark:text-ink-primary">{vr.emailProof.from}</p>
                          </div>
                          <div className="p-3 bg-white border border-gray-200 rounded-xl dark:bg-obsidian-surface dark:border-obsidian-border">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 dark:text-obsidian-faint">To</p>
                            <p className="text-sm text-gray-900 font-mono text-xs break-all dark:text-ink-primary">{vr.emailProof.to}</p>
                          </div>
                          <div className="p-3 bg-white border border-gray-200 rounded-xl md:col-span-2 dark:bg-obsidian-surface dark:border-obsidian-border">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 dark:text-obsidian-faint">Subject</p>
                            <p className="text-xs font-medium text-gray-900 dark:text-ink-primary">{vr.emailProof.subject}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 text-xs text-gray-400 dark:text-obsidian-faint">No email proof details attached</div>
                  )}

                  {vr.status === 'pending' && (
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onVerify(vr.id) }}
                        disabled={verifyingId === vr.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#38BDF8] text-white text-xs font-semibold rounded-xl hover:bg-[#38BDF8]/90 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {verifyingId === vr.id ? 'Verifying...' : 'Verify & Approve'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

export default function VerificationRequestsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [allRequests, setAllRequests] = useState<VerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified'>('all')

  useEffect(() => {
    const u = getCurrentUser()
    setUser(u)
    if (u && !['advisor', 'hod', 'super_admin'].includes(u.role)) {
      router.push('/dashboard')
    }
  }, [router])

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const [vrRes, studentsRes] = await Promise.all([
        fetch('/api/verification-requests'),
        fetch('/api/admin/students?limit=5000'),
      ])
      const vrJson = await vrRes.json()
      const studentsJson = await studentsRes.json()
      const studentMap = new Map<string, { year: string; section: string; email: string }>()
      for (const s of studentsJson.data?.data || []) {
        studentMap.set(s.id, { year: s.year || 'Unknown', section: s.section || '-', email: s.email || '' })
      }
      const enriched = (vrJson.data || []).map((vr: VerificationRequest) => {
        const info = studentMap.get(vr.studentId) || { year: 'Unknown', section: '-', email: '' }
        return { ...vr, year: info.year, section: info.section, studentEmail: info.email }
      })
      setAllRequests(enriched)
    } catch {
      setAllRequests([])
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (id: string) => {
    setVerifyingId(id)
    try {
      await fetch(`/api/verification-requests/${id}/verify`, { method: 'PATCH' })
      setAllRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'verified', advisorNotified: true } : r))
    } finally {
      setVerifyingId(null)
    }
  }

  const requestsWithYear = allRequests
    .filter(r => r.department === 'CSE')
    .map(r => ({ ...r, year: (r as any).year || 'Unknown', section: (r as any).section || '-' }))

  const filtered = requestsWithYear.filter(r => {
    const matchesSearch = !search || 
      r.studentName.toLowerCase().includes(search.toLowerCase()) ||
      r.studentId.toLowerCase().includes(search.toLowerCase()) ||
      (r.studentEmail && r.studentEmail.toLowerCase().includes(search.toLowerCase())) ||
      r.competitionTitle.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = statusFilter === 'all' || r.status === statusFilter
    return matchesSearch && matchesFilter
  })

  const grouped = YEAR_ORDER
    .filter(y => y !== '4th Year')
    .map(year => ({
      year,
      requests: filtered.filter(r => r.year === year),
    }))

  const totalPending = filtered.filter(r => r.status === 'pending').length
  const totalVerified = filtered.filter(r => r.status === 'verified').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-ink-primary">Submitted Email Proofs</h1>
        <p className="text-gray-500 mt-1 dark:text-obsidian-faint">View and verify email proof submissions from students, grouped by class</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-ink-primary">{filtered.length}</p>
            <p className="text-xs text-gray-500 mt-1 dark:text-obsidian-faint">Total Students</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{totalPending}</p>
            <p className="text-xs text-gray-500 mt-1 dark:text-obsidian-faint">Pending Verification</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{totalVerified}</p>
            <p className="text-xs text-gray-500 mt-1 dark:text-obsidian-faint">Verified</p>
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-obsidian-faint" />
          <input type="text" placeholder="Search by name, email, ID, competition..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent dark:bg-obsidian-hover dark:border-obsidian-border dark:text-ink-primary dark:placeholder:text-obsidian-faint"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'pending', 'verified'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors capitalize ${
                statusFilter === f ? 'bg-[#38BDF8] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-obsidian-surface dark:border-obsidian-border dark:text-ink-muted dark:hover:bg-obsidian-hover'
              }`}
            >
              {f === 'all' ? 'All' : f === 'pending' ? `Pending (${totalPending})` : `Verified (${totalVerified})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse dark:bg-obsidian-hover" />)}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(g => (
            <YearSection
              key={g.year}
              year={g.year}
              requests={g.requests}
              onVerify={handleVerify}
              verifyingId={verifyingId}
              expandedId={expandedId}
              onToggle={setExpandedId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

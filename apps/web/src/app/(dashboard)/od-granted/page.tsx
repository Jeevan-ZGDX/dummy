'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Badge } from '@comp-dash/design-system'
import { getCurrentUser } from '@/lib/auth'
import { Mail, Search, CheckCircle, User, Building2, ChevronDown, ChevronUp, Calendar, Download, X, Filter } from 'lucide-react'

interface EmailProof {
  from: string
  to: string
  subject: string
  date: string
}

interface VerifiedStudent {
  id: string
  registrationId: string | null
  studentId: string
  studentName: string
  studentEmail?: string
  department: string
  competitionTitle: string
  emailProof?: EmailProof | null
  status: string
  requestedAt: string
  reviewedAt?: string
  year?: string
  section?: string
}

type FilterTag = { type: 'name' | 'email' | 'competition'; value: string }

export default function ODGrantedPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [verified, setVerified] = useState<VerifiedStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterTags, setFilterTags] = useState<FilterTag[]>([])
  const [filterInput, setFilterInput] = useState('')
  const [filterType, setFilterType] = useState<'name' | 'email' | 'competition'>('name')
  const [showFilterInput, setShowFilterInput] = useState(false)
  const [exporting, setExporting] = useState(false)
  const filterInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const u = getCurrentUser()
    setUser(u)
  }, [])

  useEffect(() => {
    if (!user) return
    fetchVerified()
  }, [user])

  const fetchVerified = async () => {
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

      let list: VerifiedStudent[] = (vrJson.data || [])
        .filter((vr: any) => vr.status === 'verified')
        .map((vr: any) => {
          const info = studentMap.get(vr.studentId) || { year: 'Unknown', section: '-', email: '' }
          return { ...vr, year: info.year, section: info.section, studentEmail: info.email }
        })

      if (user.role === 'student') {
        list = list.filter(v => v.studentEmail?.toLowerCase() === user.email.toLowerCase())
      }

      setVerified(list)
    } catch {
      setVerified([])
    } finally {
      setLoading(false)
    }
  }

  const addFilterTag = () => {
    const trimmed = filterInput.trim()
    if (!trimmed) return
    const exists = filterTags.some(t => t.type === filterType && t.value.toLowerCase() === trimmed.toLowerCase())
    if (exists) return
    setFilterTags(prev => [...prev, { type: filterType, value: trimmed }])
    setFilterInput('')
    filterInputRef.current?.focus()
  }

  const removeFilterTag = (idx: number) => {
    setFilterTags(prev => prev.filter((_, i) => i !== idx))
  }

  const clearAllFilters = () => {
    setFilterTags([])
    setFilterInput('')
  }

  const filtered = verified.filter(v => {
    if (filterTags.length === 0) return true
    return filterTags.every(tag => {
      const q = tag.value.toLowerCase()
      switch (tag.type) {
        case 'name':
          return v.studentName.toLowerCase().includes(q)
        case 'email':
          return (v.studentEmail && v.studentEmail.toLowerCase().includes(q)) ||
                 (v.emailProof?.from && v.emailProof.from.toLowerCase().includes(q)) ||
                 (v.emailProof?.to && v.emailProof.to.toLowerCase().includes(q))
        case 'competition':
          return v.competitionTitle.toLowerCase().includes(q)
        default:
          return true
      }
    })
  })

  const handleExportXlsx = async () => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const rows = filtered.map(v => ({
        'Student Name': v.studentName,
        'Student Email': v.studentEmail || '',
        'Department': v.department,
        'Section': v.section || '',
        'Year': v.year || '',
        'Competition': v.competitionTitle,
        'Proof From': v.emailProof?.from || '',
        'Proof To': v.emailProof?.to || '',
        'Proof Subject': v.emailProof?.subject || '',
        'Proof Date': v.emailProof?.date ? new Date(v.emailProof.date).toLocaleString() : '',
        'Verified On': v.reviewedAt ? new Date(v.reviewedAt).toLocaleString() : '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'OD Granted')
      XLSX.writeFile(wb, `od-granted-${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-ink-primary">OD Granted</h1>
          <p className="text-gray-500 mt-1 dark:text-obsidian-faint">
            {user?.role === 'student'
              ? 'Your verified submissions with email proof metadata'
              : 'Students who have been verified with their submitted email proof metadata'}
          </p>
        </div>
        {user?.role !== 'student' && filtered.length > 0 && (
          <button onClick={handleExportXlsx} disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            Export XLSX
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{verified.length}</p>
            <p className="text-xs text-gray-500 mt-1 dark:text-obsidian-faint">Total Verified</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-ink-primary">
              {new Set(verified.map(v => v.studentId)).size}
            </p>
            <p className="text-xs text-gray-500 mt-1 dark:text-obsidian-faint">Unique Students</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-accent">
              {new Set(verified.map(v => v.competitionTitle)).size}
            </p>
            <p className="text-xs text-gray-500 mt-1 dark:text-obsidian-faint">Competitions Verified</p>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilterInput(!showFilterInput)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-white-50 transition-colors dark:bg-obsidian-surface dark:border-obsidian-border dark:text-ink-muted dark:hover:bg-obsidian-hover"
          >
            <Filter className="w-4 h-4" />
            Filters {filterTags.length > 0 && `(${filterTags.length})`}
          </button>
          {filterTags.length > 0 && (
            <button onClick={clearAllFilters}
              className="text-xs text-gray-400 hover:text-gray-600 underline dark:text-obsidian-faint dark:hover:text-ink-muted"
            >
              Clear all
            </button>
          )}
          {filtered.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-obsidian-faint">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {showFilterInput && (
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent dark:bg-obsidian-hover dark:border-obsidian-border dark:text-ink-primary"
            >
              <option value="name">Name</option>
              <option value="email">Email ID</option>
              <option value="competition">Competition</option>
            </select>
            <input ref={filterInputRef} type="text"
              value={filterInput} onChange={e => setFilterInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFilterTag() } }}
              placeholder={`Filter by ${filterType}...`}
              className="flex-1 min-w-[200px] px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent dark:bg-obsidian-hover dark:border-obsidian-border dark:text-ink-primary dark:placeholder:text-obsidian-faint"
            />
            <button onClick={addFilterTag}
              className="px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 transition-colors"
            >
              Add
            </button>
          </div>
        )}

        {filterTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {filterTags.map((tag, i) => (
              <span key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent text-xs font-medium rounded-full"
              >
                <span className="text-gray-400 font-normal dark:text-obsidian-faint">{tag.type}:</span>
                {tag.value}
                <button onClick={() => removeFilterTag(i)} className="hover:text-accent/80">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-xl animate-pulse dark:bg-obsidian-hover" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-obsidian-faint">
            <CheckCircle className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium">
              {filterTags.length > 0 ? 'No matching verified submissions' : 'No verified submissions'}
            </p>
            <p className="text-xs mt-1">
              {filterTags.length > 0
                ? 'Try adjusting your filter tags'
                : user?.role === 'student'
                  ? 'Submit an email proof in Email Verification to get verified'
                  : 'No students have been verified yet'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => (
            <div key={v.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden dark:bg-obsidian-surface dark:border-obsidian-border">
              <div
                className="p-4 cursor-pointer hover:transition-colors"
                onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-ink-primary">{v.studentName}</span>
                        <Badge size="sm" variant="success">Verified</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-obsidian-faint">
                          <User className="w-3 h-3" />
                          {v.studentEmail || v.studentId}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-obsidian-faint">
                          <Building2 className="w-3 h-3" />
                          {v.department}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400 dark:text-obsidian-faint">{v.reviewedAt ? new Date(v.reviewedAt).toLocaleDateString() : ''}</span>
                    {expandedId === v.id ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-obsidian-faint" /> : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-obsidian-faint" />}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-[52px] dark:text-obsidian-faint">
                  <span className="font-medium">Competition:</span> {v.competitionTitle}
                </p>
              </div>

              {expandedId === v.id && v.emailProof && (
                <div className="border-t border-gray-100  dark:border-obsidian-border">
                  <div className="p-4 space-y-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-obsidian-faint">Submitted Email Proof Metadata</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-white border border-green-200 rounded-xl md:col-span-2 dark:bg-obsidian-surface">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 dark:text-obsidian-faint">From</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-ink-primary break-all">{v.emailProof.from}</p>
                      </div>
                      <div className="p-3 bg-white border border-green-200 rounded-xl md:col-span-2 dark:bg-obsidian-surface">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 dark:text-obsidian-faint">To</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-ink-primary break-all">{v.emailProof.to}</p>
                      </div>
                      <div className="p-3 bg-white border border-green-200 rounded-xl md:col-span-2 dark:bg-obsidian-surface">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 dark:text-obsidian-faint">Subject</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-ink-primary">{v.emailProof.subject}</p>
                      </div>
                      <div className="p-3 bg-white border border-green-200 rounded-xl md:col-span-2 dark:bg-obsidian-surface">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 dark:text-obsidian-faint">Date & Time</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-ink-primary">
                          {v.emailProof.date ? new Date(v.emailProof.date).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    {v.reviewedAt && (
                      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-obsidian-faint">
                        <Calendar className="w-3.5 h-3.5" />
                        Verified on {new Date(v.reviewedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {expandedId === v.id && !v.emailProof && (
                <div className="border-t border-gray-100 p-4 text-center dark:border-obsidian-border">
                  <p className="text-sm text-gray-400 dark:text-obsidian-faint">No email proof metadata available</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
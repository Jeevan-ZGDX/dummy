'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, Badge } from '@comp-dash/design-system'
import { getCurrentUser } from '@/lib/auth'
import { getGmailTokens, setHistoryId, getSyncedEmails, setSyncedEmails, appendSyncedEmails, clearGmailTokens, getHistoryId, fetchRecentEmails, fetchHistorySync } from '@/lib/gmail-sync'
import { Mail, Search, Send, CheckCircle, Inbox, Clock, Shield, RefreshCw } from 'lucide-react'

type Step = 'signin' | 'permissions' | 'inbox'

function EmailVerificationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [step, setStep] = useState<Step>('signin')
  const [user, setUser] = useState<any>(null)
  const [emails, setEmails] = useState<any[]>([])
  const [filteredEmails, setFilteredEmails] = useState<any[] | null>(null)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null)
  const [emailMeta, setEmailMeta] = useState<any | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [gmailSearching, setGmailSearching] = useState(false)
  const [useGmail, setUseGmail] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  const userId = user?.email || ''
  const organizerEmailRef = useRef('')

  // On mount, check URL param or localStorage for organizerEmail
  useEffect(() => {
    const fromUrl = searchParams.get('organizerEmail')
    const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('pending_organizer_email') : null
    const val = fromUrl || fromStorage || ''
    organizerEmailRef.current = val
    if (val && typeof window !== 'undefined') {
      localStorage.setItem('pending_organizer_email', val)
    }
    if (fromUrl && typeof window !== 'undefined') {
      localStorage.setItem('pending_organizer_email', fromUrl)
    }
  }, [searchParams])

  // Handle OAuth redirect back from server (tokens are stored server-side)
  useEffect(() => {
    const connected = searchParams.get('gmail') === 'connected' || searchParams.get('auth') === 'success'

    if (connected && userId) {
      setUseGmail(true)
      setStep('inbox')
      // Clean URL params but preserve organizerEmail in ref
      const orgEmail = organizerEmailRef.current || searchParams.get('organizerEmail') || ''
      if (!organizerEmailRef.current && orgEmail) organizerEmailRef.current = orgEmail
      router.replace('/email-verification')

      getGmailTokens(userId).then(({ historyId }) => {
        if (historyId) setHistoryId(userId, historyId)
      }).catch(() => {})

      if (orgEmail) {
        const searchQuery = `from:${orgEmail}`
        setKeyword(searchQuery)
        handleSearchGmail(searchQuery)
      } else {
        handleFetchRecent(userId)
      }
    }
  }, [searchParams, userId, router])

  useEffect(() => {
    const u = getCurrentUser()
    setUser(u)
    if (searchParams.get('auth') === 'success') {
      // handled above by userId check
    }
  }, [searchParams])

  useEffect(() => {
    if (step === 'inbox') {
      if (useGmail && userId) {
        if (organizerEmailRef.current) {
          const searchQuery = `from:${organizerEmailRef.current}`
          setKeyword(searchQuery)
          handleSearchGmail(searchQuery)
          localStorage.removeItem('pending_organizer_email')
          organizerEmailRef.current = ''
          router.replace('/email-verification')
        } else {
          handleFetchRecent(userId)
        }
      } else if (user?.email) {
        fetchInternalEmails(user.email)
      }
    }
  }, [step, useGmail, user])

  // Auto incremental sync every 30 seconds when Gmail is connected
  useEffect(() => {
    if (!useGmail || !userId) return
    const interval = setInterval(() => {
      handleSync()
    }, 30000)
    return () => clearInterval(interval)
  }, [useGmail, userId])

  const fetchInternalEmails = async (email: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/registrations/lookup?email=${encodeURIComponent(email)}`)
      const json = await res.json()
      const regs = json.data?.registrations || []
      const generated = regs.map((r: any) => ({
        id: r.id,
        from: `${r.competition?.organizer || 'Competition Desk'} <noreply@comp-dash.cit.in>`,
        to: email,
        subject: r.status === 'verified' ? `Confirmed: ${r.competition?.title || 'Competition'}`
          : r.status === 'rejected' ? `Update: ${r.competition?.title || 'Competition'}`
          : `Registration: ${r.competition?.title || 'Competition'}`,
        snippet: r.status === 'verified' ? `Your registration has been verified.`
          : r.status === 'rejected' ? `Your registration was rejected.`
          : `Your registration is pending verification.`,
        date: r.registeredAt,
        competition: r.competition,
        registration: r,
        status: r.status,
      }))
      setEmails(generated)
      setFilteredEmails(null)
    } catch {
      setEmails([])
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = () => setStep('permissions')
  const handleAllowAccess = () => {
    if (organizerEmailRef.current) {
      localStorage.setItem('pending_organizer_email', organizerEmailRef.current)
    }
    const params = new URLSearchParams()
    if (userId) params.set('userId', userId)
    window.location.href = `/api/auth/gmail${params.toString() ? `?${params.toString()}` : ''}`
  }
  const handleDeny = () => setStep('signin')

  const handleSkipGmail = () => {
    setUseGmail(false)
    setStep('inbox')
    if (user?.email) fetchInternalEmails(user.email)
  }

  const handleSearchGmail = async (query?: string) => {
    const searchQuery = query || keyword.trim()
    if (!searchQuery) return
    setGmailSearching(true)
    try {
      const res = await fetch(`/api/gmail/search?userId=${encodeURIComponent(userId)}&keyword=${encodeURIComponent(searchQuery)}`)
      if (res.status === 401) { setStep('signin'); return }
      const json = await res.json()
      const fetched = json.data?.emails || []
      setEmails(fetched)
      setFilteredEmails(null)
      setSelectedEmail(null)
      setEmailMeta(null)
      setSubmitted(false)
    } catch {
      setEmails([])
    } finally {
      setGmailSearching(false)
    }
  }

  const handleFetchRecent = useCallback(async (uid?: string) => {
    const targetUid = uid || userId
    if (!targetUid) return
    setLoading(true)
    try {
      const recent = await fetchRecentEmails(targetUid, 30)
      if (recent.length > 0) {
        setEmails(recent)
        setSyncedEmails(targetUid, recent)
        setLastSync(new Date().toISOString())
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [userId])

  const handleSync = useCallback(async () => {
    if (!userId || syncing) return
    setSyncing(true)
    try {
      const result = await fetchHistorySync(userId)
      if (result === null) return
      if (result.historyId) setHistoryId(userId, result.historyId)
      if (result.emails.length > 0) {
        setEmails(prev => {
          const ids = new Set(prev.map(e => e.id))
          return [...result.emails.filter((e: any) => !ids.has(e.id)), ...prev]
        })
      }
      setLastSync(new Date().toISOString())
    } catch {
      clearGmailTokens(userId)
      setStep('signin')
    } finally { setSyncing(false) }
  }, [userId, syncing])

  const handleSearchInternal = () => {
    if (!keyword.trim()) { setFilteredEmails(null); return }
    const kw = keyword.toLowerCase()
    setFilteredEmails(emails.filter(e =>
      e.subject.toLowerCase().includes(kw) || e.snippet.toLowerCase().includes(kw) ||
      e.competition?.title?.toLowerCase().includes(kw)
    ))
    setSelectedEmail(null)
    setEmailMeta(null)
    setSubmitted(false)
  }

  const handleSelectEmail = async (email: any) => {
    setSelectedEmail(email)
    setEmailMeta(null)
    setSubmitted(false)
    if (useGmail && email.id) {
      setMetaLoading(true)
      try {
        const res = await fetch(`/api/gmail/email-detail?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(email.id)}`)
        const json = await res.json()
        setEmailMeta(json.data?.email || null)
      } catch { /* */ } finally { setMetaLoading(false) }
    } else {
      setEmailMeta({ from: email.from, to: email.to || user?.email, subject: email.subject, date: email.date })
    }
  }

  const handleSubmitProof = async () => {
    if (!emailMeta || !user?.email) return
    setSubmitting(true)
    try {
      const body: any = {
        studentEmail: user.email,
        emailProof: {
          from: emailMeta.from,
          to: emailMeta.to,
          subject: emailMeta.subject,
          date: emailMeta.date,
        },
      }
      if (selectedEmail?.registration?.id) {
        body.registrationId = selectedEmail.registration.id
      }
      await fetch('/api/verification-requests/with-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setSubmitted(true)
    } finally { setSubmitting(false) }
  }

  const displayEmails = filteredEmails !== null ? filteredEmails : emails
  const statusVariant = (s: string) => {
    if (s === 'verified' || s === 'completed') return 'success'
    if (s === 'rejected') return 'danger'
    return 'warning'
  }

  const userEmail = user?.email || ''

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary">Email Verification</h1>
        <p className="text-gray-500 mt-1 dark:text-obsidian-faint">Fetch email proof from your inbox — advisors can view submitted proofs</p>
      </div>

      {step === 'signin' && (
        <Card>
          <CardHeader>
            <CardTitle>Sign in with Google</CardTitle>
          </CardHeader>
          <div className="mt-4 px-4 pb-8">
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-20 h-20 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center mb-6 shadow-sm dark:bg-obsidian-surface dark:border-obsidian-border">
                <span className="text-3xl font-bold text-gray-400 dark:text-obsidian-faint">G</span>
              </div>
              <p className="text-base text-gray-700 mb-1 dark:text-ink-muted">Connect your Google account</p>
              <p className="text-sm text-gray-400 mb-8 dark:text-obsidian-faint">to fetch and submit email metadata to your advisor</p>
              <button onClick={handleGoogleSignIn}
                className="flex items-center gap-3 px-8 py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all text-sm font-medium text-gray-700 dark:bg-obsidian-surface dark:border-obsidian-border dark:text-ink-primary"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
              <p className="text-xs text-gray-400 mt-6 dark:text-obsidian-faint">Signed in as <span className="font-medium text-gray-600 dark:text-ink-muted">{userEmail}</span></p>
            </div>
          </div>
        </Card>
      )}

      {step === 'permissions' && (
        <Card>
          <CardHeader>
            <CardTitle>Google Account Permissions</CardTitle>
          </CardHeader>
          <div className="mt-4 px-4 pb-6">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl mb-6 dark:bg-obsidian-hover">
              <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center dark:bg-obsidian-surface dark:border-obsidian-border">
                <span className="text-lg font-bold text-gray-400 dark:text-obsidian-faint">G</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-ink-primary">{userEmail}</p>
                <p className="text-xs text-gray-500 dark:text-obsidian-faint">Comp-Dash wants to access your Google Account</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Gmail Metadata Access</p>
                  <p className="text-xs text-amber-700 mt-1">Read email metadata (From, To, Subject, Date) to submit as verification proof for advisor review.</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-obsidian-faint">Permissions requested</p>
              {[
                { scope: 'Read email metadata (From, To, Subject, Date)', detail: 'gmail.readonly' },
                { scope: 'View your email address', detail: 'userinfo.email' },
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl dark:bg-obsidian-hover">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <div><p className="text-sm text-gray-700 dark:text-ink-muted">{p.scope}</p><p className="text-xs text-gray-400 font-mono dark:text-obsidian-faint">{p.detail}</p></div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleAllowAccess} className="flex-1 px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 transition-colors">Allow</button>
              <button onClick={handleDeny} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors dark:bg-obsidian-surface dark:border-obsidian-border dark:text-ink-primary dark:hover:bg-obsidian-hover">Deny</button>
            </div>
            <div className="mt-4 text-center">
              <button onClick={handleSkipGmail} className="text-xs text-gray-400 hover:text-gray-600 underline dark:text-obsidian-faint dark:hover:text-ink-muted">Skip — use in-app email instead</button>
            </div>
          </div>
        </Card>
      )}

      {step === 'inbox' && (
        <>
          <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: useGmail ? '#f0fdf4' : '#eff6ff', borderColor: useGmail ? '#bbf7d0' : '#bfdbfe' }}>
            {useGmail ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" /> : <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />}
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: useGmail ? '#166534' : '#1e40af' }}>{useGmail ? `Connected as ${userEmail}` : `In-App Mail: ${userEmail}`}</p>
              <p className="text-xs" style={{ color: useGmail ? '#15803d' : '#3b82f6' }}>{useGmail ? 'Click an email to view metadata & submit as proof' : 'Viewing internal registration emails'}</p>
            </div>
            <Badge variant={useGmail ? 'success' : 'info'} size="sm">{useGmail ? 'Gmail' : 'In-App'}</Badge>
          </div>

           <div className="grid grid-cols-1 gap-6">
            {useGmail && (
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 dark:bg-obsidian-hover dark:border-obsidian-border">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-obsidian-faint">
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-accent' : ''}`} />
                  {syncing ? 'Syncing...' : loading ? 'Fetching inbox...' : lastSync ? `Last sync: ${new Date(lastSync).toLocaleTimeString()}` : 'Auto-sync every 30s'}
                </div>
                <button onClick={() => handleFetchRecent()} disabled={loading}
                  className="text-xs font-medium text-accent hover:text-accent/80 disabled:opacity-50"
                >
                  Fetch Inbox
                </button>
                <span className="text-gray-300">|</span>
                <button onClick={handleSync} disabled={syncing}
                  className="text-xs font-medium text-accent hover:text-accent/80 disabled:opacity-50"
                >
                  Sync Now
                </button>
              </div>
            )}
            <Card>
              <CardHeader>
                <CardTitle>{useGmail ? 'Gmail Inbox' : 'Inbox'}</CardTitle>
              </CardHeader>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2 px-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-obsidian-faint" />
                    <input type="text" placeholder={useGmail ? 'Search your Gmail inbox...' : 'Search...'}
                      value={keyword} onChange={e => setKeyword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { if (useGmail) handleSearchGmail(); else handleSearchInternal() } }}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent dark:bg-obsidian-hover dark:border-obsidian-border dark:text-ink-primary dark:placeholder:text-obsidian-faint"
                    />
                  </div>
                  <button onClick={() => { if (useGmail) handleSearchGmail(); else handleSearchInternal() }}
                    disabled={gmailSearching || loading || !keyword.trim()}
                    className="px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {gmailSearching || loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                    {useGmail ? 'Search Gmail' : 'Search'}
                  </button>
                </div>

                {(gmailSearching || (loading && useGmail)) && (
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-blue-700">{loading ? 'Fetching your recent inbox...' : 'Searching your Gmail inbox...'}</p>
                    </div>
                  </div>
                )}

                {loading && !gmailSearching && (
                  <div className="px-4 pb-4 space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse dark:bg-obsidian-hover" />)}
                  </div>
                )}

                {!loading && !gmailSearching && displayEmails.length > 0 && (
                  <div className="px-4 pb-4">
                    {filteredEmails !== null && <p className="text-xs text-gray-500 mb-3 dark:text-obsidian-faint">{filteredEmails.length} result{filteredEmails.length !== 1 ? 's' : ''}</p>}
                    <div className="space-y-2">
                      {displayEmails.map(email => (
                        <div key={email.id}
                          className={`p-4 bg-white border rounded-xl cursor-pointer transition-all dark:bg-obsidian-surface ${selectedEmail?.id === email.id ? 'border-accent ring-2 ring-accent/10' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm dark:border-obsidian-border'}`}
                          onClick={() => handleSelectEmail(email)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                                <Mail className="w-3.5 h-3.5 text-accent" />
                              </div>
                              <span className="text-xs text-gray-500 truncate dark:text-obsidian-faint">{email.from}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {email.status && <Badge size="sm" variant={statusVariant(email.status)}>{email.status.replace('_', ' ')}</Badge>}
                              <span className="text-xs text-gray-400 dark:text-obsidian-faint">{email.date ? new Date(email.date).toLocaleDateString() : ''}</span>
                            </div>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mb-1 dark:text-ink-primary">{email.subject}</p>
                          <p className="text-xs text-gray-500 line-clamp-2 dark:text-obsidian-faint">{email.snippet}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!loading && !gmailSearching && displayEmails.length === 0 && (
                  <div className="px-4 pb-4">
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-obsidian-faint">
                      {keyword ? <Search className="w-10 h-10 mb-2" /> : <Inbox className="w-10 h-10 mb-2" />}
                      <p className="text-sm">{keyword ? 'No matching emails' : 'No emails'}</p>
                      <p className="text-xs mt-1">{keyword ? 'Try a different keyword' : useGmail ? 'Click "Fetch Inbox" to load your recent emails' : 'Register for a competition first'}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {selectedEmail && !metaLoading && (
              <Card>
                <CardHeader>
                  <CardTitle>Email Metadata</CardTitle>
                </CardHeader>
                <div className="mt-4 px-4 pb-6 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl dark:bg-obsidian-hover">
                      <Mail className="w-4 h-4 text-gray-400 mt-0.5 dark:text-obsidian-faint" />
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider dark:text-obsidian-faint">From</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-ink-primary">{emailMeta?.from || selectedEmail.from}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl dark:bg-obsidian-hover">
                      <Mail className="w-4 h-4 text-gray-400 mt-0.5 dark:text-obsidian-faint" />
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider dark:text-obsidian-faint">To</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-ink-primary">{emailMeta?.to || userEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl dark:bg-obsidian-hover">
                      <Shield className="w-4 h-4 text-gray-400 mt-0.5 dark:text-obsidian-faint" />
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider dark:text-obsidian-faint">Subject</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-ink-primary">{emailMeta?.subject || selectedEmail.subject}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl dark:bg-obsidian-hover">
                      <Clock className="w-4 h-4 text-gray-400 mt-0.5 dark:text-obsidian-faint" />
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider dark:text-obsidian-faint">Date & Time Received</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-ink-primary">
                          {emailMeta?.date ? new Date(emailMeta.date).toLocaleString() : selectedEmail.date ? new Date(selectedEmail.date).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {submitted ? (
                    <div className="flex items-center justify-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Proof submitted — advisor will review</span>
                    </div>
                  ) : (
                    <button onClick={handleSubmitProof} disabled={submitting}
                      className="w-full px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                      Submit as Proof
                    </button>
                  )}
                </div>
              </Card>
            )}

            {selectedEmail && metaLoading && (
              <Card>
                <CardHeader>
                  <CardTitle>Loading...</CardTitle>
                </CardHeader>
                <div className="px-4 pb-6">
                  <div className="space-y-3">
                    {[2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse dark:bg-obsidian-hover" />)}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function EmailVerificationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <EmailVerificationContent />
    </Suspense>
  )
}

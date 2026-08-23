// Gmail tokens are stored server-side (gmail_tokens table). This module only keeps
// a non-sensitive email cache + history cursor in localStorage and proxies to the API.

const STORAGE_KEYS = {
  historyId: (uid: string) => `comp_dash_gmail_history_${uid}`,
  syncedEmails: (uid: string) => `comp_dash_gmail_synced_${uid}`,
}

interface GmailTokens {
  access_token: string
  refresh_token: string
  expiry_date: number
}

interface StoredEmail {
  id: string
  threadId: string
  from: string
  to: string
  subject: string
  snippet: string
  date: string
  labels: string[]
  competitionHint?: string
}

interface GmailSyncResult {
  historyId: string
  emails: StoredEmail[]
}

interface GmailSearchResult {
  emails: StoredEmail[]
}

async function fetchApi(endpoint: string, params: Record<string, string> = {}, options: { method?: string; body?: any } = {}): Promise<any> {
  const url = new URL(`/api${endpoint}`, window.location.origin)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    const err = new Error(json.error?.message || 'API request failed') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return json.data
}

// ─── Token helpers (server-backed) ─────────────────────────────────
export async function getGmailTokens(userId: string): Promise<{ connected: boolean; historyId: string; email: string }> {
  try {
    const data = await fetchApi('/gmail/tokens', { userId })
    return {
      connected: !!data?.connected,
      historyId: data?.historyId || '',
      email: data?.email || '',
    }
  } catch {
    return { connected: false, historyId: '', email: '' }
  }
}

export async function setGmailTokens(userId: string, tokens: GmailTokens) {
  try {
    await fetchApi('/gmail/tokens', { userId }, {
      method: 'POST',
      body: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresIn: String(Math.floor((tokens.expiry_date - Date.now()) / 1000)),
      },
    })
  } catch { /* ignore */ }
}

export async function clearGmailTokens(userId: string) {
  try {
    await fetchApi('/gmail/tokens', { userId }, { method: 'DELETE' })
  } catch { /* ignore */ }
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.historyId(userId))
    localStorage.removeItem(STORAGE_KEYS.syncedEmails(userId))
  }
}

// ─── Non-sensitive client-side cache ───────────────────────────────
export function getHistoryId(userId: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.historyId(userId))
}

export function setHistoryId(userId: string, historyId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.historyId(userId), historyId)
}

export function getSyncedEmails(userId: string): StoredEmail[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.syncedEmails(userId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function setSyncedEmails(userId: string, emails: StoredEmail[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.syncedEmails(userId), JSON.stringify(emails))
}

export function appendSyncedEmails(userId: string, newEmails: StoredEmail[]) {
  const existing = getSyncedEmails(userId)
  const existingIds = new Set(existing.map(e => e.id))
  const deduped = [...newEmails.filter(e => !existingIds.has(e.id)), ...existing]
  setSyncedEmails(userId, deduped)
}

// ─── Server-proxied Gmail API calls ────────────────────────────────
// The server resolves the OAuth token by userId; nothing sensitive leaves the server.

export async function fetchInitialHistoryId(userId: string): Promise<string | null> {
  try {
    const data = await fetchApi('/gmail/sync/initial', { userId })
    return data.historyId || null
  } catch { return null }
}

export async function fetchHistorySync(userId: string): Promise<GmailSyncResult | null> {
  const startHistoryId = getHistoryId(userId)
  if (!startHistoryId) return null
  try {
    const data = await fetchApi('/gmail/sync', { userId, startHistoryId })
    return { historyId: data.historyId, emails: data.emails }
  } catch { return null }
}

export async function searchGmailEmails(userId: string, keyword: string): Promise<StoredEmail[]> {
  try {
    const data = await fetchApi('/gmail/search', { userId, keyword })
    return data.emails || []
  } catch { return [] }
}

export async function fetchEmailDetail(userId: string, emailId: string): Promise<StoredEmail | null> {
  try {
    const data = await fetchApi('/gmail/email-detail', { userId, id: emailId })
    return data.email || null
  } catch { return null }
}

export async function fetchRecentEmails(userId: string, maxResults = 30): Promise<StoredEmail[]> {
  try {
    const data = await fetchApi('/gmail/recent', { userId, maxResults: String(maxResults) })
    return data.emails || []
  } catch { return [] }
}

export function extractCompetitionHint(email: StoredEmail): string | null {
  const subject = (email.subject || '').toLowerCase()
  const from = (email.from || '').toLowerCase()
  const keywords = ['competition', 'hackathon', 'contest', 'challenge', 'registration', 'workshop', 'conference', 'seminar', 'symposium']
  for (const kw of keywords) {
    if (subject.includes(kw) || from.includes(kw)) {
      return kw
    }
  }
  return null
}

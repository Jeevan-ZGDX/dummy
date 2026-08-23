import { getDocById, writeGmailTokenDoc, deleteDocById } from '@/lib/firestore-data'
import { COLLECTIONS } from '@/lib/firebase/config'

export interface GmailTokenRecord {
  user_id: string
  user_email: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  history_id: string | null
}

/**
 * Keyed by user id as the document id — the old table used
 * `onConflict: 'user_id'`, so making it the key preserves the one-row-per-user
 * guarantee that Firestore would not otherwise enforce.
 */
export async function getGmailTokens(userId: string): Promise<GmailTokenRecord | null> {
  const doc = await getDocById(COLLECTIONS.gmailTokens, userId)
  return (doc as GmailTokenRecord | null) || null
}

export async function storeGmailTokens(record: {
  user_id: string
  user_email: string
  access_token: string
  refresh_token?: string | null
  expires_at?: string | null
  history_id?: string | null
}) {
  const result = await writeGmailTokenDoc(record.user_id, {
    user_id: record.user_id,
    user_email: record.user_email,
    access_token: record.access_token,
    refresh_token: record.refresh_token || null,
    expires_at: record.expires_at || null,
    history_id: record.history_id || null,
    updated_at: new Date().toISOString(),
  })
  return { success: result.success, error: result.reason }
}

export async function clearGmailTokens(userId: string) {
  const result = await deleteDocById(COLLECTIONS.gmailTokens, userId)
  return { success: result.success, error: result.reason }
}

export async function refreshGmailAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.access_token) return null
    return {
      access_token: data.access_token as string,
      expires_in: (data.expires_in as number) || 3600,
    }
  } catch {
    return null
  }
}

export async function getValidAccessToken(userId: string): Promise<{ accessToken: string | null; hasTokens: boolean }> {
  const tokens = await getGmailTokens(userId)
  if (!tokens) return { accessToken: null, hasTokens: false }

  if (tokens.access_token && tokens.expires_at && new Date(tokens.expires_at).getTime() > Date.now() + 60000) {
    return { accessToken: tokens.access_token, hasTokens: true }
  }

  if (tokens.refresh_token) {
    const refreshed = await refreshGmailAccessToken(tokens.refresh_token)
    if (refreshed) {
      await storeGmailTokens({
        user_id: tokens.user_id,
        user_email: tokens.user_email,
        access_token: refreshed.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        history_id: tokens.history_id,
      })
      return { accessToken: refreshed.access_token, hasTokens: true }
    }
  }

  return { accessToken: null, hasTokens: true }
}

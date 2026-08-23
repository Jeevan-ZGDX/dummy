import { NextRequest, NextResponse } from 'next/server'
import {
  isFirestoreConfigured,
  getDocById,
  queryByField,
  createDoc,
  writeDocById,
} from '@/lib/firestore-data'
import { COLLECTIONS } from '@/lib/firebase/config'
import { getValidAccessToken } from '@/lib/gmail-tokens'

const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me'

/**
 * Postgres enforced `unique(student_email, competition_id)`, which is what made
 * the old upsert idempotent. Firestore has no unique constraint, so the pair is
 * looked up first and that document rewritten.
 *
 * Only `student_email` goes to Firestore — one student holds a handful of
 * registrations, so filtering the competition in memory avoids a second
 * indexed field for no gain.
 */
async function findRegistration(studentEmail: string, competitionId: string) {
  const rows = await queryByField(
    COLLECTIONS.studentCompetitions,
    'student_email',
    studentEmail
  )
  return rows.find((row) => row.competition_id === competitionId) ?? null
}

async function searchEmails(accessToken: string, query: string, maxResults = 30) {
  const response = await fetch(
    `${GMAIL_API_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!response.ok) throw new Error('Failed to search emails')
  return response.json()
}

async function getEmailDetails(accessToken: string, messageId: string) {
  const response = await fetch(
    `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!response.ok) throw new Error('Failed to get email details')
  return response.json()
}

function extractEmailContent(payload: any): { text: string; html: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {}
  payload.headers?.forEach((h: any) => {
    headers[h.name.toLowerCase()] = h.value
  })

  let text = ''
  let html = ''

  function processPart(part: any) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += Buffer.from(part.body.data, 'base64').toString('utf-8')
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += Buffer.from(part.body.data, 'base64').toString('utf-8')
    } else if (part.parts) {
      part.parts.forEach(processPart)
    }
  }

  processPart(payload)
  return { text, html, headers }
}

function matchesCompetitionEmail(emailContent: { text: string; html: string; headers: Record<string, string> }, competition: any): boolean {
  const combined = `${emailContent.text} ${emailContent.html}`.toLowerCase()
  const from = emailContent.headers.from?.toLowerCase() || ''
  const subject = emailContent.headers.subject?.toLowerCase() || ''

  const orgEmail = competition.organizer_email?.toLowerCase()
  const compTitle = competition.competition_name?.toLowerCase()

  if (orgEmail && from.includes(orgEmail)) return true
  if (compTitle && (subject.includes(compTitle) || combined.includes(compTitle))) return true

  const keywords = ['registration', 'confirmation', 'registered', 'signup', 'signed up', 'enrollment', 'enrolled']
  return keywords.some(k => combined.includes(k))
}

export async function POST(request: NextRequest) {
  try {
    const { competitionId, userEmail } = await request.json()

    if (!competitionId || !userEmail) {
      return NextResponse.json({ success: false, error: 'Missing competitionId or userEmail' }, { status: 400 })
    }

    if (!isFirestoreConfigured()) {
      return NextResponse.json({ success: false, error: 'Firestore not configured' }, { status: 500 })
    }

    const competition = await getDocById(COLLECTIONS.competitionDashboard, competitionId)

    if (!competition) {
      return NextResponse.json({ success: false, error: 'Competition not found' }, { status: 404 })
    }

    const token = await getValidAccessToken(userEmail)
    const accessToken = token.accessToken
    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'Gmail not connected' }, { status: 401 })
    }

    const query = `from:${competition.organizer_email} OR subject:"${competition.competition_name}" OR subject:registration OR subject:confirmation`
    // The Gmail search response is `{ messages: [...] }`; iterating the envelope
    // itself threw before it ever reached the match loop.
    const searchResult = await searchEmails(accessToken, query, 30)
    const messages = searchResult.messages ?? []

    let verified = false
    let matchedEmail: any = null

    for (const msg of messages) {
      const details = await getEmailDetails(accessToken, msg.id)
      const content = extractEmailContent(details.payload)

      if (matchesCompetitionEmail(content, competition)) {
        verified = true
        matchedEmail = {
          messageId: msg.id,
          threadId: details.threadId,
          from: content.headers.from,
          subject: content.headers.subject,
          date: content.headers.date,
        }
        break
      }
    }

    const existing = await findRegistration(userEmail, competitionId)

    if (verified && matchedEmail) {
      const now = new Date().toISOString()
      const doc = {
        student_id: userEmail,
        student_email: userEmail,
        student_name: userEmail.split('@')[0],
        competition_id: competitionId,
        competition_name: competition.competition_name,
        registration_link: competition.registration_link || '',
        verification_status: 'verified',
        verification_method: 'gmail_auto',
        gmail_message_id: matchedEmail.messageId,
        gmail_thread_id: matchedEmail.threadId,
        verified_at: now,
        updated_at: now,
      }
      if (existing) {
        await writeDocById(COLLECTIONS.studentCompetitions, existing.id, doc)
      } else {
        await createDoc(COLLECTIONS.studentCompetitions, doc)
      }
    } else if (!existing) {
      await createDoc(COLLECTIONS.studentCompetitions, {
        student_id: userEmail,
        student_email: userEmail,
        student_name: userEmail.split('@')[0],
        competition_id: competitionId,
        competition_name: competition.competition_name,
        registration_link: competition.registration_link || '',
        verification_status: 'pending',
        verification_method: 'manual',
      })
    }

    return NextResponse.json({ success: true, verified, email: matchedEmail })
  } catch (err) {
    console.error('Gmail sync error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
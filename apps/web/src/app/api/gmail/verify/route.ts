import { NextRequest, NextResponse } from 'next/server'
import { isFirestoreConfigured, getDocById } from '@/lib/firestore-data'
import { COLLECTIONS } from '@/lib/firebase/config'
import { getValidAccessToken } from '@/lib/gmail-tokens'

const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me'

const VERIFICATION_QUEUE_NAME = 'verification-queue'
const VERIFICATION_WORKER_CONCURRENCY = 4

interface VerificationJobData {
  studentEmail: string
  competitionId: string
  userId: string
  competitionTitle: string
  organizerEmail: string
}

interface ExtractedConfirmation {
  messageId: string
  threadId: string
  confirmationId: string
  extractedEmail: string
  verifiedAt: string
}

function extractEmailContent(payload: any): { text: string; html: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {}
  payload.headers?.forEach((h: any) => {
    headers[h.name.toLowerCase()] = h.value
  })

  let text = ''
  let html = ''

  function extractParts(part: any) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += Buffer.from(part.body.data, 'base64').toString('utf-8')
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += Buffer.from(part.body.data, 'base64').toString('utf-8')
    } else if (part.parts) {
      part.parts.forEach(extractParts)
    }
  }

  extractParts(payload)

  return { text, html, headers }
}

function isRegistrationConfirmation(email: any, competitionId: string, organizerEmail: string): boolean {
  const { text, html, headers } = email
  const content = `${text} ${html}`.toLowerCase()
  const from = (headers.from || '').toLowerCase()
  const subject = (headers.subject || '').toLowerCase()

  const isFromOrganizer = organizerEmail && from.includes(organizerEmail.toLowerCase())
  const hasConfirmationKeywords = /confirm|registration|registered|participat|thank you for registering|welcome to/.test(content)
  const hasCompetitionRef = competitionId && (content.includes(competitionId) || subject.includes(competitionId))

  return (isFromOrganizer || hasConfirmationKeywords) && (hasCompetitionRef || hasConfirmationKeywords)
}

function extractConfirmationMetadata(email: any, competitionId: string, organizerEmail: string): ExtractedConfirmation | null {
  const { text, html, headers } = email
  const content = `${text} ${html}`.toLowerCase()
  const from = (headers.from || '').toLowerCase()
  const subject = (headers.subject || '').toLowerCase()

  const isFromOrganizer = organizerEmail && from.includes(organizerEmail.toLowerCase())
  const hasConfirmationKeywords = /confirm|registration|registered|participat|thank you for registering|welcome to/.test(content)
  const hasCompetitionRef = competitionId && (content.includes(competitionId) || subject.includes(competitionId))

  if (!((isFromOrganizer || hasConfirmationKeywords) && (hasCompetitionRef || hasConfirmationKeywords))) {
    return null
  }

  // Extract confirmation ID from email body (e.g., "Your confirmation ID is ABC123")
  const confirmationIdMatch = content.match(/(?:confirmation|confirm|ref|code)[\s:]*([a-zA-Z0-9]{6,30})/i)
  const extractedConfirmationId = confirmationIdMatch ? confirmationIdMatch[1] : ''

  // Extract the registration email address if present
  const extractedEmail = headers['x-gmail-enhanced-original'] ? 
    'student-gmail-internal' : (headers.reply_to || headers.from || '')

  return {
    messageId: '',
    threadId: '',
    confirmationId: extractedConfirmationId,
    extractedEmail,
    verifiedAt: new Date().toISOString(),
  }
}

function buildGmailQuery(competition: any): string {
  const organizerEmail = competition?.organizer_email || ''
  const compTitle = competition?.competition_name || ''
  // Search for emails from the last 2 days with competition-related keywords
  return `from:${organizerEmail} (registration OR confirm OR registered OR participate OR signup) newer_than:2d`
}

export async function POST(request: NextRequest) {
  try {
    const { competitionId, userEmail } = await request.json()

    if (!competitionId || !userEmail) {
      return NextResponse.json({ error: 'Missing competitionId or userEmail' }, { status: 400 })
    }

    if (!isFirestoreConfigured()) {
      return NextResponse.json({ error: 'Firestore not configured' }, { status: 500 })
    }

    const competition = await getDocById(COLLECTIONS.competitionDashboard, competitionId)

    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    const token = await getValidAccessToken(userEmail)
    const accessToken = token.accessToken
    if (!accessToken) {
      return NextResponse.json({ error: 'No valid Gmail access token' }, { status: 401 })
    }

    // Push verification job to BullMQ queue
    const queue = new Queue(VERIFICATION_QUEUE_NAME, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    })

    await queue.add('verify-registration', {
      studentEmail: userEmail,
      competitionId,
      userId: userEmail, // Will be resolved
      competitionTitle: competition.competition_name,
      organizerEmail: competition.organizer_email,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      timeout: 60000,
    })

    return NextResponse.json({
      success: true,
      queued: true,
      message: 'Verification job queued. Processing started asynchronously.',
    })

  } catch (err) {
    console.error('Gmail verification queue error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const competitionId = searchParams.get('competitionId')
  const userEmail = searchParams.get('userEmail')

  if (!competitionId || !userEmail) {
    return NextResponse.json({ error: 'Missing competitionId or userEmail' }, { status: 400 })
  }

  try {
    if (!isFirestoreConfigured()) {
      return NextResponse.json({ verified: false, status: 'pending' })
    }

    // Check if there's a pending verification job for this student+competition
    // and fetch the current registration status from the database
    const { queryByField } = await import('@/lib/firestore-data')
    const { COLLECTIONS } = await import('@/lib/firebase/config')

    const rows = await queryByField(
      COLLECTIONS.studentCompetitions,
      'student_email',
      userEmail
    )

    const registration = rows.find((row: any) => row.competition_id === competitionId)

    if (registration) {
      return NextResponse.json({
        verified: registration.verification_status === 'verified',
        status: registration.verification_status || 'pending',
        verifiedAt: registration.verified_at,
        method: registration.verification_method,
        extractedConfirmationId: registration.extracted_confirmation_id,
        extractedEmail: registration.extracted_email,
      })
    }

    return NextResponse.json({ verified: false, status: 'pending' })
  } catch {
    return NextResponse.json({ verified: false, status: 'pending' })
  }
}
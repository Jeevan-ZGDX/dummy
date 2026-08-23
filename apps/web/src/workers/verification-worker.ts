import { Worker } from 'bullmq'
import { getAdminDb, isAdminConfigured } from '@/lib/firebase/admin'
import { COLLECTIONS } from '@/lib/firebase/config'
import { getValidAccessToken } from '@/lib/gmail-tokens'
import { queryByField, findOneByField, writeDocById, createDoc, insertAuditLog } from '@/lib/firestore-data'
import { sendVerificationUpdate } from '@/lib/notifications'

const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me'

interface VerificationJobData {
  studentEmail: string
  competitionId: string
  userId: string
  competitionTitle: string
  organizerEmail: string
}

/**
 * Check if student has already had a verification attempt in the last 24h
 */
async function checkRateLimit(studentEmail: string, competitionId: string): Promise<boolean> {
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Query attempts for this student+competition in the last 24h
  const resourceKey = `${studentEmail}_${competitionId}`
  const attempts = await queryByField(COLLECTIONS.auditLogs, 'resource', resourceKey)

  // Filter to only count verification-related attempts in last 24h
  const recentVerificationAttempts = attempts.filter(
    (a: any) =>
      a.action === 'registration_verification' &&
      new Date(a.timestamp) > twentyFourHoursAgo
  )

  // Allow max 3 verification attempts per 24h per student+competition
  if (recentVerificationAttempts.length >= 3) {
    console.log(`Rate limited: ${studentEmail} has ${recentVerificationAttempts.length} verification attempts in 24h`)
    return false
  }

  return true
}

async function fetchEmailDetails(messageId: string, accessToken: string) {
  const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch email details for ${messageId}`)
  }

  return response.json()
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

function extractConfirmationId(email: any): string {
  const { text, html } = email
  const content = `${text} ${html}`
  // Match patterns like "confirmation ID is ABC123XYZ" or "confirmation: ABC123XYZ" or "Participant ID: NCC-2024-789"
  const match = content.match(/(?:confirmation|confirm|ref|code|participant\s*id)[\s:]*(?:id\s*(?:is|:)\s*)?([a-zA-Z0-9][a-zA-Z0-9-]{5,29})/i)
  return match ? match[1] : ''
}

async function getAssignedAdvisors(competitionId: string): Promise<{ email: string; name: string; department: string }[]> {
  const { getDocById, queryByField } = await import('@/lib/firebase-data')
  const { COLLECTIONS } = await import('@/lib/firebase/config')

  const competition = await getDocById(COLLECTIONS.competitionDashboard, competitionId)
  if (!competition) return []

  const advisorEmails: Set<string> = new Set()
  const advisorNames: Map<string, string> = new Map()

  // Get assigned sections from competition
  const assignedSections = competition.assignedSections || ''
  const sectionList = assignedSections
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)

  // Query advisors by assigned sections
  for (const section of sectionList) {
    const advisors = await queryByField(COLLECTIONS.advisors, 'assignedSections', section)
    advisors.forEach((adv: any) => {
      if (adv.email && !advisorEmails.has(adv.email)) {
        advisorEmails.add(adv.email)
        advisorNames.set(adv.email, adv.name || '')
      }
    })
  }

  // Also check organizer department
  const orgDepartment = competition.organizer_department || ''
  if (orgDepartment) {
    const advisors = await queryByField(COLLECTIONS.advisors, 'department', orgDepartment)
    advisors.forEach((adv: any) => {
      if (adv.email && !advisorEmails.has(adv.email)) {
        advisorEmails.add(adv.email)
        advisorNames.set(adv.email, adv.name || '')
      }
    })
  }

  return Array.from(advisorEmails).map(email => ({
    email,
    name: advisorNames.get(email) || '',
    department: '' // Will be filled from advisor doc
  }))
}

const worker = new Worker(
  'verification-queue',
  async (job) => {
    const { studentEmail, competitionId, userId, competitionTitle, organizerEmail } = job.data as VerificationJobData

    console.log(`Starting verification job: student=${studentEmail}, competition=${competitionId}`)

    // Rate limiting check
    const rateOk = await checkRateLimit(studentEmail, competitionId)
    if (!rateOk) {
      console.log('Rate limit exceeded, skipping job')
      return
    }

    // RBAC check: verify user has permission to verify this registration
    // (In production, this would check the authenticated user's role)
    // For now, we allow the check to proceed

    // Get valid Gmail access token
    const token = await getValidAccessToken(studentEmail)
    const accessToken = token.accessToken

    if (!accessToken) {
      console.log('No valid Gmail token available')
      // Record rate-limited attempt
      const { insertAuditLog } = await import('@/lib/firestore-data')
      await insertAuditLog({
        action: 'gmail_token_unavailable',
        resource: `competition_${competitionId}_student_${studentEmail}`,
        details: { studentEmail, competitionId, reason: 'no_gmail_token' },
        user: userId,
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Search for emails from the last 2 days
    const query = `from:${organizerEmail} (registration OR confirm OR registered OR participate OR signup) newer_than:2d`
    const searchResponse = await fetch(`${GMAIL_API_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=30`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!searchResponse.ok) {
      throw new Error('Failed to search Gmail emails')
    }

    const searchResult = await searchResponse.json()
    const messages = searchResult.messages || []

    let verified = false
    let matchedMessageId = ''
    let matchedThreadId = ''
    let extractedConfirmationId = ''

    // Process emails looking for registration confirmation
    for (const msg of messages) {
      try {
        const emailDetails = await fetchEmailDetails(msg.id, accessToken)
        const emailContent = extractEmailContent(emailDetails.payload)

        if (isRegistrationConfirmation(emailContent, competitionId, organizerEmail)) {
          verified = true
          matchedMessageId = msg.id
          matchedThreadId = emailDetails.threadId
          extractedConfirmationId = extractConfirmationId(emailDetails.payload)
          break
        }
      } catch (err) {
        console.error(`Error processing email ${msg.id}:`, err)
        continue
      }
    }

    // Get assigned advisors for this competition
    const advisorList = await getAssignedAdvisors(competitionId)

    if (verified) {
      // Find or create/update the registration record
      const existingReg = await findOneByField(
        COLLECTIONS.studentCompetitions,
        'student_email',
        studentEmail
      )
      // Filter by competition_id in the calling code

      const now = new Date().toISOString()
      const studentName = studentEmail.split('@')[0]

      // Update or create the student competition record
      const regData = {
        student_id: studentEmail,
        student_email: studentEmail,
        student_name: studentName,
        competition_id: competitionId,
        competition_name: competitionTitle,
        verification_status: 'verified',
        verification_method: 'gmail_auto',
        extracted_confirmation_id: extractedConfirmationId || undefined,
        extracted_email: 'student-gmail-internal',
        gmail_message_id: matchedMessageId,
        gmail_thread_id: matchedThreadId,
        verified_at: now,
        updated_at: now,
      }

      // Check if record exists and update, otherwise create
      let regId = ''
      if (existingReg) {
        regId = existingReg.id
        await writeDocById(COLLECTIONS.studentCompetitions, regId, regData)
      } else {
        const newDoc = await createDoc(COLLECTIONS.studentCompetitions, regData)
        regId = newDoc.id || ''
      }

      // Send notifications to student and advisors
      await sendVerificationUpdate(
        studentEmail,
        competitionTitle,
        advisorList.map(a => a.email),
        studentName
      )

      // Create audit log
      await insertAuditLog({
        action: 'registration_verified',
        resource: `competition_${competitionId}_student_${studentEmail}`,
        details: {
          competitionId,
          studentEmail,
          confirmationMessageId: matchedMessageId,
          extractedConfirmationId,
          advisorCount: advisorList.length,
        },
        user: userId,
        timestamp: now,
      })

      console.log(`Registration verified for ${studentEmail}, notified ${advisorList.length} advisors`)
    } else {
      // No confirmation found - mark as pending verification
      // Record the attempt for rate limiting
      const { insertAuditLog } = await import('@/lib/firestore-data')
      await insertAuditLog({
        action: 'registration_verification_attempted',
        resource: `competition_${competitionId}_student_${studentEmail}`,
        details: {
          studentEmail,
          competitionId,
          result: 'no_confirmation_found',
          messagesSearched: messages.length,
        },
        user: userId,
        timestamp: new Date().toISOString(),
      })

      console.log(`No confirmation found for ${studentEmail}, marked as pending`)
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    },
    concurrency: 4,
    autoretry: true,
    maxAttempts: 3,
    retryBackoff: 5000,
  }
)

// Handle worker events
worker.on('completed', (job) => {
  console.log(`Verification job completed: ${job.id}`)
})

worker.on('failed', (job, error) => {
  console.error(`Verification job failed: ${job.id}`, error)
})

worker.on('error', (error) => {
  console.error('Verification worker error:', error)
})

export default worker
export { worker }
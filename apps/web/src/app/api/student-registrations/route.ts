import { NextRequest, NextResponse } from 'next/server'
import {
  queryByField,
  createDoc,
  updateDocById,
  getDocById,
  isFirestoreConfigured,
} from '@/lib/firestore-data'
import { COLLECTIONS } from '@/lib/firebase/config'

export async function POST(request: NextRequest) {
  try {
    const { userId, email, competitionId, verificationCode, registrationLink } = await request.json()

    if (!userId || !email || !competitionId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    if (!isFirestoreConfigured()) {
      return NextResponse.json({ success: false, error: 'Database connection failed' }, { status: 500 })
    }

    // Firestore has no compound uniqueness constraint, so the duplicate check
    // filters the narrower email match down by competition in memory rather than
    // needing a composite index for the two-field equality.
    const byEmail = await queryByField(COLLECTIONS.studentCompetitions, 'student_email', email)
    const existingRegistration = byEmail.find((row) => row.competition_id === competitionId)

    if (existingRegistration) {
      return NextResponse.json({ success: false, error: 'Already registered' }, { status: 409 })
    }

    const newRegistration = await createDoc(COLLECTIONS.studentCompetitions, {
        student_id: userId,
        student_email: email,
        student_name: email.split('@')[0],
        competition_id: competitionId,
        competition_name: '',
        registration_link: registrationLink || '',
        verification_status: verificationCode && verificationCode.trim() !== '' ? 'verified' : 'pending',
        verification_method: verificationCode && verificationCode.trim() !== '' ? 'manual_input' : 'manual',
        verified_at: verificationCode && verificationCode.trim() !== '' ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    })

    if (!newRegistration) {
      console.error('Registration insertion failed for', email, competitionId)
      return NextResponse.json({ success: false, error: 'Failed to create registration' }, { status: 500 })
    }

    return NextResponse.json({ success: true, registration: newRegistration })
  } catch (error) {
    console.error('Registration API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { registrationId, status, verificationCode, cancellation_reason } = await request.json()

    if (!registrationId) {
      return NextResponse.json({ success: false, error: 'Registration ID required' }, { status: 400 })
    }

    if (!isFirestoreConfigured()) {
      return NextResponse.json({ success: false, error: 'Database connection failed' }, { status: 500 })
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (status) {
      updateData.verification_status = status
    }

    if (verificationCode !== undefined) {
      if (verificationCode && verificationCode.trim() !== '') {
        updateData.verification_status = 'verified'
        updateData.verification_method = 'manual_input'
        updateData.verified_at = new Date().toISOString()
      }
    }

    if (cancellation_reason !== undefined) {
      updateData.verification_status = 'rejected'
    }

    const result = await updateDocById(
      COLLECTIONS.studentCompetitions,
      registrationId,
      updateData
    )

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Failed to update registration' }, { status: 500 })
    }

    // Firestore updates return nothing, but the client expects the saved row.
    const updatedRegistration = await getDocById(
      COLLECTIONS.studentCompetitions,
      registrationId
    )

    return NextResponse.json({ success: true, registration: updatedRegistration })
  } catch (error) {
    console.error('Registration update API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
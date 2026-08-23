import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { findOneByField, writeDocById, insertAuditLog } from '@/lib/firestore-data'
import { COLLECTIONS } from '@/lib/firebase/config'
import { syncUserClaims } from '@/lib/firebase-auth'
import { normalizeRole } from '@/lib/firebase/session'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

const ALLOWED_EMAILS = new Set(['hod@citchennai.net', 'admin@citchennai.net'])
const ALLOWED_ROLES = new Set(['hod', 'admin', 'super_admin'])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email: rawEmail, newPassword, confirmPassword } = body

    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required.' },
        { status: 400 }
      )
    }

    const cleanEmail = rawEmail.trim().toLowerCase()

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters long.' },
        { status: 400 }
      )
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'New password and confirm password do not match.' },
        { status: 400 }
      )
    }

    const auth = getAdminAuth()
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Database service is not configured on the server.' },
        { status: 500 }
      )
    }

    // 1. Look the account up in Firebase Auth. A direct lookup by email replaces
    //    the old paged listUsers() scan, which silently missed anyone past 1,000.
    let existingUser: Awaited<ReturnType<typeof auth.getUserByEmail>> | null = null
    try {
      existingUser = await auth.getUserByEmail(cleanEmail)
    } catch {
      existingUser = null // auth/user-not-found — handled as a create below
    }

    const claims = (existingUser?.customClaims || {}) as Record<string, unknown>
    let userRole = typeof claims.role === 'string' ? claims.role : ''
    let userName = typeof claims.name === 'string' ? claims.name : ''

    if (existingUser && !userRole) {
      const profile = await findOneByField(COLLECTIONS.userProfiles, 'email', cleanEmail)
      if (profile?.role) {
        userRole = profile.role
        userName = profile.full_name || profile.name || userName
      }
    }

    // Determine authorization: strictly HOD or Admin
    const isDirectAllowedEmail = ALLOWED_EMAILS.has(cleanEmail)
    const isAllowedRole =
      isDirectAllowedEmail || (userRole ? ALLOWED_ROLES.has(userRole.toLowerCase()) : false)

    if (!isAllowedRole) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Password reset is only available for HOD and Admin accounts. Please return to the Sign In page.',
          redirectSignIn: true,
        },
        { status: 403 }
      )
    }

    const assignedRole =
      userRole || (cleanEmail === 'hod@citchennai.net' ? 'hod' : 'super_admin')
    const assignedName =
      userName || (cleanEmail === 'hod@citchennai.net' ? 'Head of Department' : 'System Admin')
    const assignedDepartment = (existingUser && (claims.department as string)) || 'CSE'

    let userId: string

    if (existingUser) {
      userId = existingUser.uid
      await auth.updateUser(userId, { password: newPassword })
    } else {
      const created = await auth.createUser({
        email: cleanEmail,
        password: newPassword,
        emailVerified: true,
        displayName: assignedName,
      })
      userId = created.uid
    }

    await syncUserClaims(userId, {
      role: normalizeRole(assignedRole),
      department: assignedDepartment,
      name: assignedName,
    })

    // Revoke outstanding sessions so an old ID token cannot keep using the
    // account after its password was reset.
    await auth.revokeRefreshTokens(userId).catch(() => {})

    // 2. Sync to user_profiles, keyed by email. The migrated documents use email
    //    as their id because the old `user_id` was a Supabase UUID; writing by
    //    Firebase uid here would create a second, orphaned document per user.
    const profileWrite = await writeDocById(COLLECTIONS.userProfiles, cleanEmail, {
      user_id: userId,
      email: cleanEmail,
      full_name: assignedName,
      role: assignedRole,
      department: assignedDepartment,
    })
    if (!profileWrite.success) {
      console.warn('user_profiles sync warning:', profileWrite.reason)
    }

    // 3. Log audit event
    const audit = await insertAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      user: cleanEmail,
      action: 'PASSWORD_RESET',
      resource: 'auth',
      details: `Password reset successfully completed for ${cleanEmail}`,
    })
    if (!audit.success) {
      console.warn('Audit log write error:', audit.reason)
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully updated.',
    })
  } catch (err: any) {
    console.error('Error in forgot-password handler:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

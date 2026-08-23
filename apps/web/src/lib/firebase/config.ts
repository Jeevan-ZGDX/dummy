/**
 * Firebase web config, read from NEXT_PUBLIC_* so the same values are available
 * to the browser bundle, to Node route handlers, and to the Edge middleware.
 *
 * These values are not secrets — a Firebase web config is designed to ship to
 * the client. Access is controlled by Firestore security rules and Auth, never
 * by hiding this object.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
}

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)
}

/** Collection names, kept in one place so a typo fails loudly at import time. */
export const COLLECTIONS = {
  students: 'students',
  advisors: 'advisors',
  competitions: 'competitions',
  registrations: 'registrations',
  winners: 'winners',
  notifications: 'notifications',
  auditLogs: 'audit_logs',
  verificationRequests: 'verification_requests',
  competitionDashboard: 'competition_dashboard',
  roleAccess: 'role_access',
  profiles: 'profiles',
  userProfiles: 'user_profiles',
  studentCompetitions: 'student_competitions',
  gmailTokens: 'gmail_tokens',
  /** Precomputed ranking rows, one per student with at least one win. */
  leaderboard: 'leaderboard',
  /** Cumulative prize amounts per student (keyed by email). */
  prizeAmount: 'prize_amount',
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]

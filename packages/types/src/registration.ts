import { Competition } from './competition'

export type RegistrationStatus = 'pending_verification' | 'verified' | 'completed' | 'rejected'

export interface Registration {
  id: string
  competitionId: string
  competition: Competition
  userId: string
  userName: string
  department: string
  status: RegistrationStatus
  registeredAt: string
  verifiedAt: string | null
  verificationMethod: 'screenshot' | 'email' | 'manual' | null
  extractedConfirmationId: string | null
  extractedEmail: string | null
  rejectionReason: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface RegistrationListResponse {
  data: Registration[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface RegistrationCreate {
  competitionId: string
  verificationMethod: 'screenshot' | 'email'
  confirmationScreenshot?: string
  confirmationEmail?: string
  /**
   * Student identity, mirrored into `student_competitions` (which is keyed by
   * email, not by a students FK) when a registration is created.
   */
  userId?: string
  userEmail?: string
  userName?: string
  /** Denormalized onto `student_competitions.competition_name`. */
  competitionTitle?: string
}

export interface RegistrationStats {
  totalRegistered: number
  totalVerified: number
  totalCompleted: number
  totalRejected: number
  totalPending: number
  verificationRate: number
}

export interface AdminRegistrationStats extends RegistrationStats {
  totalCompetitions: number
  totalRegistrations: number
  registrationGrowth: number
  verifiedGrowth: number
  verificationRateChange: number
}

export interface StudentDashboardStats {
  totalRegistered: number
  totalVerified: number
  totalPending: number
  totalWins: number
  registrations: Registration[]
  upcomingCompetitions: Competition[]
  recentVerifiedRegs: Registration[]
  selfVerificationRequests: any[]
  totalStudents?: number
  registeredCount?: number
  unregisteredCount?: number
  totalCompetitions?: number
  yearWise?: { year: string; studentCount: number; registrationCount: number; verifiedCount: number; pendingCount: number }[]
}

export interface DashboardStats {
  totalCompetitions: number
  totalRegistrations: number
  verifiedRegistrations: number
  verificationRate: number
  registrationsOverTime: { date: string; count: number }[]
  topDepartments: { name: string; count: number }[]
  recentVerified: Registration[]
  pendingVerifications: Registration[]
  selfVerificationRequests: any[]
}

export interface CompetitionDashboardData {
  competition: Competition
  registeredStudents: Registration[]
  unregisteredStudents: { id: string; name: string; email: string; department: string; section: string }[]
  totalRegistered: number
  totalUnregistered: number
  registrationsByDepartment: { department: string; count: number }[]
}

export interface HistoryEntry {
  registration: Registration
  competition: Competition
  status: RegistrationStatus
  verifiedAt: string | null
  position?: string
  prize?: string
}

/**
 * Shape returned by `GET /advisor/dashboard/stats` — scoped to the signed-in
 * advisor's assigned sections. Distinct from the admin/COE dashboard payload,
 * which is department-wide.
 */
export interface AdvisorDashboardStats {
  totalStudents: number
  registeredCount: number
  verifiedCount: number
  pendingCount: number
  rejectedCount: number
  verificationRequests: Array<{
    id: string
    studentId?: string
    studentName: string
    department?: string
    competitionTitle?: string
    status: string
    emailProof?: {
      from?: string
      to?: string
      subject?: string
      date?: string
    } | null
    requestedAt?: string
  }>
  registrations: Array<Record<string, unknown>>
}

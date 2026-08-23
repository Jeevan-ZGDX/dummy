// ─── Advisor dashboard summary ───────────────────────────────────────────────

export interface AdvisorSummarySection {
  section: string;
  totalCount: number;
  registeredCount: number;
  verifiedCount: number;
  notRegisteredCount: number;
}

export interface AdvisorRecentRegistration {
  studentId: string;
  studentName: string;
  studentEmail: string;
  section: string;
  competitionId: string;
  competitionName: string;
  status: 'verified' | 'pending' | 'rejected';
  registeredAt: string | null;
  verifiedAt: string | null;
}

/**
 * Cross-competition summary for the signed-in advisor, sourced from
 * `student_competitions` (where registrations actually live).
 */
export interface AdvisorSummaryResponse {
  advisor: {
    id: string;
    name: string;
    email: string;
    department: string;
    assignedSections: string[];
  };
  yearScope: string;
  totals: {
    /** Students across the advisor's sections, in the year scope. */
    totalStudents: number;
    /** Distinct students with at least one registration. */
    registeredStudents: number;
    verifiedRegistrations: number;
    pendingRegistrations: number;
    rejectedRegistrations: number;
    /** Registration rows, which may exceed registeredStudents. */
    totalRegistrations: number;
    competitionsEntered: number;
  };
  sections: AdvisorSummarySection[];
  recentRegistrations: AdvisorRecentRegistration[];
}

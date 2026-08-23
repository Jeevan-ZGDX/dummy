export interface SectionRegistrationDetail {
  id: string;
  name: string;
  email: string;
  department: string;
  section: string;
}

export interface CompetitionSectionStats {
  section: string;
  registeredCount: number;
  totalCount: number;
  /** Registered students, or null when the section has none. */
  registered?: SectionRegistrationDetail[] | null;
}

export interface CompetitionSectionsResponse {
  competitionId: string;
  eligibleYears: string[];
  sections: CompetitionSectionStats[];
  /** Set when the competition admits none of the cohorts we report on. */
  notEligible?: boolean;
}

// ─── Advisor roster ─────────────────────────────────────────────────────────

/** Registration state of one student for one competition. */
export type AdvisorStudentStatus = 'registered' | 'verified' | 'rejected' | 'not_registered';

export interface AdvisorStudentRow {
  id: string;
  name: string;
  email: string;
  /** Section as displayed — year prefix stripped ("3%A" -> "A"). */
  section: string;
  year: string;
  department: string;
  status: AdvisorStudentStatus;
  /** Raw `student_competitions.verification_status`, null when never registered. */
  verificationStatus: string | null;
  registeredAt: string | null;
  verifiedAt: string | null;
}

export interface AdvisorSectionRoster {
  section: string;
  totalCount: number;
  registeredCount: number;
  verifiedCount: number;
  notRegisteredCount: number;
  students: AdvisorStudentRow[];
}

export interface AdvisorCompetitionRosterResponse {
  competitionId: string;
  competitionName: string;
  /** Year labels the competition admits, derived from eligible_year. */
  eligibleYears: string[];
  /** True when eligible_year carried no parseable year (treated as all years). */
  openToAllYears: boolean;
  advisor: {
    id: string;
    name: string;
    email: string;
    department: string;
    /** Bare section labels this advisor is responsible for. */
    assignedSections: string[];
  };
  /** Year label the roster was scoped to (e.g. "3rd Year"). */
  yearScope: string;
  totals: {
    totalStudents: number;
    registeredCount: number;
    verifiedCount: number;
    notRegisteredCount: number;
  };
  sections: AdvisorSectionRoster[];
  /** Set when the competition does not admit the advisor's year scope. */
  notEligible?: boolean;
}

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

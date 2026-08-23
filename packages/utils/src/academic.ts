/**
 * Academic label normalization.
 *
 * The live data uses three different vocabularies for the same two concepts,
 * which is why advisor→student joins silently return nothing:
 *
 *   students.section            "3%A" … "3%Q"   (3rd year)  |  "A" … "R"  (1st year)
 *   advisors.assigned_sections  "A" … "Q"       (no year prefix)
 *   students.year               "1st Year" | "3rd Year"
 *   competition_dashboard.eligible_year
 *                              "I, II, III, IV" (Roman) plus free text
 *                              ("StartUp", "Startups, MSME", "2nd Year", null)
 *
 * Everything here is derived from the strings themselves — no section or
 * competition list is hardcoded, so new sections/years need no code change.
 */

/** Sections are stored with a year prefix like "3%A" for 3rd year, bare "A" for 1st. */
const SECTION_PREFIX = /^(\d+)\s*%\s*/

/**
 * Strips any leading "<digits>%" year prefix from a section label.
 * "3%A" -> "A", "A" -> "A", " 3 % b " -> "B".
 * Returns '' for nullish/blank input so callers can decide how to bucket it.
 */
export function normalizeSection(section: string | null | undefined): string {
  if (!section) return ''
  return section.trim().replace(SECTION_PREFIX, '').trim().toUpperCase()
}

/** Reads the year number encoded in a section label, if present. "3%A" -> 3, "A" -> null. */
export function sectionYearNumber(section: string | null | undefined): number | null {
  if (!section) return null
  const match = section.trim().match(SECTION_PREFIX)
  return match ? Number(match[1]) : null
}

/**
 * Builds the section label used in `students.section` for a given bare section
 * and year, so callers can query without knowing the storage convention.
 * ("A", 3) -> "3%A"   ("A", 1) -> "A"
 *
 * Only years that actually use a prefix in the data get one. 1st-year rows are
 * stored bare, so prefixing them would match nothing.
 */
export function toStoredSection(section: string, yearNumber: number | null): string {
  const bare = normalizeSection(section)
  if (!bare) return ''
  return yearNumber !== null && yearNumber !== 1 ? `${yearNumber}%${bare}` : bare
}

/**
 * Every storage spelling a bare section could have, for `.in()` queries.
 * "A" -> ["A", "1%A", "2%A", "3%A", "4%A"] — covers both conventions without
 * needing to know which year the caller is targeting.
 */
export function storedSectionVariants(section: string, yearNumbers: number[] = [1, 2, 3, 4]): string[] {
  const bare = normalizeSection(section)
  if (!bare) return []
  return [bare, ...yearNumbers.map((y) => `${y}%${bare}`)]
}

/** True when a bare advisor section refers to the same class as a stored student section. */
export function sectionMatches(
  assignedSection: string | null | undefined,
  studentSection: string | null | undefined
): boolean {
  const a = normalizeSection(assignedSection)
  const b = normalizeSection(studentSection)
  return a !== '' && a === b
}

// ─── Year labels ────────────────────────────────────────────────────────────

/** Canonical `students.year` label for an academic year number. */
export function yearNumberToLabel(yearNumber: number): string {
  const suffix = yearNumber === 1 ? 'st' : yearNumber === 2 ? 'nd' : yearNumber === 3 ? 'rd' : 'th'
  return `${yearNumber}${suffix} Year`
}

const ROMAN_TO_NUMBER: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 }

/**
 * Parses one token from `eligible_year` into an academic year number.
 * Accepts Roman ("III"), ordinal labels ("3rd Year", "3rd", "third"), and bare
 * digits ("3"). Returns null for anything that isn't a year — "StartUp",
 * "MSME", "Startups" — so callers can treat those as "not year-scoped".
 */
export function parseYearToken(token: string): number | null {
  const t = token.trim().toUpperCase()
  if (!t) return null

  if (t in ROMAN_TO_NUMBER) return ROMAN_TO_NUMBER[t]

  const ordinal = t.match(/^(\d+)\s*(?:ST|ND|RD|TH)?\s*(?:YEAR)?$/)
  if (ordinal) {
    const n = Number(ordinal[1])
    return n >= 1 && n <= 5 ? n : null
  }

  const words: Record<string, number> = { FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5 }
  const word = t.replace(/\s*YEAR$/, '').trim()
  return word in words ? words[word] : null
}

export interface ParsedEligibleYears {
  /** Academic year numbers the competition is open to, ascending. */
  yearNumbers: number[]
  /** `students.year` labels for those numbers — ready for a `.in('year', …)` query. */
  yearLabels: string[]
  /** Tokens that carried no year meaning ("StartUp", "MSME"). */
  unparsedTokens: string[]
  /**
   * True when no year could be derived at all (blank, null, or purely
   * non-year text). Callers should treat this as "open to every year"
   * rather than "open to none" — otherwise these competitions show zero
   * eligible students.
   */
  openToAllYears: boolean
}

/**
 * Parses a `competition_dashboard.eligible_year` value into usable year filters.
 *
 * "I, II, III, IV"   -> [1,2,3,4]
 * "III, IV"          -> [3,4]
 * "2nd Year"         -> [2]
 * "Startups, MSME"   -> [] + openToAllYears (no year signal at all)
 * null / ""          -> [] + openToAllYears
 */
export function parseEligibleYears(eligible: string | null | undefined): ParsedEligibleYears {
  const tokens = (eligible ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const yearNumbers: number[] = []
  const unparsedTokens: string[] = []

  for (const token of tokens) {
    const n = parseYearToken(token)
    if (n === null) unparsedTokens.push(token)
    else if (!yearNumbers.includes(n)) yearNumbers.push(n)
  }

  yearNumbers.sort((a, b) => a - b)

  return {
    yearNumbers,
    yearLabels: yearNumbers.map(yearNumberToLabel),
    unparsedTokens,
    openToAllYears: yearNumbers.length === 0,
  }
}

// ─── Active cohorts ─────────────────────────────────────────────────────────

/**
 * Academic years the dashboards actually report on.
 *
 * `students` holds two cohorts — "2nd Year" (batch 2025) and "3rd Year"
 * (batch 2024). Both have registration activity, so both are included.
 * Widen this list when another cohort gets real data; every year filter reads
 * from here so there is one place to change.
 */
export const ACTIVE_YEAR_NUMBERS: readonly number[] = [2, 3]

/** `students.year` labels for the active cohorts. */
export const ACTIVE_YEAR_LABELS: readonly string[] = ACTIVE_YEAR_NUMBERS.map(yearNumberToLabel)

/**
 * Intersects a competition's eligible years with the cohorts we report on.
 *
 * A competition open to "I, II, III, IV" is reported as 3rd-year only, because
 * that is the only cohort with data. Returns an empty array when the
 * competition genuinely excludes every active cohort, which callers should
 * surface as "not eligible" rather than as zero students.
 */
export function activeEligibleYears(eligible: string | null | undefined): {
  yearNumbers: number[]
  yearLabels: string[]
  /** True when the competition admits none of the active cohorts. */
  excludesAllActive: boolean
} {
  const parsed = parseEligibleYears(eligible)
  // No year signal at all ("StartUp", blank) means open to everyone.
  const admitted = parsed.openToAllYears
    ? [...ACTIVE_YEAR_NUMBERS]
    : ACTIVE_YEAR_NUMBERS.filter((y) => parsed.yearNumbers.includes(y))

  return {
    yearNumbers: admitted,
    yearLabels: admitted.map(yearNumberToLabel),
    excludesAllActive: admitted.length === 0,
  }
}

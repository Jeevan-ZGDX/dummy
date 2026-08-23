import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  assertDbEnv,
  getAdvisor,
  getStudentsInSection,
  findCompetitionForYear,
  findCompetitionAdmittingButExcluding,
  seedRegistrations,
  clearFixtureRegistrations,
  countFixtureRegistrations,
  type AdvisorRow,
  type StudentRow,
} from './helpers/db'
import { ADVISOR, UNMAPPED_ADVISOR } from './helpers/auth'
import { STORAGE_STATE } from './global-setup'

/**
 * End-to-end coverage for the advisor → student mapping.
 *
 * Nothing is hardcoded: the advisor, their sections, the competition and the
 * expected student count are all read from the live database, then asserted
 * against what the API and UI report.
 *
 * Sessions come from the one-time sign-ins in global-setup.
 */

const YEAR_LABEL = '3rd Year'
const YEAR_ROMAN = 'III'

let advisor: AdvisorRow
let competitionId: string
let sectionStudents: StudentRow[]
let bareSection: string

test.beforeAll(async () => {
  assertDbEnv()
  advisor = await getAdvisor(ADVISOR.email)

  expect(
    advisor.assigned_sections?.length,
    `advisor ${advisor.email} must have at least one assigned section`
  ).toBeGreaterThan(0)

  bareSection = advisor.assigned_sections![0]
  sectionStudents = await getStudentsInSection(bareSection, YEAR_LABEL)
  expect(sectionStudents.length, `no ${YEAR_LABEL} students in section ${bareSection}`).toBeGreaterThan(0)

  const comp = await findCompetitionForYear(YEAR_ROMAN)
  expect(comp, `no competition in competition_dashboard admits ${YEAR_ROMAN}`).not.toBeNull()
  competitionId = comp.id

  await clearFixtureRegistrations()
})

test.afterAll(async () => {
  await clearFixtureRegistrations()
  expect(await countFixtureRegistrations(), 'fixture rows must be cleaned up').toBe(0)
})

function rosterUrl(id = competitionId, query = '') {
  return `/api/advisor/competitions/${id}/roster${query}`
}

async function roster(ctx: APIRequestContext, id = competitionId, query = '') {
  const res = await ctx.get(rosterUrl(id, query))
  return { status: res.status(), body: await res.json() }
}

// ─── API contract ───────────────────────────────────────────────────────────

test.describe('roster API', () => {
  test('rejects an unauthenticated request', async ({ playwright, baseURL }) => {
    // Deliberately no storage state.
    const ctx = await playwright.request.newContext({ baseURL })
    const { status, body } = await roster(ctx)
    expect(status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('UNAUTHENTICATED')
    await ctx.dispose()
  })

  test.describe('as the mapped advisor', () => {
    test.use({ storageState: STORAGE_STATE.advisor })

    test('returns every student in the section, scoped to 3rd year', async ({ request }) => {
      const { status, body } = await roster(request)
      expect(status).toBe(200)
      expect(body.success).toBe(true)

      const data = body.data
      expect(data.advisor.email.toLowerCase()).toBe(advisor.email.toLowerCase())
      expect(data.advisor.assignedSections).toEqual(
        [...advisor.assigned_sections!].sort((a, b) => a.localeCompare(b))
      )
      expect(data.yearScope).toBe(YEAR_LABEL)

      // Section labels are normalized — no "3%" prefix leaks to the client.
      for (const section of data.sections) {
        expect(section.section).not.toContain('%')
        for (const student of section.students) {
          expect(student.section).not.toContain('%')
          expect(student.year).toBe(YEAR_LABEL)
        }
      }

      // Count must match the database exactly: this is what the 3%-prefix
      // mismatch used to break (it returned zero students).
      const target = data.sections.find((s: any) => s.section === bareSection)
      expect(target, `section ${bareSection} missing from response`).toBeTruthy()
      expect(target.totalCount).toBe(sectionStudents.length)
      expect(target.students).toHaveLength(sectionStudents.length)

      // And it must not have pulled in 1st-year students sharing the letter.
      const emails = new Set(sectionStudents.map((s) => s.email))
      for (const student of target.students) expect(emails.has(student.email)).toBe(true)
    })

    test('defaults every student to not_registered when nothing is registered', async ({
      request,
    }) => {
      await clearFixtureRegistrations()
      const { body } = await roster(request)
      const data = body.data
      expect(data.totals.registeredCount).toBe(0)
      expect(data.totals.notRegisteredCount).toBe(data.totals.totalStudents)
      for (const section of data.sections) {
        for (const student of section.students) expect(student.status).toBe('not_registered')
      }
    })

    test('reflects pending, verified and rejected registrations', async ({ request }) => {
      expect(sectionStudents.length, 'need at least 3 students to seed').toBeGreaterThanOrEqual(3)
      const [a, b, c] = sectionStudents

      await clearFixtureRegistrations()
      await seedRegistrations(competitionId, [
        { student: a, status: 'pending' },
        { student: b, status: 'verified' },
        { student: c, status: 'rejected' },
      ])

      const { body } = await roster(request)
      const data = body.data
      const byEmail = new Map<string, any>(
        data.sections.flatMap((s: any) => s.students.map((st: any) => [st.email, st]))
      )

      expect(byEmail.get(a.email).status).toBe('registered')
      expect(byEmail.get(a.email).verificationStatus).toBe('pending')
      expect(byEmail.get(b.email).status).toBe('verified')
      expect(byEmail.get(b.email).verifiedAt).not.toBeNull()
      expect(byEmail.get(c.email).status).toBe('rejected')

      // "registered" means signed up — pending + verified, excluding rejected.
      expect(data.totals.registeredCount).toBe(2)
      expect(data.totals.verifiedCount).toBe(1)
      expect(data.totals.notRegisteredCount).toBe(data.totals.totalStudents - 2)

      await clearFixtureRegistrations()
    })

    test('404s for an unknown competition', async ({ request }) => {
      const { status, body } = await roster(request, 'no-such-competition-id')
      expect(status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    test('reports notEligible when the competition excludes the requested year', async ({
      request,
    }) => {
      // A competition that admits 3rd year but not 1st, so asking for year=1
      // must come back notEligible rather than silently empty.
      const comp = await findCompetitionAdmittingButExcluding(YEAR_ROMAN, 'I')
      test.skip(!comp, 'no competition admits III while excluding I')

      const { body } = await roster(request, comp.id, '?year=1')
      const data = body.data
      expect(data.eligibleYears).not.toContain('1st Year')
      expect(data.notEligible).toBe(true)
      expect(data.totals.totalStudents).toBe(0)
      expect(data.sections).toHaveLength(0)

      // The same competition must still resolve normally for 3rd year.
      const ok = await roster(request, comp.id)
      expect(ok.body.data.notEligible).toBeUndefined()
      expect(ok.body.data.totals.totalStudents).toBe(sectionStudents.length)
    })
  })

  test.describe('as an advisor account with no advisors row', () => {
    test.use({ storageState: STORAGE_STATE.unmappedAdvisor })

    test('explains why the roster is unavailable', async ({ request }) => {
      const { status, body } = await roster(request)
      expect(status).toBe(404)
      expect(body.error.code).toBe('ADVISOR_NOT_MAPPED')
      // Must name the account rather than failing silently.
      expect(body.error.detail).toContain(UNMAPPED_ADVISOR.email)
    })
  })
})

// ─── UI ─────────────────────────────────────────────────────────────────────

test.describe('advisor roster UI', () => {
  test.describe('signed in as the mapped advisor', () => {
    test.use({ storageState: STORAGE_STATE.advisor })

    test('shows the panel with real counts and per-student status', async ({ page }) => {
      const [a, b] = sectionStudents
      await clearFixtureRegistrations()
      await seedRegistrations(competitionId, [
        { student: a, status: 'pending' },
        { student: b, status: 'verified' },
      ])

      await page.goto(`/competitions/${competitionId}`)

      // Scope to the panel: the advisor's name also appears in the sidebar.
      const panel = page.getByTestId('advisor-roster-panel')
      await expect(panel).toBeVisible()
      await expect(panel).toContainText('My Students')
      await expect(panel).toContainText(advisor.name)
      await expect(panel).toContainText(new RegExp(`Section\\s*s?\\s*${bareSection}`))
      await expect(panel).toContainText(YEAR_LABEL)

      // Totals come from the database, not from fixtures in the test.
      await expect(panel).toContainText(String(sectionStudents.length))

      const sectionRow = page.getByTestId(`advisor-section-${bareSection}`)
      await expect(sectionRow).toBeVisible()
      await expect(sectionRow).toContainText(`2 / ${sectionStudents.length} registered`)

      // Expand and confirm each student renders with a status badge.
      await sectionRow.getByRole('button').first().click()
      const rows = page.getByTestId('advisor-student-row')
      await expect(rows.first()).toBeVisible()
      await expect(rows).toHaveCount(sectionStudents.length)

      await expect(sectionRow).toContainText(a.name)
      await expect(sectionRow).toContainText('Registered')
      await expect(sectionRow).toContainText('Verified')
      await expect(sectionRow).toContainText('Not registered')

      // The raw storage prefix must never reach the user. Match the prefix
      // pattern (digit-%-letter) rather than the bare "3%" string: a 2-of-65
      // progress bar legitimately renders the text "3%".
      // Deliberately not whitespace-normalized: the stored prefix is always
      // adjacent ("3%A"), whereas the progress label is "3%" followed by a
      // line break, so requiring adjacency separates the two.
      const bodyText = await page.locator('body').innerText()
      expect(bodyText).not.toMatch(/\d%[A-Za-z]/)

      // Section headings are the normalized letter only.
      const headings = await page.getByTestId('advisor-roster-sections').getByRole('button').allInnerTexts()
      for (const heading of headings) {
        expect(heading).toMatch(new RegExp(`Section ${bareSection}\\b`))
        expect(heading).not.toMatch(/Section\s*\d\s*%/)
      }

      await clearFixtureRegistrations()
    })

    test('search filters the expanded roster', async ({ page }) => {
      await page.goto(`/competitions/${competitionId}`)

      const sectionRow = page.getByTestId(`advisor-section-${bareSection}`)
      await sectionRow.getByRole('button').first().click()
      await expect(page.getByTestId('advisor-student-row').first()).toBeVisible()

      await page.getByTestId('advisor-roster-search').fill(sectionStudents[0].name)
      await expect(page.getByTestId('advisor-student-row')).toHaveCount(1)
      await expect(page.getByTestId('advisor-student-row').first()).toContainText(
        sectionStudents[0].name
      )

      // A query matching nobody shows an empty state, not a stale list.
      await page.getByTestId('advisor-roster-search').fill('zzz-no-such-student-zzz')
      await expect(page.getByTestId('advisor-student-row')).toHaveCount(0)
    })

    test('does not redirect to /login while loading the roster', async ({ page }) => {
      // Regression guard: a 401 from the roster endpoint makes the axios
      // interceptor hard-redirect to /login, silently hiding the panel.
      await page.goto(`/competitions/${competitionId}`)
      await expect(page.getByTestId('advisor-roster-panel')).toBeVisible()
      expect(page.url()).not.toContain('/login')
      expect(page.url()).not.toContain('/sign-in')
    })
  })

  test.describe('signed in as a student', () => {
    test.use({ storageState: STORAGE_STATE.student })

    test('does not see the advisor roster panel', async ({ page }) => {
      await page.goto(`/competitions/${competitionId}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByTestId('advisor-roster-panel')).toHaveCount(0)
    })
  })

  test('unauthenticated visitors are redirected to sign-in', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()
    await page.goto(`/competitions/${competitionId}`)
    await expect(page).toHaveURL(/\/sign-in/)
    await context.close()
  })
})

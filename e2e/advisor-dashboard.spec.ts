import { test, expect } from '@playwright/test'
import { ADVISOR, UNMAPPED_ADVISOR, signInViaApi } from './helpers/auth'
import {
  FIXTURE_TAG,
  assertDbEnv,
  clearFixtureRegistrations,
  findCompetitionForYear,
  getAdvisor,
  getStudentsInSection,
  seedRegistrations,
} from './helpers/db'

/**
 * The advisor dashboard (`/dashboard`) rolls a single advisor's sections up
 * across every competition.
 *
 * It regressed to all-zeroes because `/advisor/dashboard/stats` counted the
 * legacy `registrations` table, which is empty — real registrations live in
 * `student_competitions`. These tests pin the numbers to seeded fixture rows so
 * that specific regression cannot come back silently.
 */

const YEAR_LABEL = '3rd Year'

test.beforeAll(assertDbEnv)
test.afterAll(clearFixtureRegistrations)

test.describe('advisor summary API', () => {
  test('rejects an unauthenticated request', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL })
    const res = await ctx.get('/api/advisor/summary')
    expect(res.status()).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
    await ctx.dispose()
  })

  test('explains an advisor account with no advisors row', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext()
    await signInViaApi(ctx, UNMAPPED_ADVISOR, baseURL!)
    const page = await ctx.newPage()
    const res = await page.request.get('/api/advisor/summary')

    // Only meaningful while advisor@citchennai.net has no advisors row. The
    // demo-advisor script deliberately creates one, so skip if it exists.
    if (res.status() === 200) {
      test.skip(true, 'advisor@citchennai.net is currently mapped to an advisors row')
    }
    expect(res.status()).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('ADVISOR_NOT_MAPPED')
    expect(body.error.detail).toContain(UNMAPPED_ADVISOR.email)
    await ctx.close()
  })

  test.describe('as the mapped advisor', () => {
    test.use({ storageState: 'e2e/.auth/advisor.json' })

    test('totals and per-section rollup match the seeded rows', async ({ request }) => {
      await clearFixtureRegistrations()

      const advisor = await getAdvisor(ADVISOR.email)
      const section = (advisor.assigned_sections ?? [])[0]
      expect(section, 'advisor must have an assigned section').toBeTruthy()

      const students = await getStudentsInSection(section!, YEAR_LABEL)
      expect(students.length).toBeGreaterThan(4)

      const competition = await findCompetitionForYear('III')
      expect(competition, 'need a competition admitting 3rd year').toBeTruthy()

      // 3 verified, 2 pending, 1 rejected => 6 distinct registered students.
      await seedRegistrations(competition!.id, [
        { student: students[0], status: 'verified' },
        { student: students[1], status: 'verified' },
        { student: students[2], status: 'verified' },
        { student: students[3], status: 'pending' },
        { student: students[4], status: 'pending' },
        { student: students[5], status: 'rejected' },
      ])

      const res = await request.get('/api/advisor/summary')
      expect(res.ok()).toBeTruthy()
      const { data } = await res.json()

      expect(data.advisor.email.toLowerCase()).toBe(ADVISOR.email.toLowerCase())
      expect(data.yearScope).toBe(YEAR_LABEL)
      expect(data.advisor.assignedSections).toContain(section)

      expect(data.totals.totalStudents).toBe(students.length)
      expect(data.totals.registeredStudents).toBe(6)
      expect(data.totals.verifiedRegistrations).toBe(3)
      expect(data.totals.pendingRegistrations).toBe(2)
      expect(data.totals.rejectedRegistrations).toBe(1)
      expect(data.totals.totalRegistrations).toBe(6)
      expect(data.totals.competitionsEntered).toBe(1)

      const row = data.sections.find((s: any) => s.section === section)
      expect(row).toBeTruthy()
      expect(row.totalCount).toBe(students.length)
      expect(row.registeredCount).toBe(6)
      expect(row.verifiedCount).toBe(3)
      expect(row.notRegisteredCount).toBe(students.length - 6)
    })

    test('recent registrations resolve real names and competition titles', async ({ request }) => {
      const res = await request.get('/api/advisor/summary')
      const { data } = await res.json()

      expect(data.recentRegistrations.length).toBe(6)
      for (const reg of data.recentRegistrations) {
        expect(reg.studentName).toBeTruthy()
        expect(reg.studentEmail).toContain('@')
        expect(reg.section).toBe(data.advisor.assignedSections[0])
        // Resolved from competition_dashboard, not echoed back as the raw id.
        expect(reg.competitionName).not.toBe(reg.competitionId)
        expect(reg.competitionName).not.toBe(FIXTURE_TAG)
        expect(['verified', 'pending', 'rejected']).toContain(reg.status)
      }
    })

    test('counts drop back to zero once registrations are removed', async ({ request }) => {
      await clearFixtureRegistrations()
      const { data } = await (await request.get('/api/advisor/summary')).json()

      expect(data.totals.registeredStudents).toBe(0)
      expect(data.totals.verifiedRegistrations).toBe(0)
      expect(data.totals.competitionsEntered).toBe(0)
      expect(data.recentRegistrations).toHaveLength(0)
      // Roster size is independent of registrations.
      expect(data.totals.totalStudents).toBeGreaterThan(0)
    })
  })
})

test.describe('advisor dashboard UI', () => {
  test.describe('signed in as the mapped advisor', () => {
    test.use({ storageState: 'e2e/.auth/advisor.json' })

    test('renders real totals rather than zeroes or placeholders', async ({ page }) => {
      await clearFixtureRegistrations()
      const advisor = await getAdvisor(ADVISOR.email)
      const section = (advisor.assigned_sections ?? [])[0]!
      const students = await getStudentsInSection(section, YEAR_LABEL)
      const competition = await findCompetitionForYear('III')

      await seedRegistrations(competition!.id, [
        { student: students[0], status: 'verified' },
        { student: students[1], status: 'pending' },
      ])

      await page.goto('/dashboard')

      // Advisor identity, not a generic title.
      await expect(page.getByRole('heading', { name: 'Advisor Dashboard' })).toBeVisible()
      const identity = page.getByTestId('advisor-identity')
      await expect(identity).toContainText(advisor.name)
      await expect(identity).toContainText(`Section ${section}`)
      await expect(identity).toContainText(YEAR_LABEL)

      const summary = page.getByTestId('advisor-section-summary')
      await expect(summary).toBeVisible()

      const sectionRow = page.getByTestId(`advisor-summary-section-${section}`)
      await expect(sectionRow).toBeVisible()
      await expect(sectionRow).toContainText(String(students.length))
      // 2 registered of the section total.
      await expect(sectionRow).toContainText('2')

      // The old dashboard hardcoded 45 assigned students and a "2.4h" response
      // time; neither may reappear.
      const body = await page.locator('main').innerText()
      expect(body).not.toContain('2.4h')

      const recent = page.getByTestId('advisor-recent-registrations')
      await expect(recent).toBeVisible()
      await expect(page.getByTestId('advisor-recent-row')).toHaveCount(2)
      await expect(recent).toContainText(students[0].name)
      await expect(recent).toContainText(competition!.competition_name)
      // The fixture marker must never surface in the UI.
      await expect(recent).not.toContainText(FIXTURE_TAG)
    })

    test('a recent registration links through to the competition', async ({ page }) => {
      // Self-contained: never rely on rows a sibling test happened to leave.
      await clearFixtureRegistrations()
      const advisor = await getAdvisor(ADVISOR.email)
      const students = await getStudentsInSection((advisor.assigned_sections ?? [])[0]!, YEAR_LABEL)
      const competition = await findCompetitionForYear('III')
      await seedRegistrations(competition!.id, [{ student: students[0], status: 'verified' }])

      await page.goto('/dashboard')
      await page.getByTestId('advisor-recent-row').first().waitFor()

      await page
        .getByTestId('advisor-recent-row')
        .first()
        .getByRole('link')
        .click()
      await expect(page).toHaveURL(new RegExp(`/competitions/${competition!.id}`))
      // Lands on the roster for the same advisor.
      await expect(page.getByTestId('advisor-roster-panel')).toBeVisible()
    })

    test('shows an explicit empty state instead of a blank card', async ({ page }) => {
      await clearFixtureRegistrations()
      await page.goto('/dashboard')

      const recent = page.getByTestId('advisor-recent-registrations')
      await expect(recent).toBeVisible()
      await expect(recent).toContainText(/none of your students have registered/i)
      await expect(page.getByTestId('advisor-recent-row')).toHaveCount(0)
    })

    test('polling the notification count does not error', async ({ page }) => {
      // This used to 400 on every page load because the header omits userId.
      const failures: string[] = []
      page.on('response', (r) => {
        if (r.url().includes('/api/notifications') && r.status() >= 400) {
          failures.push(`${r.status()} ${r.url()}`)
        }
      })
      await page.goto('/dashboard')
      await page.getByTestId('advisor-section-summary').waitFor()
      expect(failures).toEqual([])
    })
  })

  test.describe('signed in as a student', () => {
    test.use({ storageState: 'e2e/.auth/student.json' })

    test('does not get the advisor dashboard', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page.getByRole('heading', { name: 'Advisor Dashboard' })).toHaveCount(0)
      await expect(page.getByTestId('advisor-section-summary')).toHaveCount(0)
    })
  })
})

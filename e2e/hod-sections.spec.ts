import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  FIXTURE_TAG,
  assertDbEnv,
  clearFixtureRegistrations,
  findCompetitionForYear,
  findCompetitionAdmittingButExcluding,
  getStudentsInSection,
  seedRegistrations,
} from './helpers/db'

/**
 * HOD view of a competition: a department-wide, section-wise breakdown.
 *
 * Two regressions are pinned here:
 *  - HODs used to get the *advisor* roster, which resolves by session email.
 *    `hod@citchennai.net` has no `advisors` row, so the panel rendered
 *    "no advisor record is mapped to this account".
 *  - Section totals double-counted. A competition open to "I, II, III, IV"
 *    pulled in both storage conventions (bare 1st-year "A" and prefixed
 *    3rd-year "3%A"), and both normalize to "A", so section A reported 127
 *    students instead of 65.
 */

const YEAR_LABEL = '3rd Year'

/** Current API view of one section, used as the baseline for seeded deltas. */
async function sectionRow(request: APIRequestContext, competitionId: string, section: string) {
  const res = await request.get(`/api/competitions/${competitionId}/sections`)
  expect(res.ok(), 'sections API must answer before seeding').toBeTruthy()
  const row = (await res.json()).data.sections.find((s: any) => s.section === section)
  expect(row, `section ${section} missing from the sections API`).toBeTruthy()
  return row
}

test.beforeAll(assertDbEnv)
test.afterAll(clearFixtureRegistrations)

test.describe('sections API', () => {
  // The endpoint requires a session — an anonymous caller must not be able to
  // enumerate sections or competition ids. The anonymous case is asserted below
  // with its own context.
  test.use({ storageState: 'e2e/.auth/hod.json' })

  test('reports each section once, scoped to the cohort we hold data for', async ({ request }) => {
    const competition = await findCompetitionForYear('III')
    expect(competition).toBeTruthy()

    const res = await request.get(`/api/competitions/${competition!.id}/sections`)
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()

    // Only the active cohort, even though eligible_year lists all four years.
    expect(data.eligibleYears).toEqual([YEAR_LABEL])

    // Every section distinct, no duplicates from the two naming conventions.
    const labels = data.sections.map((s: any) => s.section)
    expect(new Set(labels).size).toBe(labels.length)

    // Bare labels only — never "3%A" or a doubled "33%A".
    for (const label of labels) {
      expect(label).not.toContain('%')
      expect(label).toMatch(/^[A-Z]+$|^Unassigned$/)
    }

    // Section size must match the real 3rd-year roster, not 1st + 3rd combined.
    const first = data.sections[0]
    const actual = await getStudentsInSection(first.section, YEAR_LABEL)
    expect(first.totalCount).toBe(actual.length)
    expect(first.registeredCount).toBeLessThanOrEqual(first.totalCount)
  })

  test('counts only registrations for the competition asked about', async ({ request }) => {
    await clearFixtureRegistrations()
    const competition = await findCompetitionForYear('III')
    const res0 = await request.get(`/api/competitions/${competition!.id}/sections`)
    const before = (await res0.json()).data.sections
    const section = before[0].section
    const students = await getStudentsInSection(section, YEAR_LABEL)

    // Seed students who are not registered yet. Reusing the first three by name
    // silently collided with existing registrations for the same students, and
    // a second row for one student is still one registration, so the count
    // never moved.
    const alreadyRegistered = new Set<string>(before[0].registered.map((r: any) => r.email))
    const fresh = students.filter((s) => !alreadyRegistered.has(s.email)).slice(0, 3)
    expect(fresh.length, 'need 3 unregistered students in the section').toBe(3)

    await seedRegistrations(competition!.id, [
      { student: fresh[0], status: 'verified' },
      { student: fresh[1], status: 'pending' },
      { student: fresh[2], status: 'rejected' },
    ])

    const res1 = await request.get(`/api/competitions/${competition!.id}/sections`)
    const after = (await res1.json()).data.sections.find((s: any) => s.section === section)

    // Measured as a delta, not an absolute: the section may already hold real
    // registrations for this competition, and asserting 3 would only pass on a
    // database where it happens to hold none.
    expect(after.registeredCount).toBe(before[0].registeredCount + 3)
    expect(after.totalCount).toBe(before[0].totalCount)
    expect(after.registered).toHaveLength(before[0].registeredCount + 3)
  })

  test('flags a competition that admits no cohort we hold data for', async ({ request }) => {
    // Admits 1st year but not 3rd — we only hold 3rd-year data.
    const competition = await findCompetitionAdmittingButExcluding('I', 'III')
    test.skip(!competition, 'no competition admits I while excluding III')

    const res = await request.get(`/api/competitions/${competition!.id}/sections`)
    const { data } = await res.json()
    expect(data.notEligible).toBe(true)
    expect(data.sections).toHaveLength(0)
  })

})

/**
 * Kept out of the authenticated describe above on purpose: a `test.use`
 * storageState propagates into `playwright.request.newContext()`, so a context
 * created inside that block is signed in and the endpoint answers 404 rather
 * than 401. Only a describe without a session proves the anonymous path.
 */
test.describe('sections API without a session', () => {
  test('rejects an unauthenticated caller before revealing whether a competition exists', async ({
    playwright,
    baseURL,
  }) => {
    // Asserting 404 here would mean the API confirms which competition ids are
    // real to anyone who asks — resource enumeration. Auth comes first.
    const ctx = await playwright.request.newContext({ baseURL })
    const res = await ctx.get('/api/competitions/does-not-exist/sections')
    expect(res.status()).toBe(401)
    await ctx.dispose()
  })
})

test.describe('HOD competition detail', () => {
  test.use({ storageState: 'e2e/.auth/hod.json' })

  test('shows the section grid, not the advisor "not mapped" error', async ({ page, request }) => {
    await clearFixtureRegistrations()
    const competition = await findCompetitionForYear('III')
    const students = await getStudentsInSection('B', YEAR_LABEL)

    // Section B may already hold real registrations, and seeding a student who
    // is already registered adds a row without changing the count. Take the
    // current count as the baseline and seed two students who are not in it.
    const before = await sectionRow(request, competition!.id, 'B')
    const already = new Set<string>(before.registered.map((r: any) => r.email))
    const fresh = students.filter((s) => !already.has(s.email)).slice(0, 2)
    expect(fresh.length, 'need 2 unregistered students in section B').toBe(2)
    const expectedRegistered = before.registeredCount + 2

    await seedRegistrations(
      competition!.id,
      fresh.map((student) => ({ student, status: 'verified' as const }))
    )

    await page.goto(`/competitions/${competition!.id}`)

    const panel = page.getByTestId('hod-sections-panel')
    await expect(panel).toBeVisible()

    // The bug this replaced.
    await expect(panel).not.toContainText(/no advisor record is mapped/i)
    await expect(page.getByTestId('advisor-roster-panel')).toHaveCount(0)

    await expect(page.getByTestId('hod-sections-scope')).toContainText(YEAR_LABEL)

    const cards = page.locator('[data-testid^="hod-section-card-"]')
    await expect(cards.first()).toBeVisible()
    const cardCount = await cards.count()
    expect(cardCount).toBeGreaterThan(1)

    // Card counts must be per-cohort, not doubled.
    const sectionB = page.getByTestId('hod-section-card-B')
    await expect(sectionB).toContainText(`${students.length} students`)
    await expect(sectionB).toContainText(`${expectedRegistered} registered`)

    // Only the label may be checked for a storage prefix — the card body
    // legitimately contains a coverage percentage such as "0%".
    for (const label of await page.getByTestId('hod-section-label').allInnerTexts()) {
      expect(label).not.toContain('%')
      expect(label).toMatch(/^[A-Z]+$|^Unassigned$/)
    }
  })

  test('drilling into a section lists its registered students', async ({ page, request }) => {
    await clearFixtureRegistrations()
    const competition = await findCompetitionForYear('III')
    const students = await getStudentsInSection('B', YEAR_LABEL)

    const before = await sectionRow(request, competition!.id, 'B')
    const already = new Set<string>(before.registered.map((r: any) => r.email))
    const fresh = students.filter((s) => !already.has(s.email)).slice(0, 2)
    expect(fresh.length, 'need 2 unregistered students in section B').toBe(2)
    const expectedRows = before.registeredCount + 2

    await seedRegistrations(
      competition!.id,
      fresh.map((student) => ({ student, status: 'verified' as const }))
    )

    await page.goto(`/competitions/${competition!.id}`)
    await page.getByTestId('hod-sections-panel').waitFor()

    await page.getByTestId('hod-section-card-B').click()

    await expect(page.getByRole('heading', { name: /Section B/i })).toBeVisible()
    await expect(page.getByTestId('hod-section-student-row')).toHaveCount(expectedRows)
    // The fixture marker must never reach the UI.
    await expect(page.getByTestId('hod-sections-panel')).not.toContainText(FIXTURE_TAG)

    await page.getByRole('button', { name: /back to all sections/i }).click()
    await expect(page.locator('[data-testid^="hod-section-card-"]').first()).toBeVisible()
  })

  test('a section with no registrations says so explicitly', async ({ page, request }) => {
    await clearFixtureRegistrations()
    const competition = await findCompetitionForYear('III')

    // Whichever section is genuinely empty — hardcoding "A" only held while no
    // real registrations existed for it.
    const res = await request.get(`/api/competitions/${competition!.id}/sections`)
    const empty = (await res.json()).data.sections.find((s: any) => s.registeredCount === 0)
    test.skip(!empty, 'every section already has registrations')

    await page.goto(`/competitions/${competition!.id}`)
    await page.getByTestId('hod-sections-panel').waitFor()

    await page.getByTestId(`hod-section-card-${empty.section}`).click()
    await expect(page.getByTestId('hod-sections-panel')).toContainText(
      /has registered for this competition yet/i
    )
  })
})

test.describe('leaderboard section labels', () => {
  test.use({ storageState: 'e2e/.auth/hod.json' })

  test('are bare letters, never "33%A" or a phantom "2A"', async ({ page }) => {
    const failures: string[] = []
    page.on('response', (r) => {
      if (r.url().includes('/api/leaderboard') && r.status() >= 400) {
        failures.push(`${r.status()} ${r.url()}`)
      }
    })

    await page.goto('/leaderboard')
    await page.getByRole('button', { name: /Section-wise/i }).click()

    const labels = page.locator('div.grid p.text-base.font-bold')
    await expect(labels.first()).toBeVisible({ timeout: 30_000 })

    for (const text of await labels.allInnerTexts()) {
      // "33%A" came from prepending a year digit onto an already-prefixed
      // section; "2A" was a 1st-year student mislabelled as 2nd year.
      expect(text).not.toContain('%')
      expect(text).not.toMatch(/^2[A-R]$/)
      expect(text).toMatch(/^[A-Z]+$/)
    }

    // The hook used to fall through to a non-existent /api/leaderboard route on
    // first render, before the Supabase client was registered.
    expect(failures).toEqual([])
  })
})

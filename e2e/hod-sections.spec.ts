import { test, expect } from '@playwright/test'
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

test.beforeAll(assertDbEnv)
test.afterAll(clearFixtureRegistrations)

test.describe('sections API', () => {
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

    await seedRegistrations(competition!.id, [
      { student: students[0], status: 'verified' },
      { student: students[1], status: 'pending' },
      { student: students[2], status: 'rejected' },
    ])

    const res1 = await request.get(`/api/competitions/${competition!.id}/sections`)
    const after = (await res1.json()).data.sections.find((s: any) => s.section === section)

    // All three count as "registered"; totals are unaffected by registrations.
    expect(after.registeredCount).toBe(3)
    expect(after.totalCount).toBe(before[0].totalCount)
    expect(after.registered).toHaveLength(3)
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

  test('404s for an unknown competition', async ({ request }) => {
    const res = await request.get('/api/competitions/does-not-exist/sections')
    expect(res.status()).toBe(404)
  })
})

test.describe('HOD competition detail', () => {
  test.use({ storageState: 'e2e/.auth/hod.json' })

  test('shows the section grid, not the advisor "not mapped" error', async ({ page }) => {
    await clearFixtureRegistrations()
    const competition = await findCompetitionForYear('III')
    const students = await getStudentsInSection('B', YEAR_LABEL)
    await seedRegistrations(competition!.id, [
      { student: students[0], status: 'verified' },
      { student: students[1], status: 'verified' },
    ])

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
    await expect(sectionB).toContainText('2 registered')

    // Only the label may be checked for a storage prefix — the card body
    // legitimately contains a coverage percentage such as "0%".
    for (const label of await page.getByTestId('hod-section-label').allInnerTexts()) {
      expect(label).not.toContain('%')
      expect(label).toMatch(/^[A-Z]+$|^Unassigned$/)
    }
  })

  test('drilling into a section lists its registered students', async ({ page }) => {
    await clearFixtureRegistrations()
    const competition = await findCompetitionForYear('III')
    const students = await getStudentsInSection('B', YEAR_LABEL)
    await seedRegistrations(competition!.id, [
      { student: students[0], status: 'verified' },
      { student: students[1], status: 'verified' },
    ])

    await page.goto(`/competitions/${competition!.id}`)
    await page.getByTestId('hod-sections-panel').waitFor()

    await page.getByTestId('hod-section-card-B').click()

    await expect(page.getByRole('heading', { name: /Section B/i })).toBeVisible()
    await expect(page.getByTestId('hod-section-student-row')).toHaveCount(2)
    // The fixture marker must never reach the UI.
    await expect(page.getByTestId('hod-sections-panel')).not.toContainText(FIXTURE_TAG)

    await page.getByRole('button', { name: /back to all sections/i }).click()
    await expect(page.locator('[data-testid^="hod-section-card-"]').first()).toBeVisible()
  })

  test('a section with no registrations says so explicitly', async ({ page }) => {
    await clearFixtureRegistrations()
    const competition = await findCompetitionForYear('III')
    await page.goto(`/competitions/${competition!.id}`)
    await page.getByTestId('hod-sections-panel').waitFor()

    // Section A has no seeded rows in this spec.
    await page.getByTestId('hod-section-card-A').click()
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

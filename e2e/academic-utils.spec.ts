import { test, expect } from '@playwright/test'
import {
  normalizeSection,
  sectionYearNumber,
  toStoredSection,
  storedSectionVariants,
  sectionMatches,
  parseEligibleYears,
  parseYearToken,
  yearNumberToLabel,
} from '../packages/utils/src/academic'

/**
 * The advisor→student join was silently empty because these two vocabularies
 * never met. These cases pin the translation both ways.
 */

test.describe('normalizeSection', () => {
  test('strips the stored year prefix', () => {
    expect(normalizeSection('3%A')).toBe('A')
    expect(normalizeSection('3%Q')).toBe('Q')
    expect(normalizeSection('4%B')).toBe('B')
  })

  test('leaves bare labels untouched and normalizes case/whitespace', () => {
    expect(normalizeSection('A')).toBe('A')
    expect(normalizeSection(' 3 % b ')).toBe('B')
    expect(normalizeSection('r')).toBe('R')
  })

  test('returns empty string for missing values instead of throwing', () => {
    expect(normalizeSection(null)).toBe('')
    expect(normalizeSection(undefined)).toBe('')
    expect(normalizeSection('')).toBe('')
  })

  test('does not mangle a literal percent that is not a year prefix', () => {
    expect(normalizeSection('A%3')).toBe('A%3')
  })
})

test.describe('sectionYearNumber', () => {
  test('reads the encoded year', () => {
    expect(sectionYearNumber('3%A')).toBe(3)
    expect(sectionYearNumber('1%A')).toBe(1)
  })
  test('is null for bare labels', () => {
    expect(sectionYearNumber('A')).toBeNull()
    expect(sectionYearNumber(null)).toBeNull()
  })
})

test.describe('toStoredSection', () => {
  test('prefixes non-first years, matching how students.section is stored', () => {
    expect(toStoredSection('A', 3)).toBe('3%A')
    expect(toStoredSection('q', 3)).toBe('3%Q')
  })

  test('leaves 1st year bare — prefixing it would match nothing', () => {
    expect(toStoredSection('A', 1)).toBe('A')
    expect(toStoredSection('A', null)).toBe('A')
  })
})

test.describe('storedSectionVariants', () => {
  test('covers both storage conventions for an .in() query', () => {
    expect(storedSectionVariants('P')).toEqual(['P', '1%P', '2%P', '3%P', '4%P'])
  })
  test('is empty for a blank section', () => {
    expect(storedSectionVariants('')).toEqual([])
  })
})

test.describe('sectionMatches', () => {
  test('matches an advisor bare label against a stored student label', () => {
    expect(sectionMatches('P', '3%P')).toBe(true)
    expect(sectionMatches('a', '3%A')).toBe(true)
  })

  test('does not match different sections', () => {
    expect(sectionMatches('P', '3%Q')).toBe(false)
  })

  test('never matches on empty input', () => {
    expect(sectionMatches('', '3%A')).toBe(false)
    expect(sectionMatches('A', null)).toBe(false)
  })

  test('1st-year A and 3rd-year A normalize alike, so year must be filtered separately', () => {
    // Both are section "A" — this collision is why the roster query also
    // constrains `year`. Documented here so the behaviour is intentional.
    expect(normalizeSection('A')).toBe(normalizeSection('3%A'))
  })
})

test.describe('parseYearToken', () => {
  test('accepts Roman numerals as used by eligible_year', () => {
    expect(parseYearToken('I')).toBe(1)
    expect(parseYearToken('III')).toBe(3)
    expect(parseYearToken('IV')).toBe(4)
  })

  test('accepts ordinal labels and bare digits', () => {
    expect(parseYearToken('3rd Year')).toBe(3)
    expect(parseYearToken('2nd')).toBe(2)
    expect(parseYearToken('4')).toBe(4)
    expect(parseYearToken('third')).toBe(3)
  })

  test('rejects the free text that also appears in eligible_year', () => {
    expect(parseYearToken('StartUp')).toBeNull()
    expect(parseYearToken('MSME')).toBeNull()
    expect(parseYearToken('Startups')).toBeNull()
    expect(parseYearToken('')).toBeNull()
  })
})

test.describe('parseEligibleYears', () => {
  test('maps a Roman list to students.year labels', () => {
    const r = parseEligibleYears('I, II, III, IV')
    expect(r.yearNumbers).toEqual([1, 2, 3, 4])
    expect(r.yearLabels).toEqual(['1st Year', '2nd Year', '3rd Year', '4th Year'])
    expect(r.openToAllYears).toBe(false)
  })

  test('handles the missing-space variant seen in live data', () => {
    expect(parseEligibleYears('I,II, III, IV').yearNumbers).toEqual([1, 2, 3, 4])
  })

  test('handles a restricted list', () => {
    const r = parseEligibleYears('III, IV')
    expect(r.yearNumbers).toEqual([3, 4])
    expect(r.yearLabels).toEqual(['3rd Year', '4th Year'])
  })

  test('treats pure free text as open to all years, not open to none', () => {
    // Returning [] here would render these competitions as having zero
    // eligible students, which is the bug this guards against.
    const r = parseEligibleYears('Startups, MSME')
    expect(r.yearNumbers).toEqual([])
    expect(r.openToAllYears).toBe(true)
    expect(r.unparsedTokens).toEqual(['Startups', 'MSME'])
  })

  test('treats blank and null as open to all years', () => {
    expect(parseEligibleYears('').openToAllYears).toBe(true)
    expect(parseEligibleYears(null).openToAllYears).toBe(true)
    expect(parseEligibleYears(undefined).openToAllYears).toBe(true)
  })

  test('parses the lone ordinal value present in live data', () => {
    expect(parseEligibleYears('2nd Year').yearNumbers).toEqual([2])
  })

  test('de-duplicates and sorts', () => {
    expect(parseEligibleYears('IV, III, IV').yearNumbers).toEqual([3, 4])
  })
})

test.describe('yearNumberToLabel', () => {
  test('produces the exact labels used in students.year', () => {
    expect(yearNumberToLabel(1)).toBe('1st Year')
    expect(yearNumberToLabel(2)).toBe('2nd Year')
    expect(yearNumberToLabel(3)).toBe('3rd Year')
    expect(yearNumberToLabel(4)).toBe('4th Year')
  })
})

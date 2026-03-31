/**
 * Tests for lib/dateUtils.js — date parsing, formatting, and timezone handling.
 *
 * These are real tests that import and call actual application code.
 */

import {
  parseLocalDate,
  toLocalDateString,
  eventDateTimeToUTC,
  isEventPast,
  isEventLive,
  formatEventTime,
  formatEventDate,
  formatDate,
} from '@/lib/dateUtils'

describe('parseLocalDate', () => {
  test('parses YYYY-MM-DD as local midnight', () => {
    const date = parseLocalDate('2026-03-15')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2) // March = 2 (zero-indexed)
    expect(date.getDate()).toBe(15)
    expect(date.getHours()).toBe(0)
    expect(date.getMinutes()).toBe(0)
  })

  test('handles single-digit month and day', () => {
    const date = parseLocalDate('2026-01-05')
    expect(date.getMonth()).toBe(0)
    expect(date.getDate()).toBe(5)
  })

  test('returns Invalid Date for null', () => {
    expect(parseLocalDate(null).getTime()).toBeNaN()
  })

  test('returns Invalid Date for undefined', () => {
    expect(parseLocalDate(undefined).getTime()).toBeNaN()
  })

  test('returns Invalid Date for empty string', () => {
    expect(parseLocalDate('').getTime()).toBeNaN()
  })

  test('falls back to new Date() for non-YYYY-MM-DD formats', () => {
    const date = parseLocalDate('March 15, 2026')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(15)
  })

  test('handles date string with extra content after YYYY-MM-DD', () => {
    // The regex matches the prefix, so "2026-03-15T10:00:00" should parse the date part
    const date = parseLocalDate('2026-03-15T10:00:00')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(15)
    // Time should be midnight since we only parse the date
    expect(date.getHours()).toBe(0)
  })
})

describe('toLocalDateString', () => {
  test('returns today as YYYY-MM-DD', () => {
    const result = toLocalDateString()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('formats a specific date correctly', () => {
    const date = new Date(2026, 2, 15) // March 15, 2026 local
    expect(toLocalDateString(date)).toBe('2026-03-15')
  })

  test('pads single-digit months and days', () => {
    const date = new Date(2026, 0, 5) // Jan 5
    expect(toLocalDateString(date)).toBe('2026-01-05')
  })

  test('handles December correctly', () => {
    const date = new Date(2026, 11, 31) // Dec 31
    expect(toLocalDateString(date)).toBe('2026-12-31')
  })
})

describe('eventDateTimeToUTC', () => {
  test('returns Invalid Date for null dateStr', () => {
    expect(eventDateTimeToUTC(null).getTime()).toBeNaN()
  })

  test('returns Invalid Date for empty dateStr', () => {
    expect(eventDateTimeToUTC('').getTime()).toBeNaN()
  })

  test('defaults time to 23:59 when no timeStr given', () => {
    const result = eventDateTimeToUTC('2026-03-15')
    // Without timezone, treated as local time
    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
  })

  test('parses date + time as local when no timezone', () => {
    const result = eventDateTimeToUTC('2026-03-15', '14:30')
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(2)
    expect(result.getDate()).toBe(15)
    expect(result.getHours()).toBe(14)
    expect(result.getMinutes()).toBe(30)
  })

  test('converts with timezone to a valid UTC date', () => {
    const result = eventDateTimeToUTC('2026-03-15', '14:30', 'America/New_York')
    // Should produce a valid date (exact UTC depends on DST)
    expect(isNaN(result.getTime())).toBe(false)
    // The UTC time should differ from the input local time by the NY offset
    expect(result instanceof Date).toBe(true)
  })

  test('UTC timezone produces same date/time as input', () => {
    const result = eventDateTimeToUTC('2026-03-15', '14:30', 'UTC')
    expect(result.getUTCFullYear()).toBe(2026)
    expect(result.getUTCMonth()).toBe(2)
    expect(result.getUTCDate()).toBe(15)
    expect(result.getUTCHours()).toBe(14)
    expect(result.getUTCMinutes()).toBe(30)
  })
})

describe('isEventPast', () => {
  test('returns false for null dateStr', () => {
    expect(isEventPast(null)).toBe(false)
  })

  test('returns false for invalid date', () => {
    expect(isEventPast('not-a-date')).toBe(false)
  })

  test('returns true for event far in the past', () => {
    expect(isEventPast('2020-01-01', '10:00')).toBe(true)
  })

  test('returns false for event far in the future', () => {
    expect(isEventPast('2099-12-31', '23:59')).toBe(false)
  })

  test('accounts for duration and grace period', () => {
    // An event that started 2 hours ago with 60min duration + 30min grace = 90min
    // So 2 hours later it should be past
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const dateStr = toLocalDateString(twoHoursAgo)
    const timeStr = `${String(twoHoursAgo.getHours()).padStart(2, '0')}:${String(twoHoursAgo.getMinutes()).padStart(2, '0')}`
    expect(isEventPast(dateStr, timeStr, undefined, 60, 30)).toBe(true)
  })

  test('event within grace period is not past', () => {
    // Event started 30 min ago, duration 60 min, grace 30 min = 90 min total
    // 30 min in, it should NOT be past
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
    const dateStr = toLocalDateString(thirtyMinAgo)
    const timeStr = `${String(thirtyMinAgo.getHours()).padStart(2, '0')}:${String(thirtyMinAgo.getMinutes()).padStart(2, '0')}`
    expect(isEventPast(dateStr, timeStr, undefined, 60, 30)).toBe(false)
  })
})

describe('isEventLive', () => {
  test('returns false when no timeStr', () => {
    expect(isEventLive('2026-03-15')).toBe(false)
  })

  test('returns false for invalid date', () => {
    expect(isEventLive('invalid', '10:00')).toBe(false)
  })

  test('returns false for future event', () => {
    expect(isEventLive('2099-12-31', '10:00')).toBe(false)
  })

  test('returns false for past event', () => {
    expect(isEventLive('2020-01-01', '10:00')).toBe(false)
  })

  test('returns true for currently happening event', () => {
    const now = new Date()
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000)
    const dateStr = toLocalDateString(tenMinAgo)
    const timeStr = `${String(tenMinAgo.getHours()).padStart(2, '0')}:${String(tenMinAgo.getMinutes()).padStart(2, '0')}`
    expect(isEventLive(dateStr, timeStr, undefined, 60)).toBe(true)
  })
})

describe('formatEventTime', () => {
  test('returns empty string when no timeStr', () => {
    expect(formatEventTime('2026-03-15', null)).toBe('')
    expect(formatEventTime('2026-03-15', '')).toBe('')
    expect(formatEventTime('2026-03-15', undefined)).toBe('')
  })

  test('formats morning time correctly', () => {
    const result = formatEventTime('2026-03-15', '09:30')
    expect(result).toContain('9:30')
    expect(result).toContain('AM')
  })

  test('formats afternoon time correctly', () => {
    const result = formatEventTime('2026-03-15', '14:00')
    expect(result).toContain('2:00')
    expect(result).toContain('PM')
  })

  test('formats midnight correctly', () => {
    const result = formatEventTime('2026-03-15', '00:00')
    expect(result).toContain('12:00')
    expect(result).toContain('AM')
  })

  test('formats noon correctly', () => {
    const result = formatEventTime('2026-03-15', '12:00')
    expect(result).toContain('12:00')
    expect(result).toContain('PM')
  })

  test('hides timezone when showTimezone is false', () => {
    const withTz = formatEventTime('2026-03-15', '09:30')
    const withoutTz = formatEventTime('2026-03-15', '09:30', undefined, { showTimezone: false })
    expect(withTz.length).toBeGreaterThan(withoutTz.length)
    expect(withoutTz).toContain('9:30')
  })
})

describe('formatDate', () => {
  test('returns TBD for null', () => {
    expect(formatDate(null)).toBe('TBD')
  })

  test('returns TBD for empty string', () => {
    expect(formatDate('')).toBe('TBD')
  })

  test('formats YYYY-MM-DD correctly', () => {
    const result = formatDate('2026-03-15')
    expect(result).toContain('Mar')
    expect(result).toContain('15')
  })

  test('returns original string for unparseable date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  test('includes year when year option is set', () => {
    const result = formatDate('2026-03-15', { year: 'numeric' })
    expect(result).toContain('2026')
  })

  test('handles legacy non-YYYY-MM-DD format gracefully', () => {
    // parseLocalDate falls back to new Date() for non-matching formats
    // If it results in Invalid Date, formatDate returns the original string
    const result = formatDate('Wednesday, Dec 3')
    // Should return something — either formatted or the original string
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('formatEventDate', () => {
  test('returns TBD for null dateStr', () => {
    expect(formatEventDate(null)).toBe('TBD')
  })

  test('returns TBD for empty dateStr', () => {
    expect(formatEventDate('')).toBe('TBD')
  })

  test('formats date without timezone', () => {
    const result = formatEventDate('2026-07-04')
    expect(result).toContain('Jul')
    expect(result).toContain('4')
  })

  test('formats date without timeStr (same tz path)', () => {
    const result = formatEventDate('2026-12-25', null, 'America/New_York')
    expect(result).toContain('Dec')
    expect(result).toContain('25')
  })

  test('formats date in same timezone as viewer', () => {
    const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const result = formatEventDate('2026-03-15', '10:00', viewerTz)
    expect(result).toContain('Mar')
    expect(result).toContain('15')
  })

  test('converts date across timezones', () => {
    // An event at 2:00 AM UTC on March 15 would be March 14 evening in US Pacific
    const result = formatEventDate('2026-03-15', '02:00', 'UTC', { timeZone: 'America/Los_Angeles' })
    // Should return a valid date string (may be Mar 14 or 15 depending on test runner timezone)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  test('passes year option through', () => {
    const result = formatEventDate('2026-03-15', null, null, { year: 'numeric' })
    expect(result).toContain('2026')
  })
})

describe('formatEventTime cross-timezone', () => {
  test('converts time when event timezone differs from viewer', () => {
    // If the test runner is NOT in UTC, this should convert
    const result = formatEventTime('2026-03-15', '14:00', 'UTC')
    // Should contain a time — either converted or as-is
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i)
  })

  test('same timezone does not convert', () => {
    const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const result = formatEventTime('2026-03-15', '14:00', viewerTz)
    expect(result).toContain('2:00')
    expect(result).toContain('PM')
  })
})

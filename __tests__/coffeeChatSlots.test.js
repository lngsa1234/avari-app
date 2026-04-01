/**
 * Tests for lib/coffeeChatSlots.js — coffee chat availability formatting.
 */

import { DAYS, TIMES, formatCoffeeSlots, getDayLabel, getTimeLabel } from '@/lib/coffeeChatSlots'

describe('DAYS and TIMES constants', () => {
  test('DAYS has 7 entries', () => {
    expect(DAYS).toHaveLength(7)
    expect(DAYS).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })

  test('TIMES has 4 entries', () => {
    expect(TIMES).toHaveLength(4)
    expect(TIMES).toEqual(['morning', 'afternoon', 'evening', 'night'])
  })
})

describe('getDayLabel', () => {
  test('returns label for known days', () => {
    expect(getDayLabel('mon')).toBe('Mon')
    expect(getDayLabel('fri')).toBe('Fri')
    expect(getDayLabel('sun')).toBe('Sun')
  })

  test('returns input for unknown days', () => {
    expect(getDayLabel('xyz')).toBe('xyz')
  })
})

describe('getTimeLabel', () => {
  test('returns label for known times', () => {
    expect(getTimeLabel('morning')).toBe('Mornings (8-12)')
    expect(getTimeLabel('evening')).toBe('Evenings (5-8)')
  })

  test('returns input for unknown times', () => {
    expect(getTimeLabel('dawn')).toBe('dawn')
  })
})

describe('formatCoffeeSlots', () => {
  test('returns null for empty slots', () => {
    expect(formatCoffeeSlots(null)).toBeNull()
    expect(formatCoffeeSlots({})).toBeNull()
    expect(formatCoffeeSlots({ days: [], times: [] })).toBeNull()
  })

  test('formats days only', () => {
    expect(formatCoffeeSlots({ days: ['mon', 'wed'], times: [] })).toBe('Mon, Wed')
  })

  test('formats times only', () => {
    expect(formatCoffeeSlots({ days: [], times: ['morning', 'evening'] })).toBe('Mornings (8-12) & Evenings (5-8)')
  })

  test('formats days and times together', () => {
    const result = formatCoffeeSlots({ days: ['tue'], times: ['afternoon'] })
    expect(result).toBe('Tue · Afternoons (12-5)')
  })

  test('uses short labels when short=true', () => {
    const result = formatCoffeeSlots({ days: ['mon'], times: ['morning'] }, true)
    expect(result).toBe('Mon · Mornings')
  })

  test('full labels when short=false', () => {
    const result = formatCoffeeSlots({ days: ['mon'], times: ['morning'] }, false)
    expect(result).toBe('Mon · Mornings (8-12)')
  })
})

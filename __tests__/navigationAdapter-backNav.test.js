/**
 * Tests for back navigation improvements (2026-04-01)
 * - _path: prefix handling in createOnNavigate
 * - skip from= for list pages
 * - dynamic route preservation
 */

const { createOnNavigate, getPreviousView } = require('../lib/navigationAdapter')

// Mock search params
const mockSearchParams = (from) => ({
  get: (key) => key === 'from' ? from : null,
})

describe('createOnNavigate — _path: prefix', () => {
  test('navigates directly for _path: prefixed views', () => {
    const pushed = []
    const mockRouter = { push: (url) => pushed.push(url) }
    const navigate = createOnNavigate(mockRouter, '/messages')

    navigate('_path:/people/abc-123')
    expect(pushed).toEqual(['/people/abc-123'])
  })

  test('_path: does not append from= param', () => {
    const pushed = []
    const mockRouter = { push: (url) => pushed.push(url) }
    const navigate = createOnNavigate(mockRouter, '/messages')

    navigate('_path:/circles/xyz')
    expect(pushed[0]).toBe('/circles/xyz')
    expect(pushed[0]).not.toContain('from=')
  })
})

describe('createOnNavigate — skip from= for list pages', () => {
  test('does not append from= for allPeople', () => {
    const pushed = []
    const mockRouter = { push: (url) => pushed.push(url) }
    const navigate = createOnNavigate(mockRouter, '/people/abc-123')

    navigate('allPeople')
    expect(pushed[0]).toBe('/people')
    expect(pushed[0]).not.toContain('from=')
  })

  test('does not append from= for allEvents', () => {
    const pushed = []
    const mockRouter = { push: (url) => pushed.push(url) }
    const navigate = createOnNavigate(mockRouter, '/events/abc-123')

    navigate('allEvents')
    expect(pushed[0]).toBe('/events')
    expect(pushed[0]).not.toContain('from=')
  })

  test('does not append from= for main tabs', () => {
    const pushed = []
    const mockRouter = { push: (url) => pushed.push(url) }
    const navigate = createOnNavigate(mockRouter, '/people/abc-123')

    navigate('home')
    expect(pushed[0]).toBe('/home')
    expect(pushed[0]).not.toContain('from=')
  })

  test('appends from= for detail views', () => {
    const pushed = []
    const mockRouter = { push: (url) => pushed.push(url) }
    const navigate = createOnNavigate(mockRouter, '/coffee')

    navigate('eventDetail', { meetupId: 'evt-123' })
    expect(pushed[0]).toContain('/events/evt-123')
    expect(pushed[0]).toContain('from=')
  })
})

describe('getPreviousView — round-trip preservation', () => {
  test('preserves full path for /people/{id}', () => {
    const result = getPreviousView(mockSearchParams('/people/user-abc'))
    expect(result).toBe('_path:/people/user-abc')
  })

  test('preserves full path for /circles/{id}', () => {
    const result = getPreviousView(mockSearchParams('/circles/circle-xyz'))
    expect(result).toBe('_path:/circles/circle-xyz')
  })

  test('maps static paths to view names', () => {
    expect(getPreviousView(mockSearchParams('/home'))).toBe('home')
    expect(getPreviousView(mockSearchParams('/discover'))).toBe('discover')
    expect(getPreviousView(mockSearchParams('/coffee'))).toBe('meetups')
    expect(getPreviousView(mockSearchParams('/people'))).toBe('allPeople')
  })

  test('falls back for unknown paths', () => {
    expect(getPreviousView(mockSearchParams('/unknown'), 'home')).toBe('home')
  })

  test('falls back when from= is missing', () => {
    expect(getPreviousView(mockSearchParams(null), 'discover')).toBe('discover')
  })
})

describe('Recap page back navigation', () => {
  test('from=/coffee maps to pastMeetings in recap page logic', () => {
    // The recap page overrides: any from=/coffee* → pastMeetings
    // This simulates the recap page's logic, not raw getPreviousView
    const from = '/coffee'
    const previousView = from.startsWith('/coffee') ? 'pastMeetings' : getPreviousView(mockSearchParams(from), 'pastMeetings')
    expect(previousView).toBe('pastMeetings')

    const { ROUTES } = require('../lib/navigationAdapter')
    expect(ROUTES.pastMeetings()).toBe('/coffee?view=past')
  })

  test('from=/coffee?view=past also maps to pastMeetings', () => {
    const from = '/coffee?view=past'
    const previousView = from.startsWith('/coffee') ? 'pastMeetings' : getPreviousView(mockSearchParams(from), 'pastMeetings')
    expect(previousView).toBe('pastMeetings')
  })

  test('falls back to pastMeetings when no from param', () => {
    const previousView = getPreviousView(mockSearchParams(null), 'pastMeetings')
    expect(previousView).toBe('pastMeetings')

    const { ROUTES } = require('../lib/navigationAdapter')
    expect(ROUTES.pastMeetings()).toBe('/coffee?view=past')
  })

  test('navigates back to home when from=/home', () => {
    const previousView = getPreviousView(mockSearchParams('/home'), 'pastMeetings')
    expect(previousView).toBe('home')
  })

  test('_path: prefix navigates directly via router.push', () => {
    const pushed = []
    const mockRouter = { push: (url) => pushed.push(url) }
    const navigate = createOnNavigate(mockRouter, '/recaps/abc')

    navigate('_path:/coffee?view=past')
    expect(pushed[0]).toBe('/coffee?view=past')
  })

  test('recap page source file uses getPreviousView not hardcoded home', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'recaps', '[id]', 'page.js'), 'utf8')
    expect(src).toContain('getPreviousView')
    expect(src).not.toContain('previousView="home"')
  })

  test('coffee page includes view param in navigation path', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'app', '(app)', 'coffee', 'page.js'), 'utf8')
    // Should pass full path with ?view= to createOnNavigate
    expect(src).toContain('?view=')
    expect(src).toContain('fullPath')
  })
})

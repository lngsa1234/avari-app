/**
 * Username resolution tests for /people/[id] page.
 *
 * Verify that the people profile page correctly handles both UUID and
 * username-based routing, including regex validation, Supabase lookup,
 * and redirect on not-found.
 *
 * @jest-environment node
 */

const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(
  path.join(__dirname, '..', 'app', '(app)', 'people', '[id]', 'page.js'),
  'utf8'
)

describe('UUID_RE regex', () => {
  // Extract the regex from source so we can test it directly
  const match = source.match(/const UUID_RE = (\/.*\/[a-z]*)/)
  const UUID_RE = match ? eval(match[1]) : null

  test('regex is defined in source', () => {
    expect(source).toMatch(/const UUID_RE/)
  })

  test('matches a valid UUID v4', () => {
    expect(UUID_RE).not.toBeNull()
    expect(UUID_RE.test('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true)
  })

  test('matches uppercase UUIDs (case-insensitive flag)', () => {
    expect(UUID_RE.test('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true)
  })

  test('rejects plain usernames', () => {
    expect(UUID_RE.test('lynn.wang')).toBe(false)
    expect(UUID_RE.test('alice')).toBe(false)
    expect(UUID_RE.test('john-doe')).toBe(false)
  })

  test('rejects partial UUIDs', () => {
    expect(UUID_RE.test('a1b2c3d4-e5f6')).toBe(false)
    expect(UUID_RE.test('a1b2c3d4')).toBe(false)
  })
})

describe('People [id] page imports', () => {
  test('imports useAuth from AuthProvider', () => {
    expect(source).toMatch(/import.*useAuth.*from.*AuthProvider/)
  })

  test('imports supabase client', () => {
    expect(source).toMatch(/import.*supabase.*from/)
  })
})

describe('Username lookup', () => {
  test('queries profiles table with .eq("username", ...)', () => {
    expect(source).toMatch(/\.from\(['"]profiles['"]\)/)
    expect(source).toMatch(/\.eq\(['"]username['"]/)
  })

  test('lowercases the username before lookup', () => {
    expect(source).toMatch(/id\.toLowerCase\(\)/)
  })

  test('uses maybeSingle for username query', () => {
    expect(source).toMatch(/\.maybeSingle\(\)/)
  })
})

describe('Username not found handling', () => {
  test('redirects to /people when username is not found', () => {
    expect(source).toMatch(/router\.replace\(['"]\/people['"]\)/)
  })
})

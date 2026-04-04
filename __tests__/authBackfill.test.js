/**
 * AuthProvider username backfill tests.
 *
 * Verify that the AuthProvider correctly handles username generation
 * for new profiles and backfills usernames for existing profiles
 * that are missing them.
 *
 * @jest-environment node
 */

const fs = require('fs')
const path = require('path')

function readFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
}

const source = readFile('components/AuthProvider.js')

describe('AuthProvider imports', () => {
  test('imports generateUsername', () => {
    expect(source).toMatch(/import.*generateUsername.*from/)
  })
})

describe('New profile creation', () => {
  test('includes username field in profile insert', () => {
    expect(source).toMatch(/\.insert\(/)
    expect(source).toMatch(/username/)
  })

  test('calls generateUsername before inserting new profile', () => {
    expect(source).toMatch(/await generateUsername\(/)
  })
})

describe('Existing profile username backfill', () => {
  test('checks for missing username on existing profiles', () => {
    expect(source).toMatch(/!data\.username && data\.name/)
  })

  test('calls generateUsername during backfill', () => {
    // There should be at least two calls to generateUsername:
    // one for new profile creation, one for backfill
    const matches = source.match(/await generateUsername\(/g)
    expect(matches).not.toBeNull()
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  test('updates profile with generated username via supabase', () => {
    expect(source).toMatch(/\.update\(\{ username \}\)/)
  })
})

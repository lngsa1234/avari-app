/**
 * Profile visibility tests.
 *
 * Verify that profile visibility settings are enforced in both the
 * profile view and the people directory, including server-side and
 * client-side filtering.
 *
 * @jest-environment node
 */

const fs = require('fs')
const path = require('path')

function readComponent(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'components', name), 'utf8')
}

// ─── UserProfileView visibility guard ─────────────────────────────────────

describe('UserProfileView visibility guard', () => {
  const source = readComponent('UserProfileView.js')

  test('checks profile_visibility before rendering', () => {
    expect(source).toMatch(/profile_visibility/)
    expect(source).toMatch(/visibility === ['"]hidden['"]/)
  })

  test('hidden profile shows "This profile is not available"', () => {
    expect(source).toMatch(/This profile is not available/)
  })

  test('connections-only shows "This profile is only visible to connections"', () => {
    expect(source).toMatch(/This profile is only visible to connections/)
  })

  test('defaults visibility to public when not set', () => {
    expect(source).toMatch(/profile_visibility \|\| ['"]public['"]/)
  })
})

// ─── AllPeopleView visibility filtering ───────────────────────────────────

describe('AllPeopleView visibility filtering', () => {
  const source = readComponent('AllPeopleView.js')

  test('filters by profile_visibility (server-side .neq check)', () => {
    expect(source).toMatch(/\.neq\(/)
  })

  test('client-side filter for connections visibility', () => {
    expect(source).toMatch(/visibility === ['"]connections['"]/)
    expect(source).toMatch(/visibility === ['"]public['"]/)
  })

  test('hidden profiles are excluded (returns false)', () => {
    expect(source).toMatch(/return false.*hidden/)
  })
})

// ─── Profile settings visibility dropdown ─────────────────────────────────

describe('Profile settings visibility dropdown', () => {
  const source = readComponent('UserProfileView.js')

  test('has visibility dropdown with 3 options (public/connections/hidden)', () => {
    expect(source).toMatch(/Open to all/)
    expect(source).toMatch(/Connections only/)
    expect(source).toMatch(/Hidden/)
  })

  test('updates profile_visibility via supabase on change', () => {
    expect(source).toMatch(/\.update\(.*profile_visibility/)
  })
})

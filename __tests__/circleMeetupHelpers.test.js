/**
 * Tests for lib/circleMeetupHelpers.js
 *
 * Currently covers `resolveCircleHost`, the pure helper that picks the
 * correct display info for a circle's host on the home page "Circle to
 * Join" card.
 *
 * Bug context: a circle named "Test2" was rendering with host name "Host"
 * and avatar initial "H" on the home page, even though the actual creator
 * was named "Lynn". Root cause was that useHomeData filtered member
 * profiles through `connection_group_members.status='accepted'` — and for
 * legacy circles where the creator's membership row wasn't in the accepted
 * list (or was filtered by profile RLS), the inline find-in-members logic
 * returned undefined and fell back to the literal string "Host".
 *
 * The fix attaches a dedicated `circle.creator` field in useHomeData and
 * introduces `resolveCircleHost` which prefers that field, then falls back
 * to finding the creator in members, and finally returns the circle name's
 * initial instead of "H" as the avatar character.
 */

// circleMeetupHelpers.js imports the real supabase singleton at module load,
// which throws if env vars aren't set in the test env. We don't need the
// supabase client for these pure-function tests — mock it to an empty object.
jest.mock('@/lib/supabase', () => ({ supabase: {} }))

import { resolveCircleHost } from '@/lib/circleMeetupHelpers'

describe('resolveCircleHost — dedicated creator field (Source 1)', () => {
  test('resolves from circle.creator when present with a name', () => {
    const circle = {
      name: 'Women in Product',
      creator_id: 'user-lynn',
      creator: { id: 'user-lynn', name: 'Lynn Wang', profile_picture: 'https://cdn/lynn.jpg' },
    }

    const host = resolveCircleHost(circle)

    expect(host.name).toBe('Lynn Wang')
    expect(host.initial).toBe('L')
    expect(host.profile_picture).toBe('https://cdn/lynn.jpg')
    expect(host.resolved).toBe(true)
  })

  test('falls back to null profile_picture when creator has no picture', () => {
    const circle = {
      name: 'Readers Circle',
      creator_id: 'user-1',
      creator: { id: 'user-1', name: 'Alex' },
    }

    const host = resolveCircleHost(circle)

    expect(host.profile_picture).toBeNull()
    expect(host.resolved).toBe(true)
  })

  test('prefers circle.creator even if members list also has the creator', () => {
    const circle = {
      name: 'Test Circle',
      creator_id: 'user-1',
      creator: { id: 'user-1', name: 'From Creator Field' },
      members: [
        { user_id: 'user-1', user: { name: 'From Members List' } },
      ],
    }

    const host = resolveCircleHost(circle)

    // Source 1 wins
    expect(host.name).toBe('From Creator Field')
  })
})

describe('resolveCircleHost — members fallback (Source 2)', () => {
  test('finds creator in members when circle.creator is absent', () => {
    const circle = {
      name: 'Design Systems Group',
      creator_id: 'user-creator',
      members: [
        { user_id: 'user-other', user: { name: 'Not the creator' } },
        { user_id: 'user-creator', user: { name: 'Priya Shah', profile_picture: '/priya.jpg' } },
      ],
    }

    const host = resolveCircleHost(circle)

    expect(host.name).toBe('Priya Shah')
    expect(host.initial).toBe('P')
    expect(host.profile_picture).toBe('/priya.jpg')
    expect(host.resolved).toBe(true)
  })

  test('ignores members whose user object is null (profile fetch failed)', () => {
    const circle = {
      name: 'Test2',
      creator_id: 'user-creator',
      members: [
        { user_id: 'user-creator', user: null },
      ],
    }

    const host = resolveCircleHost(circle)

    // Not resolved — falls through to Source 3 (circle name initial)
    expect(host.resolved).toBe(false)
    expect(host.name).toBe('Host')
    expect(host.initial).toBe('T')
  })

  test('ignores members whose user.name is falsy', () => {
    const circle = {
      name: 'Empty Names',
      creator_id: 'user-creator',
      members: [
        { user_id: 'user-creator', user: { name: '' } },
      ],
    }

    const host = resolveCircleHost(circle)

    expect(host.resolved).toBe(false)
    expect(host.initial).toBe('E')
  })
})

describe('resolveCircleHost — fallback (no source resolves)', () => {
  test('uses circle name initial when the creator is not found anywhere', () => {
    const circle = {
      name: 'Test2',
      creator_id: 'user-missing',
      members: [
        { user_id: 'user-other', user: { name: 'Some Other' } },
      ],
    }

    const host = resolveCircleHost(circle)

    // This is the exact reported bug: "Test2" should show "T", not "H"
    expect(host.name).toBe('Host')
    expect(host.initial).toBe('T')
    expect(host.profile_picture).toBeNull()
    expect(host.resolved).toBe(false)
  })

  test('circle with no members array and no creator field still returns circle initial', () => {
    const circle = {
      name: 'Lone Circle',
      creator_id: 'user-1',
      // no members, no creator
    }

    const host = resolveCircleHost(circle)

    expect(host.initial).toBe('L')
    expect(host.resolved).toBe(false)
  })

  test('circle with no creator_id returns circle initial', () => {
    const circle = {
      name: 'Mystery',
      members: [
        { user_id: 'user-1', user: { name: 'Someone' } },
      ],
    }

    const host = resolveCircleHost(circle)

    // Without creator_id we can't identify the creator in members
    expect(host.resolved).toBe(false)
    expect(host.initial).toBe('M')
  })

  test('circle with empty name returns "?" as initial', () => {
    const circle = {
      name: '',
      creator_id: 'user-1',
    }

    const host = resolveCircleHost(circle)

    expect(host.name).toBe('Host')
    expect(host.initial).toBe('?')
  })

  test('circle with missing name returns "?" as initial', () => {
    const circle = {
      creator_id: 'user-1',
    }

    const host = resolveCircleHost(circle)

    expect(host.initial).toBe('?')
  })
})

describe('resolveCircleHost — guards', () => {
  test('null circle returns hard default', () => {
    const host = resolveCircleHost(null)

    expect(host.name).toBe('Host')
    expect(host.initial).toBe('H')
    expect(host.profile_picture).toBeNull()
    expect(host.resolved).toBe(false)
  })

  test('undefined circle returns hard default', () => {
    const host = resolveCircleHost(undefined)

    expect(host.name).toBe('Host')
    expect(host.initial).toBe('H')
  })
})

describe('resolveCircleHost — initial normalization', () => {
  test('lowercase name is uppercased in initial', () => {
    const circle = {
      name: 'test',
      creator: { name: 'alice smith' },
    }

    const host = resolveCircleHost(circle)

    expect(host.initial).toBe('A')
  })

  test('name with leading whitespace is trimmed before taking initial', () => {
    const circle = {
      name: 'test',
      creator: { name: '   Bob' },
    }

    const host = resolveCircleHost(circle)

    expect(host.initial).toBe('B')
  })

  test('emoji or special char as first letter is preserved uppercased where possible', () => {
    const circle = {
      name: 'test',
      creator: { name: '✨Stella' },
    }

    const host = resolveCircleHost(circle)

    expect(host.initial).toBe('✨')
  })
})

// ─── The exact reported bug, as a regression guard ─────────────────

describe('resolveCircleHost — reported Test2 bug (regression guard)', () => {
  test('Test2 circle with creator not in members resolves to "T" avatar, not "H"', () => {
    // Shape matches what useHomeData used to produce BEFORE the fix:
    //   circle.name = 'Test2'
    //   circle.creator_id set
    //   circle.members contains only accepted members (creator not among them
    //     because of legacy data or status filter)
    //   circle.creator NOT attached (old code path)
    const circle = {
      id: 'circle-test2',
      name: 'Test2',
      creator_id: 'user-lynn',
      members: [
        { user_id: 'user-other', user: { name: 'Someone Else' } },
      ],
      // NOTE: no circle.creator field — this is the pre-fix shape
    }

    const host = resolveCircleHost(circle)

    // The bug: avatar showed "H" (from "Host"). The fix: avatar should
    // show "T" (from "Test2"). Still labeled "Host" as the name since
    // we couldn't resolve who the creator actually is.
    expect(host.initial).toBe('T')
    expect(host.initial).not.toBe('H')
    expect(host.resolved).toBe(false)
  })

  test('Test2 circle with creator attached resolves to real host name', () => {
    // Shape matches what useHomeData produces AFTER the fix:
    //   circle.creator contains the creator's profile, independent of members
    const circle = {
      id: 'circle-test2',
      name: 'Test2',
      creator_id: 'user-lynn',
      creator: { id: 'user-lynn', name: 'Lynn Wang', profile_picture: '/lynn.jpg' },
      members: [
        { user_id: 'user-other', user: { name: 'Someone Else' } },
      ],
    }

    const host = resolveCircleHost(circle)

    expect(host.name).toBe('Lynn Wang')
    expect(host.initial).toBe('L')
    expect(host.profile_picture).toBe('/lynn.jpg')
    expect(host.resolved).toBe(true)
  })
})

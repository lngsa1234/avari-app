/**
 * Circles page feature tests.
 *
 * Verify new features exist in component source code:
 * - Recommend to Connect inline section
 * - Create Circle info card for insufficient connections
 * - Remove connection optimistic cache update
 * - Circles view toggle (grid/list)
 * - Profile empty state prompts
 *
 * @jest-environment node
 */

const fs = require('fs')
const path = require('path')

function readComponent(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'components', name), 'utf8')
}

// ─── Circles page Recommend to Connect ─────────────────────────────────────

describe('Circles page Recommend to Connect', () => {
  const source = readComponent('ConnectionGroupsView.js')

  test('showDiscoverInline state exists', () => {
    expect(source).toMatch(/showDiscoverInline/)
  })

  test('"Suggested for You" title exists', () => {
    expect(source).toMatch(/Suggested for You/)
  })

  test('"Recommend" text exists for discover card', () => {
    expect(source).toMatch(/Recommend/)
  })

  test('renders mutualConnections info for suggestions', () => {
    expect(source).toMatch(/mutualConnections/)
  })

  test('"Suggested for you" shown for non-mutual suggestions', () => {
    expect(source).toMatch(/Suggested for you/)
  })

  test('"Find more people to connect with" card exists', () => {
    expect(source).toMatch(/Find more people to connect with/)
  })
})

// ─── Create Circle info card ───────────────────────────────────────────────

describe('Create Circle info card', () => {
  const source = readComponent('ConnectionGroupsView.js')

  test('showCreateInfo state exists', () => {
    expect(source).toMatch(/showCreateInfo/)
  })

  test('"Connect with 2+ people first" text exists', () => {
    expect(source).toMatch(/Connect with 2\+ people first/)
  })

  test('"Find People" button navigates to allPeople', () => {
    expect(source).toMatch(/onNavigate\?\.\('allPeople'\)/)
  })

  test('"Dismiss" button exists', () => {
    expect(source).toMatch(/Dismiss/)
  })
})

// ─── Remove connection optimistic update ───────────────────────────────────

describe('Remove connection optimistic update', () => {
  const source = readComponent('UserProfileView.js')

  test('handleRemoveConnection optimistically filters connections from cache', () => {
    expect(source).toMatch(/connections.*filter.*userId/)
  })
})

// ─── Circles page view toggle ──────────────────────────────────────────────

describe('Circles page view toggle', () => {
  const source = readComponent('AllCirclesView.js')

  test('imports LayoutGrid and List from lucide-react', () => {
    expect(source).toMatch(/LayoutGrid/)
    expect(source).toMatch(/\bList\b/)
  })

  test('viewMode state defaults to list', () => {
    expect(source).toMatch(/useState\('list'\)/)
  })

  test('CircleRow component exists', () => {
    expect(source).toMatch(/function CircleRow/)
  })

  test('page title is "Discover Circles"', () => {
    expect(source).toMatch(/Discover Circles/)
  })

  test('search placeholder includes name, topic, category', () => {
    expect(source).toMatch(/Search by name, topic, or category/)
  })

  test('placeholder color is explicitly set', () => {
    expect(source).toMatch(/::placeholder/)
  })

  test('filter category chips are removed', () => {
    expect(source).not.toMatch(/Filter chips/)
  })
})

// ─── Profile empty state prompts ───────────────────────────────────────────

describe('Profile empty state prompts', () => {
  const source = readComponent('UserProfileView.js')

  test('shows "Find People" prompt', () => {
    expect(source).toMatch(/Find People/)
  })

  test('shows "Join a Circle" prompt', () => {
    expect(source).toMatch(/Join a Circle/)
  })

  test('prompts are conditional on zero connections and circles', () => {
    expect(source).toMatch(/connectionCount === 0/)
    expect(source).toMatch(/mutualCircles\.length === 0/)
  })
})

// ─── People page sections ──────────────────────────────────────────────────

describe('People page sections', () => {
  const source = readComponent('AllPeopleView.js')

  test('has "Suggested for You" section', () => {
    expect(source).toMatch(/Suggested for You/)
  })

  test('has "Approval Connections" section', () => {
    expect(source).toMatch(/Approval Connections/)
  })

  test('has "More Suggestions" section', () => {
    expect(source).toMatch(/More Suggestions/)
  })

  test('tracks incoming connection requests (hasIncomingRequest)', () => {
    expect(source).toMatch(/hasIncomingRequest/)
  })

  test('fetches incoming interests for current user', () => {
    expect(source).toMatch(/interested_in_user_id.*currentUser\.id/)
  })

  test('shows "shared circle" instead of "circle"', () => {
    expect(source).toMatch(/shared circle/)
  })

  test('search placeholder includes name, role, city, industry', () => {
    expect(source).toMatch(/Search by name, role, city, or industry/)
  })

  test('placeholder color is explicitly set', () => {
    expect(source).toMatch(/::placeholder/)
  })

  test('page title is "Discover Women"', () => {
    expect(source).toMatch(/Discover Women/)
  })
})

// ─── Profile active status ────────────────────────────────────────────────

describe('Profile active status', () => {
  const source = readComponent('UserProfileView.js')

  test('shows active status text near username', () => {
    expect(source).toMatch(/Active now/)
  })

  test('shows relative time for inactive users', () => {
    expect(source).toMatch(/m ago/)
    expect(source).toMatch(/h ago/)
    expect(source).toMatch(/d ago/)
  })

  test('shows green dot for active users', () => {
    expect(source).toMatch(/greenDot/)
  })
})

// ─── Profile Settings section ─────────────────────────────────────────────

describe('Profile Settings section', () => {
  const source = readComponent('UserProfileView.js')

  test('has Settings header', () => {
    expect(source).toMatch(/Settings/)
  })

  test('has divider above Settings', () => {
    expect(source).toMatch(/linear-gradient.*brown100/)
  })
})

// ─── Recommend to Connect toggle ──────────────────────────────────────────

describe('Recommend to Connect toggle', () => {
  const source = readComponent('ConnectionGroupsView.js')

  test('empty state button toggles discover inline', () => {
    expect(source).toMatch(/setShowDiscoverInline\(prev => !prev\)/)
  })
})

// ─── Profile visibility ───────────────────────────────────────────────────

describe('Profile visibility setting', () => {
  const profileView = readComponent('UserProfileView.js')
  const peopleView = readComponent('AllPeopleView.js')

  test('profile page has visibility dropdown with three options', () => {
    expect(profileView).toMatch(/profile_visibility/)
    expect(profileView).toMatch(/Open to all/)
    expect(profileView).toMatch(/Connections only/)
    expect(profileView).toMatch(/Hidden/)
  })

  test('profile page blocks hidden profiles for non-owners', () => {
    expect(profileView).toMatch(/This profile is not available/)
  })

  test('profile page blocks connections-only profiles for non-connections', () => {
    expect(profileView).toMatch(/This profile is only visible to connections/)
  })

  test('people directory filters by profile_visibility', () => {
    expect(peopleView).toMatch(/profile_visibility/)
    expect(peopleView).toMatch(/visibility === 'connections'/)
  })
})

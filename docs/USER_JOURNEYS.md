# CircleW User Journeys & Navigation Map

**Last updated:** 2026-04-12 (Journeys 5, 8, 9, and 10 updated with detailed component behavior for E2E test assertions)
**Purpose:** Document all user workflows, navigation paths, state transitions, and failure points for E2E testing.

---

## Architecture Overview

### Navigation System
- View components use `onNavigate(viewName, data)` callback
- `lib/navigationAdapter.js` translates view names to URLs via `createOnNavigate(router)`
- MainApp.js (legacy) uses `handleNavigate` which sets `currentView` state + syncs `selectedCircleId`, `selectedUserId`, etc.
- **Dynamic `from=` param**: `createOnNavigate` appends `from={currentPath}` to URLs for back navigation. `getPreviousView` reads this param to determine the back destination. For dynamic routes (e.g. `/people/{id}`), returns `_path:/people/{id}` which `createOnNavigate` handles as a direct `router.push()`.
- **Skip list**: Main tabs and list pages (`home`, `discover`, `meetups`, `connectionGroups`, `allPeople`, `allEvents`) don't get `from=` appended, so their back buttons use the fallback default.
- **Fallback:** unmapped view names navigate to `/${viewName}` (404)

### State Synchronized with Navigation (MainApp.js)
When `handleNavigate(view, data)` is called, these are set atomically:
- `data.circleId` → `selectedCircleId`
- `data.userId` → `selectedUserId`
- `data.chatId` → `selectedChatId`
- `data.chatType` → `selectedChatType`
- `data.recapId` → `selectedRecapId`
- `data.meetupId` → `selectedMeetupId`
- `data.meetupCategory` → `selectedMeetupCategory`
- `previousView` → automatically captured from current view before transition

### App Entry Points
1. **Direct URL** → App Router page renders, auth gate in `(app)/layout.js`
2. **Login (email/Google)** → `onAuthStateChange` SIGNED_IN → profile load → home or onboarding
3. **Email verification link** → auto-session, redirects to `/` → home or onboarding
4. **Password reset link** → `/reset-password` page
5. **Deep link** → `?event={id}` URL param or `pendingEventId` in localStorage → eventDetail

---

## Route Map

| View Name | Route | Page File | previousView |
|-----------|-------|-----------|--------------|
| home | `/home` | `app/(app)/home/page.js` | — |
| discover | `/discover` | `app/(app)/discover/page.js` | — |
| meetups | `/coffee` | `app/(app)/coffee/page.js` | — |
| connectionGroups | `/circles` | `app/(app)/circles/page.js` | — |
| circleDetail | `/circles/{circleId}` | `app/(app)/circles/[id]/page.js` | "circles" (hardcoded) |
| userProfile | `/people/{userId}` | `app/(app)/people/[id]/page.js` | "discover" (hardcoded) |
| eventDetail | `/events/{id}` | `app/(app)/events/[id]/page.js` | "coffee" (hardcoded) |
| allEvents | `/events` | `app/(app)/events/page.js` | — |
| allPeople | `/people` | `app/(app)/people/page.js` | "discover" (hardcoded) |
| allCircles | `/circles/browse` | `app/(app)/circles/browse/page.js` | — |
| createCircle | `/circles/new` | `app/(app)/circles/new/page.js` | — |
| messages | `/messages` | `app/(app)/messages/page.js` | "home" (hardcoded) |
| coffeeChats | `/schedule?type=coffee` | `app/(app)/schedule/page.js` | "home" (hardcoded) |
| scheduleMeetup | `/schedule?type={type}&...` | `app/(app)/schedule/page.js` | "home" (hardcoded) |
| profile | `/profile` | `app/(app)/profile/page.js` | "home" (hardcoded) |
| pastMeetings | NOT MAPPED (404) | — | — |
| callHistory | `/coffee?view=history` | `app/(app)/coffee/page.js` | — |
| coffeeChatRecap | `/recaps/{recapId}` | `app/(app)/recaps/[id]/page.js` | — |
| admin | `/admin` | `app/(app)/admin/page.js` | — |
| adminFeedback | `/admin/feedback` | `app/(app)/admin/feedback/page.js` | — |
| adminAnalytics | `/admin/analytics` | `app/(app)/admin/analytics/page.js` | — |
| meetupProposals | `/proposals` | `app/(app)/proposals/page.js` | — |

---

## Navigation Issues

| ID | Severity | Status | Description | File | Impact |
|----|----------|--------|-------------|------|--------|
| NAV-001 | **High** | Open | `pastMeetings` not in ROUTES, navigates to 404 | `lib/navigationAdapter.js` | User clicks "View past" on coffee page, gets 404 |
| NAV-002 | **Medium** | **Fixed** | Event detail `previousView` now uses `from=` param | `events/[id]/page.js` | Back button goes to actual referring page via `from=` param |
| NAV-003 | **Medium** | **Fixed** | User profile `previousView` now uses `from=` param | `people/[id]/page.js` | Back button goes to actual referring page; dynamic routes use `_path:` prefix |
| NAV-004 | **Medium** | **Partial** | Circle detail `previousView` hardcoded to "circles" | `circles/[id]/page.js` | Still hardcoded; needs `from=` param support |
| NAV-005 | **Medium** | **Fixed** | `from=` param persists in URL across page refreshes | `lib/navigationAdapter.js` | Back button survives page refresh for pages with `from=` param |
| NAV-006 | **Low** | Open | Proposals page missing `onNavigate` handler | `proposals/page.js` | Navigation out of proposals may not work |
| NAV-007 | **Low** | Open | Admin sub-pages missing `onNavigate` handler | `admin/feedback/page.js`, `admin/analytics/page.js` | Can't navigate from admin sub-pages |
| NAV-008 | **Low** | Open | Discover page uses direct `router.push` for host meetup | `discover/page.js:38` | Inconsistent pattern, works but harder to maintain |
| NAV-009 | **Low** | **Partial** | `schedule/page.js` uses `from=` for some flows | `schedule/page.js` | Back works when navigated with `from=`, falls back to home otherwise |
| NAV-010 | **Low** | **Fixed** | `messages/page.js` uses `from=` param for back | `messages/page.js` | Back goes to actual referring page (profile, circle, etc.) |
| NAV-011 | **Low** | **Fixed** | `/circles/browse` highlighted Circles tab when accessed from Discover | `AppNavBar.js` | Nav bar now correctly doesn't highlight Circles for browse page |
| NAV-012 | **Low** | **Fixed** | `/circles/browse` back always went to Home | `AllCirclesView.js` | Now uses `previousView` from `from=` param, defaults to Discover |

---

## Back Navigation Analysis

### Where Previous View Context Is Lost
Most pages now use `from=` URL param for dynamic back navigation. Some still use hardcoded fallbacks.

| Page | Back Navigation | Status |
|------|----------------|--------|
| `/circles/{id}` | Hardcoded "circles" | **Needs fix** — should use `from=` param |
| `/people/{userId}` | `from=` param, falls back to "allPeople" | **Fixed** |
| `/events/{id}` | `from=` param + `?category=` for coffee chats | **Fixed** |
| `/profile` | Hardcoded "home" | Acceptable (profile is always accessible from nav) |
| `/schedule` | `from=` param, falls back to "home" | **Partial** |
| `/messages` | `from=` param, falls back to "home" | **Fixed** |
| `/circles/browse` | `from=` param, falls back to "discover" | **Fixed** |

### Flows That Still Reset to Home
- Profile back button → always /home (acceptable, accessed from nav bar)
- Schedule back button → /home when no `from=` param

### Refresh Causing Broken Return Path
All `previousView` values are hardcoded props, not persisted in URL or sessionStorage. A page refresh loses the actual navigation history. Browser back button works (browser history is real), but in-app back button uses the hardcoded value.

### Modal Close Behavior
| Modal | Component | Close Action | Navigation |
|-------|-----------|-------------|------------|
| Join circle confirm | CircleDetailView | Cancel / confirm | No navigation (reloads detail) |
| Join success | CircleDetailView | Button click | No navigation |
| Leave circle confirm | CircleDetailView | Stay / leave | Leave → navigates to allCircles |
| Edit circle | CircleDetailView | Cancel / save | No navigation (reloads detail) |
| Invite to circle | CircleDetailView | Cancel / send | No navigation (reloads detail) |
| Delete meetup confirm | CircleDetailView | Cancel / delete | No navigation (reloads detail) |
| Format picker | CoffeeChatDetailView | Select option | No navigation |
| Cancel event confirm | CoffeeChatDetailView | Cancel / confirm | Navigates to previousView |
| Compose message | MessagesPageView | Cancel / select | No navigation (opens chat) |
| Report user | UserProfileView | Cancel / submit | No navigation |
| Suggest topic | NetworkDiscoverView | Cancel / submit | No navigation |

### Stale Selected Entity State
In MainApp.js, `selectedCircleId`, `selectedUserId`, `selectedMeetupId` persist in state even after navigating away. If the user navigates back via browser back button, the old entity is still selected. In App Router, this isn't an issue (entity ID comes from URL params).

### Impossible Return Journeys (remaining)
- Home → Circle card → Circle detail → Schedule meetup → Back → goes to /home (not circle detail) — **NAV-004 still open**
- ~~People → Person profile → Message → Back → goes to /home (not profile)~~ **Fixed** — now uses `from=` param
- ~~Circle detail → Member profile → Schedule coffee → Back → goes to /home (not profile)~~ **Partial** — profile back works, schedule back still goes home
- Any page → Avatar → Profile → Back → goes to /home (acceptable, nav-level action)

### Where Browser History Should Exist But Does Not
All navigation uses `router.push()` so browser history IS created. The issue is only with in-app back buttons using hardcoded `previousView` values that don't match browser history.

---

## User Journeys

---

### Journey 1: Email Signup
**Trigger:** Click "Sign up with Email" on landing page
**User goal:** Create an account and set up profile
**Suggested URL:** `/` → `/` (verification) → `/home` (after onboarding)

**Steps:**
1. Landing page (`/`) → Click "Sign up with Email"
2. Enter email + password → Click "Sign Up"
3. See "Check your email" message
4. Click verification link in email → auto-session created
5. Redirected to `/` → auth listener fires SIGNED_IN
6. Profile created with `onboarding_completed: false`
7. ProfileSetupFlow renders (9 steps):
   - Welcome → Vibe → Role/Industry → Career Stage → Bio (optional) → Hosting → Identity/Name → Photo (optional) → Preview
8. `onboarding_completed: true` → redirect to `/home`

**Failure points:**
- Signup with existing email → error message "already registered"
- Signup with weak password (< 6 chars) → Supabase rejects
- Verification link expired → must request new one
- Browser closes during onboarding → resumes on next login (onboarding_completed still false)

**Back navigation risks:**
- During onboarding, browser back goes to landing page (loses progress? steps are in state)
- After onboarding completion, browser back could return to onboarding view briefly

**Data dependencies:** None (creates new profile)

---

### Journey 2: Email Login
**Trigger:** Click "Already have an account? Log in" on landing page
**User goal:** Access existing account
**Suggested URL:** `/` → `/home`

**Steps:**
1. Landing page → Click "Log in"
2. Enter email + password → Click "Log In"
3. Auth listener → profile load → home page

**Failure points:**
- Wrong password → "Incorrect email or password"
- Unverified email → "Please check your email and verify your account first"
- Show/hide password toggle → **reported not working** (needs investigation)

**Back navigation risks:** None (single step)

**Data dependencies:** Existing profile in `profiles` table

---

### Journey 3: Google Login
**Trigger:** Click "Continue with Google" on landing page
**User goal:** Quick sign-in via Google OAuth
**Suggested URL:** `/` → Google → `/` → `/home`

**Steps:**
1. Landing page → Click "Continue with Google"
2. Google OAuth consent screen
3. Redirect back → session created
4. If first time → ProfileSetupFlow
5. If returning → `/home`

**Failure points:**
- Google auth popup blocked by browser
- User cancels Google consent
- Google account not linked (if using different email)

**Back navigation risks:** OAuth redirect clears browser history entry

**Data dependencies:** Google account email

---

### Journey 4: Forgot Password
**Trigger:** Click "Forgot password?" on login screen
**User goal:** Reset password
**Suggested URL:** `/` → email → `/reset-password`

**Steps:**
1. Login screen → Click "Forgot password?"
2. Enter email → Click "Send Reset Link"
3. Check email → Click reset link
4. `/reset-password` page → Enter new password + confirm
5. Click "Reset Password" → redirected to login

**Failure points:**
- Email not found → no error shown (Supabase sends nothing silently)
- Reset link expired (1 hour default)
- Password mismatch in confirm field

**Back navigation risks:** None

**Data dependencies:** Existing account with email

---

### Journey 5: Browse Home Feed
**Trigger:** Navigate to Home tab or app load
**User goal:** See what's happening in the community
**Suggested URL:** `/home`

**Page section order (top to bottom):**
1. Welcome card (new users only, dismissible)
2. Greeting ("Good morning/afternoon/evening, {firstName}")
3. **Requests waiting for you** (conditional — only if there are pending requests)
4. Your Coffee Chats (upcoming meetups + coffee chats)
5. People to Meet (recommended connections)
6. Circle to Join (recommended circles)
7. Live Feed (recent community activity)

**Steps:**
1. `/home` loads with greeting
2. Upcoming Meetups section → card click → `/events/{id}`
3. People to Meet section → card click → `/people/{userId}`
4. People to Meet → "Say hi" button → sends connection request (inline, no navigation)
5. Circle to Join section → card click → `/circles/{circleId}`
6. Circle to Join → "Join" button → sends join request (inline)
7. Live Feed → "Connect" → navigates to profile (shows "Request Sent" if already requested)
8. Live Feed → "Join" → `/circles/{circleId}`
9. Live Feed → "RSVP" → `/events/{meetupId}`
10. Requests section → Accept/Decline/Ignore (inline, no navigation)
11. "View all" (meetups) → `/coffee`
12. "See all" (people) → `/people`
13. "See all" (circles) → `/circles/browse`

---

#### Section detail: "Requests waiting for you"

**Section title (H3):** `Requests waiting for you` (serif font, color #3F1906, opacity 0.73)

**Data sources (mixed into one list, sorted by `requested_at`/`created_at` descending):**
- `connectionRequests` — people who sent me a connection request
- `circleJoinRequests` — people requesting to join circles I created
- `circleInvitations` — circles inviting me to join
- `remainingCoffeeRequests` — coffee chat requests not already in Upcoming Meetups (filtered by `coffeeChatRequests.filter(r => !visibleCoffeeChatIds.has(r.id))`)

**Display limit:** First 5 items. If more than 5, shows "View all {N} requests →" button that navigates to `/discover`.

**Hidden when:** `allRequests.length === 0` (entire section returns null).

**Per-card layout (each request):**
- Avatar (profile picture or initials-in-circle fallback, 48px desktop / 40px mobile)
- Name (h4, serif, bold)
- Description line (varies by request type, see below)
- Optional career/city line (smaller, color #B8A089)
- Time ago (desktop: inline as "· {timeAgo}"; mobile: below)
- Action buttons (right side)

**Time ago format:**
- Today → "new"
- Yesterday → "Yesterday"
- Older → "{N} days ago"

**Card click behavior:** Clicking the avatar/name area navigates to `/people/{userId}` (except for coffee chat requests — `user.id` is on `request.requester`).

---

**Request type: Connection request**
- **Description line:** `{user.career || 'Professional'}`
- **Second line:** `{user.city}, {user.state}` (if present)
- **Single action button:** `Review` (with Heart icon) → navigates to `/people/{request.id}` (user's profile)
- **No direct Accept/Decline on home card** — user must go to profile page to accept
- After clicking Review → Journey 10 (User Profile) "incoming request" state applies

**Request type: Circle join request (someone requesting to join MY circle)**
- **Description line:** `wants to join **{circleName}**`
- **Second line:** `{user.career}` (if present)
- **Action buttons:**
  - `Decline` (outlined, italic) → `handleDeclineCircleJoin(request.id)` → optimistic removal from list
  - `Approve` (filled, with Users icon, italic) → `handleAcceptCircleJoin(request.id)` → optimistic removal from list
- Both actions invalidate `circles-page-{userId}` cache

**Request type: Circle invitation (I was invited to a circle)**
- **Description line:** `invited you to **{circleName}**`
- **Second line:** `{user.career}` (if present — where `user` is the circle creator)
- **Action buttons:**
  - `Decline` (outlined, italic) → `handleDeclineCircleInvitation(request.id)` → optimistic removal
  - `Join` (filled, with Users icon, italic) → `handleAcceptCircleInvitation(request.id)` → optimistic removal, calls `mutatePrimary()`

**Request type: Coffee chat request**
- **Description line:** `wants a coffee chat · {month day} at {time}` (if `scheduled_time` present)
- **Second line:** `{user.career}` (if present)
- **Third line (optional):** `"{request.notes}"` (italic, if notes present)
- **Action buttons:**
  - `Decline` (outlined, italic) → `handleDeclineCoffeeChat(request.id)`
  - `Accept` (filled, with Coffee icon, italic) → `handleAcceptCoffeeChat(request.id)`

---

#### Section detail: "People to Meet"

**Section title:** "People to Meet" with "See all →" link navigating to `/people`

**Display limit:** First 4-5 people (via SWR query `home-people-recs`)

**Per-card layout:**
- Avatar + name + career
- "Say hi" button (primary) — sends connection request inline
- Button state after click: changes to show "Sent" or similar (uses local state `setSentRequests`)

**Empty state:** Section hidden entirely (no CTA)

**Failure points:**
- People to Meet loads slowly (~1 min without SWR cache, fixed with separate SWR query)
- Empty sections with < 5 users in community
- "Say hi" button state doesn't update if SWR cache is stale

**Back navigation risks:**
- Home is the root, no back needed
- Sub-navigations from home all work (browser back returns to home)

**Empty states:**
- "No upcoming events / Check back soon for new events!"
- People to Meet: hidden when empty (no CTA)
- Live Feed: "No activity yet. Be the first to connect!"
- "Requests waiting for you": section hidden entirely when no requests

**Data dependencies:** `get_home_page_data` RPC, `connection_recommendations`, `circle_match_scores`, `event_recommendations`, `feed_events`, `user_interests`, `connection_group_members`, `coffee_chats`

---

### Journey 6: Discover Community
**Trigger:** Click Discover tab
**User goal:** Find events, topics, and circles to join
**Suggested URL:** `/discover`

**Steps:**
1. `/discover` loads
2. Community Events section → event card click → `/events/{id}`
3. Community Events → "Host yours" → `/schedule?type=community` (direct router.push)
4. Trending Requests → "Vote" → votes inline
5. Trending Requests → "Host" → `/schedule?type=community&topic=...`
6. Trending Requests → "Suggest" → opens modal → submit
7. Intimate Circles → circle card click → `/circles/{circleId}`
8. Intimate Circles → "Join" → sends join request inline
9. Intimate Circles → "See all" → `/circles/browse`
10. "Start your own Circle" → `/circles/new`
11. FAB (+) button → `/circles/new`

**Failure points:**
- "Host yours" uses `router.push` directly instead of `onNavigate` [NAV-008]
- No events and no trending requests → page feels empty

**Back navigation risks:**
- Discover is a main tab, browser back works normally
- "Host yours" navigates to schedule, back returns to discover

**Empty states:**
- "No upcoming events yet / Have a topic in mind? Suggest it below and rally support!"

**Data dependencies:** `meetups`, `meetup_proposals`, `connection_groups`

---

### Journey 7: Coffee / Meetups Page
**Trigger:** Click Coffee tab
**User goal:** See upcoming and past meetups/coffee chats
**Suggested URL:** `/coffee`, `/coffee?view=past`, `/coffee?view=history`

**Steps:**
1. `/coffee` loads with Upcoming/Past tabs
2. "Host a Coffee Chat" → `/schedule`
3. Upcoming tab → meetup card click → `/events/{meetupId}`
4. Past tab → past meetup card click → `/events/{meetupId}`
5. Coffee chat recap → `/recaps/{recapId}`
6. Empty state "Browse Events" → `/discover`
7. Empty state "Discover" → `/discover`
8. ~~"View past" button → `onNavigate('pastMeetings')`~~ **[NAV-001: BROKEN, 404]**

**Failure points:**
- `pastMeetings` view name not mapped → 404 [NAV-001]
- Past tab requires `?view=past` URL param
- MeetupsView doesn't receive `previousView` from coffee page

**Back navigation risks:**
- Switching between Upcoming/Past tabs doesn't update URL (tab state is local)
- Browser back from Past tab goes to previous page, not Upcoming tab

**Empty states:**
- "No upcoming meetups / Schedule a coffee chat or join a group event!"
- CTAs: "Browse Events" and "Discover"

**Data dependencies:** `meetups`, `meetup_signups`, `coffee_chats`, `call_recaps`

---

### Journey 8: Circles Page
**Trigger:** Click Circles tab
**User goal:** See connections, circles, and manage requests
**Suggested URL:** `/circles`

**Page header:**
- H1: `Circles` (serif, color #3F1906)
- Subtitle: `Your deep and meaningful connections`

**Page section order (top to bottom):**
1. **Pending invitations** (only if any exist)
2. My Connections
3. My Active Circles (or "Create a Circle" prompt if none)
4. Recommend to Connect (inline discover, toggle via button)
5. Recent Chats (only if any)
6. **Sent Requests** (only if any exist)

---

#### Section: Pending invitations (top of page)

**Condition:** `groupInvites.length > 0`

**Layout:**
- White card with border
- Header row: Clock icon + "Pending" label + count badge (orange #D4864A on #F5E6D3 background)
- List of invitation rows

**Per-invitation row:**
- Circle name (bold, color #2C1810)
- Subtitle: `Invited by {creator.name || 'someone'}`
- Right side: **Join** button (filled brown #5C4033, white text, pill shape)

**Action: Click "Join"**
- Calls `handleAcceptInvite(invite.id, invite.group?.name)`
- On success: toast `You joined "{groupName}"!`
- Optimistic: removes from `groupInvites`, refreshes circles data

**Note:** There's no visible Decline button in this section — decline flow goes through a different path (not confirmed, may be a gap).

---

#### Section: My Connections

**H2:** `My Connections`

**Empty state:** (when `connections.length === 0`)
- Dashed border card with UserPlus icon
- Title: `No connections yet` (bold)
- Subtitle: `Connect with people to start building meaningful relationships`
- CTA button: `Recommend to Connect` (toggles `showDiscoverInline` state)

**With connections:** Horizontal slide bar of connection cards, each with:
- Avatar + name + career
- Message button → `/messages?id={userId}&type=user`
- Schedule Coffee button → `/schedule?type=coffee&connectionId={userId}`
- Card click → `/people/{userId}`

---

#### Section: My Active Circles

**Per-card layout:**
- Circle name, emoji, category badge
- Member count + next meetup date/time (if upcoming)
- Last message preview OR "No activity yet" placeholder
- Member avatars (first 3-4 + count overflow badge)
- Action buttons:
  - Message button (icon only) → `/messages?id={circleId}&type=circle`
  - Primary CTA button (varies by state):
    - `Join Now` (green) — if `daysUntilMeetup === 0`
    - `View Session` — if has upcoming meetup
    - `Get Started` — if no activity yet
    - `Open Circle` — default
- Card click → `/circles/{circleId}`

**Expand:** If more than 3 circles, shows "Show N more circles" button

**Empty state (no circles):** Shows "Create a Circle" prompt card

---

#### Section: Sent Requests

**Condition:** `sentRequestProfiles.length + sentCircleInvites.length + pendingJoinRequests.length > 0`

**H2:** `Sent Requests` with count badge (brown #8B6F5C background, white text, pill shape)

**Three item types, rendered in this order:**

**1. Sent connection requests** (from `sentRequestProfiles`):
- Avatar + name
- Subtitle: `Connection request · {timeAgo}`
- `Withdraw` button (outlined brown)
- Action: `handleWithdrawRequest(personId)` — removes from `user_interests`

**2. Sent circle invites** (from `sentCircleInvites`, filtered by `status = 'invited'` only):
- Avatar + name of invitee
- Subtitle: `Invited to **{circleName}** · {timeAgo || 'pending'}`
- `Withdraw` button
- Action: `handleWithdrawCircleInvite(membershipId)` — optimistic removal, deletes from `connection_group_members`

**3. My pending join requests** (from `pendingJoinRequests`):
- Users icon (not avatar) in brown circle
- Title: `{groupName}` (the circle I want to join)
- Subtitle: `Join request pending · {timeAgo}` (or just "Join request pending" if no timestamp)
- `Withdraw` button
- Action: Inline `supabase.from('connection_group_members').delete().eq('id', req.id)` then invalidates `circles-page-{userId}` cache

**CRITICAL — Bug fixed 2026-04-12:**
`sentCircleInvites` query **MUST** filter by `status = 'invited'` ONLY, NOT include `'pending'`. Including `'pending'` would pull in join requests TO the admin's circles and display them as "Invited to" which is wrong — those are received requests, not sent invites.

**Failure points:**
- Empty connections section when new user has 0 connections
- SWR cache not invalidated after actions on other pages
- Pending join requests mislabeled as "Invited to" if query filter is wrong (see fix above)

**Back navigation risks:**
- Circles is a main tab, back works normally
- Message/Schedule navigate away; back returns to circles (browser history)

**Empty states:**
- "No connections yet" (with CTA)
- No active circles → shows "Create a Circle" CTA
- Sent Requests section hidden entirely when empty

**Data dependencies:** `get_circles_page_data` RPC, `get_mutual_matches` RPC, `connection_group_members`, `user_interests`, `connection_groups`

---

### Journey 9: Circle Detail
**Trigger:** Click a circle card from Home, Discover, Circles, or Profile
**User goal:** View circle info, join/leave, chat, see members
**Suggested URL:** `/circles/{circleId}`
**Required dynamic route:** Yes (`[id]`)

**State detection (computed from `members` array and `currentUser`):**
- `membership = members.find(m => m.user_id === currentUser?.id)`
- `isMember = membership?.status === 'accepted'`
- `isPending = membership?.status === 'invited' || membership?.status === 'pending'`
- `isInvited = membership?.status === 'invited'` (admin invited me)
- `isRequested = membership?.status === 'pending'` (I requested to join)
- `isHost = circle.creator_id === currentUser?.id`
- `memberCount = members.filter(m => m.status === 'accepted').length`
- `maxMembers = circle.max_members || 10`
- `spotsLeft = maxMembers - memberCount`
- `isFull = spotsLeft <= 0`

**Loading state:** Shows spinner with text "Loading circle..."
**Not found state:** Shows 😕 emoji + "Circle not found" + "Go back" button

**Layout (top to bottom):**
1. **Header** (gradient background or image cover) with back chevron, circle image upload camera icon (host only), category badge
2. **Title section**: Circle name (H1) + Edit button (host only, pencil icon)
3. **Next meetup section** (if exists): Meetup topic, date, time, Edit/Delete buttons (host), RSVP button (member)
4. **Hosted by** section: Host avatar + name + career + "You" badge (if host)
5. **Members** section (see below)
6. **What to expect** section (static copy)
7. **Past Sessions** section (if any)
8. **Status banner** (invited OR requested, see below)
9. **Action button** (bottom): varies by state (see below)
10. **Floating action buttons** and modals

---

#### Members Section

**Header:** `Members` + count display: `{memberCount}/{maxMembers}`
- If `spotsLeft > 0 && spotsLeft <= 3`: adds ` · {N} spots left` warning

**Invite button:** Visible when `isMember && !isFull`
- Label: `Invite` (or similar, with "+" icon)
- Opens invite modal → select connections → click Send
- Insert status depends on `isHost`: creator sends `'invited'`, non-creator members send `'pending'` (requires admin approval)

**Accepted members list:** Shows all members with `status === 'accepted'`
- Avatar + name + career
- Click avatar → `/people/{userId}`

**Host-only: Join Requests section** (visible when `isHost && members.filter(m => m.status === 'pending').length > 0`):
- Subtitle: `Join Requests`
- List of pending members with avatar + name
- **Decline** button (outlined) — calls `.update({ status: 'declined' })`, optimistic removal from list
- **Accept** button (filled brown) — calls `.update({ status: 'accepted' })`, optimistic status update

**Host-only: Pending Invites section** (visible when `members.filter(m => m.status === 'invited').length > 0`):
- Subtitle: `Pending Invites`
- List of invited members with "Pending" badge (orange)
- No action buttons (read-only)

---

#### Non-member state (!isMember && !isPending)

**Bottom action button:**
- Label: `Request to Join` (or `Join Waitlist` if `isFull`)
- Filled brown primary button
- Click: Opens `showJoinConfirm` modal
- Modal confirm: Inserts row with `status: 'pending'` into `connection_group_members`
  - First deletes any old row (to avoid 409 conflict from previous declined/removed state)
- On success: shows `setJoinSuccess(true)` state, optimistically adds self to members

---

#### Invited state (isInvited = membership.status = 'invited')

**Status banner** (above bottom action button):
- Background with ✉️ icon
- Title: `You're Invited`
- Text: `{host.name} invited you to this circle`
- **Decline** button — `.update({ status: 'declined', responded_at })`, navigates to `previousView || 'allCircles'`
- **Accept** button — `.update({ status: 'accepted', responded_at })`, becomes member, page reloads

**Bottom action button (below banner):** `Request Pending` (disabled)
- Note: `isPending` is true for both invited and pending, so this button shows for both — the banner differentiates them

---

#### Requested state (isRequested = membership.status = 'pending')

**Status banner:**
- Background with ⏳ icon
- Title: `Request Pending`
- Text: `Waiting for {host.name || 'the host'} to approve your request`
- **Cancel Request** button — `.delete().eq('id', membership.id).eq('user_id', currentUser.id)`, refreshes circle details

**Bottom action button:** `Request Pending` (disabled, same as invited state)

---

#### Member state (isMember = status = 'accepted')

**Bottom action buttons (side by side):**
- **Chat** button (with MessageCircle icon) → `/messages?id={circleId}&type=circle`
- **Leave** button (with LogOut icon, red styling) → opens `showLeaveConfirm` modal

**Leave confirmation modal:**
- Title: `Leave "{circle.name}"?` with 👋 emoji
- Stay / Leave buttons
- Leave action: `.delete()` from `connection_group_members` with `count: 'exact'`
- On success: invalidates `circles-page-{userId}` and `home-primary-{userId}`, navigates to `previousView || 'allCircles'`

**Host-only additional actions:**
- Edit circle button (pencil icon in title section) — opens edit modal
- Circle photo upload (camera icon in header) — uploads to storage
- Schedule meetup button — navigates to `/schedule?type=circle&circleId=...`
- Edit/Delete meetup buttons (in next meetup section)

---

#### Invite Modal (when isMember clicks Invite)

**Content:**
- Title: `Invite to {circle.name}`
- Capacity check: If `memberCount + selectedInvites.length > maxMembers`, shows error: `This circle can have at most {max} members. Only {N} spot(s) left.`
- List of invitable connections (checkbox list)
- Cancel / Send buttons

**Send action:**
- Insert batch into `connection_group_members`
- **Status depends on role:**
  - If `isHost`: `status: 'invited'` (invitee can accept/decline directly)
  - If not host (regular member): `status: 'pending'` (admin must approve)
- Optimistic: adds invitees to local `members` state
- Reloads circle details

**CRITICAL — Behavior fixed 2026-04-12:**
Non-creator member invites insert as `'pending'`, not `'invited'`, so they flow through admin approval. RLS policy enforces this at the DB level via `migrations/fix-circle-member-invite-status.sql`.

---

**Failure points:**
- Join request 409 conflict if old membership row exists (fixed: delete + re-insert)
- `getOrCreateCircleMeetups` throws "Not authenticated" if session not ready
- Circle detail uses loading spinner instead of skeleton [from QA report]
- Invite modal capacity check shows toast error, does not submit

**Back navigation risks:**
- `previousView` hardcoded to "circles" [NAV-004]
- Coming from Home → circle card → back goes to /circles (should go to /home)
- Coming from Profile → shared circle → back goes to /circles (should go to /profile)
- Coming from Discover → back goes to /circles (should go to /discover)
- Page refresh → back always goes to /circles

**Empty states:**
- "Loading circle..." spinner (should be skeleton)
- "Circle not found" with 😕 emoji and "Go back" button
- No past sessions → section hidden
- No members to invite → "No connections available to invite"

**Data dependencies:** `connection_groups`, `connection_group_members`, `profiles`, `meetups` (circle meetups), `call_recaps`

---

### Journey 10: User Profile (Other)
**Trigger:** Click person card from Home, Circles, People, Search, or "Review" button in Home requests section
**User goal:** View someone's profile, connect, message, or schedule
**Suggested URL:** `/people/{userId}`
**Required dynamic route:** Yes (`[id]`)

**State detection (computed on page load):**
- `isOwnProfile = userId === currentUser.id`
- `isConnected` — from `profileData.isConnected` (mutual connection exists in `user_interests` both directions)
- `hasIncomingRequest` — target user has sent a connection request to me (exists in `user_interests` where `user_id = userId` AND `interested_in_user_id = currentUser.id`)
- `hasSentRequest` — I sent a request to them (exists in `user_interests` where `user_id = currentUser.id` AND `interested_in_user_id = userId`)
- `visibility` — from `profile.profile_visibility`: `'public'`, `'connections'`, or `'hidden'`

**Visibility gating:**
- If `visibility === 'hidden'` and not own profile → shows "This profile is private" message, no Connect button
- If `visibility === 'connections'` and not own profile and not connected → shows "Connect to see their full profile" gate

---

#### State: Not connected, no incoming request, no sent request

**Layout:**
1. Profile header (avatar, name, `@username`, active status, career)
2. Interest chips (e.g., "Early Career", "Wants to grow")
3. Stats row: Meetups count | Connections count | Shared Circles count (all show 0 for new user)
4. **Connect CTA button** (centered, filled brown #9E7868, with Users icon)
   - Text: `Connect`
   - Disabled state: `connecting || hasSentRequest`
5. "Report" link below (text button, for reporting the user)
6. Shared Circles section (if any exist)

**Action: Click "Connect"**
- Calls `handleSendConnectionRequest()`
- Inserts row into `user_interests` (`user_id` = me, `interested_in_user_id` = them)
- On duplicate (code 23505): sets `setLocalSentRequest(true)` silently
- On success:
  - `setLocalSentRequest(true)` (button state updates instantly)
  - `refreshProfile()` (re-fetches profile data)
  - `invalidateQuery('circles-sent-requests-{currentUser.id}')` (syncs Circles page)
- **Button transitions to "Request Sent" state** (see next)

#### State: Sent request pending (hasSentRequest = true)

**Connect button becomes:**
- Text: `Request Sent` (with Check icon instead of Users icon)
- Background: `COLORS.greenLight` instead of brown
- Color: `COLORS.green`
- Border: `1.5px solid {green}40`
- `cursor: 'default'` (no longer clickable from profile page)
- To withdraw: user must go to Circles page → Sent Requests section → Withdraw button

#### State: Incoming request (hasIncomingRequest = true)

**Shows banner above profile content** (in addition to the normal profile info):
- Text: `{firstName} wants to connect with you`
- **Accept button** (filled green, with Check icon): `Accept` / during processing: `Accepting...`
  - Calls `handleAcceptConnection()`
  - Inserts reciprocal row into `user_interests`
  - `refreshProfile()`, invalidates 3 cache keys (`circles-page`, `circles-peers`, `home-primary`)
  - Page state updates to "connected" (see next)
- **Ignore button** (outlined): `Ignore`
  - Calls `handleIgnoreConnection()`
  - Inserts row into `ignored_connection_requests`
  - Invalidates `home-primary-{userId}` cache (removes from Home requests section)

#### State: Connected (isConnected = true)

**Replaces Connect button with two buttons side by side:**
- **Message button** (filled brown, with MessageCircle icon): `Message`
  - Navigates to `/messages?id={userId}&type=user`
- **Coffee Chat button** (outlined, with Coffee icon): `Coffee Chat`
  - Navigates to `/schedule?type=coffee&connectionId={userId}&connectionName={name}`

**Additional "Remove Connection" option** (usually in a menu or further down):
- Opens confirmation modal with text: `Remove connection with {name}? You'll no longer see each other in your connections.`
- Cancel button → closes modal
- "Yes, Remove" button (red) → `handleRemoveConnection()`
  - Calls RPC `remove_mutual_connection({ other_user_id: userId })`
  - Optimistic update: removes user from `circles-page-{userId}` connections
  - Invalidates `circles-peers`, `home-primary`
  - Navigates to `previousView || 'connectionGroups'`

#### State: Own profile (isOwnProfile = true)

- No Connect/Message/Schedule buttons
- Edit Profile button visible (if `onEditProfile` callback provided)
- Can see own Settings section
- Back button goes to `previousView || 'home'`

---

**Failure points:**
- Profile may load slowly on first visit (SWR now caches)
- Skeleton shows on first load, cached data on return
- Hidden profiles blocked by visibility gate
- Self-request (attempting to connect with own profile) — not prevented in UI, will fail at DB level

**Back navigation risks:**
- `previousView` hardcoded to "discover" [NAV-003] — **Fixed** with `from=` param for dynamic routes
- Coming from Home (People to Meet) → uses `from=` param, works correctly
- Page refresh → loses `from=` param, falls back to "discover"

**Empty states:**
- No mutual circles → Shared Circles section hidden
- No past meetups together → hidden

**Data dependencies:** `profiles`, `get_mutual_matches` RPC, `user_interests`, `connection_group_members`, `call_recaps`, `feed_events`, `ignored_connection_requests`

---

### Journey 11: Own Profile
**Trigger:** Click avatar in nav bar
**User goal:** View/edit own profile, manage settings, log out
**Suggested URL:** `/profile`

**Steps:**
1. `/profile` loads own profile with stats
2. "Edit" → profile edit modal (from `onEditProfile` callback)
3. Toggle "Open to hosting meetups" → updates inline
4. Toggle "Open to coffee chats" → updates inline
5. Coffee chat slots (days/times) → updates inline
6. Shared Circles → circle card → `/circles/{circleId}`
7. Admin button (if admin) → `/admin`
8. "Log Out" → signs out → landing page

**Failure points:**
- `onEditProfile` callback not passed from `profile/page.js` → edit button may not work
- Toggle state uses SWR optimistic updates (may revert on error)

**Back navigation risks:**
- `previousView` hardcoded to "home" [NAV-010]
- Avatar is accessible from ANY page, back always goes to /home
- Expected: back should return to the page the user was on

**Data dependencies:** Own profile data from AuthProvider, `get_mutual_matches`, `connection_group_members`, `call_recaps`, `feed_events`

---

### Journey 12: People Directory
**Trigger:** "See all" from Home People to Meet, or Circles "See all people"
**User goal:** Browse and find people to connect with
**Suggested URL:** `/people`

**Steps:**
1. `/people` loads all community members
2. Search bar → filter by name, role, interest
3. Industry filter tabs → All, Tech, Entrepreneurship, etc.
4. Sort dropdown → Coffee chat open, Most connections
5. Person card click → `/people/{userId}`
6. "Connect" button → sends request inline
7. Back button → navigates to previousView

**Failure points:**
- Large member list could be slow (no pagination, loads all)

**Back navigation risks:**
- `previousView` hardcoded to "discover" in `people/page.js`
- Coming from Home → back goes to /discover (should go to /home)
- Coming from Circles → back goes to /discover (should go to /circles)

**Empty states:**
- "No results found. Try a different search or filter."
- "Know someone amazing?" → CTA at bottom

**Data dependencies:** `profiles`, `user_interests`, `get_mutual_matches`

---

### Journey 13: Browse Circles
**Trigger:** "See all" from Home Circles, Discover, or Circles page
**User goal:** Find circles to join
**Suggested URL:** `/circles/browse`

**Steps:**
1. `/circles/browse` loads
2. My Circles tab → circle card click → `/circles/{circleId}`
3. Open Circles tab → circle card click → `/circles/{circleId}`
4. "Create a Circle" → `/circles/new`
5. Back button → uses `from=` param, defaults to `/discover`

**Failure points:**
- None significant

**Back navigation risks:**
- ~~Back always goes to /home regardless of origin~~ **Fixed** — uses `from=` param

**Data dependencies:** `connection_groups`, `connection_group_members`

---

### Journey 14: Create Circle
**Trigger:** "Create a Circle" button from Circles, Discover, or Browse Circles
**User goal:** Create a new circle community
**Suggested URL:** `/circles/new`

**Steps:**
1. `/circles/new` loads form
2. Fill circle name, description, schedule, max members
3. Select members to invite (from connections)
4. Click "Create Circle"
5. On success → navigates to new circle detail page

**Failure points:**
- Validation: must have name, must invite 2-9 people
- Error: `alert('Error creating circle: ' + error.message)`
- Loading connections may be slow

**Back navigation risks:**
- No previousView passed, unclear back behavior
- Form state lost on navigation away

**Data dependencies:** `connection_groups` (insert), `connection_group_members` (insert), `profiles` (for member picker)

---

### Journey 15: Schedule Meetup
**Trigger:** "Host a Coffee Chat", "Schedule" from profile/circle, nav from various pages
**User goal:** Schedule a 1:1 coffee chat, circle meetup, or community event
**Suggested URL:** `/schedule?type={type}&circleId={id}&connectionId={id}&...`

**Steps:**
1. `/schedule` loads type selector: 1:1 Coffee Chat | Circle Meetup | Community Event
2. Select type → shows relevant form
3. Coffee chat: pick connection → pick time → confirm
4. Circle meetup: pick circle → pick time → confirm
5. Community event: fill details → confirm
6. After scheduling → navigates to `/events/{id}?category=coffee` (detail page)

**Failure points:**
- Pre-selected connection/circle from URL params may not match available options
- Missing connection when coming from profile of non-connection

**Back navigation risks:**
- `previousView` hardcoded to "home" [NAV-009]
- Coming from circle detail → back goes to /home (should go to circle)
- Coming from user profile → back goes to /home (should go to profile)
- Multi-step form: back button exits entire flow (doesn't go to previous step)

**Data dependencies:** `connections` (for coffee chat), `connection_groups` (for circle meetup), `meetups` (insert)

---

### Journey 16: Event / Coffee Chat Detail
**Trigger:** Click event card from Home, Coffee, Discover, or Circle detail
**User goal:** View event info, RSVP, join call, see recap
**Suggested URL:** `/events/{id}`
**Required dynamic route:** Yes (`[id]`)

**Steps (upcoming):**
1. Event info loads (topic, date, time, attendees)
2. "RSVP" / "Cancel RSVP" → inline
3. "Join call" (when live) → opens video call
4. Share event → generates shareable card
5. Attendee avatars → `/people/{userId}`

**Steps (past):**
1. Event summary + recap
2. "View Recap" → `/recaps/{recapId}`

**Failure points:**
- ~~`events/[id]/page.js` queries wrong table for coffee chats~~ **Fixed** — passes `?category=coffee` in URL, falls back to checking `coffee_chats` table if `meetups` query returns empty
- RSVP/cancel may fail silently

**Back navigation risks:**
- ~~`previousView` hardcoded to "coffee" [NAV-002]~~ **Fixed** — uses `from=` param
- Back now returns to actual referring page (Home, Discover, Circle, etc.)

**Data dependencies:** `meetups` or `coffee_chats`, `meetup_signups`, `call_recaps`, `profiles`

---

### Journey 17: Messages
**Trigger:** Message button from user profile, circle detail, or circles page
**User goal:** Send/receive messages with connections or circle groups
**Suggested URL:** `/messages`, `/messages?id={chatId}&type={user|circle}`

**Steps:**
1. `/messages` loads conversation list
2. Click conversation → opens chat thread
3. Type message → send → real-time delivery
4. "New Message" → compose modal → select contact
5. User avatar in chat → `/people/{userId}`

**Failure points:**
- No message pagination (could be slow with many messages)
- Real-time may disconnect silently
- `alert('Error sending message. Please try again.')` on send failure

**Back navigation risks:**
- `previousView` hardcoded to "home" [NAV-010]
- Coming from user profile → back goes to /home (should go to profile)
- Coming from circle detail → back goes to /home (should go to circle)

**Empty states:**
- "No conversations" with "New Message" CTA
- "No messages yet" in empty thread

**Data dependencies:** `messages` (real-time subscription), `profiles`, `connection_groups`

---

### Journey 18: Recaps
**Trigger:** Click recap from Coffee page or circle detail
**User goal:** Review AI-generated meeting summary
**Suggested URL:** `/recaps`, `/recaps/{id}`
**Required dynamic route:** Yes (`[id]`)

**Steps:**
1. `/recaps` loads recap list with filters (All, Unreviewed, Has Action Items)
2. Recap card click → `/recaps/{id}`
3. View AI summary, takeaways, action items
4. Back button → previous page

**Failure points:**
- Recap generation may fail (AI service unavailable)

**Back navigation risks:**
- No previousView passed to recap detail page
- Coming from circle detail → back destination unclear

**Data dependencies:** `call_recaps`, `recap_views`

---

### Journey 19: Proposals
**Trigger:** Navigate to proposals from admin
**User goal:** View and vote on meetup proposals
**Suggested URL:** `/proposals`

**Steps:**
1. `/proposals` loads proposal list
2. "Propose New Meetup" → form modal
3. Vote on existing proposals
4. Host from proposal → schedule meetup

**Failure points:**
- Missing `onNavigate` handler [NAV-006] → navigation from this page may break

**Back navigation risks:**
- No back button or previousView
- No `onNavigate` to navigate out

**Data dependencies:** `meetup_proposals`

---

### Journey 20: Admin Dashboard
**Trigger:** Admin button from profile page
**User goal:** View analytics, manage community
**Suggested URL:** `/admin`, `/admin/feedback`, `/admin/analytics`

**Steps:**
1. `/admin` loads dashboard cards
2. Click card → `/admin/feedback` or `/admin/analytics`
3. Admin sub-pages show data

**Failure points:**
- Sub-pages missing `onNavigate` [NAV-007]
- No admin role check on admin sub-pages (only on `/admin`)

**Back navigation risks:**
- Admin page uses direct `router.push` for sub-navigation
- Browser back works, but no in-app back button

**Data dependencies:** `get_admin_analytics` RPC, `feedback`

---

## Cross-Cutting Concerns

### Navigation Bar
- Home | Discover | Coffee | Circles tabs
- Logo → /home
- Avatar → /profile
- Search → navigates to result pages
- Active tab highlighting based on current route

### SWR Cache Invalidation After Mutations
| Action | Cache Keys to Invalidate |
|--------|-------------------------|
| Send connection request | `circles-page-{userId}`, `circles-sent-requests-{userId}` |
| Accept/decline connection | `circles-page-{userId}`, `home-primary-{userId}` |
| Join circle | `circles-page-{userId}` |
| Leave circle | `circles-page-{userId}` |
| Schedule coffee chat | `home-primary-{userId}`, `meetups-coffee-{userId}` |
| Schedule meetup | `home-primary-{userId}` |
| RSVP to event | `home-primary-{userId}` |
| Toggle coffee availability | `user-profile-{userId}-{currentUserId}` |
| Send message | (real-time, no cache invalidation needed) |

### Auth Gate
- All `app/(app)/` pages protected by `(app)/layout.js`
- Unauthenticated → redirected to landing
- Incomplete onboarding → ProfileSetupFlow
- Loading → spinner (no flash of content)

### Modals (no URL, state-only)
All modals use local component state. None have URLs. Browser back does NOT close modals — it navigates away. This is generally acceptable but could be improved with URL-based modals for:
- Circle invite modal
- Schedule meetup type selection
- Report user modal

---

## Suggested Improvements for URL Structure

### Dynamic previousView via searchParams — ✅ IMPLEMENTED
`createOnNavigate` now appends `from={currentPath}` to URLs. `getPreviousView` reads this param. For dynamic routes, returns `_path:{path}` which is handled as a direct `router.push()`. List pages and main tabs skip `from=` to avoid ping-pong navigation.

### Missing Routes to Add
- `pastMeetings` → `/coffee?view=past`
- Consider: `/circles/{id}/invite` for circle invite flow
- Consider: `/circles/{id}/settings` for circle edit

### Tab State in URL
- Coffee page Upcoming/Past tabs should update URL (`/coffee` vs `/coffee?view=past`)
- Currently tab state is local, lost on refresh

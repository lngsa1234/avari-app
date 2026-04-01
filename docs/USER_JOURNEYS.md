# CircleW User Journeys & Navigation Map

**Last updated:** 2026-03-31
**Purpose:** Document all user workflows, navigation paths, state transitions, and failure points for E2E testing.

---

## Architecture Overview

### Navigation System
- View components use `onNavigate(viewName, data)` callback
- `lib/navigationAdapter.js` translates view names to URLs via `createOnNavigate(router)`
- MainApp.js (legacy) uses `handleNavigate` which sets `currentView` state + syncs `selectedCircleId`, `selectedUserId`, etc.
- App Router pages hardcode `previousView` values (context is lost vs MainApp which tracked it dynamically)
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

| ID | Severity | Description | File | Impact |
|----|----------|-------------|------|--------|
| NAV-001 | **High** | `pastMeetings` not in ROUTES, navigates to 404 | `lib/navigationAdapter.js` | User clicks "View past" on coffee page, gets 404 |
| NAV-002 | **Medium** | Event detail `previousView` hardcoded to "coffee" | `events/[id]/page.js:24` | Back button always goes to /coffee, even when coming from Home or Discover |
| NAV-003 | **Medium** | User profile `previousView` hardcoded to "discover" | `people/[id]/page.js` | Back button goes to /discover even when coming from Circles or Home |
| NAV-004 | **Medium** | Circle detail `previousView` hardcoded to "circles" | `circles/[id]/page.js` | Back from circle always goes to /circles, not the actual referring page |
| NAV-005 | **Medium** | All hardcoded `previousView` values break after page refresh | All pages with hardcoded previousView | User refreshes → back button goes to hardcoded default, not actual history |
| NAV-006 | **Low** | Proposals page missing `onNavigate` handler | `proposals/page.js` | Navigation out of proposals may not work |
| NAV-007 | **Low** | Admin sub-pages missing `onNavigate` handler | `admin/feedback/page.js`, `admin/analytics/page.js` | Can't navigate from admin sub-pages |
| NAV-008 | **Low** | Discover page uses direct `router.push` for host meetup | `discover/page.js:38` | Inconsistent pattern, works but harder to maintain |
| NAV-009 | **Low** | `schedule/page.js` hardcodes `previousView="home"` | `schedule/page.js` | Back from schedule always goes home, even when opened from circle detail or profile |
| NAV-010 | **Low** | `messages/page.js` hardcodes `previousView="home"` | `messages/page.js` | Back from messages always goes home, even when opened from user profile or circle |

---

## Back Navigation Analysis

### Where Previous View Context Is Lost
In MainApp.js, `previousView` is tracked dynamically (set to the current view before transitioning). In App Router pages, `previousView` is **hardcoded per page**, so the actual referring page is lost.

| Page | Hardcoded previousView | Breaks When Coming From |
|------|----------------------|------------------------|
| `/circles/{id}` | "circles" | Home (circle card), Discover (circle card), Profile (shared circles) |
| `/people/{userId}` | "discover" | Home (People to Meet), Circles (connections), Search results |
| `/events/{id}` | "coffee" | Home (meetup card), Discover (event card), Circle detail (session) |
| `/profile` | "home" | Any page (avatar click in nav bar) |
| `/schedule` | "home" | Circle detail (schedule meetup), Profile (schedule coffee), Circles (schedule coffee) |
| `/messages` | "home" | User profile (message button), Circle detail (chat button), Circles (message button) |

### Flows That Reset to Home
- Profile back button → always /home
- Messages back button → always /home
- Schedule back button → always /home
- Any page refresh → previousView resets to hardcoded default

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

### Impossible Return Journeys
- Home → Circle card → Circle detail → Schedule meetup → Back → goes to /home (not circle detail)
- People → Person profile → Message → Back → goes to /home (not profile)
- Circle detail → Member profile → Schedule coffee → Back → goes to /home (not profile)
- Any page → Avatar → Profile → Back → goes to /home (not the actual previous page)

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

**Steps:**
1. `/home` loads with greeting + stats
2. Upcoming Meetups section → card click → `/events/{id}`
3. People to Meet section → card click → `/people/{userId}`
4. People to Meet → "Say hi" → sends connection request (inline, no navigation)
5. Circle to Join section → card click → `/circles/{circleId}`
6. Circle to Join → "Join" → sends join request (inline)
7. Live Feed → "Connect" → sends connection request
8. Live Feed → "Join" → `/circles/{circleId}`
9. Live Feed → "RSVP" → `/events/{meetupId}`
10. Requests section → Accept/Decline (inline, no navigation)
11. "View all" (meetups) → `/coffee`
12. "See all" (people) → `/people`
13. "See all" (circles) → `/circles/browse`

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

**Data dependencies:** `get_home_page_data` RPC, `connection_recommendations`, `circle_match_scores`, `event_recommendations`, `feed_events`

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

**Steps:**
1. `/circles` loads
2. My Connections → avatar click → `/people/{userId}`
3. My Connections → Message button → `/messages?id={userId}&type=user`
4. My Connections → Schedule Coffee → `/schedule?type=coffee&connectionId=...`
5. My Active Circles → "Discover" → `/circles/browse`
6. My Active Circles → circle card click → `/circles/{circleId}`
7. My Active Circles → Chat button → `/messages?id={circleId}&type=circle`
8. My Active Circles → "Get Started" / "Open Circle" → `/circles/{circleId}`
9. Recommend to Connect → "See all" → `/people`
10. Recommend to Connect → person card → `/people/{userId}`
11. Recommend to Connect → "Connect" → sends request inline
12. "Create a Circle" → `/circles/new`
13. Sent Requests → connection requests with Withdraw
14. Sent Requests → circle invites sent with Withdraw
15. Sent Requests → circle join requests with Withdraw

**Failure points:**
- Empty connections section when new user has 0 connections
- SWR cache not invalidated after actions on other pages

**Back navigation risks:**
- Circles is a main tab, back works normally
- Message/Schedule navigate away; back returns to circles (browser history)

**Empty states:**
- "No connections yet"
- No active circles → shows "Create a Circle" CTA

**Data dependencies:** `get_circles_page_data` RPC, `get_mutual_matches` RPC, `connection_group_members`, `user_interests`

---

### Journey 9: Circle Detail
**Trigger:** Click a circle card from Home, Discover, Circles, or Profile
**User goal:** View circle info, join/leave, chat, see members
**Suggested URL:** `/circles/{circleId}`
**Required dynamic route:** Yes (`[id]`)

**Steps (non-member):**
1. `/circles/{id}` loads circle info
2. "Request to Join" → confirmation modal → sends request (status: pending)
3. After request → "Request Pending" banner with "Cancel Request"

**Steps (invited):**
1. "You're Invited" banner → Accept / Decline
2. Accept → becomes member, page reloads
3. Decline → navigates to previous page

**Steps (member):**
1. Full circle info, schedule, members, past sessions
2. "Invite" → invite modal → select connections → send
3. "Chat" → `/messages?id={circleId}&type=circle`
4. Member avatar click → `/people/{userId}`
5. Past session card → `/recaps/{recapId}`
6. Schedule meetup → `/schedule?type=circle&circleId=...`
7. "Leave" → confirmation modal → leave → navigates to /circles

**Steps (host, additional):**
1. "Join Requests" section → Accept/Decline pending requests
2. "Pending Invites" section → shows invited users
3. Edit circle modal
4. Delete meetup confirmation

**Failure points:**
- Join request 409 conflict if old membership row exists (fixed: delete + re-insert)
- `getOrCreateCircleMeetups` throws "Not authenticated" if session not ready
- Circle detail uses loading spinner instead of skeleton [from QA report]

**Back navigation risks:**
- `previousView` hardcoded to "circles" [NAV-004]
- Coming from Home → circle card → back goes to /circles (should go to /home)
- Coming from Profile → shared circle → back goes to /circles (should go to /profile)
- Coming from Discover → back goes to /circles (should go to /discover)
- Page refresh → back always goes to /circles

**Empty states:**
- "Loading circle..." spinner (should be skeleton)
- No past sessions → section hidden
- No members to invite → "No connections available to invite"

**Data dependencies:** `connection_groups`, `connection_group_members`, `profiles`, `meetups` (circle meetups)

---

### Journey 10: User Profile (Other)
**Trigger:** Click person card from Home, Circles, People, or Search
**User goal:** View someone's profile, connect, message, or schedule
**Suggested URL:** `/people/{userId}`
**Required dynamic route:** Yes (`[id]`)

**Steps (not connected):**
1. Profile info loads (name, bio, career, stats)
2. "Connect" → sends connection request
3. After request → button shows "Request Sent"

**Steps (incoming request):**
1. "Accept" button → creates mutual connection
2. Page reloads with connected state

**Steps (connected):**
1. "Message" → `/messages?id={userId}&type=user`
2. "Schedule Coffee" → `/schedule?type=coffee&connectionId=...`
3. "Remove Connection" → confirmation → removes, navigates to previous
4. Shared Circles → circle card → `/circles/{circleId}`

**Steps (any):**
1. "Report" → report modal → submit

**Failure points:**
- Profile may load slowly on first visit (SWR now caches)
- Skeleton shows on first load, cached data on return

**Back navigation risks:**
- `previousView` hardcoded to "discover" [NAV-003]
- Coming from Home (People to Meet) → back goes to /discover (should go to /home)
- Coming from Circles (connection card) → back goes to /discover (should go to /circles)
- Coming from Search → back goes to /discover (should go to search results)
- Page refresh → back always goes to /discover

**Data dependencies:** `profiles`, `get_mutual_matches` RPC, `user_interests`, `connection_group_members`, `call_recaps`, `feed_events`

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
5. Back button → `/home` (hardcoded in component)

**Failure points:**
- No previousView passed from page

**Back navigation risks:**
- Back always goes to /home regardless of origin

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
6. After scheduling → navigates to `/coffee`

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
- `events/[id]/page.js` passes both `coffeeChatId={id}` and `meetupId={id}` — component uses whichever matches
- RSVP/cancel may fail silently

**Back navigation risks:**
- `previousView` hardcoded to "coffee" [NAV-002]
- Coming from Home (meetup card) → back goes to /coffee (should go to /home)
- Coming from Discover → back goes to /coffee (should go to /discover)
- Coming from Circle detail (past session) → back goes to /coffee (should go to circle)

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

### Dynamic previousView via searchParams
Instead of hardcoding `previousView`, pass it via URL:
```
/circles/abc123?from=home
/people/xyz789?from=circles
/events/evt456?from=discover
```
The page reads `searchParams.get('from')` and uses it for the back button. Falls back to a sensible default if missing.

### Missing Routes to Add
- `pastMeetings` → `/coffee?view=past`
- Consider: `/circles/{id}/invite` for circle invite flow
- Consider: `/circles/{id}/settings` for circle edit

### Tab State in URL
- Coffee page Upcoming/Past tabs should update URL (`/coffee` vs `/coffee?view=past`)
- Currently tab state is local, lost on refresh

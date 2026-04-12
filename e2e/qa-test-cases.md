# QA Test Cases — CircleW

Total: 85 test cases across 14 pages, 2 accounts

## 1. Authentication (4 tests)
- [ ] Landing page shows login/signup options
- [ ] Login with admin account succeeds, redirects to /home
- [ ] Login with member account succeeds, redirects to /home
- [ ] Invalid credentials shows error message

## 2. Home Page (8 tests per account = 16 tests)
### Admin
- [ ] Page loads without console errors
- [ ] "Upcoming Meetups" section visible (or empty state)
- [ ] "People to Meet" section visible (or empty state)
- [ ] "Live Feed" section visible
- [ ] "Requests waiting for you" shows join requests as "wants to join" (not "invited")
- [ ] "Requests waiting for you" shows connection requests with Accept/Decline
- [ ] Navigation bar has all 5 tabs (Home, Discover, Coffee, Circles, profile avatar)
- [ ] Clicking a person card navigates to their profile

### Member
- [ ] Same 8 tests from member perspective
- [ ] Circle invitations show "invited you to" with Accept/Decline
- [ ] No admin-only content leaking

## 3. Circles Page (10 tests per account = 20 tests)
### Admin
- [ ] Page loads, shows "Circles" heading
- [ ] "My Connections" section visible (or empty state "No connections yet")
- [ ] "My Active Circles" section visible (or empty state)
- [ ] "Create a Circle" button visible
- [ ] "Sent Requests" only shows actual sent invites (status=invited), NOT join requests
- [ ] "Sent Requests" shows own pending join requests as "Join request pending"
- [ ] Pending invitations section shows invites from others with Join button
- [ ] Circle card click navigates to circle detail
- [ ] "Recommend to Connect" / discover inline section works
- [ ] No console errors

### Member
- [ ] Same structural tests from member perspective
- [ ] Pending invitations show correct inviter name
- [ ] Sent Requests doesn't show items member didn't initiate

## 4. Circle Detail (12 tests)
### As Host/Creator
- [ ] Page loads with circle name, description
- [ ] Members section shows accepted members
- [ ] "Join Requests" section visible when pending members exist
- [ ] Accept join request removes from list immediately (optimistic)
- [ ] Decline join request removes from list immediately (optimistic)
- [ ] "Pending Invites" section shows invited members with Pending badge
- [ ] Invite button visible, opens invite modal
- [ ] Chat and Leave buttons visible

### As Member (non-creator)
- [ ] "Join Requests" section NOT visible (host-only)
- [ ] Invite button visible (members can invite)
- [ ] Member invite inserts as pending (admin approval required)
- [ ] Chat and Leave buttons visible

### As Non-member
- [ ] "Request to Join" button visible
- [ ] After requesting, shows "Request Pending" (not "You're Invited")

## 5. Circle Browse/Discover (4 tests)
- [ ] /circles/browse loads with circle listings
- [ ] Search by name/topic works
- [ ] Circle cards show member count, category
- [ ] Clicking a circle navigates to detail

## 6. Coffee/Meetups Page (8 tests)
- [ ] Page loads, shows upcoming coffee chats
- [ ] Shows group events section
- [ ] Accept coffee chat updates status immediately (optimistic)
- [ ] Decline coffee chat removes from list immediately (optimistic)
- [ ] RSVP to meetup updates attendee count immediately (optimistic)
- [ ] Cancel coffee chat removes from list immediately (optimistic)
- [ ] "Schedule" button navigates to schedule page
- [ ] No console errors

## 7. Discover Page (8 tests)
- [ ] Page loads with "Community Events" section
- [ ] "Trending Requests" section visible
- [ ] "Suggest" button opens modal
- [ ] Submit suggestion appears in list immediately (optimistic)
- [ ] Vote on a request shows "Voted" immediately (optimistic)
- [ ] Delete request (admin) removes immediately (optimistic)
- [ ] RSVP toggles immediately (optimistic)
- [ ] No console errors

## 8. People Page (6 tests)
- [ ] /people loads with people listings
- [ ] Search by name, role, city works
- [ ] "Suggested for You" section visible
- [ ] Connect button sends request
- [ ] Person card navigates to profile
- [ ] Respects profile visibility settings

## 9. User Profile (6 tests)
- [ ] /people/[id] loads with user info
- [ ] Shows name, career, location
- [ ] Connect/Connected status shown correctly
- [ ] Accept connection updates immediately
- [ ] Remove connection updates immediately (optimistic)
- [ ] Private profiles show appropriate message

## 10. Own Profile/Settings (6 tests)
- [ ] /profile loads with own info
- [ ] Settings toggles (open to hosting, coffee chat, transcription) update immediately
- [ ] Profile visibility dropdown works
- [ ] Coffee chat slots management works
- [ ] Edit profile opens modal
- [ ] No console errors

## 11. Messages (4 tests)
- [ ] /messages loads
- [ ] Shows conversation list (or empty state)
- [ ] Clicking a conversation shows messages
- [ ] No console errors

## 12. Schedule Page (3 tests)
- [ ] /schedule loads
- [ ] Shows meetup type selection
- [ ] Form fields visible for selected type

## 13. Cross-User Consistency (6 tests)
- [ ] Admin and member see consistent circle data
- [ ] Admin Sent Requests doesn't show member's join requests as invites
- [ ] Member pending request matches admin's received request
- [ ] Connection request visible on both sides
- [ ] Circle membership consistent between views
- [ ] Optimistic updates reflect on page revisit (cache invalidation)

## 14. Responsive/Mobile (4 tests)
- [ ] Home page renders correctly at 375px width
- [ ] Circles page renders correctly at 375px width
- [ ] Navigation bar visible on mobile
- [ ] No horizontal overflow on mobile

## Summary
- Authentication: 4
- Home: 16
- Circles: 20
- Circle Detail: 12
- Circle Browse: 4
- Coffee/Meetups: 8
- Discover: 8
- People: 6
- User Profile: 6
- Own Profile: 6
- Messages: 4
- Schedule: 3
- Cross-User: 6
- Responsive: 4
- **TOTAL: 107 test cases**

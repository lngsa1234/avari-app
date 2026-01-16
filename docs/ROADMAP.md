# Avari - Product Roadmap

**Last Updated:** 2026-01-09

Future enhancements and feature priorities for Avari.

---

## Current Version: 1.0

**Status:** Production-ready MVP

**Completed Features:**
- ✅ Authentication (Google OAuth + Email/Password)
- ✅ Profile management
- ✅ Hybrid meetups (in-person + video)
- ✅ 1:1 coffee chats (WebRTC)
- ✅ Group video calls (Agora, up to 17 participants)
- ✅ Direct messaging
- ✅ User connections and interests
- ✅ Screen sharing
- ✅ Client-side recording
- ✅ In-call chat

---

## High Priority

### 1. Fix Real-time Subscriptions in MainApp
**Status:** 🔴 Bug Fix
**Impact:** High (better UX, no manual refresh)
**Effort:** Medium (2-3 days)

**Problem:**
- Infinite re-render loop in React Strict Mode
- Currently disabled, requires manual refresh

**Solution:**
- Add `useCallback` to all subscription handlers
- Clean up dependency arrays
- Use refs for stable values
- Test thoroughly in Strict Mode

**Files:**
- `components/MainApp.js`

---

### 2. Message Pagination
**Status:** 🟡 Performance Enhancement
**Impact:** High (faster load for long conversations)
**Effort:** Medium (2-3 days)

**Features:**
- Load 50 messages initially
- Fetch more on scroll up
- Cursor-based pagination
- Loading indicator

**Implementation:**
```javascript
const loadMessages = async (cursor = null) => {
  let query = supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query;
  return data;
};
```

**Files:**
- `components/MessagesView.js`

---

### 3. Server-Side Call Recording
**Status:** 🟢 New Feature
**Impact:** High (full conversation recordings)
**Effort:** High (5-7 days)

**Features:**
- Integrate Agora Cloud Recording API
- Store recordings in Supabase Storage
- Provide download links
- Auto-delete after 30 days

**Implementation:**
- API route: `/api/start-recording`
- Call Agora Cloud Recording API
- Save recording metadata to database
- Webhook for recording completion

**Files:**
- `pages/api/start-recording.js`
- `pages/api/stop-recording.js`
- `pages/api/webhooks/agora-recording.js`
- Database: Add `recordings` table

**Cost:** $1.49 per 1,000 minutes (Agora Cloud Recording)

---

### 4. Push Notifications
**Status:** 🟢 New Feature
**Impact:** High (engagement, fewer missed messages)
**Effort:** Medium (3-4 days)

**Features:**
- Browser push notifications (Web Push API)
- Email notifications (SendGrid)
- Notification preferences
- In-app notification center

**Use Cases:**
- New message received
- Coffee chat request
- Meetup reminder (1 hour before)
- Someone expressed interest in you

**Implementation:**
- Service Worker for push notifications
- SendGrid integration for emails
- Database: Add `notification_preferences` table

**Files:**
- `public/sw.js`
- `pages/api/send-notification.js`
- `components/NotificationCenter.js`

---

### 5. User Blocking
**Status:** 🟡 Safety Feature
**Impact:** High (safety, harassment prevention)
**Effort:** Medium (2-3 days)

**Features:**
- Block other users
- Hide blocked users from recommendations
- Prevent messages/calls from blocked users
- Report abuse

**Implementation:**
- Database: Add `blocked_users` table
- Filter queries to exclude blocked users
- Add "Block User" button in profiles

**Files:**
- Database migration
- `components/UserProfile.js`
- `lib/blockHelpers.js`

---

## Medium Priority

### 6. Agora Token Authentication
**Status:** 🟡 Security Enhancement
**Impact:** Medium (production security)
**Effort:** Low (1-2 days)

**Features:**
- Server-side token generation
- Time-limited access (tokens expire)
- Role-based permissions (publisher/subscriber)

**Implementation:**
- Enable App Certificate in Agora Console
- Create `/api/agora-token` route
- Update client to fetch tokens before joining

**Files:**
- `pages/api/agora-token.js`
- `hooks/useAgora.js`

**See:** [API_INTEGRATIONS.md](./API_INTEGRATIONS.md#token-generation-future)

---

### 7. Profile Picture Upload
**Status:** 🟢 New Feature
**Impact:** Medium (better identity, engagement)
**Effort:** Medium (2-3 days)

**Features:**
- Upload profile picture to Supabase Storage
- Image cropping/resizing
- Optimize for web (WebP format)
- Placeholder avatars (initials)

**Implementation:**
- Supabase Storage bucket: `profile-pictures`
- Client-side image cropping (react-easy-crop)
- Server-side optimization (Sharp)

**Files:**
- `components/ProfilePictureUpload.js`
- `pages/api/upload-picture.js`

---

### 8. Calendar Integration
**Status:** 🟢 New Feature
**Impact:** Medium (better attendance)
**Effort:** Low (1-2 days)

**Features:**
- Export meetups to Google Calendar
- iCal format for Apple Calendar
- Auto-reminders (1 hour before, 1 day before)
- "Add to Calendar" button

**Implementation:**
```javascript
const generateICS = (meetup) => {
  return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${formatDate(meetup.date, meetup.time)}
SUMMARY:${meetup.title}
DESCRIPTION:${meetup.description}
LOCATION:${meetup.location || 'Video Call'}
END:VEVENT
END:VCALENDAR`;
};
```

**Files:**
- `lib/calendarHelpers.js`
- `components/AddToCalendarButton.js`

---

### 9. Meetup Analytics
**Status:** 🟢 New Feature
**Impact:** Medium (data-driven planning)
**Effort:** Medium (3-4 days)

**Features:**
- Track attendance rates
- Video call participation metrics
- Popular meetup times/locations
- User engagement charts

**Implementation:**
- Database: Add `meetup_analytics` table
- Admin dashboard component
- Charts library (Recharts)

**Files:**
- `components/AdminDashboard.js`
- `lib/analyticsHelpers.js`

---

### 10. Advanced Search & Filters
**Status:** 🟢 New Feature
**Impact:** Medium (easier discovery)
**Effort:** Medium (2-3 days)

**Features:**
- Search meetups by keyword
- Filter by date range, location, topic
- Search users by interests, location, career
- Save search preferences

**Implementation:**
- Full-text search in database (PostgreSQL `to_tsvector`)
- Filter UI components
- Search history (localStorage)

**Files:**
- `components/SearchFilters.js`
- `lib/searchHelpers.js`

---

## Low Priority / Nice-to-Have

### 11. Video Call Reactions
**Status:** 🟢 New Feature
**Impact:** Low (engagement)
**Effort:** Low (1-2 days)

**Features:**
- Emoji reactions during calls (👍 ❤️ 😂)
- Raise hand feature
- Animated overlays

---

### 12. Breakout Rooms
**Status:** 🟢 New Feature
**Impact:** Low (better networking)
**Effort:** High (5-7 days)

**Features:**
- Split group call into smaller rooms
- Random or manual assignment
- Timer for rotation

---

### 13. Transcription & Captions
**Status:** 🟢 New Feature
**Impact:** Medium (accessibility)
**Effort:** High (7-10 days)

**Features:**
- Real-time speech-to-text
- Save transcripts of calls
- Searchable meeting notes

**Cost:** $0.024 per minute (Google Speech-to-Text)

---

### 14. AI-Powered Recommendations
**Status:** 🟢 New Feature
**Impact:** Medium (better networking)
**Effort:** High (10-14 days)

**Features:**
- Match users by interests + career
- Suggest meetups based on preferences
- Auto-generate connection requests

**Implementation:**
- Vector embeddings for user profiles
- Cosine similarity matching
- Machine learning model

---

### 15. Gamification
**Status:** 🟢 New Feature
**Impact:** Low (engagement)
**Effort:** Medium (3-5 days)

**Features:**
- Badges for attendance milestones
- Leaderboard for most connected
- Rewards for hosting meetups

---

### 16. White-Label Platform
**Status:** 🟢 New Feature
**Impact:** High (B2B revenue)
**Effort:** Very High (30+ days)

**Features:**
- Custom branding for organizations
- Separate user bases per org
- Admin dashboard per org
- Multi-tenancy architecture

---

## Roadmap Timeline

### Q1 2026 (Jan-Mar)
- ✅ Launch MVP (completed)
- 🔴 Fix real-time subscriptions
- 🟡 Message pagination
- 🟡 User blocking

### Q2 2026 (Apr-Jun)
- 🟢 Push notifications
- 🟢 Server-side recording
- 🟡 Agora token auth
- 🟢 Profile picture upload

### Q3 2026 (Jul-Sep)
- 🟢 Calendar integration
- 🟢 Meetup analytics
- 🟢 Advanced search
- 🟢 Video reactions

### Q4 2026 (Oct-Dec)
- 🟢 Transcription & captions
- 🟢 AI-powered recommendations
- 🟢 Gamification
- 🟢 White-label (if funded)

---

## Feature Prioritization Matrix

**Impact vs Effort:**

```
High Impact, Low Effort:
- Calendar integration
- User blocking
- Agora token auth

High Impact, Medium Effort:
- Fix real-time subscriptions
- Message pagination
- Push notifications
- Profile picture upload

High Impact, High Effort:
- Server-side recording
- White-label platform

Low Impact, Low Effort:
- Video reactions
- Gamification (basic)

Low Impact, High Effort:
- Breakout rooms
```

---

## Feedback & Suggestions

Have ideas for new features? Open an issue on GitHub or contact the team.

---

**See also:**
- [Architecture](./ARCHITECTURE.md)
- [Design Decisions](./DESIGN_DECISIONS.md)

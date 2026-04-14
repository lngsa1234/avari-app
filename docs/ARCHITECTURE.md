# Avari - Architecture Overview

**Last Updated:** 2026-01-09

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Project Structure](#project-structure)
3. [Technology Stack](#technology-stack)
4. [Component Hierarchy](#component-hierarchy)
5. [Data Flow](#data-flow)

---

## System Architecture

### High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Browser Client                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Next.js Application                     │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  Pages                                      │  │  │
│  │  │  • LandingPage (auth)                       │  │  │
│  │  │  • MainApp (dashboard)                      │  │  │
│  │  │  • VideoCall (WebRTC 1:1)                   │  │  │
│  │  │  • GroupMeeting (Agora)                     │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │                                                    │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  Custom Hooks                               │  │  │
│  │  │  • useAgora (Agora SDK)                     │  │  │
│  │  │  • useSignaling (Socket.IO)                 │  │  │
│  │  │  • useRecording (MediaRecorder)             │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└────────┬──────────────┬──────────────┬────────────────┘
         │              │              │
    ┌────▼───┐    ┌────▼────┐    ┌───▼────────┐
    │Supabase│    │  Agora  │    │ Socket.IO  │
    │        │    │   RTC   │    │  Signaling │
    │• Auth  │    │  SDK-ng │    │   Server   │
    │• DB    │    │ (Groups)│    │  (WebRTC)  │
    │• RT    │    └─────────┘    └────────────┘
    └────────┘
```

### Architecture Principles

1. **Separation of Concerns**
   - Pages handle routing and layout
   - Components manage UI and user interactions
   - Hooks encapsulate business logic
   - Lib contains pure utility functions

2. **Real-time First**
   - Supabase Realtime for data sync
   - WebRTC for peer-to-peer video
   - Socket.IO for signaling
   - Optimistic UI updates

3. **Mobile-First Design**
   - Responsive layouts (Tailwind breakpoints)
   - Touch-friendly controls
   - Safe-area-inset for notched devices
   - Optimized for cellular networks

4. **Progressive Enhancement**
   - Works without JavaScript for auth pages
   - Fallback to polling if WebSocket fails
   - Manual refresh if real-time fails

---

## Project Structure

```
avari-app/
├── app/                              # Next.js 14 App Router
│   ├── layout.js                    # Root layout with AuthProvider
│   ├── page.js                      # Landing/home page
│   ├── globals.css                  # Global styles + Tailwind
│   ├── meeting/[id]/page.js         # 1:1 WebRTC video call page
│   ├── group-meeting/[id]/page.js   # Group Agora video page
│   └── reset-password/page.js       # Password reset flow
│
├── components/                       # React components
│   ├── AuthProvider.js              # Supabase auth context
│   ├── LandingPage.js               # Login/signup page
│   ├── MainApp.js                   # Main dashboard (2000+ lines)
│   ├── CoffeeChatsView.js           # 1:1 chat scheduling
│   ├── MessagesView.js              # Direct messaging UI
│   ├── VideoCall.tsx                # WebRTC component (TypeScript)
│   ├── VideoCallButton.js           # Launch video call button
│   ├── CompactMessagesView.js       # Compact message display
│   └── ProfileSetup.js              # User profile editor
│
├── hooks/                            # Custom React hooks
│   ├── useAgora.js                  # Agora SDK wrapper
│   ├── useSignaling.ts              # Socket.IO WebRTC signaling
│   ├── useRecording.js              # Video recording hook
│   ├── useIceServers.ts             # STUN/TURN configuration
│   └── useWakeLock.ts               # Screen wake-lock
│
├── lib/                              # Helper utilities
│   ├── supabase.js                  # Supabase client singleton
│   ├── agoraHelpers.js              # Agora room CRUD
│   └── coffeeChatHelpers.js         # Coffee chat logic
│
├── docs/                             # Documentation
│   ├── ARCHITECTURE.md              # This file
│   ├── DATABASE.md                  # Schema documentation
│   ├── DESIGN_DECISIONS.md          # Architectural choices
│   └── [other docs]
│
├── database-migration-agora.sql      # Agora schema
├── database-migration-call-messages.sql # In-call chat schema
├── .env.local                        # Environment variables
├── package.json                      # Dependencies
├── tailwind.config.js                # Tailwind configuration
└── AGORA_SETUP.md                    # Agora integration guide
```

### Directory Responsibilities

**`/app`**: Next.js pages and routing
- Each folder = a route
- `page.js` = route component
- `layout.js` = shared layout
- Uses App Router (not Pages Router)

**`/components`**: Reusable React components
- UI components only
- Should not contain business logic
- Props-based configuration
- Can use hooks from `/hooks`

**`/hooks`**: Custom React hooks
- Business logic encapsulation
- External API integrations
- State management
- Reusable across components

**`/lib`**: Pure utility functions
- No React dependencies
- Stateless helpers
- API clients (Supabase)
- Database operations

**`/docs`**: Technical documentation
- Architecture guides
- Feature specifications
- Deployment instructions

---

## Technology Stack

### Frontend Framework
- **Next.js 14.0.4**: React framework with App Router
- **React 18.2.0**: UI library
- **TypeScript**: For WebRTC hooks (`.ts`, `.tsx` files)
- **JavaScript**: For main components (`.js`, `.jsx` files)

### Styling & UI
- **Tailwind CSS 3.4.0**: Utility-first CSS framework
- **PostCSS 8.4.32**: CSS processing
- **Lucide React 0.263.1**: Icon library
- **React DatePicker 9.1.0**: Date/time selection

### Real-time Communication
- **Agora RTC SDK NG 4.24.2**: Group video calls (3-17 participants)
- **Socket.IO Client 4.8.3**: WebRTC signaling for 1:1 calls
- **Native WebRTC API**: Peer-to-peer video connections

### Backend & Database
- **Supabase 2.39.0**:
  - PostgreSQL database
  - Authentication (Google OAuth, Email/Password)
  - Realtime subscriptions
  - Row Level Security (RLS)

### Build & Deployment
- **Node.js 18+**: Runtime
- **npm**: Package manager
- **Vercel**: Recommended deployment platform

---

## Component Hierarchy

### Authentication Layer
```
App
└── AuthProvider (Context)
    ├── LandingPage (Unauthenticated)
    │   ├── Google OAuth Button
    │   ├── Email Signup Form
    │   └── Email Login Form
    │
    └── MainApp (Authenticated)
        ├── Navigation Tabs
        ├── Home Tab
        │   ├── Meetup List
        │   ├── Create Meetup Modal
        │   └── Meetup Details
        ├── Chats Tab
        │   └── CoffeeChatsView
        │       ├── Schedule Form
        │       ├── Upcoming Chats
        │       ├── Pending Requests
        │       └── Sent Requests
        ├── Messages Tab
        │   └── MessagesView
        │       ├── Conversation List
        │       ├── Message Thread
        │       └── Send Message Form
        └── Profile Tab
            └── Profile Editor
```

### Video Call Components
```
1:1 Video Call Page
└── VideoCall (TypeScript)
    ├── useSignaling (Socket.IO)
    ├── useIceServers (STUN/TURN)
    ├── Local Video
    ├── Remote Video
    └── Control Bar
        ├── Mute Button
        ├── Camera Button
        └── Hang Up Button

Group Video Call Page
└── GroupMeeting
    ├── useAgora (Agora SDK)
    ├── useRecording (MediaRecorder)
    ├── Grid View
    │   ├── Local Video
    │   └── Remote Videos (up to 16)
    ├── Speaker View
    │   ├── Main Speaker
    │   └── Thumbnail Strip
    ├── Control Bar
    │   ├── Mute Button
    │   ├── Camera Button
    │   ├── Screen Share Button
    │   ├── Record Button
    │   ├── Chat Button
    │   └── Leave Button
    └── Chat Panel
        ├── Message List
        └── Send Form
```

---

## Data Flow

### Authentication Flow
```
1. User lands on LandingPage
   ↓
2. User clicks "Sign in with Google"
   ↓
3. Redirect to Google OAuth consent screen
   ↓
4. Google redirects back with session
   ↓
5. AuthProvider detects session in URL
   ↓
6. Load user profile from database
   ↓
7. If no profile exists, auto-create one
   ↓
8. Set user + profile in context
   ↓
9. Render MainApp (authenticated view)
```

### Real-time Message Flow
```
User A sends message:
1. User A types message
   ↓
2. Clicks "Send"
   ↓
3. INSERT into messages table via Supabase
   ↓
4. Message appears immediately in User A's view
   ↓
5. Supabase triggers postgres_changes event
   ↓
6. User B's subscription receives event
   ↓
7. Message added to User B's state
   ↓
8. Message appears in User B's view
   ↓
9. Auto-mark as read (UPDATE messages)
```

### WebRTC Connection Flow (1:1)
```
User A initiates call:
1. User A requests coffee chat
   ↓
2. User B accepts
   ↓
3. Both navigate to /meeting/[roomId]
   ↓
4. Both connect to Socket.IO signaling server
   ↓
5. User A creates RTCPeerConnection
   ↓
6. User A creates SDP offer
   ↓
7. User A sends offer via Socket.IO
   ↓
8. User B receives offer
   ↓
9. User B creates RTCPeerConnection
   ↓
10. User B creates SDP answer
    ↓
11. User B sends answer via Socket.IO
    ↓
12. User A receives answer
    ↓
13. Both exchange ICE candidates via Socket.IO
    ↓
14. WebRTC connection established (P2P)
    ↓
15. Media streams flow directly between peers
```

### Agora Group Call Flow
```
User joins group video:
1. User clicks "Join Video Call"
   ↓
2. Create/retrieve Agora room from database
   ↓
3. Navigate to /group-meeting/[channelName]
   ↓
4. useAgora hook initializes Agora client
   ↓
5. Join channel with App ID + channel name
   ↓
6. Create local audio + video tracks
   ↓
7. Publish tracks to channel
   ↓
8. Listen for 'user-published' events
   ↓
9. Subscribe to each remote user's tracks
   ↓
10. Play remote tracks in video elements
    ↓
11. Display in grid/speaker view
```

---

## Performance Considerations

### Optimizations Implemented
1. **Singleton Supabase Client**: Single instance across app
2. **useRef for Stable Values**: Avoid unnecessary re-renders
3. **useCallback for Functions**: Memoize event handlers
4. **SessionStorage for State**: Persist across refreshes
5. **Lazy Subscriptions**: Only subscribe when needed
6. **Component Code-Splitting**: Large components separated
7. **Database Indexes**: On frequently queried columns

### Bundle Size
- Main bundle: ~500KB (gzipped)
- Agora SDK: ~300KB (loaded on-demand)
- Socket.IO: ~50KB

### Load Times (Target)
- Initial page load: < 2s
- WebRTC connection: 2-4s
- Agora connection: 1-2s
- Message delivery: < 100ms

---

## Scalability Considerations

### Current Limits
- **1:1 Video**: Peer-to-peer (scales perfectly)
- **Group Video**: Up to 17 participants per room
- **Database**: Supabase free tier (500MB, 2GB transfer/month)
- **Messages**: Unlimited storage, pagination recommended at 10K+ messages

### Scaling Strategy
1. **Horizontal Scaling**: Stateless Next.js (deploy to multiple regions)
2. **Database Scaling**: Upgrade Supabase tier or migrate to dedicated PostgreSQL
3. **CDN**: Use Vercel Edge for static assets
4. **Video Scaling**: Agora handles automatically (global network)

---

## Security Architecture

### Layers of Security
1. **Authentication**: Supabase JWT tokens
2. **Authorization**: Row Level Security (RLS) policies
3. **Network**: HTTPS only (enforced)
4. **Database**: Encrypted at rest (Supabase default)
5. **Video**: Agora uses DTLS-SRTP (encrypted media)

### Trust Boundaries
```
Browser (Untrusted)
    ↓ HTTPS + JWT
Supabase Auth (Trusted)
    ↓ RLS Policies
Database (Trusted)
```

### Attack Surface
- **XSS**: Mitigated by React (auto-escaping)
- **CSRF**: Mitigated by SameSite cookies + token validation
- **SQL Injection**: Impossible (Supabase parameterized queries)
- **Unauthorized Access**: Prevented by RLS policies

---

## Monitoring & Observability

### Recommended Monitoring
1. **Application Performance**
   - Vercel Analytics (free)
   - Web Vitals (LCP, FID, CLS)
   - Error tracking (Sentry recommended)

2. **Database Performance**
   - Supabase Dashboard metrics
   - Query performance logs
   - Connection pool usage

3. **Video Quality**
   - Agora Analytics Dashboard
   - Call quality metrics
   - Connection success rate

### Key Metrics to Track
- Authentication success rate
- Video call connection time
- Message delivery latency
- User retention rate
- Meetup attendance rate

---

**See also:**
- [Database Schema](./DATABASE.md)
- [Design Decisions](./DESIGN_DECISIONS.md)
- [API Integrations](./API_INTEGRATIONS.md)

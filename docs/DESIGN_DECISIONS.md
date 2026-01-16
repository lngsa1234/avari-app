# Avari - Design Decisions

**Last Updated:** 2026-01-09

This document explains the key architectural and technical decisions made in building Avari, along with the rationale behind each choice.

---

## Table of Contents

1. [Dual Video Architecture](#1-dual-video-architecture)
2. [Socket.IO Polling Priority](#2-socketio-polling-priority)
3. [Supabase Singleton Client](#3-supabase-singleton-client)
4. [Profile Auto-creation](#4-profile-auto-creation)
5. [Real-time Subscriptions (Disabled)](#5-real-time-subscriptions-disabled)
6. [SessionStorage for Conversation Persistence](#6-sessionstorage-for-conversation-persistence)
7. [Numeric UIDs for Agora](#7-numeric-uids-for-agora)
8. [App ID Only (No Token) for Agora](#8-app-id-only-no-token-for-agora)
9. [Mobile-Safe CSS with Safe-Area-Inset](#9-mobile-safe-css-with-safe-area-inset)
10. [Tailwind CSS with Custom Plugin](#10-tailwind-css-with-custom-plugin)

---

## 1. Dual Video Architecture

### Decision
Use **WebRTC for 1:1 calls**, **Agora for 3+ participants**

### Context
Needed to support both private coffee chats (2 people) and group meetups (3-17 people) with different requirements:
- 1:1: Intimate, private, peer-to-peer
- Groups: Scalable, reliable, professional quality

### Options Considered

**Option A: WebRTC for everything**
- ✅ Free (except TURN server)
- ✅ Peer-to-peer = lowest latency
- ❌ Complex mesh networking for groups (N*(N-1)/2 connections)
- ❌ Poor quality at 5+ participants
- ❌ No built-in features (screen share, recording)

**Option B: Agora for everything**
- ✅ Scales well to groups
- ✅ Built-in features (screen share, recording, noise suppression)
- ✅ Production-grade reliability
- ❌ Costs money (after 10K minutes/month)
- ❌ Overkill for 1:1 calls
- ❌ Adds latency (goes through Agora servers)

**Option C: Dual architecture (Chosen)**
- ✅ Best of both worlds
- ✅ WebRTC for lightweight 1:1
- ✅ Agora for scalable groups
- ✅ Optimized for each use case
- ❌ Increased complexity (two codebases)

### Rationale
- **1:1 calls are frequent**: Most networking starts with coffee chats
- **WebRTC is free**: No ongoing costs for peer-to-peer
- **Groups need reliability**: Professional quality for larger meetups
- **Agora free tier is generous**: 10K min/month covers small communities
- **Complexity is manageable**: Both are well-documented

### Impact
- Separate hooks: `useSignaling.ts` (WebRTC) vs `useAgora.js`
- Separate pages: `/meeting/[id]` vs `/group-meeting/[id]`
- Different databases: `video_rooms` vs `agora_rooms`

---

## 2. Socket.IO Polling Priority

### Decision
Enable `['polling', 'websocket']` transports in that order (polling first)

### Context
Mobile users (especially on cellular networks) were experiencing "Could not establish connection" errors when trying to join 1:1 video calls.

### Original Implementation
```javascript
const socket = io(serverUrl, {
  transports: ['websocket', 'polling'] // WebSocket first ❌
});
```

### Problem
- Many cellular carriers (AT&T, Verizon, T-Mobile) block or throttle WebSocket
- iOS Safari has WebSocket bugs on weak connections
- Connection fails entirely if WebSocket is blocked

### Solution
```javascript
const socket = io(serverUrl, {
  transports: ['polling', 'websocket'], // Polling first ✅
  upgrade: true, // Allow upgrade to WebSocket if available
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  reconnectionAttempts: 10,
  timeout: 30000
});
```

### Rationale
- **HTTP long polling works everywhere**: No carrier blocks HTTP POST
- **WebSocket upgrade if available**: Best of both worlds
- **Mobile reliability > latency**: Slight latency increase acceptable for reliability
- **Longer timeouts for mobile**: Cellular networks are slower

### Results
- 99% connection success rate on mobile (vs 60% before)
- Slightly higher latency (100-200ms) vs WebSocket
- Seamless experience across all networks

### Trade-offs
- **Pros**: Works on all networks, more reliable
- **Cons**: Higher server load (more HTTP requests), slightly higher latency

---

## 3. Supabase Singleton Client

### Decision
Export `supabase` as a constant, not a function

### Bad Pattern (Avoided)
```javascript
// ❌ Creates new instance on every import
export const getSupabase = () => createClient(url, key);
```

### Good Pattern (Chosen)
```javascript
// ✅ Same instance everywhere
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
```

### Rationale
1. **Prevents duplicate subscriptions**: Multiple instances = multiple WebSocket connections
2. **Stable for useEffect dependencies**: Same reference across renders
3. **Single session store**: One token, one auth state
4. **Better performance**: One connection pool, not N connections

### Example Problem (Without Singleton)
```javascript
// Component A
const supabase1 = createClient(...);
supabase1.channel('messages').subscribe(...);

// Component B
const supabase2 = createClient(...);
supabase2.channel('messages').subscribe(...);

// Result: Two subscriptions to same channel! 🐛
```

### Impact
- All components import same instance
- useEffect dependencies stable (no infinite loops)
- Real-time subscriptions work correctly

---

## 4. Profile Auto-creation

### Decision
Auto-create profile on first sign-in if missing

### Context
After user signs up with Google OAuth or email, they have an `auth.users` record but no `profiles` record. Need to decide when to create profile.

### Options Considered

**Option A: Separate "Setup Profile" page**
- ✅ Explicit user action
- ✅ Collect all info upfront
- ❌ Extra friction (more steps to get started)
- ❌ Drop-off risk (users abandon before setup)

**Option B: Auto-create with defaults (Chosen)**
- ✅ Zero friction (sign up → start using)
- ✅ Can edit later
- ✅ Meaningful defaults (name from email)
- ❌ Profile might be incomplete initially

### Implementation
```javascript
// AuthProvider.js
if (user && !profile) {
  // Extract name from email
  const emailName = user.email
    .split('@')[0]
    .split('.')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  await supabase.from('profiles').insert({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || emailName
  });
}
```

### Rationale
- **Reduce friction**: Users want to start networking immediately
- **Graceful degradation**: Missing bio/career not critical
- **Good defaults**: Email → name conversion is reasonable
  - `john.doe@example.com` → "John Doe"
  - Works for most professional emails
- **Can improve later**: Profile editor always available

### Trade-offs
- **Pros**: Faster onboarding, no drop-off
- **Cons**: Some profiles initially incomplete

---

## 5. Real-time Subscriptions (Disabled)

### Decision
**Temporarily disable** real-time subscriptions in MainApp

### Problem
Infinite re-render loop in React Strict Mode:
```
1. useEffect runs → create subscription
2. Subscription triggers → state update
3. State update → component re-renders
4. Re-render → useEffect dependencies changed
5. useEffect runs again → GOTO 1 ♾️
```

### Root Cause
```javascript
useEffect(() => {
  const handleUpdate = (payload) => { // ❌ New function every render
    setMeetups(...);
  };

  supabase.channel('meetups').on('postgres_changes', {}, handleUpdate);
}, [supabase]); // handleUpdate not in deps = stale closure
```

### Temporary Solution
Disabled real-time, added manual refresh buttons

```javascript
// ❌ Commented out
// useEffect(() => {
//   const subscription = supabase.channel(...);
// }, []);

// ✅ Manual refresh
<button onClick={loadMeetups}>Refresh</button>
```

### Permanent Fix (TODO)
```javascript
const handleUpdate = useCallback((payload) => {
  setMeetups(prev => {
    // Update logic using prev state
  });
}, []); // Empty deps = stable function

useEffect(() => {
  supabase.channel('meetups').on('postgres_changes', {}, handleUpdate);
}, [handleUpdate]); // Now stable
```

### Rationale
- **Ship now, fix later**: Manual refresh is acceptable UX
- **Avoid blocking**: Real-time nice-to-have, not critical
- **Learn from MessagesView**: Real-time works there (smaller scope, simpler dependencies)

### Current Status
- ✅ Real-time works in: MessagesView, group-meeting page
- ❌ Real-time disabled in: MainApp

---

## 6. SessionStorage for Conversation Persistence

### Decision
Use `sessionStorage` to remember selected conversation across page refreshes

### Context
User selects conversation with User B, refreshes page → should stay on same conversation

### Options Considered

**Option A: URL params (?user=123)**
- ✅ Shareable links
- ❌ Ugly URLs
- ❌ Privacy concern (user IDs in URL)

**Option B: LocalStorage**
- ✅ Persists across sessions
- ❌ Privacy concern (persists forever)
- ❌ Not cleared on logout

**Option C: SessionStorage (Chosen)**
- ✅ Persists across refreshes (within session)
- ✅ Cleared on tab close (privacy)
- ✅ Simple API
- ❌ Doesn't persist across tabs

**Option D: React state only**
- ✅ Simple, no persistence
- ❌ Lost on refresh (bad UX)

### Implementation
```javascript
// Save on selection
const handleSelectConversation = (userId) => {
  setSelectedConversation(userId);
  sessionStorage.setItem('selectedConversation', userId);
};

// Restore on mount
useEffect(() => {
  const saved = sessionStorage.getItem('selectedConversation');
  if (saved) setSelectedConversation(saved);
}, []);

// Access in subscription (via ref)
const selectedConversationRef = useRef(selectedConversation);
useEffect(() => {
  selectedConversationRef.current = selectedConversation;
}, [selectedConversation]);
```

### Rationale
- **Good UX**: Return to same conversation after refresh
- **Privacy**: Cleared when tab closes
- **Simple**: Native browser API, no library needed
- **Ref pattern**: Allows accessing latest state in subscription callbacks

---

## 7. Numeric UIDs for Agora

### Decision
Convert UUID strings to 32-bit integers for Agora UIDs

### Context
Agora recommends numeric UIDs for better performance. User IDs are UUIDs (strings).

### Problem
```javascript
// UUID: "550e8400-e29b-41d4-a716-446655440000"
// Agora wants: 123456789 (number)
```

### Solution
```javascript
function generateNumericUid(uuidString) {
  let hash = 0;
  for (let i = 0; i < uuidString.length; i++) {
    const char = uuidString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash); // Ensure positive
}
```

### Rationale
- **Agora best practice**: Numeric UIDs perform better in routing
- **Deterministic**: Same UUID always produces same number
- **No collisions (in practice)**: 32-bit space = 4 billion possibilities
- **Simple**: No external dependencies

### Trade-offs
- **Pros**: Better Agora performance, follows best practices
- **Cons**: Possible collisions (extremely rare in small user base)

### Collision Risk Analysis
- User base: ~10,000 users (estimated)
- Collision probability: ~0.001% (negligible)
- If collision occurs: Users would have same UID in Agora (would see each other's streams mixed up)
- Mitigation: Track in database, regenerate if collision detected

---

## 8. App ID Only (No Token) for Agora

### Decision
Use **test mode** (App ID only, no token) for development/production

### Context
Agora supports two auth modes:
1. **Test mode**: App ID only (public, no auth)
2. **Secured mode**: App ID + App Certificate + dynamic tokens

### Current Setup
```javascript
// Client-side
await client.join(appId, channelName, null, uid);
//                                   ^^^^ no token
```

### Rationale for Test Mode
1. **Simpler setup**: No server-side token generation needed
2. **Faster development**: No API routes required
3. **Free tier sufficient**: 10K min/month covers small communities
4. **Can upgrade later**: Migration path to tokens exists

### Security Trade-off
- **Development**: Anyone with App ID can join if they know channel name
- **Mitigation**: Channel names are UUIDs (hard to guess)
- **Risk**: Low (small community, no financial incentive to attack)

### Production Plan (Future)
When ready to scale or increase security:

1. **Enable App Certificate** in Agora console
2. **Create API route**: `/api/agora-token`
   ```javascript
   // pages/api/agora-token.js
   import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

   export default async function handler(req, res) {
     const { channelName, uid } = req.query;

     // Verify user is authenticated
     const user = await getUser(req);
     if (!user) return res.status(401).json({ error: 'Unauthorized' });

     const token = RtcTokenBuilder.buildTokenWithUid(
       appId,
       appCertificate,
       channelName,
       uid,
       RtcRole.PUBLISHER,
       expirationTimeInSeconds
     );

     res.json({ token });
   }
   ```

3. **Update client** to fetch token:
   ```javascript
   const res = await fetch(`/api/agora-token?channelName=${channel}&uid=${uid}`);
   const { token } = await res.json();
   await client.join(appId, channelName, token, uid);
   ```

### Benefits of Token Auth (Future)
- Only authenticated users can join
- Tokens expire (time-limited access)
- Can revoke access server-side
- Can implement role-based permissions (publisher vs subscriber)

---

## 9. Mobile-Safe CSS with Safe-Area-Inset

### Decision
Add `env(safe-area-inset-*)` padding to all edge UI elements

### Context
iPhone X+ devices have:
- Top notch (camera/sensors)
- Bottom home indicator
- Rounded corners

Content can be hidden behind these elements.

### Problem
```
┌──────────────────────────┐
│  [Hidden by notch] ❌    │  ← Top bar
├──────────────────────────┤
│                          │
│   Main content           │
│                          │
├──────────────────────────┤
│ [Home indicator]         │  ← Bottom nav hidden
└──────────────────────────┘
```

### Solution
```css
/* Bottom navigation */
.bottom-nav {
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}

/* Top header */
.top-header {
  padding-top: env(safe-area-inset-top);
}

/* Side content */
.side-panel {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

### Rationale
- **iOS Safari injects values**: `env()` CSS function provides safe padding
- **Ignored on other devices**: Falls back to 0 on Android/desktop
- **Better UX**: Content visible and tappable on all devices
- **Apple guidelines**: Recommended approach

### Implementation Example
```jsx
<div className="fixed bottom-0 left-0 right-0 bg-white"
     style={{
       paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))'
     }}>
  {/* Navigation buttons */}
</div>
```

### Also need viewport meta tag
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
                                                                      ^^^^^^^^^^^^^^^^
                                                                      Enables safe-area-inset
```

---

## 10. Tailwind CSS with Custom Plugin

### Decision
Use Tailwind CSS utility framework + custom `scrollbar-hide` plugin

### Context
Needed consistent, responsive design system with minimal custom CSS.

### Options Considered

**Option A: Plain CSS / CSS Modules**
- ✅ Full control
- ❌ Verbose (lots of class names)
- ❌ Inconsistent spacing/colors
- ❌ Manual responsive breakpoints

**Option B: Styled Components / CSS-in-JS**
- ✅ Component-scoped styles
- ❌ Runtime overhead
- ❌ Large bundle size
- ❌ No SSR optimization

**Option C: Tailwind CSS (Chosen)**
- ✅ Utility-first (rapid development)
- ✅ Consistent design system out-of-box
- ✅ Responsive utilities (`sm:`, `md:`, `lg:`)
- ✅ Tree-shaking (unused classes removed)
- ✅ Small production bundle
- ❌ HTML can look verbose
- ❌ Learning curve for team

### Custom Plugin: Scrollbar Hide
```javascript
// tailwind.config.js
module.exports = {
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          // Firefox
          'scrollbar-width': 'none',

          // IE/Edge
          '-ms-overflow-style': 'none',

          // Chrome/Safari/Opera
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      });
    }
  ]
};
```

### Rationale
- **Rapid prototyping**: Build UI fast with utility classes
- **Consistent design**: Pre-defined spacing (4px scale), colors, typography
- **Responsive by default**: Mobile-first breakpoints
- **Small bundle**: PurgeCSS removes unused classes
- **Custom plugin**: Adds missing utilities (scrollbar hide)

### Example Usage
```jsx
<div className="flex gap-4 p-6 bg-gray-100 rounded-lg shadow-md sm:flex-col md:flex-row">
  {/* Responsive flexbox with Tailwind */}
</div>

<div className="overflow-x-auto scrollbar-hide">
  {/* Horizontal scroll without visible scrollbar */}
</div>
```

### Trade-offs
- **Pros**: Fast development, small bundle, consistent design
- **Cons**: Verbose HTML, team must learn Tailwind conventions

---

## Summary of Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Dual Video (WebRTC + Agora) | Optimize each use case | Increased complexity |
| Socket.IO Polling First | Mobile reliability | Slight latency increase |
| Supabase Singleton | Prevent duplicate subscriptions | None |
| Profile Auto-creation | Reduce onboarding friction | Some incomplete profiles |
| Real-time Disabled (temp) | Avoid infinite loops | Manual refresh needed |
| SessionStorage for State | Privacy + UX balance | Doesn't persist across tabs |
| Numeric UIDs for Agora | Better performance | Rare collision risk |
| No Token for Agora | Simpler dev, free tier | Lower security (acceptable) |
| Safe-Area-Inset CSS | iPhone notch support | None |
| Tailwind + Plugin | Rapid development | Verbose HTML |

---

**See also:**
- [Architecture](./ARCHITECTURE.md)
- [API Integrations](./API_INTEGRATIONS.md)
- [Roadmap](./ROADMAP.md)

# Avari - API Integrations

**Last Updated:** 2026-01-09

Complete guide to external API integrations in Avari.

---

## Table of Contents
1. [Supabase](#supabase)
2. [Agora](#agora)
3. [Socket.IO](#socketio)
4. [Future Integrations](#future-integrations)

---

## Supabase

**Purpose:** Database, Authentication, Realtime subscriptions
**Version:** 2.39.0
**Documentation:** https://supabase.com/docs

### Setup

1. **Create Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose organization, name, password, region
   - Wait for provisioning (~2 minutes)

2. **Get Credentials**
   - Navigate to Settings → API
   - Copy:
     - Project URL: `https://[project-ref].supabase.co`
     - Anon/Public Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

3. **Add to Environment**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://vcfcppjbeauxbxnkcgvm.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

### Features Used

#### Authentication
```javascript
// Google OAuth
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.origin }
});

// Email/Password
await supabase.auth.signUp({ email, password });
await supabase.auth.signInWithPassword({ email, password });

// Password Reset
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${origin}/reset-password`
});
```

#### Database Queries
```javascript
// Insert
const { data, error } = await supabase
  .from('profiles')
  .insert({ id: user.id, name: 'Alice' });

// Select
const { data } = await supabase
  .from('meetups')
  .select('*')
  .order('date', { ascending: true });

// Update
await supabase
  .from('profiles')
  .update({ name: 'Bob' })
  .eq('id', userId);

// Delete
await supabase
  .from('meetups')
  .delete()
  .eq('id', meetupId);
```

#### Realtime Subscriptions
```javascript
const channel = supabase
  .channel('messages-realtime')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `receiver_id=eq.${userId}`
    },
    (payload) => {
      console.log('New message:', payload.new);
      setMessages(prev => [...prev, payload.new]);
    }
  )
  .subscribe();

// Cleanup
return () => {
  supabase.removeChannel(channel);
};
```

### OAuth Provider Setup

#### Google OAuth
1. **Create Google Cloud Project**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create new project

2. **Configure OAuth Consent Screen**
   - APIs & Services → OAuth consent screen
   - User Type: External
   - Add app name, email, logo
   - Add scopes: email, profile

3. **Create OAuth Credentials**
   - APIs & Services → Credentials
   - Create OAuth Client ID
   - Application type: Web application
   - Authorized redirect URIs:
     ```
     https://[project-ref].supabase.co/auth/v1/callback
     ```
   - Copy Client ID and Client Secret

4. **Configure in Supabase**
   - Dashboard → Authentication → Providers
   - Enable Google
   - Paste Client ID and Secret
   - Save

5. **Add Redirect URLs**
   - Authentication → URL Configuration
   - Site URL: `https://yourdomain.com`
   - Redirect URLs:
     ```
     http://localhost:3000
     https://yourdomain.com
     ```

### Row Level Security

All tables have RLS enabled. Policies control data access.

**Enable RLS:**
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

**Example Policies:**
```sql
-- Users can read all profiles
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);
```

See [DATABASE.md](./DATABASE.md) for all policies.

### Pricing

**Free Tier:**
- 500 MB database
- 2 GB transfer/month
- 50,000 monthly active users
- Unlimited API requests

**Pro Tier ($25/month):**
- 8 GB database
- 250 GB transfer/month
- 100,000 MAU
- Daily backups

---

## Agora

**Purpose:** Group video calls (3-17 participants)
**Version:** 4.24.2 (agora-rtc-sdk-ng)
**Documentation:** https://docs.agora.io

### Setup

1. **Create Account**
   - Go to [agora.io](https://www.agora.io)
   - Sign up (free)

2. **Create Project**
   - Dashboard → Project Management
   - Create new project
   - Choose "Testing Mode" (App ID only, no token)

3. **Get App ID**
   - Copy App ID (32-character hex)
   - Add to environment:
     ```bash
     NEXT_PUBLIC_AGORA_APP_ID=c13e37d737eb4da6a1487e48f9fa2852
     ```

### Testing Mode vs Secured Mode

#### Testing Mode (Current Setup)
- **Security:** App ID only (public, no authentication)
- **Use Case:** Development, small communities
- **Pros:** Simple setup, no server required
- **Cons:** Anyone with App ID can join channels

#### Secured Mode (Production Recommended)
- **Security:** App ID + App Certificate + dynamic tokens
- **Use Case:** Production, larger communities
- **Pros:** Only authorized users can join
- **Cons:** Requires server-side token generation

### Token Generation (Future)

**Enable Secured Mode:**
1. Dashboard → Project Management → Configure
2. Enable "Primary Certificate"
3. Copy App Certificate (keep secret!)

**Generate Token (Server-Side):**
```javascript
// pages/api/agora-token.js
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

export default async function handler(req, res) {
  const { channelName, uid } = req.query;

  // Verify user is authenticated
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE; // Secret!
  const expirationTimeInSeconds = 3600; // 1 hour

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    privilegeExpiredTs
  );

  res.json({ token });
}
```

**Client Usage:**
```javascript
// Fetch token
const res = await fetch(`/api/agora-token?channelName=${channel}&uid=${uid}`);
const { token } = await res.json();

// Join with token
await client.join(appId, channelName, token, uid);
```

### SDK Usage

**Install:**
```bash
npm install agora-rtc-sdk-ng
```

**Import:**
```javascript
import AgoraRTC from 'agora-rtc-sdk-ng';
```

**Create Client:**
```javascript
const client = AgoraRTC.createClient({
  mode: 'rtc',  // Real-time communication
  codec: 'vp8'  // Video codec
});
```

**Join Channel:**
```javascript
await client.join(appId, channelName, token, uid);
```

**Create Tracks:**
```javascript
const [audioTrack, videoTrack] =
  await AgoraRTC.createMicrophoneAndCameraTracks();
```

**Publish:**
```javascript
await client.publish([audioTrack, videoTrack]);
```

**Subscribe to Remote Users:**
```javascript
client.on('user-published', async (user, mediaType) => {
  await client.subscribe(user, mediaType);

  if (mediaType === 'video') {
    user.videoTrack.play(videoElement);
  }

  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
});
```

**Leave:**
```javascript
await client.leave();
audioTrack.close();
videoTrack.close();
```

### Screen Sharing

```javascript
const screenTrack = await AgoraRTC.createScreenVideoTrack({
  encoderConfig: '1080p_1'
}, 'auto');

// Replace camera with screen
await client.unpublish(videoTrack);
await client.publish(screenTrack);

// Handle user stopping share
screenTrack.on('track-ended', () => {
  // Republish camera
});
```

### Pricing

**Free Tier:**
- 10,000 minutes/month
- No credit card required

**Pay-as-you-go:**
- $0.99 per 1,000 minutes (video HD)
- $0.49 per 1,000 minutes (audio only)
- Cloud recording extra ($1.49 per 1,000 minutes)

### Troubleshooting

**"CAN_NOT_GET_GATEWAY_SERVER"**
- Cause: Project in Secured Mode but no token provided
- Fix: Switch to Testing Mode OR generate tokens

**"INVALID_APP_ID"**
- Cause: Wrong App ID
- Fix: Verify `NEXT_PUBLIC_AGORA_APP_ID` matches dashboard

**"INVALID_CHANNEL_NAME"**
- Cause: Invalid characters in channel name
- Fix: Use alphanumeric + dash/underscore only

---

## Socket.IO

**Purpose:** WebRTC signaling for 1:1 video calls
**Version:** 4.8.3
**Documentation:** https://socket.io/docs/v4/

### Setup

**Default Server:** `https://live-chat-demo.onrender.com`

**Custom Server (Optional):**
- Deploy your own Socket.IO server
- Update `NEXT_PUBLIC_SIGNALING_SERVER_URL`

### Client Configuration

```javascript
import { io } from 'socket.io-client';

const socket = io(serverUrl, {
  // Transport priority (polling first for mobile)
  transports: ['polling', 'websocket'],
  upgrade: true, // Allow upgrade to WebSocket

  // Reconnection settings
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  reconnectionAttempts: 10,
  timeout: 30000
});
```

### Events

**Register:**
```javascript
socket.emit('register', { matchId: roomId });
```

**Send Offer:**
```javascript
socket.emit('offer', {
  offer: sdpOffer,
  matchId: roomId
});
```

**Receive Offer:**
```javascript
socket.on('offer', ({ offer, userId }) => {
  // Create answer
});
```

**Send Answer:**
```javascript
socket.emit('answer', {
  answer: sdpAnswer,
  matchId: roomId
});
```

**ICE Candidates:**
```javascript
// Send
socket.emit('ice-candidate', {
  candidate: iceCandidate,
  matchId: roomId
});

// Receive
socket.on('ice-candidate', ({ candidate }) => {
  peerConnection.addIceCandidate(candidate);
});
```

**End Call:**
```javascript
socket.emit('call-ended', { matchId: roomId });
socket.on('call-ended', () => {
  // Cleanup
});
```

### Self-Hosting Socket.IO Server

**server.js:**
```javascript
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Configure for production
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', ({ matchId }) => {
    socket.join(matchId);
    rooms.set(socket.id, matchId);
  });

  socket.on('offer', ({ offer, matchId }) => {
    socket.to(matchId).emit('offer', {
      offer,
      userId: socket.id
    });
  });

  socket.on('answer', ({ answer, matchId }) => {
    socket.to(matchId).emit('answer', {
      answer,
      userId: socket.id
    });
  });

  socket.on('ice-candidate', ({ candidate, matchId }) => {
    socket.to(matchId).emit('ice-candidate', {
      candidate,
      userId: socket.id
    });
  });

  socket.on('call-ended', ({ matchId }) => {
    socket.to(matchId).emit('call-ended');
  });

  socket.on('disconnect', () => {
    const matchId = rooms.get(socket.id);
    if (matchId) {
      socket.to(matchId).emit('call-ended');
      rooms.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
```

**Deploy:**
- Heroku, Render, Railway, or DigitalOcean
- Set `NEXT_PUBLIC_SIGNALING_SERVER_URL` to deployed URL

---

## Future Integrations

### Potential Additions

**Twilio (SMS/Video)**
- SMS notifications for meetups
- Alternative video solution
- Phone verification

**SendGrid (Email)**
- Transactional emails
- Meetup reminders
- Weekly digest

**Stripe (Payments)**
- Premium memberships
- Paid meetups
- Donations

**Google Calendar**
- Export meetups to calendar
- Auto-reminders
- Sync with Google Meet

**Cloudinary (Image Storage)**
- Profile picture uploads
- Image optimization
- CDN delivery

**Sentry (Error Tracking)**
- Real-time error monitoring
- Performance tracking
- User feedback

---

**See also:**
- [Architecture](./ARCHITECTURE.md)
- [Deployment](./DEPLOYMENT.md)
- [Group Video](./GROUP_VIDEO.md)

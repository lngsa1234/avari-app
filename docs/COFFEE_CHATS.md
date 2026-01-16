# Avari - Coffee Chats (1:1 Video Calls)

**Last Updated:** 2026-01-09

Complete guide to 1:1 video calls using WebRTC and Socket.IO.

---

## Table of Contents
1. [Overview](#overview)
2. [User Flow](#user-flow)
3. [Architecture](#architecture)
4. [Implementation](#implementation)
5. [Troubleshooting](#troubleshooting)

---

## Overview

**Purpose:** Private 1:1 video conversations between users
**Technology:** WebRTC (native browser API) + Socket.IO signaling
**Quality:** Peer-to-peer (lowest latency, highest quality)

### Key Features
- Request coffee chats with other users
- Schedule specific date/time
- Accept/decline requests
- Join video call with one click
- Mute/unmute audio
- Turn camera on/off
- Screen sharing
- Client-side recording (MediaRecorder)
- In-call text chat (Supabase Realtime)
- Hang up

---

## User Flow

### Request Flow
```
1. User A navigates to "Chats" tab
   ↓
2. Clicks "Schedule" sub-tab
   ↓
3. Selects User B from dropdown
   ↓
4. Picks date/time, adds notes
   ↓
5. Clicks "Send Request"
   ↓
6. INSERT into coffee_chats (status='pending')
   ↓
7. Request appears in User A's "Sent" tab
```

### Accept Flow
```
1. User B's subscription triggers (Supabase Realtime)
   ↓
2. Request appears in User B's "Requests" tab
   ↓
3. User B clicks "Accept"
   ↓
4. UPDATE coffee_chats (status='accepted')
   ↓
5. Create video_rooms record
   ↓
6. Both users see "Join Video Call" button in "Upcoming" tab
```

### Video Call Flow
```
1. User A clicks "Join Video Call"
   ↓
2. Navigate to /meeting/[roomId]
   ↓
3. Request camera/microphone permissions
   ↓
4. Connect to Socket.IO signaling server
   ↓
5. Create RTCPeerConnection
   ↓
6. User A creates SDP offer → send via Socket.IO
   ↓
7. User B receives offer → creates SDP answer → send back
   ↓
8. Both exchange ICE candidates via Socket.IO
   ↓
9. WebRTC connection established (P2P)
   ↓
10. Display local + remote video
```

---

## Architecture

### WebRTC Overview

**WebRTC = Web Real-Time Communication**
- Peer-to-peer media streaming
- No intermediary server (after connection)
- Low latency, high quality
- Built into all modern browsers

**Components:**
1. **getUserMedia**: Access camera/microphone
2. **RTCPeerConnection**: Manage peer connection
3. **ICE (Interactive Connectivity Establishment)**: Find network path
4. **STUN/TURN servers**: Help with NAT traversal
5. **Signaling**: Exchange connection info (via Socket.IO)

### Signaling Server (Socket.IO)

**Purpose:** Exchange SDP offers/answers and ICE candidates

**Not transmitted over WebRTC:** Connection setup info only
**Server:** `https://live-chat-demo.onrender.com` (default)

**Events:**
- `register`: Associate socket with room ID
- `offer`: Send SDP offer (caller)
- `answer`: Send SDP answer (callee)
- `ice-candidate`: Send ICE candidate (both)
- `call-ended`: End call

---

## Implementation

### 1. Request Coffee Chat

**Component:** `components/CoffeeChatsView.js`

**Form:**
```jsx
<form onSubmit={handleSubmitRequest}>
  <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
    <option value="">Select a user</option>
    {availableUsers.map(user => (
      <option key={user.id} value={user.id}>{user.name}</option>
    ))}
  </select>

  <DatePicker
    selected={scheduledTime}
    onChange={(date) => setScheduledTime(date)}
    showTimeSelect
    minDate={new Date()}
  />

  <textarea
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
    placeholder="Add a note (optional)"
  />

  <button type="submit">Send Request</button>
</form>
```

**Submit Handler:**
```javascript
const handleSubmitRequest = async (e) => {
  e.preventDefault();

  await requestCoffeeChat(
    selectedUser,
    scheduledTime,
    notes
  );

  // Reset form
  setSelectedUser('');
  setScheduledTime(null);
  setNotes('');

  // Refresh lists
  loadSentRequests();
};
```

**Helper:** `lib/coffeeChatHelpers.js`

```javascript
export async function requestCoffeeChat(recipientId, scheduledTime, notes) {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('coffee_chats')
    .insert({
      requester_id: user.id,
      recipient_id: recipientId,
      scheduled_time: scheduledTime,
      status: 'pending',
      notes: notes
    });

  if (error) throw error;
}
```

---

### 2. Accept Request

**Component:** `components/CoffeeChatsView.js`

**Accept Handler:**
```javascript
const handleAcceptRequest = async (chatId) => {
  await acceptCoffeeChat(chatId);

  // Refresh lists
  loadPendingRequests();
  loadUpcomingChats();
};
```

**Helper:** `lib/coffeeChatHelpers.js`

```javascript
export async function acceptCoffeeChat(chatId) {
  const { data: { user } } = await supabase.auth.getUser();

  // Get chat details
  const { data: chat } = await supabase
    .from('coffee_chats')
    .select('*')
    .eq('id', chatId)
    .single();

  // Create video room
  const roomId = generateUUID();
  const { data: room } = await supabase
    .from('video_rooms')
    .insert({
      room_id: roomId,
      participants: [chat.requester_id, chat.recipient_id],
      created_by: user.id
    })
    .select()
    .single();

  // Update chat status
  await supabase
    .from('coffee_chats')
    .update({
      status: 'accepted',
      video_link: roomId
    })
    .eq('id', chatId);

  return roomId;
}
```

---

### 3. Video Call Component

**File:** `components/VideoCall.tsx` (TypeScript)

**Initialize Call:**
```typescript
const initializeCall = async () => {
  try {
    // Get user media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    setLocalStream(stream);

    // Display local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    // Setup peer connection
    await setupPeerConnection(stream);

    // Setup signaling
    await setupRealtimeSignaling();

  } catch (error) {
    console.error('Error initializing call:', error);
    setError('Failed to access camera/microphone');
  }
};
```

**Setup Peer Connection:**
```typescript
const setupPeerConnection = async (stream: MediaStream) => {
  // Get ICE servers (STUN/TURN)
  const iceServers = await fetchIceServers();

  // Create peer connection
  const pc = new RTCPeerConnection({ iceServers });

  // Add local tracks
  stream.getTracks().forEach(track => {
    pc.addTrack(track, stream);
  });

  // Handle remote track
  pc.ontrack = (event) => {
    console.log('Remote track received');
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = event.streams[0];
    }
  };

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate && socket) {
      socket.emit('ice-candidate', {
        candidate: event.candidate,
        matchId: roomId
      });
    }
  };

  // Handle connection state
  pc.onconnectionstatechange = () => {
    console.log('Connection state:', pc.connectionState);
    if (pc.connectionState === 'connected') {
      setCallStatus('connected');
    }
  };

  setPeerConnection(pc);
  return pc;
};
```

**Setup Signaling:**
```typescript
const setupRealtimeSignaling = async () => {
  const socketUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL;

  const socketInstance = io(socketUrl, {
    transports: ['polling', 'websocket'],
    upgrade: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: 10,
    timeout: 30000
  });

  // Register with room
  socketInstance.emit('register', { matchId: roomId });

  // Handle offer (callee)
  socketInstance.on('offer', async ({ offer }) => {
    if (!peerConnection) return;

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socketInstance.emit('answer', {
      answer,
      matchId: roomId
    });
  });

  // Handle answer (caller)
  socketInstance.on('answer', async ({ answer }) => {
    if (!peerConnection) return;

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  });

  // Handle ICE candidates
  socketInstance.on('ice-candidate', async ({ candidate }) => {
    if (!peerConnection) return;

    await peerConnection.addIceCandidate(
      new RTCIceCandidate(candidate)
    );
  });

  // Handle call ended
  socketInstance.on('call-ended', () => {
    handleCallEnded();
  });

  setSocket(socketInstance);

  // If caller, create offer
  if (isCaller) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socketInstance.emit('offer', {
      offer,
      matchId: roomId
    });
  }
};
```

---

### 4. ICE Servers

**Hook:** `hooks/useIceServers.ts`

**Fetch Servers:**
```typescript
export const fetchIceServers = async (): Promise<RTCIceServer[]> => {
  const stunServer = process.env.NEXT_PUBLIC_STUN_SERVER_URL ||
    'stun:stun.l.google.com:19302';

  const iceServers: RTCIceServer[] = [
    { urls: stunServer }
  ];

  // Add TURN server if configured
  if (process.env.NEXT_PUBLIC_TURN_SERVER_URL) {
    iceServers.push({
      urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
      username: process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_SERVER_CREDENTIAL
    });
  }

  return iceServers;
};
```

**STUN vs TURN:**
- **STUN (Session Traversal Utilities for NAT):** Helps discover public IP
- **TURN (Traversal Using Relays around NAT):** Relays media if P2P fails
- **Default:** Google STUN (free, public)
- **Production:** Add TURN for reliability (Twilio, Xirsys)

---

### 5. Control Buttons

**Mute/Unmute:**
```typescript
const handleToggleMute = () => {
  if (!localStream) return;

  localStream.getAudioTracks().forEach(track => {
    track.enabled = !track.enabled;
  });

  setIsMuted(!isMuted);
};
```

**Camera On/Off:**
```typescript
const handleToggleVideo = () => {
  if (!localStream) return;

  localStream.getVideoTracks().forEach(track => {
    track.enabled = !track.enabled;
  });

  setIsVideoOff(!isVideoOff);
};
```

**Hang Up:**
```typescript
const handleHangUp = async () => {
  // Stop local stream
  localStream?.getTracks().forEach(track => track.stop());

  // Close peer connection
  peerConnection?.close();

  // Notify remote peer
  socket?.emit('call-ended', { matchId: roomId });

  // Navigate away
  router.push('/');
};
```

---

### 6. Screen Sharing

**Implementation:** `components/VideoCall.tsx` (lines 340-390)

**Start Screen Sharing:**
```typescript
const toggleScreenShare = async () => {
  try {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }

      // Replace with camera
      if (peerConnectionRef.current && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }

      setIsScreenSharing(false);
    } else {
      // Start screen sharing
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always'
        },
        audio: false
      });

      screenStreamRef.current = screenStream;

      // Replace camera with screen
      if (peerConnectionRef.current) {
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
      }

      // Handle user stopping share via browser button
      screenStream.getVideoTracks()[0].onended = () => {
        toggleScreenShare();
      };

      setIsScreenSharing(true);
    }
  } catch (error) {
    console.error('Error toggling screen share:', error);
  }
};
```

**Key Points:**
- Uses `navigator.mediaDevices.getDisplayMedia()` to capture screen
- Replaces video track dynamically using `RTCRtpSender.replaceTrack()`
- No need to renegotiate SDP offer/answer
- Automatically stops when user clicks browser "Stop Sharing" button
- Shows cursor by default (`cursor: 'always'`)

---

### 7. Recording

**Hook:** `hooks/useRecording.js`

**Implementation:**
```typescript
const {
  isRecording,
  recordingTime,
  startRecording,
  stopRecording,
  formatTime
} = useRecording();

const toggleRecording = async () => {
  try {
    if (isRecording) {
      stopRecording();
    } else {
      // Record local video stream
      if (localStreamRef.current) {
        await startRecording(localStreamRef.current);
      }
    }
  } catch (error) {
    console.error('Error toggling recording:', error);
  }
};
```

**How It Works:**
```typescript
const startRecording = async (stream) => {
  // Create MediaRecorder
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp8,opus'
  });

  // Collect data chunks
  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunksRef.current.push(event.data);
    }
  };

  // Auto-download when stopped
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `avari-call-${new Date().toISOString()}.webm`;
    a.click();

    URL.revokeObjectURL(url);
  };

  // Start recording (collect chunks every second)
  mediaRecorder.start(1000);
  setIsRecording(true);

  // Start timer
  timerRef.current = setInterval(() => {
    setRecordingTime(prev => prev + 1);
  }, 1000);
};
```

**Features:**
- Records local video/audio stream only
- WebM format with VP8 video and Opus audio codecs
- Shows recording indicator with timer (MM:SS format)
- Auto-downloads recording when stopped
- Client-side only (no server upload)

**Limitations:**
- Only records local stream (not remote participant)
- No mixing of remote audio/video
- Browser-dependent codec support
- Large file sizes for long calls

**Future Enhancements:**
- Mix remote stream audio for complete call recording
- Upload to Supabase Storage
- Server-side recording option
- Support for other formats (MP4)

---

### 8. In-Call Chat

**Implementation:** `components/VideoCall.tsx` (lines 410-443, 558-605, 781-848)

**Database:** Supabase `call_messages` table

**Send Message:**
```typescript
const handleSendMessage = async (e) => {
  e.preventDefault();
  if (!newMessage.trim()) return;

  try {
    const { data, error } = await supabase
      .from('call_messages')
      .insert({
        channel_name: `video-${matchId}`,
        user_id: userId,
        user_name: currentUserName,
        message: newMessage.trim()
      })
      .select()
      .single();

    if (error) throw error;

    setNewMessage('');

    // Manually add if real-time doesn't work
    if (data) {
      setMessages(prev => {
        const exists = prev.some(m => m.id === data.id);
        if (!exists) {
          return [...prev, data];
        }
        return prev;
      });
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
};
```

**Real-Time Subscription:**
```typescript
useEffect(() => {
  const channelName = `video-${matchId}`;

  // Load existing messages
  const loadMessages = async () => {
    const { data } = await supabase
      .from('call_messages')
      .select('*')
      .eq('channel_name', channelName)
      .order('created_at', { ascending: true })
      .limit(100);

    if (data) {
      setMessages(data);
    }
  };

  loadMessages();

  // Subscribe to new messages
  const channel = supabase
    .channel(`call-messages-${channelName}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_messages',
        filter: `channel_name=eq.${channelName}`
      },
      (payload) => {
        console.log('New message:', payload.new);
        setMessages(prev => {
          const exists = prev.some(m => m.id === payload.new.id);
          if (!exists) {
            return [...prev, payload.new as Message];
          }
          return prev;
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [matchId]);
```

**UI Features:**
- Sliding panel on right side (80% width on mobile)
- Shows sender name and timestamp
- Auto-scrolls to latest message
- Message length limit (500 characters)
- Unread message badge on chat button
- Different colors for own vs. partner messages

**Chat Panel Layout:**
```jsx
{showChat && (
  <div className="fixed right-0 top-0 bottom-0 w-80 bg-gray-800 border-l border-gray-700 flex flex-col z-50">
    {/* Header */}
    <div className="p-4 border-b border-gray-700 flex items-center justify-between">
      <h3 className="text-white font-semibold">Chat</h3>
      <button onClick={() => setShowChat(false)}>✕</button>
    </div>

    {/* Messages */}
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg) => (
        <div key={msg.id}
          className={msg.user_id === userId ? 'ml-auto bg-purple-600' : 'mr-auto bg-gray-700'}>
          <p className="text-xs text-gray-300">{msg.user_id === userId ? 'You' : msg.user_name}</p>
          <p className="text-white text-sm">{msg.message}</p>
          <p className="text-xs text-gray-400">
            {new Date(msg.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      ))}
    </div>

    {/* Input */}
    <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
      <div className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          maxLength={500}
        />
        <button type="submit" disabled={!newMessage.trim()}>
          Send
        </button>
      </div>
    </form>
  </div>
)}
```

---

## Troubleshooting

### Permission Denied
**Error:** `NotAllowedError: Permission denied`
**Cause:** User denied camera/microphone access
**Fix:**
1. Click camera icon in browser address bar
2. Allow permissions
3. Reload page

### Connection Timeout
**Error:** `ICE connection failed`
**Causes:**
- Strict firewall blocking UDP
- No STUN/TURN server accessible
- Network incompatible with P2P

**Fix:**
1. Add TURN server (relays media)
2. Check firewall allows UDP
3. Try different network

### "Could not connect to signaling server"
**Error:** Socket.IO connection fails
**Causes:**
- Server down
- Network blocks WebSocket
- Firewall blocking port

**Fix:**
1. Verify `NEXT_PUBLIC_SIGNALING_SERVER_URL`
2. Check server status
3. Try polling-only transport

### Black Screen (No Video)
**Cause:** Remote stream not set
**Check:**
- `pc.ontrack` event firing?
- `remoteVideoRef.current` not null?
- `remoteVideoRef.current.srcObject` set?

### Audio Echo
**Cause:** User has multiple devices playing audio
**Fix:**
- Mute one device
- Use headphones

### One-Way Audio/Video
**Cause:** ICE candidate exchange failed
**Check:**
- Socket.IO events properly wired?
- `addIceCandidate()` called for both sides?
- Console logs for errors

### Screen Sharing Not Working
**Error:** `NotAllowedError` or screen share fails
**Causes:**
- Browser doesn't support `getDisplayMedia()`
- User denied screen share permission
- Browser security restrictions

**Fix:**
1. Use modern browser (Chrome 72+, Firefox 66+, Safari 13+)
2. Check browser permissions
3. Try refreshing the page

### Screen Share Stops Immediately
**Cause:** User clicked "Stop Sharing" in browser
**Check:**
- This is normal behavior
- The `onended` event handler properly reverts to camera

### Recording Not Starting
**Error:** `MediaRecorder not supported`
**Causes:**
- Browser doesn't support MediaRecorder API
- Unsupported MIME type
- No media stream available

**Fix:**
1. Use modern browser (Chrome 47+, Firefox 25+, Safari 14+)
2. Check console for errors about codec support
3. Verify `localStreamRef.current` is not null

### Recording File Too Large
**Cause:** WebM format with high bitrate
**Options:**
- Record shorter segments
- Use external compression tool after download
- Future: Implement server-side compression

### Chat Messages Not Appearing
**Cause:** Supabase real-time subscription issue
**Check:**
- Supabase project has Realtime enabled
- `call_messages` table exists
- RLS policies allow read/write
- Console shows subscription successful

**Fix:**
1. Check Supabase Dashboard → Database → Replication
2. Enable replication for `call_messages` table
3. Verify RLS policies in Database → Policies
4. Check network tab for websocket connection

### Chat Messages Delayed
**Cause:** Network latency or Realtime lag
**Check:**
- Messages are stored in database (check Supabase dashboard)
- WebSocket connection active
- Network quality

**Fix:**
- Fallback: Messages are manually added on send (already implemented)
- Check Supabase Realtime status
- Try refreshing the page

---

**See also:**
- [Group Video (Agora)](./GROUP_VIDEO.md)
- [API Integrations](./API_INTEGRATIONS.md)
- [Architecture](./ARCHITECTURE.md)

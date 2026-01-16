# Avari - Group Video Calls (Agora)

**Last Updated:** 2026-01-09

Complete guide to group video meetings using Agora RTC SDK.

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation](#implementation)
4. [Features](#features)
5. [UI Components](#ui-components)
6. [Troubleshooting](#troubleshooting)

---

## Overview

**Purpose:** Support 3-17 participants in hybrid meetups
**Technology:** Agora RTC SDK NG v4.24.2
**Mode:** RTC (Real-time Communication)
**Codec:** VP8 for video, Opus for audio

### Key Features
- Grid view (responsive layout for 1-16 participants)
- Speaker view (main speaker + thumbnails)
- Screen sharing
- Client-side recording (MediaRecorder)
- In-call text chat (Supabase Realtime)
- Mute/unmute audio
- Turn camera on/off

---

## Architecture

### Flow Diagram
```
User clicks "Join Video Call"
    ↓
┌────────────────────────┐
│ createAgoraRoom()      │
│ • Check if exists      │
│ • INSERT if needed     │
└────────┬───────────────┘
         │
    ┌────▼─────────────────┐
    │ Navigate to          │
    │ /group-meeting/[id]  │
    └────────┬─────────────┘
             │
    ┌────────▼──────────┐
    │ useAgora hook     │
    │ • Init client     │
    │ • Join channel    │
    │ • Create tracks   │
    │ • Publish tracks  │
    └────────┬──────────┘
             │
    ┌────────▼──────────────┐
    │ Listen for events     │
    │ • user-published      │
    │ • user-unpublished    │
    │ • user-left           │
    └────────┬──────────────┘
             │
    ┌────────▼──────────┐
    │ Subscribe to      │
    │ remote users      │
    └────────┬──────────┘
             │
    ┌────────▼──────────┐
    │ Render video grid │
    │ • Local video     │
    │ • Remote videos   │
    └───────────────────┘
```

### Channel Naming
- Format: `meetup-{meetupId}`
- Example: `meetup-550e8400-e29b-41d4-a716-446655440000`
- Ensures unique channel per meetup
- Persistent across page refreshes

### UID Generation
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

**Why numeric?** Agora recommends numeric UIDs for better routing performance.

---

## Implementation

### 1. useAgora Hook

**File:** `hooks/useAgora.js`

**Initialization:**
```javascript
const client = AgoraRTC.createClient({
  mode: 'rtc',  // Real-time communication
  codec: 'vp8'  // Video codec
});
```

**Join Channel:**
```javascript
const join = async (appId, channel, token = null, uid = null) => {
  // Prevent duplicate joins
  if (isJoiningRef.current || isJoined) {
    return;
  }

  isJoiningRef.current = true;

  // Join channel
  const assignedUid = await client.join(appId, channel, token, uid);

  // Create local tracks
  const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
    {
      // Audio config
      encoderConfig: 'music_standard',
      echoCancellation: true,
      noiseSuppression: true
    },
    {
      // Video config
      encoderConfig: {
        width: 640,
        height: 480,
        frameRate: 15,
        bitrateMin: 600,
        bitrateMax: 1000
      }
    }
  );

  setLocalAudioTrack(audioTrack);
  setLocalVideoTrack(videoTrack);

  // Publish tracks
  await client.publish([audioTrack, videoTrack]);
  setIsPublishing(true);
  setIsJoined(true);
  isJoiningRef.current = false;

  return assignedUid;
};
```

**Event Handlers:**
```javascript
// Remote user published media
client.on('user-published', async (user, mediaType) => {
  // Subscribe to remote user
  await client.subscribe(user, mediaType);

  if (mediaType === 'video') {
    setRemoteUsers(prev => ({
      ...prev,
      [user.uid]: {
        ...prev[user.uid],
        videoTrack: user.videoTrack,
        uid: user.uid
      }
    }));
  }

  if (mediaType === 'audio') {
    setRemoteUsers(prev => ({
      ...prev,
      [user.uid]: {
        ...prev[user.uid],
        audioTrack: user.audioTrack,
        uid: user.uid
      }
    }));
    // Auto-play remote audio
    user.audioTrack?.play();
  }
});

// Remote user unpublished media
client.on('user-unpublished', (user, mediaType) => {
  if (mediaType === 'video') {
    setRemoteUsers(prev => {
      const updated = { ...prev };
      if (updated[user.uid]) {
        delete updated[user.uid].videoTrack;
      }
      return updated;
    });
  }
});

// Remote user left
client.on('user-left', (user) => {
  setRemoteUsers(prev => {
    const updated = { ...prev };
    delete updated[user.uid];
    return updated;
  });
});
```

**Leave Channel:**
```javascript
const leave = async () => {
  // Stop and close local tracks
  if (localAudioTrack) {
    localAudioTrack.stop();
    localAudioTrack.close();
    setLocalAudioTrack(null);
  }

  if (localVideoTrack) {
    localVideoTrack.stop();
    localVideoTrack.close();
    setLocalVideoTrack(null);
  }

  // Leave channel
  if (client && client.connectionState === 'CONNECTED') {
    await client.leave();
  }

  setIsJoined(false);
  setIsPublishing(false);
  setRemoteUsers({});
};
```

---

### 2. Group Meeting Page

**File:** `app/group-meeting/[id]/page.js`

**Initialize Call:**
```javascript
const initializeGroupCall = async () => {
  // Get Agora App ID
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;

  // Check camera/microphone permissions
  const testStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  testStream.getTracks().forEach(track => track.stop());

  // Join Agora channel
  const numericUid = generateNumericUid(user.id);
  await join(appId, channelName, null, numericUid);

  // Mark room as started
  await startAgoraRoom(channelName);
};
```

**Video Playback:**
```javascript
// Play local video
useEffect(() => {
  if (localVideoTrack && localVideoRef.current) {
    localVideoTrack.play(localVideoRef.current);
  }
}, [localVideoTrack]);

// Remote video component
function RemoteVideoPlayer({ remoteUser }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && remoteUser.videoTrack) {
      remoteUser.videoTrack.play(videoRef.current);
    }

    return () => {
      if (remoteUser.videoTrack) {
        remoteUser.videoTrack.stop();
      }
    };
  }, [remoteUser.videoTrack, remoteUser.uid]);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden relative">
      {remoteUser.videoTrack ? (
        <div ref={videoRef} className="w-full h-full" />
      ) : (
        <div className="flex items-center justify-center">
          <p>Camera off</p>
        </div>
      )}
    </div>
  );
}
```

---

## Features

### 1. Grid View

**Responsive Layout:**
```javascript
const participantCount = Object.keys(remoteUsers).length + 1; // +1 for local

const gridCols =
  participantCount === 1 ? 'grid-cols-1' :
  participantCount === 2 ? 'grid-cols-2' :
  participantCount <= 4 ? 'grid-cols-2' :
  participantCount <= 6 ? 'grid-cols-3' :
  participantCount <= 9 ? 'grid-cols-3' :
  'grid-cols-4';

const gridRows =
  participantCount === 1 ? '1fr' :
  participantCount === 2 ? '1fr' :
  participantCount <= 4 ? 'repeat(2, 1fr)' :
  participantCount <= 6 ? 'repeat(2, 1fr)' :
  participantCount <= 9 ? 'repeat(3, 1fr)' :
  'repeat(4, 1fr)';
```

**Result:**
- 1 participant: 1x1
- 2 participants: 2x1
- 3-4 participants: 2x2
- 5-6 participants: 3x2
- 7-9 participants: 3x3
- 10+ participants: 4x4

### 2. Speaker View

**Layout:**
- Main area: First remote user (or local if alone)
- Thumbnail strip: Local + other remote users
- Scrollable thumbnails (horizontal)

**Switch Views:**
```javascript
<button onClick={() => setGridView(!gridView)}>
  {gridView ? '👤 Speaker' : '📱 Grid'}
</button>
```

### 3. Screen Sharing

**Start Sharing:**
```javascript
const startScreenShare = async () => {
  // Create screen track
  const screenTrack = await AgoraRTC.createScreenVideoTrack({
    encoderConfig: '1080p_1'
  }, 'auto');

  setLocalScreenTrack(screenTrack);

  // Unpublish camera
  if (localVideoTrack) {
    await client.unpublish(localVideoTrack);
  }

  // Publish screen
  await client.publish(screenTrack);
  setIsScreenSharing(true);

  // Handle user clicking "Stop Sharing" in browser
  screenTrack.on('track-ended', async () => {
    await stopScreenShare();
  });
};
```

**Stop Sharing:**
```javascript
const stopScreenShare = async () => {
  // Unpublish and close screen track
  await client.unpublish(localScreenTrack);
  localScreenTrack.close();
  setLocalScreenTrack(null);

  // Republish camera
  if (localVideoTrack) {
    await client.publish(localVideoTrack);
  }

  setIsScreenSharing(false);
};
```

### 4. Recording

**Hook:** `hooks/useRecording.js`

**Start Recording:**
```javascript
const startRecording = async (stream) => {
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp8,opus'
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunksRef.current.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);

    // Auto-download
    const a = document.createElement('a');
    a.href = url;
    a.download = `avari-call-${new Date().toISOString()}.webm`;
    a.click();

    URL.revokeObjectURL(url);
  };

  mediaRecorder.start(1000); // Collect chunks every second
  setIsRecording(true);

  // Start timer
  timerRef.current = setInterval(() => {
    setRecordingTime(prev => prev + 1);
  }, 1000);
};
```

**Limitations:**
- Records local stream only (not remote participants)
- Client-side only (not uploaded to server)
- WebM format (browser-dependent codec support)

**Enhancement Opportunities:**
- Use Agora Cloud Recording API (server-side)
- Mix remote audio streams into recording
- Upload to Supabase Storage

### 5. In-call Chat

**Implementation:**
- Supabase `call_messages` table
- Real-time subscriptions
- Sliding panel on right side

**Send Message:**
```javascript
const handleSendMessage = async (e) => {
  e.preventDefault();

  await supabase.from('call_messages').insert({
    channel_name: channelName,
    user_id: user.id,
    user_name: user.email,
    message: newMessage.trim()
  });

  setNewMessage('');
};
```

**Receive Messages:**
```javascript
useEffect(() => {
  // Load existing messages
  const loadMessages = async () => {
    const { data } = await supabase
      .from('call_messages')
      .select('*')
      .eq('channel_name', channelName)
      .order('created_at', { ascending: true });

    setMessages(data || []);
  };

  loadMessages();

  // Subscribe to new messages
  const channel = supabase
    .channel(`call-messages-${channelName}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'call_messages',
      filter: `channel_name=eq.${channelName}`
    }, (payload) => {
      setMessages(prev => [...prev, payload.new]);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [channelName]);
```

---

## UI Components

### Control Bar
```jsx
<div className="bg-gray-800 py-3 px-4">
  <div className="flex items-center justify-between">
    {/* Recording indicator */}
    {isRecording && (
      <div className="text-red-500">
        <span className="animate-pulse">⏺</span>
        {formatTime(recordingTime)}
      </div>
    )}

    {/* Controls */}
    <div className="flex gap-3">
      <button onClick={handleToggleMute}
        className={isMuted ? 'bg-red-600' : 'bg-gray-700'}>
        {isMuted ? '🔇' : '🎤'}
      </button>

      <button onClick={handleToggleVideo}
        className={isVideoOff ? 'bg-red-600' : 'bg-gray-700'}>
        📹
      </button>

      <button onClick={handleToggleScreenShare}
        className={isScreenSharing ? 'bg-blue-600' : 'bg-gray-700'}>
        🖥️
      </button>

      <button onClick={handleToggleRecording}
        className={isRecording ? 'bg-red-600' : 'bg-gray-700'}>
        ⏺
      </button>

      <button onClick={() => setShowChat(!showChat)}
        className={showChat ? 'bg-purple-600' : 'bg-gray-700'}>
        💬
        {messages.length > 0 && !showChat && (
          <span className="badge">{messages.length}</span>
        )}
      </button>

      <button onClick={handleLeaveCall}
        className="bg-red-600">
        Leave
      </button>
    </div>
  </div>
</div>
```

### Chat Panel
```jsx
{showChat && (
  <div className="fixed right-0 top-0 bottom-0 w-80 bg-gray-800">
    {/* Header */}
    <div className="p-4 border-b">
      <h3>Chat</h3>
      <button onClick={() => setShowChat(false)}>✕</button>
    </div>

    {/* Messages */}
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map((msg) => (
        <div key={msg.id}
          className={msg.user_id === user.id ? 'ml-auto' : 'mr-auto'}>
          <p className="text-xs">{msg.user_name}</p>
          <p className="text-sm">{msg.message}</p>
          <p className="text-xs">{formatTime(msg.created_at)}</p>
        </div>
      ))}
    </div>

    {/* Input */}
    <form onSubmit={handleSendMessage} className="p-4 border-t">
      <input
        type="text"
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        placeholder="Type a message..."
      />
      <button type="submit">Send</button>
    </form>
  </div>
)}
```

---

## Troubleshooting

### "CAN_NOT_GET_GATEWAY_SERVER: dynamic use static key"
- **Cause:** Agora project in Secured Mode
- **Fix:** Switch to Testing Mode in Agora Console
- **Or:** Generate tokens server-side (see [API_INTEGRATIONS.md](./API_INTEGRATIONS.md))

### "FRAMERATE_INPUT_TOO_LOW"
- **Cause:** Camera can't maintain 15fps
- **Impact:** Informational, doesn't break call
- **Fix:** Lower framerate in config to 12fps

### "Client already in connecting/connected state"
- **Cause:** Duplicate join attempts (React Strict Mode)
- **Fix:** Use `isJoiningRef` to prevent duplicates (already implemented)

### No video showing
- **Check:** Video container has height (use `flex-1`, not `h-0`)
- **Check:** `localVideoTrack.play(element)` called
- **Check:** Element ref is not null
- **Check:** Console for Agora errors

### Remote user not visible
- **Check:** Subscription successful (`user-published` event)
- **Check:** `remoteUsers` state updated
- **Check:** RemoteVideoPlayer component rendered
- **Check:** `remoteUser.videoTrack` exists

### Audio echo
- **Check:** Echo cancellation enabled (default: on)
- **Cause:** User has two devices in same room
- **Fix:** Mute one device or use headphones

---

**See also:**
- [Coffee Chats (WebRTC)](./COFFEE_CHATS.md)
- [API Integrations](./API_INTEGRATIONS.md)
- [Agora Setup Guide](../AGORA_SETUP.md)

# Avari - Direct Messaging

**Last Updated:** 2026-01-09

Complete guide to real-time direct messaging between users.

---

## Table of Contents
1. [Overview](#overview)
2. [User Flow](#user-flow)
3. [Implementation](#implementation)
4. [Real-time Updates](#real-time-updates)
5. [Features](#features)

---

## Overview

**Purpose:** Private text conversations between users
**Technology:** Supabase (PostgreSQL + Realtime subscriptions)
**Update Latency:** <100ms

### Key Features
- Send/receive messages in real-time
- Conversation list with latest message preview
- Unread message count
- Read receipts
- Auto-scroll to latest message
- Session persistence (remembers selected conversation)

---

## User Flow

### Send Message Flow
```
1. User A navigates to "Messages" tab
   ↓
2. Selects conversation with User B
   ↓
3. Types message in input field
   ↓
4. Presses Enter or clicks "Send"
   ↓
5. INSERT into messages table
   ↓
6. Message appears immediately in User A's view
   ↓
7. Supabase triggers postgres_changes event
   ↓
8. User B's subscription receives event
   ↓
9. Message added to User B's state
   ↓
10. Message appears in User B's view
    ↓
11. Auto-mark as read (UPDATE messages SET read = true)
```

### Conversation Selection
```
1. User clicks on conversation in list
   ↓
2. setSelectedConversation(userId)
   ↓
3. Save to sessionStorage (persists across refreshes)
   ↓
4. Load messages for that conversation
   ↓
5. Scroll to bottom
   ↓
6. Mark all messages as read
```

---

## Implementation

### Component Structure

**File:** `components/MessagesView.js` (850+ lines)

**Layout:**
```
┌────────────────────────────────────────┐
│  Messages                              │
├──────────────┬─────────────────────────┤
│ Conversation │  Message Thread         │
│ List         │  ┌───────────────────┐  │
│              │  │ User B              │  │
│ • User B     │  │ Hi there!           │  │
│   Latest msg │  │ 2:30 PM             │  │
│   [2 unread] │  └───────────────────┘  │
│              │  ┌───────────────────┐  │
│ • User C     │  │ You                 │  │
│   Another... │  │ Hey! How are you?   │  │
│              │  │ 2:31 PM             │  │
│              │  └───────────────────┘  │
│              │                          │
│              │  ┌───────────────────┐  │
│              │  │ [Type message...] │  │
│              │  │ [Send]             │  │
│              │  └───────────────────┘  │
└──────────────┴─────────────────────────┘
```

### State Management

```javascript
const [conversations, setConversations] = useState([]);
const [selectedConversation, setSelectedConversation] = useState(null);
const [messages, setMessages] = useState([]);
const [newMessage, setNewMessage] = useState('');
const [unreadCounts, setUnreadCounts] = useState({});

// Ref for accessing state in subscriptions
const selectedConversationRef = useRef(selectedConversation);

useEffect(() => {
  selectedConversationRef.current = selectedConversation;
}, [selectedConversation]);
```

### Load Conversations

```javascript
const loadConversations = async () => {
  // Get all messages where user is sender or receiver
  const { data: allMessages } = await supabase
    .from('messages')
    .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  // Group by conversation
  const conversationMap = new Map();

  allMessages.forEach(msg => {
    const otherUserId = msg.sender_id === user.id
      ? msg.receiver_id
      : msg.sender_id;

    const otherUser = msg.sender_id === user.id
      ? msg.receiver
      : msg.sender;

    if (!conversationMap.has(otherUserId)) {
      conversationMap.set(otherUserId, {
        userId: otherUserId,
        user: otherUser,
        lastMessage: msg,
        unreadCount: 0
      });
    }

    // Count unread messages
    if (msg.receiver_id === user.id && !msg.read) {
      const conv = conversationMap.get(otherUserId);
      conv.unreadCount++;
    }
  });

  setConversations(Array.from(conversationMap.values()));
};
```

### Load Messages for Conversation

```javascript
const loadMessages = async (otherUserId) => {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),` +
      `and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
    )
    .order('created_at', { ascending: true });

  setMessages(data || []);

  // Mark all as read
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('receiver_id', user.id)
    .eq('sender_id', otherUserId)
    .eq('read', false);

  // Scroll to bottom
  setTimeout(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, 100);
};
```

### Send Message

```javascript
const handleSendMessage = async (e) => {
  e.preventDefault();

  if (!newMessage.trim() || !selectedConversation) return;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      receiver_id: selectedConversation,
      content: newMessage.trim(),
      read: false
    })
    .select()
    .single();

  if (error) {
    alert('Error sending message: ' + error.message);
    return;
  }

  // Add to local state immediately
  setMessages(prev => [...prev, data]);

  // Clear input
  setNewMessage('');

  // Scroll to bottom
  setTimeout(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, 0);
};
```

---

## Real-time Updates

### Supabase Subscription

```javascript
useEffect(() => {
  if (!user) return;

  // Subscribe to new messages
  const messagesChannel = supabase
    .channel('messages-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      },
      (payload) => {
        console.log('📨 New message received:', payload.new);

        const message = payload.new;
        const currentConversation = selectedConversationRef.current;

        // If from current conversation, add to thread
        if (message.sender_id === currentConversation) {
          setMessages(prev => [...prev, message]);

          // Auto-mark as read
          supabase
            .from('messages')
            .update({ read: true })
            .eq('id', message.id);

          // Scroll to bottom
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 0);
        } else {
          // Update unread count for other conversations
          setUnreadCounts(prev => ({
            ...prev,
            [message.sender_id]: (prev[message.sender_id] || 0) + 1
          }));
        }

        // Refresh conversation list (to update latest message)
        loadConversations();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(messagesChannel);
  };
}, [user]);
```

### Why Use Ref?

**Problem:** Subscription callback captures stale state

```javascript
// ❌ BAD: selectedConversation is stale in callback
useEffect(() => {
  supabase.on('INSERT', (payload) => {
    if (payload.new.sender_id === selectedConversation) {
      // selectedConversation is from when effect ran, not current!
    }
  });
}, []); // Empty deps = stale closure
```

**Solution:** Use ref to access latest value

```javascript
// ✅ GOOD: selectedConversationRef.current is always latest
const selectedConversationRef = useRef(selectedConversation);

useEffect(() => {
  selectedConversationRef.current = selectedConversation;
}, [selectedConversation]);

useEffect(() => {
  supabase.on('INSERT', (payload) => {
    const current = selectedConversationRef.current; // Latest value!
    if (payload.new.sender_id === current) {
      // Correct comparison
    }
  });
}, []);
```

---

## Features

### 1. Unread Message Count

**Calculate:**
```javascript
const getUnreadCount = (userId) => {
  return messages.filter(m =>
    m.sender_id === userId &&
    m.receiver_id === user.id &&
    !m.read
  ).length;
};
```

**Display:**
```jsx
{unreadCount > 0 && (
  <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs">
    {unreadCount}
  </span>
)}
```

### 2. Read Receipts

**Mark as Read:**
```javascript
const markAsRead = async (otherUserId) => {
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('receiver_id', user.id)
    .eq('sender_id', otherUserId)
    .eq('read', false);
};
```

**Display:**
```jsx
{message.sender_id === user.id && (
  <span className="text-xs">
    {message.read ? '✓✓ Read' : '✓ Sent'}
  </span>
)}
```

### 3. Typing Indicator (Future)

**Implementation:**
```javascript
// Broadcast typing status
const handleTyping = () => {
  supabase
    .channel('typing')
    .send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, conversationId: selectedConversation }
    });
};

// Listen for typing
supabase
  .channel('typing')
  .on('broadcast', { event: 'typing' }, (payload) => {
    if (payload.conversationId === user.id) {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 3000);
    }
  })
  .subscribe();
```

### 4. Session Persistence

**Save Selected Conversation:**
```javascript
const handleSelectConversation = (userId) => {
  setSelectedConversation(userId);
  sessionStorage.setItem('selectedConversation', userId);
  loadMessages(userId);
};
```

**Restore on Mount:**
```javascript
useEffect(() => {
  const saved = sessionStorage.getItem('selectedConversation');
  if (saved) {
    setSelectedConversation(saved);
    loadMessages(saved);
  }
}, []);
```

### 5. Search Conversations

```javascript
const [searchQuery, setSearchQuery] = useState('');

const filteredConversations = conversations.filter(conv =>
  conv.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  conv.lastMessage.content.toLowerCase().includes(searchQuery.toLowerCase())
);
```

### 6. Delete Conversation

```javascript
const handleDeleteConversation = async (otherUserId) => {
  if (!confirm('Delete this conversation? This cannot be undone.')) {
    return;
  }

  // Delete all messages with this user
  await supabase
    .from('messages')
    .delete()
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),` +
      `and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
    );

  // Refresh conversations
  loadConversations();

  // Clear selection
  setSelectedConversation(null);
};
```

---

## UI Components

### Conversation List Item

```jsx
<div
  onClick={() => handleSelectConversation(conv.userId)}
  className={`
    p-4 cursor-pointer hover:bg-gray-100
    ${selectedConversation === conv.userId ? 'bg-blue-50' : ''}
  `}
>
  {/* Profile Picture */}
  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
    <span className="text-white text-lg">
      {conv.user.name?.charAt(0).toUpperCase()}
    </span>
  </div>

  {/* Name and Last Message */}
  <div className="flex-1">
    <div className="flex justify-between items-start">
      <span className="font-semibold">{conv.user.name}</span>
      <span className="text-xs text-gray-500">
        {formatTime(conv.lastMessage.created_at)}
      </span>
    </div>

    <p className="text-sm text-gray-600 truncate">
      {conv.lastMessage.sender_id === user.id && 'You: '}
      {conv.lastMessage.content}
    </p>
  </div>

  {/* Unread Badge */}
  {conv.unreadCount > 0 && (
    <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs">
      {conv.unreadCount}
    </span>
  )}
</div>
```

### Message Bubble

```jsx
<div
  className={`flex ${
    message.sender_id === user.id ? 'justify-end' : 'justify-start'
  }`}
>
  <div
    className={`
      max-w-[70%] rounded-lg p-3
      ${message.sender_id === user.id
        ? 'bg-purple-600 text-white'
        : 'bg-gray-200 text-gray-900'
      }
    `}
  >
    <p className="break-words">{message.content}</p>
    <div className="flex items-center gap-2 mt-1">
      <span className="text-xs opacity-70">
        {formatTime(message.created_at)}
      </span>
      {message.sender_id === user.id && (
        <span className="text-xs opacity-70">
          {message.read ? '✓✓' : '✓'}
        </span>
      )}
    </div>
  </div>
</div>
```

### Message Input

```jsx
<form onSubmit={handleSendMessage} className="p-4 border-t">
  <div className="flex gap-2">
    <input
      type="text"
      value={newMessage}
      onChange={(e) => setNewMessage(e.target.value)}
      placeholder="Type a message..."
      className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
      maxLength={1000}
    />
    <button
      type="submit"
      disabled={!newMessage.trim()}
      className="bg-purple-600 text-white px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Send
    </button>
  </div>
</form>
```

---

## Pagination (Future Enhancement)

**Current:** Loads all messages for a conversation
**Issue:** Slow for conversations with 1000+ messages

**Solution:** Cursor-based pagination

```javascript
const loadMessages = async (otherUserId, cursor = null) => {
  let query = supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),` +
      `and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
    )
    .order('created_at', { ascending: false})
    .limit(50);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query;

  // Reverse for chronological order
  const messages = data.reverse();

  if (cursor) {
    setMessages(prev => [...messages, ...prev]);
  } else {
    setMessages(messages);
  }

  return messages;
};

// Load more on scroll to top
const handleScroll = (e) => {
  if (e.target.scrollTop === 0 && messages.length > 0) {
    const oldestMessage = messages[0];
    loadMessages(selectedConversation, oldestMessage.created_at);
  }
};
```

See [Roadmap](./ROADMAP.md#2-message-pagination) for priority.

---

**See also:**
- [Database Schema](./DATABASE.md)
- [Architecture](./ARCHITECTURE.md)
- [Roadmap](./ROADMAP.md)

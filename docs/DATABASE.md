# Avari - Database Schema

**Last Updated:** 2026-01-09

## Table of Contents
1. [Overview](#overview)
2. [Schema Diagram](#schema-diagram)
3. [Tables](#tables)
4. [Row Level Security](#row-level-security)
5. [Indexes](#indexes)
6. [Functions & Triggers](#functions--triggers)

---

## Overview

**Database:** PostgreSQL (via Supabase)
**Version:** 15.x
**Schema:** `public`

### Key Features
- Row Level Security (RLS) enabled on all tables
- UUID primary keys
- Timestamps (created_at, updated_at)
- Foreign key constraints with cascading deletes
- Real-time subscriptions enabled

---

## Schema Diagram

```
┌──────────────┐
│ auth.users   │ (Managed by Supabase Auth)
│ - id (UUID)  │
│ - email      │
└──────┬───────┘
       │
       │ 1:1
       ↓
┌──────────────────────┐
│ profiles             │
│ - id (FK auth.users) │
│ - name               │
│ - career             │
│ - city, state        │
│ - bio                │
│ - interests[]        │
│ - profile_picture    │
└──────┬───────────────┘
       │
       │ 1:many
       ↓
┌──────────────────┐         ┌─────────────────┐
│ meetups          │←────────│ meetup_signups  │
│ - id (PK)        │  1:many │ - meetup_id (FK)│
│ - title          │         │ - user_id (FK)  │
│ - date, time     │         │ - signup_type   │
│ - location       │         └─────────────────┘
│ - created_by (FK)│
└──────┬───────────┘
       │ 1:1
       ↓
┌──────────────────┐
│ agora_rooms      │
│ - channel_name   │
│ - meetup_id (FK) │
│ - is_active      │
└──────────────────┘

┌──────────────────┐
│ coffee_chats     │
│ - requester_id   │
│ - recipient_id   │
│ - status         │
│ - video_link     │
└──────┬───────────┘
       │ 1:1
       ↓
┌──────────────────┐
│ video_rooms      │
│ - room_id        │
│ - participants[] │
└──────────────────┘

┌──────────────────┐
│ messages         │
│ - sender_id      │
│ - receiver_id    │
│ - content        │
│ - read           │
└──────────────────┘

┌──────────────────┐
│ call_messages    │
│ - channel_name   │
│ - user_id        │
│ - message        │
└──────────────────┘

┌──────────────────┐
│ user_interests   │
│ - user_id        │
│ - interested_in  │
└──────────────────┘
```

---

## Tables

### profiles

User profile information (extends `auth.users`)

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  career TEXT,
  city TEXT,
  state TEXT,
  bio TEXT,
  profile_picture TEXT,
  interests TEXT[],
  meetups_attended INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id`: User ID from auth.users (primary key)
- `email`: Email address (copied from auth for convenience)
- `name`: Full name
- `career`: Job title or company
- `city`, `state`: Location
- `bio`: Free-text self-description
- `profile_picture`: URL to profile image
- `interests`: Array of interest tags
- `meetups_attended`: Counter for gamification

**Relationships:**
- `id` → `auth.users.id` (1:1)

**Indexes:**
- Primary key on `id`
- Index on `email` (for lookups)

---

### meetups

Events that users can attend (in-person or virtually)

```sql
CREATE TABLE public.meetups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agora_link TEXT,
  video_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id`: Unique meetup identifier
- `title`: Meetup name
- `date`, `time`: When the meetup occurs
- `location`: Physical address (optional)
- `description`: Details about the meetup
- `created_by`: User who created it
- `agora_link`: Link to Agora video room (if hybrid)
- `video_link`: Alternative video link

**Relationships:**
- `created_by` → `auth.users.id`

**Indexes:**
- Primary key on `id`
- Index on `date` (for date-range queries)
- Index on `created_by` (for user's meetups)

---

### meetup_signups

Tracks which users signed up for which meetups

```sql
CREATE TABLE public.meetup_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id UUID NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signup_type TEXT CHECK (signup_type IN ('in_person', 'video')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(meetup_id, user_id)
);
```

**Columns:**
- `id`: Unique signup record
- `meetup_id`: Which meetup
- `user_id`: Which user
- `signup_type`: How they'll attend ('in_person' or 'video')

**Relationships:**
- `meetup_id` → `meetups.id`
- `user_id` → `auth.users.id`

**Constraints:**
- Unique constraint on (meetup_id, user_id) - can't sign up twice

**Indexes:**
- Primary key on `id`
- Index on `meetup_id` (for attendee lists)
- Index on `user_id` (for user's signups)

---

### coffee_chats

1:1 video chat requests between users

```sql
CREATE TABLE public.coffee_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  notes TEXT,
  room_url TEXT,
  video_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id`: Unique chat request
- `requester_id`: User who initiated request
- `recipient_id`: User receiving request
- `scheduled_time`: When the chat should happen
- `status`: Current state (pending/accepted/declined/cancelled)
- `notes`: Context or reason for chat
- `room_url`: Link to video room (after acceptance)
- `video_link`: Alternative to room_url

**Relationships:**
- `requester_id` → `auth.users.id`
- `recipient_id` → `auth.users.id`

**Indexes:**
- Primary key on `id`
- Index on `requester_id` (for sent requests)
- Index on `recipient_id` (for received requests)
- Index on `status` (for filtering)

---

### messages

Direct messages between users

```sql
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id`: Unique message
- `sender_id`: Who sent it
- `receiver_id`: Who should receive it
- `content`: Message text
- `read`: Whether recipient has read it

**Relationships:**
- `sender_id` → `auth.users.id`
- `receiver_id` → `auth.users.id`

**Indexes:**
- Primary key on `id`
- Index on `sender_id, receiver_id` (for conversation queries)
- Index on `receiver_id, read` (for unread counts)
- Index on `created_at` (for ordering)

---

### video_rooms

Tracks 1:1 WebRTC video call rooms

```sql
CREATE TABLE public.video_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT UNIQUE NOT NULL,
  meetup_id UUID REFERENCES meetups(id) ON DELETE SET NULL,
  participants TEXT[] NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE
);
```

**Columns:**
- `id`: Database primary key
- `room_id`: Unique room identifier (used in URL)
- `meetup_id`: Associated meetup (optional)
- `participants`: Array of user IDs in the call
- `created_by`: Who created the room
- `started_at`, `ended_at`: Call duration tracking

**Relationships:**
- `meetup_id` → `meetups.id` (optional)
- `created_by` → `auth.users.id`

**Indexes:**
- Primary key on `id`
- Unique index on `room_id`

---

### agora_rooms

Tracks Agora group video call rooms

```sql
CREATE TABLE public.agora_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT UNIQUE NOT NULL,
  meetup_id UUID UNIQUE REFERENCES meetups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);
```

**Columns:**
- `id`: Database primary key
- `channel_name`: Agora channel name (format: `meetup-{meetupId}`)
- `meetup_id`: Associated meetup (unique - one room per meetup)
- `created_by`: Who created the room
- `started_at`: When first user joined
- `ended_at`: When room closed
- `is_active`: Whether room is currently active

**Relationships:**
- `meetup_id` → `meetups.id` (1:1, unique)
- `created_by` → `auth.users.id`

**Indexes:**
- Primary key on `id`
- Unique index on `channel_name`
- Unique index on `meetup_id`

**Migration File:** `database-migration-agora.sql`

---

### user_interests

Tracks when one user expresses interest in another

```sql
CREATE TABLE public.user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interested_in_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, interested_in_user_id)
);
```

**Columns:**
- `id`: Unique interest record
- `user_id`: User expressing interest
- `interested_in_user_id`: User they're interested in
- `created_at`: When interest was expressed

**Relationships:**
- `user_id` → `auth.users.id`
- `interested_in_user_id` → `auth.users.id`

**Constraints:**
- Unique on (user_id, interested_in_user_id) - can't express interest twice

**Indexes:**
- Primary key on `id`
- Index on `user_id` (for user's interests)
- Index on `interested_in_user_id` (for who's interested in a user)

---

### call_messages

Real-time chat messages during video calls

```sql
CREATE TABLE public.call_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id`: Unique message
- `channel_name`: Agora channel (e.g., `meetup-123`)
- `user_id`: Who sent it
- `user_name`: Display name (cached for performance)
- `message`: Message text
- `created_at`: Timestamp

**Relationships:**
- `user_id` → `auth.users.id`

**Indexes:**
- Primary key on `id`
- Index on `channel_name` (for filtering messages per call)
- Index on `created_at` (for ordering + cleanup)

**Migration File:** `database-migration-call-messages.sql`

**Auto-cleanup:** Messages older than 24 hours are deleted automatically

---

## Row Level Security

All tables have RLS enabled with policies to control access.

### profiles

**Policies:**
```sql
-- Anyone authenticated can read all profiles
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
```

### meetups

**Policies:**
```sql
-- Anyone authenticated can read meetups
CREATE POLICY "Meetups are viewable by authenticated users"
  ON meetups FOR SELECT
  TO authenticated
  USING (true);

-- Anyone authenticated can create meetups
CREATE POLICY "Authenticated users can create meetups"
  ON meetups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Creators can update their own meetups
CREATE POLICY "Users can update own meetups"
  ON meetups FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Creators can delete their own meetups
CREATE POLICY "Users can delete own meetups"
  ON meetups FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
```

### meetup_signups

**Policies:**
```sql
-- Anyone can read signups
CREATE POLICY "Signups are viewable by authenticated users"
  ON meetup_signups FOR SELECT
  TO authenticated
  USING (true);

-- Users can sign themselves up
CREATE POLICY "Users can sign up for meetups"
  ON meetup_signups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own signups
CREATE POLICY "Users can delete own signups"
  ON meetup_signups FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

### coffee_chats

**Policies:**
```sql
-- Users can see chats where they are requester or recipient
CREATE POLICY "Users can view their coffee chats"
  ON coffee_chats FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Users can create chat requests
CREATE POLICY "Users can create coffee chat requests"
  ON coffee_chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

-- Users can update chats where they are involved
CREATE POLICY "Users can update their coffee chats"
  ON coffee_chats FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);
```

### messages

**Policies:**
```sql
-- Users can see messages where they are sender or receiver
CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Users can update messages they received (mark as read)
CREATE POLICY "Users can update received messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id);
```

### video_rooms

**Policies:**
```sql
-- Users can see rooms they're participating in
CREATE POLICY "Users can view their video rooms"
  ON video_rooms FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(participants::uuid[]));

-- Anyone authenticated can create rooms
CREATE POLICY "Authenticated users can create video rooms"
  ON video_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Participants can update rooms
CREATE POLICY "Participants can update video rooms"
  ON video_rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = ANY(participants::uuid[]));
```

### agora_rooms

**Policies:**
```sql
-- Anyone authenticated can read agora rooms
CREATE POLICY "Agora rooms are viewable by authenticated users"
  ON agora_rooms FOR SELECT
  TO authenticated
  USING (true);

-- Anyone authenticated can create agora rooms
CREATE POLICY "Authenticated users can create agora rooms"
  ON agora_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Creators and admins can update rooms
CREATE POLICY "Allow authenticated users to update agora_rooms"
  ON agora_rooms FOR UPDATE
  TO authenticated
  USING (true); -- Can be restricted to created_by or admin role
```

### user_interests

**Policies:**
```sql
-- Anyone authenticated can see interests
CREATE POLICY "Interests are viewable by authenticated users"
  ON user_interests FOR SELECT
  TO authenticated
  USING (true);

-- Users can express interest
CREATE POLICY "Users can create interests"
  ON user_interests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### call_messages

**Policies:**
```sql
-- Anyone authenticated can read call messages
CREATE POLICY "Allow authenticated users to read call messages"
  ON call_messages FOR SELECT
  TO authenticated
  USING (true);

-- Users can send their own messages
CREATE POLICY "Allow authenticated users to send call messages"
  ON call_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

---

## Indexes

### Performance Indexes

**profiles:**
- `PRIMARY KEY (id)` - Default
- `INDEX idx_profiles_email (email)` - Email lookups

**meetups:**
- `PRIMARY KEY (id)` - Default
- `INDEX idx_meetups_date (date)` - Date range queries
- `INDEX idx_meetups_created_by (created_by)` - User's meetups

**meetup_signups:**
- `PRIMARY KEY (id)` - Default
- `INDEX idx_signups_meetup_id (meetup_id)` - Attendee lists
- `INDEX idx_signups_user_id (user_id)` - User's signups
- `UNIQUE (meetup_id, user_id)` - Prevent duplicates

**coffee_chats:**
- `PRIMARY KEY (id)` - Default
- `INDEX idx_coffee_requester (requester_id)` - Sent requests
- `INDEX idx_coffee_recipient (recipient_id)` - Received requests
- `INDEX idx_coffee_status (status)` - Filter by status

**messages:**
- `PRIMARY KEY (id)` - Default
- `INDEX idx_messages_conversation (sender_id, receiver_id)` - Conversations
- `INDEX idx_messages_unread (receiver_id, read)` - Unread counts
- `INDEX idx_messages_created (created_at)` - Ordering

**video_rooms:**
- `PRIMARY KEY (id)` - Default
- `UNIQUE INDEX idx_video_rooms_room_id (room_id)` - Room lookup

**agora_rooms:**
- `PRIMARY KEY (id)` - Default
- `UNIQUE INDEX idx_agora_rooms_channel (channel_name)` - Channel lookup
- `UNIQUE INDEX idx_agora_rooms_meetup (meetup_id)` - One room per meetup

**user_interests:**
- `PRIMARY KEY (id)` - Default
- `INDEX idx_interests_user (user_id)` - User's interests
- `INDEX idx_interests_target (interested_in_user_id)` - Who's interested
- `UNIQUE (user_id, interested_in_user_id)` - Prevent duplicates

**call_messages:**
- `PRIMARY KEY (id)` - Default
- `INDEX idx_call_messages_channel (channel_name)` - Per-call messages
- `INDEX idx_call_messages_created (created_at)` - Ordering + cleanup

---

## Functions & Triggers

### update_agora_room_started

Auto-set `started_at` timestamp when room becomes active

```sql
CREATE OR REPLACE FUNCTION update_agora_room_started()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true AND OLD.is_active = false AND NEW.started_at IS NULL THEN
    NEW.started_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agora_room_started_trigger
  BEFORE UPDATE ON agora_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_agora_room_started();
```

### delete_old_call_messages

Auto-delete messages older than 24 hours

```sql
CREATE OR REPLACE FUNCTION public.delete_old_call_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM public.call_messages
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**To schedule (run manually or via cron):**
```sql
SELECT delete_old_call_messages();
```

**Supabase Cron (if using pg_cron extension):**
```sql
SELECT cron.schedule(
  'delete-old-call-messages',
  '0 * * * *', -- Every hour
  'SELECT delete_old_call_messages()'
);
```

---

## Migration Files

### database-migration-agora.sql
Creates agora_rooms table, indexes, RLS policies, and triggers.

**To apply:**
1. Open Supabase Dashboard → SQL Editor
2. Paste contents of `database-migration-agora.sql`
3. Click "Run"

### database-migration-call-messages.sql
Creates call_messages table, indexes, RLS policies, and cleanup function.

**To apply:**
1. Open Supabase Dashboard → SQL Editor
2. Paste contents of `database-migration-call-messages.sql`
3. Click "Run"

---

**See also:**
- [Architecture](./ARCHITECTURE.md)
- [API Integrations](./API_INTEGRATIONS.md)

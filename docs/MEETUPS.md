# Avari - Meetups

**Last Updated:** 2026-01-09

Complete guide to creating and managing hybrid meetups.

---

## Table of Contents
1. [Overview](#overview)
2. [Create Meetup](#create-meetup)
3. [Signup System](#signup-system)
4. [Join Video Call](#join-video-call)
5. [Edit & Delete](#edit--delete)

---

## Overview

**Meetups** are events that users can attend either in-person or via video call.

### Key Features
- Create meetups with date, time, location, description
- Hybrid attendance: in-person OR video
- Sign up for meetups
- Join video call (creates Agora room)
- Edit/delete own meetups
- Search and filter meetups

---

## Create Meetup

### User Flow
```
1. User clicks "Create Meetup" button
   ↓
2. Modal opens with form
   ↓
3. User fills in:
   - Title
   - Date
   - Time
   - Location (optional for video-only)
   - Description
   ↓
4. Clicks "Create"
   ↓
5. INSERT into meetups table
   ↓
6. Modal closes, meetup appears in list
```

### Implementation

**Component:** `components/MainApp.js`

**Form:**
```jsx
<form onSubmit={handleCreateMeetup}>
  <input
    type="text"
    value={newMeetup.title}
    onChange={(e) => setNewMeetup({...newMeetup, title: e.target.value})}
    placeholder="Meetup title"
    required
  />

  <input
    type="date"
    value={newMeetup.date}
    onChange={(e) => setNewMeetup({...newMeetup, date: e.target.value})}
    required
    min={new Date().toISOString().split('T')[0]}
  />

  <input
    type="time"
    value={newMeetup.time}
    onChange={(e) => setNewMeetup({...newMeetup, time: e.target.value})}
    required
  />

  <input
    type="text"
    value={newMeetup.location}
    onChange={(e) => setNewMeetup({...newMeetup, location: e.target.value})}
    placeholder="Location (optional for video-only)"
  />

  <textarea
    value={newMeetup.description}
    onChange={(e) => setNewMeetup({...newMeetup, description: e.target.value})}
    placeholder="Description"
    rows={4}
  />

  <button type="submit">Create Meetup</button>
</form>
```

**Submit Handler:**
```javascript
const handleCreateMeetup = async (e) => {
  e.preventDefault();

  const { data, error } = await supabase
    .from('meetups')
    .insert({
      title: newMeetup.title,
      date: newMeetup.date,
      time: newMeetup.time,
      location: newMeetup.location || null,
      description: newMeetup.description,
      created_by: user.id
    })
    .select()
    .single();

  if (error) {
    alert('Error creating meetup: ' + error.message);
    return;
  }

  // Add to local state
  setMeetups(prev => [...prev, data]);

  // Reset form
  setNewMeetup({
    title: '',
    date: '',
    time: '',
    location: '',
    description: ''
  });

  // Close modal
  setShowCreateModal(false);
};
```

---

## Signup System

### User Flow
```
1. User clicks "Sign Up" on meetup
   ↓
2. Modal shows attendance options:
   - In-person
   - Video call
   ↓
3. User selects option
   ↓
4. Clicks "Confirm"
   ↓
5. INSERT into meetup_signups
   ↓
6. Button changes to "Join Video Call" or "View Details"
```

### Implementation

**Signup Modal:**
```jsx
<div className="modal">
  <h3>How would you like to attend?</h3>

  <button
    onClick={() => handleSignup(meetup.id, 'in_person')}
    className="btn-primary"
  >
    📍 In-Person
    <span className="text-sm">Attend at {meetup.location}</span>
  </button>

  <button
    onClick={() => handleSignup(meetup.id, 'video')}
    className="btn-primary"
  >
    📹 Video Call
    <span className="text-sm">Join from anywhere</span>
  </button>

  <button onClick={() => setShowSignupModal(false)}>
    Cancel
  </button>
</div>
```

**Signup Handler:**
```javascript
const handleSignup = async (meetupId, signupType) => {
  const { error } = await supabase
    .from('meetup_signups')
    .insert({
      meetup_id: meetupId,
      user_id: user.id,
      signup_type: signupType
    });

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      alert('You are already signed up for this meetup');
    } else {
      alert('Error signing up: ' + error.message);
    }
    return;
  }

  // Add to local state
  setUserSignups(prev => [...prev, meetupId]);
  setShowSignupModal(false);
};
```

**Check if User is Signed Up:**
```javascript
const isSignedUp = (meetupId) => {
  return userSignups.includes(meetupId);
};
```

---

## Join Video Call

### User Flow
```
1. User clicks "Join Video Call" button
   ↓
2. handleJoinVideoCall() called
   ↓
3. Check if Agora room exists for meetup
   ↓
4. If not, create Agora room:
   - INSERT into agora_rooms
   - Channel name: meetup-{meetupId}
   ↓
5. Navigate to /group-meeting/meetup-{meetupId}
   ↓
6. Agora video page initializes
   ↓
7. User joins channel with other participants
```

### Implementation

**Join Button:**
```jsx
{isSignedUp(meetup.id) && (
  <div className="flex gap-2">
    {/* In-person option */}
    <div className="flex items-center gap-2">
      <MapPin className="w-4 h-4" />
      <span>{meetup.location}</span>
    </div>

    {/* Video option */}
    <button
      onClick={() => handleJoinVideoCall(meetup.id)}
      className="btn-primary"
    >
      <Video className="w-4 h-4" />
      Join Video Call
    </button>
  </div>
)}
```

**Join Handler:**
```javascript
const handleJoinVideoCall = async (meetupId) => {
  try {
    // Create or get Agora room
    const { roomId, channelName } = await createAgoraRoom(meetupId);

    // Navigate to video page
    router.push(`/group-meeting/${channelName}`);

  } catch (error) {
    alert('Error joining video call: ' + error.message);
  }
};
```

**Helper:** `lib/agoraHelpers.js`

```javascript
export async function createAgoraRoom(meetupId) {
  const { data: { user } } = await supabase.auth.getUser();

  // Check if room already exists
  const { data: existingRoom } = await supabase
    .from('agora_rooms')
    .select('*')
    .eq('meetup_id', meetupId)
    .single();

  if (existingRoom) {
    return {
      roomId: existingRoom.id,
      channelName: existingRoom.channel_name
    };
  }

  // Create new room
  const channelName = `meetup-${meetupId}`;

  const { data: newRoom, error } = await supabase
    .from('agora_rooms')
    .insert({
      channel_name: channelName,
      meetup_id: meetupId,
      created_by: user.id,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;

  return {
    roomId: newRoom.id,
    channelName: newRoom.channel_name
  };
}
```

---

## Edit & Delete

### Edit Meetup

**User Flow:**
```
1. User clicks "Edit" button on their own meetup
   ↓
2. Modal opens with form pre-filled
   ↓
3. User modifies fields
   ↓
4. Clicks "Save Changes"
   ↓
5. UPDATE meetups table
   ↓
6. Modal closes, changes reflected in list
```

**Implementation:**
```javascript
const handleEditMeetup = async (e) => {
  e.preventDefault();

  const { error } = await supabase
    .from('meetups')
    .update({
      title: editingMeetup.title,
      date: editingMeetup.date,
      time: editingMeetup.time,
      location: editingMeetup.location,
      description: editingMeetup.description,
      updated_at: new Date().toISOString()
    })
    .eq('id', editingMeetup.id);

  if (error) {
    alert('Error updating meetup: ' + error.message);
    return;
  }

  // Update local state
  setMeetups(prev => prev.map(m =>
    m.id === editingMeetup.id ? editingMeetup : m
  ));

  // Close modal
  setEditingMeetup(null);
};
```

### Delete Meetup

**User Flow:**
```
1. User clicks "Delete" button
   ↓
2. Confirmation dialog appears
   ↓
3. User confirms
   ↓
4. DELETE from meetups table
   ↓
5. Meetup removed from list
```

**Implementation:**
```javascript
const handleDeleteMeetup = async (meetupId) => {
  if (!confirm('Are you sure you want to delete this meetup?')) {
    return;
  }

  const { error } = await supabase
    .from('meetups')
    .delete()
    .eq('id', meetupId);

  if (error) {
    alert('Error deleting meetup: ' + error.message);
    return;
  }

  // Remove from local state
  setMeetups(prev => prev.filter(m => m.id !== meetupId));
};
```

**Permissions:**
- Only creator can edit/delete
- RLS policy enforces: `USING (auth.uid() = created_by)`

---

## Meetup List Display

### Filter & Sort

**By Date:**
```javascript
const upcomingMeetups = meetups
  .filter(m => new Date(m.date) >= new Date())
  .sort((a, b) => new Date(a.date) - new Date(b.date));
```

**By Search:**
```javascript
const filteredMeetups = meetups.filter(m =>
  m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
  m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
  m.location?.toLowerCase().includes(searchQuery.toLowerCase())
);
```

### Display Component

```jsx
{filteredMeetups.map(meetup => (
  <div key={meetup.id} className="meetup-card">
    {/* Header */}
    <div className="flex justify-between">
      <h3>{meetup.title}</h3>
      {user.id === meetup.created_by && (
        <div className="flex gap-2">
          <button onClick={() => handleEditClick(meetup)}>
            Edit
          </button>
          <button onClick={() => handleDeleteMeetup(meetup.id)}>
            Delete
          </button>
        </div>
      )}
    </div>

    {/* Date/Time */}
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4" />
      <span>{formatDate(meetup.date)}</span>
      <Clock className="w-4 h-4" />
      <span>{formatTime(meetup.time)}</span>
    </div>

    {/* Location */}
    {meetup.location && (
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4" />
        <span>{meetup.location}</span>
      </div>
    )}

    {/* Description */}
    <p className="text-sm">{meetup.description}</p>

    {/* Signup Count */}
    <div className="flex items-center gap-2">
      <Users className="w-4 h-4" />
      <span>{getSignupCount(meetup.id)} attending</span>
    </div>

    {/* Actions */}
    {!isSignedUp(meetup.id) ? (
      <button onClick={() => handleSignupClick(meetup)}>
        Sign Up
      </button>
    ) : (
      <div className="flex gap-2">
        <span className="text-green-600">✓ Signed up</span>
        <button onClick={() => handleJoinVideoCall(meetup.id)}>
          Join Video Call
        </button>
      </div>
    )}
  </div>
))}
```

---

## Real-time Updates

### Supabase Subscriptions

**Listen for Changes:**
```javascript
useEffect(() => {
  const meetupsChannel = supabase
    .channel('meetups_changes')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'meetups'
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setMeetups(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setMeetups(prev => prev.map(m =>
            m.id === payload.new.id ? payload.new : m
          ));
        } else if (payload.eventType === 'DELETE') {
          setMeetups(prev => prev.filter(m => m.id !== payload.old.id));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(meetupsChannel);
  };
}, []);
```

**Currently:** Real-time disabled in MainApp (see [Design Decisions](./DESIGN_DECISIONS.md#5-real-time-subscriptions-disabled))

---

**See also:**
- [Group Video](./GROUP_VIDEO.md)
- [Database Schema](./DATABASE.md)
- [Architecture](./ARCHITECTURE.md)

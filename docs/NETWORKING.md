# Avari - Networking Features

**Last Updated:** 2026-01-09

Complete guide to user connections, interests, and recommendations.

---

## Table of Contents
1. [Overview](#overview)
2. [Mutual Connections](#mutual-connections)
3. [User Interests](#user-interests)
4. [Recommendations](#recommendations)
5. [Implementation](#implementation)

---

## Overview

**Purpose:** Help users discover and connect with other members

### Key Features
- **Mutual Connections**: Users who attended same meetups
- **Express Interest**: Mark interest in specific users
- **Recommendations**: Suggest potential connections (up to 30)
- **Filter Logic**: Exclude existing connections and interests

---

## Mutual Connections

### Definition
Users who have signed up for the same meetup as you.

### Logic
```
1. Get all meetups user has signed up for
2. Get all signups for those meetups
3. Exclude current user
4. Load profiles for those users
5. Display as "Mutual Connections"
```

### Implementation

```javascript
const loadMutualConnections = async () => {
  // Get meetups user signed up for
  const { data: userSignups } = await supabase
    .from('meetup_signups')
    .select('meetup_id')
    .eq('user_id', user.id);

  const meetupIds = userSignups.map(s => s.meetup_id);

  if (meetupIds.length === 0) {
    setMutualConnections([]);
    return;
  }

  // Get all users who signed up for same meetups
  const { data: otherSignups } = await supabase
    .from('meetup_signups')
    .select('user_id')
    .in('meetup_id', meetupIds)
    .neq('user_id', user.id); // Exclude self

  // Get unique user IDs
  const userIds = [...new Set(otherSignups.map(s => s.user_id))];

  // Load profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  setMutualConnections(profiles);
};
```

### Display

```jsx
<div className="grid grid-cols-2 gap-4">
  {mutualConnections.map(user => (
    <div key={user.id} className="border rounded-lg p-4">
      {/* Profile Picture */}
      <div className="w-16 h-16 bg-purple-500 rounded-full mx-auto">
        <span className="text-2xl text-white">
          {user.name?.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Name and Career */}
      <h3 className="font-semibold text-center mt-2">{user.name}</h3>
      <p className="text-sm text-gray-600 text-center">{user.career}</p>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => handleMessageUser(user.id)}
          className="btn-secondary flex-1"
        >
          Message
        </button>
        <button
          onClick={() => handleExpressInterest(user.id)}
          className="btn-primary flex-1"
        >
          Connect
        </button>
      </div>
    </div>
  ))}
</div>
```

---

## User Interests

### Definition
When you mark interest in another user, it's stored in `user_interests` table.

### Purpose
- Track who you want to connect with
- Future feature: Mutual interest matching
- Future feature: Notify user when interest is mutual

### Logic
```
1. User clicks "Connect" or "Express Interest"
2. INSERT into user_interests
3. Add to local state
4. Button changes to "Interested ✓"
```

### Implementation

**Express Interest:**
```javascript
const handleExpressInterest = async (targetUserId) => {
  const { error } = await supabase
    .from('user_interests')
    .insert({
      user_id: user.id,
      interested_in_user_id: targetUserId
    });

  if (error) {
    if (error.code === '23505') { // Unique constraint
      alert('You already expressed interest in this user');
    } else {
      alert('Error: ' + error.message);
    }
    return;
  }

  // Add to local state
  setExpressedInterests(prev => [...prev, targetUserId]);
};
```

**Check if Interested:**
```javascript
const hasExpressedInterest = (userId) => {
  return expressedInterests.includes(userId);
};
```

**Load Interests:**
```javascript
const loadExpressedInterests = async () => {
  const { data } = await supabase
    .from('user_interests')
    .select('interested_in_user_id')
    .eq('user_id', user.id);

  const userIds = data.map(i => i.interested_in_user_id);
  setExpressedInterests(userIds);
};
```

---

## Recommendations

### Definition
Users you might want to connect with, based on:
- Attended same meetups (but not yet connected)
- Similar interests (future)
- Similar career paths (future)

### Current Logic
```
1. Get all users who attended same meetups
2. Exclude:
   - Current user
   - Users you already messaged
   - Users you already expressed interest in
3. Limit to 30 users
4. Display as "Potential Connections"
```

### Implementation

```javascript
const loadRecommendations = async () => {
  // Get meetups user signed up for
  const { data: userSignups } = await supabase
    .from('meetup_signups')
    .select('meetup_id')
    .eq('user_id', user.id);

  const meetupIds = userSignups.map(s => s.meetup_id);

  if (meetupIds.length === 0) {
    setRecommendations([]);
    return;
  }

  // Get all users from same meetups
  const { data: otherSignups } = await supabase
    .from('meetup_signups')
    .select('user_id')
    .in('meetup_id', meetupIds)
    .neq('user_id', user.id);

  const candidateUserIds = [...new Set(otherSignups.map(s => s.user_id))];

  // Get users you've messaged
  const { data: conversations } = await supabase
    .from('messages')
    .select('sender_id, receiver_id')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

  const messagedUserIds = new Set();
  conversations.forEach(msg => {
    if (msg.sender_id === user.id) {
      messagedUserIds.add(msg.receiver_id);
    } else {
      messagedUserIds.add(msg.sender_id);
    }
  });

  // Get users you've expressed interest in
  const { data: interests } = await supabase
    .from('user_interests')
    .select('interested_in_user_id')
    .eq('user_id', user.id);

  const interestedUserIds = new Set(
    interests.map(i => i.interested_in_user_id)
  );

  // Filter candidates
  const recommendedUserIds = candidateUserIds.filter(id =>
    !messagedUserIds.has(id) &&
    !interestedUserIds.has(id)
  );

  // Load profiles (limit 30)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', recommendedUserIds)
    .limit(30);

  setRecommendations(profiles);
};
```

### Display

```jsx
<div className="space-y-4">
  <h2 className="text-xl font-bold">Potential Connections</h2>
  <p className="text-sm text-gray-600">
    People who attended the same meetups as you
  </p>

  <div className="grid grid-cols-3 gap-4">
    {recommendations.map(user => (
      <div key={user.id} className="border rounded-lg p-4">
        {/* Profile */}
        <div className="w-20 h-20 bg-blue-500 rounded-full mx-auto">
          <span className="text-3xl text-white">
            {user.name?.charAt(0).toUpperCase()}
          </span>
        </div>

        <h3 className="font-semibold text-center mt-3">{user.name}</h3>
        <p className="text-sm text-gray-600 text-center">{user.career}</p>

        {/* Location */}
        {user.city && (
          <p className="text-xs text-gray-500 text-center mt-1">
            {user.city}, {user.state}
          </p>
        )}

        {/* Interests */}
        {user.interests && user.interests.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {user.interests.slice(0, 3).map((interest, i) => (
              <span key={i} className="text-xs bg-gray-200 px-2 py-1 rounded">
                {interest}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => handleViewProfile(user.id)}
            className="btn-secondary flex-1 text-sm"
          >
            View
          </button>
          <button
            onClick={() => handleExpressInterest(user.id)}
            className="btn-primary flex-1 text-sm"
          >
            Connect
          </button>
        </div>
      </div>
    ))}
  </div>

  {recommendations.length === 0 && (
    <p className="text-center text-gray-500 py-8">
      No recommendations yet. Sign up for more meetups to discover connections!
    </p>
  )}
</div>
```

---

## User Profile View

### Features
- View full profile details
- See shared meetups
- Message button
- Express interest button
- Coffee chat request button

### Implementation

```jsx
const UserProfileModal = ({ userId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [sharedMeetups, setSharedMeetups] = useState([]);

  useEffect(() => {
    loadProfile();
    loadSharedMeetups();
  }, [userId]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    setProfile(data);
  };

  const loadSharedMeetups = async () => {
    // Get current user's meetups
    const { data: mySignups } = await supabase
      .from('meetup_signups')
      .select('meetup_id')
      .eq('user_id', user.id);

    // Get their meetups
    const { data: theirSignups } = await supabase
      .from('meetup_signups')
      .select('meetup_id, meetups(*)')
      .eq('user_id', userId);

    // Find shared ones
    const myMeetupIds = mySignups.map(s => s.meetup_id);
    const shared = theirSignups.filter(s =>
      myMeetupIds.includes(s.meetup_id)
    );

    setSharedMeetups(shared.map(s => s.meetups));
  };

  if (!profile) return null;

  return (
    <div className="modal">
      <div className="modal-content max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 bg-purple-500 rounded-full">
              <span className="text-4xl text-white">
                {profile.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{profile.name}</h2>
              <p className="text-gray-600">{profile.career}</p>
              <p className="text-sm text-gray-500">
                {profile.city}, {profile.state}
              </p>
            </div>
          </div>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mt-6">
            <h3 className="font-semibold">About</h3>
            <p className="text-gray-700 mt-2">{profile.bio}</p>
          </div>
        )}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold">Interests</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.interests.map((interest, i) => (
                <span key={i} className="bg-purple-100 px-3 py-1 rounded-full">
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Shared Meetups */}
        {sharedMeetups.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold">
              Shared Meetups ({sharedMeetups.length})
            </h3>
            <div className="space-y-2 mt-2">
              {sharedMeetups.map(meetup => (
                <div key={meetup.id} className="border-l-4 border-purple-500 pl-3">
                  <p className="font-medium">{meetup.title}</p>
                  <p className="text-sm text-gray-600">
                    {formatDate(meetup.date)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={() => handleMessageUser(userId)}
            className="btn-secondary flex-1"
          >
            Send Message
          </button>
          <button
            onClick={() => handleRequestCoffeeChat(userId)}
            className="btn-primary flex-1"
          >
            Request Coffee Chat
          </button>
          <button
            onClick={() => handleExpressInterest(userId)}
            className="btn-primary"
          >
            {hasExpressedInterest(userId) ? 'Interested ✓' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## Future Enhancements

### 1. Mutual Interest Notifications
When User B also expresses interest in User A:
```javascript
// Check for mutual interest
const { data: reverseInterest } = await supabase
  .from('user_interests')
  .select('*')
  .eq('user_id', targetUserId)
  .eq('interested_in_user_id', user.id)
  .single();

if (reverseInterest) {
  // Send notification: "You both expressed interest in each other!"
  sendNotification(user.id, 'mutual_interest', targetUserId);
  sendNotification(targetUserId, 'mutual_interest', user.id);
}
```

### 2. Interest-Based Matching
Match users by shared interests:
```javascript
const findSimilarUsers = async () => {
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('interests')
    .eq('id', user.id)
    .single();

  const { data: others } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', user.id);

  // Calculate similarity (Jaccard index)
  const similarities = others.map(other => {
    const myInterests = new Set(myProfile.interests || []);
    const theirInterests = new Set(other.interests || []);

    const intersection = new Set(
      [...myInterests].filter(i => theirInterests.has(i))
    );

    const union = new Set([...myInterests, ...theirInterests]);

    const similarity = intersection.size / union.size;

    return { user: other, similarity };
  });

  // Sort by similarity
  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, 10); // Top 10
};
```

### 3. Career-Based Recommendations
Match users in similar fields:
```javascript
const findSimilarCareers = async () => {
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('career')
    .eq('id', user.id)
    .single();

  // Extract keywords from career
  const keywords = myProfile.career
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(w => w.length > 3);

  // Full-text search on careers
  const { data: others } = await supabase
    .from('profiles')
    .select('*')
    .textSearch('career', keywords.join(' | '))
    .neq('id', user.id)
    .limit(20);

  return others;
};
```

---

**See also:**
- [Messaging](./MESSAGING.md)
- [Coffee Chats](./COFFEE_CHATS.md)
- [Meetups](./MEETUPS.md)
- [Roadmap](./ROADMAP.md)

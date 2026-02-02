// components/MeetupsView.js
// Meetups page - Coffee chats and group events combined
// UX design based on meetups-page.jsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Video, Calendar, MapPin, Clock, Users, Plus, X, Sparkles } from 'lucide-react';
import PostMeetingSummary from './PostMeetingSummary';

export default function MeetupsView({ currentUser, supabase, connections = [], meetups = [], userSignups = [], onNavigate }) {
  const [activeView, setActiveView] = useState('upcoming');
  const [activeFilter, setActiveFilter] = useState('all');
  const [coffeeChats, setCoffeeChats] = useState([]);
  const [groupEvents, setGroupEvents] = useState([]);
  const [pastMeetups, setPastMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState({
    coffeeChats: 0,
    circleInvites: 0
  });

  // Recap modal state
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [selectedRecap, setSelectedRecap] = useState(null);
  const [loadingRecap, setLoadingRecap] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentUser.id, meetups, userSignups]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadCoffeeChats(),
      loadGroupEvents(),
      loadPastMeetups(),
      loadPendingRequests()
    ]);
    setLoading(false);
  };

  const loadCoffeeChats = useCallback(async () => {
    try {
      // Load all coffee chats for the user
      const { data, error } = await supabase
        .from('coffee_chats')
        .select(`
          id,
          requester_id,
          recipient_id,
          status,
          scheduled_time,
          notes,
          room_url,
          created_at
        `)
        .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .in('status', ['pending', 'accepted', 'scheduled'])
        .order('scheduled_time', { ascending: true });

      if (error) {
        // Silently handle missing table - feature not yet set up
        if (error.message.includes('does not exist') || error.code === '42P01') {
          setCoffeeChats([]);
          return;
        }
        console.log('Coffee chats error:', error.message);
        setCoffeeChats([]);
        return;
      }

      // Filter to only upcoming chats (client-side filter)
      // Allow 1 hour grace period for recently started chats
      const now = new Date();
      const gracePeriod = new Date(now.getTime() - 60 * 60 * 1000);

      const upcomingChats = (data || []).filter(chat => {
        if (!chat.scheduled_time) return false;
        const chatTime = new Date(chat.scheduled_time);
        return chatTime >= gracePeriod;
      });

      // Get profile info for the other person in each chat
      const otherUserIds = upcomingChats.map(chat =>
        chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id
      );

      let profiles = [];
      if (otherUserIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, name, career, profile_picture')
          .in('id', otherUserIds);
        profiles = profileData || [];
      }

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const chatsWithProfiles = upcomingChats.map(chat => {
        const otherId = chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id;
        const profile = profileMap.get(otherId);
        // Extract date and time from scheduled_time timestamp
        const scheduledDate = chat.scheduled_time ? new Date(chat.scheduled_time) : null;
        return {
          ...chat,
          type: 'coffee',
          with: profile?.name || 'Unknown',
          avatar: profile?.profile_picture,
          role: profile?.career || 'Professional',
          date: scheduledDate ? formatDate(scheduledDate.toISOString()) : 'TBD',
          time: scheduledDate ? formatTime(scheduledDate.toTimeString().slice(0, 5)) : 'TBD',
          duration: '30 min',
          scheduled_date: chat.scheduled_time // Keep for sorting
        };
      });

      setCoffeeChats(chatsWithProfiles);
    } catch (err) {
      console.error('Error loading coffee chats:', err);
      setCoffeeChats([]);
    }
  }, [currentUser.id, supabase]);

  const loadGroupEvents = useCallback(async () => {
    try {
      const signedUpMeetupIds = userSignups || [];

      // Fetch meetups user is signed up for OR created (for circle meetups)
      let query = supabase
        .from('meetups')
        .select('*, connection_groups(id, name)')
        .order('date', { ascending: true });

      // Get signed up meetups OR circle meetups created by user
      if (signedUpMeetupIds.length > 0) {
        query = query.or(`id.in.(${signedUpMeetupIds.join(',')}),created_by.eq.${currentUser.id}`);
      } else {
        query = query.eq('created_by', currentUser.id);
      }

      const { data: signedUpMeetups, error } = await query;

      if (error) {
        console.error('Error fetching signed up meetups:', error);
        setGroupEvents([]);
        return;
      }

      // Filter to upcoming ones
      const now = new Date();
      const upcomingEvents = (signedUpMeetups || []).filter(meetup => {
        try {
          let meetupDate;
          const dateStr = meetup.date;

          if (dateStr?.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            meetupDate = new Date(year, month - 1, day);
          } else if (dateStr) {
            const cleanDateStr = dateStr.replace(/^[A-Za-z]+,\s*/, '');
            meetupDate = new Date(`${cleanDateStr} ${new Date().getFullYear()}`);
          } else {
            return false;
          }

          if (meetup.time) {
            const [hours, minutes] = meetup.time.split(':').map(Number);
            meetupDate.setHours(hours, minutes, 0, 0);
          }

          // Include meetups within 4 hour grace period
          const gracePeriod = new Date(meetupDate.getTime() + (4 * 60 * 60 * 1000));
          return now < gracePeriod;
        } catch {
          return false;
        }
      }).map(meetup => {
        const isCircleMeetup = !!meetup.circle_id;
        const circleName = meetup.connection_groups?.name;

        return {
          ...meetup,
          type: 'group',
          title: meetup.topic || (isCircleMeetup ? `${circleName} Meetup` : 'Community Meetup'),
          emoji: isCircleMeetup ? '🔒' : getEventEmoji(meetup.topic),
          host: isCircleMeetup ? circleName : 'CircleW Community',
          originalDate: meetup.date,
          date: formatDate(meetup.date),
          time: formatTime(meetup.time),
          duration: `${meetup.duration || 60} min`,
          location: meetup.location || 'Virtual',
          attendees: meetup.signupCount || 0,
          maxAttendees: meetup.participantLimit || meetup.max_attendees || 100,
          status: 'going', // User is signed up
          description: meetup.description || (isCircleMeetup ? `Private meetup for ${circleName}` : 'Join us for meaningful connections.'),
          isCircleMeetup
        };
      });

      setGroupEvents(upcomingEvents);
    } catch (err) {
      console.error('Error loading group events:', err);
      setGroupEvents([]);
    }
  }, [userSignups, supabase]);

  const loadPastMeetups = useCallback(async () => {
    try {
      const now = new Date();
      const gracePeriod = new Date(now.getTime() - 60 * 60 * 1000);
      const allPastMeetups = [];

      // 1. Load past coffee chats
      try {
        const { data: coffeeData } = await supabase
          .from('coffee_chats')
          .select('*')
          .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
          .order('scheduled_time', { ascending: false })
          .limit(20);

        const pastChats = (coffeeData || []).filter(chat => {
          if (!chat.scheduled_time) return false;
          const chatTime = new Date(chat.scheduled_time);
          return chat.status === 'completed' || chatTime < gracePeriod;
        });

        // Get profile info for coffee chat partners
        const otherUserIds = pastChats.map(chat =>
          chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id
        ).filter(Boolean);

        let profiles = [];
        if (otherUserIds.length > 0) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, name, profile_picture, career')
            .in('id', otherUserIds);
          profiles = profileData || [];
        }

        const profileMap = new Map(profiles.map(p => [p.id, p]));

        pastChats.forEach(chat => {
          const otherId = chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id;
          const profile = profileMap.get(otherId);
          allPastMeetups.push({
            id: `coffee-${chat.id}`,
            sourceId: chat.id,
            type: 'coffee',
            with: profile?.name || 'Unknown',
            withProfile: profile,
            title: `☕ Coffee with ${profile?.name || 'Unknown'}`,
            emoji: '☕',
            date: formatDate(chat.scheduled_time || chat.created_at),
            rawDate: new Date(chat.scheduled_time || chat.created_at),
            topic: chat.notes || 'Coffee chat',
            notes: null,
            followUp: chat.status !== 'completed',
          });
        });
      } catch (e) {
        console.log('Coffee chats not available:', e.message);
      }

      // 2. Load past meetups user attended (both circle and public)
      try {
        // Get meetup IDs the user signed up for
        const { data: signups } = await supabase
          .from('meetup_signups')
          .select('meetup_id')
          .eq('user_id', currentUser.id);

        const signedUpIds = (signups || []).map(s => s.meetup_id);

        // Also include meetups user created
        let meetupsQuery = supabase
          .from('meetups')
          .select('*, connection_groups(id, name)')
          .order('date', { ascending: false })
          .limit(30);

        if (signedUpIds.length > 0) {
          meetupsQuery = meetupsQuery.or(`id.in.(${signedUpIds.join(',')}),created_by.eq.${currentUser.id}`);
        } else {
          meetupsQuery = meetupsQuery.eq('created_by', currentUser.id);
        }

        const { data: meetupsData } = await meetupsQuery;

        // Filter to past meetups
        const pastMeetups = (meetupsData || []).filter(meetup => {
          const meetupDate = new Date(`${meetup.date}T${meetup.time || '00:00'}`);
          return meetupDate < gracePeriod;
        });

        pastMeetups.forEach(meetup => {
          const isCircle = !!meetup.circle_id;
          const circleName = meetup.connection_groups?.name;

          allPastMeetups.push({
            id: `meetup-${meetup.id}`,
            sourceId: meetup.id,
            type: isCircle ? 'circle' : 'public',
            with: isCircle ? circleName : null,
            title: isCircle
              ? `🔒 ${circleName || 'Circle'} Meetup`
              : `🎉 ${meetup.topic || 'Event'}`,
            emoji: isCircle ? '🔒' : '🎉',
            date: formatDate(meetup.date),
            rawDate: new Date(`${meetup.date}T${meetup.time || '00:00'}`),
            topic: meetup.topic || meetup.description || (isCircle ? 'Circle meetup' : 'Public event'),
            notes: meetup.description,
            location: meetup.location,
            followUp: false,
            circleName: circleName,
            circleId: meetup.circle_id,
          });
        });
      } catch (e) {
        console.log('Meetups not available:', e.message);
      }

      // 3. Fetch call recaps to match with past meetups
      let recaps = [];
      try {
        const { data: recapData } = await supabase
          .from('call_recaps')
          .select('*')
          .or(`created_by.eq.${currentUser.id},participant_ids.cs.{${currentUser.id}}`)
          .order('created_at', { ascending: false })
          .limit(50);
        recaps = recapData || [];
      } catch (e) {
        console.log('Call recaps not available');
      }

      // Match recaps to meetups and extract topics
      allPastMeetups.forEach(item => {
        const matchingRecap = recaps.find(r => {
          const recapTime = new Date(r.started_at || r.created_at);
          const timeDiff = Math.abs(item.rawDate - recapTime);
          // Match if within 4 hours
          return timeDiff < 4 * 60 * 60 * 1000;
        });

        if (matchingRecap) {
          item.hasRecap = true;
          item.recapId = matchingRecap.id;
          item.recapData = matchingRecap;

          // Extract topics from AI summary
          if (matchingRecap.ai_summary?.topicsDiscussed) {
            item.topicsDiscussed = matchingRecap.ai_summary.topicsDiscussed.slice(0, 3);
          }
        }
      });

      // 4. Fetch participants for group meetups
      const meetupIds = allPastMeetups
        .filter(m => m.type === 'circle' || m.type === 'public')
        .map(m => m.sourceId);

      if (meetupIds.length > 0) {
        try {
          const { data: signupData } = await supabase
            .from('meetup_signups')
            .select('meetup_id, user_id, profiles(id, name, profile_picture, career)')
            .in('meetup_id', meetupIds);

          // Group participants by meetup
          const participantsByMeetup = {};
          (signupData || []).forEach(signup => {
            if (!participantsByMeetup[signup.meetup_id]) {
              participantsByMeetup[signup.meetup_id] = [];
            }
            if (signup.profiles) {
              participantsByMeetup[signup.meetup_id].push(signup.profiles);
            }
          });

          // Attach participants to meetups
          allPastMeetups.forEach(item => {
            if (item.type === 'circle' || item.type === 'public') {
              item.participants = participantsByMeetup[item.sourceId] || [];
            }
          });
        } catch (e) {
          console.log('Could not fetch participants:', e.message);
        }
      }

      // Sort by date descending
      allPastMeetups.sort((a, b) => b.rawDate - a.rawDate);

      setPastMeetups(allPastMeetups);
    } catch (err) {
      console.error('Error loading past meetups:', err);
      setPastMeetups([]);
    }
  }, [currentUser.id, supabase]);

  // View recap for a past meetup
  const handleViewRecap = async (item) => {
    // Generate appropriate summary based on meetup type
    const getSummaryForType = () => {
      if (item.type === 'coffee') {
        return {
          summary: `You had a coffee chat with ${item.with}. ${item.topic ? `Topic: ${item.topic}` : ''}`,
          sentiment: { overall: 'Productive', emoji: '☕', highlights: ['Connection made'] },
          keyTakeaways: [{ emoji: '🤝', text: `Connected with ${item.with}` }],
          topicsDiscussed: item.topic ? [{ topic: item.topic, mentions: 1 }] : [],
          memorableQuotes: [],
          actionItems: [{ text: `Follow up with ${item.with}`, done: false }],
          suggestedFollowUps: [{ personName: item.with, reason: 'Continue building the relationship', suggestedTopic: 'Catch up and discuss next steps' }]
        };
      } else if (item.type === 'circle') {
        return {
          summary: `You attended a ${item.circleName || 'circle'} meetup. ${item.topic ? `Topic: ${item.topic}` : ''}`,
          sentiment: { overall: 'Engaging', emoji: '🔒', highlights: ['Circle connection', 'Group discussion'] },
          keyTakeaways: [{ emoji: '👥', text: `Participated in ${item.circleName || 'circle'} meetup` }],
          topicsDiscussed: item.topic ? [{ topic: item.topic, mentions: 1 }] : [],
          memorableQuotes: [],
          actionItems: [{ text: `Review notes from ${item.circleName || 'circle'} meetup`, done: false }],
          suggestedFollowUps: []
        };
      } else {
        // Public event
        return {
          summary: `You attended "${item.topic}". ${item.location ? `Location: ${item.location}` : ''}`,
          sentiment: { overall: 'Inspiring', emoji: '🎉', highlights: ['Networking', 'Learning'] },
          keyTakeaways: [{ emoji: '✨', text: `Attended ${item.topic}` }],
          topicsDiscussed: item.topic ? [{ topic: item.topic, mentions: 1 }] : [],
          memorableQuotes: [],
          actionItems: [{ text: 'Follow up with people you met', done: false }],
          suggestedFollowUps: []
        };
      }
    };

    if (item.recapData && item.recapData.ai_summary) {
      // We have stored AI recap data
      setSelectedRecap({
        meeting: {
          title: item.title,
          type: item.type,
          emoji: item.emoji,
          host: item.type === 'coffee' ? 'You' : (item.circleName || 'Host'),
          date: item.date,
          duration: item.recapData.duration_seconds,
          location: item.location || 'Video Call'
        },
        summary: item.recapData.ai_summary,
        participants: item.withProfile ? [item.withProfile] : []
      });
    } else {
      // Generate a basic recap on the fly
      setSelectedRecap({
        meeting: {
          title: item.title,
          type: item.type,
          emoji: item.emoji,
          host: item.type === 'coffee' ? 'You' : (item.circleName || 'Host'),
          date: item.date,
          duration: 0,
          location: item.location || 'Video Call'
        },
        summary: getSummaryForType(),
        participants: item.withProfile ? [item.withProfile] : []
      });
    }
    setShowRecapModal(true);
  };

  const loadPendingRequests = useCallback(async () => {
    try {
      // Count pending coffee chat requests (where user is recipient)
      const { count: pendingCoffee, error: coffeeError } = await supabase
        .from('coffee_chats')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', currentUser.id)
        .eq('status', 'pending');

      // Count pending circle invites
      const { count: pendingCircles, error: circleError } = await supabase
        .from('connection_group_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('status', 'invited');

      setPendingRequests({
        coffeeChats: coffeeError ? 0 : (pendingCoffee || 0),
        circleInvites: circleError ? 0 : (pendingCircles || 0)
      });
    } catch (err) {
      // Silently handle errors
      setPendingRequests({ coffeeChats: 0, circleInvites: 0 });
    }
  }, [currentUser.id, supabase]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === now.toDateString()) return 'Today';
      if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'TBD';
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
      return timeStr;
    }
  };

  const getEventEmoji = (topic) => {
    if (!topic) return '🎯';
    const lower = topic.toLowerCase();
    if (lower.includes('network')) return '🤝';
    if (lower.includes('workshop')) return '🛠️';
    if (lower.includes('career')) return '💼';
    if (lower.includes('mentor')) return '🌟';
    if (lower.includes('coffee')) return '☕';
    if (lower.includes('social')) return '🎉';
    return '🎯';
  };

  const getStatusStyle = (status) => {
    switch(status) {
      case 'confirmed':
      case 'going':
        return { bg: 'rgba(92, 64, 51, 0.12)', color: '#5C4033', text: status === 'confirmed' ? '✓ Confirmed' : '✓ Going' };
      case 'pending':
      case 'scheduled':
        return { bg: 'rgba(196, 149, 106, 0.2)', color: '#8B6F5C', text: '⏳ Pending' };
      case 'open':
        return { bg: 'rgba(139, 111, 92, 0.1)', color: '#5C4033', text: 'Open' };
      default:
        return { bg: 'rgba(139, 111, 92, 0.1)', color: '#5C4033', text: status || 'Open' };
    }
  };

  const handleJoinCall = (meetup) => {
    // Route based on meetup type
    if (meetup.isCircleMeetup || meetup.circle_id) {
      // Circle meetup - use Agora via /call/circle/
      const channelName = `connection-group-${meetup.circle_id}`;
      window.location.href = `/call/circle/${channelName}`;
    } else if (meetup.type === 'coffee' || meetup.type === '1on1') {
      // Coffee chat - use WebRTC via /call/coffee/
      window.location.href = `/call/coffee/${meetup.room_id || meetup.id}`;
    } else {
      // Regular group meetup - use LiveKit via /call/meetup/
      const channelName = `meetup-${meetup.id}`;
      window.location.href = `/call/meetup/${channelName}`;
    }
  };

  const handleScheduleCoffeeChat = () => {
    // Navigate to unified schedule meetup page
    if (onNavigate) onNavigate('scheduleMeetup');
  };

  // Separate circle and public events
  const circleEvents = groupEvents.filter(e => e.isCircleMeetup);
  const publicEvents = groupEvents.filter(e => !e.isCircleMeetup);

  const allUpcoming = [...coffeeChats, ...groupEvents].sort((a, b) => {
    // Sort by date - use scheduled_date for coffee chats, original date for group events
    const dateA = a.scheduled_date ? new Date(a.scheduled_date) : new Date(a.originalDate || a.date);
    const dateB = b.scheduled_date ? new Date(b.scheduled_date) : new Date(b.originalDate || b.date);
    return dateA - dateB;
  });

  const filteredItems = activeFilter === 'all'
    ? allUpcoming
    : activeFilter === 'coffee'
      ? coffeeChats
      : activeFilter === 'circle'
        ? circleEvents
        : publicEvents;

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>Loading your meetups...</p>
        <style>{keyframeStyles}</style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.ambientBg}></div>

      {/* Page Title Section */}
      <section style={styles.titleSection}>
        <div style={styles.titleLeft}>
          <h1 style={styles.pageTitle}>Meetups</h1>
          <p style={styles.subtitle}>Your upcoming connections & events</p>
        </div>
        <button style={styles.scheduleBtn} onClick={handleScheduleCoffeeChat}>
          <Plus size={18} />
          Schedule Meetup
        </button>
      </section>

      {/* Quick Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statInfo}>
            <span style={styles.statNumber}>{coffeeChats.length}</span>
            <span style={styles.statLabel}>☕ 1:1 Chats</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statInfo}>
            <span style={styles.statNumber}>{circleEvents.length}</span>
            <span style={styles.statLabel}>🔒 Circle</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statInfo}>
            <span style={styles.statNumber}>{publicEvents.length}</span>
            <span style={styles.statLabel}>🌐 Public</span>
          </div>
        </div>
        {(pendingRequests.coffeeChats + pendingRequests.circleInvites) > 0 ? (
          <div
            style={{...styles.statCard, ...styles.pendingCard}}
            onClick={() => onNavigate && onNavigate(pendingRequests.coffeeChats > 0 ? 'coffeeChats' : 'connectionGroups')}
          >
            <div style={styles.statInfo}>
              <span style={styles.statNumber}>{pendingRequests.coffeeChats + pendingRequests.circleInvites}</span>
              <span style={styles.statLabel}>🔔 Pending</span>
            </div>
            <span style={styles.pendingBadge}>Action needed</span>
          </div>
        ) : (
          <div style={styles.statCard}>
            <div style={styles.statInfo}>
              <span style={styles.statNumber}>{allUpcoming.length}</span>
              <span style={styles.statLabel}>📋 Total</span>
            </div>
          </div>
        )}
      </div>

      {/* View Toggle & Filters */}
      <div style={styles.controlsRow}>
        <div style={styles.viewToggle}>
          <button
            style={{...styles.viewBtn, ...(activeView === 'upcoming' ? styles.viewBtnActive : {})}}
            onClick={() => setActiveView('upcoming')}
          >
            Upcoming
          </button>
          <button
            style={{...styles.viewBtn, ...(activeView === 'past' ? styles.viewBtnActive : {})}}
            onClick={() => setActiveView('past')}
          >
            Past
          </button>
        </div>

        {activeView === 'upcoming' && (
          <div style={styles.filterTabs}>
            {[
              { key: 'all', label: 'All', icon: '📋', count: allUpcoming.length },
              { key: 'coffee', label: '1:1', icon: '☕', count: coffeeChats.length },
              { key: 'circle', label: 'Circle', icon: '🔒', count: circleEvents.length },
              { key: 'public', label: 'Public', icon: '🌐', count: publicEvents.length },
            ].map(filter => (
              <button
                key={filter.key}
                style={{...styles.filterTab, ...(activeFilter === filter.key ? styles.filterTabActive : {})}}
                onClick={() => setActiveFilter(filter.key)}
              >
                <span style={styles.filterIcon}>{filter.icon}</span>
                {filter.label}
                {filter.count > 0 && <span style={styles.filterCount}>{filter.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {activeView === 'upcoming' ? (
        <div style={styles.meetupsList}>
          {filteredItems.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📅</span>
              <h3 style={styles.emptyTitle}>No upcoming meetups</h3>
              <p style={styles.emptyText}>Schedule a coffee chat or join a group event!</p>
              <button style={styles.emptyBtn} onClick={() => onNavigate && onNavigate('home')}>
                Browse Events
              </button>
            </div>
          ) : (
            filteredItems.map((item, index) => (
              item.type === 'coffee' ? (
                // Coffee Chat Card
                <div key={item.id} style={{...styles.meetupCard, animationDelay: `${index * 0.1}s`}}>
                  <div style={styles.cardLeft}>
                    <div style={styles.coffeeIcon}>☕</div>
                  </div>

                  <div style={styles.cardContent}>
                    <div style={styles.cardHeader}>
                      <div style={styles.cardType}>Coffee Chat</div>
                      <div style={{
                        ...styles.statusBadge,
                        backgroundColor: getStatusStyle(item.status).bg,
                        color: getStatusStyle(item.status).color
                      }}>
                        {getStatusStyle(item.status).text}
                      </div>
                    </div>

                    <div style={styles.personRow}>
                      {item.avatar ? (
                        <img src={item.avatar} alt={item.with} style={styles.personAvatarImg} />
                      ) : (
                        <span style={styles.personAvatar}>👤</span>
                      )}
                      <div style={styles.personInfo}>
                        <span style={styles.personName}>{item.with}</span>
                        <span style={styles.personRole}>{item.role}</span>
                      </div>
                    </div>

                    {item.topic && (
                      <div style={styles.topicRow}>
                        <span style={styles.topicLabel}>Topic:</span>
                        <span style={styles.topicText}>{item.topic}</span>
                      </div>
                    )}
                  </div>

                  <div style={styles.cardRight}>
                    <div style={styles.dateBlock}>
                      <span style={styles.dateDay}>{item.date}</span>
                      <span style={styles.dateTime}>{item.time}</span>
                      <span style={styles.dateDuration}>{item.duration}</span>
                    </div>
                    <div style={styles.locationBlock}>
                      <span style={styles.locationIcon}>{item.location?.includes('Zoom') || item.location?.includes('Virtual') ? '💻' : '📍'}</span>
                      <span style={styles.locationText}>{item.location || 'Virtual'}</span>
                    </div>
                    <div style={styles.cardActions}>
                      <button style={styles.actionBtnPrimary} onClick={() => handleJoinCall(item)}>
                        <Video size={14} style={{ marginRight: 6 }} />
                        Join
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Group Event Card (Circle or Public)
                <div key={item.id} style={{
                  ...styles.meetupCard,
                  ...styles.groupCard,
                  ...(item.isCircleMeetup ? styles.circleCard : styles.publicCard),
                  animationDelay: `${index * 0.1}s`
                }}>
                  <div style={styles.cardLeft}>
                    <div style={item.isCircleMeetup ? styles.circleIcon : styles.publicIcon}>
                      {item.isCircleMeetup ? '🔒' : '🌐'}
                    </div>
                  </div>

                  <div style={styles.cardContent}>
                    <div style={styles.cardHeader}>
                      <div style={item.isCircleMeetup ? styles.cardTypeCircle : styles.cardTypePublic}>
                        {item.isCircleMeetup ? 'Intimate Circle' : 'Public Event'}
                      </div>
                      <div style={{
                        ...styles.statusBadge,
                        backgroundColor: getStatusStyle(item.status).bg,
                        color: getStatusStyle(item.status).color
                      }}>
                        {getStatusStyle(item.status).text}
                      </div>
                    </div>

                    <h3 style={styles.eventTitle}>{item.title}</h3>
                    <p style={styles.eventHost}>Hosted by {item.host}</p>
                    <p style={styles.eventDesc}>{item.description}</p>
                  </div>

                  <div style={styles.cardRight}>
                    <div style={styles.dateBlock}>
                      <span style={styles.dateDay}>{item.date}</span>
                      <span style={styles.dateTime}>{item.time}</span>
                      <span style={styles.dateDuration}>{item.duration}</span>
                    </div>
                    <div style={styles.locationBlock}>
                      <span style={styles.locationIcon}>{item.location?.includes('Zoom') || item.location === 'Virtual' ? '💻' : '📍'}</span>
                      <span style={styles.locationText}>{item.location}</span>
                    </div>
                    <div style={styles.attendeesBlock}>
                      <span style={styles.attendeeText}>{item.attendees}/{item.maxAttendees} attending</span>
                    </div>
                    <div style={styles.cardActions}>
                      {item.status === 'going' ? (
                        <button style={styles.actionBtnGoing} onClick={() => handleJoinCall(item)}>
                          <Video size={14} style={{ marginRight: 6 }} />
                          Join Room
                        </button>
                      ) : (
                        <button style={styles.actionBtnPrimary} onClick={() => onNavigate && onNavigate('home')}>
                          RSVP
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            ))
          )}
        </div>
      ) : (
        // Past Meetups
        <div style={styles.pastList}>
          {pastMeetups.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📚</span>
              <h3 style={styles.emptyTitle}>No past meetups yet</h3>
              <p style={styles.emptyText}>Your completed calls will appear here</p>
            </div>
          ) : (
            pastMeetups.map((item, index) => (
              <div key={item.id} style={{...styles.pastCardNew, animationDelay: `${index * 0.1}s`}}>
                {/* Card Header */}
                <div style={styles.pastCardHeader}>
                  <div style={styles.pastCardLeft}>
                    <div style={{
                      ...styles.pastIconNew,
                      background: item.type === 'coffee'
                        ? 'linear-gradient(135deg, #D4A574 0%, #C4956A 100%)'
                        : item.type === 'circle'
                          ? 'linear-gradient(135deg, #5C4033 0%, #3D2B1F 100%)'
                          : 'linear-gradient(135deg, #C4956A 0%, #A67B5B 100%)'
                    }}>
                      {item.emoji}
                    </div>
                    <div style={styles.pastCardInfo}>
                      <span style={styles.pastCardType}>
                        {item.type === 'coffee' && `Coffee Chat`}
                        {item.type === 'circle' && `Circle Meetup`}
                        {item.type === 'public' && `Public Event`}
                      </span>
                      <span style={styles.pastCardTitle}>
                        {item.type === 'coffee' && item.with}
                        {item.type === 'circle' && (item.circleName || 'Circle')}
                        {item.type === 'public' && (item.topic || 'Event')}
                      </span>
                      <span style={styles.pastCardDate}>{item.date}</span>
                    </div>
                  </div>
                  <div style={styles.pastCardActions}>
                    <button
                      style={styles.viewRecapBtnNew}
                      onClick={() => handleViewRecap(item)}
                    >
                      <Sparkles size={14} />
                      {item.hasRecap ? 'View Recap' : 'Summary'}
                    </button>
                  </div>
                </div>

                {/* Participants Section */}
                {(item.type === 'coffee' && item.withProfile) && (
                  <div style={styles.pastSection}>
                    <span style={styles.pastSectionLabel}>Participant</span>
                    <div style={styles.participantsList}>
                      <div style={styles.participantChip}>
                        {item.withProfile.profile_picture ? (
                          <img src={item.withProfile.profile_picture} alt="" style={styles.participantAvatar} />
                        ) : (
                          <span style={styles.participantAvatarPlaceholder}>👤</span>
                        )}
                        <span style={styles.participantName}>{item.withProfile.name}</span>
                        {item.withProfile.career && (
                          <span style={styles.participantRole}>{item.withProfile.career}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {((item.type === 'circle' || item.type === 'public') && item.participants?.length > 0) && (
                  <div style={styles.pastSection}>
                    <span style={styles.pastSectionLabel}>
                      {item.participants.length} Participant{item.participants.length > 1 ? 's' : ''}
                    </span>
                    <div style={styles.participantsList}>
                      {item.participants.slice(0, 4).map((p, idx) => (
                        <div key={p.id || idx} style={styles.participantChip}>
                          {p.profile_picture ? (
                            <img src={p.profile_picture} alt="" style={styles.participantAvatar} />
                          ) : (
                            <span style={styles.participantAvatarPlaceholder}>👤</span>
                          )}
                          <span style={styles.participantName}>{p.name}</span>
                        </div>
                      ))}
                      {item.participants.length > 4 && (
                        <span style={styles.moreParticipants}>+{item.participants.length - 4} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Topics Discussed Section */}
                {item.topicsDiscussed?.length > 0 && (
                  <div style={styles.pastSection}>
                    <span style={styles.pastSectionLabel}>Topics Discussed</span>
                    <div style={styles.topicsList}>
                      {item.topicsDiscussed.map((t, idx) => (
                        <span key={idx} style={styles.topicChip}>
                          {t.topic}
                          {t.mentions > 1 && <span style={styles.topicMentions}>{t.mentions}x</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallback: Show topic/notes if no AI topics */}
                {!item.topicsDiscussed?.length && item.topic && item.type !== 'public' && (
                  <div style={styles.pastSection}>
                    <span style={styles.pastSectionLabel}>Topic</span>
                    <p style={styles.pastTopicText}>{item.topic}</p>
                  </div>
                )}

                {/* Follow-up action for coffee chats */}
                {item.followUp && item.type === 'coffee' && (
                  <div style={styles.pastFooter}>
                    <button style={styles.followUpBtnNew} onClick={handleScheduleCoffeeChat}>
                      Schedule Follow-up
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Suggested Section */}
      {activeView === 'upcoming' && groupEvents.length < 3 && (
        <section style={styles.suggestedSection}>
          <h2 style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>✨</span>
            Discover More Events
          </h2>
          <p style={styles.suggestedText}>
            Check out upcoming circle meetups and expand your network!
          </p>
          <button style={styles.suggestedBtn} onClick={() => onNavigate && onNavigate('home')}>
            Browse Events
          </button>
        </section>
      )}

      <style>{keyframeStyles}</style>

      {/* Recap Modal */}
      {showRecapModal && selectedRecap && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <PostMeetingSummary
              meeting={selectedRecap.meeting}
              summary={selectedRecap.summary}
              participants={selectedRecap.participants}
              currentUserId={currentUser.id}
              onClose={() => {
                setShowRecapModal(false);
                setSelectedRecap(null);
              }}
              onScheduleFollowUp={(followUp) => {
                setShowRecapModal(false);
                handleScheduleCoffeeChat();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const keyframeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const styles = {
  container: {
    minHeight: '100%',
    fontFamily: '"DM Sans", sans-serif',
    position: 'relative',
  },
  ambientBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      radial-gradient(ellipse at 20% 20%, rgba(139, 111, 92, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(166, 123, 91, 0.04) 0%, transparent 50%)
    `,
    pointerEvents: 'none',
    zIndex: -1,
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(139, 111, 92, 0.2)',
    borderTopColor: '#8B6F5C',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },
  loadingText: {
    color: '#6B5344',
    fontSize: '16px',
  },
  titleSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  titleLeft: {},
  pageTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '32px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '4px',
    margin: 0,
  },
  subtitle: {
    fontSize: '15px',
    color: '#8B7355',
    margin: 0,
  },
  scheduleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 16px rgba(139, 111, 92, 0.25)',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.06)',
  },
  statIcon: {
    fontSize: '24px',
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  statNumber: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '22px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  statLabel: {
    fontSize: '11px',
    color: '#8B7355',
  },
  pendingCard: {
    cursor: 'pointer',
    backgroundColor: 'rgba(196, 149, 106, 0.15)',
    border: '1px solid rgba(196, 149, 106, 0.3)',
    transition: 'all 0.2s ease',
    position: 'relative',
  },
  pendingBadge: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    backgroundColor: '#C4956A',
    color: 'white',
    fontSize: '9px',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '10px',
    textTransform: 'uppercase',
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  viewToggle: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    borderRadius: '12px',
  },
  viewBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#8B7355',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.2s ease',
  },
  viewBtnActive: {
    backgroundColor: 'white',
    color: '#5C4033',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  filterTabs: {
    display: 'flex',
    gap: '8px',
  },
  filterTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#6B5344',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(139, 111, 92, 0.15)',
    borderRadius: '100px',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.2s ease',
  },
  filterTabActive: {
    backgroundColor: '#5C4033',
    color: 'white',
    borderColor: '#5C4033',
  },
  filterIcon: {
    fontSize: '14px',
  },
  filterCount: {
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: 'rgba(139, 111, 92, 0.2)',
    padding: '2px 6px',
    borderRadius: '10px',
    marginLeft: '4px',
  },
  meetupsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '32px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '20px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '20px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '8px',
    margin: 0,
  },
  emptyText: {
    fontSize: '14px',
    color: '#8B7355',
    marginBottom: '20px',
    margin: '0 0 20px 0',
  },
  emptyBtn: {
    padding: '12px 24px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  meetupCard: {
    display: 'flex',
    gap: '20px',
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '20px',
    boxShadow: '0 4px 20px rgba(139, 111, 92, 0.08)',
    border: '1px solid rgba(139, 111, 92, 0.08)',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
    flexWrap: 'wrap',
  },
  groupCard: {
  },
  circleCard: {
  },
  publicCard: {
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'flex-start',
  },
  coffeeIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #D4A574 0%, #C4956A 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
  },
  groupIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #8B6F5C 0%, #6B4423 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
  },
  circleIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #5C4033 0%, #3D2B1F 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
  },
  publicIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #C4956A 0%, #A67B5B 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    minWidth: '200px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  cardType: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#C4956A',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardTypeGroup: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#8B6F5C',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardTypeCircle: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#5C4033',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardTypePublic: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#A67B5B',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: '600',
  },
  personRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  personAvatar: {
    fontSize: '36px',
  },
  personAvatarImg: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  personInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  personName: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  personRole: {
    fontSize: '13px',
    color: '#8B7355',
  },
  topicRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  topicLabel: {
    fontSize: '13px',
    color: '#8B7355',
  },
  topicText: {
    fontSize: '13px',
    color: '#5C4033',
    fontWeight: '500',
  },
  eventTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '18px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '4px',
    margin: '0 0 4px 0',
  },
  eventHost: {
    fontSize: '13px',
    color: '#8B7355',
    marginBottom: '8px',
    margin: '0 0 8px 0',
  },
  eventDesc: {
    fontSize: '14px',
    color: '#5C4033',
    lineHeight: '1.5',
    margin: 0,
  },
  cardRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '10px',
    minWidth: '140px',
  },
  dateBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  dateDay: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  dateTime: {
    fontSize: '14px',
    color: '#5C4033',
  },
  dateDuration: {
    fontSize: '12px',
    color: '#A89080',
  },
  locationBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  locationIcon: {
    fontSize: '14px',
  },
  locationText: {
    fontSize: '12px',
    color: '#6B5344',
  },
  attendeesBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  attendeeText: {
    fontSize: '11px',
    color: '#8B7355',
  },
  cardActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: 'auto',
  },
  actionBtnPrimary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  actionBtnGoing: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    backgroundColor: 'rgba(92, 64, 51, 0.1)',
    border: '1px solid rgba(92, 64, 51, 0.3)',
    borderRadius: '10px',
    color: '#5C4033',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  pastList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '32px',
  },
  pastCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '18px 20px',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '16px',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
    flexWrap: 'wrap',
  },
  pastIcon: {
    fontSize: '24px',
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    borderRadius: '12px',
    flexShrink: 0,
  },
  pastContent: {
    flex: 1,
    minWidth: '200px',
  },
  pastHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  pastType: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  pastDate: {
    fontSize: '13px',
    color: '#8B7355',
  },
  pastDetail: {
    fontSize: '13px',
    color: '#6B5344',
    margin: 0,
  },
  pastNotes: {
    fontSize: '12px',
    color: '#8B7355',
    marginTop: '6px',
    fontStyle: 'italic',
    margin: '6px 0 0 0',
  },
  pastActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  viewRecapBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'background-color 0.2s',
  },
  followUpBtn: {
    padding: '8px 16px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    border: 'none',
    borderRadius: '100px',
    color: '#5C4033',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  // New past card styles
  pastCardNew: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: '20px',
    boxShadow: '0 4px 20px rgba(139, 111, 92, 0.08)',
    border: '1px solid rgba(139, 111, 92, 0.08)',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  pastCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  pastCardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flex: 1,
    minWidth: '200px',
  },
  pastIconNew: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    flexShrink: 0,
  },
  pastCardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  pastCardType: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#8B7355',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  pastCardTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '17px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  pastCardDate: {
    fontSize: '13px',
    color: '#8B7355',
  },
  pastCardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  viewRecapBtnNew: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(139, 111, 92, 0.2)',
  },
  pastSection: {
    paddingTop: '10px',
    borderTop: '1px solid rgba(139, 111, 92, 0.08)',
  },
  pastSectionLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: '600',
    color: '#8B7355',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '10px',
  },
  participantsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
  },
  participantChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px 6px 6px',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    borderRadius: '100px',
  },
  participantAvatar: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  participantAvatarPlaceholder: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 111, 92, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
  },
  participantName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#3D2B1F',
  },
  participantRole: {
    fontSize: '11px',
    color: '#8B7355',
    marginLeft: '4px',
  },
  moreParticipants: {
    fontSize: '12px',
    color: '#8B7355',
    fontStyle: 'italic',
  },
  topicsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  topicChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'rgba(196, 149, 106, 0.15)',
    borderRadius: '100px',
    fontSize: '13px',
    color: '#5C4033',
    fontWeight: '500',
  },
  topicMentions: {
    fontSize: '10px',
    color: '#8B7355',
    backgroundColor: 'rgba(139, 111, 92, 0.15)',
    padding: '2px 6px',
    borderRadius: '10px',
  },
  pastTopicText: {
    fontSize: '14px',
    color: '#5C4033',
    margin: 0,
    lineHeight: '1.5',
  },
  pastFooter: {
    paddingTop: '10px',
    borderTop: '1px solid rgba(139, 111, 92, 0.08)',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  followUpBtnNew: {
    padding: '10px 18px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    border: '1px solid rgba(139, 111, 92, 0.2)',
    borderRadius: '100px',
    color: '#5C4033',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.2s ease',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    width: '100%',
    maxWidth: '700px',
    maxHeight: '90vh',
    overflow: 'auto',
    borderRadius: '24px',
    backgroundColor: '#F5F0EB',
  },
  suggestedSection: {
    padding: '24px',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: '20px',
    border: '1px solid rgba(139, 111, 92, 0.08)',
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '18px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    margin: '0 0 8px 0',
  },
  sectionIcon: {
    fontSize: '18px',
  },
  suggestedText: {
    fontSize: '14px',
    color: '#8B7355',
    marginBottom: '16px',
    margin: '0 0 16px 0',
  },
  suggestedBtn: {
    padding: '12px 24px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
};

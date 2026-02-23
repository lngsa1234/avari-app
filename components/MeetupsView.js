// components/MeetupsView.js
// Meetups page - Coffee chats and group events combined
// UX design based on meetups-page.jsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Video, Calendar, MapPin, Clock, Users, Plus, X, Sparkles, Edit3, Trash2, MoreHorizontal } from 'lucide-react';
import { parseLocalDate } from '../lib/dateUtils';

export default function MeetupsView({ currentUser, supabase, connections = [], meetups = [], userSignups = [], onNavigate, initialView = null }) {
  const [activeView, setActiveView] = useState(initialView || 'upcoming');
  const [activeFilter, setActiveFilter] = useState('all');
  const [coffeeChats, setCoffeeChats] = useState([]);
  const [groupEvents, setGroupEvents] = useState([]);
  const [pastMeetups, setPastMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState({
    coffeeChats: 0,
    circleInvites: 0
  });
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMeetup, setEditingMeetup] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingMeetupId, setDeletingMeetupId] = useState(null);
  const [showCancelChatConfirm, setShowCancelChatConfirm] = useState(false);
  const [cancellingChatId, setCancellingChatId] = useState(null);

  // Close action menu when clicking outside
  useEffect(() => {
    if (!actionMenuOpen) return;
    const handleClick = () => setActionMenuOpen(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [actionMenuOpen]);

  // Responsive
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth < 640;
    return false;
  });
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track which recaps have been viewed (persisted in localStorage)
  const [reviewedRecaps, setReviewedRecaps] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('reviewedRecaps') || '[]');
      } catch { return []; }
    }
    return [];
  });

  const markRecapReviewed = (recapId) => {
    if (!recapId) return;
    setReviewedRecaps(prev => {
      if (prev.includes(recapId)) return prev;
      const updated = [...prev, recapId];
      localStorage.setItem('reviewedRecaps', JSON.stringify(updated));
      return updated;
    });
  };

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
        // Exclude completed, declined, cancelled
        if (chat.status === 'completed' || chat.status === 'declined' || chat.status === 'cancelled') return false;
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
        const isPending = chat.status === 'pending';
        const isInviteReceived = isPending && chat.recipient_id === currentUser.id;
        const isInviteSent = isPending && chat.requester_id === currentUser.id;
        return {
          ...chat,
          type: 'coffee',
          with: profile?.name || 'Unknown',
          avatar: profile?.profile_picture,
          role: profile?.career || 'Professional',
          date: scheduledDate ? formatDate(scheduledDate.toISOString()) : 'TBD',
          time: scheduledDate ? formatTime(scheduledDate.toTimeString().slice(0, 5)) : 'TBD',
          duration: '30 min',
          rawDate: scheduledDate,
          isPending,
          isInviteReceived,
          isInviteSent,
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

      // Get circles the user is a member of
      const { data: membershipData } = await supabase
        .from('connection_group_members')
        .select('group_id')
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted');
      const userCircleIds = (membershipData || []).map(m => m.group_id);

      // Fetch meetups user is signed up for, created, or from their circles
      let query = supabase
        .from('meetups')
        .select('*, connection_groups(id, name)')
        .order('date', { ascending: true });

      const orConditions = [];
      if (signedUpMeetupIds.length > 0) {
        orConditions.push(`id.in.(${signedUpMeetupIds.join(',')})`);
      }
      orConditions.push(`created_by.eq.${currentUser.id}`);
      if (userCircleIds.length > 0) {
        orConditions.push(`circle_id.in.(${userCircleIds.join(',')})`);
      }
      query = query.or(orConditions.join(','));

      const { data: signedUpMeetups, error } = await query;

      if (error) {
        console.error('Error fetching signed up meetups:', error);
        setGroupEvents([]);
        return;
      }

      // Get total meetup count per circle (including past)
      let circleMeetupCounts = {};
      const circleIdsInResults = [...new Set((signedUpMeetups || []).filter(m => m.circle_id).map(m => m.circle_id))];
      if (circleIdsInResults.length > 0) {
        try {
          const { data: allCircleMeetups } = await supabase
            .from('meetups')
            .select('id, circle_id, date')
            .in('circle_id', circleIdsInResults)
            .order('date', { ascending: true });

          (allCircleMeetups || []).forEach(m => {
            if (!circleMeetupCounts[m.circle_id]) circleMeetupCounts[m.circle_id] = [];
            circleMeetupCounts[m.circle_id].push(m.id);
          });
        } catch (e) {
          console.log('Could not fetch circle meetup counts:', e.message);
        }
      }

      // Filter to upcoming ones
      const now = new Date();
      const upcomingFiltered = (signedUpMeetups || []).filter(meetup => {
        // Exclude completed meetups
        if (meetup.status === 'completed' || meetup.status === 'cancelled') return false;
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
      });

      // Fetch attendee profiles and host profiles for upcoming meetups
      const upcomingMeetupIds = upcomingFiltered.map(m => m.id);
      const hostIds = [...new Set(upcomingFiltered.map(m => m.created_by).filter(Boolean))];
      let attendeesByMeetup = {};
      let hostProfileMap = {};

      if (upcomingMeetupIds.length > 0) {
        try {
          const { data: signupData } = await supabase
            .from('meetup_signups')
            .select('meetup_id, user_id')
            .in('meetup_id', upcomingMeetupIds);

          // Combine attendee user IDs and host IDs to fetch all profiles in one query
          const attendeeUserIds = (signupData || []).map(s => s.user_id);
          const allUserIds = [...new Set([...attendeeUserIds, ...hostIds])];
          let profileMap = {};
          if (allUserIds.length > 0) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, name, profile_picture, career')
              .in('id', allUserIds);
            (profileData || []).forEach(p => { profileMap[p.id] = p; });
          }
          hostProfileMap = profileMap;

          (signupData || []).forEach(signup => {
            if (!attendeesByMeetup[signup.meetup_id]) {
              attendeesByMeetup[signup.meetup_id] = [];
            }
            const profile = profileMap[signup.user_id];
            if (profile) {
              attendeesByMeetup[signup.meetup_id].push(profile);
            }
          });
        } catch (e) {
          console.log('Could not fetch attendee profiles:', e.message);
        }
      }

      const upcomingEvents = upcomingFiltered.map(meetup => {
        const isCircleMeetup = !!meetup.circle_id;
        const circleName = meetup.connection_groups?.name;
        const attendeeProfiles = attendeesByMeetup[meetup.id] || [];
        const hostProfile = hostProfileMap[meetup.created_by];

        // Calculate session number for circle meetups
        let sessionNumber = null;
        if (isCircleMeetup && circleMeetupCounts[meetup.circle_id]) {
          const meetupIds = circleMeetupCounts[meetup.circle_id];
          sessionNumber = meetupIds.indexOf(meetup.id) + 1;
        }

        return {
          ...meetup,
          type: 'group',
          title: meetup.topic || (isCircleMeetup ? `${circleName} Meetup` : 'Community Meetup'),
          emoji: isCircleMeetup ? '🔒' : getEventEmoji(meetup.topic),
          host: hostProfile?.name || (isCircleMeetup ? circleName : 'CircleW Community'),
          hostProfile,
          sessionNumber,
          originalDate: meetup.date,
          rawDate: parseLocalDate(meetup.date),
          date: formatDate(meetup.date),
          rawTime: meetup.time,
          time: formatTime(meetup.time),
          duration: `${meetup.duration || 60} min`,
          location: meetup.location || 'Virtual',
          attendees: attendeeProfiles.length || meetup.signupCount || 0,
          attendeeProfiles,
          maxAttendees: meetup.participantLimit || meetup.max_attendees || 100,
          status: (signedUpMeetupIds.includes(meetup.id) || meetup.created_by === currentUser.id) ? 'going' : 'open',
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

      // 0. Fetch call recaps first so we can use them to identify events that actually happened
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

      // Helper: check if a date has a matching recap (within 4 hours)
      const findMatchingRecap = (rawDate) => {
        return recaps.find(r => {
          const recapTime = new Date(r.started_at || r.created_at);
          const timeDiff = Math.abs(rawDate - recapTime);
          return timeDiff < 4 * 60 * 60 * 1000;
        });
      };

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
          if (chat.status === 'completed') return true;
          // Also include if there's a matching recap (call actually happened)
          if (chat.status === 'accepted') {
            const chatTime = new Date(chat.scheduled_time);
            return chatTime < gracePeriod && !!findMatchingRecap(chatTime);
          }
          return false;
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

        // Also include meetups user created or from circles user belongs to
        const { data: membershipData } = await supabase
          .from('connection_group_members')
          .select('group_id')
          .eq('user_id', currentUser.id)
          .eq('status', 'accepted');
        const userCircleIds = (membershipData || []).map(m => m.group_id);

        let meetupsQuery = supabase
          .from('meetups')
          .select('*, connection_groups(id, name)')
          .order('date', { ascending: false })
          .limit(30);

        const orConditions = [];
        if (signedUpIds.length > 0) {
          orConditions.push(`id.in.(${signedUpIds.join(',')})`);
        }
        orConditions.push(`created_by.eq.${currentUser.id}`);
        if (userCircleIds.length > 0) {
          orConditions.push(`circle_id.in.(${userCircleIds.join(',')})`);
        }
        meetupsQuery = meetupsQuery.or(orConditions.join(','));

        const { data: meetupsData } = await meetupsQuery;

        // Filter to past meetups that actually happened
        // (completed status OR has a matching call recap)
        const pastMeetups = (meetupsData || []).filter(meetup => {
          const userParticipated = signedUpIds.includes(meetup.id) || meetup.created_by === currentUser.id;
          if (!userParticipated) return false;
          if (meetup.status === 'completed') return true;
          // Also include if there's a matching recap
          const meetupDate = parseLocalDate(meetup.date);
          if (meetup.time) {
            const [hours, minutes] = meetup.time.split(':').map(Number);
            meetupDate.setHours(hours, minutes, 0, 0);
          }
          return meetupDate < gracePeriod && !!findMatchingRecap(meetupDate);
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
            rawDate: (() => { const d = parseLocalDate(meetup.date); if (meetup.time) { const [h, m] = meetup.time.split(':').map(Number); d.setHours(h, m, 0, 0); } return d; })(),
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

      // 3. Match recaps to past meetups and extract topics
      allPastMeetups.forEach(item => {
        const matchingRecap = findMatchingRecap(item.rawDate);

        if (matchingRecap) {
          item.hasRecap = true;
          item.recapId = matchingRecap.id;
          item.recapData = matchingRecap;

          // Extract topics from AI summary (stored as TEXT, not JSON object)
          if (matchingRecap.ai_summary) {
            try {
              const parsed = JSON.parse(matchingRecap.ai_summary);
              if (parsed.topicsDiscussed) {
                item.topicsDiscussed = parsed.topicsDiscussed.slice(0, 3);
              }
            } catch {
              // Plain text format — extract topics from "Topics Discussed:" section
              const text = matchingRecap.ai_summary;
              const topicsMatch = text.split(/topics discussed:?\s*/i)[1];
              if (topicsMatch) {
                const topics = topicsMatch.split('\n')
                  .map(l => l.replace(/^[-•*]\s*/, '').trim())
                  .filter(l => l.length > 3)
                  .slice(0, 3)
                  .map(t => ({ topic: t, mentions: 1 }));
                if (topics.length > 0) item.topicsDiscussed = topics;
              }
            }
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
            .select('meetup_id, user_id')
            .in('meetup_id', meetupIds);

          // Get unique user IDs from signups and fetch their profiles
          const userIds = [...new Set((signupData || []).map(s => s.user_id))];
          let profileMap = {};
          if (userIds.length > 0) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, name, profile_picture, career')
              .in('id', userIds);
            (profileData || []).forEach(p => { profileMap[p.id] = p; });
          }

          // Group participants by meetup
          const participantsByMeetup = {};
          (signupData || []).forEach(signup => {
            if (!participantsByMeetup[signup.meetup_id]) {
              participantsByMeetup[signup.meetup_id] = [];
            }
            const profile = profileMap[signup.user_id];
            if (profile) {
              participantsByMeetup[signup.meetup_id].push(profile);
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
  const handleViewRecap = (item) => {
    if (item.recapId) {
      markRecapReviewed(item.recapId);
      onNavigate('sessionRecapDetail', { recapId: item.recapId });
    }
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
      const date = parseLocalDate(dateStr);
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

  const handleAcceptChat = async (chat) => {
    try {
      const { error } = await supabase
        .from('coffee_chats')
        .update({ status: 'accepted' })
        .eq('id', chat.id);

      if (!error) {
        setCoffeeChats(prev => prev.map(c =>
          c.id === chat.id ? { ...c, status: 'accepted', isPending: false, isInviteReceived: false, isInviteSent: false } : c
        ));
      }
    } catch (err) {
      console.error('Error accepting chat:', err);
    }
  };

  const handleDeclineChat = async (chat) => {
    try {
      const { error } = await supabase
        .from('coffee_chats')
        .update({ status: 'declined' })
        .eq('id', chat.id);

      if (!error) {
        setCoffeeChats(prev => prev.filter(c => c.id !== chat.id));
      }
    } catch (err) {
      console.error('Error declining chat:', err);
    }
  };

  const handleRsvpMeetup = async (meetup) => {
    try {
      const { error } = await supabase
        .from('meetup_signups')
        .insert({ meetup_id: meetup.id, user_id: currentUser.id });

      if (!error) {
        setGroupEvents(prev => prev.map(e =>
          e.id === meetup.id ? { ...e, status: 'going' } : e
        ));
      }
    } catch (err) {
      console.error('Error RSVPing to meetup:', err);
    }
  };

  const handleScheduleCoffeeChat = () => {
    // Navigate to unified schedule meetup page
    if (onNavigate) onNavigate('scheduleMeetup');
  };

  const handleEditMeetup = (item) => {
    setEditingMeetup({
      id: item.id,
      topic: item.topic || item.title || '',
      date: item.originalDate || '',
      time: item.rawTime || '',
      location: item.location || '',
    });
    setShowEditModal(true);
    setActionMenuOpen(null);
  };

  const handleUpdateMeetup = async () => {
    if (!editingMeetup) return;
    try {
      const { error } = await supabase
        .from('meetups')
        .update({
          topic: editingMeetup.topic,
          date: editingMeetup.date,
          time: editingMeetup.time,
          location: editingMeetup.location,
        })
        .eq('id', editingMeetup.id);

      if (!error) {
        setGroupEvents(prev => prev.map(e =>
          e.id === editingMeetup.id ? {
            ...e,
            topic: editingMeetup.topic,
            title: editingMeetup.topic || e.title,
            originalDate: editingMeetup.date,
            rawDate: parseLocalDate(editingMeetup.date),
            date: formatDate(editingMeetup.date),
            rawTime: editingMeetup.time,
            time: formatTime(editingMeetup.time),
            location: editingMeetup.location,
          } : e
        ));
        setShowEditModal(false);
        setEditingMeetup(null);
      }
    } catch (err) {
      console.error('Error updating meetup:', err);
    }
  };

  const handleDeleteMeetup = async (meetupId) => {
    try {
      // Delete signups first, then the meetup
      await supabase.from('meetup_signups').delete().eq('meetup_id', meetupId);
      const { error } = await supabase
        .from('meetups')
        .delete()
        .eq('id', meetupId);

      if (!error) {
        setGroupEvents(prev => prev.filter(e => e.id !== meetupId));
        setShowDeleteConfirm(false);
        setDeletingMeetupId(null);
      }
    } catch (err) {
      console.error('Error deleting meetup:', err);
    }
  };

  const handleCancelCoffeeChat = async (chatId) => {
    try {
      const { error } = await supabase
        .from('coffee_chats')
        .update({ status: 'cancelled' })
        .eq('id', chatId);

      if (!error) {
        setCoffeeChats(prev => prev.filter(c => c.id !== chatId));
        setShowCancelChatConfirm(false);
        setCancellingChatId(null);
      }
    } catch (err) {
      console.error('Error cancelling coffee chat:', err);
    }
  };

  // Separate circle and public events
  const circleEvents = groupEvents.filter(e => e.isCircleMeetup);
  const publicEvents = groupEvents.filter(e => !e.isCircleMeetup);

  const allUpcoming = [...coffeeChats, ...groupEvents].sort((a, b) => {
    // Sort by date - use scheduled_date for coffee chats, original date for group events
    const dateA = a.scheduled_date ? new Date(a.scheduled_date) : parseLocalDate(a.originalDate || a.date);
    const dateB = b.scheduled_date ? new Date(b.scheduled_date) : parseLocalDate(b.originalDate || b.date);
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
    <div style={{...styles.container, padding: isMobile ? '16px' : undefined}}>
      <div style={styles.ambientBg}></div>

      {/* Page Title Section */}
      <section style={{
        ...styles.titleSection,
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        marginBottom: isMobile ? '16px' : '24px',
      }}>
        <div style={styles.titleLeft}>
          <h1 style={{...styles.pageTitle, fontSize: isMobile ? '24px' : '32px'}}>Coffee Chats</h1>
          <p style={{
            ...styles.subtitle,
            fontSize: isMobile ? '14px' : '15px',
            background: 'linear-gradient(89.8deg, #7E654D 27.14%, #9C8370 72.64%, #B9A594 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Catch up over a virtual coffee</p>
        </div>
        <button style={{
          ...styles.scheduleBtn,
          padding: isMobile ? '10px 16px' : '12px 20px',
          fontSize: isMobile ? '13px' : '14px',
          width: isMobile ? '100%' : 'auto',
          justifyContent: 'center',
        }} onClick={handleScheduleCoffeeChat}>
          <Plus size={isMobile ? 16 : 18} />
          Schedule Meetup
        </button>
      </section>

      {/* View Toggle & Filters */}
      <div style={{...styles.controlsRow, marginBottom: isMobile ? '14px' : '20px'}}>
        <div style={{...styles.viewToggle, width: isMobile ? '100%' : undefined}}>
          <button
            style={{...styles.viewBtn, ...(activeView === 'upcoming' ? styles.viewBtnActive : {}), flex: isMobile ? 1 : undefined, textAlign: 'center', padding: isMobile ? '8px 14px' : '10px 20px'}}
            onClick={() => setActiveView('upcoming')}
          >
            Upcoming
          </button>
          <button
            style={{...styles.viewBtn, ...(activeView === 'past' ? styles.viewBtnActive : {}), flex: isMobile ? 1 : undefined, textAlign: 'center', padding: isMobile ? '8px 14px' : '10px 20px'}}
            onClick={() => setActiveView('past')}
          >
            Past
          </button>
        </div>

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
                <div key={item.id} style={{
                  ...styles.meetupCard,
                  ...(item.isPending ? styles.pendingCoffeeCard : {}),
                  ...(item.isInviteReceived ? { borderLeft: '3px solid #C4956A' } : {}),
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? '12px' : '20px',
                  padding: isMobile ? '14px' : '20px',
                  animationDelay: `${index * 0.1}s`
                }}>
                  <div style={{...styles.cardLeft, flexDirection: isMobile ? 'row' : undefined, gap: isMobile ? '12px' : undefined}}>
                    {(() => {
                      const today = new Date(); today.setHours(0,0,0,0);
                      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
                      const itemDate = item.rawDate ? new Date(item.rawDate) : null;
                      if (itemDate) itemDate.setHours(0,0,0,0);
                      const isHighlighted = itemDate && (itemDate.getTime() === today.getTime() || itemDate.getTime() === tomorrow.getTime());
                      const isToday = itemDate && itemDate.getTime() === today.getTime();
                      const isTomorrow = itemDate && itemDate.getTime() === tomorrow.getTime();
                      return (
                        <div style={{
                          ...styles.dateBadge,
                          ...(item.isPending ? styles.dateBadgePending : {}),
                          ...(isHighlighted ? { backgroundColor: '#5C4033' } : {}),
                        }}>
                          <span style={{
                            ...styles.dateBadgeWeekday,
                            fontSize: isHighlighted ? '11px' : '10px',
                            fontWeight: '700',
                            letterSpacing: '0.5px',
                            ...(isHighlighted ? { color: '#fff' } : {}),
                          }}>
                            {isToday ? 'TODAY' : isTomorrow ? 'TMRW' : item.rawDate ? item.rawDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : ''}
                          </span>
                          <span style={{
                            ...styles.dateBadgeDay,
                            ...(isHighlighted ? { color: '#fff' } : {}),
                          }}>
                            {item.rawDate ? item.rawDate.getDate() : '—'}
                          </span>
                          <span style={{
                            ...styles.dateBadgeMonth,
                            ...(isHighlighted ? { color: 'rgba(255,255,255,0.7)' } : {}),
                          }}>
                            {item.rawDate ? item.rawDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '—'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={styles.cardContent}>
                    <div style={styles.personRow}>
                      {item.avatar ? (
                        <img src={item.avatar} alt={item.with} style={styles.personAvatarImg} />
                      ) : (
                        <span style={styles.personAvatar}>👤</span>
                      )}
                      <div style={{...styles.personInfo, flex: 1}}>
                        <span style={styles.personName}>{item.with}</span>
                        <span style={styles.personRole}>{item.role}</span>
                      </div>
                      {item.time && item.time !== 'TBD' && (
                        <span style={styles.cardTime}>{item.time}</span>
                      )}
                    </div>

                    {item.isPending && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px',
                      }}>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '3px 10px',
                          borderRadius: '100px',
                          backgroundColor: item.isInviteReceived ? 'rgba(196, 149, 106, 0.25)' : 'rgba(139, 111, 92, 0.1)',
                          color: item.isInviteReceived ? '#8B6F5C' : '#7A6855',
                        }}>
                          {item.isInviteReceived
                            ? `${item.with} invited you for coffee`
                            : `Awaiting response`
                          }
                        </div>
                      </div>
                    )}

                    {item.topic && (
                      <div style={styles.topicRow}>
                        <span style={styles.topicText}>{item.topic}</span>
                      </div>
                    )}
                  </div>

                  <div style={{
                    ...styles.cardRight,
                    alignItems: isMobile ? 'stretch' : 'flex-end',
                    minWidth: isMobile ? '100%' : '140px',
                  }}>
                    <div style={styles.locationBlock}>
                      <span style={styles.locationIcon}>{item.location?.includes('Zoom') || item.location?.includes('Virtual') ? '💻' : '📍'}</span>
                      <span style={styles.locationText}>{item.location || 'Virtual'}</span>
                    </div>
                    <div style={{...styles.cardActions, flexDirection: isMobile ? 'row' : 'column', width: isMobile ? '100%' : undefined}}>
                      {item.isInviteReceived ? (
                        <>
                          <button style={{...styles.actionBtnAccept, flex: isMobile ? 1 : undefined}} onClick={() => handleAcceptChat(item)}>
                            Accept
                          </button>
                          <button style={{...styles.actionBtnDecline, flex: isMobile ? 1 : undefined}} onClick={() => handleDeclineChat(item)}>
                            Decline
                          </button>
                        </>
                      ) : item.isPending ? (
                        <>
                          <button style={{...styles.actionBtnWaiting, width: isMobile ? '100%' : undefined}} disabled>
                            <Clock size={14} style={{ marginRight: 6 }} />
                            Awaiting
                          </button>
                          {item.requester_id === currentUser.id && (
                            <button
                              style={{...styles.cancelChatBtn, width: isMobile ? '100%' : undefined}}
                              onClick={() => { setCancellingChatId(item.id); setShowCancelChatConfirm(true); }}
                            >
                              Cancel
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button style={{...styles.actionBtnPrimary, width: isMobile ? '100%' : undefined}} onClick={() => handleJoinCall(item)}>
                            <Video size={14} style={{ marginRight: 6 }} />
                            Join
                          </button>
                          {item.requester_id === currentUser.id && (
                            <button
                              style={{...styles.cancelChatBtn, width: isMobile ? '100%' : undefined}}
                              onClick={() => { setCancellingChatId(item.id); setShowCancelChatConfirm(true); }}
                            >
                              Cancel
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Group Event Card (Circle or Public)
                <div key={item.id} style={{
                  ...styles.meetupCard,
                  ...styles.groupCard,
                  ...(item.isCircleMeetup ? styles.circleCard : styles.publicCard),
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? '12px' : '20px',
                  padding: isMobile ? '14px' : '20px',
                  animationDelay: `${index * 0.1}s`
                }}>
                  <div style={{...styles.cardLeft, flexDirection: isMobile ? 'row' : undefined, gap: isMobile ? '12px' : undefined}}>
                    {(() => {
                      const today = new Date(); today.setHours(0,0,0,0);
                      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
                      const itemDate = item.rawDate ? new Date(item.rawDate) : null;
                      if (itemDate) itemDate.setHours(0,0,0,0);
                      const isHighlighted = itemDate && (itemDate.getTime() === today.getTime() || itemDate.getTime() === tomorrow.getTime());
                      const isToday = itemDate && itemDate.getTime() === today.getTime();
                      const isTomorrow = itemDate && itemDate.getTime() === tomorrow.getTime();
                      return (
                        <div style={{
                          ...styles.dateBadge,
                          ...(isHighlighted ? { backgroundColor: '#5C4033' } : {}),
                        }}>
                          <span style={{
                            ...styles.dateBadgeWeekday,
                            fontSize: isHighlighted ? '11px' : '10px',
                            fontWeight: '700',
                            letterSpacing: '0.5px',
                            ...(isHighlighted ? { color: '#fff' } : {}),
                          }}>
                            {isToday ? 'TODAY' : isTomorrow ? 'TMRW' : item.rawDate ? item.rawDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : ''}
                          </span>
                          <span style={{
                            ...styles.dateBadgeDay,
                            ...(isHighlighted ? { color: '#fff' } : {}),
                          }}>
                            {item.rawDate ? item.rawDate.getDate() : '—'}
                          </span>
                          <span style={{
                            ...styles.dateBadgeMonth,
                            ...(isHighlighted ? { color: 'rgba(255,255,255,0.7)' } : {}),
                          }}>
                            {item.rawDate ? item.rawDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '—'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={styles.cardContent}>
                    <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px'}}>
                      <h3 style={{...styles.eventTitle, margin: 0}}>{item.title}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {item.time && item.time !== 'TBD' && (
                          <span style={styles.cardTime}>{item.time}</span>
                        )}
                        {item.created_by === currentUser.id && (
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setActionMenuOpen(actionMenuOpen === item.id ? null : item.id); }}
                              style={styles.moreBtn}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {actionMenuOpen === item.id && (
                              <div style={styles.actionMenu}>
                                <button style={styles.actionMenuItem} onClick={(e) => { e.stopPropagation(); handleEditMeetup(item); }}>
                                  <Edit3 size={14} /> Edit
                                </button>
                                <button style={{...styles.actionMenuItem, color: '#D32F2F'}} onClick={(e) => { e.stopPropagation(); setDeletingMeetupId(item.id); setShowDeleteConfirm(true); setActionMenuOpen(null); }}>
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 4px 0' }}>
                      {item.hostProfile?.profile_picture ? (
                        <img src={item.hostProfile.profile_picture} alt={item.host} style={{
                          width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover',
                        }} />
                      ) : (
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#E8D5C0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', color: '#8B6F5C',
                        }}>
                          {item.host?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontSize: '13px', color: '#5C4033' }}>Hosted by {item.host}</span>
                    </div>
                    <p style={styles.eventDesc}>
                      {item.description}
                      {item.sessionNumber && ` · Session #${item.sessionNumber}`}
                    </p>
                    {item.attendeeProfiles && item.attendeeProfiles.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', marginRight: '6px' }}>
                          {item.attendeeProfiles.slice(0, 5).map((p, idx) => (
                            <div key={p.id} style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              border: '2px solid #FDF8F2',
                              marginLeft: idx === 0 ? 0 : '-8px',
                              overflow: 'hidden',
                              backgroundColor: '#E8D5C0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 5 - idx,
                              position: 'relative',
                            }}>
                              {p.profile_picture ? (
                                <img src={p.profile_picture} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ fontSize: '11px', color: '#8B6F5C' }}>{p.name?.charAt(0)?.toUpperCase()}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: '12px', color: '#7A6855' }}>
                          {item.attendeeProfiles.length} attending
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{
                    ...styles.cardRight,
                    alignItems: isMobile ? 'stretch' : 'flex-end',
                    minWidth: isMobile ? '100%' : '140px',
                  }}>
                    <div style={styles.locationBlock}>
                      <span style={styles.locationIcon}>{item.location?.includes('Zoom') || item.location === 'Virtual' ? '💻' : '📍'}</span>
                      <span style={styles.locationText}>{item.location}</span>
                    </div>
                    <div style={{...styles.cardActions, width: isMobile ? '100%' : undefined}}>
                      {(item.status === 'going' || item.isCircleMeetup) ? (
                        <button style={{...styles.actionBtnGoing, width: isMobile ? '100%' : undefined}} onClick={() => handleJoinCall(item)}>
                          <Video size={14} style={{ marginRight: 6 }} />
                          Join Room
                        </button>
                      ) : (
                        <button style={{...styles.actionBtnPrimary, width: isMobile ? '100%' : undefined}} onClick={() => handleRsvpMeetup(item)}>
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
            pastMeetups.map((item, index) => {
              const durationMin = item.recapData?.duration_seconds
                ? Math.round(item.recapData.duration_seconds / 60)
                : null;
              const durationStr = durationMin
                ? durationMin >= 60
                  ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
                  : `${durationMin}m`
                : null;
              const attendeeCount = item.recapData?.participant_count
                || item.participants?.length
                || (item.type === 'coffee' ? 2 : null);

              // ai_summary is stored as TEXT - could be JSON string or plain text
              let summary = null;
              let actionItems = [];
              if (item.recapData?.ai_summary) {
                const raw = item.recapData.ai_summary;
                try {
                  const parsed = JSON.parse(raw);
                  summary = parsed.summary || null;
                  actionItems = (parsed.actionItems || []).map(a => typeof a === 'string' ? a : a.text || '').filter(Boolean);
                } catch {
                  // Plain text format
                  const lines = raw.split('\n');
                  const summaryLines = [];
                  let currentSection = 'summary';
                  for (const line of lines) {
                    const lower = line.toLowerCase();
                    if (lower.includes('key takeaway') || lower.includes('takeaways:') || lower.includes('highlights:')) { currentSection = 'takeaways'; continue; }
                    if (lower.includes('action item') || lower.includes('next step') || lower.includes('follow up') || lower.includes('follow-up') || lower.includes('to-do')) { currentSection = 'actions'; continue; }
                    if (lower.includes('topics discussed')) { currentSection = 'topics'; continue; }
                    if (lower.includes('quote') || lower.includes('memorable')) { currentSection = 'quotes'; continue; }
                    const clean = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
                    if (!clean) continue;
                    if (currentSection === 'summary') summaryLines.push(clean);
                    else if (currentSection === 'actions' && clean.length > 5) actionItems.push(clean);
                  }
                  summary = summaryLines.join(' ') || null;
                }
              }

              const isUnreviewed = item.hasRecap && item.recapId && !reviewedRecaps.includes(item.recapId);

              return (
                <div key={item.id} style={{
                  ...styles.pastCardCompact,
                  alignItems: 'flex-start',
                  animationDelay: `${index * 0.1}s`,
                }}>
                  <div style={styles.pastCardCompactLeft}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={styles.pastCardTopic}>{item.topic || item.title}</span>
                      {isUnreviewed && (
                        <span style={styles.newBadge}>New</span>
                      )}
                    </div>
                    <span style={styles.pastCardMeta}>
                      {item.type === 'coffee' && `with ${item.with}`}
                      {item.type === 'circle' && (item.circleName || 'Circle')}
                      {item.type === 'public' && 'Community'}
                      {' · '}
                      {item.date}
                    </span>
                    {(durationStr || attendeeCount != null) && (
                      <span style={{ ...styles.pastCardMeta, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {durationStr && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            {durationStr}
                          </span>
                        )}
                        {attendeeCount != null && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={12} />
                            {attendeeCount} {attendeeCount === 1 ? 'attendee' : 'attendees'}
                          </span>
                        )}
                      </span>
                    )}
                    {summary && (
                      <div style={styles.summaryBox}>
                        <span style={styles.summaryText}>
                          {summary.length > 150 ? summary.slice(0, 150) + '...' : summary}
                        </span>
                      </div>
                    )}
                    {actionItems.length > 0 && (
                      <div style={styles.actionItemsBox}>
                        <div style={styles.actionItemsHeader}>
                          <span style={styles.actionItemsIcon}>&#9745;</span>
                          <span style={styles.actionItemsLabel}>Follow-ups</span>
                          <span style={styles.actionItemsCount}>{actionItems.length}</span>
                        </div>
                        {actionItems.slice(0, 3).map((action, i) => (
                          <div key={i} style={styles.actionItem}>
                            <span style={styles.actionBullet}>&#9702;</span>
                            <span style={styles.actionText}>{action}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    style={{
                      ...styles.viewRecapBtnCompact,
                      ...(isUnreviewed ? styles.viewRecapBtnUnreviewed : {}),
                    }}
                    onClick={() => handleViewRecap(item)}
                  >
                    <Sparkles size={13} />
                    Recap
                  </button>
                </div>
              );
            })
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

      {/* Edit Meetup Modal */}
      {showEditModal && editingMeetup && (
        <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.editModalHeader}>
              <h3 style={styles.editModalTitle}>Edit Meetup</h3>
              <button style={styles.editModalClose} onClick={() => setShowEditModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={styles.editModalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Topic</label>
                <input
                  type="text"
                  value={editingMeetup.topic}
                  onChange={(e) => setEditingMeetup({ ...editingMeetup, topic: e.target.value })}
                  style={styles.formInput}
                  placeholder="Meetup topic"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Date</label>
                <input
                  type="date"
                  value={editingMeetup.date}
                  onChange={(e) => setEditingMeetup({ ...editingMeetup, date: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Time</label>
                <input
                  type="time"
                  value={editingMeetup.time}
                  onChange={(e) => setEditingMeetup({ ...editingMeetup, time: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Location</label>
                <input
                  type="text"
                  value={editingMeetup.location}
                  onChange={(e) => setEditingMeetup({ ...editingMeetup, location: e.target.value })}
                  style={styles.formInput}
                  placeholder="Virtual, city name, or venue"
                />
              </div>
            </div>
            <div style={styles.editModalFooter}>
              <button style={styles.editModalCancel} onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button style={styles.editModalSave} onClick={handleUpdateMeetup}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Meetup Confirmation */}
      {showDeleteConfirm && (
        <div style={styles.modalOverlay} onClick={() => { setShowDeleteConfirm(false); setDeletingMeetupId(null); }}>
          <div style={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.confirmTitle}>Delete Meetup?</h3>
            <p style={styles.confirmText}>This will remove the meetup for all attendees. This action cannot be undone.</p>
            <div style={styles.confirmActions}>
              <button style={styles.confirmCancel} onClick={() => { setShowDeleteConfirm(false); setDeletingMeetupId(null); }}>
                Cancel
              </button>
              <button style={styles.confirmDelete} onClick={() => handleDeleteMeetup(deletingMeetupId)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Coffee Chat Confirmation */}
      {showCancelChatConfirm && (
        <div style={styles.modalOverlay} onClick={() => { setShowCancelChatConfirm(false); setCancellingChatId(null); }}>
          <div style={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.confirmTitle}>Cancel Coffee Chat?</h3>
            <p style={styles.confirmText}>This will cancel the scheduled coffee chat.</p>
            <div style={styles.confirmActions}>
              <button style={styles.confirmCancel} onClick={() => { setShowCancelChatConfirm(false); setCancellingChatId(null); }}>
                Keep It
              </button>
              <button style={styles.confirmDelete} onClick={() => handleCancelCoffeeChat(cancellingChatId)}>
                Cancel Chat
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{keyframeStyles}</style>

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
    background: 'linear-gradient(219.16deg, rgba(247, 242, 236, 0.96) 39.76%, rgba(240, 225, 213, 0.980157) 67.53%, rgba(236, 217, 202, 0.990231) 82.33%)',
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
    fontFamily: '"Lora", serif',
    fontSize: '32px',
    fontWeight: '500',
    color: '#584233',
    letterSpacing: '0.15px',
    lineHeight: 1.28,
    margin: 0,
  },
  subtitle: {
    fontFamily: '"Lora", serif',
    fontSize: '15px',
    fontWeight: '500',
    color: 'rgba(107, 86, 71, 0.77)',
    margin: 0,
    marginTop: '6px',
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
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
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
  pendingCoffeeCard: {
    backgroundColor: 'rgba(253, 248, 242, 0.9)',
    borderLeft: '3px solid #C4956A',
    border: '1px solid rgba(196, 149, 106, 0.25)',
    borderLeftWidth: '3px',
    borderLeftColor: '#C4956A',
  },
  dateBadgePending: {
    backgroundColor: '#FFF5EB',
    borderColor: '#E8D5C0',
  },
  pendingNote: {
    fontSize: '13px',
    color: '#8B6F5C',
    fontStyle: 'italic',
    marginBottom: '8px',
    padding: '6px 10px',
    backgroundColor: 'rgba(196, 149, 106, 0.1)',
    borderRadius: '8px',
  },
  actionBtnAccept: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    backgroundColor: '#5C4033',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
  },
  actionBtnDecline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(139, 111, 92, 0.25)',
    borderRadius: '10px',
    color: 'rgba(107, 86, 71, 0.77)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
  },
  actionBtnWaiting: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    backgroundColor: 'rgba(196, 149, 106, 0.15)',
    border: '1px dashed rgba(196, 149, 106, 0.4)',
    borderRadius: '10px',
    color: 'rgba(107, 86, 71, 0.77)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'default',
    fontFamily: '"Lora", serif',
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
    gap: '0',
  },
  viewBtn: {
    padding: '8px 16px',
    fontSize: '24px',
    fontWeight: '500',
    color: 'rgba(107, 86, 71, 0.5)',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '0',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
    letterSpacing: '0.15px',
    transition: 'all 0.2s ease',
  },
  viewBtnActive: {
    color: '#3F1906',
    borderBottom: '2px solid #3F1906',
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
    fontFamily: '"Lora", serif',
    fontSize: '20px',
    fontWeight: '500',
    color: '#3F1906',
    letterSpacing: '0.15px',
    marginBottom: '8px',
    margin: 0,
  },
  emptyText: {
    fontFamily: '"Lora", serif',
    fontSize: '14px',
    fontWeight: '400',
    color: 'rgba(107, 86, 71, 0.77)',
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
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
  },
  meetupCard: {
    display: 'flex',
    gap: '20px',
    padding: '20px',
    background: 'linear-gradient(219.16deg, rgba(247, 242, 236, 0.96) 39.76%, rgba(240, 225, 213, 0.980157) 67.53%, rgba(236, 217, 202, 0.990231) 82.33%)',
    borderRadius: '20px',
    border: '1px solid rgba(139, 111, 92, 0.12)',
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
  dateBadge: {
    width: '52px',
    borderRadius: '14px',
    backgroundColor: 'rgba(189, 173, 162, 0.65)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 4px',
    flexShrink: 0,
  },
  dateBadgeMonth: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#605045',
    letterSpacing: '0.5px',
    lineHeight: '1',
  },
  dateBadgeDay: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#3F1906',
    lineHeight: '1.2',
    fontFamily: '"Lora", serif',
  },
  dateBadgeWeekday: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#605045',
    lineHeight: '1',
  },
  dateBadgeTime: {
    fontSize: '9px',
    fontWeight: '600',
    color: '#605045',
    lineHeight: '1',
    marginTop: '3px',
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
  cardTime: {
    fontFamily: '"Lora", serif',
    fontSize: '12px',
    fontWeight: '500',
    color: 'rgba(107, 86, 71, 0.77)',
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
    marginBottom: '8px',
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
    fontFamily: '"Lora", serif',
    fontSize: '17px',
    fontWeight: '500',
    color: '#3F1906',
    letterSpacing: '0.15px',
  },
  personRole: {
    fontFamily: '"Lora", serif',
    fontSize: '13px',
    fontWeight: '400',
    color: 'rgba(107, 86, 71, 0.77)',
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
    fontFamily: '"Lora", serif',
    fontSize: '13px',
    color: 'rgba(107, 86, 71, 0.77)',
    fontWeight: '400',
  },
  eventTitle: {
    fontFamily: '"Lora", serif',
    fontSize: '18px',
    fontWeight: '500',
    color: '#3F1906',
    letterSpacing: '0.15px',
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
    fontFamily: '"Lora", serif',
    fontSize: '14px',
    fontWeight: '400',
    color: 'rgba(107, 86, 71, 0.77)',
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
    backgroundColor: '#5C4033',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
  },
  actionBtnGoing: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    backgroundColor: '#7A5C4A',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
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
    background: 'linear-gradient(219.16deg, rgba(247, 242, 236, 0.96) 39.76%, rgba(240, 225, 213, 0.980157) 67.53%, rgba(236, 217, 202, 0.990231) 82.33%)',
    borderRadius: '20px',
    border: '1px solid rgba(139, 111, 92, 0.12)',
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
  pastCardTopic: {
    fontFamily: '"Lora", serif',
    fontSize: '18px',
    fontWeight: '500',
    color: '#3F1906',
    letterSpacing: '0.15px',
    lineHeight: '1.3',
  },
  pastCardMeta: {
    fontFamily: '"Lora", serif',
    fontSize: '13px',
    fontWeight: '400',
    color: 'rgba(107, 86, 71, 0.77)',
    marginTop: '2px',
  },
  pastCardSummary: {
    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '13px',
    fontWeight: '400',
    color: 'rgba(63, 25, 6, 0.65)',
    marginTop: '6px',
    lineHeight: '1.45',
    fontStyle: 'italic',
  },
  summaryBox: {
    marginTop: '8px',
    padding: '10px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '10px',
    borderLeft: '3px solid rgba(139, 111, 92, 0.35)',
  },
  summaryText: {
    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '13px',
    fontWeight: '400',
    color: 'rgba(63, 25, 6, 0.7)',
    lineHeight: '1.5',
    fontStyle: 'italic',
  },
  actionItemsBox: {
    marginTop: '10px',
    padding: '10px 12px',
    backgroundColor: 'rgba(196, 134, 139, 0.1)',
    borderRadius: '10px',
    borderLeft: '3px solid #C4868B',
  },
  actionItemsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    marginBottom: '6px',
  },
  actionItemsIcon: {
    fontSize: '14px',
    color: '#C4868B',
  },
  actionItemsLabel: {
    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '12px',
    fontWeight: '700',
    color: '#5C4033',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  actionItemsCount: {
    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '10px',
    fontWeight: '600',
    color: 'white',
    backgroundColor: '#C4868B',
    borderRadius: '100px',
    padding: '1px 6px',
    marginLeft: '2px',
  },
  actionItem: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    marginTop: '4px',
  },
  actionBullet: {
    color: '#C4868B',
    fontSize: '14px',
    flexShrink: 0,
  },
  actionText: {
    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '12.5px',
    color: 'rgba(63, 25, 6, 0.8)',
    lineHeight: '1.4',
  },
  newBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#5C4033',
    color: 'white',
    fontSize: '10px',
    fontWeight: '600',
    borderRadius: '100px',
    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    flexShrink: 0,
  },
  viewRecapBtnUnreviewed: {
    backgroundColor: '#5C4033',
    boxShadow: '0 2px 8px rgba(92, 64, 51, 0.35)',
  },
  pastCardCompact: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 18px',
    background: 'linear-gradient(219.16deg, rgba(247, 242, 236, 0.96) 39.76%, rgba(240, 225, 213, 0.980157) 67.53%, rgba(236, 217, 202, 0.990231) 82.33%)',
    borderRadius: '14px',
    border: '1px solid rgba(139, 111, 92, 0.12)',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  pastCardCompactLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  viewRecapBtnCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '8px 14px',
    backgroundColor: '#5C4033',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
    flexShrink: 0,
    transition: 'all 0.2s ease',
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
    backgroundColor: '#5C4033',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(139, 111, 92, 0.2)',
  },
  pastSection: {
    paddingTop: '10px',
    borderTop: '1px solid rgba(139, 111, 92, 0.08)',
  },
  pastSectionLabel: {
    display: 'block',
    fontFamily: '"Lora", serif',
    fontSize: '11px',
    fontWeight: '500',
    color: 'rgba(107, 86, 71, 0.77)',
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
  // Action menu styles
  moreBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    color: '#8B6F5C',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  actionMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
    border: '1px solid rgba(139, 111, 92, 0.12)',
    overflow: 'hidden',
    zIndex: 50,
    minWidth: '120px',
  },
  actionMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#5C4033',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    textAlign: 'left',
    transition: 'background-color 0.15s',
  },
  cancelChatBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(139, 111, 92, 0.2)',
    borderRadius: '10px',
    color: '#8B6F5C',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
  },
  // Edit modal styles
  editModal: {
    backgroundColor: '#FDF8F3',
    borderRadius: '20px',
    maxWidth: '440px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
  },
  editModalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 20px',
    borderBottom: '1px solid rgba(139, 111, 92, 0.12)',
  },
  editModalTitle: {
    fontFamily: '"Lora", serif',
    fontSize: '18px',
    fontWeight: '600',
    color: '#3F1906',
    margin: 0,
  },
  editModalClose: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#5C4033',
  },
  editModalBody: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
  },
  editModalFooter: {
    display: 'flex',
    gap: '10px',
    padding: '16px 20px',
    borderTop: '1px solid rgba(139, 111, 92, 0.12)',
  },
  editModalCancel: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    color: '#5C4033',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  editModalSave: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#5C4033',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  formGroup: {
    marginBottom: '16px',
  },
  formLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#5C4033',
    marginBottom: '6px',
    fontFamily: '"DM Sans", sans-serif',
  },
  formInput: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    border: '1.5px solid rgba(139, 111, 92, 0.2)',
    borderRadius: '10px',
    backgroundColor: 'white',
    color: '#3F1906',
    fontFamily: '"DM Sans", sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  },
  // Confirm modal styles
  confirmModal: {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '24px',
    maxWidth: '340px',
    width: '100%',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
  },
  confirmTitle: {
    fontFamily: '"Lora", serif',
    fontSize: '18px',
    fontWeight: '600',
    color: '#3F1906',
    margin: '0 0 10px',
  },
  confirmText: {
    fontSize: '14px',
    color: '#6B5344',
    lineHeight: '1.5',
    margin: '0 0 20px',
  },
  confirmActions: {
    display: 'flex',
    gap: '10px',
  },
  confirmCancel: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    color: '#5C4033',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  confirmDelete: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#D32F2F',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
};

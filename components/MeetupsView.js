// components/MeetupsView.js
// Meetups page - Coffee chats and group events combined
// UX design based on meetups-page.jsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Video, Calendar, MapPin, Clock, Users, Plus, X, Sparkles, Edit3, Trash2, MoreHorizontal, ImagePlus } from 'lucide-react';
import { parseLocalDate, isEventPast, formatEventTime, eventDateTimeToUTC } from '../lib/dateUtils';

const formatDate = (isoStr) => {
  try {
    return new Date(isoStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return 'TBD'; }
};

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
  const [activeCardId, setActiveCardId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMeetup, setEditingMeetup] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingMeetupId, setDeletingMeetupId] = useState(null);
  const [showCancelChatConfirm, setShowCancelChatConfirm] = useState(false);
  const [cancellingChatId, setCancellingChatId] = useState(null);

  // Close action menu and active card when clicking outside
  useEffect(() => {
    if (!actionMenuOpen && !activeCardId) return;
    const handleClick = () => { setActionMenuOpen(null); setActiveCardId(null); };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [actionMenuOpen, activeCardId]);

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

  const hasLoadedRef = React.useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, [currentUser.id]);

  const loadData = async () => {
    const t0 = Date.now();
    setLoading(true);
    await Promise.all([
      loadCoffeeChats(),
      loadGroupEvents(),
      loadPendingRequests()
    ]);
    console.log(`⏱️ Meetups page data loaded in ${Date.now() - t0}ms`);
    setLoading(false);
    // Defer past meetups — only visible in the "past" tab
    loadPastMeetups();
  };

  const loadCoffeeChats = useCallback(async () => {
    const t0 = Date.now();
    try {
      // Load all coffee chats for the user
      const { data, error } = await supabase
        .from('coffee_chats')
        .select('*')
        .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .in('status', ['pending', 'accepted', 'scheduled'])
        .order('scheduled_time', { ascending: true });

      if (error) {
        console.error('Coffee chats query error:', error.message);
        setCoffeeChats([]);
        return;
      }

      // Filter to only upcoming chats (client-side filter)
      // Show all chats scheduled from today onwards
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const upcomingChats = (data || []).filter(chat => {
        // Exclude completed, declined, cancelled
        if (chat.status === 'completed' || chat.status === 'declined' || chat.status === 'cancelled') return false;
        if (!chat.scheduled_time) return false;
        const chatTime = new Date(chat.scheduled_time);
        return chatTime >= todayStart;
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

      console.log(`⏱️ Meetups: loadCoffeeChats in ${Date.now() - t0}ms`);
      setCoffeeChats(chatsWithProfiles);
    } catch (err) {
      console.error('Error loading coffee chats:', err);
      setCoffeeChats([]);
    }
  }, [currentUser.id, supabase]);

  const loadGroupEvents = useCallback(async () => {
    const t0 = Date.now();
    try {
      const signedUpMeetupIds = userSignups || [];

      // Build meetups query with memberships in parallel
      const { data: membershipData } = await supabase
        .from('connection_group_members')
        .select('group_id')
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted');
      const userCircleIds = (membershipData || []).map(m => m.group_id);

      const orConditions = [];
      if (signedUpMeetupIds.length > 0) {
        orConditions.push(`id.in.(${signedUpMeetupIds.join(',')})`);
      }
      orConditions.push(`created_by.eq.${currentUser.id}`);
      if (userCircleIds.length > 0) {
        orConditions.push(`circle_id.in.(${userCircleIds.join(',')})`);
      }

      const { data: signedUpMeetups, error } = await supabase
        .from('meetups')
        .select('*, connection_groups(id, name)')
        .or(orConditions.join(','))
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching signed up meetups:', error);
        setGroupEvents([]);
        return;
      }

      // Filter to upcoming ones
      const now = new Date();
      const upcomingFiltered = (signedUpMeetups || []).filter(meetup => {
        if (meetup.status === 'completed' || meetup.status === 'cancelled') return false;
        if (!meetup.date) return false;
        // Use timezone-aware check with generous grace period (4 hours = 240 min)
        return !isEventPast(meetup.date, meetup.time, meetup.timezone, parseInt(meetup.duration || '60'), 240);
      });

      // Fire circle counts + attendee signups in parallel
      const upcomingMeetupIds = upcomingFiltered.map(m => m.id);
      const hostIds = [...new Set(upcomingFiltered.map(m => m.created_by).filter(Boolean))];
      const circleIdsInResults = [...new Set((signedUpMeetups || []).filter(m => m.circle_id).map(m => m.circle_id))];

      const parallelQueries = [];
      const parallelKeys = [];

      if (circleIdsInResults.length > 0) {
        parallelQueries.push(supabase.from('meetups').select('id, circle_id, date').in('circle_id', circleIdsInResults).order('date', { ascending: true }));
        parallelKeys.push('circleMeetups');
      }
      if (upcomingMeetupIds.length > 0) {
        parallelQueries.push(supabase.from('meetup_signups').select('meetup_id, user_id').in('meetup_id', upcomingMeetupIds));
        parallelKeys.push('signups');
      }

      const parallelResults = parallelQueries.length > 0 ? await Promise.all(parallelQueries) : [];
      const parallelMap = {};
      parallelKeys.forEach((key, i) => { parallelMap[key] = parallelResults[i]?.data || []; });

      let circleMeetupCounts = {};
      (parallelMap.circleMeetups || []).forEach(m => {
        if (!circleMeetupCounts[m.circle_id]) circleMeetupCounts[m.circle_id] = [];
        circleMeetupCounts[m.circle_id].push(m.id);
      });

      let attendeesByMeetup = {};
      let hostProfileMap = {};
      const signupData = parallelMap.signups || [];

      if (signupData.length > 0 || hostIds.length > 0) {
        const attendeeUserIds = signupData.map(s => s.user_id);
        const allUserIds = [...new Set([...attendeeUserIds, ...hostIds])];
        if (allUserIds.length > 0) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, name, profile_picture, career')
            .in('id', allUserIds);
          const profileMap = {};
          (profileData || []).forEach(p => { profileMap[p.id] = p; });
          hostProfileMap = profileMap;

          signupData.forEach(signup => {
            if (!attendeesByMeetup[signup.meetup_id]) attendeesByMeetup[signup.meetup_id] = [];
            const profile = profileMap[signup.user_id];
            if (profile) attendeesByMeetup[signup.meetup_id].push(profile);
          });
        }
      }

      const upcomingEvents = upcomingFiltered.map(meetup => {
        const isCircleMeetup = !!meetup.circle_id;
        const circleName = meetup.connection_groups?.name;
        const signupProfiles = attendeesByMeetup[meetup.id] || [];
        const hostProfile = hostProfileMap[meetup.created_by];
        // Always include host in attendee list if not already there
        const hostAlreadyIncluded = signupProfiles.some(p => p.id === meetup.created_by);
        const attendeeProfiles = (hostProfile && !hostAlreadyIncluded)
          ? [hostProfile, ...signupProfiles]
          : signupProfiles;

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
          date: formatDateLocal(meetup.date, meetup.time, meetup.timezone),
          rawTime: meetup.time,
          time: formatEventTime(meetup.date, meetup.time, meetup.timezone),
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

      console.log(`⏱️ Meetups: loadGroupEvents in ${Date.now() - t0}ms`);
      setGroupEvents(upcomingEvents);
    } catch (err) {
      console.error('Error loading group events:', err);
      setGroupEvents([]);
    }
  }, [userSignups, supabase]);

  const loadPastMeetups = useCallback(async () => {
    const t0 = Date.now();
    try {
      const now = new Date();
      const gracePeriod = new Date(now.getTime() - 60 * 60 * 1000);
      const allPastMeetups = [];

      // Round 1: Fire all independent queries in parallel
      const [recapResult, coffeeResult, signupsResult, membershipResult] = await Promise.all([
        supabase
          .from('call_recaps')
          .select('*')
          .or(`created_by.eq.${currentUser.id},participant_ids.cs.{${currentUser.id}}`)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('coffee_chats')
          .select('*')
          .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
          .order('scheduled_time', { ascending: false })
          .limit(20),
        supabase
          .from('meetup_signups')
          .select('meetup_id')
          .eq('user_id', currentUser.id),
        supabase
          .from('connection_group_members')
          .select('group_id')
          .eq('user_id', currentUser.id)
          .eq('status', 'accepted'),
      ]);

      const recaps = recapResult.data || [];
      const signedUpIds = (signupsResult.data || []).map(s => s.meetup_id);
      const userCircleIds = (membershipResult.data || []).map(m => m.group_id);

      // Helper: check if a date has a matching recap (within 4 hours)
      const findMatchingRecap = (rawDate) => {
        return recaps.find(r => {
          const recapTime = new Date(r.started_at || r.created_at);
          const timeDiff = Math.abs(rawDate - recapTime);
          return timeDiff < 4 * 60 * 60 * 1000;
        });
      };

      // Round 2: Queries that depend on Round 1 results — in parallel
      const round2Promises = [];
      const round2Keys = [];

      // Coffee chat partner profiles
      const coffeeData = coffeeResult.data || [];
      const pastChats = coffeeData.filter(chat => {
        if (!chat.scheduled_time) return false;
        if (chat.status === 'completed') return true;
        if (chat.status === 'accepted') {
          const chatTime = new Date(chat.scheduled_time);
          return chatTime < gracePeriod && !!findMatchingRecap(chatTime);
        }
        return false;
      });
      const otherUserIds = pastChats.map(chat =>
        chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id
      ).filter(Boolean);
      if (otherUserIds.length > 0) {
        round2Promises.push(supabase.from('profiles').select('id, name, profile_picture, career').in('id', otherUserIds));
        round2Keys.push('coffeeProfiles');
      }

      // Meetups query
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
      round2Promises.push(meetupsQuery);
      round2Keys.push('meetups');

      const round2Results = await Promise.all(round2Promises);
      const round2Map = {};
      round2Keys.forEach((key, i) => { round2Map[key] = round2Results[i]?.data || []; });

      // Process coffee chats
      const profileMap = new Map((round2Map.coffeeProfiles || []).map(p => [p.id, p]));
      pastChats.forEach(chat => {
        const otherId = chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id;
        const profile = profileMap.get(otherId);
        allPastMeetups.push({
          id: `coffee-${chat.id}`,
          sourceId: chat.id,
          type: 'coffee',
          with: profile?.name || 'Unknown',
          withProfile: profile,
          title: chat.topic ? `${chat.topic} — with ${profile?.name || 'Unknown'}` : `☕ Coffee with ${profile?.name || 'Unknown'}`,
          emoji: '☕',
          date: formatDate(chat.scheduled_time || chat.created_at),
          rawDate: new Date(chat.scheduled_time || chat.created_at),
          topic: chat.notes || 'Coffee chat',
          notes: null,
          followUp: chat.status !== 'completed',
        });
      });

      // Process meetups
      const meetupsData = round2Map.meetups || [];
      const pastMeetups = meetupsData.filter(meetup => {
        const userParticipated = signedUpIds.includes(meetup.id) || meetup.created_by === currentUser.id;
        if (!userParticipated) return false;
        if (meetup.status === 'completed') return true;
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
          date: formatDateLocal(meetup.date, meetup.time, meetup.timezone),
          rawDate: (() => { const d = parseLocalDate(meetup.date); if (meetup.time) { const [h, m] = meetup.time.split(':').map(Number); d.setHours(h, m, 0, 0); } return d; })(),
          topic: meetup.topic || meetup.description || (isCircle ? 'Circle meetup' : 'Public event'),
          notes: meetup.description,
          location: meetup.location,
          followUp: false,
          circleName: circleName,
          circleId: meetup.circle_id,
        });
      });

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
    } finally {
      console.log(`⏱️ Meetups: loadPastMeetups in ${Date.now() - t0}ms`);
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
    const t0 = Date.now();
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
    } finally {
      console.log(`⏱️ Meetups: loadPendingRequests in ${Date.now() - t0}ms`);
    }
  }, [currentUser.id, supabase]);

  const formatDateLocal = (dateStr, timeStr, timezone) => {
    if (!dateStr) return 'TBD';
    try {
      // Get the event's date in the viewer's timezone
      let viewerDate;
      if (timezone && timeStr) {
        const eventUTC = eventDateTimeToUTC(dateStr, timeStr, timezone);
        viewerDate = eventUTC; // This is a proper Date, will display in viewer's local
      } else {
        viewerDate = parseLocalDate(dateStr);
      }

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (viewerDate.toDateString() === now.toDateString()) return 'Today';
      if (viewerDate.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

      return viewerDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
      // Circle meetup - use Agora via /call/circle/ with meetup ID for session isolation
      const channelName = `connection-group-${meetup.id}`;
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
      meeting_format: item.meeting_format || 'virtual',
      image_url: item.image_url || null,
      newImageFile: null,
      newImagePreview: null,
    });
    setShowEditModal(true);
    setActionMenuOpen(null);
  };

  const handleUpdateMeetup = async () => {
    if (!editingMeetup) return;
    try {
      // Upload new image if selected
      let imageUrl = editingMeetup.image_url;
      if (editingMeetup.newImageFile) {
        const fileExt = editingMeetup.newImageFile.name.split('.').pop();
        const fileName = `profile-photos/${currentUser.id}-meetup-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, editingMeetup.newImageFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const { data, error } = await supabase
        .from('meetups')
        .update({
          topic: editingMeetup.topic,
          date: editingMeetup.date,
          time: editingMeetup.time,
          location: editingMeetup.meeting_format === 'virtual' ? 'Virtual' : editingMeetup.location,
          meeting_format: editingMeetup.meeting_format,
          image_url: imageUrl,
        })
        .eq('id', editingMeetup.id)
        .select();

      if (!error) {
        setGroupEvents(prev => prev.map(e =>
          e.id === editingMeetup.id ? {
            ...e,
            topic: editingMeetup.topic,
            title: editingMeetup.topic || e.title,
            originalDate: editingMeetup.date,
            rawDate: parseLocalDate(editingMeetup.date),
            date: formatDateLocal(editingMeetup.date, editingMeetup.time, editingMeetup.timezone),
            rawTime: editingMeetup.time,
            time: formatEventTime(editingMeetup.date, editingMeetup.time, editingMeetup.timezone),
            location: editingMeetup.meeting_format === 'virtual' ? 'Virtual' : editingMeetup.location,
            meeting_format: editingMeetup.meeting_format,
            image_url: imageUrl,
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
          Host a Coffee Chat
        </button>
      </section>

      {/* Back to upcoming link when viewing past */}
      {activeView === 'past' && (
        <button
          onClick={() => setActiveView('upcoming')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontWeight: '500',
            color: '#8B6F5C', padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: '4px',
          }}
        >
          ← Back to upcoming
        </button>
      )}

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
          ) : (() => {
            // Group items by date for date divider rows
            const todayDate = new Date(); todayDate.setHours(0,0,0,0);
            const tomorrowDate = new Date(todayDate); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
            const grouped = [];
            let lastDateKey = null;

            filteredItems.forEach((item) => {
              const itemDate = item.rawDate ? new Date(item.rawDate) : null;
              if (itemDate) itemDate.setHours(0,0,0,0);
              const dateKey = itemDate ? itemDate.toISOString() : 'unknown';

              if (dateKey !== lastDateKey) {
                const diffDays = itemDate ? Math.round((itemDate - todayDate) / (1000 * 60 * 60 * 24)) : -1;
                let dayLabel;
                if (diffDays === 0) dayLabel = 'TODAY';
                else if (diffDays === 1) dayLabel = 'TMRW';
                else dayLabel = item.rawDate ? item.rawDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : '';
                const monthDay = item.rawDate ? item.rawDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '';

                grouped.push({ type: 'header', dayLabel, monthDay, isToday: diffDays === 0, key: dateKey });
                lastDateKey = dateKey;
              }
              grouped.push({ type: 'item', item });
            });

            return grouped.map((entry, gIdx) => {
              if (entry.type === 'header') {
                return (
                  <div key={entry.key} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: gIdx === 0 ? '0 0 6px' : '14px 0 6px',
                  }}>
                    {entry.isToday && (
                      <span style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: '#5C4033', flexShrink: 0,
                      }} />
                    )}
                    <span style={{
                      fontFamily: '"DM Sans", sans-serif', fontSize: '12px', fontWeight: '700',
                      color: '#5C4033', letterSpacing: '1px',
                    }}>
                      {entry.dayLabel}
                    </span>
                    <span style={{
                      fontFamily: '"DM Sans", sans-serif', fontSize: '12px', fontWeight: '500',
                      color: '#B8A089', letterSpacing: '0.5px',
                    }}>
                      {entry.monthDay}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(180, 160, 137, 0.25)' }} />
                  </div>
                );
              }

              const item = entry.item;
              const itemDate = item.rawDate ? new Date(item.rawDate) : null;
              const isToday = itemDate && (() => { const d = new Date(itemDate); d.setHours(0,0,0,0); return d.getTime() === todayDate.getTime(); })();

              const isCoffee = item.type === 'coffee';
              const title = isCoffee ? (item.topic ? `${item.topic} — with ${item.with}` : `Coffee Chat with ${item.with}`) : (item.title || 'Community Event');
              const time = item.time && item.time !== 'TBD' ? item.time : null;
              const attendees = isCoffee ? [] : (item.attendeeProfiles || []);
              const coffeeAvatar = isCoffee ? { name: item.with, profile_picture: item.avatar } : null;
              const attendeeCount = isCoffee ? 2 : (attendees.length || 0);

              // Topic tag: use vibe_category, or derive from title keywords
              const topicTag = isCoffee ? '1:1 Chat' : (item.vibe_category || item.category || (() => {
                const t = (item.title || '').toLowerCase();
                if (/\bai\b|machine learning|ml\b|tech|coding|engineer/.test(t)) return 'AI & Tech';
                if (/founder|startup|fundrais|venture|bootstrap|mrr/.test(t)) return 'Founder Life';
                if (/product|pm\b|build|ship|launch/.test(t)) return 'Product';
                if (/career|job|hiring|interview|resume|transition|promotion/.test(t)) return 'Career';
                if (/design|ux\b|ui\b|creative|brand/.test(t)) return 'Design';
                if (/lead|manage|team|executive|ceo|cto/.test(t)) return 'Leadership';
                if (/burnout|mental|wellness|balance|self.care|stress/.test(t)) return 'Wellness';
                if (/marketing|growth|content|social media|seo/.test(t)) return 'Marketing';
                if (/remote|async|distributed/.test(t)) return 'Remote Work';
                if (/network|community|connect|circle/.test(t)) return 'Community';
                return 'Discussion';
              })());

              return (
                <div key={item.id} onClick={(e) => {
                  if (e.target.closest('button') || e.target.closest('[data-menu]')) return;
                  if (!isCoffee && onNavigate) { onNavigate('eventDetail', { meetupId: item.id }); return; }
                  setActiveCardId(activeCardId === item.id ? null : item.id);
                }} style={{
                  display: 'flex', alignItems: 'center',
                  padding: isMobile ? '14px 16px' : '18px 22px',
                  borderRadius: '16px',
                  background: isToday
                    ? 'linear-gradient(135deg, #7A5C42 0%, #9B7A5C 50%, #8B6B4F 100%)'
                    : '#FFFBF7',
                  border: isToday ? 'none' : '1px solid rgba(180, 160, 137, 0.12)',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = isToday
                    ? '0 6px 24px rgba(88, 66, 51, 0.25)'
                    : '0 4px 16px rgba(88, 66, 51, 0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                  {/* Time column with host avatar */}
                  <div style={{
                    minWidth: isMobile ? '65px' : '80px', flexShrink: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    paddingRight: isMobile ? '12px' : '18px',
                    borderRight: isToday
                      ? '1px solid rgba(255,255,255,0.2)'
                      : '1px solid rgba(180, 160, 137, 0.15)',
                  }}>
                    {/* Host avatar */}
                    {(() => {
                      const avatarSrc = isCoffee ? coffeeAvatar?.profile_picture : item.hostProfile?.profile_picture;
                      const avatarName = isCoffee ? (coffeeAvatar?.name || '?') : (item.host || '?');
                      return avatarSrc ? (
                        <img src={avatarSrc} alt="" style={{
                          width: 40, height: 40, borderRadius: '50%', objectFit: 'cover',
                          border: `2px solid ${isToday ? 'rgba(255,255,255,0.3)' : 'rgba(180, 160, 137, 0.2)'}`,
                        }} />
                      ) : (
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: isToday ? 'rgba(255,255,255,0.2)' : '#C4A97D',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '15px', fontWeight: 600, color: '#FFF',
                          border: `2px solid ${isToday ? 'rgba(255,255,255,0.3)' : 'rgba(180, 160, 137, 0.2)'}`,
                        }}>
                          {avatarName[0].toUpperCase()}
                        </div>
                      );
                    })()}
                    <span style={{
                      fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '14px' : '15px', fontWeight: '700',
                      color: isToday ? '#FFF' : '#5C4033',
                    }}>
                      {(time || 'TBD').replace(/\s+([A-Z]{2,5}|[\w\s]+ time)$/i, '')}
                    </span>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: isMobile ? '12px' : '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* Topic tag + format badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '700',
                        padding: '3px 10px', borderRadius: '6px',
                        background: isToday ? 'rgba(255,255,255,0.2)' : 'rgba(139, 111, 71, 0.12)',
                        color: isToday ? 'rgba(255,255,255,0.9)' : '#7A5C42',
                        letterSpacing: '0.4px', textTransform: 'capitalize',
                        fontFamily: '"DM Sans", sans-serif',
                      }}>
                        {topicTag}
                      </span>
                      {!isCoffee && item.meeting_format && item.meeting_format !== 'virtual' && (
                        <span style={{
                          fontSize: '10px', fontWeight: '600', padding: '3px 10px', borderRadius: '6px',
                          backgroundColor: isToday ? 'rgba(255,255,255,0.15)' : (item.meeting_format === 'hybrid' ? '#E8EDF0' : '#E8F0E4'),
                          color: isToday ? 'rgba(255,255,255,0.8)' : (item.meeting_format === 'hybrid' ? '#4A6572' : '#4E6B46'),
                          whiteSpace: 'nowrap',
                        }}>
                          {item.meeting_format === 'hybrid' ? 'Hybrid' : 'In-Person'}
                        </span>
                      )}
                      {isCoffee && item.isPending && (
                        <span style={{
                          fontSize: '10px', fontWeight: '600', padding: '3px 10px', borderRadius: '6px',
                          background: isToday ? 'rgba(255,255,255,0.15)' : 'rgba(196, 149, 106, 0.2)',
                          color: isToday ? 'rgba(255,255,255,0.8)' : '#8B6F5C',
                        }}>
                          {item.isInviteReceived ? 'Invited you' : 'Awaiting response'}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 style={{
                      fontFamily: '"Lora", serif', fontSize: isMobile ? '15px' : '18px', fontWeight: '600',
                      color: isToday ? '#FFF' : '#2C1810', margin: 0, lineHeight: 1.3,
                    }}>
                      {title}
                    </h4>

                    {/* Description */}
                    {item.description && (
                      <p style={{
                        fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '12px' : '13px', fontWeight: '400',
                        color: isToday ? 'rgba(255,255,255,0.55)' : '#A89080',
                        margin: 0, lineHeight: 1.4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.description}
                      </p>
                    )}

                    {/* Participant avatars + count */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      {attendees.length > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          {attendees.slice(0, 3).map((a, idx) => (
                            <span key={a.id || idx} style={{
                              width: 22, height: 22, borderRadius: '50%',
                              border: `1.5px solid ${isToday ? 'rgba(122,92,66,0.8)' : '#FFFBF7'}`,
                              marginLeft: idx > 0 ? -6 : 0,
                              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: a.profile_picture ? 'none' : (isToday ? 'rgba(255,255,255,0.25)' : '#C4A97D'),
                              fontSize: '9px', color: '#FFF', fontWeight: 600, flexShrink: 0,
                            }}>
                              {a.profile_picture ? (
                                <img src={a.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                (a.name || '?')[0].toUpperCase()
                              )}
                            </span>
                          ))}
                        </span>
                      )}
                      {isCoffee && coffeeAvatar && (
                        <span style={{
                          width: 22, height: 22, borderRadius: '50%',
                          border: `1.5px solid ${isToday ? 'rgba(122,92,66,0.8)' : '#FFFBF7'}`,
                          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: coffeeAvatar.profile_picture ? 'none' : (isToday ? 'rgba(255,255,255,0.25)' : '#C4A97D'),
                          fontSize: '9px', color: '#FFF', fontWeight: 600, flexShrink: 0,
                        }}>
                          {coffeeAvatar.profile_picture ? (
                            <img src={coffeeAvatar.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            (coffeeAvatar.name || '?')[0].toUpperCase()
                          )}
                        </span>
                      )}
                      <span style={{
                        fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontWeight: '500',
                        color: isToday ? 'rgba(255,255,255,0.55)' : '#C4956A',
                      }}>
                        {attendeeCount} {attendeeCount === 1 ? 'attendee' : 'attendees'}
                      </span>
                    </div>

                    {/* Edit/Delete menu for owned items */}
                    {activeCardId === item.id && ((!isCoffee && item.created_by === currentUser.id) || (isCoffee && item.requester_id === currentUser.id)) && (
                      <div style={{ position: 'relative', marginTop: '4px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActionMenuOpen(actionMenuOpen === item.id ? null : item.id); }}
                          style={styles.moreBtn}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {actionMenuOpen === item.id && (
                          <div style={styles.actionMenu}>
                            {!isCoffee && (
                              <button style={styles.actionMenuItem} onClick={(e) => { e.stopPropagation(); handleEditMeetup(item); }}>
                                <Edit3 size={14} /> Edit
                              </button>
                            )}
                            {isCoffee ? (
                              <button style={{...styles.actionMenuItem, color: '#D32F2F'}} onClick={(e) => { e.stopPropagation(); setCancellingChatId(item.id); setShowCancelChatConfirm(true); setActionMenuOpen(null); }}>
                                <Trash2 size={14} /> Cancel
                              </button>
                            ) : (
                              <button style={{...styles.actionMenuItem, color: '#D32F2F'}} onClick={(e) => { e.stopPropagation(); setDeletingMeetupId(item.id); setShowDeleteConfirm(true); setActionMenuOpen(null); }}>
                                <Trash2 size={14} /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: '12px' }}>
                    {isCoffee ? (
                      item.isInviteReceived ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button onClick={(e) => { e.stopPropagation(); handleAcceptChat(item); }} style={{
                            background: isToday ? 'rgba(255,255,255,0.95)' : 'rgba(88, 66, 51, 0.9)',
                            color: isToday ? '#5C4033' : '#F5EDE9', border: 'none',
                            padding: '9px 18px', borderRadius: '14px',
                            fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontWeight: '600',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>Accept</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeclineChat(item); }} style={{
                            background: 'none', color: isToday ? 'rgba(255,255,255,0.5)' : '#9B8A7E',
                            border: isToday ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(139,111,92,0.2)',
                            padding: '7px 14px', borderRadius: '14px',
                            fontFamily: '"DM Sans", sans-serif', fontSize: '12px', fontWeight: '500',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>Decline</button>
                        </div>
                      ) : item.isPending ? (
                        <span style={{
                          fontSize: '12px', fontWeight: '600',
                          color: isToday ? 'rgba(255,255,255,0.5)' : '#9B8A7E',
                          fontFamily: '"DM Sans", sans-serif',
                        }}>Pending</span>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); handleJoinCall(item); }} style={{
                          background: isToday ? 'rgba(255,255,255,0.95)' : 'rgba(88, 66, 51, 0.9)',
                          color: isToday ? '#5C4033' : '#F5EDE9', border: 'none',
                          padding: '10px 22px', borderRadius: '14px',
                          fontFamily: '"DM Sans", sans-serif', fontSize: '14px', fontWeight: '700',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                          gap: '7px', whiteSpace: 'nowrap', transition: 'transform 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          <Video size={16} />
                          Join
                        </button>
                      )
                    ) : (
                      (item.status === 'going' || item.isCircleMeetup) ? (
                        item.meeting_format === 'in_person' ? (
                          <span style={{
                            fontSize: '13px', fontWeight: '600',
                            color: isToday ? 'rgba(255,255,255,0.8)' : '#4E6B46',
                            fontFamily: '"DM Sans", sans-serif',
                            padding: '10px 18px', borderRadius: '14px',
                            backgroundColor: isToday ? 'rgba(255,255,255,0.15)' : '#E8F0E4',
                          }}>Going</span>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleJoinCall(item); }} style={{
                            background: isToday ? 'rgba(255,255,255,0.95)' : 'rgba(88, 66, 51, 0.9)',
                            color: isToday ? '#5C4033' : '#F5EDE9', border: 'none',
                            padding: '10px 22px', borderRadius: '14px',
                            fontFamily: '"DM Sans", sans-serif', fontSize: '14px', fontWeight: '700',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                            gap: '7px', whiteSpace: 'nowrap', transition: 'transform 0.15s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            <Video size={16} />
                            Join
                          </button>
                        )
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); handleRsvpMeetup(item); }} style={{
                          background: isToday ? 'rgba(255,255,255,0.95)' : 'rgba(88, 66, 51, 0.9)',
                          color: isToday ? '#5C4033' : '#F5EDE9', border: 'none',
                          padding: '10px 22px', borderRadius: '14px',
                          fontFamily: '"DM Sans", sans-serif', fontSize: '14px', fontWeight: '700',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                          gap: '7px', whiteSpace: 'nowrap', transition: 'transform 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          <Video size={16} />
                          Join
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            });
          })()}
          {/* View past link */}
          {filteredItems.length > 0 && pastMeetups.length > 0 && (
            <button
              onClick={() => setActiveView('past')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontWeight: '500',
                color: '#B8A089', padding: '16px 0 4px', margin: '0 auto', display: 'block',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#8B6F5C'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B8A089'; }}
            >
              View past meetups →
            </button>
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
                <div key={item.id} onClick={() => {
                  if (item.type !== 'coffee' && item.sourceId && onNavigate) {
                    onNavigate('eventDetail', { meetupId: item.sourceId });
                  }
                }} style={{
                  ...styles.pastCardCompact,
                  alignItems: 'flex-start',
                  animationDelay: `${index * 0.1}s`,
                  cursor: item.type !== 'coffee' ? 'pointer' : 'default',
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
                    onClick={(e) => { e.stopPropagation(); handleViewRecap(item); }}
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
      {activeView !== 'past' && groupEvents.length < 3 && (
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
                <label style={styles.formLabel}>Meeting Format</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { value: 'virtual', label: 'Virtual' },
                    { value: 'in_person', label: 'In-Person' },
                    { value: 'hybrid', label: 'Hybrid' },
                  ].map(option => (
                    <button
                      key={option.value}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: editingMeetup.meeting_format === option.value
                          ? '1.5px solid #8B6F5C'
                          : '1.5px solid rgba(139, 111, 92, 0.2)',
                        backgroundColor: editingMeetup.meeting_format === option.value
                          ? 'rgba(139, 111, 92, 0.08)'
                          : 'white',
                        color: editingMeetup.meeting_format === option.value
                          ? '#8B6F5C'
                          : '#6B5344',
                        fontSize: '13px',
                        fontWeight: editingMeetup.meeting_format === option.value ? '600' : '500',
                        cursor: 'pointer',
                        fontFamily: '"DM Sans", sans-serif',
                      }}
                      onClick={() => {
                        const newFormat = option.value;
                        setEditingMeetup({
                          ...editingMeetup,
                          meeting_format: newFormat,
                          location: newFormat === 'virtual' ? 'Virtual'
                            : editingMeetup.location === 'Virtual' ? '' : editingMeetup.location,
                        });
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {editingMeetup.meeting_format !== 'virtual' && (
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {editingMeetup.meeting_format === 'hybrid' ? 'Physical Location' : 'Location'}
                  </label>
                  <input
                    type="text"
                    value={editingMeetup.location}
                    onChange={(e) => setEditingMeetup({ ...editingMeetup, location: e.target.value })}
                    style={styles.formInput}
                    placeholder="City name or venue"
                  />
                  {editingMeetup.meeting_format === 'hybrid' && (
                    <p style={{ fontSize: '11px', color: '#A89080', margin: '6px 0 0', fontStyle: 'italic' }}>
                      Virtual call link will also be available
                    </p>
                  )}
                </div>
              )}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Event Photo</label>
                {(editingMeetup.newImagePreview || editingMeetup.image_url) ? (
                  <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden' }}>
                    <img
                      src={editingMeetup.newImagePreview || editingMeetup.image_url}
                      alt="Event"
                      style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block', borderRadius: '10px' }}
                    />
                    <button
                      onClick={() => setEditingMeetup({ ...editingMeetup, image_url: null, newImageFile: null, newImagePreview: null })}
                      style={{
                        position: 'absolute', top: '6px', right: '6px',
                        width: '24px', height: '24px', borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.5)', border: 'none',
                        color: 'white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', borderRadius: '10px',
                    border: '1.5px dashed rgba(139, 111, 92, 0.2)',
                    backgroundColor: 'white', cursor: 'pointer',
                    fontSize: '13px', color: '#A89080',
                  }}>
                    <ImagePlus size={18} />
                    Add a cover photo
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
                        if (file.size > 5 * 1024 * 1024) { alert('Image must be less than 5MB'); return; }
                        setEditingMeetup({
                          ...editingMeetup,
                          newImageFile: file,
                          newImagePreview: URL.createObjectURL(file),
                        });
                      }}
                    />
                  </label>
                )}
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
  },
  ambientBg: {
    display: 'none',
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
    fontFamily: '"Lora", serif',
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
    gap: '0',
    padding: '0',
    background: 'transparent',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(59,35,20,0.06)',
    border: '1px solid rgba(59,35,20,0.05)',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
    alignItems: 'stretch',
    position: 'relative',
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
    minWidth: '68px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 0',
    background: '#F3EAE0',
    borderRight: '1px solid rgba(59,35,20,0.06)',
    borderRadius: '16px 0 0 16px',
    flexShrink: 0,
  },
  dateBadgeMonth: {
    fontFamily: '"DM Sans", sans-serif',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '1.2px',
    color: '#8B6347',
    marginBottom: '2px',
  },
  dateBadgeDay: {
    fontFamily: '"Lora", serif',
    fontSize: '26px',
    fontWeight: '600',
    color: '#3B2314',
    lineHeight: 1,
  },
  dateBadgeWeekday: {
    fontFamily: '"DM Sans", sans-serif',
    fontSize: '11px',
    fontWeight: '500',
    color: '#9B8A7E',
    marginTop: '3px',
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
    padding: '14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
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
    justifyContent: 'center',
    gap: '10px',
    padding: '0 14px 0 0',
    flexShrink: 0,
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
    background: 'transparent',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(59,35,20,0.06)',
    border: '1px solid rgba(59,35,20,0.05)',
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
    background: 'transparent',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(59,35,20,0.06)',
    border: '1px solid rgba(59,35,20,0.05)',
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
    fontFamily: '"Lora", serif',
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

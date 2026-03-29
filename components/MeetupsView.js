// components/MeetupsView.js
// Meetups page - Coffee chats and group events combined
// UX design based on meetups-page.jsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Video, Calendar, MapPin, Clock, Users, Plus, X, Sparkles, Edit3, Trash2, MoreHorizontal, ImagePlus, ChevronLeft, FileText, Check, Circle } from 'lucide-react';
import { parseLocalDate, isEventPast, formatEventTime, eventDateTimeToUTC } from '../lib/dateUtils';
import { colors as tokens, fonts } from '@/lib/designTokens';

const formatDate = (isoStr) => {
  try {
    return new Date(isoStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return 'TBD'; }
};

export default function MeetupsView({ currentUser, supabase, connections = [], meetups = [], userSignups = [], onNavigate, initialView = null, pastOnly = false }) {
  const [activeView, setActiveView] = useState(pastOnly ? 'past' : (initialView || 'upcoming'));
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

  // Past meetings: completed follow-ups and expanded summaries
  const [completedFollowUps, setCompletedFollowUps] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('completedFollowUps') || '{}'); } catch { return {}; }
    }
    return {};
  });
  const [expandedSummaries, setExpandedSummaries] = useState({});

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

  // Track which recaps have been viewed (from recap_views table)
  const [reviewedRecaps, setReviewedRecaps] = useState([]);

  useEffect(() => {
    supabase
      .from('recap_views')
      .select('recap_id')
      .eq('user_id', currentUser.id)
      .then(({ data }) => {
        setReviewedRecaps((data || []).map(v => v.recap_id));
      });
  }, [currentUser.id]);

  const markRecapReviewed = (recapId) => {
    if (!recapId) return;
    setReviewedRecaps(prev => {
      if (prev.includes(recapId)) return prev;
      return [...prev, recapId];
    });
    supabase.from('recap_views')
      .upsert({ recap_id: recapId, user_id: currentUser.id }, { onConflict: 'recap_id,user_id' });
  };

  const toggleFollowUp = (itemId, actionIndex) => {
    const key = `${itemId}_${actionIndex}`;
    setCompletedFollowUps(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('completedFollowUps', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleSummaryExpanded = (itemId) => {
    setExpandedSummaries(prev => ({ ...prev, [itemId]: !prev[itemId] }));
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
    const promises = [
      loadCoffeeChats(),
      loadGroupEvents(),
      loadPendingRequests(),
    ];
    if (initialView === 'past' || pastOnly) {
      promises.push(loadPastMeetups());
    }
    await Promise.all(promises);
    console.log(`⏱️ Meetups page data loaded in ${Date.now() - t0}ms`);
    setLoading(false);
    if (initialView !== 'past' && !pastOnly) {
      loadPastMeetups();
    }
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
        if (!chat.scheduled_time) return true; // No time = pending, show it
        const chatTime = new Date(chat.scheduled_time);
        // Coffee chats last ~30 min, add 30 min grace
        return chatTime.getTime() + 60 * 60 * 1000 > now.getTime();
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
          time: formatEventTime(meetup.date, meetup.time, meetup.timezone, { showTimezone: false }),
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

      // Build a map of entity ID → recap by extracting UUID from channel_name
      const recapsByEntityId = {};
      recaps.forEach(r => {
        const channelName = r.channel_name || '';
        const uuidMatch = channelName.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch) {
          const entityId = uuidMatch[0];
          // Keep the most recent recap per entity
          if (!recapsByEntityId[entityId] || new Date(r.created_at) > new Date(recapsByEntityId[entityId].created_at)) {
            recapsByEntityId[entityId] = r;
          }
        }
      });

      const findMatchingRecap = (entityId) => {
        return recapsByEntityId[entityId] || null;
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
          return chatTime < gracePeriod && !!findMatchingRecap(chat.id);
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
          topic: chat.topic || `Coffee with ${profile?.name || 'Unknown'}`,
          notes: null,
          followUp: chat.status !== 'completed',
        });
      });

      // Process meetups
      const meetupsData = round2Map.meetups || [];
      const userCircleIdSet = new Set(userCircleIds);
      const pastMeetups = meetupsData.filter(meetup => {
        const userParticipated = signedUpIds.includes(meetup.id) || meetup.created_by === currentUser.id;
        const isCircleMember = meetup.circle_id && userCircleIdSet.has(meetup.circle_id);
        if (!userParticipated && !isCircleMember) return false;
        if (meetup.status === 'completed') return true;
        const meetupDate = parseLocalDate(meetup.date);
        if (meetup.time) {
          const [hours, minutes] = meetup.time.split(':').map(Number);
          meetupDate.setHours(hours, minutes, 0, 0);
        }
        return meetupDate < gracePeriod && !!findMatchingRecap(meetup.id);
      });

      pastMeetups.forEach(meetup => {
        const isCircle = !!meetup.circle_id;
        const circleName = meetup.connection_groups?.name;
        const didAttend = signedUpIds.includes(meetup.id) || meetup.created_by === currentUser.id;
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
          didAttend,
        });
      });

      // 3. Match recaps to past meetups and extract topics
      allPastMeetups.forEach(item => {
        const matchingRecap = findMatchingRecap(item.sourceId);

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

      // 3b. Add recap-driven events not already in the list
      // (events where the user participated via call but didn't sign up)
      const addedEntityIds = new Set(allPastMeetups.map(m => m.sourceId));
      const missingRecapEntities = Object.entries(recapsByEntityId)
        .filter(([entityId]) => !addedEntityIds.has(entityId));

      if (missingRecapEntities.length > 0) {
        // Fetch meetup/group info for missing entities
        const missingMeetupIds = missingRecapEntities
          .filter(([, r]) => r.call_type !== 'group')
          .map(([entityId]) => entityId);
        const missingGroupIds = missingRecapEntities
          .filter(([, r]) => r.call_type === 'group')
          .map(([entityId]) => entityId);

        const missingPromises = [];
        const missingKeys = [];
        if (missingMeetupIds.length > 0) {
          missingPromises.push(supabase.from('meetups').select('id, topic, date, time, timezone, description, circle_id, connection_groups(id, name)').in('id', missingMeetupIds));
          missingKeys.push('meetups');
        }
        if (missingGroupIds.length > 0) {
          missingPromises.push(supabase.from('connection_groups').select('id, name').in('id', missingGroupIds));
          missingKeys.push('groups');
        }

        if (missingPromises.length > 0) {
          const missingResults = await Promise.all(missingPromises);
          const missingMap = {};
          missingKeys.forEach((key, i) => { missingMap[key] = missingResults[i]?.data || []; });

          // Add missing meetups
          (missingMap.meetups || []).forEach(meetup => {
            const recap = recapsByEntityId[meetup.id];
            if (!recap) return;
            const isCircle = !!meetup.circle_id;
            const circleName = meetup.connection_groups?.name;
            allPastMeetups.push({
              id: `meetup-${meetup.id}`,
              sourceId: meetup.id,
              type: isCircle ? 'circle' : 'public',
              with: isCircle ? circleName : null,
              title: isCircle ? `🔒 ${circleName || 'Circle'} Meetup` : `🎉 ${meetup.topic || 'Event'}`,
              emoji: isCircle ? '🔒' : '🎉',
              date: formatDateLocal(meetup.date, meetup.time, meetup.timezone),
              rawDate: (() => { const d = parseLocalDate(meetup.date); if (meetup.time) { const [h, m] = meetup.time.split(':').map(Number); d.setHours(h, m, 0, 0); } return d; })(),
              topic: meetup.topic || meetup.description || (isCircle ? 'Circle meetup' : 'Public event'),
              notes: meetup.description,
              circleName, circleId: meetup.circle_id,
              didAttend: true,
              hasRecap: true, recapId: recap.id, recapData: recap,
            });
          });

          // Add missing group calls (circle meetings without a meetup record)
          (missingMap.groups || []).forEach(group => {
            const recap = recapsByEntityId[group.id];
            if (!recap) return;
            allPastMeetups.push({
              id: `group-${group.id}-${recap.id}`,
              sourceId: group.id,
              type: 'circle',
              with: group.name,
              title: `🔒 ${group.name} Meeting`,
              emoji: '🔒',
              date: formatDate(recap.started_at || recap.created_at),
              rawDate: new Date(recap.started_at || recap.created_at),
              topic: group.name,
              circleName: group.name, circleId: group.id,
              didAttend: true,
              hasRecap: true, recapId: recap.id, recapData: recap,
            });
          });
        }
      }

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
      // All coffee chat types use the unified recap view
      onNavigate('coffeeChatRecap', { recapId: item.recapId });
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
      {pastOnly ? (
        <section style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: isMobile ? '20px' : '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid rgba(139, 111, 92, 0.1)',
        }}>
          <button
            onClick={() => onNavigate?.('home')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
              display: 'flex', alignItems: 'center', color: '#7E654D', flexShrink: 0,
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 style={{
              fontFamily: fonts.serif, fontSize: isMobile ? '24px' : '32px',
              fontWeight: '500', color: '#584233', letterSpacing: '0.15px',
              lineHeight: 1.28, margin: 0,
            }}>Past Meetings</h1>
            <p style={{
              fontFamily: fonts.serif, fontSize: isMobile ? '13px' : '14px',
              fontWeight: '500', margin: '4px 0 0',
              color: 'rgba(107, 86, 71, 0.77)',
            }}>Review recaps and follow up on action items</p>
          </div>
        </section>
      ) : (
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
            }}>Schedule 1:1 video chats with your connections</p>
          </div>
          <button style={{
            ...styles.scheduleBtn,
            padding: isMobile ? '10px 16px' : '12px 20px',
            fontSize: isMobile ? '13px' : '14px',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center',
            boxShadow: isMobile ? '0 2px 8px rgba(139, 111, 92, 0.2)' : '0 4px 16px rgba(139, 111, 92, 0.25)',
          }} onClick={handleScheduleCoffeeChat}>
            <Plus size={isMobile ? 14 : 18} />
            Host a Coffee Chat
          </button>
        </section>
      )}

      {/* Upcoming / Past tab bar (only in normal mode, not pastOnly) */}
      {!pastOnly && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: isMobile ? '16px' : '20px',
          background: 'rgba(139, 111, 92, 0.06)',
          borderRadius: '12px',
          padding: '4px',
          width: 'fit-content',
        }}>
          {['upcoming', 'past'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveView(tab)}
              style={{
                padding: isMobile ? '8px 20px' : '8px 24px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: fonts.sans,
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: activeView === tab ? '600' : '500',
                color: activeView === tab ? '#FFFFFF' : '#8B6F5C',
                background: activeView === tab ? '#8B6F5C' : 'transparent',
                transition: 'all 0.2s ease',
                minHeight: '44px',
              }}
            >
              {tab === 'upcoming' ? 'Upcoming' : 'Past'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {activeView === 'upcoming' ? (
        <div style={styles.meetupsList}>
          {filteredItems.length === 0 ? (
            <div style={{...styles.emptyState, padding: isMobile ? '32px 16px' : '48px 24px'}}>
              <span style={{...styles.emptyIcon, fontSize: isMobile ? '36px' : '48px'}}>📅</span>
              <h3 style={{...styles.emptyTitle, fontSize: isMobile ? '17px' : '20px'}}>No upcoming meetups</h3>
              <p style={{...styles.emptyText, fontSize: isMobile ? '13px' : '14px'}}>Schedule a coffee chat or join a group event!</p>
              <button style={{...styles.emptyBtn, padding: isMobile ? '10px 20px' : '12px 24px', fontSize: isMobile ? '13px' : '14px'}} onClick={() => onNavigate && onNavigate('discover')}>
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
                      fontFamily: fonts.sans, fontSize: '12px', fontWeight: '700',
                      color: '#5C4033', letterSpacing: '1px',
                    }}>
                      {entry.dayLabel}
                    </span>
                    <span style={{
                      fontFamily: fonts.sans, fontSize: '12px', fontWeight: '500',
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
              const attendees = isCoffee
                ? [
                    { id: currentUser.id, name: currentUser.name, profile_picture: currentUser.profile_picture },
                    { id: 'other', name: item.with, profile_picture: item.avatar },
                  ]
                : (item.attendeeProfiles || []);
              const coffeeAvatar = isCoffee ? { name: item.with, profile_picture: item.avatar } : null;
              const attendeeCount = isCoffee ? 0 : (attendees.length || 0);

              // Category tag: meeting type
              const categoryTag = isCoffee ? '1:1' : (item.isCircleMeetup ? 'Circle' : 'Event');
              const categoryColors = {
                '1:1': { bg: 'rgba(155, 126, 196, 0.15)', color: '#7B5EA7' },
                'Circle': { bg: 'rgba(139, 158, 126, 0.15)', color: '#5C7A4E' },
                'Event': { bg: 'rgba(139, 111, 71, 0.12)', color: '#7A5C42' },
              };

              // Vibe tag
              const vibeMap = {
                advice: { label: 'Advice', bg: 'rgba(59, 130, 246, 0.12)', color: '#2563EB' },
                vent: { label: 'Vent', bg: 'rgba(239, 68, 68, 0.10)', color: '#DC2626' },
                grow: { label: 'Grow', bg: 'rgba(34, 197, 94, 0.12)', color: '#16A34A' },
              };
              const vibe = item.vibe_category ? vibeMap[item.vibe_category] : null;

              // Topic tag: derive from title keywords
              const topicTag = isCoffee ? null : (() => {
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
                return null;
              })();

              return (
                <div key={item.id} onClick={(e) => {
                  if (e.target.closest('button') || e.target.closest('[data-menu]')) return;
                  if (onNavigate) {
                    onNavigate('eventDetail', { meetupId: item.id, meetupCategory: isCoffee ? 'coffee' : undefined });
                    return;
                  }
                }} style={{
                  display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                  padding: isMobile ? '12px 14px' : '18px 22px',
                  borderRadius: isMobile ? '14px' : '16px',
                  background: isToday
                    ? 'linear-gradient(135deg, #7A5C42 0%, #9B7A5C 50%, #8B6B4F 100%)'
                    : '#FFFBF7',
                  border: isToday ? 'none' : '1px solid rgba(180, 160, 137, 0.12)',
                  marginBottom: isMobile ? '6px' : '8px',
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
                    minWidth: isMobile ? '52px' : '80px', flexShrink: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? '3px' : '4px',
                    paddingRight: isMobile ? '10px' : '18px',
                    borderRight: isToday
                      ? '1px solid rgba(255,255,255,0.2)'
                      : '1px solid rgba(180, 160, 137, 0.15)',
                  }}>
                    {/* Host avatar */}
                    {(() => {
                      const avatarSrc = isCoffee ? (item.requester_id === currentUser.id ? currentUser.profile_picture : coffeeAvatar?.profile_picture) : item.hostProfile?.profile_picture;
                      const avatarName = isCoffee ? (item.requester_id === currentUser.id ? (currentUser.name || '?') : (coffeeAvatar?.name || '?')) : (item.host || '?');
                      const avatarSize = isMobile ? 32 : 40;
                      return avatarSrc ? (
                        <img src={avatarSrc} alt="" style={{
                          width: avatarSize, height: avatarSize, borderRadius: '50%', objectFit: 'cover',
                          border: `2px solid ${isToday ? 'rgba(255,255,255,0.3)' : 'rgba(180, 160, 137, 0.2)'}`,
                        }} />
                      ) : (
                        <div style={{
                          width: avatarSize, height: avatarSize, borderRadius: '50%',
                          background: isToday ? 'rgba(255,255,255,0.2)' : '#C4A97D',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: isMobile ? '12px' : '15px', fontWeight: 600, color: '#FFF',
                          border: `2px solid ${isToday ? 'rgba(255,255,255,0.3)' : 'rgba(180, 160, 137, 0.2)'}`,
                        }}>
                          {avatarName[0].toUpperCase()}
                        </div>
                      );
                    })()}
                    <span style={{
                      fontFamily: fonts.sans, fontSize: isMobile ? '11px' : '15px', fontWeight: '700',
                      color: isToday ? '#FFF' : '#5C4033', textAlign: 'center', lineHeight: 1.2,
                    }}>
                      {time || 'TBD'}
                    </span>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: isMobile ? '10px' : '18px', display: 'flex', flexDirection: 'column', gap: isMobile ? '3px' : '4px' }}>
                    {/* Tags row: Category + Vibe + Topic + Format */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '5px', flexWrap: 'wrap' }}>
                      {/* Category tag (1:1 / Circle / Event) */}
                      <span style={{
                        fontSize: isMobile ? '9px' : '10px', fontWeight: '700',
                        padding: isMobile ? '2px 7px' : '3px 9px', borderRadius: '6px',
                        background: isToday ? 'rgba(255,255,255,0.2)' : (categoryColors[categoryTag]?.bg || 'rgba(139, 111, 71, 0.12)'),
                        color: isToday ? 'rgba(255,255,255,0.9)' : (categoryColors[categoryTag]?.color || '#7A5C42'),
                        letterSpacing: '0.3px', textTransform: 'uppercase',
                        fontFamily: fonts.sans,
                      }}>
                        {categoryTag}
                      </span>
                      {/* Vibe tag (Advice / Vent / Grow) */}
                      {vibe && (
                        <span style={{
                          fontSize: isMobile ? '9px' : '10px', fontWeight: '600', padding: isMobile ? '2px 7px' : '3px 9px', borderRadius: '6px',
                          background: isToday ? 'rgba(255,255,255,0.15)' : vibe.bg,
                          color: isToday ? 'rgba(255,255,255,0.8)' : vibe.color,
                          fontFamily: fonts.sans,
                        }}>
                          {vibe.label}
                        </span>
                      )}
                      {/* Topic tag (AI & Tech, Career, etc.) */}
                      {topicTag && (
                        <span style={{
                          fontSize: isMobile ? '9px' : '10px', fontWeight: '600', padding: isMobile ? '2px 7px' : '3px 9px', borderRadius: '6px',
                          background: isToday ? 'rgba(255,255,255,0.12)' : 'rgba(201, 169, 110, 0.12)',
                          color: isToday ? 'rgba(255,255,255,0.7)' : '#8B7355',
                          fontFamily: fonts.sans,
                        }}>
                          {topicTag}
                        </span>
                      )}
                      {/* Format tag (In-Person / Hybrid) */}
                      {!isCoffee && item.meeting_format && item.meeting_format !== 'virtual' && (
                        <span style={{
                          fontSize: isMobile ? '9px' : '10px', fontWeight: '600', padding: isMobile ? '2px 7px' : '3px 9px', borderRadius: '6px',
                          background: isToday ? 'rgba(255,255,255,0.15)' : (item.meeting_format === 'hybrid' ? '#E8EDF0' : '#E8F0E4'),
                          color: isToday ? 'rgba(255,255,255,0.8)' : (item.meeting_format === 'hybrid' ? '#4A6572' : '#4E6B46'),
                          fontFamily: fonts.sans,
                        }}>
                          {item.meeting_format === 'hybrid' ? 'Hybrid' : 'In-Person'}
                        </span>
                      )}
                      {/* Pending status for coffee chats */}
                      {isCoffee && item.isPending && (
                        <span style={{
                          fontSize: isMobile ? '9px' : '10px', fontWeight: '600', padding: isMobile ? '2px 7px' : '3px 9px', borderRadius: '6px',
                          background: isToday ? 'rgba(255,255,255,0.15)' : 'rgba(196, 149, 106, 0.2)',
                          color: isToday ? 'rgba(255,255,255,0.8)' : '#8B6F5C',
                          fontFamily: fonts.sans,
                        }}>
                          {item.isInviteReceived ? 'Invited you' : 'Awaiting response'}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 style={{
                      fontFamily: fonts.serif, fontSize: isMobile ? '15px' : '18px', fontWeight: '600',
                      color: isToday ? '#FFF' : '#2C1810', margin: 0, lineHeight: 1.3,
                    }}>
                      {title}
                    </h4>

                    {/* Description - hidden on mobile */}
                    {!isMobile && item.description && (
                      <p style={{
                        fontFamily: fonts.sans, fontSize: '13px', fontWeight: '400',
                        color: isToday ? 'rgba(255,255,255,0.55)' : '#A89080',
                        margin: 0, lineHeight: 1.4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.description}
                      </p>
                    )}

                    {/* Participant avatars + count */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '6px', marginTop: '2px' }}>
                      {attendees.length > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          {attendees.slice(0, isMobile ? 2 : 3).map((a, idx) => (
                            <span key={a.id || idx} style={{
                              width: isMobile ? 18 : 22, height: isMobile ? 18 : 22, borderRadius: '50%',
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
                        fontFamily: fonts.sans, fontSize: isMobile ? '11px' : '13px', fontWeight: '500',
                        color: isToday ? 'rgba(255,255,255,0.55)' : '#C4956A',
                      }}>
                        {isCoffee
                          ? (item.isPending ? (item.isInviteReceived ? 'Invite received' : 'Awaiting response') : '1:1 Video Call')
                          : `${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'}`}
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
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: isMobile ? '8px' : '12px' }}>
                    {isCoffee ? (
                      item.isInviteReceived ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button onClick={(e) => { e.stopPropagation(); handleAcceptChat(item); }} style={{
                            background: isToday ? 'rgba(255,255,255,0.95)' : 'rgba(88, 66, 51, 0.9)',
                            color: isToday ? '#5C4033' : '#F5EDE9', border: 'none',
                            padding: isMobile ? '7px 14px' : '9px 18px', borderRadius: isMobile ? '10px' : '14px',
                            fontFamily: fonts.sans, fontSize: isMobile ? '12px' : '13px', fontWeight: '600',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>Accept</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeclineChat(item); }} style={{
                            background: 'none', color: isToday ? 'rgba(255,255,255,0.5)' : '#9B8A7E',
                            border: isToday ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(139,111,92,0.2)',
                            padding: isMobile ? '5px 10px' : '7px 14px', borderRadius: isMobile ? '10px' : '14px',
                            fontFamily: fonts.sans, fontSize: isMobile ? '11px' : '12px', fontWeight: '500',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>Decline</button>
                        </div>
                      ) : item.isPending ? (
                        <span style={{
                          fontSize: isMobile ? '10px' : '11px', fontWeight: '600',
                          color: isToday ? 'rgba(255,255,255,0.7)' : '#8B6F5C',
                          fontFamily: fonts.sans,
                          padding: isMobile ? '6px 10px' : '8px 14px', borderRadius: isMobile ? '10px' : '12px',
                          background: isToday ? 'rgba(255,255,255,0.12)' : 'rgba(196, 149, 106, 0.15)',
                          display: 'inline-flex', alignItems: 'center', gap: isMobile ? '3px' : '5px',
                          letterSpacing: '0.2px', whiteSpace: 'nowrap',
                        }}>
                          <Clock size={isMobile ? 10 : 12} />
                          {isMobile ? 'Awaiting' : 'Awaiting response'}
                        </span>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); handleJoinCall(item); }} style={{
                          background: isToday ? 'rgba(255,255,255,0.95)' : 'rgba(88, 66, 51, 0.9)',
                          color: isToday ? '#5C4033' : '#F5EDE9', border: 'none',
                          padding: isMobile ? '8px 14px' : '10px 22px', borderRadius: isMobile ? '10px' : '14px',
                          fontFamily: fonts.sans, fontSize: isMobile ? '12px' : '14px', fontWeight: '700',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                          gap: isMobile ? '5px' : '7px', whiteSpace: 'nowrap', transition: 'transform 0.15s ease',
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
                            fontSize: isMobile ? '12px' : '13px', fontWeight: '600',
                            color: isToday ? 'rgba(255,255,255,0.8)' : '#4E6B46',
                            fontFamily: fonts.sans,
                            padding: isMobile ? '7px 12px' : '10px 18px', borderRadius: isMobile ? '10px' : '14px',
                            backgroundColor: isToday ? 'rgba(255,255,255,0.15)' : '#E8F0E4',
                          }}>Going</span>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleJoinCall(item); }} style={{
                            background: isToday ? 'rgba(255,255,255,0.95)' : 'rgba(88, 66, 51, 0.9)',
                            color: isToday ? '#5C4033' : '#F5EDE9', border: 'none',
                            padding: isMobile ? '8px 14px' : '10px 22px', borderRadius: isMobile ? '10px' : '14px',
                            fontFamily: fonts.sans, fontSize: isMobile ? '12px' : '14px', fontWeight: '700',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                            gap: isMobile ? '5px' : '7px', whiteSpace: 'nowrap', transition: 'transform 0.15s ease',
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
                          padding: isMobile ? '8px 14px' : '10px 22px', borderRadius: isMobile ? '10px' : '14px',
                          fontFamily: fonts.sans, fontSize: isMobile ? '12px' : '14px', fontWeight: '700',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                          gap: isMobile ? '5px' : '7px', whiteSpace: 'nowrap', transition: 'transform 0.15s ease',
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
              onClick={() => onNavigate?.('pastMeetings')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: fonts.sans, fontSize: '13px', fontWeight: '500',
                color: '#B8A089', padding: '16px 0 4px', margin: '0 auto', display: 'block',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#8B6F5C'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B8A089'; }}
            >
              View past meetings →
            </button>
          )}
        </div>
      ) : (
        // Past Meetings — redesigned
        <div style={styles.pastList}>
          {pastMeetups.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📚</span>
              <h3 style={styles.emptyTitle}>No past meetings yet</h3>
              <p style={styles.emptyText}>Your completed calls will appear here</p>
            </div>
          ) : (() => {
            // Compute all follow-up stats for global progress bar
            let totalFollowUps = 0;
            let totalCompleted = 0;

            const parsedItems = pastMeetups.map(item => {
              const durationMin = item.recapData?.duration_seconds ? Math.floor(item.recapData.duration_seconds / 60) : null;
              const durationStr = durationMin ? (durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`) : null;
              const attendeeCount = item.recapData?.participant_count || item.participants?.length || (item.type === 'coffee' ? 2 : null);

              let summary = null;
              let actionItems = [];
              if (item.recapData?.ai_summary) {
                const raw = item.recapData.ai_summary;
                try {
                  const parsed = JSON.parse(raw);
                  summary = parsed.summary || null;
                  actionItems = (parsed.actionItems || []).map(a => typeof a === 'string' ? a : a.text || '').filter(Boolean);
                } catch {
                  const lines = raw.split('\n');
                  const summaryLines = [];
                  let currentSection = 'summary';
                  for (const line of lines) {
                    const clean = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
                    const lower = line.toLowerCase();
                    if (lower.includes('key takeaway') || lower.includes('takeaways:')) { currentSection = 'takeaways'; continue; }
                    if (lower.includes('action item') || lower.includes('follow up') || lower.includes('next step')) { currentSection = 'actions'; continue; }
                    if (lower.includes('topics discussed')) { currentSection = 'topics'; continue; }
                    if (lower.includes('quote') || lower.includes('memorable')) { currentSection = 'quotes'; continue; }
                    if (!clean) continue;
                    if (currentSection === 'summary') summaryLines.push(clean);
                    else if (currentSection === 'actions' && clean.length > 5) actionItems.push(clean);
                  }
                  summary = summaryLines.join(' ') || null;
                }
              }

              const completedCount = actionItems.filter((_, i) => completedFollowUps[`${item.id}_${i}`]).length;
              totalFollowUps += actionItems.length;
              totalCompleted += completedCount;

              return { ...item, summary, actionItems, durationStr, attendeeCount, completedCount };
            });

            // Group by date
            const grouped = [];
            let lastDateKey = null;
            parsedItems.forEach(item => {
              const d = item.rawDate;
              const dateKey = d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : 'unknown';
              if (dateKey !== lastDateKey) {
                const today = new Date(); today.setHours(0,0,0,0);
                const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
                const itemDay = new Date(d); itemDay.setHours(0,0,0,0);
                let label;
                if (itemDay.getTime() === today.getTime()) label = 'Today';
                else if (itemDay.getTime() === yesterday.getTime()) label = 'Yesterday';
                else label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                grouped.push({ type: 'date', label, key: dateKey });
                lastDateKey = dateKey;
              }
              grouped.push({ type: 'item', data: item, key: item.id });
            });

            const typeTagColors = {
              coffee: { bg: '#FDF3EB', text: '#C4763B', label: '1:1 Coffee' },
              circle: { bg: '#EBF1F7', text: '#4A6A8B', label: 'Circle' },
              public: { bg: '#E8F2EB', text: '#4A7C59', label: 'Community' },
            };

            return (
              <>
                {/* Global follow-up progress bar */}
                {totalFollowUps > 0 && (() => {
                  const pct = Math.round((totalCompleted / totalFollowUps) * 100);
                  const allDone = totalCompleted === totalFollowUps;
                  return (
                    <div style={{
                      padding: isMobile ? '10px 12px' : '12px 16px', marginBottom: isMobile ? '8px' : '10px', borderRadius: isMobile ? '12px' : '14px',
                      background: allDone
                        ? 'linear-gradient(135deg, rgba(74,124,89,0.1) 0%, rgba(74,124,89,0.04) 100%)'
                        : 'linear-gradient(135deg, #5C4033 0%, #7A5C42 100%)',
                      border: allDone ? '1px solid rgba(74,124,89,0.2)' : 'none',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' }}>
                          <div style={{
                            width: isMobile ? '24px' : '28px', height: isMobile ? '24px' : '28px', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: allDone ? 'rgba(74,124,89,0.15)' : 'rgba(255,255,255,0.15)',
                          }}>
                            {allDone
                              ? <Check size={isMobile ? 13 : 15} style={{ color: '#4A7C59' }} />
                              : <FileText size={isMobile ? 13 : 15} style={{ color: '#F5EDE4' }} />
                            }
                          </div>
                          <span style={{ fontFamily: fonts.sans, fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: allDone ? '#4A7C59' : '#F5EDE4' }}>
                            {allDone ? 'All done!' : 'Follow-up Progress'}
                          </span>
                        </div>
                        <span style={{
                          fontFamily: fonts.sans, fontSize: isMobile ? '11px' : '12px', fontWeight: '600',
                          color: allDone ? '#4A7C59' : '#F5EDE4',
                          backgroundColor: allDone ? 'rgba(74,124,89,0.12)' : 'rgba(255,255,255,0.15)',
                          padding: '2px 8px', borderRadius: '100px',
                        }}>
                          {totalCompleted} / {totalFollowUps}
                        </span>
                      </div>
                      <div style={{ height: isMobile ? '6px' : '8px', backgroundColor: allDone ? 'rgba(74,124,89,0.12)' : 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '4px', transition: 'width 0.4s ease',
                          background: allDone ? '#4A7C59' : 'linear-gradient(90deg, #D4B896, #F5EDE4)',
                          width: `${pct}%`,
                        }} />
                      </div>
                    </div>
                  );
                })()}

                {grouped.map(entry => {
                  if (entry.type === 'date') {
                    return (
                      <div key={entry.key} style={{ fontFamily: fonts.sans, fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#A89080', textTransform: 'uppercase', letterSpacing: '1px', padding: isMobile ? '6px 0 3px' : '8px 0 4px', marginTop: '2px' }}>
                        {entry.label}
                      </div>
                    );
                  }

                  const item = entry.data;
                  const isUnreviewed = item.hasRecap && item.recapId && !reviewedRecaps.includes(item.recapId);
                  const isExpanded = expandedSummaries[item.id];
                  const tag = typeTagColors[item.type] || typeTagColors.public;

                  return (
                    <div key={item.id} style={{ padding: isMobile ? '10px 12px' : '12px 14px', marginBottom: isMobile ? '4px' : '6px', background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(250,245,239,0.3) 100%)', borderRadius: isMobile ? '12px' : '14px', border: '1px solid rgba(139,111,92,0.08)', cursor: 'pointer' }}
                      onClick={() => { if (item.sourceId && onNavigate) onNavigate('eventDetail', { meetupId: item.sourceId, meetupCategory: item.type === 'coffee' ? 'coffee' : undefined }); }}
                    >
                      {/* Header row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: isMobile ? '8px' : '10px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: fonts.serif, fontSize: isMobile ? '14px' : '17px', fontWeight: '600', color: '#3F1906', lineHeight: '1.3' }}>
                              {item.topic || item.title}
                            </span>
                            <span style={{ fontSize: isMobile ? '9px' : '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '6px', backgroundColor: tag.bg, color: tag.text, flexShrink: 0 }}>
                              {item.type === 'circle' ? (item.circleName || tag.label) : tag.label}
                            </span>
                            {isUnreviewed && <span style={{...styles.newBadge, fontSize: isMobile ? '9px' : '10px', padding: isMobile ? '1px 6px' : '2px 8px'}}>New</span>}
                            {item.didAttend === false && (
                              <span style={{ fontSize: isMobile ? '9px' : '10px', fontWeight: 600, color: '#A89080', backgroundColor: '#F5EDE4', borderRadius: '6px', padding: '2px 7px' }}>Missed</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px', marginTop: '3px', flexWrap: 'wrap' }}>
                            {item.type === 'coffee' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: isMobile ? '11px' : '12px', color: '#8B7355' }}>
                                <Users size={isMobile ? 10 : 11} /> with {item.with}
                              </span>
                            )}
                            {item.durationStr && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: isMobile ? '11px' : '12px', color: '#8B7355' }}>
                                <Clock size={isMobile ? 10 : 11} /> {item.durationStr}
                              </span>
                            )}
                            {item.attendeeCount != null && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: isMobile ? '11px' : '12px', color: '#8B7355' }}>
                                <Users size={isMobile ? 10 : 11} /> {item.attendeeCount}
                              </span>
                            )}
                          </div>
                        </div>
                        {item.hasRecap && (
                          <button
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              padding: isMobile ? '5px 10px' : '7px 14px', borderRadius: '100px', border: 'none',
                              fontSize: isMobile ? '11px' : '12px', fontWeight: '600', cursor: 'pointer',
                              fontFamily: fonts.sans, flexShrink: 0,
                              backgroundColor: isUnreviewed ? '#5C4033' : 'rgba(139,111,92,0.12)',
                              color: isUnreviewed ? 'white' : '#5C4033',
                              boxShadow: isUnreviewed ? '0 2px 8px rgba(92,64,51,0.35)' : 'none',
                            }}
                            onClick={(e) => { e.stopPropagation(); handleViewRecap(item); }}
                          >
                            <FileText size={isMobile ? 11 : 13} />
                            Recap
                          </button>
                        )}
                      </div>

                      {/* Summary with expand/collapse */}
                      {item.summary && (
                        <div style={{ marginTop: isMobile ? '6px' : '8px', padding: isMobile ? '6px 8px' : '8px 10px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: isMobile ? '8px' : '10px', borderLeft: '3px solid rgba(139,111,92,0.35)' }}>
                          <span style={{ fontFamily: fonts.sans, fontSize: isMobile ? '12px' : '13px', color: 'rgba(63,25,6,0.7)', lineHeight: '1.5', fontStyle: 'italic' }}>
                            {isExpanded || item.summary.length <= (isMobile ? 100 : 150) ? item.summary : item.summary.slice(0, isMobile ? 100 : 150) + '...'}
                          </span>
                          {item.summary.length > (isMobile ? 100 : 150) && (
                            <button onClick={(e) => { e.stopPropagation(); toggleSummaryExpanded(item.id); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B6F5C', fontSize: isMobile ? '11px' : '12px', fontWeight: '600', padding: '3px 0 0', fontFamily: fonts.sans }}>
                              {isExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Follow-ups with checkable items */}
                      {item.actionItems.length > 0 ? (
                        <div style={{ marginTop: isMobile ? '6px' : '8px', padding: isMobile ? '6px 8px' : '8px 10px', backgroundColor: 'rgba(196,134,139,0.08)', borderRadius: isMobile ? '8px' : '10px', borderLeft: '3px solid #C4868B' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: isMobile ? '10px' : '12px', fontWeight: '700', color: '#5C4033', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: fonts.sans }}>Follow-ups</span>
                              <span style={{ fontSize: isMobile ? '9px' : '10px', fontWeight: '600', color: 'white', backgroundColor: '#C4868B', borderRadius: '100px', padding: '1px 5px', fontFamily: fonts.sans }}>
                                {item.completedCount} / {item.actionItems.length}
                              </span>
                            </div>
                            <div style={{ width: isMobile ? '40px' : '60px', height: '4px', backgroundColor: 'rgba(196,134,139,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: '2px', transition: 'width 0.3s ease', backgroundColor: item.completedCount === item.actionItems.length ? '#4A7C59' : '#C4868B', width: `${(item.completedCount / item.actionItems.length) * 100}%` }} />
                            </div>
                          </div>
                          {item.actionItems.map((action, i) => {
                            const isDone = !!completedFollowUps[`${item.id}_${i}`];
                            return (
                              <div key={i} onClick={(e) => { e.stopPropagation(); toggleFollowUp(item.id, i); }}
                                style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '3px 0', cursor: 'pointer', opacity: isDone ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                                {isDone
                                  ? <Check size={isMobile ? 12 : 14} style={{ color: '#4A7C59', flexShrink: 0, marginTop: '1px' }} />
                                  : <Circle size={isMobile ? 12 : 14} style={{ color: '#C4868B', flexShrink: 0, marginTop: '1px' }} />
                                }
                                <span style={{ fontFamily: fonts.sans, fontSize: isMobile ? '11.5px' : '12.5px', color: 'rgba(63,25,6,0.8)', lineHeight: '1.4', textDecoration: isDone ? 'line-through' : 'none' }}>
                                  {action}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : item.hasRecap ? (
                        <div style={{ marginTop: isMobile ? '6px' : '8px', padding: isMobile ? '5px 8px' : '6px 10px', backgroundColor: 'rgba(139,111,92,0.04)', borderRadius: isMobile ? '8px' : '10px' }}>
                          <span style={{ fontFamily: fonts.sans, fontSize: isMobile ? '11px' : '12px', color: '#A89080', fontStyle: 'italic' }}>No follow-ups for this meeting</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}

      {/* Suggested Section */}
      {activeView !== 'past' && groupEvents.length < 3 && (
        <section style={{...styles.suggestedSection, padding: isMobile ? '20px 16px' : '24px'}}>
          <h2 style={{...styles.sectionTitle, fontSize: isMobile ? '16px' : '18px'}}>
            Explore the Community
          </h2>
          <p style={{...styles.suggestedText, fontSize: isMobile ? '13px' : '14px'}}>
            Join group events, vote on topics, or find a circle to grow with.
          </p>
          <button style={{...styles.suggestedBtn, padding: isMobile ? '10px 20px' : '12px 24px', fontSize: isMobile ? '13px' : '14px'}} onClick={() => onNavigate && onNavigate('discover')}>
            Discover
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
                        fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
    position: 'relative',
    maxWidth: '880px',
    margin: '0 auto',
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
    fontFamily: fonts.serif,
    fontSize: '32px',
    fontWeight: '500',
    color: '#584233',
    letterSpacing: '0.15px',
    lineHeight: 1.28,
    margin: 0,
  },
  subtitle: {
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.serif,
    fontSize: '20px',
    fontWeight: '500',
    color: '#3F1906',
    letterSpacing: '0.15px',
    marginBottom: '8px',
    margin: 0,
  },
  emptyText: {
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
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
    minWidth: '58px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 0',
    background: '#F3EAE0',
    borderRight: '1px solid rgba(59,35,20,0.06)',
    borderRadius: '16px 0 0 16px',
    flexShrink: 0,
  },
  dateBadgeMonth: {
    fontFamily: fonts.sans,
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '1.2px',
    color: '#8B6347',
    marginBottom: '2px',
  },
  dateBadgeDay: {
    fontFamily: fonts.serif,
    fontSize: '26px',
    fontWeight: '600',
    color: '#3B2314',
    lineHeight: 1,
  },
  dateBadgeWeekday: {
    fontFamily: fonts.sans,
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
    minWidth: 0,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
    fontSize: '17px',
    fontWeight: '500',
    color: '#3F1906',
    letterSpacing: '0.15px',
  },
  personRole: {
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
    fontSize: '13px',
    color: 'rgba(107, 86, 71, 0.77)',
    fontWeight: '400',
  },
  eventTitle: {
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
  },
  pastList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    marginBottom: '24px',
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.serif,
    fontSize: '18px',
    fontWeight: '500',
    color: '#3F1906',
    letterSpacing: '0.15px',
    lineHeight: '1.3',
  },
  pastCardMeta: {
    fontFamily: fonts.serif,
    fontSize: '13px',
    fontWeight: '400',
    color: 'rgba(107, 86, 71, 0.77)',
    marginTop: '2px',
  },
  pastCardSummary: {
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
    fontSize: '12px',
    fontWeight: '700',
    color: '#5C4033',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  actionItemsCount: {
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(139, 111, 92, 0.2)',
  },
  pastSection: {
    paddingTop: '10px',
    borderTop: '1px solid rgba(139, 111, 92, 0.08)',
  },
  pastSectionLabel: {
    display: 'block',
    fontFamily: fonts.serif,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
  },
  formInput: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    border: '1.5px solid rgba(139, 111, 92, 0.2)',
    borderRadius: '10px',
    backgroundColor: 'white',
    color: '#3F1906',
    fontFamily: fonts.sans,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
  },
};

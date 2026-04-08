// components/NetworkDiscoverView.js
// Network discovery page with Vibe Bar, Recommended Section, and Dynamic Results Feed
'use client';

import { useState, useEffect, useMemo } from 'react';
import { parseLocalDate, isEventPast, formatEventTime, formatEventDate } from '../lib/dateUtils';
import { requestToJoinGroup } from '@/lib/connectionRecommendationHelpers';
import { useSupabaseQuery, invalidateQuery } from '@/hooks/useSupabaseQuery';
import {
  Search,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  Plus,
  Users,
  User,
  Lock,
  ThumbsUp,
  X,
  Check,
  UserPlus
} from 'lucide-react';

// Custom hook for responsive design
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth });
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

import { colors as tokens, fonts } from '@/lib/designTokens';

// Color palette — sourced from shared design tokens
const colors = {
  primary: tokens.primary,
  primaryDark: tokens.primaryDark,
  primaryLight: tokens.primaryLight,
  cream: tokens.bg,
  warmWhite: tokens.bgWarm,
  text: '#4A3728',
  textLight: tokens.textLight,
  textMuted: tokens.textMuted,
  border: tokens.borderSolid,
};

// Vibe categories
const VIBE_CATEGORIES = [
  { id: 'advice', emoji: '🧘', label: 'Get advice', description: 'Connect with mentors & leaders' },
  { id: 'peers', emoji: '🗣️', label: 'Find support', description: 'Find your community' },
  { id: 'grow', emoji: '🚀', label: 'Career Growth', description: 'Level up your skills' },
];

// Topic chips for search bar
const TOPIC_CHIPS = [
  'Job Search',
  'AI Founding Partner',
  'Vibe Coding',
  'Career Pivot',
  'Fundraising Tips',
  'Work-Life Balance',
  'Networking',
  'Leadership',
  'PM Interviews',
  'Automotive Tech',
  'Mom Founders',
];

// Rotating placeholder hints
const PLACEHOLDER_HINTS = [
  'What brings you here today?',
  'Find women in AI & tech...',
  'Looking for a co-founder?',
];

// Score a circle's relevance for the current user
function scoreCircleForUser(circle, currentUser, connectionIds) {
  let score = 0;
  const reasons = [];

  const members = circle.members || [];

  // 1. Connections as members (0.15 per connection, capped at 0.30)
  const connMembers = members.filter(m => connectionIds.has(m.user_id));
  if (connMembers.length > 0) {
    score += Math.min(connMembers.length * 0.15, 0.30);
    const names = connMembers
      .map(m => m.user?.name?.split(' ')[0])
      .filter(Boolean);
    if (names.length === 1) {
      reasons.push(`${names[0]} is a member`);
    } else if (names.length > 1) {
      reasons.push(`${names.length} of your connections are here`);
    }
  }

  // 2. Interest overlap with members (0.08 per shared interest, capped at 0.25)
  const userInterests = (currentUser.interests || []).map(i => i.toLowerCase());
  if (userInterests.length > 0) {
    const memberInterests = new Set();
    members.forEach(m => {
      (m.user?.interests || []).forEach(i => memberInterests.add(i.toLowerCase()));
    });
    const shared = userInterests.filter(i => memberInterests.has(i));
    if (shared.length > 0) {
      score += Math.min(shared.length * 0.08, 0.25);
      reasons.push(`Shared interests: ${shared.slice(0, 3).join(', ')}`);
    }
  }

  // 3. Career similarity with members (0.05 per match, capped at 0.15)
  const userCareer = (currentUser.career || '').toLowerCase();
  if (userCareer) {
    const careerMatches = members.filter(m =>
      (m.user?.career || '').toLowerCase() === userCareer
    ).length;
    if (careerMatches > 0) {
      score += Math.min(careerMatches * 0.05, 0.15);
      reasons.push(`${careerMatches} member${careerMatches > 1 ? 's' : ''} in ${currentUser.career}`);
    }
  }

  // 4. Circle name/description matches user interests (0.08 per keyword, capped at 0.15)
  if (userInterests.length > 0) {
    const circleText = `${circle.name || ''} ${circle.description || ''}`.toLowerCase();
    const keywordMatches = userInterests.filter(i => circleText.includes(i));
    if (keywordMatches.length > 0) {
      score += Math.min(keywordMatches.length * 0.08, 0.15);
      reasons.push(`Matches your interests`);
    }
  }

  // 5. Ideal group size 3-8 (0.10 for 3-8, 0.05 for 1-2)
  const memberCount = members.length;
  if (memberCount >= 3 && memberCount <= 8) {
    score += 0.10;
  } else if (memberCount >= 1 && memberCount <= 2) {
    score += 0.05;
  }

  // 6. Vibe category exact match (0.05)
  if (currentUser.vibe_category && circle.vibe_category === currentUser.vibe_category) {
    score += 0.05;
    reasons.push('Matches your vibe');
  }

  return {
    score,
    reason: reasons[0] || null,
    reasons,
  };
}

export default function NetworkDiscoverView({
  currentUser,
  supabase,
  connections = [],
  meetups = [],
  onNavigate,
  onHostMeetup,
  onRequestMeetup,
  toast,
}) {
  const [selectedVibe, setSelectedVibe] = useState('peers');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTopic, setRequestTopic] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestVibe, setRequestVibe] = useState('grow');
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState(null);
  const [sentRequests, setSentRequests] = useState(new Set()); // Track sent connection requests
  const [rsvpLoading, setRsvpLoading] = useState({});
  const [circleJoinState, setCircleJoinState] = useState({}); // { [circleId]: 'idle' | 'loading' | 'joined' | 'requested' }
  const [searchText, setSearchText] = useState('');
  const [selectedChips, setSelectedChips] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
  const [expandedCircleId, setExpandedCircleId] = useState(null);

  // --- SWR data-loading queries (all grouped before useMemo hooks) ---
  // Stable defaults to prevent useMemo thrashing on re-renders
  const EMPTY_ARRAY = useMemo(() => [], []);
  const EMPTY_OBJECT = useMemo(() => ({}), []);
  const EMPTY_SET = useMemo(() => new Set(), []);
  const EMPTY_STATS = useMemo(() => ({ activeThisWeek: 0, meetupsThisWeek: 0 }), []);

  const { data: connectionGroups = EMPTY_ARRAY, isLoading: isLoadingGroups } = useSupabaseQuery(
    'discover-connection-groups',
    async (sb) => {
      const { data: groups, error } = await sb
        .from('connection_groups')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error || !groups || groups.length === 0) return [];

      const groupIds = groups.map(g => g.id);
      const { data: allMembers, error: membersError } = await sb
        .from('connection_group_members')
        .select('id, group_id, user_id, status')
        .in('group_id', groupIds)
        .eq('status', 'accepted');

      const memberUserIds = [...new Set((allMembers || []).map(m => m.user_id))];
      let profileMap = {};

      if (memberUserIds.length > 0) {
        const { data: profiles } = await sb
          .from('profiles')
          .select('id, name, career, profile_picture')
          .in('id', memberUserIds);

        profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }

      return groups.map(g => ({
        ...g,
        members: (allMembers || [])
          .filter(m => m.group_id === g.id)
          .map(m => ({
            ...m,
            user: profileMap[m.user_id] || null
          }))
      }));
    }
  );

  const { data: meetupRequests = EMPTY_ARRAY, isLoading: isLoadingRequests } = useSupabaseQuery(
    'discover-meetup-requests',
    async (sb) => {
      const { data, error } = await sb
        .from('meetup_requests')
        .select('*')
        .eq('status', 'open')
        .order('supporter_count', { ascending: false })
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) return [];

      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await sb
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const requestIds = data.map(r => r.id);
      const { data: allSupporters } = await sb
        .from('meetup_request_supporters')
        .select('request_id, user_id')
        .in('request_id', requestIds);

      const supporterUserIds = [...new Set((allSupporters || []).map(s => s.user_id))];
      let supporterProfileMap = {};
      if (supporterUserIds.length > 0) {
        const { data: supporterProfiles } = await sb
          .from('profiles')
          .select('id, name, profile_picture')
          .in('id', supporterUserIds);
        supporterProfileMap = (supporterProfiles || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
      }

      const supportersByRequest = {};
      (allSupporters || []).forEach(s => {
        if (!supportersByRequest[s.request_id]) supportersByRequest[s.request_id] = [];
        supportersByRequest[s.request_id].push({ ...s, profile: supporterProfileMap[s.user_id] || null });
      });

      return data.map(r => ({
        ...r,
        user: profileMap[r.user_id] || null,
        supporters: supportersByRequest[r.id] || [],
      }));
    }
  );

  const { data: socialProofStats = EMPTY_STATS } = useSupabaseQuery(
    'discover-social-proof',
    async (sb) => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { count: activeCount } = await sb
        .from('meetup_signups')
        .select('user_id', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo.toISOString());

      const { count: meetupCount } = await sb
        .from('meetups')
        .select('id', { count: 'exact', head: true })
        .gte('date', oneWeekAgo.toISOString().split('T')[0]);

      return {
        activeThisWeek: activeCount || 0,
        meetupsThisWeek: meetupCount || 0,
      };
    }
  );

  const { data: userRsvps = EMPTY_SET, isLoading: isLoadingRsvps } = useSupabaseQuery(
    currentUser?.id ? `discover-user-rsvps-${currentUser.id}` : null,
    async (sb) => {
      const { data, error } = await sb
        .from('meetup_signups')
        .select('meetup_id')
        .eq('user_id', currentUser.id);

      if (!error && data) {
        return new Set(data.map(r => r.meetup_id));
      }
      return new Set();
    }
  );

  const { data: meetupSignups = EMPTY_OBJECT, isLoading: isLoadingSignups } = useSupabaseQuery(
    'discover-meetup-signups',
    async (sb) => {
      const { data: signupsData, error: signupsError } = await sb
        .from('meetup_signups')
        .select('*');

      if (signupsError || !signupsData || signupsData.length === 0) return {};

      const userIds = [...new Set(signupsData.map(s => s.user_id))];
      const { data: profilesData } = await sb
        .from('profiles')
        .select('id, name, profile_picture')
        .in('id', userIds);

      const profilesMap = {};
      if (profilesData) {
        profilesData.forEach(p => { profilesMap[p.id] = p; });
      }

      const byMeetup = {};
      signupsData.forEach(s => {
        if (!byMeetup[s.meetup_id]) byMeetup[s.meetup_id] = [];
        byMeetup[s.meetup_id].push({
          ...s,
          profile: profilesMap[s.user_id] || null,
        });
      });
      return byMeetup;
    }
  );

  // Derive loading from SWR flags
  const loading = isLoadingGroups || isLoadingRequests;

  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 480;
  const isTablet = windowWidth >= 480 && windowWidth < 768;

  const isNewUser = connections.length === 0;

  // Scored and sorted circles for recommendations
  const connectionIds = useMemo(() =>
    new Set(connections.map(c => c.id)), [connections]);

  const scoredAvailableCircles = useMemo(() => {
    console.log('[Circles] connectionGroups:', connectionGroups.length, 'currentUser:', currentUser?.id);
    const filtered = connectionGroups.filter(group => {
      const isMember = group.members?.some(m => m.user_id === currentUser.id);
      const memberCount = group.members?.length || 0;
      if (isMember) console.log('[Circles] Filtered out (member):', group.name);
      if (memberCount >= 10) console.log('[Circles] Filtered out (full):', group.name);
      return !isMember && memberCount < 10;
    });
    console.log('[Circles] After filter:', filtered.length);
    return filtered
      .map(circle => ({
        ...circle,
        _scoring: scoreCircleForUser(circle, currentUser, connectionIds)
      }))
      .sort((a, b) => b._scoring.score - a._scoring.score);
  }, [connectionGroups, currentUser, connectionIds]);

  // Rotating placeholder animation — stops when focused or has input
  useEffect(() => {
    if (searchText || selectedChips.length > 0 || searchFocused) return;
    const interval = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_HINTS.length);
        setPlaceholderVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, [searchText, selectedChips.length, searchFocused]);

  const toggleChip = (chip) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const removeChip = (chip) => {
    setSelectedChips((prev) => prev.filter((c) => c !== chip));
  };

  const clearAll = () => {
    setSearchText('');
    setSelectedChips([]);
  };

  const hasInput = searchText.length > 0 || selectedChips.length > 0;

  const handleRsvp = async (meetupId) => {
    if (!meetupId || rsvpLoading[meetupId]) return;

    setRsvpLoading(prev => ({ ...prev, [meetupId]: true }));
    try {
      const isRsvped = userRsvps.has(meetupId);

      if (isRsvped) {
        // Cancel RSVP
        const { error } = await supabase
          .from('meetup_signups')
          .delete()
          .eq('meetup_id', meetupId)
          .eq('user_id', currentUser.id);

        if (error) throw error;
      } else {
        // Add RSVP (defaults to video; user can change from EventDetailView for hybrid events)
        const { error } = await supabase
          .from('meetup_signups')
          .insert({
            meetup_id: meetupId,
            user_id: currentUser.id,
            signup_type: 'video',
          });

        if (error) throw error;
      }

      // Reload data to update attendee counts
      invalidateQuery('discover-meetup-signups');
      invalidateQuery(`discover-user-rsvps-${currentUser.id}`);
    } catch (err) {
      console.error('Error handling RSVP:', err);
      toast?.error('Failed to update RSVP. Please try again.');
    } finally {
      setRsvpLoading(prev => ({ ...prev, [meetupId]: false }));
    }
  };


  const handleConnect = async (personId) => {
    if (!currentUser?.id || sentRequests.has(personId)) return;
    setSentRequests(prev => new Set(prev).add(personId));
    try {
      const { error } = await supabase
        .from('user_interests')
        .insert({
          user_id: currentUser.id,
          interested_in_user_id: personId,
        });
      if (error) {
        // If duplicate, keep the "Requested" state
        if (!error.message?.includes('duplicate')) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error sending connection request:', error);
      setSentRequests(prev => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
    }
  };

  const handleSupportRequest = async (requestId) => {
    try {
      const { error } = await supabase
        .from('meetup_request_supporters')
        .insert({
          request_id: requestId,
          user_id: currentUser.id
        });

      if (error && error.code !== '23505') {
        throw error;
      }

      await supabase.rpc('increment_request_supporters', { request_id: requestId });
      invalidateQuery('discover-meetup-requests');
    } catch (error) {
      console.error('Error supporting request:', error);
    }
  };

  const handleDeleteRequest = async (requestId) => {
    try {
      await supabase.from('meetup_request_supporters').delete().eq('request_id', requestId);
      await supabase.from('meetup_requests').delete().eq('id', requestId);
      setDeletingRequestId(null);
      invalidateQuery('discover-meetup-requests');
    } catch (error) {
      console.error('Error deleting request:', error);
    }
  };

  const handleHostRequest = async (request) => {
    if (onHostMeetup) {
      onHostMeetup({
        topic: request.topic,
        description: request.description,
        vibe_category: request.vibe_category
      });
    }
  };

  const handleSubmitRequest = async () => {
    if (!requestTopic.trim()) {
      toast?.error('Please enter a topic');
      return;
    }

    try {
      const { error } = await supabase
        .from('meetup_requests')
        .insert({
          user_id: currentUser.id,
          topic: requestTopic.trim(),
          description: requestDescription.trim() || null,
          vibe_category: requestVibe,
          status: 'open',
          supporter_count: 1
        });

      if (error) throw error;

      setShowRequestModal(false);
      setRequestTopic('');
      setRequestDescription('');
      setRequestVibe('grow');

      invalidateQuery('discover-meetup-requests');
      toast?.success('Request submitted! Others can now support your idea.');
    } catch (error) {
      console.error('Error submitting request:', error);
      toast?.error('Error submitting request: ' + error.message);
    }
  };

  // Filter meetups by vibe
  const filteredMeetups = selectedVibe
    ? meetups.filter(m => m.vibe_category === selectedVibe || !m.vibe_category)
    : meetups;

  // Get upcoming meetups (for Trending This Week - shows all events)
  const upcomingMeetups = filteredMeetups
    .filter(m => !isEventPast(m.date, m.time, m.timezone, parseInt(m.duration || '60')))
    .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

  // Community Events - only meetups without a circle (public events)
  const featuredMeetups = upcomingMeetups.filter(m => !m.circle_id).slice(0, 4);


  // Recommended meetups (non-RSVP'd only for "Community Events" section)
  const recommendedMeetups = upcomingMeetups.filter(m => !m.circle_id && !userRsvps.has(m.id)).slice(0, 4);

  // Format time for display
  const formatTime = (timeStr) => {
    if (!timeStr) return '7:00 PM';
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
      return timeStr;
    }
  };

  // Get recommended meetup based on vibe (only non-RSVP'd events)
  const getRecommendedContent = () => {
    const meetup = recommendedMeetups[0];

    const vibeContent = {
      advice: {
        title: meetup?.topic || 'Career Pivot AMA',
        subtitle: meetup?.description || 'Connect with experienced leaders',
        groupSize: `Small group (${meetup?.participant_limit || 8})`,
        matchReason: 'Advice',
      },
      peers: {
        title: meetup?.topic || 'Coffee Chat Meetup',
        subtitle: meetup?.description || 'Career transition support',
        groupSize: `Small group (${meetup?.participant_limit || 8})`,
        matchReason: 'Support',
      },
      grow: {
        title: meetup?.topic || 'Skills Workshop',
        subtitle: meetup?.description || 'Interactive learning session',
        groupSize: `Small group (${meetup?.participant_limit || 12})`,
        matchReason: 'Growth',
      },
    };

    const content = vibeContent[selectedVibe] || vibeContent.peers;

    return {
      ...content,
      date: meetup ? formatEventDate(meetup.date, meetup.time, meetup.timezone, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Thu, Feb 6',
      time: meetup ? formatEventTime(meetup.date, meetup.time, meetup.timezone) : '7:00 PM',
      location: meetup?.location || 'Virtual',
      spots: meetup ? Math.max(1, (meetup.participant_limit || 8) - (meetup.signups?.length || 0)) : 2,
      totalSpots: meetup?.participant_limit || 8,
      attendees: (meetup?.signups || []).slice(0, 3).map(s => ({
        name: s.user?.name || 'Member',
        emoji: '👩🏻'
      })),
      extraCount: Math.max(0, (meetup?.signups?.length || 0) - 3),
      meetupId: meetup?.id,
      isGroup: !meetup, // Only show as group if there's no actual meetup
    };
  };

  const recommendedContent = getRecommendedContent();

  if (loading && connectionGroups.length === 0) {
    return (
      <div style={{ padding: isMobile ? '16px' : '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ width: '220px', height: '24px', borderRadius: '8px', background: '#EDE6DF', marginBottom: '6px', animation: 'pulse 1.5s infinite' }} />
            <div style={{ width: '280px', height: '12px', borderRadius: '6px', background: '#F5EDE4', animation: 'pulse 1.5s infinite', animationDelay: '0.1s' }} />
          </div>
          <div style={{ width: '110px', height: '40px', borderRadius: '12px', background: '#EDE6DF', animation: 'pulse 1.5s infinite' }} />
        </div>
        {/* Trending requests skeleton */}
        <div style={{ width: '180px', height: '20px', borderRadius: '6px', background: '#EDE6DF', marginBottom: '12px', animation: 'pulse 1.5s infinite' }} />
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            padding: '14px 16px', marginBottom: '6px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(139,111,92,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            animation: 'pulse 1.5s infinite', animationDelay: `${i * 0.12}s`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#EDE6DF' }} />
              <div style={{ width: `${140 + i * 20}px`, height: '14px', borderRadius: '6px', background: '#EDE6DF' }} />
            </div>
            <div style={{ width: '70px', height: '32px', borderRadius: '8px', background: '#EDE6DF' }} />
          </div>
        ))}
        {/* Circles skeleton */}
        <div style={{ width: '160px', height: '20px', borderRadius: '6px', background: '#EDE6DF', margin: '24px 0 12px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(139,111,92,0.08)', display: 'flex', gap: '14px', animation: 'pulse 1.5s infinite', animationDelay: '0.15s' }}>
          <div style={{ width: '120px', height: '120px', borderRadius: '12px', background: '#EDE6DF', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '70%', height: '16px', borderRadius: '6px', background: '#EDE6DF', marginBottom: '8px' }} />
            <div style={{ width: '90%', height: '12px', borderRadius: '4px', background: '#F5EDE4', marginBottom: '6px' }} />
            <div style={{ width: '60%', height: '12px', borderRadius: '4px', background: '#F5EDE4' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fonts.sans, paddingBottom: '100px', maxWidth: '880px', margin: '0 auto' }}>

      {/* Community Events */}
      <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? '12px' : '16px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
                Community Events
              </h2>
              <p style={{ fontSize: isMobile ? '13px' : '14px', color: colors.textLight, margin: '4px 0 0' }}>
                Join conversations that matter to you
              </p>
            </div>
            <button
              onClick={() => onHostMeetup?.()}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'linear-gradient(135deg, #6B4226, #8B5E3C)',
                color: '#FFF', border: 'none',
                borderRadius: '12px', padding: '8px 14px',
                fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: fonts.sans, flexShrink: 0,
                boxShadow: '0 2px 8px rgba(107, 66, 38, 0.25)',
              }}
            >
              <Plus size={14} />
              Host yours
            </button>
          </div>

          {featuredMeetups.length === 0 ? (
            <div style={{
              backgroundColor: colors.cream,
              borderRadius: isMobile ? '14px' : '16px',
              border: `1px solid ${colors.border}`,
              padding: isMobile ? '28px 16px' : '32px 20px',
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: isMobile ? '14px' : '15px',
                color: colors.textLight,
                margin: '0 0 4px',
                lineHeight: '1.5',
              }}>
                No upcoming events yet
              </p>
              <p style={{
                fontSize: isMobile ? '12px' : '13px',
                color: colors.textMuted,
                margin: 0,
              }}>
                Have a topic in mind? Suggest it below and rally support!
              </p>
            </div>
          ) : (
          <div style={{
            display: 'flex',
            gap: isMobile ? '12px' : '14px',
            overflowX: 'auto',
            paddingBottom: '8px',
            marginLeft: isMobile ? '-16px' : '-24px',
            marginRight: isMobile ? '-16px' : '-24px',
            paddingLeft: isMobile ? '16px' : '24px',
            paddingRight: isMobile ? '16px' : '24px',
            WebkitOverflowScrolling: 'touch',
          }}>
            {featuredMeetups.map((meetup, index) => {
              const signups = meetupSignups[meetup.id] || [];
              const signupCount = signups.length;
              const hasUploadedImage = !!meetup.image_url;
              const fallbackGradient = [
                'linear-gradient(160deg, #6B4226 0%, #A0714F 50%, #C49A6C 100%)',
                'linear-gradient(160deg, #5C6B42 0%, #7A9455 50%, #A0B87A 100%)',
                'linear-gradient(160deg, #6B4266 0%, #945587 50%, #B87AA0 100%)',
                'linear-gradient(160deg, #42536B 0%, #557A94 50%, #7AA0B8 100%)',
                'linear-gradient(160deg, #6B5C42 0%, #947A55 50%, #B8A07A 100%)',
                'linear-gradient(160deg, #4A426B 0%, #6B5594 50%, #947AB8 100%)',
              ][index % 6];

              return (
                <div
                  key={meetup.id}
                  onClick={() => onNavigate?.('eventDetail', { meetupId: meetup.id })}
                  style={{
                    minWidth: isMobile ? '280px' : '310px',
                    borderRadius: isMobile ? '14px' : '16px',
                    overflow: 'hidden',
                    boxShadow: '0 3px 14px rgba(0, 0, 0, 0.12)',
                    flexShrink: 0,
                    cursor: 'pointer',
                    background: '#FAF7F4',
                    border: '1px solid rgba(139,111,92,0.08)',
                  }}>
                  {/* Image area */}
                  <div style={{
                    position: 'relative',
                    height: isMobile ? '170px' : '190px',
                    background: hasUploadedImage ? 'none' : fallbackGradient,
                  }}>
                    {hasUploadedImage && (
                      <>
                        <img src={meetup.image_url} alt="" style={{
                          position: 'absolute', inset: 0,
                          width: '100%', height: '100%', objectFit: 'cover', zIndex: 0,
                        }} />
                        <div style={{
                          position: 'absolute', inset: 0, zIndex: 1,
                          background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.7) 100%)',
                        }} />
                      </>
                    )}

                    {/* Frosted date pill — top left */}
                    <div style={{
                      position: 'absolute', top: isMobile ? '10px' : '12px', left: isMobile ? '10px' : '12px',
                      zIndex: 2,
                    }}>
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: isMobile ? '5px 12px' : '6px 14px',
                        background: 'rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)',
                        fontSize: isMobile ? '11px' : '12px', fontWeight: '600',
                        color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}>
                        <Calendar size={isMobile ? 11 : 12} />
                        {formatEventDate(meetup.date, meetup.time, meetup.timezone, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Title + time/location — bottom of image */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: isMobile ? '14px' : '16px',
                      zIndex: 2,
                    }}>
                      <h4 style={{
                        fontSize: isMobile ? '18px' : '20px', fontWeight: '700',
                        color: '#fff', margin: 0, fontFamily: fonts.serif,
                        lineHeight: '1.3', textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {meetup.topic}
                      </h4>
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        gap: isMobile ? '8px' : '10px', marginTop: '6px',
                        fontSize: isMobile ? '11px' : '12px',
                        color: 'rgba(255,255,255,0.85)',
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={isMobile ? 10 : 11} /> {formatEventTime(meetup.date, meetup.time, meetup.timezone)}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={isMobile ? 10 : 11} /> {
                            meetup.meeting_format === 'hybrid'
                              ? `${meetup.location} + Virtual`
                              : meetup.meeting_format === 'in_person'
                                ? meetup.location
                                : 'Virtual'
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom bar: avatars + going count + RSVP button */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: isMobile ? '10px 14px' : '12px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex', marginRight: '8px' }}>
                        {signups.slice(0, 3).map((signup, idx) => (
                          <div key={signup.user_id || idx} style={{
                            width: isMobile ? '26px' : '28px',
                            height: isMobile ? '26px' : '28px',
                            borderRadius: '50%',
                            backgroundColor: colors.primaryLight,
                            border: '2px solid #FAF7F4',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: isMobile ? '9px' : '10px', fontWeight: '600', color: 'white',
                            marginLeft: idx > 0 ? '-8px' : 0,
                            overflow: 'hidden',
                          }}>
                            {signup.profile?.profile_picture ? (
                              <img loading="lazy" src={signup.profile.profile_picture} alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              signup.profile?.name?.[0] || '?'
                            )}
                          </div>
                        ))}
                        {signupCount > 3 && (
                          <div style={{
                            width: isMobile ? '26px' : '28px',
                            height: isMobile ? '26px' : '28px',
                            borderRadius: '50%',
                            backgroundColor: '#E8DDD6',
                            border: '2px solid #FAF7F4',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: isMobile ? '8px' : '9px', fontWeight: '600', color: '#6B5344',
                            marginLeft: '-8px',
                          }}>
                            +{signupCount - 3}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontFamily: fonts.sans,
                        fontSize: isMobile ? '12px' : '13px', color: '#8B7355', fontWeight: '500',
                      }}>
                        {signupCount > 0 ? `${signupCount} going` : 'Be first!'}
                      </span>
                    </div>
                    {userRsvps.has(meetup.id) ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRsvp(meetup.id); }}
                        disabled={rsvpLoading[meetup.id]}
                        style={{
                          padding: isMobile ? '7px 16px' : '8px 20px',
                          backgroundColor: 'rgba(92,64,51,0.08)',
                          color: '#5C4033',
                          border: '1.5px solid rgba(92,64,51,0.2)',
                          borderRadius: '10px',
                          fontSize: isMobile ? '12px' : '13px', fontWeight: '600',
                          cursor: 'pointer', fontFamily: fonts.sans,
                          display: 'flex', alignItems: 'center', gap: '5px',
                        }}>
                        {rsvpLoading[meetup.id] ? '...' : <><Check size={isMobile ? 12 : 13} /> Going</>}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRsvp(meetup.id); }}
                        disabled={rsvpLoading[meetup.id]}
                        style={{
                          padding: isMobile ? '7px 16px' : '8px 20px',
                          backgroundColor: '#5C4033',
                          color: '#FAF5EF',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: isMobile ? '12px' : '13px', fontWeight: '600',
                          cursor: rsvpLoading[meetup.id] ? 'not-allowed' : 'pointer',
                          fontFamily: fonts.sans,
                        }}>
                        {rsvpLoading[meetup.id] ? '...' : 'Going'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
          )}
        </div>

      {/* Trending Requests — Ranking List */}
      {meetupRequests.length > 0 && (
        <div style={{
          marginBottom: isMobile ? '24px' : '32px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '14px' : '18px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600', color: '#3D2E1F', margin: 0, fontFamily: fonts.serif }}>
                Trending Requests
              </h2>
              <p style={{ fontSize: isMobile ? '13px' : '14px', color: '#7A6B5D', margin: '4px 0 0' }}>
                Most wanted topics — vote to make them happen
              </p>
            </div>
            <button
              onClick={() => setShowRequestModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'transparent', color: '#8B6914', border: '1.5px solid rgba(139, 105, 20, 0.25)',
                borderRadius: '12px', padding: '8px 14px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: fonts.sans, flexShrink: 0,
              }}
            >
              <Plus size={14} />
              Suggest
            </button>
          </div>

          <div style={{
            background: '#FFFBF5',
            borderRadius: meetupRequests.length > 3 ? '16px 16px 0 0' : '16px',
            border: '1px solid rgba(180, 140, 100, 0.12)',
            borderBottom: meetupRequests.length > 3 ? 'none' : undefined,
            boxShadow: meetupRequests.length > 3 ? 'none' : '0 2px 12px rgba(120, 80, 40, 0.06)',
            overflow: 'hidden',
            maxHeight: showAllRequests ? '400px' : 'none',
            overflowY: showAllRequests ? 'auto' : 'hidden',
          }}>
            {(showAllRequests ? meetupRequests : meetupRequests.slice(0, 3)).map((request, index) => {
              const vibeInfo = VIBE_CATEGORIES.find(v => v.id === request.vibe_category);
              const hasSupported = request.supporters?.some(s => s.user_id === currentUser?.id);
              const supporterCount = (request.supporters || []).length;
              const rank = index + 1;
              const rankColors = ['#C4956A', '#A0917A', '#B8A898'];
              const displayCount = showAllRequests ? meetupRequests.length : Math.min(meetupRequests.length, 3);

              return (
                <div
                  key={request.id}
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    gap: isMobile ? '10px' : '16px',
                    padding: isMobile ? '12px 14px' : '16px 20px',
                    borderBottom: index < displayCount - 1 ? '1px solid rgba(180, 140, 100, 0.08)' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(180, 140, 100, 0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Top row: rank + content */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', flex: 1, minWidth: 0 }}>
                    {/* Rank number */}
                    <div style={{
                      width: isMobile ? '26px' : '32px',
                      height: isMobile ? '26px' : '32px',
                      borderRadius: rank <= 3 ? '10px' : '8px',
                      background: rank <= 3 ? rankColors[index] : 'rgba(180, 140, 100, 0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isMobile ? '12px' : '14px',
                      fontWeight: 800,
                      color: rank <= 3 ? '#FFF' : '#8C7B6B',
                      flexShrink: 0,
                      fontFamily: fonts.sans,
                    }}>
                      {rank}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: isMobile ? '14px' : '16px',
                        fontWeight: 600,
                        color: '#3D2B1F',
                        lineHeight: 1.35,
                        fontFamily: fonts.serif,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {request.topic}
                      </div>
                      {vibeInfo && (
                        <div style={{ marginTop: '3px' }}>
                          <span style={{
                            fontSize: isMobile ? '10px' : '11px', fontWeight: 600, color: '#8B6914',
                            background: 'rgba(139, 105, 20, 0.08)',
                            padding: '2px 8px', borderRadius: '6px',
                            letterSpacing: '0.3px', textTransform: 'uppercase',
                          }}>
                            {vibeInfo.label}
                          </span>
                        </div>
                      )}
                      {supporterCount > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            {(request.supporters || []).slice(0, 3).map((s, idx) => (
                              <span key={s.user_id} style={{
                                width: isMobile ? 20 : 22, height: isMobile ? 20 : 22,
                                borderRadius: '50%', border: '1.5px solid #FBF7F0',
                                marginLeft: idx > 0 ? -6 : 0,
                                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: s.profile?.profile_picture ? 'none' : '#C4A97D',
                                fontSize: '10px', color: '#FFF', fontWeight: 600,
                                flexShrink: 0,
                              }}>
                                {s.profile?.profile_picture ? (
                                  <img loading="lazy" src={s.profile.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  (s.profile?.name || '?')[0].toUpperCase()
                                )}
                              </span>
                            ))}
                          </span>
                          <span style={{ fontSize: isMobile ? '11px' : '12px', color: '#8C7B6B', fontWeight: 500 }}>
                            {supporterCount} interested
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
                    ...(isMobile ? { justifyContent: 'flex-end', marginTop: '-4px' } : {}),
                  }}>
                    <button
                      onClick={() => !hasSupported && handleSupportRequest(request.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '5px',
                        background: hasSupported ? 'rgba(139, 105, 20, 0.08)' : 'linear-gradient(135deg, #6B4F1D, #8B6914)',
                        color: hasSupported ? '#8B6914' : '#FFF',
                        border: 'none', borderRadius: '10px',
                        padding: isMobile ? '8px 14px' : '8px 14px',
                        fontSize: isMobile ? '12px' : '13px', fontWeight: 600,
                        cursor: hasSupported ? 'default' : 'pointer',
                        boxShadow: hasSupported ? 'none' : '0 1px 4px rgba(139, 105, 20, 0.2)',
                        fontFamily: fonts.sans, whiteSpace: 'nowrap',
                        minHeight: '36px',
                      }}
                    >
                      {hasSupported ? <><Check size={13} /> Voted</> : <><ThumbsUp size={13} /> Vote</>}
                    </button>
                    <button
                      onClick={() => handleHostRequest(request)}
                      title="Volunteer to host this discussion"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '4px',
                        background: 'transparent', color: '#6B4F1D',
                        border: '1.5px solid rgba(139, 105, 20, 0.2)',
                        borderRadius: '10px', padding: isMobile ? '8px 14px' : '7px 12px',
                        fontSize: isMobile ? '12px' : '13px', fontWeight: 600,
                        cursor: 'pointer', fontFamily: fonts.sans, whiteSpace: 'nowrap',
                        minHeight: '36px',
                      }}
                    >
                      <Users size={13} /> Host
                    </button>
                    {currentUser?.role === 'admin' && (
                      <button
                        onClick={() => setDeletingRequestId(request.id)}
                        title="Remove request (admin)"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: isMobile ? '28px' : '32px', height: isMobile ? '28px' : '32px',
                          background: 'transparent', color: '#B0867A',
                          border: '1.5px solid rgba(176, 134, 122, 0.2)',
                          borderRadius: '8px',
                          fontSize: isMobile ? '12px' : '14px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(232, 93, 74, 0.08)'; e.currentTarget.style.color = '#E85D4A'; e.currentTarget.style.borderColor = 'rgba(232, 93, 74, 0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#B0867A'; e.currentTarget.style.borderColor = 'rgba(176, 134, 122, 0.2)'; }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
          {/* See all / Show less toggle — outside scroll container */}
          {meetupRequests.length > 3 && (
            <button
              onClick={() => setShowAllRequests(!showAllRequests)}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '12px 20px',
                background: '#FFFBF5',
                color: '#8B6914',
                border: '1px solid rgba(180, 140, 100, 0.12)',
                borderTop: 'none',
                borderRadius: '0 0 16px 16px',
                fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: fonts.sans,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(180, 140, 100, 0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFBF5'; }}
            >
              {showAllRequests ? 'Show less' : `See all ${meetupRequests.length} requests`}
              <span style={{
                display: 'inline-block',
                transition: 'transform 0.2s ease',
                transform: showAllRequests ? 'rotate(180deg)' : 'rotate(0deg)',
                fontSize: '11px',
              }}>&#9660;</span>
            </button>
          )}
        </div>
      )}

      {/* Admin delete request confirmation */}
      {deletingRequestId && (() => {
        const request = meetupRequests.find(r => r.id === deletingRequestId);
        return (
          <div
            onClick={() => setDeletingRequestId(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white', borderRadius: '20px',
                padding: isMobile ? '24px' : '28px',
                maxWidth: '380px', width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              }}
            >
              <h3 style={{
                fontSize: '18px', fontWeight: 700, color: '#3D2B1F',
                margin: '0 0 8px', fontFamily: fonts.serif,
              }}>
                Remove Request
              </h3>
              <p style={{
                fontSize: '14px', color: '#7A6B5D', margin: '0 0 6px', lineHeight: 1.5,
              }}>
                Are you sure you want to remove this request?
              </p>
              {request && (
                <div style={{
                  fontSize: '15px', fontWeight: 600, color: '#3D2B1F',
                  background: 'rgba(180, 140, 100, 0.08)', borderRadius: '10px',
                  padding: '10px 14px', margin: '12px 0 20px',
                  fontFamily: fonts.serif,
                }}>
                  "{request.topic}"
                </div>
              )}
              <p style={{
                fontSize: '13px', color: '#A0917A', margin: '0 0 20px',
              }}>
                This will also remove all supporter votes. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setDeletingRequestId(null)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px',
                    background: 'rgba(180, 140, 100, 0.08)', color: '#6B5C42',
                    border: 'none', fontSize: '14px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: fonts.sans,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteRequest(deletingRequestId)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px',
                    background: '#E85D4A', color: 'white',
                    border: 'none', fontSize: '14px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: fonts.sans,
                    boxShadow: '0 2px 8px rgba(232, 93, 74, 0.3)',
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Intimate Circles */}
      {(() => {
        const availableCircles = scoredAvailableCircles;

        const circleGradients = [
          'linear-gradient(160deg, #6B4226 0%, #A0714F 50%, #C49A6C 100%)',
          'linear-gradient(160deg, #5C6B42 0%, #7A9455 50%, #A0B87A 100%)',
          'linear-gradient(160deg, #6B4266 0%, #945587 50%, #B87AA0 100%)',
          'linear-gradient(160deg, #42536B 0%, #557A94 50%, #7AA0B8 100%)',
          'linear-gradient(160deg, #6B5C42 0%, #947A55 50%, #B8A07A 100%)',
          'linear-gradient(160deg, #4A426B 0%, #6B5594 50%, #947AB8 100%)',
        ];

        const avatarColors = ['#8B5E3C', '#A0714F', '#6B4226', '#C49A6C'];

        const expandedCircle = expandedCircleId
          ? availableCircles.find(c => c.id === expandedCircleId)
          : null;

        // Show full-width prompt when no circles available
        if (availableCircles.length === 0) {
          return (
            <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '12px' : '16px' }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
                    Intimate Circles
                  </h2>
                  <p style={{ fontSize: isMobile ? '13px' : '14px', color: colors.textLight, margin: '4px 0 0' }}>
                    Small groups built on real connections
                  </p>
                </div>
                <button
                  onClick={() => onNavigate?.('allCircles')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'none',
                    border: 'none',
                    color: colors.primary,
                    fontSize: isMobile ? '13px' : '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}>
                  See all <ChevronRight size={isMobile ? 12 : 14} />
                </button>
              </div>

            </div>
          );
        }

        return (
          <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '12px' : '16px' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
                  Intimate Circles
                </h2>
                <p style={{ fontSize: isMobile ? '13px' : '14px', color: colors.textLight, margin: '4px 0 0' }}>
                  Small groups built on real connections
                </p>
              </div>
              <button
                onClick={() => onNavigate?.('allCircles')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: colors.primary,
                  fontSize: isMobile ? '13px' : '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}>
                See all <ChevronRight size={isMobile ? 12 : 14} />
              </button>
            </div>

            {/* Circle cards — vertical list */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {availableCircles.slice(0, 3).map((circle, index) => {
                const memberCount = circle.members?.length || 0;
                const maxMembers = circle.max_members || 10;
                const spotsLeft = maxMembers - memberCount;
                const isInviteOnly = !!circle.is_private;
                const description = circle.description
                  || (circle.vibe_category === 'advice' ? 'Mentorship & guidance'
                  : circle.vibe_category === 'peers' ? 'Peer support & community'
                  : circle.vibe_category === 'grow' ? 'Career growth & skills'
                  : 'Connect & grow together');

                const creator = circle.members?.find(m => m.user_id === circle.creator_id);
                const creatorName = creator?.user?.name || 'CircleW';

                const cadence = circle.cadence || '';
                const meetingDay = circle.meeting_day || '';
                const timeOfDay = circle.time_of_day || '';
                const scheduleStr = [meetingDay, timeOfDay, cadence ? `Every ${cadence.toLowerCase()}` : ''].filter(Boolean).join(' · ');

                // Generate tags from vibe, name, and description
                const tags = [];
                if (circle.vibe_category) {
                  const vibeLabels = { advice: 'Mentorship', vent: 'Support', grow: 'Growth' };
                  tags.push(vibeLabels[circle.vibe_category] || circle.vibe_category);
                }
                const text = `${circle.name || ''} ${description}`.toLowerCase();
                const tagKeywords = [
                  { keywords: ['founder', 'startup', 'bootstrap'], tag: 'Founders' },
                  { keywords: ['early-stage', 'early stage', 'seed', 'pre-seed'], tag: 'Early-stage' },
                  { keywords: ['accountability', 'accountable'], tag: 'Accountability' },
                  { keywords: ['ai', 'machine learning', 'ml'], tag: 'AI' },
                  { keywords: ['product', 'pm', 'build'], tag: 'Product' },
                  { keywords: ['design', 'ux', 'ui', 'creative'], tag: 'Design' },
                  { keywords: ['career', 'job', 'interview', 'transition'], tag: 'Career' },
                  { keywords: ['book', 'reading', 'read'], tag: 'Reading' },
                  { keywords: ['leader', 'manage', 'executive', 'ceo', 'cto'], tag: 'Leadership' },
                  { keywords: ['wellness', 'mental', 'burnout', 'balance'], tag: 'Wellness' },
                  { keywords: ['marketing', 'growth', 'content', 'seo'], tag: 'Marketing' },
                  { keywords: ['engineer', 'coding', 'tech', 'developer'], tag: 'Tech' },
                  { keywords: ['network', 'community', 'connect'], tag: 'Community' },
                  { keywords: ['side project', 'hack', 'indie'], tag: 'Side Projects' },
                  { keywords: ['fundrais', 'investor', 'venture', 'pitch'], tag: 'Fundraising' },
                  { keywords: ['lesson', 'learn', 'skill'], tag: 'Lessons' },
                ];
                tagKeywords.forEach(({ keywords, tag }) => {
                  if (!tags.includes(tag) && keywords.some(kw => text.includes(kw))) {
                    tags.push(tag);
                  }
                });
                // Limit to 3 tags
                const displayTags = tags.slice(0, 3);

                return (
                  <div
                    key={circle.id}
                    onClick={() => onNavigate?.('circleDetail', { circleId: circle.id })}
                    style={{
                      background: '#FAF7F4', borderRadius: isMobile ? '14px' : '22px',
                      border: '1px solid #E8DDD6',
                      boxShadow: '0 4px 24px rgba(61,46,34,0.11)',
                      overflow: 'hidden', display: 'flex', alignItems: 'stretch',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(61,46,34,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(61,46,34,0.11)'; }}
                  >
                    {/* Left: image or SVG */}
                    <div style={{
                      width: isMobile ? '100px' : '160px', flexShrink: 0,
                      position: 'relative', overflow: 'hidden',
                    }}>
                      {circle.image_url ? (
                        <img src={circle.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <svg viewBox="0 0 110 190" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
                          <rect width="110" height="190" fill="#2C1F15"/>
                          <circle cx="55" cy="95" r="60" fill="#E8C070" opacity="0.06"/>
                          <circle cx="55" cy="95" r="38" fill="#E8C070" opacity="0.07"/>
                          <circle cx="55" cy="95" r="50" fill="none" stroke="#5C3D20" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.6"/>
                          <ellipse cx="55" cy="98" rx="34" ry="22" fill="#5C3D20"/>
                          <ellipse cx="55" cy="98" rx="34" ry="22" fill="none" stroke="#7A5230" strokeWidth="1.5"/>
                          <ellipse cx="55" cy="50" rx="7" ry="7" fill="#C4956A"/>
                          <rect x="48" y="55" width="14" height="10" rx="5" fill="#C4956A"/>
                          <ellipse cx="88" cy="77" rx="6" ry="6" fill="#A0724A"/>
                          <rect x="82" y="82" width="12" height="9" rx="4" fill="#A0724A"/>
                          <ellipse cx="23" cy="77" rx="6" ry="6" fill="#D4A878"/>
                          <rect x="17" y="82" width="12" height="9" rx="4" fill="#D4A878"/>
                          <ellipse cx="79" cy="132" rx="6" ry="6" fill="#D4A878"/>
                          <rect x="73" y="137" width="12" height="9" rx="4" fill="#D4A878"/>
                          <ellipse cx="31" cy="132" rx="6" ry="6" fill="#C4956A"/>
                          <rect x="25" y="137" width="12" height="9" rx="4" fill="#C4956A"/>
                          <circle cx="55" cy="33" r="3" fill="#E8C070" opacity="0.9"/>
                          <circle cx="94" cy="59" r="2.5" fill="#E8C070" opacity="0.75"/>
                          <circle cx="16" cy="59" r="2.5" fill="#E8C070" opacity="0.75"/>
                        </svg>
                      )}
                    </div>

                    {/* Right: content */}
                    <div style={{
                      flex: 1, padding: isMobile ? '10px 12px' : '14px 16px',
                      display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px', minWidth: 0,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                          padding: isMobile ? '2px 7px' : '3px 9px', borderRadius: '20px',
                          background: '#E8F5E9', border: '1px solid #B8DFC0',
                          fontSize: isMobile ? '9px' : '10.5px', fontWeight: '600', color: '#2E6B40',
                        }}>
                          {!isInviteOnly && <span style={{ width: isMobile ? 5 : 6, height: isMobile ? 5 : 6, borderRadius: '50%', background: '#22c55e' }} />}
                          {isInviteOnly ? 'Invite Only' : 'Open'}
                        </span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                          padding: isMobile ? '2px 7px' : '3px 9px', borderRadius: '20px',
                          background: '#F0E8DF', border: '1px solid #E0D0BE',
                          fontSize: isMobile ? '9px' : '10.5px', fontWeight: '600', color: '#6B4F35',
                        }}>
                          <Users size={isMobile ? 9 : 11} /> {memberCount}/{maxMembers}
                        </span>
                      </div>

                      <div>
                        <h4 style={{
                          fontSize: isMobile ? '13px' : '15px', fontWeight: '700',
                          color: '#2C1F15', margin: 0, fontFamily: fonts.serif,
                          lineHeight: '1.25', letterSpacing: '-0.2px',
                        }}>
                          {circle.name}
                        </h4>
                        {scheduleStr && (
                          <p style={{ fontSize: isMobile ? '10px' : '12px', fontWeight: '600', color: '#6B5344', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={isMobile ? 10 : 12} style={{ flexShrink: 0 }} /> {scheduleStr}
                          </p>
                        )}
                      </div>

                      <p style={{
                        fontSize: isMobile ? '11px' : '12px', color: '#8B7355', margin: 0, lineHeight: '1.5',
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {description}
                      </p>

                      {displayTags.length > 0 && (
                        <div style={{ display: 'flex', gap: isMobile ? '4px' : '5px', flexWrap: 'wrap' }}>
                          {displayTags.map((tag, i) => (
                            <span key={i} style={{
                              fontSize: isMobile ? '9px' : '10.5px', fontWeight: '500', color: '#6B4F35',
                              background: '#F0E8DF', border: '1px solid #E0D0BE',
                              padding: isMobile ? '1px 7px' : '2px 9px', borderRadius: '10px',
                            }}>{tag}</span>
                          ))}
                        </div>
                      )}

                      {/* Member avatars + spots */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '6px' }}>
                        {memberCount > 0 && (
                          <div style={{ display: 'flex' }}>
                            {circle.members?.slice(0, isMobile ? 3 : 4).map((member, idx) => {
                              const avatarBgs = ['#E8D5C0', '#D4C4A8', '#C4956A', '#A0724A'];
                              const avSize = isMobile ? '18px' : '22px';
                              return (
                                <div key={member.id || idx} style={{
                                  width: avSize, height: avSize, borderRadius: '50%',
                                  background: avatarBgs[idx % avatarBgs.length],
                                  border: '1.5px solid #FAF7F4',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: isMobile ? '7px' : '9px', fontWeight: '600', color: '#5C3318',
                                  marginLeft: idx > 0 ? (isMobile ? '-5px' : '-6px') : 0, flexShrink: 0,
                                  overflow: 'hidden',
                                }}>
                                  {member.user?.profile_picture ? (
                                    <img loading="lazy" src={member.user.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    member.user?.name?.charAt(0) || '?'
                                  )}
                                </div>
                              );
                            })}
                            {memberCount > (isMobile ? 3 : 4) && (
                              <div style={{
                                width: isMobile ? '18px' : '22px', height: isMobile ? '18px' : '22px', borderRadius: '50%',
                                background: '#F0E8DF', border: '1.5px solid #FAF7F4',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: isMobile ? '7px' : '8px', fontWeight: '600', color: '#6B4F35',
                                marginLeft: isMobile ? '-5px' : '-6px',
                              }}>+{memberCount - (isMobile ? 3 : 4)}</div>
                            )}
                          </div>
                        )}
                        <span style={{ fontSize: isMobile ? '9px' : '10px', color: '#A07850' }}>{spotsLeft} left</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: isMobile ? '9px' : '10px', color: '#B09A8A' }}>by {creatorName.split(' ')[0]}</span>
                      </div>

                      <div style={{ height: '1px', background: '#EDE6DF' }} />

                      {/* Bottom row: host + Join button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '6px' }}>
                        <div style={{
                          width: isMobile ? '18px' : '22px', height: isMobile ? '18px' : '22px', borderRadius: '50%',
                          background: '#E8D5C0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: isMobile ? '8px' : '9.5px', fontWeight: '600', color: '#5C3318', flexShrink: 0,
                          overflow: 'hidden',
                        }}>
                          {creator?.user?.profile_picture ? (
                            <img loading="lazy" src={creator.user.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : creatorName.charAt(0)}
                        </div>
                        <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '500', color: '#6B4F35' }}>{creatorName.split(' ')[0]}</span>
                        <span style={{ fontSize: isMobile ? '9px' : '10px', color: '#B09A8A' }}>{'\u00b7'} host</span>
                        <span style={{ flex: 1 }} />
                        {(() => {
                          const joinState = circleJoinState[circle.id] || 'idle';
                          const isDone = joinState === 'joined' || joinState === 'requested';
                          return (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (isDone) return;
                                setCircleJoinState(prev => ({ ...prev, [circle.id]: 'loading' }));
                                try {
                                  const result = await requestToJoinGroup(supabase, circle.id, currentUser.id);
                                  if (result.success) {
                                    setCircleJoinState(prev => ({ ...prev, [circle.id]: 'requested' }));
                                    invalidateQuery('discover-connection-groups');
                                    toast?.success('Request sent!');
                                  } else {
                                    const errMsg = typeof result.error === 'string' ? result.error : result.error?.message || String(result.error || '');
                                    setCircleJoinState(prev => ({ ...prev, [circle.id]: errMsg.includes('Already') ? 'joined' : 'idle' }));
                                    if (errMsg && !errMsg.includes('Already')) toast?.error(errMsg);
                                  }
                                } catch (err) {
                                  setCircleJoinState(prev => ({ ...prev, [circle.id]: 'idle' }));
                                  toast?.error('Failed to join');
                                }
                              }}
                              disabled={joinState === 'loading'}
                              style={{
                                padding: isMobile ? '5px 12px' : '6px 14px', borderRadius: '14px',
                                fontSize: isMobile ? '10px' : '11.5px', fontWeight: '600',
                                cursor: isDone ? 'default' : joinState === 'loading' ? 'wait' : 'pointer',
                                fontFamily: fonts.sans,
                                background: isDone ? '#5A8A4A' : '#3D2E22',
                                color: '#FAF7F4',
                                border: 'none', transition: 'background 0.15s',
                                opacity: joinState === 'loading' ? 0.7 : 1,
                              }}
                              onMouseEnter={e => { if (!isDone) e.currentTarget.style.background = '#2C1F15' }}
                              onMouseLeave={e => { if (!isDone) e.currentTarget.style.background = isDone ? '#5A8A4A' : '#3D2E22' }}
                            >
                              {joinState === 'loading' ? '...'
                                : joinState === 'joined' ? 'Joined ✓'
                                : joinState === 'requested' ? 'Requested ✓'
                                : isInviteOnly ? 'Request' : 'Join'}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}


              {/* Create Circle Card */}
              <div
                onClick={() => onNavigate?.('createCircle')}
                style={{
                  borderRadius: isMobile ? '14px' : '16px',
                  cursor: 'pointer',
                  background: '#F5EDE4',
                  border: '1.5px dashed #C4A882',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: isMobile ? '14px 16px' : '16px 20px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#EDE3D7' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F5EDE4' }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  backgroundColor: '#D8CFC6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Plus size={18} style={{ color: '#6B4226' }} />
                </div>
                <div>
                  <h4 style={{
                    fontSize: '14px', fontWeight: '600', color: '#3E2C1E',
                    margin: 0, fontFamily: fonts.serif,
                  }}>
                    Start your own Circle
                  </h4>
                  <p style={{ fontSize: '11px', color: '#7A6855', margin: '2px 0 0' }}>
                    6-10 women, weekly
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* Floating Action Button */}
      <div style={{
        position: 'fixed',
        bottom: isMobile ? '90px' : '100px',
        right: isMobile ? '16px' : '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '12px',
        zIndex: 50,
      }}>
        <button
          onClick={() => onHostMeetup ? onHostMeetup() : setShowRequestModal(true)}
          style={{
            width: isMobile ? '50px' : '56px',
            height: isMobile ? '50px' : '56px',
            borderRadius: '50%',
            border: 'none',
            background: colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(139, 111, 92, 0.35)',
            cursor: 'pointer',
            color: 'white',
            fontSize: isMobile ? '24px' : '28px',
            fontWeight: '300',
          }}>
          +
        </button>
      </div>

      {/* Request Meetup Modal */}
      {showRequestModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: isMobile ? '0' : '16px',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: isMobile ? '20px 20px 0 0' : '20px',
            maxWidth: '400px',
            width: '100%',
            padding: isMobile ? '20px 16px 32px' : '24px',
            maxHeight: isMobile ? '85vh' : '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '14px' : '16px' }}>
              <h3 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
                Request a Meetup
              </h3>
              <button
                onClick={() => setShowRequestModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: colors.textLight,
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: isMobile ? '13px' : '14px', color: colors.textLight, marginBottom: isMobile ? '16px' : '20px' }}>
              Suggest a topic you'd like to see. Others can support your idea!
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
                Topic *
              </label>
              <input
                type="text"
                value={requestTopic}
                onChange={(e) => setRequestTopic(e.target.value)}
                placeholder="e.g., Career Transition Support Group"
                style={{
                  width: '100%',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  padding: isMobile ? '10px 12px' : '12px',
                  fontSize: isMobile ? '14px' : '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                maxLength={200}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
                What vibe is this?
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {VIBE_CATEGORIES.map((vibe) => {
                  const isSelected = requestVibe === vibe.id;
                  return (
                    <button
                      key={vibe.id}
                      type="button"
                      onClick={() => setRequestVibe(vibe.id)}
                      style={{
                        flex: 1,
                        padding: isMobile ? '8px' : '10px',
                        borderRadius: '10px',
                        border: isSelected ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                        backgroundColor: isSelected ? `${colors.primary}15` : 'white',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: isMobile ? '16px' : '18px', display: 'block', marginBottom: '4px' }}>{vibe.emoji}</span>
                      <span style={{ fontSize: isMobile ? '10px' : '11px', color: isSelected ? colors.primary : colors.textLight }}>
                        {vibe.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: isMobile ? '16px' : '20px' }}>
              <label style={{ display: 'block', fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
                Description (Optional)
              </label>
              <textarea
                value={requestDescription}
                onChange={(e) => setRequestDescription(e.target.value)}
                placeholder="Tell us more about what you're looking for..."
                style={{
                  width: '100%',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  padding: isMobile ? '10px 12px' : '12px',
                  fontSize: isMobile ? '14px' : '14px',
                  height: isMobile ? '70px' : '80px',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                maxLength={500}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowRequestModal(false)}
                style={{
                  flex: 1,
                  padding: isMobile ? '11px' : '12px',
                  backgroundColor: colors.cream,
                  color: colors.text,
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={!requestTopic.trim()}
                style={{
                  flex: 1,
                  padding: isMobile ? '11px' : '12px',
                  backgroundColor: requestTopic.trim() ? colors.primary : colors.border,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: requestTopic.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Hide scrollbar for horizontal scroll areas */
        div::-webkit-scrollbar {
          height: 0;
          width: 0;
        }

        /* Smooth scrolling on iOS */
        @supports (-webkit-overflow-scrolling: touch) {
          div {
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
    </div>
  );
}

// components/CircleDetailView.js
// Detailed view for a single circle with full info and actions
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Users, Calendar, Clock, MapPin, MessageCircle, Video, Settings, LogOut, X, Edit3, Trash2, Check, UserPlus, Plus, FileText } from 'lucide-react';
import { parseLocalDate } from '../lib/dateUtils';
import {
  getOrCreateCircleMeetups,
  getUserRSVPStatus,
  rsvpToMeetup,
  cancelRSVP,
  calculateUpcomingDates,
  deleteCircleMeetup,
  deleteAllFutureCircleMeetups,
} from '@/lib/circleMeetupHelpers';

// Color palette
const colors = {
  primary: '#8B6F5C',
  primaryDark: '#6B5344',
  primaryLight: '#A89080',
  cream: '#FDF8F3',
  warmWhite: '#FFFAF5',
  text: '#4A3728',
  textLight: '#7A6855',
  textMuted: '#A89080',
  border: '#EDE6DF',
  success: '#4CAF50',
  warning: '#FFB74D',
};

const fonts = {
  serif: "'Playfair Display', Georgia, serif",
  sans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// Circle visual data
const CIRCLE_EMOJIS = ['🦋', '👩‍💻', '🧘‍♀️', '🚀', '🎨', '💰', '📚', '👶', '💫', '🌸'];
const CIRCLE_GRADIENTS = [
  'linear-gradient(135deg, #E8D5C4 0%, #D4C4B0 100%)',
  'linear-gradient(135deg, #D4E5F7 0%, #B8D4E8 100%)',
  'linear-gradient(135deg, #E5F0E5 0%, #C8DEC8 100%)',
  'linear-gradient(135deg, #F5E6D3 0%, #E8D4BC 100%)',
  'linear-gradient(135deg, #F5E0E5 0%, #E8CCD4 100%)',
  'linear-gradient(135deg, #E5E8D4 0%, #D4D8C0 100%)',
  'linear-gradient(135deg, #F0E6F5 0%, #DED0E8 100%)',
  'linear-gradient(135deg, #FCE4EC 0%, #F8BBD9 100%)',
];

const CATEGORY_LABELS = {
  advice: { label: 'Get Advice', emoji: '💡' },
  vent: { label: 'Find Support', emoji: '🤝' },
  grow: { label: 'Career Growth', emoji: '🚀' },
  peers: { label: 'Peer Support', emoji: '💜' },
};

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

export default function CircleDetailView({
  currentUser,
  supabase,
  onNavigate,
  circleId,
  previousView,
}) {
  const [circle, setCircle] = useState(null);
  const [members, setMembers] = useState([]);
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    location: '',
    vibe_category: '',
  });
  const [saving, setSaving] = useState(false);
  const [circleMeetups, setCircleMeetups] = useState([]);
  const [userRSVPs, setUserRSVPs] = useState({});
  const [rsvpLoading, setRsvpLoading] = useState({});
  const [useFallbackDates, setUseFallbackDates] = useState(false);
  const [pastMeetups, setPastMeetups] = useState([]);
  const [showAllPast, setShowAllPast] = useState(false);
  const [recapMap, setRecapMap] = useState({});
  const [editingCircleMeetup, setEditingCircleMeetup] = useState(null);
  const [showEditCircleMeetupModal, setShowEditCircleMeetupModal] = useState(false);
  const [deletingCircleMeetupId, setDeletingCircleMeetupId] = useState(null);
  const [showDeleteCircleMeetupConfirm, setShowDeleteCircleMeetupConfirm] = useState(false);
  const [deleteAllFuture, setDeleteAllFuture] = useState(false);
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitableConnections, setInvitableConnections] = useState([]);
  const [selectedInvites, setSelectedInvites] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 480;

  // Determine user's relationship to circle
  const membership = members.find(m => m.user_id === currentUser?.id);
  const isMember = membership?.status === 'accepted';
  const isPending = membership?.status === 'invited';
  const isHost = circle?.creator_id === currentUser?.id;
  const memberCount = members.filter(m => m.status === 'accepted').length;
  const maxMembers = circle?.max_members || 10;
  const spotsLeft = maxMembers - memberCount;
  const isFull = spotsLeft <= 0;

  useEffect(() => {
    console.log('🔵 CircleDetailView mounted, circleId:', circleId);
    if (circleId) {
      loadCircleDetails();
    }
  }, [circleId]);

  const loadCircleDetails = async () => {
    setLoading(true);
    try {
      // Fetch circle data and members in parallel (both only need circleId)
      const [circleResult, membersResult] = await Promise.all([
        supabase
          .from('connection_groups')
          .select('*')
          .eq('id', circleId)
          .single(),
        supabase
          .from('connection_group_members')
          .select('id, user_id, status, invited_at, responded_at')
          .eq('group_id', circleId),
      ]);

      if (circleResult.error) throw circleResult.error;
      const circleData = circleResult.data;
      setCircle(circleData);

      if (membersResult.error) throw membersResult.error;
      const membersData = membersResult.data;

      // Fetch member profiles, host profile, and meetups in parallel
      const memberUserIds = membersData?.map(m => m.user_id) || [];
      const profilesPromise = memberUserIds.length > 0
        ? supabase
            .from('profiles')
            .select('id, name, career, profile_picture, city, state')
            .in('id', memberUserIds)
        : Promise.resolve({ data: [] });

      const hostPromise = circleData?.creator_id
        ? supabase
            .from('profiles')
            .select('id, name, career, profile_picture')
            .eq('id', circleData.creator_id)
            .single()
        : Promise.resolve({ data: null });

      const meetupsPromise = loadCircleMeetups(circleData);

      const [profilesResult, hostResult] = await Promise.all([
        profilesPromise,
        hostPromise,
        meetupsPromise,
      ]);

      // Process member profiles
      const profileMap = (profilesResult.data || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});
      const enrichedMembers = membersData.map(m => ({
        ...m,
        profile: profileMap[m.user_id] || {},
      }));
      setMembers(enrichedMembers);

      // Set host
      if (hostResult.data) {
        setHost(hostResult.data);
      }
    } catch (error) {
      console.error('Error loading circle details:', error);
    } finally {
      setLoading(false);
    }
  };

  const openInviteModal = async () => {
    try {
      // Get current user's connections via mutual matches
      const { data: matches, error: connError } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id });

      if (connError) throw connError;

      const connectedUserIds = (matches || []).map(m => m.matched_user_id);

      // Exclude users already in this circle (any status)
      const existingMemberIds = new Set(members.map(m => m.user_id));
      const invitableIds = connectedUserIds.filter(id => !existingMemberIds.has(id));

      if (invitableIds.length === 0) {
        setInvitableConnections([]);
        setShowInviteModal(true);
        return;
      }

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, career, profile_picture')
        .in('id', invitableIds);

      setInvitableConnections(profiles || []);
      setSelectedInvites([]);
      setShowInviteModal(true);
    } catch (err) {
      console.error('Error loading invitable connections:', err);
    }
  };

  const handleSendInvites = async () => {
    if (selectedInvites.length === 0) return;

    // Check max members
    if (memberCount + selectedInvites.length > maxMembers) {
      alert(`This circle can have at most ${maxMembers} members. Only ${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left.`);
      return;
    }

    setInviteLoading(true);
    try {
      const inserts = selectedInvites.map(userId => ({
        group_id: circleId,
        user_id: userId,
        status: 'invited',
      }));

      const { error } = await supabase
        .from('connection_group_members')
        .insert(inserts);

      if (error) throw error;

      setShowInviteModal(false);
      setSelectedInvites([]);
      loadCircleDetails();
    } catch (err) {
      console.error('Error sending invites:', err);
      alert('Failed to send invites. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  const loadCircleMeetups = async (circleData) => {
    if (!circleData) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const channelName = `connection-group-${circleId}`;

      // Run all independent queries in parallel
      const [meetupsResult, pastResult, recapResult] = await Promise.all([
        getOrCreateCircleMeetups(circleId, circleData, 4),
        supabase
          .from('meetups')
          .select('id, topic, date, time, location, duration, participant_limit, status')
          .eq('circle_id', circleId)
          .lt('date', today)
          .not('status', 'eq', 'cancelled')
          .order('date', { ascending: false })
          .limit(10),
        supabase
          .from('call_recaps')
          .select('id, channel_name, created_at, started_at')
          .eq('channel_name', channelName)
          .order('created_at', { ascending: false }),
      ]);

      // Process future meetups
      const { meetups, needsMigration } = meetupsResult;
      if (needsMigration) {
        setUseFallbackDates(true);
        setCircleMeetups([]);
      } else {
        setUseFallbackDates(false);
        setCircleMeetups(meetups);

        // Load user's RSVP status (depends on meetups result)
        if (meetups.length > 0) {
          const meetupIds = meetups.map(m => m.id);
          const rsvpStatus = await getUserRSVPStatus(meetupIds);
          setUserRSVPs(rsvpStatus);
        }
      }

      // Process past meetups
      const pastData = pastResult.data;
      if (pastData && pastData.length > 0) {
        // Get attendee counts (depends on pastData IDs)
        const pastIds = pastData.map(m => m.id);
        const { data: pastSignups } = await supabase
          .from('meetup_signups')
          .select('meetup_id')
          .in('meetup_id', pastIds);

        const countByMeetup = {};
        (pastSignups || []).forEach(s => {
          countByMeetup[s.meetup_id] = (countByMeetup[s.meetup_id] || 0) + 1;
        });

        const enrichedPast = pastData.map(m => ({
          ...m,
          attendeeCount: countByMeetup[m.id] || 0,
        }));
        setPastMeetups(enrichedPast);

        // Match recaps to past meetups
        const recapData = recapResult.data;
        if (recapResult.error) {
          console.warn('Could not fetch circle recaps:', recapResult.error.message);
        }

        if (recapData && recapData.length > 0) {
          const rMap = {};
          const usedRecaps = new Set();

          // Build a lookup map from recaps: local date string -> recap
          const recapsByDate = new Map();
          recapData.forEach(r => {
            const recapTime = new Date(r.started_at || r.created_at);
            const dateStr = `${recapTime.getFullYear()}-${String(recapTime.getMonth() + 1).padStart(2, '0')}-${String(recapTime.getDate()).padStart(2, '0')}`;
            if (!recapsByDate.has(dateStr)) {
              recapsByDate.set(dateStr, []);
            }
            recapsByDate.get(dateStr).push(r);
          });

          // Pass 1: strict match (same day) using Map for O(1) lookup
          enrichedPast.forEach(meetup => {
            const candidates = recapsByDate.get(meetup.date) || [];
            const match = candidates.find(r => !usedRecaps.has(r.id));
            if (match) {
              rMap[meetup.id] = match.id;
              usedRecaps.add(match.id);
            }
          });

          // Pass 2: wider match (within 2 days) for unmatched meetups only
          enrichedPast.forEach(meetup => {
            if (rMap[meetup.id]) return;
            const meetupMs = new Date(meetup.date + 'T00:00:00').getTime();
            const matchingRecap = recapData.find(r => {
              if (usedRecaps.has(r.id)) return false;
              const recapTime = new Date(r.started_at || r.created_at);
              const recapDateStr = `${recapTime.getFullYear()}-${String(recapTime.getMonth() + 1).padStart(2, '0')}-${String(recapTime.getDate()).padStart(2, '0')}`;
              const recapMs = new Date(recapDateStr + 'T00:00:00').getTime();
              return Math.abs(recapMs - meetupMs) / (1000 * 60 * 60 * 24) <= 2;
            });
            if (matchingRecap) {
              rMap[meetup.id] = matchingRecap.id;
              usedRecaps.add(matchingRecap.id);
            }
          });

          setRecapMap(rMap);
        }
      }
    } catch (error) {
      console.error('Error loading circle meetups:', error);
      setUseFallbackDates(true);
    }
  };

  const handleRSVP = async (meetupId) => {
    setRsvpLoading(prev => ({ ...prev, [meetupId]: true }));
    try {
      const isRSVPd = userRSVPs[meetupId];

      if (isRSVPd) {
        const result = await cancelRSVP(meetupId);
        if (result.success) {
          setUserRSVPs(prev => ({ ...prev, [meetupId]: false }));
        }
      } else {
        const result = await rsvpToMeetup(meetupId);
        if (result.success) {
          setUserRSVPs(prev => ({ ...prev, [meetupId]: true }));
        }
      }
    } catch (error) {
      console.error('Error handling RSVP:', error);
    } finally {
      setRsvpLoading(prev => ({ ...prev, [meetupId]: false }));
    }
  };

  const handleEditCircleMeetup = (meetup) => {
    setEditingCircleMeetup({
      id: meetup.id,
      topic: meetup.topic || '',
      date: meetup.date || '',
      time: meetup.time || '',
      location: meetup.location || circle?.location || '',
    });
    setShowEditCircleMeetupModal(true);
  };

  const handleUpdateCircleMeetup = async () => {
    if (!editingCircleMeetup) return;
    try {
      const { error } = await supabase
        .from('meetups')
        .update({
          topic: editingCircleMeetup.topic,
          date: editingCircleMeetup.date,
          time: editingCircleMeetup.time,
          location: editingCircleMeetup.location,
        })
        .eq('id', editingCircleMeetup.id);

      if (!error) {
        setShowEditCircleMeetupModal(false);
        setEditingCircleMeetup(null);
        await loadCircleMeetups(circle);
      }
    } catch (error) {
      console.error('Error updating circle meetup:', error);
    }
  };

  const handleDeleteCircleMeetup = async (meetupId) => {
    try {
      let result;
      if (deleteAllFuture) {
        result = await deleteAllFutureCircleMeetups(circleId);
      } else {
        result = await deleteCircleMeetup(meetupId);
      }
      if (result.success) {
        setShowDeleteCircleMeetupConfirm(false);
        setDeletingCircleMeetupId(null);
        setDeleteAllFuture(false);
        if (deleteAllFuture) {
          await loadCircleDetails();
        } else {
          await loadCircleMeetups(circle);
        }
      }
    } catch (error) {
      console.error('Error deleting circle meetup:', error);
    }
  };

  const handleRequestToJoin = async () => {
    if (!currentUser?.id || !circleId) return;
    setActionLoading(true);

    try {
      // Check if already a member
      const existing = members.find(m => m.user_id === currentUser.id);
      if (existing) {
        setShowJoinConfirm(false);
        return;
      }

      // Add as invited (pending approval)
      const { error } = await supabase
        .from('connection_group_members')
        .insert({
          group_id: circleId,
          user_id: currentUser.id,
          status: 'invited',
        });

      if (error) throw error;

      setShowJoinConfirm(false);
      setJoinSuccess(true);
      await loadCircleDetails();
    } catch (error) {
      console.error('Error requesting to join:', error);
      setShowJoinConfirm(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveCircle = async () => {
    if (!membership?.id) return;
    setActionLoading(true);

    try {
      // Delete by group_id + user_id to satisfy RLS policies
      const { error, count } = await supabase
        .from('connection_group_members')
        .delete({ count: 'exact' })
        .eq('group_id', circleId)
        .eq('user_id', currentUser.id);

      if (error) throw error;
      if (count === 0) throw new Error('Could not remove membership. Please try again.');

      setShowLeaveConfirm(false);
      alert('You have left the circle.');
      onNavigate?.(previousView || 'allCircles');
    } catch (error) {
      console.error('Error leaving circle:', error);
      alert('Error leaving circle: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnterChat = () => {
    // Navigate to messages page with this circle's chat open
    onNavigate?.('messages', { chatId: circleId, chatType: 'circle' });
  };

  const handleStartCall = async () => {
    try {
      const channelName = `connection-group-${circleId}`;
      window.location.href = `/call/circle/${channelName}`;
    } catch (error) {
      alert('Could not start video call: ' + error.message);
    }
  };

  const handleOpenEdit = () => {
    setEditForm({
      name: circle?.name || '',
      description: circle?.description || '',
      location: circle?.location || '',
      vibe_category: circle?.vibe_category || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) {
      alert('Circle name is required');
      return;
    }

    setSaving(true);
    try {
      // Build update object with only valid values
      // vibe_category constraint only allows: 'advice', 'vent', 'grow' (or null to keep existing)
      const validVibeCategories = ['advice', 'vent', 'grow', 'peers'];
      const updateData = {
        name: editForm.name.trim(),
        updated_at: new Date().toISOString(),
      };

      // Only include vibe_category if it's a valid value (don't send empty string)
      if (editForm.vibe_category && validVibeCategories.includes(editForm.vibe_category)) {
        updateData.vibe_category = editForm.vibe_category;
      }

      // Try to update with extended fields first
      const extendedData = {
        ...updateData,
        description: editForm.description?.trim() || null,
        location: editForm.location?.trim() || null,
      };

      const { error } = await supabase
        .from('connection_groups')
        .update(extendedData)
        .eq('id', circleId);

      if (error) {
        // If columns don't exist, try updating only existing columns
        if (error.message.includes('column') || error.code === '42703') {
          console.log('Some columns may not exist, trying basic update...');
          const { error: basicError } = await supabase
            .from('connection_groups')
            .update(updateData)
            .eq('id', circleId);

          if (basicError) throw basicError;
        } else {
          throw error;
        }
      }

      setShowEditModal(false);
      await loadCircleDetails();
      alert('Circle updated successfully!');
    } catch (error) {
      console.error('Error updating circle:', error);
      alert('Error updating circle: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Get visual elements based on circle index
  const circleIndex = circle?.name?.charCodeAt(0) % 8 || 0;
  const emoji = CIRCLE_EMOJIS[circleIndex];
  const gradient = CIRCLE_GRADIENTS[circleIndex];
  const categoryInfo = CATEGORY_LABELS[circle?.vibe_category] || null;

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading circle...</p>
        <style>{keyframeStyles}</style>
      </div>
    );
  }

  if (!circle) {
    return (
      <div style={styles.container}>
        <div style={styles.errorState}>
          <span style={{ fontSize: '48px', marginBottom: '16px' }}>😕</span>
          <h2 style={{ margin: '0 0 8px', color: colors.text }}>Circle not found</h2>
          <p style={{ color: colors.textLight, marginBottom: '24px' }}>This circle may have been removed or doesn't exist.</p>
          <button style={styles.primaryButton} onClick={() => onNavigate?.(previousView || 'allCircles')}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  const acceptedMembers = members.filter(m => m.status === 'accepted');

  return (
    <div style={styles.container}>
      {/* Header with gradient */}
      <div style={{ ...styles.header, background: gradient }}>
        <button
          style={styles.backButton}
          onClick={() => onNavigate?.(previousView || 'allCircles')}
        >
          <ChevronLeft size={24} color={colors.text} />
        </button>

        <div style={styles.headerContent}>
          <div style={styles.emojiContainer}>
            <span style={styles.emoji}>{emoji}</span>
          </div>

          {categoryInfo && (
            <span style={styles.categoryBadge}>
              {categoryInfo.emoji} {categoryInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Title Section */}
        <div style={styles.titleSection}>
          <h1 style={styles.circleName}>{circle.name}</h1>
          {circle.description && (
            <p style={styles.description}>{circle.description}</p>
          )}
        </div>

        {/* Regular Schedule */}
        <div style={styles.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={styles.sectionTitle}>Regular Schedule</h3>
            {isHost && (
              <button
                onClick={() => onNavigate?.('scheduleMeetup', {
                  meetupType: 'circle',
                  scheduleCircleId: circle.id,
                  scheduleCircleName: circle.name
                })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: colors.primary,
                  cursor: 'pointer',
                  fontFamily: fonts.sans,
                }}
              >
                <Edit3 size={14} />
                Edit
              </button>
            )}
          </div>

          {/* Schedule grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: (circleMeetups.length > 0 || (useFallbackDates && circle.meeting_day && circle.meeting_day !== 'Flexible')) ? '16px' : 0,
          }}>
            <div style={{
              backgroundColor: colors.cream,
              borderRadius: '12px',
              padding: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Calendar size={15} color={colors.primary} />
                <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Frequency</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text, fontFamily: fonts.serif }}>
                {circle.meeting_day && circle.cadence
                  ? `${circle.cadence}`
                  : circle.cadence || 'TBD'}
              </span>
              {circle.meeting_day && (
                <span style={{ display: 'block', fontSize: '13px', color: colors.textLight, marginTop: '2px' }}>
                  on {circle.meeting_day}s
                </span>
              )}
            </div>

            <div style={{
              backgroundColor: colors.cream,
              borderRadius: '12px',
              padding: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Clock size={15} color={colors.primary} />
                <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text, fontFamily: fonts.serif }}>
                {circle.time_of_day || 'Flexible'}
              </span>
            </div>

            <div style={{
              backgroundColor: colors.cream,
              borderRadius: '12px',
              padding: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <MapPin size={15} color={colors.primary} />
                <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text, fontFamily: fonts.serif }}>
                {circle.location || 'Virtual'}
              </span>
            </div>

            <div style={{
              backgroundColor: colors.cream,
              borderRadius: '12px',
              padding: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Users size={15} color={colors.primary} />
                <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Group Size</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text, fontFamily: fonts.serif }}>
                {memberCount}/{maxMembers}
              </span>
              <span style={{ display: 'block', fontSize: '13px', color: spotsLeft <= 2 ? colors.warning : colors.textLight, marginTop: '2px' }}>
                {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} open` : 'Full'}
              </span>
            </div>
          </div>

          {/* Next meetup highlight */}
          {(() => {
            const nextMeetup = circleMeetups[0];
            const nextFallbackDate = (!nextMeetup && useFallbackDates && circle.meeting_day && circle.meeting_day !== 'Flexible')
              ? calculateUpcomingDates(circle.meeting_day, circle.cadence, 1)[0]
              : null;

            if (!nextMeetup && !nextFallbackDate) return null;

            const displayDate = nextMeetup
              ? parseLocalDate(nextMeetup.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : nextFallbackDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

            const displayTime = nextMeetup?.time
              ? new Date(`2000-01-01T${nextMeetup.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              : circle.time_of_day || 'Time TBD';

            return (
              <div style={{
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Next Meetup
                  </span>
                  <p style={{ fontSize: '15px', fontWeight: '600', color: 'white', margin: '4px 0 2px', fontFamily: fonts.serif }}>
                    {displayDate}
                  </p>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                    {displayTime} · {circle.location || 'Virtual'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {isHost && nextMeetup && (
                    <>
                      <button
                        onClick={() => handleEditCircleMeetup(nextMeetup)}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          border: '1.5px solid rgba(255,255,255,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'white',
                        }}
                        title="Edit meetup"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => { setDeletingCircleMeetupId(nextMeetup.id); setShowDeleteCircleMeetupConfirm(true); }}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          border: '1.5px solid rgba(255,255,255,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'white',
                        }}
                        title="Delete meetup"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  {isMember && nextMeetup && (
                    <button
                      onClick={() => handleRSVP(nextMeetup.id)}
                      disabled={rsvpLoading[nextMeetup.id]}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: userRSVPs[nextMeetup.id] ? 'rgba(255,255,255,0.2)' : 'white',
                        color: userRSVPs[nextMeetup.id] ? 'white' : colors.primary,
                        border: userRSVPs[nextMeetup.id] ? '1.5px solid rgba(255,255,255,0.4)' : 'none',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexShrink: 0,
                      }}
                    >
                      {rsvpLoading[nextMeetup.id] ? '...' : userRSVPs[nextMeetup.id] ? (
                        <><Check size={14} /> Going</>
                      ) : (
                        <><UserPlus size={14} /> RSVP</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

        </div>

        {/* Host Section */}
        {host && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Hosted by</h3>
            <div style={styles.hostCard}>
              <div style={styles.avatar}>
                {host.profile_picture ? (
                  <img src={host.profile_picture} alt={host.name} style={styles.avatarImg} />
                ) : (
                  <span style={styles.avatarText}>{host.name?.charAt(0) || '?'}</span>
                )}
              </div>
              <div style={styles.hostInfo}>
                <span style={styles.hostName}>{host.name}</span>
                {host.career && <span style={styles.hostCareer}>{host.career}</span>}
              </div>
              {isHost && <span style={styles.youBadge}>You</span>}
            </div>
          </div>
        )}

        {/* Members Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Members</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={styles.memberCount}>
                {memberCount}/{maxMembers}
                {spotsLeft > 0 && spotsLeft <= 3 && (
                  <span style={styles.spotsWarning}> · {spotsLeft} spots left</span>
                )}
              </span>
              {isMember && !isFull && (
                <button
                  onClick={openInviteModal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 12px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '100px',
                    color: colors.primary,
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: fonts.sans,
                  }}
                >
                  <UserPlus size={13} />
                  Invite
                </button>
              )}
            </div>
          </div>

          <div style={styles.membersList}>
            {acceptedMembers.map((member) => (
              <div
                key={member.id}
                style={{ ...styles.memberCard, cursor: 'pointer' }}
                onClick={() => onNavigate?.('userProfile', { userId: member.user_id })}
              >
                <div style={styles.memberAvatar}>
                  {member.profile?.profile_picture ? (
                    <img src={member.profile.profile_picture} alt={member.profile.name} style={styles.avatarImg} />
                  ) : (
                    <span style={styles.avatarText}>{member.profile?.name?.charAt(0) || '?'}</span>
                  )}
                </div>
                <div style={styles.memberInfo}>
                  <span style={styles.memberName}>
                    {member.profile?.name || 'Unknown'}
                    {member.user_id === currentUser?.id && ' (You)'}
                  </span>
                  {member.profile?.career && (
                    <span style={styles.memberCareer}>{member.profile.career}</span>
                  )}
                </div>
                {member.user_id === circle.creator_id && (
                  <span style={styles.hostTag}>Host</span>
                )}
              </div>
            ))}

            {acceptedMembers.length === 0 && (
              <p style={styles.emptyText}>No members yet. Be the first to join!</p>
            )}
          </div>

          {/* Pending Invites */}
          {members.filter(m => m.status === 'invited').length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '600', color: colors.textMuted, marginBottom: '8px', fontFamily: fonts.sans }}>
                Pending Invites
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {members.filter(m => m.status === 'invited').map(member => (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      backgroundColor: `${colors.primary}06`,
                      border: `1px dashed ${colors.border}`,
                      opacity: 0.7,
                    }}
                  >
                    <div style={{ ...styles.memberAvatar, width: '32px', height: '32px' }}>
                      {member.profile?.profile_picture ? (
                        <img src={member.profile.profile_picture} alt={member.profile.name} style={styles.avatarImg} />
                      ) : (
                        <span style={{ ...styles.avatarText, fontSize: '12px' }}>{member.profile?.name?.charAt(0) || '?'}</span>
                      )}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: colors.textLight, flex: 1 }}>
                      {member.profile?.name || 'Unknown'}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: colors.warning,
                      fontWeight: '600',
                      padding: '2px 8px',
                      borderRadius: '100px',
                      backgroundColor: `${colors.warning}15`,
                    }}>
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* What to Expect */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>What to expect</h3>
          <div style={styles.expectList}>
            <div style={styles.expectItem}>
              <span style={styles.expectEmoji}>🤝</span>
              <span style={styles.expectText}>A safe, judgment-free space to share and connect</span>
            </div>
            <div style={styles.expectItem}>
              <span style={styles.expectEmoji}>💬</span>
              <span style={styles.expectText}>Regular meetups with meaningful conversations</span>
            </div>
            <div style={styles.expectItem}>
              <span style={styles.expectEmoji}>🌱</span>
              <span style={styles.expectText}>Lasting connections that grow over time</span>
            </div>
          </div>
        </div>

        {/* Past Sessions */}
        {pastMeetups.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Past Sessions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(showAllPast ? pastMeetups : pastMeetups.slice(0, 3)).map((meetup) => {
                const meetupDate = parseLocalDate(meetup.date);
                const dateStr = meetupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const timeStr = meetup.time
                  ? new Date(`2000-01-01T${meetup.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  : null;
                const hasRecap = !!recapMap[meetup.id];

                return (
                  <div
                    key={meetup.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      backgroundColor: colors.cream,
                      borderRadius: '12px',
                      cursor: hasRecap ? 'pointer' : 'default',
                    }}
                    onClick={hasRecap ? () => onNavigate?.('sessionRecapDetail', { recapId: recapMap[meetup.id] }) : undefined}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(139, 111, 92, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Calendar size={16} color={colors.textMuted} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: colors.text,
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {meetup.topic || 'Circle Meetup'}
                      </p>
                      <p style={{
                        fontSize: '12px',
                        color: colors.textMuted,
                        margin: '2px 0 0',
                      }}>
                        {dateStr}{timeStr ? ` · ${timeStr}` : ''} · {meetup.attendeeCount} attended
                      </p>
                    </div>
                    {hasRecap && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        backgroundColor: `${colors.primary}15`,
                        borderRadius: '8px',
                        flexShrink: 0,
                      }}>
                        <FileText size={13} color={colors.primary} />
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: colors.primary,
                        }}>
                          AI Recap
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {pastMeetups.length > 3 && (
              <button
                onClick={() => setShowAllPast(!showAllPast)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.primary,
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginTop: '12px',
                  padding: 0,
                  fontFamily: fonts.sans,
                }}
              >
                {showAllPast ? 'Show less' : `View all ${pastMeetups.length} past sessions`}
              </button>
            )}
          </div>
        )}

        {/* Status Banner for Pending */}
        {isPending && (
          <div style={styles.pendingBanner}>
            <span style={styles.pendingIcon}>⏳</span>
            <div style={{ flex: 1 }}>
              <span style={styles.pendingTitle}>Invitation Pending</span>
              <span style={styles.pendingText}>{host?.name || 'Host'} invited you to this circle</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
              <button
                onClick={async () => {
                  try {
                    setActionLoading(true)
                    const { error } = await supabase
                      .from('connection_group_members')
                      .update({ status: 'declined', responded_at: new Date().toISOString() })
                      .eq('id', membership.id)
                      .eq('user_id', currentUser.id)
                    if (error) throw error
                    onNavigate?.(previousView || 'allCircles')
                  } catch (err) {
                    console.error('Error declining invitation:', err)
                  } finally {
                    setActionLoading(false)
                  }
                }}
                disabled={actionLoading}
                style={{
                  padding: '6px 16px',
                  background: 'transparent',
                  border: '1px solid rgba(184, 160, 137, 0.4)',
                  borderRadius: '16px',
                  color: '#6B5647',
                  fontFamily: '"Lora", serif',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Decline
              </button>
              <button
                onClick={async () => {
                  try {
                    setActionLoading(true)
                    const { error } = await supabase
                      .from('connection_group_members')
                      .update({ status: 'accepted', responded_at: new Date().toISOString() })
                      .eq('id', membership.id)
                      .eq('user_id', currentUser.id)
                    if (error) throw error
                    await loadCircleDetails()
                  } catch (err) {
                    console.error('Error accepting invitation:', err)
                  } finally {
                    setActionLoading(false)
                  }
                }}
                disabled={actionLoading}
                style={{
                  padding: '6px 16px',
                  background: 'rgba(103, 77, 59, 0.9)',
                  border: 'none',
                  borderRadius: '16px',
                  color: '#F5EDE9',
                  fontFamily: '"Lora", serif',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Accept
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isMember && !isPending && (
          <button
            style={{
              ...styles.primaryButton,
              ...(isFull ? styles.waitlistButton : {}),
              ...(actionLoading ? styles.buttonDisabled : {}),
            }}
            onClick={() => setShowJoinConfirm(true)}
            disabled={actionLoading}
          >
            {isFull ? 'Join Waitlist' : 'Request to Join'}
          </button>
        )}

        {isMember && (
          <div style={styles.memberActions}>
            <button style={styles.actionButton} onClick={handleEnterChat}>
              <MessageCircle size={18} />
              <span>Chat</span>
            </button>
            <button
              style={{ ...styles.actionButton, ...styles.leaveButton }}
              onClick={() => setShowLeaveConfirm(true)}
            >
              <LogOut size={18} />
              <span>Leave</span>
            </button>
          </div>
        )}

        {isPending && (
          <button style={{ ...styles.primaryButton, ...styles.buttonDisabled }} disabled>
            Request Pending
          </button>
        )}
      </div>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Leave Circle?</h3>
            <p style={styles.modalText}>
              Are you sure you want to leave "{circle.name}"? You'll need to request to join again.
            </p>
            <div style={styles.modalActions}>
              <button
                style={styles.cancelButton}
                onClick={() => setShowLeaveConfirm(false)}
              >
                Cancel
              </button>
              <button
                style={styles.confirmLeaveButton}
                onClick={handleLeaveCircle}
                disabled={actionLoading}
              >
                {actionLoading ? 'Leaving...' : 'Leave Circle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Confirmation Modal */}
      {showJoinConfirm && (
        <div style={styles.modalOverlay} onClick={() => setShowJoinConfirm(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${colors.primary}20, ${colors.primary}40)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <Users size={22} style={{ color: colors.primary }} />
              </div>
              <h3 style={{ ...styles.modalTitle, margin: '0 0 8px' }}>
                {isFull ? 'Join Waitlist?' : 'Join this Circle?'}
              </h3>
            </div>
            <p style={styles.modalText}>
              {isFull
                ? `This circle is currently full. You'll be added to the waitlist and notified when a spot opens up.`
                : `Your request will be sent to ${host?.name || 'the host'} for approval. You'll be notified once accepted.`
              }
            </p>
            <div style={styles.modalActions}>
              <button
                style={styles.cancelButton}
                onClick={() => setShowJoinConfirm(false)}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.cancelButton,
                  backgroundColor: colors.primary,
                  color: 'white',
                }}
                onClick={handleRequestToJoin}
                disabled={actionLoading}
              >
                {actionLoading ? 'Sending...' : isFull ? 'Join Waitlist' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Success Modal */}
      {joinSuccess && (
        <div style={styles.modalOverlay} onClick={() => setJoinSuccess(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <Check size={26} style={{ color: '#4CAF50' }} />
              </div>
              <h3 style={{ ...styles.modalTitle, margin: '0 0 8px' }}>Request Sent!</h3>
              <p style={{ ...styles.modalText, margin: '0 0 20px' }}>
                {host?.name || 'The host'} will review your request. You'll be notified once accepted.
              </p>
              <button
                style={{
                  ...styles.cancelButton,
                  backgroundColor: colors.primary,
                  color: 'white',
                  width: '100%',
                }}
                onClick={() => setJoinSuccess(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Circle Modal */}
      {showEditModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.editModal}>
            <div style={styles.editModalHeader}>
              <h3 style={styles.modalTitle}>Edit Circle</h3>
              <button
                style={styles.closeButton}
                onClick={() => setShowEditModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={styles.editModalBody}>
              {/* Circle Name */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Circle Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  style={styles.formInput}
                  placeholder="Enter circle name"
                  maxLength={100}
                />
              </div>

              {/* Description */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  style={styles.formTextarea}
                  placeholder="What is this circle about?"
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* Category */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Category</label>
                <select
                  value={editForm.vibe_category}
                  onChange={(e) => setEditForm({ ...editForm, vibe_category: e.target.value })}
                  style={styles.formSelect}
                >
                  <option value="">Keep current / No change</option>
                  <option value="advice">💡 Get Advice</option>
                  <option value="vent">🤝 Find Support</option>
                  <option value="grow">🚀 Career Growth</option>
                </select>
              </div>

              {/* Location */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Location</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  style={styles.formInput}
                  placeholder="Virtual, city name, or venue"
                />
              </div>
            </div>

            <div style={styles.editModalFooter}>
              <button
                style={styles.cancelButton}
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.saveButton,
                  ...(saving ? styles.buttonDisabled : {}),
                }}
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Circle Meetup Modal */}
      {showEditCircleMeetupModal && editingCircleMeetup && (
        <div style={styles.modalOverlay} onClick={() => setShowEditCircleMeetupModal(false)}>
          <div style={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.editModalHeader}>
              <h3 style={styles.modalTitle}>Edit Meetup</h3>
              <button style={styles.closeButton} onClick={() => setShowEditCircleMeetupModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.editModalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Topic</label>
                <input
                  type="text"
                  value={editingCircleMeetup.topic}
                  onChange={(e) => setEditingCircleMeetup({ ...editingCircleMeetup, topic: e.target.value })}
                  style={styles.formInput}
                  placeholder="Meetup topic"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Date</label>
                <input
                  type="date"
                  value={editingCircleMeetup.date}
                  onChange={(e) => setEditingCircleMeetup({ ...editingCircleMeetup, date: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Time</label>
                <input
                  type="time"
                  value={editingCircleMeetup.time}
                  onChange={(e) => setEditingCircleMeetup({ ...editingCircleMeetup, time: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Location</label>
                <input
                  type="text"
                  value={editingCircleMeetup.location}
                  onChange={(e) => setEditingCircleMeetup({ ...editingCircleMeetup, location: e.target.value })}
                  style={styles.formInput}
                  placeholder="Virtual, city name, or venue"
                />
              </div>
            </div>
            <div style={styles.editModalFooter}>
              <button style={styles.cancelButton} onClick={() => setShowEditCircleMeetupModal(false)}>
                Cancel
              </button>
              <button style={styles.saveButton} onClick={handleUpdateCircleMeetup}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Circle Meetup Confirmation */}
      {showDeleteCircleMeetupConfirm && (
        <div style={styles.modalOverlay} onClick={() => { setShowDeleteCircleMeetupConfirm(false); setDeletingCircleMeetupId(null); setDeleteAllFuture(false); }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Delete Meetup?</h3>
            <p style={styles.modalText}>
              {deleteAllFuture
                ? 'This will remove all future meetups and stop the recurring schedule. This action cannot be undone.'
                : 'This will remove the meetup for all circle members. This action cannot be undone.'}
            </p>
            {circle?.cadence && circle.cadence !== 'As needed' && (
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                backgroundColor: colors.cream,
                borderRadius: '10px',
                marginBottom: '16px',
                cursor: 'pointer',
                fontSize: '13px',
                color: colors.text,
                fontWeight: '500',
              }}>
                <input
                  type="checkbox"
                  checked={deleteAllFuture}
                  onChange={(e) => setDeleteAllFuture(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: colors.primary, cursor: 'pointer' }}
                />
                Delete all future meetups and stop recurring schedule
              </label>
            )}
            <div style={styles.modalActions}>
              <button style={styles.cancelButton} onClick={() => { setShowDeleteCircleMeetupConfirm(false); setDeletingCircleMeetupId(null); setDeleteAllFuture(false); }}>
                Cancel
              </button>
              <button style={styles.confirmLeaveButton} onClick={() => handleDeleteCircleMeetup(deletingCircleMeetupId)}>
                {deleteAllFuture ? 'Delete All' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Members Modal */}
      {showInviteModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={styles.modalTitle}>Invite to Circle</h3>
              <button
                onClick={() => { setShowInviteModal(false); setSelectedInvites([]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: '18px' }}
              >
                <X size={20} />
              </button>
            </div>

            {invitableConnections.length === 0 ? (
              <p style={{ fontSize: '14px', color: colors.textLight, textAlign: 'center', padding: '20px 0' }}>
                No connections available to invite. They may already be in this circle.
              </p>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '12px' }}>
                  Select connections to invite ({spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} available)
                </p>
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {invitableConnections.map(person => {
                    const isSelected = selectedInvites.includes(person.id);
                    return (
                      <div
                        key={person.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedInvites(prev => prev.filter(id => id !== person.id));
                          } else if (selectedInvites.length < spotsLeft) {
                            setSelectedInvites(prev => [...prev, person.id]);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '12px',
                          cursor: selectedInvites.length >= spotsLeft && !isSelected ? 'not-allowed' : 'pointer',
                          backgroundColor: isSelected ? `${colors.primary}10` : 'transparent',
                          border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                          opacity: selectedInvites.length >= spotsLeft && !isSelected ? 0.5 : 1,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: colors.cream,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}>
                          {person.profile_picture ? (
                            <img src={person.profile_picture} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '14px', color: colors.primary }}>{person.name?.charAt(0)}</span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: colors.text }}>{person.name}</div>
                          {person.career && (
                            <div style={{ fontSize: '12px', color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.career}</div>
                          )}
                        </div>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          border: `1.5px solid ${isSelected ? colors.primary : colors.border}`,
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {isSelected && <Check size={12} color="white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ ...styles.modalActions, marginTop: '16px' }}>
              <button
                style={styles.cancelButton}
                onClick={() => { setShowInviteModal(false); setSelectedInvites([]); }}
              >
                Cancel
              </button>
              {invitableConnections.length > 0 && (
                <button
                  onClick={handleSendInvites}
                  disabled={selectedInvites.length === 0 || inviteLoading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: selectedInvites.length === 0 ? colors.border : colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: selectedInvites.length === 0 ? 'not-allowed' : 'pointer',
                    fontFamily: fonts.sans,
                    opacity: inviteLoading ? 0.7 : 1,
                  }}
                >
                  {inviteLoading ? 'Sending...' : `Invite ${selectedInvites.length > 0 ? `(${selectedInvites.length})` : ''}`}
                </button>
              )}
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

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: colors.cream,
    fontFamily: fonts.sans,
    display: 'flex',
    flexDirection: 'column',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: `3px solid ${colors.border}`,
    borderTopColor: colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },
  loadingText: {
    color: colors.textLight,
    fontSize: '15px',
  },
  errorState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    textAlign: 'center',
  },
  header: {
    position: 'relative',
    padding: '16px 16px 60px',
    minHeight: '180px',
  },
  backButton: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  settingsButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '20px',
  },
  emojiContainer: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    marginBottom: '12px',
  },
  emoji: {
    fontSize: '40px',
  },
  categoryBadge: {
    padding: '6px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '100px',
    fontSize: '13px',
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: '0 20px 40px',
    marginTop: '-30px',
    position: 'relative',
    zIndex: 1,
  },
  titleSection: {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '24px',
    marginBottom: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
    textAlign: 'center',
  },
  circleName: {
    fontFamily: fonts.serif,
    fontSize: '24px',
    fontWeight: '600',
    color: colors.text,
    margin: '0 0 8px',
  },
  description: {
    fontSize: '15px',
    color: colors.textLight,
    margin: 0,
    lineHeight: '1.5',
  },
  detailsCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '16px 20px',
    marginBottom: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  detailText: {
    fontSize: '14px',
    color: colors.text,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: '16px',
    fontWeight: '600',
    color: colors.text,
    margin: 0,
  },
  memberCount: {
    fontSize: '13px',
    color: colors.textMuted,
  },
  spotsWarning: {
    color: colors.warning,
    fontWeight: '600',
  },
  hostCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: colors.cream,
    borderRadius: '12px',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarText: {
    color: 'white',
    fontSize: '18px',
    fontWeight: '600',
  },
  hostInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  hostName: {
    fontSize: '15px',
    fontWeight: '600',
    color: colors.text,
  },
  hostCareer: {
    fontSize: '13px',
    color: colors.textLight,
  },
  youBadge: {
    padding: '4px 10px',
    backgroundColor: `${colors.primary}15`,
    color: colors.primary,
    borderRadius: '100px',
    fontSize: '12px',
    fontWeight: '600',
  },
  membersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  memberCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    backgroundColor: colors.cream,
    borderRadius: '12px',
  },
  memberAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  memberInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  memberName: {
    fontSize: '14px',
    fontWeight: '500',
    color: colors.text,
  },
  memberCareer: {
    fontSize: '12px',
    color: colors.textLight,
  },
  hostTag: {
    padding: '3px 8px',
    backgroundColor: colors.primary,
    color: 'white',
    borderRadius: '100px',
    fontSize: '10px',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: '14px',
    color: colors.textMuted,
    textAlign: 'center',
    padding: '20px',
  },
  expectList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  expectItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  expectEmoji: {
    fontSize: '18px',
    lineHeight: '1.4',
  },
  expectText: {
    fontSize: '14px',
    color: colors.textLight,
    lineHeight: '1.4',
  },
  pendingBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: `${colors.warning}15`,
    borderRadius: '12px',
    marginBottom: '16px',
  },
  pendingIcon: {
    fontSize: '24px',
  },
  pendingTitle: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: colors.text,
    marginBottom: '2px',
  },
  pendingText: {
    fontSize: '13px',
    color: colors.textLight,
  },
  footer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '16px 20px',
    backgroundColor: 'rgba(253, 248, 243, 0.95)',
    borderTop: `1px solid ${colors.border}`,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    zIndex: 10,
  },
  primaryButton: {
    width: '100%',
    padding: '16px',
    backgroundColor: colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: '14px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: fonts.sans,
  },
  waitlistButton: {
    backgroundColor: colors.primaryLight,
  },
  buttonDisabled: {
    backgroundColor: colors.border,
    color: colors.textMuted,
    cursor: 'not-allowed',
  },
  memberActions: {
    display: 'flex',
    gap: '10px',
  },
  actionButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    backgroundColor: 'white',
    color: colors.primary,
    border: `1.5px solid ${colors.primary}`,
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: fonts.sans,
  },
  leaveButton: {
    color: colors.textMuted,
    borderColor: colors.border,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 100,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '24px',
    maxWidth: '340px',
    width: '100%',
  },
  modalTitle: {
    fontFamily: fonts.serif,
    fontSize: '20px',
    fontWeight: '600',
    color: colors.text,
    margin: '0 0 12px',
  },
  modalText: {
    fontSize: '14px',
    color: colors.textLight,
    lineHeight: '1.5',
    margin: '0 0 20px',
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
  },
  cancelButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: colors.cream,
    color: colors.text,
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: fonts.sans,
  },
  confirmLeaveButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#E57373',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: fonts.sans,
  },
  // Edit Modal Styles
  editModal: {
    backgroundColor: 'white',
    borderRadius: '20px',
    maxWidth: '480px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  editModalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: `1px solid ${colors.border}`,
  },
  closeButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: colors.cream,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: colors.text,
  },
  editModalBody: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
  },
  editModalFooter: {
    display: 'flex',
    gap: '12px',
    padding: '20px',
    borderTop: `1px solid ${colors.border}`,
  },
  formGroup: {
    marginBottom: '20px',
  },
  formLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: colors.text,
    marginBottom: '8px',
  },
  formInput: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '15px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: '12px',
    backgroundColor: 'white',
    color: colors.text,
    fontFamily: fonts.sans,
    outline: 'none',
    boxSizing: 'border-box',
  },
  formTextarea: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '15px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: '12px',
    backgroundColor: 'white',
    color: colors.text,
    fontFamily: fonts.sans,
    outline: 'none',
    resize: 'none',
    boxSizing: 'border-box',
  },
  formSelect: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '15px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: '12px',
    backgroundColor: 'white',
    color: colors.text,
    fontFamily: fonts.sans,
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  formSectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '16px',
    marginTop: '8px',
    paddingTop: '16px',
    borderTop: `1px solid ${colors.border}`,
  },
  saveButton: {
    flex: 1,
    padding: '14px',
    backgroundColor: colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: fonts.sans,
  },
  buttonDisabled: {
    backgroundColor: colors.border,
    color: colors.textMuted,
    cursor: 'not-allowed',
  },
  // Upcoming Meetups Styles
  upcomingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  upcomingItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    backgroundColor: colors.cream,
    borderRadius: '12px',
    position: 'relative',
  },
  upcomingItemNext: {
    backgroundColor: `${colors.primary}10`,
    border: `1.5px solid ${colors.primary}30`,
  },
  upcomingDate: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  upcomingDay: {
    fontSize: '11px',
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  upcomingFullDate: {
    fontSize: '14px',
    fontWeight: '600',
    color: colors.text,
  },
  upcomingTime: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  upcomingTimeText: {
    fontSize: '13px',
    fontWeight: '500',
  },
  nextBadge: {
    position: 'absolute',
    top: '-8px',
    right: '12px',
    padding: '3px 10px',
    backgroundColor: colors.primary,
    color: 'white',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  upcomingMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  rsvpButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    backgroundColor: 'white',
    border: `1.5px solid ${colors.border}`,
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: colors.textLight,
    cursor: 'pointer',
    fontFamily: fonts.sans,
    transition: 'all 0.2s ease',
  },
  rsvpButtonActive: {
    backgroundColor: `${colors.success}15`,
    borderColor: colors.success,
    color: colors.success,
  },
};

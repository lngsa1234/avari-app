// components/CircleDetailView.js
// Detailed view for a single circle with full info and actions
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Users, Calendar, Clock, MapPin, MessageCircle, Video, Settings, LogOut, X, Edit3, Check, UserPlus, Plus } from 'lucide-react';
import {
  getOrCreateCircleMeetups,
  getUserRSVPStatus,
  rsvpToMeetup,
  cancelRSVP,
  calculateUpcomingDates,
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
    meeting_day: '',
    cadence: '',
    time_of_day: '',
    location: '',
    vibe_category: '',
  });
  const [saving, setSaving] = useState(false);
  const [circleMeetups, setCircleMeetups] = useState([]);
  const [userRSVPs, setUserRSVPs] = useState({});
  const [rsvpLoading, setRsvpLoading] = useState({});
  const [useFallbackDates, setUseFallbackDates] = useState(false);

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
      // Fetch circle data
      const { data: circleData, error: circleError } = await supabase
        .from('connection_groups')
        .select('*')
        .eq('id', circleId)
        .single();

      if (circleError) throw circleError;
      setCircle(circleData);

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('connection_group_members')
        .select('id, user_id, status, invited_at, responded_at')
        .eq('group_id', circleId);

      if (membersError) throw membersError;

      // Get member profiles
      const memberUserIds = membersData?.map(m => m.user_id) || [];
      if (memberUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, career, profile_picture, city, state')
          .in('id', memberUserIds);

        const profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});

        const enrichedMembers = membersData.map(m => ({
          ...m,
          profile: profileMap[m.user_id] || {},
        }));
        setMembers(enrichedMembers);
      } else {
        setMembers([]);
      }

      // Fetch host profile
      if (circleData?.creator_id) {
        const { data: hostProfile } = await supabase
          .from('profiles')
          .select('id, name, career, profile_picture')
          .eq('id', circleData.creator_id)
          .single();
        setHost(hostProfile);
      }

      // Load circle meetups
      await loadCircleMeetups(circleData);
    } catch (error) {
      console.error('Error loading circle details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCircleMeetups = async (circleData) => {
    if (!circleData) return;

    try {
      const { meetups, needsMigration } = await getOrCreateCircleMeetups(
        circleId,
        circleData,
        4
      );

      if (needsMigration) {
        // Fall back to calculated dates if circle_id column doesn't exist
        setUseFallbackDates(true);
        setCircleMeetups([]);
      } else {
        setUseFallbackDates(false);
        setCircleMeetups(meetups);

        // Load user's RSVP status
        if (meetups.length > 0) {
          const meetupIds = meetups.map(m => m.id);
          const rsvpStatus = await getUserRSVPStatus(meetupIds);
          setUserRSVPs(rsvpStatus);
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

  const handleRequestToJoin = async () => {
    if (!currentUser?.id || !circleId) return;
    setActionLoading(true);

    try {
      // Check if already a member
      const existing = members.find(m => m.user_id === currentUser.id);
      if (existing) {
        alert('You already have a pending request or are a member.');
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

      alert(`Request sent! ${host?.name || 'The host'} will review your request.`);
      await loadCircleDetails();
    } catch (error) {
      console.error('Error requesting to join:', error);
      alert('Error sending request: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveCircle = async () => {
    if (!membership?.id) return;
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from('connection_group_members')
        .delete()
        .eq('id', membership.id);

      if (error) throw error;

      setShowLeaveConfirm(false);
      alert('You have left the circle.');
      onNavigate?.('allCircles');
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
      meeting_day: circle?.meeting_day || '',
      cadence: circle?.cadence || '',
      time_of_day: circle?.time_of_day || '',
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
        meeting_day: editForm.meeting_day || null,
        cadence: editForm.cadence || null,
        time_of_day: editForm.time_of_day || null,
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
          <button style={styles.primaryButton} onClick={() => onNavigate?.('allCircles')}>
            Browse Circles
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
          onClick={() => onNavigate?.('allCircles')}
        >
          <ChevronLeft size={24} color={colors.text} />
        </button>

        {isHost && (
          <button
            style={styles.settingsButton}
            onClick={handleOpenEdit}
          >
            <Edit3 size={20} color={colors.text} />
          </button>
        )}

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

        {/* Meeting Details */}
        <div style={styles.detailsCard}>
          <div style={styles.detailRow}>
            <Calendar size={18} color={colors.primary} />
            <span style={styles.detailText}>
              {circle.meeting_day && circle.cadence
                ? `${circle.cadence} on ${circle.meeting_day}s`
                : circle.meeting_day
                  ? `Every ${circle.meeting_day}`
                  : circle.cadence || 'Schedule TBD'}
            </span>
          </div>
          <div style={styles.detailRow}>
            <Clock size={18} color={colors.primary} />
            <span style={styles.detailText}>
              {circle.time_of_day || 'Time flexible'}
            </span>
          </div>
          <div style={styles.detailRow}>
            <MapPin size={18} color={colors.primary} />
            <span style={styles.detailText}>
              {circle.location || 'Virtual'}
            </span>
          </div>
        </div>

        {/* Upcoming Meetups */}
        {(circleMeetups.length > 0 || (useFallbackDates && circle.meeting_day && circle.meeting_day !== 'Flexible')) && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Upcoming Meetups</h3>
            <div style={styles.upcomingList}>
              {/* Use actual meetups if available */}
              {!useFallbackDates && circleMeetups.map((meetup, index) => {
                const isNext = index === 0;
                const isRSVPd = userRSVPs[meetup.id];
                const isLoading = rsvpLoading[meetup.id];
                const meetupDate = new Date(meetup.date + 'T00:00:00');
                const dayName = meetupDate.toLocaleDateString('en-US', { weekday: 'short' });
                const fullDate = meetupDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const timeDisplay = meetup.time ?
                  new Date(`2000-01-01T${meetup.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  : 'Time TBD';

                return (
                  <div
                    key={meetup.id}
                    style={{
                      ...styles.upcomingItem,
                      ...(isNext ? styles.upcomingItemNext : {}),
                    }}
                  >
                    <div style={styles.upcomingDate}>
                      <span style={styles.upcomingDay}>{dayName}</span>
                      <span style={styles.upcomingFullDate}>{fullDate}</span>
                    </div>
                    <div style={styles.upcomingMeta}>
                      <div style={styles.upcomingTime}>
                        <Clock size={14} color={isNext ? colors.primary : colors.textMuted} />
                        <span style={{
                          ...styles.upcomingTimeText,
                          color: isNext ? colors.primary : colors.textMuted,
                        }}>
                          {timeDisplay}
                        </span>
                      </div>
                      {isMember && (
                        <button
                          style={{
                            ...styles.rsvpButton,
                            ...(isRSVPd ? styles.rsvpButtonActive : {}),
                          }}
                          onClick={() => handleRSVP(meetup.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? '...' : isRSVPd ? (
                            <>
                              <Check size={14} />
                              <span>Going</span>
                            </>
                          ) : (
                            <>
                              <UserPlus size={14} />
                              <span>RSVP</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    {isNext && (
                      <span style={styles.nextBadge}>Next</span>
                    )}
                  </div>
                );
              })}

              {/* Fallback to calculated dates */}
              {useFallbackDates && calculateUpcomingDates(circle.meeting_day, circle.cadence, 4).map((date, index) => {
                const isNext = index === 0;
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const fullDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                return (
                  <div
                    key={index}
                    style={{
                      ...styles.upcomingItem,
                      ...(isNext ? styles.upcomingItemNext : {}),
                    }}
                  >
                    <div style={styles.upcomingDate}>
                      <span style={styles.upcomingDay}>{dayName}</span>
                      <span style={styles.upcomingFullDate}>{fullDate}</span>
                    </div>
                    <div style={styles.upcomingTime}>
                      <Clock size={14} color={isNext ? colors.primary : colors.textMuted} />
                      <span style={{
                        ...styles.upcomingTimeText,
                        color: isNext ? colors.primary : colors.textMuted,
                      }}>
                        {circle.time_of_day || 'Time TBD'}
                      </span>
                    </div>
                    {isNext && (
                      <span style={styles.nextBadge}>Next</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            <span style={styles.memberCount}>
              {memberCount}/{maxMembers}
              {spotsLeft > 0 && spotsLeft <= 3 && (
                <span style={styles.spotsWarning}> · {spotsLeft} spots left</span>
              )}
            </span>
          </div>

          <div style={styles.membersList}>
            {acceptedMembers.map((member) => (
              <div key={member.id} style={styles.memberCard}>
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

        {/* Status Banner for Pending */}
        {isPending && (
          <div style={styles.pendingBanner}>
            <span style={styles.pendingIcon}>⏳</span>
            <div>
              <span style={styles.pendingTitle}>Request Pending</span>
              <span style={styles.pendingText}>Waiting for {host?.name || 'host'} to approve</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div style={styles.footer}>
        {!isMember && !isPending && (
          <button
            style={{
              ...styles.primaryButton,
              ...(isFull ? styles.waitlistButton : {}),
              ...(actionLoading ? styles.buttonDisabled : {}),
            }}
            onClick={handleRequestToJoin}
            disabled={actionLoading}
          >
            {actionLoading ? 'Sending...' : isFull ? 'Join Waitlist' : 'Request to Join'}
          </button>
        )}

        {isMember && (
          <div style={styles.memberActions}>
            {circle?.cadence === 'As needed' && circle?.creator_id === currentUser?.id && (
              <button
                style={styles.actionButton}
                onClick={() => onNavigate?.('scheduleMeetup', {
                  meetupType: 'circle',
                  scheduleCircleId: circle.id,
                  scheduleCircleName: circle.name
                })}
              >
                <Plus size={18} />
                <span>Schedule</span>
              </button>
            )}
            <button style={styles.actionButton} onClick={handleEnterChat}>
              <MessageCircle size={18} />
              <span>Chat</span>
            </button>
            <button style={styles.actionButton} onClick={handleStartCall}>
              <Video size={18} />
              <span>Call</span>
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

              {/* Schedule Section */}
              <div style={styles.formSectionTitle}>Schedule</div>

              {/* Day of Week */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Meeting Day</label>
                <select
                  value={editForm.meeting_day || ''}
                  onChange={(e) => setEditForm({ ...editForm, meeting_day: e.target.value })}
                  style={styles.formSelect}
                >
                  <option value="">Select day</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>

              {/* Cadence */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Frequency</label>
                <select
                  value={editForm.cadence}
                  onChange={(e) => setEditForm({ ...editForm, cadence: e.target.value })}
                  style={styles.formSelect}
                >
                  <option value="">Select frequency</option>
                  <option value="Weekly">Every week</option>
                  <option value="Biweekly">Every other week</option>
                  <option value="Monthly">Once a month</option>
                  <option value="1st & 3rd">1st & 3rd week of month</option>
                  <option value="As needed">As needed</option>
                </select>
              </div>

              {/* Time */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Meeting Time</label>
                <select
                  value={editForm.time_of_day}
                  onChange={(e) => setEditForm({ ...editForm, time_of_day: e.target.value })}
                  style={styles.formSelect}
                >
                  <option value="">Select time</option>
                  <option value="7:00 AM">7:00 AM</option>
                  <option value="8:00 AM">8:00 AM</option>
                  <option value="9:00 AM">9:00 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="11:00 AM">11:00 AM</option>
                  <option value="12:00 PM">12:00 PM</option>
                  <option value="1:00 PM">1:00 PM</option>
                  <option value="2:00 PM">2:00 PM</option>
                  <option value="3:00 PM">3:00 PM</option>
                  <option value="4:00 PM">4:00 PM</option>
                  <option value="5:00 PM">5:00 PM</option>
                  <option value="6:00 PM">6:00 PM</option>
                  <option value="7:00 PM">7:00 PM</option>
                  <option value="8:00 PM">8:00 PM</option>
                  <option value="9:00 PM">9:00 PM</option>
                  <option value="Flexible">Flexible</option>
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
    padding: '0 20px 120px',
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

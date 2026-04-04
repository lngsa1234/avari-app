'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Briefcase, MessageCircle, Coffee, UserMinus, Users, Edit3, BookOpen, Shield, LogOut, Flag, Check, UserPlus, Heart, Clock, Activity, Share2 } from 'lucide-react';
import ShareProfileModal from '@/components/ShareProfileModal';
import { DAYS, TIMES, getDayLabel, getTimeLabel, formatCoffeeSlots } from '@/lib/coffeeChatSlots';
import { apiFetch } from '@/lib/apiFetch';
import { colors as tokens, fonts } from '@/lib/designTokens';
import { useSupabaseQuery, invalidateQuery } from '@/hooks/useSupabaseQuery';

const COLORS = {
  bg: tokens.bgAlt,
  bgCard: tokens.bgCard,
  bgCardHover: tokens.bgCardHover,
  brown900: tokens.text,
  brown700: tokens.buttonBg,
  brown600: '#6B4C3B',
  brown500: tokens.primary,
  brown400: '#A68B7B',
  brown300: '#C4A882',
  brown200: '#D4C4A8',
  brown100: '#E8DDD0',
  accent: '#7B5B3A',
  accentLight: '#A67C52',
  green: '#4A7C59',
  greenLight: '#E8F2EB',
  greenDot: tokens.online,
  white: tokens.white,
  shadow: tokens.shadow,
  shadowMd: tokens.shadowMd,
  red: '#B85C4A',
  redBg: '#FDF0ED',
  blue: tokens.blue,
  blueLight: '#EBF1F7',
};

const FONT = fonts.sans;
const DISPLAY_FONT = fonts.serif;

const CAREER_STAGE_LABELS = {
  emerging: 'Early Career',
  scaling: 'Mid-Career',
  leading: 'Manager / Director',
  legacy: 'Executive / Founder',
};

const CAREER_STAGE_COLORS = {
  emerging: { bg: '#E8F2EB', text: '#4A7C59' },
  scaling: { bg: '#EBF1F7', text: '#4A6A8B' },
  leading: { bg: '#F3EEF8', text: '#7C5DAF' },
  legacy: { bg: '#FDF3EB', text: '#C4763B' },
};

const VIBE_LABELS = {
  advice: 'Looking for advice',
  vent: 'Wants to vent',
  grow: 'Wants to grow',
};

const VIBE_COLORS = {
  advice: { bg: '#FDF0ED', text: '#B85C4A' },
  vent: { bg: '#FDF3EB', text: '#C4763B' },
  grow: { bg: '#E8F2EB', text: '#4A7C59' },
};

const ACTIVITY_CONFIG = {
  coffee_live: { icon: Coffee, color: '#6B4F3A', bg: '#FDF3EB', label: 'Joined a coffee chat' },
  coffee_scheduled: { icon: Coffee, color: '#6B4F3A', bg: '#FDF3EB', label: 'Scheduled a coffee chat' },
  connection: { icon: UserPlus, color: '#4A7C59', bg: '#E8F2EB', label: 'Made a new connection' },
  circle_join: { icon: Users, color: '#5C6BC0', bg: '#EDE7F6', label: 'Joined a circle' },
  community_event: { icon: BookOpen, color: '#B85C4A', bg: '#FDF0ED', label: 'Hosted a meetup' },
  member_joined: { icon: UserPlus, color: '#4A7C59', bg: '#E8F2EB', label: 'Joined the community' },
};

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function UserProfileView({ currentUser, supabase, userId, onNavigate, previousView, onConnectionRemoved, onEditProfile, onShowTutorial, onSignOut, onAdminDashboard, refreshKey, toast, hideBack }) {
  const [removing, setRemoving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [localSentRequest, setLocalSentRequest] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const isOwnProfile = userId === currentUser.id;
  const [showShareModal, setShowShareModal] = useState(false);

  // SWR: profile data cached across navigation
  const { data: profileData, isLoading: loading, mutate: refreshProfile } = useSupabaseQuery(
    userId ? `user-profile-${userId}-${currentUser.id}` : null,
    async (sb) => {
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      const { data: matches } = await sb
        .rpc('get_mutual_matches', { for_user_id: currentUser.id });
      const matchedIds = (matches || []).map(m => m.matched_user_id);
      const connected = matchedIds.includes(userId);

      let hasIncoming = false;
      let hasSent = false;
      if (!connected && userId !== currentUser.id) {
        const [{ data: incomingInterest }, { data: outgoingInterest }] = await Promise.all([
          sb
            .from('user_interests')
            .select('id')
            .eq('user_id', userId)
            .eq('interested_in_user_id', currentUser.id)
            .limit(1),
          sb
            .from('user_interests')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('interested_in_user_id', userId)
            .limit(1),
        ]);
        hasIncoming = (incomingInterest || []).length > 0;
        hasSent = (outgoingInterest || []).length > 0;
      }

      let connCount = 0;
      if (userId === currentUser.id) {
        connCount = (matches || []).length;
      } else {
        const { data: theirMatches } = await sb
          .rpc('get_mutual_matches', { for_user_id: userId });
        connCount = (theirMatches || []).length;
      }

      const { data: myCircles } = await sb
        .from('connection_group_members')
        .select('group_id')
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted');

      const { data: theirCircles } = await sb
        .from('connection_group_members')
        .select('group_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      let sharedCircles = [];
      if (myCircles && theirCircles) {
        const myGroupIds = new Set(myCircles.map(c => c.group_id));
        const sharedIds = theirCircles.filter(c => myGroupIds.has(c.group_id)).map(c => c.group_id);

        if (sharedIds.length > 0) {
          const { data: circles } = await sb
            .from('connection_groups')
            .select('id, name, connection_group_members(count)')
            .in('id', sharedIds);
          sharedCircles = circles || [];
        }
      }

      const { count: recapCount } = await sb
        .from('call_recaps')
        .select('id', { count: 'exact', head: true })
        .contains('participant_ids', [userId]);

      const { data: feedData, error: feedError } = await sb
        .from('feed_events')
        .select('id, event_type, target_id, metadata, created_at')
        .eq('actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(8);
      if (feedError) console.error('Feed events error:', feedError);

      const targetIds = [...new Set((feedData || []).filter(e => e.target_id).map(e => e.target_id))];
      let targetNames = {};
      if (targetIds.length > 0) {
        const { data: targets } = await sb
          .from('profiles')
          .select('id, name')
          .in('id', targetIds);
        (targets || []).forEach(t => { targetNames[t.id] = t.name; });
      }

      return {
        profile: data,
        isConnected: connected,
        hasIncomingRequest: hasIncoming,
        hasSentRequest: hasSent,
        connectionCount: connCount,
        mutualCircles: sharedCircles,
        meetupCount: recapCount || 0,
        activities: (feedData || []).map(e => ({ ...e, _targetName: targetNames[e.target_id] || null })),
      };
    }
  );

  const profile = profileData?.profile || null;
  const isConnected = profileData?.isConnected || false;
  const hasIncomingRequest = profileData?.hasIncomingRequest || false;
  const hasSentRequest = localSentRequest || profileData?.hasSentRequest || false;
  const connectionCount = profileData?.connectionCount || 0;
  const mutualCircles = profileData?.mutualCircles || [];
  const meetupCount = profileData?.meetupCount || 0;
  const activities = profileData?.activities || [];

  useEffect(() => {
    if (!loading && profile) setTimeout(() => setLoaded(true), 50);
  }, [loading, profile]);

  const handleRemoveConnection = async () => {
    setRemoving(true);
    try {
      const { error } = await supabase
        .rpc('remove_mutual_connection', { other_user_id: userId });

      if (error) throw error;

      setShowConfirm(false);
      refreshProfile();
      // Optimistically remove from circles-page cache so My Connections updates instantly
      invalidateQuery(`circles-page-${currentUser.id}`, prev => {
        if (!prev) return prev;
        return {
          ...prev,
          connections: (prev.connections || []).filter(c => c.id !== userId && c.userId !== userId),
        };
      }, { revalidate: true });
      invalidateQuery(`circles-peers-${currentUser.id}`);
      invalidateQuery(`home-primary-${currentUser.id}`);
      onConnectionRemoved?.(userId);
      onNavigate?.(previousView || 'connectionGroups');
    } catch (err) {
      console.error('Error removing connection:', err);
      toast?.error('Failed to remove connection. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  const handleAcceptConnection = async () => {
    setAccepting(true);
    try {
      const { error } = await supabase
        .from('user_interests')
        .insert({
          user_id: currentUser.id,
          interested_in_user_id: userId,
        });

      if (error && error.code !== '23505') throw error;

      refreshProfile();
      invalidateQuery(`circles-page-${currentUser.id}`);
      invalidateQuery(`circles-peers-${currentUser.id}`);
      invalidateQuery(`home-primary-${currentUser.id}`);
    } catch (err) {
      console.error('Error accepting connection:', err);
      toast?.error('Failed to accept connection. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleSendConnectionRequest = async () => {
    setConnecting(true);
    try {
      const { error } = await supabase
        .from('user_interests')
        .insert({
          user_id: currentUser.id,
          interested_in_user_id: userId,
        });

      if (error) {
        if (error.code === '23505') {
          setLocalSentRequest(true);
          refreshProfile();
        } else {
          throw error;
        }
        return;
      }

      setLocalSentRequest(true);
      refreshProfile();
      invalidateQuery(`circles-sent-requests-${currentUser.id}`);
    } catch (err) {
      console.error('Error sending connection request:', err);
      toast?.error('Failed to send connection request. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleIgnoreConnection = async () => {
    try {
      const { error } = await supabase
        .from('ignored_connection_requests')
        .insert({
          user_id: currentUser.id,
          ignored_user_id: userId,
        });

      if (error && error.code !== '23505') throw error;

      refreshProfile();
      invalidateQuery(`home-primary-${currentUser.id}`);
    } catch (err) {
      console.error('Error ignoring connection:', err);
    }
  };

  const isActive = profile?.last_active &&
    (Date.now() - new Date(profile.last_active).getTime()) < 10 * 60 * 1000;

  const fadeIn = (delay = 0) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(12px)',
    transition: `all 0.45s ease ${delay}s`,
  });

  if (loading && !profileData) {
    return (
      <div style={{ fontFamily: FONT, maxWidth: '880px', margin: '0 auto' }}>
        <style>{keyframeStyles}</style>
        {/* Nav skeleton */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: '#EDE6DF', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: 60, height: 18, borderRadius: 6, background: '#EDE6DF', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: 50, height: 16, borderRadius: 4, background: '#EDE6DF', animation: 'pulse 1.5s infinite' }} />
        </div>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 8, marginBottom: 20 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#EDE6DF', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '60%', height: 20, borderRadius: 6, background: '#EDE6DF', marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
            <div style={{ width: '45%', height: 14, borderRadius: 4, background: '#F5EDE4', marginBottom: 6, animation: 'pulse 1.5s infinite', animationDelay: '0.1s' }} />
            <div style={{ width: '35%', height: 12, borderRadius: 4, background: '#F5EDE4', animation: 'pulse 1.5s infinite', animationDelay: '0.2s' }} />
          </div>
        </div>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.5)', borderRadius: 12, padding: 14, border: '1px solid rgba(139,111,92,0.08)', animation: 'pulse 1.5s infinite', animationDelay: `${i * 0.1}s` }}>
              <div style={{ width: '40%', height: 20, borderRadius: 4, background: '#EDE6DF', marginBottom: 6, margin: '0 auto' }} />
              <div style={{ width: '60%', height: 10, borderRadius: 4, background: '#F5EDE4', margin: '0 auto' }} />
            </div>
          ))}
        </div>
        {/* Bio skeleton */}
        <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 16, padding: 16, border: '1px solid rgba(139,111,92,0.08)', marginBottom: 16, animation: 'pulse 1.5s infinite', animationDelay: '0.15s' }}>
          <div style={{ width: '90%', height: 12, borderRadius: 4, background: '#EDE6DF', marginBottom: 8 }} />
          <div style={{ width: '75%', height: 12, borderRadius: 4, background: '#F5EDE4', marginBottom: 8 }} />
          <div style={{ width: '60%', height: 12, borderRadius: 4, background: '#F5EDE4' }} />
        </div>
        {/* Activity skeleton */}
        <div style={{ width: 140, height: 18, borderRadius: 6, background: '#EDE6DF', marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
        {[0, 1].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, animation: 'pulse 1.5s infinite', animationDelay: `${i * 0.15}s` }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EDE6DF', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: '70%', height: 12, borderRadius: 4, background: '#EDE6DF', marginBottom: 4 }} />
              <div style={{ width: '40%', height: 10, borderRadius: 4, background: '#F5EDE4' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ width: '100%', fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0' }}>
          <button onClick={() => onNavigate?.(previousView || 'connectionGroups')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.brown500, display: 'flex', padding: 4 }}>
            <ChevronLeft size={20} />
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: COLORS.brown400, fontSize: 16 }}>User not found</p>
        </div>
      </div>
    );
  }

  // Visibility guard: block access if profile is hidden or connections-only for non-connections
  const visibility = profile.profile_visibility || 'public';
  if (!isOwnProfile && visibility === 'hidden') {
    return (
      <div style={{ width: '100%', fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0' }}>
          <button onClick={() => onNavigate?.(previousView || 'connectionGroups')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.brown500, display: 'flex', padding: 4 }}>
            <ChevronLeft size={20} />
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: COLORS.brown400, fontSize: 16 }}>This profile is not available</p>
        </div>
      </div>
    );
  }

  if (!isOwnProfile && visibility === 'connections' && !isConnected) {
    return (
      <div style={{ width: '100%', fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0' }}>
          <button onClick={() => onNavigate?.(previousView || 'connectionGroups')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.brown500, display: 'flex', padding: 4 }}>
            <ChevronLeft size={20} />
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: COLORS.brown400, fontSize: 16 }}>This profile is only visible to connections</p>
        </div>
      </div>
    );
  }

  const locationText = profile.city
    ? `${profile.city}${profile.state ? `, ${profile.state}` : ''}`
    : profile.state || null;

  const roleText = [profile.career, profile.industry].filter(Boolean).join(' \u00B7 ');

  return (
    <>
      <style>{keyframeStyles}</style>

      <div className="profile-container" style={{ fontFamily: FONT, minHeight: '100vh', maxWidth: '880px', margin: '0 auto' }}>

        {/* ─── Top Nav ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0', position: 'sticky', top: 0, zIndex: 10,
          ...fadeIn(0),
        }}>
          {hideBack ? (
            <div style={{ width: 28 }} />
          ) : (
            <button
              onClick={() => onNavigate?.(previousView || (isOwnProfile ? 'home' : 'connectionGroups'))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.brown500, display: 'flex', padding: 4 }}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <span style={{ fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 600, color: COLORS.brown900, flex: 1 }}>
            Profile
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isOwnProfile && onEditProfile && (
              <button
                onClick={onEditProfile}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: COLORS.brown500, display: 'flex', alignItems: 'center',
                  gap: 4, fontFamily: FONT, fontSize: 13, fontWeight: 600, padding: 4,
                }}
              >
                <Edit3 size={15} /> Edit
              </button>
            )}
            <button
              onClick={() => setShowShareModal(true)}
              style={{
                background: 'none',
                border: 'none', cursor: 'pointer',
                color: COLORS.brown500,
                display: 'flex', alignItems: 'center',
                gap: 4, fontFamily: FONT, fontSize: 13, fontWeight: 600,
                padding: '4px 6px', borderRadius: 6,
              }}
            >
              <Share2 size={15} />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* ─── Hero Section ─── */}
        <div style={{ paddingTop: 8, paddingBottom: 4, ...fadeIn(0.05) }}>
          {/* Avatar + Name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Avatar */}
            <div className="profile-avatar" style={{
              position: 'relative', borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(145deg, ${COLORS.brown300}, ${COLORS.accent}, ${COLORS.brown700})`,
              padding: 3,
            }}>
              {profile.profile_picture ? (
                <img
                  src={profile.profile_picture}
                  alt={profile.name}
                  className="profile-avatar-img"
                  style={{
                    borderRadius: '50%', objectFit: 'cover',
                    width: '100%', height: '100%',
                    border: `3px solid ${COLORS.white}`,
                  }}
                />
              ) : (
                <div
                  className="profile-avatar-img"
                  style={{
                    borderRadius: '50%',
                    width: '100%', height: '100%',
                    background: `linear-gradient(145deg, ${COLORS.accent}, ${COLORS.brown700})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: COLORS.white, fontFamily: DISPLAY_FONT, fontWeight: 600,
                    letterSpacing: 1,
                    border: `3px solid ${COLORS.white}`,
                  }}
                >
                  <span className="profile-avatar-initial">{(profile.name || '?')[0].toUpperCase()}</span>
                </div>
              )}
              <div style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 16, height: 16, borderRadius: 8,
                background: isActive ? COLORS.greenDot : '#9E9E9E',
                border: `3px solid ${COLORS.white}`,
              }} />
            </div>

            {/* Name + role + location */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="profile-name" style={{
                fontFamily: DISPLAY_FONT, fontWeight: 700,
                color: COLORS.brown900, letterSpacing: -0.3, margin: 0,
              }}>
                {profile.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                {profile.username && (
                  <span style={{
                    fontFamily: FONT, fontSize: 13, color: COLORS.brown300,
                    fontWeight: 500,
                  }}>
                    @{profile.username}
                  </span>
                )}
                {profile.last_active && (
                  <span style={{
                    fontFamily: FONT, fontSize: 12, fontWeight: 500,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    color: isActive ? COLORS.green : COLORS.brown400,
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: isActive ? COLORS.greenDot : '#C4A882',
                      display: 'inline-block',
                    }} />
                    {(() => {
                      if (isActive) return 'Active now';
                      const diff = Date.now() - new Date(profile.last_active).getTime();
                      const mins = Math.floor(diff / 60000);
                      if (mins < 60) return `${mins}m ago`;
                      const hours = Math.floor(mins / 60);
                      if (hours < 24) return `${hours}h ago`;
                      const days = Math.floor(hours / 24);
                      if (days < 7) return `${days}d ago`;
                      return `${Math.floor(days / 7)}w ago`;
                    })()}
                  </span>
                )}
              </div>

              {/* Hook / Headline */}
              {profile.hook && (
                <p className="profile-hook" style={{
                  fontFamily: FONT, color: COLORS.brown400,
                  marginTop: 4, lineHeight: 1.4, margin: '4px 0 0',
                  fontStyle: 'italic',
                }}>
                  {profile.hook}
                </p>
              )}

              {/* Role + location */}
              {(roleText || locationText) && (
                <div className="profile-role-row" style={{
                  display: 'flex', alignItems: 'center',
                  flexWrap: 'wrap', marginTop: 6,
                }}>
                  {roleText && (
                    <span className="profile-role-text" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontFamily: FONT, color: COLORS.brown500, fontWeight: 500,
                    }}>
                      <Briefcase size={14} color={COLORS.brown300} />
                      {roleText}
                    </span>
                  )}
                  {locationText && (
                    <span className="profile-role-text" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontFamily: FONT, color: COLORS.brown500, fontWeight: 500,
                    }}>
                      <MapPin size={14} color={COLORS.brown300} />
                      {locationText}
                    </span>
                  )}
                </div>
              )}

              {/* Connected badge */}
              {!isOwnProfile && isConnected && (
                <span style={{
                  display: 'inline-block', marginTop: 8,
                  padding: '4px 14px', background: COLORS.greenLight,
                  color: COLORS.green, fontSize: 12, fontWeight: 600, borderRadius: 20,
                }}>
                  Connected
                </span>
              )}
            </div>
          </div>

          {/* Tags: career stage + vibe */}
          {(profile.career_stage || profile.vibe_category) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {profile.career_stage && (
                <span style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 600,
                  color: CAREER_STAGE_COLORS[profile.career_stage]?.text || COLORS.green,
                  background: CAREER_STAGE_COLORS[profile.career_stage]?.bg || COLORS.greenLight,
                  borderRadius: 20, padding: '5px 14px',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  {CAREER_STAGE_LABELS[profile.career_stage] || profile.career_stage}
                </span>
              )}
              {profile.vibe_category && (
                <span style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 600,
                  color: VIBE_COLORS[profile.vibe_category]?.text || COLORS.blue,
                  background: VIBE_COLORS[profile.vibe_category]?.bg || COLORS.blueLight,
                  borderRadius: 20, padding: '5px 14px',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  {VIBE_LABELS[profile.vibe_category] || profile.vibe_category}
                </span>
              )}
              {profile.open_to_coffee_chat && (
                <span style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 600,
                  color: '#6B4F3A',
                  background: '#FDF3EB',
                  borderRadius: 20, padding: '5px 14px',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <Coffee size={12} /> Open to Coffee Chat
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── Stats ─── */}
        <div style={{ marginTop: 24, ...fadeIn(0.12) }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { value: meetupCount, label: 'Meetups' },
              { value: connectionCount, label: 'Connections' },
              { value: mutualCircles.length, label: 'Shared Circles' },
            ].map((stat, i) => (
              <div key={i} style={{
                flex: 1, background: COLORS.bgCard, borderRadius: 14,
                padding: '14px 8px', textAlign: 'center',
              }}>
                <div className="profile-stat-value" style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, color: COLORS.brown700, lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div className="profile-stat-label" style={{ fontFamily: FONT, color: COLORS.brown400, marginTop: 4, fontWeight: 500 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Empty state prompts (own profile, no connections or circles) ─── */}
        {isOwnProfile && (connectionCount === 0 || mutualCircles.length === 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, ...fadeIn(0.13) }}>
            {connectionCount === 0 && (
              <button
                onClick={() => onNavigate?.('allPeople')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 24,
                  background: COLORS.accent, border: 'none',
                  cursor: 'pointer', fontFamily: FONT,
                  fontSize: 13, fontWeight: 600, color: 'white',
                }}
              >
                <Users size={15} /> Find People
              </button>
            )}
            {mutualCircles.length === 0 && (
              <button
                onClick={() => onNavigate?.('allCircles')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 24,
                  background: COLORS.accent, border: 'none',
                  cursor: 'pointer', fontFamily: FONT,
                  fontSize: 13, fontWeight: 600, color: 'white',
                }}
              >
                <Heart size={15} /> Join a Circle
              </button>
            )}
          </div>
        )}

        {/* ─── Settings (own profile only) ─── */}
        {isOwnProfile && (<>
          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.brown100}, transparent)`, margin: '20px 0 0' }} />
          <div style={{ marginTop: 16, ...fadeIn(0.15) }}>
            <h3 style={{
              fontFamily: DISPLAY_FONT, fontSize: 16, fontWeight: 600,
              color: COLORS.brown700, margin: '0 0 8px',
            }}>
              Settings
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '4px 0', ...fadeIn(0.15) }}>
            {/* Hosting toggle */}
            <div
              onClick={async () => {
                const newVal = !profile.open_to_hosting;
                refreshProfile(prev => prev ? { ...prev, profile: { ...prev.profile, open_to_hosting: newVal } } : prev, { revalidate: false });
                await supabase.from('profiles').update({ open_to_hosting: newVal }).eq('id', currentUser.id);
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', cursor: 'pointer',
                borderBottom: '1px solid #F0E6D8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={15} style={{ color: COLORS.brown500 }} />
                <div>
                  <span className="profile-toggle-label" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: COLORS.brown700, display: 'block' }}>
                    Open to hosting meetups
                  </span>
                  <span className="profile-toggle-subtitle" style={{ fontFamily: FONT, fontSize: 12, color: COLORS.brown400, display: 'block', marginTop: 2 }}>
                    You'll be notified when people need your expertise
                  </span>
                </div>
              </div>
              <div style={{
                width: 44, height: 26, borderRadius: 13,
                background: profile.open_to_hosting ? COLORS.green : '#D4C4A8',
                transition: 'background 0.2s',
                position: 'relative', flexShrink: 0,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 11,
                  background: COLORS.white,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  position: 'absolute', top: 2,
                  left: profile.open_to_hosting ? 20 : 2,
                  transition: 'left 0.2s',
                }} />
              </div>
            </div>
            {/* Coffee chat toggle */}
            <div
              onClick={async () => {
                const newVal = !profile.open_to_coffee_chat;
                refreshProfile(prev => prev ? { ...prev, profile: { ...prev.profile, open_to_coffee_chat: newVal } } : prev, { revalidate: false });
                await supabase.from('profiles').update({ open_to_coffee_chat: newVal }).eq('id', currentUser.id);
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Coffee size={15} style={{ color: COLORS.brown500 }} />
                <div>
                  <span className="profile-toggle-label" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: COLORS.brown700, display: 'block' }}>
                    Open to coffee chats
                  </span>
                  <span className="profile-toggle-subtitle" style={{ fontFamily: FONT, fontSize: 12, color: COLORS.brown400, display: 'block', marginTop: 2 }}>
                    Show others you're available for 1:1 conversations
                  </span>
                </div>
              </div>
              <div style={{
                width: 44, height: 26, borderRadius: 13,
                background: profile.open_to_coffee_chat ? '#6B4F3A' : '#D4C4A8',
                transition: 'background 0.2s',
                position: 'relative', flexShrink: 0,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 11,
                  background: COLORS.white,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  position: 'absolute', top: 2,
                  left: profile.open_to_coffee_chat ? 20 : 2,
                  transition: 'left 0.2s',
                }} />
              </div>
            </div>
            {/* Transcription preference */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', cursor: 'default',
                borderTop: '1px solid #F0E6D8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15 }}>📝</span>
                <div>
                  <span className="profile-toggle-label" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: COLORS.brown700, display: 'block' }}>
                    Coffee chat transcription
                  </span>
                  <span className="profile-toggle-subtitle" style={{ fontFamily: FONT, fontSize: 12, color: COLORS.brown400, display: 'block', marginTop: 2 }}>
                    How to respond when someone requests transcription
                  </span>
                </div>
              </div>
              <select
                value={profile.transcription_preference || 'ask'}
                onChange={async (e) => {
                  const newVal = e.target.value;
                  refreshProfile(prev => prev ? { ...prev, profile: { ...prev.profile, transcription_preference: newVal } } : prev, { revalidate: false });
                  await supabase.from('profiles').update({ transcription_preference: newVal }).eq('id', currentUser.id);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: `1px solid ${COLORS.border || '#E8D5C3'}`,
                  fontFamily: FONT,
                  fontSize: 13,
                  color: COLORS.brown700,
                  background: COLORS.white,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <option value="ask">Always ask me</option>
                <option value="always">Always allow</option>
                <option value="never">Never allow</option>
              </select>
            </div>
            {/* Profile visibility */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', cursor: 'default',
                borderTop: '1px solid #F0E6D8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={15} style={{ color: COLORS.brown500 }} />
                <div>
                  <span className="profile-toggle-label" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: COLORS.brown700, display: 'block' }}>
                    Profile visibility
                  </span>
                  <span className="profile-toggle-subtitle" style={{ fontFamily: FONT, fontSize: 12, color: COLORS.brown400, display: 'block', marginTop: 2 }}>
                    Who can find and view your profile
                  </span>
                </div>
              </div>
              <select
                value={profile.profile_visibility || 'public'}
                onChange={async (e) => {
                  const newVal = e.target.value;
                  refreshProfile(prev => prev ? { ...prev, profile: { ...prev.profile, profile_visibility: newVal } } : prev, { revalidate: false });
                  await supabase.from('profiles').update({ profile_visibility: newVal }).eq('id', currentUser.id);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: `1px solid ${COLORS.border || '#E8D5C3'}`,
                  fontFamily: FONT,
                  fontSize: 13,
                  color: COLORS.brown700,
                  background: COLORS.white,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <option value="public">Open to all</option>
                <option value="connections">Connections only</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>

          {/* Preferred time slots picker */}
          {profile.open_to_coffee_chat && (
            <div style={{
              marginTop: 12, padding: '12px 14px', borderRadius: 12,
              background: '#FDF3EB', border: '1px solid #E8D5C3',
              ...fadeIn(0.2),
            }}>
              <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#6B4F3A', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> Preferred times
              </p>
              {/* Day chips */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                {DAYS.map(day => {
                  const selected = (profile.coffee_chat_slots?.days || []).includes(day);
                  return (
                    <button
                      key={day}
                      onClick={async () => {
                        const currentDays = profile.coffee_chat_slots?.days || [];
                        const newDays = selected ? currentDays.filter(d => d !== day) : [...currentDays, day];
                        const newSlots = { ...profile.coffee_chat_slots, days: newDays };
                        refreshProfile(prev => prev ? { ...prev, profile: { ...prev.profile, coffee_chat_slots: newSlots } } : prev, { revalidate: false });
                        await supabase.from('profiles').update({ coffee_chat_slots: newSlots }).eq('id', currentUser.id);
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        fontFamily: FONT, cursor: 'pointer', transition: 'all 0.15s',
                        border: selected ? '1.5px solid #6B4F3A' : '1.5px solid #D4C4A8',
                        background: selected ? '#6B4F3A' : COLORS.white,
                        color: selected ? COLORS.white : COLORS.brown500,
                      }}
                    >
                      {getDayLabel(day)}
                    </button>
                  );
                })}
              </div>
              {/* Time chips */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {TIMES.map(time => {
                  const selected = (profile.coffee_chat_slots?.times || []).includes(time);
                  return (
                    <button
                      key={time}
                      onClick={async () => {
                        const currentTimes = profile.coffee_chat_slots?.times || [];
                        const newTimes = selected ? currentTimes.filter(t => t !== time) : [...currentTimes, time];
                        const newSlots = { ...profile.coffee_chat_slots, times: newTimes };
                        refreshProfile(prev => prev ? { ...prev, profile: { ...prev.profile, coffee_chat_slots: newSlots } } : prev, { revalidate: false });
                        await supabase.from('profiles').update({ coffee_chat_slots: newSlots }).eq('id', currentUser.id);
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        fontFamily: FONT, cursor: 'pointer', transition: 'all 0.15s',
                        border: selected ? '1.5px solid #6B4F3A' : '1.5px solid #D4C4A8',
                        background: selected ? '#6B4F3A' : COLORS.white,
                        color: selected ? COLORS.white : COLORS.brown500,
                      }}
                    >
                      {getTimeLabel(time)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>)}

        {/* ─── Preferred slots display (other profiles) ─── */}
        {!isOwnProfile && profile.open_to_coffee_chat && formatCoffeeSlots(profile.coffee_chat_slots) && (
          <div style={{
            marginTop: 10, padding: '8px 14px', borderRadius: 10,
            background: '#FDF3EB',
            display: 'flex', alignItems: 'center', gap: 6,
            ...fadeIn(0.15),
          }}>
            <Clock size={12} style={{ color: '#6B4F3A', flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontSize: 12, color: '#6B4F3A' }}>
              Prefers {formatCoffeeSlots(profile.coffee_chat_slots, true)}
            </span>
          </div>
        )}

        {/* ─── Incoming Connection Request ─── */}
        {!isOwnProfile && !isConnected && hasIncomingRequest && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, marginTop: 20, padding: '14px 20px',
            background: COLORS.greenLight, borderRadius: 14,
            border: `1px solid ${COLORS.green}20`,
            ...fadeIn(0.1),
          }}>
            <span style={{ fontFamily: FONT, fontSize: 14, color: COLORS.brown700, fontWeight: 500 }}>
              {profile.name?.split(' ')[0]} wants to connect with you
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleAcceptConnection}
                disabled={accepting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 20px', background: COLORS.green, color: COLORS.white,
                  border: 'none', borderRadius: 12,
                  fontFamily: FONT, fontSize: 14, fontWeight: 600,
                  cursor: accepting ? 'default' : 'pointer',
                  opacity: accepting ? 0.7 : 1,
                }}
              >
                <Check size={16} />
                {accepting ? 'Accepting...' : 'Accept'}
              </button>
              <button
                onClick={handleIgnoreConnection}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 20px', background: 'transparent', color: COLORS.brown500,
                  border: `1.5px solid ${COLORS.brown200}`, borderRadius: 12,
                  fontFamily: FONT, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Ignore
              </button>
            </div>
          </div>
        )}

        {/* ─── Connect CTA (not connected, no incoming request) ─── */}
        {!isOwnProfile && !isConnected && !hasIncomingRequest && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, ...fadeIn(0.1) }}>
            <button
              className="profile-cta-btn"
              onClick={handleSendConnectionRequest}
              disabled={connecting || hasSentRequest}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: 8,
                background: hasSentRequest ? COLORS.greenLight : COLORS.accent,
                color: hasSentRequest ? COLORS.green : COLORS.white,
                border: hasSentRequest ? `1.5px solid ${COLORS.green}40` : 'none',
                borderRadius: 14,
                fontFamily: FONT, fontWeight: 600,
                cursor: hasSentRequest ? 'default' : connecting ? 'default' : 'pointer',
                opacity: connecting ? 0.7 : 1,
              }}
            >
              {hasSentRequest ? (
                <><Check size={16} /> Request Sent</>
              ) : connecting ? (
                'Sending...'
              ) : (
                <><Users size={16} /> Connect</>
              )}
            </button>
          </div>
        )}

        {/* ─── Visitor CTA (connected, not own profile) ─── */}
        {!isOwnProfile && isConnected && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, ...fadeIn(0.1) }}>
            <button
              className="profile-cta-btn"
              onClick={() => onNavigate?.('messages', { chatId: userId, chatType: 'user' })}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, background: COLORS.accent, color: COLORS.white, border: 'none',
                borderRadius: 14,
                fontFamily: FONT, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <MessageCircle size={16} /> Message
            </button>
            <button
              className="profile-cta-btn"
              onClick={() => onNavigate?.('scheduleMeetup', {
                type: 'coffee',
                scheduleConnectionId: userId,
                scheduleConnectionName: profile.name,
              })}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, background: 'transparent', color: COLORS.brown600,
                border: `1.5px solid ${COLORS.brown200}`,
                borderRadius: 14,
                fontFamily: FONT, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Coffee size={16} /> Coffee Chat
            </button>
          </div>
        )}

        {/* ─── Shared Circles ─── */}
        {mutualCircles.length > 0 && (
          <>
            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.brown100}, transparent)`, margin: '24px 0' }} />
            <div style={fadeIn(0.21)}>
              <div className="profile-section-label" style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: FONT, fontWeight: 700,
                color: COLORS.brown700, marginBottom: 12,
                textTransform: 'uppercase', letterSpacing: 0.8,
              }}>
                <Users size={14} color={COLORS.brown400} />
                Shared Circles
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mutualCircles.map(circle => {
                  const memberCount = circle.connection_group_members?.[0]?.count;
                  return (
                    <button
                      className="profile-circle-chip"
                      key={circle.id}
                      onClick={() => onNavigate?.('circleDetail', { circleId: circle.id })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: COLORS.bgCard, border: 'none', borderRadius: 14,
                        cursor: 'pointer', width: '100%',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `linear-gradient(135deg, ${COLORS.brown200}, ${COLORS.brown100})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, flexShrink: 0,
                      }}>
                        <Users size={16} color={COLORS.brown500} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="profile-circle-name" style={{ fontFamily: FONT, fontWeight: 600, color: COLORS.brown700 }}>{circle.name}</div>
                        {memberCount != null && (
                          <div style={{ fontFamily: FONT, fontSize: 11.5, color: COLORS.brown400, marginTop: 1 }}>
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          </div>
                        )}
                      </div>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M4.5 2.5L8 6L4.5 9.5" stroke={COLORS.brown300} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ─── Recent Activity ─── */}
        {activities.length > 0 && (
          <>
            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.brown100}, transparent)`, margin: '24px 0' }} />
            <div style={fadeIn(0.24)}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: FONT, fontWeight: 700, fontSize: 11,
                color: COLORS.brown700, marginBottom: 14,
                textTransform: 'uppercase', letterSpacing: 0.8,
              }}>
                <Activity size={14} color={COLORS.brown400} />
                Recent Activity
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {activities.map((activity, i) => {
                  const config = ACTIVITY_CONFIG[activity.event_type] || ACTIVITY_CONFIG.connection;
                  const Icon = config.icon;
                  const meta = activity.metadata || {};
                  let label = config.label;
                  let subtitle = null;

                  if (activity.event_type === 'coffee_scheduled' || activity.event_type === 'coffee_live') {
                    label = activity._targetName ? `Coffee chat with ${activity._targetName}` : config.label;
                    if (meta.topic && meta.topic !== 'Coffee Chat') subtitle = meta.topic;
                    if (meta.scheduled_time) {
                      const d = new Date(meta.scheduled_time);
                      subtitle = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    }
                  } else if (activity.event_type === 'community_event') {
                    label = meta.title || 'Hosted a meetup';
                    const parts = [];
                    if (meta.date) {
                      const d = new Date(meta.date + 'T00:00:00');
                      parts.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
                    }
                    if (meta.location) parts.push(meta.location);
                    if (parts.length) subtitle = parts.join(' · ');
                  } else if (activity.event_type === 'circle_join') {
                    label = meta.circle_name ? `Joined ${meta.circle_name}` : config.label;
                  } else if (activity.event_type === 'connection') {
                    label = activity._targetName ? `Connected with ${activity._targetName}` : config.label;
                  } else if (activity.event_type === 'member_joined') {
                    label = 'Joined the community';
                    const parts = [meta.career, meta.industry].filter(Boolean);
                    if (parts.length) subtitle = parts.join(' · ');
                  }

                  return (
                    <div key={activity.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '11px 0',
                      borderBottom: i < activities.length - 1 ? `1px solid ${COLORS.brown100}` : 'none',
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: config.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginTop: 1,
                      }}>
                        <Icon size={15} color={config.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="profile-activity-label" style={{
                          fontFamily: FONT, fontSize: 13.5, fontWeight: 500,
                          color: COLORS.brown700,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {label}
                        </div>
                        {subtitle && (
                          <div className="profile-activity-time" style={{
                            fontFamily: FONT, fontSize: 12, color: COLORS.brown400,
                            marginTop: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {subtitle}
                          </div>
                        )}
                      </div>
                      <span className="profile-activity-time" style={{
                        fontFamily: FONT, fontSize: 11, color: COLORS.brown400,
                        flexShrink: 0, marginTop: 2,
                      }}>
                        {timeAgo(activity.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ─── Remove Connection (visitor only) ─── */}
        {!isOwnProfile && isConnected && (
          <>
            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.brown100}, transparent)`, margin: '24px 0' }} />
            <div style={fadeIn(0.27)}>
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, width: '100%', padding: 12,
                    background: 'transparent', color: COLORS.red,
                    border: `1.5px solid rgba(184,92,74,0.2)`,
                    borderRadius: 14, fontFamily: FONT, fontSize: 14,
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <UserMinus size={16} /> Remove Connection
                </button>
              ) : (
                <div style={{
                  background: COLORS.redBg, borderRadius: 14,
                  padding: 16, border: '1px solid rgba(184,92,74,0.12)',
                }}>
                  <p style={{
                    fontFamily: FONT, fontSize: 14, color: COLORS.brown600,
                    lineHeight: 1.5, margin: '0 0 14px',
                  }}>
                    Remove connection with {profile.name}? You'll no longer see each other in your connections.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => setShowConfirm(false)}
                      style={{
                        flex: 1, padding: 10, background: 'transparent',
                        color: COLORS.brown600, border: `1.5px solid ${COLORS.brown200}`,
                        borderRadius: 12, fontFamily: FONT, fontSize: 14,
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRemoveConnection}
                      disabled={removing}
                      style={{
                        flex: 1, padding: 10, background: COLORS.red,
                        color: COLORS.white, border: 'none',
                        borderRadius: 12, fontFamily: FONT, fontSize: 14,
                        fontWeight: 600, cursor: 'pointer',
                        opacity: removing ? 0.6 : 1,
                      }}
                    >
                      {removing ? 'Removing...' : 'Yes, Remove'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── Report User (visitor only) ─── */}
        {!isOwnProfile && (
          <div style={{ marginTop: 20, ...fadeIn(0.3) }}>
            {!showReport && !reportSubmitted && (
              <button
                onClick={() => setShowReport(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, width: '100%', padding: 10,
                  background: 'none', color: COLORS.brown400,
                  border: 'none', fontFamily: FONT, fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <Flag size={14} /> Report
              </button>
            )}

            {showReport && !reportSubmitted && (
              <div style={{
                background: COLORS.bgCard, borderRadius: 14,
                padding: 16, border: `1px solid ${COLORS.brown100}`,
              }}>
                <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: COLORS.brown700, margin: '0 0 12px' }}>
                  Why are you reporting this account?
                </p>
                {[
                  'Spam or fake account',
                  'Harassment or abuse',
                  'Inappropriate content',
                  'Impersonation',
                  'Other',
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setReportReason(reason)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '10px 12px', marginBottom: 6,
                      background: reportReason === reason ? 'rgba(139,111,92,0.1)' : COLORS.white,
                      border: `1.5px solid ${reportReason === reason ? COLORS.accent : COLORS.brown100}`,
                      borderRadius: 10, fontFamily: FONT, fontSize: 14,
                      color: COLORS.brown700, cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {reportReason === reason && <Check size={16} style={{ color: COLORS.accent }} />}
                    {reason}
                  </button>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    onClick={() => { setShowReport(false); setReportReason(null); }}
                    style={{
                      flex: 1, padding: 10, background: 'transparent',
                      color: COLORS.brown600, border: `1.5px solid ${COLORS.brown200}`,
                      borderRadius: 12, fontFamily: FONT, fontSize: 14,
                      fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!reportReason || reportSubmitting}
                    onClick={async () => {
                      setReportSubmitting(true);
                      try {
                        await apiFetch('/api/feedback', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            userId: currentUser.id,
                            category: 'report',
                            subject: `Report: ${profile.name} (${reportReason})`,
                            message: `Reported user: ${profile.name} (ID: ${profile.id})\nReason: ${reportReason}`,
                            pageContext: 'user-profile',
                          }),
                        });
                        setReportSubmitted(true);
                        setShowReport(false);
                      } catch (err) {
                        console.error('Report failed:', err);
                      } finally {
                        setReportSubmitting(false);
                      }
                    }}
                    style={{
                      flex: 1, padding: 10, background: reportReason ? COLORS.red : COLORS.brown200,
                      color: COLORS.white, border: 'none',
                      borderRadius: 12, fontFamily: FONT, fontSize: 14,
                      fontWeight: 600, cursor: reportReason ? 'pointer' : 'default',
                      opacity: reportSubmitting ? 0.6 : 1,
                    }}
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            )}

            {reportSubmitted && (
              <p style={{
                textAlign: 'center', fontFamily: FONT, fontSize: 13,
                color: COLORS.green, padding: 10,
              }}>
                <Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Thanks for reporting. We'll review this.
              </p>
            )}
          </div>
        )}

        {/* ─── Own Profile Footer ─── */}
        {isOwnProfile && (
          <>
            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.brown100}, transparent)`, margin: '24px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', ...fadeIn(0.3) }}>
              {onShowTutorial && (
                <button
                  onClick={onShowTutorial}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: FONT, fontSize: 13, color: COLORS.brown400,
                    fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <BookOpen size={14} /> App Tutorial
                </button>
              )}
              {currentUser.role === 'admin' && onAdminDashboard && (
                <button
                  onClick={onAdminDashboard}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: FONT, fontSize: 13, color: COLORS.brown400,
                    fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Shield size={14} /> Admin
                </button>
              )}
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: FONT, fontSize: 13, color: COLORS.red,
                    fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <LogOut size={14} /> Log Out
                </button>
              )}
            </div>
          </>
        )}

        {/* ─── Tagline ─── */}
        <div className="profile-tagline" style={{ textAlign: 'center', ...fadeIn(0.33) }}>
          <span style={{
            fontFamily: DISPLAY_FONT, color: COLORS.brown300, fontStyle: 'italic',
          }}>
            Find your circle. Move forward.
          </span>
        </div>
      </div>

      {/* ─── Share Profile Modal ─── */}
      {showShareModal && (
        <ShareProfileModal
          userId={userId}
          username={profile?.username}
          name={profile?.name}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  );
}

const keyframeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .profile-container { width: 100%; padding: 0 0 60px; }
  .profile-avatar { width: 96px; height: 96px; }
  .profile-avatar-initial { font-size: 38px; }
  .profile-name { font-size: 28px; }
  .profile-hook { font-size: 14.5px; max-width: 90%; }
  .profile-role-row { gap: 14px; margin-top: 14px; }
  .profile-role-text { font-size: 13px; }
  .profile-stat-value { font-size: 22px; }
  .profile-stat-label { font-size: 11.5px; }
  .profile-cta-btn { padding: 12px 22px; font-size: 14px; }
  .profile-section-label { font-size: 14px; }
  .profile-circle-chip { padding: 12px 16px; }
  .profile-circle-name { font-size: 13.5px; }
  .profile-tagline { font-size: 16px; margin-top: 40px; }
  .profile-toggle-label { font-size: 14px !important; }
  .profile-toggle-subtitle { font-size: 12px !important; }
  .profile-activity-label { font-size: 13.5px !important; }
  .profile-activity-time { font-size: 11px !important; }

  @media (min-width: 640px) {
    .profile-container { padding: 0 0 72px; }
    .profile-avatar { width: 116px; height: 116px; }
    .profile-avatar-initial { font-size: 46px; }
    .profile-name { font-size: 34px; }
    .profile-hook { font-size: 15.5px; max-width: 80%; }
    .profile-role-row { gap: 18px; margin-top: 16px; }
    .profile-role-text { font-size: 14px; }
    .profile-stat-value { font-size: 26px; }
    .profile-stat-label { font-size: 12.5px; }
    .profile-cta-btn { padding: 14px 28px; font-size: 15px; }
    .profile-section-label { font-size: 15px; }
    .profile-circle-chip { padding: 14px 18px; }
    .profile-circle-name { font-size: 14.5px; }
    .profile-tagline { font-size: 17px; margin-top: 48px; }
    .profile-toggle-label { font-size: 15px !important; }
    .profile-toggle-subtitle { font-size: 13px !important; }
    .profile-activity-label { font-size: 14px !important; }
    .profile-activity-time { font-size: 12px !important; }
  }

  @media (min-width: 1024px) {
    .profile-container { padding: 0 0 80px; }
    .profile-avatar { width: 128px; height: 128px; }
    .profile-avatar-initial { font-size: 50px; }
    .profile-name { font-size: 38px; }
    .profile-hook { font-size: 16px; max-width: 70%; }
    .profile-role-row { gap: 20px; margin-top: 18px; }
    .profile-role-text { font-size: 15px; }
    .profile-stat-value { font-size: 28px; }
    .profile-stat-label { font-size: 13px; }
    .profile-cta-btn { padding: 14px 32px; font-size: 15px; }
    .profile-section-label { font-size: 15px; }
    .profile-circle-chip { padding: 16px 20px; }
    .profile-circle-name { font-size: 15px; }
    .profile-tagline { font-size: 18px; margin-top: 56px; }
  }
`;

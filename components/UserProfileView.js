'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Briefcase, MessageCircle, Coffee, UserMinus, Users, TrendingUp, Sparkles, Crown, Heart, Rocket } from 'lucide-react';

export default function UserProfileView({ currentUser, supabase, userId, onNavigate, previousView, onConnectionRemoved }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mutualCircles, setMutualCircles] = useState([]);
  const [connectionCount, setConnectionCount] = useState(0);

  useEffect(() => {
    if (userId) loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      // Fetch full profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);

      // Check if connected (mutual match) & count their connections
      const { data: matches } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id });
      const matchedIds = (matches || []).map(m => m.matched_user_id);
      setIsConnected(matchedIds.includes(userId));

      // Count their connections
      if (userId === currentUser.id) {
        // Viewing own profile — use our own matches
        setConnectionCount((matches || []).length);
      } else {
        // Count mutual connections (their matches that overlap with ours)
        const { data: theirMatches } = await supabase
          .rpc('get_mutual_matches', { for_user_id: userId });
        setConnectionCount((theirMatches || []).length);
      }

      // Load mutual circles
      const { data: myCircles } = await supabase
        .from('connection_group_members')
        .select('group_id')
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted');

      const { data: theirCircles } = await supabase
        .from('connection_group_members')
        .select('group_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (myCircles && theirCircles) {
        const myGroupIds = new Set(myCircles.map(c => c.group_id));
        const sharedIds = theirCircles.filter(c => myGroupIds.has(c.group_id)).map(c => c.group_id);

        if (sharedIds.length > 0) {
          const { data: circles } = await supabase
            .from('connection_groups')
            .select('id, name')
            .in('id', sharedIds);
          setMutualCircles(circles || []);
        }
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveConnection = async () => {
    setRemoving(true);
    try {
      await supabase
        .from('user_interests')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('interested_in_user_id', userId);

      await supabase
        .from('user_interests')
        .delete()
        .eq('user_id', userId)
        .eq('interested_in_user_id', currentUser.id);

      setIsConnected(false);
      setShowConfirm(false);
      onConnectionRemoved?.(userId);
      onNavigate?.(previousView || 'connectionGroups');
    } catch (err) {
      console.error('Error removing connection:', err);
      alert('Failed to remove connection. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  const isActive = profile?.last_active &&
    (Date.now() - new Date(profile.last_active).getTime()) < 10 * 60 * 1000;

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>Loading profile...</p>
        <style>{keyframeStyles}</style>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={() => onNavigate?.(previousView || 'connectionGroups')}>
            <ChevronLeft size={22} color="#3F1906" />
          </button>
        </div>
        <div style={styles.emptyState}>
          <p style={{ color: '#8B7355', fontSize: '16px' }}>User not found</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>{keyframeStyles}</style>

      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={() => onNavigate?.(previousView || 'connectionGroups')}>
          <ChevronLeft size={22} color="#3F1906" />
        </button>
        <h2 style={styles.headerTitle}>Profile</h2>
        <div style={{ width: 40 }}></div>
      </div>

      {/* Profile Card */}
      <div style={styles.profileCard}>
        {/* Avatar */}
        <div style={styles.avatarSection}>
          <div style={{ position: 'relative' }}>
            {profile.profile_picture ? (
              <img src={profile.profile_picture} alt={profile.name} style={styles.avatar} />
            ) : (
              <div style={styles.avatarFallback}>
                {profile.name?.[0] || '?'}
              </div>
            )}
            <span style={{
              ...styles.statusDot,
              backgroundColor: isActive ? '#4CAF50' : '#9E9E9E',
            }}></span>
          </div>

          <h1 style={styles.name}>{profile.name}</h1>

          {isConnected && (
            <span style={styles.connectedBadge}>Connected</span>
          )}
        </div>

        {/* Info Cards */}
        <div style={styles.infoSection}>
          {profile.career && (
            <div style={styles.infoCard}>
              <div style={styles.infoIcon}>
                <Briefcase size={16} color="#8B7355" />
              </div>
              <div>
                <p style={styles.infoLabel}>{profile.career}</p>
                {profile.industry && <p style={styles.infoSub}>{profile.industry}</p>}
              </div>
            </div>
          )}

          {(profile.city || profile.state) && (
            <div style={styles.infoCard}>
              <div style={styles.infoIcon}>
                <MapPin size={16} color="#8B7355" />
              </div>
              <div>
                <p style={styles.infoLabel}>
                  {profile.city ? `${profile.city}${profile.state ? `, ${profile.state}` : ''}` : profile.state}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Career Stage & Vibe */}
        {(profile.career_stage || profile.vibe_category) && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', justifyContent: 'center' }}>
            {profile.career_stage && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 14px',
                backgroundColor: CAREER_STAGE_COLORS[profile.career_stage]?.bg || '#F5EDE4',
                color: CAREER_STAGE_COLORS[profile.career_stage]?.text || '#5E4530',
                fontSize: '12px',
                fontWeight: '600',
                borderRadius: '20px',
              }}>
                {CAREER_STAGE_LABELS[profile.career_stage] || profile.career_stage}
              </span>
            )}
            {profile.vibe_category && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 14px',
                backgroundColor: VIBE_COLORS[profile.vibe_category]?.bg || '#F5EDE4',
                color: VIBE_COLORS[profile.vibe_category]?.text || '#5E4530',
                fontSize: '12px',
                fontWeight: '600',
                borderRadius: '20px',
              }}>
                {VIBE_LABELS[profile.vibe_category] || profile.vibe_category}
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <span style={styles.statNumber}>{profile.meetups_attended || 0}</span>
            <span style={styles.statLabel}>Meetups</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statNumber}>{connectionCount}</span>
            <span style={styles.statLabel}>Connections</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statNumber}>{mutualCircles.length}</span>
            <span style={styles.statLabel}>Shared Circles</span>
          </div>
        </div>

        {/* Bio / Hook */}
        {(profile.bio || profile.hook) && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>About</h3>
            {profile.hook && (
              <p style={styles.hookText}>"{profile.hook}"</p>
            )}
            {profile.bio && (
              <p style={styles.bioText}>{profile.bio}</p>
            )}
          </div>
        )}

        {/* Mutual Circles */}
        {mutualCircles.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <Users size={14} style={{ marginRight: '6px' }} />
              Shared Circles
            </h3>
            <div style={styles.tagsList}>
              {mutualCircles.map(circle => (
                <button
                  key={circle.id}
                  onClick={() => onNavigate?.('circleDetail', { circleId: circle.id })}
                  style={styles.circleChip}
                >
                  {circle.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons (only if connected) */}
        {isConnected && (
          <>
            <div style={styles.actions}>
              <button
                style={styles.primaryBtn}
                onClick={() => onNavigate?.('messages', { chatId: userId, chatType: 'user' })}
              >
                <MessageCircle size={16} />
                Message
              </button>
              <button
                style={styles.secondaryBtn}
                onClick={() => onNavigate?.('scheduleMeetup', {
                  type: 'coffee',
                  scheduleConnectionId: userId,
                  scheduleConnectionName: profile.name,
                })}
              >
                <Coffee size={16} />
                Coffee Chat
              </button>
            </div>

            {/* Remove Connection */}
            <div style={styles.dangerSection}>
              {!showConfirm ? (
                <button style={styles.removeBtn} onClick={() => setShowConfirm(true)}>
                  <UserMinus size={16} />
                  Remove Connection
                </button>
              ) : (
                <div style={styles.confirmBox}>
                  <p style={styles.confirmText}>
                    Remove connection with {profile.name}? You'll no longer see each other in your connections.
                  </p>
                  <div style={styles.confirmActions}>
                    <button style={styles.cancelBtn} onClick={() => setShowConfirm(false)}>
                      Cancel
                    </button>
                    <button
                      style={{ ...styles.confirmRemoveBtn, opacity: removing ? 0.6 : 1 }}
                      onClick={handleRemoveConnection}
                      disabled={removing}
                    >
                      {removing ? 'Removing...' : 'Yes, Remove'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const CAREER_STAGE_LABELS = {
  emerging: 'Early Career',
  scaling: 'Mid-Career',
  leading: 'Manager / Director',
  legacy: 'Executive / Founder',
};

const CAREER_STAGE_COLORS = {
  emerging: { bg: '#ECFDF5', text: '#059669' },
  scaling: { bg: '#EEF2FF', text: '#4F46E5' },
  leading: { bg: '#F5F3FF', text: '#7C3AED' },
  legacy: { bg: '#FFF7ED', text: '#D97706' },
};

const VIBE_LABELS = {
  advice: 'Looking for advice',
  vent: 'Wants to vent',
  grow: 'Wants to grow',
};

const VIBE_COLORS = {
  advice: { bg: '#FFF1F2', text: '#E11D48' },
  vent: { bg: '#FFF7ED', text: '#EA580C' },
  grow: { bg: '#ECFDF5', text: '#059669' },
};

const keyframeStyles = `
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const styles = {
  container: {
    minHeight: '100vh',
    padding: '0 16px 32px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E8DDD0',
    borderTopColor: '#8B6F5C',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    marginTop: '12px',
    color: '#8B7355',
    fontSize: '14px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
  },
  backButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#3F1906',
    fontFamily: '"Lora", serif',
  },
  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(8px)',
    borderRadius: '20px',
    border: '1px solid rgba(139,111,92,0.15)',
    padding: '28px 24px',
  },
  avatarSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px',
  },
  avatar: {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid rgba(139,111,92,0.2)',
  },
  avatarFallback: {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    backgroundColor: '#8B6F5C',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    fontWeight: '600',
    color: 'white',
  },
  statusDot: {
    position: 'absolute',
    bottom: '4px',
    right: '4px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '3px solid white',
  },
  name: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#3F1906',
    fontFamily: '"Lora", serif',
    margin: '12px 0 6px',
    textAlign: 'center',
  },
  connectedBadge: {
    padding: '4px 14px',
    backgroundColor: 'rgba(168,230,207,0.2)',
    color: '#2E7D5B',
    fontSize: '12px',
    fontWeight: '600',
    borderRadius: '20px',
  },
  statsRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  statCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '14px 8px',
    backgroundColor: '#F5EDE4',
    borderRadius: '14px',
  },
  statNumber: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#3F1906',
    fontFamily: '"Lora", serif',
  },
  statLabel: {
    fontSize: '11px',
    color: '#8B7355',
    fontWeight: '500',
    marginTop: '2px',
  },
  infoSection: {
    marginBottom: '20px',
  },
  infoCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid rgba(139,111,92,0.1)',
    marginBottom: '8px',
  },
  infoIcon: {
    width: '36px',
    height: '36px',
    backgroundColor: '#F5EDE4',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#3F1906',
    margin: 0,
  },
  infoSub: {
    fontSize: '12px',
    color: '#8B7355',
    margin: 0,
  },
  section: {
    borderTop: '1px solid rgba(139,111,92,0.1)',
    paddingTop: '18px',
    marginBottom: '18px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3F1906',
    margin: '0 0 10px',
    fontFamily: '"Lora", serif',
    display: 'flex',
    alignItems: 'center',
  },
  hookText: {
    fontSize: '14px',
    color: '#6B5744',
    fontStyle: 'italic',
    backgroundColor: '#FFF8F0',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(139,111,92,0.1)',
    margin: '0 0 8px',
    lineHeight: '1.5',
  },
  bioText: {
    fontSize: '14px',
    color: '#6B5744',
    lineHeight: '1.6',
    margin: 0,
  },
  tagsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  tag: {
    padding: '5px 12px',
    backgroundColor: '#F5EDE4',
    color: '#5E4530',
    fontSize: '13px',
    fontWeight: '500',
    borderRadius: '20px',
  },
  circleChip: {
    padding: '6px 14px',
    backgroundColor: 'rgba(139,111,92,0.08)',
    color: '#5E4530',
    fontSize: '13px',
    fontWeight: '500',
    borderRadius: '20px',
    border: '1px solid rgba(139,111,92,0.15)',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  primaryBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: '#5E4530',
    color: '#FFF8F0',
    border: 'none',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'rgba(94,69,48,0.1)',
    color: '#5E4530',
    border: '1.5px solid rgba(94,69,48,0.2)',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  dangerSection: {
    borderTop: '1px solid rgba(139,111,92,0.1)',
    paddingTop: '18px',
  },
  removeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    backgroundColor: 'transparent',
    color: '#C0392B',
    border: '1.5px solid rgba(192,57,43,0.2)',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  confirmBox: {
    backgroundColor: 'rgba(192,57,43,0.05)',
    borderRadius: '14px',
    padding: '16px',
    border: '1px solid rgba(192,57,43,0.12)',
  },
  confirmText: {
    fontSize: '14px',
    color: '#6B5744',
    lineHeight: '1.5',
    margin: '0 0 14px',
  },
  confirmActions: {
    display: 'flex',
    gap: '10px',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: 'transparent',
    color: '#6B5744',
    border: '1.5px solid rgba(139,111,92,0.2)',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  confirmRemoveBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#C0392B',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
};

'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Briefcase, MessageCircle, Coffee, UserMinus, Users, Edit3, BookOpen, Shield, LogOut } from 'lucide-react';

const COLORS = {
  bg: '#FAF6F1',
  bgCard: '#F5EDE4',
  bgCardHover: '#EDE3D7',
  brown900: '#3D2B1F',
  brown700: '#5C4033',
  brown600: '#6B4C3B',
  brown500: '#8B6F5E',
  brown400: '#A68B7B',
  brown300: '#C4A882',
  brown200: '#D4C4A8',
  brown100: '#E8DDD0',
  accent: '#7B5B3A',
  accentLight: '#A67C52',
  green: '#4A7C59',
  greenLight: '#E8F2EB',
  greenDot: '#5BA36B',
  white: '#FFFFFF',
  shadow: 'rgba(61,43,31,0.08)',
  shadowMd: 'rgba(61,43,31,0.12)',
  red: '#B85C4A',
  redBg: '#FDF0ED',
  blue: '#4A6A8B',
  blueLight: '#EBF1F7',
};

const FONT = "'DM Sans', 'Nunito', system-ui, sans-serif";
const DISPLAY_FONT = "'Playfair Display', 'Georgia', serif";

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

export default function UserProfileView({ currentUser, supabase, userId, onNavigate, previousView, onConnectionRemoved, onEditProfile, onShowTutorial, onSignOut, onAdminDashboard }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mutualCircles, setMutualCircles] = useState([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const isOwnProfile = userId === currentUser.id;

  useEffect(() => {
    if (userId) loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);

      const { data: matches } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id });
      const matchedIds = (matches || []).map(m => m.matched_user_id);
      setIsConnected(matchedIds.includes(userId));

      if (userId === currentUser.id) {
        setConnectionCount((matches || []).length);
      } else {
        const { data: theirMatches } = await supabase
          .rpc('get_mutual_matches', { for_user_id: userId });
        setConnectionCount((theirMatches || []).length);
      }

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
            .select('id, name, connection_group_members(count)')
            .in('id', sharedIds);
          setMutualCircles(circles || []);
        }
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setLoaded(true), 50);
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

  const fadeIn = (delay = 0) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(12px)',
    transition: `all 0.45s ease ${delay}s`,
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: FONT }}>
        <style>{keyframeStyles}</style>
        <div style={{ width: 32, height: 32, border: `3px solid ${COLORS.brown100}`, borderTopColor: COLORS.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ marginTop: 12, color: COLORS.brown400, fontSize: 14 }}>Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px', fontFamily: FONT }}>
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

  const locationText = profile.city
    ? `${profile.city}${profile.state ? `, ${profile.state}` : ''}`
    : profile.state || null;

  const roleText = [profile.career, profile.industry].filter(Boolean).join(' \u00B7 ');

  return (
    <>
      <style>{keyframeStyles}</style>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px 60px', fontFamily: FONT, minHeight: '100vh' }}>

        {/* ─── Top Nav ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0', position: 'sticky', top: 0, zIndex: 10,
          ...fadeIn(0),
        }}>
          <button
            onClick={() => onNavigate?.(previousView || (isOwnProfile ? 'home' : 'connectionGroups'))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.brown500, display: 'flex', padding: 4 }}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 600, color: COLORS.brown900 }}>
            Profile
          </span>
          {isOwnProfile && onEditProfile ? (
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
          ) : (
            <div style={{ width: 40 }} />
          )}
        </div>

        {/* ─── Hero Section ─── */}
        <div style={{ textAlign: 'center', paddingTop: 8, paddingBottom: 4, ...fadeIn(0.05) }}>
          {/* Avatar */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ position: 'relative', width: 96, height: 96 }}>
              {profile.profile_picture ? (
                <img
                  src={profile.profile_picture}
                  alt={profile.name}
                  style={{
                    width: 96, height: 96, borderRadius: 48, objectFit: 'cover',
                    boxShadow: `0 4px 16px ${COLORS.shadowMd}`,
                  }}
                />
              ) : (
                <div style={{
                  width: 96, height: 96, borderRadius: 48,
                  background: `linear-gradient(145deg, ${COLORS.accent}, ${COLORS.brown700})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: COLORS.white, fontFamily: DISPLAY_FONT, fontWeight: 600,
                  fontSize: 38, letterSpacing: 1,
                  boxShadow: `0 4px 16px ${COLORS.shadowMd}`,
                }}>
                  {(profile.name || '?')[0].toUpperCase()}
                </div>
              )}
              <div style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 16, height: 16, borderRadius: 8,
                background: isActive ? COLORS.greenDot : '#9E9E9E',
                border: `3px solid ${COLORS.white}`,
              }} />
            </div>
          </div>

          {/* Name */}
          <h1 style={{
            fontFamily: DISPLAY_FONT, fontSize: 30, fontWeight: 700,
            color: COLORS.brown900, letterSpacing: -0.3, margin: 0,
          }}>
            {profile.name}
          </h1>

          {/* Hook / Headline */}
          {profile.hook && (
            <p style={{
              fontFamily: FONT, fontSize: 14.5, color: COLORS.brown400,
              marginTop: 6, lineHeight: 1.4, maxWidth: 340, margin: '6px auto 0',
              fontStyle: 'italic',
            }}>
              {profile.hook}
            </p>
          )}

          {/* Connected badge */}
          {!isOwnProfile && isConnected && (
            <span style={{
              display: 'inline-block', marginTop: 10,
              padding: '4px 14px', background: COLORS.greenLight,
              color: COLORS.green, fontSize: 12, fontWeight: 600, borderRadius: 20,
            }}>
              Connected
            </span>
          )}

          {/* Compact role + location */}
          {(roleText || locationText) && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 14, marginTop: 14, flexWrap: 'wrap',
            }}>
              {roleText && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: FONT, fontSize: 13, color: COLORS.brown500, fontWeight: 500,
                }}>
                  <Briefcase size={14} color={COLORS.brown300} />
                  {roleText}
                </span>
              )}
              {locationText && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontFamily: FONT, fontSize: 13, color: COLORS.brown500, fontWeight: 500,
                }}>
                  <MapPin size={14} color={COLORS.brown300} />
                  {locationText}
                </span>
              )}
            </div>
          )}

          {/* Tags: career stage + vibe */}
          {(profile.career_stage || profile.vibe_category) && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
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
            </div>
          )}
        </div>

        {/* ─── Visitor CTA (connected, not own profile) ─── */}
        {!isOwnProfile && isConnected && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, ...fadeIn(0.1) }}>
            <button
              onClick={() => onNavigate?.('messages', { chatId: userId, chatType: 'user' })}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, background: COLORS.accent, color: COLORS.white, border: 'none',
                borderRadius: 14, padding: '12px 22px',
                fontFamily: FONT, fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              <MessageCircle size={16} /> Message
            </button>
            <button
              onClick={() => onNavigate?.('scheduleMeetup', {
                type: 'coffee',
                scheduleConnectionId: userId,
                scheduleConnectionName: profile.name,
              })}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, background: 'transparent', color: COLORS.brown600,
                border: `1.5px solid ${COLORS.brown200}`,
                borderRadius: 14, padding: '12px 22px',
                fontFamily: FONT, fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              <Coffee size={16} /> Coffee Chat
            </button>
          </div>
        )}

        {/* ─── Stats ─── */}
        <div style={{ marginTop: 24, ...fadeIn(0.12) }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { value: profile.meetups_attended || 0, label: 'Meetups' },
              { value: connectionCount, label: 'Connections' },
              { value: mutualCircles.length, label: 'Shared Circles' },
            ].map((stat, i) => (
              <div key={i} style={{
                flex: 1, background: COLORS.bgCard, borderRadius: 14,
                padding: '14px 8px', textAlign: 'center',
              }}>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: COLORS.brown700, lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 11.5, color: COLORS.brown400, marginTop: 4, fontWeight: 500 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Divider ─── */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.brown100}, transparent)`, margin: '24px 0' }} />

        {/* ─── About ─── */}
        {(profile.bio || profile.hook) && (
          <div style={fadeIn(0.15)}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontFamily: FONT, fontWeight: 700, fontSize: 14,
              color: COLORS.brown700, marginBottom: 12,
              textTransform: 'uppercase', letterSpacing: 0.8,
            }}>
              About
            </div>
            {profile.bio && (
              <p style={{
                fontFamily: FONT, fontSize: 14, color: COLORS.brown600,
                lineHeight: 1.65, background: COLORS.bgCard,
                borderRadius: 14, padding: '16px 18px', margin: 0,
              }}>
                {profile.bio}
              </p>
            )}
          </div>
        )}

        {/* ─── Shared Circles ─── */}
        {mutualCircles.length > 0 && (
          <>
            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.brown100}, transparent)`, margin: '24px 0' }} />
            <div style={fadeIn(0.21)}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: FONT, fontWeight: 700, fontSize: 14,
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
                      key={circle.id}
                      onClick={() => onNavigate?.('circleDetail', { circleId: circle.id })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: COLORS.bgCard, border: 'none', borderRadius: 14,
                        padding: '12px 16px', cursor: 'pointer', width: '100%',
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
                        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, color: COLORS.brown700 }}>{circle.name}</div>
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
        <div style={{ textAlign: 'center', marginTop: 40, ...fadeIn(0.33) }}>
          <span style={{
            fontFamily: DISPLAY_FONT, fontSize: 16, color: COLORS.brown300, fontStyle: 'italic',
          }}>
            Find your circle. Move forward.
          </span>
        </div>
      </div>
    </>
  );
}

const keyframeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
`;

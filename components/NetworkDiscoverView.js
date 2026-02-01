// components/NetworkDiscoverView.js
// Network discovery page with Vibe Bar, Recommended Section, and Dynamic Results Feed
'use client';

import { useState, useEffect } from 'react';
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
  ThumbsUp
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

// Color palette - Mocha Brown theme
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
};

// Font families
const fonts = {
  serif: "'Playfair Display', Georgia, serif",
  sans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// Vibe categories
const VIBE_CATEGORIES = [
  { id: 'advice', emoji: '🧘', label: 'Get advice', description: 'Connect with mentors & leaders' },
  { id: 'peers', emoji: '🗣️', label: 'Find support', description: 'Find your community' },
  { id: 'grow', emoji: '🚀', label: 'Career Growth', description: 'Level up your skills' },
];

export default function NetworkDiscoverView({
  currentUser,
  supabase,
  connections = [],
  meetups = [],
  onNavigate,
  onHostMeetup,
  onRequestMeetup
}) {
  const [selectedVibe, setSelectedVibe] = useState('peers');
  const [connectionGroups, setConnectionGroups] = useState([]);
  const [meetupRequests, setMeetupRequests] = useState([]);
  const [peerSuggestions, setPeerSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socialProofStats, setSocialProofStats] = useState({ activeThisWeek: 0, meetupsThisWeek: 0 });
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTopic, setRequestTopic] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestVibe, setRequestVibe] = useState('grow');

  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 480;
  const isTablet = windowWidth >= 480 && windowWidth < 768;

  const isNewUser = connections.length === 0;

  useEffect(() => {
    loadData();
  }, [selectedVibe]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadConnectionGroups(),
        loadMeetupRequests(),
        loadPeerSuggestions(),
        loadSocialProofStats()
      ]);
    } catch (error) {
      console.error('Error loading network data:', error);
    }
    setLoading(false);
  };

  const loadConnectionGroups = async () => {
    try {
      const { data: groups, error } = await supabase
        .from('connection_groups')
        .select('id, name, creator_id, is_active, vibe_category, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching connection groups:', error);
        setConnectionGroups([]);
        return;
      }

      if (!groups || groups.length === 0) {
        setConnectionGroups([]);
        return;
      }

      const groupIds = groups.map(g => g.id);
      const { data: allMembers, error: membersError } = await supabase
        .from('connection_group_members')
        .select('id, group_id, user_id, status')
        .in('group_id', groupIds)
        .eq('status', 'accepted');

      if (membersError) {
        console.error('Error fetching group members:', membersError);
      }

      const memberUserIds = [...new Set((allMembers || []).map(m => m.user_id))];
      let profileMap = {};

      if (memberUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, career')
          .in('id', memberUserIds);

        profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }

      let enrichedGroups = groups.map(g => ({
        ...g,
        members: (allMembers || [])
          .filter(m => m.group_id === g.id)
          .map(m => ({
            ...m,
            user: profileMap[m.user_id] || null
          }))
      }));

      if (selectedVibe) {
        enrichedGroups = enrichedGroups.filter(g => g.vibe_category === selectedVibe || !g.vibe_category);
      }

      setConnectionGroups(enrichedGroups);
    } catch (error) {
      console.error('Error loading connection groups:', error);
      setConnectionGroups([]);
    }
  };

  const loadMeetupRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('meetup_requests')
        .select('*')
        .eq('status', 'open')
        .order('supporter_count', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching meetup requests:', error);
        setMeetupRequests([]);
        return;
      }

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);

        const profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});

        const requestIds = data.map(r => r.id);
        const { data: supporters } = await supabase
          .from('meetup_request_supporters')
          .select('request_id, user_id')
          .in('request_id', requestIds)
          .eq('user_id', currentUser.id);

        const supportedSet = new Set((supporters || []).map(s => s.request_id));

        let requests = data.map(r => ({
          ...r,
          user: profileMap[r.user_id] || null,
          supporters: supportedSet.has(r.id) ? [{ user_id: currentUser.id }] : []
        }));

        if (selectedVibe) {
          requests = requests.filter(r => r.vibe_category === selectedVibe || !r.vibe_category);
        }
        setMeetupRequests(requests);
      } else {
        setMeetupRequests([]);
      }
    } catch (error) {
      console.error('Error loading meetup requests:', error);
      setMeetupRequests([]);
    }
  };

  const loadPeerSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, hook')
        .neq('id', currentUser.id)
        .not('name', 'is', null)
        .limit(10);

      if (error) {
        console.error('Error fetching peer suggestions:', error);
        setPeerSuggestions([]);
        return;
      }

      const connectedIds = connections.map(c => c.connected_user_id || c.id);
      const suggestions = (data || []).filter(u => !connectedIds.includes(u.id));
      setPeerSuggestions(suggestions.slice(0, 4));
    } catch (error) {
      console.error('Error loading peer suggestions:', error);
      setPeerSuggestions([]);
    }
  };

  const loadSocialProofStats = async () => {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { count: activeCount } = await supabase
        .from('meetup_signups')
        .select('user_id', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo.toISOString());

      const { count: meetupCount } = await supabase
        .from('meetups')
        .select('id', { count: 'exact', head: true })
        .gte('date', oneWeekAgo.toISOString().split('T')[0]);

      setSocialProofStats({
        activeThisWeek: activeCount || 0,
        meetupsThisWeek: meetupCount || 0
      });
    } catch (error) {
      console.error('Error loading social proof stats:', error);
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
      await loadMeetupRequests();
    } catch (error) {
      console.error('Error supporting request:', error);
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
      alert('Please enter a topic');
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

      await loadMeetupRequests();
      alert('Request submitted! Others can now support your idea.');
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Error submitting request: ' + error.message);
    }
  };

  // Filter meetups by vibe
  const filteredMeetups = selectedVibe
    ? meetups.filter(m => m.vibe_category === selectedVibe || !m.vibe_category)
    : meetups;

  // Get featured meetups (upcoming, with most signups)
  const featuredMeetups = filteredMeetups
    .filter(m => new Date(m.date) >= new Date())
    .slice(0, 4);

  // Get recommended meetup based on vibe
  const getRecommendedContent = () => {
    const vibeContent = {
      advice: {
        title: featuredMeetups[0]?.topic || 'Career Pivot AMA',
        subtitle: featuredMeetups[0]?.description || 'Connect with experienced leaders',
        groupSize: 'Small group (6-8)',
        matchReason: 'Advice',
        isGroup: false,
      },
      peers: {
        title: featuredMeetups[0]?.topic || 'Coffee Chat Meetup',
        subtitle: featuredMeetups[0]?.description || 'Career transition support',
        groupSize: 'Small group (4-6)',
        matchReason: 'Support',
        isGroup: true,
      },
      grow: {
        title: featuredMeetups[0]?.topic || 'Skills Workshop',
        subtitle: featuredMeetups[0]?.description || 'Interactive learning session',
        groupSize: 'Interactive (12-15)',
        matchReason: 'Growth',
        isGroup: false,
      },
    };

    const content = vibeContent[selectedVibe] || vibeContent.peers;
    const meetup = featuredMeetups[0];

    return {
      ...content,
      date: meetup ? new Date(meetup.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Thu, Feb 6',
      time: meetup?.time || '7 PM',
      location: meetup?.location || 'Virtual',
      spots: meetup ? Math.max(1, (meetup.max_attendees || 8) - (meetup.signups?.length || 0)) : 2,
      totalSpots: meetup?.max_attendees || 8,
      attendees: (meetup?.signups || []).slice(0, 3).map(s => ({
        name: s.user?.name || 'Member',
        emoji: '👩🏻'
      })),
      extraCount: Math.max(0, (meetup?.signups?.length || 0) - 3),
      meetupId: meetup?.id,
    };
  };

  const recommendedContent = getRecommendedContent();

  if (loading && connectionGroups.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: `4px solid ${colors.primary}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: colors.textLight }}>Loading network...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fonts.sans, paddingBottom: '100px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
        <h1 style={{
          fontSize: isMobile ? '24px' : '28px',
          fontWeight: '600',
          color: colors.text,
          margin: '0 0 6px',
          fontFamily: fonts.serif
        }}>
          Discover
        </h1>
        <p style={{ fontSize: isMobile ? '14px' : '15px', color: colors.textLight, margin: 0 }}>
          Find your people. Take the next step.
        </p>
      </div>

      {/* Vibe Bar */}
      <div style={{
        backgroundColor: colors.warmWhite,
        borderRadius: isMobile ? '16px' : '20px',
        padding: isMobile ? '16px' : '20px',
        marginBottom: isMobile ? '20px' : '24px',
        boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
      }}>
        <p style={{
          fontSize: isMobile ? '13px' : '14px',
          fontWeight: '600',
          color: colors.text,
          marginBottom: isMobile ? '12px' : '16px',
        }}>
          What are you here for today?
        </p>

        <div style={{
          display: 'flex',
          gap: isMobile ? '8px' : '10px',
          flexDirection: isMobile ? 'column' : 'row',
        }}>
          {VIBE_CATEGORIES.map((vibe) => {
            const isActive = selectedVibe === vibe.id;
            return (
              <button
                key={vibe.id}
                onClick={() => setSelectedVibe(vibe.id)}
                style={{
                  flex: isMobile ? 'none' : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isMobile ? 'flex-start' : 'center',
                  gap: '8px',
                  padding: isMobile ? '12px 14px' : '14px 12px',
                  borderRadius: '12px',
                  border: isActive ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  backgroundColor: isActive ? `${colors.primaryLight}30` : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: isMobile ? '18px' : '20px' }}>{vibe.emoji}</span>
                <span style={{
                  fontSize: isMobile ? '13px' : '13px',
                  fontWeight: isActive ? '600' : '500',
                  color: isActive ? colors.primary : colors.text,
                }}>
                  {vibe.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recommended for You */}
      {featuredMeetups.length > 0 && (
        <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          <h2 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 14px',
            fontFamily: fonts.serif
          }}>
            Recommended for you
          </h2>

          <div style={{
            backgroundColor: colors.warmWhite,
            borderRadius: isMobile ? '16px' : '20px',
            padding: isMobile ? '16px' : '20px',
            boxShadow: '0 4px 20px rgba(139, 111, 92, 0.12)',
            border: `1px solid ${colors.primary}30`,
          }}>
            {/* Spots Badge */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: isMobile ? '10px' : '12px' }}>
              <span style={{
                padding: '4px 10px',
                backgroundColor: `${colors.primary}15`,
                color: colors.primary,
                fontSize: isMobile ? '10px' : '11px',
                fontWeight: '600',
                borderRadius: '8px',
              }}>
                {recommendedContent.spots} spots left
              </span>
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: '600',
              color: colors.text,
              margin: '0 0 4px',
              fontFamily: fonts.serif
            }}>
              {recommendedContent.title}
            </h3>
            <p style={{ fontSize: isMobile ? '13px' : '14px', color: colors.textLight, margin: '0 0 14px' }}>
              {recommendedContent.subtitle}
            </p>

            {/* Group Size */}
            <p style={{
              fontSize: isMobile ? '12px' : '13px',
              color: colors.textLight,
              margin: '0 0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              👥 {recommendedContent.groupSize}
            </p>

            {/* Date, Time, Location */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '8px' : '12px',
              fontSize: isMobile ? '12px' : '13px',
              color: colors.textLight,
              marginBottom: '16px',
              flexWrap: 'wrap',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={isMobile ? 12 : 14} /> {recommendedContent.date}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={isMobile ? 12 : 14} /> {recommendedContent.time}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={isMobile ? 12 : 14} /> {recommendedContent.location}
              </span>
            </div>

            {/* Social Proof - Attendees */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              paddingTop: '14px',
              borderTop: `1px solid ${colors.border}`,
            }}>
              <div style={{ display: 'flex', marginRight: '10px' }}>
                {recommendedContent.attendees.map((person, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: isMobile ? '24px' : '28px',
                      height: isMobile ? '24px' : '28px',
                      borderRadius: '50%',
                      backgroundColor: colors.primaryLight,
                      border: '2px solid white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? '12px' : '14px',
                      marginLeft: idx > 0 ? '-8px' : 0,
                    }}
                  >
                    {person.emoji}
                  </div>
                ))}
                {recommendedContent.extraCount > 0 && (
                  <div style={{
                    width: isMobile ? '24px' : '28px',
                    height: isMobile ? '24px' : '28px',
                    borderRadius: '50%',
                    backgroundColor: colors.primary,
                    border: '2px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isMobile ? '9px' : '10px',
                    fontWeight: '600',
                    color: 'white',
                    marginLeft: '-8px',
                  }}>
                    +{recommendedContent.extraCount}
                  </div>
                )}
              </div>
              <span style={{ fontSize: isMobile ? '11px' : '12px', color: colors.textLight }}>
                {recommendedContent.attendees.length + recommendedContent.extraCount > 0
                  ? `${recommendedContent.attendees.length + recommendedContent.extraCount} going`
                  : 'Be the first to join!'
                }
              </span>
            </div>

            {/* Match Reason + CTA */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '16px',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              gap: isMobile ? '12px' : '0',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: isMobile ? '11px' : '12px',
                fontWeight: '500',
                color: colors.primary,
                backgroundColor: `${colors.primary}15`,
                padding: isMobile ? '5px 10px' : '6px 12px',
                borderRadius: '16px',
              }}>
                🤎 {recommendedContent.matchReason}
              </span>
              <button
                onClick={() => {
                  if (recommendedContent.isGroup) {
                    onNavigate?.('connectionGroups');
                  } else {
                    onNavigate?.('allEvents');
                  }
                }}
                style={{
                  padding: isMobile ? '10px 20px' : '12px 24px',
                  backgroundColor: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: `0 4px 12px ${colors.primary}40`,
                  flex: isMobile ? 1 : 'none',
                }}>
                {recommendedContent.isGroup ? 'Join group' : 'RSVP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join an Intimate Circle */}
      {(() => {
        // Filter groups where current user is NOT a member and group is not full
        const availableCircles = connectionGroups.filter(group => {
          const isMember = group.members?.some(m => m.user_id === currentUser.id);
          const memberCount = group.members?.length || 0;
          return !isMember && memberCount < 10;
        });

        const circleEmojis = ['💫', '🌙', '✨', '🔮', '🌸', '💜', '🦋', '🌊'];
        const circleGradients = [
          'linear-gradient(135deg, #F5E6D3 0%, #E8D4BC 100%)',
          'linear-gradient(135deg, #E5F0E5 0%, #C8DEC8 100%)',
          'linear-gradient(135deg, #F0E6F5 0%, #DED0E8 100%)',
          'linear-gradient(135deg, #E5E8F5 0%, #D0D8E8 100%)',
        ];

        // Show full-width prompt when no circles available
        if (availableCircles.length === 0) {
          return (
            <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '12px' : '16px' }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
                    Join an Intimate Circle
                  </h2>
                  <p style={{ fontSize: isMobile ? '12px' : '13px', color: colors.textLight, margin: '4px 0 0' }}>
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
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}>
                  See all <ChevronRight size={isMobile ? 12 : 14} />
                </button>
              </div>

              <div
                onClick={() => onNavigate?.('createCircle')}
                style={{
                  background: 'linear-gradient(135deg, #FDF8F3 0%, #F5EDE6 100%)',
                  borderRadius: isMobile ? '16px' : '20px',
                  padding: isMobile ? '24px 20px' : '32px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div style={{
                  width: isMobile ? '64px' : '80px',
                  height: isMobile ? '64px' : '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #E8D5C4 0%, #D4C4B0 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <span style={{ fontSize: isMobile ? '32px' : '40px' }}>✨</span>
                </div>

                <h3 style={{
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: '600',
                  color: colors.text,
                  margin: '0 0 8px',
                  fontFamily: fonts.serif,
                }}>
                  Start Your Own Circle
                </h3>

                <p style={{
                  fontSize: isMobile ? '13px' : '14px',
                  color: colors.textLight,
                  margin: '0 0 20px',
                  maxWidth: '320px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  lineHeight: '1.5',
                }}>
                  Create an intimate group of up to 10 people for meaningful conversations and lasting connections.
                </p>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.('createCircle');
                  }}
                  style={{
                    padding: isMobile ? '12px 24px' : '14px 32px',
                    backgroundColor: colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: `0 4px 12px ${colors.primary}40`,
                  }}
                >
                  Create a Circle
                </button>
              </div>
            </div>
          );
        }

        return (
          <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '12px' : '16px' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
                  Join an Intimate Circle
                </h2>
                <p style={{ fontSize: isMobile ? '12px' : '13px', color: colors.textLight, margin: '4px 0 0' }}>
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
                  fontSize: isMobile ? '12px' : '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}>
                See all <ChevronRight size={isMobile ? 12 : 14} />
              </button>
            </div>

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
              {availableCircles.slice(0, 6).map((circle, index) => {
                const memberCount = circle.members?.length || 0;
                const spotsLeft = 10 - memberCount;

                return (
                  <div
                    key={circle.id}
                    onClick={() => onNavigate?.('circleDetail', { circleId: circle.id })}
                    style={{
                      minWidth: isMobile ? '160px' : isTablet ? '180px' : '200px',
                      backgroundColor: colors.warmWhite,
                      borderRadius: isMobile ? '12px' : '16px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 12px rgba(139, 111, 92, 0.1)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    {/* Circle Header */}
                    <div style={{
                      height: isMobile ? '56px' : '70px',
                      background: circleGradients[index % circleGradients.length],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}>
                      <span style={{ fontSize: isMobile ? '22px' : '28px' }}>{circleEmojis[index % circleEmojis.length]}</span>
                      <span style={{
                        position: 'absolute',
                        top: isMobile ? '6px' : '8px',
                        right: isMobile ? '6px' : '8px',
                        padding: isMobile ? '2px 6px' : '3px 8px',
                        backgroundColor: spotsLeft <= 3 ? colors.primary : 'white',
                        color: spotsLeft <= 3 ? 'white' : colors.text,
                        borderRadius: '10px',
                        fontSize: isMobile ? '9px' : '10px',
                        fontWeight: '600',
                      }}>
                        {spotsLeft} spots
                      </span>
                    </div>

                    {/* Circle Content */}
                    <div style={{ padding: isMobile ? '10px 12px' : '12px 14px' }}>
                      <h4 style={{
                        fontSize: isMobile ? '13px' : '14px',
                        fontWeight: '600',
                        color: colors.text,
                        margin: '0 0 6px',
                        fontFamily: fonts.serif,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {circle.name}
                      </h4>

                      {/* Member Avatars */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: isMobile ? '8px' : '10px',
                      }}>
                        <div style={{ display: 'flex', marginRight: '6px' }}>
                          {circle.members?.slice(0, 3).map((member, idx) => (
                            <div key={member.id} style={{
                              width: isMobile ? '20px' : '24px',
                              height: isMobile ? '20px' : '24px',
                              borderRadius: '50%',
                              backgroundColor: colors.primary,
                              border: '2px solid white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: isMobile ? '9px' : '10px',
                              fontWeight: '600',
                              color: 'white',
                              marginLeft: idx > 0 ? '-6px' : 0,
                            }}>
                              {member.user?.name?.charAt(0) || '?'}
                            </div>
                          ))}
                          {memberCount > 3 && (
                            <div style={{
                              width: isMobile ? '20px' : '24px',
                              height: isMobile ? '20px' : '24px',
                              borderRadius: '50%',
                              backgroundColor: colors.cream,
                              border: '2px solid white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: isMobile ? '8px' : '9px',
                              fontWeight: '600',
                              color: colors.text,
                              marginLeft: '-6px',
                            }}>
                              +{memberCount - 3}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: isMobile ? '10px' : '11px', color: colors.textLight }}>
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Vibe Tag */}
                      {circle.vibe_category && (
                        <span style={{
                          display: 'inline-block',
                          padding: isMobile ? '3px 8px' : '4px 10px',
                          backgroundColor: `${colors.primary}15`,
                          color: colors.primary,
                          borderRadius: '12px',
                          fontSize: isMobile ? '10px' : '11px',
                          fontWeight: '500',
                        }}>
                          {circle.vibe_category === 'advice' ? '💡 Advice' :
                           circle.vibe_category === 'peers' ? '🤝 Support' :
                           circle.vibe_category === 'grow' ? '🚀 Growth' : circle.vibe_category}
                        </span>
                      )}

                      {/* View Circle Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate?.('circleDetail', { circleId: circle.id });
                        }}
                        style={{
                          width: '100%',
                          marginTop: isMobile ? '8px' : '10px',
                          padding: isMobile ? '6px 10px' : '8px 12px',
                          backgroundColor: 'white',
                          color: colors.primary,
                          border: `1.5px solid ${colors.primary}`,
                          borderRadius: isMobile ? '8px' : '10px',
                          fontSize: isMobile ? '11px' : '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        View Circle
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Create Circle Card */}
              <div
                onClick={() => onNavigate?.('createCircle')}
                style={{
                  minWidth: isMobile ? '130px' : isTablet ? '150px' : '160px',
                  backgroundColor: colors.cream,
                  borderRadius: isMobile ? '12px' : '16px',
                  border: `2px dashed ${colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: isMobile ? '16px' : '20px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: isMobile ? '40px' : '48px',
                  height: isMobile ? '40px' : '48px',
                  borderRadius: '50%',
                  backgroundColor: `${colors.primary}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: isMobile ? '8px' : '12px',
                }}>
                  <span style={{ fontSize: isMobile ? '20px' : '24px' }}>✨</span>
                </div>
                <p style={{
                  fontSize: isMobile ? '12px' : '13px',
                  fontWeight: '600',
                  color: colors.text,
                  margin: '0 0 4px',
                  textAlign: 'center',
                }}>
                  Start Your Own
                </p>
                <p style={{
                  fontSize: isMobile ? '10px' : '11px',
                  color: colors.textLight,
                  margin: 0,
                  textAlign: 'center',
                }}>
                  Create a circle
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Trending This Week */}
      {featuredMeetups.length > 0 && (
        <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '12px' : '16px' }}>
            <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
              Trending This Week
            </h2>
            <button
              onClick={() => onNavigate?.('allEvents')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                color: colors.primary,
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}>
              See all <ChevronRight size={isMobile ? 12 : 14} />
            </button>
          </div>

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
              const signupCount = meetup.signups?.length || 0;
              const spotsLeft = Math.max(0, (meetup.max_attendees || 8) - signupCount);
              const emojis = ['☕', '🎯', '🍷', '💼'];
              const gradients = [
                `linear-gradient(135deg, ${colors.primaryLight} 0%, ${colors.primary}30 100%)`,
                `linear-gradient(135deg, ${colors.cream} 0%, #E8DFD8 100%)`,
                `linear-gradient(135deg, #F5EDE8 0%, #EBE0D8 100%)`,
                `linear-gradient(135deg, #EDE6DF 0%, #E0D8D0 100%)`,
              ];

              return (
                <div
                  key={meetup.id}
                  style={{
                    minWidth: isMobile ? '240px' : '280px',
                    backgroundColor: colors.warmWhite,
                    borderRadius: isMobile ? '14px' : '16px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.1)',
                    flexShrink: 0,
                  }}>
                  <div style={{
                    height: isMobile ? '75px' : '90px',
                    background: gradients[index % 4],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isMobile ? '30px' : '36px',
                    position: 'relative',
                  }}>
                    {emojis[index % 4]}
                    <span style={{
                      position: 'absolute',
                      top: isMobile ? '8px' : '10px',
                      right: isMobile ? '8px' : '10px',
                      padding: isMobile ? '3px 6px' : '4px 8px',
                      backgroundColor: colors.primary,
                      borderRadius: '6px',
                      fontSize: isMobile ? '9px' : '10px',
                      fontWeight: '600',
                      color: 'white',
                    }}>
                      {spotsLeft} spots left
                    </span>
                  </div>
                  <div style={{ padding: isMobile ? '12px 14px' : '14px 16px' }}>
                    <h4 style={{
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '600',
                      color: colors.text,
                      margin: '0 0 4px',
                      fontFamily: fonts.serif,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {meetup.topic}
                    </h4>
                    <p style={{ fontSize: isMobile ? '11px' : '12px', color: colors.textLight, margin: '0 0 8px' }}>
                      {meetup.host_name || 'Community Event'}
                    </p>
                    <p style={{ fontSize: isMobile ? '10px' : '11px', color: colors.primary, margin: '0 0 10px', fontWeight: '500' }}>
                      👥 Small group ({meetup.max_attendees || 8})
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px', fontSize: isMobile ? '10px' : '11px', color: colors.textLight, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={isMobile ? 10 : 11} /> {new Date(meetup.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={isMobile ? 10 : 11} /> {meetup.time}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={isMobile ? 10 : 11} /> {meetup.location || 'Virtual'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: isMobile ? '10px' : '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', marginRight: '8px' }}>
                          {['👩🏻', '👩🏾', '👩🏼'].slice(0, Math.min(3, signupCount || 1)).map((emoji, idx) => (
                            <div key={idx} style={{
                              width: isMobile ? '20px' : '22px',
                              height: isMobile ? '20px' : '22px',
                              borderRadius: '50%',
                              backgroundColor: colors.cream,
                              border: '2px solid white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: isMobile ? '10px' : '11px',
                              marginLeft: idx > 0 ? '-6px' : 0,
                            }}>
                              {emoji}
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: isMobile ? '10px' : '11px', color: colors.textLight }}>
                          {signupCount > 0 ? `${signupCount} going` : 'Be first!'}
                        </span>
                      </div>
                      <button
                        onClick={() => onNavigate?.('home')}
                        style={{
                          padding: isMobile ? '5px 10px' : '6px 12px',
                          backgroundColor: colors.primary,
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: isMobile ? '10px' : '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}>
                        RSVP
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Request a Meetup prompt card - show when there are few events */}
            {featuredMeetups.length <= 2 && (
              <div
                onClick={() => setShowRequestModal(true)}
                style={{
                  minWidth: isMobile ? '240px' : '280px',
                  backgroundColor: colors.cream,
                  borderRadius: isMobile ? '14px' : '16px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(139, 111, 92, 0.1)',
                  flexShrink: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `2px dashed ${colors.border}`,
                  transition: 'all 0.2s ease',
                  padding: isMobile ? '16px' : '20px',
                }}>
                <p style={{
                  fontSize: isMobile ? '13px' : '14px',
                  color: colors.textLight,
                  margin: '0 0 16px',
                  textAlign: 'center',
                  lineHeight: '1.4',
                }}>
                  Don't see what you're looking for?
                </p>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: isMobile ? '10px 18px' : '12px 20px',
                  backgroundColor: colors.primary,
                  color: 'white',
                  borderRadius: '10px',
                  fontSize: isMobile ? '12px' : '13px',
                  fontWeight: '600',
                }}>
                  <Plus size={isMobile ? 14 : 16} />
                  Request a Meetup
                </span>
                <p style={{
                  fontSize: isMobile ? '10px' : '11px',
                  color: colors.textMuted,
                  margin: '12px 0 0',
                  textAlign: 'center',
                }}>
                  Popular requests get hosted!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connect with People */}
      <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? '12px' : '16px', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', color: colors.text, margin: '0 0 4px', fontFamily: fonts.serif }}>
              Connect with people
            </h2>
            <p style={{ fontSize: isMobile ? '12px' : '13px', color: colors.textLight, margin: 0 }}>
              Find women you can start a conversation with
            </p>
          </div>
          <button
            onClick={() => onNavigate?.('allPeople')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: colors.primary,
              fontSize: isMobile ? '12px' : '13px',
              fontWeight: '600',
              cursor: 'pointer',
              flexShrink: 0,
            }}>
            See all <ChevronRight size={isMobile ? 12 : 14} />
          </button>
        </div>

        {/* People Cards */}
        <div style={{
          display: 'flex',
          gap: isMobile ? '10px' : '12px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginLeft: isMobile ? '-16px' : '0',
          marginRight: isMobile ? '-16px' : '0',
          paddingLeft: isMobile ? '16px' : '0',
          paddingRight: isMobile ? '16px' : '0',
          WebkitOverflowScrolling: 'touch',
        }}>
          {peerSuggestions.length === 0 ? (
            <div style={{
              minWidth: isMobile ? '220px' : '260px',
              backgroundColor: colors.cream,
              borderRadius: isMobile ? '14px' : '16px',
              padding: isMobile ? '16px' : '20px',
              textAlign: 'center',
            }}>
              <div style={{
                width: isMobile ? '48px' : '56px',
                height: isMobile ? '48px' : '56px',
                borderRadius: '50%',
                backgroundColor: `${colors.primary}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <User size={isMobile ? 24 : 28} style={{ color: colors.primary }} />
              </div>
              <h4 style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '600', color: colors.text, margin: '0 0 4px' }}>
                Meet people
              </h4>
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: colors.textLight, margin: '0 0 12px' }}>
                Join meetups to grow your network
              </p>
              <button
                onClick={() => onNavigate?.('allEvents')}
                style={{
                  padding: isMobile ? '7px 14px' : '8px 16px',
                  backgroundColor: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '11px' : '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Find Meetups
              </button>
            </div>
          ) : (
            peerSuggestions.map((person) => (
              <div
                key={person.id}
                style={{
                  minWidth: isMobile ? '220px' : '260px',
                  backgroundColor: colors.text,
                  borderRadius: isMobile ? '14px' : '16px',
                  padding: isMobile ? '16px' : '20px',
                  boxShadow: '0 4px 16px rgba(74, 55, 40, 0.15)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px' }}>
                  <div style={{
                    width: isMobile ? '48px' : '56px',
                    height: isMobile ? '48px' : '56px',
                    borderRadius: '50%',
                    backgroundColor: colors.primaryLight,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isMobile ? '22px' : '28px',
                    flexShrink: 0,
                    color: 'white',
                    fontWeight: '600',
                  }}>
                    {person.photo_url ? (
                      <img
                        src={person.photo_url}
                        alt={person.name}
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      person.name?.[0] || '?'
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: isMobile ? '11px' : '12px',
                      color: 'rgba(255,255,255,0.7)',
                      margin: '0 0 4px',
                    }}>
                      Ask me about:
                    </p>
                    <h4 style={{
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '600',
                      color: 'white',
                      margin: '0 0 8px',
                      lineHeight: '1.3',
                      fontFamily: fonts.serif,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {person.hook || person.career || 'Professional networking'}
                    </h4>
                    <p style={{
                      fontSize: isMobile ? '11px' : '12px',
                      color: 'rgba(255,255,255,0.6)',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {person.name} | {person.career || 'Professional'}
                    </p>
                  </div>
                </div>
                {/* Tags at bottom */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: isMobile ? '12px' : '14px',
                  paddingTop: isMobile ? '12px' : '14px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                  {person.city && (
                    <span style={{
                      padding: isMobile ? '4px 8px' : '5px 10px',
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: isMobile ? '10px' : '11px',
                      fontWeight: '500',
                      borderRadius: '6px',
                    }}>
                      Nearby
                    </span>
                  )}
                  <span style={{
                    padding: isMobile ? '4px 8px' : '5px 10px',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: isMobile ? '10px' : '11px',
                    fontWeight: '500',
                    borderRadius: '6px',
                  }}>
                    {person.career ? 'Similar' : 'Connect'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Empty state when no meetups */}
      {featuredMeetups.length === 0 && (
        <div style={{
          backgroundColor: colors.warmWhite,
          borderRadius: isMobile ? '16px' : '20px',
          padding: isMobile ? '32px 16px' : '40px 20px',
          textAlign: 'center',
          marginBottom: isMobile ? '24px' : '32px',
        }}>
          <div style={{ fontSize: isMobile ? '40px' : '48px', marginBottom: isMobile ? '12px' : '16px' }}>🌱</div>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 8px',
            fontFamily: fonts.serif,
          }}>
            No meetups scheduled yet
          </h3>
          <p style={{ fontSize: isMobile ? '13px' : '14px', color: colors.textLight, margin: '0 0 20px' }}>
            Be the first to host a meetup and bring people together!
          </p>
          <button
            onClick={() => onHostMeetup ? onHostMeetup() : onNavigate?.('meetupProposals')}
            style={{
              padding: isMobile ? '10px 20px' : '12px 24px',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: `0 4px 12px ${colors.primary}40`,
            }}
          >
            Host a Meetup
          </button>
        </div>
      )}

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
              <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
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

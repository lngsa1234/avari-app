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
  ThumbsUp,
  Sparkles
} from 'lucide-react';

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

  const isNewUser = connections.length === 0;

  // Calculate profile completion
  const getProfileCompletion = () => {
    if (!currentUser) return { percentage: 0, missing: [] };
    const fields = [
      { key: 'name', label: 'name' },
      { key: 'career', label: 'role' },
      { key: 'industry', label: 'industry' },
      { key: 'career_stage', label: 'career stage' },
      { key: 'vibe_category', label: 'vibe' },
      { key: 'hook', label: 'hook' },
      { key: 'city', label: 'location' },
      { key: 'profile_picture', label: 'photo' }
    ];
    const filled = fields.filter(f => currentUser[f.key]);
    const missing = fields.filter(f => !currentUser[f.key]).map(f => f.label);
    const percentage = Math.round((filled.length / fields.length) * 100);
    return { percentage, missing };
  };

  const profileCompletion = getProfileCompletion();

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
          .select('id, name, career, photo_url')
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
          .select('id, name, photo_url')
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
        .select('id, name, career, city, state, photo_url, hook')
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
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '600',
          color: colors.text,
          margin: '0 0 6px',
          fontFamily: fonts.serif
        }}>
          Discover
        </h1>
        <p style={{ fontSize: '15px', color: colors.textLight, margin: 0 }}>
          Find your people. Take the next step.
        </p>
      </div>

      {/* Profile Completion Nudge */}
      {profileCompletion.percentage < 100 && profileCompletion.percentage > 0 && (
        <button
          onClick={() => onNavigate?.('profile')}
          style={{
            width: '100%',
            background: `linear-gradient(to right, ${colors.cream}, #FFF5EB)`,
            border: `1px solid ${colors.border}`,
            borderRadius: '16px',
            padding: '16px',
            textAlign: 'left',
            cursor: 'pointer',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: `${colors.primary}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles style={{ width: '24px', height: '24px', color: colors.primary }} />
            </div>
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              backgroundColor: 'white',
              borderRadius: '9999px',
              padding: '2px 6px',
              fontSize: '11px',
              fontWeight: '700',
              color: colors.primary,
              border: `1px solid ${colors.border}`,
            }}>
              {profileCompletion.percentage}%
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: '600', color: colors.text, margin: 0 }}>
              Complete your profile
            </p>
            <p style={{ fontSize: '13px', color: colors.textLight, margin: '4px 0 0' }}>
              Add {profileCompletion.missing.slice(0, 2).join(' & ')} to get 2x more connections
            </p>
          </div>
          <ChevronRight style={{ width: '20px', height: '20px', color: colors.primaryLight }} />
        </button>
      )}

      {/* Vibe Bar */}
      <div style={{
        backgroundColor: colors.warmWhite,
        borderRadius: '20px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
      }}>
        <p style={{
          fontSize: '14px',
          fontWeight: '600',
          color: colors.text,
          marginBottom: '16px',
        }}>
          What are you here for today?
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          {VIBE_CATEGORIES.map((vibe) => {
            const isActive = selectedVibe === vibe.id;
            return (
              <button
                key={vibe.id}
                onClick={() => setSelectedVibe(vibe.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '14px 12px',
                  borderRadius: '12px',
                  border: isActive ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  backgroundColor: isActive ? `${colors.primaryLight}30` : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: '20px' }}>{vibe.emoji}</span>
                <span style={{
                  fontSize: '13px',
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
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 14px',
            fontFamily: fonts.serif
          }}>
            Recommended for you
          </h2>

          <div style={{
            backgroundColor: colors.warmWhite,
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 4px 20px rgba(139, 111, 92, 0.12)',
            border: `1px solid ${colors.primary}30`,
          }}>
            {/* Spots Badge */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <span style={{
                padding: '4px 10px',
                backgroundColor: `${colors.primary}15`,
                color: colors.primary,
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '8px',
              }}>
                {recommendedContent.spots} spots left
              </span>
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: colors.text,
              margin: '0 0 4px',
              fontFamily: fonts.serif
            }}>
              {recommendedContent.title}
            </h3>
            <p style={{ fontSize: '14px', color: colors.textLight, margin: '0 0 14px' }}>
              {recommendedContent.subtitle}
            </p>

            {/* Group Size */}
            <p style={{
              fontSize: '13px',
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
              gap: '12px',
              fontSize: '13px',
              color: colors.textLight,
              marginBottom: '16px',
              flexWrap: 'wrap',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={14} /> {recommendedContent.date}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={14} /> {recommendedContent.time}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={14} /> {recommendedContent.location}
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
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: colors.primaryLight,
                      border: '2px solid white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      marginLeft: idx > 0 ? '-8px' : 0,
                    }}
                  >
                    {person.emoji}
                  </div>
                ))}
                {recommendedContent.extraCount > 0 && (
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: colors.primary,
                    border: '2px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: '600',
                    color: 'white',
                    marginLeft: '-8px',
                  }}>
                    +{recommendedContent.extraCount}
                  </div>
                )}
              </div>
              <span style={{ fontSize: '12px', color: colors.textLight }}>
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
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '500',
                color: colors.primary,
                backgroundColor: `${colors.primary}15`,
                padding: '6px 12px',
                borderRadius: '16px',
              }}>
                🤎 {recommendedContent.matchReason}
              </span>
              <button
                onClick={() => onNavigate?.('home')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: `0 4px 12px ${colors.primary}40`,
                }}>
                {recommendedContent.isGroup ? 'Join group' : 'RSVP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Happening This Week */}
      {featuredMeetups.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
              Happening This Week
            </h2>
            <button
              onClick={() => onNavigate?.('home')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                color: colors.primary,
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}>
              See all <ChevronRight size={14} />
            </button>
          </div>

          <div style={{
            display: 'flex',
            gap: '14px',
            overflowX: 'auto',
            paddingBottom: '8px',
            marginLeft: '-24px',
            marginRight: '-24px',
            paddingLeft: '24px',
            paddingRight: '24px',
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
                    minWidth: '280px',
                    backgroundColor: colors.warmWhite,
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.1)',
                    flexShrink: 0,
                  }}>
                  <div style={{
                    height: '90px',
                    background: gradients[index % 4],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '36px',
                    position: 'relative',
                  }}>
                    {emojis[index % 4]}
                    <span style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      padding: '4px 8px',
                      backgroundColor: colors.primary,
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: '600',
                      color: 'white',
                    }}>
                      {spotsLeft} spots left
                    </span>
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    <h4 style={{
                      fontSize: '15px',
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
                    <p style={{ fontSize: '12px', color: colors.textLight, margin: '0 0 8px' }}>
                      {meetup.host_name || 'Community Event'}
                    </p>
                    <p style={{ fontSize: '11px', color: colors.primary, margin: '0 0 10px', fontWeight: '500' }}>
                      👥 Small group ({meetup.max_attendees || 8})
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: colors.textLight, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={11} /> {new Date(meetup.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} /> {meetup.time}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={11} /> {meetup.location || 'Virtual'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', marginRight: '8px' }}>
                          {['👩🏻', '👩🏾', '👩🏼'].slice(0, Math.min(3, signupCount || 1)).map((emoji, idx) => (
                            <div key={idx} style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              backgroundColor: colors.cream,
                              border: '2px solid white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              marginLeft: idx > 0 ? '-6px' : 0,
                            }}>
                              {emoji}
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: '11px', color: colors.textLight }}>
                          {signupCount > 0 ? `${signupCount} going` : 'Be first!'}
                        </span>
                      </div>
                      <button
                        onClick={() => onNavigate?.('home')}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: colors.primary,
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '11px',
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
          </div>
        </div>
      )}

      {/* Connect with People */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, margin: '0 0 4px', fontFamily: fonts.serif }}>
              Connect with people
            </h2>
            <p style={{ fontSize: '13px', color: colors.textLight, margin: 0 }}>
              Find women you can start a conversation with
            </p>
          </div>
          <button
            onClick={() => onNavigate?.('connections')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: colors.primary,
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}>
            See all <ChevronRight size={14} />
          </button>
        </div>

        {/* People Cards */}
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
          {peerSuggestions.length === 0 ? (
            <div style={{
              minWidth: '260px',
              backgroundColor: colors.cream,
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: `${colors.primary}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <User size={28} style={{ color: colors.primary }} />
              </div>
              <h4 style={{ fontSize: '15px', fontWeight: '600', color: colors.text, margin: '0 0 4px' }}>
                Meet people
              </h4>
              <p style={{ fontSize: '12px', color: colors.textLight, margin: '0 0 12px' }}>
                Join meetups to grow your network
              </p>
              <button
                onClick={() => onNavigate?.('home')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
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
                  minWidth: '260px',
                  backgroundColor: colors.text,
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 4px 16px rgba(74, 55, 40, 0.15)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: colors.primaryLight,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
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
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.7)',
                      margin: '0 0 4px',
                    }}>
                      Ask me about:
                    </p>
                    <h4 style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: 'white',
                      margin: '0 0 8px',
                      lineHeight: '1.3',
                      fontFamily: fonts.serif,
                    }}>
                      {person.hook || person.career || 'Professional networking'}
                    </h4>
                    <p style={{
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.6)',
                      margin: 0,
                    }}>
                      {person.name} | {person.career || 'Professional'}
                    </p>
                  </div>
                </div>
                {/* Tags at bottom */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '14px',
                  paddingTop: '14px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                  {person.city && (
                    <span style={{
                      padding: '5px 10px',
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: '11px',
                      fontWeight: '500',
                      borderRadius: '6px',
                    }}>
                      Nearby
                    </span>
                  )}
                  <span style={{
                    padding: '5px 10px',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: '11px',
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
          borderRadius: '20px',
          padding: '40px 20px',
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌱</div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 8px',
            fontFamily: fonts.serif,
          }}>
            No meetups scheduled yet
          </h3>
          <p style={{ fontSize: '14px', color: colors.textLight, margin: '0 0 20px' }}>
            Be the first to host a meetup and bring people together!
          </p>
          <button
            onClick={() => onHostMeetup ? onHostMeetup() : onNavigate?.('meetupProposals')}
            style={{
              padding: '12px 24px',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
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
        bottom: '100px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '12px',
        zIndex: 50,
      }}>
        <button
          onClick={() => onHostMeetup ? onHostMeetup() : setShowRequestModal(true)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: 'none',
            background: colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(139, 111, 92, 0.35)',
            cursor: 'pointer',
            color: 'white',
            fontSize: '28px',
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
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            maxWidth: '400px',
            width: '100%',
            padding: '24px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
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
                }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '14px', color: colors.textLight, marginBottom: '20px' }}>
              Suggest a topic you'd like to see. Others can support your idea!
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
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
                  padding: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                maxLength={200}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
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
                        padding: '10px',
                        borderRadius: '10px',
                        border: isSelected ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                        backgroundColor: isSelected ? `${colors.primary}15` : 'white',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: '18px', display: 'block', marginBottom: '4px' }}>{vibe.emoji}</span>
                      <span style={{ fontSize: '11px', color: isSelected ? colors.primary : colors.textLight }}>
                        {vibe.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
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
                  padding: '12px',
                  fontSize: '14px',
                  height: '80px',
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
                  padding: '12px',
                  backgroundColor: colors.cream,
                  color: colors.text,
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
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
                  padding: '12px',
                  backgroundColor: requestTopic.trim() ? colors.primary : colors.border,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
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
      `}</style>
    </div>
  );
}

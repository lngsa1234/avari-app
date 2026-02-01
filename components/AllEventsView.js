// components/AllEventsView.js
// All Events page with search functionality and filters
'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  Users,
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

// Vibe categories for filtering
const VIBE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'advice', label: 'Get advice' },
  { id: 'peers', label: 'Find support' },
  { id: 'grow', label: 'Career Growth' },
];

export default function AllEventsView({
  currentUser,
  supabase,
  onNavigate,
}) {
  const [meetups, setMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVibe, setSelectedVibe] = useState('all');
  const [activeView, setActiveView] = useState('upcoming'); // 'upcoming' or 'past'

  useEffect(() => {
    loadAllMeetups();
  }, []);

  const loadAllMeetups = async () => {
    setLoading(true);
    try {
      // Fetch all meetups
      const { data: meetupsData, error } = await supabase
        .from('meetups')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching meetups:', error);
        setMeetups([]);
        return;
      }

      if (!meetupsData || meetupsData.length === 0) {
        setMeetups([]);
        setLoading(false);
        return;
      }

      // Fetch signups separately
      const { data: signupsData, error: signupsError } = await supabase
        .from('meetup_signups')
        .select('id, meetup_id, user_id');

      if (signupsError) {
        console.error('Error fetching signups:', signupsError);
      }

      // Group signups by meetup_id
      const signupsByMeetup = (signupsData || []).reduce((acc, signup) => {
        if (!acc[signup.meetup_id]) {
          acc[signup.meetup_id] = [];
        }
        acc[signup.meetup_id].push(signup);
        return acc;
      }, {});

      // Attach signups to meetups
      const meetupsWithSignups = meetupsData.map(meetup => ({
        ...meetup,
        signups: signupsByMeetup[meetup.id] || [],
      }));

      setMeetups(meetupsWithSignups);
    } catch (error) {
      console.error('Error loading meetups:', error);
      setMeetups([]);
    }
    setLoading(false);
  };

  // Filter meetups based on search, vibe, and date
  const filteredMeetups = meetups.filter((meetup) => {
    // Filter by date (upcoming vs past)
    const meetupDate = new Date(meetup.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (activeView === 'upcoming' && meetupDate < today) return false;
    if (activeView === 'past' && meetupDate >= today) return false;

    // Filter by vibe category
    if (selectedVibe !== 'all' && meetup.vibe_category !== selectedVibe) return false;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesTopic = meetup.topic?.toLowerCase().includes(query);
      const matchesHost = meetup.host_name?.toLowerCase().includes(query);
      const matchesLocation = meetup.location?.toLowerCase().includes(query);
      if (!matchesTopic && !matchesHost && !matchesLocation) return false;
    }

    return true;
  });

  // Sort: upcoming events by date ascending, past events by date descending
  const sortedMeetups = [...filteredMeetups].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return activeView === 'upcoming' ? dateA - dateB : dateB - dateA;
  });

  if (loading) {
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
          <p style={{ color: colors.textLight }}>Loading events...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fonts.sans, paddingBottom: '100px' }}>
      {/* Header with back button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px',
      }}>
        <button
          onClick={() => onNavigate?.('discover')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            backgroundColor: 'white',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={20} style={{ color: colors.text }} />
        </button>
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: colors.text,
          margin: 0,
          fontFamily: fonts.serif,
        }}>
          All Events
        </h1>
      </div>

      {/* Search bar */}
      <div style={{
        position: 'relative',
        marginBottom: '20px',
      }}>
        <Search
          size={18}
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: colors.textMuted,
          }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by topic, host, or location..."
          style={{
            width: '100%',
            padding: '14px 14px 14px 44px',
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.warmWhite,
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            color: colors.text,
          }}
        />
      </div>

      {/* Vibe filter tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        overflowX: 'auto',
        paddingBottom: '4px',
      }}>
        {VIBE_FILTERS.map((vibe) => {
          const isActive = selectedVibe === vibe.id;
          return (
            <button
              key={vibe.id}
              onClick={() => setSelectedVibe(vibe.id)}
              style={{
                padding: '10px 16px',
                borderRadius: '20px',
                border: isActive ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                backgroundColor: isActive ? `${colors.primary}15` : 'white',
                color: isActive ? colors.primary : colors.textLight,
                fontSize: '13px',
                fontWeight: isActive ? '600' : '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {vibe.label}
            </button>
          );
        })}
      </div>

      {/* Date toggle */}
      <div style={{
        display: 'flex',
        backgroundColor: colors.cream,
        borderRadius: '12px',
        padding: '4px',
        marginBottom: '24px',
      }}>
        <button
          onClick={() => setActiveView('upcoming')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: activeView === 'upcoming' ? 'white' : 'transparent',
            color: activeView === 'upcoming' ? colors.text : colors.textLight,
            fontSize: '14px',
            fontWeight: activeView === 'upcoming' ? '600' : '500',
            cursor: 'pointer',
            boxShadow: activeView === 'upcoming' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveView('past')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: activeView === 'past' ? 'white' : 'transparent',
            color: activeView === 'past' ? colors.text : colors.textLight,
            fontSize: '14px',
            fontWeight: activeView === 'past' ? '600' : '500',
            cursor: 'pointer',
            boxShadow: activeView === 'past' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          Past
        </button>
      </div>

      {/* Events grid */}
      {sortedMeetups.length === 0 ? (
        <div style={{
          backgroundColor: colors.warmWhite,
          borderRadius: '20px',
          padding: '40px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {searchQuery || selectedVibe !== 'all' ? '🔍' : '📅'}
          </div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 8px',
            fontFamily: fonts.serif,
          }}>
            {searchQuery || selectedVibe !== 'all'
              ? 'No matching events'
              : activeView === 'upcoming'
                ? 'No upcoming events'
                : 'No past events'
            }
          </h3>
          <p style={{ fontSize: '14px', color: colors.textLight, margin: 0 }}>
            {searchQuery || selectedVibe !== 'all'
              ? 'Try adjusting your search or filters'
              : activeView === 'upcoming'
                ? 'Check back soon for new events!'
                : 'Past events will appear here'
            }
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {sortedMeetups.map((meetup, index) => {
            const signupCount = meetup.signups?.length || 0;
            const spotsLeft = Math.max(0, (meetup.max_attendees || 8) - signupCount);
            const emojis = ['☕', '🎯', '🍷', '💼', '🚀', '🧘', '🗣️', '✨'];
            const gradients = [
              `linear-gradient(135deg, ${colors.primaryLight} 0%, ${colors.primary}30 100%)`,
              `linear-gradient(135deg, ${colors.cream} 0%, #E8DFD8 100%)`,
              `linear-gradient(135deg, #F5EDE8 0%, #EBE0D8 100%)`,
              `linear-gradient(135deg, #EDE6DF 0%, #E0D8D0 100%)`,
            ];
            const isPast = new Date(meetup.date) < new Date();

            return (
              <div
                key={meetup.id}
                style={{
                  backgroundColor: colors.warmWhite,
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(139, 111, 92, 0.1)',
                  opacity: isPast ? 0.7 : 1,
                }}
              >
                <div style={{
                  height: '90px',
                  background: gradients[index % 4],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '36px',
                  position: 'relative',
                }}>
                  {emojis[index % 8]}
                  <span style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    padding: '4px 8px',
                    backgroundColor: isPast ? colors.textMuted : colors.primary,
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: '600',
                    color: 'white',
                  }}>
                    {isPast ? 'Past' : `${spotsLeft} spots left`}
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
                    <Users size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Small group ({meetup.max_attendees || 8})
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '11px',
                    color: colors.textLight,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={11} />
                      {new Date(meetup.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} /> {meetup.time}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={11} /> {meetup.location || 'Virtual'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '12px',
                  }}>
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
                    {!isPast && (
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
                        }}
                      >
                        RSVP
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

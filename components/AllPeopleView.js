// components/AllPeopleView.js
// All People page with search and filters
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  MapPin,
  Briefcase,
  Heart,
  MessageCircle,
  X,
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
  success: '#6B8E7B',
};

// Font families
const fonts = {
  serif: "'Playfair Display', Georgia, serif",
  sans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// Interest filter options
const INTEREST_FILTERS = [
  'All',
  'Tech',
  'Entrepreneurship',
  'Wellness',
  'Finance',
  'Parenting',
  'Creative',
  'Leadership',
];

// Avatar gradients
const GRADIENTS = [
  'linear-gradient(135deg, #E8D5C4 0%, #D4C4B0 100%)',
  'linear-gradient(135deg, #E5F0E5 0%, #C8DEC8 100%)',
  'linear-gradient(135deg, #F5E6D3 0%, #E8D4BC 100%)',
  'linear-gradient(135deg, #F0E6F5 0%, #DED0E8 100%)',
  'linear-gradient(135deg, #F5E0E5 0%, #E8CCD4 100%)',
  'linear-gradient(135deg, #E5E8D4 0%, #D4D8C0 100%)',
  'linear-gradient(135deg, #FCE4EC 0%, #F8BBD9 100%)',
  'linear-gradient(135deg, #D4E5F7 0%, #B8D4E8 100%)',
];

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

export default function AllPeopleView({
  currentUser,
  supabase,
  onNavigate,
}) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInterest, setSelectedInterest] = useState('All');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [connectionRequested, setConnectionRequested] = useState(false);

  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 480;

  useEffect(() => {
    loadPeople();
  }, []);

  const loadPeople = async () => {
    setLoading(true);
    try {
      // Fetch all profiles except current user
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUser.id)
        .not('name', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching profiles:', error);
        setPeople([]);
        return;
      }

      if (!profilesData || profilesData.length === 0) {
        setPeople([]);
        setLoading(false);
        return;
      }

      // Get mutual matches (connections) using the database function
      const { data: mutualMatches, error: matchError } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id });

      console.log('🔍 Current user ID:', currentUser.id);
      console.log('🔍 Mutual matches result:', mutualMatches);
      console.log('🔍 Mutual matches error:', matchError);

      const myConnectionIds = new Set((mutualMatches || []).map(m => m.matched_user_id));
      console.log('🔍 My connection IDs:', [...myConnectionIds]);

      // Fetch current user's circle memberships
      const { data: myCircles } = await supabase
        .from('connection_group_members')
        .select('group_id')
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted');

      const myCircleIds = (myCircles || []).map(c => c.group_id);

      // Fetch all circle memberships for other users
      let circleMembers = [];
      if (myCircleIds.length > 0) {
        const { data: allCircleMembers } = await supabase
          .from('connection_group_members')
          .select('user_id, group_id')
          .in('group_id', myCircleIds)
          .eq('status', 'accepted')
          .neq('user_id', currentUser.id);

        circleMembers = allCircleMembers || [];
      }

      // Calculate mutual circles for each person
      const userCircleCount = {};
      circleMembers.forEach(member => {
        if (!userCircleCount[member.user_id]) {
          userCircleCount[member.user_id] = 0;
        }
        userCircleCount[member.user_id]++;
      });

      // Get all user_interests to calculate mutual connections
      // Mutual connections = people who are connected to both current user and the person
      const profileIds = profilesData.map(p => p.id);

      // Get interests expressed BY other users
      const { data: interestsByOthers } = await supabase
        .from('user_interests')
        .select('user_id, interested_in_user_id')
        .in('user_id', profileIds);

      // Get interests expressed IN other users
      const { data: interestsInOthers } = await supabase
        .from('user_interests')
        .select('user_id, interested_in_user_id')
        .in('interested_in_user_id', profileIds);

      // Build a map of each person's mutual matches (connections)
      const personConnections = {};
      profileIds.forEach(id => { personConnections[id] = new Set(); });

      // Find mutual matches for each person
      const interestsByUser = {};
      const interestsInUser = {};

      (interestsByOthers || []).forEach(i => {
        if (!interestsByUser[i.user_id]) interestsByUser[i.user_id] = new Set();
        interestsByUser[i.user_id].add(i.interested_in_user_id);
      });

      (interestsInOthers || []).forEach(i => {
        if (!interestsInUser[i.interested_in_user_id]) interestsInUser[i.interested_in_user_id] = new Set();
        interestsInUser[i.interested_in_user_id].add(i.user_id);
      });

      // A mutual match exists when user A expressed interest in B AND B expressed interest in A
      profileIds.forEach(personId => {
        const theyLike = interestsByUser[personId] || new Set();
        const likedThem = interestsInUser[personId] || new Set();
        theyLike.forEach(otherId => {
          if (likedThem.has(otherId)) {
            personConnections[personId].add(otherId);
          }
        });
      });

      // Calculate mutual connections for each person (shared connections with current user)
      const userMutualConnections = {};
      profileIds.forEach(personId => {
        let count = 0;
        personConnections[personId].forEach(connId => {
          if (myConnectionIds.has(connId)) {
            count++;
          }
        });
        userMutualConnections[personId] = count;
      });

      // Enrich profiles with mutual data and connection status
      const enrichedProfiles = profilesData.map(person => ({
        ...person,
        mutualCircles: userCircleCount[person.id] || 0,
        mutualConnections: userMutualConnections[person.id] || 0,
        isConnected: myConnectionIds.has(person.id),
      }));

      console.log('🔍 Enriched profiles:', enrichedProfiles.map(p => ({
        name: p.name,
        id: p.id,
        isConnected: p.isConnected,
        mutualConnections: p.mutualConnections,
        mutualCircles: p.mutualCircles,
      })));

      setPeople(enrichedProfiles);
    } catch (error) {
      console.error('Error loading people:', error);
      setPeople([]);
    }
    setLoading(false);
  };

  // Filter people based on search and interest
  const filteredPeople = useMemo(() => {
    return people.filter(person => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        person.name?.toLowerCase().includes(query) ||
        person.hook?.toLowerCase().includes(query) ||
        person.career?.toLowerCase().includes(query) ||
        person.industry?.toLowerCase().includes(query) ||
        person.city?.toLowerCase().includes(query);

      const matchesInterest = selectedInterest === 'All' ||
        person.industry?.toLowerCase().includes(selectedInterest.toLowerCase()) ||
        person.career?.toLowerCase().includes(selectedInterest.toLowerCase());

      return matchesSearch && matchesInterest;
    });
  }, [people, searchQuery, selectedInterest]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedInterest('All');
  };

  const handleRequestConnect = async (personId) => {
    // Here you would implement the actual connection request logic
    setConnectionRequested(true);
    setTimeout(() => {
      setSelectedPerson(null);
      setConnectionRequested(false);
    }, 2000);
  };

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
          <p style={{ color: colors.textLight }}>Loading people...</p>
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
        marginBottom: '8px',
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
        <div>
          <h1 style={{
            fontSize: isMobile ? '22px' : '24px',
            fontWeight: '600',
            color: colors.text,
            margin: 0,
            fontFamily: fonts.serif,
          }}>
            Connect with Women
          </h1>
        </div>
      </div>

      <p style={{
        fontSize: isMobile ? '13px' : '14px',
        color: colors.textLight,
        margin: '0 0 20px',
        paddingLeft: '52px',
      }}>
        Find inspiring women in your community
      </p>

      {/* Search bar */}
      <div style={{
        position: 'relative',
        marginBottom: '16px',
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
          placeholder="Search by name, role, or interests..."
          style={{
            width: '100%',
            padding: '14px 40px 14px 44px',
            borderRadius: '16px',
            border: `2px solid ${colors.border}`,
            backgroundColor: 'white',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            color: colors.text,
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={18} style={{ color: colors.textMuted }} />
          </button>
        )}
      </div>

      {/* Interest filter pills */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
        marginBottom: '20px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {INTEREST_FILTERS.map((interest) => {
          const isActive = selectedInterest === interest;
          return (
            <button
              key={interest}
              onClick={() => setSelectedInterest(interest)}
              style={{
                padding: '10px 16px',
                borderRadius: '20px',
                border: isActive ? 'none' : `2px solid ${colors.border}`,
                backgroundColor: isActive ? colors.primary : 'white',
                color: isActive ? 'white' : colors.text,
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {interest}
            </button>
          );
        })}
      </div>

      {/* How it works banner */}
      <div style={{
        background: 'linear-gradient(to right, #FFF8F0, #FDF5ED)',
        borderRadius: '16px',
        padding: '14px 16px',
        marginBottom: '20px',
        border: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}>
        <span style={{ fontSize: '24px' }}>✨</span>
        <div>
          <h3 style={{
            fontSize: '13px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 4px',
          }}>
            How connecting works
          </h3>
          <p style={{
            fontSize: '12px',
            color: colors.textLight,
            margin: 0,
            lineHeight: '1.4',
          }}>
            Attend a group meetup first to unlock 1-on-1 coffee chats. This helps build authentic connections!
          </p>
        </div>
      </div>

      {/* Results count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <p style={{ fontSize: '13px', color: colors.textLight, margin: 0 }}>
          {filteredPeople.length} women to connect with
        </p>
        {(searchQuery || selectedInterest !== 'All') && (
          <button
            onClick={clearFilters}
            style={{
              background: 'none',
              border: 'none',
              color: colors.primary,
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* People Grid */}
      {filteredPeople.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 20px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 8px',
            fontFamily: fonts.serif,
          }}>
            No matches found
          </h3>
          <p style={{ fontSize: '14px', color: colors.textLight, margin: '0 0 20px' }}>
            Try adjusting your search or filters
          </p>
          <button
            onClick={clearFilters}
            style={{
              padding: '12px 24px',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: '16px',
        }}>
          {filteredPeople.map((person, index) => (
            <PersonCard
              key={person.id}
              person={person}
              gradient={GRADIENTS[index % GRADIENTS.length]}
              isMobile={isMobile}
              onClick={() => setSelectedPerson(person)}
            />
          ))}

          {/* Invite Card */}
          <div
            style={{
              backgroundColor: colors.warmWhite,
              borderRadius: '24px',
              border: `2px dashed ${colors.border}`,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              minHeight: '200px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💌</div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: colors.text,
              margin: '0 0 4px',
              fontFamily: fonts.serif,
            }}>
              Know someone amazing?
            </h3>
            <p style={{
              fontSize: '13px',
              color: colors.textLight,
              margin: '0 0 16px',
            }}>
              Invite her to join!
            </p>
            <button
              style={{
                padding: '10px 20px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Send Invite
            </button>
          </div>
        </div>
      )}

      {/* Profile Preview Modal */}
      {selectedPerson && (
        <ProfilePreviewModal
          person={selectedPerson}
          gradient={GRADIENTS[people.indexOf(selectedPerson) % GRADIENTS.length]}
          isMobile={isMobile}
          connectionRequested={connectionRequested}
          onClose={() => {
            setSelectedPerson(null);
            setConnectionRequested(false);
          }}
          onRequestConnect={() => handleRequestConnect(selectedPerson.id)}
        />
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        div::-webkit-scrollbar {
          height: 0;
          width: 0;
        }
      `}</style>
    </div>
  );
}

function PersonCard({ person, gradient, isMobile, onClick }) {
  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
        border: `1px solid ${colors.border}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Avatar Header */}
      <div style={{
        height: '96px',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {person.photo_url ? (
          <img
            src={person.photo_url}
            alt={person.name}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3px solid white',
            }}
          />
        ) : (
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: '600',
            color: 'white',
            border: '3px solid white',
          }}>
            {getInitials(person.name)}
          </div>
        )}

        {/* Badge */}
        {person.isConnected ? (
          <span style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            padding: '4px 10px',
            backgroundColor: colors.success,
            color: 'white',
            fontSize: '11px',
            fontWeight: '600',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <Heart size={10} fill="white" />
            Connected
          </span>
        ) : person.is_new ? (
          <span style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            padding: '4px 10px',
            backgroundColor: '#4DB6AC',
            color: 'white',
            fontSize: '11px',
            fontWeight: '600',
            borderRadius: '12px',
          }}>
            New
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {/* Name */}
        <h3 style={{
          fontSize: '17px',
          fontWeight: '600',
          color: colors.text,
          margin: '0 0 4px',
          fontFamily: fonts.serif,
        }}>
          {person.name}
        </h3>

        {/* Hook */}
        {person.hook && (
          <p style={{
            fontSize: '13px',
            color: colors.textLight,
            margin: '0 0 10px',
            lineHeight: '1.4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {person.hook}
          </p>
        )}

        {/* Title & Industry */}
        {person.career && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: colors.textLight,
            marginBottom: '6px',
          }}>
            <Briefcase size={12} style={{ color: colors.textMuted, flexShrink: 0 }} />
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {person.career}{person.industry ? ` • ${person.industry}` : ''}
            </span>
          </div>
        )}

        {/* Location */}
        {person.city && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: colors.textLight,
            marginBottom: '10px',
          }}>
            <MapPin size={12} style={{ color: colors.textMuted, flexShrink: 0 }} />
            <span>{person.city}{person.state ? `, ${person.state}` : ''}</span>
          </div>
        )}

        {/* Tags */}
        {(person.industry || person.career_stage) && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '10px',
          }}>
            {person.industry && (
              <span style={{
                padding: '4px 10px',
                backgroundColor: colors.cream,
                color: colors.text,
                fontSize: '11px',
                borderRadius: '12px',
              }}>
                {person.industry}
              </span>
            )}
            {person.career_stage && (
              <span style={{
                padding: '4px 10px',
                backgroundColor: colors.cream,
                color: colors.text,
                fontSize: '11px',
                borderRadius: '12px',
              }}>
                {person.career_stage}
              </span>
            )}
          </div>
        )}

        {/* Connection Status - Last Line */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '11px',
          paddingTop: '10px',
          borderTop: `1px solid ${colors.border}`,
          flexWrap: 'wrap',
        }}>
          {person.isConnected && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: colors.success,
              fontWeight: '600',
            }}>
              <Heart size={12} fill={colors.success} />
              <span>Connected</span>
            </div>
          )}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: person.mutualConnections > 0 ? colors.success : colors.textMuted,
          }}>
            <Users size={12} />
            <span>{person.mutualConnections || 0} mutual</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: person.mutualCircles > 0 ? colors.success : colors.textMuted,
          }}>
            <span>•</span>
            <span>{person.mutualCircles || 0} circles</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilePreviewModal({ person, gradient, isMobile, connectionRequested, onClose, onRequestConnect }) {
  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  if (connectionRequested) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
          onClick={onClose}
        />
        <div style={{
          position: 'relative',
          backgroundColor: colors.warmWhite,
          borderRadius: '24px',
          width: '90%',
          maxWidth: '400px',
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 8px',
            fontFamily: fonts.serif,
          }}>
            Connection Request Sent!
          </h3>
          <p style={{
            fontSize: '14px',
            color: colors.textLight,
            margin: '0 0 24px',
          }}>
            {person.name?.split(' ')[0]} will be notified. We'll let you know when she responds!
          </p>
          <button
            onClick={onClose}
            style={{
              padding: '14px 32px',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center',
    }}>
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={{
        position: 'relative',
        backgroundColor: colors.warmWhite,
        borderRadius: isMobile ? '24px 24px 0 0' : '24px',
        width: '100%',
        maxWidth: '400px',
        maxHeight: isMobile ? '90vh' : '85vh',
        overflowY: 'auto',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.8)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          <X size={20} style={{ color: colors.textLight }} />
        </button>

        {/* Header with Avatar */}
        <div style={{
          height: '128px',
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {person.photo_url ? (
            <img
              src={person.photo_url}
              alt={person.name}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid white',
              }}
            />
          ) : (
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              fontWeight: '600',
              color: 'white',
              border: '4px solid white',
            }}>
              {getInitials(person.name)}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Name & Hook */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: colors.text,
              margin: '0 0 4px',
              fontFamily: fonts.serif,
            }}>
              {person.name}
            </h2>
            <p style={{
              fontSize: '14px',
              color: colors.textLight,
              margin: 0,
            }}>
              {person.hook || 'Member'}
            </p>
          </div>

          {/* Info Cards */}
          <div style={{ marginBottom: '20px' }}>
            {person.career && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
                marginBottom: '8px',
              }}>
                <span style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: colors.cream,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}>
                  💼
                </span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: colors.text, margin: 0 }}>
                    {person.career}
                  </p>
                  {person.industry && (
                    <p style={{ fontSize: '12px', color: colors.textLight, margin: 0 }}>
                      {person.industry}
                    </p>
                  )}
                </div>
              </div>
            )}

            {person.city && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
              }}>
                <span style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: colors.cream,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}>
                  📍
                </span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: colors.text, margin: 0 }}>
                    {person.city}{person.state ? `, ${person.state}` : ''}
                  </p>
                  <p style={{ fontSize: '12px', color: colors.textLight, margin: 0 }}>
                    Local to you
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Looking For / Hook */}
          {person.hook && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                fontSize: '13px',
                fontWeight: '600',
                color: colors.text,
                margin: '0 0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>🎯</span> About
              </h3>
              <p style={{
                fontSize: '13px',
                color: colors.textLight,
                backgroundColor: '#FFF8F0',
                padding: '12px',
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
                margin: 0,
                lineHeight: '1.5',
              }}>
                "{person.hook}"
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={onRequestConnect}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              <MessageCircle size={18} />
              Request to Connect
            </button>

            <button
              onClick={() => {}}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'white',
                color: colors.text,
                border: `2px solid ${colors.border}`,
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>☕</span>
              See Shared Events
            </button>
          </div>

          {/* Footer Note */}
          <p style={{
            fontSize: '11px',
            color: colors.textMuted,
            textAlign: 'center',
            margin: 0,
          }}>
            Attend a meetup together to unlock 1-on-1 coffee chats
          </p>
        </div>
      </div>
    </div>
  );
}

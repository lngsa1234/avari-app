// components/AllCirclesView.js
// All Circles page with search and filters - based on UX reference
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Users,
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Heart,
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
  success: '#4DB6AC',
  warning: '#FFB74D',
  danger: '#E57373',
};

// Font families
const fonts = {
  serif: "'Playfair Display', Georgia, serif",
  sans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// Category filters
const CATEGORIES = ['All', 'Career', 'Business', 'Wellness', 'Tech', 'Creative', 'Finance', 'Learning', 'Parenting'];

// Circle emojis and gradients
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

export default function AllCirclesView({
  currentUser,
  supabase,
  onNavigate,
}) {
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCircle, setSelectedCircle] = useState(null);

  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 480;

  useEffect(() => {
    loadCircles();
  }, []);

  const loadCircles = async () => {
    setLoading(true);
    try {
      // Fetch all active circles
      const { data: groupsData, error } = await supabase
        .from('connection_groups')
        .select('id, name, creator_id, is_active, vibe_category, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching circles:', error);
        setCircles([]);
        return;
      }

      if (!groupsData || groupsData.length === 0) {
        setCircles([]);
        setLoading(false);
        return;
      }

      // Fetch all members for these groups
      const groupIds = groupsData.map(g => g.id);
      const { data: membersData, error: membersError } = await supabase
        .from('connection_group_members')
        .select('id, group_id, user_id, status')
        .in('group_id', groupIds)
        .eq('status', 'accepted');

      if (membersError) {
        console.error('Error fetching members:', membersError);
      }

      // Get unique member user IDs
      const memberUserIds = [...new Set((membersData || []).map(m => m.user_id))];

      // Fetch profiles for all members
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

      // Get creator profiles
      const creatorIds = [...new Set(groupsData.map(g => g.creator_id))];
      let creatorMap = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('profiles')
          .select('id, name, career')
          .in('id', creatorIds);

        creatorMap = (creators || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }

      // Enrich groups with member data
      const enrichedGroups = groupsData.map((group, index) => {
        const groupMembers = (membersData || [])
          .filter(m => m.group_id === group.id)
          .map(m => ({
            ...m,
            user: profileMap[m.user_id] || null,
          }));

        const memberCount = groupMembers.length;
        const totalSpots = 10;
        const spotsLeft = Math.max(0, totalSpots - memberCount);
        const isOpen = spotsLeft > 0;
        const isMember = groupMembers.some(m => m.user_id === currentUser.id);

        return {
          ...group,
          members: groupMembers,
          memberCount,
          totalSpots,
          spotsLeft,
          isOpen,
          isMember,
          host: creatorMap[group.creator_id] || { name: 'Unknown' },
          emoji: CIRCLE_EMOJIS[index % CIRCLE_EMOJIS.length],
          gradient: CIRCLE_GRADIENTS[index % CIRCLE_GRADIENTS.length],
          category: mapVibeToCategory(group.vibe_category),
        };
      });

      setCircles(enrichedGroups);
    } catch (error) {
      console.error('Error loading circles:', error);
      setCircles([]);
    }
    setLoading(false);
  };

  // Map vibe_category to display category
  const mapVibeToCategory = (vibe) => {
    const vibeMap = {
      advice: 'Career',
      peers: 'Wellness',
      grow: 'Business',
    };
    return vibeMap[vibe] || 'General';
  };

  // Filter circles
  const filteredCircles = useMemo(() => {
    return circles.filter(circle => {
      const matchesSearch = !searchQuery ||
        circle.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || circle.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [circles, searchQuery, selectedCategory]);

  // Separate into categories: my circles, open circles, waitlist circles
  const myCircles = filteredCircles.filter(c => c.isMember);
  const openCircles = filteredCircles.filter(c => !c.isMember && c.isOpen);
  const waitlistCircles = filteredCircles.filter(c => !c.isMember && !c.isOpen);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
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
          <p style={{ color: colors.textLight }}>Loading circles...</p>
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
      {/* Header */}
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
            Intimate Circles
          </h1>
        </div>
      </div>

      <p style={{
        fontSize: isMobile ? '13px' : '14px',
        color: colors.textLight,
        margin: '0 0 20px',
        paddingLeft: '52px',
      }}>
        Small groups that meet regularly & grow together
      </p>

      {/* Search Bar */}
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
          placeholder="Search circles by name..."
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

      {/* Category Pills */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
        marginBottom: '20px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {CATEGORIES.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
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
              {category}
            </button>
          );
        })}
      </div>

      {/* What's an Intimate Circle */}
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
        <span style={{ fontSize: '24px' }}>💫</span>
        <div>
          <h3 style={{
            fontSize: '13px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 4px',
          }}>
            What's an Intimate Circle?
          </h3>
          <p style={{
            fontSize: '12px',
            color: colors.textLight,
            margin: 0,
            lineHeight: '1.4',
          }}>
            A small group (up to 10 women) that meets regularly around a shared interest. It's where lasting friendships are built over time.
          </p>
        </div>
      </div>

      {/* Results Count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <p style={{ fontSize: '13px', color: colors.textLight, margin: 0 }}>
          {filteredCircles.length} circle{filteredCircles.length !== 1 ? 's' : ''} found
        </p>
        {(searchQuery || selectedCategory !== 'All') && (
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

      {/* My Circles */}
      {myCircles.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '15px',
            fontWeight: '600',
            color: colors.text,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              backgroundColor: colors.primary,
              borderRadius: '50%',
            }} />
            My Circles
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '16px',
          }}>
            {myCircles.map((circle) => (
              <CircleCard
                key={circle.id}
                circle={circle}
                isMobile={isMobile}
                onClick={() => onNavigate?.('circleDetail', { circleId: circle.id })}
                isMember={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* Open Circles */}
      {openCircles.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '15px',
            fontWeight: '600',
            color: colors.text,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              backgroundColor: colors.success,
              borderRadius: '50%',
            }} />
            Open to Join
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '16px',
          }}>
            {openCircles.map((circle) => (
              <CircleCard
                key={circle.id}
                circle={circle}
                isMobile={isMobile}
                onClick={() => onNavigate?.('circleDetail', { circleId: circle.id })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Waitlist Circles */}
      {waitlistCircles.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '15px',
            fontWeight: '600',
            color: colors.text,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              backgroundColor: colors.warning,
              borderRadius: '50%',
            }} />
            Waitlist
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '16px',
          }}>
            {waitlistCircles.map((circle) => (
              <CircleCard
                key={circle.id}
                circle={circle}
                isMobile={isMobile}
                onClick={() => onNavigate?.('circleDetail', { circleId: circle.id })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Start Your Own Circle */}
      <div
        onClick={() => onNavigate?.('createCircle')}
        style={{
          backgroundColor: colors.warmWhite,
          borderRadius: '24px',
          border: `2px dashed ${colors.border}`,
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌱</div>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: colors.text,
          margin: '0 0 8px',
          fontFamily: fonts.serif,
        }}>
          Start Your Own Circle
        </h3>
        <p style={{
          fontSize: '14px',
          color: colors.textLight,
          margin: '0 0 20px',
          maxWidth: '280px',
          lineHeight: '1.5',
        }}>
          Have a topic you're passionate about? Gather your people and create a space for connection.
        </p>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
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
          <span style={{ fontSize: '18px' }}>+</span>
          Create a Circle
        </button>
      </div>

      {/* Empty State */}
      {filteredCircles.length === 0 && (
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
            No circles found
          </h3>
          <p style={{ fontSize: '14px', color: colors.textLight, margin: '0 0 20px' }}>
            Try a different search or start your own!
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
      )}

      {/* Circle Detail Modal */}
      {selectedCircle && (
        <CircleDetailModal
          circle={selectedCircle}
          currentUser={currentUser}
          supabase={supabase}
          isMobile={isMobile}
          onClose={() => setSelectedCircle(null)}
          onNavigate={onNavigate}
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

function CircleCard({ circle, isMobile, onClick, isMember = false }) {
  const spotsColor = isMember
    ? { bg: colors.primary, text: 'white' }
    : circle.spotsLeft === 0
      ? { bg: colors.warning, text: 'white' }
      : circle.spotsLeft <= 2
        ? { bg: colors.danger, text: 'white' }
        : { bg: colors.success, text: 'white' };

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
        border: isMember ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header with Emoji */}
      <div style={{
        height: isMobile ? '100px' : '112px',
        background: circle.gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{ fontSize: isMobile ? '40px' : '48px' }}>{circle.emoji}</span>

        {/* Spots/Member Badge */}
        <span style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          padding: '4px 12px',
          backgroundColor: spotsColor.bg,
          color: spotsColor.text,
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '600',
        }}>
          {isMember ? 'Member' : circle.spotsLeft === 0 ? 'Waitlist' : `${circle.spotsLeft} spot${circle.spotsLeft !== 1 ? 's' : ''} left`}
        </span>

        {/* Category Badge */}
        <span style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          padding: '4px 10px',
          backgroundColor: 'rgba(255,255,255,0.9)',
          color: colors.text,
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '500',
        }}>
          {circle.category}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '600',
          color: colors.text,
          margin: '0 0 8px',
          fontFamily: fonts.serif,
        }}>
          {circle.name}
        </h3>

        {/* Members Preview */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '12px',
          borderTop: `1px solid ${colors.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex' }}>
              {circle.members?.slice(0, 4).map((member, idx) => (
                <div key={member.id} style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: colors.primary,
                  border: '2px solid white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'white',
                  marginLeft: idx > 0 ? '-8px' : 0,
                }}>
                  {member.user?.name?.charAt(0) || '?'}
                </div>
              ))}
              {circle.memberCount > 4 && (
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: colors.cream,
                  border: '2px solid white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: colors.text,
                  marginLeft: '-8px',
                }}>
                  +{circle.memberCount - 4}
                </div>
              )}
            </div>
            <span style={{ fontSize: '12px', color: colors.textLight, marginLeft: '8px' }}>
              {circle.memberCount}/{circle.totalSpots}
            </span>
          </div>
          <ChevronRight size={20} style={{ color: colors.primaryLight }} />
        </div>
      </div>
    </div>
  );
}

function CircleDetailModal({ circle, currentUser, supabase, isMobile, onClose, onNavigate }) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const handleRequest = async () => {
    setIsRequesting(true);
    try {
      // Check if already a member or has pending request
      const { data: existing } = await supabase
        .from('connection_group_members')
        .select('id, status')
        .eq('group_id', circle.id)
        .eq('user_id', currentUser.id)
        .single();

      if (existing) {
        alert(existing.status === 'accepted' ? 'You are already a member!' : 'You already have a pending request.');
        setIsRequesting(false);
        return;
      }

      // Create join request
      const { error } = await supabase
        .from('connection_group_members')
        .insert({
          group_id: circle.id,
          user_id: currentUser.id,
          status: 'invited', // Will be reviewed by host
        });

      if (error) throw error;

      setRequestSent(true);
    } catch (error) {
      console.error('Error requesting to join:', error);
      alert('Failed to send request. Please try again.');
    }
    setIsRequesting(false);
  };

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
        {/* Close Button */}
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

        {/* Header with Emoji */}
        <div style={{
          height: '140px',
          background: circle.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          <span style={{ fontSize: '64px' }}>{circle.emoji}</span>
          <span style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            padding: '4px 12px',
            backgroundColor: 'rgba(255,255,255,0.9)',
            color: colors.text,
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500',
          }}>
            {circle.category}
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: colors.text,
              margin: '0 0 4px',
              fontFamily: fonts.serif,
            }}>
              {circle.name}
            </h2>
          </div>

          {/* Host */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: '#FFF8F0',
            borderRadius: '12px',
            marginBottom: '20px',
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: '600',
              color: 'white',
            }}>
              {circle.host?.name?.charAt(0) || '?'}
            </div>
            <div>
              <p style={{ fontSize: '12px', color: colors.textLight, margin: 0 }}>Hosted by</p>
              <p style={{ fontSize: '14px', fontWeight: '600', color: colors.text, margin: 0 }}>
                {circle.host?.name || 'Unknown'}
              </p>
            </div>
          </div>

          {/* Members */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.text,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} />
                Members ({circle.memberCount}/{circle.totalSpots})
              </span>
              {circle.spotsLeft > 0 ? (
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: colors.success }}>
                  {circle.spotsLeft} spots open
                </span>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: colors.warning }}>
                  Waitlist
                </span>
              )}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {circle.members?.map((member) => (
                <div key={member.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  backgroundColor: 'white',
                  borderRadius: '20px',
                  border: `1px solid ${colors.border}`,
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'white',
                  }}>
                    {member.user?.name?.charAt(0) || '?'}
                  </div>
                  <span style={{ fontSize: '13px', color: colors.text }}>
                    {member.user?.name || 'Unknown'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* What to Expect */}
          <div style={{
            backgroundColor: '#F5EDE5',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.text,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>✨</span> What to expect
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontSize: '13px',
              color: colors.textLight,
            }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                <span style={{ color: colors.success }}>•</span>
                <span>Regular meetups with the same core group</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                <span style={{ color: colors.success }}>•</span>
                <span>Safe space to share and grow together</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: colors.success }}>•</span>
                <span>Deeper connections over time</span>
              </li>
            </ul>
          </div>

          {/* Action Button */}
          {!requestSent ? (
            <button
              onClick={handleRequest}
              disabled={isRequesting}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: isRequesting ? 'not-allowed' : 'pointer',
                opacity: isRequesting ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isRequesting ? (
                'Sending request...'
              ) : circle.isOpen ? (
                <>
                  <Heart size={18} />
                  Request to Join
                </>
              ) : (
                <>
                  <Clock size={18} />
                  Join Waitlist
                </>
              )}
            </button>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '16px',
              backgroundColor: '#E5F0E5',
              borderRadius: '12px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: colors.success,
                fontWeight: '600',
              }}>
                <Check size={18} />
                {circle.isOpen ? 'Request Sent!' : 'Added to Waitlist!'}
              </div>
              <p style={{ fontSize: '12px', color: colors.textLight, marginTop: '4px' }}>
                {circle.host?.name?.split(' ')[0] || 'The host'} will review your request
              </p>
            </div>
          )}

          {/* Footer Note */}
          <p style={{
            fontSize: '11px',
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: '16px',
          }}>
            Circle hosts review requests to ensure a good fit for everyone
          </p>
        </div>
      </div>
    </div>
  );
}

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

// Color palette - matching Home page warm browns
const colors = {
  primary: '#584233',
  primaryDark: '#3F1906',
  primaryLight: '#9C8068',
  cream: '#FAF5EF',
  warmWhite: '#F5EDE9',
  text: '#3F1906',
  textLight: '#6B5647',
  textMuted: '#B8A089',
  border: 'rgba(139, 111, 92, 0.1)',
  success: '#4DB6AC',
  warning: '#FFB74D',
  danger: '#E57373',
};

// Font families - matching Home page
const fonts = {
  serif: "'Lora', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
    <div style={{ fontFamily: fonts.serif, paddingBottom: '100px', position: 'relative', padding: isMobile ? '16px 0' : '24px 0' }}>
      {/* Title Section */}
      <section style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'flex-end',
        flexDirection: isMobile ? 'column' : 'row',
        marginBottom: isMobile ? '20px' : '24px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(139, 111, 92, 0.1)',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => onNavigate?.('discover')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'rgba(168, 132, 98, 0.15)',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={20} style={{ color: colors.text }} />
          </button>
          <div>
            <h1 style={{
              fontFamily: fonts.serif,
              fontSize: isMobile ? '24px' : '32px',
              fontWeight: '500',
              color: '#584233',
              letterSpacing: '0.15px',
              margin: 0,
              lineHeight: 1.28,
            }}>
              Intimate Circles
            </h1>
            <p style={{
              fontFamily: fonts.serif,
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '500',
              margin: 0,
              marginTop: '6px',
              background: 'linear-gradient(89.8deg, #7E654D 27.14%, #B9A594 72.64%, #ECDDD2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Small groups that meet regularly & grow together
            </p>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <div style={{
        position: 'relative',
        marginBottom: '16px',
      }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#B8A089',
          }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search circles by name..."
          style={{
            width: '100%',
            padding: '12px 40px 12px 44px',
            borderRadius: '50px',
            border: '1px solid rgba(232, 221, 208, 0.8)',
            backgroundColor: 'white',
            fontSize: '13px',
            fontFamily: fonts.sans,
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
                padding: '8px 16px',
                borderRadius: '50px',
                border: 'none',
                backgroundColor: isActive ? '#5E4530' : 'rgba(168, 132, 98, 0.12)',
                color: isActive ? '#FAF5EF' : '#9C8068',
                fontSize: '13px',
                fontWeight: '500',
                fontFamily: fonts.sans,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.25s ease',
              }}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* What's an Intimate Circle - styled like AI Insights banner */}
      <div style={{
        background: 'linear-gradient(93.28deg, #7A624B 9.73%, #BC9972 95.71%)',
        borderRadius: '15px',
        padding: isMobile ? '14px 16px' : '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        position: 'relative',
        overflow: 'hidden',
        opacity: 0.83,
        boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
      }}>
        {/* Decorative circle */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-20%',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />
        <span style={{ fontSize: '24px', position: 'relative', zIndex: 1 }}>💫</span>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h3 style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.95)',
            margin: '0 0 4px',
            fontFamily: fonts.serif,
          }}>
            What's an Intimate Circle?
          </h3>
          <p style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.75)',
            margin: 0,
            lineHeight: '1.4',
            fontFamily: fonts.sans,
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
        <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0, fontFamily: fonts.sans }}>
          {filteredCircles.length} circle{filteredCircles.length !== 1 ? 's' : ''} found
        </p>
        {(searchQuery || selectedCategory !== 'All') && (
          <button
            onClick={clearFilters}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(107, 86, 71, 0.77)',
              fontSize: '13px',
              fontWeight: '500',
              fontFamily: fonts.serif,
              cursor: 'pointer',
              letterSpacing: '0.15px',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* My Circles */}
      {myCircles.length > 0 && (
        <section style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.015) 0%, rgba(255, 255, 255, 0.013) 100%)',
          borderRadius: '19px',
          padding: isMobile ? '16px 0' : '24px 0',
          marginBottom: isMobile ? '16px' : '20px',
          backdropFilter: 'blur(2px)',
        }}>
          <h2 style={{
            fontFamily: fonts.serif,
            fontSize: isMobile ? '20px' : '24px',
            fontWeight: '500',
            color: '#3F1906',
            marginBottom: '16px',
            letterSpacing: '0.15px',
          }}>
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
        <section style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.015) 0%, rgba(255, 255, 255, 0.013) 100%)',
          borderRadius: '19px',
          padding: isMobile ? '16px 0' : '24px 0',
          marginBottom: isMobile ? '16px' : '20px',
          backdropFilter: 'blur(2px)',
        }}>
          <h2 style={{
            fontFamily: fonts.serif,
            fontSize: isMobile ? '20px' : '24px',
            fontWeight: '500',
            color: '#3F1906',
            marginBottom: '16px',
            letterSpacing: '0.15px',
          }}>
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
        <section style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.015) 0%, rgba(255, 255, 255, 0.013) 100%)',
          borderRadius: '19px',
          padding: isMobile ? '16px 0' : '24px 0',
          marginBottom: isMobile ? '16px' : '20px',
          backdropFilter: 'blur(2px)',
        }}>
          <h2 style={{
            fontFamily: fonts.serif,
            fontSize: isMobile ? '20px' : '24px',
            fontWeight: '500',
            color: '#3F1906',
            marginBottom: '16px',
            letterSpacing: '0.15px',
          }}>
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
          background: 'linear-gradient(135deg, #F5EDE4 0%, #E8DDD0 100%)',
          borderRadius: '19px',
          border: '1px dashed rgba(139, 111, 92, 0.2)',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          backdropFilter: 'blur(2px)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌱</div>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '500',
          color: '#584233',
          margin: '0 0 8px',
          fontFamily: fonts.serif,
          letterSpacing: '0.15px',
        }}>
          Start Your Own Circle
        </h3>
        <p style={{
          fontSize: '14px',
          color: colors.textLight,
          margin: '0 0 20px',
          maxWidth: '280px',
          lineHeight: '1.5',
          fontFamily: fonts.sans,
        }}>
          Have a topic you're passionate about? Gather your people and create a space for connection.
        </p>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: 'linear-gradient(88.65deg, rgba(134, 112, 96, 0.63) 56.79%, rgba(197, 172, 150, 0.63) 98.85%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: fonts.sans,
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
            fontWeight: '500',
            color: '#584233',
            margin: '0 0 8px',
            fontFamily: fonts.serif,
            letterSpacing: '0.15px',
          }}>
            No circles found
          </h3>
          <p style={{ fontSize: '14px', color: colors.textLight, margin: '0 0 20px', fontFamily: fonts.sans }}>
            Try a different search or start your own!
          </p>
          <button
            onClick={clearFilters}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(88.65deg, rgba(134, 112, 96, 0.63) 56.79%, rgba(197, 172, 150, 0.63) 98.85%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              fontFamily: fonts.sans,
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
  const avatarColors = ['#9C8068', '#C9A96E', '#8B9E7E'];

  const spotsColor = isMember
    ? { bg: 'rgba(168, 132, 98, 0.75)', text: 'white' }
    : circle.spotsLeft === 0
      ? { bg: colors.warning, text: 'white' }
      : circle.spotsLeft <= 2
        ? { bg: colors.danger, text: 'white' }
        : { bg: 'rgba(77, 182, 172, 0.8)', text: 'white' };

  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(255, 255, 255, 0.35)',
        borderRadius: '19px',
        overflow: 'hidden',
        border: isMember ? '1px solid rgba(168, 132, 98, 0.3)' : '1px solid rgba(139, 111, 92, 0.08)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(2px)',
      }}
    >
      {/* Header with Emoji */}
      <div style={{
        height: isMobile ? '90px' : '100px',
        background: circle.gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{ fontSize: isMobile ? '36px' : '44px' }}>{circle.emoji}</span>

        {/* Spots/Member Badge */}
        <span style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '4px 10px',
          backgroundColor: spotsColor.bg,
          color: spotsColor.text,
          borderRadius: '20px',
          fontSize: '10px',
          fontWeight: '600',
          fontFamily: fonts.sans,
          letterSpacing: '0.3px',
        }}>
          {isMember ? 'Member' : circle.spotsLeft === 0 ? 'Waitlist' : `${circle.spotsLeft} spot${circle.spotsLeft !== 1 ? 's' : ''} left`}
        </span>

        {/* Category Badge */}
        <span style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          padding: '4px 10px',
          backgroundColor: 'rgba(255,255,255,0.75)',
          color: '#584233',
          borderRadius: '20px',
          fontSize: '10px',
          fontWeight: '500',
          fontFamily: fonts.sans,
        }}>
          {circle.category}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px' }}>
        <h3 style={{
          fontSize: '15px',
          fontWeight: '500',
          color: '#3F1906',
          margin: '0 0 10px',
          fontFamily: fonts.serif,
          letterSpacing: '0.15px',
        }}>
          {circle.name}
        </h3>

        {/* Members Preview */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '10px',
          borderTop: '1px solid rgba(139, 111, 92, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex' }}>
              {circle.members?.slice(0, 3).map((member, idx) => (
                <div key={member.id} style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${avatarColors[idx % 3]}, #7A5C42)`,
                  border: '2px solid rgba(255,255,255,0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: 'white',
                  marginLeft: idx > 0 ? '-6px' : 0,
                }}>
                  {member.user?.name?.charAt(0) || '?'}
                </div>
              ))}
              {circle.memberCount > 3 && (
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(189, 173, 162, 0.5)',
                  border: '2px solid rgba(255,255,255,0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: '600',
                  color: '#605045',
                  marginLeft: '-6px',
                }}>
                  +{circle.memberCount - 3}
                </div>
              )}
            </div>
            <span style={{ fontSize: '11px', color: '#B8A089', marginLeft: '8px', fontFamily: fonts.sans }}>
              {circle.memberCount}/{circle.totalSpots}
            </span>
          </div>
          <ChevronRight size={18} style={{ color: '#B8A089' }} />
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
        background: 'linear-gradient(180deg, #F5EDE4 0%, #EDE3D7 40%, #E8DDD0 100%)',
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
              fontWeight: '500',
              color: '#584233',
              margin: '0 0 4px',
              fontFamily: fonts.serif,
              letterSpacing: '0.15px',
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
            backgroundColor: 'rgba(255, 255, 255, 0.35)',
            borderRadius: '12px',
            marginBottom: '20px',
            border: '1px solid rgba(139, 111, 92, 0.08)',
            backdropFilter: 'blur(2px)',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #9C8068, #7A5C42)',
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
              <p style={{ fontSize: '12px', color: colors.textMuted, margin: 0, fontFamily: fonts.sans }}>Hosted by</p>
              <p style={{ fontSize: '14px', fontWeight: '500', color: '#3F1906', margin: 0, fontFamily: fonts.serif }}>
                {circle.host?.name || 'Unknown'}
              </p>
            </div>
          </div>

          {/* Members */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#3F1906',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: fonts.serif,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} />
                Members ({circle.memberCount}/{circle.totalSpots})
              </span>
              {circle.spotsLeft > 0 ? (
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: colors.success, fontFamily: fonts.sans }}>
                  {circle.spotsLeft} spots open
                </span>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: colors.warning, fontFamily: fonts.sans }}>
                  Waitlist
                </span>
              )}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {circle.members?.map((member, idx) => (
                <div key={member.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  borderRadius: '20px',
                  border: '1px solid rgba(139, 111, 92, 0.08)',
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${['#9C8068', '#C9A96E', '#8B9E7E'][idx % 3]}, #7A5C42)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'white',
                  }}>
                    {member.user?.name?.charAt(0) || '?'}
                  </div>
                  <span style={{ fontSize: '13px', color: '#3F1906', fontFamily: fonts.sans }}>
                    {member.user?.name || 'Unknown'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* What to Expect */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.35)',
            borderRadius: '15px',
            padding: '16px',
            marginBottom: '24px',
            backdropFilter: 'blur(2px)',
            border: '1px solid rgba(139, 111, 92, 0.08)',
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#3F1906',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: fonts.serif,
            }}>
              <span>✨</span> What to expect
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontSize: '13px',
              color: colors.textLight,
              fontFamily: fonts.sans,
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
                background: 'linear-gradient(88.65deg, rgba(134, 112, 96, 0.63) 56.79%, rgba(197, 172, 150, 0.63) 98.85%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                fontFamily: fonts.sans,
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
              backgroundColor: 'rgba(77, 182, 172, 0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(77, 182, 172, 0.15)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: colors.success,
                fontWeight: '600',
                fontFamily: fonts.sans,
              }}>
                <Check size={18} />
                {circle.isOpen ? 'Request Sent!' : 'Added to Waitlist!'}
              </div>
              <p style={{ fontSize: '12px', color: colors.textLight, marginTop: '4px', fontFamily: fonts.sans }}>
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
            fontFamily: fonts.sans,
          }}>
            Circle hosts review requests to ensure a good fit for everyone
          </p>
        </div>
      </div>
    </div>
  );
}

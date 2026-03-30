// components/AllCirclesView.js
// All Circles page — redesigned to match circlew_circles_page UX reference
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search, Users, ChevronLeft, ChevronRight, X, Check, Clock, Heart,
} from 'lucide-react';
import { colors as tokens, fonts } from '@/lib/designTokens';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

const colors = {
  mocha: tokens.tagText,
  mochaDark: '#4A3527',
  mochaLight: tokens.primary,
  mochaPale: tokens.bgPale,
  mochaMuted: '#C4A882',
  cream: tokens.bgAlt,
  border: tokens.border,
  borderHover: tokens.borderHover,
  tagBg: tokens.tagBg,
  tagText: tokens.tagText,
  success: '#4DB6AC',
  warning: tokens.warning,
};

const CATEGORIES = ['All', 'Career', 'Business', 'Wellness', 'Tech', 'Creative', 'Finance', 'Learning', 'Parenting'];

const COVER_COLORS = [
  '#E8DDD3', '#D8E8E0', '#EEE0D5', '#F5E8D0', '#EAD8F0', '#D8EAD8', '#F0E8F0', '#F5E8D8',
];
const COVER_ICONS = ['🚀', '🤖', '🛠️', '💰', '🎨', '🌱', '🌸', '👩‍👧', '📚', '💫'];
const AVATAR_COLORS = ['#7A5C44', '#4A7A5C', '#6A5A8A', '#A06030', '#7A5A8A', '#6B4F3A', '#C4A882'];

export default function AllCirclesView({ currentUser, supabase, onNavigate }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchFocused, setSearchFocused] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 560);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const { data: circles = [], isLoading: loading, mutate: refreshCircles } = useSupabaseQuery(
    currentUser ? 'all-circles' : null,
    async (sb) => {
      try {
      const { data: groupsData, error } = await sb
        .from('connection_groups')
        .select('id, name, description, creator_id, is_active, vibe_category, cadence, meeting_day, max_members, created_at, image_url')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error || !groupsData?.length) return [];

      const groupIds = groupsData.map(g => g.id);
      const [membersRes, creatorsRes] = await Promise.all([
        supabase.from('connection_group_members').select('id, group_id, user_id, status').in('group_id', groupIds).eq('status', 'accepted'),
        supabase.from('profiles').select('id, name, career, profile_picture').in('id', [...new Set(groupsData.map(g => g.creator_id))]),
      ]);

      const memberUserIds = [...new Set((membersRes.data || []).map(m => m.user_id))];
      let profileMap = {};
      if (memberUserIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name, career, profile_picture').in('id', memberUserIds);
        (profiles || []).forEach(p => { profileMap[p.id] = p; });
      }
      const creatorMap = {};
      (creatorsRes.data || []).forEach(p => { creatorMap[p.id] = p; });

      const enriched = groupsData.map((group, idx) => {
        const groupMembers = (membersRes.data || [])
          .filter(m => m.group_id === group.id)
          .map(m => ({ ...m, user: profileMap[m.user_id] || null }));
        const maxSpots = group.max_members || 10;
        const memberCount = groupMembers.length;
        const spotsLeft = Math.max(0, maxSpots - memberCount);

        return {
          ...group,
          members: groupMembers,
          memberCount,
          totalSpots: maxSpots,
          spotsLeft,
          isFull: spotsLeft === 0,
          isMember: groupMembers.some(m => m.user_id === currentUser.id),
          host: creatorMap[group.creator_id] || { name: 'Unknown' },
          coverColor: COVER_COLORS[idx % COVER_COLORS.length],
          coverIcon: COVER_ICONS[idx % COVER_ICONS.length],
          category: mapVibeToCategory(group.vibe_category),
          freq: group.cadence || 'Flexible',
        };
      });
      return enriched;
    } catch (e) { console.error('Error loading circles:', e); return []; }
  });

  const loadCircles = async () => { await refreshCircles(); };

  const mapVibeToCategory = (vibe) => {
    const map = { advice: 'Career', peers: 'Wellness', grow: 'Business' };
    return map[vibe] || 'General';
  };

  const filteredCircles = useMemo(() => {
    return circles.filter(c => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        c.name?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q);
      const matchesCat = selectedCategory === 'All' || c.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [circles, searchQuery, selectedCategory]);

  const openCircles = filteredCircles.filter(c => !c.isMember && !c.isFull);
  const fullCircles = filteredCircles.filter(c => !c.isMember && c.isFull);
  const myCircles = filteredCircles.filter(c => c.isMember);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: `4px solid ${colors.mocha}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: colors.mochaLight, fontFamily: fonts.sans }}>Loading circles...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fonts.sans, maxWidth: '860px', margin: '0 auto', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <button
            onClick={() => onNavigate?.('home')}
            aria-label="Go back"
            style={{
              width: '44px', height: '44px', borderRadius: '50%',
              border: `1px solid ${colors.border}`, background: 'white',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <ChevronLeft size={16} style={{ color: colors.mocha }} />
          </button>
          <span style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif, letterSpacing: '0.01em' }}>
            Circles
          </span>
        </div>
        <p style={{ fontSize: '13px', color: colors.mochaLight, margin: 0, paddingLeft: '46px' }}>
          Small groups that meet regularly around a shared interest
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: colors.mochaMuted, pointerEvents: 'none', zIndex: 1 }}>
          <Search size={15} />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          placeholder="Search circles by name or topic..."
          style={{
            width: '100%', height: '44px', padding: '0 40px 0 42px',
            borderRadius: '24px', border: `1px solid ${searchFocused ? colors.mochaMuted : colors.border}`,
            background: 'white', fontSize: '14px', color: colors.mocha,
            outline: 'none', fontFamily: fonts.sans, boxSizing: 'border-box',
            boxShadow: searchFocused ? '0 0 0 3px rgba(107,79,58,0.07)' : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={16} style={{ color: colors.mochaMuted }} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '20px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {CATEGORIES.map(cat => {
          const active = selectedCategory === cat;
          return (
            <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
              height: '36px', padding: '0 16px', borderRadius: '20px',
              border: `1px solid ${active ? colors.mocha : colors.border}`,
              background: active ? colors.mocha : 'white',
              color: active ? 'white' : colors.mochaLight,
              fontSize: '13px', fontWeight: active ? '500' : '400',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              fontFamily: fonts.sans, transition: 'all 0.15s',
            }}>
              {cat}
            </button>
          );
        })}
      </div>

      {/* Explainer banner */}
      <div style={{
        display: 'flex', gap: '14px', alignItems: 'flex-start',
        background: colors.mochaPale, border: `1px solid ${colors.border}`,
        borderRadius: '14px', padding: '16px 18px', marginBottom: '24px',
      }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%', background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}><Users size={18} style={{ color: colors.mocha }} /></div>
        <div>
          <strong style={{ fontSize: '14px', fontWeight: '500', color: colors.mocha, display: 'block', marginBottom: '4px' }}>
            What's an Intimate Circle?
          </strong>
          <span style={{ fontSize: '13px', color: colors.mochaLight, lineHeight: '1.6' }}>
            A small group of up to 10 women that meets regularly around a shared interest. It's where real friendships are built over time — not just networking.
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
            <span style={{ fontSize: '11px', background: colors.tagBg, color: colors.tagText, padding: '3px 10px', borderRadius: '12px' }}>Up to 10 members</span>
            <span style={{ fontSize: '11px', background: colors.tagBg, color: colors.tagText, padding: '3px 10px', borderRadius: '12px' }}>Regular meetups</span>
            <span style={{ fontSize: '11px', background: colors.tagBg, color: colors.tagText, padding: '3px 10px', borderRadius: '12px' }}>Unlock 1-on-1 chats after 5 meetups</span>
          </div>
        </div>
      </div>

      {/* My Circles */}
      {myCircles.length > 0 && (
        <CircleSection title="My Circles" count={myCircles.length} isMobile={isMobile}>
          {myCircles.map(c => <CircleCard key={c.id} circle={c} isMobile={isMobile} onClick={() => onNavigate?.('circleDetail', { circleId: c.id })} isMember />)}
        </CircleSection>
      )}

      {/* Open to Join */}
      {openCircles.length > 0 && (
        <CircleSection title="Open to Join" count={openCircles.length} isMobile={isMobile}>
          {openCircles.map(c => <CircleCard key={c.id} circle={c} isMobile={isMobile} onClick={() => onNavigate?.('circleDetail', { circleId: c.id })} />)}
        </CircleSection>
      )}

      {/* Currently Full */}
      {fullCircles.length > 0 && (
        <CircleSection title="Currently Full" count={fullCircles.length} isMobile={isMobile} marginTop="40px">
          {fullCircles.map(c => <CircleCard key={c.id} circle={c} isMobile={isMobile} onClick={() => onNavigate?.('circleDetail', { circleId: c.id })} />)}
        </CircleSection>
      )}

      {/* Start Your Own Circle */}
      <div
        onClick={() => onNavigate?.('createCircle')}
        style={{
          background: colors.mochaPale, borderRadius: '16px',
          border: `2px dashed ${colors.border}`, padding: '32px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', cursor: 'pointer',
          marginTop: '32px',
        }}
      >
        <Users size={36} style={{ color: colors.mochaMuted, marginBottom: '12px' }} />
        <h3 style={{ fontSize: '16px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif, margin: '0 0 4px' }}>
          Start Your Own Circle
        </h3>
        <p style={{ fontSize: '13px', color: colors.mochaLight, margin: '0 0 16px', maxWidth: '280px', lineHeight: '1.5' }}>
          Have a topic you're passionate about? Gather your people and create a space for connection.
        </p>
        <button style={{
          padding: '10px 24px', background: colors.mocha, color: 'white',
          border: 'none', borderRadius: '20px', fontSize: '13px', fontWeight: '500',
          cursor: 'pointer', fontFamily: fonts.sans, display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{ fontSize: '16px' }}>+</span> Create a Circle
        </button>
      </div>

      {/* Empty state */}
      {filteredCircles.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: colors.mochaMuted, fontSize: '14px' }}>
          No circles match your search. Try a different filter or start your own!
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        div::-webkit-scrollbar { height: 0; width: 0; }
      `}</style>
    </div>
  );
}

// === Section header with count badge ===
function CircleSection({ title, count, isMobile, marginTop = '0', children }) {
  return (
    <div style={{ marginTop }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '18px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif }}>{title}</span>
        <span style={{ fontSize: '12px', color: colors.mochaMuted, background: colors.tagBg, padding: '3px 10px', borderRadius: '12px' }}>
          {count} circle{count !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {children}
      </div>
    </div>
  );
}

// === Circle Card (matches reference: cover, desc, progress, join button) ===
function CircleCard({ circle, isMobile, onClick, isMember = false }) {
  const pct = Math.round((circle.memberCount / circle.totalSpots) * 100);
  const spotsLeft = circle.spotsLeft;
  const isFew = spotsLeft <= 3 && spotsLeft > 0;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'white', borderRadius: '16px', border: `1px solid ${colors.border}`,
        overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column',
      }}
      className="card-hover"
    >
      {/* Cover */}
      <div style={{
        height: '110px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: circle.image_url ? `url(${circle.image_url}) center/cover no-repeat` : circle.coverColor,
        overflow: 'hidden',
      }}>
        {!circle.image_url && (
          <span style={{ fontSize: '28px', fontWeight: '600', fontFamily: fonts.serif, color: colors.mocha, opacity: 0.4, position: 'relative', zIndex: 1 }}>
            {circle.name?.charAt(0)?.toUpperCase() || 'C'}
          </span>
        )}
        {circle.image_url && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.25))' }} />}

        {/* Category badge */}
        <span style={{
          position: 'absolute', top: '10px', left: '10px', fontSize: '11px', fontWeight: '500',
          background: 'rgba(255,255,255,0.88)', color: colors.mocha, padding: '3px 10px', borderRadius: '12px',
          backdropFilter: 'blur(4px)',
        }}>
          {circle.category}
        </span>

        {/* Spots badge */}
        <span style={{
          position: 'absolute', top: '10px', right: '10px', fontSize: '11px', fontWeight: '500',
          padding: '3px 10px', borderRadius: '12px',
          background: isMember ? 'rgba(107,79,58,0.15)' : circle.isFull ? 'rgba(160,160,160,0.2)' : isFew ? 'rgba(180,100,40,0.15)' : 'rgba(107,79,58,0.15)',
          color: isMember ? colors.mochaDark : circle.isFull ? '#666' : isFew ? '#7A3A10' : colors.mochaDark,
        }}>
          {isMember ? 'Member' : circle.isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '16px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif, marginBottom: '5px', lineHeight: '1.3' }}>
          {circle.name}
        </div>

        {/* Description */}
        {circle.description && (
          <div style={{
            fontSize: '12px', color: colors.mochaLight, lineHeight: '1.55', marginBottom: '12px',
            flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {circle.description}
          </div>
        )}
        {!circle.description && <div style={{ flex: 1, marginBottom: '12px' }} />}

        {/* Meta row: avatars + count + frequency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', marginRight: '2px' }}>
            {circle.members?.slice(0, 4).map((m, i) => (
              m.user?.profile_picture ? (
                <img key={m.id} src={m.user.profile_picture} alt="" style={{
                  width: '22px', height: '22px', borderRadius: '50%', border: '2px solid white',
                  objectFit: 'cover', marginLeft: i > 0 ? '-6px' : 0, position: 'relative', zIndex: 4 - i,
                }} />
              ) : (
                <div key={m.id} style={{
                  width: '22px', height: '22px', borderRadius: '50%', border: '2px solid white',
                  background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: '500', color: 'white',
                  marginLeft: i > 0 ? '-6px' : 0, position: 'relative', zIndex: 4 - i,
                }}>
                  {m.user?.name?.charAt(0) || '?'}
                </div>
              )
            ))}
            {circle.memberCount > 4 && (
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%', border: '2px solid white',
                background: colors.mochaMuted, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: '500', color: 'white', marginLeft: '-6px', position: 'relative', zIndex: 0,
              }}>
                +{circle.memberCount - 4}
              </div>
            )}
          </div>
          <span style={{ fontSize: '11px', color: colors.mochaMuted }}>{circle.memberCount}/{circle.totalSpots} members</span>
          <span style={{ fontSize: '11px', background: colors.tagBg, color: colors.tagText, padding: '2px 8px', borderRadius: '10px', marginLeft: 'auto' }}>
            {circle.freq}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: colors.mochaMuted, marginBottom: '5px' }}>
            <span>Spots filled</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: '4px', background: colors.tagBg, borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '4px', transition: 'width 0.4s',
              width: `${pct}%`,
              background: isFew ? colors.warning : colors.mochaMuted,
            }} />
          </div>
        </div>

        {/* Footer: join + peek */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            disabled={isMember}
            style={{
              flex: 1, height: '36px', borderRadius: '20px', fontSize: '13px', fontWeight: '500',
              cursor: isMember ? 'default' : 'pointer', fontFamily: fonts.sans, border: 'none',
              background: isMember ? colors.tagBg : colors.mocha,
              color: isMember ? colors.mochaMuted : 'white',
              transition: 'background 0.15s',
            }}
          >
            {isMember ? 'View circle' : circle.isFull ? 'Join waitlist' : 'Join circle'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            style={{
              height: '36px', width: '36px', borderRadius: '50%',
              border: `1px solid ${colors.border}`, background: 'white',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: colors.mochaLight, fontSize: '14px', flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

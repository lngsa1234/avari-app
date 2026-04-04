// components/AllPeopleView.js
// All People page — redesigned to match circlew_people_page UX reference
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
  Coffee,
  Sparkles,
  UserPlus,
  LayoutGrid,
  List,
} from 'lucide-react';
import { colors as tokens, fonts } from '@/lib/designTokens';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

const colors = {
  mocha: tokens.tagText,
  mochaLight: tokens.primary,
  mochaPale: tokens.bgPale,
  mochaMuted: '#C4A882',
  cream: tokens.bgAlt,
  warmWhite: tokens.bgWarm,
  text: tokens.text,
  textLight: tokens.textSecondary,
  textMuted: tokens.textMuted,
  border: tokens.border,
  borderHover: tokens.borderHover,
  tagBg: tokens.tagBg,
  tagText: tokens.tagText,
  chatBg: '#FFF8F0',
  chatBorder: '#D4956A',
  chatText: '#A0522D',
  success: '#6B8E7B',
  primary: tokens.primary,
};

const INTEREST_FILTERS = [
  'All', 'Tech', 'Entrepreneurship', 'Wellness', 'Finance', 'Parenting', 'Creative', 'Leadership',
];

// Banner colors for cards without profile pictures
const BANNER_COLORS = [
  '#EDE3D8', '#D8E8D5', '#E8DFF5', '#F5E2D0', '#EEE0F5', '#E5E8D4', '#F0E6F5', '#D4E5F7',
];
const AVATAR_COLORS = [
  '#7A5C44', '#4A7A5C', '#6A5A8A', '#A06030', '#7A5A8A', '#5A7A4A', '#8A5A6A', '#4A6A8A',
];

export default function AllPeopleView({
  currentUser,
  supabase,
  onNavigate,
  previousView,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInterest, setSelectedInterest] = useState('All');
  const [sortBy, setSortBy] = useState('default');
  const [viewMode, setViewMode] = useState('list');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [connectionRequested, setConnectionRequested] = useState(false);

  const [searchFocused, setSearchFocused] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // SWR: people data cached across navigation
  const { data: people = [], isLoading: loading, mutate: refreshPeople } = useSupabaseQuery(
    currentUser ? `all-people-${currentUser.id}` : null,
    async (sb) => { return loadPeopleData(sb); }
  );

  const loadPeople = async () => { await refreshPeople(); };

  async function loadPeopleData(sb) {
    try {
      const { data: profilesData, error } = await sb
        .from('profiles')
        .select('*')
        .neq('id', currentUser.id)
        .not('name', 'is', null)
        .order('created_at', { ascending: false });

      if (error || !profilesData?.length) {
        return [];
      }

      // Fetch mutual matches, circle data, interests in parallel
      const profileIds = profilesData.map(p => p.id);
      const [matchRes, myCirclesRes, myInterestsRes] = await Promise.all([
        supabase.rpc('get_mutual_matches', { for_user_id: currentUser.id }),
        supabase.from('connection_group_members').select('group_id').eq('user_id', currentUser.id).eq('status', 'accepted'),
        supabase.from('user_interests').select('interested_in_user_id').eq('user_id', currentUser.id),
      ]);

      const myConnectionIds = new Set((matchRes.data || []).map(m => m.matched_user_id));
      const myCircleIds = (myCirclesRes.data || []).map(c => c.group_id);
      const myInterestIds = new Set((myInterestsRes.data || []).map(i => i.interested_in_user_id));

      // Fetch circle memberships and meetup counts
      let circleMembers = [];
      if (myCircleIds.length > 0) {
        const { data } = await supabase
          .from('connection_group_members')
          .select('user_id, group_id')
          .in('group_id', myCircleIds)
          .eq('status', 'accepted')
          .neq('user_id', currentUser.id);
        circleMembers = data || [];
      }

      const userCircleCount = {};
      circleMembers.forEach(m => {
        userCircleCount[m.user_id] = (userCircleCount[m.user_id] || 0) + 1;
      });

      // Calculate mutual connections
      const [byOthers, inOthers] = await Promise.all([
        supabase.from('user_interests').select('user_id, interested_in_user_id').in('user_id', profileIds),
        supabase.from('user_interests').select('user_id, interested_in_user_id').in('interested_in_user_id', profileIds),
      ]);

      const interestsByUser = {};
      const interestsInUser = {};
      (byOthers.data || []).forEach(i => {
        if (!interestsByUser[i.user_id]) interestsByUser[i.user_id] = new Set();
        interestsByUser[i.user_id].add(i.interested_in_user_id);
      });
      (inOthers.data || []).forEach(i => {
        if (!interestsInUser[i.interested_in_user_id]) interestsInUser[i.interested_in_user_id] = new Set();
        interestsInUser[i.interested_in_user_id].add(i.user_id);
      });

      const personConnections = {};
      profileIds.forEach(id => { personConnections[id] = new Set(); });
      profileIds.forEach(personId => {
        const theyLike = interestsByUser[personId] || new Set();
        const likedThem = interestsInUser[personId] || new Set();
        theyLike.forEach(otherId => { if (likedThem.has(otherId)) personConnections[personId].add(otherId); });
      });

      const userMutualConnections = {};
      profileIds.forEach(personId => {
        let count = 0;
        personConnections[personId].forEach(connId => { if (myConnectionIds.has(connId)) count++; });
        userMutualConnections[personId] = count;
      });

      // Fetch meetup attendance counts per user
      const { data: attendeeData } = await supabase
        .from('meetup_signups')
        .select('user_id')
        .in('user_id', profileIds);
      const userMeetupCount = {};
      (attendeeData || []).forEach(a => {
        userMeetupCount[a.user_id] = (userMeetupCount[a.user_id] || 0) + 1;
      });

      // Fetch user's circles for profile modal
      const { data: allMemberships } = await supabase
        .from('connection_group_members')
        .select('user_id, group_id, connection_groups(id, name, connection_group_members(count))')
        .in('user_id', profileIds)
        .eq('status', 'accepted');

      const userCircles = {};
      (allMemberships || []).forEach(m => {
        if (!userCircles[m.user_id]) userCircles[m.user_id] = [];
        if (m.connection_groups) {
          const exists = userCircles[m.user_id].find(c => c.id === m.connection_groups.id);
          if (!exists) {
            userCircles[m.user_id].push({
              id: m.connection_groups.id,
              name: m.connection_groups.name,
              members: m.connection_groups.connection_group_members?.[0]?.count || 0,
            });
          }
        }
      });

      const enriched = profilesData.map(person => ({
        ...person,
        mutualCircles: userCircleCount[person.id] || 0,
        mutualConnections: userMutualConnections[person.id] || 0,
        meetupsAttended: userMeetupCount[person.id] || 0,
        totalCircles: (userCircles[person.id] || []).length,
        circles: userCircles[person.id] || [],
        isConnected: myConnectionIds.has(person.id),
        hasPendingRequest: !myConnectionIds.has(person.id) && myInterestIds.has(person.id),
      }));

      return enriched;
    } catch (error) {
      console.error('Error loading people:', error);
      return [];
    }
  };

  const filteredPeople = useMemo(() => {
    let result = people.filter(person => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        person.name?.toLowerCase().includes(q) ||
        person.hook?.toLowerCase().includes(q) ||
        person.career?.toLowerCase().includes(q) ||
        person.industry?.toLowerCase().includes(q) ||
        person.city?.toLowerCase().includes(q) ||
        (person.interests || []).some(i => i.toLowerCase().includes(q));

      const matchesInterest = selectedInterest === 'All' ||
        person.industry?.toLowerCase().includes(selectedInterest.toLowerCase()) ||
        person.career?.toLowerCase().includes(selectedInterest.toLowerCase()) ||
        (person.interests || []).some(i => i.toLowerCase().includes(selectedInterest.toLowerCase()));

      return matchesSearch && matchesInterest;
    });

    if (sortBy === 'chat') result.sort((a, b) => (b.open_to_coffee_chat ? 1 : 0) - (a.open_to_coffee_chat ? 1 : 0));
    if (sortBy === 'mutual') result.sort((a, b) => b.mutualConnections - a.mutualConnections);

    return result;
  }, [people, searchQuery, selectedInterest, sortBy]);

  const clearFilters = () => { setSearchQuery(''); setSelectedInterest('All'); };

  const handleRequestConnect = async (personId) => {
    try {
      const { error } = await supabase
        .from('user_interests')
        .insert({ user_id: currentUser.id, interested_in_user_id: personId });
      if (error && error.code !== '23505') console.error('Connect error:', error);
      setConnectionRequested(true);
      setTimeout(() => { setSelectedPerson(null); setConnectionRequested(false); }, 2000);
    } catch (err) { console.error('Connect error:', err); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: `4px solid ${colors.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: colors.textLight, fontFamily: fonts.sans }}>Loading people...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fonts.sans, maxWidth: '820px', margin: '0 auto', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <button
            onClick={() => onNavigate?.(previousView || 'home')}
            aria-label="Go back"
            style={{
              width: '44px', height: '44px', borderRadius: '50%',
              border: `1px solid ${colors.border}`, background: 'white',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={16} style={{ color: colors.mocha }} />
          </button>
          <h1 style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif, margin: 0, letterSpacing: '0.01em' }}>
            Connect with Women
          </h1>
        </div>
        <p style={{ fontSize: '13px', color: colors.mochaLight, margin: 0, paddingLeft: '46px' }}>
          Find inspiring women in your community
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
          placeholder="Search by name, role, or interest..."
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

      {/* Search hints — show when focused and no query yet */}
      {searchFocused && !searchQuery && (() => {
        // Build hints from actual data: top cities, careers, industries
        const hints = [];
        const cityCounts = {};
        const careerCounts = {};
        people.forEach(p => {
          if (p.city) cityCounts[p.city] = (cityCounts[p.city] || 0) + 1;
          if (p.career) careerCounts[p.career] = (careerCounts[p.career] || 0) + 1;
        });
        const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c);
        const topCareers = Object.entries(careerCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);
        topCareers.forEach(c => hints.push(c));
        topCities.forEach(c => hints.push(c));
        return hints.length > 0 ? (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: colors.mochaMuted, lineHeight: '28px' }}>Try:</span>
            {hints.slice(0, 5).map((hint, i) => (
              <button
                key={i}
                onMouseDown={(e) => { e.preventDefault(); setSearchQuery(hint); }}
                style={{
                  height: '28px', padding: '0 12px', borderRadius: '14px',
                  border: `1px solid ${colors.border}`, background: 'white',
                  fontSize: '12px', color: colors.mochaLight, cursor: 'pointer',
                  fontFamily: fonts.sans, transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {hint}
              </button>
            ))}
          </div>
        ) : null;
      })()}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '12px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {INTEREST_FILTERS.map((interest) => {
          const isActive = selectedInterest === interest;
          return (
            <button
              key={interest}
              onClick={() => setSelectedInterest(interest)}
              style={{
                height: '36px', padding: '0 16px', borderRadius: '20px',
                border: `1px solid ${isActive ? colors.mocha : colors.border}`,
                background: isActive ? colors.mocha : 'white',
                color: isActive ? 'white' : colors.mochaLight,
                fontSize: '13px', fontWeight: isActive ? '500' : '400',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: fonts.sans, transition: 'all 0.15s',
              }}
            >
              {interest}
            </button>
          );
        })}
      </div>

      {/* Toolbar: count + sort + view toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', color: colors.mochaLight }}>
          <strong style={{ color: colors.mocha, fontWeight: '500' }}>{filteredPeople.length}</strong> women to connect with
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', border: `1px solid ${colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              style={{
                width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: viewMode === 'grid' ? colors.mocha : 'white',
                color: viewMode === 'grid' ? 'white' : colors.mochaMuted,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label="List view"
              style={{
                width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: viewMode === 'list' ? colors.mocha : 'white',
                color: viewMode === 'list' ? 'white' : colors.mochaMuted,
                border: 'none', borderLeft: `1px solid ${colors.border}`, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <List size={15} />
            </button>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              height: '34px', padding: '0 12px', borderRadius: '8px',
              border: `1px solid ${colors.border}`, background: 'white',
              fontSize: '13px', color: colors.mocha, fontFamily: fonts.sans,
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="default">Sort: Recommended</option>
            <option value="chat">Coffee chat open</option>
            <option value="mutual">Most connections</option>
          </select>
        </div>
      </div>

      {/* How it works banner */}
      <div style={{
        display: 'flex', gap: '12px', alignItems: 'flex-start',
        background: colors.mochaPale, border: `1px solid ${colors.border}`,
        borderRadius: '12px', padding: '14px 16px', marginBottom: '20px',
      }}>
        <Heart size={16} style={{ color: colors.mochaMuted, flexShrink: 0, marginTop: '1px' }} />
        <div>
          <strong style={{ fontSize: '13px', fontWeight: '500', color: colors.mocha, display: 'block', marginBottom: '3px' }}>
            How connecting works
          </strong>
          <span style={{ fontSize: '12px', color: colors.mochaLight, lineHeight: '1.6' }}>
            Attend a group meetup first to unlock 1-on-1 coffee chats — this builds authentic connections!
          </span>
        </div>
      </div>

      {/* People Grid / List */}
      {filteredPeople.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: colors.mochaMuted, fontSize: '14px' }}>
          No results found. Try a different search or filter.
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
          {filteredPeople.map((person, idx) => (
            <PersonCard
              key={person.id}
              person={person}
              bannerColor={BANNER_COLORS[idx % BANNER_COLORS.length]}
              avatarColor={AVATAR_COLORS[idx % AVATAR_COLORS.length]}
              onClick={() => onNavigate?.('userProfile', { userId: person.id })}
              onConnect={() => setSelectedPerson(person)}
            />
          ))}

          {/* Invite card */}
          <div style={{
            background: 'white', borderRadius: '14px', border: `2px dashed ${colors.border}`,
            padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', textAlign: 'center', minHeight: '200px', cursor: 'pointer',
          }}>
            <UserPlus size={36} style={{ color: colors.mochaMuted, marginBottom: '12px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif, margin: '0 0 4px' }}>
              Know someone amazing?
            </h3>
            <p style={{ fontSize: '13px', color: colors.mochaLight, margin: '0 0 16px' }}>Invite her to join!</p>
            <button style={{
              padding: '8px 20px', background: colors.mocha, color: 'white',
              border: 'none', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
              cursor: 'pointer', fontFamily: fonts.sans,
            }}>
              Send Invite
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: colors.border, borderRadius: '14px', overflow: 'hidden', border: `1px solid ${colors.border}` }}>
          {filteredPeople.map((person, idx) => (
            <PersonRow
              key={person.id}
              person={person}
              avatarColor={AVATAR_COLORS[idx % AVATAR_COLORS.length]}
              onClick={() => onNavigate?.('userProfile', { userId: person.id })}
              onConnect={() => setSelectedPerson(person)}
            />
          ))}
        </div>
      )}

      {/* Profile overlay */}
      {selectedPerson && (
        <ProfileOverlay
          person={selectedPerson}
          bannerColor={BANNER_COLORS[people.indexOf(selectedPerson) % BANNER_COLORS.length]}
          avatarColor={AVATAR_COLORS[people.indexOf(selectedPerson) % AVATAR_COLORS.length]}
          isMobile={isMobile}
          connectionRequested={connectionRequested}
          onClose={() => { setSelectedPerson(null); setConnectionRequested(false); }}
          onRequestConnect={() => handleRequestConnect(selectedPerson.id)}
          onNavigate={onNavigate}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        div::-webkit-scrollbar { height: 0; width: 0; }
      `}</style>
    </div>
  );
}

// === Person Card (matches reference: banner + overlapping avatar) ===
function PersonCard({ person, bannerColor, avatarColor, onClick, onConnect }) {
  const initial = person.name ? person.name.charAt(0).toUpperCase() : '?';
  const interests = person.interests || [];
  const tags = interests.length > 0
    ? interests.slice(0, 3)
    : [person.industry, person.career_stage].filter(Boolean).slice(0, 3);

  return (
    <div
      onClick={onClick}
      style={{
        background: 'white', borderRadius: '14px', border: `1px solid ${colors.border}`,
        overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s, transform 0.18s, box-shadow 0.18s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(107,79,58,0.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Banner with overlapping avatar */}
      <div style={{ height: '68px', background: bannerColor, display: 'flex', alignItems: 'flex-end', padding: '0 16px' }}>
        {person.profile_picture ? (
          <img
            src={person.profile_picture}
            alt={person.name}
            style={{
              width: '46px', height: '46px', borderRadius: '50%', border: '3px solid white',
              objectFit: 'cover', position: 'relative', top: '23px', flexShrink: 0,
              background: bannerColor,
            }}
            onLoad={(e) => { e.currentTarget.style.opacity = '1'; }}
          />
        ) : (
          <div style={{
            width: '46px', height: '46px', borderRadius: '50%', border: '3px solid white',
            background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '17px', fontWeight: '500', color: 'white', position: 'relative', top: '23px',
            flexShrink: 0, fontFamily: fonts.serif,
          }}>
            {initial}
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '30px 16px 16px' }}>
        {/* Name + chat badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '15px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif }}>
            {person.name}
          </span>
          {person.open_to_coffee_chat && (
            <span style={{
              fontSize: '11px', background: colors.chatBg, border: `1px solid ${colors.chatBorder}`,
              color: colors.chatText, padding: '2px 9px', borderRadius: '12px', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              Open to chat
            </span>
          )}
        </div>

        {/* Role + industry */}
        {person.career && (
          <div style={{ fontSize: '12px', color: colors.mochaLight, marginBottom: '2px' }}>
            {person.career}{person.industry ? ` · ${person.industry}` : ''}
          </div>
        )}

        {/* Location */}
        {person.city ? (
          <div style={{ fontSize: '12px', color: colors.mochaMuted, marginBottom: '10px' }}>
            <MapPin size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />{person.city}{person.state ? `, ${person.state}` : ''}
          </div>
        ) : (
          <div style={{ marginBottom: '10px' }} />
        )}

        {/* Bio preview */}
        {person.hook && (
          <div style={{
            fontSize: '12px', color: colors.mochaLight, marginBottom: '10px', lineHeight: '1.55',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {person.hook}
          </div>
        )}

        {/* Interest tags */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px', minHeight: '26px' }}>
            {tags.map((tag, i) => (
              <span key={i} style={{ fontSize: '11px', background: colors.tagBg, color: colors.tagText, padding: '3px 10px', borderRadius: '12px' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: social proof + view button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: `1px solid ${colors.border}` }}>
          <span style={{ fontSize: '11px', color: colors.mochaMuted }}>
            {person.mutualConnections || 0} mutual · {person.mutualCircles || 0} circle{person.mutualCircles !== 1 ? 's' : ''}
          </span>
          {person.isConnected ? (
            <span style={{ fontSize: '11px', color: colors.success, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Heart size={10} fill={colors.success} /> Connected
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onConnect?.(); }}
              style={{
                height: '36px', padding: '0 18px', borderRadius: '20px', fontSize: '13px',
                fontWeight: '500', cursor: 'pointer', fontFamily: fonts.sans,
                background: person.hasPendingRequest ? colors.mochaPale : colors.mocha,
                color: person.hasPendingRequest ? colors.mochaMuted : 'white',
                border: 'none', transition: 'background 0.15s',
              }}
              disabled={person.hasPendingRequest}
            >
              {person.hasPendingRequest ? 'Requested' : 'Connect'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// === Person Row (list view — compact, one line per person) ===
function PersonRow({ person, avatarColor, onClick, onConnect }) {
  const initial = person.name ? person.name.charAt(0).toUpperCase() : '?';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', background: 'white', cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = colors.mochaPale; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
    >
      {/* Avatar */}
      {person.profile_picture ? (
        <img
          src={person.profile_picture}
          alt={person.name}
          style={{
            width: '42px', height: '42px', borderRadius: '50%',
            objectFit: 'cover', flexShrink: 0,
          }}
        />
      ) : (
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%',
          background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: '500', color: 'white', flexShrink: 0,
          fontFamily: fonts.serif,
        }}>
          {initial}
        </div>
      )}

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {person.name}
          </span>
          {person.username && (
            <span style={{ fontSize: '11px', color: colors.mochaMuted, flexShrink: 0 }}>@{person.username}</span>
          )}
          {person.open_to_coffee_chat && (
            <Coffee size={13} style={{ color: colors.chatText, flexShrink: 0 }} />
          )}
        </div>
        <div style={{ fontSize: '12px', color: colors.mochaLight, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {[person.career, person.industry].filter(Boolean).join(' · ')}
        </div>
        {person.city && (
          <div style={{ fontSize: '11px', color: colors.mochaMuted, display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
            <MapPin size={10} />{person.city}{person.state ? `, ${person.state}` : ''}
          </div>
        )}
      </div>

      {/* Right side: status or connect */}
      <div style={{ flexShrink: 0 }}>
        {person.isConnected ? (
          <span style={{ fontSize: '11px', color: colors.success, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Heart size={10} fill={colors.success} /> Connected
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onConnect?.(); }}
            style={{
              height: '30px', padding: '0 14px', borderRadius: '16px', fontSize: '12px',
              fontWeight: '500', cursor: 'pointer', fontFamily: fonts.sans,
              background: person.hasPendingRequest ? colors.mochaPale : colors.mocha,
              color: person.hasPendingRequest ? colors.mochaMuted : 'white',
              border: 'none', transition: 'background 0.15s',
            }}
            disabled={person.hasPendingRequest}
          >
            {person.hasPendingRequest ? 'Requested' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  );
}

// === Profile Overlay (matches reference: stats, circles, actions) ===
function ProfileOverlay({ person, bannerColor, avatarColor, isMobile, connectionRequested, onClose, onRequestConnect, onNavigate }) {
  const initial = person.name ? person.name.charAt(0).toUpperCase() : '?';
  const interests = person.interests || [];
  const tags = interests.length > 0
    ? interests
    : [person.industry, person.career_stage].filter(Boolean);

  if (connectionRequested) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(60,35,18,0.45)' }} onClick={onClose} />
        <div style={{ position: 'relative', background: colors.cream, borderRadius: '20px', width: '90%', maxWidth: '400px', padding: '48px 24px', textAlign: 'center', animation: 'slideUp 0.28s ease' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h3 style={{ fontSize: '20px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif, margin: '0 0 8px' }}>
            Connection Request Sent!
          </h3>
          <p style={{ fontSize: '14px', color: colors.mochaLight, margin: '0 0 24px' }}>
            {person.name?.split(' ')[0]} will be notified.
          </p>
          <button onClick={onClose} style={{ padding: '12px 32px', background: colors.mocha, color: 'white', border: 'none', borderRadius: '24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: fonts.sans }}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(60,35,18,0.45)' }} onClick={onClose} />

      <div style={{
        position: 'relative', background: colors.cream, width: '100%', maxWidth: '520px',
        maxHeight: isMobile ? '92vh' : '88vh',
        borderRadius: isMobile ? '20px 20px 0 0' : '20px',
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.28s ease',
      }}>
        {/* Header banner */}
        <div style={{ position: 'relative', height: '110px', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, background: bannerColor, borderRadius: isMobile ? '20px 20px 0 0' : '20px 20px 0 0' }} />
          <button onClick={onClose} style={{
            position: 'absolute', top: '14px', right: '14px', width: '32px', height: '32px',
            borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none',
            cursor: 'pointer', fontSize: '16px', color: colors.mocha,
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
          }}>✕</button>
          {person.profile_picture ? (
            <img
              src={person.profile_picture}
              alt={person.name}
              style={{
                position: 'absolute', bottom: '-28px', left: '20px',
                width: '56px', height: '56px', borderRadius: '50%', border: '3px solid white',
                objectFit: 'cover', background: bannerColor,
              }}
            />
          ) : (
            <div style={{
              position: 'absolute', bottom: '-28px', left: '20px',
              width: '56px', height: '56px', borderRadius: '50%', border: '3px solid white',
              background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: '500', color: 'white', fontFamily: fonts.serif,
            }}>
              {initial}
            </div>
          )}
        </div>

        {/* Profile body */}
        <div style={{ padding: '40px 20px 28px' }}>
          {/* Name + chat badge */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '22px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif, lineHeight: '1.2' }}>
              {person.name}
            </span>
            {person.open_to_coffee_chat && (
              <span style={{
                fontSize: '11px', background: colors.chatBg, border: `1px solid ${colors.chatBorder}`,
                color: colors.chatText, padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap',
                marginTop: '4px', flexShrink: 0,
              }}>
                Open to chat
              </span>
            )}
          </div>

          {/* Role */}
          {person.career && (
            <div style={{ fontSize: '13px', color: colors.mochaLight, marginBottom: '2px' }}>
              {person.career}{person.industry ? ` · ${person.industry}` : ''}
            </div>
          )}

          {/* Location */}
          {person.city && (
            <div style={{ fontSize: '12px', color: colors.mochaMuted, marginBottom: '14px' }}>
              <MapPin size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />{person.city}{person.state ? `, ${person.state}` : ''}
            </div>
          )}

          {/* Bio */}
          {person.hook && (
            <div style={{
              fontSize: '13px', color: colors.mochaLight, lineHeight: '1.65',
              padding: '14px', background: 'white', borderRadius: '10px',
              border: `1px solid ${colors.border}`, marginBottom: '4px',
            }}>
              {person.hook}
            </div>
          )}

          {/* Interests */}
          {tags.length > 0 && (
            <>
              <div style={{ fontSize: '11px', fontWeight: '500', color: colors.mochaMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', marginTop: '18px' }}>
                Interests
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {tags.map((tag, i) => (
                  <span key={i} style={{ fontSize: '11px', background: colors.tagBg, color: colors.tagText, padding: '3px 10px', borderRadius: '12px' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '18px', marginBottom: '4px' }}>
            <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '12px 10px', textAlign: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif, display: 'block' }}>
                {person.mutualConnections || 0}
              </span>
              <span style={{ fontSize: '11px', color: colors.mochaMuted, marginTop: '2px', display: 'block' }}>Mutual</span>
            </div>
            <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '12px 10px', textAlign: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif, display: 'block' }}>
                {person.totalCircles || 0}
              </span>
              <span style={{ fontSize: '11px', color: colors.mochaMuted, marginTop: '2px', display: 'block' }}>Circles</span>
            </div>
            <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '12px 10px', textAlign: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: '500', color: colors.mocha, fontFamily: fonts.serif, display: 'block' }}>
                {person.meetupsAttended || 0}
              </span>
              <span style={{ fontSize: '11px', color: colors.mochaMuted, marginTop: '2px', display: 'block' }}>Meetups</span>
            </div>
          </div>

          {/* Active circles */}
          {(person.circles?.length > 0) && (
            <>
              <div style={{ fontSize: '11px', fontWeight: '500', color: colors.mochaMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', marginTop: '18px' }}>
                Active circles
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px' }}>
                {person.circles.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'white', border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '10px 14px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.mochaMuted, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: colors.mocha, fontWeight: '500' }}>{c.name}</span>
                    <span style={{ fontSize: '11px', color: colors.mochaMuted, marginLeft: 'auto' }}>{c.members} members</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {person.circles?.length === 0 && (
            <>
              <div style={{ fontSize: '11px', fontWeight: '500', color: colors.mochaMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', marginTop: '18px' }}>
                Active circles
              </div>
              <div style={{ fontSize: '12px', color: colors.mochaMuted, padding: '4px 0' }}>Not in any circles yet</div>
            </>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '20px' }}>
            {person.isConnected ? (
              <>
                <button
                  onClick={() => { onClose(); onNavigate?.('userProfile', { userId: person.id }); }}
                  style={{ flex: 1, height: '44px', borderRadius: '24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: fonts.sans, background: colors.mocha, color: 'white', border: 'none' }}
                >
                  View Profile
                </button>
                {person.open_to_coffee_chat && (
                  <button
                    onClick={() => { onClose(); onNavigate?.('scheduleMeetup', { type: 'coffee', connectionId: person.id, connectionName: person.name }); }}
                    style={{ flex: 1, height: '44px', borderRadius: '24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: fonts.sans, background: colors.chatBg, color: colors.chatText, border: `1px solid ${colors.chatBorder}` }}
                  >
                    ☕ Request coffee chat
                  </button>
                )}
              </>
            ) : person.hasPendingRequest ? (
              <>
                <button disabled style={{ flex: 1, height: '44px', borderRadius: '24px', fontSize: '14px', fontWeight: '500', fontFamily: fonts.sans, background: colors.mochaPale, color: colors.mochaMuted, border: 'none', cursor: 'default' }}>
                  Requested
                </button>
                <button
                  onClick={() => { onClose(); onNavigate?.('userProfile', { userId: person.id }); }}
                  style={{ flex: 1, height: '44px', borderRadius: '24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: fonts.sans, background: 'white', color: colors.mocha, border: `1px solid ${colors.borderHover}` }}
                >
                  View Profile
                </button>
              </>
            ) : person.open_to_coffee_chat ? (
              <>
                <button
                  onClick={onRequestConnect}
                  style={{ flex: 1, height: '44px', borderRadius: '24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: fonts.sans, background: colors.chatBg, color: colors.chatText, border: `1px solid ${colors.chatBorder}` }}
                >
                  ☕ Request coffee chat
                </button>
                <button
                  onClick={onRequestConnect}
                  style={{ flex: 1, height: '44px', borderRadius: '24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: fonts.sans, background: 'white', color: colors.mocha, border: `1px solid ${colors.borderHover}` }}
                >
                  Connect
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onRequestConnect}
                  style={{ flex: 1, height: '44px', borderRadius: '24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: fonts.sans, background: colors.mocha, color: 'white', border: 'none' }}
                >
                  Connect
                </button>
                <button
                  onClick={() => { onClose(); onNavigate?.('userProfile', { userId: person.id }); }}
                  style={{ flex: 1, height: '44px', borderRadius: '24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: fonts.sans, background: 'white', color: colors.mocha, border: `1px solid ${colors.borderHover}` }}
                >
                  View Profile
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

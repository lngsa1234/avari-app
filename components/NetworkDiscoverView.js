// components/NetworkDiscoverView.js
// Network discovery page with Vibe Bar, Recommended Section, and Dynamic Results Feed
'use client';

import { useState, useEffect, useMemo } from 'react';
import { parseLocalDate } from '../lib/dateUtils';
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
  X,
  Check,
  UserPlus
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

// Topic chips for search bar
const TOPIC_CHIPS = [
  'Job Search',
  'AI Founding Partner',
  'Vibe Coding',
  'Career Pivot',
  'Fundraising Tips',
  'Work-Life Balance',
  'Networking',
  'Leadership',
  'PM Interviews',
  'Automotive Tech',
  'Mom Founders',
];

// Rotating placeholder hints
const PLACEHOLDER_HINTS = [
  'What brings you here today?',
  'Find women in AI & tech...',
  'Looking for a co-founder?',
];

// Score a circle's relevance for the current user
function scoreCircleForUser(circle, currentUser, connectionIds) {
  let score = 0;
  const reasons = [];

  const members = circle.members || [];

  // 1. Connections as members (0.15 per connection, capped at 0.30)
  const connMembers = members.filter(m => connectionIds.has(m.user_id));
  if (connMembers.length > 0) {
    score += Math.min(connMembers.length * 0.15, 0.30);
    const names = connMembers
      .map(m => m.user?.name?.split(' ')[0])
      .filter(Boolean);
    if (names.length === 1) {
      reasons.push(`${names[0]} is a member`);
    } else if (names.length > 1) {
      reasons.push(`${names.length} of your connections are here`);
    }
  }

  // 2. Interest overlap with members (0.08 per shared interest, capped at 0.25)
  const userInterests = (currentUser.interests || []).map(i => i.toLowerCase());
  if (userInterests.length > 0) {
    const memberInterests = new Set();
    members.forEach(m => {
      (m.user?.interests || []).forEach(i => memberInterests.add(i.toLowerCase()));
    });
    const shared = userInterests.filter(i => memberInterests.has(i));
    if (shared.length > 0) {
      score += Math.min(shared.length * 0.08, 0.25);
      reasons.push(`Shared interests: ${shared.slice(0, 3).join(', ')}`);
    }
  }

  // 3. Career similarity with members (0.05 per match, capped at 0.15)
  const userCareer = (currentUser.career || '').toLowerCase();
  if (userCareer) {
    const careerMatches = members.filter(m =>
      (m.user?.career || '').toLowerCase() === userCareer
    ).length;
    if (careerMatches > 0) {
      score += Math.min(careerMatches * 0.05, 0.15);
      reasons.push(`${careerMatches} member${careerMatches > 1 ? 's' : ''} in ${currentUser.career}`);
    }
  }

  // 4. Circle name/description matches user interests (0.08 per keyword, capped at 0.15)
  if (userInterests.length > 0) {
    const circleText = `${circle.name || ''} ${circle.description || ''}`.toLowerCase();
    const keywordMatches = userInterests.filter(i => circleText.includes(i));
    if (keywordMatches.length > 0) {
      score += Math.min(keywordMatches.length * 0.08, 0.15);
      reasons.push(`Matches your interests`);
    }
  }

  // 5. Ideal group size 3-8 (0.10 for 3-8, 0.05 for 1-2)
  const memberCount = members.length;
  if (memberCount >= 3 && memberCount <= 8) {
    score += 0.10;
  } else if (memberCount >= 1 && memberCount <= 2) {
    score += 0.05;
  }

  // 6. Vibe category exact match (0.05)
  if (currentUser.vibe_category && circle.vibe_category === currentUser.vibe_category) {
    score += 0.05;
    reasons.push('Matches your vibe');
  }

  return {
    score,
    reason: reasons[0] || null,
    reasons,
  };
}

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
  const [sentRequests, setSentRequests] = useState(new Set()); // Track sent connection requests
  const [userRsvps, setUserRsvps] = useState(new Set()); // Track user's RSVPs
  const [rsvpLoading, setRsvpLoading] = useState({});
  const [meetupSignups, setMeetupSignups] = useState({});
  const [searchText, setSearchText] = useState('');
  const [selectedChips, setSelectedChips] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
  const [expandedCircleId, setExpandedCircleId] = useState(null);
  const [meetupImages, setMeetupImages] = useState(() => {
    // Load cached images from localStorage on mount
    // Bump CACHE_VERSION when bgQueries change to force fresh images
    const CACHE_VERSION = 'v2';
    if (typeof window !== 'undefined') {
      try {
        const storedVersion = localStorage.getItem('meetupImagesCacheVersion');
        if (storedVersion !== CACHE_VERSION) {
          localStorage.removeItem('meetupImages');
          localStorage.setItem('meetupImagesCacheVersion', CACHE_VERSION);
          return {};
        }
        const cached = localStorage.getItem('meetupImages');
        return cached ? JSON.parse(cached) : {};
      } catch { return {}; }
    }
    return {};
  });

  const [imageBrightness, setImageBrightness] = useState({});

  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 480;
  const isTablet = windowWidth >= 480 && windowWidth < 768;

  const isNewUser = connections.length === 0;

  // Scored and sorted circles for recommendations
  const connectionIds = useMemo(() =>
    new Set(connections.map(c => c.id)), [connections]);

  const scoredAvailableCircles = useMemo(() => {
    console.log('[Circles] connectionGroups:', connectionGroups.length, 'currentUser:', currentUser?.id);
    const filtered = connectionGroups.filter(group => {
      const isMember = group.members?.some(m => m.user_id === currentUser.id);
      const memberCount = group.members?.length || 0;
      if (isMember) console.log('[Circles] Filtered out (member):', group.name);
      if (memberCount >= 10) console.log('[Circles] Filtered out (full):', group.name);
      return !isMember && memberCount < 10;
    });
    console.log('[Circles] After filter:', filtered.length);
    return filtered
      .map(circle => ({
        ...circle,
        _scoring: scoreCircleForUser(circle, currentUser, connectionIds)
      }))
      .sort((a, b) => b._scoring.score - a._scoring.score);
  }, [connectionGroups, currentUser, connectionIds]);

  // Rotating placeholder animation
  useEffect(() => {
    if (searchText || selectedChips.length > 0) return;
    const interval = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_HINTS.length);
        setPlaceholderVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, [searchText, selectedChips.length]);

  const toggleChip = (chip) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const removeChip = (chip) => {
    setSelectedChips((prev) => prev.filter((c) => c !== chip));
  };

  const clearAll = () => {
    setSearchText('');
    setSelectedChips([]);
  };

  const hasInput = searchText.length > 0 || selectedChips.length > 0;

  useEffect(() => {
    loadData();
  }, [selectedVibe]);

  // Fetch Unsplash images for meetup topics (moved after featuredMeetups is computed)

  // Load user's RSVPs on mount
  useEffect(() => {
    loadUserRsvps();
  }, [currentUser.id]);

  const loadMeetupSignups = async () => {
    try {
      const { data: signupsData, error: signupsError } = await supabase
        .from('meetup_signups')
        .select('*');

      if (signupsError || !signupsData || signupsData.length === 0) return;

      const userIds = [...new Set(signupsData.map(s => s.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, profile_picture')
        .in('id', userIds);

      const profilesMap = {};
      if (profilesData) {
        profilesData.forEach(p => { profilesMap[p.id] = p; });
      }

      console.log('🔍 Signups count:', signupsData.length);
      console.log('🔍 User IDs:', userIds);
      console.log('🔍 Profiles loaded:', profilesData);
      console.log('🔍 Profiles map:', profilesMap);

      const byMeetup = {};
      signupsData.forEach(s => {
        if (!byMeetup[s.meetup_id]) byMeetup[s.meetup_id] = [];
        byMeetup[s.meetup_id].push({
          ...s,
          profile: profilesMap[s.user_id] || null,
        });
      });
      console.log('🔍 Final meetupSignups:', byMeetup);
      setMeetupSignups(byMeetup);
    } catch (err) {
      console.error('Error loading meetup signups:', err);
    }
  };

  useEffect(() => {
    loadMeetupSignups();
  }, [supabase]);

  const loadUserRsvps = async () => {
    try {
      const { data, error } = await supabase
        .from('meetup_signups')
        .select('meetup_id')
        .eq('user_id', currentUser.id);

      if (!error && data) {
        setUserRsvps(new Set(data.map(r => r.meetup_id)));
      }
    } catch (err) {
      console.error('Error loading user RSVPs:', err);
    }
  };

  const handleRsvp = async (meetupId) => {
    if (!meetupId || rsvpLoading[meetupId]) return;

    setRsvpLoading(prev => ({ ...prev, [meetupId]: true }));
    try {
      const isRsvped = userRsvps.has(meetupId);

      if (isRsvped) {
        // Cancel RSVP
        const { error } = await supabase
          .from('meetup_signups')
          .delete()
          .eq('meetup_id', meetupId)
          .eq('user_id', currentUser.id);

        if (error) throw error;

        setUserRsvps(prev => {
          const newSet = new Set(prev);
          newSet.delete(meetupId);
          return newSet;
        });
      } else {
        // Add RSVP
        const { error } = await supabase
          .from('meetup_signups')
          .insert({
            meetup_id: meetupId,
            user_id: currentUser.id
          });

        if (error) throw error;

        setUserRsvps(prev => new Set([...prev, meetupId]));
      }

      // Reload data to update attendee counts
      await loadMeetupSignups();
    } catch (err) {
      console.error('Error handling RSVP:', err);
      alert('Failed to update RSVP. Please try again.');
    } finally {
      setRsvpLoading(prev => ({ ...prev, [meetupId]: false }));
    }
  };

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
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(30);

      console.log('[Circles] Fetched groups:', groups?.length, 'error:', error);

      if (error) {
        console.error('Error fetching connection groups:', error);
        setConnectionGroups([]);
        return;
      }

      if (!groups || groups.length === 0) {
        console.log('[Circles] No active groups found');
        setConnectionGroups([]);
        return;
      }

      const groupIds = groups.map(g => g.id);
      const { data: allMembers, error: membersError } = await supabase
        .from('connection_group_members')
        .select('id, group_id, user_id, status')
        .in('group_id', groupIds)
        .eq('status', 'accepted');

      console.log('[Circles] Members fetched:', allMembers?.length, 'error:', membersError);
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

      console.log('[Circles] Setting state:', enrichedGroups.length);
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
        .select('id, name, career, city, state, hook, industry, career_stage, profile_picture')
        .neq('id', currentUser.id)
        .not('name', 'is', null)
        .limit(10);

      if (error) {
        console.error('Error fetching peer suggestions:', error);
        setPeerSuggestions([]);
        return;
      }

      // Filter out connected users (from connections prop + mutual matches)
      const connectedIds = new Set(connections.map(c => c.connected_user_id || c.id));

      const { data: mutualMatches } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id });
      const myMatchIds = new Set((mutualMatches || []).map(m => m.matched_user_id));

      // Also filter out users the current user has already sent interest to
      const { data: myInterests } = await supabase
        .from('user_interests')
        .select('interested_in_user_id')
        .eq('user_id', currentUser.id);
      const myInterestIds = new Set((myInterests || []).map(i => i.interested_in_user_id));

      // Exclude connections, mutual matches, and already-requested users
      const suggestions = (data || []).filter(u =>
        !connectedIds.has(u.id) && !myMatchIds.has(u.id) && !myInterestIds.has(u.id)
      );
      const suggestionIds = suggestions.map(s => s.id);

      // Get mutual circles
      let userCircleCount = {};
      if (suggestionIds.length > 0) {
        const { data: myCircles } = await supabase
          .from('connection_group_members')
          .select('group_id')
          .eq('user_id', currentUser.id)
          .eq('status', 'accepted');
        const myCircleIds = (myCircles || []).map(c => c.group_id);

        if (myCircleIds.length > 0) {
          const { data: sharedMembers } = await supabase
            .from('connection_group_members')
            .select('user_id, group_id')
            .in('group_id', myCircleIds)
            .in('user_id', suggestionIds)
            .eq('status', 'accepted');

          (sharedMembers || []).forEach(m => {
            if (!userCircleCount[m.user_id]) userCircleCount[m.user_id] = new Set();
            userCircleCount[m.user_id].add(m.group_id);
          });
        }
      }

      // Get mutual connections (shared connections with current user)
      let userMutualConnections = {};
      if (suggestionIds.length > 0) {
        for (const personId of suggestionIds) {
          const { data: personMatches } = await supabase
            .rpc('get_mutual_matches', { for_user_id: personId });
          let count = 0;
          (personMatches || []).forEach(m => {
            if (myMatchIds.has(m.matched_user_id)) count++;
          });
          userMutualConnections[personId] = count;
        }
      }

      const enriched = suggestions.slice(0, 4).map(person => ({
        ...person,
        mutualCircles: userCircleCount[person.id] ? userCircleCount[person.id].size : 0,
        mutualConnections: userMutualConnections[person.id] || 0,
      }));

      setPeerSuggestions(enriched);
    } catch (error) {
      console.error('Error loading peer suggestions:', error);
      setPeerSuggestions([]);
    }
  };

  const handleConnect = async (personId) => {
    if (!currentUser?.id || sentRequests.has(personId)) return;
    setSentRequests(prev => new Set(prev).add(personId));
    try {
      const { error } = await supabase
        .from('user_interests')
        .insert({
          user_id: currentUser.id,
          interested_in_user_id: personId,
        });
      if (error) {
        // If duplicate, keep the "Requested" state
        if (!error.message?.includes('duplicate')) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error sending connection request:', error);
      setSentRequests(prev => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
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

  // Get upcoming meetups (for Trending This Week - shows all events)
  const upcomingMeetups = filteredMeetups
    .filter(m => parseLocalDate(m.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

  // Community Events - only meetups without a circle (public events)
  const featuredMeetups = upcomingMeetups.filter(m => !m.circle_id).slice(0, 4);

  // Fetch Unsplash images for featured meetups
  const featuredMeetupIds = featuredMeetups.map(m => m.id).join(',');
  useEffect(() => {
    const unsplashKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
    if (!unsplashKey || featuredMeetups.length === 0) return;

    let cancelled = false;

    const fetchImages = async () => {
      const newImages = {};

      await Promise.all(
        featuredMeetups.map(async (meetup, index) => {
          if (meetup.image_url || meetupImages[meetup.id]) return; // Has uploaded photo or already cached
          try {
            // Authentic, candid community-focused backgrounds
            const bgQueries = [
              'diverse people laughing outdoors candid',
              'community gathering golden hour unposed',
              'women collaboration workshop warm lighting',
              'supportive conversation soft sunlight',
              'neighborhood block party real people',
              'people sharing meal long table candid',
              'group learning craft hands-on',
              'outdoor fitness class park vibrant',
            ];
            const query = bgQueries[index % bgQueries.length];
            const page = (index % 5) + 1;
            const res = await fetch(
              `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&page=${page}&orientation=portrait`,
              { headers: { Authorization: `Client-ID ${unsplashKey}` } }
            );
            if (!res.ok) return;
            const data = await res.json();
            const imageUrl = data.results?.[0]?.urls?.small;
            if (imageUrl) {
              newImages[meetup.id] = imageUrl;
            }
          } catch (err) {
            // Fall back to gradient
          }
        })
      );

      if (!cancelled && Object.keys(newImages).length > 0) {
        setMeetupImages(prev => {
          const updated = { ...prev, ...newImages };
          try { localStorage.setItem('meetupImages', JSON.stringify(updated)); } catch {}
          return updated;
        });
      }
    };

    fetchImages();
    return () => { cancelled = true; };
  }, [featuredMeetupIds]);

  // Analyze image brightness for text color adaptation
  useEffect(() => {
    const analyzeImages = () => {
      Object.entries(meetupImages).forEach(([meetupId, url]) => {
        if (imageBrightness[meetupId] !== undefined) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const size = 50;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;
            let totalBrightness = 0;
            const pixelCount = data.length / 4;
            for (let i = 0; i < data.length; i += 4) {
              totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            }
            const avgBrightness = totalBrightness / pixelCount;
            setImageBrightness(prev => ({ ...prev, [meetupId]: avgBrightness }));
          } catch {
            // CORS or other error — default to dark overlay
          }
        };
        img.src = url;
      });
    };
    if (Object.keys(meetupImages).length > 0) analyzeImages();
  }, [meetupImages]);

  // Recommended meetups (non-RSVP'd only for "Community Events" section)
  const recommendedMeetups = upcomingMeetups.filter(m => !m.circle_id && !userRsvps.has(m.id)).slice(0, 4);

  // Format time for display
  const formatTime = (timeStr) => {
    if (!timeStr) return '7:00 PM';
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
      return timeStr;
    }
  };

  // Get recommended meetup based on vibe (only non-RSVP'd events)
  const getRecommendedContent = () => {
    const meetup = recommendedMeetups[0];

    const vibeContent = {
      advice: {
        title: meetup?.topic || 'Career Pivot AMA',
        subtitle: meetup?.description || 'Connect with experienced leaders',
        groupSize: `Small group (${meetup?.participant_limit || 8})`,
        matchReason: 'Advice',
      },
      peers: {
        title: meetup?.topic || 'Coffee Chat Meetup',
        subtitle: meetup?.description || 'Career transition support',
        groupSize: `Small group (${meetup?.participant_limit || 8})`,
        matchReason: 'Support',
      },
      grow: {
        title: meetup?.topic || 'Skills Workshop',
        subtitle: meetup?.description || 'Interactive learning session',
        groupSize: `Small group (${meetup?.participant_limit || 12})`,
        matchReason: 'Growth',
      },
    };

    const content = vibeContent[selectedVibe] || vibeContent.peers;

    return {
      ...content,
      date: meetup ? parseLocalDate(meetup.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Thu, Feb 6',
      time: formatTime(meetup?.time),
      location: meetup?.location || 'Virtual',
      spots: meetup ? Math.max(1, (meetup.participant_limit || 8) - (meetup.signups?.length || 0)) : 2,
      totalSpots: meetup?.participant_limit || 8,
      attendees: (meetup?.signups || []).slice(0, 3).map(s => ({
        name: s.user?.name || 'Member',
        emoji: '👩🏻'
      })),
      extraCount: Math.max(0, (meetup?.signups?.length || 0) - 3),
      meetupId: meetup?.id,
      isGroup: !meetup, // Only show as group if there's no actual meetup
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
      {/* Search Bar + Topic Chips */}
      <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
        {/* Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '6px',
          padding: selectedChips.length > 0 ? '10px 14px' : '0 14px',
          minHeight: '48px',
          borderRadius: '999px',
          backgroundColor: searchFocused ? '#FFFFFF' : '#FDF8F4',
          border: searchFocused ? '2px solid #8B5E3C' : '1px solid #C49A6C40',
          boxShadow: searchFocused
            ? '0 0 0 3px #8B5E3C25, 0 2px 8px rgba(139, 94, 60, 0.15)'
            : '0 2px 8px rgba(139, 94, 60, 0.1)',
          transition: 'all 0.2s ease',
          position: 'relative',
          ...(selectedChips.length > 0 ? { borderRadius: '20px' } : {}),
        }}>
          {/* Magnifying glass */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            height: selectedChips.length > 0 ? '32px' : '48px',
            flexShrink: 0,
          }}>
            <Search size={18} style={{ color: '#8B5E3C' }} />
          </div>

          {/* Selected chip pills inside bar */}
          {selectedChips.map((chip) => (
            <span
              key={chip}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: '#8B5E3C15',
                border: '1px solid #8B5E3C40',
                fontSize: '12.5px',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: '500',
                color: '#6B4226',
                whiteSpace: 'nowrap',
                lineHeight: '1.4',
              }}
            >
              {chip}
              <button
                onClick={() => removeChip(chip)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#8B5E3C',
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {/* Text input */}
          <div style={{ flex: 1, position: 'relative', minWidth: '80px', height: selectedChips.length > 0 ? '32px' : '48px', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '14px',
                fontFamily: "'Montserrat', sans-serif",
                color: '#4A3728',
              }}
            />
            {/* Animated placeholder */}
            {!hasInput && (
              <span style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '14px',
                fontFamily: "'Montserrat', sans-serif",
                color: '#A0714F',
                pointerEvents: 'none',
                opacity: placeholderVisible ? 1 : 0,
                transition: 'opacity 0.4s ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}>
                {PLACEHOLDER_HINTS[placeholderIndex]}
              </span>
            )}
          </div>

          {/* Clear all button */}
          {hasInput && (
            <button
              onClick={clearAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: '#8B5E3C20',
                cursor: 'pointer',
                flexShrink: 0,
                alignSelf: 'center',
                color: '#6B4226',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Topic Chips */}
        <div style={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: '8px',
          marginTop: '12px',
          overflowX: 'auto',
          paddingBottom: '4px',
          marginLeft: isMobile ? '-16px' : '-24px',
          marginRight: isMobile ? '-16px' : '-24px',
          paddingLeft: isMobile ? '16px' : '24px',
          paddingRight: isMobile ? '16px' : '24px',
          WebkitOverflowScrolling: 'touch',
        }}>
          {TOPIC_CHIPS.map((chip) => {
            const isSelected = selectedChips.includes(chip);
            return (
              <button
                key={chip}
                onClick={() => toggleChip(chip)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 11px',
                  borderRadius: '999px',
                  border: isSelected ? '1.5px solid #8B5E3C' : '1px solid #C49A6C50',
                  backgroundColor: isSelected ? '#8B5E3C12' : '#FDF8F4',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: '500',
                  color: isSelected ? '#6B4226' : '#6B4226CC',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {isSelected && <Check size={13} style={{ color: '#8B5E3C' }} />}
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      {/* Community Events */}
      <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? '12px' : '16px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
                Community Events
              </h2>
              <p style={{ fontSize: isMobile ? '13px' : '14px', color: colors.textLight, margin: '4px 0 0' }}>
                Join conversations that matter to you
              </p>
            </div>
            {featuredMeetups.length > 0 && (
              <button
                onClick={() => onNavigate?.('allEvents')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: colors.primary,
                  fontSize: isMobile ? '13px' : '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}>
                See all <ChevronRight size={isMobile ? 12 : 14} />
              </button>
            )}
          </div>

          {featuredMeetups.length === 0 ? (
            <div style={{
              backgroundColor: colors.cream,
              borderRadius: isMobile ? '14px' : '16px',
              border: `1px solid ${colors.border}`,
              padding: isMobile ? '28px 16px' : '32px 20px',
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: isMobile ? '14px' : '15px',
                color: colors.textLight,
                margin: '0 0 4px',
                lineHeight: '1.5',
              }}>
                No upcoming events yet
              </p>
              <p style={{
                fontSize: isMobile ? '12px' : '13px',
                color: colors.textMuted,
                margin: 0,
              }}>
                Have a topic in mind? Suggest it below and rally support!
              </p>
            </div>
          ) : (
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
              const signups = meetupSignups[meetup.id] || [];
              const signupCount = signups.length;
              const spotsLeft = Math.max(0, (meetup.participant_limit || meetup.max_attendees || 8) - signupCount);
              const hasUploadedImage = !!meetup.image_url;
              const bgImage = meetup.image_url || meetupImages[meetup.id];
              const brightness = imageBrightness[meetup.id];
              const isLightImage = !hasUploadedImage && bgImage && brightness !== undefined && brightness > 140;
              const textColor = isLightImage ? '#3E2C1E' : 'white';
              const textColorMuted = isLightImage ? 'rgba(62,44,30,0.7)' : 'rgba(255,255,255,0.8)';
              const textColorFaint = isLightImage ? 'rgba(62,44,30,0.4)' : 'rgba(255,255,255,0.4)';
              const badgeBg = isLightImage ? 'rgba(62,44,30,0.12)' : 'rgba(255,255,255,0.2)';
              const spotsBg = spotsLeft <= 2 ? 'rgba(212, 85, 58, 0.85)' : (isLightImage ? 'rgba(62,44,30,0.75)' : 'rgba(139, 94, 60, 0.85)');
              const textShadow = isLightImage ? 'none' : '0 1px 4px rgba(0,0,0,0.4)';
              const fallbackGradient = [
                'linear-gradient(160deg, #6B4226 0%, #A0714F 50%, #C49A6C 100%)',
                'linear-gradient(160deg, #5C6B42 0%, #7A9455 50%, #A0B87A 100%)',
                'linear-gradient(160deg, #6B4266 0%, #945587 50%, #B87AA0 100%)',
                'linear-gradient(160deg, #42536B 0%, #557A94 50%, #7AA0B8 100%)',
                'linear-gradient(160deg, #6B5C42 0%, #947A55 50%, #B8A07A 100%)',
                'linear-gradient(160deg, #4A426B 0%, #6B5594 50%, #947AB8 100%)',
              ][index % 6];

              return (
                <div
                  key={meetup.id}
                  onClick={() => onNavigate?.('eventDetail', { meetupId: meetup.id })}
                  style={{
                    minWidth: isMobile ? '280px' : '310px',
                    height: isMobile ? '200px' : '220px',
                    borderRadius: isMobile ? '14px' : '16px',
                    overflow: 'hidden',
                    boxShadow: '0 3px 14px rgba(0, 0, 0, 0.18)',
                    flexShrink: 0,
                    position: 'relative',
                    cursor: 'pointer',
                  }}>
                  {/* Gradient background (always present as base/fallback) */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: fallbackGradient,
                  }} />
                  {/* Unsplash image overlay (on top of gradient) */}
                  {bgImage && (
                    <img
                      src={bgImage}
                      alt=""
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: 'saturate(0.85) sepia(0.1) brightness(0.95)',
                      }}
                    />
                  )}
                  {/* Adaptive overlay for readability */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: hasUploadedImage
                      ? 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.65) 100%)'
                      : bgImage
                        ? isLightImage
                          ? 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 35%, rgba(255,255,255,0.2) 60%, rgba(253,248,243,0.75) 100%)'
                          : 'linear-gradient(180deg, rgba(107,66,38,0.1) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.2) 60%, rgba(30,20,12,0.75) 100%)'
                        : 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.4) 100%)',
                  }} />

                  {/* Top row: date + spots */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: isMobile ? '10px' : '12px',
                    zIndex: 2,
                  }}>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: isMobile ? '3px 8px' : '4px 10px',
                      backgroundColor: badgeBg,
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                      borderRadius: '8px',
                      fontSize: isMobile ? '11px' : '12px',
                      fontWeight: '600',
                      color: textColor,
                    }}>
                      <Calendar size={isMobile ? 11 : 12} />
                      {parseLocalDate(meetup.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{
                      padding: isMobile ? '3px 8px' : '4px 10px',
                      backgroundColor: spotsBg,
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                      borderRadius: '8px',
                      fontSize: isMobile ? '10px' : '11px',
                      fontWeight: '600',
                      color: spotsLeft <= 2 ? 'white' : textColor,
                    }}>
                      {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                    </span>
                  </div>

                  {/* Center: topic title */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    transform: 'translateY(-50%)',
                    padding: isMobile ? '0 16px' : '0 20px',
                    textAlign: 'center',
                    zIndex: 2,
                  }}>
                    <h4 style={{
                      fontSize: isMobile ? '20px' : '22px',
                      fontWeight: '700',
                      color: textColor,
                      margin: 0,
                      fontFamily: fonts.serif,
                      lineHeight: '1.35',
                      textShadow: textShadow,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {meetup.topic}
                    </h4>
                    {/* Time + location under title */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: isMobile ? '8px' : '10px',
                      marginTop: '8px',
                      fontSize: isMobile ? '11px' : '12px',
                      color: textColorMuted,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={isMobile ? 10 : 11} /> {meetup.time}
                      </span>
                      <span style={{ color: textColorFaint }}>|</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <MapPin size={isMobile ? 10 : 11} /> {meetup.location || 'Virtual'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: avatars + RSVP */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: isMobile ? '12px' : '14px',
                    zIndex: 2,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex', marginRight: '6px' }}>
                        {signups.slice(0, 3).map((signup, idx) => (
                          <div key={signup.user_id || idx} style={{
                            width: isMobile ? '22px' : '24px',
                            height: isMobile ? '22px' : '24px',
                            borderRadius: '50%',
                            backgroundColor: colors.primaryLight,
                            border: isLightImage ? '2px solid rgba(255,255,255,0.9)' : '2px solid rgba(255,255,255,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: isMobile ? '9px' : '10px',
                            fontWeight: '600',
                            color: 'white',
                            marginLeft: idx > 0 ? '-6px' : 0,
                            overflow: 'hidden',
                          }}>
                            {signup.profile?.profile_picture ? (
                              <img
                                src={signup.profile.profile_picture}
                                alt={signup.profile.name || ''}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              signup.profile?.name?.[0] || '?'
                            )}
                          </div>
                        ))}
                        {signupCount > 3 && (
                          <div style={{
                            width: isMobile ? '22px' : '24px',
                            height: isMobile ? '22px' : '24px',
                            borderRadius: '50%',
                            backgroundColor: isLightImage ? 'rgba(62,44,30,0.2)' : 'rgba(255,255,255,0.25)',
                            border: isLightImage ? '2px solid rgba(255,255,255,0.9)' : '2px solid rgba(255,255,255,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: isMobile ? '8px' : '9px',
                            fontWeight: '600',
                            color: textColor,
                            marginLeft: '-6px',
                          }}>
                            +{signupCount - 3}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: isMobile ? '11px' : '12px', color: textColorMuted, fontWeight: '500' }}>
                        {signupCount > 0 ? `${signupCount} going` : 'Be first!'}
                      </span>
                    </div>
                    {userRsvps.has(meetup.id) ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRsvp(meetup.id); }}
                        disabled={rsvpLoading[meetup.id]}
                        style={{
                          padding: isMobile ? '7px 14px' : '8px 18px',
                          backgroundColor: isLightImage ? 'rgba(76,175,80,0.12)' : 'rgba(168,230,207,0.25)',
                          color: isLightImage ? '#2E7D32' : '#A8E6CF',
                          border: isLightImage ? '1.5px solid rgba(76,175,80,0.3)' : '1.5px solid rgba(168,230,207,0.5)',
                          borderRadius: '8px',
                          fontSize: isMobile ? '12px' : '13px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}>
                        {rsvpLoading[meetup.id] ? '...' : <><Check size={isMobile ? 12 : 13} /> Going</>}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRsvp(meetup.id); }}
                        disabled={rsvpLoading[meetup.id]}
                        style={{
                          padding: isMobile ? '7px 16px' : '8px 20px',
                          backgroundColor: isLightImage ? colors.primary : 'rgba(255,255,255,0.95)',
                          color: isLightImage ? 'white' : colors.text,
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: isMobile ? '12px' : '13px',
                          fontWeight: '700',
                          cursor: rsvpLoading[meetup.id] ? 'not-allowed' : 'pointer',
                        }}>
                        {rsvpLoading[meetup.id] ? '...' : 'RSVP'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
          )}
        </div>

      {/* Trending Requests */}
      {meetupRequests.length > 0 && (
        <div style={{
          marginBottom: isMobile ? '24px' : '32px',
          marginLeft: isMobile ? '-16px' : '-24px',
          marginRight: isMobile ? '-16px' : '-24px',
          padding: isMobile ? '20px 16px' : '24px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '12px' : '16px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600', color: '#3D2E1F', margin: 0, fontFamily: fonts.serif }}>
                Trending Requests
              </h2>
              <p style={{ fontSize: isMobile ? '13px' : '14px', color: '#7A6B5D', margin: '4px 0 0' }}>
                Topics the community wants — support to make them happen
              </p>
            </div>
          </div>

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
            {meetupRequests.slice(0, 6).map((request) => {
              const vibeInfo = VIBE_CATEGORIES.find(v => v.id === request.vibe_category);
              const hasSupported = request.supporters?.some(s => s.user_id === currentUser?.id);
              const isOwner = request.user_id === currentUser?.id;

              return (
                <div
                  key={request.id}
                  style={{
                    minWidth: isMobile ? '240px' : '270px',
                    maxWidth: isMobile ? '240px' : '270px',
                    padding: isMobile ? '16px' : '20px',
                    backgroundColor: '#FFFCF8',
                    borderRadius: '16px',
                    border: '1px solid #DDD2C2',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isMobile ? '12px' : '14px',
                    transition: 'box-shadow 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(139,111,71,0.12)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Vote badge + Category tag */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: isMobile ? '5px 12px' : '6px 14px',
                      borderRadius: '20px',
                      backgroundColor: '#FDF8F2',
                    }}>
                      <span style={{
                        fontSize: isMobile ? '16px' : '18px',
                        fontWeight: '700',
                        color: '#8B6F47',
                        fontFamily: "'DM Serif Display', Georgia, serif",
                        lineHeight: '1',
                      }}>
                        {request.supporter_count || 0}
                      </span>
                      <span style={{
                        fontSize: isMobile ? '9px' : '10px',
                        color: '#7A6B5D',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontFamily: "'Nunito Sans', sans-serif",
                      }}>
                        VOTES
                      </span>
                    </div>
                    {vibeInfo && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: isMobile ? '4px 10px' : '5px 12px',
                        borderRadius: '20px',
                        backgroundColor: '#F8F0E4',
                        fontSize: isMobile ? '11px' : '12px',
                        color: '#7A6B5D',
                        fontWeight: '600',
                        fontFamily: "'Nunito Sans', sans-serif",
                      }}>
                        {vibeInfo.emoji} {vibeInfo.label}
                      </div>
                    )}
                  </div>

                  {/* Topic title */}
                  <p style={{
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '700',
                    color: '#3D2E1F',
                    margin: 0,
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: '1.3',
                    flex: 1,
                  }}>
                    {request.topic}
                  </p>

                  {/* Support button + Host this */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    {hasSupported ? (
                      <button
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: isMobile ? '7px 14px' : '8px 16px',
                          backgroundColor: '#E8D9C6',
                          color: '#8B6F47',
                          border: 'none',
                          borderRadius: '20px',
                          fontSize: isMobile ? '12px' : '13px',
                          fontWeight: '700',
                          cursor: 'default',
                          fontFamily: "'Nunito Sans', sans-serif",
                        }}
                      >
                        👍 Supported
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSupportRequest(request.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: isMobile ? '7px 14px' : '8px 16px',
                          backgroundColor: '#8B6F47',
                          color: 'white',
                          border: 'none',
                          borderRadius: '20px',
                          fontSize: isMobile ? '12px' : '13px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          fontFamily: "'Nunito Sans', sans-serif",
                          transition: 'opacity 0.2s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                      >
                        👍 Support
                      </button>
                    )}
                    <button
                      onClick={() => handleHostRequest(request)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8B6F47',
                        fontSize: isMobile ? '11px' : '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        padding: 0,
                        fontFamily: "'Nunito Sans', sans-serif",
                        letterSpacing: '0.2px',
                        flexShrink: 0,
                      }}
                    >
                      Host this
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Suggest a topic card */}
            <button
              onClick={() => setShowRequestModal(true)}
              style={{
                minWidth: isMobile ? '140px' : '160px',
                maxWidth: isMobile ? '140px' : '160px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: isMobile ? '16px' : '20px',
                backgroundColor: 'transparent',
                color: '#8B6F47',
                border: '1.5px dashed #DDD2C2',
                borderRadius: '16px',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '700',
                cursor: 'pointer',
                fontFamily: "'Nunito Sans', sans-serif",
                flexShrink: 0,
                transition: 'border-color 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8B6F47'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#DDD2C2'; }}
            >
              <Plus size={isMobile ? 18 : 20} />
              Suggest a topic
            </button>
          </div>
        </div>
      )}

      {/* Intimate Circles */}
      {(() => {
        const availableCircles = scoredAvailableCircles;

        const circleGradients = [
          'linear-gradient(160deg, #6B4226 0%, #A0714F 50%, #C49A6C 100%)',
          'linear-gradient(160deg, #5C6B42 0%, #7A9455 50%, #A0B87A 100%)',
          'linear-gradient(160deg, #6B4266 0%, #945587 50%, #B87AA0 100%)',
          'linear-gradient(160deg, #42536B 0%, #557A94 50%, #7AA0B8 100%)',
          'linear-gradient(160deg, #6B5C42 0%, #947A55 50%, #B8A07A 100%)',
          'linear-gradient(160deg, #4A426B 0%, #6B5594 50%, #947AB8 100%)',
        ];

        const avatarColors = ['#8B5E3C', '#A0714F', '#6B4226', '#C49A6C'];

        const expandedCircle = expandedCircleId
          ? availableCircles.find(c => c.id === expandedCircleId)
          : null;

        // Show full-width prompt when no circles available
        if (availableCircles.length === 0) {
          return (
            <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '12px' : '16px' }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
                    Intimate Circles
                  </h2>
                  <p style={{ fontSize: isMobile ? '13px' : '14px', color: colors.textLight, margin: '4px 0 0' }}>
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
                    fontSize: isMobile ? '13px' : '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}>
                  See all <ChevronRight size={isMobile ? 12 : 14} />
                </button>
              </div>

              <div
                onClick={() => onNavigate?.('createCircle')}
                style={{
                  background: 'linear-gradient(135deg, #F5EDE4 0%, #EDE3D7 50%, #E8DDD0 100%)',
                  borderRadius: '19px',
                  padding: isMobile ? '28px 20px' : '32px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: '1px solid #E0D5C7',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#D8CFC6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '22px' }}>✨</span>
                </div>

                <h3 style={{
                  fontSize: isMobile ? '20px' : '24px',
                  fontWeight: '600',
                  color: '#3E2C1E',
                  margin: '0 0 8px',
                  fontFamily: fonts.serif,
                }}>
                  Start your own Circle
                </h3>

                <p style={{
                  fontSize: isMobile ? '13px' : '14px',
                  color: '#7A6855',
                  margin: '0 0 18px',
                  lineHeight: '1.6',
                  maxWidth: '320px',
                  fontStyle: 'italic',
                }}>
                  Start a trusted small group of 6-10 women to meet weekly and help each other move forward.
                </p>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginBottom: '20px',
                  alignItems: 'flex-start',
                }}>
                  {['6-10 women per Circle', 'Weekly check-ins', 'Clear next steps'].map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#8B6F5C',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Check size={12} style={{ color: 'white' }} />
                      </div>
                      <span style={{
                        fontSize: isMobile ? '13px' : '14px',
                        fontWeight: '500',
                        color: '#3E2C1E',
                      }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.('createCircle');
                  }}
                  style={{
                    padding: isMobile ? '11px 28px' : '12px 32px',
                    backgroundColor: '#8B6F5C',
                    color: 'white',
                    border: 'none',
                    borderRadius: '999px',
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Create a circle
                </button>
              </div>
            </div>
          );
        }

        return (
          <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '12px' : '16px' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
                  Intimate Circles
                </h2>
                <p style={{ fontSize: isMobile ? '13px' : '14px', color: colors.textLight, margin: '4px 0 0' }}>
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
                  fontSize: isMobile ? '13px' : '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}>
                See all <ChevronRight size={isMobile ? 12 : 14} />
              </button>
            </div>

            {/* Netflix-style poster row */}
            <div style={{
              display: 'flex',
              gap: isMobile ? '10px' : '12px',
              overflowX: 'auto',
              paddingBottom: '8px',
              marginLeft: isMobile ? '-16px' : '-24px',
              marginRight: isMobile ? '-16px' : '-24px',
              paddingLeft: isMobile ? '16px' : '24px',
              paddingRight: isMobile ? '16px' : '24px',
              WebkitOverflowScrolling: 'touch',
              alignItems: 'flex-start',
            }}>
              {availableCircles.slice(0, 6).map((circle, index) => {
                const memberCount = circle.members?.length || 0;
                const maxMembers = circle.max_members || 10;
                const spotsLeft = maxMembers - memberCount;
                const isInviteOnly = !!circle.is_private;
                const isExpanded = expandedCircleId === circle.id;
                const description = circle.description
                  || (circle.vibe_category === 'advice' ? 'Mentorship & guidance'
                  : circle.vibe_category === 'peers' ? 'Peer support & community'
                  : circle.vibe_category === 'grow' ? 'Career growth & skills'
                  : 'Connect & grow together');

                const cardWidth = isMobile ? 200 : 230;
                const collapsedHeight = isMobile ? 220 : 250;
                return (
                  <div
                    key={circle.id}
                    onClick={() => setExpandedCircleId(isExpanded ? null : circle.id)}
                    style={{
                      width: `${isExpanded ? cardWidth + 40 : cardWidth}px`,
                      minWidth: `${isExpanded ? cardWidth + 40 : cardWidth}px`,
                      borderRadius: '14px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      flexShrink: 0,
                      position: 'relative',
                      border: isExpanded ? `2.5px solid ${colors.primary}` : '2.5px solid transparent',
                      transition: 'all 0.3s ease',
                      boxShadow: isExpanded
                        ? `0 8px 24px ${colors.primary}35`
                        : '0 3px 12px rgba(0,0,0,0.18)',
                    }}
                  >
                    {/* Gradient poster area */}
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      height: `${collapsedHeight}px`,
                    }}>
                      {/* Gradient background */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: circleGradients[index % circleGradients.length],
                      }} />

                      {/* Top-left: Open/Invite Only pill */}
                      <span style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: isMobile ? '10px' : '11px',
                        fontWeight: '700',
                        letterSpacing: '0.3px',
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                        color: 'white',
                        zIndex: 2,
                      }}>
                        {isInviteOnly ? 'Invite Only' : 'Open'}
                      </span>

                      {/* Recommendation reason badge */}
                      {circle._scoring?.reason && (
                        <span style={{
                          position: 'absolute',
                          top: '10px',
                          left: isInviteOnly ? '100px' : '68px',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: isMobile ? '9px' : '10px',
                          fontWeight: '600',
                          backgroundColor: 'rgba(255,255,255,0.22)',
                          backdropFilter: 'blur(4px)',
                          WebkitBackdropFilter: 'blur(4px)',
                          color: 'white',
                          zIndex: 2,
                          maxWidth: '130px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {circle._scoring.reason}
                        </span>
                      )}

                      {/* Top-right: member count */}
                      <span style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontSize: isMobile ? '11px' : '12px',
                        fontWeight: '700',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                        color: 'white',
                        zIndex: 2,
                      }}>
                        {memberCount}/{maxMembers}
                      </span>

                      {/* Bottom gradient scrim + circle name */}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '36px 12px 12px',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
                        zIndex: 2,
                      }}>
                        <h4 style={{
                          fontSize: isMobile ? '15px' : '17px',
                          fontWeight: '700',
                          color: 'white',
                          margin: 0,
                          fontFamily: fonts.serif,
                          lineHeight: '1.3',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {circle.name}
                        </h4>
                      </div>
                    </div>

                    {/* Expanded detail section */}
                    {isExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          backgroundColor: colors.warmWhite,
                          padding: isMobile ? '14px 12px 16px' : '16px 14px 18px',
                          animation: 'slideDown 0.25s ease-out',
                        }}
                      >
                        {/* Description */}
                        <p style={{
                          fontSize: isMobile ? '12px' : '13px',
                          color: colors.textLight,
                          margin: '0 0 12px',
                          lineHeight: '1.5',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {description}
                        </p>

                        {/* Connection social proof */}
                        {(() => {
                          const connInCircle = (circle.members || []).filter(m => connectionIds.has(m.user_id));
                          if (connInCircle.length === 0) return null;
                          const names = connInCircle.map(m => m.user?.name?.split(' ')[0]).filter(Boolean);
                          const text = names.length === 1
                            ? `${names[0]} is here`
                            : `${names.length} of your connections are here`;
                          return (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              backgroundColor: `${colors.primary}12`,
                              marginBottom: '10px',
                            }}>
                              <UserPlus size={13} style={{ color: colors.primary, flexShrink: 0 }} />
                              <span style={{
                                fontSize: isMobile ? '11px' : '12px',
                                fontWeight: '600',
                                color: colors.primary,
                              }}>
                                {text}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Avatar stack + spots */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          marginBottom: '12px',
                        }}>
                          <div style={{ display: 'flex', marginRight: '8px' }}>
                            {circle.members?.slice(0, 4).map((member, idx) => (
                              <div key={member.id} style={{
                                width: isMobile ? '24px' : '28px',
                                height: isMobile ? '24px' : '28px',
                                borderRadius: '50%',
                                backgroundColor: avatarColors[idx % avatarColors.length],
                                border: '2px solid white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: isMobile ? '10px' : '11px',
                                fontWeight: '600',
                                color: 'white',
                                marginLeft: idx > 0 ? '-7px' : 0,
                              }}>
                                {member.user?.name?.charAt(0) || '?'}
                              </div>
                            ))}
                            {memberCount > 4 && (
                              <div style={{
                                width: isMobile ? '24px' : '28px',
                                height: isMobile ? '24px' : '28px',
                                borderRadius: '50%',
                                backgroundColor: colors.cream,
                                border: '2px solid white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: isMobile ? '8px' : '9px',
                                fontWeight: '600',
                                color: colors.text,
                                marginLeft: '-7px',
                              }}>
                                +{memberCount - 4}
                              </div>
                            )}
                          </div>
                          <span style={{
                            fontSize: isMobile ? '11px' : '12px',
                            color: colors.textLight,
                          }}>
                            {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                          </span>
                        </div>

                        {/* CTA Buttons */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate?.('circleDetail', { circleId: circle.id });
                            }}
                            style={{
                              flex: 1,
                              padding: isMobile ? '9px 10px' : '10px 12px',
                              backgroundColor: 'transparent',
                              color: colors.primary,
                              border: `1.5px solid ${colors.primary}`,
                              borderRadius: '10px',
                              fontSize: isMobile ? '12px' : '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            View Details
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate?.('circleDetail', { circleId: circle.id });
                            }}
                            style={{
                              flex: 1,
                              padding: isMobile ? '9px 10px' : '10px 12px',
                              backgroundColor: isInviteOnly ? 'transparent' : colors.primary,
                              color: isInviteOnly ? colors.primary : 'white',
                              border: isInviteOnly ? `1.5px solid ${colors.primary}` : 'none',
                              borderRadius: '10px',
                              fontSize: isMobile ? '12px' : '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              boxShadow: isInviteOnly ? 'none' : `0 2px 8px ${colors.primary}30`,
                            }}
                          >
                            {isInviteOnly ? 'Request' : 'Join'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Create Circle Card - poster style */}
              <div
                onClick={() => onNavigate?.('createCircle')}
                style={{
                  width: isMobile ? '200px' : '230px',
                  minWidth: isMobile ? '200px' : '230px',
                  height: isMobile ? '220px' : '250px',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  flexShrink: 0,
                  position: 'relative',
                  background: 'linear-gradient(135deg, #F5EDE4 0%, #EDE3D7 50%, #E8DDD0 100%)',
                  border: '1.5px dashed #C4A882',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px 14px',
                  textAlign: 'center',
                }}
              >
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#D8CFC6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '10px',
                }}>
                  <Plus size={20} style={{ color: '#6B4226' }} />
                </div>
                <h4 style={{
                  fontSize: isMobile ? '14px' : '15px',
                  fontWeight: '600',
                  color: '#3E2C1E',
                  margin: '0 0 6px',
                  fontFamily: fonts.serif,
                  lineHeight: '1.3',
                }}>
                  Start your own Circle
                </h4>
                <p style={{
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#7A6855',
                  margin: 0,
                  lineHeight: '1.4',
                }}>
                  6-10 women, weekly
                </p>
              </div>
            </div>
          </div>
        );
      })()}


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
              <h3 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
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

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
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

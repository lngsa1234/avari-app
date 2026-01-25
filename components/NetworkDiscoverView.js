// components/NetworkDiscoverView.js
// Network discovery page with Vibe Bar, Creation Duo, and Dynamic Results Feed
'use client';

import { useState, useEffect } from 'react';
import {
  Compass,
  Heart,
  MessageCircle,
  Rocket,
  Calendar,
  Lightbulb,
  Plus,
  Users,
  User,
  Coffee,
  Lock,
  ThumbsUp,
  Clock,
  MapPin,
  ChevronRight,
  AlertCircle,
  Sparkles
} from 'lucide-react';

// Vibe categories mapping
const VIBE_CATEGORIES = {
  advice: {
    id: 'advice',
    label: 'I need advice',
    icon: Heart,
    color: 'rose',
    description: 'Find mentors & career guidance'
  },
  vent: {
    id: 'vent',
    label: 'I want to vent',
    icon: MessageCircle,
    color: 'amber',
    description: 'Support groups & casual meetups'
  },
  grow: {
    id: 'grow',
    label: 'I want to grow',
    icon: Rocket,
    color: 'emerald',
    description: 'Skill workshops & learning'
  }
};

export default function NetworkDiscoverView({
  currentUser,
  supabase,
  connections = [],
  meetups = [],
  onNavigate,
  onHostMeetup,
  onRequestMeetup
}) {
  const [selectedVibe, setSelectedVibe] = useState(null);
  const [connectionGroups, setConnectionGroups] = useState([]);
  const [meetupRequests, setMeetupRequests] = useState([]);
  const [peerSuggestions, setPeerSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socialProofStats, setSocialProofStats] = useState({ activeThisWeek: 0, meetupsThisWeek: 0 });
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTopic, setRequestTopic] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestVibe, setRequestVibe] = useState('grow');

  // Check if user is new (no meetups attended, no connections)
  const isNewUser = connections.length === 0;

  // Calculate profile completion for nudge banner
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
      // Get all active connection groups
      const { data: groups, error } = await supabase
        .from('connection_groups')
        .select('id, name, creator_id, is_active, vibe_category, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('Connection groups query result:', { groups, error });

      if (error) {
        console.error('Error fetching connection groups:', error);
        setConnectionGroups([]);
        return;
      }

      if (!groups || groups.length === 0) {
        console.log('No connection groups found');
        setConnectionGroups([]);
        return;
      }

      // Fetch members for each group
      const groupIds = groups.map(g => g.id);
      const { data: allMembers, error: membersError } = await supabase
        .from('connection_group_members')
        .select('id, group_id, user_id, status')
        .in('group_id', groupIds)
        .eq('status', 'accepted');

      if (membersError) {
        console.error('Error fetching group members:', membersError);
      }

      // Fetch profiles for all members
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

      // Attach members with profiles to groups
      let enrichedGroups = groups.map(g => ({
        ...g,
        members: (allMembers || [])
          .filter(m => m.group_id === g.id)
          .map(m => ({
            ...m,
            user: profileMap[m.user_id] || null
          }))
      }));

      // Filter by vibe if selected
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
      // Load community wishlist/requests (simple query first)
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
        // Fetch user profiles separately
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, photo_url')
          .in('id', userIds);

        const profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});

        // Fetch supporters for current user to check "Me Too" status
        const requestIds = data.map(r => r.id);
        const { data: supporters } = await supabase
          .from('meetup_request_supporters')
          .select('request_id, user_id')
          .in('request_id', requestIds)
          .eq('user_id', currentUser.id);

        const supportedSet = new Set((supporters || []).map(s => s.request_id));

        // Attach user info and support status to requests
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
      // Get profiles who attended same meetups but aren't connected
      // Note: bio field may not exist, so we query basic fields first
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, photo_url')
        .neq('id', currentUser.id)
        .not('name', 'is', null)
        .limit(10);

      if (error) {
        console.error('Error fetching peer suggestions:', error);
        setPeerSuggestions([]);
        return;
      }

      // Filter out already connected users
      const connectedIds = connections.map(c => c.connected_user_id || c.id);
      const suggestions = (data || []).filter(u => !connectedIds.includes(u.id));

      console.log('Peer suggestions loaded:', suggestions.length);
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

      // Count users active this week
      const { count: activeCount } = await supabase
        .from('meetup_signups')
        .select('user_id', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo.toISOString());

      // Count meetups this week
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

      if (error && error.code !== '23505') { // Ignore duplicate key error
        throw error;
      }

      // Increment supporter count
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
    .slice(0, 3);

  const getVibeColor = (vibe) => {
    const colors = {
      advice: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', button: 'bg-rose-500 hover:bg-rose-600' },
      vent: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', button: 'bg-amber-500 hover:bg-amber-600' },
      grow: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', button: 'bg-emerald-500 hover:bg-emerald-600' }
    };
    return colors[vibe] || colors.grow;
  };

  if (loading && connectionGroups.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading network...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Welcoming State - Social Proof Banner for New Users */}
      {isNewUser && socialProofStats.activeThisWeek > 0 && (
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-lg">
                {socialProofStats.activeThisWeek} women in your industry are meeting this week
              </p>
              <p className="text-rose-100 text-sm mt-1">
                Join them and start building your network!
              </p>
            </div>
            <Users className="w-12 h-12 text-rose-200" />
          </div>
        </div>
      )}

      {/* Profile Completion Nudge */}
      {profileCompletion.percentage < 100 && profileCompletion.percentage > 0 && (
        <button
          onClick={() => onNavigate?.('profile')}
          className="w-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-amber-600" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full px-1.5 py-0.5 text-xs font-bold text-amber-600 border border-amber-200">
                {profileCompletion.percentage}%
              </div>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">
                Complete your profile
              </p>
              <p className="text-sm text-amber-700">
                Add {profileCompletion.missing.slice(0, 2).join(' & ')} to get 2x more connections
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-500" />
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
              style={{ width: `${profileCompletion.percentage}%` }}
            />
          </div>
        </button>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
        <div className="flex items-center mb-2">
          <Compass className="w-6 h-6 mr-2 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-800">Discover</h2>
        </div>
        <p className="text-gray-600">Find your community, your way</p>
      </div>

      {/* 1. The Vibe Bar */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          What's your vibe today?
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {Object.values(VIBE_CATEGORIES).map((vibe) => {
            const Icon = vibe.icon;
            const isSelected = selectedVibe === vibe.id;
            const colors = getVibeColor(vibe.id);

            return (
              <button
                key={vibe.id}
                onClick={() => setSelectedVibe(isSelected ? null : vibe.id)}
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  isSelected
                    ? `${colors.bg} ${colors.border} ${colors.text} shadow-md scale-[1.02]`
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? colors.text : 'text-gray-400'}`} />
                <p className="text-xs font-medium leading-tight">{vibe.label}</p>
              </button>
            );
          })}
        </div>
        {selectedVibe && (
          <p className="text-sm text-gray-500 text-center">
            {VIBE_CATEGORIES[selectedVibe].description}
          </p>
        )}
      </div>

      {/* 2. The Creation Duo (Action Hub) - Always Visible */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onHostMeetup ? onHostMeetup() : onNavigate?.('meetupProposals')}
          className="bg-white border-2 border-dashed border-indigo-300 rounded-xl p-5 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3 group-hover:bg-indigo-200 transition-colors">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
            <p className="font-semibold text-gray-800">Host a Meetup</p>
            <p className="text-xs text-gray-500 mt-1">Lead a session</p>
          </div>
        </button>

        <button
          onClick={() => setShowRequestModal(true)}
          className="bg-white border-2 border-dashed border-amber-300 rounded-xl p-5 hover:border-amber-500 hover:bg-amber-50 transition-all group"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-200 transition-colors">
              <Lightbulb className="w-6 h-6 text-amber-600" />
            </div>
            <p className="font-semibold text-gray-800">Request a Meetup</p>
            <p className="text-xs text-gray-500 mt-1">Suggest a topic</p>
          </div>
        </button>
      </div>

      {/* 3. Dynamic Results Feed */}

      {/* A. Large Meetup Cards (Featured Events) - Horizontal Scroll */}
      {featuredMeetups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Featured Meetups</h3>
            <button
              onClick={() => onNavigate?.('home')}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
            >
              See all <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex overflow-x-auto gap-3 pb-2 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory">
            {featuredMeetups.map((meetup) => {
              const vibeColors = getVibeColor(meetup.vibe_category || 'grow');
              const signupCount = meetup.signups?.length || 0;

              return (
                <div
                  key={meetup.id}
                  className="flex-shrink-0 w-[calc(100vw-3rem)] sm:w-[calc(50vw-2rem)] lg:w-[calc(33vw-2rem)] max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow snap-start"
                >
                  <div className={`h-2 ${vibeColors.button.split(' ')[0]}`} />
                  <div className="p-4">
                    <h4 className="font-semibold text-gray-800 text-base line-clamp-2 mb-2">{meetup.topic}</h4>
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <Calendar className="w-4 h-4 mr-1 flex-shrink-0" />
                      {new Date(meetup.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="flex items-center text-sm text-gray-600 mb-3">
                      <Clock className="w-4 h-4 mr-1 flex-shrink-0" />
                      {meetup.time}
                    </div>

                    {/* Who's Going Avatars */}
                    <div className="flex items-center mb-3">
                      <div className="flex -space-x-2">
                        {(meetup.signups || []).slice(0, 3).map((signup, idx) => (
                          <div
                            key={idx}
                            className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-pink-400 border-2 border-white flex items-center justify-center text-white text-xs font-medium"
                          >
                            {signup.user?.name?.[0] || '?'}
                          </div>
                        ))}
                        {signupCount > 3 && (
                          <div className="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-medium">
                            +{signupCount - 3}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 ml-2">
                        {signupCount > 0 ? `${signupCount} going` : 'Be first!'}
                      </span>
                    </div>

                    <button
                      onClick={() => onNavigate?.('home')}
                      className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                    >
                      Join Meetup
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* B. Connection Group Cards (The Ring) - Horizontal Scroll */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Connection Groups</h3>
          <button
            onClick={() => onNavigate?.('connectionGroups')}
            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
          >
            See all <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex overflow-x-auto gap-3 pb-2 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory">
          {connectionGroups.length === 0 ? (
            <div className="flex-shrink-0 w-[calc(100vw-3rem)] sm:w-[calc(50vw-2rem)] lg:w-[calc(33vw-2rem)] max-w-xs bg-purple-50 border border-purple-200 rounded-xl p-5 text-center snap-start">
              <div className="flex justify-center mb-3">
                <div className="flex -space-x-1">
                  {[1, 2, 3, 4].map((_, idx) => (
                    <div
                      key={idx}
                      className="w-8 h-8 rounded-full border-2 border-dashed border-purple-300 flex items-center justify-center text-purple-300"
                    >
                      <Plus className="w-3 h-3" />
                    </div>
                  ))}
                </div>
              </div>
              <h4 className="font-medium text-purple-800 text-sm mb-1">No groups yet</h4>
              <p className="text-xs text-purple-600 mb-3">
                Create a small group for video chats
              </p>
              <button
                onClick={() => onNavigate?.('connectionGroups')}
                className="bg-purple-500 hover:bg-purple-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors text-xs"
              >
                Create Group
              </button>
            </div>
          ) : (
            connectionGroups.map((group) => {
              const members = group.members?.filter(m => m.status === 'accepted') || [];
              const maxSlots = 4;
              const filledSlots = members.length;
              const emptySlots = maxSlots - filledSlots;

              return (
                <div
                  key={group.id}
                  className="flex-shrink-0 w-[calc(100vw-3rem)] sm:w-[calc(50vw-2rem)] lg:w-[calc(33vw-2rem)] max-w-xs bg-white rounded-xl shadow-sm border border-gray-200 p-4 snap-start"
                >
                  <h4 className="font-semibold text-gray-800 text-sm mb-3 line-clamp-1">{group.name}</h4>

                  {/* The Ring Visualization */}
                  <div className="flex items-center justify-center mb-3">
                    <div className="flex -space-x-1">
                      {members.slice(0, maxSlots).map((member, idx) => (
                        <div
                          key={idx}
                          className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-white flex items-center justify-center text-white text-xs font-medium shadow-sm"
                          title={member.user?.name}
                        >
                          {member.user?.name?.[0] || '?'}
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, emptySlots) }).map((_, idx) => (
                        <div
                          key={`empty-${idx}`}
                          className="w-9 h-9 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400"
                        >
                          <Plus className="w-3 h-3" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 text-center mb-3">
                    {filledSlots}/{maxSlots} members
                  </p>

                  <button
                    onClick={() => onNavigate?.('connectionGroups')}
                    className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-1.5 rounded-lg transition-colors text-sm"
                  >
                    Claim a Slot
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* C. Community Wishlist (Requests) - Horizontal Scroll */}
      {meetupRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">Community Wishlist</h3>

          <div className="flex overflow-x-auto gap-3 pb-2 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory">
            {meetupRequests.map((request) => {
              const supporterCount = request.supporter_count || request.supporters?.length || 0;
              const hasSupported = request.supporters?.some(s => s.user_id === currentUser.id);

              return (
                <div
                  key={request.id}
                  className="flex-shrink-0 w-[calc(100vw-3rem)] sm:w-[calc(50vw-2rem)] lg:w-[calc(33vw-2rem)] max-w-sm bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200 p-4 sm:p-5 snap-start"
                >
                  <p className="font-medium text-gray-800 text-sm sm:text-base line-clamp-2 mb-1">{request.topic}</p>
                  {request.description && (
                    <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 mb-2">{request.description}</p>
                  )}
                  <p className="text-xs sm:text-sm text-gray-500 mb-3">
                    {supporterCount} {supporterCount === 1 ? 'person wants' : 'people want'} this
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleHostRequest(request)}
                      className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs sm:text-sm font-medium py-2 sm:py-2.5 rounded-lg transition-colors"
                    >
                      Host This
                    </button>
                    <button
                      onClick={() => !hasSupported && handleSupportRequest(request.id)}
                      disabled={hasSupported}
                      className={`flex-1 text-xs sm:text-sm font-medium py-2 sm:py-2.5 rounded-lg transition-colors flex items-center justify-center ${
                        hasSupported
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <ThumbsUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      {hasSupported ? 'Supported' : 'Me Too'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* D. Peer Discovery (1:1) - Horizontal Scroll */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">People to Meet</h3>
          <button
            onClick={() => onNavigate?.('connections')}
            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
          >
            See all <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex overflow-x-auto gap-3 pb-2 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory">
          {peerSuggestions.length === 0 ? (
            <div className="flex-shrink-0 w-[calc(100vw-3rem)] sm:w-[calc(50vw-2rem)] lg:w-[calc(33vw-2rem)] max-w-xs bg-rose-50 border border-rose-200 rounded-xl p-4 sm:p-5 text-center snap-start">
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-100 flex items-center justify-center">
                  <User className="w-7 h-7 sm:w-8 sm:h-8 text-rose-400" />
                </div>
              </div>
              <h4 className="font-medium text-rose-800 text-sm sm:text-base mb-1">Meet people</h4>
              <p className="text-xs sm:text-sm text-rose-600 mb-3">
                Join meetups to grow your network
              </p>
              <button
                onClick={() => onNavigate?.('home')}
                className="bg-rose-500 hover:bg-rose-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm"
              >
                Find Meetups
              </button>
            </div>
          ) : (
            peerSuggestions.map((peer) => (
              <div
                key={peer.id}
                className="flex-shrink-0 w-[calc(100vw-3rem)] sm:w-[calc(50vw-2rem)] lg:w-[calc(33vw-2rem)] max-w-xs bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-md transition-shadow snap-start"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-rose-400 to-pink-400 flex items-center justify-center text-white text-xl sm:text-2xl font-semibold mb-3">
                    {peer.name?.[0] || '?'}
                  </div>
                  <h4 className="font-medium text-gray-800 text-sm sm:text-base line-clamp-1">{peer.name}</h4>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-1">{peer.career || 'Professional'}</p>
                  {peer.city && (
                    <p className="text-xs text-gray-400 mt-1">{peer.city}{peer.state ? `, ${peer.state}` : ''}</p>
                  )}

                  <div className="flex items-center text-xs sm:text-sm text-gray-400 mt-3">
                    <Lock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Connect to chat
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Vibe-filtered Empty State */}
      {selectedVibe && featuredMeetups.length === 0 && meetupRequests.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-gray-600 mb-3">
            No "{VIBE_CATEGORIES[selectedVibe].label.toLowerCase()}" events yet
          </p>
          <button
            onClick={() => onHostMeetup ? onHostMeetup() : onNavigate?.('meetupProposals')}
            className="bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
          >
            Host One
          </button>
        </div>
      )}

      {/* Request Meetup Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Request a Meetup</h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Suggest a topic you'd like to see. Others can support your idea, and someone might host it!
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic *
                </label>
                <input
                  type="text"
                  value={requestTopic}
                  onChange={(e) => setRequestTopic(e.target.value)}
                  placeholder="e.g., Grief in the Workplace Support Group"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What vibe is this?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(VIBE_CATEGORIES).map((vibe) => {
                    const Icon = vibe.icon;
                    const isSelected = requestVibe === vibe.id;
                    const colors = getVibeColor(vibe.id);

                    return (
                      <button
                        key={vibe.id}
                        type="button"
                        onClick={() => setRequestVibe(vibe.id)}
                        className={`p-2 rounded-lg border transition-all text-center ${
                          isSelected
                            ? `${colors.bg} ${colors.border} ${colors.text}`
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mx-auto mb-1 ${isSelected ? colors.text : 'text-gray-400'}`} />
                        <p className="text-xs">{vibe.id}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="Tell us more about what you're looking for..."
                  className="w-full border border-gray-300 rounded-lg p-3 h-20 resize-none focus:outline-none focus:border-indigo-500"
                  maxLength={500}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={!requestTopic.trim()}
                className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-2.5 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

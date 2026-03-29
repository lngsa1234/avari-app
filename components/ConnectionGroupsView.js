// components/ConnectionGroupsView.js
// Circles page - Connected users, recent communications, and active groups
// UX design based on mycircles.jsx

'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  checkGroupEligibility,
  getEligibleConnections,
  createConnectionGroup,
  getMyConnectionGroups,
  getPendingGroupInvites,
  acceptGroupInvite,
  declineGroupInvite,
  createConnectionGroupRoom,
  deleteConnectionGroup,
  sendGroupMessage,
  getGroupMessages,
  deleteGroupMessage
} from '@/lib/connectionGroupHelpers';
import { isUserActive, countActiveUsers } from '@/lib/activityHelpers';
import { parseLocalDate, toLocalDateString } from '../lib/dateUtils';
import { MapPin, Users, UserPlus, Check, ChevronRight, MessageCircle, Coffee, FileText, Clock, Calendar, PartyPopper } from 'lucide-react';

export default function ConnectionGroupsView({ currentUser, supabase, connections: connectionsProp = [], onNavigate }) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth < 640;
    return false;
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [connectionGroups, setConnectionGroups] = useState([]);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const [groupInvites, setGroupInvites] = useState([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState([]);
  const [sentCircleInvites, setSentCircleInvites] = useState([]);
  const [eligibleConnections, setEligibleConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedConnections, setSelectedConnections] = useState([]);

  // Use connections from props, add online status
  const [connections, setConnections] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Connect with People
  const [peerSuggestions, setPeerSuggestions] = useState([]);
  const [sentRequests, setSentRequests] = useState(new Set());
  const [sentRequestProfiles, setSentRequestProfiles] = useState([]);

  // Unread DM counts per sender
  const [unreadCounts, setUnreadCounts] = useState({});
  // Recent chats
  const [recentChats, setRecentChats] = useState([]);

  // Load connections directly from DB (single source of truth)
  const loadConnectionsDirect = async (sharedMatches) => {
    const t0 = Date.now();
    try {
      const matches = sharedMatches || [];
      if (matches.length === 0) return;

      const matchedUserIds = matches.map(m => m.matched_user_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, profile_picture, last_active')
        .in('id', matchedUserIds);
      if (profileError || !profiles) return;

      const connectionsWithStatus = profiles.map(user => ({
        id: user.id,
        userId: user.id,
        name: user.name || 'Unknown',
        avatar: user.profile_picture,
        career: user.career || '',
        city: user.city,
        state: user.state,
        last_active: user.last_active,
        status: isUserActive(user.last_active, 10) ? 'online' : 'away',
      }));
      console.log(`⏱️ Circles: loadConnectionsDirect in ${Date.now() - t0}ms`);
      setConnections(connectionsWithStatus);
    } catch (err) {
      console.error('Error loading connections directly:', err);
    }
  };

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();

    const invitesChannel = supabase
      .channel('connection-group-invites')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connection_group_members',
          filter: `user_id=eq.${currentUser.id}`
        },
        () => {
          loadGroupInvites();
          loadConnectionGroups();
        }
      )
      .subscribe();

    const dmChannel = supabase
      .channel('circles-unread-dm')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`
        },
        (payload) => {
          const senderId = payload.new.sender_id;
          setUnreadCounts(prev => ({
            ...prev,
            [senderId]: (prev[senderId] || 0) + 1
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`
        },
        () => {
          loadUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(invitesChannel);
      supabase.removeChannel(dmChannel);
    };
  }, [currentUser.id]);

  useEffect(() => {
    if (!selectedGroup) return;

    const messagesChannel = supabase
      .channel(`group-messages-${selectedGroup.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connection_group_messages',
          filter: `group_id=eq.${selectedGroup.id}`
        },
        () => {
          loadGroupChatMessages(selectedGroup.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedGroup]);

  const loadUnreadCounts = async () => {
    const t0 = Date.now();
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', currentUser.id)
        .eq('read', false);

      if (error) return;

      const counts = {};
      (data || []).forEach(msg => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
      });
      console.log(`⏱️ Circles: loadUnreadCounts in ${Date.now() - t0}ms`);
      setUnreadCounts(counts);
    } catch (err) {
      // silently fail
    }
  };

  const loadRecentChats = async () => {
    console.log('⏱️ Circles: loadRecentChats starting, userId:', currentUser?.id);
    try {
      // Get latest message per conversation (sent or received)
      const { data: sent } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id, receiver_id, read')
        .eq('sender_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: received } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id, receiver_id, read')
        .eq('receiver_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Deduplicate by conversation partner, keep latest
      const allMessages = [...(sent || []), ...(received || [])];
      const latestByUser = {};
      allMessages.forEach(msg => {
        const partnerId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        if (!latestByUser[partnerId] || new Date(msg.created_at) > new Date(latestByUser[partnerId].created_at)) {
          latestByUser[partnerId] = { ...msg, partnerId };
        }
      });

      const chats = Object.values(latestByUser)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);

      if (chats.length === 0) { setRecentChats([]); return; }

      // Fetch profiles for chat partners
      const partnerIds = chats.map(c => c.partnerId);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, profile_picture, career')
        .in('id', partnerIds);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      const result = chats.map(c => ({
        ...c,
        partner: profileMap[c.partnerId] || { id: c.partnerId, name: 'Unknown' },
        isFromMe: c.sender_id === currentUser.id,
        unread: !c.read && c.receiver_id === currentUser.id,
      }));
      console.log('⏱️ Circles: loadRecentChats result:', result.length, 'chats');
      setRecentChats(result);
    } catch (err) {
      console.error('Error loading recent chats:', err);
    }
  };

  const loadData = async () => {
    const t0 = Date.now();
    setLoading(true);

    // Single RPC for all circles page data + mutual matches in parallel
    const [rpcResult, mutualResult] = await Promise.all([
      supabase.rpc('get_circles_page_data', { p_user_id: currentUser.id }),
      supabase.rpc('get_mutual_matches', { for_user_id: currentUser.id }),
    ]);

    const sharedMatches = mutualResult.data || [];

    if (rpcResult.error) {
      console.error('Circles RPC error:', rpcResult.error);
      setLoading(false);
      return;
    }

    const d = rpcResult.data;

    // Process connection groups from RPC data
    const groups = d.groups || [];
    const members = d.members || [];
    const creators = d.creators || [];
    const latestMessages = d.latest_messages || [];
    const upcomingMeetups = d.upcoming_meetups || [];
    const pastMeetups = d.past_meetups || [];

    const creatorMap = {};
    creators.forEach(c => { creatorMap[c.id] = c; });

    const membersByGroup = {};
    members.forEach(m => {
      if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
      membersByGroup[m.group_id].push({
        id: m.id, status: m.status, user_id: m.user_id, group_id: m.group_id,
        user: { id: m.user_id, name: m.name, career: m.career, last_active: m.last_active, profile_picture: m.profile_picture }
      });
    });

    const latestMessageByGroup = {};
    latestMessages.forEach(msg => {
      latestMessageByGroup[msg.group_id] = {
        ...msg,
        sender: { id: msg.user_id, name: msg.sender_name }
      };
    });

    const nextMeetupByCircle = {};
    upcomingMeetups.forEach(meetup => {
      const existing = nextMeetupByCircle[meetup.circle_id];
      if (!existing) {
        nextMeetupByCircle[meetup.circle_id] = meetup;
      } else {
        const existingDate = new Date(existing.date).getTime();
        const thisDate = new Date(meetup.date).getTime();
        const daysDiff = Math.abs(thisDate - existingDate) / (24 * 60 * 60 * 1000);
        if (daysDiff <= 3 && new Date(meetup.updated_at) > new Date(existing.updated_at)) {
          nextMeetupByCircle[meetup.circle_id] = meetup;
        }
      }
    });

    const pastMeetupCountByCircle = {};
    const lastTopicByCircle = {};
    pastMeetups.forEach(meetup => {
      pastMeetupCountByCircle[meetup.circle_id] = (pastMeetupCountByCircle[meetup.circle_id] || 0) + 1;
      if (!lastTopicByCircle[meetup.circle_id] && meetup.topic) {
        lastTopicByCircle[meetup.circle_id] = meetup.topic;
      }
    });

    // Fetch latest recap for each circle
    const groupIds = groups.map(g => g.id);
    const channelNames = groupIds.map(id => `connection-group-${id}`);
    const latestRecapByCircle = {};
    if (channelNames.length > 0) {
      const { data: recaps } = await supabase
        .from('call_recaps')
        .select('id, channel_name, created_at, ai_summary')
        .in('channel_name', channelNames)
        .order('created_at', { ascending: false });
      (recaps || []).forEach(r => {
        const circleId = r.channel_name.replace('connection-group-', '');
        if (!latestRecapByCircle[circleId]) {
          latestRecapByCircle[circleId] = r;
        }
      });
    }

    for (const group of groups) {
      group.creator = creatorMap[group.creator_id] || null;
      group.members = membersByGroup[group.id] || [];
      group.lastMessage = latestMessageByGroup[group.id] || null;
      group.nextMeetup = nextMeetupByCircle[group.id] || null;
      group.pastSessionCount = pastMeetupCountByCircle[group.id] || 0;
      group.lastTopic = lastTopicByCircle[group.id] || null;
      group.lastRecap = latestRecapByCircle[group.id] || null;
    }
    groups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setConnectionGroups(groups);

    // Process invitations from RPC data
    const invitations = d.invitations || [];
    setGroupInvites(invitations.map(inv => ({
      id: inv.id,
      group_id: inv.group_id,
      user_id: inv.user_id,
      status: inv.status,
      invited_at: inv.invited_at,
      group: {
        id: inv.group_id,
        name: inv.group_name,
        creator_id: inv.group_creator_id,
        created_at: inv.group_created_at,
        is_active: inv.group_is_active,
        creator: { id: inv.group_creator_id, name: inv.creator_name }
      }
    })));

    // Fetch user's own pending join requests
    const { data: pendingReqs } = await supabase
      .from('connection_group_members')
      .select('id, group_id, status, invited_at, connection_groups(id, name)')
      .eq('user_id', currentUser.id)
      .eq('status', 'pending');
    setPendingJoinRequests((pendingReqs || []).map(r => ({
      id: r.id,
      group_id: r.group_id,
      invited_at: r.invited_at,
      groupName: r.connection_groups?.name || 'Unknown circle',
    })));

    // Process unread counts from RPC data
    const unreadData = d.unread_counts || [];
    const counts = {};
    unreadData.forEach(u => { counts[u.sender_id] = u.count; });
    setUnreadCounts(counts);

    // Process connections from shared matches
    if (sharedMatches.length > 0) {
      const matchedUserIds = sharedMatches.map(m => m.matched_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, profile_picture, last_active')
        .in('id', matchedUserIds);

      if (profiles) {
        setConnections(profiles.map(user => ({
          id: user.id,
          userId: user.id,
          name: user.name || 'Unknown',
          avatar: user.profile_picture,
          career: user.career || '',
          city: user.city,
          state: user.state,
          last_active: user.last_active,
          status: isUserActive(user.last_active, 10) ? 'online' : 'away',
        })));
      }
    }

    console.log(`⏱️ Circles page rendered in ${Date.now() - t0}ms`);
    setLoading(false);

    // Deferred — peer suggestions and sent requests load in background
    loadPeerSuggestions(sharedMatches);
    loadSentRequests(sharedMatches);
    loadRecentChats();
    loadSentCircleInvites();
  };

  const loadPeerSuggestions = async (sharedMatches) => {
    const t0 = Date.now();
    try {
      const [profilesResult, interestsResult, incomingInterestsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, career, city, state, hook, industry, career_stage, interests, profile_picture, open_to_coffee_chat, last_active')
          .neq('id', currentUser.id)
          .not('name', 'is', null)
          .limit(50),
        supabase
          .from('user_interests')
          .select('interested_in_user_id')
          .eq('user_id', currentUser.id),
        supabase
          .from('user_interests')
          .select('user_id')
          .eq('interested_in_user_id', currentUser.id),
      ]);

      if (profilesResult.error) {
        setPeerSuggestions([]);
        return;
      }

      const myMatchIds = new Set((sharedMatches || []).map(m => m.matched_user_id));
      const myInterestIds = new Set((interestsResult.data || []).map(i => i.interested_in_user_id));
      const interestedInMeIds = new Set((incomingInterestsResult.data || []).map(i => i.user_id));

      const suggestions = (profilesResult.data || []).filter(u =>
        !myMatchIds.has(u.id) && !myInterestIds.has(u.id)
      );

      // Prioritize: interested in me > open to coffee chat > others
      suggestions.sort((a, b) => {
        const scoreA = (interestedInMeIds.has(a.id) ? 4 : 0) + (a.open_to_coffee_chat ? 2 : 0);
        const scoreB = (interestedInMeIds.has(b.id) ? 4 : 0) + (b.open_to_coffee_chat ? 2 : 0);
        return scoreB - scoreA;
      });

      const finalSuggestions = suggestions.slice(0, 20);
      const finalIds = finalSuggestions.map(s => s.id);

      if (finalIds.length === 0) {
        setPeerSuggestions([]);
        return;
      }

      // Fetch shared circles and mutual connections with simple queries (no extra RPCs)
      const [myCirclesResult, suggestedInterestsResult] = await Promise.all([
        supabase
          .from('connection_group_members')
          .select('group_id')
          .eq('user_id', currentUser.id)
          .eq('status', 'accepted'),
        // Count mutual connections: find interests involving both the suggestion and my matches
        supabase
          .from('user_interests')
          .select('user_id, interested_in_user_id')
          .in('user_id', finalIds)
          .in('interested_in_user_id', Array.from(myMatchIds)),
      ]);

      // Build mutual connections: a suggested person has a mutual connection if
      // they expressed interest in one of my matches AND that match expressed interest back
      const userMutualConnections = {};
      // For simplicity, count how many of my connections each suggestion is connected to
      // by checking bidirectional interests
      const suggestedInterests = suggestedInterestsResult.data || [];
      const interestsByUser = {};
      suggestedInterests.forEach(i => {
        if (!interestsByUser[i.user_id]) interestsByUser[i.user_id] = new Set();
        interestsByUser[i.user_id].add(i.interested_in_user_id);
      });
      finalIds.forEach(id => {
        userMutualConnections[id] = interestsByUser[id] ? interestsByUser[id].size : 0;
      });

      // Build shared circles map
      let userCircleCount = {};
      const myCircleIds = (myCirclesResult.data || []).map(c => c.group_id);
      if (myCircleIds.length > 0) {
        const { data: sharedMembers } = await supabase
          .from('connection_group_members')
          .select('user_id, group_id')
          .in('group_id', myCircleIds)
          .in('user_id', finalIds)
          .eq('status', 'accepted');

        (sharedMembers || []).forEach(m => {
          if (!userCircleCount[m.user_id]) userCircleCount[m.user_id] = new Set();
          userCircleCount[m.user_id].add(m.group_id);
        });
      }

      const enriched = finalSuggestions.map(person => ({
        ...person,
        mutualCircles: userCircleCount[person.id] ? userCircleCount[person.id].size : 0,
        mutualConnections: userMutualConnections[person.id] || 0,
      }));

      console.log(`⏱️ Circles: loadPeerSuggestions in ${Date.now() - t0}ms`);
      setPeerSuggestions(enriched);
    } catch (error) {
      console.error('Error loading peer suggestions:', error);
      setPeerSuggestions([]);
    }
  };

  const loadSentRequests = async (sharedMatches) => {
    const t0 = Date.now();
    try {
      const { data: interestsData, error: interestsError } = await supabase
        .from('user_interests')
        .select('interested_in_user_id, created_at')
        .eq('user_id', currentUser.id);

      if (interestsError) {
        setSentRequestProfiles([]);
        return;
      }

      const mutualIds = new Set((sharedMatches || []).map(m => m.matched_user_id));

      // Pending = I sent interest but they haven't matched back
      const pendingInterests = (interestsData || []).filter(i =>
        !mutualIds.has(i.interested_in_user_id)
      );

      if (pendingInterests.length === 0) {
        setSentRequestProfiles([]);
        return;
      }

      const pendingIds = pendingInterests.map(i => i.interested_in_user_id);
      const createdAtMap = {};
      pendingInterests.forEach(i => { createdAtMap[i.interested_in_user_id] = i.created_at; });

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, profile_picture')
        .in('id', pendingIds);

      if (profilesError) {
        setSentRequestProfiles([]);
        return;
      }

      const enriched = (profiles || []).map(p => ({
        ...p,
        requested_at: createdAtMap[p.id],
      }));

      // Sort by most recent first
      enriched.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

      console.log(`⏱️ Circles: loadSentRequests in ${Date.now() - t0}ms`);
      setSentRequestProfiles(enriched);
    } catch (error) {
      console.error('Error loading sent requests:', error);
      setSentRequestProfiles([]);
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
      if (error && !error.message?.includes('duplicate')) throw error;

      // Check if this creates a mutual match
      const { data: isMutual } = await supabase
        .rpc('check_mutual_interest', { user_a: currentUser.id, user_b: personId });

      if (isMutual) {
        // Mutual match: add to connections and remove from suggestions
        const person = peerSuggestions.find(p => p.id === personId);
        if (person) {
          setConnections(prev => [...prev, {
            id: person.id,
            userId: person.id,
            name: person.name,
            avatar: person.profile_picture,
            career: person.career || '',
            city: person.city,
            state: person.state,
            status: 'away',
          }]);
          setPeerSuggestions(prev => prev.filter(p => p.id !== personId));
        }
      } else {
        // Add to pending requests list
        const person = peerSuggestions.find(p => p.id === personId);
        if (person) {
          setSentRequestProfiles(prev => [{
            id: person.id,
            name: person.name,
            career: person.career,
            city: person.city,
            state: person.state,
            profile_picture: person.profile_picture,
            requested_at: new Date().toISOString(),
          }, ...prev]);
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

  const handleWithdrawRequest = async (personId) => {
    try {
      const { error } = await supabase
        .from('user_interests')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('interested_in_user_id', personId);
      if (error) throw error;
      setSentRequestProfiles(prev => prev.filter(p => p.id !== personId));
      // Also remove from sentRequests set so the "Connect" button reappears in suggestions
      setSentRequests(prev => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
    } catch (error) {
      console.error('Error withdrawing request:', error);
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const loadSentCircleInvites = async () => {
    try {
      // Get circles I created
      const { data: myCircles } = await supabase
        .from('connection_groups')
        .select('id, name')
        .eq('creator_id', currentUser.id);

      if (!myCircles || myCircles.length === 0) { setSentCircleInvites([]); return; }

      const circleIds = myCircles.map(c => c.id);
      const circleNameMap = {};
      myCircles.forEach(c => { circleNameMap[c.id] = c.name; });

      // Get pending invited members
      const { data: pendingMembers } = await supabase
        .from('connection_group_members')
        .select('id, user_id, group_id, invited_at')
        .eq('status', 'invited')
        .in('group_id', circleIds);

      if (!pendingMembers || pendingMembers.length === 0) { setSentCircleInvites([]); return; }

      const userIds = [...new Set(pendingMembers.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, career, profile_picture')
        .in('id', userIds);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      setSentCircleInvites(pendingMembers.map(m => ({
        id: m.id,
        user: profileMap[m.user_id] || { id: m.user_id, name: 'Unknown' },
        circleName: circleNameMap[m.group_id],
        groupId: m.group_id,
        invited_at: m.invited_at,
      })).filter(i => i.user.name !== 'Unknown'));
    } catch (err) {
      console.error('Error loading sent circle invites:', err);
    }
  };

  const handleWithdrawCircleInvite = async (membershipId) => {
    try {
      const { error } = await supabase
        .from('connection_group_members')
        .delete()
        .eq('id', membershipId);
      if (error) throw error;
      setSentCircleInvites(prev => prev.filter(i => i.id !== membershipId));
    } catch (err) {
      console.error('Error withdrawing circle invite:', err);
    }
  };

  const loadConnectionGroups = async () => {
    const t0 = Date.now();
    try {
      const groups = await getMyConnectionGroups(currentUser.id);
      console.log(`⏱️ Circles: loadConnectionGroups in ${Date.now() - t0}ms`);
      setConnectionGroups(groups);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadGroupInvites = async () => {
    const t0 = Date.now();
    try {
      const invites = await getPendingGroupInvites(currentUser.id);
      console.log(`⏱️ Circles: loadGroupInvites in ${Date.now() - t0}ms`);
      setGroupInvites(invites);
    } catch (error) {
      console.error('Error loading invites:', error);
    }
  };

  const loadEligibleConnections = async () => {
    try {
      const connections = await getEligibleConnections();
      setEligibleConnections(connections);

      if (connections.length < 2) {
        alert('You need at least 2 mutual connections to create a group.');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error loading connections:', error);
      return false;
    }
  };

  const handleCreateClick = async () => {
    const hasConnections = await loadEligibleConnections();
    if (hasConnections) {
      setShowCreateModal(true);
    }
  };

  const handleToggleConnection = (connectionId) => {
    if (selectedConnections.includes(connectionId)) {
      setSelectedConnections(selectedConnections.filter(id => id !== connectionId));
    } else {
      if (selectedConnections.length >= 9) {
        alert('Maximum group size is 10 people (you + 9 others)');
        return;
      }
      setSelectedConnections([...selectedConnections, connectionId]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('Please enter a circle name');
      return;
    }

    if (selectedConnections.length < 2 || selectedConnections.length > 9) {
      alert('Please select 2-9 people to invite');
      return;
    }

    try {
      await createConnectionGroup({
        name: groupName.trim(),
        description: groupDescription.trim(),
        invitedUserIds: selectedConnections
      });

      const createdName = groupName;
      const inviteCount = selectedConnections.length;
      setShowCreateModal(false);
      setGroupName('');
      setGroupDescription('');
      setSelectedConnections([]);
      setCreateSuccess({ name: createdName, inviteCount });
      await loadConnectionGroups();
    } catch (error) {
      alert('Error creating circle: ' + error.message);
    }
  };

  const handleAcceptInvite = async (membershipId, groupName) => {
    try {
      await acceptGroupInvite(membershipId);
      alert(`You joined "${groupName}"!`);
      await Promise.all([loadConnectionGroups(), loadGroupInvites()]);
    } catch (error) {
      alert('Error accepting invite: ' + error.message);
    }
  };

  const handleDeclineInvite = async (membershipId) => {
    if (!confirm('Decline this group invitation?')) return;

    try {
      await declineGroupInvite(membershipId);
      await loadGroupInvites();
    } catch (error) {
      alert('Error declining invite: ' + error.message);
    }
  };

  const handleJoinCall = async (groupId) => {
    try {
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        alert('Video calls not configured.');
        return;
      }

      // Find the next upcoming meetup for this group to use as session ID
      const { data: nextMeetup } = await supabase
        .from('meetups')
        .select('id')
        .eq('circle_id', groupId)
        .gte('date', toLocalDateString())
        .order('date', { ascending: true })
        .limit(1)
        .single();

      const { channelName } = await createConnectionGroupRoom(groupId, nextMeetup?.id);
      window.location.href = `/call/circle/${channelName}`;
    } catch (error) {
      alert('Could not join video call: ' + error.message);
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!confirm(`Delete "${groupName}"? This cannot be undone.`)) return;

    try {
      await deleteConnectionGroup(groupId);
      await loadConnectionGroups();
    } catch (error) {
      alert('Error deleting group: ' + error.message);
    }
  };

  const handleOpenGroupChat = async (group) => {
    setSelectedGroup(group);
    setShowChatModal(true);
    await loadGroupChatMessages(group.id);
  };

  const loadGroupChatMessages = async (groupId) => {
    try {
      const messages = await getGroupMessages(supabase, groupId);
      setGroupMessages(messages);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedGroup) return;

    try {
      await sendGroupMessage(supabase, selectedGroup.id, newMessage);
      setNewMessage('');
      await loadGroupChatMessages(selectedGroup.id);
    } catch (error) {
      alert('Error sending message: ' + error.message);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Delete this message?')) return;

    try {
      await deleteGroupMessage(supabase, messageId);
      await loadGroupChatMessages(selectedGroup.id);
    } catch (error) {
      alert('Error deleting message: ' + error.message);
    }
  };

  const onlineCount = useMemo(() => connections.filter(c => c.status === 'online').length, [connections]);

  // Pre-compute group card data so filtering/date-parsing doesn't re-run on every render
  const themes = [
    { emoji: '💼', color: '#8B6F5C' },
    { emoji: '🚀', color: '#A67B5B' },
    { emoji: '💪', color: '#6B4423' },
    { emoji: '🔄', color: '#D4A574' },
    { emoji: '🏙️', color: '#C4956A' },
  ];

  const enrichedGroups = useMemo(() => {
    return connectionGroups.map((group, index) => {
      const acceptedMembers = group.members?.filter(m => m.status === 'accepted') || [];
      const activeMembers = acceptedMembers.filter(m =>
        isUserActive(m.user?.last_active, 10)
      );
      const activeNames = activeMembers
        .map(m => m.user?.name?.split(' ')[0])
        .filter(Boolean);
      const theme = themes[index % themes.length];
      const hasUpcoming = !!group.nextMeetup;
      const sessionCount = group.pastSessionCount || 0;

      let daysUntilMeetup = null;
      if (hasUpcoming) {
        const meetupDate = parseLocalDate(group.nextMeetup.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        meetupDate.setHours(0, 0, 0, 0);
        daysUntilMeetup = Math.round((meetupDate - today) / (1000 * 60 * 60 * 24));
      }

      const hasNoActivity = !hasUpcoming && !group.lastMessage;

      return { group, acceptedMembers, activeMembers, activeNames, theme, hasUpcoming, sessionCount, daysUntilMeetup, hasNoActivity };
    });
  }, [connectionGroups]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>Loading your circles...</p>
        <style>{keyframeStyles}</style>
      </div>
    );
  }

  return (
    <div style={{...styles.container, padding: isMobile ? '16px 0' : '24px 0'}} className="circles-container">

      {/* Page Header */}
      <div style={{ marginBottom: isMobile ? '16px' : '24px', maxWidth: '800px', margin: '0 auto', marginBottom: isMobile ? '16px' : '24px' }}>
        <h1 style={{
          fontFamily: '"Lora", serif', fontSize: isMobile ? '24px' : '28px',
          fontWeight: '600', color: '#3F1906', margin: 0, letterSpacing: '-0.3px',
        }}>Circles</h1>
        <p style={{
          fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '13px' : '14px',
          color: '#A08070', marginTop: '4px',
        }}>Your deep and meaningful connections</p>
      </div>

      {/* Pending Invitations Alert */}
      {groupInvites.length > 0 && (
        <div style={{...styles.inviteAlert, padding: isMobile ? '12px 14px' : '16px 20px', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', maxWidth: '800px', margin: '0 auto', marginBottom: isMobile ? '16px' : '20px'}} className="circles-invite-alert">
          <div style={styles.inviteAlertContent}>
            <UserPlus size={16} style={{ color: '#8B6914', flexShrink: 0 }} />
            <span style={styles.inviteAlertText}>
              {groupInvites.length} pending group invitation{groupInvites.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={styles.inviteActions}>
            {groupInvites.slice(0, 2).map(invite => (
              <div key={invite.id} style={styles.miniInvite}>
                <span style={styles.miniInviteName}>{invite.group?.name}</span>
                <button
                  style={styles.miniAcceptBtn}
                  onClick={() => handleAcceptInvite(invite.id, invite.group?.name)}
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Pending Join Requests (user-initiated) */}
      {pendingJoinRequests.length === 1 && (() => {
        const req = pendingJoinRequests[0];
        const daysAgo = req.invited_at ? Math.floor((Date.now() - new Date(req.invited_at)) / (1000 * 60 * 60 * 24)) : null;
        const timeLabel = daysAgo === null ? '' : daysAgo === 0 ? 'sent today' : daysAgo === 1 ? 'sent 1 day ago' : `sent ${daysAgo} days ago`;
        return (
          <div style={{
            background: 'white', borderRadius: '16px', border: '1px solid #E8DDD6',
            padding: isMobile ? '12px 14px' : '14px 16px', display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px',
            maxWidth: '800px', margin: '0 auto', marginBottom: isMobile ? '16px' : '20px',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
          }}>
            <div style={{
              width: isMobile ? '36px' : '40px', height: isMobile ? '36px' : '40px', borderRadius: '10px',
              background: '#F5E6D3', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: '18px',
            }}>⏳</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '15px', fontWeight: '600', color: '#2C1810',
                fontFamily: '"DM Sans", sans-serif', marginBottom: '3px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{req.groupName}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D4864A', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#A08070', fontFamily: '"DM Sans", sans-serif' }}>
                  Join request pending{timeLabel ? ` · ${timeLabel}` : ''}
                </span>
              </div>
            </div>
            <button
              onClick={async () => {
                const { error } = await supabase.from('connection_group_members').delete().eq('id', req.id);
                if (!error) setPendingJoinRequests(prev => prev.filter(r => r.id !== req.id));
              }}
              style={{
                fontSize: isMobile ? '12px' : '13px', fontWeight: '500', color: '#A08070',
                background: 'none', border: '1px solid #E8DDD6', borderRadius: '100px',
                padding: '7px 16px', cursor: 'pointer', fontFamily: '"DM Sans", sans-serif',
                transition: 'all 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#C4A882'; e.currentTarget.style.color = '#6B4C3B'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8DDD6'; e.currentTarget.style.color = '#A08070'; }}
            >Withdraw request</button>
          </div>
        );
      })()}
      {pendingJoinRequests.length > 1 && (
        <div style={{
          background: 'white', borderRadius: '16px', border: '1px solid #E8DDD6',
          overflow: 'hidden', maxWidth: '800px', margin: '0 auto', marginBottom: isMobile ? '16px' : '20px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid #E8DDD6',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} style={{ color: '#8B6F5C' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#2C1810', fontFamily: '"DM Sans", sans-serif' }}>
                Pending join requests
              </span>
              <span style={{
                fontSize: '11px', fontWeight: '600', background: '#F5E6D3', color: '#D4864A',
                borderRadius: '100px', padding: '2px 8px', fontFamily: '"DM Sans", sans-serif',
              }}>{pendingJoinRequests.length}</span>
            </div>
          </div>
          {pendingJoinRequests.map((req, i) => {
            const daysAgo = req.invited_at ? Math.floor((Date.now() - new Date(req.invited_at)) / (1000 * 60 * 60 * 24)) : null;
            const timeLabel = daysAgo === null ? '' : daysAgo === 0 ? 'Sent today' : daysAgo === 1 ? 'Sent 1 day ago' : `Sent ${daysAgo} days ago`;
            return (
              <div key={req.id} style={{
                display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '12px',
                borderBottom: i < pendingJoinRequests.length - 1 ? '1px solid #E8DDD6' : 'none',
              }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '8px',
                  background: '#F5E6D3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', flexShrink: 0,
                }}>⭕</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#2C1810', fontFamily: '"DM Sans", sans-serif' }}>
                    {req.groupName}
                  </div>
                  {timeLabel && (
                    <div style={{ fontSize: '12px', color: '#A08070', fontFamily: '"DM Sans", sans-serif', marginTop: '1px' }}>
                      {timeLabel}
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    const { error } = await supabase.from('connection_group_members').delete().eq('id', req.id);
                    if (!error) setPendingJoinRequests(prev => prev.filter(r => r.id !== req.id));
                  }}
                  style={{
                    fontSize: '12px', fontWeight: '500', color: '#A08070',
                    background: 'none', border: '1px solid #E8DDD6', borderRadius: '100px',
                    padding: '5px 13px', cursor: 'pointer', fontFamily: '"DM Sans", sans-serif',
                    transition: 'all 0.15s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#C4A882'; e.currentTarget.style.color = '#6B4C3B'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8DDD6'; e.currentTarget.style.color = '#A08070'; }}
                >Withdraw</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Single Column Layout */}
      <div style={styles.singleColumn}>

        {/* Pending Requests */}
        {sentRequestProfiles.length > 0 && (
          <section style={{ ...styles.section, marginBottom: '0' }} className="circles-card">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h2 style={{...styles.cardTitle, fontSize: isMobile ? '18px' : '20px'}}>
                  Pending Requests
                </h2>
                <span style={{
                  fontSize: '11px',
                  color: '#FFF8F0',
                  backgroundColor: '#8B6F5C',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontWeight: '600',
                }}>
                  {sentRequestProfiles.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sentRequestProfiles.map((person) => (
                  <div
                    key={person.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(139, 111, 92, 0.06)',
                      borderRadius: '12px',
                      border: '1px solid rgba(139, 111, 92, 0.1)',
                    }}
                  >
                    <div
                      style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        backgroundColor: '#8B6F5C',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', color: 'white', fontWeight: '600',
                        flexShrink: 0, overflow: 'hidden', cursor: 'pointer',
                      }}
                      onClick={() => onNavigate?.('userProfile', { userId: person.id })}
                    >
                      {person.profile_picture ? (
                        <img src={person.profile_picture} alt={person.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (person.name?.[0] || '?').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#3E2723',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {person.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8B7355',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {person.career || 'Professional'}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#A89080', flexShrink: 0 }}>
                      {formatTimeAgo(person.requested_at)}
                    </span>
                    <button
                      onClick={() => handleWithdrawRequest(person.id)}
                      style={{
                        padding: '5px 12px', fontSize: '12px', fontWeight: '600',
                        color: '#8B6F5C', backgroundColor: 'transparent',
                        border: '1.5px solid rgba(139, 111, 92, 0.3)',
                        borderRadius: '8px', cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      Withdraw
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Sent Circle Invitations */}
        {sentCircleInvites.length > 0 && (
          <section style={{ ...styles.section, marginBottom: '0' }} className="circles-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <h2 style={{...styles.cardTitle, fontSize: isMobile ? '18px' : '20px'}}>
                Pending Circle Invitations
              </h2>
              <span style={{
                fontSize: '11px', color: '#FFF8F0', backgroundColor: '#8B6F5C',
                borderRadius: '10px', padding: '2px 8px', fontWeight: '600',
              }}>
                {sentCircleInvites.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sentCircleInvites.map((invite) => (
                <div
                  key={invite.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(139, 111, 92, 0.06)',
                    borderRadius: '12px',
                    border: '1px solid rgba(139, 111, 92, 0.1)',
                  }}
                >
                  <div
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      backgroundColor: '#8B6F5C',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', color: 'white', fontWeight: '600',
                      flexShrink: 0, overflow: 'hidden', cursor: 'pointer',
                    }}
                    onClick={() => onNavigate?.('userProfile', { userId: invite.user.id })}
                  >
                    {invite.user.profile_picture ? (
                      <img src={invite.user.profile_picture} alt={invite.user.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (invite.user.name?.[0] || '?').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#3E2723',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {invite.user.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#8B7355' }}>
                      Invited to <span style={{ fontWeight: '600' }}>{invite.circleName}</span> · pending
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#A89080', flexShrink: 0 }}>
                    {invite.invited_at ? formatTimeAgo(invite.invited_at) : ''}
                  </span>
                  <button
                    onClick={() => handleWithdrawCircleInvite(invite.id)}
                    style={{
                      padding: '5px 12px', fontSize: '12px', fontWeight: '600',
                      color: '#8B6F5C', backgroundColor: 'transparent',
                      border: '1.5px solid rgba(139, 111, 92, 0.3)',
                      borderRadius: '8px', cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    Withdraw
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Chats */}
        {recentChats.length > 0 && (
          <section style={{ ...styles.section, marginBottom: '0' }} className="circles-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '10px' : '14px' }}>
              <h2 style={{...styles.cardTitle, fontSize: isMobile ? '18px' : '20px'}}>
                Recent Chats
              </h2>
              <button
                onClick={() => onNavigate?.('messages')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'none', border: 'none', color: '#8B6F5C',
                  fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                }}>
                See all <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => onNavigate?.('messages', { chatId: chat.partner.id, chatType: 'user' })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px',
                    backgroundColor: chat.unread ? 'rgba(139, 111, 92, 0.06)' : 'transparent',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(139, 111, 92, 0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = chat.unread ? 'rgba(139, 111, 92, 0.06)' : 'transparent'; }}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    backgroundColor: '#8B6F5C',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', color: 'white', fontWeight: '600',
                    flexShrink: 0, overflow: 'hidden',
                  }}>
                    {chat.partner.profile_picture ? (
                      <img src={chat.partner.profile_picture} alt={chat.partner.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (chat.partner.name?.[0] || '?').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontFamily: '"DM Sans", sans-serif', fontSize: '14px',
                        fontWeight: chat.unread ? '700' : '600', color: '#2C1810',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {chat.partner.name}
                      </span>
                      {chat.unread && (
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#8B6F5C', flexShrink: 0 }} />
                      )}
                    </div>
                    <p style={{
                      fontFamily: '"DM Sans", sans-serif', fontSize: '12px',
                      color: chat.unread ? '#5C4033' : '#8B7A6B',
                      fontWeight: chat.unread ? '500' : '400',
                      margin: '2px 0 0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {chat.isFromMe ? 'You: ' : ''}{chat.content?.slice(0, 50)}{chat.content?.length > 50 ? '...' : ''}
                    </p>
                  </div>
                  <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '11px', color: '#A89080', flexShrink: 0 }}>
                    {(() => {
                      const diff = Date.now() - new Date(chat.created_at).getTime();
                      const mins = Math.floor(diff / 60000);
                      if (mins < 60) return `${mins}m`;
                      const hours = Math.floor(mins / 60);
                      if (hours < 24) return `${hours}h`;
                      return `${Math.floor(hours / 24)}d`;
                    })()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Connections Section */}
        <section style={styles.section} className="circles-card">
          <h2 style={{...styles.cardTitle, fontSize: isMobile ? '18px' : '20px', marginBottom: isMobile ? '10px' : '14px'}}>
            My Connections
          </h2>
          {/* Existing connections - slide bar */}
          {connections.length === 0 ? (
            <div style={{
              padding: isMobile ? '24px 16px' : '32px 20px',
              textAlign: 'center',
              background: 'rgba(139, 111, 92, 0.04)',
              borderRadius: '16px',
              border: '1.5px dashed rgba(139, 111, 92, 0.2)',
            }}>
              <UserPlus size={28} style={{ color: '#B8A089', marginBottom: '10px' }} />
              <p style={{
                fontFamily: '"DM Sans", sans-serif', fontSize: '14px',
                fontWeight: '600', color: '#3F1906', margin: '0 0 4px',
              }}>No connections yet</p>
              <p style={{
                fontFamily: '"DM Sans", sans-serif', fontSize: '12px',
                color: '#A08070', margin: '0 0 16px',
              }}>Connect with people to start building meaningful relationships</p>
              <button
                onClick={() => onNavigate?.('allPeople')}
                style={{
                  padding: '8px 20px', borderRadius: '20px',
                  fontSize: '13px', fontWeight: '600',
                  background: '#8B6F5C', border: 'none',
                  color: '#FAF5EF', cursor: 'pointer',
                  fontFamily: '"DM Sans", sans-serif',
                }}
              >Discover People</button>
            </div>
          ) : (
          <div style={styles.slideBar}>
            {connections.map((user, index) => (
              <div
                key={user.id}
                style={{
                  ...styles.slideCard,
                  animationDelay: `${index * 0.1}s`
                }}
                className="circles-slide-card"
                onClick={() => setSelectedUser(user)}
              >
                <div
                  style={{ ...styles.slideAvatarContainer, cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.('userProfile', { userId: user.id });
                  }}
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} style={styles.slideAvatarImg} className="circles-slide-avatar" />
                  ) : (
                    <div style={styles.slideAvatarPlaceholder} className="circles-slide-avatar">👤</div>
                  )}
                  <span style={{
                    ...styles.slideStatusIndicator,
                    backgroundColor: user.status === 'online' ? '#4CAF50' : '#FFA726'
                  }}></span>
                </div>
                <span style={styles.slideName} className="circles-slide-name">{user.name?.split(' ')[0]}</span>
                <span style={styles.slideRole}>{user.career}</span>
                <div style={styles.slideActions} onClick={(e) => e.stopPropagation()}>
                  <button
                    style={{ ...styles.slideActionBtn, position: 'relative' }}
                    className="slide-action-btn"
                    onClick={() => onNavigate?.('messages', { chatId: user.id, chatType: 'user' })}
                    title="Message"
                  >
                    <MessageCircle size={13} />
                    {unreadCounts[user.userId] > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        backgroundColor: '#ef4444',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 700,
                        minWidth: 15,
                        height: 15,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        padding: '0 3px',
                        border: '1.5px solid #FDF8F3',
                      }}>
                        {unreadCounts[user.userId] > 9 ? '9+' : unreadCounts[user.userId]}
                      </span>
                    )}
                  </button>
                  <button
                    style={styles.slideActionBtn}
                    className="slide-action-btn"
                    onClick={() => onNavigate?.('scheduleMeetup', {
                      type: 'coffee',
                      scheduleConnectionId: user.id,
                      scheduleConnectionName: user.name,
                    })}
                    title="Schedule Coffee"
                  >
                    <Coffee size={13} />
                  </button>
                </div>
              </div>
            ))}

          </div>
          )}

          {/* My Active Circles */}
          {enrichedGroups.length > 0 && (
            <>
              <div style={{ height: '1px', background: 'rgba(139, 111, 92, 0.1)', margin: '20px 0 0' }} />
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '10px' : '14px' }}>
                  <h2 style={{...styles.cardTitle, fontSize: isMobile ? '18px' : '20px'}}>
                    My Active Circles
                  </h2>
                  <button
                    onClick={() => onNavigate?.('allCircles')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      background: 'none', border: 'none', color: '#8B6F5C',
                      fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    }}>
                    Discover <ChevronRight size={14} />
                  </button>
                </div>

                <div style={styles.circlesList}>
                  {enrichedGroups.map(({ group, acceptedMembers, activeMembers, activeNames, theme, hasUpcoming, sessionCount, daysUntilMeetup, hasNoActivity }, index) => (
                    <div
                      key={group.id}
                      className="circles-circle-card"
                      onClick={() => onNavigate?.('circleDetail', { circleId: group.id })}
                      style={{
                        background: '#FAF7F4', borderRadius: isMobile ? '14px' : '22px',
                        border: hasNoActivity ? '1.5px dashed rgba(139, 111, 92, 0.25)' : '1px solid #E8DDD6',
                        boxShadow: '0 4px 24px rgba(61,46,34,0.11)',
                        overflow: 'hidden', display: 'flex', alignItems: 'stretch',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        animationDelay: `${index * 0.12}s`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(61,46,34,0.15)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(61,46,34,0.11)'; }}
                    >
                      {/* Left: image */}
                      <div style={{
                        width: isMobile ? '100px' : '160px', flexShrink: 0,
                        position: 'relative', overflow: 'hidden',
                      }}>
                        {group.image_url ? (
                          <img src={group.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <svg viewBox="0 0 110 190" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
                            <rect width="110" height="190" fill="#2C1F15"/>
                            <circle cx="55" cy="95" r="60" fill="#E8C070" opacity="0.06"/>
                            <circle cx="55" cy="95" r="38" fill="#E8C070" opacity="0.07"/>
                            <circle cx="55" cy="95" r="50" fill="none" stroke="#5C3D20" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.6"/>
                            <ellipse cx="55" cy="98" rx="34" ry="22" fill="#5C3D20"/>
                            <ellipse cx="55" cy="98" rx="34" ry="22" fill="none" stroke="#7A5230" strokeWidth="1.5"/>
                            <ellipse cx="55" cy="50" rx="7" ry="7" fill="#C4956A"/>
                            <rect x="48" y="55" width="14" height="10" rx="5" fill="#C4956A"/>
                            <ellipse cx="88" cy="77" rx="6" ry="6" fill="#A0724A"/>
                            <rect x="82" y="82" width="12" height="9" rx="4" fill="#A0724A"/>
                            <ellipse cx="23" cy="77" rx="6" ry="6" fill="#D4A878"/>
                            <rect x="17" y="82" width="12" height="9" rx="4" fill="#D4A878"/>
                          </svg>
                        )}
                      </div>

                      {/* Right: content */}
                      <div style={{
                        flex: 1, padding: isMobile ? '10px 12px' : '14px 16px',
                        display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px', minWidth: 0,
                      }}>
                        {/* Status badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {activeNames.length > 0 && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              padding: isMobile ? '2px 7px' : '3px 9px', borderRadius: '20px',
                              background: '#E8F5E9', border: '1px solid #B8DFC0',
                              fontSize: isMobile ? '9px' : '10.5px', fontWeight: '600', color: '#2E6B40',
                            }}>
                              <span style={{ width: isMobile ? 5 : 6, height: isMobile ? 5 : 6, borderRadius: '50%', background: '#22c55e' }} />
                              {activeNames.length <= 2
                                ? activeNames.join(' & ')
                                : `${activeNames[0]} + ${activeNames.length - 1} more`} online
                            </span>
                          )}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            padding: isMobile ? '2px 7px' : '3px 9px', borderRadius: '20px',
                            background: '#F0E8DF', border: '1px solid #E0D0BE',
                            fontSize: isMobile ? '9px' : '10.5px', fontWeight: '600', color: '#6B4F35',
                          }}>
                            <Users size={isMobile ? 9 : 11} /> {acceptedMembers.length} member{acceptedMembers.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Name + sessions */}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <h3 style={{
                            fontSize: isMobile ? '13px' : '15px', fontWeight: '700',
                            color: '#2C1F15', margin: 0, fontFamily: '"Lora", serif',
                            lineHeight: '1.25', letterSpacing: '-0.2px',
                          }}>
                            {group.name}
                          </h3>
                          {sessionCount > 0 && (
                            <span style={{ fontSize: isMobile ? '10px' : '11px', color: '#A89080', flexShrink: 0 }}>
                              {sessionCount} past session{sessionCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Last activity + Next meetup */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {group.lastMessage ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: isMobile ? '11px' : '12px', color: '#8B7355' }}>
                              <MessageCircle size={11} style={{ color: '#A89080', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: '600' }}>{group.lastMessage.sender?.name?.split(' ')[0] || 'Someone'}</span>: {group.lastMessage.content?.slice(0, 50)}
                              </span>
                              {group.lastMessage.created_at && (
                                <span style={{ fontSize: '10px', color: '#A89080', flexShrink: 0, marginLeft: 'auto' }}>
                                  {(() => {
                                    const diff = Date.now() - new Date(group.lastMessage.created_at).getTime();
                                    const mins = Math.floor(diff / 60000);
                                    if (mins < 60) return `${mins}m`;
                                    const hours = Math.floor(mins / 60);
                                    if (hours < 24) return `${hours}h`;
                                    return `${Math.floor(hours / 24)}d`;
                                  })()}
                                </span>
                              )}
                            </div>
                          ) : group.lastTopic ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: isMobile ? '11px' : '12px', color: '#8B7355' }}>
                              <FileText size={11} style={{ color: '#A89080', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Last: {group.lastTopic}
                              </span>
                            </div>
                          ) : hasNoActivity ? (
                            <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#A89080', fontStyle: 'italic' }}>
                              No activity yet
                            </div>
                          ) : null}
                          {hasUpcoming && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: isMobile ? '11px' : '12px', color: '#5C4033' }}>
                              <Calendar size={12} style={{ flexShrink: 0, color: '#8B6F5C' }} />
                              <span style={{ fontWeight: '600' }}>
                                Next: {parseLocalDate(group.nextMeetup.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                {group.nextMeetup.time && ` · ${group.nextMeetup.time}`}
                              </span>
                              {daysUntilMeetup !== null && (
                                <span style={{
                                  fontSize: '10px', fontWeight: '600',
                                  color: daysUntilMeetup === 0 ? '#4CAF50' : '#D4864A',
                                  background: daysUntilMeetup === 0 ? '#4CAF5015' : '#FDF3EB',
                                  padding: '1px 6px', borderRadius: '6px', marginLeft: 'auto',
                                }}>
                                  {daysUntilMeetup === 0 ? 'Today' : daysUntilMeetup === 1 ? 'Tomorrow' : `in ${daysUntilMeetup}d`}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Member avatars + CTA */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {acceptedMembers.slice(0, isMobile ? 3 : 4).map((member, idx) => (
                              <div key={member.id} style={{
                                width: isMobile ? '22px' : '26px', height: isMobile ? '22px' : '26px', borderRadius: '50%',
                                background: member.user?.profile_picture ? 'none'
                                  : `linear-gradient(135deg, ${['#9C8068', '#C9A96E', '#8B9E7E', '#A67B5B'][idx % 4]}, #7A5C42)`,
                                border: '1.5px solid #FAF7F4',
                                marginLeft: idx > 0 ? '-6px' : 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '9px', fontWeight: '600', color: 'white',
                                overflow: 'hidden', flexShrink: 0,
                              }}>
                                {member.user?.profile_picture ? (
                                  <img src={member.user.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (member.user?.name?.[0] || '?').toUpperCase()}
                              </div>
                            ))}
                            {acceptedMembers.length > (isMobile ? 3 : 4) && (
                              <div style={{
                                width: isMobile ? '22px' : '26px', height: isMobile ? '22px' : '26px', borderRadius: '50%',
                                backgroundColor: 'rgba(189, 173, 162, 0.5)',
                                border: '1.5px solid #FAF7F4',
                                marginLeft: '-6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '8px', fontWeight: '600', color: '#605045',
                              }}>
                                +{acceptedMembers.length - (isMobile ? 3 : 4)}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); onNavigate?.('messages', { chatId: group.id, chatType: 'circle' }); }}
                              style={{
                                width: isMobile ? '30px' : '34px', height: isMobile ? '30px' : '34px', borderRadius: '50%',
                                background: 'transparent', border: '1px solid #E0D0BE',
                                color: '#6B4F35', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s', flexShrink: 0,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#F0E8DF'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            ><MessageCircle size={isMobile ? 14 : 16} /></button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onNavigate?.('circleDetail', { circleId: group.id }); }}
                              style={{
                                padding: isMobile ? '6px 14px' : '7px 18px', borderRadius: '20px',
                                fontSize: isMobile ? '12px' : '13px', fontWeight: '600',
                                background: hasUpcoming && daysUntilMeetup === 0 ? '#4CAF50' : '#8B6F5C',
                                border: 'none',
                                color: '#FAF5EF', cursor: 'pointer', fontFamily: '"DM Sans", sans-serif',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                            >{hasUpcoming && daysUntilMeetup === 0 ? 'Join Now' : hasUpcoming ? 'View Session' : hasNoActivity ? 'Get Started' : 'Open Circle'}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={handleCreateClick} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', padding: '12px', marginTop: '12px',
                  backgroundColor: 'transparent', border: '1.5px dashed rgba(139, 111, 92, 0.25)',
                  borderRadius: '12px', color: '#8B6F5C', fontSize: '14px', fontWeight: '600',
                  cursor: 'pointer', fontFamily: '"Lora", serif', transition: 'all 0.2s ease',
                }}>
                  <UserPlus size={16} /> Create a Circle
                </button>
              </div>
            </>
          )}

          {/* People you may know */}
          {peerSuggestions.length > 0 && (
            <>
              <div style={{ height: '1px', background: 'rgba(139, 111, 92, 0.1)', margin: '20px 0 0' }} />
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '10px' : '14px' }}>
                  <h2 style={{...styles.cardTitle, fontSize: isMobile ? '18px' : '20px'}}>
                    Recommend to Connect
                  </h2>
                  <button
                    onClick={() => onNavigate?.('allPeople')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      background: 'none', border: 'none', color: '#8B6F5C',
                      fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    }}>
                    See all <ChevronRight size={14} />
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: isMobile ? '10px' : '12px',
                }}>
                  {peerSuggestions.slice(0, 4).map((person) => (
                    <div
                      key={person.id}
                      onClick={() => onNavigate?.('userProfile', { userId: person.id })}
                      style={{
                        width: '100%',
                        background: '#FFFBF7',
                        border: '1px solid rgba(124, 96, 65, 0.12)',
                        borderRadius: '20px',
                        padding: isMobile ? '16px' : '20px',
                        display: 'flex', flexDirection: 'column',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(88, 66, 51, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Avatar + Name/Career */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{
                            width: isMobile ? '48px' : '56px', height: isMobile ? '48px' : '56px',
                            borderRadius: '50%',
                            backgroundColor: '#6B5344',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: isMobile ? '18px' : '20px', color: 'white', fontWeight: '600',
                            overflow: 'hidden',
                          }}>
                            {person.profile_picture ? (
                              <img src={person.profile_picture} alt={person.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              (person.name?.[0] || '?').toUpperCase()
                            )}
                          </div>
                          {person.last_active && (
                            <span style={{
                              position: 'absolute', bottom: '2px', right: '2px',
                              width: '10px', height: '10px', borderRadius: '50%',
                              backgroundColor: isUserActive(person.last_active, 10) ? '#4CAF50' : '#FFA726',
                              border: '2px solid #FFFBF7',
                            }} />
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 style={{
                            fontFamily: '"Lora", serif', fontSize: isMobile ? '15px' : '17px', fontWeight: '700',
                            color: '#2C1810', margin: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {person.name}
                          </h4>
                          <p style={{
                            fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '12px' : '13px',
                            color: '#5C4033', margin: '2px 0 0',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {person.career || 'Professional'}
                          </p>
                          {/* Interest Tags */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                            {(person.interests?.length ? person.interests : [person.industry].filter(Boolean)).slice(0, 3).map((tag, i) => (
                              <span key={i} style={{
                                fontFamily: '"DM Sans", sans-serif', fontSize: '10px', fontWeight: 500,
                                color: '#5C4033', backgroundColor: '#E8DDD6',
                                border: 'none',
                                borderRadius: '8px', padding: '2px 8px',
                                whiteSpace: 'nowrap',
                              }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Hook / Description */}
                      {person.hook && (
                        <p style={{
                          fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '12px' : '13px',
                          color: '#3D2B1F', margin: '0 0 10px', lineHeight: '1.4',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>
                          {person.hook}
                        </p>
                      )}

                      {/* Mutuals + Activity */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '11px' : '12px',
                        color: '#8B7A6B', marginBottom: '12px',
                      }}>
                        {(person.mutualConnections > 0 || person.mutualCircles > 0) && (
                          <>
                            <span style={{
                              width: '16px', height: '16px', borderRadius: '50%',
                              backgroundColor: '#4CAF50', display: 'inline-flex',
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Check size={10} style={{ color: 'white' }} />
                            </span>
                            <span>{person.mutualConnections || person.mutualCircles || 0} mutuals</span>
                            <span style={{ color: '#B8A089' }}>·</span>
                          </>
                        )}
                        <span>{(() => {
                          if (!person.last_active) return 'Not yet active';
                          const diff = Date.now() - new Date(person.last_active).getTime();
                          const mins = Math.floor(diff / 60000);
                          if (mins < 10) return 'Active now';
                          if (mins < 60) return `Active ${mins}m ago`;
                          const hours = Math.floor(mins / 60);
                          if (hours < 24) return `Active ${hours}h ago`;
                          const days = Math.floor(hours / 24);
                          if (days < 7) return 'Active this week';
                          if (days < 30) return `Active ${Math.floor(days / 7)}w ago`;
                          return `Active ${Math.floor(days / 30)}mo+ ago`;
                        })()}</span>
                      </div>

                      {/* Bottom row: Coffee Chat left, Connect right */}
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: isMobile ? '8px' : '0' }}>
                        {person.open_to_coffee_chat ? (
                          <span style={{
                            fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '10px' : '11px', fontWeight: 600,
                            color: '#5C4033', backgroundColor: '#FDF3EB',
                            border: '1px solid rgba(124, 96, 65, 0.15)',
                            borderRadius: '8px', padding: '3px 10px',
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            whiteSpace: 'nowrap',
                          }}>
                            <Coffee size={10} /> Open to Coffee Chat
                          </span>
                        ) : <div />}
                        {sentRequests.has(person.id) ? (
                          <div style={{
                            padding: '5px 14px',
                            backgroundColor: 'rgba(92, 64, 51, 0.06)',
                            color: '#8B6F5C',
                            border: '1.5px solid rgba(139, 111, 92, 0.2)',
                            borderRadius: '10px', fontSize: '12px', fontWeight: '600',
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                          }}>
                            <Check size={11} /> Requested
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleConnect(person.id); }}
                            style={{
                              padding: '5px 14px',
                              backgroundColor: '#8B6F5C', color: '#FFF',
                              border: 'none', borderRadius: '10px',
                              fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#7A5C42'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#8B6F5C'; }}
                          >
                            <UserPlus size={11} /> Connect
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

      </div>


      {/* Create Group Modal */}
      {showCreateModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal} className="circles-modal">
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Create Circle</h2>
              <button
                style={styles.modalClose}
                onClick={() => {
                  setShowCreateModal(false);
                  setGroupName('');
                  setGroupDescription('');
                  setSelectedConnections([]);
                }}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Circle Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Product Managers SF"
                  style={styles.formInput}
                  maxLength={100}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Description (optional)</label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="What is this circle about?"
                  style={{ ...styles.formInput, minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                  maxLength={300}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Select 2-9 Connections</label>
                <p style={styles.formHint}>{selectedConnections.length}/9 selected</p>

                <div style={styles.connectionsList}>
                  {eligibleConnections.map(connection => (
                    <div
                      key={connection.id}
                      style={{
                        ...styles.connectionItem,
                        ...(selectedConnections.includes(connection.id) ? styles.connectionItemSelected : {})
                      }}
                      onClick={() => handleToggleConnection(connection.id)}
                    >
                      <div style={styles.connectionCheckbox}>
                        {selectedConnections.includes(connection.id) && (
                          <span style={styles.checkmark}>✓</span>
                        )}
                      </div>
                      <div style={styles.connectionDetails}>
                        <span style={styles.connectionName}>{connection.name}</span>
                        <span style={styles.connectionCareer}>{connection.career}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                style={styles.cancelButton}
                onClick={() => {
                  setShowCreateModal(false);
                  setGroupName('');
                  setGroupDescription('');
                  setSelectedConnections([]);
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.submitButton,
                  ...(!groupName.trim() || selectedConnections.length < 2 ? styles.submitButtonDisabled : {})
                }}
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedConnections.length < 2}
              >
                Create Circle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Circle Created Success Modal */}
      {createSuccess && (
        <div style={styles.modalOverlay} onClick={() => setCreateSuccess(null)}>
          <div
            style={{
              ...styles.modalContent,
              maxWidth: '360px',
              textAlign: 'center',
              padding: '32px 24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Check size={48} style={{ color: '#4A7C59', marginBottom: '16px' }} />
            <h2 style={{
              fontFamily: '"Lora", serif',
              fontSize: '20px',
              fontWeight: '700',
              color: '#2C1810',
              margin: '0 0 8px',
            }}>
              Circle Created!
            </h2>
            <p style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '14px',
              color: '#8B7355',
              margin: '0 0 6px',
              lineHeight: '1.5',
            }}>
              <strong style={{ color: '#5C4033' }}>{createSuccess.name}</strong> is ready to go.
            </p>
            <p style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '13px',
              color: '#A89080',
              margin: '0 0 24px',
            }}>
              {createSuccess.inviteCount} invitation{createSuccess.inviteCount !== 1 ? 's' : ''} sent to your connections.
            </p>
            <button
              onClick={() => setCreateSuccess(null)}
              style={{
                padding: '10px 32px',
                backgroundColor: '#5C4033',
                color: '#FFF',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: '"DM Sans", sans-serif',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#7A5C42'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#5C4033'; }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Group Chat Modal */}
      {showChatModal && selectedGroup && (
        <div style={styles.modalOverlay}>
          <div style={styles.chatModal} className="circles-modal">
            <div style={styles.chatHeader}>
              <div>
                <h2 style={styles.chatTitle}>{selectedGroup.name}</h2>
                <p style={styles.chatSubtitle}>Group Chat</p>
              </div>
              <button
                style={styles.modalClose}
                onClick={() => {
                  setShowChatModal(false);
                  setSelectedGroup(null);
                  setGroupMessages([]);
                }}
              >
                ✕
              </button>
            </div>

            <div style={styles.chatMessages}>
              {groupMessages.length === 0 ? (
                <div style={styles.chatEmpty}>
                  <MessageCircle size={32} style={{ color: '#B8A089', marginBottom: '8px' }} />
                  <p style={styles.chatEmptyText}>No messages yet</p>
                  <p style={styles.chatEmptyHint}>Start the conversation!</p>
                </div>
              ) : (
                groupMessages.map((msg) => {
                  const isOwn = msg.user_id === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        ...styles.messageWrapper,
                        justifyContent: isOwn ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{
                        ...styles.messageBubble,
                        ...(isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther)
                      }}>
                        <p style={styles.msgSender}>
                          {isOwn ? 'You' : msg.user?.name || 'Unknown'}
                        </p>
                        <p style={styles.messageText}>{msg.message}</p>
                        <div style={styles.messageFooter}>
                          <span style={styles.msgTime}>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {isOwn && (
                            <button
                              style={styles.messageDelete}
                              onClick={() => handleDeleteMessage(msg.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form style={styles.chatInputBar} onSubmit={handleSendMessage}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                style={styles.chatInput}
                maxLength={2000}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                style={{
                  ...styles.chatSendButton,
                  ...(!newMessage.trim() ? styles.chatSendButtonDisabled : {})
                }}
              >
                ✦
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{keyframeStyles}</style>
    </div>
  );
}

const keyframeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap');

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .sparkline-container .sparkline-bar {
    transition: background-color 0.3s ease, transform 0.3s ease;
  }

  .circles-circle-card:hover .sparkline-container .sparkline-bar {
    background-color: var(--bar-warm) !important;
    transform: scaleY(1.15);
    transform-origin: bottom;
  }

  .circles-circle-card:hover .sparkline-container .sparkline-bar:nth-child(1) { transition-delay: 0s; }
  .circles-circle-card:hover .sparkline-container .sparkline-bar:nth-child(2) { transition-delay: 0.05s; }
  .circles-circle-card:hover .sparkline-container .sparkline-bar:nth-child(3) { transition-delay: 0.1s; }
  .circles-circle-card:hover .sparkline-container .sparkline-bar:nth-child(4) { transition-delay: 0.15s; }
  .circles-circle-card:hover .sparkline-container .sparkline-bar:nth-child(5) { transition-delay: 0.2s; }

  .slide-action-btn:hover {
    background-color: rgba(139, 111, 92, 0.15) !important;
    border-color: rgba(139, 111, 92, 0.3) !important;
    color: #5C4033 !important;
  }

  /* Responsive styles */
  @media (max-width: 640px) {
    .circles-container {
      padding: 16px 0 !important;
    }
    .circles-title-section {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 12px !important;
    }
    .circles-page-title {
      font-size: 28px !important;
    }
    .circles-quick-stats {
      width: 100% !important;
      justify-content: space-around !important;
      padding: 12px 16px !important;
    }
    .circles-stat-number {
      font-size: 20px !important;
    }
    .circles-card {
      padding: 16px !important;
      border-radius: 20px !important;
    }
    .circles-card-header {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 8px !important;
    }
    .circles-card-title {
      font-size: 16px !important;
    }
    .circles-slide-card {
      min-width: 80px !important;
      padding: 12px 10px !important;
    }
    .circles-slide-avatar {
      width: 48px !important;
      height: 48px !important;
    }
    .circles-slide-name {
      font-size: 12px !important;
    }
    .circles-add-card {
      min-width: 80px !important;
      padding: 12px 10px !important;
    }
    .circles-add-icon {
      width: 48px !important;
      height: 48px !important;
      font-size: 24px !important;
    }
    .circles-message-item {
      padding: 10px !important;
    }
    .circles-circle-card .circle-card-layout {
      flex-direction: column !important;
      align-items: stretch !important;
    }
    .circles-circle-card .circle-card-actions {
      margin-top: 10px !important;
      padding-top: 10px !important;
      border-top: 1px solid rgba(139, 111, 92, 0.08) !important;
    }
    .circles-circle-card .circle-card-actions button {
      flex: 1 !important;
    }
    .circles-invite-alert {
      flex-direction: column !important;
      align-items: flex-start !important;
    }
    .circles-modal {
      margin: 16px !important;
      max-height: calc(100vh - 32px) !important;
    }
  }

  @media (max-width: 480px) {
    .circles-page-title {
      font-size: 24px !important;
    }
    .circles-quick-stats {
      gap: 12px !important;
      padding: 10px 12px !important;
    }
    .circles-stat-number {
      font-size: 18px !important;
    }
    .circles-stat-label {
      font-size: 10px !important;
    }
    .circles-card {
      padding: 14px !important;
      border-radius: 16px !important;
    }
    .circles-slide-card {
      min-width: 70px !important;
      padding: 10px 8px !important;
    }
    .circles-slide-avatar {
      width: 44px !important;
      height: 44px !important;
    }
    .circles-circle-emoji {
      width: 40px !important;
      height: 40px !important;
      font-size: 18px !important;
    }
  }
`;

const styles = {
  container: {
    fontFamily: '"Lora", serif',
    position: 'relative',
    padding: '24px 0',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(165deg, #FDF8F3 0%, #F5EDE6 50%, #EDE4DB 100%)',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(139, 111, 92, 0.2)',
    borderTopColor: '#8B6F5C',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },
  loadingText: {
    color: '#6B5344',
    fontSize: '16px',
  },
  titleSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: '24px',
    paddingBottom: '20px',
    position: 'relative',
    zIndex: 1,
    flexWrap: 'wrap',
    gap: '16px',
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto 24px auto',
  },
  titleContent: {},
  pageTitle: {
    fontFamily: '"Lora", serif',
    fontSize: '32px',
    fontWeight: '500',
    color: '#584233',
    letterSpacing: '0.15px',
    lineHeight: 1.28,
    marginBottom: '4px',
    margin: 0,
  },
  tagline: {
    fontFamily: '"Lora", serif',
    fontSize: '15px',
    fontWeight: '500',
    color: '#7E654D',
    margin: 0,
  },
  quickStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '14px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: '"Lora", serif',
    fontSize: '24px',
    fontWeight: '600',
    color: '#5C4033',
  },
  statLabel: {
    fontSize: '11px',
    color: '#8B7355',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statDivider: {
    width: '1px',
    height: '28px',
    backgroundColor: 'rgba(139, 111, 92, 0.2)',
  },
  inviteAlert: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: 'rgba(139, 111, 92, 0.12)',
    borderRadius: '16px',
    marginBottom: '24px',
    position: 'relative',
    zIndex: 1,
    flexWrap: 'wrap',
    gap: '12px',
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto 24px auto',
  },
  inviteAlertContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  inviteAlertIcon: {
    fontSize: '20px',
  },
  inviteAlertText: {
    fontWeight: '600',
    color: '#5C4033',
    fontSize: '15px',
  },
  inviteActions: {
    display: 'flex',
    gap: '10px',
  },
  miniInvite: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '100px',
  },
  miniInviteName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#5C4033',
  },
  miniAcceptBtn: {
    padding: '4px 12px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  singleColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    marginBottom: '24px',
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto 24px auto',
  },
  section: {
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column',
    animation: 'fadeInUp 0.6s ease-out forwards',
  },
  sectionDivider: {
    height: '1px',
    backgroundColor: 'rgba(139, 111, 92, 0.15)',
    margin: '0',
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: '24px',
    padding: '20px',
    boxShadow: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    animation: 'fadeInUp 0.6s ease-out forwards',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  cardTitle: {
    fontFamily: '"Lora", serif',
    fontSize: '20px',
    fontWeight: '500',
    color: '#3F1906',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: 0,
  },
  cardIcon: {
    fontSize: '16px',
  },
  onlineBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#4CAF50',
    fontWeight: '500',
  },
  pulsingDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#4CAF50',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
  },
  userGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  slideBar: {
    display: 'flex',
    gap: '16px',
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingBottom: '8px',
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(139, 111, 92, 0.3) transparent',
    WebkitOverflowScrolling: 'touch',
  },
  slideCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 14px',
    minWidth: '110px',
    backgroundColor: 'transparent',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
    flexShrink: 0,
  },
  slideAvatarContainer: {
    position: 'relative',
  },
  slideAvatarImg: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2.5px solid rgba(139, 111, 92, 0.15)',
  },
  slideAvatarPlaceholder: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    border: '2.5px solid rgba(139, 111, 92, 0.15)',
  },
  slideStatusIndicator: {
    position: 'absolute',
    bottom: '3px',
    right: '3px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2.5px solid white',
  },
  slideName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2B1F',
    textAlign: 'center',
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slideRole: {
    fontSize: '12px',
    color: '#8B7355',
    textAlign: 'center',
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slideActions: {
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
  },
  slideActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    border: '1px solid rgba(139, 111, 92, 0.15)',
    backgroundColor: '#E8DDD6',
    color: '#8B6F5C',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    padding: 0,
  },
  addConnectionCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 12px',
    minWidth: '90px',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    flexShrink: 0,
    border: '2px dashed rgba(139, 111, 92, 0.3)',
  },
  addConnectionIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 111, 92, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: '300',
    color: '#8B6F5C',
    border: '2px dashed rgba(139, 111, 92, 0.3)',
  },
  addConnectionText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#8B6F5C',
  },
  emptyCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '36px',
    marginBottom: '12px',
    opacity: 0.6,
  },
  emptyText: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#5C4033',
    marginBottom: '4px',
  },
  emptyHint: {
    fontSize: '13px',
    color: '#8B7355',
    marginBottom: '16px',
  },
  emptyStateButton: {
    padding: '12px 24px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
    transition: 'all 0.3s ease',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'transparent',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  userAvatarContainer: {
    position: 'relative',
  },
  userAvatar: {
    fontSize: '32px',
    display: 'block',
  },
  userAvatarImg: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: '0',
    right: '0',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '2px solid white',
  },
  userInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  userName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2B1F',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: '12px',
    color: '#8B7355',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mutualBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    borderRadius: '10px',
    flexShrink: 0,
  },
  mutualCount: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#5C4033',
  },
  mutualLabel: {
    fontSize: '9px',
    color: '#8B7355',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  seeAllBtn: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: 'transparent',
    border: '1.5px solid rgba(139, 111, 92, 0.25)',
    borderRadius: '12px',
    color: '#6B5344',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"Lora", serif',
  },
  tabGroup: {
    display: 'flex',
    gap: '4px',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    padding: '4px',
    borderRadius: '10px',
  },
  tab: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#8B7355',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: '"Lora", serif',
  },
  tabActive: {
    backgroundColor: 'white',
    color: '#5C4033',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
  },
  messageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
    overflow: 'auto',
    maxHeight: '300px',
  },
  messageItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
    position: 'relative',
  },
  messageUnread: {
    backgroundColor: 'rgba(139, 111, 92, 0.06)',
  },
  messageAvatar: {
    position: 'relative',
    flexShrink: 0,
  },
  msgAvatarEmoji: {
    fontSize: '28px',
    display: 'block',
  },
  msgAvatarImg: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  groupIndicator: {
    position: 'absolute',
    bottom: '-2px',
    right: '-4px',
    fontSize: '7px',
    color: '#8B6F5C',
  },
  messageContent: {
    flex: 1,
    minWidth: 0,
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '3px',
  },
  messageSender: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  messageTime: {
    fontSize: '11px',
    color: '#A89080',
  },
  messagePreview: {
    fontSize: '12px',
    color: '#6B5344',
    lineHeight: '1.4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    margin: 0,
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#8B6F5C',
    borderRadius: '50%',
    flexShrink: 0,
    alignSelf: 'center',
  },
  composeBar: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
    padding: '6px',
    backgroundColor: 'rgba(139, 111, 92, 0.06)',
    borderRadius: '14px',
  },
  composeInput: {
    flex: 1,
    padding: '10px 14px',
    backgroundColor: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '13px',
    color: '#3D2B1F',
    outline: 'none',
    fontFamily: '"Lora", serif',
  },
  composeBtn: {
    width: '40px',
    height: '40px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGroupBtn: {
    padding: '6px 14px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(139, 111, 92, 0.2)',
    borderRadius: '100px',
    color: '#8B7355',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"Lora", serif',
  },
  circlesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  createFirstBtn: {
    marginTop: '16px',
    padding: '12px 20px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
  },
  circleCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '14px',
    backgroundColor: 'transparent',
    borderRadius: '14px',
    border: '1px solid rgba(139, 111, 92, 0.08)',
    transition: 'all 0.3s ease',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  emptyCardActionable: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 24px',
    border: '1.5px dashed rgba(139, 111, 92, 0.25)',
    borderRadius: '14px',
    backgroundColor: 'rgba(139, 111, 92, 0.02)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.3s ease',
  },
  circleEmoji: {
    width: '64px',
    minHeight: '64px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, rgba(139, 111, 92, 0.15), rgba(139, 111, 92, 0.25))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
  },
  circleInfo: {
    flex: 1,
    minWidth: 0,
  },
  circleName: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#2C1810',
    marginBottom: '2px',
    margin: 0,
  },
  circleDesc: {
    fontSize: '13px',
    color: '#5C4033',
    margin: 0,
    marginBottom: '6px',
  },
  circleActivityLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#6B5344',
    marginTop: '6px',
    overflow: 'hidden',
  },
  activityIcon: {
    fontSize: '11px',
    flexShrink: 0,
  },
  activityText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  activityTime: {
    fontSize: '10px',
    color: '#A89080',
    flexShrink: 0,
  },
  noActivityText: {
    fontSize: '11px',
    color: '#A89080',
    fontStyle: 'italic',
  },
  circleMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  memberCount: {
    fontSize: '11px',
    color: '#A89080',
  },
  activeCount: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: '#4CAF50',
  },
  activeDot: {
    width: '6px',
    height: '6px',
    backgroundColor: '#4CAF50',
    borderRadius: '50%',
  },
  enterBtn: {
    padding: '8px 20px',
    backgroundColor: 'transparent',
    border: '1.5px solid rgba(139, 111, 92, 0.3)',
    borderRadius: '100px',
    color: '#6B5344',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"Lora", serif',
    flexShrink: 0,
  },
  exploreBtn: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"Lora", serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  exploreBtnIcon: {
    fontSize: '14px',
  },
  motivationalBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '28px 32px',
    background: 'linear-gradient(135deg, #5C4033 0%, #8B6F5C 100%)',
    borderRadius: '20px',
    position: 'relative',
    zIndex: 1,
    flexWrap: 'wrap',
    gap: '20px',
  },
  bannerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flex: 1,
    minWidth: '250px',
  },
  bannerQuote: {
    fontFamily: '"Lora", serif',
    fontSize: '40px',
    color: 'rgba(255, 255, 255, 0.3)',
    lineHeight: 1,
  },
  bannerQuoteEnd: {
    fontFamily: '"Lora", serif',
    fontSize: '40px',
    color: 'rgba(255, 255, 255, 0.3)',
    lineHeight: 1,
    alignSelf: 'flex-end',
  },
  bannerText: {
    fontFamily: '"Lora", serif',
    fontSize: '17px',
    color: 'white',
    fontWeight: '400',
    fontStyle: 'italic',
    lineHeight: '1.5',
    margin: 0,
  },
  bannerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 24px',
    backgroundColor: 'white',
    border: 'none',
    borderRadius: '100px',
    color: '#5C4033',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"Lora", serif',
    flexShrink: 0,
  },
  bannerArrow: {
    fontSize: '16px',
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(61, 43, 31, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  modal: {
    backgroundColor: '#FDF8F3',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 24px 48px rgba(61, 43, 31, 0.2)',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(139, 111, 92, 0.1)',
  },
  modalTitle: {
    fontFamily: '"Lora", serif',
    fontSize: '20px',
    fontWeight: '600',
    color: '#3D2B1F',
    margin: 0,
  },
  modalClose: {
    width: '36px',
    height: '36px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    border: 'none',
    borderRadius: '50%',
    color: '#6B5344',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: '24px',
    flex: 1,
    overflowY: 'auto',
  },
  formGroup: {
    marginBottom: '20px',
  },
  formLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '8px',
  },
  formHint: {
    fontSize: '13px',
    color: '#8B7355',
    marginBottom: '12px',
  },
  formInput: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'white',
    border: '1.5px solid rgba(139, 111, 92, 0.2)',
    borderRadius: '12px',
    fontSize: '15px',
    color: '#3D2B1F',
    outline: 'none',
    fontFamily: '"Lora", serif',
    boxSizing: 'border-box',
  },
  connectionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '250px',
    overflowY: 'auto',
  },
  connectionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px',
    backgroundColor: 'white',
    border: '1.5px solid rgba(139, 111, 92, 0.15)',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  connectionItemSelected: {
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    borderColor: '#8B6F5C',
  },
  connectionCheckbox: {
    width: '22px',
    height: '22px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    border: '1.5px solid rgba(139, 111, 92, 0.3)',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmark: {
    color: '#8B6F5C',
    fontWeight: '600',
    fontSize: '14px',
  },
  connectionDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  connectionName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  connectionCareer: {
    fontSize: '13px',
    color: '#6B5344',
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid rgba(139, 111, 92, 0.1)',
  },
  cancelButton: {
    flex: 1,
    padding: '14px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    border: 'none',
    borderRadius: '12px',
    color: '#6B5344',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
  },
  submitButton: {
    flex: 1,
    padding: '14px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"Lora", serif',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(139, 111, 92, 0.3)',
    cursor: 'not-allowed',
  },
  // Chat Modal
  chatModal: {
    backgroundColor: '#FDF8F3',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '700px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 48px rgba(61, 43, 31, 0.2)',
    overflow: 'hidden',
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(139, 111, 92, 0.1)',
  },
  chatTitle: {
    fontFamily: '"Lora", serif',
    fontSize: '18px',
    fontWeight: '600',
    color: '#3D2B1F',
    margin: 0,
  },
  chatSubtitle: {
    fontSize: '13px',
    color: '#8B7355',
    margin: 0,
  },
  chatMessages: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
    minHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  chatEmpty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatEmptyIcon: {
    fontSize: '40px',
    marginBottom: '12px',
    opacity: 0.5,
  },
  chatEmptyText: {
    fontSize: '15px',
    color: '#6B5344',
    marginBottom: '4px',
  },
  chatEmptyHint: {
    fontSize: '13px',
    color: '#8B7355',
  },
  messageWrapper: {
    display: 'flex',
    width: '100%',
  },
  messageBubble: {
    maxWidth: '70%',
    padding: '12px 16px',
    borderRadius: '16px',
  },
  messageBubbleOwn: {
    backgroundColor: '#8B6F5C',
    color: 'white',
    borderBottomRightRadius: '4px',
  },
  messageBubbleOther: {
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    color: '#3D2B1F',
    borderBottomLeftRadius: '4px',
  },
  msgSender: {
    fontSize: '11px',
    fontWeight: '600',
    marginBottom: '4px',
    opacity: 0.8,
    margin: 0,
  },
  messageText: {
    fontSize: '14px',
    lineHeight: '1.5',
    wordBreak: 'break-word',
    margin: 0,
  },
  messageFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px',
  },
  msgTime: {
    fontSize: '10px',
    opacity: 0.7,
  },
  messageDelete: {
    fontSize: '10px',
    opacity: 0.7,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'inherit',
    textDecoration: 'underline',
    fontFamily: '"Lora", serif',
  },
  chatInputBar: {
    display: 'flex',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid rgba(139, 111, 92, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  chatInput: {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: 'white',
    border: '1.5px solid rgba(139, 111, 92, 0.15)',
    borderRadius: '12px',
    fontSize: '14px',
    color: '#3D2B1F',
    outline: 'none',
    fontFamily: '"Lora", serif',
  },
  chatSendButton: {
    width: '44px',
    height: '44px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendButtonDisabled: {
    backgroundColor: 'rgba(139, 111, 92, 0.3)',
    cursor: 'not-allowed',
  },
};

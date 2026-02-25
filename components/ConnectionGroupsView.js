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
import { parseLocalDate } from '../lib/dateUtils';
import { MapPin, Users, UserPlus, Check, ChevronRight, MessageCircle, Coffee } from 'lucide-react';

export default function ConnectionGroupsView({ currentUser, supabase, connections: connectionsProp = [], onNavigate }) {
  const [connectionGroups, setConnectionGroups] = useState([]);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const [groupInvites, setGroupInvites] = useState([]);
  const [eligibleConnections, setEligibleConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedConnections, setSelectedConnections] = useState([]);

  // Use connections from props, add online status
  const [connections, setConnections] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Connect with People
  const [peerSuggestions, setPeerSuggestions] = useState([]);
  const [sentRequests, setSentRequests] = useState(new Set());
  const [sentRequestProfiles, setSentRequestProfiles] = useState([]);

  // Update connections when prop changes
  useEffect(() => {
    if (connectionsProp && connectionsProp.length > 0) {
      const connectionsWithStatus = connectionsProp.map(conn => {
        // MainApp.js structure: { id, connected_user: { id, name, career, city, state, bio, last_active }, matched_at }
        const user = conn.connected_user || conn;
        const userIsActive = isUserActive(user.last_active, 10); // Active in last 10 minutes

        return {
          id: conn.id || user.id,
          name: user.name || 'Unknown',
          avatar: user.profile_picture,
          career: user.career || '',
          city: user.city,
          state: user.state,
          last_active: user.last_active,
          status: userIsActive ? 'online' : 'away'
        };
      });
      setConnections(connectionsWithStatus);
    }
  }, [connectionsProp]);

  useEffect(() => {
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

    return () => {
      supabase.removeChannel(invitesChannel);
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

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadConnectionGroups(),
      loadGroupInvites(),
      loadPeerSuggestions(),
      loadSentRequests()
    ]);
    setLoading(false);
  };

  const loadPeerSuggestions = async () => {
    try {
      // Parallel: fetch profiles, my matches, and my interests at the same time
      const connectedIds = new Set((connectionsProp || []).map(c => (c.connected_user || c).id));

      const [profilesResult, mutualResult, interestsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, career, city, state, hook, industry, career_stage, profile_picture')
          .neq('id', currentUser.id)
          .not('name', 'is', null)
          .limit(50),
        supabase
          .rpc('get_mutual_matches', { for_user_id: currentUser.id }),
        supabase
          .from('user_interests')
          .select('interested_in_user_id')
          .eq('user_id', currentUser.id),
      ]);

      if (profilesResult.error) {
        setPeerSuggestions([]);
        return;
      }

      const myMatchIds = new Set((mutualResult.data || []).map(m => m.matched_user_id));
      const myInterestIds = new Set((interestsResult.data || []).map(i => i.interested_in_user_id));

      const suggestions = (profilesResult.data || []).filter(u =>
        !connectedIds.has(u.id) && !myMatchIds.has(u.id) && !myInterestIds.has(u.id)
      );

      // Only enrich the final 4 we'll actually show
      const finalSuggestions = suggestions.slice(0, 4);
      const finalIds = finalSuggestions.map(s => s.id);

      if (finalIds.length === 0) {
        setPeerSuggestions([]);
        return;
      }

      // Parallel: fetch shared circles and mutual connections for the 4 suggestions
      const [myCirclesResult, ...matchResults] = await Promise.all([
        supabase
          .from('connection_group_members')
          .select('group_id')
          .eq('user_id', currentUser.id)
          .eq('status', 'accepted'),
        // Batch all RPC calls in parallel instead of sequential loop
        ...finalIds.map(personId =>
          supabase.rpc('get_mutual_matches', { for_user_id: personId })
        ),
      ]);

      // Build mutual connections map from parallel results
      const userMutualConnections = {};
      finalIds.forEach((personId, i) => {
        let count = 0;
        (matchResults[i].data || []).forEach(m => {
          if (myMatchIds.has(m.matched_user_id)) count++;
        });
        userMutualConnections[personId] = count;
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

      setPeerSuggestions(enriched);
    } catch (error) {
      console.error('Error loading peer suggestions:', error);
      setPeerSuggestions([]);
    }
  };

  const loadSentRequests = async () => {
    try {
      const connectedIds = new Set((connectionsProp || []).map(c => (c.connected_user || c).id));

      const [interestsResult, mutualResult] = await Promise.all([
        supabase
          .from('user_interests')
          .select('interested_in_user_id, created_at')
          .eq('user_id', currentUser.id),
        supabase
          .rpc('get_mutual_matches', { for_user_id: currentUser.id }),
      ]);

      if (interestsResult.error) {
        setSentRequestProfiles([]);
        return;
      }

      const mutualIds = new Set((mutualResult.data || []).map(m => m.matched_user_id));

      // Pending = I sent interest but they haven't matched back, and not already connected
      const pendingInterests = (interestsResult.data || []).filter(i =>
        !mutualIds.has(i.interested_in_user_id) && !connectedIds.has(i.interested_in_user_id)
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

  const loadConnectionGroups = async () => {
    try {
      const groups = await getMyConnectionGroups();
      setConnectionGroups(groups);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadGroupInvites = async () => {
    try {
      const invites = await getPendingGroupInvites();
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
      alert('Please enter a group name');
      return;
    }

    if (selectedConnections.length < 2 || selectedConnections.length > 9) {
      alert('Please select 2-9 people to invite');
      return;
    }

    try {
      await createConnectionGroup({
        name: groupName.trim(),
        invitedUserIds: selectedConnections
      });

      alert(`Group "${groupName}" created! Invitations sent.`);
      setShowCreateModal(false);
      setGroupName('');
      setSelectedConnections([]);
      await loadConnectionGroups();
    } catch (error) {
      alert('Error creating group: ' + error.message);
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

      const { channelName } = await createConnectionGroupRoom(groupId);
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
    <div style={styles.container} className="circles-container">

      {/* Title Section */}
      <section style={styles.titleSection} className="circles-title-section">
        <div style={styles.titleContent}>
          <h1 style={styles.pageTitle} className="circles-page-title">Circles</h1>
          <p style={styles.tagline}>Where meaningful connections grow deeper</p>
        </div>
      </section>

      {/* Pending Invitations Alert */}
      {groupInvites.length > 0 && (
        <div style={styles.inviteAlert} className="circles-invite-alert">
          <div style={styles.inviteAlertContent}>
            <span style={styles.inviteAlertIcon}>✨</span>
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


      {/* Single Column Layout */}
      <div style={styles.singleColumn}>

        {/* Connections Section */}
        <section style={styles.section} className="circles-card">
          <div style={styles.cardHeader} className="circles-card-header">
            <h2 style={styles.cardTitle} className="circles-card-title">
              Connections
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={styles.onlineBadge}>
                <span style={styles.pulsingDot}></span>
                {onlineCount} online
              </span>
              <button
                onClick={() => onNavigate?.('allPeople')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: '#8B6F5C',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}>
                See all <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Existing connections - slide bar */}
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
                    style={styles.slideActionBtn}
                    className="slide-action-btn"
                    onClick={() => onNavigate?.('messages', { chatId: user.id, chatType: 'user' })}
                    title="Message"
                  >
                    <MessageCircle size={13} />
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

            {/* Add Connection Button */}
            <div
              style={styles.addConnectionCard}
              className="circles-add-card"
              onClick={() => onNavigate && onNavigate('discover')}
            >
              <div style={styles.addConnectionIcon} className="circles-add-icon">+</div>
              <span style={styles.addConnectionText}>Add</span>
            </div>
          </div>

          {/* Pending Requests */}
          {sentRequestProfiles.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h2 style={styles.cardTitle}>
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
                    {/* Avatar */}
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#8B6F5C',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        color: 'white',
                        fontWeight: '600',
                        flexShrink: 0,
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                      onClick={() => onNavigate?.('userProfile', { userId: person.id })}
                    >
                      {person.profile_picture ? (
                        <img
                          src={person.profile_picture}
                          alt={person.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        (person.name?.[0] || '?').toUpperCase()
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#3E2723',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {person.name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#8B7355',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {person.career || 'Professional'}
                      </div>
                    </div>

                    {/* Time ago */}
                    <span style={{
                      fontSize: '11px',
                      color: '#A89080',
                      flexShrink: 0,
                    }}>
                      {formatTimeAgo(person.requested_at)}
                    </span>

                    {/* Withdraw button */}
                    <button
                      onClick={() => handleWithdrawRequest(person.id)}
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#8B6F5C',
                        backgroundColor: 'transparent',
                        border: '1.5px solid rgba(139, 111, 92, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Withdraw
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* People you may know */}
          {peerSuggestions.length > 0 && (
            <>
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h2 style={styles.cardTitle}>
                    Recommend to Connect
                  </h2>
                  <span style={{ fontSize: '12px', color: '#A89080' }}>
                    From events & circles
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '12px',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                  WebkitOverflowScrolling: 'touch',
                }}>
                  {peerSuggestions.map((person) => (
                    <div
                      key={person.id}
                      style={{
                        minWidth: '220px',
                        background: 'linear-gradient(160deg, #3E2C1E 0%, #5C4033 50%, #7A5C42 100%)',
                        borderRadius: '16px',
                        padding: '16px',
                        boxShadow: '0 4px 16px rgba(139, 94, 60, 0.2)',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          backgroundColor: '#8B6F5C',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '22px',
                          flexShrink: 0,
                          color: 'white',
                          fontWeight: '600',
                        }}>
                          {person.profile_picture ? (
                            <img
                              src={person.profile_picture}
                              alt={person.name}
                              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            (person.name?.[0] || '?').toUpperCase()
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#FFF8F0',
                            margin: '0 0 2px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {person.name}
                          </h4>
                          <p style={{
                            fontSize: '12px',
                            color: '#E8D5C0',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {person.career || 'Professional'}
                          </p>
                        </div>
                      </div>

                      {/* Hook / Ask me about */}
                      {person.hook && (
                        <p style={{
                          fontSize: '12px',
                          color: '#F5E6D5',
                          margin: '10px 0 0',
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

                      {/* Mutual + Location row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255,248,240,0.12)',
                        fontSize: '10px',
                        color: '#E8D5C0',
                      }}>
                        {(person.mutualConnections > 0 || person.mutualCircles > 0) && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#A8E6CF' }}>
                            <Users size={10} />
                            {person.mutualConnections || 0} mutual
                          </span>
                        )}
                        {person.city && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <MapPin size={10} style={{ opacity: 0.7 }} />
                            {person.city}{person.state ? `, ${person.state}` : ''}
                          </span>
                        )}
                      </div>

                      {/* Connect button */}
                      {sentRequests.has(person.id) ? (
                        <div style={{
                          width: '100%',
                          marginTop: '10px',
                          padding: '7px',
                          backgroundColor: 'rgba(168,230,207,0.2)',
                          color: '#A8E6CF',
                          border: '1.5px solid rgba(168,230,207,0.4)',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxSizing: 'border-box',
                        }}>
                          <Check size={13} />
                          Requested
                        </div>
                      ) : (
                        <button
                          onClick={() => handleConnect(person.id)}
                          style={{
                            width: '100%',
                            marginTop: '10px',
                            padding: '7px',
                            backgroundColor: 'rgba(255,248,240,0.18)',
                            color: '#FFF8F0',
                            border: '1.5px solid rgba(255,248,240,0.3)',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxSizing: 'border-box',
                          }}
                        >
                          <UserPlus size={13} />
                          Connect
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* My Circles Section */}
        <section style={styles.section} className="circles-card">
          <div style={styles.cardHeader} className="circles-card-header">
            <h2 style={styles.cardTitle} className="circles-card-title">
              My Circles
            </h2>
            <button style={styles.addGroupBtn} onClick={() => onNavigate && onNavigate('discover')}>Discover Circles</button>
          </div>

          <div style={styles.circlesList}>
            {connectionGroups.length === 0 ? (
              <div
                style={styles.emptyCardActionable}
                onClick={handleCreateClick}
              >
                <span style={{ fontSize: '32px', marginBottom: '8px' }}>🌱</span>
                <p style={styles.emptyText}>No groups yet</p>
                <p style={styles.emptyHint}>Schedule your first meetup or start a conversation</p>
                <button style={styles.emptyStateButton} onClick={handleCreateClick}>
                  Get Started
                </button>
              </div>
            ) : (
              enrichedGroups.map(({ group, acceptedMembers, activeMembers, activeNames, theme, hasUpcoming, sessionCount, daysUntilMeetup, hasNoActivity }, index) => {
                return (
                  <div
                    key={group.id}
                    className="circles-circle-card"
                    style={{
                      ...styles.circleCard,
                      animationDelay: `${index * 0.12}s`,
                      ...(hasNoActivity ? { border: '1.5px dashed rgba(139, 111, 92, 0.25)' } : {}),
                    }}
                  >
                    {/* Main layout: horizontal on desktop, vertical on mobile */}
                    <div className="circle-card-layout" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>

                      {/* Left: Icon */}
                      <div style={{
                        ...styles.circleEmoji,
                        background: `linear-gradient(135deg, ${theme.color}22, ${theme.color}44)`,
                        position: 'relative',
                      }} className="circles-circle-emoji">
                        {theme.emoji}
                        {sessionCount > 0 && (
                          <div className="sparkline-container" style={{
                            position: 'absolute',
                            bottom: '-4px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            gap: '2px',
                            alignItems: 'flex-end',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255,255,255,0.6)',
                          }}>
                            {[0.35, 0.6, 1, 0.5, 0.75].map((h, i) => (
                              <div key={i} className="sparkline-bar" style={{
                                width: '3px',
                                height: `${h * 10}px`,
                                borderRadius: '1.5px',
                                backgroundColor: `${theme.color}55`,
                                transition: 'background-color 0.3s ease, height 0.3s ease',
                                '--bar-warm': theme.color,
                              }} />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Center: Name + Members + Context */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={styles.circleName}>{group.name}</h3>
                          {sessionCount > 0 && (
                            <span style={{ fontSize: '10px', color: '#A89080', flexShrink: 0 }}>
                              {sessionCount} past session{sessionCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Members row: avatars + count + online */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          {acceptedMembers.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {acceptedMembers.slice(0, 4).map((member, idx) => (
                                <div key={member.id} style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: member.user?.profile_picture
                                    ? 'none'
                                    : `linear-gradient(135deg, ${['#9C8068', '#C9A96E', '#8B9E7E', '#A67B5B'][idx % 4]}, #7A5C42)`,
                                  border: '1.5px solid rgba(255,255,255,0.9)',
                                  marginLeft: idx > 0 ? '-5px' : 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '8px',
                                  fontWeight: '600',
                                  color: 'white',
                                  overflow: 'hidden',
                                  flexShrink: 0,
                                }}>
                                  {member.user?.profile_picture ? (
                                    <img src={member.user.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    (member.user?.name?.[0] || '?').toUpperCase()
                                  )}
                                </div>
                              ))}
                              {acceptedMembers.length > 4 && (
                                <div style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  backgroundColor: 'rgba(189, 173, 162, 0.5)',
                                  border: '1.5px solid rgba(255,255,255,0.9)',
                                  marginLeft: '-5px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '7px',
                                  fontWeight: '600',
                                  color: '#605045',
                                }}>
                                  +{acceptedMembers.length - 4}
                                </div>
                              )}
                            </div>
                          )}
                          <span style={{ fontSize: '11px', color: '#6B5344' }}>
                            {acceptedMembers.length} member{acceptedMembers.length !== 1 ? 's' : ''}
                          </span>
                          {activeNames.length > 0 && (
                            <span style={styles.activeCount}>
                              <span style={styles.activeDot}></span>
                              {activeNames.length <= 2
                                ? activeNames.join(' & ') + (activeNames.length === 1 ? ' is' : ' are') + ' online'
                                : `${activeNames[0]} + ${activeNames.length - 1} online`
                              }
                            </span>
                          )}
                        </div>

                        {/* Context line: meetup / last topic / empty hint */}
                        {hasUpcoming && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '6px',
                            fontSize: '11px',
                            color: '#6B5344',
                          }}>
                            <span>📅</span>
                            <span style={{ fontWeight: '600' }}>
                              {parseLocalDate(group.nextMeetup.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              {group.nextMeetup.time && ` · ${group.nextMeetup.time}`}
                            </span>
                            {daysUntilMeetup !== null && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                color: daysUntilMeetup === 0 ? '#4CAF50' : theme.color,
                                backgroundColor: daysUntilMeetup === 0 ? '#4CAF5015' : `${theme.color}12`,
                                padding: '2px 6px',
                                borderRadius: '6px',
                              }}>
                                {daysUntilMeetup === 0 ? 'Today' : daysUntilMeetup === 1 ? 'Tomorrow' : `in ${daysUntilMeetup} days`}
                              </span>
                            )}
                          </div>
                        )}
                        {group.lastTopic && !hasNoActivity && !hasUpcoming && (
                          <div style={{
                            marginTop: '4px',
                            fontSize: '11px',
                            color: '#8B7355',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            Last discussed: {group.lastTopic}
                          </div>
                        )}
                        {hasNoActivity && (
                          <div style={{ marginTop: '4px', fontSize: '11px', color: '#A89080', fontStyle: 'italic' }}>
                            Schedule a meetup or start a conversation
                          </div>
                        )}
                      </div>

                      {/* Right: Action buttons */}
                      <div className="circle-card-actions" style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          style={{
                            ...styles.enterBtn,
                            padding: '8px 14px',
                            fontSize: '12px',
                          }}
                          onClick={() => onNavigate?.('messages', { chatId: group.id, chatType: 'circle' })}
                        >
                          Message
                        </button>
                        <button
                          style={{
                            ...styles.enterBtn,
                            padding: '8px 14px',
                            fontSize: '12px',
                            backgroundColor: hasUpcoming ? `${theme.color}12` : hasNoActivity ? '#8B6F5C' : `${theme.color}08`,
                            color: hasNoActivity ? 'white' : '#6B5344',
                            borderColor: hasNoActivity ? '#8B6F5C' : 'rgba(139, 111, 92, 0.3)',
                          }}
                          className="circles-enter-btn"
                          onClick={() => onNavigate?.('circleDetail', { circleId: group.id })}
                        >
                          {hasUpcoming ? 'Open' : hasNoActivity ? 'Get Started' : 'Enter'}
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>


      </div>


      {/* Create Group Modal */}
      {showCreateModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal} className="circles-modal">
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Create Connection Group</h2>
              <button
                style={styles.modalClose}
                onClick={() => {
                  setShowCreateModal(false);
                  setGroupName('');
                  setSelectedConnections([]);
                }}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Group Name</label>
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
                Create Group
              </button>
            </div>
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
                  <span style={styles.chatEmptyIcon}>💬</span>
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
    borderBottom: '1px solid rgba(139, 111, 92, 0.1)',
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
    background: 'linear-gradient(89.8deg, #7E654D 27.14%, #B9A594 72.64%, #ECDDD2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
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
    padding: '16px 12px',
    minWidth: '90px',
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
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(139, 111, 92, 0.15)',
  },
  slideAvatarPlaceholder: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    border: '2px solid rgba(139, 111, 92, 0.15)',
  },
  slideStatusIndicator: {
    position: 'absolute',
    bottom: '2px',
    right: '2px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: '2px solid white',
  },
  slideName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#3D2B1F',
    textAlign: 'center',
    maxWidth: '80px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slideRole: {
    fontSize: '11px',
    color: '#8B7355',
    textAlign: 'center',
    maxWidth: '80px',
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
    backgroundColor: 'rgba(139, 111, 92, 0.06)',
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
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, rgba(139, 111, 92, 0.15), rgba(139, 111, 92, 0.25))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    flexShrink: 0,
  },
  circleInfo: {
    flex: 1,
    minWidth: 0,
  },
  circleName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '2px',
    margin: 0,
  },
  circleDesc: {
    fontSize: '12px',
    color: '#8B7355',
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

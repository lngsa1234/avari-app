// components/ConnectionGroupsView.js
// Circles page - Connected users, recent communications, and active groups
// UX design based on mycircles.jsx

'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function ConnectionGroupsView({ currentUser, supabase, connections: connectionsProp = [], onNavigate }) {
  const [activeTab, setActiveTab] = useState('all');
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
  const [recentMessages, setRecentMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

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
      loadRecentMessages()
    ]);
    setLoading(false);
  };

  const loadRecentMessages = async () => {
    try {
      // Load recent direct messages from 'messages' table
      const { data: directMessages, error: dmError } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id, receiver_id, read')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (dmError) {
        console.error('Error loading direct messages:', dmError);
      }

      // Get unique conversations (latest message per conversation)
      const conversationMap = new Map();
      const otherUserIds = new Set();

      (directMessages || []).forEach(msg => {
        const otherUserId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        otherUserIds.add(otherUserId);

        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            id: msg.id,
            oderId: otherUserId,
            message: msg.content,
            time: formatTimeAgo(msg.created_at),
            unread: msg.receiver_id === currentUser.id && !msg.read,
            isGroup: false
          });
        }
      });

      // Fetch profiles for other users
      if (otherUserIds.size > 0) {
        const userIdArray = Array.from(otherUserIds);
        let profiles = [];

        // Fetch profiles one by one to avoid .in() filter issues
        for (const userId of userIdArray) {
          try {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('id, name, profile_picture')
              .eq('id', userId)
              .maybeSingle();

            if (error) {
              console.error('Error fetching profile for', userId, error);
            } else if (profile) {
              profiles.push(profile);
            }
          } catch (err) {
            console.error('Exception fetching profile:', err);
          }
        }

        const profileMap = new Map(profiles.map(p => [p.id, p]));

        // Update conversations with profile info
        conversationMap.forEach((conv, otherUserId) => {
          const profile = profileMap.get(otherUserId);
          conv.from = profile?.name || 'Unknown';
          conv.avatar = profile?.profile_picture || null;
        });
      }

      // Load recent group messages (simplified query)
      const { data: groupMsgs, error: gmError } = await supabase
        .from('connection_group_messages')
        .select('id, group_id, user_id, message, created_at')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (gmError) {
        console.error('Error loading group messages:', gmError);
      }

      // Get unique group conversations
      const groupMap = new Map();
      const groupIds = new Set();
      const userIdsFromGroups = new Set();

      (groupMsgs || []).forEach(msg => {
        groupIds.add(msg.group_id);
        userIdsFromGroups.add(msg.user_id);
      });

      // Fetch group names
      let groupNameMap = new Map();
      if (groupIds.size > 0) {
        for (const groupId of Array.from(groupIds)) {
          try {
            const { data: group, error } = await supabase
              .from('connection_groups')
              .select('id, name')
              .eq('id', groupId)
              .maybeSingle();
            if (!error && group) groupNameMap.set(group.id, group.name);
          } catch (err) {
            console.error('Error fetching group:', err);
          }
        }
      }

      // Fetch user names for group messages
      let userNameMap = new Map();
      if (userIdsFromGroups.size > 0) {
        for (const userId of Array.from(userIdsFromGroups)) {
          try {
            const { data: user, error } = await supabase
              .from('profiles')
              .select('id, name')
              .eq('id', userId)
              .maybeSingle();
            if (!error && user) userNameMap.set(user.id, user.name);
          } catch (err) {
            console.error('Error fetching user:', err);
          }
        }
      }

      (groupMsgs || []).forEach(msg => {
        if (!groupMap.has(msg.group_id)) {
          groupMap.set(msg.group_id, {
            id: `group-${msg.group_id}`,
            from: groupNameMap.get(msg.group_id) || 'Unknown Group',
            avatar: null,
            message: `${userNameMap.get(msg.user_id) || 'Someone'}: ${msg.message}`,
            time: formatTimeAgo(msg.created_at),
            unread: false,
            isGroup: true,
            groupId: msg.group_id
          });
        }
      });

      // Combine and sort by recency
      const allMessages = [
        ...Array.from(conversationMap.values()),
        ...Array.from(groupMap.values())
      ].slice(0, 10);

      setRecentMessages(allMessages);
    } catch (error) {
      console.error('Error loading recent messages:', error);
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
      window.location.href = `/connection-group-call/${channelName}`;
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

  const handleMessageClick = (msg) => {
    if (msg.isGroup && msg.groupId) {
      const group = connectionGroups.find(g => g.id === msg.groupId);
      if (group) handleOpenGroupChat(group);
    } else if (onNavigate) {
      onNavigate('messages');
    }
  };

  const onlineCount = connections.filter(c => c.status === 'online').length;

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
      <div style={styles.ambientBg}></div>
      <div style={styles.grainOverlay}></div>

      {/* Title Section */}
      <section style={styles.titleSection} className="circles-title-section">
        <div style={styles.titleContent}>
          <h1 style={styles.pageTitle} className="circles-page-title">Circles</h1>
          <p style={styles.tagline}>Your community, your connections</p>
        </div>
        <div style={styles.quickStats} className="circles-quick-stats">
          <div style={styles.statItem}>
            <span style={styles.statNumber} className="circles-stat-number">{connections.length}</span>
            <span style={styles.statLabel} className="circles-stat-label">Connections</span>
          </div>
          <div style={styles.statDivider}></div>
          <div style={styles.statItem}>
            <span style={styles.statNumber} className="circles-stat-number">{connectionGroups.length}</span>
            <span style={styles.statLabel} className="circles-stat-label">Groups</span>
          </div>
          <div style={styles.statDivider}></div>
          <div style={styles.statItem}>
            <span style={styles.statNumber} className="circles-stat-number">{onlineCount}</span>
            <span style={styles.statLabel} className="circles-stat-label">Online</span>
          </div>
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

        {/* Connections Section - Horizontal Slide Bar */}
        <section style={styles.card} className="circles-card">
          <div style={styles.cardHeader} className="circles-card-header">
            <h2 style={styles.cardTitle} className="circles-card-title">
              Connections
            </h2>
            <span style={styles.onlineBadge}>
              <span style={styles.pulsingDot}></span>
              {onlineCount} online
            </span>
          </div>

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
                <div style={styles.slideAvatarContainer}>
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

        </section>

        {/* Recent Conversations Section */}
        <section style={styles.card} className="circles-card">
          <div style={styles.cardHeader} className="circles-card-header">
            <h2 style={styles.cardTitle} className="circles-card-title">
              Recent Conversations
            </h2>
            <div style={styles.tabGroup}>
              {['all', 'direct', 'groups'].map(tab => (
                <button
                  key={tab}
                  style={{
                    ...styles.tab,
                    ...(activeTab === tab ? styles.tabActive : {})
                  }}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.messageList}>
            {recentMessages.length === 0 ? (
              <div style={styles.emptyCard}>
                <span style={styles.emptyIcon}>💬</span>
                <p style={styles.emptyText}>No conversations yet</p>
                <p style={styles.emptyHint}>Start chatting with connections</p>
              </div>
            ) : (
              recentMessages
                .filter(msg => {
                  if (activeTab === 'all') return true;
                  if (activeTab === 'direct') return !msg.isGroup;
                  return msg.isGroup;
                })
                .map((msg, index) => (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageItem,
                    ...(msg.unread ? styles.messageUnread : {}),
                    animationDelay: `${index * 0.08}s`
                  }}
                  className="circles-message-item"
                  onClick={() => handleMessageClick(msg)}
                >
                  <div style={styles.messageAvatar}>
                    {msg.avatar ? (
                      <img src={msg.avatar} alt={msg.from} style={styles.msgAvatarImg} />
                    ) : (
                      <span style={styles.msgAvatarEmoji}>{msg.isGroup ? '👥' : '👤'}</span>
                    )}
                    {msg.isGroup && <span style={styles.groupIndicator}>●●●</span>}
                  </div>
                  <div style={styles.messageContent}>
                    <div style={styles.messageHeader}>
                      <span style={styles.messageSender}>{msg.from}</span>
                      <span style={styles.messageTime}>{msg.time}</span>
                    </div>
                    <p style={styles.messagePreview}>{msg.message}</p>
                  </div>
                  {msg.unread && <span style={styles.unreadDot}></span>}
                </div>
              ))
            )}
          </div>

          <div style={styles.composeBar}>
            <input
              type="text"
              placeholder="Start a new conversation..."
              style={styles.composeInput}
              onFocus={() => onNavigate && onNavigate('messages')}
            />
            <button style={styles.composeBtn}>✦</button>
          </div>
        </section>

        {/* My Groups Section */}
        <section style={styles.card} className="circles-card">
          <div style={styles.cardHeader} className="circles-card-header">
            <h2 style={styles.cardTitle} className="circles-card-title">
              My Groups
            </h2>
            <button style={styles.addGroupBtn} onClick={handleCreateClick}>+ Join</button>
          </div>

          <div style={styles.circlesList}>
            {connectionGroups.length === 0 ? (
              <div style={styles.emptyCard}>
                <span style={styles.emptyIcon}>🎯</span>
                <p style={styles.emptyText}>No groups yet</p>
                <p style={styles.emptyHint}>Create a group with connections</p>
                <button style={styles.emptyStateButton} onClick={handleCreateClick}>
                  Create Your First Group
                </button>
              </div>
            ) : (
              connectionGroups.map((group, index) => {
                const acceptedMembers = group.members?.filter(m => m.status === 'accepted') || [];
                // Count members who were active in the last 10 minutes
                const activeCount = acceptedMembers.filter(m =>
                  isUserActive(m.user?.last_active, 10)
                ).length;

                const themes = [
                  { emoji: '💼', color: '#8B6F5C', desc: 'Professional network' },
                  { emoji: '🚀', color: '#A67B5B', desc: 'Founders & dreamers' },
                  { emoji: '💪', color: '#6B4423', desc: 'Support & growth' },
                  { emoji: '🔄', color: '#D4A574', desc: 'Career transitions' },
                  { emoji: '🏙️', color: '#C4956A', desc: 'Local connections' },
                ];
                const theme = themes[index % themes.length];

                return (
                  <div
                    key={group.id}
                    style={{
                      ...styles.circleCard,
                      animationDelay: `${index * 0.12}s`
                    }}
                    className="circles-circle-card"
                  >
                    <div style={{
                      ...styles.circleEmoji,
                      background: `linear-gradient(135deg, ${theme.color}22, ${theme.color}44)`
                    }} className="circles-circle-emoji">
                      {theme.emoji}
                    </div>
                    <div style={styles.circleInfo}>
                      <h3 style={styles.circleName}>{group.name}</h3>
                      <p style={styles.circleDesc}>{theme.desc}</p>
                      <div style={styles.circleMeta}>
                        <span style={styles.memberCount}>
                          👥 {acceptedMembers.length} members
                        </span>
                        {activeCount > 0 && (
                          <span style={styles.activeCount}>
                            <span style={styles.activeDot}></span>
                            {activeCount} active
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      style={styles.enterBtn}
                      className="circles-enter-btn"
                      onClick={() => handleOpenGroupChat(group)}
                    >
                      Enter
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <button style={styles.exploreBtn} onClick={() => onNavigate && onNavigate('discover')}>
            <span style={styles.exploreBtnIcon}>🔍</span>
            Explore More Circles
          </button>
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
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

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

  /* Responsive styles */
  @media (max-width: 640px) {
    .circles-container {
      padding: 16px !important;
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
    .circles-circle-card {
      flex-wrap: wrap !important;
      gap: 10px !important;
    }
    .circles-enter-btn {
      width: 100% !important;
      text-align: center !important;
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
    minHeight: '100vh',
    background: 'linear-gradient(165deg, #FDF8F3 0%, #F5EDE6 50%, #EDE4DB 100%)',
    fontFamily: '"DM Sans", sans-serif',
    position: 'relative',
    padding: '24px',
  },
  ambientBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      radial-gradient(ellipse at 20% 20%, rgba(139, 111, 92, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(166, 123, 91, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(212, 165, 116, 0.04) 0%, transparent 70%)
    `,
    pointerEvents: 'none',
    zIndex: 0,
  },
  grainOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
    opacity: 0.03,
    pointerEvents: 'none',
    zIndex: 0,
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
    fontFamily: '"Playfair Display", serif',
    fontSize: '36px',
    fontWeight: '600',
    color: '#3D2B1F',
    letterSpacing: '-1px',
    marginBottom: '4px',
    margin: 0,
  },
  tagline: {
    fontSize: '15px',
    color: '#8B7355',
    fontWeight: '400',
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
    fontFamily: '"Playfair Display", serif',
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
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '24px',
    padding: '20px',
    boxShadow: '0 4px 24px rgba(139, 111, 92, 0.08)',
    border: '1px solid rgba(139, 111, 92, 0.08)',
    backdropFilter: 'blur(10px)',
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
    fontFamily: '"Playfair Display", serif',
    fontSize: '18px',
    fontWeight: '600',
    color: '#3D2B1F',
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
    backgroundColor: 'rgba(139, 111, 92, 0.04)',
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
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.3s ease',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'rgba(139, 111, 92, 0.04)',
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
    fontFamily: '"DM Sans", sans-serif',
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
    fontFamily: '"DM Sans", sans-serif',
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
    fontFamily: '"DM Sans", sans-serif',
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
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    border: 'none',
    borderRadius: '100px',
    color: '#6B5344',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"DM Sans", sans-serif',
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
    fontFamily: '"DM Sans", sans-serif',
  },
  circleCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'rgba(139, 111, 92, 0.04)',
    borderRadius: '14px',
    transition: 'all 0.3s ease',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
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
    fontFamily: '"DM Sans", sans-serif',
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
    fontFamily: '"DM Sans", sans-serif',
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
    fontFamily: '"Playfair Display", serif',
    fontSize: '40px',
    color: 'rgba(255, 255, 255, 0.3)',
    lineHeight: 1,
  },
  bannerQuoteEnd: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '40px',
    color: 'rgba(255, 255, 255, 0.3)',
    lineHeight: 1,
    alignSelf: 'flex-end',
  },
  bannerText: {
    fontFamily: '"Playfair Display", serif',
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
    fontFamily: '"DM Sans", sans-serif',
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
    fontFamily: '"Playfair Display", serif',
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
    fontFamily: '"DM Sans", sans-serif',
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
    fontFamily: '"DM Sans", sans-serif',
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
    fontFamily: '"DM Sans", sans-serif',
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
    fontFamily: '"Playfair Display", serif',
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
    fontFamily: '"DM Sans", sans-serif',
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
    fontFamily: '"DM Sans", sans-serif',
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

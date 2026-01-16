// components/ConnectionGroupsView.js
// Main view for connection groups (3-4 person small group video chats)

'use client';

import { useState, useEffect, useRef } from 'react';
import { Users, Video, Calendar, User, Check, X, Plus, Trash2, MessageCircle, Send } from 'lucide-react';
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

export default function ConnectionGroupsView({ currentUser, supabase }) {
  const [activeTab, setActiveTab] = useState('groups'); // groups, invitations
  const [connectionGroups, setConnectionGroups] = useState([]);

  // Group chat state
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const [groupInvites, setGroupInvites] = useState([]);
  const [eligibleConnections, setEligibleConnections] = useState([]);
  const [isEligible, setIsEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedConnections, setSelectedConnections] = useState([]);

  // Subscription for group invitations (always active)
  useEffect(() => {
    loadData();
    checkEligibility();

    console.log('🔔 Setting up invites subscription');

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
        (payload) => {
          console.log('🔔 Group membership change:', payload);
          loadGroupInvites();
          loadConnectionGroups();
        }
      )
      .subscribe((status) => {
        console.log('📡 Invites subscription status:', status);
      });

    return () => {
      console.log('🔕 Cleaning up invites subscription');
      supabase.removeChannel(invitesChannel);
    };
  }, [currentUser.id]);

  // Separate subscription for group messages (only when chat is open)
  useEffect(() => {
    if (!selectedGroup) return;

    console.log('💬 Setting up messages subscription for group:', selectedGroup.id);

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
        (payload) => {
          console.log('💬 New message received:', payload);
          // Reload messages when new message arrives
          loadGroupChatMessages(selectedGroup.id);
        }
      )
      .subscribe((status) => {
        console.log('📡 Messages subscription status:', status);
      });

    return () => {
      console.log('🔕 Cleaning up messages subscription');
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedGroup]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadConnectionGroups(),
      loadGroupInvites()
    ]);
    setLoading(false);
  };

  const checkEligibility = async () => {
    const eligible = await checkGroupEligibility();
    setIsEligible(eligible);
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
        alert('You need at least 2 mutual connections to create a group. Keep attending meetups and making connections!');
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
      if (selectedConnections.length >= 3) {
        alert('Maximum group size is 4 people (you + 3 others)');
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

    if (selectedConnections.length < 2 || selectedConnections.length > 3) {
      alert('Please select 2-3 people to invite (groups must have 3-4 people total)');
      return;
    }

    try {
      await createConnectionGroup({
        name: groupName.trim(),
        invitedUserIds: selectedConnections
      });

      alert(`✅ Group "${groupName}" created! Invitations sent.`);

      // Reset and reload
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
      alert(`✅ You joined "${groupName}"!`);
      await Promise.all([loadConnectionGroups(), loadGroupInvites()]);
      setActiveTab('groups');
    } catch (error) {
      alert('Error accepting invite: ' + error.message);
    }
  };

  const handleDeclineInvite = async (membershipId) => {
    if (!confirm('Decline this group invitation?')) return;

    try {
      await declineGroupInvite(membershipId);
      alert('Invitation declined');
      await loadGroupInvites();
    } catch (error) {
      alert('Error declining invite: ' + error.message);
    }
  };

  const handleJoinCall = async (groupId, groupName) => {
    try {
      console.log('📹 Joining video call for group:', groupId);

      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        alert('❌ Agora not configured\n\nPlease add NEXT_PUBLIC_AGORA_APP_ID to your .env.local file.');
        return;
      }

      const { channelName } = await createConnectionGroupRoom(groupId);
      console.log('✅ Video room ready:', channelName);

      window.location.href = `/connection-group-call/${channelName}`;
    } catch (error) {
      console.error('❌ Error joining call:', error);
      alert('Could not join video call: ' + error.message);
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!confirm(`Are you sure you want to delete "${groupName}"?\n\nThis will remove the group and all its members. This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteConnectionGroup(groupId);
      alert(`✅ Group "${groupName}" deleted successfully`);
      await loadConnectionGroups();
    } catch (error) {
      alert('Error deleting group: ' + error.message);
    }
  };

  const handleOpenChat = async (group) => {
    setSelectedGroup(group);
    setShowChatModal(true);
    await loadGroupChatMessages(group.id);
  };

  const loadGroupChatMessages = async (groupId) => {
    try {
      const messages = await getGroupMessages(supabase, groupId);
      setGroupMessages(messages);
      // Auto-scroll to bottom
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading connection groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
        <div className="flex items-center mb-2">
          <Users className="w-6 h-6 mr-2 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">Connection Groups</h3>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Create small groups (3-4 people) with your connections for group video chats
        </p>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            💡 Need at least 2 mutual connections to create a group
          </p>
        </div>
      </div>

      {/* Pending Invitations Badge */}
      {groupInvites.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 cursor-pointer"
             onClick={() => setActiveTab('invitations')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-rose-600" />
              <span className="font-medium text-rose-800">
                {groupInvites.length} pending invitation{groupInvites.length > 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-rose-600 text-sm">View →</span>
          </div>
        </div>
      )}

      {/* Create Group Button */}
      <button
        onClick={handleCreateClick}
        className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
      >
        <Plus className="w-5 h-5 mr-2" />
        Create New Group
      </button>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'groups'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          My Groups ({connectionGroups.length})
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'invitations'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Invitations
          {groupInvites.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {groupInvites.length}
            </span>
          )}
        </button>
      </div>

      {/* My Groups Tab */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {connectionGroups.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No groups yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Create a group to start video chatting with your connections!
              </p>
            </div>
          ) : (
            connectionGroups.map(group => {
              const acceptedMembers = group.members?.filter(m => m.status === 'accepted') || [];
              const isCreator = group.creator_id === currentUser.id;

              return (
                <div key={group.id} className="bg-white rounded-lg shadow p-5 border border-gray-200">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-800 text-lg">{group.name}</h4>
                      {isCreator && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                          Creator
                        </span>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 mt-3">
                      <p className="text-xs text-gray-600 mb-2 font-medium">
                        Members ({acceptedMembers.length}):
                      </p>
                      <div className="space-y-1">
                        {acceptedMembers.map(member => (
                          <div key={member.id} className="text-sm text-gray-700 flex items-center">
                            <User className="w-3 h-3 mr-2 text-purple-600" />
                            {member.user?.name || 'Unknown'} {member.user?.id === currentUser.id && '(You)'}
                            {member.user?.career && (
                              <span className="text-xs text-gray-500 ml-1">• {member.user.career}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => handleOpenChat(group)}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Group Chat
                    </button>

                    <button
                      onClick={() => handleJoinCall(group.id, group.name)}
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Join Video Call
                    </button>

                    {isCreator && (
                      <button
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 rounded-lg transition-colors border border-red-200 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Group
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          {groupInvites.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No pending invitations</p>
            </div>
          ) : (
            groupInvites.map(invite => {
              const group = invite.group;
              const creator = group?.creator;

              return (
                <div key={invite.id} className="bg-white rounded-lg shadow p-5 border-2 border-purple-200">
                  <div className="mb-4">
                    <div className="flex items-center mb-2">
                      <div className="bg-purple-100 rounded-full p-2 mr-3">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{group?.name}</h4>
                        <p className="text-sm text-gray-600">
                          Invited by {creator?.name || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-3 mt-3">
                      <p className="text-xs text-gray-600">
                        You've been invited to join this connection group for group video chats
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptInvite(invite.id, group.name)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineInvite(invite.id)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Decline
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Create Connection Group</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setGroupName('');
                  setSelectedConnections([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Group Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Product Managers SF"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
                  maxLength={100}
                />
              </div>

              {/* Select Connections */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select 2-3 Connections *
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  {selectedConnections.length}/3 selected • Groups have 3-4 people total
                </p>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {eligibleConnections.map(connection => (
                    <label
                      key={connection.id}
                      className={`flex items-start p-3 border rounded-lg cursor-pointer transition ${
                        selectedConnections.includes(connection.id)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedConnections.includes(connection.id)}
                        onChange={() => handleToggleConnection(connection.id)}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{connection.name}</p>
                        <p className="text-sm text-gray-600">{connection.career}</p>
                        {connection.city && connection.state && (
                          <p className="text-xs text-gray-500">{connection.city}, {connection.state}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setGroupName('');
                  setSelectedConnections([]);
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedConnections.length < 2 || selectedConnections.length > 3}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Chat Modal */}
      {showChatModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{selectedGroup.name}</h3>
                <p className="text-sm text-gray-600">Group Chat</p>
              </div>
              <button
                onClick={() => {
                  setShowChatModal(false);
                  setSelectedGroup(null);
                  setGroupMessages([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: '400px' }}>
              {groupMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">No messages yet</p>
                    <p className="text-sm text-gray-500 mt-2">Start the conversation!</p>
                  </div>
                </div>
              ) : (
                groupMessages.map((msg) => {
                  const isOwn = msg.user_id === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          isOwn
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <p className="text-xs opacity-75 mb-1">
                          {isOwn ? 'You' : msg.user?.name || 'Unknown'}
                        </p>
                        <p className="text-sm break-words">{msg.message}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs opacity-75">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          {isOwn && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="text-xs opacity-75 hover:opacity-100 ml-2"
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

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  maxLength={2000}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors flex items-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {newMessage.length}/2000 characters
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

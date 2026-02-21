'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, Send, MoreVertical, X, CheckCheck, Plus, Users, MessageCircle } from 'lucide-react';

export default function MessagesPageView({ currentUser, supabase, onNavigate, initialChatId, initialChatType, previousView }) {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    loadContacts();
  }, [currentUser.id]);

  // Handle initial chat selection (when navigating from another page)
  useEffect(() => {
    if (initialChatId && conversations.length > 0) {
      const chat = conversations.find(c =>
        (initialChatType === 'circle' && c.isGroup && c.circleId === initialChatId) ||
        (initialChatType === 'user' && !c.isGroup && c.oderId === initialChatId)
      );
      if (chat) {
        setActiveChat(chat);
      }
    }
  }, [initialChatId, initialChatType, conversations]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      // Load 1:1 conversations
      const { data: messages1on1, error: msg1on1Error } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          created_at,
          read
        `)
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (msg1on1Error) {
        console.error('Error loading 1:1 messages:', msg1on1Error);
      }

      // Group messages by conversation partner
      const conversationMap = new Map();
      (messages1on1 || []).forEach(msg => {
        const oderId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        if (!conversationMap.has(oderId)) {
          conversationMap.set(oderId, {
            oderId,
            messages: [],
            lastMessage: msg,
            unread: 0
          });
        }
        conversationMap.get(oderId).messages.push(msg);
        if (!msg.read && msg.receiver_id === currentUser.id) {
          conversationMap.get(oderId).unread++;
        }
      });

      // Get profile info for conversation partners
      const oderIds = Array.from(conversationMap.keys());
      let profiles = [];
      if (oderIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, name, profile_picture, career')
          .in('id', oderIds);
        profiles = profileData || [];
      }

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      // Build 1:1 conversation objects
      const oneOnOneConvos = Array.from(conversationMap.values()).map(convo => {
        const profile = profileMap.get(convo.oderId);
        return {
          id: `user-${convo.oderId}`,
          oderId: convo.oderId,
          name: profile?.name || 'Unknown',
          emoji: getInitialEmoji(profile?.name),
          avatar: profile?.profile_picture,
          subtitle: profile?.career || '',
          bg: 'bg-[#E6DCD4]',
          isGroup: false,
          lastMessage: {
            text: convo.lastMessage.content,
            time: formatTime(convo.lastMessage.created_at),
            isMe: convo.lastMessage.sender_id === currentUser.id
          },
          unread: convo.unread,
          messages: convo.messages.reverse()
        };
      });

      // Load circle group conversations
      const { data: circleMembers, error: circleMembersError } = await supabase
        .from('connection_group_members')
        .select(`
          group_id,
          connection_groups:group_id (
            id,
            name,
            description
          )
        `)
        .eq('user_id', currentUser.id);

      if (circleMembersError) {
        console.error('Error loading circle memberships:', circleMembersError);
      }

      // Get circle messages for each circle
      const circleConvos = [];
      for (const membership of (circleMembers || [])) {
        const circle = membership.connection_groups;
        if (!circle) continue;

        const { data: circleMessages, error: circleMessagesError } = await supabase
          .from('circle_messages')
          .select(`
            id,
            circle_id,
            sender_id,
            content,
            created_at,
            profiles:sender_id (
              id,
              name,
              profile_picture
            )
          `)
          .eq('circle_id', circle.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (circleMessagesError) {
          // Table might not exist yet
          console.log('Circle messages table may not exist:', circleMessagesError.message);
          continue;
        }

        // Get member count
        const { count: memberCount } = await supabase
          .from('connection_group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', circle.id);

        const lastMsg = circleMessages?.[0];
        circleConvos.push({
          id: `circle-${circle.id}`,
          circleId: circle.id,
          name: circle.name,
          emoji: '👥',
          bg: 'bg-[#E8E0D8]',
          isGroup: true,
          memberCount: memberCount || 0,
          lastMessage: lastMsg ? {
            sender: lastMsg.profiles?.name || 'Unknown',
            text: lastMsg.content,
            time: formatTime(lastMsg.created_at),
            isMe: lastMsg.sender_id === currentUser.id
          } : {
            text: 'No messages yet',
            time: '',
            isMe: false
          },
          unread: 0, // TODO: Implement unread tracking for circles
          messages: (circleMessages || []).reverse().map(msg => ({
            id: msg.id,
            sender: {
              id: msg.sender_id,
              name: msg.profiles?.name || 'Unknown',
              avatar: msg.profiles?.profile_picture
            },
            text: msg.content,
            time: formatTime(msg.created_at),
            isMe: msg.sender_id === currentUser.id
          }))
        });
      }

      // Combine and sort by most recent
      const allConvos = [...oneOnOneConvos, ...circleConvos].sort((a, b) => {
        const timeA = a.lastMessage?.time || '';
        const timeB = b.lastMessage?.time || '';
        return timeB.localeCompare(timeA);
      });

      setConversations(allConvos);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      let people = [];

      // Try to load connections (mutual matches) using the database function
      try {
        const { data: matches, error: matchError } = await supabase
          .rpc('get_mutual_matches', { for_user_id: currentUser.id });

        if (!matchError && matches && matches.length > 0) {
          // Get profile details for matched users
          const matchedUserIds = matches.map(m => m.matched_user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, profile_picture, career')
            .in('id', matchedUserIds);

          if (profiles) {
            people = profiles.map(p => ({
              id: p.id,
              name: p.name,
              emoji: getInitialEmoji(p.name),
              avatar: p.profile_picture,
              bg: 'bg-[#E6DCD4]',
              isGroup: false,
              subtitle: p.career || ''
            }));
          }
        }
      } catch (rpcError) {
        console.log('get_mutual_matches not available, using fallback');
      }

      // Fallback: Also load people the user has messaged before
      const { data: messagePartners } = await supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

      if (messagePartners && messagePartners.length > 0) {
        const partnerIds = new Set();
        messagePartners.forEach(msg => {
          if (msg.sender_id !== currentUser.id) partnerIds.add(msg.sender_id);
          if (msg.receiver_id !== currentUser.id) partnerIds.add(msg.receiver_id);
        });

        // Remove IDs we already have
        const existingIds = new Set(people.map(p => p.id));
        const newPartnerIds = Array.from(partnerIds).filter(id => !existingIds.has(id));

        if (newPartnerIds.length > 0) {
          const { data: partnerProfiles } = await supabase
            .from('profiles')
            .select('id, name, profile_picture, career')
            .in('id', newPartnerIds);

          if (partnerProfiles) {
            const additionalPeople = partnerProfiles.map(p => ({
              id: p.id,
              name: p.name,
              emoji: getInitialEmoji(p.name),
              avatar: p.profile_picture,
              bg: 'bg-[#E6DCD4]',
              isGroup: false,
              subtitle: p.career || ''
            }));
            people = [...people, ...additionalPeople];
          }
        }
      }

      // Load circles user is member of
      const { data: membershipData, error: circlesError } = await supabase
        .from('connection_group_members')
        .select('group_id')
        .eq('user_id', currentUser.id);

      let groups = [];
      if (!circlesError && membershipData && membershipData.length > 0) {
        const groupIds = membershipData.map(m => m.group_id);
        const { data: circleData } = await supabase
          .from('connection_groups')
          .select('id, name')
          .in('id', groupIds);

        if (circleData) {
          groups = circleData.map(c => ({
            id: c.id,
            name: c.name,
            emoji: '👥',
            bg: 'bg-[#E8E0D8]',
            isGroup: true,
            subtitle: 'Circle'
          }));
        }
      }

      setContacts([...people, ...groups]);
      console.log('Loaded contacts:', people.length, 'people,', groups.length, 'circles');
    } catch (err) {
      console.error('Error loading contacts:', err);
    }
  };

  const handleStartNewChat = async (contact, initialMessage) => {
    if (contact.isGroup) {
      // Send to circle
      const { error } = await supabase
        .from('circle_messages')
        .insert({
          circle_id: contact.id,
          sender_id: currentUser.id,
          content: initialMessage
        });

      if (error) {
        console.error('Error sending circle message:', error);
        alert('Error sending message. Please try again.');
        return;
      }
    } else {
      // Send 1:1 message
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: contact.id,
          content: initialMessage
        });

      if (error) {
        console.error('Error sending message:', error);
        alert('Error sending message. Please try again.');
        return;
      }
    }

    // Reload conversations and open the chat
    await loadConversations();
    setShowCompose(false);
  };

  const handleSendMessage = async (text) => {
    if (!activeChat || !text.trim()) return;

    if (activeChat.isGroup) {
      const { error } = await supabase
        .from('circle_messages')
        .insert({
          circle_id: activeChat.circleId,
          sender_id: currentUser.id,
          content: text.trim()
        });

      if (error) {
        console.error('Error sending circle message:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: activeChat.oderId,
          content: text.trim()
        });

      if (error) {
        console.error('Error sending message:', error);
        return;
      }
    }

    // Optimistically add message to UI
    const newMsg = {
      id: Date.now(),
      sender: {
        id: currentUser.id,
        name: currentUser.name || 'You',
        avatar: currentUser.profile_picture
      },
      text: text.trim(),
      time: 'Just now',
      isMe: true
    };

    setActiveChat(prev => ({
      ...prev,
      messages: [...prev.messages, newMsg],
      lastMessage: {
        text: text.trim(),
        time: 'Just now',
        isMe: true
      }
    }));

    // Update conversations list
    setConversations(prev => {
      const updated = prev.map(c =>
        c.id === activeChat.id
          ? { ...c, messages: [...c.messages, newMsg], lastMessage: { text: text.trim(), time: 'Just now', isMe: true } }
          : c
      );
      return updated.sort((a, b) => {
        if (a.id === activeChat.id) return -1;
        if (b.id === activeChat.id) return 1;
        return 0;
      });
    });
  };

  const filteredConversations = conversations.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getInitialEmoji = (name) => {
    if (!name) return '👤';
    const emojis = ['👩‍💼', '👩‍🦱', '👩', '👩‍🦰', '👩‍💻', '👩‍🎨', '👨‍💼', '👨‍💻', '👨'];
    return emojis[name.charCodeAt(0) % emojis.length];
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>Loading messages...</p>
        <style>{keyframeStyles}</style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {showCompose ? (
        <ComposeView
          contacts={contacts}
          onClose={() => setShowCompose(false)}
          onSend={handleStartNewChat}
        />
      ) : !activeChat ? (
        <InboxView
          conversations={filteredConversations}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          totalUnread={totalUnread}
          onSelectChat={setActiveChat}
          onCompose={() => setShowCompose(true)}
          previousView={previousView}
          onNavigate={onNavigate}
        />
      ) : (
        <ChatView
          conversation={activeChat}
          currentUser={currentUser}
          onBack={() => setActiveChat(null)}
          onSendMessage={handleSendMessage}
        />
      )}
      <style>{keyframeStyles}</style>
    </div>
  );
}

// Compose View Component
function ComposeView({ contacts, onClose, onSend }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [message, setMessage] = useState('');

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const people = filteredContacts.filter(c => !c.isGroup);
  const groups = filteredContacts.filter(c => c.isGroup);

  const handleSend = () => {
    if (selectedContact && message.trim()) {
      onSend(selectedContact, message.trim());
    }
  };

  return (
    <div style={styles.composeContainer}>
      {/* Header */}
      <header style={styles.composeHeader}>
        <div style={styles.composeHeaderInner}>
          <div style={styles.composeHeaderTop}>
            <button onClick={onClose} style={styles.closeBtn}>
              <X size={24} />
            </button>
            <h1 style={styles.composeTitle}>New Message</h1>
          </div>

          {/* Selected Contact or Search */}
          {selectedContact ? (
            <div style={styles.selectedContactBar}>
              <span style={styles.toLabel}>To:</span>
              <div style={styles.selectedContactChip}>
                <span style={styles.selectedContactEmoji}>{selectedContact.emoji}</span>
                <span style={styles.selectedContactName}>{selectedContact.name}</span>
                <button onClick={() => setSelectedContact(null)} style={styles.removeContactBtn}>
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.searchInputContainer}>
              <span style={styles.toLabel}>To:</span>
              <input
                type="text"
                placeholder="Search people or circles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={styles.composeSearchInput}
              />
            </div>
          )}
        </div>
      </header>

      {/* Contact List or Message Input */}
      {!selectedContact ? (
        <main style={styles.contactList}>
          {/* People */}
          {people.length > 0 && (
            <div style={styles.contactSection}>
              <p style={styles.contactSectionTitle}>People</p>
              <div style={styles.contactItems}>
                {people.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    style={styles.contactItem}
                  >
                    {contact.avatar ? (
                      <img src={contact.avatar} alt={contact.name} style={styles.contactAvatar} />
                    ) : (
                      <div style={styles.contactEmojiAvatar}>{contact.emoji}</div>
                    )}
                    <div style={styles.contactInfo}>
                      <p style={styles.contactName}>{contact.name}</p>
                      <p style={styles.contactSubtitle}>{contact.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {groups.length > 0 && (
            <div style={styles.contactSection}>
              <p style={styles.contactSectionTitle}>Circles & Groups</p>
              <div style={styles.contactItems}>
                {groups.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    style={styles.contactItem}
                  >
                    <div style={styles.contactEmojiAvatar}>{contact.emoji}</div>
                    <div style={{ ...styles.contactInfo, flex: 1 }}>
                      <p style={styles.contactName}>{contact.name}</p>
                      <p style={styles.contactSubtitle}>{contact.subtitle}</p>
                    </div>
                    <Users size={16} color="#8C7B6B" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredContacts.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🔍</div>
              <p style={styles.emptyText}>No results found</p>
            </div>
          )}
        </main>
      ) : (
        <main style={styles.composeMessageArea}>
          <div style={styles.composeMessageCenter}>
            {selectedContact.avatar ? (
              <img src={selectedContact.avatar} alt={selectedContact.name} style={styles.composeAvatar} />
            ) : (
              <div style={styles.composeEmojiAvatar}>{selectedContact.emoji}</div>
            )}
            <p style={styles.composeContactName}>{selectedContact.name}</p>
            <p style={styles.composeContactHint}>Start a new conversation</p>
          </div>
        </main>
      )}

      {/* Message Input - only show when contact selected */}
      {selectedContact && (
        <footer style={styles.composeFooter}>
          <div style={styles.messageInputContainer}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              autoFocus
              style={styles.messageTextarea}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            style={{
              ...styles.sendBtn,
              backgroundColor: message.trim() ? '#8C7B6B' : '#E6DDD4',
              color: message.trim() ? 'white' : '#8C7B6B',
              cursor: message.trim() ? 'pointer' : 'default'
            }}
          >
            <Send size={20} />
          </button>
        </footer>
      )}
    </div>
  );
}

// Inbox View Component
function InboxView({ conversations, searchQuery, setSearchQuery, totalUnread, onSelectChat, onCompose, previousView, onNavigate }) {
  return (
    <>
      {/* Header */}
      <header style={styles.inboxHeader}>
        <div style={styles.inboxHeaderInner}>
          {/* Back button when navigating from another page */}
          {previousView && previousView !== 'messages' && (
            <button
              onClick={() => onNavigate?.(previousView)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                color: '#8C7B6B',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '4px 0',
                marginBottom: '4px',
              }}
            >
              <ChevronLeft size={18} />
              Back
            </button>
          )}
          {/* Title */}
          <div style={styles.inboxTitleRow}>
            <div>
              <h1 style={styles.inboxTitle}>Messages</h1>
              <p style={styles.inboxSubtitle}>
                {totalUnread > 0 ? `${totalUnread} unread` : 'All caught up!'}
              </p>
            </div>
            <button onClick={onCompose} style={styles.composeBtn}>
              <Plus size={20} />
            </button>
          </div>

          {/* Search Bar */}
          <div style={styles.searchContainer}>
            <Search size={20} color="rgba(140, 123, 107, 0.5)" style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Conversation List */}
      <main style={styles.conversationList}>
        {conversations.length > 0 ? (
          <div>
            {conversations.map((convo) => (
              <ConversationRow key={convo.id} conversation={convo} onClick={() => onSelectChat(convo)} />
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIconLarge}>💬</div>
            <h3 style={styles.emptyTitle}>No conversations</h3>
            <p style={styles.emptyText}>Start a conversation with someone!</p>
            <button onClick={onCompose} style={styles.emptyBtn}>
              New Message
            </button>
          </div>
        )}
      </main>
    </>
  );
}

// Conversation Row Component
function ConversationRow({ conversation, onClick }) {
  return (
    <div style={styles.conversationRow} onClick={onClick}>
      {/* Avatar */}
      <div style={styles.conversationAvatarContainer}>
        {conversation.avatar ? (
          <img src={conversation.avatar} alt={conversation.name} style={styles.conversationAvatarImg} />
        ) : (
          <div style={styles.conversationAvatar}>{conversation.emoji}</div>
        )}
        {conversation.unread > 0 && (
          <span style={styles.unreadBadge}>{conversation.unread}</span>
        )}
      </div>

      {/* Content */}
      <div style={styles.conversationContent}>
        <div style={styles.conversationHeader}>
          <h3 style={{
            ...styles.conversationName,
            fontWeight: conversation.unread > 0 ? '600' : '500'
          }}>
            {conversation.name}
          </h3>
          <span style={{
            ...styles.conversationTime,
            color: conversation.unread > 0 ? '#C4956A' : '#8C7B6B',
            fontWeight: conversation.unread > 0 ? '500' : '400'
          }}>
            {conversation.lastMessage?.time}
          </span>
        </div>

        {/* Last message */}
        <p style={{
          ...styles.lastMessage,
          color: conversation.unread > 0 ? '#5D4E42' : '#8C7B6B',
          fontWeight: conversation.unread > 0 ? '500' : '400'
        }}>
          {conversation.isGroup && conversation.lastMessage?.sender && !conversation.lastMessage?.isMe && (
            <span style={{ color: '#8C7B6B', fontWeight: '400' }}>{conversation.lastMessage.sender}: </span>
          )}
          {conversation.lastMessage?.isMe && <span style={{ color: '#8C7B6B', fontWeight: '400' }}>You: </span>}
          {conversation.lastMessage?.text}
        </p>
      </div>
    </div>
  );
}

// Chat View Component
function ChatView({ conversation, currentUser, onBack, onSendMessage }) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message);
    setMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.chatContainer}>
      {/* Chat Header */}
      <header style={styles.chatHeader}>
        <div style={styles.chatHeaderInner}>
          <button onClick={onBack} style={styles.backBtn}>
            <ChevronLeft size={24} />
          </button>

          {conversation.avatar ? (
            <img src={conversation.avatar} alt={conversation.name} style={styles.chatAvatar} />
          ) : (
            <div style={styles.chatEmojiAvatar}>{conversation.emoji}</div>
          )}

          <div style={styles.chatHeaderInfo}>
            <h2 style={styles.chatName}>{conversation.name}</h2>
            {conversation.isGroup && (
              <p style={styles.chatMemberCount}>{conversation.memberCount} members</p>
            )}
          </div>

          <button style={styles.moreBtn}>
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main style={styles.messagesArea}>
        <div style={styles.messagesInner}>
          {conversation.messages.map((msg, index) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isGroup={conversation.isGroup}
              showAvatar={conversation.isGroup && !msg.isMe}
              showName={conversation.isGroup && !msg.isMe && (index === 0 || conversation.messages[index - 1]?.sender?.name !== msg.sender?.name)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Message Input */}
      <footer style={styles.chatFooter}>
        <div style={styles.chatInputContainer}>
          <div style={styles.messageInputWrapper}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              style={styles.messageTextarea}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            style={{
              ...styles.sendBtn,
              backgroundColor: message.trim() ? '#8C7B6B' : '#E6DDD4',
              color: message.trim() ? 'white' : '#8C7B6B',
              cursor: message.trim() ? 'pointer' : 'default'
            }}
          >
            <Send size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message, isGroup, showAvatar, showName }) {
  const isMe = message.isMe;

  if (message.isSystem) {
    return (
      <div style={styles.systemMessage}>
        <p style={styles.systemMessageText}>{message.text}</p>
      </div>
    );
  }

  return (
    <div style={{
      ...styles.messageBubbleContainer,
      justifyContent: isMe ? 'flex-end' : 'flex-start'
    }}>
      {/* Avatar for group chats */}
      {showAvatar && (
        <div style={styles.messageAvatar}>
          {message.sender?.avatar ? (
            <img src={message.sender.avatar} alt="" style={styles.messageAvatarImg} />
          ) : (
            message.sender?.name?.charAt(0) || '?'
          )}
        </div>
      )}
      {!showAvatar && !isMe && isGroup && <div style={{ width: '32px', flexShrink: 0 }} />}

      <div style={{ maxWidth: '75%' }}>
        {/* Sender name for group chats */}
        {showName && (
          <p style={styles.senderName}>{message.sender?.name}</p>
        )}

        {/* Message bubble */}
        <div style={{
          ...styles.messageBubble,
          backgroundColor: isMe ? '#8C7B6B' : 'white',
          color: isMe ? 'white' : '#5D4E42',
          borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
          border: isMe ? 'none' : '1px solid #EBE3DB'
        }}>
          <p style={styles.messageText}>{message.text}</p>
        </div>

        {/* Time */}
        <div style={{
          ...styles.messageTime,
          justifyContent: isMe ? 'flex-end' : 'flex-start'
        }}>
          <span style={styles.timeText}>{message.time}</span>
          {isMe && <CheckCheck size={14} color="#6B9080" style={{ marginLeft: '4px' }} />}
        </div>
      </div>
    </div>
  );
}

const keyframeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const styles = {
  container: {
    minHeight: '100%',
    backgroundColor: '#FAF6F3',
    fontFamily: '"DM Sans", sans-serif',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
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

  // Inbox styles
  inboxHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    backgroundColor: 'rgba(250, 246, 243, 0.95)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid #E6DDD4',
  },
  inboxHeaderInner: {
    maxWidth: '768px',
    margin: '0 auto',
    padding: '16px',
  },
  inboxTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  inboxTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '24px',
    fontWeight: '600',
    color: '#5D4E42',
    margin: 0,
  },
  inboxSubtitle: {
    fontSize: '14px',
    color: '#8C7B6B',
    marginTop: '2px',
    margin: 0,
  },
  composeBtn: {
    width: '40px',
    height: '40px',
    backgroundColor: '#8C7B6B',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  searchContainer: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
  },
  searchInput: {
    width: '100%',
    paddingLeft: '48px',
    paddingRight: '40px',
    paddingTop: '12px',
    paddingBottom: '12px',
    backgroundColor: 'white',
    border: '2px solid #E6DDD4',
    borderRadius: '16px',
    fontSize: '15px',
    color: '#5D4E42',
    outline: 'none',
    fontFamily: '"DM Sans", sans-serif',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'rgba(140, 123, 107, 0.5)',
    cursor: 'pointer',
    padding: 0,
  },

  // Conversation list
  conversationList: {
    maxWidth: '768px',
    margin: '0 auto',
  },
  conversationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #EBE3DB',
    transition: 'background-color 0.2s',
  },
  conversationAvatarContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  conversationAvatar: {
    width: '48px',
    height: '48px',
    backgroundColor: '#E6DCD4',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  },
  conversationAvatarImg: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  unreadBadge: {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    width: '20px',
    height: '20px',
    backgroundColor: '#C4956A',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationContent: {
    flex: 1,
    minWidth: 0,
  },
  conversationHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2px',
  },
  conversationName: {
    fontSize: '15px',
    color: '#5D4E42',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  conversationTime: {
    fontSize: '12px',
    flexShrink: 0,
    marginLeft: '8px',
  },
  lastMessage: {
    fontSize: '14px',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: '64px 16px',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  emptyIconLarge: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '500',
    color: '#5D4E42',
    marginBottom: '8px',
    margin: '0 0 8px 0',
  },
  emptyText: {
    fontSize: '14px',
    color: '#8C7B6B',
    marginBottom: '16px',
    margin: '0 0 16px 0',
  },
  emptyBtn: {
    padding: '10px 20px',
    backgroundColor: '#8C7B6B',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },

  // Compose view
  composeContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  composeHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    backgroundColor: '#FAF6F3',
    borderBottom: '1px solid #E6DDD4',
  },
  composeHeaderInner: {
    maxWidth: '768px',
    margin: '0 auto',
    padding: '16px',
  },
  composeHeaderTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  closeBtn: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#5D4E42',
    cursor: 'pointer',
  },
  composeTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '20px',
    fontWeight: '600',
    color: '#5D4E42',
    margin: 0,
  },
  selectedContactBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'white',
    border: '2px solid #E6DDD4',
    borderRadius: '16px',
  },
  toLabel: {
    fontSize: '14px',
    color: '#8C7B6B',
  },
  selectedContactChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    backgroundColor: '#F5EDE5',
    borderRadius: '100px',
  },
  selectedContactEmoji: {
    fontSize: '18px',
  },
  selectedContactName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#5D4E42',
  },
  removeContactBtn: {
    background: 'none',
    border: 'none',
    color: '#8C7B6B',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
  searchInputContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 12px',
    backgroundColor: 'white',
    border: '2px solid #E6DDD4',
    borderRadius: '16px',
  },
  composeSearchInput: {
    flex: 1,
    padding: '12px 0',
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    color: '#5D4E42',
    fontFamily: '"DM Sans", sans-serif',
  },

  // Contact list
  contactList: {
    flex: 1,
    maxWidth: '768px',
    margin: '0 auto',
    width: '100%',
  },
  contactSection: {
    padding: '16px',
  },
  contactSectionTitle: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#8C7B6B',
    marginBottom: '8px',
    paddingLeft: '4px',
    margin: '0 0 8px 0',
  },
  contactItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'background-color 0.2s',
  },
  contactAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  contactEmojiAvatar: {
    width: '44px',
    height: '44px',
    backgroundColor: '#E6DCD4',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  contactInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  contactName: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#5D4E42',
    margin: 0,
  },
  contactSubtitle: {
    fontSize: '13px',
    color: '#8C7B6B',
    margin: 0,
  },

  // Compose message area
  composeMessageArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '768px',
    margin: '0 auto',
    width: '100%',
    padding: '16px',
  },
  composeMessageCenter: {
    textAlign: 'center',
  },
  composeAvatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    objectFit: 'cover',
    margin: '0 auto 12px',
  },
  composeEmojiAvatar: {
    width: '64px',
    height: '64px',
    backgroundColor: '#E6DCD4',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    margin: '0 auto 12px',
  },
  composeContactName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#5D4E42',
    marginBottom: '4px',
    margin: '0 0 4px 0',
  },
  composeContactHint: {
    fontSize: '14px',
    color: '#8C7B6B',
    margin: 0,
  },

  // Footer
  composeFooter: {
    position: 'sticky',
    bottom: 0,
    backgroundColor: '#FAF6F3',
    borderTop: '1px solid #E6DDD4',
    padding: '12px 16px',
  },

  // Chat view
  chatContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  chatHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    backgroundColor: '#FAF6F3',
    borderBottom: '1px solid #E6DDD4',
  },
  chatHeaderInner: {
    maxWidth: '768px',
    margin: '0 auto',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  backBtn: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#5D4E42',
    cursor: 'pointer',
  },
  chatAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  chatEmojiAvatar: {
    width: '40px',
    height: '40px',
    backgroundColor: '#E6DCD4',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  chatHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  chatName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#5D4E42',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chatMemberCount: {
    fontSize: '12px',
    color: '#8C7B6B',
    margin: 0,
  },
  moreBtn: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#8C7B6B',
    cursor: 'pointer',
  },

  // Messages area
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  messagesInner: {
    maxWidth: '768px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  // Message bubbles
  messageBubbleContainer: {
    display: 'flex',
    gap: '8px',
  },
  messageAvatar: {
    width: '32px',
    height: '32px',
    backgroundColor: '#F0E8E0',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    flexShrink: 0,
    marginTop: 'auto',
  },
  messageAvatarImg: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  senderName: {
    fontSize: '12px',
    color: '#8C7B6B',
    marginBottom: '4px',
    marginLeft: '4px',
    margin: '0 0 4px 4px',
  },
  messageBubble: {
    padding: '10px 16px',
  },
  messageText: {
    fontSize: '14px',
    lineHeight: '1.5',
    margin: 0,
  },
  messageTime: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '4px',
  },
  timeText: {
    fontSize: '11px',
    color: 'rgba(140, 123, 107, 0.6)',
  },
  systemMessage: {
    display: 'flex',
    justifyContent: 'center',
    margin: '16px 0',
  },
  systemMessageText: {
    fontSize: '12px',
    color: '#8C7B6B',
    backgroundColor: '#F5EDE5',
    padding: '8px 16px',
    borderRadius: '100px',
    margin: 0,
  },

  // Chat footer
  chatFooter: {
    position: 'sticky',
    bottom: 0,
    backgroundColor: '#FAF6F3',
    borderTop: '1px solid #E6DDD4',
    padding: '12px 16px',
  },
  chatInputContainer: {
    maxWidth: '768px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
  },
  messageInputContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    maxWidth: '768px',
    margin: '0 auto',
  },
  messageInputWrapper: {
    flex: 1,
    backgroundColor: 'white',
    border: '2px solid #E6DDD4',
    borderRadius: '16px',
    padding: '10px 16px',
  },
  messageTextarea: {
    width: '100%',
    resize: 'none',
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    color: '#5D4E42',
    fontFamily: '"DM Sans", sans-serif',
    maxHeight: '120px',
    backgroundColor: 'transparent',
  },
  sendBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    flexShrink: 0,
  },
};

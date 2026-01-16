'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, User, Clock, Check, CheckCheck, Search } from 'lucide-react';

export default function MessagesView({ currentUser, supabase, onUnreadCountChange }) {
  const [conversations, setConversations] = useState([]);
  
  // Persist selected conversation across re-renders
  const [selectedConversation, setSelectedConversation] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('selectedConversation');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);

  // Save selected conversation to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedConversation) {
        sessionStorage.setItem('selectedConversation', JSON.stringify(selectedConversation));
      } else {
        sessionStorage.removeItem('selectedConversation');
      }
    }
  }, [selectedConversation]);

  // Use ref to always have latest selectedConversation in subscription
  const selectedConversationRef = useRef(selectedConversation);
  
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []); // Empty array - only run once on mount, loadConversations is defined below

  // Set up subscription separately so it can access latest state via ref
  useEffect(() => {
    console.log('🔌 Setting up messages subscription for Safari/Chrome');
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    console.log('🌐 Browser:', isSafari ? 'Safari' : 'Chrome/Other');
    
    const channel = supabase
      .channel(`messages_view_${currentUser.id}_${Date.now()}`)  // Unique channel name with timestamp
      // Listen for new messages received
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`
        },
        (payload) => {
          console.log('📨 New message received via real-time:', payload.new);
          const message = payload.new;
          const currentlySelected = selectedConversationRef.current;
          
          console.log('🔍 Currently selected conversation:', currentlySelected?.id);
          console.log('🔍 Message from:', message.sender_id);
          console.log('🔍 Match?', currentlySelected?.id === message.sender_id);

          // If message is from current conversation, add it to chat
          if (currentlySelected && message.sender_id === currentlySelected.id) {
            console.log('✅ Adding message to current chat window');
            setMessages(prev => {
              // Prevent duplicates
              if (prev.find(m => m.id === message.id)) {
                console.log('⚠️ Message already exists, skipping');
                return prev;
              }
              console.log('📝 Adding to messages. Before:', prev.length, 'After:', prev.length + 1);
              return [...prev, message];
            });
            
            // Mark as read immediately since user is viewing it
            supabase
              .from('messages')
              .update({ read: true })
              .eq('id', message.id)
              .then(({ error }) => {
                if (error) {
                  console.error('❌ Error marking as read:', error);
                } else {
                  console.log('✅ Marked message as read in database');
                  // Update local state
                  setMessages(prev =>
                    prev.map(m => m.id === message.id ? { ...m, read: true } : m)
                  );
                  // Notify parent to refresh unread count
                  onUnreadCountChange?.();
                }
              });
          } else {
            console.log('⚠️ Not adding to chat - conversation not open or different sender');
          }

          // Update conversation list to show new last message
          setConversations(prev => {
            const existingConv = prev.find(conv => conv.id === message.sender_id);
            
            if (existingConv) {
              const updatedConversations = prev.map(conv => {
                if (conv.id === message.sender_id) {
                  return {
                    ...conv,
                    lastMessage: message,
                    lastMessageTime: message.created_at,
                    unreadCount: currentlySelected?.id === message.sender_id 
                      ? 0  // Already viewing, so no unread
                      : (conv.unreadCount || 0) + 1  // Increment unread
                  };
                }
                return conv;
              });

              // Sort by last message time
              updatedConversations.sort((a, b) => 
                new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
              );

              return updatedConversations;
            } else {
              console.log('🆕 New conversation detected, reloading...');
              loadConversations();
              return prev;
            }
          });
        }
      )
      // DISABLED: UPDATE listener causes infinite loop
      // Read receipts feature temporarily disabled until database issue is resolved
      /*
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${currentUser.id}`
        },
        (payload) => {
          console.log('📖 Message read status updated:', payload.new);
          const updatedMessage = payload.new;
          
          // CRITICAL: Only update if read status actually changed
          // Otherwise we get infinite loop from updated_at trigger
          setMessages(prev => {
            const foundMessage = prev.find(m => m.id === updatedMessage.id);
            
            if (!foundMessage) {
              console.log('⚠️ Message not found in current messages, ignoring update');
              return prev; // Don't update if message not in list
            }
            
            // Check if read status actually changed
            if (foundMessage.read === updatedMessage.read) {
              console.log('⏭️ Read status unchanged (old:', foundMessage.read, 'new:', updatedMessage.read, ') - skipping update to prevent loop');
              return prev; // DON'T update state if nothing changed!
            }
            
            console.log('✅ Read status changed from', foundMessage.read, 'to', updatedMessage.read);
            
            return prev.map(m =>
              m.id === updatedMessage.id
                ? { ...m, read: updatedMessage.read }
                : m
            );
          });
        }
      )
      */
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active (INSERT + UPDATE)');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Subscription error:', err);
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Subscription timed out');
        } else {
          console.log('📡 Subscription status:', status);
        }
      });

    // Aggressive polling for Safari (and as fallback for all browsers)
    // Poll more frequently when a conversation is open
    let lastCheckedTime = new Date();
    let pollInterval = null;
    
    // Only enable polling fallback for Safari or if real-time fails
    if (isSafari) {
      console.log('🔄 Enabling polling for Safari (2-second interval)');
      pollInterval = setInterval(async () => {
        const currentlySelected = selectedConversationRef.current;
        
        if (currentlySelected) {
          try {
            // Get all messages between current user and selected conversation
            // that are newer than the last message we have
            const { data: newMessages } = await supabase
              .from('messages')
              .select('*')
              .eq('sender_id', currentlySelected.id)
              .eq('receiver_id', currentUser.id)
              .gt('created_at', lastCheckedTime.toISOString())
              .order('created_at', { ascending: true });

            if (newMessages && newMessages.length > 0) {
              console.log(`🔄 [Safari Polling] Found ${newMessages.length} new message(s)`);
              
              setMessages(prev => {
                // Add new messages, avoiding duplicates
                const existingIds = new Set(prev.map(m => m.id));
                const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
                
                if (uniqueNewMessages.length > 0) {
                  console.log(`📝 Adding ${uniqueNewMessages.length} new message(s) via polling`);
                  return [...prev, ...uniqueNewMessages];
                }
                return prev;
              });
              
              // Mark as read in database
              const messageIds = newMessages.map(m => m.id);
              const { error: readError } = await supabase
                .from('messages')
                .update({ read: true })
                .in('id', messageIds);

              if (!readError) {
                console.log('✅ Marked polled messages as read');
                // Update local state
                setMessages(prev =>
                  prev.map(m => messageIds.includes(m.id) ? { ...m, read: true } : m)
                );
                // Notify parent to refresh unread count
                onUnreadCountChange?.();
              }
              
              // Update last checked time to the newest message
              lastCheckedTime = new Date(newMessages[newMessages.length - 1].created_at);
            }
          } catch (err) {
            console.error('❌ Polling error:', err);
          }
        }
      }, 2000); // Safari: poll every 2 seconds
    } else {
      console.log('✅ Chrome detected - using real-time only (no polling)');
    }

    return () => {
      console.log('🧹 Cleaning up MessagesView subscription');
      if (pollInterval) clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [currentUser.id, supabase]); // Don't include messages - causes too many re-subscriptions

  // Load messages when conversation selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);

      console.log('📧 Loading conversations for messaging...');

      // Get mutual matches using your database function (same as MainApp)
      const { data: matches, error: matchesError } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id });

      if (matchesError) {
        console.error('Error loading mutual matches:', matchesError);
        throw matchesError;
      }

      console.log('✅ Found mutual matches:', matches?.length || 0);

      if (!matches || matches.length === 0) {
        console.log('No connections to message yet');
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get last message with each connection
      const matchedUserIds = matches.map(m => m.matched_user_id);
      console.log('👥 Matched user IDs:', matchedUserIds);

      // Get profile details for matched users
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, bio')
        .in('id', matchedUserIds);

      if (profileError) {
        console.error('Error loading profiles:', profileError);
        throw profileError;
      }

      console.log('👤 Loaded profiles:', profiles);

      // Combine matches with profiles
      const conversationsWithLastMessage = await Promise.all(
        matches.map(async (match) => {
          const otherUserId = match.matched_user_id;
          const profile = profiles.find(p => p.id === otherUserId);

          if (!profile) {
            console.warn('No profile found for user:', otherUserId);
            return null;
          }

          const { data: lastMessage } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', otherUserId)
            .eq('receiver_id', currentUser.id)
            .eq('read', false);

          return {
            id: otherUserId,
            user: {
              id: profile.id,
              name: profile.name || 'Unknown User',
              career: profile.career || '',
              city: profile.city || '',
              state: profile.state || '',
              bio: profile.bio || ''
            },
            lastMessage,
            unreadCount: unreadCount || 0,
            lastMessageTime: lastMessage?.created_at || match.matched_at
          };
        })
      );

      // Filter out null entries (users without profiles)
      const validConversations = conversationsWithLastMessage.filter(conv => conv !== null);

      // Sort by last message time
      validConversations.sort((a, b) => 
        new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      );

      console.log('✅ Loaded conversations:', validConversations.length);
      setConversations(validConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, supabase]); // Dependencies for loadConversations

  const loadMessages = async (otherUserId) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      // Mark unread messages from this sender as read
      const unreadMessageIds = (data || [])
        .filter(msg => msg.sender_id === otherUserId && msg.read === false)
        .map(msg => msg.id);

      if (unreadMessageIds.length > 0) {
        console.log(`📖 Marking ${unreadMessageIds.length} message(s) as read`);
        
        // Update database
        const { error: updateError } = await supabase
          .from('messages')
          .update({ read: true })
          .in('id', unreadMessageIds);

        if (updateError) {
          console.error('❌ Error marking as read:', updateError);
        } else {
          console.log('✅ Marked messages as read in database');

          // Update local state to reflect read status
          setMessages(prev =>
            prev.map(msg =>
              unreadMessageIds.includes(msg.id)
                ? { ...msg, read: true }
                : msg
            )
          );

          // Notify parent to refresh unread count
          onUnreadCountChange?.();
        }
      }

      // Update conversation unread count
      setConversations(prev =>
        prev.map(conv =>
          conv.id === otherUserId
            ? { ...conv, unreadCount: 0 }
            : conv
        )
      );
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || sending) return;

    try {
      setSending(true);
      const messageText = newMessage.trim();
      setNewMessage(''); // Clear input immediately

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: selectedConversation.id,
          content: messageText,
          read: false
        })
        .select()
        .single();

      if (error) throw error;

      console.log('📤 Sent message:', data);

      // Add to messages list with duplicate check
      setMessages(prev => {
        const alreadyExists = prev.find(m => m.id === data.id);
        console.log(`🔍 Checking for duplicate: ID=${data.id}, Exists=${!!alreadyExists}, Current count=${prev.length}`);
        
        if (alreadyExists) {
          console.log('⚠️ Sent message already in list, skipping');
          return prev;
        }
        
        console.log('✅ Adding sent message to UI (new length will be', prev.length + 1, ')');
        return [...prev, data];
      });

      // Update conversation last message
      setConversations(prev =>
        prev.map(conv =>
          conv.id === selectedConversation.id
            ? { ...conv, lastMessage: data, lastMessageTime: data.created_at }
            : conv
        )
      );

      // Focus back on input
      messageInputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv?.user?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 shadow-lg">
        <div className="flex items-center">
          <MessageCircle className="w-6 h-6 mr-3" />
          <h1 className="text-xl font-bold">Messages</h1>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List - Hidden on mobile when chat is selected */}
        <div className={`bg-white border-r border-gray-200 flex flex-col ${
          selectedConversation 
            ? 'hidden md:flex md:w-96' 
            : 'w-full md:w-96 flex'
        }`}>
          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium mb-1">No conversations yet</p>
                <p className="text-sm">
                  Connect with people at meetups to start chatting!
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left ${
                    selectedConversation?.id === conv.id ? 'bg-purple-50 border-l-4 border-l-purple-600' : ''
                  }`}
                >
                  <div className="flex items-start">
                    <div className="bg-purple-100 rounded-full p-2 mr-3">
                      <User className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {conv.user.name}
                        </h3>
                        {conv.lastMessage && (
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                            {formatTime(conv.lastMessage.created_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-1 truncate">
                        {conv.user.career}
                      </p>
                      {conv.lastMessage && (
                        <p className="text-sm text-gray-500 truncate">
                          {conv.lastMessage.sender_id === currentUser.id ? 'You: ' : ''}
                          {conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                    {conv.unreadCount > 0 && (
                      <div className="bg-purple-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ml-2 flex-shrink-0">
                        {conv.unreadCount}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messages Area */}
        {!selectedConversation ? (
          <div className="flex-1 hidden md:flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <MessageCircle className="w-20 h-20 mx-auto mb-4" />
              <p className="text-lg font-medium">Select a conversation to start messaging</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-white">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
              <div className="flex items-center">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden mr-3 text-gray-600"
                >
                  ←
                </button>
                <div className="bg-purple-100 rounded-full p-2 mr-3">
                  <User className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {selectedConversation.user.name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {selectedConversation.user.career}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3" />
                  <p>No messages yet. Say hello! 👋</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.sender_id === currentUser.id;
                  const showTime = index === 0 || 
                    new Date(message.created_at) - new Date(messages[index - 1].created_at) > 60000;

                  return (
                    <div key={message.id}>
                      {showTime && (
                        <div className="text-center text-xs text-gray-500 my-4">
                          {formatTime(message.created_at)}
                        </div>
                      )}
                      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              isOwn
                                ? 'bg-purple-600 text-white rounded-br-none'
                                : 'bg-gray-200 text-gray-900 rounded-bl-none'
                            }`}
                          >
                            <p className="text-sm break-words">{message.content}</p>
                          </div>
                          {isOwn && (
                            <div className="flex items-center justify-end mt-1 space-x-1">
                              <span className="text-xs text-gray-500">
                                {new Date(message.created_at).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </span>
                              {message.read ? (
                                <CheckCheck className="w-3 h-3 text-purple-600" />
                              ) : (
                                <Check className="w-3 h-3 text-gray-400" />
                              )}
                            </div>
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
            <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center space-x-2">
                <input
                  ref={messageInputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:border-purple-500"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

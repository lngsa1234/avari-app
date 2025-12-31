'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, ArrowLeft, User } from 'lucide-react';
import { createClient } from '@/lib/supabase';

const supabase = createClient();

/**
 * CompactMessagesView - Mobile-first messaging component
 * Optimized for small screens with back navigation
 */
export default function CompactMessagesView({ currentUser, onBack }) {
  const [view, setView] = useState('list'); // 'list' or 'chat'
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversations();

    // Subscribe to new messages
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`
        },
        (payload) => {
          handleNewMessage(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      setView('chat');
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      setLoading(true);

      const { data: connections } = await supabase
        .from('connections')
        .select(`
          *,
          connected_user:profiles!connections_connected_user_id_fkey(
            id, name, career
          )
        `)
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted');

      const conversationsWithLastMessage = await Promise.all(
        (connections || []).map(async (conn) => {
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${conn.connected_user.id}),and(sender_id.eq.${conn.connected_user.id},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', conn.connected_user.id)
            .eq('receiver_id', currentUser.id)
            .eq('read', false);

          return {
            id: conn.connected_user.id,
            user: conn.connected_user,
            lastMessage,
            unreadCount: unreadCount || 0,
            lastMessageTime: lastMessage?.created_at || conn.created_at
          };
        })
      );

      conversationsWithLastMessage.sort((a, b) =>
        new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      );

      setConversations(conversationsWithLastMessage);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (otherUserId) => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      setMessages(data || []);

      // Mark as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', otherUserId)
        .eq('receiver_id', currentUser.id)
        .eq('read', false);

      setConversations(prev =>
        prev.map(conv =>
          conv.id === otherUserId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleNewMessage = (message) => {
    if (selectedConversation && message.sender_id === selectedConversation.id) {
      setMessages(prev => [...prev, message]);
      supabase.from('messages').update({ read: true }).eq('id', message.id);
    } else {
      loadConversations();
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const { data } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: selectedConversation.id,
          content: messageText,
          read: false
        })
        .select()
        .single();

      setMessages(prev => [...prev, data]);
      setConversations(prev =>
        prev.map(conv =>
          conv.id === selectedConversation.id
            ? { ...conv, lastMessage: data, lastMessageTime: data.created_at }
            : conv
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const goBack = () => {
    if (view === 'chat') {
      setView('list');
      setSelectedConversation(null);
    } else {
      onBack?.();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 shadow-lg">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-3">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <MessageCircle className="w-6 h-6 mr-2" />
          <h1 className="text-lg font-bold">
            {view === 'chat' ? selectedConversation?.user.name : 'Messages'}
          </h1>
        </div>
      </div>

      {/* Conversations List */}
      {view === 'list' && (
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-16 h-16 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No conversations yet</p>
              <p className="text-sm mt-2">Connect with people to start messaging!</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className="w-full p-4 border-b border-gray-100 active:bg-gray-50 text-left"
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
                        <span className="text-xs text-gray-500 ml-2">
                          {formatTime(conv.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="text-sm text-gray-500 truncate">
                        {conv.lastMessage.sender_id === currentUser.id ? 'You: ' : ''}
                        {conv.lastMessage.content}
                      </p>
                    )}
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="bg-purple-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ml-2">
                      {conv.unreadCount}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Chat View */}
      {view === 'chat' && selectedConversation && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((message) => {
              const isOwn = message.sender_id === currentUser.id;
              return (
                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                      isOwn
                        ? 'bg-purple-600 text-white rounded-br-none'
                        : 'bg-white text-gray-900 rounded-bl-none shadow'
                    }`}
                  >
                    <p className="text-sm break-words">{message.content}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-purple-200' : 'text-gray-500'}`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-3 border-t border-gray-200 bg-white">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-purple-600 text-white p-3 rounded-full disabled:bg-gray-300"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

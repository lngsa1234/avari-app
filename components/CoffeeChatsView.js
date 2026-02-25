// components/CoffeeChatsView.js
// Main view for 1:1 virtual coffee chats

'use client';

import React, { useState, useEffect } from 'react';
import { Video, Calendar, Clock, User, Check, X, MessageCircle } from 'lucide-react';
import {
  requestCoffeeChat,
  acceptCoffeeChat,
  declineCoffeeChat,
  cancelCoffeeChat,
  getMyCoffeeChats,
  getPendingRequests,
  getSentRequests
} from '@/lib/coffeeChatHelpers';
import VideoCallButton from './VideoCallButton';

export default function CoffeeChatsView({ currentUser, connections, supabase, onNavigate }) {
  const [activeTab, setActiveTab] = useState('schedule'); // schedule, upcoming, requests, sent
  const [coffeeChats, setCoffeeChats] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadCoffeeChats();
    loadPendingRequests();
    loadSentRequests();

    // Real-time subscription for new coffee chat requests
    console.log('🔔 Setting up real-time subscription for coffee chats');
    
    // Subscribe to requests received (where user is recipient)
    const receivedChannel = supabase
      .channel('coffee-chats-received')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coffee_chats',
          filter: `recipient_id=eq.${currentUser.id}`
        },
        (payload) => {
          console.log('🔔 Received request change:', payload);
          loadPendingRequests();
          loadCoffeeChats();
        }
      )
      .subscribe();

    // Subscribe to requests sent (where user is requester)
    const sentChannel = supabase
      .channel('coffee-chats-sent')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coffee_chats',
          filter: `requester_id=eq.${currentUser.id}`
        },
        (payload) => {
          console.log('🔔 Sent request change:', payload);
          loadSentRequests();
          loadCoffeeChats();
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      console.log('🔕 Cleaning up coffee chats subscriptions');
      supabase.removeChannel(receivedChannel);
      supabase.removeChannel(sentChannel);
    };
  }, [currentUser.id]);

  const loadCoffeeChats = async () => {
    setLoading(true);
    try {
      console.log('📋 Loading coffee chats...');
      const chats = await getMyCoffeeChats(supabase);
      console.log('✅ Loaded chats:', chats);
      setCoffeeChats(chats);
    } catch (error) {
      console.error('❌ Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const requests = await getPendingRequests(supabase);
      setPendingRequests(requests);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const loadSentRequests = async () => {
    try {
      const requests = await getSentRequests(supabase);
      setSentRequests(requests);
    } catch (error) {
      console.error('Error loading sent requests:', error);
      setSentRequests([]);
    }
  };

  const handleScheduleClick = (connection) => {
    setSelectedConnection(connection);
    setShowScheduleModal(true);
  };

  const notifyEmail = (type, chatId) => {
    fetch('/api/notifications/coffee-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationType: type, chatId }),
    }).catch(err => console.error('[Email] notify failed:', err));
  };

  const handleSubmitRequest = async () => {
    if (!scheduledDate || !scheduledTime) {
      alert('Please select date and time');
      return;
    }

    try {
      const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);

      const data = await requestCoffeeChat(supabase, {
        recipientId: selectedConnection.connected_user_id || selectedConnection.id,
        scheduledTime: dateTime,
        notes: notes
      });

      if (data?.id) notifyEmail('new_request', data.id);

      alert(`✅ Video chat requested with ${selectedConnection.connected_user?.name || selectedConnection.name}!`);
      
      setShowScheduleModal(false);
      setScheduledDate('');
      setScheduledTime('');
      setNotes('');
      loadCoffeeChats();
      loadSentRequests();
      
      // Switch to sent requests tab to see the request
      setActiveTab('sent');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleAccept = async (chatId) => {
    try {
      await acceptCoffeeChat(supabase, chatId);
      notifyEmail('accepted', chatId);
      alert('✅ Video chat accepted! Video room created.');
      await loadCoffeeChats();
      await loadPendingRequests();
      await loadSentRequests();
      
      // Switch to upcoming tab to see the accepted chat
      setActiveTab('upcoming');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleDecline = async (chatId) => {
    if (!confirm('Decline this video chat request?')) return;

    try {
      await declineCoffeeChat(supabase, chatId);
      notifyEmail('declined', chatId);
      loadPendingRequests();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleCancel = async (chatId) => {
    if (!confirm('Cancel this video chat?')) return;
    
    try {
      await cancelCoffeeChat(supabase, chatId);
      loadCoffeeChats();
      loadSentRequests();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const getPartnerInfo = (chat) => {
    const isRequester = chat.requester_id === currentUser.id;
    const partner = isRequester ? chat.recipient : chat.requester;
    return partner || { name: 'Unknown User', career: 'No career info', email: '' };
  };

  const upcomingChats = coffeeChats.filter(
    chat => chat.status === 'accepted' && new Date(chat.scheduled_time) > new Date()
  );

  const pastChats = coffeeChats.filter(
    chat => chat.status === 'completed' || 
           (chat.status === 'accepted' && new Date(chat.scheduled_time) <= new Date())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading video chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
        <div className="flex items-center mb-2">
          <Video className="w-6 h-6 mr-2 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">1:1 Video Chats</h3>
        </div>
        <p className="text-sm text-gray-600">
          Schedule virtual video chats with people you've connected with at meetups
        </p>
      </div>

      {/* Pending Requests Badge */}
      {pendingRequests.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 cursor-pointer"
             onClick={() => setActiveTab('requests')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <MessageCircle className="w-5 h-5 mr-2 text-rose-600" />
              <span className="font-medium text-rose-800">
                {pendingRequests.length} pending {pendingRequests.length === 1 ? 'request' : 'requests'}
              </span>
            </div>
            <span className="text-rose-600 text-sm">View →</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap flex-shrink-0 whitespace-nowrap flex-shrink-0 ${
            activeTab === 'schedule'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Schedule New
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
            activeTab === 'upcoming'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Upcoming ({upcomingChats.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap flex-shrink-0 relative ${
            activeTab === 'requests'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Requests
          {pendingRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
            activeTab === 'sent'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Sent ({sentRequests.length})
        </button>
      </div>

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {connections.length === 0 ? (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-amber-600" />
              </div>
              <h4 className="font-semibold text-amber-800 text-lg mb-2">No connections yet</h4>
              <p className="text-amber-700 mb-2">
                To schedule 1:1 coffee chats, you first need to make connections.
              </p>
              <div className="bg-white/60 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800">
                  <strong>How it works:</strong> Attend a group meetup → Meet people → Express interest → Mutual matches become connections!
                </p>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('home')}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
                >
                  Find Meetups to Join
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Choose a connection to schedule a 1:1 video coffee chat
              </p>
              {connections.map(conn => {
                const person = conn.connected_user || conn;
                return (
                  <div key={conn.id} className="bg-white rounded-lg shadow p-5 border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 text-lg">{person.name}</h4>
                        <p className="text-sm text-gray-600 mb-1">{person.career}</p>
                        {person.city && person.state && (
                          <p className="text-xs text-gray-500">{person.city}, {person.state}</p>
                        )}
                        {conn.met_at && (
                          <p className="text-xs text-purple-600 mt-1">
                            Met at: {conn.met_at}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleScheduleClick({ ...conn, connected_user: person })}
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule Coffee Chat
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Upcoming Tab */}
      {activeTab === 'upcoming' && (
        <div>
          {upcomingChats.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <Calendar style={{ width: '48px', height: '48px', color: '#D4C4B0', margin: '0 auto 12px' }} />
              <p style={{ color: '#7A5C42', fontSize: '15px', margin: 0, fontFamily: '"Lora", serif' }}>No upcoming coffee chats</p>
              <p style={{ color: '#B8A089', fontSize: '13px', marginTop: '4px', fontFamily: '"Lora", serif' }}>
                {connections.length > 0
                  ? 'Schedule a 1:1 chat to get to know your connections better!'
                  : 'Make connections at meetups first, then come back to schedule 1:1 chats!'}
              </p>
              <button
                onClick={() => connections.length > 0 ? setActiveTab('schedule') : onNavigate?.('home')}
                style={{
                  background: 'rgba(88, 66, 51, 0.9)', color: '#F5EDE9', border: 'none',
                  padding: '10px 24px', borderRadius: '18px', marginTop: '16px',
                  fontFamily: '"Lora", serif', fontStyle: 'italic', fontSize: '15px', fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {connections.length > 0 ? 'Schedule a Coffee Chat' : 'Find Meetups'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {upcomingChats.map((chat, idx) => {
                const partner = getPartnerInfo(chat);
                const chatDate = new Date(chat.scheduled_time);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const eventDay = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());
                const diffDays = Math.round((eventDay - today) / (1000 * 60 * 60 * 24));
                const isSoon = (chatDate - now) < 60 * 60 * 1000 && chatDate > now;
                const isLive = now >= chatDate && now <= new Date(chatDate.getTime() + 30 * 60 * 1000);

                const isHighlight = diffDays <= 1;
                const month = chatDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                const day = chatDate.getDate();
                let dayLabel;
                if (diffDays === 0) dayLabel = 'TODAY';
                else if (diffDays === 1) dayLabel = 'TOMOR';
                else dayLabel = chatDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

                const timeStr = chatDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                return (
                  <React.Fragment key={chat.id}>
                    {idx > 0 && (
                      <div style={{ height: '1px', background: 'rgba(139, 111, 92, 0.25)', margin: '0 8px' }} />
                    )}
                    <div
                      style={{
                        display: 'flex', gap: '16px', padding: '14px 8px',
                        transition: 'background-color 0.2s ease', cursor: 'pointer',
                        position: 'relative', borderRadius: '12px', alignItems: 'center',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF5EF'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Date Badge */}
                      <div style={{
                        minWidth: '72px', padding: '18px 8px',
                        backgroundColor: isHighlight ? 'rgba(168, 132, 98, 0.75)' : 'rgba(189, 173, 162, 0.65)',
                        borderRadius: '8px', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <span style={{
                          fontFamily: '"Lora", serif', fontSize: '11px', fontWeight: '600',
                          color: isHighlight ? '#FFF' : '#605045', letterSpacing: '0.5px', textTransform: 'uppercase',
                        }}>{dayLabel}</span>
                        <span style={{
                          fontFamily: '"Lora", serif', fontSize: '24px', fontWeight: '500',
                          color: isHighlight ? '#FFF' : '#605045', lineHeight: '33px', letterSpacing: '0.15px',
                        }}>{day}</span>
                        <span style={{
                          fontFamily: '"Lora", serif', fontSize: '12px', fontWeight: '500',
                          color: isHighlight ? 'rgba(255,255,255,0.8)' : '#9B8A7E', marginTop: '2px',
                        }}>{month}</span>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                            letterSpacing: '0.8px', padding: '3px 8px', borderRadius: '5px', flexShrink: 0,
                            background: '#F0E4D8', color: '#6B4632',
                          }}>1:1</span>
                          {isLive && (
                            <span style={{
                              fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                              letterSpacing: '0.8px', padding: '3px 8px', borderRadius: '5px',
                              background: '#FEF0EC', color: '#D45B3E',
                              display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D45B3E', animation: 'pulse-live 1.5s infinite' }} />
                              Live
                            </span>
                          )}
                          {isSoon && !isLive && (
                            <span style={{
                              fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                              letterSpacing: '0.8px', padding: '3px 8px', borderRadius: '5px', flexShrink: 0,
                              background: '#E8F5E9', color: '#2E7D32',
                            }}>Starting soon</span>
                          )}
                        </div>

                        <h4 style={{
                          fontFamily: '"Lora", serif', fontSize: '20px', fontWeight: '600',
                          color: '#523C2E', margin: 0, lineHeight: '20px', letterSpacing: '0.15px',
                        }}>
                          {chat.topic || `Coffee Chat with ${partner.name}`}
                        </h4>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: '"Lora", serif', fontSize: '15px', color: '#523C2E' }}>
                            <svg width="18" height="18" fill="none" stroke="#605045" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                            <span style={{ fontWeight: '600' }}>{timeStr}</span>
                          </div>
                          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#D4B896', flexShrink: 0 }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: '"Lora", serif', fontSize: '15px', color: '#523C2E' }}>
                            <svg width="18" height="18" fill="none" stroke="#605045" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span>{partner.name}</span>
                          </div>
                        </div>

                        {chat.notes && (
                          <p style={{ fontFamily: '"Lora", serif', fontSize: '14px', color: '#9B8A7E', fontStyle: 'italic', margin: 0 }}>
                            "{chat.notes}"
                          </p>
                        )}
                      </div>

                      {/* Action Button */}
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                        {chat.video_link ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `/call/coffee/${chat.id}`;
                            }}
                            style={{
                              background: 'rgba(88, 66, 51, 0.9)', color: '#F5EDE9', border: 'none',
                              padding: '10px 20px', borderRadius: '18px',
                              fontFamily: '"Lora", serif', fontStyle: 'italic', fontSize: '16px', fontWeight: '700',
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                              gap: '6px', whiteSpace: 'nowrap', letterSpacing: '0.15px',
                            }}
                          >
                            <Video style={{ width: '18px', height: '18px', color: 'rgba(255, 246, 238, 0.85)' }} />
                            Join
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#B8A089', fontFamily: '"Lora", serif' }}>
                            Video link pending
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancel(chat.id); }}
                          style={{
                            background: 'none', border: 'none', color: '#C48B6B',
                            fontSize: '12px', fontFamily: '"Lora", serif', cursor: 'pointer',
                            padding: '4px 8px',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No pending requests</p>
            </div>
          ) : (
            pendingRequests.map(request => {
              const requester = request.requester || {};
              const requestDate = new Date(request.scheduled_time);

              return (
                <div key={request.id} className="bg-white rounded-lg shadow p-5 border-2 border-purple-200">
                  <div className="mb-4">
                    <div className="flex items-center mb-2">
                      <div className="bg-purple-100 rounded-full p-2 mr-3">
                        <User className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{requester.name || 'Unknown User'}</h4>
                        <p className="text-sm text-gray-600">{requester.career || 'No career info'}</p>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 rounded-lg p-3 mt-3">
                      <div className="flex items-center text-sm text-gray-700 mb-1">
                        <Calendar className="w-4 h-4 mr-2 text-purple-600" />
                        {requestDate.toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div className="flex items-center text-sm text-gray-700">
                        <Clock className="w-4 h-4 mr-2 text-purple-600" />
                        {requestDate.toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>

                    {request.notes && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-700 italic">"{request.notes}"</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(request.id)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(request.id)}
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

      {/* Sent Requests Tab */}
      {activeTab === 'sent' && (
        <div className="space-y-4">
          {sentRequests.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No sent requests</p>
              <p className="text-sm text-gray-500 mt-2">
                Schedule a video chat to send a request
              </p>
            </div>
          ) : (
            sentRequests.map(request => {
              const recipient = request.recipient || {};
              const requestDate = new Date(request.scheduled_time);

              return (
                <div key={request.id} className="bg-white rounded-lg shadow p-5 border-2 border-yellow-200">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className="bg-yellow-100 rounded-full p-2 mr-3">
                          <User className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{recipient.name || 'Unknown User'}</h4>
                          <p className="text-sm text-gray-600">{recipient.career || 'No career info'}</p>
                        </div>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">
                        Pending
                      </span>
                    </div>
                    
                    <div className="bg-yellow-50 rounded-lg p-3 mt-3">
                      <div className="flex items-center text-sm text-gray-700 mb-1">
                        <Calendar className="w-4 h-4 mr-2 text-yellow-600" />
                        {requestDate.toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div className="flex items-center text-sm text-gray-700">
                        <Clock className="w-4 h-4 mr-2 text-yellow-600" />
                        {requestDate.toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>

                    {request.notes && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-700 italic">"{request.notes}"</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleCancel(request.id)}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 rounded-lg transition-colors"
                  >
                    Cancel Request
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && selectedConnection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Schedule Video Chat
              </h3>
              <button 
                onClick={() => setShowScheduleModal(false)} 
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center bg-purple-50 rounded-lg p-3">
                <User className="w-10 h-10 text-purple-600 mr-3" />
                <div>
                  <p className="font-semibold text-gray-800">
                    {selectedConnection.connected_user?.name || selectedConnection.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedConnection.connected_user?.career || selectedConnection.career}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time *
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., 'Looking forward to discussing marketing strategies!'"
                  className="w-full border border-gray-300 rounded-lg p-3 h-20 resize-none focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={!scheduledDate || !scheduledTime}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

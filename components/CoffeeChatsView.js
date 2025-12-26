// components/CoffeeChatsView.js
// Main view for 1:1 virtual coffee chats

'use client';

import { useState, useEffect } from 'react';
import { Video, Calendar, Clock, User, Check, X, MessageCircle } from 'lucide-react';
import { 
  requestCoffeeChat, 
  acceptCoffeeChat, 
  declineCoffeeChat, 
  cancelCoffeeChat,
  getMyCoffeeChats,
  getPendingRequests 
} from '@/lib/coffeeChatHelpers';
import VideoCallButton from './VideoCallButton';

export default function CoffeeChatsView({ currentUser, connections, supabase }) {
  const [activeTab, setActiveTab] = useState('schedule'); // schedule, upcoming, requests
  const [coffeeChats, setCoffeeChats] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadCoffeeChats();
    loadPendingRequests();
  }, []);

  const loadCoffeeChats = async () => {
    setLoading(true);
    try {
      const chats = await getMyCoffeeChats();
      setCoffeeChats(chats);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const requests = await getPendingRequests();
      setPendingRequests(requests);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const handleScheduleClick = (connection) => {
    setSelectedConnection(connection);
    setShowScheduleModal(true);
  };

  const handleSubmitRequest = async () => {
    if (!scheduledDate || !scheduledTime) {
      alert('Please select date and time');
      return;
    }

    try {
      const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      
      await requestCoffeeChat({
        recipientId: selectedConnection.connected_user_id || selectedConnection.id,
        scheduledTime: dateTime,
        notes: notes
      });

      alert(`✅ Coffee chat requested with ${selectedConnection.connected_user?.name || selectedConnection.name}!`);
      
      setShowScheduleModal(false);
      setScheduledDate('');
      setScheduledTime('');
      setNotes('');
      loadCoffeeChats();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleAccept = async (chatId) => {
    try {
      await acceptCoffeeChat(chatId);
      alert('✅ Coffee chat accepted! Video room created.');
      loadCoffeeChats();
      loadPendingRequests();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleDecline = async (chatId) => {
    if (!confirm('Decline this coffee chat request?')) return;
    
    try {
      await declineCoffeeChat(chatId);
      loadPendingRequests();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleCancel = async (chatId) => {
    if (!confirm('Cancel this coffee chat?')) return;
    
    try {
      await cancelCoffeeChat(chatId);
      loadCoffeeChats();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const getPartnerInfo = (chat) => {
    const isRequester = chat.requester_id === currentUser.id;
    return isRequester ? chat.recipient : chat.requester;
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
          <p className="text-gray-600">Loading coffee chats...</p>
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
          <h3 className="text-lg font-semibold text-gray-800">1:1 Coffee Chats</h3>
        </div>
        <p className="text-sm text-gray-600">
          Schedule virtual coffee chats with people you've connected with at meetups
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
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'schedule'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Schedule New
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'upcoming'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Upcoming ({upcomingChats.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-medium transition-colors relative ${
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
      </div>

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {connections.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
              <User className="w-12 h-12 text-amber-600 mx-auto mb-3" />
              <h4 className="font-semibold text-amber-800 mb-2">No connections yet</h4>
              <p className="text-sm text-amber-700 mb-4">
                Attend in-person meetups to make connections first!
              </p>
              <button className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors">
                Browse Meetups
              </button>
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
        <div className="space-y-4">
          {upcomingChats.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No upcoming coffee chats</p>
              <p className="text-sm text-gray-500 mt-2">Schedule one with your connections!</p>
            </div>
          ) : (
            upcomingChats.map(chat => {
              const partner = getPartnerInfo(chat);
              const chatDate = new Date(chat.scheduled_time);
              const isToday = chatDate.toDateString() === new Date().toDateString();
              const isSoon = (chatDate - new Date()) < 30 * 60 * 1000; // Within 30 minutes

              return (
                <div key={chat.id} className={`bg-white rounded-lg shadow p-5 border-2 ${
                  isSoon ? 'border-green-500' : 'border-gray-200'
                }`}>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-800">{partner.name}</h4>
                      {isToday && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Today!
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{partner.career}</p>
                    <div className="flex items-center text-sm text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 mr-2 text-purple-500" />
                      {chatDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="flex items-center text-sm text-gray-700">
                      <Clock className="w-4 h-4 mr-2 text-purple-500" />
                      {chatDate.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                      })}
                    </div>
                    {chat.notes && (
                      <p className="text-sm text-gray-600 mt-2 italic">"{chat.notes}"</p>
                    )}
                  </div>

                  {chat.video_link && (
                    <div className="space-y-2">
                      <VideoCallButton meetup={chat} />
                    </div>
                  )}

                  <button
                    onClick={() => handleCancel(chat.id)}
                    className="w-full mt-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 rounded-lg transition-colors text-sm"
                  >
                    Cancel Chat
                  </button>
                </div>
              );
            })
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
              const requester = request.requester;
              const requestDate = new Date(request.scheduled_time);

              return (
                <div key={request.id} className="bg-white rounded-lg shadow p-5 border-2 border-purple-200">
                  <div className="mb-4">
                    <div className="flex items-center mb-2">
                      <div className="bg-purple-100 rounded-full p-2 mr-3">
                        <User className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{requester.name}</h4>
                        <p className="text-sm text-gray-600">{requester.career}</p>
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

      {/* Schedule Modal */}
      {showScheduleModal && selectedConnection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Schedule Coffee Chat
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

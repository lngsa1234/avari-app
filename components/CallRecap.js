'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * CallRecap - Shows a summary after a video call ends
 * Displays: duration, participants, chat highlights, and connection suggestions
 */
export default function CallRecap({
  channelName,
  startedAt,
  endedAt,
  participants = [], // Array of { id, name, email, profile_picture }
  currentUserId,
  onClose,
  onConnect
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calculate duration
  const getDuration = () => {
    if (!startedAt) return 'Unknown duration';

    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (diffHours > 0) {
      return `${diffHours}h ${remainingMins}m`;
    }
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  };

  // Load chat messages from the call
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('call_messages')
          .select('*')
          .eq('channel_name', channelName)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setMessages(data);
        }
      } catch (err) {
        console.error('Error loading recap messages:', err);
      } finally {
        setLoading(false);
      }
    };

    if (channelName) {
      loadMessages();
    } else {
      setLoading(false);
    }
  }, [channelName]);

  // Get unique participants from messages if not provided
  const getParticipantsFromMessages = () => {
    const uniqueUsers = new Map();
    messages.forEach(msg => {
      if (msg.user_id !== currentUserId && !uniqueUsers.has(msg.user_id)) {
        uniqueUsers.set(msg.user_id, {
          id: msg.user_id,
          name: msg.user_name,
          email: msg.user_name
        });
      }
    });
    return Array.from(uniqueUsers.values());
  };

  // Get chat highlights (first few messages as summary)
  const getChatHighlights = () => {
    if (messages.length === 0) return [];
    // Return up to 5 messages as highlights
    return messages.slice(0, 5);
  };

  const displayParticipants = participants.length > 0
    ? participants.filter(p => p.id !== currentUserId)
    : getParticipantsFromMessages();

  const chatHighlights = getChatHighlights();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-6 rounded-t-2xl">
          <div className="text-center">
            <span className="text-4xl mb-2 block">&#9996;</span>
            <h2 className="text-white text-2xl font-bold">Call Ended</h2>
            <p className="text-rose-100 mt-1">Here's your call recap</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Duration */}
          <div className="bg-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">&#128337;</span>
              <div>
                <p className="text-gray-400 text-sm">Duration</p>
                <p className="text-white text-xl font-semibold">{getDuration()}</p>
              </div>
            </div>
          </div>

          {/* Participants */}
          {displayParticipants.length > 0 && (
            <div className="bg-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">&#128101;</span>
                <p className="text-gray-400 text-sm">
                  You connected with {displayParticipants.length} {displayParticipants.length === 1 ? 'person' : 'people'}
                </p>
              </div>
              <div className="space-y-3">
                {displayParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between bg-gray-600 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      {participant.profile_picture ? (
                        <img
                          src={participant.profile_picture}
                          alt={participant.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {(participant.name || participant.email || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-white font-medium">
                          {participant.name || participant.email || 'Unknown'}
                        </p>
                        {participant.career && (
                          <p className="text-gray-400 text-sm">{participant.career}</p>
                        )}
                      </div>
                    </div>
                    {onConnect && (
                      <button
                        onClick={() => onConnect(participant.id)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Highlights */}
          {chatHighlights.length > 0 && (
            <div className="bg-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">&#128172;</span>
                <p className="text-gray-400 text-sm">Chat Highlights</p>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {chatHighlights.map((msg) => (
                  <div key={msg.id} className="bg-gray-600 rounded-lg p-2">
                    <p className="text-gray-300 text-xs mb-1">
                      {msg.user_id === currentUserId ? 'You' : msg.user_name}
                    </p>
                    <p className="text-white text-sm">{msg.message}</p>
                  </div>
                ))}
                {messages.length > 5 && (
                  <p className="text-gray-400 text-xs text-center mt-2">
                    +{messages.length - 5} more messages
                  </p>
                )}
              </div>
            </div>
          )}

          {/* No activity message */}
          {displayParticipants.length === 0 && chatHighlights.length === 0 && !loading && (
            <div className="text-center py-4">
              <p className="text-gray-400">No other participants joined this call.</p>
            </div>
          )}

          {/* Stats summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {displayParticipants.length}
              </p>
              <p className="text-gray-400 text-sm">Participants</p>
            </div>
            <div className="bg-gray-700 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {messages.length}
              </p>
              <p className="text-gray-400 text-sm">Messages</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white py-3 rounded-xl font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

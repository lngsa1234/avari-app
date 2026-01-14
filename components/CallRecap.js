'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * CallRecap - Enhanced post-call summary with transcription and metrics
 *
 * Displays:
 * - Call duration and participant list
 * - Transcription (if available from LiveKit)
 * - AI-generated summary (if enabled)
 * - Performance metrics (connection quality, latency)
 * - Chat highlights
 * - Connection suggestions
 */
export default function CallRecap({
  channelName,
  callType = 'meetup', // '1on1', 'meetup', 'group'
  provider = 'unknown', // 'webrtc', 'livekit', 'agora'
  startedAt,
  endedAt,
  participants = [],
  currentUserId,
  transcript = [], // Array of { speakerId, speakerName, text, timestamp }
  metrics = null, // { latency, packetLoss, connectionQuality }
  onClose,
  onConnect
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'transcript', 'metrics'

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

  const getDurationSeconds = () => {
    if (!startedAt) return 0;
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    return Math.floor((end - start) / 1000);
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

  // Generate AI summary if transcript is available
  const generateAiSummary = async () => {
    if (transcript.length === 0 && messages.length === 0) return;

    setGeneratingSummary(true);
    try {
      const response = await fetch('/api/generate-recap-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          messages,
          participants,
          duration: getDurationSeconds()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiSummary(data.summary);
      }
    } catch (err) {
      console.error('Error generating AI summary:', err);
    } finally {
      setGeneratingSummary(false);
    }
  };

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

  const displayParticipants = participants.length > 0
    ? participants.filter(p => p.id !== currentUserId)
    : getParticipantsFromMessages();

  const chatHighlights = messages.slice(0, 5);

  // Connection quality color
  const getQualityColor = (quality) => {
    switch (quality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  // Provider badge color
  const getProviderColor = () => {
    switch (provider) {
      case 'livekit': return 'bg-blue-600';
      case 'agora': return 'bg-purple-600';
      case 'webrtc': return 'bg-green-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-6 flex-shrink-0">
          <div className="text-center">
            <span className="text-4xl mb-2 block">&#9996;</span>
            <h2 className="text-white text-2xl font-bold">Call Ended</h2>
            <p className="text-rose-100 mt-1">Here's your call recap</p>
            <div className="mt-2 flex justify-center gap-2">
              <span className={`${getProviderColor()} text-white text-xs px-2 py-1 rounded-full`}>
                {provider.toUpperCase()}
              </span>
              <span className="bg-gray-700 text-white text-xs px-2 py-1 rounded-full">
                {callType === '1on1' ? '1:1 Call' : callType === 'meetup' ? 'Meetup' : 'Group Call'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 flex-shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              activeTab === 'overview' ? 'text-white border-b-2 border-rose-500' : 'text-gray-400'
            }`}
          >
            Overview
          </button>
          {transcript.length > 0 && (
            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex-1 py-3 text-sm font-medium transition ${
                activeTab === 'transcript' ? 'text-white border-b-2 border-rose-500' : 'text-gray-400'
              }`}
            >
              Transcript ({transcript.length})
            </button>
          )}
          {metrics && (
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex-1 py-3 text-sm font-medium transition ${
                activeTab === 'metrics' ? 'text-white border-b-2 border-rose-500' : 'text-gray-400'
              }`}
            >
              Metrics
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Duration & Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-700 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-white">{getDuration()}</p>
                  <p className="text-gray-400 text-sm">Duration</p>
                </div>
                <div className="bg-gray-700 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-purple-400">{displayParticipants.length}</p>
                  <p className="text-gray-400 text-sm">Participants</p>
                </div>
                <div className="bg-gray-700 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-purple-400">{messages.length}</p>
                  <p className="text-gray-400 text-sm">Messages</p>
                </div>
              </div>

              {/* AI Summary */}
              {(transcript.length > 0 || messages.length > 0) && (
                <div className="bg-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">&#129302;</span>
                      <p className="text-gray-400 text-sm">AI Summary</p>
                    </div>
                    {!aiSummary && (
                      <button
                        onClick={generateAiSummary}
                        disabled={generatingSummary}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition"
                      >
                        {generatingSummary ? 'Generating...' : 'Generate'}
                      </button>
                    )}
                  </div>
                  {aiSummary ? (
                    <p className="text-white text-sm">{aiSummary}</p>
                  ) : (
                    <p className="text-gray-500 text-sm italic">
                      Click 'Generate' to create an AI summary of this call
                    </p>
                  )}
                </div>
              )}

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
            </>
          )}

          {/* Transcript Tab */}
          {activeTab === 'transcript' && transcript.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Call Transcript</h3>
                <span className="text-gray-400 text-sm">{transcript.length} entries</span>
              </div>
              {transcript.map((entry, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-purple-400 text-sm font-medium">
                      {entry.speakerName || 'Unknown Speaker'}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-white text-sm">{entry.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Metrics Tab */}
          {activeTab === 'metrics' && metrics && (
            <div className="space-y-4">
              <h3 className="text-white font-semibold mb-4">Call Quality Metrics</h3>

              {/* Connection Quality */}
              <div className="bg-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Connection Quality</span>
                  <span className={`font-semibold ${getQualityColor(metrics.connectionQuality)}`}>
                    {metrics.connectionQuality?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
              </div>

              {/* Detailed Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700 rounded-xl p-4">
                  <p className="text-gray-400 text-sm">Latency</p>
                  <p className="text-white text-xl font-semibold">
                    {metrics.latency || 0}ms
                  </p>
                </div>
                <div className="bg-gray-700 rounded-xl p-4">
                  <p className="text-gray-400 text-sm">Packet Loss</p>
                  <p className="text-white text-xl font-semibold">
                    {metrics.packetLoss?.toFixed(1) || 0}%
                  </p>
                </div>
                <div className="bg-gray-700 rounded-xl p-4">
                  <p className="text-gray-400 text-sm">Bitrate</p>
                  <p className="text-white text-xl font-semibold">
                    {metrics.bitrate || 0} kbps
                  </p>
                </div>
                <div className="bg-gray-700 rounded-xl p-4">
                  <p className="text-gray-400 text-sm">Resolution</p>
                  <p className="text-white text-xl font-semibold">
                    {metrics.videoResolution || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Provider Info */}
              <div className="bg-gray-700 rounded-xl p-4">
                <p className="text-gray-400 text-sm mb-2">Provider Details</p>
                <div className="flex items-center gap-4">
                  <span className={`${getProviderColor()} text-white text-sm px-3 py-1 rounded-full`}>
                    {provider.toUpperCase()}
                  </span>
                  <span className="text-gray-300 text-sm">
                    {provider === 'livekit' && 'LiveKit (Large Groups)'}
                    {provider === 'agora' && 'Agora (Small Groups)'}
                    {provider === 'webrtc' && 'WebRTC (Peer-to-Peer)'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex-shrink-0">
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

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getRecommendationsForCall,
  updateConnectionRecommendationStatus,
  updateGroupRecommendationStatus,
  createGroupFromRecommendation,
  requestToJoinGroup,
  createConnectionFromRecommendation,
  fetchSuggestedMemberProfiles
} from '@/lib/connectionRecommendationHelpers';
import { updateRecapSummaryByChannel } from '@/lib/callRecapHelpers';

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
 * - AI-powered connection and group recommendations
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
  onConnect,
  meetupId // For fetching recommendations
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState(null);
  const [topicsDiscussed, setTopicsDiscussed] = useState([]);
  const [keyTakeaways, setKeyTakeaways] = useState([]);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'transcript', 'metrics', 'recommendations'

  // Recommendations state
  const [connectionRecs, setConnectionRecs] = useState([]);
  const [groupRecs, setGroupRecs] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState({}); // Cache for suggested member profiles
  const [connectedUserIds, setConnectedUserIds] = useState(new Set()); // Already connected users

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
          // Auto-generate summary after messages are loaded
          if (data.length > 0 || transcript.length > 0) {
            generateAiSummaryInternal(data);
          }
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
      // Still try to generate summary if we have transcript
      if (transcript.length > 0) {
        generateAiSummaryInternal([]);
      }
    }
  }, [channelName]);

  // Load recommendations for this call
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!channelName || !currentUserId) return;

      setLoadingRecs(true);
      try {
        const { connectionRecs: connRecs, groupRecs: grpRecs } = await getRecommendationsForCall(
          supabase,
          channelName,
          currentUserId
        );

        setConnectionRecs(connRecs || []);
        setGroupRecs(grpRecs || []);

        // Load member profiles for form_new recommendations
        const formNewRecs = (grpRecs || []).filter(r => r.recommendation_type === 'form_new');
        if (formNewRecs.length > 0) {
          const allMemberIds = formNewRecs.flatMap(r => r.suggested_members || []);
          const uniqueMemberIds = [...new Set(allMemberIds)];
          if (uniqueMemberIds.length > 0) {
            const profiles = await fetchSuggestedMemberProfiles(supabase, uniqueMemberIds);
            const profileMap = {};
            profiles.forEach(p => { profileMap[p.id] = p; });
            setMemberProfiles(profileMap);
          }
        }
      } catch (err) {
        console.error('Error loading recommendations:', err);
      } finally {
        setLoadingRecs(false);
      }
    };

    // Delay slightly to allow recommendations to be generated
    const timer = setTimeout(loadRecommendations, 1000);
    return () => clearTimeout(timer);
  }, [channelName, currentUserId]);

  // Load existing connections to check if users are already connected
  useEffect(() => {
    const loadExistingConnections = async () => {
      if (!currentUserId) return;

      try {
        const { data, error } = await supabase
          .from('user_interests')
          .select('interested_in_user_id')
          .eq('user_id', currentUserId);

        if (!error && data) {
          setConnectedUserIds(new Set(data.map(c => c.interested_in_user_id)));
        }
      } catch (err) {
        console.error('Error loading existing connections:', err);
      }
    };

    loadExistingConnections();
  }, [currentUserId]);

  // Internal function to generate AI summary
  const generateAiSummaryInternal = async (loadedMessages) => {
    const msgs = loadedMessages || messages;
    if (transcript.length === 0 && msgs.length === 0) return;
    if (generatingSummary || aiSummary) return; // Prevent duplicate calls

    setGeneratingSummary(true);
    try {
      const response = await fetch('/api/generate-recap-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          messages: msgs,
          participants,
          duration: getDurationSeconds()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiSummary(data.summary);
        setTopicsDiscussed(data.topicsDiscussed || []);
        setKeyTakeaways(data.keyTakeaways || []);

        // Save the AI summary to the database
        if (channelName && data.summary) {
          // Build a complete summary string that includes all structured data
          const fullSummary = buildFullSummary(data);
          await updateRecapSummaryByChannel(channelName, fullSummary);
        }
      }
    } catch (err) {
      console.error('Error generating AI summary:', err);
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Build a full summary string that includes all structured data for storage
  const buildFullSummary = (data) => {
    let summary = data.summary || '';

    if (data.keyTakeaways && data.keyTakeaways.length > 0) {
      summary += '\n\nKey Takeaways:\n';
      data.keyTakeaways.forEach(t => {
        const text = typeof t === 'string' ? t : (t.text || t);
        const emoji = typeof t === 'object' && t.emoji ? t.emoji + ' ' : '• ';
        summary += `${emoji}${text}\n`;
      });
    }

    if (data.actionItems && data.actionItems.length > 0) {
      summary += '\nAction Items:\n';
      data.actionItems.forEach(a => {
        const text = typeof a === 'string' ? a : (a.text || a);
        summary += `• ${text}\n`;
      });
    }

    if (data.topicsDiscussed && data.topicsDiscussed.length > 0) {
      summary += '\nTopics Discussed:\n';
      data.topicsDiscussed.forEach(t => {
        const topic = typeof t === 'string' ? t : (t.topic || t);
        summary += `• ${topic}\n`;
      });
    }

    return summary.trim();
  };

  // Public function for manual regeneration
  const generateAiSummary = () => {
    // Reset current state to allow regeneration
    setAiSummary(null);
    setTopicsDiscussed([]);
    setKeyTakeaways([]);
    // Then generate new summary
    setTimeout(() => generateAiSummaryInternal(messages), 0);
  };

  // Handle connection recommendation actions
  const handleConnectFromRec = async (rec) => {
    const result = await createConnectionFromRecommendation(supabase, rec);
    if (result.success) {
      setConnectionRecs(prev => prev.map(r =>
        r.id === rec.id ? { ...r, status: 'connected' } : r
      ));
      // Also trigger the original onConnect if provided
      if (onConnect) {
        onConnect(rec.recommended_user_id);
      }
    }
  };

  const handleDismissConnectionRec = async (recId) => {
    await updateConnectionRecommendationStatus(supabase, recId, 'dismissed');
    setConnectionRecs(prev => prev.filter(r => r.id !== recId));
  };

  // Handle group recommendation actions
  const handleCreateGroup = async (rec) => {
    const result = await createGroupFromRecommendation(supabase, rec, currentUserId);
    if (result.success) {
      setGroupRecs(prev => prev.map(r =>
        r.id === rec.id ? { ...r, status: 'acted', result_group_id: result.group.id } : r
      ));
      alert(`Group "${rec.suggested_name}" created! Invitations sent to members.`);
    } else {
      alert('Failed to create group. Please try again.');
    }
  };

  const handleJoinGroup = async (rec) => {
    const result = await requestToJoinGroup(supabase, rec.suggested_group_id, currentUserId);
    if (result.success) {
      await updateGroupRecommendationStatus(supabase, rec.id, 'acted', rec.suggested_group_id);
      setGroupRecs(prev => prev.map(r =>
        r.id === rec.id ? { ...r, status: 'acted' } : r
      ));
      alert('Join request sent! The group admin will review your request.');
    } else {
      alert(result.error || 'Failed to join group. Please try again.');
    }
  };

  const handleDismissGroupRec = async (recId) => {
    await updateGroupRecommendationStatus(supabase, recId, 'dismissed');
    setGroupRecs(prev => prev.filter(r => r.id !== recId));
  };

  // Helper to get display name for a participant
  const getDisplayName = (participant) => {
    if (participant.name && participant.name !== 'Unknown' && !participant.name.includes('-')) {
      return participant.name;
    }
    if (participant.email) {
      // If email, show the part before @
      const emailPart = participant.email.split('@')[0];
      // Capitalize first letter
      return emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
    }
    return 'Participant';
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

  const displayParticipants = (participants.length > 0
    ? participants.filter(p => p.id !== currentUserId)
    : getParticipantsFromMessages()
  ).map(p => ({
    ...p,
    displayName: getDisplayName(p)
  }));

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
          {(connectionRecs.length > 0 || groupRecs.length > 0 || loadingRecs) && (
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`flex-1 py-3 text-sm font-medium transition ${
                activeTab === 'recommendations' ? 'text-white border-b-2 border-rose-500' : 'text-gray-400'
              }`}
            >
              <span className="mr-1">&#10024;</span>
              Suggestions {connectionRecs.length + groupRecs.length > 0 && `(${connectionRecs.length + groupRecs.length})`}
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
                    {aiSummary && !generatingSummary && (
                      <button
                        onClick={generateAiSummary}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-lg text-xs font-medium transition"
                      >
                        Regenerate
                      </button>
                    )}
                  </div>
                  {generatingSummary ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-400 text-sm">Generating summary...</p>
                    </div>
                  ) : aiSummary ? (
                    <p className="text-white text-sm">{aiSummary}</p>
                  ) : (
                    <p className="text-gray-500 text-sm italic">
                      No summary available
                    </p>
                  )}
                </div>
              )}

              {/* Topics Discussed */}
              {topicsDiscussed.length > 0 && (
                <div className="bg-gray-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">&#128172;</span>
                    <p className="text-gray-400 text-sm">Topics Discussed</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topicsDiscussed.map((topic, index) => (
                      <span
                        key={index}
                        className="bg-purple-600/30 text-purple-300 px-3 py-1.5 rounded-full text-sm"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Takeaways */}
              {keyTakeaways.length > 0 && (
                <div className="bg-gray-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">&#128161;</span>
                    <p className="text-gray-400 text-sm">Key Takeaways</p>
                  </div>
                  <ul className="space-y-2">
                    {keyTakeaways.map((takeaway, index) => (
                      <li key={index} className="flex items-start gap-2 text-white text-sm">
                        <span className="text-green-400 mt-0.5">&#10003;</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
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
                              alt={participant.displayName}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold">
                                {participant.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-white font-medium">
                              {participant.displayName}
                            </p>
                            {participant.career && (
                              <p className="text-gray-400 text-sm">{participant.career}</p>
                            )}
                          </div>
                        </div>
                        {connectedUserIds.has(participant.id) ? (
                          <span className="text-green-400 text-sm flex items-center gap-1">
                            <span>&#10003;</span> Connected
                          </span>
                        ) : onConnect && (
                          <button
                            onClick={() => {
                              onConnect(participant.id);
                              // Update local state immediately
                              setConnectedUserIds(prev => new Set([...prev, participant.id]));
                            }}
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

          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && (
            <div className="space-y-6">
              {loadingRecs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-2 text-gray-400">Loading suggestions...</span>
                </div>
              ) : (
                <>
                  {/* Connection Recommendations */}
                  {connectionRecs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">&#129309;</span>
                        <h3 className="text-white font-semibold">People to Connect</h3>
                        <span className="text-gray-400 text-sm">Based on your conversation</span>
                      </div>
                      <div className="space-y-3">
                        {connectionRecs.map(rec => (
                          <ConnectionRecommendationCard
                            key={rec.id}
                            recommendation={rec}
                            onConnect={() => handleConnectFromRec(rec)}
                            onDismiss={() => handleDismissConnectionRec(rec.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Group Recommendations */}
                  {groupRecs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">&#128101;</span>
                        <h3 className="text-white font-semibold">Groups for You</h3>
                        <span className="text-gray-400 text-sm">Form cohorts or join existing</span>
                      </div>
                      <div className="space-y-3">
                        {groupRecs.map(rec => (
                          <GroupRecommendationCard
                            key={rec.id}
                            recommendation={rec}
                            memberProfiles={memberProfiles}
                            onCreateGroup={() => handleCreateGroup(rec)}
                            onJoinGroup={() => handleJoinGroup(rec)}
                            onDismiss={() => handleDismissGroupRec(rec.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {connectionRecs.length === 0 && groupRecs.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <span className="text-4xl block mb-2">&#129302;</span>
                      <p>No suggestions yet.</p>
                      <p className="text-sm mt-1">AI recommendations will appear here after the call.</p>
                    </div>
                  )}
                </>
              )}
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

/**
 * Connection Recommendation Card Component
 */
function ConnectionRecommendationCard({ recommendation, onConnect, onDismiss }) {
  const user = recommendation.recommended_user;
  const matchPercent = Math.round((recommendation.match_score || 0) * 100);

  const getDisplayName = (u) => {
    if (u?.name && u.name !== 'Unknown') return u.name;
    if (u?.email) return u.email.split('@')[0];
    return 'User';
  };

  return (
    <div className="bg-gray-700 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {user?.profile_picture ? (
            <img
              src={user.profile_picture}
              alt={getDisplayName(user)}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-lg">
                {getDisplayName(user).charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h4 className="text-white font-medium">{getDisplayName(user)}</h4>
            {user?.career && (
              <p className="text-gray-400 text-sm">{user.career}</p>
            )}
          </div>
        </div>

        {/* Match Score Badge */}
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          matchPercent >= 80 ? 'bg-green-600 text-white' :
          matchPercent >= 60 ? 'bg-blue-600 text-white' :
          'bg-gray-600 text-gray-300'
        }`}>
          {matchPercent}% match
        </div>
      </div>

      {/* AI Reason */}
      <p className="text-gray-300 text-sm mt-3 mb-2">
        <span className="text-purple-400">Why connect: </span>
        {recommendation.reason}
      </p>

      {/* Shared Topics */}
      {recommendation.shared_topics?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {recommendation.shared_topics.map((topic, idx) => (
            <span
              key={idx}
              className="bg-gray-600 text-gray-300 text-xs px-2 py-0.5 rounded-full"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        {recommendation.status === 'connected' ? (
          <span className="text-green-400 text-sm flex items-center gap-1">
            <span>&#10003;</span> Connected
          </span>
        ) : (
          <>
            <button
              onClick={onConnect}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium transition"
            >
              Connect
            </button>
            <button
              onClick={onDismiss}
              className="px-4 bg-gray-600 hover:bg-gray-500 text-gray-300 py-2 rounded-lg text-sm transition"
            >
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Group Recommendation Card Component
 */
function GroupRecommendationCard({ recommendation, memberProfiles, onCreateGroup, onJoinGroup, onDismiss }) {
  const isFormNew = recommendation.recommendation_type === 'form_new';
  const matchPercent = Math.round((recommendation.match_score || 0) * 100);

  // Get suggested member names for form_new
  const getMemberNames = () => {
    if (!recommendation.suggested_members || !memberProfiles) return [];
    return recommendation.suggested_members
      .map(id => {
        const profile = memberProfiles[id];
        if (profile?.name) return profile.name;
        if (profile?.email) return profile.email.split('@')[0];
        return null;
      })
      .filter(Boolean);
  };

  const memberNames = getMemberNames();

  return (
    <div className="bg-gray-700 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isFormNew ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-blue-500'
          }`}>
            <span className="text-white text-xl">
              {isFormNew ? '&#43;' : '&#128101;'}
            </span>
          </div>
          <div>
            <h4 className="text-white font-medium">
              {isFormNew
                ? recommendation.suggested_name || 'New Connection Group'
                : recommendation.suggested_group?.name || 'Connection Group'
              }
            </h4>
            <p className="text-gray-400 text-sm">
              {isFormNew ? 'Form a new cohort' : 'Join existing group'}
            </p>
          </div>
        </div>

        {/* Match Score */}
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          matchPercent >= 80 ? 'bg-green-600 text-white' :
          matchPercent >= 60 ? 'bg-blue-600 text-white' :
          'bg-gray-600 text-gray-300'
        }`}>
          {matchPercent}% match
        </div>
      </div>

      {/* Topic badge for form_new */}
      {isFormNew && recommendation.suggested_topic && (
        <div className="mb-2">
          <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
            {recommendation.suggested_topic}
          </span>
        </div>
      )}

      {/* Suggested members for form_new */}
      {isFormNew && memberNames.length > 0 && (
        <p className="text-gray-300 text-sm mb-2">
          <span className="text-gray-400">With: </span>
          {memberNames.join(', ')}
        </p>
      )}

      {/* AI Reason */}
      <p className="text-gray-300 text-sm mb-3">
        <span className="text-purple-400">Why: </span>
        {recommendation.reason}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        {recommendation.status === 'acted' ? (
          <span className="text-green-400 text-sm flex items-center gap-1">
            <span>&#10003;</span> {isFormNew ? 'Group Created' : 'Request Sent'}
          </span>
        ) : (
          <>
            <button
              onClick={isFormNew ? onCreateGroup : onJoinGroup}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                isFormNew
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isFormNew ? 'Create Group' : 'Request to Join'}
            </button>
            <button
              onClick={onDismiss}
              className="px-4 bg-gray-600 hover:bg-gray-500 text-gray-300 py-2 rounded-lg text-sm transition"
            >
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

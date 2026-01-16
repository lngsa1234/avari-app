'use client';

import { useState, useEffect } from 'react';
import { Phone, Clock, Users, Calendar, ChevronRight, Video, MessageSquare, Sparkles, X, UserPlus } from 'lucide-react';
import { getMyCallRecaps } from '@/lib/callRecapHelpers';
import {
  getRecommendationsForCall,
  updateConnectionRecommendationStatus,
  updateGroupRecommendationStatus,
  createGroupFromRecommendation,
  requestToJoinGroup,
  createConnectionFromRecommendation,
  fetchSuggestedMemberProfiles
} from '@/lib/connectionRecommendationHelpers';

/**
 * CallHistoryView - Browse past video call recaps
 *
 * Shows a list of past calls with:
 * - Date and duration
 * - Participants
 * - AI summary preview
 * - Click to view full recap details
 * - Connection and group recommendations
 */
export default function CallHistoryView({ currentUser, supabase }) {
  const [recaps, setRecaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecap, setSelectedRecap] = useState(null);
  const [participantProfiles, setParticipantProfiles] = useState({});

  // Recommendations state
  const [connectionRecs, setConnectionRecs] = useState([]);
  const [groupRecs, setGroupRecs] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState({});

  useEffect(() => {
    loadRecaps();
  }, []);

  // Load recommendations when a recap is selected
  useEffect(() => {
    if (selectedRecap && selectedRecap.channel_name) {
      loadRecommendations(selectedRecap.channel_name);
    } else {
      setConnectionRecs([]);
      setGroupRecs([]);
    }
  }, [selectedRecap]);

  const loadRecommendations = async (channelName) => {
    setLoadingRecs(true);
    try {
      const { connectionRecs: connRecs, groupRecs: grpRecs } = await getRecommendationsForCall(
        supabase,
        channelName,
        currentUser.id
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

  // Recommendation action handlers
  const handleConnectFromRec = async (rec) => {
    const result = await createConnectionFromRecommendation(supabase, rec);
    if (result.success) {
      setConnectionRecs(prev => prev.map(r =>
        r.id === rec.id ? { ...r, status: 'connected' } : r
      ));
    }
  };

  const handleDismissConnectionRec = async (recId) => {
    await updateConnectionRecommendationStatus(supabase, recId, 'dismissed');
    setConnectionRecs(prev => prev.filter(r => r.id !== recId));
  };

  const handleCreateGroup = async (rec) => {
    const result = await createGroupFromRecommendation(supabase, rec, currentUser.id);
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
    const result = await requestToJoinGroup(supabase, rec.suggested_group_id, currentUser.id);
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

  const loadRecaps = async () => {
    try {
      setLoading(true);
      const data = await getMyCallRecaps(50);
      setRecaps(data);

      // Fetch participant profiles
      const allParticipantIds = new Set();
      data.forEach(recap => {
        (recap.participant_ids || []).forEach(id => allParticipantIds.add(id));
      });

      if (allParticipantIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, career, city, state')
          .in('id', Array.from(allParticipantIds));

        const profileMap = {};
        (profiles || []).forEach(p => {
          profileMap[p.id] = p;
        });
        setParticipantProfiles(profileMap);
      }
    } catch (error) {
      console.error('Error loading call history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
  };

  const getCallTypeLabel = (callType) => {
    switch (callType) {
      case '1on1': return '1:1 Call';
      case 'meetup': return 'Group Meetup';
      case 'group': return 'Group Call';
      default: return 'Video Call';
    }
  };

  const getCallTypeColor = (callType) => {
    switch (callType) {
      case '1on1': return 'bg-blue-100 text-blue-700';
      case 'meetup': return 'bg-purple-100 text-purple-700';
      case 'group': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getParticipantNames = (recap) => {
    const ids = recap.participant_ids || [];
    const names = ids
      .filter(id => id !== currentUser.id)
      .map(id => participantProfiles[id]?.name || 'Unknown')
      .filter(Boolean);

    if (names.length === 0) return 'No participants';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names[0]} and ${names.length - 1} others`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading call history...</p>
        </div>
      </div>
    );
  }

  // Full recap detail view
  if (selectedRecap) {
    const transcript = selectedRecap.transcript || [];
    const metrics = selectedRecap.metrics || {};

    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setSelectedRecap(null)}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ChevronRight className="w-5 h-5 rotate-180 mr-1" />
            Back to Call History
          </button>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCallTypeColor(selectedRecap.call_type)}`}>
            {getCallTypeLabel(selectedRecap.call_type)}
          </span>
        </div>

        {/* Recap Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-500 p-6 text-white">
            <h2 className="text-2xl font-bold mb-2">Call Recap</h2>
            <p className="opacity-90">{formatDate(selectedRecap.started_at)}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 p-6 bg-gray-50 border-b">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{formatDuration(selectedRecap.duration_seconds)}</p>
              <p className="text-sm text-gray-500">Duration</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{selectedRecap.participant_count || 0}</p>
              <p className="text-sm text-gray-500">Participants</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{transcript.length}</p>
              <p className="text-sm text-gray-500">Transcript Lines</p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Participants */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <Users className="w-5 h-5 mr-2 text-purple-500" />
                Participants
              </h3>
              <div className="flex flex-wrap gap-2">
                {(selectedRecap.participant_ids || []).map(id => {
                  const profile = participantProfiles[id];
                  return (
                    <div
                      key={id}
                      className="flex items-center bg-gray-100 rounded-full px-3 py-1"
                    >
                      <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center mr-2">
                        <span className="text-xs font-medium text-purple-700">
                          {(profile?.name || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-gray-700">
                        {profile?.name || 'Unknown'}
                        {id === currentUser.id && ' (You)'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Summary */}
            {selectedRecap.ai_summary && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
                  AI Summary
                </h3>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-100">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedRecap.ai_summary}</p>
                </div>
              </div>
            )}

            {/* Transcript */}
            {transcript.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2 text-blue-500" />
                  Transcript
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto space-y-3">
                  {transcript.map((entry, index) => (
                    <div key={index} className="flex">
                      <div className="flex-shrink-0 w-24">
                        <span className="text-sm font-medium text-purple-600">
                          {entry.speakerName || 'Unknown'}:
                        </span>
                      </div>
                      <p className="flex-1 text-gray-700">{entry.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metrics */}
            {Object.keys(metrics).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <Video className="w-5 h-5 mr-2 text-green-500" />
                  Call Quality
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {metrics.latency && (
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-800">{metrics.latency}ms</p>
                      <p className="text-xs text-gray-500">Latency</p>
                    </div>
                  )}
                  {metrics.packetLoss !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-800">{metrics.packetLoss}%</p>
                      <p className="text-xs text-gray-500">Packet Loss</p>
                    </div>
                  )}
                  {metrics.connectionQuality && (
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-800 capitalize">{metrics.connectionQuality}</p>
                      <p className="text-xs text-gray-500">Quality</p>
                    </div>
                  )}
                  {metrics.videoResolution && (
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-800">{metrics.videoResolution}</p>
                      <p className="text-xs text-gray-500">Resolution</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Connection Recommendations */}
            {(connectionRecs.length > 0 || loadingRecs) && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <UserPlus className="w-5 h-5 mr-2 text-purple-500" />
                  People to Connect
                </h3>
                {loadingRecs ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
                    <span className="ml-2 text-gray-500">Loading suggestions...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {connectionRecs.map(rec => (
                      <div key={rec.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {rec.recommended_user?.profile_picture ? (
                              <img
                                src={rec.recommended_user.profile_picture}
                                alt={rec.recommended_user.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                                <span className="text-purple-700 font-medium">
                                  {(rec.recommended_user?.name || 'U')[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-800">
                                {rec.recommended_user?.name || 'Unknown'}
                              </p>
                              {rec.recommended_user?.career && (
                                <p className="text-sm text-gray-500">{rec.recommended_user.career}</p>
                              )}
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            (rec.match_score || 0) >= 0.8 ? 'bg-green-100 text-green-700' :
                            (rec.match_score || 0) >= 0.6 ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {Math.round((rec.match_score || 0) * 100)}% match
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          <span className="text-purple-600">Why connect:</span> {rec.reason}
                        </p>
                        {rec.shared_topics?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {rec.shared_topics.map((topic, idx) => (
                              <span key={idx} className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                                {topic}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          {rec.status === 'connected' ? (
                            <span className="text-green-600 text-sm flex items-center">
                              &#10003; Connected
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleConnectFromRec(rec)}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition"
                              >
                                Connect
                              </button>
                              <button
                                onClick={() => handleDismissConnectionRec(rec.id)}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-600 px-4 py-1.5 rounded-lg text-sm transition"
                              >
                                Not now
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Group Recommendations */}
            {groupRecs.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-blue-500" />
                  Groups for You
                </h3>
                <div className="space-y-3">
                  {groupRecs.map(rec => {
                    const isFormNew = rec.recommendation_type === 'form_new';
                    const memberNames = isFormNew && rec.suggested_members
                      ? rec.suggested_members.map(id => memberProfiles[id]?.name || 'Unknown').filter(Boolean)
                      : [];

                    return (
                      <div key={rec.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isFormNew ? 'bg-gradient-to-br from-purple-400 to-pink-400' : 'bg-blue-200'
                            }`}>
                              <span className="text-white text-lg">{isFormNew ? '+' : '👥'}</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">
                                {isFormNew
                                  ? rec.suggested_name || 'New Connection Group'
                                  : rec.suggested_group?.name || 'Connection Group'
                                }
                              </p>
                              <p className="text-sm text-gray-500">
                                {isFormNew ? 'Form a new cohort' : 'Join existing group'}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            (rec.match_score || 0) >= 0.8 ? 'bg-green-100 text-green-700' :
                            (rec.match_score || 0) >= 0.6 ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {Math.round((rec.match_score || 0) * 100)}% match
                          </span>
                        </div>
                        {isFormNew && rec.suggested_topic && (
                          <span className="inline-block bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full mb-2">
                            {rec.suggested_topic}
                          </span>
                        )}
                        {isFormNew && memberNames.length > 0 && (
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="text-gray-500">With:</span> {memberNames.join(', ')}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          <span className="text-purple-600">Why:</span> {rec.reason}
                        </p>
                        <div className="flex gap-2 mt-3">
                          {rec.status === 'acted' ? (
                            <span className="text-green-600 text-sm flex items-center">
                              &#10003; {isFormNew ? 'Group Created' : 'Request Sent'}
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => isFormNew ? handleCreateGroup(rec) : handleJoinGroup(rec)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                                  isFormNew
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                              >
                                {isFormNew ? 'Create Group' : 'Request to Join'}
                              </button>
                              <button
                                onClick={() => handleDismissGroupRec(rec.id)}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-600 px-4 py-1.5 rounded-lg text-sm transition"
                              >
                                Not now
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No content message */}
            {!selectedRecap.ai_summary && transcript.length === 0 && connectionRecs.length === 0 && groupRecs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No transcript or summary available for this call.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Call history list view
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Phone className="w-7 h-7 mr-3 text-purple-500" />
          Call History
        </h1>
        <p className="text-gray-600 mt-1">View recaps from your past video calls</p>
      </div>

      {recaps.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <Video className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Call History Yet</h3>
          <p className="text-gray-500">
            Your video call recaps will appear here after your calls end.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recaps.map((recap) => (
            <div
              key={recap.id}
              onClick={() => setSelectedRecap(recap)}
              className="bg-white rounded-xl shadow hover:shadow-md transition-shadow cursor-pointer p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header row */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCallTypeColor(recap.call_type)}`}>
                      {getCallTypeLabel(recap.call_type)}
                    </span>
                    <span className="text-sm text-gray-500 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(recap.started_at)}
                    </span>
                  </div>

                  {/* Participants */}
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    {getParticipantNames(recap)}
                  </h3>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatDuration(recap.duration_seconds)}
                    </span>
                    <span className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      {recap.participant_count || 0} participants
                    </span>
                    {recap.ai_summary && (
                      <span className="flex items-center text-yellow-600">
                        <Sparkles className="w-4 h-4 mr-1" />
                        AI Summary
                      </span>
                    )}
                  </div>

                  {/* AI Summary preview */}
                  {recap.ai_summary && (
                    <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                      {recap.ai_summary}
                    </p>
                  )}
                </div>

                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

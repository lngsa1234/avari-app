'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ChevronLeft,
  Calendar,
  Clock,
  Users,
  Sparkles,
  CheckCircle2,
  Circle,
  FileText,
  ListTodo,
  MessageSquare,
  Quote,
  Share2,
} from 'lucide-react';

const colors = {
  primary: '#8B6F5C',
  primaryDark: '#6B5344',
  cream: '#FDF8F3',
  text: '#3F1906',
  textLight: '#584233',
  textMuted: 'rgba(107, 86, 71, 0.77)',
  textSoft: '#A89080',
  border: 'rgba(139, 111, 92, 0.1)',
  sage: '#8B9E7E',
  gold: '#C9A96E',
  purple: '#9B7EC4',
  gradient: 'linear-gradient(219.16deg, rgba(247, 242, 236, 0.96) 39.76%, rgba(240, 225, 213, 0.980157) 67.53%, rgba(236, 217, 202, 0.990231) 82.33%)',
};

const fonts = {
  serif: '"Lora", Georgia, serif',
  sans: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth });
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

function parseAISummary(summary) {
  const emptyResult = {
    summary: '',
    sentiment: null,
    keyTakeaways: [],
    topicsDiscussed: [],
    memorableQuotes: [],
    actionItems: [],
    suggestedFollowUps: [],
    suggestedCircles: [],
  };

  if (!summary) return emptyResult;

  // Try JSON parse — handles both stringified JSON and raw JSON objects
  let parsed = null;
  try {
    parsed = typeof summary === 'object' ? summary : JSON.parse(summary);
  } catch (e) {
    // Not JSON — fall through to text parsing below
  }

  if (parsed && typeof parsed === 'object' && (parsed.summary || parsed.keyTakeaways || parsed.topicsDiscussed)) {
    return {
      summary: parsed.summary || '',
      sentiment: parsed.sentiment || null,
      keyTakeaways: (parsed.keyTakeaways || []).map(t => typeof t === 'string' ? t : t.text || ''),
      topicsDiscussed: (parsed.topicsDiscussed || []).map(t => ({
        topic: typeof t === 'string' ? t : (t.topic || ''),
        details: Array.isArray(t.details) ? t.details.slice(0, 2) : [],
        mentions: t.mentions || 1,
      })),
      memorableQuotes: parsed.memorableQuotes || [],
      actionItems: (parsed.actionItems || []).map(a => typeof a === 'string' ? { text: a, assignee: '' } : { text: a.text || '', assignee: a.assignee || '' }),
      suggestedFollowUps: parsed.suggestedFollowUps || [],
      suggestedCircles: (parsed.suggestedCircles || []).filter(c => c.name),
    };
  }

  const result = { ...emptyResult };
  const lines = summary.split('\n');
  let currentSection = 'summary';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const lowerLine = trimmed.toLowerCase();
    if (lowerLine.includes('key takeaway') || lowerLine.includes('takeaways:') || lowerLine.includes('highlights:')) {
      currentSection = 'takeaways'; continue;
    }
    if (lowerLine.includes('action item') || lowerLine.includes('next step') || lowerLine.includes('to-do') || lowerLine.includes('follow up')) {
      currentSection = 'actions'; continue;
    }
    if (lowerLine.includes('topic') && lowerLine.includes('discussed')) {
      currentSection = 'topics'; continue;
    }
    if (lowerLine.includes('quote') || lowerLine.includes('memorable')) {
      currentSection = 'quotes'; continue;
    }

    // Detect indented detail bullets for topics (e.g. "   - Detail text")
    if (currentSection === 'topics' && /^\s{2,}-\s/.test(line)) {
      const detailText = line.replace(/^\s*-\s*/, '').trim();
      if (detailText && result.topicsDiscussed.length > 0) {
        const lastTopic = result.topicsDiscussed[result.topicsDiscussed.length - 1];
        if (lastTopic.details.length < 2) {
          lastTopic.details.push(detailText);
        }
      }
      continue;
    }

    const cleanLine = trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    if (cleanLine) {
      if (currentSection === 'summary') {
        result.summary += (result.summary ? ' ' : '') + cleanLine;
      } else if (currentSection === 'takeaways' && cleanLine.length > 10) {
        result.keyTakeaways.push(cleanLine);
      } else if (currentSection === 'actions' && cleanLine.length > 5) {
        result.actionItems.push({ text: cleanLine, assignee: '' });
      } else if (currentSection === 'topics' && cleanLine.length > 3) {
        result.topicsDiscussed.push({ topic: cleanLine, details: [] });
      } else if (currentSection === 'quotes' && cleanLine.length > 10) {
        result.memorableQuotes.push({ quote: cleanLine, author: '' });
      }
    }
  }

  if (!result.summary && result.keyTakeaways.length === 0) {
    result.summary = summary;
  }

  return result;
}

function formatDuration(seconds) {
  if (!seconds) return '0m';
  const mins = Math.floor(seconds / 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}m`;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  try {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return timeStr;
  }
}

function getCallTypeLabel(callType) {
  switch (callType) {
    case '1on1': return '1:1';
    case 'meetup': return 'Community Event';
    case 'group': return 'Circle';
    default: return 'Coffee Chat';
  }
}

export default function CoffeeChatRecapView({ recapId, onNavigate, previousView }) {
  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 640;
  const isTablet = windowWidth >= 640 && windowWidth < 768;

  const [recap, setRecap] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [participantProfiles, setParticipantProfiles] = useState({});
  const [completedActions, setCompletedActions] = useState(new Set());
  const [signedUpProfiles, setSignedUpProfiles] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState({}); // userId -> 'connected' | 'sent' | 'incoming' | null
  const [isHost, setIsHost] = useState(false);

  const handleBack = () => {
    onNavigate?.(previousView || 'home');
  };

  useEffect(() => {
    if (recapId) loadRecap();
  }, [recapId]);

  async function loadRecap() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('call_recaps')
        .select('*')
        .eq('id', recapId)
        .single();

      if (error) throw error;

      // Look up scheduled event info based on call type
      const channelName = data.channel_name || '';
      const uuidMatch = channelName.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const entityId = uuidMatch ? uuidMatch[0] : null;

      let meetup = null;
      let group = null;
      let coffeeChat = null;
      let eventTitle = null;

      if (data.call_type === '1on1') {
        // 1:1 coffee chat — channel name is the coffee_chats ID
        const lookupId = entityId || channelName;
        const { data: chatData, error: chatError } = await supabase
          .from('coffee_chats')
          .select('id, topic, scheduled_time, requester_id, recipient_id')
          .eq('id', lookupId)
          .single();
        if (chatError) console.warn('[RecapDetail] coffee_chats lookup failed:', chatError.message);
        coffeeChat = chatData;
        eventTitle = chatData?.topic || null;
      } else if (data.call_type === 'group' && entityId) {
        // Circle meetup — try meetup first, then group
        const { data: meetupData } = await supabase
          .from('meetups')
          .select('id, topic, description, date, time, location, circle_id, created_by')
          .eq('id', entityId)
          .single();

        if (meetupData) {
          meetup = meetupData;
          // Get circle name for display
          if (meetupData.circle_id) {
            const { data: groupData } = await supabase
              .from('connection_groups')
              .select('id, name')
              .eq('id', meetupData.circle_id)
              .single();
            group = groupData;
          }
          // Use circle name + date for recurring meetups
          const meetupDate = meetupData.date ? new Date(meetupData.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          eventTitle = group?.name ? `${group.name}${meetupDate ? ' · ' + meetupDate : ''}` : meetupData.topic;
        } else {
          // Legacy: entityId might be the group ID directly
          const { data: groupData } = await supabase
            .from('connection_groups')
            .select('id, name')
            .eq('id', entityId)
            .single();
          group = groupData;
          eventTitle = groupData?.name || null;
        }
      } else if (entityId) {
        // Community event meetup
        const { data: meetupData } = await supabase
          .from('meetups')
          .select('id, topic, description, date, time, location, created_by')
          .eq('id', entityId)
          .single();
        meetup = meetupData;
        eventTitle = meetupData?.topic || null;
      }

      const enriched = {
        ...data,
        meetup,
        group,
        coffeeChat,
        meetup_title: eventTitle,
        meetup_date: meetup?.date || null,
        meetup_time: meetup?.time || null,
        meetup_location: meetup?.location || null,
      };

      setRecap(enriched);
      setParsed(parseAISummary(data.ai_summary));

      // Mark as viewed
      localStorage.setItem(`recap_viewed_${recapId}`, 'true');

      // Load participant profiles
      const participantIds = data.participant_ids || [];
      if (participantIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, profile_picture, career')
          .in('id', participantIds);

        const profileMap = {};
        (profiles || []).forEach(p => { profileMap[p.id] = p; });
        setParticipantProfiles(profileMap);
      }

      // Load signups for meetup-based events to show no-shows
      if (meetup?.id || entityId) {
        const meetupId = meetup?.id || entityId;
        const { data: signups } = await supabase
          .from('meetup_signups')
          .select('user_id')
          .eq('meetup_id', meetupId);

        if (signups && signups.length > 0) {
          const signupUserIds = signups.map(s => s.user_id).filter(Boolean);
          const { data: signupProfiles } = await supabase
            .from('profiles')
            .select('id, name, profile_picture, career')
            .in('id', signupUserIds);
          setSignedUpProfiles(signupProfiles || []);
        }
      }

      // Load connection status for participant profiles
      if (participantIds.length > 0) {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            // Check if current user is the host
            if (meetup?.created_by === authUser.id || group?.creator_id === authUser.id || data.created_by === authUser.id) {
              setIsHost(true);
            }
            const [{ data: mutualMatches }, { data: myInterests }, { data: theirInterests }] = await Promise.all([
              supabase.rpc('get_mutual_matches', { for_user_id: authUser.id }),
              supabase.from('user_interests').select('interested_in_user_id').eq('user_id', authUser.id),
              supabase.from('user_interests').select('user_id').eq('interested_in_user_id', authUser.id),
            ]);
            const status = {};
            const connectedIds = new Set((mutualMatches || []).map(m => m.matched_user_id));
            const sentIds = new Set((myInterests || []).map(i => i.interested_in_user_id));
            const incomingIds = new Set((theirInterests || []).map(i => i.user_id));
            participantIds.forEach(id => {
              if (id === authUser.id) return;
              if (connectedIds.has(id)) status[id] = 'connected';
              else if (sentIds.has(id)) status[id] = 'sent';
              else if (incomingIds.has(id)) status[id] = 'incoming';
            });
            setConnectionStatus(status);
          }
        } catch (err) {
          console.warn('[RecapDetail] Failed to load connection status:', err);
        }
      }

      // Load completed actions from localStorage
      const savedActions = localStorage.getItem('completed_recap_actions');
      if (savedActions) {
        setCompletedActions(new Set(JSON.parse(savedActions)));
      }

      // Lazy AI generation: if recap has transcript but no AI summary, generate now
      if (!data.ai_summary && data.transcript?.length > 0) {
        console.log('[RecapDetail] No AI summary found, generating lazily...');
        try {
          const participantNames = Object.values(participantProfiles || {}).map(p => p.name).filter(Boolean);
          // Fetch existing circles for AI context
          const { data: circles } = await supabase
            .from('connection_groups')
            .select('id, name')
            .eq('is_active', true);
          const response = await fetch('/api/generate-recap-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: data.transcript,
              messages: [],
              participants: participantNames.length > 0 ? participantNames : ['Participant'],
              duration: data.duration_seconds || 0,
              meetingTitle: eventTitle || 'Coffee Chat',
              meetingType: data.call_type === '1on1' ? '1:1 coffee chat' : 'circle meetup',
              existingCircles: (circles || []).map(c => ({ name: c.name, id: c.id }))
            })
          });
          if (response.ok) {
            const summaryData = await response.json();
            const aiSummaryJson = JSON.stringify(summaryData);
            await supabase
              .from('call_recaps')
              .update({ ai_summary: aiSummaryJson })
              .eq('id', data.id);
            setParsed(parseAISummary(aiSummaryJson));
            console.log('[RecapDetail] Lazy AI summary generated and saved');
          }
        } catch (genErr) {
          console.error('[RecapDetail] Lazy generation failed:', genErr);
        }
      }
    } catch (error) {
      console.error('Error loading recap:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleActionItem(actionIndex) {
    const key = `${recapId}_${actionIndex}`;
    const newCompleted = new Set(completedActions);
    if (newCompleted.has(key)) {
      newCompleted.delete(key);
    } else {
      newCompleted.add(key);
    }
    setCompletedActions(newCompleted);
    localStorage.setItem('completed_recap_actions', JSON.stringify([...newCompleted]));
  }

  // Responsive styles
  const containerPadding = isMobile ? '0 0 32px' : isTablet ? '0 4px 36px' : '0 4px 40px';
  const heroGap = isMobile ? '14px' : '16px';
  const heroPadding = isMobile ? '20px 0' : isTablet ? '20px 0' : '24px 4px';
  const titleSize = isMobile ? '20px' : isTablet ? '22px' : '24px';
  const cardPadding = isMobile ? '16px' : isTablet ? '18px' : '20px';
  const cardRadius = isMobile ? '14px' : '16px';
  const sectionTitleSize = isMobile ? '15px' : '16px';
  const metaFontSize = isMobile ? '12px' : '13px';
  const bodyFontSize = isMobile ? '13px' : '14px';

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', fontFamily: fonts.sans }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: '40px', height: '40px', border: `3px solid ${colors.border}`, borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
        <p style={{ color: colors.textMuted, fontSize: '15px' }}>Loading recap...</p>
      </div>
    );
  }

  if (!recap || !parsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', padding: '24px', textAlign: 'center', fontFamily: fonts.sans }}>
        <FileText size={isMobile ? 40 : 48} style={{ color: colors.textSoft, marginBottom: '16px' }} />
        <h2 style={{ color: colors.text, margin: '0 0 8px', fontSize: isMobile ? '18px' : '22px', fontFamily: fonts.serif }}>Recap not found</h2>
        <p style={{ color: colors.textMuted, marginBottom: '24px', fontSize: bodyFontSize }}>This recap may have been removed.</p>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px',
          backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '12px',
          fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: fonts.sans,
        }} onClick={handleBack}>
          <ChevronLeft size={18} /> Go back
        </button>
      </div>
    );
  }

  const recapDate = new Date(recap.started_at || recap.created_at);
  const dateDisplay = recapDate.toLocaleDateString('en-US', isMobile
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  );

  return (
    <div style={{ fontFamily: fonts.sans, paddingBottom: '20px' }}>
      {/* Back button + Title row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <button
          aria-label="Go back"
          onClick={handleBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: 'rgba(139, 111, 92, 0.08)',
            border: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={20} color={colors.text} />
        </button>
        <h2 style={{
          fontWeight: '600',
          color: colors.text,
          fontFamily: fonts.serif,
          fontSize: isMobile ? '16px' : '18px',
          margin: 0,
        }}>Coffee Chat Recap</h2>
      </div>

      {/* Hero Header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: heroGap,
        padding: heroPadding,
        alignItems: 'flex-start',
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '14px',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
          border: `1px solid ${colors.border}`,
          flexShrink: 0,
          padding: isMobile ? '10px 14px' : '12px 16px',
          minWidth: isMobile ? '56px' : '64px',
          alignSelf: isMobile ? 'flex-start' : 'auto',
        }}>
          <span style={{
            display: 'block',
            fontWeight: '700',
            color: colors.primary,
            letterSpacing: '0.5px',
            fontSize: isMobile ? '10px' : '11px',
          }}>
            {recapDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
          </span>
          <span style={{
            display: 'block',
            fontWeight: '700',
            color: colors.text,
            fontFamily: fonts.serif,
            lineHeight: '1.1',
            fontSize: isMobile ? '24px' : '28px',
          }}>{recapDate.getDate()}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontFamily: fonts.serif,
            fontSize: titleSize,
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 8px',
            lineHeight: '1.3',
            wordBreak: 'break-word',
          }}>
            {recap.meetup_title || getCallTypeLabel(recap.call_type)}
          </h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '14px',
            flexWrap: 'wrap',
            marginBottom: '6px',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: metaFontSize, color: colors.textMuted }}>
              <Calendar size={isMobile ? 12 : 14} /> {dateDisplay}
            </span>
            {(recap.meetup_time || recap.coffeeChat?.scheduled_time) && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: metaFontSize, color: colors.textMuted }}>
                <Clock size={isMobile ? 12 : 14} /> {recap.meetup_time
                  ? formatTime(recap.meetup_time)
                  : new Date(recap.coffeeChat.scheduled_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: metaFontSize, color: colors.textMuted }}>
              <Clock size={isMobile ? 12 : 14} /> {formatDuration(recap.duration_seconds)}
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '14px',
            flexWrap: 'wrap',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: metaFontSize, color: colors.textMuted }}>
              <Users size={isMobile ? 12 : 14} /> {recap.participant_count || 0} participants
            </span>
            <span style={{
              fontSize: isMobile ? '10px' : '11px',
              padding: isMobile ? '2px 8px' : '3px 10px',
              borderRadius: '100px',
              backgroundColor: 'rgba(139, 158, 126, 0.15)',
              color: '#5C7A4E',
              fontWeight: '500',
            }}>
              {getCallTypeLabel(recap.call_type)}
            </span>
          </div>
        </div>
      </div>

      {/* Share Recap */}
      <div style={{ padding: '0 0 8px' }}>
        <button
          onClick={async () => {
            const title = recap.meetup_title || 'Coffee Chat Recap';
            const topics = (parsed?.topicsDiscussed || []).map(t => typeof t === 'string' ? t : t.topic).filter(Boolean);
            const takeaways = (parsed?.keyTakeaways || []).map(t => typeof t === 'string' ? t : t.text || '').filter(Boolean).slice(0, 3);
            const durationMin = recap.duration_seconds ? Math.floor(recap.duration_seconds / 60) : 0;
            const participantCount = recap.participant_count || 0;

            const url = `${window.location.origin}/recaps/${recapId}`;
            const lines = [
              `\u2615 ${title} \u2014 Recap`,
              '',
              `${durationMin > 0 ? durationMin + ' min' : ''}${durationMin > 0 && participantCount > 0 ? ' \u00B7 ' : ''}${participantCount > 0 ? participantCount + ' participants' : ''}`,
              topics.length > 0 ? `\nTopics:\n${topics.map(t => `\u2022 ${t}`).join('\n')}` : '',
              takeaways.length > 0 ? `\nKey Takeaways:\n${takeaways.map(t => `\u2022 ${t}`).join('\n')}` : '',
              '',
              `\uD83D\uDD17 View full recap on CircleW`,
              url,
            ].filter(Boolean).join('\n');

            if (navigator.share) {
              try { await navigator.share({ title, text: lines }); } catch (e) { /* cancelled */ }
            } else {
              await navigator.clipboard.writeText(lines);
              alert('Recap copied to clipboard!');
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '10px 16px', borderRadius: '12px',
            backgroundColor: 'transparent', color: colors.textLight,
            border: `1px solid ${colors.border}`, fontSize: '13px', fontWeight: '500',
            cursor: 'pointer', fontFamily: fonts.sans, width: '100%',
          }}
        >
          <Share2 size={15} /> Share Recap
        </button>
      </div>

      {/* Content sections */}
      <div style={{
        padding: containerPadding,
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '12px' : '16px',
      }}>
        {/* Participants */}
        {(recap.participant_ids || []).length > 0 && (() => {
          const attendedIds = new Set(recap.participant_ids || []);
          const noShows = signedUpProfiles.filter(p => !attendedIds.has(p.id));
          const attendedProfiles = (recap.participant_ids || []).map(id => participantProfiles[id]).filter(Boolean);

          return (
            <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '8px' : '12px' }}>
                <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize, margin: 0 }}>
                  <Users size={isMobile ? 14 : 16} style={{ color: colors.primary }} />
                  Attended ({attendedProfiles.length})
                </h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '6px' : '10px' }}>
                {attendedProfiles.map(profile => (
                  <div
                    key={profile.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: isMobile ? '6px' : '8px',
                      padding: isMobile ? '6px 10px' : '8px 12px',
                      backgroundColor: 'rgba(250, 245, 239, 0.7)',
                      borderRadius: '20px',
                      fontSize: isMobile ? '12px' : '13px',
                      color: colors.textLight, cursor: 'pointer',
                    }}
                    onClick={() => onNavigate?.('userProfile', { userId: profile.id })}
                  >
                    {profile.profile_picture ? (
                      <img src={profile.profile_picture} alt={profile.name} style={{
                        width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px',
                        borderRadius: '50%', objectFit: 'cover',
                      }} />
                    ) : (
                      <div style={{
                        width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px',
                        borderRadius: '50%', backgroundColor: colors.primary, color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: isMobile ? '9px' : '11px', fontWeight: '600',
                      }}>
                        {(profile.name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontWeight: '500' }}>{profile.name || 'Unknown'}</span>
                    {profile.career && !isMobile && (
                      <span style={{ color: colors.textSoft, fontSize: '12px' }}>{profile.career}</span>
                    )}
                  </div>
                ))}
              </div>
              {isHost && noShows.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <h4 style={{ fontSize: isMobile ? '11px' : '12px', color: colors.textSoft, fontWeight: '600', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Signed up but didn't attend ({noShows.length})
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '4px' : '6px' }}>
                    {noShows.map(profile => (
                      <div
                        key={profile.id}
                        style={{
                          display: 'flex', alignItems: 'center',
                          gap: '5px', padding: isMobile ? '4px 8px' : '5px 10px',
                          backgroundColor: 'rgba(250, 245, 239, 0.4)',
                          borderRadius: '16px',
                          fontSize: isMobile ? '11px' : '12px',
                          color: colors.textSoft, cursor: 'pointer', opacity: 0.6,
                        }}
                        onClick={() => onNavigate?.('userProfile', { userId: profile.id })}
                      >
                        {profile.profile_picture ? (
                          <img src={profile.profile_picture} alt={profile.name} style={{
                            width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover',
                          }} />
                        ) : (
                          <div style={{
                            width: '18px', height: '18px', borderRadius: '50%',
                            backgroundColor: colors.textSoft, color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '9px', fontWeight: '600',
                          }}>
                            {(profile.name || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <span>{profile.name || 'Unknown'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Sentiment / Meeting Vibe */}
        {parsed.sentiment && (
          <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
            <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
              <span style={{ fontSize: isMobile ? '14px' : '16px' }}>{parsed.sentiment.emoji || '✨'}</span>
              Meeting Vibe
            </h3>
            <div style={{
              padding: isMobile ? '12px' : '16px',
              backgroundColor: 'rgba(201, 169, 110, 0.1)',
              borderRadius: '12px',
              borderLeft: `4px solid ${colors.gold}`,
            }}>
              <p style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '600', color: colors.textLight, margin: '0 0 8px' }}>
                {parsed.sentiment.overall}
              </p>
              {parsed.sentiment.highlights && parsed.sentiment.highlights.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '6px' : '8px', marginTop: '8px' }}>
                  {parsed.sentiment.highlights.map((h, i) => (
                    <span key={i} style={{
                      padding: isMobile ? '3px 8px' : '4px 10px',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      fontSize: isMobile ? '11px' : '12px',
                      color: colors.textMuted,
                    }}>{h}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Summary */}
        <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
          <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
            <Sparkles size={isMobile ? 14 : 16} style={{ color: colors.gold }} />
            AI Summary
          </h3>
          <div style={{
            backgroundColor: 'rgba(139, 111, 92, 0.05)',
            borderRadius: '12px',
            padding: isMobile ? '12px' : '16px',
            fontSize: bodyFontSize,
            color: colors.textLight,
            lineHeight: '1.6',
          }}>
            {parsed.summary || recap.ai_summary || (
              <span style={{ color: colors.textSoft, fontStyle: 'italic' }}>No summary available</span>
            )}
          </div>
        </div>

        {/* Topics Discussed */}
        {parsed.topicsDiscussed.length > 0 && (
          <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
            <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
              <MessageSquare size={isMobile ? 14 : 16} style={{ color: '#6B8E7A' }} />
              Topics Discussed
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '12px' }}>
              {parsed.topicsDiscussed.map((t, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ color: '#6B8E7A', fontWeight: '600', fontSize: isMobile ? '13px' : '14px', flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontSize: isMobile ? '13px' : '14px', color: colors.textLight, fontWeight: '500' }}>{t.topic || t}</span>
                  </div>
                  {t.details && t.details.length > 0 && (
                    <div style={{ marginLeft: isMobile ? '20px' : '22px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {t.details.map((detail, di) => (
                        <div key={di} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{ color: 'rgba(107, 142, 122, 0.5)', marginTop: '1px' }}>-</span>
                          <span style={{ fontSize: isMobile ? '12px' : '13px', color: colors.textMuted, lineHeight: '1.4' }}>{detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Memorable Quotes */}
        {parsed.memorableQuotes.length > 0 && (
          <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
            <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
              <Quote size={isMobile ? 14 : 16} style={{ color: colors.purple }} />
              Memorable Quotes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '12px' }}>
              {parsed.memorableQuotes.map((q, i) => (
                <div key={i} style={{
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  backgroundColor: 'rgba(155, 126, 196, 0.08)',
                  borderRadius: '12px',
                  borderLeft: `3px solid ${colors.purple}`,
                }}>
                  <p style={{ fontSize: bodyFontSize, fontStyle: 'italic', color: colors.textLight, margin: 0 }}>
                    &ldquo;{q.quote || q}&rdquo;
                  </p>
                  {q.author && (
                    <p style={{ fontSize: isMobile ? '11px' : '12px', color: colors.textMuted, margin: '6px 0 0' }}>— {q.author}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Takeaways */}
        <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
          <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
            <FileText size={isMobile ? 14 : 16} style={{ color: colors.primary }} />
            Key Takeaways
          </h3>
          {parsed.keyTakeaways.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {parsed.keyTakeaways.map((takeaway, i) => (
                <li key={i} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: isMobile ? '8px' : '10px',
                  padding: isMobile ? '8px 0' : '10px 0',
                  borderBottom: `1px solid ${colors.border}`,
                  fontSize: bodyFontSize,
                  color: colors.textLight,
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: colors.sage,
                    marginTop: '7px',
                    flexShrink: 0,
                  }}></div>
                  <span>{takeaway}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: bodyFontSize, color: colors.textSoft, fontStyle: 'italic', margin: 0 }}>
              No key takeaways from this session
            </p>
          )}
        </div>

        {/* Action Items */}
        <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
          <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
            <ListTodo size={isMobile ? 14 : 16} style={{ color: colors.sage }} />
            Action Items
          </h3>
          {parsed.actionItems.length > 0 ? (
            parsed.actionItems.map((item, i) => {
              const isCompleted = completedActions.has(`${recapId}_${i}`);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: isMobile ? '8px' : '10px',
                    padding: isMobile ? '8px 10px' : '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: isCompleted ? 'rgba(139, 158, 126, 0.1)' : 'rgba(139, 111, 92, 0.05)',
                    marginBottom: '8px',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleActionItem(i)}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={isMobile ? 16 : 18} style={{ color: colors.sage, flexShrink: 0 }} />
                  ) : (
                    <Circle size={isMobile ? 16 : 18} style={{ color: colors.textSoft, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <span style={{
                      fontSize: bodyFontSize,
                      color: isCompleted ? colors.sage : colors.textLight,
                      textDecoration: isCompleted ? 'line-through' : 'none',
                    }}>
                      {typeof item === 'string' ? item : item.text}
                    </span>
                    {item.assignee && (
                      <span style={{
                        fontSize: isMobile ? '11px' : '12px',
                        color: colors.primary,
                        fontWeight: '500',
                        marginLeft: '6px',
                      }}>
                        — {item.assignee}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p style={{ fontSize: bodyFontSize, color: colors.textSoft, fontStyle: 'italic', margin: 0 }}>
              No action items from this session
            </p>
          )}
        </div>

        {/* Suggested Follow-ups */}
        {parsed.suggestedFollowUps.filter(f => f.personName).length > 0 && (
          <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
            <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
              <Users size={isMobile ? 14 : 16} style={{ color: colors.gold }} />
              Suggested Follow-ups
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {parsed.suggestedFollowUps.filter(f => f.personName).map((followUp, i) => {
                // Find the user ID from participant profiles by name
                const profileEntry = Object.entries(participantProfiles).find(
                  ([, p]) => p.name === followUp.personName
                );
                const userId = profileEntry ? profileEntry[0] : null;

                return (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    gap: isMobile ? '10px' : '12px',
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    backgroundColor: 'rgba(201, 169, 110, 0.08)',
                    borderRadius: '12px',
                  }}>
                    <div style={{
                      width: isMobile ? '32px' : '36px',
                      height: isMobile ? '32px' : '36px',
                      borderRadius: '50%',
                      backgroundColor: colors.gold,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? '12px' : '14px',
                      fontWeight: '600',
                      flexShrink: 0,
                    }}>
                      {(followUp.personName || 'U')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: bodyFontSize, fontWeight: '600', color: colors.text, margin: 0 }}>
                        {followUp.personName}
                      </p>
                      {followUp.reason && (
                        <p style={{ fontSize: isMobile ? '11px' : '12px', color: colors.textMuted, margin: '2px 0 0' }}>{followUp.reason}</p>
                      )}
                      {followUp.suggestedTopic && (
                        <p style={{ fontSize: isMobile ? '11px' : '12px', color: colors.textSoft, margin: '2px 0 0' }}>Topic: {followUp.suggestedTopic}</p>
                      )}
                    </div>
                    {userId && (() => {
                      const status = connectionStatus[userId];
                      const label = status === 'connected' ? 'Schedule' : status === 'sent' ? 'Sent' : 'Connect';
                      const bgColor = status === 'connected' ? colors.primary : status === 'sent' ? 'rgba(139, 158, 126, 0.15)' : colors.primary;
                      const textColor = status === 'sent' ? '#5C7A4E' : 'white';
                      const profile = participantProfiles[userId];
                      return (
                        <button
                          onClick={() => {
                            if (status === 'connected') {
                              onNavigate?.('scheduleMeetup', {
                                type: 'coffee',
                                scheduleConnectionId: userId,
                                scheduleConnectionName: profile?.name || followUp.personName,
                              });
                            } else {
                              onNavigate?.('userProfile', { userId });
                            }
                          }}
                          disabled={status === 'sent'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: isMobile ? '6px 10px' : '7px 14px',
                            borderRadius: '100px', border: 'none',
                            backgroundColor: bgColor, color: textColor,
                            fontSize: isMobile ? '11px' : '12px', fontWeight: '600',
                            cursor: status === 'sent' ? 'default' : 'pointer', fontFamily: fonts.sans,
                            flexShrink: 0,
                          }}
                        >
                          {status === 'connected' ? <Calendar size={isMobile ? 11 : 13} /> : <Users size={isMobile ? 11 : 13} />}
                          {label}
                        </button>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Suggested Circles */}
        {parsed.suggestedCircles.length > 0 && (
          <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
            <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
              <Users size={isMobile ? 14 : 16} style={{ color: colors.sage }} />
              Suggested Circles
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {parsed.suggestedCircles.map((circle, i) => (
                <div key={i} style={{
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  backgroundColor: 'rgba(139, 158, 126, 0.08)',
                  borderRadius: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: bodyFontSize, fontWeight: '600', color: colors.text, margin: 0 }}>
                        {circle.name}
                      </p>
                      {circle.reason && (
                        <p style={{ fontSize: isMobile ? '11px' : '12px', color: colors.textMuted, margin: '2px 0 0' }}>{circle.reason}</p>
                      )}
                      {circle.type === 'create' && circle.suggestedMembers?.length > 0 && (
                        <p style={{ fontSize: isMobile ? '11px' : '12px', color: colors.textSoft, margin: '4px 0 0' }}>
                          With: {circle.suggestedMembers.join(', ')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (circle.type === 'join') {
                          const { data: match } = await supabase
                            .from('connection_groups')
                            .select('id')
                            .eq('name', circle.name)
                            .limit(1)
                            .single();
                          if (match) {
                            onNavigate?.('circleDetail', { circleId: match.id });
                          } else {
                            onNavigate?.('allCircles');
                          }
                        } else {
                          onNavigate?.('createCircle');
                        }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: isMobile ? '6px 10px' : '7px 14px',
                        borderRadius: '100px', border: 'none',
                        backgroundColor: circle.type === 'join' ? colors.sage : colors.primary,
                        color: 'white',
                        fontSize: isMobile ? '11px' : '12px', fontWeight: '600',
                        cursor: 'pointer', fontFamily: fonts.sans,
                        flexShrink: 0,
                      }}
                    >
                      {circle.type === 'join' ? 'Browse' : 'Create'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
    border: '1px solid rgba(139, 111, 92, 0.08)',
    overflow: 'hidden',
    wordBreak: 'break-word',
  },
  sectionTitle: {
    fontWeight: '600',
    color: colors.text,
    margin: '0 0 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: fonts.serif,
  },
};

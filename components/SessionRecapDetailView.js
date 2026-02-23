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
  };

  if (!summary) return emptyResult;

  try {
    const parsed = JSON.parse(summary);
    return {
      summary: parsed.summary || '',
      sentiment: parsed.sentiment || null,
      keyTakeaways: (parsed.keyTakeaways || []).map(t => typeof t === 'string' ? t : t.text || ''),
      topicsDiscussed: parsed.topicsDiscussed || [],
      memorableQuotes: parsed.memorableQuotes || [],
      actionItems: (parsed.actionItems || []).map(a => typeof a === 'string' ? a : a.text || ''),
      suggestedFollowUps: parsed.suggestedFollowUps || [],
    };
  } catch (e) {
    // Not JSON, parse as text
  }

  const result = { ...emptyResult };
  const lines = summary.split('\n').filter(l => l.trim());
  let currentSection = 'summary';

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
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

    const cleanLine = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    if (cleanLine) {
      if (currentSection === 'summary') {
        result.summary += (result.summary ? ' ' : '') + cleanLine;
      } else if (currentSection === 'takeaways' && cleanLine.length > 10) {
        result.keyTakeaways.push(cleanLine);
      } else if (currentSection === 'actions' && cleanLine.length > 5) {
        result.actionItems.push(cleanLine);
      } else if (currentSection === 'topics' && cleanLine.length > 3) {
        result.topicsDiscussed.push({ topic: cleanLine, mentions: 1 });
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
    case '1on1': return '1:1 Coffee Chat';
    case 'meetup':
    case 'group': return 'Circle Meetup';
    default: return 'Video Call';
  }
}

export default function SessionRecapDetailView({ recapId, onNavigate, previousView }) {
  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 640;
  const isTablet = windowWidth >= 640 && windowWidth < 768;

  const [recap, setRecap] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [participantProfiles, setParticipantProfiles] = useState({});
  const [completedActions, setCompletedActions] = useState(new Set());

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

      // Extract UUID from channel_name to look up meetup/group info
      const channelName = data.channel_name || '';
      const uuidMatch = channelName.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const entityId = uuidMatch ? uuidMatch[0] : null;

      let meetup = null;
      let group = null;

      if (entityId) {
        if (data.call_type === 'group') {
          const { data: groupData } = await supabase
            .from('connection_groups')
            .select('id, name')
            .eq('id', entityId)
            .single();
          group = groupData;
        } else {
          const { data: meetupData } = await supabase
            .from('meetups')
            .select('id, topic, description, date, time, location')
            .eq('id', entityId)
            .single();
          meetup = meetupData;
        }
      }

      const enriched = {
        ...data,
        meetup,
        group,
        meetup_title: group?.name || meetup?.topic || null,
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

      // Load completed actions from localStorage
      const savedActions = localStorage.getItem('completed_recap_actions');
      if (savedActions) {
        setCompletedActions(new Set(JSON.parse(savedActions)));
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
        }}>Session Recap</h2>
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
            {recap.meetup_time && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: metaFontSize, color: colors.textMuted }}>
                <Clock size={isMobile ? 12 : 14} /> {formatTime(recap.meetup_time)}
              </span>
            )}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '14px',
            flexWrap: 'wrap',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: metaFontSize, color: colors.textMuted }}>
              <Clock size={isMobile ? 12 : 14} /> {formatDuration(recap.duration_seconds)}
            </span>
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
              {recap.call_type === '1on1' ? '1:1' : 'Circle'}
            </span>
          </div>
        </div>
      </div>

      {/* Content sections */}
      <div style={{
        padding: containerPadding,
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '12px' : '16px',
      }}>
        {/* Participants */}
        {(recap.participant_ids || []).length > 0 && (
          <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
            <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
              <Users size={isMobile ? 14 : 16} style={{ color: colors.primary }} />
              Participants ({(recap.participant_ids || []).length})
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '6px' : '10px' }}>
              {(recap.participant_ids || []).map(id => {
                const profile = participantProfiles[id];
                return (
                  <div key={id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '6px' : '8px',
                    padding: isMobile ? '6px 10px' : '8px 12px',
                    backgroundColor: 'rgba(250, 245, 239, 0.7)',
                    borderRadius: '20px',
                    fontSize: isMobile ? '12px' : '13px',
                    color: colors.textLight,
                  }}>
                    {profile?.profile_picture ? (
                      <img src={profile.profile_picture} alt={profile.name} style={{
                        width: isMobile ? '20px' : '24px',
                        height: isMobile ? '20px' : '24px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }} />
                    ) : (
                      <div style={{
                        width: isMobile ? '20px' : '24px',
                        height: isMobile ? '20px' : '24px',
                        borderRadius: '50%',
                        backgroundColor: colors.primary,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isMobile ? '9px' : '11px',
                        fontWeight: '600',
                      }}>
                        {(profile?.name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontWeight: '500' }}>{profile?.name || 'Unknown'}</span>
                    {profile?.career && !isMobile && (
                      <span style={{ color: colors.textSoft, fontSize: '12px' }}>· {profile.career}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '6px' : '8px' }}>
              {parsed.topicsDiscussed.map((t, i) => (
                <span key={i} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: isMobile ? '5px 10px' : '6px 12px',
                  backgroundColor: 'rgba(107, 142, 122, 0.1)',
                  borderRadius: '16px',
                  fontSize: isMobile ? '12px' : '13px',
                  color: colors.textLight,
                }}>
                  {t.topic || t}
                  {t.mentions && t.mentions > 1 && (
                    <span style={{
                      backgroundColor: '#6B8E7A',
                      color: 'white',
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '10px',
                    }}>{t.mentions}x</span>
                  )}
                </span>
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
                  <span style={{
                    fontSize: bodyFontSize,
                    color: isCompleted ? colors.sage : colors.textLight,
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    flex: 1,
                  }}>
                    {item}
                  </span>
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
        {parsed.suggestedFollowUps.length > 0 && (
          <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
            <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
              <Users size={isMobile ? 14 : 16} style={{ color: colors.gold }} />
              Suggested Follow-ups
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {parsed.suggestedFollowUps.map((followUp, i) => (
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
    background: colors.gradient,
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

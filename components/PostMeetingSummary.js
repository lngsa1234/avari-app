'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Users, Clock, MapPin, MessageCircle, Lightbulb, UserPlus, Calendar, ChevronRight, Check, Share2, Download, ThumbsUp, Video, X, ChevronLeft } from 'lucide-react';

// Color palette - Mocha Brown theme
const colors = {
  primary: '#8B6F5C',
  primaryDark: '#5C4033',
  primaryLight: '#A89080',
  cream: '#FDF8F3',
  warmWhite: '#FFFAF5',
  background: '#F5F0EB',
  text: '#3D3D3D',
  textLight: '#5D4E42',
  textMuted: '#8C7B6B',
  border: '#E6DDD4',
  cardBg: '#FFFFFF',
  highlight: '#FAF6F3',
  success: '#4CAF50',
  successBg: '#E8F5E9',
};

const fonts = {
  serif: '"Playfair Display", Georgia, serif',
  sans: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
};

/**
 * PostMeetingSummary - Comprehensive AI-generated meeting recap
 * Based on UX reference: circleW-post-meeting-summary.jsx
 */
export default function PostMeetingSummary({
  meeting = {},
  summary = {},
  participants = [],
  currentUserId,
  onClose,
  onScheduleFollowUp,
  onConnect,
  onNavigate,
}) {
  const [actionItems, setActionItems] = useState(summary.actionItems || []);
  const [feedbackGiven, setFeedbackGiven] = useState(null);

  useEffect(() => {
    if (summary.actionItems) {
      setActionItems(summary.actionItems);
    }
  }, [summary.actionItems]);

  const toggleActionItem = (index) => {
    const updated = [...actionItems];
    updated[index].done = !updated[index].done;
    setActionItems(updated);
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown duration';
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${remainingMins}m`;
    }
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  // Stats calculation
  const stats = {
    peopleMetCount: participants.length || 0,
    conversationsCount: summary.topicsDiscussed?.length || 0,
    takeawaysCount: summary.keyTakeaways?.length || 0,
    followUpsCount: summary.suggestedFollowUps?.length || 0,
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.card}>
          <div style={styles.headerTop}>
            {onClose && (
              <button style={styles.closeBtn} onClick={onClose}>
                <ChevronLeft size={20} />
              </button>
            )}
            <div style={styles.aiLabel}>
              <Sparkles size={14} />
              <span>AI-Generated Summary</span>
            </div>
          </div>

          <div style={styles.meetingHeader}>
            <div style={styles.meetingEmoji}>
              {meeting.emoji || (meeting.type === 'group' ? '👥' : '☕')}
            </div>
            <div style={styles.meetingInfo}>
              <h1 style={styles.meetingTitle}>
                {meeting.title || 'Meeting Summary'}
              </h1>
              <p style={styles.meetingHost}>
                {meeting.host ? `Hosted by ${meeting.host}` : ''}
              </p>
            </div>
          </div>

          {/* Meeting Details */}
          <div style={styles.meetingDetails}>
            {meeting.date && (
              <div style={styles.detailItem}>
                <Calendar size={14} color={colors.textMuted} />
                <span>{meeting.date}</span>
              </div>
            )}
            {meeting.duration && (
              <div style={styles.detailItem}>
                <Clock size={14} color={colors.textMuted} />
                <span>{formatDuration(meeting.duration)}</span>
              </div>
            )}
            {meeting.location && (
              <div style={styles.detailItem}>
                <MapPin size={14} color={colors.textMuted} />
                <span>{meeting.location}</span>
              </div>
            )}
            {participants.length > 0 && (
              <div style={styles.detailItem}>
                <Users size={14} color={colors.textMuted} />
                <span>{participants.length} attended</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div style={styles.statsGrid}>
          <StatCard number={stats.peopleMetCount} label="People Met" emoji="👋" />
          <StatCard number={stats.conversationsCount} label="Topics" emoji="💬" />
          <StatCard number={stats.takeawaysCount} label="Takeaways" emoji="💡" />
          <StatCard number={stats.followUpsCount} label="Follow-ups" emoji="📅" />
        </div>

        {/* Overall Sentiment */}
        {summary.sentiment && (
          <div style={styles.sentimentCard}>
            <div style={styles.sentimentContent}>
              <div>
                <p style={styles.sentimentLabel}>Meeting Vibe</p>
                <p style={styles.sentimentValue}>
                  {summary.sentiment.emoji} {summary.sentiment.overall}
                </p>
              </div>
              <div style={styles.highlightTags}>
                {summary.sentiment.highlights?.map((highlight, i) => (
                  <span key={i} style={styles.highlightTag}>
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        {summary.summary && (
          <div style={styles.card}>
            <p style={styles.summaryText}>{summary.summary}</p>
          </div>
        )}

        {/* Key Takeaways */}
        {summary.keyTakeaways?.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <Lightbulb size={18} color="#F9A825" />
              Key Takeaways
            </h2>
            <div style={styles.takeawaysList}>
              {summary.keyTakeaways.map((takeaway, index) => (
                <div key={index} style={styles.takeawayItem}>
                  <span style={styles.takeawayEmoji}>{takeaway.emoji}</span>
                  <p style={styles.takeawayText}>{takeaway.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Topics Discussed */}
        {summary.topicsDiscussed?.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <MessageCircle size={18} color={colors.textMuted} />
              Topics Discussed
            </h2>
            <div style={styles.topicsList}>
              {summary.topicsDiscussed.map((topic, index) => (
                <span key={index} style={styles.topicTag}>
                  {topic.topic}
                  <span style={styles.topicCount}>{topic.mentions}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* People You Met */}
        {participants.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <UserPlus size={18} color="#6B9080" />
              People You Met
            </h2>
            <div style={styles.peopleList}>
              {participants.filter(p => p.id !== currentUserId).map((person, index) => (
                <div key={index} style={styles.personCard}>
                  <div style={styles.personAvatar}>
                    {person.profile_picture ? (
                      <img src={person.profile_picture} alt={person.name} style={styles.avatarImg} />
                    ) : (
                      <span style={styles.avatarEmoji}>{person.emoji || '👤'}</span>
                    )}
                  </div>
                  <div style={styles.personInfo}>
                    <div style={styles.personNameRow}>
                      <p style={styles.personName}>{person.name}</p>
                      {person.connected && (
                        <span style={styles.connectedBadge}>
                          <Check size={10} /> Connected
                        </span>
                      )}
                    </div>
                    <p style={styles.personRole}>
                      {person.career || person.role}
                      {person.company && ` at ${person.company}`}
                    </p>
                    {person.sharedInterests?.length > 0 && (
                      <div style={styles.interestTags}>
                        {person.sharedInterests.map((interest, i) => (
                          <span key={i} style={styles.interestTag}>{interest}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {!person.connected && onConnect && (
                    <button
                      style={styles.connectBtn}
                      onClick={() => onConnect(person)}
                    >
                      Connect
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Follow-ups */}
        {summary.suggestedFollowUps?.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <Calendar size={18} color={colors.textMuted} />
              Suggested Follow-ups
            </h2>
            <div style={styles.followUpsList}>
              {summary.suggestedFollowUps.map((followUp, index) => (
                <div key={index} style={styles.followUpCard}>
                  <div style={styles.followUpHeader}>
                    <div style={styles.followUpAvatar}>
                      {followUp.emoji || '👤'}
                    </div>
                    <div style={styles.followUpInfo}>
                      <p style={styles.followUpTitle}>
                        Coffee chat with {followUp.personName}
                      </p>
                      <p style={styles.followUpReason}>{followUp.reason}</p>
                    </div>
                  </div>
                  <div style={styles.followUpFooter}>
                    <p style={styles.followUpTopic}>
                      <span style={{ color: colors.textMuted }}>Suggested topic:</span>{' '}
                      {followUp.suggestedTopic}
                    </p>
                    {onScheduleFollowUp && (
                      <button
                        style={styles.scheduleBtn}
                        onClick={() => onScheduleFollowUp(followUp)}
                      >
                        Schedule <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <Check size={18} color={colors.textMuted} />
              Your Action Items
            </h2>
            <div style={styles.actionList}>
              {actionItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => toggleActionItem(index)}
                  style={{
                    ...styles.actionItem,
                    ...(item.done ? styles.actionItemDone : {}),
                  }}
                >
                  <div style={{
                    ...styles.actionCheckbox,
                    ...(item.done ? styles.actionCheckboxDone : {}),
                  }}>
                    {item.done && <Check size={12} color="white" />}
                  </div>
                  <span style={{
                    ...styles.actionText,
                    ...(item.done ? styles.actionTextDone : {}),
                  }}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Memorable Quotes */}
        {summary.memorableQuotes?.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <span style={{ fontSize: '18px' }}>💬</span>
              Memorable Quotes
            </h2>
            <div style={styles.quotesList}>
              {summary.memorableQuotes.map((quote, index) => (
                <div key={index} style={styles.quoteCard}>
                  <p style={styles.quoteText}>"{quote.quote}"</p>
                  <p style={styles.quoteAuthor}>— {quote.author}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={styles.actionsRow}>
          <button style={styles.primaryAction}>
            <Share2 size={18} />
            Share Summary
          </button>
          <button style={styles.secondaryAction}>
            <Download size={18} />
            Export
          </button>
        </div>

        {/* Feedback */}
        <div style={styles.feedback}>
          <p style={styles.feedbackLabel}>Was this summary helpful?</p>
          <div style={styles.feedbackButtons}>
            <button
              style={{
                ...styles.feedbackBtn,
                ...(feedbackGiven === 'yes' ? styles.feedbackBtnActive : {}),
              }}
              onClick={() => setFeedbackGiven('yes')}
            >
              <ThumbsUp size={14} /> Yes
            </button>
            <button
              style={{
                ...styles.feedbackBtn,
                ...(feedbackGiven === 'no' ? styles.feedbackBtnActive : {}),
              }}
              onClick={() => setFeedbackGiven('no')}
            >
              <ThumbsUp size={14} style={{ transform: 'rotate(180deg)' }} /> No
            </button>
          </div>
          {feedbackGiven && (
            <p style={styles.feedbackThanks}>Thanks for your feedback!</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ number, label, emoji }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statEmoji}>{emoji}</div>
      <p style={styles.statNumber}>{number}</p>
      <p style={styles.statLabel}>{label}</p>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: colors.background,
    fontFamily: fonts.sans,
  },
  content: {
    maxWidth: '700px',
    margin: '0 auto',
    padding: '24px 16px',
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: '24px',
    padding: '20px',
    border: `1px solid ${colors.border}`,
    marginBottom: '16px',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    border: `1px solid ${colors.border}`,
    backgroundColor: 'white',
    cursor: 'pointer',
    color: colors.text,
  },
  aiLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: colors.textMuted,
    fontSize: '13px',
  },
  meetingHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  meetingEmoji: {
    width: '64px',
    height: '64px',
    backgroundColor: colors.highlight,
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    flexShrink: 0,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontFamily: fonts.serif,
    fontSize: '20px',
    fontWeight: '600',
    color: colors.text,
    margin: 0,
    marginBottom: '4px',
  },
  meetingHost: {
    fontSize: '14px',
    color: colors.textMuted,
    margin: 0,
  },
  meetingDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: `1px solid ${colors.border}`,
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: colors.textLight,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '16px',
  },
  statCard: {
    backgroundColor: colors.cardBg,
    borderRadius: '16px',
    padding: '12px',
    border: `1px solid ${colors.border}`,
    textAlign: 'center',
  },
  statEmoji: {
    fontSize: '20px',
    marginBottom: '4px',
  },
  statNumber: {
    fontSize: '20px',
    fontWeight: '700',
    color: colors.text,
    margin: 0,
  },
  statLabel: {
    fontSize: '11px',
    color: colors.textMuted,
    margin: 0,
    lineHeight: 1.2,
  },
  sentimentCard: {
    background: `linear-gradient(135deg, ${colors.highlight} 0%, #DED4CA 100%)`,
    borderRadius: '24px',
    padding: '20px',
    marginBottom: '16px',
  },
  sentimentContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  sentimentLabel: {
    fontSize: '13px',
    color: colors.textMuted,
    margin: 0,
    marginBottom: '4px',
  },
  sentimentValue: {
    fontSize: '18px',
    fontWeight: '600',
    color: colors.text,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  highlightTags: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  highlightTag: {
    padding: '6px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    color: colors.textLight,
    fontSize: '12px',
    fontWeight: '500',
    borderRadius: '20px',
  },
  summaryText: {
    fontSize: '15px',
    lineHeight: 1.6,
    color: colors.text,
    margin: 0,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '16px',
    fontWeight: '600',
    color: colors.text,
    margin: 0,
    marginBottom: '16px',
  },
  takeawaysList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  takeawayItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    backgroundColor: colors.highlight,
    borderRadius: '12px',
  },
  takeawayEmoji: {
    fontSize: '20px',
  },
  takeawayText: {
    fontSize: '14px',
    color: colors.text,
    margin: 0,
    lineHeight: 1.5,
  },
  topicsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  topicTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    backgroundColor: '#F5EDE5',
    color: colors.textLight,
    fontSize: '13px',
    borderRadius: '20px',
  },
  topicCount: {
    width: '20px',
    height: '20px',
    backgroundColor: colors.border,
    color: colors.textMuted,
    fontSize: '11px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  personCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
  },
  personAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: colors.highlight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarEmoji: {
    fontSize: '24px',
  },
  personInfo: {
    flex: 1,
  },
  personNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  personName: {
    fontSize: '15px',
    fontWeight: '600',
    color: colors.text,
    margin: 0,
  },
  connectedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    backgroundColor: colors.successBg,
    color: colors.success,
    fontSize: '11px',
    fontWeight: '500',
    borderRadius: '20px',
  },
  personRole: {
    fontSize: '13px',
    color: colors.textMuted,
    margin: 0,
  },
  interestTags: {
    display: 'flex',
    gap: '4px',
    marginTop: '6px',
  },
  interestTag: {
    fontSize: '11px',
    color: colors.textMuted,
    backgroundColor: '#F5EDE5',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  connectBtn: {
    padding: '8px 16px',
    backgroundColor: colors.primary,
    color: 'white',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  followUpsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  followUpCard: {
    padding: '16px',
    backgroundColor: colors.highlight,
    borderRadius: '12px',
  },
  followUpHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  followUpAvatar: {
    width: '40px',
    height: '40px',
    backgroundColor: colors.border,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  followUpInfo: {
    flex: 1,
  },
  followUpTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: colors.text,
    margin: 0,
  },
  followUpReason: {
    fontSize: '12px',
    color: colors.textMuted,
    margin: 0,
  },
  followUpFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '12px',
    borderTop: `1px solid ${colors.border}`,
  },
  followUpTopic: {
    fontSize: '13px',
    color: colors.textLight,
    margin: 0,
  },
  scheduleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    backgroundColor: colors.primary,
    color: 'white',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  actionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  actionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: colors.highlight,
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'background-color 0.2s',
  },
  actionItemDone: {
    backgroundColor: colors.successBg,
  },
  actionCheckbox: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: `2px solid ${colors.textMuted}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionCheckboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  actionText: {
    fontSize: '14px',
    color: colors.text,
  },
  actionTextDone: {
    color: colors.textMuted,
    textDecoration: 'line-through',
  },
  quotesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  quoteCard: {
    padding: '16px',
    backgroundColor: '#FFFCFA',
    borderRadius: '12px',
    borderLeft: `4px solid ${colors.primary}`,
  },
  quoteText: {
    fontFamily: fonts.serif,
    fontSize: '15px',
    fontStyle: 'italic',
    color: colors.text,
    margin: 0,
    marginBottom: '8px',
  },
  quoteAuthor: {
    fontSize: '13px',
    color: colors.textMuted,
    margin: 0,
  },
  actionsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  primaryAction: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    backgroundColor: colors.primary,
    color: 'white',
    fontSize: '15px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  secondaryAction: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px 20px',
    backgroundColor: 'white',
    color: colors.textLight,
    fontSize: '15px',
    fontWeight: '500',
    border: `2px solid ${colors.border}`,
    borderRadius: '12px',
    cursor: 'pointer',
  },
  feedback: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  feedbackLabel: {
    fontSize: '13px',
    color: colors.textMuted,
    margin: 0,
    marginBottom: '8px',
  },
  feedbackButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
  },
  feedbackBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: 'white',
    color: colors.textLight,
    fontSize: '13px',
    border: `1px solid ${colors.border}`,
    borderRadius: '20px',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  feedbackBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.highlight,
  },
  feedbackThanks: {
    fontSize: '12px',
    color: colors.success,
    marginTop: '8px',
  },
};

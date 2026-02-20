// components/ScheduleMeetupView.js
// Unified page to schedule 1:1 coffee chats or circle meetups

'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, Clock, Users, User, MessageCircle } from 'lucide-react';

// Color palette - Mocha Brown theme
const colors = {
  primary: '#8B6F5C',
  primaryDark: '#5C4033',
  primaryLight: '#A89080',
  cream: '#FDF8F3',
  warmWhite: '#FFFAF5',
  text: '#3D2B1F',
  textLight: '#6B5344',
  textMuted: '#A89080',
  border: '#EDE6DF',
  cardBg: 'rgba(255, 255, 255, 0.8)',
};

const fonts = {
  serif: '"Playfair Display", Georgia, serif',
  sans: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
};

export default function ScheduleMeetupView({
  currentUser,
  supabase,
  connections = [],
  onNavigate,
  // Pre-fill props from navigation context
  initialType = null,
  initialCircleId = null,
  initialCircleName = null,
  initialConnectionId = null,
  initialConnectionName = null,
}) {
  const [meetupType, setMeetupType] = useState(initialType || null);
  const [selectedConnection, setSelectedConnection] = useState(
    initialConnectionId ? { id: initialConnectionId, name: initialConnectionName } : null
  );
  const [selectedCircle, setSelectedCircle] = useState(
    initialCircleId ? { id: initialCircleId, name: initialCircleName } : null
  );
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');

  const [availableCircles, setAvailableCircles] = useState([]);
  const [availableConnections, setAvailableConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  // Sync selectedCircle with full data after circles are loaded
  useEffect(() => {
    if (initialCircleId && availableCircles.length > 0) {
      const fullCircleData = availableCircles.find(c => c.id === initialCircleId);
      if (fullCircleData) {
        setSelectedCircle(fullCircleData);
      }
    }
  }, [initialCircleId, availableCircles]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadConnections(),
      loadUserCircles(),
    ]);
    setLoading(false);
  };

  const loadConnections = async () => {
    try {
      // Get mutual matches
      const { data: matches, error } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id });

      if (error) {
        console.error('Error loading connections:', error);
        setAvailableConnections([]);
        return;
      }

      // Get profiles for matches
      if (matches && matches.length > 0) {
        const userIds = matches.map(m => m.matched_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, career, profile_picture')
          .in('id', userIds);

        setAvailableConnections(profiles || []);
      } else {
        setAvailableConnections([]);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
      setAvailableConnections([]);
    }
  };

  const loadUserCircles = async () => {
    try {
      // Get all circles where user is a member
      const { data: memberGroups, error: memberError } = await supabase
        .from('connection_group_members')
        .select(`
          group_id,
          connection_groups!inner (
            id,
            name,
            cadence,
            meeting_day,
            time_of_day,
            creator_id
          )
        `)
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted');

      if (memberError) {
        console.error('Error loading circles:', memberError);
        setAvailableCircles([]);
        return;
      }

      const userCircles = (memberGroups || [])
        .map(mg => mg.connection_groups)
        .filter(circle => circle != null);

      setAvailableCircles(userCircles);
    } catch (error) {
      console.error('Error loading circles:', error);
      setAvailableCircles([]);
    }
  };

  const handleSubmit = async () => {
    if (!meetupType) {
      alert('Please select a meetup type');
      return;
    }

    if (meetupType === 'coffee' && !selectedConnection) {
      alert('Please select a person to meet with');
      return;
    }

    if (meetupType === 'circle' && !selectedCircle) {
      alert('Please select a circle');
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      alert('Please select date and time');
      return;
    }

    setSubmitting(true);

    try {
      if (meetupType === 'coffee') {
        await scheduleCoffeeChat();
      } else {
        await scheduleCircleMeetup();
      }
    } catch (error) {
      alert('Error scheduling meetup: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const scheduleCoffeeChat = async () => {
    const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);

    const { error } = await supabase
      .from('coffee_chats')
      .insert({
        requester_id: currentUser.id,
        recipient_id: selectedConnection.id,
        scheduled_time: dateTime.toISOString(),
        notes: notes || null,
        status: 'pending',
      });

    if (error) throw error;

    alert(`Request sent to ${selectedConnection.name}!`);
    onNavigate?.('meetups');
  };

  const scheduleCircleMeetup = async () => {
    // Get the authenticated user directly from Supabase
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      throw new Error('Not authenticated');
    }

    // Debug: Check if IDs match
    console.log('Auth user ID:', authUser.id);
    console.log('Current user ID:', currentUser.id);
    console.log('Circle creator ID:', selectedCircle.creator_id);

    // Format time to HH:MM format if needed
    const formattedTime = scheduledTime.includes(':') ? scheduledTime : `${scheduledTime}:00`;

    const { error } = await supabase
      .from('meetups')
      .insert({
        circle_id: selectedCircle.id,
        date: scheduledDate,
        time: formattedTime,
        topic: topic || `${selectedCircle.name} Meetup`,
        description: notes || `Meetup for ${selectedCircle.name}`,
        duration: 60,
        location: 'Virtual',
        created_by: authUser.id,  // Use auth user ID directly
        participant_limit: 10,
      });

    if (error) {
      console.error('Insert error details:', error);
      throw error;
    }

    alert(`Meetup scheduled for ${selectedCircle.name}!`);
    onNavigate?.('circleDetail', { circleId: selectedCircle.id });
  };

  // Get today's date for min date
  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => onNavigate?.('meetups')}>
          <ChevronLeft size={20} />
        </button>
        <h1 style={styles.title}>Schedule a Meetup</h1>
      </div>

      {/* Type Selection */}
      <div style={styles.section}>
        <label style={styles.label}>What type of meetup?</label>
        <div style={styles.typeButtons}>
          <button
            style={{
              ...styles.typeBtn,
              ...(meetupType === 'coffee' ? styles.typeBtnActive : {}),
            }}
            onClick={() => setMeetupType('coffee')}
          >
            <span style={styles.typeIcon}>☕</span>
            <span style={styles.typeLabel}>1:1 Coffee Chat</span>
            <span style={styles.typeDesc}>Private video chat with one person</span>
          </button>
          <button
            style={{
              ...styles.typeBtn,
              ...(meetupType === 'circle' ? styles.typeBtnActive : {}),
              ...(availableCircles.length === 0 ? styles.typeBtnDisabled : {}),
            }}
            onClick={() => availableCircles.length > 0 && setMeetupType('circle')}
            disabled={availableCircles.length === 0}
          >
            <span style={styles.typeIcon}>🔒</span>
            <span style={styles.typeLabel}>Circle Meetup</span>
            <span style={styles.typeDesc}>
              {availableCircles.length === 0
                ? 'No circles available'
                : 'Group meetup with circle members'}
            </span>
          </button>
        </div>
      </div>

      {/* Person/Circle Selection */}
      {meetupType === 'coffee' && (
        <div style={styles.section}>
          <label style={styles.label}>Who do you want to meet with?</label>
          {availableConnections.length === 0 ? (
            <div style={styles.emptyNote}>
              No connections yet. Connect with people first!
            </div>
          ) : (
            <div style={styles.selectionList}>
              {availableConnections.map(conn => (
                <button
                  key={conn.id}
                  style={{
                    ...styles.selectionItem,
                    ...(selectedConnection?.id === conn.id ? styles.selectionItemActive : {}),
                  }}
                  onClick={() => setSelectedConnection(conn)}
                >
                  {conn.profile_picture ? (
                    <img src={conn.profile_picture} alt={conn.name} style={styles.avatar} />
                  ) : (
                    <div style={styles.avatarPlaceholder}>
                      <User size={20} />
                    </div>
                  )}
                  <div style={styles.selectionInfo}>
                    <span style={styles.selectionName}>{conn.name}</span>
                    <span style={styles.selectionMeta}>{conn.career || 'Connection'}</span>
                  </div>
                  {selectedConnection?.id === conn.id && (
                    <span style={styles.checkmark}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {meetupType === 'circle' && (
        <div style={styles.section}>
          <label style={styles.label}>Which circle?</label>
          <div style={styles.selectionList}>
            {availableCircles.map(circle => (
              <button
                key={circle.id}
                style={{
                  ...styles.selectionItem,
                  ...(selectedCircle?.id === circle.id ? styles.selectionItemActive : {}),
                }}
                onClick={() => setSelectedCircle(circle)}
              >
                <div style={styles.circleIcon}>🔒</div>
                <div style={styles.selectionInfo}>
                  <span style={styles.selectionName}>{circle.name}</span>
                  <span style={styles.selectionMeta}>
                    {circle.meeting_day} • {circle.time_of_day || 'Flexible time'}
                  </span>
                </div>
                {selectedCircle?.id === circle.id && (
                  <span style={styles.checkmark}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date & Time */}
      {meetupType && (
        <>
          <div style={styles.section}>
            <label style={styles.label}>When?</label>
            <div style={styles.dateTimeRow}>
              <div style={styles.inputGroup}>
                <Calendar size={18} style={styles.inputIcon} />
                <input
                  type="date"
                  value={scheduledDate}
                  min={today}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <Clock size={18} style={styles.inputIcon} />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Topic (for circles) */}
          {meetupType === 'circle' && (
            <div style={styles.section}>
              <label style={styles.label}>Topic (optional)</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What will you discuss?"
                style={styles.textInput}
              />
            </div>
          )}

          {/* Notes */}
          <div style={styles.section}>
            <label style={styles.label}>
              {meetupType === 'coffee' ? 'Message (optional)' : 'Description (optional)'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                meetupType === 'coffee'
                  ? "Add a message for the recipient..."
                  : "Add details about this meetup..."
              }
              style={styles.textarea}
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <button
            style={{
              ...styles.submitBtn,
              ...(submitting ? styles.submitBtnDisabled : {}),
            }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Scheduling...' : meetupType === 'coffee' ? 'Send Request' : 'Schedule Meetup'}
          </button>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: fonts.sans,
    maxWidth: '600px',
    margin: '0 auto',
    paddingBottom: '40px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: `3px solid ${colors.border}`,
    borderTopColor: colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    color: colors.textMuted,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '32px',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: `1px solid ${colors.border}`,
    backgroundColor: 'white',
    cursor: 'pointer',
    color: colors.text,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: '24px',
    fontWeight: '600',
    color: colors.text,
    margin: 0,
  },
  section: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: colors.text,
    marginBottom: '12px',
  },
  typeButtons: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  typeBtn: {
    flex: '1 1 200px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '20px',
    backgroundColor: colors.cardBg,
    border: `2px solid ${colors.border}`,
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
  },
  typeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
  },
  typeBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  typeIcon: {
    fontSize: '32px',
  },
  typeLabel: {
    fontSize: '16px',
    fontWeight: '600',
    color: colors.text,
  },
  typeDesc: {
    fontSize: '12px',
    color: colors.textMuted,
  },
  selectionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  selectionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
    width: '100%',
  },
  selectionItemActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: colors.cream,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textMuted,
  },
  circleIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    backgroundColor: 'rgba(92, 64, 51, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  selectionInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  selectionName: {
    fontSize: '15px',
    fontWeight: '600',
    color: colors.text,
  },
  selectionMeta: {
    fontSize: '13px',
    color: colors.textMuted,
  },
  checkmark: {
    fontSize: '18px',
    color: colors.primary,
    fontWeight: '600',
  },
  emptyNote: {
    padding: '20px',
    backgroundColor: colors.cream,
    borderRadius: '12px',
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: '14px',
  },
  dateTimeRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  inputGroup: {
    flex: '1 1 150px',
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: colors.textMuted,
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '14px 14px 14px 44px',
    borderRadius: '12px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.warmWhite,
    fontSize: '14px',
    color: colors.text,
    boxSizing: 'border-box',
  },
  textInput: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.warmWhite,
    fontSize: '14px',
    color: colors.text,
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.warmWhite,
    fontSize: '14px',
    color: colors.text,
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: fonts.sans,
  },
  submitBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: fonts.sans,
    transition: 'all 0.2s ease',
  },
  submitBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};

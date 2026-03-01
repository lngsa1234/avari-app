// components/ScheduleMeetupView.js
// Unified page to schedule 1:1 coffee chats or circle meetups

'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, Clock, Users, User, MessageCircle, MapPin, Repeat, ImagePlus, X } from 'lucide-react';
import { reconcileCircleMeetups } from '@/lib/circleMeetupHelpers';


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
  previousView,
  // Pre-fill props from navigation context
  initialType = null,
  initialCircleId = null,
  initialCircleName = null,
  initialConnectionId = null,
  initialConnectionName = null,
  initialTopic = '',
  initialDescription = '',
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
  const [topic, setTopic] = useState(initialTopic || '');
  const [notes, setNotes] = useState(initialDescription || '');
  const [meetingFormat, setMeetingFormat] = useState('virtual');
  const [location, setLocation] = useState('Virtual');
  const [participantLimit, setParticipantLimit] = useState(20);
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatCadence, setRepeatCadence] = useState('Weekly');

  const [eventImage, setEventImage] = useState(null);
  const [eventImageFile, setEventImageFile] = useState(null);

  const [availableCircles, setAvailableCircles] = useState([]);
  const [availableConnections, setAvailableConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  // Sync selectedCircle with full data after circles are loaded, and prefill schedule
  useEffect(() => {
    if (initialCircleId && availableCircles.length > 0) {
      const fullCircleData = availableCircles.find(c => c.id === initialCircleId);
      if (fullCircleData) {
        setSelectedCircle(fullCircleData);

        // Prefill schedule fields from existing circle settings
        if (fullCircleData.cadence && fullCircleData.cadence !== 'As needed') {
          setIsRepeating(true);
          setRepeatCadence(fullCircleData.cadence);
        }
        if (fullCircleData.time_of_day && fullCircleData.time_of_day !== 'Flexible') {
          // Convert display time (e.g. "7:00 PM") to input format (e.g. "19:00")
          const match = fullCircleData.time_of_day.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (match) {
            let hours = parseInt(match[1]);
            const minutes = match[2];
            const period = match[3].toUpperCase();
            if (period === 'PM' && hours !== 12) hours += 12;
            else if (period === 'AM' && hours === 12) hours = 0;
            setScheduledTime(`${hours.toString().padStart(2, '0')}:${minutes}`);
          }
        }
        // Prefill topic
        setTopic(`${fullCircleData.name} Meetup`);

        if (fullCircleData.meeting_day) {
          // Set the date to the next occurrence of the meeting day
          const DAYS = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
          const dayIndex = DAYS[fullCircleData.meeting_day];
          if (dayIndex !== undefined) {
            const today = new Date();
            const daysUntil = (dayIndex - today.getDay() + 7) % 7;
            const nextDate = new Date(today);
            nextDate.setDate(today.getDate() + (daysUntil === 0 ? 7 : daysUntil));
            setScheduledDate(nextDate.toISOString().split('T')[0]);
          }
        }
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

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }
    setEventImageFile(file);
    setEventImage(URL.createObjectURL(file));
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

    if (meetupType === 'coffee' && !topic.trim()) {
      alert('Please enter a topic for the coffee chat');
      return;
    }

    if (meetupType === 'circle' && !selectedCircle) {
      alert('Please select a circle');
      return;
    }

    if (meetupType === 'circle' && !topic.trim()) {
      alert('Please enter a topic for the meetup');
      return;
    }

    if (meetupType === 'community' && !topic.trim()) {
      alert('Please enter a topic for the event');
      return;
    }

    if (meetingFormat !== 'virtual' && !location.trim()) {
      alert('Please enter a location');
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
      } else if (meetupType === 'circle') {
        await scheduleCircleMeetup();
      } else if (meetupType === 'community') {
        await scheduleCommunityEvent();
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
        topic: topic.trim(),
        notes: notes || null,
        status: 'pending',
      });

    if (error) throw error;

    alert(`Request sent to ${selectedConnection.name}!`);
    onNavigate?.(previousView || 'meetups');
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

    if (isRepeating) {
      const repeatDay = new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });

      // Convert 24h time to display format (e.g. "14:00" → "2:00 PM")
      const [hours, minutes] = formattedTime.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const timeOfDay = `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;

      // Update circle's cadence settings
      await supabase
        .from('connection_groups')
        .update({
          meeting_day: repeatDay,
          cadence: repeatCadence,
          time_of_day: timeOfDay,
        })
        .eq('id', selectedCircle.id);

      // Reconcile meetup records with the new schedule
      await reconcileCircleMeetups(selectedCircle.id, {
        ...selectedCircle,
        meeting_day: repeatDay,
        cadence: repeatCadence,
        time_of_day: timeOfDay,
      });
    } else {
      // Non-repeating: insert a single meetup
      const { data: existingOnDate } = await supabase
        .from('meetups')
        .select('id')
        .eq('circle_id', selectedCircle.id)
        .eq('date', scheduledDate)
        .maybeSingle();

      if (!existingOnDate) {
        const { data: meetupData, error } = await supabase
          .from('meetups')
          .insert({
            circle_id: selectedCircle.id,
            date: scheduledDate,
            time: formattedTime,
            topic: topic.trim(),
            description: notes || `Meetup for ${selectedCircle.name}`,
            duration: 60,
            location: meetingFormat === 'virtual' ? 'Virtual' : location,
            meeting_format: meetingFormat,
            created_by: authUser.id,
            participant_limit: 10,
          })
          .select('id')
          .single();

        if (error) throw error;

        if (meetupData?.id) {
          await supabase
            .from('meetup_signups')
            .insert({ meetup_id: meetupData.id, user_id: authUser.id });
        }
      }
    }

    alert(`Meetup scheduled for ${selectedCircle.name}!`);
    onNavigate?.('circleDetail', { circleId: selectedCircle.id });
  };

  const scheduleCommunityEvent = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      throw new Error('Not authenticated');
    }

    const formattedTime = scheduledTime.includes(':') ? scheduledTime : `${scheduledTime}:00`;

    // Upload event image if selected
    let imageUrl = null;
    if (eventImageFile) {
      const fileExt = eventImageFile.name.split('.').pop();
      const fileName = `profile-photos/${authUser.id}-meetup-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, eventImageFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      imageUrl = publicUrl;
    }

    const { data: meetupData, error } = await supabase
      .from('meetups')
      .insert({
        circle_id: null,
        date: scheduledDate,
        time: formattedTime,
        topic: topic.trim(),
        description: notes || 'Community event',
        duration: 60,
        location: meetingFormat === 'virtual' ? 'Virtual' : location,
        meeting_format: meetingFormat,
        created_by: authUser.id,
        participant_limit: participantLimit,
        ...(imageUrl && { image_url: imageUrl }),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Insert error details:', error);
      throw error;
    }

    // Auto-RSVP the creator
    if (meetupData?.id) {
      await supabase
        .from('meetup_signups')
        .insert({ meetup_id: meetupData.id, user_id: authUser.id });
    }

    alert('Community event created!');
    onNavigate?.(previousView || 'meetups');
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
        <button style={styles.backBtn} onClick={() => onNavigate?.(previousView || 'meetups')}>
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
          <button
            style={{
              ...styles.typeBtn,
              ...(meetupType === 'community' ? styles.typeBtnActive : {}),
            }}
            onClick={() => setMeetupType('community')}
          >
            <span style={styles.typeIcon}>🌐</span>
            <span style={styles.typeLabel}>Community Event</span>
            <span style={styles.typeDesc}>Open meetup for all members</span>
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

      {/* Participant Limit for Community Events */}
      {meetupType === 'community' && (
        <div style={styles.section}>
          <label style={styles.label}>Participant Limit</label>
          <div style={styles.inputGroup}>
            <Users size={18} style={styles.inputIcon} />
            <input
              type="number"
              value={participantLimit}
              min={2}
              max={100}
              onChange={(e) => setParticipantLimit(parseInt(e.target.value) || 20)}
              style={styles.input}
            />
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

          {/* Repeat Toggle - Circle meetups only */}
          {meetupType === 'circle' && (
            <div style={styles.section}>
              <div
                style={styles.toggleRow}
                onClick={() => setIsRepeating(!isRepeating)}
              >
                <div style={styles.toggleInfo}>
                  <Repeat size={18} color={isRepeating ? colors.primary : colors.textMuted} />
                  <span style={styles.toggleLabel}>Repeat this meetup</span>
                </div>
                <div style={{
                  ...styles.toggle,
                  ...(isRepeating ? styles.toggleActive : {}),
                }}>
                  <div style={{
                    ...styles.toggleKnob,
                    ...(isRepeating ? styles.toggleKnobActive : {}),
                  }} />
                </div>
              </div>

              {isRepeating && (
                <div style={{ marginTop: '16px' }}>
                  <label style={styles.label}>How often?</label>
                  <div style={styles.cadenceButtons}>
                    {[
                      { value: 'Weekly', label: 'Weekly' },
                      { value: 'Biweekly', label: 'Every other week' },
                      { value: 'Monthly', label: 'Monthly' },
                      { value: '1st & 3rd', label: '1st & 3rd week' },
                    ].map(option => (
                      <button
                        key={option.value}
                        style={{
                          ...styles.cadenceBtn,
                          ...(repeatCadence === option.value ? styles.cadenceBtnActive : {}),
                        }}
                        onClick={() => setRepeatCadence(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {scheduledDate && (
                    <div style={styles.repeatInfo}>
                      <Repeat size={14} color={colors.primary} />
                      <span style={styles.repeatInfoText}>
                        Future sessions will be auto-generated on {new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}s, {repeatCadence === 'Biweekly' ? 'every other week' : repeatCadence === '1st & 3rd' ? '1st & 3rd week of month' : repeatCadence.toLowerCase()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Meeting Format - for circle and community events */}
          {(meetupType === 'community' || meetupType === 'circle') && (
            <div style={styles.section}>
              <label style={styles.label}>Meeting Format</label>
              <div style={styles.cadenceButtons}>
                {[
                  { value: 'virtual', label: 'Virtual' },
                  { value: 'in_person', label: 'In-Person' },
                  { value: 'hybrid', label: 'Hybrid' },
                ].map(option => (
                  <button
                    key={option.value}
                    style={{
                      ...styles.cadenceBtn,
                      ...(meetingFormat === option.value ? styles.cadenceBtnActive : {}),
                    }}
                    onClick={() => {
                      setMeetingFormat(option.value);
                      if (option.value === 'virtual') {
                        setLocation('Virtual');
                      } else if (location === 'Virtual') {
                        setLocation('');
                      }
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location - hidden for virtual */}
          {meetingFormat !== 'virtual' && (
            <div style={styles.section}>
              <label style={styles.label}>
                {meetingFormat === 'hybrid' ? 'Physical Location *' : 'Location *'}
              </label>
              <div style={styles.inputGroup}>
                <MapPin size={18} style={styles.inputIcon} />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Blue Bottle Coffee, 123 Main St"
                  style={styles.input}
                />
              </div>
              {meetingFormat === 'hybrid' && (
                <p style={{ fontSize: '12px', color: colors.textMuted, margin: '8px 0 0', fontStyle: 'italic' }}>
                  Virtual call link will also be available
                </p>
              )}
            </div>
          )}

          {/* Topic */}
          <div style={styles.section}>
            <label style={styles.label}>Topic *</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={meetupType === 'coffee' ? "What would you like to chat about?" : meetupType === 'community' ? "What's the event about?" : "What will you discuss?"}
              style={styles.textInput}
            />
          </div>

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

          {/* Event Photo - Community events only */}
          {meetupType === 'community' && (
            <div style={styles.section}>
              <label style={styles.label}>Event Photo (optional)</label>
              {eventImage ? (
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
                  <img
                    src={eventImage}
                    alt="Event preview"
                    style={{
                      width: '100%',
                      height: '180px',
                      objectFit: 'cover',
                      display: 'block',
                      borderRadius: '12px',
                    }}
                  />
                  <button
                    onClick={() => { setEventImage(null); setEventImageFile(null); }}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      border: 'none',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '24px',
                  borderRadius: '12px',
                  border: `2px dashed ${colors.border}`,
                  backgroundColor: colors.warmWhite,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}>
                  <ImagePlus size={28} color={colors.textMuted} />
                  <span style={{ fontSize: '14px', color: colors.textMuted, fontWeight: '500' }}>
                    Add a cover photo
                  </span>
                  <span style={{ fontSize: '12px', color: colors.textMuted }}>
                    Max 5MB
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            style={{
              ...styles.submitBtn,
              ...(submitting ? styles.submitBtnDisabled : {}),
            }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? 'Scheduling...'
              : meetupType === 'coffee'
                ? 'Send Request'
                : meetupType === 'community'
                  ? 'Create Event'
                  : 'Schedule Meetup'}
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
    maxWidth: '100%',
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
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none',
  },
  toggleInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  toggleLabel: {
    fontSize: '15px',
    fontWeight: '600',
    color: colors.text,
  },
  toggle: {
    width: '48px',
    height: '28px',
    borderRadius: '14px',
    backgroundColor: colors.border,
    position: 'relative',
    transition: 'background-color 0.2s ease',
    flexShrink: 0,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleKnob: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: 'white',
    position: 'absolute',
    top: '3px',
    left: '3px',
    transition: 'transform 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
  },
  toggleKnobActive: {
    transform: 'translateX(20px)',
  },
  cadenceButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  cadenceBtn: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: `1.5px solid ${colors.border}`,
    backgroundColor: colors.warmWhite,
    fontSize: '13px',
    fontWeight: '500',
    color: colors.textLight,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: fonts.sans,
  },
  cadenceBtnActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    color: colors.primary,
    fontWeight: '600',
  },
  repeatInfo: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    marginTop: '14px',
    padding: '12px 14px',
    backgroundColor: 'rgba(139, 111, 92, 0.06)',
    borderRadius: '10px',
  },
  repeatInfoText: {
    fontSize: '13px',
    color: colors.textLight,
    lineHeight: '1.4',
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

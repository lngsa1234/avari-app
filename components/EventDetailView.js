'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ChevronLeft,
  Calendar,
  Clock,
  Users,
  MapPin,
  Video,
  Sparkles,
  CheckCircle2,
  Circle,
  FileText,
  ListTodo,
  MessageSquare,
  Quote,
  UserCheck,
  XCircle,
  ImagePlus,
  X,
} from 'lucide-react';
import { parseLocalDate } from '../lib/dateUtils';

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

export default function EventDetailView({ currentUser, supabase: supabaseProp, onNavigate, meetupId, previousView }) {
  const sb = supabaseProp || supabase;
  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 640;
  const isTablet = windowWidth >= 640 && windowWidth < 768;

  const [meetup, setMeetup] = useState(null);
  const [host, setHost] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [userSignupType, setUserSignupType] = useState(null);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [attendeeCounts, setAttendeeCounts] = useState({ in_person: 0, video: 0 });
  const [recap, setRecap] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [completedActions, setCompletedActions] = useState(new Set());
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isHost = meetup?.created_by === currentUser.id;

  const handleBack = () => {
    onNavigate?.(previousView || 'home');
  };

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be less than 5MB'); return; }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-photos/${currentUser.id}-meetup-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await sb.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = sb.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await sb
        .from('meetups')
        .update({ image_url: publicUrl })
        .eq('id', meetupId);
      if (updateError) throw updateError;

      setMeetup(prev => ({ ...prev, image_url: publicUrl }));
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload photo: ' + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    try {
      const { error } = await sb
        .from('meetups')
        .update({ image_url: null })
        .eq('id', meetupId);
      if (error) throw error;
      setMeetup(prev => ({ ...prev, image_url: null }));
    } catch (err) {
      alert('Failed to remove photo: ' + err.message);
    }
  }

  useEffect(() => {
    if (meetupId) loadEventDetails();
  }, [meetupId]);

  async function loadEventDetails() {
    try {
      setLoading(true);

      // Fetch meetup with host profile and circle info
      const { data: meetupData, error: meetupError } = await sb
        .from('meetups')
        .select('*, connection_groups(id, name), host:profiles!created_by(id, name, profile_picture, career)')
        .eq('id', meetupId)
        .single();

      if (meetupError) throw meetupError;

      setMeetup(meetupData);
      setHost(meetupData.host);

      // Fetch attendees (with signup_type) and check signup in parallel
      const [signupsResult, signupResult] = await Promise.all([
        sb.from('meetup_signups')
          .select('user_id, signup_type')
          .eq('meetup_id', meetupId),
        sb.from('meetup_signups')
          .select('id, signup_type')
          .eq('meetup_id', meetupId)
          .eq('user_id', currentUser.id)
          .maybeSingle(),
      ]);

      // Fetch profiles for attendees
      const signups = signupsResult.data || [];
      const userIds = signups.map(s => s.user_id);
      let attendeesData = [];
      if (userIds.length > 0) {
        const { data: profiles } = await sb
          .from('profiles')
          .select('id, name, profile_picture, career')
          .in('id', userIds);
        attendeesData = signups.map(s => ({
          user_id: s.user_id,
          signup_type: s.signup_type || 'video',
          profiles: (profiles || []).find(p => p.id === s.user_id) || null,
        }));
      }

      // Calculate attendee counts by type
      const counts = { in_person: 0, video: 0 };
      signups.forEach(s => {
        if (s.signup_type === 'in_person') counts.in_person++;
        else counts.video++;
      });
      setAttendeeCounts(counts);

      setAttendees(attendeesData);
      setIsSignedUp(!!signupResult.data);
      if (signupResult.data) {
        setUserSignupType(signupResult.data.signup_type || 'video');
      }

      // Check if past event and load recap
      const eventDate = parseLocalDate(meetupData.date);
      const now = new Date();
      const isPast = eventDate < now;

      if (isPast) {
        // Look for recap by matching meetup ID in channel_name
        const { data: recapData } = await sb
          .from('call_recaps')
          .select('*')
          .ilike('channel_name', `%${meetupId}%`);

        if (recapData && recapData.length > 0) {
          const recapRecord = recapData[0];
          setRecap(recapRecord);
          setParsed(parseAISummary(recapRecord.ai_summary));
          setActiveTab('recap');

          // Load completed actions from localStorage
          const savedActions = localStorage.getItem('completed_recap_actions');
          if (savedActions) {
            setCompletedActions(new Set(JSON.parse(savedActions)));
          }
        }
      }
    } catch (error) {
      console.error('Error loading event details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRsvp(signupType) {
    // For hybrid events, show format picker first
    const format = meetup?.meeting_format;
    if (format === 'hybrid' && !signupType) {
      setShowFormatPicker(true);
      return;
    }

    // Determine signup_type based on meeting format
    let type = signupType || 'video';
    if (format === 'in_person') type = 'in_person';
    else if (format === 'virtual') type = 'video';

    try {
      setActionLoading(true);
      setShowFormatPicker(false);
      const { error } = await sb
        .from('meetup_signups')
        .insert([{ meetup_id: meetupId, user_id: currentUser.id, signup_type: type }]);

      if (error) {
        if (error.code === '23505') {
          alert('You have already signed up for this event!');
        } else {
          alert('Error signing up: ' + error.message);
        }
      } else {
        setIsSignedUp(true);
        setUserSignupType(type);
        await reloadAttendees();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function reloadAttendees() {
    const { data: signups } = await sb
      .from('meetup_signups')
      .select('user_id, signup_type')
      .eq('meetup_id', meetupId);
    const ids = (signups || []).map(s => s.user_id);

    // Recalculate counts
    const counts = { in_person: 0, video: 0 };
    (signups || []).forEach(s => {
      if (s.signup_type === 'in_person') counts.in_person++;
      else counts.video++;
    });
    setAttendeeCounts(counts);

    if (ids.length > 0) {
      const { data: profiles } = await sb
        .from('profiles')
        .select('id, name, profile_picture, career')
        .in('id', ids);
      setAttendees((signups || []).map(s => ({
        user_id: s.user_id,
        signup_type: s.signup_type || 'video',
        profiles: (profiles || []).find(p => p.id === s.user_id) || null,
      })));
    } else {
      setAttendees([]);
    }
  }

  async function handleCancelRsvp() {
    if (!confirm('Are you sure you want to cancel your RSVP?')) return;
    try {
      setActionLoading(true);
      const { error } = await sb
        .from('meetup_signups')
        .delete()
        .eq('meetup_id', meetupId)
        .eq('user_id', currentUser.id);

      if (error) {
        alert('Error canceling: ' + error.message);
      } else {
        setIsSignedUp(false);
        await reloadAttendees();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function handleJoinCall() {
    if (!meetup) return;
    if (meetup.circle_id) {
      const channelName = `connection-group-${meetup.circle_id}`;
      window.location.href = `/call/circle/${channelName}`;
    } else {
      window.location.href = `/call/${meetupId}`;
    }
  }

  function toggleActionItem(actionIndex) {
    if (!recap) return;
    const key = `${recap.id}_${actionIndex}`;
    const newCompleted = new Set(completedActions);
    if (newCompleted.has(key)) {
      newCompleted.delete(key);
    } else {
      newCompleted.add(key);
    }
    setCompletedActions(newCompleted);
    localStorage.setItem('completed_recap_actions', JSON.stringify([...newCompleted]));
  }

  // Responsive
  const cardPadding = isMobile ? '16px' : isTablet ? '18px' : '20px';
  const cardRadius = isMobile ? '14px' : '16px';
  const sectionTitleSize = isMobile ? '15px' : '16px';
  const metaFontSize = isMobile ? '12px' : '13px';
  const bodyFontSize = isMobile ? '13px' : '14px';
  const titleSize = isMobile ? '20px' : isTablet ? '22px' : '24px';

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', fontFamily: fonts.sans }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: '40px', height: '40px', border: `3px solid ${colors.border}`, borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
        <p style={{ color: colors.textMuted, fontSize: '15px' }}>Loading event...</p>
      </div>
    );
  }

  if (!meetup) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', padding: '24px', textAlign: 'center', fontFamily: fonts.sans }}>
        <Calendar size={isMobile ? 40 : 48} style={{ color: colors.textSoft, marginBottom: '16px' }} />
        <h2 style={{ color: colors.text, margin: '0 0 8px', fontSize: isMobile ? '18px' : '22px', fontFamily: fonts.serif }}>Event not found</h2>
        <p style={{ color: colors.textMuted, marginBottom: '24px', fontSize: bodyFontSize }}>This event may have been removed.</p>
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

  // Parse event date
  const eventDate = parseLocalDate(meetup.date);
  const now = new Date();
  const isPast = eventDate < now;

  // Check if event is live (today and within time window)
  const todayStr = new Date().toISOString().split('T')[0];
  const eventDateStr = meetup.date;
  const isToday = todayStr === eventDateStr;
  let isLive = false;
  if (isToday && meetup.time) {
    try {
      const [h, m] = meetup.time.split(':').map(Number);
      const eventStart = new Date(); eventStart.setHours(h, m, 0, 0);
      const eventEnd = new Date(eventStart.getTime() + (parseInt(meetup.duration || '60') * 60000));
      isLive = now >= eventStart && now <= eventEnd;
    } catch {}
  }

  const dateDisplay = eventDate.toLocaleDateString('en-US', isMobile
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  );

  const hasRecap = !!(recap && parsed);
  const showTabs = isPast && hasRecap;

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
        }}>Event Details</h2>
      </div>

      {/* Hero Image / Upload */}
      {meetup.image_url ? (
        <div style={{
          borderRadius: '14px',
          overflow: 'hidden',
          marginBottom: '8px',
          position: 'relative',
        }}>
          <img
            src={meetup.image_url}
            alt={meetup.topic || 'Event'}
            style={{
              width: '100%',
              height: '200px',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {isHost && !isPast && (
            <div style={{
              position: 'absolute', top: '8px', right: '8px',
              display: 'flex', gap: '6px',
            }}>
              <label style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.5)', border: 'none',
                color: 'white', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer',
              }}>
                <ImagePlus size={16} />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </label>
              <button
                onClick={handleRemovePhoto}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.5)', border: 'none',
                  color: 'white', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      ) : isHost && !isPast ? (
        <label style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          padding: '20px',
          borderRadius: '14px',
          border: `2px dashed ${colors.border}`,
          backgroundColor: 'rgba(139, 111, 92, 0.03)',
          cursor: uploadingPhoto ? 'wait' : 'pointer',
          marginBottom: '8px',
          opacity: uploadingPhoto ? 0.6 : 1,
        }}>
          <ImagePlus size={24} color={colors.textSoft} />
          <span style={{ fontSize: '13px', color: colors.textMuted, fontWeight: '500' }}>
            {uploadingPhoto ? 'Uploading...' : 'Add event photo'}
          </span>
          {!uploadingPhoto && (
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          )}
        </label>
      ) : null}

      {/* Hero Header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '14px' : '16px',
        padding: isMobile ? '20px 0' : '24px 4px',
        alignItems: 'flex-start',
      }}>
        {/* Date badge */}
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
            {eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
          </span>
          <span style={{
            display: 'block',
            fontWeight: '700',
            color: colors.text,
            fontFamily: fonts.serif,
            lineHeight: '1.1',
            fontSize: isMobile ? '24px' : '28px',
          }}>{eventDate.getDate()}</span>
        </div>

        {/* Event info */}
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
            {meetup.topic || 'Community Event'}
          </h1>

          {/* Status badges */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '8px',
          }}>
            {isLive && (
              <span style={{
                fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '100px',
                background: '#FEF0EC', color: '#D45B3E',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D45B3E', animation: 'pulse-live 1.5s infinite' }} />
                Live Now
              </span>
            )}
            {isPast && (
              <span style={{
                fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '100px',
                backgroundColor: 'rgba(139, 158, 126, 0.15)', color: '#5C7A4E',
              }}>
                Completed
              </span>
            )}
            {meetup.meeting_format && meetup.meeting_format !== 'virtual' && (
              <span style={{
                fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '100px',
                background: meetup.meeting_format === 'hybrid' ? '#E8EDF0' : '#E8F0E4',
                color: meetup.meeting_format === 'hybrid' ? '#4A6572' : '#4E6B46',
              }}>
                {meetup.meeting_format === 'hybrid' ? 'Hybrid' : 'In-Person'}
              </span>
            )}
            {meetup.connection_groups?.name && (
              <span style={{
                fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '100px',
                background: '#F0E4D8', color: '#6B4632',
              }}>
                {meetup.connection_groups.name}
              </span>
            )}
          </div>

          {/* Meta info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '14px',
            flexWrap: 'wrap',
            marginBottom: '4px',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: metaFontSize, color: colors.textMuted }}>
              <Calendar size={isMobile ? 12 : 14} /> {dateDisplay}
            </span>
            {meetup.time && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: metaFontSize, color: colors.textMuted }}>
                <Clock size={isMobile ? 12 : 14} /> {formatTime(meetup.time)}
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
              <MapPin size={isMobile ? 12 : 14} /> {
                meetup.meeting_format === 'hybrid'
                  ? `${meetup.location} + Virtual`
                  : meetup.meeting_format === 'in_person'
                    ? meetup.location
                    : 'Virtual'
              }
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: metaFontSize, color: colors.textMuted }}>
              <Users size={isMobile ? 12 : 14} /> {
                meetup.meeting_format === 'hybrid'
                  ? `${attendeeCounts.in_person} in-person, ${attendeeCounts.video} virtual`
                  : `${attendees.length} attendee${attendees.length !== 1 ? 's' : ''}`
              }
            </span>
          </div>
        </div>
      </div>

      {/* Tab switcher - only for past events with recap */}
      {showTabs && (
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          backgroundColor: 'rgba(139, 111, 92, 0.08)',
          borderRadius: '12px',
          marginBottom: '16px',
        }}>
          {['details', 'recap'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? colors.text : colors.textMuted,
                fontSize: '14px',
                fontWeight: activeTab === tab ? '600' : '500',
                cursor: 'pointer',
                fontFamily: fonts.sans,
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {tab === 'details' ? 'Details' : 'Recap'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '12px' : '16px',
      }}>
        {activeTab === 'details' && (
          <>
            {/* Action buttons */}
            {!isPast && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {isSignedUp ? (
                    <>
                      {meetup.meeting_format !== 'in_person' && (
                        <button
                          onClick={handleJoinCall}
                          style={{
                            flex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            padding: '12px 20px', borderRadius: '14px',
                            backgroundColor: colors.primaryDark, color: 'white',
                            border: 'none', fontSize: '15px', fontWeight: '600',
                            cursor: 'pointer', fontFamily: fonts.sans,
                          }}
                        >
                          <Video size={18} /> Join Call
                        </button>
                      )}
                      <button
                        onClick={handleCancelRsvp}
                        disabled={actionLoading}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          padding: '12px 16px', borderRadius: '14px',
                          backgroundColor: 'transparent', color: colors.textMuted,
                          border: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '500',
                          cursor: actionLoading ? 'not-allowed' : 'pointer', fontFamily: fonts.sans,
                          opacity: actionLoading ? 0.6 : 1,
                          flex: meetup.meeting_format === 'in_person' ? 1 : undefined,
                        }}
                      >
                        <XCircle size={16} /> Cancel RSVP
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleRsvp()}
                      disabled={actionLoading}
                      style={{
                        flex: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '12px 20px', borderRadius: '14px',
                        backgroundColor: colors.primaryDark, color: 'white',
                        border: 'none', fontSize: '15px', fontWeight: '600',
                        cursor: actionLoading ? 'not-allowed' : 'pointer', fontFamily: fonts.sans,
                        opacity: actionLoading ? 0.6 : 1,
                      }}
                    >
                      <UserCheck size={18} /> RSVP
                    </button>
                  )}
                </div>

                {/* Hybrid format picker */}
                {showFormatPicker && (
                  <div style={{
                    display: 'flex',
                    gap: '10px',
                    padding: '14px',
                    backgroundColor: 'rgba(139, 111, 92, 0.06)',
                    borderRadius: '14px',
                    border: `1px solid ${colors.border}`,
                  }}>
                    <span style={{ fontSize: '13px', color: colors.textLight, alignSelf: 'center', fontWeight: '500' }}>
                      How will you attend?
                    </span>
                    <button
                      onClick={() => handleRsvp('in_person')}
                      disabled={actionLoading}
                      style={{
                        flex: 1,
                        padding: '10px 14px', borderRadius: '10px',
                        backgroundColor: 'white', color: colors.text,
                        border: `1.5px solid ${colors.border}`, fontSize: '13px', fontWeight: '600',
                        cursor: 'pointer', fontFamily: fonts.sans,
                      }}
                    >
                      In-Person
                    </button>
                    <button
                      onClick={() => handleRsvp('video')}
                      disabled={actionLoading}
                      style={{
                        flex: 1,
                        padding: '10px 14px', borderRadius: '10px',
                        backgroundColor: 'white', color: colors.text,
                        border: `1.5px solid ${colors.border}`, fontSize: '13px', fontWeight: '600',
                        cursor: 'pointer', fontFamily: fonts.sans,
                      }}
                    >
                      Virtual
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {meetup.description && (
              <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
                <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
                  <FileText size={isMobile ? 14 : 16} style={{ color: colors.primary }} />
                  About This Event
                </h3>
                <p style={{
                  fontSize: bodyFontSize,
                  color: colors.textLight,
                  lineHeight: '1.6',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}>
                  {meetup.description}
                </p>
              </div>
            )}

            {/* Host */}
            {host && (
              <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
                <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
                  <Users size={isMobile ? 14 : 16} style={{ color: colors.primary }} />
                  Host
                </h3>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(250, 245, 239, 0.7)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                  }}
                  onClick={() => onNavigate?.('userProfile', { userId: host.id })}
                >
                  {host.profile_picture ? (
                    <img src={host.profile_picture} alt={host.name} style={{
                      width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover',
                    }} />
                  ) : (
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      backgroundColor: colors.primary, color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', fontWeight: '600',
                    }}>
                      {(host.name || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: colors.text, margin: 0 }}>
                      {host.name}
                    </p>
                    {host.career && (
                      <p style={{ fontSize: '12px', color: colors.textMuted, margin: '2px 0 0' }}>
                        {host.career}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Attendees */}
            <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
              <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
                <Users size={isMobile ? 14 : 16} style={{ color: colors.primary }} />
                Attendees ({attendees.length})
              </h3>
              {attendees.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '6px' : '10px' }}>
                  {attendees.map(signup => {
                    const profile = signup.profiles;
                    return (
                      <div
                        key={signup.user_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: isMobile ? '6px' : '8px',
                          padding: isMobile ? '6px 10px' : '8px 12px',
                          backgroundColor: 'rgba(250, 245, 239, 0.7)',
                          borderRadius: '20px',
                          fontSize: isMobile ? '12px' : '13px',
                          color: colors.textLight,
                          cursor: 'pointer',
                        }}
                        onClick={() => onNavigate?.('userProfile', { userId: signup.user_id })}
                      >
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
                          <span style={{ color: colors.textSoft, fontSize: '12px' }}>{profile.career}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: bodyFontSize, color: colors.textSoft, fontStyle: 'italic', margin: 0 }}>
                  No attendees yet. Be the first to RSVP!
                </p>
              )}
            </div>
          </>
        )}

        {activeTab === 'recap' && hasRecap && (
          <>
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
                        <p style={{ fontSize: isMobile ? '11px' : '12px', color: colors.textMuted, margin: '6px 0 0' }}>&mdash; {q.author}</p>
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
                        width: '6px', height: '6px', borderRadius: '50%',
                        backgroundColor: colors.sage, marginTop: '7px', flexShrink: 0,
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
                  const isCompleted = completedActions.has(`${recap.id}_${i}`);
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
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-live {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
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

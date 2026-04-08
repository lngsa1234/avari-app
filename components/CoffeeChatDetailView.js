'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/apiFetch';
import { getRecapTranscriptFromStorage } from '@/lib/callRecapHelpers';
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
  Pencil,
  Check,
  Share2,
} from 'lucide-react';
import { parseLocalDate, toLocalDateString, isEventPast, isEventLive, formatEventTime, formatEventDate, eventDateTimeToUTC } from '../lib/dateUtils';
import { colors as tokens, fonts } from '@/lib/designTokens';
import { invalidateQuery } from '@/hooks/useSupabaseQuery';

const colors = {
  primary: tokens.primary,
  primaryDark: tokens.primaryDark,
  cream: tokens.bg,
  text: '#3F1906',
  textLight: tokens.textSecondary,
  textMuted: tokens.textSoft,
  textSoft: tokens.textMuted,
  border: 'rgba(139, 111, 92, 0.1)',
  sage: tokens.sage,
  gold: tokens.gold,
  purple: tokens.purple,
  gradient: tokens.gradient,
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

export default function CoffeeChatDetailView({ currentUser, supabase: supabaseProp, onNavigate, meetupId, meetupCategory, previousView, onMeetupChanged, toast }) {
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
  const [actualParticipants, setActualParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [completedActions, setCompletedActions] = useState(new Set());
  const [suggestedTopics, setSuggestedTopics] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editing, setEditing] = useState(null); // 'time' | 'location' | 'description' | null
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'cancelRsvp' | 'cancelEvent', title, message }

  const isHost = meetup?.created_by === currentUser.id;

  const handleBack = () => {
    onNavigate?.(previousView || 'home');
  };

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast?.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast?.error('Image must be less than 5MB'); return; }

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
      onMeetupChanged?.();
    } catch (err) {
      console.error('Upload error:', err);
      toast?.error('Failed to upload photo: ' + err.message);
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
      onMeetupChanged?.();
    } catch (err) {
      toast?.error('Failed to remove photo: ' + err.message);
    }
  }

  useEffect(() => {
    if (meetupId) loadEventDetails();
  }, [meetupId]);

  async function loadEventDetails(categoryOverride) {
    try {
      setLoading(true);
      const category = categoryOverride || meetupCategory;

      // 1:1 coffee chat — load from coffee_chats table
      if (category === 'coffee') {
        const { data: chatData, error: chatError } = await sb
          .from('coffee_chats')
          .select('*')
          .eq('id', meetupId)
          .single();

        if (chatError) throw chatError;

        // Fetch both participant profiles
        const participantIds = [chatData.requester_id, chatData.recipient_id];
        const { data: profiles } = await sb
          .from('profiles')
          .select('id, name, profile_picture, career')
          .in('id', participantIds);

        const requesterProfile = (profiles || []).find(p => p.id === chatData.requester_id);
        const recipientProfile = (profiles || []).find(p => p.id === chatData.recipient_id);
        const otherPerson = chatData.requester_id === currentUser.id ? recipientProfile : requesterProfile;

        // Normalize coffee chat to meetup shape
        const scheduledTime = chatData.scheduled_time ? new Date(chatData.scheduled_time) : null;
        const normalizedMeetup = {
          id: chatData.id,
          _isCoffeeChat: true,
          _coffeeChatData: chatData,
          topic: chatData.topic || `Coffee Chat with ${otherPerson?.name || 'Unknown'}`,
          description: chatData.notes || null,
          date: scheduledTime ? scheduledTime.toISOString().split('T')[0] : null,
          time: scheduledTime ? scheduledTime.toTimeString().slice(0, 5) : null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          duration: String(chatData.duration || 30),
          location: 'Virtual',
          meeting_format: 'virtual',
          status: chatData.status,
          created_by: chatData.requester_id,
          created_at: chatData.created_at,
          circle_id: null,
        };

        setMeetup(normalizedMeetup);
        setHost(requesterProfile);

        const attendeesData = (profiles || []).map(p => ({
          user_id: p.id,
          signup_type: 'video',
          profiles: p,
        }));
        setAttendees(attendeesData);
        setAttendeeCounts({ in_person: 0, video: attendeesData.length });
        setIsSignedUp(true);
        setLoading(false);
        return;
      }

      // Circle or community event — load from meetups table
      const { data: meetupData, error: meetupError } = await sb
        .from('meetups')
        .select('*, connection_groups(id, name), host:profiles!created_by(id, name, profile_picture, career)')
        .eq('id', meetupId)
        .single();

      // If not found in meetups, try coffee_chats (fallback for missing category param)
      if (meetupError && meetupError.code === 'PGRST116') {
        const { data: fallbackChat } = await sb
          .from('coffee_chats')
          .select('id')
          .eq('id', meetupId)
          .maybeSingle();
        if (fallbackChat) {
          return loadEventDetails('coffee');
        }
      }

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

      // Load discussion topics — tries cache first, generates on demand if needed
      loadSuggestedTopics(meetupData, attendeesData);

      // Load recap if available (for any event that has had a call)
      const { data: recapData, error: recapError } = await sb
        .from('call_recaps')
        .select('id, channel_name, call_type, provider, started_at, ended_at, duration_seconds, participant_count, participant_ids, transcript_path, metrics, created_by, created_at, updated_at')
        .ilike('channel_name', `%${meetupId}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recapData && recapData.length > 0) {
        const recapRecord = recapData[0];
        // Load transcript + AI summary from storage
        const { transcript: storedTranscript, aiSummary: storedAiSummary } =
          await getRecapTranscriptFromStorage(recapRecord.transcript_path);
        recapRecord.transcript = storedTranscript;
        recapRecord.ai_summary = storedAiSummary;
        setRecap(recapRecord);
        setParsed(parseAISummary(recapRecord.ai_summary));

        // Load actual participant profiles from recap
        const participantIds = recapRecord.participant_ids || [];
        let participantNames = [];
        if (participantIds.length > 0) {
          const { data: participantProfiles } = await sb
            .from('profiles')
            .select('id, name, profile_picture, career')
            .in('id', participantIds);
          setActualParticipants(participantProfiles || []);
          participantNames = (participantProfiles || []).map(p => p.name).filter(Boolean);
        }

        // Load completed actions from localStorage
        const savedActions = localStorage.getItem('completed_recap_actions');
        if (savedActions) {
          setCompletedActions(new Set(JSON.parse(savedActions)));
        }

        // Lazy AI generation: if recap has transcript but no AI summary, generate now
        if (!recapRecord.ai_summary && recapRecord.transcript?.length > 0) {
          console.log('[EventDetail] No AI summary found, generating lazily...');
          try {
            const response = await apiFetch('/api/generate-recap-summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transcript: recapRecord.transcript,
                messages: [],
                participants: participantNames.length > 0 ? participantNames : ['Participant'],
                duration: recapRecord.duration_seconds || 0,
                meetingTitle: meetup?.topic || 'Coffee Chat',
                meetingType: meetup?.circle_id ? 'circle meetup' : 'community event'
              })
            });
            if (response.ok) {
              const summaryData = await response.json();
              const aiSummaryJson = JSON.stringify(summaryData);
              await apiFetch('/api/save-recap-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recapId: recapRecord.id, aiSummary: aiSummaryJson })
              });
              setParsed(parseAISummary(aiSummaryJson));
              setRecap(prev => ({ ...prev, ai_summary: aiSummaryJson }));
              console.log('[EventDetail] AI summary generated and saved');
            }
          } catch (genErr) {
            console.error('[EventDetail] Lazy generation failed:', genErr);
          }
        }
      }
    } catch (error) {
      console.error('Error loading event details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSuggestedTopics(meetupData, attendeesData) {
    if (!meetupData) return;
    try {
      // Try cached topics first (pre-generated by daily cron)
      const cacheRes = await apiFetch(`/api/agent/discussion-topics?meetupId=${meetupData.id}`);
      if (cacheRes.ok) {
        const cacheData = await cacheRes.json();
        if (cacheData.found && cacheData.topics) {
          setSuggestedTopics(cacheData.topics);
          return;
        }
      }

      // No cache — generate on demand and cache for next time
      if (attendeesData && attendeesData.length >= 1) {
        const res = await apiFetch('/api/agent/discussion-topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetupId: meetupData.id,
            title: meetupData.topic || meetupData.title,
            description: meetupData.description,
            attendees: attendeesData.map(a => ({
              name: a.profiles?.name,
              career: a.profiles?.career,
              interests: a.profiles?.interests || [],
            })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestedTopics(data.topics);
        }
      }
    } catch (err) {
      console.error('Error loading discussion topics:', err);
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
          toast?.info('You have already signed up for this event!');
        } else {
          toast?.error('Error signing up: ' + error.message);
        }
      } else {
        setIsSignedUp(true);
        setUserSignupType(type);
        await reloadAttendees();
      }
    } catch (err) {
      toast?.error('Error: ' + err.message);
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

  function handleCancelRsvp() {
    setConfirmAction({
      type: 'cancelRsvp',
      title: 'Cancel RSVP',
      message: 'Are you sure you want to cancel your RSVP?',
    });
  }

  function handleCancelEvent() {
    setConfirmAction({
      type: 'cancelEvent',
      title: meetup?._isCoffeeChat ? 'Cancel Coffee Chat' : 'Cancel Event',
      message: meetup?._isCoffeeChat
        ? 'Are you sure you want to cancel this coffee chat?'
        : 'Are you sure you want to cancel this event? This will remove it for all attendees.',
    });
  }

  async function executeConfirmAction() {
    const action = confirmAction;
    setConfirmAction(null);

    if (action.type === 'cancelRsvp') {
      try {
        setActionLoading(true);
        const { error } = await sb
          .from('meetup_signups')
          .delete()
          .eq('meetup_id', meetupId)
          .eq('user_id', currentUser.id);

        if (error) {
          toast?.error('Error canceling: ' + error.message);
        } else {
          setIsSignedUp(false);
          invalidateQuery(`meetups-group-${currentUser.id}`);
          invalidateQuery(`home-primary-${currentUser.id}`);
          await reloadAttendees();
        }
      } catch (err) {
        toast?.error('Error: ' + err.message);
      } finally {
        setActionLoading(false);
      }
    } else if (action.type === 'cancelEvent') {
      try {
        setActionLoading(true);
        const table = meetup?._isCoffeeChat ? 'coffee_chats' : 'meetups';
        const { error } = await sb.from(table)
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', meetupId);
        if (error) {
          toast?.error('Error canceling: ' + error.message);
        } else {
          await onMeetupChanged?.();
          invalidateQuery(`meetups-coffee-${currentUser.id}`);
          invalidateQuery(`meetups-past-${currentUser.id}`);
          onNavigate?.(previousView || 'meetups');
        }
      } catch (err) {
        toast?.error('Error: ' + err.message);
      } finally {
        setActionLoading(false);
      }
    }
  }

  function startEdit(field) {
    setEditing(field);
    if (field === 'time') {
      setEditValues({ date: meetup.date, time: meetup.time || '', duration: parseInt(meetup.duration || '60') });
    } else if (field === 'location') {
      setEditValues({ location: meetup.location || '' });
    } else if (field === 'description') {
      setEditValues({ description: meetup.description || '' });
    }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const isCoffee = meetup?._isCoffeeChat;
      const updates = { updated_at: new Date().toISOString() };
      if (editing === 'time') {
        if (isCoffee) {
          updates.scheduled_time = new Date(`${editValues.date}T${editValues.time}`).toISOString();
        } else {
          updates.date = editValues.date;
          updates.time = editValues.time;
        }
        if (editValues.duration) {
          updates.duration = editValues.duration;
        }
      } else if (editing === 'location') {
        updates.location = editValues.location;
      } else if (editing === 'description') {
        if (isCoffee) {
          updates.notes = editValues.description;
        } else {
          updates.description = editValues.description;
        }
      }
      const table = isCoffee ? 'coffee_chats' : 'meetups';
      const { error } = await sb.from(table).update(updates).eq('id', meetupId);
      if (error) {
        toast?.error('Error saving: ' + error.message);
      } else {
        const localUpdates = { ...updates };
        // For coffee chats, also update the normalized date/time fields
        if (isCoffee && updates.scheduled_time) {
          const dt = new Date(updates.scheduled_time);
          localUpdates.date = dt.toISOString().split('T')[0];
          localUpdates.time = dt.toTimeString().slice(0, 5);
        }
        setMeetup(prev => ({ ...prev, ...localUpdates }));
        setEditing(null);
        onMeetupChanged?.();
      }
    } catch (err) {
      toast?.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleFormatChange(newFormat) {
    setSaving(true);
    try {
      const updates = { meeting_format: newFormat, updated_at: new Date().toISOString() };
      if (newFormat === 'virtual') updates.location = 'Virtual';
      const { error } = await sb.from('meetups').update(updates).eq('id', meetupId);
      if (error) {
        toast?.error('Error saving: ' + error.message);
      } else {
        setMeetup(prev => ({ ...prev, ...updates }));
        onMeetupChanged?.();
      }
    } catch (err) {
      toast?.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleJoinCall() {
    if (!meetup) return;
    if (meetup._isCoffeeChat) {
      // 1:1 coffee chat — WebRTC peer-to-peer
      // Strip "coffee-" prefix if present (some pages prefix IDs to avoid collisions)
      const chatId = meetup._coffeeChatId || (typeof (meetup.id || meetupId) === 'string' && (meetup.id || meetupId).startsWith('coffee-') ? (meetup.id || meetupId).replace('coffee-', '') : (meetup.id || meetupId));
      window.location.href = `/call/coffee/${chatId}`;
    } else if (meetup.circle_id) {
      // Use meetup ID for session-isolated channel names
      const channelName = `connection-group-${meetup.id || meetupId}`;
      window.location.href = `/call/circle/${channelName}`;
    } else {
      // Regular meetup - use LiveKit via /call/meetup/
      const channelName = `meetup-${meetup.id || meetupId}`;
      window.location.href = `/call/meetup/${channelName}`;
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

  // Check event status using timezone-aware comparison
  const eventDuration = parseInt(meetup.duration || '60');
  const isPast = isEventPast(meetup.date, meetup.time, meetup.timezone, eventDuration);
  const isLive = isEventLive(meetup.date, meetup.time, meetup.timezone, eventDuration);
  // Compute viewer-local date for the calendar badge (handles cross-timezone date shifts)
  const eventDate = (() => {
    if (meetup.timezone && meetup.time) {
      try {
        const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const utc = eventDateTimeToUTC(meetup.date, meetup.time, meetup.timezone)
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: viewerTz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(utc)
        const y = parseInt(parts.find(p => p.type === 'year').value)
        const m = parseInt(parts.find(p => p.type === 'month').value)
        const d = parseInt(parts.find(p => p.type === 'day').value)
        return new Date(y, m - 1, d)
      } catch { /* fall through */ }
    }
    return parseLocalDate(meetup.date)
  })();

  const dateDisplay = formatEventDate(meetup.date, meetup.time, meetup.timezone, isMobile
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  );

  const hasRecap = !!(recap && parsed);
  // Determine if we should show recap view:
  // - Recap with AI summary exists (meeting truly ended), OR
  // - Grace period expired (meeting is definitely over, show what we have)
  const hasAiSummary = !!(recap?.ai_summary);
  const showRecapView = hasAiSummary || (isPast && hasRecap);

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
        }}>{showRecapView ? 'Coffee Chat Recap' : 'Coffee Chat Detail'}</h2>
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
            {isHost && !isPast ? (
              <div style={{ display: 'flex', gap: '4px' }}>
                {['virtual', 'in_person', 'hybrid'].map(fmt => {
                  const active = (meetup.meeting_format || 'virtual') === fmt;
                  const label = fmt === 'virtual' ? 'Virtual' : fmt === 'in_person' ? 'In-Person' : 'Hybrid';
                  return (
                    <button key={fmt} onClick={() => !active && handleFormatChange(fmt)} disabled={saving}
                      style={{
                        fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                        letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '100px',
                        border: active ? 'none' : `1px solid ${colors.border}`,
                        background: active
                          ? (fmt === 'hybrid' ? '#E8EDF0' : fmt === 'in_person' ? '#E8F0E4' : '#F0E8D8')
                          : 'transparent',
                        color: active
                          ? (fmt === 'hybrid' ? '#4A6572' : fmt === 'in_person' ? '#4E6B46' : '#6B5832')
                          : colors.textMuted,
                        cursor: active ? 'default' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                        fontFamily: fonts.sans,
                      }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : meetup.meeting_format && meetup.meeting_format !== 'virtual' ? (
              <span style={{
                fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '100px',
                background: meetup.meeting_format === 'hybrid' ? '#E8EDF0' : '#E8F0E4',
                color: meetup.meeting_format === 'hybrid' ? '#4A6572' : '#4E6B46',
              }}>
                {meetup.meeting_format === 'hybrid' ? 'Hybrid' : 'In-Person'}
              </span>
            ) : null}
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
          {editing === 'time' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <input type="date" value={editValues.date || ''} onChange={e => setEditValues(v => ({ ...v, date: e.target.value }))}
                  style={{ padding: '4px 8px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: metaFontSize, fontFamily: fonts.sans, color: colors.text }} />
                <input type="time" value={editValues.time || ''} onChange={e => setEditValues(v => ({ ...v, time: e.target.value }))}
                  style={{ padding: '4px 8px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: metaFontSize, fontFamily: fonts.sans, color: colors.text }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {[30, 45, 60, 90, 120].map((min) => (
                  <button key={min} onClick={() => setEditValues(v => ({ ...v, duration: min }))}
                    style={{
                      padding: '3px 10px', borderRadius: '8px', fontSize: metaFontSize, fontWeight: 600, cursor: 'pointer', fontFamily: fonts.sans,
                      border: `1.5px solid ${editValues.duration === min ? colors.primary : colors.border}`,
                      background: editValues.duration === min ? colors.primary : 'transparent',
                      color: editValues.duration === min ? '#FFF' : colors.text,
                    }}>
                    {min < 60 ? `${min}m` : `${min / 60}h`}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={saveEdit} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#5C7A4E' }}><Check size={16} /></button>
                <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.textMuted }}><X size={16} /></button>
              </div>
            </div>
          ) : (
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
                  <Clock size={isMobile ? 12 : 14} /> {formatEventTime(meetup.date, meetup.time, meetup.timezone, { showTimezone: false })}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: metaFontSize, color: colors.textMuted }}>
                <Clock size={isMobile ? 12 : 14} /> {hasRecap && recap.duration_seconds
                  ? (recap.duration_seconds >= 3600
                    ? `${Math.floor(recap.duration_seconds / 3600)}h ${Math.floor((recap.duration_seconds % 3600) / 60)}m`
                    : `${Math.floor(recap.duration_seconds / 60)}m`)
                  : `${eventDuration}m`}
              </span>
              {isHost && !isPast && (
                <button onClick={() => startEdit('time')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: colors.textMuted }}>
                  <Pencil size={12} />
                </button>
              )}
            </div>
          )}
          {editing === 'location' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input type="text" value={editValues.location || ''} onChange={e => setEditValues(v => ({ ...v, location: e.target.value }))}
                placeholder="Enter location"
                style={{ padding: '4px 8px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: metaFontSize, fontFamily: fonts.sans, color: colors.text, flex: 1, minWidth: '120px' }} />
              <button onClick={saveEdit} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#5C7A4E' }}><Check size={16} /></button>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.textMuted }}><X size={16} /></button>
            </div>
          ) : (
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
              {isHost && !isPast && meetup.meeting_format !== 'virtual' && (
                <button onClick={() => startEdit('location')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: colors.textMuted }}>
                  <Pencil size={12} />
                </button>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: metaFontSize, color: colors.textMuted }}>
                <Users size={isMobile ? 12 : 14} /> {
                  showRecapView
                    ? `${actualParticipants.length || recap?.participant_count || 0} attended`
                    : meetup._isCoffeeChat
                      ? (meetup.status === 'accepted' ? 'Accepted' : meetup.status === 'pending' ? 'Pending' : meetup.status)
                      : meetup.meeting_format === 'hybrid'
                        ? `${attendeeCounts.in_person} in-person, ${attendeeCounts.video} virtual`
                        : `${attendees.length} signed up`
                }
              </span>
            </div>
          )}
        </div>

        {/* QR Code — right side, community events and circle meetups only */}
        {!meetup._isCoffeeChat && !isMobile && (
          <div style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
          }}>
            <div style={{
              width: '90px', height: '90px', borderRadius: '10px', overflow: 'hidden',
              border: `1px solid ${colors.border}`, background: '#fff', padding: '5px',
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/?event=${meetupId}` : '')}&color=5C4033&bgcolor=FFFFFF`}
                alt="QR Code"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <span style={{ fontSize: '10px', color: colors.textMuted, textAlign: 'center' }}>Scan to join</span>
          </div>
        )}
      </div>

      {/* QR Code — mobile, below header */}
      {!meetup._isCoffeeChat && isMobile && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px', marginBottom: '8px',
          borderRadius: '12px', border: `1px solid ${colors.border}`,
          background: 'rgba(139,111,92,0.03)',
        }}>
          <div style={{
            width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden',
            border: `1px solid ${colors.border}`, background: '#fff', padding: '4px', flexShrink: 0,
          }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/?event=${meetupId}` : '')}&color=5C4033&bgcolor=FFFFFF`}
              alt="QR Code"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <div>
            <p style={{ fontFamily: fonts.sans, fontSize: '13px', color: colors.text, margin: '0 0 2px', fontWeight: '500' }}>
              Scan to join
            </p>
            <p style={{ fontFamily: fonts.sans, fontSize: '11px', color: colors.textMuted, margin: 0 }}>
              Share so others can RSVP
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '12px' : '16px',
      }}>
        {/* Event details - always shown */}
        <>
            {/* Action buttons */}
            {showRecapView ? (
              /* Recap view: Share Recap only */
              <button
                onClick={async () => {
                  const title = meetup.topic || 'Coffee Chat Recap';
                  const topics = (parsed?.topicsDiscussed || []).map(t => typeof t === 'string' ? t : t.topic).filter(Boolean);
                  const takeaways = (parsed?.keyTakeaways || []).map(t => typeof t === 'string' ? t : t.text || '').filter(Boolean).slice(0, 3);
                  const durationMin = recap?.duration_seconds ? Math.floor(recap.duration_seconds / 60) : 0;
                  const participantCount = actualParticipants.length || recap?.participant_count || 0;
                  const url = `${window.location.origin}/recaps/${recap?.id}`;

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
                    toast?.success('Recap copied to clipboard!');
                  }
                }}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px 16px', borderRadius: '12px',
                  backgroundColor: 'transparent', color: colors.textLight,
                  border: `1px solid ${colors.border}`, fontSize: '13px', fontWeight: '500',
                  cursor: 'pointer', fontFamily: fonts.sans,
                }}
              >
                <Share2 size={15} /> Share Recap
              </button>
            ) : (
              /* Detail view: Join Call + Share Event + Cancel/RSVP */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <>
                {(isSignedUp || isHost) ? (
                  <>
                    {meetup._isCoffeeChat && meetup.status === 'pending' ? (
                      <span style={{
                        flex: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '12px 20px', borderRadius: '14px',
                        backgroundColor: 'rgba(196, 149, 106, 0.15)', color: '#8B6F5C',
                        border: 'none', fontSize: '15px', fontWeight: '600',
                        fontFamily: fonts.sans,
                      }}>
                        <Clock size={18} /> Awaiting response
                      </span>
                    ) : meetup.meeting_format !== 'in_person' && (
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
                    {!isPast && (isHost ? (
                      <button
                        onClick={handleCancelEvent}
                        disabled={actionLoading}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          padding: '12px 16px', borderRadius: '14px',
                          backgroundColor: 'transparent', color: '#D45B3E',
                          border: '1px solid rgba(212, 91, 62, 0.3)', fontSize: '14px', fontWeight: '500',
                          cursor: actionLoading ? 'not-allowed' : 'pointer', fontFamily: fonts.sans,
                          opacity: actionLoading ? 0.6 : 1,
                          flex: meetup.meeting_format === 'in_person' ? 1 : undefined,
                        }}
                      >
                        <XCircle size={16} /> {meetup._isCoffeeChat ? 'Cancel Chat' : 'Cancel Event'}
                      </button>
                    ) : (
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
                    ))}
                  </>
                ) : !isPast ? (
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
                ) : null}
                  <button
                    onClick={async () => {
                      const url = `${window.location.origin}/?event=${meetupId}`;
                      const title = meetup.topic || 'Event';
                      const dateStr = meetup.date ? formatEventDate(meetup.date, meetup.time, meetup.timezone, { weekday: 'long', month: 'long', day: 'numeric' }) : '';
                      const timeStr = meetup.time ? formatEventTime(meetup.date, meetup.time, meetup.timezone, { showTimezone: false }) : '';
                      const locationStr = meetup.meeting_format === 'in_person' ? (meetup.location || '') : meetup.meeting_format === 'hybrid' ? `${meetup.location} + Virtual` : 'Virtual';

                      // Generate share card image with QR code
                      if (!meetup._isCoffeeChat) {
                        try {
                          // Load QR code image first
                          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&color=5C4033&bgcolor=FFFFFF`;
                          const qrImg = new Image();
                          qrImg.crossOrigin = 'anonymous';
                          await new Promise((resolve, reject) => {
                            qrImg.onload = resolve;
                            qrImg.onerror = reject;
                            qrImg.src = qrUrl;
                          });

                          // Create canvas
                          const w = 600, h = 800;
                          const canvas = document.createElement('canvas');
                          canvas.width = w;
                          canvas.height = h;
                          const ctx = canvas.getContext('2d');

                          // Background gradient (warm mocha)
                          const grad = ctx.createLinearGradient(0, 0, w, h);
                          grad.addColorStop(0, '#F5EBE0');
                          grad.addColorStop(0.5, '#E8D5C4');
                          grad.addColorStop(1, '#D4B896');
                          ctx.fillStyle = grad;
                          ctx.fillRect(0, 0, w, h);

                          // Decorative circle top-right
                          ctx.beginPath();
                          ctx.arc(w + 30, -30, 180, 0, Math.PI * 2);
                          ctx.fillStyle = 'rgba(92,64,51,0.06)';
                          ctx.fill();

                          // Decorative circle bottom-left
                          ctx.beginPath();
                          ctx.arc(-40, h + 20, 150, 0, Math.PI * 2);
                          ctx.fillStyle = 'rgba(92,64,51,0.05)';
                          ctx.fill();

                          // CircleW logo text
                          ctx.fillStyle = '#5C4033';
                          ctx.font = '600 20px "DM Sans", sans-serif';
                          ctx.textAlign = 'center';
                          ctx.fillText('CircleW', w / 2, 50);

                          // Event title
                          ctx.fillStyle = '#3D2B1F';
                          ctx.font = '700 28px "Lora", Georgia, serif';
                          ctx.textAlign = 'center';
                          // Word wrap title
                          const maxWidth = w - 80;
                          const titleWords = title.split(' ');
                          let titleLines = [];
                          let currentLine = '';
                          titleWords.forEach(word => {
                            const testLine = currentLine ? currentLine + ' ' + word : word;
                            if (ctx.measureText(testLine).width > maxWidth) {
                              titleLines.push(currentLine);
                              currentLine = word;
                            } else {
                              currentLine = testLine;
                            }
                          });
                          if (currentLine) titleLines.push(currentLine);
                          let titleY = 95;
                          titleLines.forEach(line => {
                            ctx.fillText(line, w / 2, titleY);
                            titleY += 36;
                          });

                          // Date + time
                          ctx.fillStyle = '#6B5344';
                          ctx.font = '500 18px "DM Sans", sans-serif';
                          const dateTimeStr = dateStr && timeStr ? `${dateStr} · ${timeStr}` : dateStr || timeStr;
                          ctx.fillText(dateTimeStr, w / 2, titleY + 15);

                          // Location
                          if (locationStr) {
                            ctx.fillStyle = '#8B7355';
                            ctx.font = '500 16px "DM Sans", sans-serif';
                            ctx.fillText(locationStr, w / 2, titleY + 42);
                          }

                          // QR code (centered, white rounded rect background)
                          const qrSize = 280;
                          const qrX = (w - qrSize - 40) / 2;
                          const qrY = titleY + 70;
                          const qrPad = 20;

                          // White rounded rect behind QR
                          const rx = qrX, ry = qrY, rw = qrSize + qrPad * 2, rh = qrSize + qrPad * 2, radius = 20;
                          ctx.fillStyle = '#FFFFFF';
                          ctx.beginPath();
                          ctx.moveTo(rx + radius, ry);
                          ctx.lineTo(rx + rw - radius, ry);
                          ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
                          ctx.lineTo(rx + rw, ry + rh - radius);
                          ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
                          ctx.lineTo(rx + radius, ry + rh);
                          ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
                          ctx.lineTo(rx, ry + radius);
                          ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
                          ctx.closePath();
                          ctx.fill();

                          // Shadow for QR container
                          ctx.shadowColor = 'rgba(61,46,34,0.12)';
                          ctx.shadowBlur = 20;
                          ctx.shadowOffsetY = 4;
                          ctx.fill();
                          ctx.shadowColor = 'transparent';
                          ctx.shadowBlur = 0;
                          ctx.shadowOffsetY = 0;

                          // Draw QR code
                          ctx.drawImage(qrImg, qrX + qrPad, qrY + qrPad, qrSize, qrSize);

                          // "Scan to RSVP" text
                          ctx.fillStyle = '#5C4033';
                          ctx.font = '600 18px "DM Sans", sans-serif';
                          ctx.fillText('Scan to RSVP', w / 2, qrY + rh + 35);

                          // Footer tagline
                          ctx.fillStyle = '#8B7355';
                          ctx.font = '500 14px "DM Sans", sans-serif';
                          ctx.fillText('Join a community of women building', w / 2, h - 48);
                          ctx.fillText('meaningful connections', w / 2, h - 28);

                          // Convert to blob and share
                          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                          const file = new File([blob], `${title.replace(/[^a-zA-Z0-9]/g, '-')}-invite.png`, { type: 'image/png' });

                          if (navigator.share && navigator.canShare?.({ files: [file] })) {
                            await navigator.share({ title: `Join: ${title}`, files: [file] });
                          } else {
                            // Fallback: download the image
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = file.name;
                            a.click();
                            URL.revokeObjectURL(a.href);
                          }
                          return;
                        } catch (e) {
                          console.error('[Share] Card generation failed:', e);
                        }
                      }

                      // Fallback: text-only share
                      const lines = [
                        `☕ ${title}`,
                        '',
                        `📅 ${dateStr && timeStr ? `${dateStr} at ${timeStr}` : dateStr || timeStr}`,
                        locationStr ? `📍 ${locationStr}` : '',
                        '',
                        `RSVP here: ${url}`,
                      ].filter(Boolean).join('\n');

                      if (navigator.share) {
                        try { await navigator.share({ title, text: lines, url }); } catch (e) { /* cancelled */ }
                      } else {
                        await navigator.clipboard.writeText(lines);
                        toast?.success('Event details copied to clipboard!');
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '12px 16px', borderRadius: '14px',
                      backgroundColor: 'transparent', color: colors.textLight,
                      border: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '500',
                      cursor: 'pointer', fontFamily: fonts.sans,
                    }}
                  >
                    <Share2 size={16} /> Share Event
                  </button>
                  </>
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
            {(meetup.description || (isHost && !isPast)) && (
              <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
                <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize, justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={isMobile ? 14 : 16} style={{ color: colors.primary }} />
                    About This Event
                  </span>
                  {isHost && !isPast && editing !== 'description' && (
                    <button onClick={() => startEdit('description')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: colors.textMuted }}>
                      <Pencil size={13} />
                    </button>
                  )}
                </h3>
                {editing === 'description' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      value={editValues.description || ''}
                      onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                      placeholder="Describe your event..."
                      rows={4}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                        border: `1px solid ${colors.border}`, fontSize: bodyFontSize,
                        fontFamily: fonts.sans, color: colors.text, lineHeight: '1.6',
                        resize: 'vertical', boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditing(null)} style={{
                        padding: '6px 14px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                        background: 'white', fontSize: '13px', fontWeight: '500', cursor: 'pointer', color: colors.textMuted, fontFamily: fonts.sans,
                      }}>Cancel</button>
                      <button onClick={saveEdit} disabled={saving} style={{
                        padding: '6px 14px', borderRadius: '8px', border: 'none',
                        background: colors.primary, color: 'white', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: fonts.sans,
                        opacity: saving ? 0.6 : 1,
                      }}>{saving ? 'Saving...' : 'Save'}</button>
                    </div>
                  </div>
                ) : (
                  <p style={{
                    fontSize: bodyFontSize,
                    color: colors.textLight,
                    lineHeight: '1.6',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {meetup.description || (isHost ? 'Tap the pencil to add a description.' : '')}
                  </p>
                )}
              </div>
            )}

            {/* Suggested Topics to Discuss — pre-generated by cron 24h before event */}
            {!isPast && suggestedTopics && (
              <div style={{ ...styles.card, padding: cardPadding, borderRadius: cardRadius }}>
                <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
                  <Sparkles size={isMobile ? 14 : 16} style={{ color: colors.primary }} />
                  Suggested Topics to Discuss
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {suggestedTopics.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: '12px', alignItems: 'flex-start',
                      padding: isMobile ? '10px 12px' : '12px 14px',
                      backgroundColor: 'rgba(250, 245, 239, 0.7)',
                      borderRadius: '12px',
                    }}>
                      <span style={{ fontSize: isMobile ? '18px' : '20px', flexShrink: 0 }}>
                        {item.emoji || '💡'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: bodyFontSize, fontWeight: '600',
                          color: colors.text, margin: 0,
                        }}>
                          {item.topic}
                        </p>
                        {item.reason && (
                          <p style={{
                            fontSize: isMobile ? '12px' : '13px',
                            color: colors.textMuted, margin: '3px 0 0',
                          }}>
                            {item.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
                    <img loading="lazy" src={host.profile_picture} alt={host.name} style={{
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
              {hasRecap && actualParticipants.length > 0 ? (() => {
                const actualIds = new Set(actualParticipants.map(p => p.id));
                const noShows = attendees.filter(s => !actualIds.has(s.user_id));
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '8px' : '12px' }}>
                      <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize, margin: 0 }}>
                        <Users size={isMobile ? 14 : 16} style={{ color: colors.primary }} />
                        Attended ({actualParticipants.length})
                      </h3>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '6px' : '10px' }}>
                      {actualParticipants.map(profile => (
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
                            <img loading="lazy" src={profile.profile_picture} alt={profile.name} style={{
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
                    {noShows.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <h4 style={{ fontSize: isMobile ? '11px' : '12px', color: colors.textSoft, fontWeight: '600', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Signed up but didn't attend ({noShows.length})
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '4px' : '6px' }}>
                          {noShows.map(signup => {
                            const profile = signup.profiles;
                            return (
                              <div
                                key={signup.user_id}
                                style={{
                                  display: 'flex', alignItems: 'center',
                                  gap: '5px', padding: isMobile ? '4px 8px' : '5px 10px',
                                  backgroundColor: 'rgba(250, 245, 239, 0.4)',
                                  borderRadius: '16px',
                                  fontSize: isMobile ? '11px' : '12px',
                                  color: colors.textSoft, cursor: 'pointer', opacity: 0.6,
                                }}
                                onClick={() => onNavigate?.('userProfile', { userId: signup.user_id })}
                              >
                                {profile?.profile_picture ? (
                                  <img loading="lazy" src={profile.profile_picture} alt={profile?.name} style={{
                                    width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover',
                                  }} />
                                ) : (
                                  <div style={{
                                    width: '18px', height: '18px', borderRadius: '50%',
                                    backgroundColor: colors.textSoft, color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '9px', fontWeight: '600',
                                  }}>
                                    {(profile?.name || 'U')[0].toUpperCase()}
                                  </div>
                                )}
                                <span>{profile?.name || 'Unknown'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })() : (
                <>
                  <h3 style={{ ...styles.sectionTitle, fontSize: sectionTitleSize }}>
                    <Users size={isMobile ? 14 : 16} style={{ color: colors.primary }} />
                    {meetup._isCoffeeChat ? 'Participants' : 'Attendees'} ({attendees.length})
                  </h3>
                  {attendees.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '6px' : '10px' }}>
                      {attendees.map(signup => {
                        const profile = signup.profiles;
                        return (
                          <div
                            key={signup.user_id}
                            style={{
                              display: 'flex', alignItems: 'center',
                              gap: isMobile ? '6px' : '8px',
                              padding: isMobile ? '6px 10px' : '8px 12px',
                              backgroundColor: 'rgba(250, 245, 239, 0.7)',
                              borderRadius: '20px',
                              fontSize: isMobile ? '12px' : '13px',
                              color: colors.textLight, cursor: 'pointer',
                            }}
                            onClick={() => onNavigate?.('userProfile', { userId: signup.user_id })}
                          >
                            {profile?.profile_picture ? (
                              <img loading="lazy" src={profile.profile_picture} alt={profile.name} style={{
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
                </>
              )}
            </div>
        </>

        {/* AI Recap - shown below details when available */}
        {hasRecap && (
          <>
            {/* Recap section header */}
            <div style={{
              borderTop: `1px solid rgba(139, 111, 92, 0.15)`,
              paddingTop: '16px',
              marginTop: '4px',
            }}>
              <h2 style={{
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '700',
                color: colors.text,
                margin: '0 0 12px',
                fontFamily: fonts.sans,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                AI Meeting Recap
              </h2>
            </div>
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

      {/* Confirmation Modal */}
      {confirmAction && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '20px',
            padding: '28px 24px', maxWidth: '340px', width: '100%',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            textAlign: 'center',
          }}>
            <h3 style={{
              fontFamily: fonts.serif, fontSize: '18px', fontWeight: '600',
              color: '#3D2B1F', margin: '0 0 8px',
            }}>
              {confirmAction.title}
            </h3>
            <p style={{
              fontSize: '14px', color: '#6B5344',
              margin: '0 0 24px', lineHeight: '1.5',
            }}>
              {confirmAction.message}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{
                  flex: 1, padding: '12px',
                  backgroundColor: 'rgba(139, 111, 92, 0.08)',
                  color: '#5C4033', border: 'none', borderRadius: '12px',
                  fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  fontFamily: fonts.sans,
                }}
              >
                Go Back
              </button>
              <button
                onClick={executeConfirmAction}
                style={{
                  flex: 1, padding: '12px',
                  backgroundColor: '#D32F2F', color: 'white',
                  border: 'none', borderRadius: '12px',
                  fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  fontFamily: fonts.sans,
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

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

import { useState } from 'react'
import { createAgoraRoom, hasAgoraRoom } from '@/lib/agoraHelpers'
import { supabase } from '@/lib/supabase'

// Helper function to format date from ISO to friendly display
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    let date
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateStr.split('-').map(Number)
      date = new Date(year, month - 1, day)
    } else {
      const cleanDateStr = dateStr
        .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '')
        .trim()
      date = new Date(`${cleanDateStr} ${new Date().getFullYear()}`)
    }
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

/**
 * useMeetups — meetup CRUD, signups, RSVP, video call join
 * Does NOT own meetups/userSignups/signups state — calls refresh callbacks from useHomeData
 */
export default function useMeetups(currentUser, { refreshMeetups, refreshUserSignups, refreshSignups, meetups, userSignups, toast } = {}) {
  // Modal state
  const [newMeetup, setNewMeetup] = useState({ date: '', time: '', location: '', topic: '', duration: '60', participantLimit: '100', description: '' })
  const [selectedDate, setSelectedDate] = useState(null)
  const [editingMeetup, setEditingMeetup] = useState(null)
  const [showCreateMeetup, setShowCreateMeetup] = useState(false)
  const [showEditMeetup, setShowEditMeetup] = useState(false)
  const [nextStepPrompt, setNextStepPrompt] = useState(null)

  const handleSignUp = async (meetupId) => {
    try {
      const { error } = await supabase
        .from('meetup_signups')
        .insert([
          {
            meetup_id: meetupId,
            user_id: currentUser.id
          }
        ])

      if (error) {
        if (error.code === '23505') {
          toast?.info('You have already signed up for this meetup')
        } else {
          toast?.error('Error signing up: ' + error.message)
        }
      } else {
        await refreshUserSignups?.()
        await refreshMeetups?.()

        // Find the meetup to get its date
        const meetup = meetups?.find(m => m.id === meetupId)
        const isFirstMeetup = !userSignups || userSignups.length === 0

        // Show appropriate next step prompt
        setNextStepPrompt({
          type: isFirstMeetup ? 'first_meetup' : 'meetup_signup',
          data: {
            meetupDate: meetup ? formatDate(meetup.date) : null
          }
        })
      }
    } catch (err) {
      toast?.error('Error: ' + err.message)
    }
  }

  const handleCancelSignup = async (meetupId) => {
    if (!confirm('Are you sure you want to cancel your signup?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('meetup_signups')
        .delete()
        .eq('meetup_id', meetupId)
        .eq('user_id', currentUser.id)

      if (error) {
        toast?.error('Error canceling signup: ' + error.message)
      } else {
        await refreshUserSignups?.()
        await refreshMeetups?.()
        toast?.success('Signup canceled')
      }
    } catch (err) {
      toast?.error('Error: ' + err.message)
    }
  }

  const handleCreateMeetup = async () => {
    if (!newMeetup.date || !newMeetup.time || !newMeetup.topic) {
      toast?.error('Please fill in topic, date and time')
      return
    }

    try {
      const { data, error } = await supabase
        .from('meetups')
        .insert([
          {
            date: newMeetup.date,
            time: newMeetup.time,
            topic: newMeetup.topic.trim(),
            duration: parseInt(newMeetup.duration) || 60,
            participant_limit: parseInt(newMeetup.participantLimit) || 100,
            description: newMeetup.description?.trim() || null,
            location: newMeetup.location || null,
            created_by: currentUser.id
          }
        ])
        .select()

      if (error) {
        toast?.error('Error creating meetup: ' + error.message)
      } else {
        // Auto-RSVP the creator
        if (data && data[0]?.id) {
          await supabase
            .from('meetup_signups')
            .insert({ meetup_id: data[0].id, user_id: currentUser.id })
        }
        // Reload meetups from database to ensure consistency
        await refreshMeetups?.()
        await refreshUserSignups?.()
        setNewMeetup({ date: '', time: '', location: '', topic: '', duration: '60', participantLimit: '100', description: '' })
        setSelectedDate(null)
        setShowCreateMeetup(false)
        toast?.success('Meetup created!')
      }
    } catch (err) {
      toast?.error('Error: ' + err.message)
    }
  }

  const handleEditMeetup = (meetup) => {
    setEditingMeetup({ ...meetup })
    setShowEditMeetup(true)
  }

  const handleUpdateMeetup = async () => {
    if (!editingMeetup.date || !editingMeetup.time) {
      toast?.error('Please fill in date and time')
      return
    }

    try {
      const updateData = {
        date: editingMeetup.date,
        time: editingMeetup.time,
        location: editingMeetup.location || null,
        updated_at: new Date().toISOString()
      };
      // If rescheduling a completed meetup, reset status to scheduled
      if (editingMeetup.status === 'completed') {
        updateData.status = 'scheduled';
      }
      const { error } = await supabase
        .from('meetups')
        .update(updateData)
        .eq('id', editingMeetup.id)

      if (error) {
        toast?.error('Error updating meetup: ' + error.message)
      } else {
        await refreshMeetups?.()
        setShowEditMeetup(false)
        setEditingMeetup(null)
        toast?.success('Meetup updated!')
      }
    } catch (err) {
      toast?.error('Error: ' + err.message)
    }
  }

  const handleDeleteMeetup = async (meetupId) => {
    if (!confirm('Are you sure you want to cancel this meetup?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('meetups')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', meetupId)

      if (error) {
        toast?.error('Error cancelling meetup: ' + error.message)
      } else {
        await refreshMeetups?.()
        toast?.success('Meetup cancelled')
      }
    } catch (err) {
      toast?.error('Error: ' + err.message)
    }
  }

  const handleSetLocation = async (meetupId, location) => {
    if (!location.trim()) {
      toast?.error('Please enter a location')
      return
    }

    try {
      const { error } = await supabase
        .from('meetups')
        .update({
          location: location,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetupId)

      if (error) {
        toast?.error('Error setting location: ' + error.message)
      } else {
        await refreshMeetups?.()
        toast?.success('Location set!')
      }
    } catch (err) {
      toast?.error('Error: ' + err.message)
    }
  }

  const handleJoinVideoCall = async (meetup) => {
    try {
      const meetupId = typeof meetup === 'object' ? meetup.id : meetup;
      const circleId = typeof meetup === 'object' ? meetup.circle_id : null;
      const isCoffeeChat = typeof meetup === 'object' && meetup._isCoffeeChat;

      // If this is a 1:1 coffee chat, route to WebRTC peer-to-peer call
      // Strip "coffee-" prefix if present (some pages prefix IDs to avoid collisions with meetup IDs)
      if (isCoffeeChat) {
        const chatId = meetup._coffeeChatId || (typeof meetupId === 'string' && meetupId.startsWith('coffee-') ? meetupId.replace('coffee-', '') : meetupId);
        window.location.href = `/call/coffee/${chatId}`;
        return;
      }

      // If this is a circle meetup, route to circle call (Agora) with meetup ID for session isolation
      if (circleId) {
        const channelName = `connection-group-${meetupId}`;
        window.location.href = `/call/circle/${channelName}`;
        return;
      }

      // Regular meetup - use LiveKit via /call/meetup/
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        toast?.error('Video not configured. Please add NEXT_PUBLIC_AGORA_APP_ID to .env.local and restart.');
        return;
      }

      // Check if room already exists
      const exists = await hasAgoraRoom(meetupId);

      if (!exists) {
        const { channelName, link } = await createAgoraRoom(meetupId);
      }

      // Navigate to the video call
      const channelName = `meetup-${meetupId}`;
      window.location.href = `/call/meetup/${channelName}`;
    } catch (error) {
      console.error('Error joining video call:', error);

      let errorMsg = 'Could not join video call\n\n';

      if (error.message.includes('agora_rooms')) {
        errorMsg += 'Database table not found.\n\n';
        errorMsg += 'Please run the database migration:\n';
        errorMsg += '1. Open Supabase SQL Editor\n';
        errorMsg += '2. Run database-migration-agora.sql\n\n';
        errorMsg += 'See AGORA_SETUP.md for details.';
      } else if (error.message.includes('Not authenticated')) {
        errorMsg += 'You must be logged in to join video calls.';
      } else {
        errorMsg += error.message;
      }

      toast?.error(errorMsg);
    }
  }

  return {
    // Modal state
    newMeetup, setNewMeetup,
    selectedDate, setSelectedDate,
    editingMeetup, setEditingMeetup,
    showCreateMeetup, setShowCreateMeetup,
    showEditMeetup, setShowEditMeetup,
    nextStepPrompt, setNextStepPrompt,

    // Handlers
    handleSignUp,
    handleCancelSignup,
    handleCreateMeetup,
    handleEditMeetup,
    handleUpdateMeetup,
    handleDeleteMeetup,
    handleSetLocation,
    handleJoinVideoCall,
  }
}

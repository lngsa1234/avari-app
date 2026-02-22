// lib/circleMeetupHelpers.js
// Helper functions for circle meetup management

import { supabase } from './supabase';
import { parseLocalDate } from './dateUtils';

// Days of week mapping
const DAYS_OF_WEEK = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6,
};

/**
 * Calculate upcoming meetup dates based on schedule
 */
export function calculateUpcomingDates(meetingDay, cadence, count = 4) {
  if (!meetingDay || meetingDay === 'Flexible') return [];

  const dayIndex = DAYS_OF_WEEK[meetingDay];
  if (dayIndex === undefined) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = [];
  let currentDate = new Date(today);

  // Find the next occurrence of the meeting day
  const daysUntilNext = (dayIndex - currentDate.getDay() + 7) % 7;
  currentDate.setDate(currentDate.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext));

  // Determine interval based on cadence
  let intervalDays = 7;
  let isFirstAndThird = false;

  switch (cadence) {
    case 'Weekly':
      intervalDays = 7;
      break;
    case 'Biweekly':
      intervalDays = 14;
      break;
    case 'Monthly':
      intervalDays = 28;
      break;
    case '1st & 3rd':
      isFirstAndThird = true;
      break;
    default:
      intervalDays = 7;
  }

  if (isFirstAndThird) {
    let month = currentDate.getMonth();
    let year = currentDate.getFullYear();

    for (let i = 0; i < 6 && dates.length < count; i++) {
      const firstOfMonth = new Date(year, month, 1);
      const firstDayOfWeek = firstOfMonth.getDay();
      let firstOccurrence = 1 + ((dayIndex - firstDayOfWeek + 7) % 7);

      const first = new Date(year, month, firstOccurrence);
      const third = new Date(year, month, firstOccurrence + 14);

      if (first > today && dates.length < count) {
        dates.push(first);
      }
      if (third > today && dates.length < count) {
        dates.push(third);
      }

      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + intervalDays);
    }
  }

  return dates.slice(0, count);
}

/**
 * Get or create meetups for a circle based on its schedule
 */
export async function getOrCreateCircleMeetups(circleId, circle, count = 4) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // First, get ALL existing meetups for this circle (including past) to avoid duplicates
    const { data: allExistingMeetups, error: fetchError } = await supabase
      .from('meetups')
      .select('*')
      .eq('circle_id', circleId)
      .order('date', { ascending: true });

    if (fetchError) {
      // If circle_id column doesn't exist, return empty and use calculated dates
      if (fetchError.message.includes('column') || fetchError.code === '42703') {
        console.log('circle_id column not found in meetups table, using calculated dates');
        return { meetups: [], needsMigration: true };
      }
      throw fetchError;
    }

    // Filter to future meetups that match the current schedule day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const currentDayIndex = circle.meeting_day ? DAYS_OF_WEEK[circle.meeting_day] : null;

    const existingMeetups = (allExistingMeetups || []).filter(m => {
      if (m.date < todayStr) return false;
      // If circle has a scheduled day, only include meetups on that day
      if (currentDayIndex !== null && currentDayIndex !== undefined) {
        const meetupDay = parseLocalDate(m.date).getDay();
        if (meetupDay !== currentDayIndex) return false;
      }
      return true;
    });

    // If we have enough future meetups on the current schedule, return them
    if (existingMeetups.length >= count) {
      return { meetups: existingMeetups.slice(0, count), needsMigration: false };
    }

    // Calculate dates we need
    const upcomingDates = calculateUpcomingDates(
      circle.meeting_day,
      circle.cadence,
      count
    );

    if (upcomingDates.length === 0) {
      return { meetups: existingMeetups || [], needsMigration: false };
    }

    // Check which dates already have meetups (normalize date format)
    const existingDates = new Set(
      (allExistingMeetups || []).map(m => {
        // Normalize to YYYY-MM-DD format
        const d = parseLocalDate(m.date);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      })
    );

    // Create meetups for missing dates
    const meetupsToCreate = [];
    for (const date of upcomingDates) {
      const dateStr = date.toISOString().split('T')[0];

      // Skip if this date already exists
      if (existingDates.has(dateStr)) {
        continue;
      }

      // Mark this date as used to prevent duplicates in same batch
      existingDates.add(dateStr);

      meetupsToCreate.push({
        circle_id: circleId,
        date: dateStr,
        time: convertTimeToDbFormat(circle.time_of_day) || '19:00',
        topic: `${circle.name} Meetup`,
        duration: 60,
        participant_limit: circle.max_members || 10,
        description: circle.description || `Regular meetup for ${circle.name}`,
        location: circle.location || 'Virtual',
        created_by: circle.creator_id,
        vibe_category: circle.vibe_category,
      });
    }

    // Insert new meetups if needed
    if (meetupsToCreate.length > 0) {
      const { data: newMeetups, error: insertError } = await supabase
        .from('meetups')
        .insert(meetupsToCreate)
        .select();

      if (insertError) {
        console.error('Error creating circle meetups:', insertError);
        // Return existing meetups even if insert fails
        return { meetups: existingMeetups || [], needsMigration: false };
      }

      // Combine and sort all future meetups
      const allFutureMeetups = [...existingMeetups, ...(newMeetups || [])];
      allFutureMeetups.sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
      return { meetups: allFutureMeetups.slice(0, count), needsMigration: false };
    }

    return { meetups: existingMeetups.slice(0, count), needsMigration: false };
  } catch (error) {
    console.error('Error in getOrCreateCircleMeetups:', error);
    return { meetups: [], needsMigration: true, error };
  }
}

/**
 * Convert display time to database format
 */
function convertTimeToDbFormat(timeOfDay) {
  if (!timeOfDay || timeOfDay === 'Flexible') return null;

  // Handle formats like "7:00 PM", "12:00 PM", etc.
  const match = timeOfDay.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

/**
 * Get RSVPs for a meetup
 */
export async function getMeetupRSVPs(meetupId) {
  try {
    const { data, error } = await supabase
      .from('meetup_signups')
      .select(`
        id,
        user_id,
        created_at,
        profiles:user_id (
          id,
          name,
          profile_picture
        )
      `)
      .eq('meetup_id', meetupId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting RSVPs:', error);
    return [];
  }
}

/**
 * RSVP to a circle meetup
 */
export async function rsvpToMeetup(meetupId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if already signed up
    const { data: existing } = await supabase
      .from('meetup_signups')
      .select('id')
      .eq('meetup_id', meetupId)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return { success: true, message: 'Already signed up' };
    }

    const { error } = await supabase
      .from('meetup_signups')
      .insert({
        meetup_id: meetupId,
        user_id: user.id,
      });

    if (error) throw error;
    return { success: true, message: 'RSVP successful' };
  } catch (error) {
    console.error('Error RSVPing to meetup:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel RSVP to a meetup
 */
export async function cancelRSVP(meetupId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('meetup_signups')
      .delete()
      .eq('meetup_id', meetupId)
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error canceling RSVP:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's RSVP status for multiple meetups
 */
export async function getUserRSVPStatus(meetupIds) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('meetup_signups')
      .select('meetup_id')
      .eq('user_id', user.id)
      .in('meetup_id', meetupIds);

    if (error) throw error;

    const rsvpMap = {};
    (data || []).forEach(r => {
      rsvpMap[r.meetup_id] = true;
    });
    return rsvpMap;
  } catch (error) {
    console.error('Error getting RSVP status:', error);
    return {};
  }
}

/**
 * Delete a circle meetup (host only)
 */
export async function deleteCircleMeetup(meetupId) {
  try {
    const { error } = await supabase
      .from('meetups')
      .delete()
      .eq('id', meetupId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting meetup:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete all future circle meetups and clear the recurring schedule
 */
export async function deleteAllFutureCircleMeetups(circleId) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Query future meetups first, then delete by id (RLS may block bulk delete by other columns)
    const { data: futureMeetups } = await supabase
      .from('meetups')
      .select('id')
      .eq('circle_id', circleId)
      .gte('date', today);

    if (futureMeetups && futureMeetups.length > 0) {
      const ids = futureMeetups.map(m => m.id);
      const { error: deleteError } = await supabase
        .from('meetups')
        .delete()
        .in('id', ids);
      if (deleteError) throw deleteError;
    }

    // Clear cadence settings to stop auto-generation
    const { error: updateError } = await supabase
      .from('connection_groups')
      .update({
        meeting_day: null,
        cadence: null,
        time_of_day: null,
      })
      .eq('id', circleId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Error deleting all future meetups:', error);
    return { success: false, error: error.message };
  }
}

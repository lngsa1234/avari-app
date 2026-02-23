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

    // Filter to future meetups (use local date to avoid UTC shift)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const currentDayIndex = circle.meeting_day ? DAYS_OF_WEEK[circle.meeting_day] : null;

    // Get all future meetups that are active (not cancelled/completed)
    const activeFutureMeetups = (allExistingMeetups || []).filter(m => {
      if (m.date < todayStr) return false;
      if (m.status === 'cancelled' || m.status === 'completed') return false;
      return true;
    });

    // For the return value, include ALL active future meetups (even rescheduled ones on different days)
    // Sort by date
    const existingMeetups = activeFutureMeetups.sort((a, b) => a.date.localeCompare(b.date));

    // If we have enough future meetups on the current schedule, return them
    if (existingMeetups.length >= count) {
      return { meetups: existingMeetups.slice(0, count), needsMigration: false };
    }

    // Calculate how many more meetups we need to auto-generate
    const neededCount = count - existingMeetups.length;
    if (neededCount <= 0) {
      return { meetups: existingMeetups.slice(0, count), needsMigration: false };
    }

    // Calculate dates we need
    const upcomingDates = calculateUpcomingDates(
      circle.meeting_day,
      circle.cadence,
      count + existingMeetups.length // generate extra to account for skips
    );

    if (upcomingDates.length === 0) {
      return { meetups: existingMeetups || [], needsMigration: false };
    }

    // Check which dates already have meetups (normalize date format)
    // Include ALL meetup dates (past, future, cancelled) to avoid re-creating
    const existingDates = new Set(
      (allExistingMeetups || []).map(m => {
        // Normalize to YYYY-MM-DD format
        const d = parseLocalDate(m.date);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      })
    );

    // Build list of active future meetup dates (as timestamps) for proximity checking
    // This prevents auto-generating a meetup for e.g. Feb 23 when the meetup was rescheduled to Feb 24
    const activeFutureDateTimestamps = activeFutureMeetups.map(m => parseLocalDate(m.date).getTime());

    // Create meetups for missing dates, but only up to what we need
    const meetupsToCreate = [];
    for (const date of upcomingDates) {
      if (meetupsToCreate.length >= neededCount) break;

      const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

      // Skip if this date already exists
      if (existingDates.has(dateStr)) {
        continue;
      }

      // Skip if there's already an active meetup within 3 days (handles rescheduled meetups)
      const dateMs = date.getTime();
      const hasNearbyMeetup = activeFutureDateTimestamps.some(
        ts => Math.abs(ts - dateMs) <= 3 * 24 * 60 * 60 * 1000
      );
      if (hasNearbyMeetup) {
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
 * Cancel a circle meetup (host only) — uses update instead of delete for RLS compatibility
 */
export async function deleteCircleMeetup(meetupId) {
  try {
    const { error } = await supabase
      .from('meetups')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', meetupId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error cancelling meetup:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel all future circle meetups and clear the recurring schedule
 */
export async function deleteAllFutureCircleMeetups(circleId) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Query future meetups first, then cancel by id (RLS blocks .delete())
    const { data: futureMeetups } = await supabase
      .from('meetups')
      .select('id')
      .eq('circle_id', circleId)
      .gte('date', today);

    if (futureMeetups && futureMeetups.length > 0) {
      const ids = futureMeetups.map(m => m.id);
      const { error: cancelError } = await supabase
        .from('meetups')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .in('id', ids);
      if (cancelError) throw cancelError;
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
    console.error('Error cancelling all future meetups:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reconcile circle meetups after a schedule change.
 * Reuses existing active meetup records, cancels excess ones, and creates new ones as needed.
 */
export async function reconcileCircleMeetups(circleId, circle, count = 4) {
  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 1. Fetch all future meetups for this circle
    const { data: futureMeetups, error: fetchError } = await supabase
      .from('meetups')
      .select('*')
      .eq('circle_id', circleId)
      .gte('date', todayStr)
      .order('date', { ascending: true });

    if (fetchError) throw fetchError;

    // 2. Filter to active ones (not cancelled/completed)
    const activeMeetups = (futureMeetups || []).filter(
      m => m.status !== 'cancelled' && m.status !== 'completed'
    );

    // 3. Calculate new schedule dates
    const newDates = calculateUpcomingDates(circle.meeting_day, circle.cadence, count);
    if (newDates.length === 0) return { success: true, meetups: [] };

    const newTime = convertTimeToDbFormat(circle.time_of_day) || '19:00';
    const topicName = circle.name ? `${circle.name} Meetup` : 'Circle Meetup';

    // 4. Reuse existing active meetups by updating them to the new schedule
    const reusedMeetups = [];
    const reusableCount = Math.min(activeMeetups.length, newDates.length);

    for (let i = 0; i < reusableCount; i++) {
      const meetup = activeMeetups[i];
      const newDate = newDates[i];
      const dateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;

      const { error: updateError } = await supabase
        .from('meetups')
        .update({
          date: dateStr,
          time: newTime,
          topic: topicName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', meetup.id);

      if (updateError) {
        console.error('Error reusing meetup:', updateError);
      } else {
        reusedMeetups.push({ ...meetup, date: dateStr, time: newTime, topic: topicName });
      }
    }

    // 5. Cancel any excess active meetups
    if (activeMeetups.length > newDates.length) {
      const excessMeetups = activeMeetups.slice(newDates.length);
      const excessIds = excessMeetups.map(m => m.id);

      const { error: cancelError } = await supabase
        .from('meetups')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .in('id', excessIds);

      if (cancelError) {
        console.error('Error cancelling excess meetups:', cancelError);
      }
    }

    // 6. Create new meetup records if there are more new dates than old records
    const createdMeetups = [];
    if (newDates.length > activeMeetups.length) {
      const datesToCreate = newDates.slice(activeMeetups.length);
      const meetupsToInsert = datesToCreate.map(date => {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return {
          circle_id: circleId,
          date: dateStr,
          time: newTime,
          topic: topicName,
          duration: 60,
          participant_limit: circle.max_members || 10,
          description: circle.description || `Regular meetup for ${circle.name || 'circle'}`,
          location: circle.location || 'Virtual',
          created_by: circle.creator_id,
          vibe_category: circle.vibe_category,
        };
      });

      const { data: newMeetups, error: insertError } = await supabase
        .from('meetups')
        .insert(meetupsToInsert)
        .select();

      if (insertError) {
        console.error('Error creating new meetups:', insertError);
      } else {
        createdMeetups.push(...(newMeetups || []));
      }
    }

    return { success: true, meetups: [...reusedMeetups, ...createdMeetups] };
  } catch (error) {
    console.error('Error reconciling circle meetups:', error);
    return { success: false, error: error.message };
  }
}

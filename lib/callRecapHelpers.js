/**
 * Call Recap Helpers
 *
 * Functions to save and retrieve call recaps from the database
 */

import { supabase } from './supabase';

/**
 * Clamp start/end times to the scheduled meeting window.
 * - Start: no earlier than 10 min before scheduled start
 * - End: no later than scheduled end (start + duration)
 * Returns { clampedStart, clampedEnd, durationSeconds }
 */
function clampToSchedule(startedAt, endedAt, scheduledDate, scheduledTime, scheduledDuration) {
  let clampedStart = startedAt ? new Date(startedAt) : null;
  let clampedEnd = endedAt ? new Date(endedAt) : new Date();

  if (scheduledDate && scheduledTime) {
    try {
      const scheduled = new Date(`${scheduledDate}T${scheduledTime}`);
      const durationMin = parseInt(scheduledDuration) || 60;
      const windowStart = new Date(scheduled.getTime() - 10 * 60 * 1000); // 10 min before
      const windowEnd = new Date(scheduled.getTime() + durationMin * 60 * 1000);

      if (clampedStart && clampedStart < windowStart) {
        console.log('[CallRecap] Clamping start from', clampedStart.toISOString(), 'to', windowStart.toISOString());
        clampedStart = windowStart;
      }
      if (clampedEnd > windowEnd) {
        console.log('[CallRecap] Clamping end from', clampedEnd.toISOString(), 'to', windowEnd.toISOString());
        clampedEnd = windowEnd;
      }
    } catch (e) {
      console.warn('[CallRecap] Failed to parse schedule for clamping:', e);
    }
  }

  const durationSeconds = clampedStart
    ? Math.max(0, Math.floor((clampedEnd - clampedStart) / 1000))
    : 0;

  return {
    clampedStart: clampedStart?.toISOString() || startedAt,
    clampedEnd: clampedEnd.toISOString(),
    durationSeconds,
  };
}

/**
 * Save a call recap to the database
 * @param {Object} recapData
 * @returns {Promise<Object>}
 */
export async function saveCallRecap(recapData) {
  const {
    channelName,
    callType,
    provider,
    startedAt,
    endedAt,
    participants = [],
    transcript = [],
    aiSummary = null,
    metrics = {},
    userId,
    scheduledDate = null,   // e.g. "2026-03-22"
    scheduledTime = null,   // e.g. "14:00"
    scheduledDuration = null // minutes, e.g. 60
  } = recapData;

  try {
    // Get current session, fall back to refresh if needed
    let session;
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing) {
      session = existing;
    } else {
      const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed) {
        console.error('[CallRecap] Auth failed:', refreshError?.message || 'no session');
        throw new Error('Not authenticated');
      }
      session = refreshed;
    }

    // Extract participant IDs
    const participantIds = participants.map(p => p.id).filter(Boolean);

    // Check for existing recap for this channel (same meetup/chat)
    const { data: existingRecap } = await supabase
      .from('call_recaps')
      .select('id, transcript, started_at, participant_ids')
      .eq('channel_name', channelName)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRecap) {
      // Merge transcripts: combine old + new, sorted by timestamp
      const oldTranscript = existingRecap.transcript || [];
      const mergedTranscript = [...oldTranscript, ...transcript]
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      // Use the earliest start time
      const effectiveStartedAt = existingRecap.started_at && startedAt
        ? (new Date(existingRecap.started_at) < new Date(startedAt) ? existingRecap.started_at : startedAt)
        : existingRecap.started_at || startedAt;

      // Merge participant IDs
      const mergedParticipantIds = [...new Set([...(existingRecap.participant_ids || []), ...participantIds])];

      const effectiveEnd = endedAt || new Date().toISOString();

      // Clamp to scheduled meeting window if available
      const { clampedStart, clampedEnd, durationSeconds } = clampToSchedule(
        effectiveStartedAt, effectiveEnd, scheduledDate, scheduledTime, scheduledDuration
      );

      const updateFields = {
        ended_at: clampedEnd,
        duration_seconds: durationSeconds,
        participant_count: mergedParticipantIds.length,
        participant_ids: mergedParticipantIds,
        transcript: mergedTranscript,
      };
      // Only update ai_summary if a new one is provided — don't overwrite existing with null
      if (aiSummary !== undefined && aiSummary !== null) {
        updateFields.ai_summary = aiSummary;
      }

      const { data, error } = await supabase
        .from('call_recaps')
        .update(updateFields)
        .eq('id', existingRecap.id)
        .select()
        .single();

      if (error) {
        // RLS may block non-creator from updating — fall back to creating a new recap
        console.warn('[CallRecap] Update failed (RLS?), creating separate recap:', error.message);
      } else {
        console.log('[CallRecap] Recap updated (merged with previous session):', data.id);
        return data;
      }
    }

    // No existing recap — create new one
    // Clamp to scheduled meeting window if available
    const { clampedStart, clampedEnd, durationSeconds: newDuration } = clampToSchedule(
      startedAt, endedAt, scheduledDate, scheduledTime, scheduledDuration
    );

    const { data, error } = await supabase
      .from('call_recaps')
      .insert({
        channel_name: channelName,
        call_type: callType,
        provider: provider,
        started_at: clampedStart,
        ended_at: clampedEnd,
        duration_seconds: newDuration,
        participant_count: participants.length,
        participant_ids: participantIds,
        transcript: transcript,
        ai_summary: aiSummary,
        metrics: metrics,
        created_by: session.user.id
      })
      .select()
      .single();

    if (error) {
      console.error('[CallRecap] Error saving recap:', error);
      throw error;
    }

    console.log('[CallRecap] Recap saved:', data.id);
    return data;
  } catch (error) {
    console.error('[CallRecap] Failed to save recap:', error);
    throw error;
  }
}

/**
 * Save provider metrics for A/B testing
 * @param {Object} metricsData
 * @returns {Promise<Object>}
 */
export async function saveProviderMetrics(metricsData) {
  const {
    provider,
    callType,
    channelName,
    metrics,
    participantCount,
    durationSeconds
  } = metricsData;

  try {
    const { data, error } = await supabase
      .from('provider_metrics')
      .insert({
        provider,
        call_type: callType,
        channel_name: channelName,
        avg_latency_ms: metrics.latency || 0,
        max_latency_ms: metrics.maxLatency || metrics.latency || 0,
        min_latency_ms: metrics.minLatency || metrics.latency || 0,
        packet_loss_percent: metrics.packetLoss || 0,
        avg_bitrate_kbps: metrics.bitrate || 0,
        connection_quality: metrics.connectionQuality || 'unknown',
        participant_count: participantCount,
        duration_seconds: durationSeconds,
        video_resolution: metrics.videoResolution || null,
        fps: metrics.fps || null,
        reconnect_count: metrics.reconnectCount || 0
      })
      .select()
      .single();

    if (error) {
      console.error('[ProviderMetrics] Error saving metrics:', error);
      // Don't throw - metrics are optional
      return null;
    }

    console.log('[ProviderMetrics] Metrics saved:', data.id);
    return data;
  } catch (error) {
    console.error('[ProviderMetrics] Failed to save metrics:', error);
    return null;
  }
}

/**
 * Get call recaps for the current user
 * @param {number} limit - Number of recaps to fetch
 * @returns {Promise<Array>}
 */
export async function getMyCallRecaps(limit = 20) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('call_recaps')
      .select('*')
      .or(`created_by.eq.${user.id},participant_ids.cs.{${user.id}}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('[CallRecap] Error fetching recaps:', error);
    return [];
  }
}

/**
 * Get a single call recap by channel name
 * @param {string} channelName
 * @returns {Promise<Object|null>}
 */
export async function getCallRecapByChannel(channelName) {
  try {
    const { data, error } = await supabase
      .from('call_recaps')
      .select('*')
      .eq('channel_name', channelName)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('[CallRecap] Error fetching recap:', error);
    return null;
  }
}

/**
 * Get provider performance summary
 * @returns {Promise<Array>}
 */
export async function getProviderPerformanceSummary() {
  try {
    const { data, error } = await supabase
      .from('provider_performance_summary')
      .select('*');

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('[ProviderMetrics] Error fetching summary:', error);
    return [];
  }
}

/**
 * Update AI summary for a recap
 * @param {string} recapId
 * @param {string} summary
 * @returns {Promise<Object>}
 */
export async function updateRecapSummary(recapId, summary) {
  try {
    const { data, error } = await supabase
      .from('call_recaps')
      .update({ ai_summary: summary })
      .eq('id', recapId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('[CallRecap] Error updating summary:', error);
    throw error;
  }
}

/**
 * Update AI summary for a recap by channel name
 * @param {string} channelName
 * @param {string} summary
 * @returns {Promise<Object|null>}
 */
export async function updateRecapSummaryByChannel(channelName, summary) {
  try {
    const { data, error } = await supabase
      .from('call_recaps')
      .update({ ai_summary: summary })
      .eq('channel_name', channelName)
      .order('created_at', { ascending: false })
      .limit(1)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[CallRecap] Error updating summary by channel:', error);
      return null;
    }

    console.log('[CallRecap] Summary saved for channel:', channelName);
    return data;
  } catch (error) {
    console.error('[CallRecap] Error updating summary by channel:', error);
    return null;
  }
}

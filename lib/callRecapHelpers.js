/**
 * Call Recap Helpers
 *
 * Functions to save and retrieve call recaps from the database
 */

import { supabase } from './supabase';

const TRANSCRIPT_BUCKET = 'call-transcripts';

// Column list for recap queries — excludes transcript and ai_summary (now in storage)
const RECAP_COLUMNS = 'id, channel_name, call_type, provider, started_at, ended_at, duration_seconds, participant_count, participant_ids, transcript_path, metrics, created_by, created_at, updated_at';

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
    scheduledDate = null,
    scheduledTime = null,
    scheduledDuration = null
  } = recapData;

  try {
    // Get auth token for the server API
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data: { session: refreshed } } = await supabase.auth.refreshSession();
      if (!refreshed) throw new Error('Not authenticated');
    }
    const token = (session || (await supabase.auth.getSession()).data.session)?.access_token;

    const participantIds = participants.map(p => p.id).filter(Boolean);

    // Server-authoritative merge: one recap per channel_name, guaranteed.
    // The server uses service role to bypass RLS, preventing duplicate rows.
    const response = await fetch('/api/save-call-recap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        channelName, callType, provider,
        startedAt, endedAt,
        participantIds, transcript,
        aiSummary, metrics,
        scheduledDate, scheduledTime, scheduledDuration,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Server returned ${response.status}`);
    }

    const data = await response.json();
    console.log('[CallRecap] Recap saved via server:', data.id);
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
      .select(RECAP_COLUMNS)
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
      .select(RECAP_COLUMNS)
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
 * Fetch transcript + AI summary from Supabase Storage.
 * Call this only when the user wants to view the full recap detail.
 * @param {string} transcriptPath - storage path from call_recaps.transcript_path
 * @returns {Promise<{ transcript: Array, aiSummary: string|null }>}
 */
export async function getRecapTranscriptFromStorage(transcriptPath) {
  if (!transcriptPath) return { transcript: [], aiSummary: null };

  try {
    const { data, error } = await supabase.storage
      .from(TRANSCRIPT_BUCKET)
      .download(transcriptPath);

    if (error) throw error;

    const parsed = JSON.parse(await data.text());
    return {
      transcript: parsed.transcript || [],
      aiSummary: parsed.aiSummary || null,
    };
  } catch (error) {
    console.error('[CallRecap] Error fetching transcript from storage:', error);
    return { transcript: [], aiSummary: null };
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
    // Get the transcript_path for this recap
    const { data: recap, error: fetchError } = await supabase
      .from('call_recaps')
      .select('id, transcript_path, channel_name')
      .eq('id', recapId)
      .single();

    if (fetchError) throw fetchError;

    // Update summary in storage
    await updateSummaryInStorage(recap.transcript_path || `recaps/${recap.channel_name}.json`, summary);

    return recap;
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
    const storagePath = `recaps/${channelName}.json`;
    await updateSummaryInStorage(storagePath, summary);

    console.log('[CallRecap] Summary saved for channel:', channelName);
    return { channel_name: channelName };
  } catch (error) {
    console.error('[CallRecap] Error updating summary by channel:', error);
    return null;
  }
}

/**
 * Update just the aiSummary field in a storage transcript file.
 * Downloads existing file, merges summary, re-uploads.
 */
async function updateSummaryInStorage(storagePath, summary) {
  let existing = { transcript: [], aiSummary: null };

  // Try to download existing file
  const { data: fileData, error: dlError } = await supabase.storage
    .from(TRANSCRIPT_BUCKET)
    .download(storagePath);

  if (!dlError && fileData) {
    try {
      existing = JSON.parse(await fileData.text());
    } catch (e) {
      // File exists but isn't valid JSON — overwrite
    }
  }

  existing.aiSummary = summary;

  const { error: uploadError } = await supabase.storage
    .from(TRANSCRIPT_BUCKET)
    .upload(storagePath, JSON.stringify(existing), {
      contentType: 'application/json',
      upsert: true,
    });

  if (uploadError) throw uploadError;
}

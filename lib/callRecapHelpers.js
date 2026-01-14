/**
 * Call Recap Helpers
 *
 * Functions to save and retrieve call recaps from the database
 */

import { supabase } from './supabase';

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
    userId
  } = recapData;

  try {
    // Calculate duration
    const start = startedAt ? new Date(startedAt) : null;
    const end = endedAt ? new Date(endedAt) : new Date();
    const durationSeconds = start ? Math.floor((end - start) / 1000) : 0;

    // Extract participant IDs
    const participantIds = participants.map(p => p.id).filter(Boolean);

    const { data, error } = await supabase
      .from('call_recaps')
      .insert({
        channel_name: channelName,
        call_type: callType,
        provider: provider,
        started_at: startedAt,
        ended_at: endedAt || new Date().toISOString(),
        duration_seconds: durationSeconds,
        participant_count: participants.length,
        participant_ids: participantIds,
        transcript: transcript,
        ai_summary: aiSummary,
        metrics: metrics,
        created_by: userId
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
      .single();

    if (error && error.code !== 'PGRST116') throw error;

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

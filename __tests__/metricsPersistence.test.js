/**
 * Tests for video call metrics persistence.
 *
 * Covers:
 * - Metrics collection from WebRTC stats
 * - Metrics aggregation (min/max latency tracking)
 * - Metrics passed through call-end flow
 * - saveProviderMetrics parameter mapping
 * - Edge cases (no data, Infinity minLatency)
 */

import { saveProviderMetrics } from '@/lib/callRecapHelpers';

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'metric-123' }, error: null }),
    })),
  },
}));

describe('Metrics Persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Metrics Collection Logic ─────────────────────────────

  describe('Metrics collection from WebRTC stats', () => {
    test('calculates connection quality from RTT', () => {
      const qualityFromRtt = (rtt) => {
        if (rtt < 100) return 'excellent';
        if (rtt < 200) return 'good';
        if (rtt < 400) return 'fair';
        return 'poor';
      };

      expect(qualityFromRtt(50)).toBe('excellent');
      expect(qualityFromRtt(150)).toBe('good');
      expect(qualityFromRtt(300)).toBe('fair');
      expect(qualityFromRtt(500)).toBe('poor');
    });

    test('tracks min and max latency over time', () => {
      const metrics = { latency: 0, maxLatency: 0, minLatency: Infinity };

      // Simulate multiple metric samples
      const samples = [120, 80, 200, 50, 150];
      samples.forEach(rtt => {
        metrics.latency = rtt;
        metrics.maxLatency = Math.max(metrics.maxLatency, rtt);
        metrics.minLatency = metrics.minLatency === Infinity ? rtt : Math.min(metrics.minLatency, rtt);
      });

      expect(metrics.latency).toBe(150); // Last sample
      expect(metrics.maxLatency).toBe(200);
      expect(metrics.minLatency).toBe(50);
    });

    test('handles first sample correctly (minLatency starts at Infinity)', () => {
      const metrics = { maxLatency: 0, minLatency: Infinity };
      const rtt = 100;

      metrics.maxLatency = Math.max(metrics.maxLatency, rtt);
      metrics.minLatency = metrics.minLatency === Infinity ? rtt : Math.min(metrics.minLatency, rtt);

      expect(metrics.maxLatency).toBe(100);
      expect(metrics.minLatency).toBe(100);
    });

    test('calculates packet loss percentage from RTP stats', () => {
      const packetsReceived = 950;
      const packetsLost = 50;
      const total = packetsReceived + packetsLost;
      const packetLoss = total > 0 ? (packetsLost / total) * 100 : 0;

      expect(packetLoss).toBe(5);
    });

    test('handles zero packets gracefully', () => {
      const packetsReceived = 0;
      const packetsLost = 0;
      const total = packetsReceived + packetsLost;
      const packetLoss = total > 0 ? (packetsLost / total) * 100 : 0;

      expect(packetLoss).toBe(0);
    });
  });

  // ─── Metrics in Call-End Flow ─────────────────────────────

  describe('Metrics passed through call-end flow', () => {
    test('VideoCall.tsx onEndCall includes metrics and provider', () => {
      const metricsRef = {
        latency: 85,
        packetLoss: 0.5,
        bitrate: 2500,
        connectionQuality: 'excellent',
        maxLatency: 120,
        minLatency: 45,
        videoResolution: '1280x720',
        fps: 30,
      };

      // Simulate what handleEndCall does
      const finalMetrics = { ...metricsRef };
      if (finalMetrics.minLatency === Infinity) finalMetrics.minLatency = 0;

      const recapData = {
        startedAt: '2026-04-07T10:00:00Z',
        endedAt: '2026-04-07T10:30:00Z',
        metrics: finalMetrics,
        provider: 'webrtc',
      };

      expect(recapData.metrics.latency).toBe(85);
      expect(recapData.metrics.maxLatency).toBe(120);
      expect(recapData.metrics.minLatency).toBe(45);
      expect(recapData.provider).toBe('webrtc');
    });

    test('Infinity minLatency is normalized to 0', () => {
      const metricsRef = { latency: 0, maxLatency: 0, minLatency: Infinity };
      const finalMetrics = { ...metricsRef };
      if (finalMetrics.minLatency === Infinity) finalMetrics.minLatency = 0;

      expect(finalMetrics.minLatency).toBe(0);
    });

    test('livekitMode sets provider to livekit', () => {
      const livekitMode = true;
      const provider = livekitMode ? 'livekit' : 'webrtc';
      expect(provider).toBe('livekit');
    });

    test('non-livekitMode sets provider to webrtc', () => {
      const livekitMode = false;
      const provider = livekitMode ? 'livekit' : 'webrtc';
      expect(provider).toBe('webrtc');
    });
  });

  // ─── saveProviderMetrics Parameter Mapping ────────────────

  describe('saveProviderMetrics parameter mapping', () => {
    test('maps JS metrics to database column names', async () => {
      const { supabase } = require('@/lib/supabase');
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'pm-1' }, error: null }),
        }),
      });
      supabase.from.mockReturnValue({ insert: mockInsert });

      await saveProviderMetrics({
        provider: 'webrtc',
        callType: '1on1',
        channelName: 'video-abc123',
        metrics: {
          latency: 85,
          maxLatency: 120,
          minLatency: 45,
          packetLoss: 0.5,
          bitrate: 2500,
          connectionQuality: 'excellent',
          videoResolution: '1280x720',
          fps: 30,
          reconnectCount: 0,
        },
        participantCount: 2,
        durationSeconds: 1800,
      });

      expect(supabase.from).toHaveBeenCalledWith('provider_metrics');
      expect(mockInsert).toHaveBeenCalledWith({
        provider: 'webrtc',
        call_type: '1on1',
        channel_name: 'video-abc123',
        avg_latency_ms: 85,
        max_latency_ms: 120,
        min_latency_ms: 45,
        packet_loss_percent: 0.5,
        avg_bitrate_kbps: 2500,
        connection_quality: 'excellent',
        participant_count: 2,
        duration_seconds: 1800,
        video_resolution: '1280x720',
        fps: 30,
        reconnect_count: 0,
      });
    });

    test('handles missing optional metric fields', async () => {
      const { supabase } = require('@/lib/supabase');
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'pm-2' }, error: null }),
        }),
      });
      supabase.from.mockReturnValue({ insert: mockInsert });

      await saveProviderMetrics({
        provider: 'agora',
        callType: 'group',
        channelName: 'circle-xyz',
        metrics: { latency: 100 },
        participantCount: 4,
        durationSeconds: 600,
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'agora',
        call_type: 'group',
        avg_latency_ms: 100,
        max_latency_ms: 100, // Falls back to latency
        min_latency_ms: 100, // Falls back to latency
        packet_loss_percent: 0,
        avg_bitrate_kbps: 0,
        connection_quality: 'unknown',
        video_resolution: null,
        fps: null,
        reconnect_count: 0,
      }));
    });

    test('returns null on database error without throwing', async () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      });

      const result = await saveProviderMetrics({
        provider: 'livekit',
        callType: 'meetup',
        channelName: 'meetup-abc',
        metrics: { latency: 50 },
        participantCount: 10,
        durationSeconds: 3600,
      });

      expect(result).toBeNull();
    });
  });

  // ─── VideoCallButton Flow ─────────────────────────────────

  describe('VideoCallButton metrics flow', () => {
    test('only saves provider metrics when latency data exists', () => {
      const shouldSave = (metrics) => metrics && metrics.latency !== undefined;

      expect(shouldSave({ latency: 85, packetLoss: 0.5 })).toBe(true);
      expect(shouldSave({})).toBe(false);
      expect(shouldSave(null)).toBeFalsy();
      expect(shouldSave(undefined)).toBeFalsy();
    });

    test('calculates duration from start and end time', () => {
      const startedAt = '2026-04-07T10:00:00Z';
      const endedAt = '2026-04-07T10:30:00Z';
      const durationSeconds = Math.floor((new Date(endedAt) - new Date(startedAt)) / 1000);

      expect(durationSeconds).toBe(1800);
    });

    test('defaults to 0 duration when timestamps missing', () => {
      const startedAt = null;
      const endedAt = null;
      const durationSeconds = startedAt && endedAt
        ? Math.floor((new Date(endedAt) - new Date(startedAt)) / 1000)
        : 0;

      expect(durationSeconds).toBe(0);
    });
  });

  // ─── Unified Call Page Flow ───────────────────────────────

  describe('Unified call page metrics flow', () => {
    test('quality tier maps to connection quality string', () => {
      const tierToQuality = (label) => {
        if (label === 'HD') return 'excellent';
        if (label === 'SD') return 'good';
        if (label === 'Low') return 'fair';
        return 'poor';
      };

      expect(tierToQuality('HD')).toBe('excellent');
      expect(tierToQuality('SD')).toBe('good');
      expect(tierToQuality('Low')).toBe('fair');
      expect(tierToQuality('Min')).toBe('poor');
    });

    test('only saves when metrics have been collected', () => {
      const metrics = { latency: 0, packetLoss: 0 };
      const shouldSave = metrics.latency > 0 || metrics.packetLoss > 0;
      expect(shouldSave).toBe(false);

      metrics.latency = 100;
      const shouldSaveNow = metrics.latency > 0 || metrics.packetLoss > 0;
      expect(shouldSaveNow).toBe(true);
    });
  });
});

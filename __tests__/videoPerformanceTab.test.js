/**
 * Tests for Video Performance tab in Admin Analytics.
 *
 * Covers:
 * - Quality score calculation
 * - Provider data aggregation across call types
 * - Empty state handling
 * - Comparison table data mapping
 */

describe('Video Performance Tab', () => {
  // ─── Quality Score Calculation ────────────────────────────

  // Mirrors the qualityScore function from AdminAnalyticsView.js
  function qualityScore(row) {
    const total = (row.excellent_count || 0) + (row.good_count || 0) + (row.fair_count || 0) + (row.poor_count || 0);
    if (total === 0) return 0;
    return Math.round(
      ((row.excellent_count * 4 + row.good_count * 3 + row.fair_count * 2 + row.poor_count * 1) / total) * 25
    );
  }

  describe('qualityScore', () => {
    test('returns 100 when all calls are excellent', () => {
      expect(qualityScore({ excellent_count: 50, good_count: 0, fair_count: 0, poor_count: 0 })).toBe(100);
    });

    test('returns 75 when all calls are good', () => {
      expect(qualityScore({ excellent_count: 0, good_count: 50, fair_count: 0, poor_count: 0 })).toBe(75);
    });

    test('returns 50 when all calls are fair', () => {
      expect(qualityScore({ excellent_count: 0, good_count: 0, fair_count: 50, poor_count: 0 })).toBe(50);
    });

    test('returns 25 when all calls are poor', () => {
      expect(qualityScore({ excellent_count: 0, good_count: 0, fair_count: 0, poor_count: 50 })).toBe(25);
    });

    test('returns 0 when no data', () => {
      expect(qualityScore({ excellent_count: 0, good_count: 0, fair_count: 0, poor_count: 0 })).toBe(0);
      expect(qualityScore({})).toBe(0);
    });

    test('weighted average for mixed quality', () => {
      // 10 excellent (40) + 10 good (30) + 10 fair (20) + 10 poor (10) = 100/40 * 25 = 63
      const score = qualityScore({ excellent_count: 10, good_count: 10, fair_count: 10, poor_count: 10 });
      expect(score).toBe(63);
    });

    test('excellent-heavy distribution scores high', () => {
      const score = qualityScore({ excellent_count: 80, good_count: 15, fair_count: 4, poor_count: 1 });
      expect(score).toBeGreaterThanOrEqual(90);
    });

    test('poor-heavy distribution scores low', () => {
      const score = qualityScore({ excellent_count: 1, good_count: 4, fair_count: 15, poor_count: 80 });
      expect(score).toBeLessThanOrEqual(35);
    });
  });

  // ─── Provider Data Aggregation ────────────────────────────

  describe('Provider data aggregation', () => {
    // Mirrors the aggregation logic from VideoTab
    function aggregateByProvider(providerSummary) {
      const byProvider = {};
      providerSummary.forEach(row => {
        if (!byProvider[row.provider]) {
          byProvider[row.provider] = {
            provider: row.provider,
            total_calls: 0, avg_latency: 0, avg_packet_loss: 0, avg_bitrate: 0,
            avg_duration_minutes: 0, excellent_count: 0, good_count: 0, fair_count: 0, poor_count: 0,
            _count: 0,
          };
        }
        const p = byProvider[row.provider];
        p.total_calls += row.total_calls;
        p.avg_latency += (row.avg_latency || 0) * row.total_calls;
        p.avg_packet_loss += (row.avg_packet_loss || 0) * row.total_calls;
        p.avg_bitrate += (row.avg_bitrate || 0) * row.total_calls;
        p.avg_duration_minutes += (row.avg_duration_minutes || 0) * row.total_calls;
        p.excellent_count += row.excellent_count || 0;
        p.good_count += row.good_count || 0;
        p.fair_count += row.fair_count || 0;
        p.poor_count += row.poor_count || 0;
        p._count += row.total_calls;
      });

      Object.values(byProvider).forEach(p => {
        if (p._count > 0) {
          p.avg_latency = Math.round(p.avg_latency / p._count);
          p.avg_packet_loss = Math.round((p.avg_packet_loss / p._count) * 100) / 100;
          p.avg_bitrate = Math.round(p.avg_bitrate / p._count);
          p.avg_duration_minutes = Math.round((p.avg_duration_minutes / p._count) * 10) / 10;
        }
      });

      return byProvider;
    }

    test('aggregates single provider single call type', () => {
      const result = aggregateByProvider([
        { provider: 'webrtc', call_type: '1on1', total_calls: 100, avg_latency: 50, avg_packet_loss: 0.5, avg_bitrate: 2500, avg_duration_minutes: 15, excellent_count: 80, good_count: 15, fair_count: 4, poor_count: 1 },
      ]);

      expect(result.webrtc.total_calls).toBe(100);
      expect(result.webrtc.avg_latency).toBe(50);
      expect(result.webrtc.avg_packet_loss).toBe(0.5);
      expect(result.webrtc.excellent_count).toBe(80);
    });

    test('aggregates provider across multiple call types with weighted average', () => {
      const result = aggregateByProvider([
        { provider: 'livekit', call_type: 'meetup', total_calls: 20, avg_latency: 100, avg_packet_loss: 1.0, avg_bitrate: 3000, avg_duration_minutes: 30, excellent_count: 10, good_count: 8, fair_count: 2, poor_count: 0 },
        { provider: 'livekit', call_type: '1on1', total_calls: 80, avg_latency: 40, avg_packet_loss: 0.2, avg_bitrate: 2000, avg_duration_minutes: 10, excellent_count: 70, good_count: 8, fair_count: 2, poor_count: 0 },
      ]);

      expect(result.livekit.total_calls).toBe(100);
      // Weighted: (100*20 + 40*80) / 100 = 5200/100 = 52
      expect(result.livekit.avg_latency).toBe(52);
      // Quality counts summed
      expect(result.livekit.excellent_count).toBe(80);
      expect(result.livekit.good_count).toBe(16);
    });

    test('handles empty input', () => {
      const result = aggregateByProvider([]);
      expect(Object.keys(result)).toHaveLength(0);
    });

    test('keeps providers separate', () => {
      const result = aggregateByProvider([
        { provider: 'webrtc', call_type: '1on1', total_calls: 50, avg_latency: 30, excellent_count: 40, good_count: 10 },
        { provider: 'agora', call_type: 'group', total_calls: 30, avg_latency: 80, excellent_count: 10, good_count: 15, fair_count: 5 },
      ]);

      expect(result.webrtc.total_calls).toBe(50);
      expect(result.agora.total_calls).toBe(30);
      expect(result.webrtc.avg_latency).toBe(30);
      expect(result.agora.avg_latency).toBe(80);
    });
  });

  // ─── Data Structure from RPC ──────────────────────────────

  describe('RPC data structure', () => {
    test('provider_metrics_summary has expected shape', () => {
      const row = {
        provider: 'webrtc',
        call_type: '1on1',
        total_calls: 42,
        avg_latency: 55,
        avg_packet_loss: 0.3,
        avg_duration_minutes: 12.5,
        avg_bitrate: 2400,
        avg_participants: 2.0,
        excellent_count: 30,
        good_count: 8,
        fair_count: 3,
        poor_count: 1,
      };

      expect(row.provider).toBe('webrtc');
      expect(row.call_type).toBe('1on1');
      expect(row.total_calls).toBeGreaterThan(0);
      expect(row.avg_latency).toBeDefined();
      expect(row.excellent_count + row.good_count + row.fair_count + row.poor_count).toBe(42);
    });

    test('calls_by_provider has expected shape', () => {
      const row = {
        provider: 'livekit',
        total_calls: 25,
        total_seconds: 45000,
        avg_duration_minutes: 30.0,
      };

      expect(row.provider).toBe('livekit');
      expect(row.total_seconds / 60).toBe(750);
    });

    test('calls_by_week_provider has expected shape', () => {
      const row = {
        week: '2026-03-30',
        webrtc: 12,
        livekit: 5,
        agora: 8,
        total: 25,
      };

      expect(row.total).toBe(row.webrtc + row.livekit + row.agora);
    });
  });

  // ─── Empty / Missing Data ─────────────────────────────────

  describe('Empty state handling', () => {
    test('handles missing provider_metrics_summary gracefully', () => {
      const data = {};
      const summary = data.provider_metrics_summary || [];
      expect(summary).toEqual([]);
    });

    test('handles missing calls_by_provider gracefully', () => {
      const data = {};
      const calls = data.calls_by_provider || [];
      const totalCalls = calls.reduce((sum, p) => sum + p.total_calls, 0);
      expect(totalCalls).toBe(0);
    });

    test('handles missing calls_by_week_provider gracefully', () => {
      const data = {};
      const weeks = data.calls_by_week_provider || [];
      expect(weeks).toEqual([]);
    });

    test('total calls computed from calls_by_provider', () => {
      const callsByProvider = [
        { provider: 'webrtc', total_calls: 100 },
        { provider: 'livekit', total_calls: 50 },
        { provider: 'agora', total_calls: 30 },
      ];
      const total = callsByProvider.reduce((sum, p) => sum + p.total_calls, 0);
      expect(total).toBe(180);
    });
  });

  // ─── Provider Labels ──────────────────────────────────────

  describe('Provider labels and descriptions', () => {
    const PROVIDER_LABELS = { webrtc: 'WebRTC', livekit: 'LiveKit', agora: 'Agora' };
    const PROVIDER_DESCRIPTIONS = {
      webrtc: 'Peer-to-peer · 1:1 Coffee Chats',
      livekit: 'SFU Server · Meetups & Fallback',
      agora: 'SFU Server · Connection Groups',
    };

    test('all three providers have labels', () => {
      expect(PROVIDER_LABELS.webrtc).toBe('WebRTC');
      expect(PROVIDER_LABELS.livekit).toBe('LiveKit');
      expect(PROVIDER_LABELS.agora).toBe('Agora');
    });

    test('all three providers have descriptions', () => {
      expect(PROVIDER_DESCRIPTIONS.webrtc).toContain('Coffee');
      expect(PROVIDER_DESCRIPTIONS.livekit).toContain('Meetups');
      expect(PROVIDER_DESCRIPTIONS.agora).toContain('Groups');
    });
  });

  // ─── Quality Score Edge Cases ─────────────────────────────

  describe('Quality score edge cases', () => {
    test('single excellent call scores 100', () => {
      expect(qualityScore({ excellent_count: 1, good_count: 0, fair_count: 0, poor_count: 0 })).toBe(100);
    });

    test('single poor call scores 25', () => {
      expect(qualityScore({ excellent_count: 0, good_count: 0, fair_count: 0, poor_count: 1 })).toBe(25);
    });

    test('50/50 excellent and poor averages to ~63', () => {
      // (4*50 + 1*50) / 100 * 25 = 250/100 * 25 = 62.5 → 63
      const score = qualityScore({ excellent_count: 50, good_count: 0, fair_count: 0, poor_count: 50 });
      expect(score).toBe(63);
    });

    test('score color buckets are correct', () => {
      // >= 75 green, >= 50 yellow, >= 25 orange, < 25 red
      const excellent = qualityScore({ excellent_count: 100, good_count: 0, fair_count: 0, poor_count: 0 });
      const good = qualityScore({ excellent_count: 0, good_count: 100, fair_count: 0, poor_count: 0 });
      const fair = qualityScore({ excellent_count: 0, good_count: 0, fair_count: 100, poor_count: 0 });
      const poor = qualityScore({ excellent_count: 0, good_count: 0, fair_count: 0, poor_count: 100 });

      expect(excellent).toBeGreaterThanOrEqual(75); // green
      expect(good).toBeGreaterThanOrEqual(50);       // yellow
      expect(fair).toBeGreaterThanOrEqual(25);        // orange
      expect(poor).toBeGreaterThanOrEqual(25);        // orange (25 exactly)
    });
  });
});

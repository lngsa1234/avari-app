/**
 * Shared WebRTC metrics collection from RTCPeerConnection.getStats()
 *
 * Used by:
 * - VideoCall.tsx (1:1 coffee chats)
 * - WebRTCProvider.js (provider abstraction)
 * - app/call/[type]/[id]/page.js (unified call page)
 */

/**
 * Calculate connection quality from RTT in milliseconds.
 * @param {number} rttMs - Round-trip time in milliseconds
 * @returns {'excellent' | 'good' | 'fair' | 'poor'}
 */
export function connectionQualityFromRtt(rttMs) {
  if (rttMs < 100) return 'excellent';
  if (rttMs < 200) return 'good';
  if (rttMs < 400) return 'fair';
  return 'poor';
}

/**
 * Extract metrics from RTCPeerConnection stats.
 * @param {RTCPeerConnection} pc
 * @returns {Promise<{ rtt: number, packetLoss: number, bitrate: number, quality: string } | null>}
 */
export async function collectWebRTCMetrics(pc) {
  if (!pc || pc.connectionState !== 'connected') return null;

  try {
    const stats = await pc.getStats();
    let rtt = 0;
    let packetLoss = 0;
    let bitrate = 0;

    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
      }
      if (report.type === 'inbound-rtp' && report.packetsLost !== undefined) {
        const total = report.packetsReceived + report.packetsLost;
        packetLoss = total > 0 ? (report.packetsLost / total) * 100 : 0;
      }
      if (report.type === 'outbound-rtp' && report.bytesSent) {
        bitrate = report.bytesSent / 1000;
      }
    });

    return {
      rtt: Math.round(rtt),
      packetLoss: Math.round(packetLoss * 100) / 100,
      bitrate: Math.round(bitrate),
      quality: connectionQualityFromRtt(rtt),
    };
  } catch {
    return null;
  }
}

/**
 * Update an accumulated metrics object with a new sample.
 * Tracks running min/max latency for the call duration.
 * @param {Object} metrics - The accumulated metrics ref
 * @param {{ rtt: number, packetLoss: number, bitrate: number, quality: string }} sample
 */
export function updateAccumulatedMetrics(metrics, sample) {
  metrics.latency = sample.rtt;
  metrics.packetLoss = sample.packetLoss;
  metrics.bitrate = sample.bitrate;
  metrics.connectionQuality = sample.quality;
  metrics.maxLatency = Math.max(metrics.maxLatency || 0, sample.rtt);
  metrics.minLatency = (metrics.minLatency === undefined || metrics.minLatency === Infinity)
    ? sample.rtt
    : Math.min(metrics.minLatency, sample.rtt);
}

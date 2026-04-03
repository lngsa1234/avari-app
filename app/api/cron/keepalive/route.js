import { NextResponse } from 'next/server';

/**
 * Keep the signaling server warm to prevent Render free tier cold starts.
 * Runs every 10 minutes via Vercel Cron.
 *
 * GET /api/cron/keepalive
 */
export async function GET() {
  const serverUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL;
  if (!serverUrl) {
    return NextResponse.json({ error: 'No signaling server URL configured' }, { status: 500 });
  }

  try {
    const start = Date.now();
    const response = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(10000) });
    const latency = Date.now() - start;
    const isColdStart = latency > 5000;

    if (isColdStart) {
      console.log(`[Keepalive] Signaling server cold start detected: ${latency}ms`);
    }

    return NextResponse.json({
      ok: response.ok,
      latency,
      coldStart: isColdStart,
    });
  } catch (error) {
    console.error('[Keepalive] Signaling server unreachable:', error.message);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}

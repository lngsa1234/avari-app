import { NextResponse } from 'next/server';

/**
 * Cron endpoint to run Circle AI Agent batch jobs
 *
 * Run daily at 9am via Vercel Cron or external scheduler
 * GET /api/cron/agent
 *
 * This endpoint triggers:
 * 1. Batch nudge generation for eligible users
 * 2. Batch event recommendation generation
 */
export async function GET(request) {
  try {
    // Verify cron secret (for security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Cron] Unauthorized cron attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const results = {
      timestamp: new Date().toISOString(),
      nudges: null,
      eventRecommendations: null,
      errors: []
    };

    // Run batch jobs in parallel
    const [nudgeResult, eventRecResult] = await Promise.allSettled([
      // Batch nudges
      fetch(`${baseUrl}/api/agent/nudges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: true })
      }).then(r => r.json()),

      // Batch event recommendations
      fetch(`${baseUrl}/api/agent/event-recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: true })
      }).then(r => r.json())
    ]);

    // Process results
    if (nudgeResult.status === 'fulfilled') {
      results.nudges = nudgeResult.value;
    } else {
      results.errors.push({ job: 'nudges', error: nudgeResult.reason?.message || 'Unknown error' });
    }

    if (eventRecResult.status === 'fulfilled') {
      results.eventRecommendations = eventRecResult.value;
    } else {
      results.errors.push({ job: 'eventRecommendations', error: eventRecResult.reason?.message || 'Unknown error' });
    }

    console.log('[Cron] Agent batch completed:', results);

    return NextResponse.json({
      success: results.errors.length === 0,
      ...results
    });
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Cron job failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Allow POST as well (for manual triggers)
 */
export async function POST(request) {
  return GET(request);
}

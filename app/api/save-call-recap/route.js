import { NextResponse } from 'next/server';
import { authenticateRequest, createAdminClient } from '@/lib/apiAuth';

const TRANSCRIPT_BUCKET = 'call-transcripts';

/**
 * Server-authoritative recap save/merge.
 * Uses service role to bypass RLS — guarantees one recap per channel_name.
 *
 * If a recap already exists for the channel, merges transcripts and participant IDs.
 * If not, creates a new one.
 *
 * POST /api/save-call-recap
 */
export async function POST(request) {
  try {
    const { user, response } = await authenticateRequest(request);
    if (!user) return response;

    const body = await request.json();
    const {
      channelName, callType, provider,
      startedAt, endedAt,
      participantIds = [], transcript = [],
      aiSummary = null, metrics = {},
      scheduledDate = null, scheduledTime = null, scheduledDuration = null,
    } = body;

    if (!channelName) {
      return NextResponse.json({ error: 'Missing channelName' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check transcript consent before saving
    // Don't trust client-supplied callType. Use consent row presence as signal.
    let allowTranscript = true;
    const { data: consentRow } = await supabase
      .from('call_consent')
      .select('status')
      .eq('channel_name', channelName)
      .maybeSingle();

    if (consentRow && consentRow.status !== 'accepted') {
      // Consent exists but was not accepted — strip transcript
      allowTranscript = false;
    }
    // If no consent row exists: allow transcript (backwards compat, group calls)

    const filteredTranscript = allowTranscript ? transcript : [];

    // Check for existing recap for this channel (no longer fetch transcript from DB)
    const { data: existing, error: fetchError } = await supabase
      .from('call_recaps')
      .select('id, transcript_path, started_at, participant_ids')
      .eq('channel_name', channelName)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[SaveCallRecap] Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Clamp times to scheduled window
    const clamped = clampToSchedule(
      existing ? earlierDate(existing.started_at, startedAt) : startedAt,
      endedAt,
      scheduledDate, scheduledTime, scheduledDuration
    );

    const storagePath = `recaps/${channelName}.json`;

    if (existing) {
      // Merge transcripts via storage
      let oldTranscript = [];
      let oldAiSummary = null;

      if (existing.transcript_path) {
        // Read existing transcript from storage
        const { data: fileData, error: dlError } = await supabase.storage
          .from(TRANSCRIPT_BUCKET)
          .download(existing.transcript_path);
        if (!dlError && fileData) {
          try {
            const parsed = JSON.parse(await fileData.text());
            oldTranscript = parsed.transcript || [];
            oldAiSummary = parsed.aiSummary || null;
          } catch (e) {
            console.error('[SaveCallRecap] Error parsing storage file:', e);
          }
        }
      }

      // Deduplicate by timestamp + text
      const seen = new Set(oldTranscript.map(e => `${e.timestamp}|${e.text}`));
      const newEntries = filteredTranscript.filter(e => !seen.has(`${e.timestamp}|${e.text}`));
      const mergedTranscript = [...oldTranscript, ...newEntries]
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      const mergedParticipantIds = [...new Set([
        ...(existing.participant_ids || []),
        ...participantIds,
      ])];

      // Upload merged transcript + summary to storage
      const storagePayload = {
        transcript: mergedTranscript,
        aiSummary: (aiSummary !== undefined && aiSummary !== null) ? aiSummary : oldAiSummary,
      };
      const { error: uploadError } = await supabase.storage
        .from(TRANSCRIPT_BUCKET)
        .upload(storagePath, JSON.stringify(storagePayload), {
          contentType: 'application/json',
          upsert: true,
        });

      if (uploadError) {
        console.error('[SaveCallRecap] Storage upload error:', uploadError);
        return NextResponse.json({ error: 'Failed to save transcript to storage' }, { status: 500 });
      }

      const updateFields = {
        ended_at: clamped.clampedEnd,
        duration_seconds: clamped.durationSeconds,
        participant_count: mergedParticipantIds.length,
        participant_ids: mergedParticipantIds,
        transcript_path: storagePath,
        transcript: [],
        ai_summary: null,
      };

      const { data, error } = await supabase
        .from('call_recaps')
        .update(updateFields)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[SaveCallRecap] Update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    // No existing recap — create new one
    // Upload transcript + summary to storage
    const storagePayload = {
      transcript: filteredTranscript,
      aiSummary: aiSummary || null,
    };
    const { error: uploadError } = await supabase.storage
      .from(TRANSCRIPT_BUCKET)
      .upload(storagePath, JSON.stringify(storagePayload), {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      console.error('[SaveCallRecap] Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to save transcript to storage' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('call_recaps')
      .insert({
        channel_name: channelName,
        call_type: callType,
        provider,
        started_at: clamped.clampedStart,
        ended_at: clamped.clampedEnd,
        duration_seconds: clamped.durationSeconds,
        participant_count: participantIds.length,
        participant_ids: participantIds,
        transcript: [],
        transcript_path: storagePath,
        ai_summary: null,
        metrics,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[SaveCallRecap] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[SaveCallRecap] Error:', error);
    return NextResponse.json({ error: 'Failed to save recap' }, { status: 500 });
  }
}

function earlierDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) < new Date(b) ? a : b;
}

function clampToSchedule(startedAt, endedAt, scheduledDate, scheduledTime, scheduledDuration) {
  let clampedStart = startedAt ? new Date(startedAt) : null;
  let clampedEnd = endedAt ? new Date(endedAt) : new Date();

  if (scheduledDate && scheduledTime) {
    try {
      const scheduled = new Date(`${scheduledDate}T${scheduledTime}`);
      const durationMin = parseInt(scheduledDuration) || 60;
      const windowStart = new Date(scheduled.getTime() - 10 * 60 * 1000);
      const windowEnd = new Date(scheduled.getTime() + durationMin * 60 * 1000);

      if (clampedStart && clampedStart < windowStart) clampedStart = windowStart;
      if (clampedEnd > windowEnd) clampedEnd = windowEnd;
    } catch (e) {
      // ignore parse error
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

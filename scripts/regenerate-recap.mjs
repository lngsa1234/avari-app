/**
 * Regenerate AI summary for an existing call recap.
 *
 * Usage: node scripts/regenerate-recap.mjs <recap-id>
 *
 * Requires the Next.js dev server running on localhost:3000
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local manually (no dotenv dependency)
const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

const recapId = process.argv[2];
if (!recapId) {
  console.error('Usage: node scripts/regenerate-recap.mjs <recap-id>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log(`Fetching recap ${recapId}...`);

  const { data: recap, error } = await supabase
    .from('call_recaps')
    .select('*')
    .eq('id', recapId)
    .single();

  if (error || !recap) {
    console.error('Failed to fetch recap:', error?.message);
    process.exit(1);
  }

  const transcript = recap.transcript || [];
  console.log(`Found ${transcript.length} transcript entries, ${recap.participant_count} participants`);

  if (transcript.length === 0) {
    console.error('No transcript data to summarize');
    process.exit(1);
  }

  const durationSeconds = recap.duration_seconds || 0;
  const participants = recap.participant_ids || [];

  // Fetch participant names
  let participantNames = [];
  if (participants.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('name')
      .in('id', participants);
    participantNames = (profiles || []).map(p => p.name).filter(Boolean);
  }

  console.log(`Participants: ${participantNames.join(', ')}`);
  console.log(`Duration: ${Math.floor(durationSeconds / 60)} minutes`);
  console.log('Calling /api/generate-recap-summary...');

  const response = await fetch('http://localhost:3000/api/generate-recap-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      messages: [],
      participants: participantNames,
      duration: durationSeconds,
      meetingTitle: null,
      meetingType: recap.call_type === '1on1' ? '1:1 coffee chat' : 'circle meeting',
    }),
  });

  if (!response.ok) {
    console.error('API error:', response.status, await response.text());
    process.exit(1);
  }

  const summaryData = await response.json();
  console.log('\nGenerated summary:', summaryData.summary?.substring(0, 200));

  // Build full summary text
  let fullSummaryText = summaryData.summary || '';
  if (summaryData.keyTakeaways?.length > 0) {
    fullSummaryText += '\n\nKey Takeaways:\n';
    summaryData.keyTakeaways.forEach(t => {
      const text = typeof t === 'string' ? t : (t.text || t);
      const emoji = typeof t === 'object' && t.emoji ? t.emoji + ' ' : '• ';
      fullSummaryText += `${emoji}${text}\n`;
    });
  }
  if (summaryData.actionItems?.length > 0) {
    fullSummaryText += '\nAction Items:\n';
    summaryData.actionItems.forEach(a => {
      const text = typeof a === 'string' ? a : (a.text || a);
      fullSummaryText += `• ${text}\n`;
    });
  }

  // Update the recap
  const { error: updateError } = await supabase
    .from('call_recaps')
    .update({ ai_summary: fullSummaryText.trim() })
    .eq('id', recapId);

  if (updateError) {
    console.error('Failed to update recap:', updateError.message);
    process.exit(1);
  }

  console.log('\nRecap updated successfully!');
  console.log('Full summary:\n');
  console.log(fullSummaryText);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

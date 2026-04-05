#!/usr/bin/env node
/**
 * Migrate transcript + ai_summary from call_recaps DB columns to Supabase Storage.
 *
 * For each call_recaps row that has transcript or ai_summary data:
 *   1. Uploads a JSON file to the 'call-transcripts' storage bucket
 *   2. Updates the row with transcript_path and nulls out transcript + ai_summary
 *
 * Storage file format: { transcript: [...], aiSummary: "..." }
 * Storage path: recaps/{channel_name}.json
 *
 * Prerequisites:
 *   - Create 'call-transcripts' bucket in Supabase dashboard (private, no public access)
 *   - Set env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/migrate-transcripts-to-storage.mjs
 *   node scripts/migrate-transcripts-to-storage.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local manually (no dotenv dependency)
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch (e) {
  // .env.local not found — rely on existing env vars
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'call-transcripts';
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log(`🔄 Migrating transcripts to storage bucket "${BUCKET}"...`);
  if (DRY_RUN) console.log('  (DRY RUN — no changes will be made)\n');

  // Fetch all recaps that have transcript data or ai_summary
  const { data: recaps, error } = await supabase
    .from('call_recaps')
    .select('id, channel_name, transcript, ai_summary, transcript_path')
    .or('transcript.neq.[],ai_summary.neq.null')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching recaps:', error.message);
    process.exit(1);
  }

  // Filter to only rows that have actual data to migrate
  const toMigrate = (recaps || []).filter(r =>
    !r.transcript_path && (
      (Array.isArray(r.transcript) && r.transcript.length > 0) ||
      (r.ai_summary && r.ai_summary.trim().length > 0)
    )
  );

  console.log(`Found ${recaps?.length || 0} recaps total, ${toMigrate.length} to migrate.\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const recap of toMigrate) {
    const storagePath = `recaps/${recap.channel_name}.json`;
    const payload = {
      transcript: recap.transcript || [],
      aiSummary: recap.ai_summary || null,
    };
    const jsonBlob = JSON.stringify(payload);
    const sizeKB = (jsonBlob.length / 1024).toFixed(1);

    console.log(`  [${migrated + skipped + failed + 1}/${toMigrate.length}] ${recap.channel_name} (${sizeKB} KB)`);

    if (DRY_RUN) {
      console.log(`    → Would upload to ${storagePath}`);
      migrated++;
      continue;
    }

    // Upload to storage (upsert to handle re-runs)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, jsonBlob, {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      console.error(`    ✗ Upload failed: ${uploadError.message}`);
      failed++;
      continue;
    }

    // Update DB row: set path, clear large columns
    const { error: updateError } = await supabase
      .from('call_recaps')
      .update({
        transcript_path: storagePath,
        transcript: [],
        ai_summary: null,
      })
      .eq('id', recap.id);

    if (updateError) {
      console.error(`    ✗ DB update failed: ${updateError.message}`);
      failed++;
      continue;
    }

    console.log(`    ✓ Migrated → ${storagePath}`);
    migrated++;
  }

  console.log(`\nDone! Migrated: ${migrated}, Skipped: ${skipped}, Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nRe-run the script to retry failed items.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

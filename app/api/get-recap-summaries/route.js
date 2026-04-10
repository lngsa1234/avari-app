import { NextResponse } from 'next/server';
import { authenticateRequest, createAdminClient } from '@/lib/apiAuth';

const TRANSCRIPT_BUCKET = 'call-transcripts';

/**
 * Batch-fetch AI summaries from Supabase Storage.
 * Returns only the aiSummary field (not the full transcript) for each path.
 *
 * POST /api/get-recap-summaries
 * Body: { paths: ["recaps/channel1.json", "recaps/channel2.json", ...] }
 * Response: { summaries: { "recaps/channel1.json": "{...}", "recaps/channel2.json": null } }
 */
export async function POST(request) {
  try {
    const { user, response } = await authenticateRequest(request);
    if (!user) return response;

    const { paths } = await request.json();

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ summaries: {} });
    }

    // Validate all paths
    const validPaths = paths.filter(p =>
      typeof p === 'string' && p.startsWith('recaps/') && !p.includes('..')
    );

    const supabase = createAdminClient();

    // Download all files in parallel
    const results = await Promise.all(
      validPaths.map(async (path) => {
        try {
          const { data, error } = await supabase.storage
            .from(TRANSCRIPT_BUCKET)
            .download(path);

          if (error || !data) return { path, aiSummary: null };

          const parsed = JSON.parse(await data.text());
          return { path, aiSummary: parsed.aiSummary || null };
        } catch {
          return { path, aiSummary: null };
        }
      })
    );

    const summaries = {};
    results.forEach(r => { summaries[r.path] = r.aiSummary; });

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error('[GetRecapSummaries] Error:', error);
    return NextResponse.json({ summaries: {} });
  }
}

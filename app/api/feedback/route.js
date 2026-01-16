import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client inside functions to ensure env vars are available
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(url, key);
}

/**
 * POST /api/feedback - Submit user feedback
 */
export async function POST(request) {
  try {
    const { userId, category, subject, message, pageContext, rating } = await request.json();

    // Validate required fields
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    if (!category || !['bug', 'feature', 'improvement', 'other'].includes(category)) {
      return NextResponse.json({ error: 'Valid category is required' }, { status: 400 });
    }
    if (!subject || subject.length < 3 || subject.length > 200) {
      return NextResponse.json({ error: 'Subject must be 3-200 characters' }, { status: 400 });
    }
    if (!message || message.length < 10 || message.length > 5000) {
      return NextResponse.json({ error: 'Message must be 10-5000 characters' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Insert feedback
    const { data, error } = await supabase
      .from('user_feedback')
      .insert({
        user_id: userId,
        category,
        subject,
        message,
        page_context: pageContext || null,
        rating: rating || null,
        status: 'new'
      })
      .select()
      .single();

    if (error) {
      console.error('[Feedback] Error inserting:', error);
      // Check if it's a table doesn't exist error
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          error: 'Feedback system not yet configured. Please run the database migration.'
        }, { status: 503 });
      }
      return NextResponse.json({ error: 'Failed to submit feedback: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, feedback: data });
  } catch (error) {
    console.error('[Feedback] Error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

/**
 * GET /api/feedback - Get feedback (admin only gets all, users get their own)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isAdmin = searchParams.get('isAdmin') === 'true';
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseClient();

    let query = supabase
      .from('user_feedback')
      .select(`
        *,
        user:profiles!user_feedback_user_id_fkey(id, name, email, profile_picture),
        reviewer:profiles!user_feedback_reviewed_by_fkey(id, name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by user if not admin
    if (!isAdmin && userId) {
      query = query.eq('user_id', userId);
    }

    // Optional filters
    if (status) {
      query = query.eq('status', status);
    }
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[Feedback] Error fetching:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ feedback: [], total: 0, message: 'Feedback table not yet created' });
      }
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
    }

    return NextResponse.json({ feedback: data || [], total: count || 0 });
  } catch (error) {
    console.error('[Feedback] Error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/feedback - Update feedback status (admin only)
 */
export async function PATCH(request) {
  try {
    const { feedbackId, status, adminNotes, reviewedBy } = await request.json();

    if (!feedbackId) {
      return NextResponse.json({ error: 'Feedback ID is required' }, { status: 400 });
    }

    const updateData = {};
    if (status) {
      if (!['new', 'reviewed', 'in_progress', 'resolved', 'closed'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = status;
    }
    if (adminNotes !== undefined) {
      updateData.admin_notes = adminNotes;
    }
    if (reviewedBy) {
      updateData.reviewed_by = reviewedBy;
      updateData.reviewed_at = new Date().toISOString();
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_feedback')
      .update(updateData)
      .eq('id', feedbackId)
      .select()
      .single();

    if (error) {
      console.error('[Feedback] Error updating:', error);
      return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true, feedback: data });
  } catch (error) {
    console.error('[Feedback] Error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

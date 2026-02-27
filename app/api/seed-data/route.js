import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'lngsa.wang@gmail.com';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase configuration');
  return createClient(url, key);
}

const CIRCLES = [
  {
    name: 'Women in Tech Leadership',
    meeting_day: 'Tuesday',
    cadence: 'Weekly',
    time_of_day: '7:00 PM',
    max_members: 12,
    location: 'Virtual',
    description: 'A supportive space for women navigating leadership roles in tech. Share wins, challenges, and strategies for career growth.',
    vibe_category: 'grow',
  },
  {
    name: 'Startup Founders Roundtable',
    meeting_day: 'Thursday',
    cadence: 'Biweekly',
    time_of_day: '6:00 PM',
    max_members: 10,
    location: 'Virtual',
    description: 'Early-stage founders sharing lessons learned, brainstorming solutions, and holding each other accountable.',
    vibe_category: 'advice',
  },
  {
    name: 'Creative Side Projects',
    meeting_day: 'Saturday',
    cadence: 'Weekly',
    time_of_day: '10:00 AM',
    max_members: 15,
    location: 'Virtual',
    description: 'Designers, writers, and makers working on passion projects. Show progress, get feedback, and stay motivated.',
    vibe_category: 'grow',
  },
  {
    name: 'Career Changers Support',
    meeting_day: 'Wednesday',
    cadence: 'Weekly',
    time_of_day: '8:00 PM',
    max_members: 12,
    location: 'Virtual',
    description: 'Transitioning to a new career? Share your journey, get advice, and connect with others making the leap.',
    vibe_category: 'advice',
  },
  {
    name: 'Mindful Professionals',
    meeting_day: 'Monday',
    cadence: 'Weekly',
    time_of_day: '7:30 AM',
    max_members: 10,
    location: 'Virtual',
    description: 'Start the week with intention. Meditation, journaling prompts, and open discussion about work-life balance.',
    vibe_category: 'vent',
  },
  {
    name: 'Product Builders Club',
    meeting_day: 'Wednesday',
    cadence: 'Weekly',
    time_of_day: '12:00 PM',
    max_members: 12,
    location: 'Virtual',
    description: 'PMs, designers, and engineers discussing product strategy, user research, and building things people love.',
    vibe_category: 'grow',
  },
  {
    name: 'Freelancer Accountability',
    meeting_day: 'Friday',
    cadence: 'Weekly',
    time_of_day: '9:00 AM',
    max_members: 8,
    location: 'Virtual',
    description: 'Solo workers checking in weekly — share goals, celebrate wins, and troubleshoot business challenges together.',
    vibe_category: 'grow',
  },
  {
    name: 'Parents in Tech',
    meeting_day: 'Thursday',
    cadence: 'Biweekly',
    time_of_day: '8:30 PM',
    max_members: 12,
    location: 'Virtual',
    description: 'Balancing parenting and a tech career. A judgment-free zone to vent, share tips, and support each other.',
    vibe_category: 'vent',
  },
  {
    name: 'AI & Machine Learning Explorers',
    meeting_day: 'Tuesday',
    cadence: 'Weekly',
    time_of_day: '6:30 PM',
    max_members: 15,
    location: 'Virtual',
    description: 'Discussing the latest in AI — papers, tools, projects, and ethical implications. All experience levels welcome.',
    vibe_category: 'grow',
  },
  {
    name: 'Book Club for Builders',
    meeting_day: 'Sunday',
    cadence: 'Monthly',
    time_of_day: '4:00 PM',
    max_members: 20,
    location: 'Virtual',
    description: 'Reading and discussing books on business, design, psychology, and creativity. One book per month, deep conversations.',
    vibe_category: 'advice',
  },
];

const TRENDING_REQUESTS = [
  {
    topic: 'How to negotiate a raise in tech',
    description: 'Looking for people who have successfully negotiated significant salary increases. What worked, what didn\'t, and how to prepare.',
    vibe_category: 'advice',
    supporter_count: 47,
  },
  {
    topic: 'Dealing with burnout as a founder',
    description: 'Need a safe space to talk about the mental health challenges of running a startup. How do you keep going when it gets tough?',
    vibe_category: 'vent',
    supporter_count: 38,
  },
  {
    topic: 'Building a personal brand on LinkedIn',
    description: 'Want to learn strategies for growing professional visibility on LinkedIn. Content ideas, posting frequency, and engagement tactics.',
    vibe_category: 'grow',
    supporter_count: 34,
  },
  {
    topic: 'Transitioning from IC to management',
    description: 'Just got promoted to engineering manager. Looking for advice on the transition — what to expect and common mistakes to avoid.',
    vibe_category: 'advice',
    supporter_count: 31,
  },
  {
    topic: 'Remote work productivity hacks',
    description: 'Working from home and struggling with focus. Want to hear what routines, tools, and environments help others stay productive.',
    vibe_category: 'grow',
    supporter_count: 28,
  },
  {
    topic: 'Navigating layoffs and job searching',
    description: 'Recently laid off and feeling lost. Would love to connect with others going through the same thing for support and job search tips.',
    vibe_category: 'vent',
    supporter_count: 42,
  },
  {
    topic: 'Side project to revenue: first $1K MRR',
    description: 'Has anyone taken a side project and turned it into a revenue-generating product? Share your journey to the first $1K in monthly recurring revenue.',
    vibe_category: 'grow',
    supporter_count: 36,
  },
  {
    topic: 'Imposter syndrome in senior roles',
    description: 'The higher I climb, the more I feel like I don\'t belong. Looking for honest conversations about imposter syndrome at senior/exec levels.',
    vibe_category: 'vent',
    supporter_count: 44,
  },
  {
    topic: 'Best practices for async team communication',
    description: 'Managing a distributed team across time zones. Want to discuss tools, processes, and cultural norms that make async work actually work.',
    vibe_category: 'advice',
    supporter_count: 25,
  },
  {
    topic: 'Learning AI/ML as a non-technical professional',
    description: 'I\'m in marketing/ops and want to understand AI well enough to leverage it. What resources and learning paths do you recommend?',
    vibe_category: 'grow',
    supporter_count: 33,
  },
];

/**
 * POST /api/seed-data - Create sample circles and trending requests
 * Looks up the Admin user (lngsa.wang@gmail.com) and uses them as creator/host
 */
export async function POST() {
  try {
    const supabase = getSupabaseClient();

    // Look up Admin user by email
    const { data: adminUser, error: userError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (userError || !adminUser) {
      // Fallback: try auth.users via admin API
      const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) {
        return NextResponse.json({ error: 'Failed to look up admin user', details: authError.message }, { status: 500 });
      }
      const foundUser = users?.find(u => u.email === ADMIN_EMAIL);
      if (!foundUser) {
        return NextResponse.json({ error: `Admin user not found: ${ADMIN_EMAIL}` }, { status: 404 });
      }
      var userId = foundUser.id;
      var userName = foundUser.user_metadata?.full_name || 'Admin';
    } else {
      var userId = adminUser.id;
      var userName = adminUser.full_name || 'Admin';
    }

    console.log(`Seeding data with admin user: ${userName} (${userId})`);

    // Insert circles
    const circleRows = CIRCLES.map((c) => ({ ...c, creator_id: userId }));
    const { data: circles, error: circlesError } = await supabase
      .from('connection_groups')
      .insert(circleRows)
      .select('id, name');

    if (circlesError) {
      console.error('Error inserting circles:', circlesError);
      return NextResponse.json({ error: 'Failed to insert circles', details: circlesError.message }, { status: 500 });
    }

    // Add admin as accepted member of each circle
    if (circles?.length) {
      const memberRows = circles.map((c) => ({
        group_id: c.id,
        user_id: userId,
        status: 'accepted',
      }));
      const { error: membersError } = await supabase
        .from('connection_group_members')
        .insert(memberRows);

      if (membersError) {
        console.error('Error adding circle members:', membersError);
      }
    }

    // Insert trending requests
    const requestRows = TRENDING_REQUESTS.map((r) => ({
      ...r,
      user_id: userId,
      status: 'open',
    }));
    const { data: requests, error: requestsError } = await supabase
      .from('meetup_requests')
      .insert(requestRows)
      .select('id, topic');

    if (requestsError) {
      console.error('Error inserting requests:', requestsError);
      return NextResponse.json(
        { error: 'Failed to insert trending requests', details: requestsError.message, circles },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      adminUser: { id: userId, name: userName },
      circles: circles || [],
      trendingRequests: requests || [],
    });
  } catch (err) {
    console.error('Seed data error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

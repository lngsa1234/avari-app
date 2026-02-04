# Circle AI Agent

An intelligent agent system for CircleW that provides personalized recommendations and engagement nudges.

## Overview

The Circle AI Agent consists of 4 skills:

1. **Icebreaker Generator** - Creates conversation starters for meetups
2. **Circle Matcher** - Matches users to relevant circles/groups
3. **Personalized Nudges** - Sends engagement prompts to users
4. **Event Recommendations** - Suggests relevant public events

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CIRCLE AI AGENT SYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐    │
│  │  Icebreaker  │   │    Circle    │   │   Event              │    │
│  │   Generator  │   │   Matcher    │   │   Recommendations    │    │
│  └──────────────┘   └──────────────┘   └──────────────────────┘    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Personalized Nudges                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│         ┌─────────────┬─────────────┬─────────────┐                │
│         │   Rule      │  Light AI   │   Full AI   │                │
│         │   Engine    │  (Haiku)    │  (Sonnet)   │                │
│         │   (FREE)    │  (~$0.001)  │  (~$0.01)   │                │
│         └─────────────┴─────────────┴─────────────┘                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Run Database Migration

Execute the SQL migration in your Supabase SQL editor:

```bash
# File: database-migration-circle-agent.sql
```

This creates the following tables:
- `meetup_icebreakers` - Cached icebreaker questions
- `user_nudges` - User engagement prompts
- `circle_match_scores` - User-circle match scores
- `event_recommendations` - Personalized event suggestions
- `agent_executions` - Cost tracking and analytics

### 2. Environment Variables

Add these to your `.env.local`:

```env
# Required (already have)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Provider (at least one required for AI features)
ANTHROPIC_API_KEY=your_anthropic_key  # Recommended - uses Haiku
OPENAI_API_KEY=your_openai_key        # Fallback - uses GPT-4o-mini

# Cron Security (optional but recommended)
CRON_SECRET=your_random_secret_string

# App URL (for cron callbacks)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 3. Deploy to Vercel

The `vercel.json` includes cron configuration:

```json
{
  "crons": [
    {
      "path": "/api/cron/agent",
      "schedule": "0 9 * * *"
    }
  ]
}
```

This runs the agent batch jobs daily at 9am UTC.

## API Endpoints

### Icebreakers

```
POST /api/agent/icebreakers
Body: { meetupId, title, description, attendees }

GET /api/agent/icebreakers?meetupId=xxx
```

### Circle Matching

```
POST /api/agent/circle-match
Body: { userId }

GET /api/agent/circle-match?userId=xxx
```

### Nudges

```
POST /api/agent/nudges
Body: { userId } OR { batch: true }

GET /api/agent/nudges?userId=xxx

PATCH /api/agent/nudges
Body: { nudgeId, status }
```

### Event Recommendations

```
POST /api/agent/event-recommendations
Body: { userId } OR { batch: true }

GET /api/agent/event-recommendations?userId=xxx

PATCH /api/agent/event-recommendations
Body: { recId, status }
```

### Cron (Batch Processing)

```
GET /api/cron/agent
Header: Authorization: Bearer {CRON_SECRET}
```

## Components

### NudgeBanner

Displays personalized nudges to users:

```jsx
import NudgeBanner from '@/components/NudgeBanner';

// In your page/layout
<NudgeBanner className="mb-4" />
```

### EventRecommendations

Shows AI-powered event recommendations:

```jsx
import EventRecommendations from '@/components/EventRecommendations';

<EventRecommendations
  maxItems={3}
  showRefresh={true}
/>
```

### CircleRecommendations

Displays circle/group recommendations:

```jsx
import CircleRecommendations from '@/components/CircleRecommendations';

<CircleRecommendations
  maxItems={3}
  showRefresh={true}
/>
```

### IcebreakerDisplay

Shows icebreaker questions during meetups:

```jsx
import IcebreakerDisplay from '@/components/IcebreakerDisplay';

<IcebreakerDisplay
  meetupId={meetupId}
  meetupTitle="Tech Networking"
  meetupDescription="A meetup for tech professionals"
  attendees={attendeeProfiles}
/>
```

## Cost Optimization

The agent uses a tiered approach to minimize costs:

| Tier | Description | Cost | Use Case |
|------|-------------|------|----------|
| Rule | Template/algorithm-based | FREE | Simple matches, basic nudges |
| Light AI | Claude Haiku / GPT-4o-mini | ~$0.0003 | Complex matching, icebreakers |
| Full AI | Claude Sonnet / GPT-4 | ~$0.003 | (Reserved for future use) |

### Estimated Monthly Costs

| Skill | Usage | Tier Mix | Monthly Cost |
|-------|-------|----------|--------------|
| Icebreakers | 10/day | 50% rule, 50% light | ~$0.15 |
| Circle Match | 50/day | 80% rule, 20% light | ~$0.30 |
| Nudges | 100/day | 100% rule | $0 |
| Event Recs | 100/day | 90% rule, 10% light | ~$0.15 |
| **Total** | | | **~$0.60/month** |

## Monitoring

### Cost Tracking

The `agent_executions` table logs all agent activity:

```sql
SELECT
  skill,
  tier,
  COUNT(*) as executions,
  SUM(cost_usd) as total_cost
FROM agent_executions
WHERE executed_at > NOW() - INTERVAL '30 days'
GROUP BY skill, tier
ORDER BY total_cost DESC;
```

### Helper Function

```javascript
import { getAgentCostSummary } from '@/lib/agentHelpers';

const summary = await getAgentCostSummary(supabase, 30);
// Returns: { total_cost, by_skill, by_tier, executions }
```

## Extending the Agent

### Adding a New Skill

1. Create API route in `/app/api/agent/[skill-name]/route.js`
2. Add helper functions in `/lib/[skill]Helpers.js`
3. Create frontend component in `/components/[SkillName].js`
4. Add database tables if needed
5. Update cron job if batch processing is required

### Customizing Matching Logic

Edit the scoring functions in each API route:
- `computeRuleBasedMatches()` - Rule-based scoring
- `enhanceWithAI()` / `generateAIMatches()` - AI enhancement

## Files Created

```
/app/api/agent/
  ├── icebreakers/route.js
  ├── circle-match/route.js
  ├── nudges/route.js
  └── event-recommendations/route.js

/app/api/cron/
  └── agent/route.js

/lib/
  ├── agentHelpers.js
  └── eventRecommendationHelpers.js

/components/
  ├── NudgeBanner.js
  ├── EventRecommendations.js
  ├── CircleRecommendations.js
  └── IcebreakerDisplay.js

/docs/
  └── CIRCLE-AI-AGENT.md

database-migration-circle-agent.sql
vercel.json
```

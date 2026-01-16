# Avari - Deployment Guide

**Last Updated:** 2026-01-09

## Table of Contents
1. [Environment Setup](#environment-setup)
2. [Local Development](#local-development)
3. [Database Setup](#database-setup)
4. [Production Build](#production-build)
5. [Deployment Platforms](#deployment-platforms)
6. [Environment Variables](#environment-variables)
7. [Troubleshooting](#troubleshooting)

---

## Environment Setup

### Prerequisites
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Git**: For version control
- **Supabase Account**: For database and auth
- **Agora Account**: For group video calls

### Install Dependencies
```bash
cd avari-app
npm install
```

---

## Local Development

### 1. Clone Repository
```bash
git clone https://github.com/your-org/avari-app.git
cd avari-app
```

### 2. Create Environment File
Create `.env.local` in the root directory:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://vcfcppjbeauxbxnkcgvm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Socket.IO Signaling Server (Required for 1:1 calls)
NEXT_PUBLIC_SIGNALING_SERVER_URL=https://live-chat-demo.onrender.com

# Agora (Required for group video)
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id_here

# Optional: Agora Token Auth (Production)
# AGORA_APP_CERTIFICATE=your_certificate_here

# Optional: Custom STUN/TURN servers
# NEXT_PUBLIC_STUN_SERVER_URL=stun:stun.l.google.com:19302
# NEXT_PUBLIC_TURN_SERVER_URL=turn:your-turn-server.com:3478
# NEXT_PUBLIC_TURN_SERVER_USERNAME=username
# NEXT_PUBLIC_TURN_SERVER_CREDENTIAL=password
```

### 3. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Development Tools

**Hot Reload:** Enabled by default
**React Strict Mode:** Enabled (helps catch bugs)
**TypeScript:** Supported for `.ts` and `.tsx` files

---

## Database Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy Project URL and Anon Key

### 2. Run Migrations

#### Option A: SQL Editor (Recommended)
1. Open Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create new query
4. Copy contents of `database-migration-agora.sql`
5. Click **Run**
6. Repeat for `database-migration-call-messages.sql`

#### Option B: Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### 3. Enable Realtime for call_messages

1. Go to **Database** → **Replication**
2. Find `call_messages` table
3. Toggle **Enable Insert** to ON
4. This allows real-time chat during video calls

### 4. Verify Tables

Run this query in SQL Editor to check all tables exist:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:
- profiles
- meetups
- meetup_signups
- coffee_chats
- messages
- video_rooms
- agora_rooms
- user_interests
- call_messages

---

## Production Build

### Build for Production
```bash
# Install dependencies
npm install

# Build Next.js app
npm run build

# Start production server
npm start
```

### Build Output
```
.next/
├── static/           # Static assets
├── server/           # Server-side code
└── cache/            # Build cache
```

### Build Optimization
- **Tree-shaking**: Unused code removed
- **Code-splitting**: Lazy load pages
- **Image optimization**: Next.js Image component
- **CSS purging**: Unused Tailwind classes removed

### Test Production Build Locally
```bash
npm run build
npm start
# Open http://localhost:3000
```

---

## Deployment Platforms

### Vercel (Recommended)

**Why Vercel:**
- Built by Next.js creators
- Zero configuration
- Automatic deployments on git push
- Edge functions for API routes
- Free tier generous

**Steps:**
1. Push code to GitHub
2. Visit [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repo
5. Add environment variables (see below)
6. Click "Deploy"

**Environment Variables in Vercel:**
1. Go to Project Settings → Environment Variables
2. Add each variable from `.env.local`
3. Set for: Production, Preview, Development
4. Click "Save"

**Custom Domain:**
1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS records as instructed

### Netlify

**Steps:**
1. Push code to GitHub
2. Visit [netlify.com](https://netlify.com)
3. Click "New site from Git"
4. Select your repo
5. Build command: `npm run build`
6. Publish directory: `.next`
7. Add environment variables
8. Click "Deploy"

### Railway

**Steps:**
1. Visit [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repo
4. Railway auto-detects Next.js
5. Add environment variables
6. Deploy

### Self-Hosted (Docker)

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy app files
COPY . .

# Build
RUN npm run build

# Expose port
EXPOSE 3000

# Start
CMD ["npm", "start"]
```

**Build and Run:**
```bash
docker build -t avari-app .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e NEXT_PUBLIC_AGORA_APP_ID=... \
  avari-app
```

---

## Environment Variables

### Required Variables

**NEXT_PUBLIC_SUPABASE_URL**
- Supabase project URL
- Format: `https://[project-ref].supabase.co`
- Find: Supabase Dashboard → Settings → API → Project URL

**NEXT_PUBLIC_SUPABASE_ANON_KEY**
- Supabase anonymous key (public, safe to expose)
- Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Find: Supabase Dashboard → Settings → API → anon/public

**NEXT_PUBLIC_AGORA_APP_ID**
- Agora App ID for video calls
- Format: 32-character hex string
- Find: Agora Console → Project Management → App ID

**NEXT_PUBLIC_SIGNALING_SERVER_URL**
- Socket.IO server for WebRTC signaling
- Default: `https://live-chat-demo.onrender.com`
- Can self-host if needed

### Optional Variables

**AGORA_APP_CERTIFICATE**
- For token-based authentication (production)
- Keep secret (server-side only, no `NEXT_PUBLIC_` prefix)
- Find: Agora Console → Project Management → App Certificate

**STUN/TURN Servers (WebRTC)**
- `NEXT_PUBLIC_STUN_SERVER_URL`: STUN server URL
- `NEXT_PUBLIC_TURN_SERVER_URL`: TURN server URL
- `NEXT_PUBLIC_TURN_SERVER_USERNAME`: TURN username
- `NEXT_PUBLIC_TURN_SERVER_CREDENTIAL`: TURN password
- Default: Google STUN servers (free, public)

---

## Troubleshooting

### Build Errors

**Error: "Module not found"**
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run build
```

**Error: "Out of memory"**
```bash
# Increase Node.js memory
NODE_OPTIONS=--max_old_space_size=4096 npm run build
```

### Runtime Errors

**"Supabase client not initialized"**
- Check `NEXT_PUBLIC_SUPABASE_URL` is set
- Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
- Verify environment variables in deployment platform

**"Agora connection failed"**
- Check `NEXT_PUBLIC_AGORA_APP_ID` is correct
- Verify Agora project is not in secured mode (or provide token)
- Check browser console for detailed error

**"Could not connect to signaling server"**
- Check `NEXT_PUBLIC_SIGNALING_SERVER_URL` is accessible
- Try default: `https://live-chat-demo.onrender.com`
- Check network/firewall settings

### Database Issues

**"Permission denied for table"**
- Check Row Level Security (RLS) policies
- Verify user is authenticated
- Check policy allows operation

**"Relation does not exist"**
- Run database migrations
- Check table names match schema
- Verify Supabase project is correct

### Video Call Issues

**"Camera/microphone access denied"**
- Grant browser permissions
- Check HTTPS (required for getUserMedia)
- Try different browser

**"WebRTC connection timeout"**
- Check STUN/TURN server configuration
- Verify firewall allows UDP traffic
- Try from different network

**"Agora join failed"**
- Check App ID is correct
- Verify channel name is valid (alphanumeric + dashes)
- Check Agora project status (not expired)

### Performance Issues

**Slow page load**
- Check Next.js build is optimized
- Verify CDN caching is enabled
- Check database query performance
- Use Vercel Analytics to identify bottlenecks

**High memory usage**
- Check for memory leaks in useEffect
- Ensure subscriptions are cleaned up
- Verify video streams are stopped on unmount

---

## Post-Deployment Checklist

- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Google OAuth configured (redirect URIs)
- [ ] Agora project active
- [ ] HTTPS enabled (required)
- [ ] Custom domain configured (optional)
- [ ] Error tracking setup (Sentry, etc.)
- [ ] Analytics setup (Vercel, Google Analytics)
- [ ] Backup strategy configured
- [ ] Monitoring alerts configured

---

## Monitoring & Analytics

### Recommended Tools

**Application Performance:**
- Vercel Analytics (built-in)
- Google Analytics
- Plausible (privacy-friendly)

**Error Tracking:**
- Sentry
- Bugsnag
- Rollbar

**Database Monitoring:**
- Supabase Dashboard (built-in metrics)
- Query performance logs

**Video Quality:**
- Agora Analytics Dashboard
- Call quality reports

---

**See also:**
- [Architecture](./ARCHITECTURE.md)
- [API Integrations](./API_INTEGRATIONS.md)

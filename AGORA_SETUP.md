# Agora Integration Setup Guide

This guide will help you integrate Agora video calling into your Avari app for hybrid group meetups.

## Overview

- **1:1 Coffee Chats**: Uses WebRTC (existing implementation in `/app/meeting/[id]/page.js`)
- **Group Meetups**: Uses Agora SDK for hybrid meetups (new implementation in `/app/group-meeting/[id]/page.js`)

## Step 1: Get Agora Credentials

1. **Sign up for Agora**
   - Go to [https://console.agora.io/](https://console.agora.io/)
   - Create a free account

2. **Create a New Project**
   - Click "Projects" in the left sidebar
   - Click "Create" button
   - Give your project a name (e.g., "Avari Meetups")
   - Choose "Secured mode: APP ID + Token" for authentication mode (recommended for production)
   - For development, you can use "Testing mode: APP ID" (simpler setup)

3. **Get Your App ID**
   - After creating the project, you'll see your **App ID**
   - Copy this - you'll need it in the next step

## Step 2: Configure Environment Variables

1. **Create or update `.env.local`** in your project root:

```bash
# Add this to your .env.local file
NEXT_PUBLIC_AGORA_APP_ID=your_app_id_here
```

2. **Replace `your_app_id_here`** with the App ID you copied from Agora Console

3. **Restart your development server**:
```bash
npm run dev
```

## Step 3: Run Database Migration

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Click "SQL Editor" in the left sidebar

2. **Run the migration SQL**
   - Open the file `database-migration-agora.sql` in your project
   - Copy the entire SQL content
   - Paste it into the Supabase SQL Editor
   - Click "Run" to execute the migration

3. **Verify the tables were created**
   - Go to "Table Editor" in Supabase
   - You should see a new table called `agora_rooms`
   - The `meetups` table should have a new column `agora_link`

## Step 4: Test the Integration

1. **Create or sign up for a meetup** as an admin or user

2. **Sign up for the meetup** to see the hybrid options

3. **Click "Join Video Call"** to test the Agora video functionality

4. **Expected behavior**:
   - Should create an Agora room for the meetup
   - Should redirect you to `/group-meeting/meetup-[id]`
   - Should request camera/microphone permissions
   - Should show your video feed
   - Other participants can join by clicking the same button

## Architecture

### Video Call Routing

```
1:1 Coffee Chats (WebRTC)
├── Route: /meeting/[id]
├── Component: app/meeting/[id]/page.js
├── Database: video_rooms table
└── Use case: Private 1:1 video chats

Group Meetups (Agora)
├── Route: /group-meeting/[id]
├── Component: app/group-meeting/[id]/page.js
├── Hook: hooks/useAgora.js
├── Helpers: lib/agoraHelpers.js
├── Database: agora_rooms table
└── Use case: Hybrid meetups (3+ people, in-person OR video)
```

### How it Works

1. **Meetup Created**: Admin creates a meetup with date, time, and location
2. **User Signs Up**: Users sign up for the meetup
3. **Hybrid Options Shown**: Users see two options:
   - **In-Person**: Attend at the physical location
   - **Video Call**: Join remotely via Agora
4. **Video Room Created**: When first user clicks "Join Video Call":
   - System creates an Agora room in the database
   - Channel name format: `meetup-{meetupId}`
   - Room link is saved to meetup record
5. **Participants Join**: Other users can join the same video room
6. **Multi-participant Support**: Agora handles up to 17 participants in grid view

## Features

### Group Video Call Features

- ✅ **Grid View**: See all participants in a grid (up to 16 remote + you)
- ✅ **Speaker View**: Main speaker + thumbnail strip
- ✅ **Mute/Unmute**: Toggle microphone
- ✅ **Camera On/Off**: Toggle video
- ✅ **Participant Count**: See how many people are in the call
- ✅ **Auto Audio**: Remote audio plays automatically
- ✅ **Responsive Layout**: Adapts to 1-17 participants

### Hybrid Meetup Features

- ✅ **Dual Attendance Options**: In-person OR video
- ✅ **Location Display**: Shows meetup location
- ✅ **Video Link**: One-click join for video participants
- ✅ **Participant Preview**: See who's signed up 12 hours before
- ✅ **Cancellation**: Can cancel signup anytime

## Agora Free Tier Limits

Agora provides a generous free tier:
- **10,000 minutes/month** free
- Perfect for small communities
- No credit card required for testing

## Production Setup (Optional - For Token Authentication)

For production, you should enable token authentication for better security:

1. **Enable App Certificate** in Agora Console
2. **Install token builder**:
   ```bash
   npm install agora-access-token
   ```

3. **Create token API route** (`app/api/agora-token/route.js`):
   ```javascript
   import { NextResponse } from 'next/server';
   import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

   export async function POST(request) {
     const { channelName, uid } = await request.json();

     const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
     const appCertificate = process.env.AGORA_APP_CERTIFICATE;

     const role = RtcRole.PUBLISHER;
     const expirationTimeInSeconds = 3600;
     const currentTimestamp = Math.floor(Date.now() / 1000);
     const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

     const token = RtcTokenBuilder.buildTokenWithUid(
       appId,
       appCertificate,
       channelName,
       uid,
       role,
       privilegeExpiredTs
     );

     return NextResponse.json({ token });
   }
   ```

4. **Add to `.env.local`**:
   ```bash
   AGORA_APP_CERTIFICATE=your_app_certificate_here
   ```

5. **Update `useAgora` hook** to fetch and use tokens before joining

## Troubleshooting

### Camera/Microphone Not Working

- **Check browser permissions**: Make sure you've allowed camera/mic access
- **Use HTTPS**: Agora requires HTTPS in production (localhost is fine for dev)
- **Check console**: Look for error messages in browser console

### "Agora App ID not configured" Error

- Make sure `NEXT_PUBLIC_AGORA_APP_ID` is in your `.env.local`
- Restart your Next.js server after adding environment variables
- Verify the variable name has the `NEXT_PUBLIC_` prefix

### Room Not Creating

- Check Supabase database migration ran successfully
- Verify `agora_rooms` table exists
- Check browser console for errors
- Ensure user is authenticated

### Video Not Showing

- Check that local video is playing in the local video container
- For remote videos, check the `remoteUsers` state in console
- Verify Agora credentials are correct

## File Structure

```
avari-app/
├── app/
│   ├── group-meeting/
│   │   └── [id]/
│   │       └── page.js          # Group video meeting UI (Agora)
│   └── meeting/
│       └── [id]/
│           └── page.js          # 1:1 video meeting UI (WebRTC)
├── components/
│   └── MainApp.js               # Updated with hybrid meetup UI
├── hooks/
│   └── useAgora.js              # Agora React hook
├── lib/
│   └── agoraHelpers.js          # Agora room management
├── database-migration-agora.sql # Database schema
├── .env.local                   # Environment variables (create this)
└── AGORA_SETUP.md              # This file
```

## Next Steps

1. ✅ Complete database migration
2. ✅ Add Agora App ID to `.env.local`
3. ✅ Restart your dev server
4. ✅ Test creating and joining a group video meetup
5. 🎯 (Optional) Set up token authentication for production
6. 🎯 (Optional) Customize video UI to match your branding
7. 🎯 (Optional) Add screen sharing feature
8. 🎯 (Optional) Add call recording

## Support

- **Agora Docs**: [https://docs.agora.io/](https://docs.agora.io/)
- **Agora Support**: [https://agora-ticket.agora.io/](https://agora-ticket.agora.io/)
- **Community**: [https://stackoverflow.com/questions/tagged/agora.io](https://stackoverflow.com/questions/tagged/agora.io)

## Summary

You now have:
- ✅ Agora SDK installed
- ✅ Custom React hook for Agora calls
- ✅ Group video meeting page with grid/speaker views
- ✅ Hybrid meetup UI (in-person + video options)
- ✅ Database schema for Agora rooms
- ✅ 1:1 calls still using WebRTC
- ✅ Group calls using Agora for better scalability

Your users can now choose to attend meetups in-person OR join remotely via video call! 🎉

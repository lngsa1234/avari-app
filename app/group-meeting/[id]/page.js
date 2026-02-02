// app/group-meeting/[id]/page.js
// DEPRECATED: Redirects to /call/meetup/[id]
// The unified call page is now at /app/call/[type]/[id]/page.js

'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function GroupMeetingRedirect() {
  const params = useParams();
  const router = useRouter();
  const channelName = params.id;

  useEffect(() => {
    // Redirect to new unified call page
    router.replace(`/call/meetup/${channelName}`);
  }, [channelName, router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p>Redirecting to meetup...</p>
      </div>
    </div>
  );
}

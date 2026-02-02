// app/meeting/[id]/page.js
// DEPRECATED: Redirects to /call/coffee/[id]
// The unified call page is now at /app/call/[type]/[id]/page.js

'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function VideoMeetingRedirect() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id;

  useEffect(() => {
    // Redirect to new unified call page
    router.replace(`/call/coffee/${meetingId}`);
  }, [meetingId, router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p>Redirecting to call...</p>
      </div>
    </div>
  );
}

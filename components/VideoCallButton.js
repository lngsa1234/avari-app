// components/VideoCallButton.js
// Updated to work with Avari's meetups instead of coffee_chats

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createVideoMeeting } from '@/lib/videoMeeting';

export default function VideoCallButton({ meetup }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [videoLink, setVideoLink] = useState(meetup?.video_link || null);

  const handleCreateVideo = async () => {
    setIsCreating(true);
    try {
      const { link, roomId } = await createVideoMeeting({
        meetupId: meetup.id
      });
      
      setVideoLink(link);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(link);
      alert(`✅ Video room created!\n\nLink copied to clipboard:\n${link}\n\nShare this with meetup participants!`);
      
    } catch (error) {
      console.error('Error creating video:', error);
      alert('Error creating video room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinVideo = () => {
    const roomId = videoLink.split('/meeting/')[1];
    router.push(`/meeting/${roomId}`);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(videoLink);
    alert('📋 Video link copied to clipboard!');
  };

  // Parse meetup date/time
  const meetupDateTime = parseMeetupDateTime(meetup.date, meetup.time);
  const now = new Date();
  const isToday = meetupDateTime && meetupDateTime.toDateString() === now.toDateString();
  const isUpcoming = meetupDateTime && meetupDateTime > now;
  const isSoon = isUpcoming && (meetupDateTime - now) < 30 * 60 * 1000; // Within 30 minutes

  if (!videoLink) {
    // No video room yet - show create button
    return (
      <button
        onClick={handleCreateVideo}
        disabled={isCreating}
        className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-medium py-3 rounded-lg hover:from-rose-600 hover:to-pink-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isCreating ? (
          <>
            <span className="animate-spin">⏳</span>
            <span>Creating video room...</span>
          </>
        ) : (
          <>
            <span>📹</span>
            <span>Add Video Call</span>
          </>
        )}
      </button>
    );
  }

  // Video room exists - show join/copy buttons
  return (
    <div className="space-y-2">
      {/* Join button - prominent if meeting is soon or today */}
      <button
        onClick={handleJoinVideo}
        className={`w-full font-medium py-3 rounded-lg transition flex items-center justify-center gap-2 ${
          isSoon 
            ? 'bg-green-600 hover:bg-green-700 text-white animate-pulse'
            : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white'
        }`}
      >
        <span>📹</span>
        <span>{isSoon ? 'Join Video Call Now!' : 'Join Video Call'}</span>
      </button>

      {/* Copy link button */}
      <button
        onClick={handleCopyLink}
        className="w-full bg-white border-2 border-rose-500 text-rose-500 font-medium py-2 rounded-lg hover:bg-rose-50 transition"
      >
        🔗 Copy Video Link
      </button>

      {/* Status indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-green-600 bg-green-50 py-2 px-3 rounded">
        <span>✓</span>
        <span>Video room ready</span>
      </div>

      {/* Meeting time reminder */}
      {isToday && meetupDateTime && (
        <div className="text-center text-sm text-gray-600 bg-yellow-50 py-2 px-3 rounded border border-yellow-200">
          ⏰ Meetup today at {meetupDateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      )}
    </div>
  );
}

/**
 * Helper to parse meetup date/time strings
 * Avari stores: date: "Saturday, Dec 7" and time: "2:00 PM"
 */
function parseMeetupDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  
  try {
    // Combine date and time strings
    const dateTimeStr = `${dateStr} ${timeStr}`;
    const parsed = new Date(dateTimeStr);
    
    // Check if valid
    if (isNaN(parsed.getTime())) {
      // Try parsing current year
      const currentYear = new Date().getFullYear();
      const withYear = `${dateStr} ${currentYear} ${timeStr}`;
      return new Date(withYear);
    }
    
    return parsed;
  } catch (error) {
    console.error('Error parsing meetup date/time:', error);
    return null;
  }
}

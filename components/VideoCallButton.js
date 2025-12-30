'use client';

import { useState } from 'react';
import VideoCall from './VideoCall';

/**
 * VideoCallButton - Socket.IO Version
 * 
 * Displays button to initiate 1:1 video calls
 * Uses Socket.IO backend for real-time WebRTC signaling
 * 
 * @param {Object} meetup - Coffee chat/meetup object with user IDs
 * @param {string} currentUserId - Currently logged-in user's ID
 */
export default function VideoCallButton({ meetup, currentUserId }) {
  const [showVideoCall, setShowVideoCall] = useState(false);

  // Validate required props
  if (!meetup || !currentUserId) {
    console.warn('VideoCallButton: Missing required props', { 
      hasMeetup: !!meetup, 
      hasCurrentUserId: !!currentUserId 
    });
    return null;
  }

  // Determine the other user in the chat
  const isRequester = meetup.requester_id === currentUserId;
  const otherUserId = isRequester ? meetup.recipient_id : meetup.requester_id;
  
  // Get other user's name
  const otherUserName = isRequester 
    ? (meetup.recipient?.name || 'Other User')
    : (meetup.requester?.name || 'Other User');

  // Validate other user exists
  if (!otherUserId) {
    console.warn('VideoCallButton: Cannot determine other user', { meetup });
    return (
      <div className="p-2 bg-yellow-100 border border-yellow-400 rounded text-xs">
        ⚠️ Video calling unavailable (user not found)
      </div>
    );
  }

  // Prevent calling yourself
  if (otherUserId === currentUserId) {
    console.warn('VideoCallButton: Cannot call yourself');
    return null;
  }

  console.log('✅ VideoCallButton ready:', {
    matchId: meetup.id,
    currentUserId,
    otherUserId,
    otherUserName
  });

  // Show full-screen video call interface
  if (showVideoCall) {
    return (
      <VideoCall
        matchId={meetup.id}
        userId={currentUserId}
        otherUserId={otherUserId}
        otherUserName={otherUserName}
        onEndCall={() => {
          console.log('📞 Call ended');
          setShowVideoCall(false);
        }}
      />
    );
  }

  // Show video call button
  return (
    <button
      onClick={() => {
        console.log('🎥 Starting video call:', {
          matchId: meetup.id,
          from: currentUserId,
          to: otherUserId
        });
        setShowVideoCall(true);
      }}
      className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-lg"
      title={`Start video call with ${otherUserName}`}
    >
      <svg 
        className="w-5 h-5 mr-2" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
        />
      </svg>
      Join Video Call
    </button>
  );
}

'use client';

/**
 * Live Transcript Overlay
 * Displays recent transcript entries over the video
 */
export default function TranscriptOverlay({
  transcript = [],
  isTranscribing = false,
  maxEntries = 3,
}) {
  // Only show if transcribing and has entries
  if (!isTranscribing || transcript.length === 0) {
    return null;
  }

  const recentEntries = transcript.slice(-maxEntries);

  return (
    <div className="absolute bottom-24 left-4 right-4 pointer-events-none z-30">
      <div className="bg-stone-900 bg-opacity-80 rounded-lg p-3 max-h-24 overflow-hidden border border-stone-700">
        <div className="space-y-1">
          {recentEntries.map((entry, idx) => (
            <p key={idx} className="text-white text-sm">
              <span className="text-amber-400 font-medium">
                {entry.speakerName}:{' '}
              </span>
              {entry.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

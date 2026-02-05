'use client';

/**
 * Live Transcript Overlay (Closed Captions Style)
 * Displays recent transcript entries at the bottom of the video area
 */
export default function TranscriptOverlay({
  transcript = [],
  isTranscribing = false,
  interimText = '',
  speakerName = 'You',
  maxEntries = 2,
}) {
  // Only show if transcribing and has entries or interim text
  if (!isTranscribing || (transcript.length === 0 && !interimText)) {
    return null;
  }

  const recentEntries = transcript.slice(-maxEntries);

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[95%] max-w-2xl pointer-events-none z-40">
      <div className="flex flex-col items-center gap-1">
        {recentEntries.map((entry, idx) => (
          <div
            key={idx}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-center animate-fade-in"
            style={{
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span
              className="text-xs font-semibold flex-shrink-0"
              style={{ color: '#D4A574' }}
            >
              {entry.speakerName}:
            </span>
            <span className="text-white text-sm font-medium">
              {entry.text}
            </span>
          </div>
        ))}
        {/* Show interim text while speaking */}
        {interimText && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-center animate-fade-in"
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span
              className="text-xs font-semibold flex-shrink-0 animate-pulse"
              style={{ color: '#6BBF6A' }}
            >
              {speakerName}:
            </span>
            <span className="text-white/80 text-sm font-medium italic">
              {interimText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

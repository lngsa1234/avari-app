'use client';

/**
 * Live Transcript Overlay — YouTube-style two-line captions
 *
 * Line 1: previous sentence (slides up when replaced)
 * Line 2: current sentence (interim while speaking, stays after finalize)
 * When next sentence starts, line 2 slides up to line 1.
 */
export default function TranscriptOverlay({
  transcript = [],
  isTranscribing = false,
  interimText = '',
  speakerName = 'You',
}) {
  if (!isTranscribing) {
    return null;
  }

  const lastEntry = transcript.length > 0 ? transcript[transcript.length - 1] : null;
  const prevEntry = transcript.length > 1 ? transcript[transcript.length - 2] : null;

  // Determine what to show on each line
  let line1 = null;
  let line2 = null;

  if (interimText) {
    // Currently speaking: line 1 = last finalized, line 2 = interim
    if (lastEntry) {
      line1 = { key: lastEntry.timestamp, speaker: lastEntry.speakerName, text: lastEntry.text, isInterim: false };
    }
    // Skip interim if it duplicates last finalized (happens during recognition restart)
    const isDuplicate = lastEntry && (
      lastEntry.text === interimText ||
      lastEntry.text.includes(interimText) ||
      interimText.includes(lastEntry.text)
    );
    if (!isDuplicate) {
      line2 = { key: 'interim', speaker: speakerName, text: interimText, isInterim: true };
    }
  } else if (lastEntry) {
    // Not speaking: line 1 = previous, line 2 = last finalized (stays in place)
    if (prevEntry) {
      line1 = { key: prevEntry.timestamp, speaker: prevEntry.speakerName, text: prevEntry.text, isInterim: false };
    }
    line2 = { key: lastEntry.timestamp, speaker: lastEntry.speakerName, text: lastEntry.text, isInterim: false };
  }

  if (!line1 && !line2) {
    return null;
  }

  return (
    <div className="absolute bottom-10 left-3 max-w-[70%] sm:max-w-lg pointer-events-none z-40">
      <div
        className="px-3 py-2 rounded-lg"
        style={{
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {line1 && (
          <div
            key={line1.key}
            className="text-sm leading-relaxed"
            style={{ opacity: 0.5, animation: 'captionSlideUp 0.25s ease-out' }}
          >
            <span className="font-semibold" style={{ color: '#D4A574' }}>
              {line1.speaker}:{' '}
            </span>
            <span className="text-white">{line1.text}</span>
          </div>
        )}
        {line2 && (
          <div
            key={line2.key}
            className={`text-sm leading-relaxed ${line1 ? 'mt-0.5' : ''}`}
          >
            <span className="font-semibold" style={{ color: line2.isInterim ? '#6BBF6A' : '#D4A574' }}>
              {line2.speaker}:{' '}
            </span>
            <span className={`text-white ${line2.isInterim ? 'opacity-90' : ''}`}>
              {line2.text}
            </span>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes captionSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 0.5; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

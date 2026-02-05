'use client';

/**
 * Empty State Component
 * Consistent empty state styling for video call panels
 *
 * @param {Object} props
 * @param {string} props.emoji - Emoji icon to display
 * @param {string} props.title - Main message
 * @param {string} props.subtitle - Optional secondary message
 * @param {string} props.size - Size variant: 'small', 'medium', 'large'
 */
export default function EmptyState({
  emoji = '📭',
  title,
  subtitle,
  size = 'medium',
  children,
}) {
  const sizeClasses = {
    small: {
      container: 'py-4',
      emoji: 'text-2xl mb-2',
      title: 'text-xs',
      subtitle: 'text-xs',
    },
    medium: {
      container: 'py-8',
      emoji: 'text-4xl mb-3',
      title: 'text-sm',
      subtitle: 'text-xs',
    },
    large: {
      container: 'py-12',
      emoji: 'text-5xl mb-4',
      title: 'text-base',
      subtitle: 'text-sm',
    },
  };

  const classes = sizeClasses[size] || sizeClasses.medium;

  return (
    <div className={`text-center ${classes.container}`}>
      {emoji && (
        <span className={`block ${classes.emoji}`}>{emoji}</span>
      )}
      {title && (
        <p className={`text-stone-400 ${classes.title}`}>{title}</p>
      )}
      {subtitle && (
        <p className={`text-stone-500 mt-1 ${classes.subtitle}`}>{subtitle}</p>
      )}
      {children && (
        <div className="mt-4">{children}</div>
      )}
    </div>
  );
}

// Preset empty states for common use cases
export function ChatEmptyState() {
  return (
    <EmptyState
      emoji="💬"
      title="No messages yet"
      subtitle="Start the conversation!"
    />
  );
}

export function TranscriptEmptyState({ isTranscribing }) {
  return (
    <EmptyState
      emoji="🎤"
      title={isTranscribing ? 'Listening...' : 'Transcript will appear here'}
      subtitle={isTranscribing ? 'Start speaking!' : 'Enable transcription to begin'}
    />
  );
}

export function ParticipantsEmptyState() {
  return (
    <EmptyState
      emoji="👥"
      title="Waiting for others..."
      subtitle="Share the meeting link to invite participants"
    />
  );
}

export function TopicsEmptyState() {
  return (
    <EmptyState
      emoji="💡"
      title="No topics loaded"
      subtitle="Click shuffle to get conversation starters"
    />
  );
}

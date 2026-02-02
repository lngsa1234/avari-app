'use client';

import { useRef, useEffect } from 'react';

/**
 * Chat Panel for Video Calls
 * Displays messages and provides input for sending new messages
 */
export default function ChatPanel({
  messages = [],
  currentUserId,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onClose,
  accentColor = 'purple',
}) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSendMessage?.(e);
  };

  const accentColors = {
    rose: {
      bg: 'bg-amber-700',
      focus: 'focus:ring-amber-500',
      border: 'border-amber-600',
      gradient: 'from-amber-50 to-orange-50',
    },
    purple: {
      bg: 'bg-amber-700',
      focus: 'focus:ring-amber-500',
      border: 'border-amber-600',
      gradient: 'from-amber-50 to-orange-50',
    },
    mocha: {
      bg: 'bg-amber-700',
      focus: 'focus:ring-amber-500',
      border: 'border-amber-600',
      gradient: 'from-amber-50 to-orange-50',
    },
  };

  const colors = accentColors[accentColor] || accentColors.mocha;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-stone-700 flex items-center justify-between">
        <h3 className="text-white font-semibold">Chat</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-stone-400 mt-8">
            <p className="text-4xl mb-2">💬</p>
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${
                msg.user_id === currentUserId
                  ? `ml-auto ${colors.bg}`
                  : 'mr-auto bg-stone-700'
              } max-w-[85%] rounded-lg p-3`}
            >
              <p className="text-xs text-stone-300 mb-1">
                {msg.user_id === currentUserId ? 'You' : (msg.user_name || msg.sender || 'Anonymous')}
              </p>
              <p className="text-white text-sm break-words">{msg.message || msg.text}</p>
              <p className="text-xs text-stone-400 mt-1">
                {new Date(msg.created_at || msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-stone-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => onNewMessageChange?.(e.target.value)}
            placeholder="Type a message..."
            className={`flex-1 bg-stone-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 ${colors.focus}`}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newMessage?.trim()}
            className={`${colors.bg} hover:opacity-90 disabled:bg-stone-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition`}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

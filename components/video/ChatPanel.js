'use client';

import { useRef, useEffect } from 'react';

/* ─── Icons ─── */
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ChatEmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

/* ─── Color tokens ─── */
const C = {
  text: '#F5EDE4',
  textMuted: 'rgba(245, 237, 228, 0.5)',
  textFaint: 'rgba(245, 237, 228, 0.3)',
  accent: '#D4A574',
  border: 'rgba(245, 237, 228, 0.08)',
  myBubble: 'linear-gradient(135deg, #D4A574 0%, #B8895A 100%)',
  theirBubble: 'rgba(245, 237, 228, 0.08)',
};

/**
 * Chat Panel for Video Calls - Redesigned
 * Glass-morphism styling with gradient message bubbles
 */
export default function ChatPanel({
  messages = [],
  currentUserId,
  newMessage,
  onNewMessageChange,
  onSendMessage,
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage?.(e);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-2.5 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 pt-12">
            <ChatEmptyIcon />
            <span style={{ color: C.textMuted }} className="text-sm font-medium">
              No messages yet
            </span>
            <span style={{ color: C.textFaint }} className="text-xs">
              Start the conversation!
            </span>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.user_id === currentUserId;
            const senderName = msg.user_name || msg.sender || 'Anonymous';
            const messageText = msg.message || msg.text;
            const timestamp = new Date(msg.created_at || msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-slide-up`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {!isMe && (
                  <span
                    className="text-xs font-semibold mb-1 ml-1"
                    style={{ color: C.accent }}
                  >
                    {senderName}
                  </span>
                )}
                <div
                  className="max-w-[82%] px-3.5 py-2.5 text-sm font-medium leading-relaxed"
                  style={{
                    background: isMe ? C.myBubble : C.theirBubble,
                    color: isMe ? '#fff' : C.text,
                    borderRadius: 16,
                    borderBottomRightRadius: isMe ? 4 : 16,
                    borderBottomLeftRadius: isMe ? 16 : 4,
                    boxShadow: isMe
                      ? '0 2px 8px rgba(212,165,116,0.2)'
                      : '0 1px 4px rgba(0,0,0,0.15)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {messageText}
                </div>
                <span
                  className={`text-[10px] mt-1 ${isMe ? 'mr-1' : 'ml-1'}`}
                  style={{ color: C.textFaint }}
                >
                  {timestamp}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-3 py-2.5 flex gap-2 items-center"
        style={{ borderTop: `1px solid ${C.border}` }}
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => onNewMessageChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={500}
          className="flex-1 px-3.5 py-2.5 rounded-xl text-sm font-medium outline-none transition-colors"
          style={{
            background: 'rgba(245,237,228,0.06)',
            border: `1px solid ${C.border}`,
            color: C.text,
          }}
          onFocus={(e) => (e.target.style.borderColor = C.accent)}
          onBlur={(e) => (e.target.style.borderColor = C.border)}
        />
        <button
          type="submit"
          disabled={!newMessage?.trim()}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: newMessage?.trim() ? C.accent : 'rgba(245,237,228,0.06)',
            color: newMessage?.trim() ? '#fff' : C.textFaint,
            cursor: newMessage?.trim() ? 'pointer' : 'default',
            boxShadow: newMessage?.trim() ? '0 2px 8px rgba(212,165,116,0.3)' : 'none',
          }}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

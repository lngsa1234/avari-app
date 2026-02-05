import { useState, useRef, useEffect } from "react";

/* ─── Color tokens ─── */
const C = {
  bg: "#1E1410",
  surface: "rgba(45, 30, 20, 0.65)",
  surfaceHover: "rgba(245, 237, 228, 0.06)",
  surfaceActive: "rgba(245, 237, 228, 0.1)",
  border: "rgba(245, 237, 228, 0.08)",
  borderLight: "rgba(245, 237, 228, 0.12)",
  text: "#F5EDE4",
  textMuted: "rgba(245, 237, 228, 0.5)",
  textFaint: "rgba(245, 237, 228, 0.3)",
  accent: "#D4A574",
  accentSoft: "rgba(212, 165, 116, 0.15)",
  accentGlow: "rgba(212, 165, 116, 0.25)",
  green: "#6BBF6A",
  greenSoft: "rgba(107, 191, 106, 0.12)",
  red: "#E85D4A",
  myBubble: "linear-gradient(135deg, #D4A574 0%, #B8895A 100%)",
  theirBubble: "rgba(245, 237, 228, 0.08)",
};

/* ─── Icons ─── */
const ChatBubbleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const TopicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C6.48 2 2 6 2 11c0 2.5 1.1 4.8 2.9 6.5L4 22l4.5-2.3c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-9s-4.48-9-10-9z" />
    <circle cx="8" cy="11" r="1" fill="currentColor" />
    <circle cx="12" cy="11" r="1" fill="currentColor" />
    <circle cx="16" cy="11" r="1" fill="currentColor" />
  </svg>
);

const PeopleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ShuffleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
);

const MicIcon = ({ muted }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={muted ? C.textFaint : C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {muted ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
      </>
    ) : (
      <>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      </>
    )}
  </svg>
);

const CamIcon = ({ off }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={off ? C.textFaint : C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
      </>
    ) : (
      <>
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </>
    )}
  </svg>
);

const ScreenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const MicrophoneEmoji = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.textFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

/* ─── Avatar ─── */
const Avatar = ({ name, color, size = 40, online }) => {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: color, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: size * 0.38, fontWeight: 700,
        color: "#fff", letterSpacing: "-0.02em",
      }}>
        {initial}
      </div>
      {online !== undefined && (
        <div style={{
          position: "absolute", bottom: 0, right: 0,
          width: 10, height: 10, borderRadius: "50%",
          background: online ? C.green : C.textFaint,
          border: `2px solid ${C.bg}`,
        }} />
      )}
    </div>
  );
};

/* ─── Tab Button ─── */
const TabBtn = ({ icon, label, active, onClick, badge }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        gap: 6, padding: "10px 0", border: "none", cursor: "pointer",
        background: "transparent", position: "relative",
        color: active ? C.accent : hovered ? C.text : C.textMuted,
        fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: active ? 600 : 500,
        transition: "all 0.2s ease",
      }}
    >
      {icon}
      <span>{label}</span>
      {badge > 0 && (
        <span style={{
          background: C.red, color: "#fff", fontSize: 10, fontWeight: 700,
          borderRadius: 8, minWidth: 16, height: 16, display: "flex",
          alignItems: "center", justifyContent: "center", padding: "0 4px",
        }}>{badge}</span>
      )}
      {active && (
        <div style={{
          position: "absolute", bottom: 0, left: "15%", right: "15%",
          height: 2, background: C.accent, borderRadius: 1,
          animation: "tabSlide 0.25s ease",
        }} />
      )}
    </button>
  );
};

/* ─── Messages Tab ─── */
const MessagesTab = () => {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([
    { id: 1, sender: "You", text: "hello", time: "08:34 PM", isMe: true },
    { id: 2, sender: "Ling Wang", text: "yes", time: "10:27 PM", isMe: false },
  ]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!msg.trim()) return;
    setMessages([...messages, {
      id: Date.now(), sender: "You", text: msg.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isMe: true,
    }]);
    setMsg("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Chat area */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex",
        flexDirection: "column", gap: 10,
      }}>
        {messages.map((m, i) => (
          <div key={m.id} style={{
            display: "flex", flexDirection: "column",
            alignItems: m.isMe ? "flex-end" : "flex-start",
            animation: `msgIn 0.3s ease ${i * 0.05}s both`,
          }}>
            {!m.isMe && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: C.accent,
                marginBottom: 3, marginLeft: 4,
              }}>{m.sender}</span>
            )}
            <div style={{
              background: m.isMe ? C.myBubble : C.theirBubble,
              color: m.isMe ? "#fff" : C.text,
              padding: "10px 14px", borderRadius: 16,
              borderBottomRightRadius: m.isMe ? 4 : 16,
              borderBottomLeftRadius: m.isMe ? 16 : 4,
              maxWidth: "82%", fontSize: 14, fontWeight: 500,
              lineHeight: 1.45, letterSpacing: "-0.01em",
              boxShadow: m.isMe
                ? "0 2px 8px rgba(212,165,116,0.2)"
                : "0 1px 4px rgba(0,0,0,0.15)",
            }}>
              {m.text}
            </div>
            <span style={{
              fontSize: 10, color: C.textFaint, marginTop: 3,
              marginLeft: m.isMe ? 0 : 4, marginRight: m.isMe ? 4 : 0,
            }}>{m.time}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 12px", borderTop: `1px solid ${C.border}`,
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          style={{
            flex: 1, background: "rgba(245,237,228,0.06)",
            border: `1px solid ${C.border}`, borderRadius: 12,
            padding: "10px 14px", color: C.text, fontSize: 13,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            outline: "none", transition: "border-color 0.2s",
          }}
          onFocus={(e) => e.target.style.borderColor = C.accent}
          onBlur={(e) => e.target.style.borderColor = C.border}
        />
        <button
          onClick={handleSend}
          style={{
            width: 38, height: 38, borderRadius: 12, border: "none",
            background: msg.trim() ? C.accent : "rgba(245,237,228,0.06)",
            color: msg.trim() ? "#fff" : C.textFaint,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: msg.trim() ? "pointer" : "default",
            transition: "all 0.2s ease",
            boxShadow: msg.trim() ? "0 2px 8px rgba(212,165,116,0.3)" : "none",
          }}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
};

/* ─── Topics Tab ─── */
const topicsList = [
  "What's one thing you wish you knew before making the leap?",
  "How do you handle the loneliness of being a solo founder?",
  "What's your biggest challenge right now?",
  "What skill from your PM days helps you the most as a founder?",
  "How did you decide your idea was worth pursuing?",
  "What does your typical day look like now vs. as a PM?",
];

const TopicsTab = () => {
  const [topicIdx, setTopicIdx] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [listening, setListening] = useState(true);

  const shuffle = () => {
    setSpinning(true);
    setTimeout(() => {
      setTopicIdx((prev) => (prev + 1) % topicsList.length);
      setSpinning(false);
    }, 400);
  };

  // Simulated live transcript entries
  useEffect(() => {
    const t = setTimeout(() => {
      setTranscripts([
        { speaker: "Ling", text: "I think the hardest part was leaving the structure behind...", time: "10:28" },
        { speaker: "Admin", text: "Totally agree, the ambiguity can be overwhelming at first.", time: "10:28" },
      ]);
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Current topic card */}
      <div style={{ padding: "14px 14px 0 14px" }}>
        <div style={{
          background: `linear-gradient(135deg, rgba(212,165,116,0.15) 0%, rgba(139,94,60,0.12) 100%)`,
          border: `1px solid ${C.accentGlow}`,
          borderRadius: 16, padding: "16px 16px 14px",
          display: "flex", alignItems: "flex-start", gap: 12,
          position: "relative", overflow: "hidden",
        }}>
          {/* Subtle glow */}
          <div style={{
            position: "absolute", top: -20, right: -20, width: 80, height: 80,
            background: "radial-gradient(circle, rgba(212,165,116,0.15) 0%, transparent 70%)",
          }} />
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: C.accent,
              textTransform: "uppercase", letterSpacing: 1.2,
            }}>Current Topic</span>
            <p style={{
              color: C.text, fontSize: 15, fontWeight: 600, margin: "6px 0 0",
              lineHeight: 1.4, letterSpacing: "-0.01em",
              animation: spinning ? "topicOut 0.2s ease" : "topicIn 0.3s ease",
            }}>
              {topicsList[topicIdx]}
            </p>
          </div>
          <button
            onClick={shuffle}
            style={{
              width: 38, height: 38, borderRadius: 10, border: "none",
              background: C.accent, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(212,165,116,0.3)",
              transform: spinning ? "rotate(180deg)" : "rotate(0)",
              transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <ShuffleIcon />
          </button>
        </div>
      </div>

      {/* Live transcript section */}
      <div style={{
        margin: "14px 14px 0", display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: C.green,
          animation: "pulse 2s ease infinite",
        }} />
        <span style={{
          fontSize: 12, fontWeight: 600, color: C.text,
          letterSpacing: "0.02em",
        }}>Live Transcript</span>
      </div>

      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 14px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {transcripts.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", flex: 1, gap: 12, paddingTop: 60,
          }}>
            <MicrophoneEmoji />
            <span style={{ color: C.textMuted, fontSize: 13, fontWeight: 500 }}>
              Listening... Start speaking!
            </span>
          </div>
        ) : (
          transcripts.map((t, i) => (
            <div key={i} style={{
              animation: `msgIn 0.3s ease ${i * 0.1}s both`,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6, marginBottom: 3,
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>
                  {t.speaker}
                </span>
                <span style={{ fontSize: 10, color: C.textFaint }}>{t.time}</span>
              </div>
              <div style={{
                background: C.theirBubble, borderRadius: 12,
                padding: "8px 12px", fontSize: 13, fontWeight: 400,
                color: "rgba(245,237,228,0.8)", lineHeight: 1.5,
                borderLeft: `2px solid ${C.accentGlow}`,
              }}>
                {t.text}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/* ─── People Tab ─── */
const participants = [
  { name: "Admin", role: "Host", mic: true, cam: false, screen: false, color: "linear-gradient(135deg, #D4A574, #8B5E3C)", online: true },
  { name: "Ling Wang", role: null, mic: true, cam: true, screen: true, color: "linear-gradient(135deg, #C49A6C, #7B5E3C)", online: true },
];

const PeopleTab = () => {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: C.textMuted,
          textTransform: "uppercase", letterSpacing: 1.2,
        }}>
          {participants.length} Participants
        </span>
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          background: C.greenSoft, padding: "3px 8px",
          borderRadius: 6, fontSize: 10, fontWeight: 600, color: C.green,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.green }} />
          All Connected
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {participants.map((p, i) => (
          <ParticipantRow key={i} {...p} index={i} />
        ))}
      </div>
    </div>
  );
};

const ParticipantRow = ({ name, role, mic, cam, screen, color, online, index }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", borderRadius: 14,
        background: hovered ? C.surfaceHover : "transparent",
        transition: "all 0.2s ease",
        animation: `msgIn 0.3s ease ${index * 0.08}s both`,
      }}
    >
      {/* Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: color, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 15, fontWeight: 700,
          color: "#fff",
        }}>
          {name.charAt(0)}
        </div>
        <div style={{
          position: "absolute", bottom: -1, right: -1,
          width: 12, height: 12, borderRadius: "50%",
          background: online ? C.green : C.textFaint,
          border: `2.5px solid ${C.bg}`,
        }} />
      </div>

      {/* Name & role */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: C.text, fontSize: 14, fontWeight: 600,
          letterSpacing: "-0.01em",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{name}</span>
          {role && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: C.accent,
              background: C.accentSoft, padding: "2px 6px",
              borderRadius: 5, textTransform: "uppercase",
              letterSpacing: 0.5, flexShrink: 0,
            }}>{role}</span>
          )}
        </div>
        {role === "Host" && (
          <span style={{ fontSize: 11, color: C.textFaint, fontWeight: 500 }}>You</span>
        )}
      </div>

      {/* Status icons */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {screen && (
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: C.accentSoft, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <ScreenIcon />
          </div>
        )}
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: mic ? C.greenSoft : "rgba(232,93,74,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <MicIcon muted={!mic} />
        </div>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: cam ? C.greenSoft : "rgba(245,237,228,0.04)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CamIcon off={!cam} />
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   ══  MAIN SIDEBAR COMPONENT
   ════════════════════════════════════════════════════ */
export default function MeetingPanelSidebar() {
  const [tab, setTab] = useState("topics");
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div style={{
        position: "fixed", top: 20, right: 20, zIndex: 1000,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            background: C.accent, border: "none", borderRadius: 14,
            padding: "10px 18px", color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 4px 16px rgba(212,165,116,0.3)",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <ChatBubbleIcon /> Meeting Panel
        </button>
      </div>
    );
  }

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "linear-gradient(165deg, #1E1410 0%, #2D1E14 40%, #1A120E 100%)",
      display: "flex", alignItems: "stretch", justifyContent: "flex-end",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes msgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tabSlide { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes topicOut { to { opacity: 0; transform: translateY(-6px); } }
        @keyframes topicIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        input::placeholder { color: rgba(245,237,228,0.3); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(245,237,228,0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(245,237,228,0.2); }
      `}</style>

      {/* Placeholder for video area */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color: C.textFaint, fontSize: 14 }}>Video Area</span>
      </div>

      {/* Sidebar */}
      <div style={{
        width: 360, display: "flex", flexDirection: "column",
        background: "rgba(30, 20, 14, 0.85)",
        backdropFilter: "blur(24px) saturate(1.3)",
        WebkitBackdropFilter: "blur(24px) saturate(1.3)",
        borderLeft: `1px solid ${C.border}`,
        animation: "slideIn 0.35s ease",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 16px 12px",
        }}>
          <span style={{
            fontSize: 16, fontWeight: 700, color: C.text,
            letterSpacing: "-0.02em",
          }}>
            Meeting Panel
          </span>
          <button
            onClick={() => setOpen(false)}
            style={{
              width: 32, height: 32, borderRadius: 10, border: "none",
              background: "rgba(245,237,228,0.06)", color: C.textMuted,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(245,237,228,0.12)";
              e.currentTarget.style.color = C.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(245,237,228,0.06)";
              e.currentTarget.style.color = C.textMuted;
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", borderBottom: `1px solid ${C.border}`,
          margin: "0 8px",
        }}>
          <TabBtn icon={<ChatBubbleIcon />} label="Messages" active={tab === "messages"} onClick={() => setTab("messages")} />
          <TabBtn icon={<TopicIcon />} label="Topics" active={tab === "topics"} onClick={() => setTab("topics")} />
          <TabBtn icon={<PeopleIcon />} label="People" active={tab === "people"} onClick={() => setTab("people")} badge={tab !== "people" ? 0 : 0} />
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {tab === "messages" && <MessagesTab />}
          {tab === "topics" && <TopicsTab />}
          {tab === "people" && <PeopleTab />}
        </div>

        {/* Subtle brand */}
        <div style={{
          padding: "8px 16px", borderTop: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: C.textFaint,
            letterSpacing: 1.5, textTransform: "uppercase",
          }}>CircleW</span>
        </div>
      </div>
    </div>
  );
}

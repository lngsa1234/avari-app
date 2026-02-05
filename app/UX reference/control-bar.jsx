import { useState, useRef, useEffect } from "react";

const MicIcon = ({ muted }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {muted ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </>
    ) : (
      <>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </>
    )}
  </svg>
);

const CameraIcon = ({ off }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const ScreenShareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <polyline points="8 10 12 6 16 10" />
    <line x1="12" y1="6" x2="12" y2="14" />
  </svg>
);

const ChatIcon = ({ badge }) => (
  <div style={{ position: "relative" }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
    {badge > 0 && (
      <span style={{
        position: "absolute", top: -6, right: -8, background: "#E85D4A",
        color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10,
        minWidth: 16, height: 16, display: "flex", alignItems: "center",
        justifyContent: "center", padding: "0 4px"
      }}>{badge}</span>
    )}
  </div>
);

const PeopleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const RecordIcon = ({ recording }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={recording ? "#E85D4A" : "none"} stroke={recording ? "#E85D4A" : "currentColor"} strokeWidth="2">
    <circle cx="12" cy="12" r="8" />
    {recording && <circle cx="12" cy="12" r="4" fill="#fff" />}
  </svg>
);

const CaptionIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <path d="M7 12h2m4 0h4M7 16h10" />
  </svg>
);

const MoreIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const LanguageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const HandIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v6M10 10V5a2 2 0 0 0-4 0v11" />
    <path d="M18 11a2 2 0 0 1 4 0v3a8 8 0 0 1-8 8h-2c-2.5 0-3.8-.5-5.4-2.1L3 17.2a2 2 0 0 1 2.8-2.8L8 16" />
  </svg>
);

/* ─── Tooltip component ─── */
const Tooltip = ({ text, children, position = "top" }) => {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: "absolute",
          bottom: position === "top" ? "calc(100% + 10px)" : undefined,
          top: position === "bottom" ? "calc(100% + 10px)" : undefined,
          left: "50%", transform: "translateX(-50%)",
          background: "rgba(30, 20, 15, 0.92)", color: "#F5EDE4",
          fontSize: 12, fontWeight: 500, padding: "5px 10px",
          borderRadius: 6, whiteSpace: "nowrap",
          pointerEvents: "none", zIndex: 1000,
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          animation: "tooltipIn 0.15s ease"
        }}>
          {text}
        </div>
      )}
    </div>
  );
};

/* ─── Control Button ─── */
const ControlBtn = ({ icon, label, active, danger, onClick, small, dropdown, style: extraStyle }) => {
  const [hovered, setHovered] = useState(false);
  const base = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    border: "none", cursor: "pointer", transition: "all 0.2s ease",
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 13,
    borderRadius: small ? 10 : 14,
    padding: small ? "8px 10px" : (label ? "10px 16px" : "10px 12px"),
    color: danger ? "#fff" : active ? "#3D2517" : "#F5EDE4",
    background: danger
      ? (hovered ? "#D14535" : "#E85D4A")
      : active
        ? (hovered ? "#E8DED4" : "#F5EDE4")
        : (hovered ? "rgba(245,237,228,0.15)" : "rgba(245,237,228,0.08)"),
    transform: hovered ? "translateY(-1px)" : "none",
    boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
    ...extraStyle
  };
  return (
    <Tooltip text={label || ""}>
      <button style={base} onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {icon}
        {label && <span>{label}</span>}
        {dropdown && <ChevronDown />}
      </button>
    </Tooltip>
  );
};

/* ─── Dropdown Menu (for More) ─── */
const DropdownMenu = ({ items, onClose, anchorRef }) => {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) &&
          anchorRef.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  return (
    <div ref={ref} style={{
      position: "absolute", bottom: "calc(100% + 12px)", right: 0,
      background: "rgba(45, 30, 20, 0.96)", backdropFilter: "blur(20px)",
      borderRadius: 14, padding: "6px", minWidth: 200,
      boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(245,237,228,0.08)",
      animation: "menuIn 0.2s ease", zIndex: 1000
    }}>
      {items.map((item, i) => (
        <MenuItem key={i} {...item} onClick={() => { item.onClick?.(); onClose(); }} />
      ))}
    </div>
  );
};

const MenuItem = ({ icon, label, onClick, active, danger }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "10px 14px", border: "none", cursor: "pointer",
        borderRadius: 10, fontFamily: "'DM Sans', sans-serif",
        fontSize: 13, fontWeight: 500, transition: "all 0.15s ease",
        color: danger ? "#E85D4A" : active ? "#D4A574" : "#F5EDE4",
        background: hovered ? "rgba(245,237,228,0.1)" : "transparent",
      }}
    >
      <span style={{ opacity: 0.8, display: "flex" }}>{icon}</span>
      <span>{label}</span>
      {active && <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.6 }}>ON</span>}
    </button>
  );
};

/* ─── Divider ─── */
const Divider = () => (
  <div style={{
    width: 1, height: 28, background: "rgba(245,237,228,0.12)",
    margin: "0 4px", flexShrink: 0
  }} />
);

/* ─── Main Control Bar ─── */
export default function VideoCallControlBar() {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const moreRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const moreMenuItems = [
    {
      icon: <RecordIcon recording={recording} />,
      label: recording ? "Stop Recording" : "Record Meeting",
      active: recording,
      onClick: () => setRecording(!recording),
      danger: recording
    },
    {
      icon: <CaptionIcon />,
      label: "Captions",
      active: captions,
      onClick: () => setCaptions(!captions)
    },
    {
      icon: <LanguageIcon />,
      label: "Language: EN",
      onClick: () => {}
    },
    {
      icon: <HandIcon />,
      label: handRaised ? "Lower Hand" : "Raise Hand",
      active: handRaised,
      onClick: () => setHandRaised(!handRaised)
    }
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(165deg, #1E1410 0%, #2D1E14 40%, #1A120E 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
      fontFamily: "'DM Sans', sans-serif", padding: "40px 20px"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes tooltipIn { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes menuIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes barIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* ── Simulated Video Area ── */}
      <div style={{
        flex: 1, width: "100%", maxWidth: 960, display: "flex",
        alignItems: "center", justifyContent: "center",
        animation: "slideUp 0.6s ease"
      }}>
        <div style={{
          background: "rgba(245,237,228,0.03)", borderRadius: 20,
          border: "1px solid rgba(245,237,228,0.06)",
          width: "100%", aspectRatio: "16/9", display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, #D4A574, #8B5E3C)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 700, color: "#fff",
            boxShadow: "0 4px 20px rgba(212,165,116,0.3)"
          }}>
            CW
          </div>
          <span style={{ color: "rgba(245,237,228,0.5)", fontSize: 14, fontWeight: 500 }}>
            Connection Group
          </span>
          <span style={{ color: "rgba(245,237,228,0.3)", fontSize: 12 }}>
            2 participants
          </span>
        </div>
      </div>

      {/* ── Status indicators ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, marginBottom: 12,
        animation: "barIn 0.5s ease 0.1s both"
      }}>
        {recording && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(232,93,74,0.15)", padding: "4px 12px",
            borderRadius: 20, fontSize: 12, fontWeight: 600, color: "#E85D4A"
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", background: "#E85D4A",
              animation: "pulse 1.5s ease infinite"
            }} />
            REC
          </div>
        )}
        {captions && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 12, color: "rgba(245,237,228,0.45)", fontWeight: 500
          }}>
            <CaptionIcon /> CC
          </div>
        )}
        <span style={{
          fontSize: 13, color: "rgba(245,237,228,0.4)", fontWeight: 500,
          fontVariantNumeric: "tabular-nums"
        }}>
          {formatTime(elapsed)}
        </span>
      </div>

      {/* ── Control Bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(45, 30, 20, 0.75)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        borderRadius: 20, padding: "8px 10px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(245,237,228,0.06), inset 0 1px 0 rgba(245,237,228,0.05)",
        position: "relative",
        animation: "barIn 0.5s ease 0.2s both"
      }}>
        {/* Primary: Audio/Video */}
        <ControlBtn
          icon={<MicIcon muted={!micOn} />}
          active={micOn}
          onClick={() => setMicOn(!micOn)}
          label={micOn ? undefined : undefined}
          dropdown
        />
        <ControlBtn
          icon={<CameraIcon off={!camOn} />}
          active={camOn}
          onClick={() => setCamOn(!camOn)}
        />

        <Divider />

        {/* Secondary: Collaboration */}
        <ControlBtn
          icon={<ScreenShareIcon />}
          active={sharing}
          onClick={() => setSharing(!sharing)}
        />
        <ControlBtn
          icon={<ChatIcon badge={1} />}
          active={showChat}
          onClick={() => setShowChat(!showChat)}
        />
        <ControlBtn
          icon={<PeopleIcon />}
          active={showParticipants}
          onClick={() => setShowParticipants(!showParticipants)}
          label="2"
        />

        <Divider />

        {/* More menu */}
        <div ref={moreRef} style={{ position: "relative" }}>
          <ControlBtn
            icon={<MoreIcon />}
            onClick={() => setShowMore(!showMore)}
          />
          {showMore && (
            <DropdownMenu
              items={moreMenuItems}
              onClose={() => setShowMore(false)}
              anchorRef={moreRef}
            />
          )}
        </div>

        <Divider />

        {/* Leave */}
        <ControlBtn
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          }
          label="Leave"
          danger
          onClick={() => {}}
        />
      </div>

      {/* ── Brand watermark ── */}
      <div style={{
        marginTop: 16, fontSize: 11, fontWeight: 600,
        color: "rgba(245,237,228,0.2)", letterSpacing: 1.5,
        textTransform: "uppercase",
        animation: "barIn 0.5s ease 0.3s both"
      }}>
        CircleW
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";

/* ─────────────────── SVG Icons ─────────────────── */
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

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const SpeakerViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <rect x="15" y="14" width="5" height="4" rx="1" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const SignalIcon = ({ quality }) => {
  const color = quality === "Good" ? "#6BBF6A" : quality === "Fair" ? "#D4A574" : "#E85D4A";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
      <rect x="2" y="16" width="4" height="6" rx="1" />
      <rect x="8" y="11" width="4" height="11" rx="1" opacity={quality === "Poor" ? 0.25 : 1} />
      <rect x="14" y="6" width="4" height="16" rx="1" opacity={quality === "Poor" || quality === "Fair" ? 0.25 : 1} />
      <rect x="20" y="2" width="4" height="20" rx="1" opacity={quality !== "Good" ? 0.25 : 1} />
    </svg>
  );
};

/* ─── Tooltip ─── */
const Tooltip = ({ text, children, position = "bottom" }) => {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && text && (
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
const ControlBtn = ({ icon, label, active, danger, onClick, dropdown, style: extraStyle }) => {
  const [hovered, setHovered] = useState(false);
  const base = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    border: "none", cursor: "pointer", transition: "all 0.2s ease",
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 13,
    borderRadius: 14,
    padding: label ? "10px 16px" : "10px 12px",
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
    <Tooltip text={label || ""} position="top">
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

/* ─── Dropdown Menu ─── */
const DropdownMenu = ({ items, onClose, anchorRef, position = "bottom" }) => {
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
      position: "absolute",
      ...(position === "bottom"
        ? { top: "calc(100% + 8px)", right: 0 }
        : { bottom: "calc(100% + 12px)", right: 0 }),
      background: "rgba(45, 30, 20, 0.96)", backdropFilter: "blur(20px)",
      borderRadius: 14, padding: "6px", minWidth: 200,
      boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(245,237,228,0.08)",
      animation: "menuIn 0.2s ease", zIndex: 1000
    }}>
      {items.map((item, i) => (
        <MenuItemBtn key={i} {...item} onClick={() => { item.onClick?.(); onClose(); }} />
      ))}
    </div>
  );
};

const MenuItemBtn = ({ icon, label, onClick, active, danger }) => {
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
const VDivider = () => (
  <div style={{
    width: 1, height: 28, background: "rgba(245,237,228,0.12)",
    margin: "0 4px", flexShrink: 0
  }} />
);

/* ════════════════════════════════════════════════════
   ══  TOP HEADER BAR
   ════════════════════════════════════════════════════ */
const TopHeader = ({ elapsed, viewMode, setViewMode, connection }) => {
  const [copied, setCopied] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const viewRef = useRef(null);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 20px",
      background: "rgba(45, 30, 20, 0.6)",
      backdropFilter: "blur(20px) saturate(1.3)",
      WebkitBackdropFilter: "blur(20px) saturate(1.3)",
      borderBottom: "1px solid rgba(245,237,228,0.06)",
      animation: "slideDown 0.4s ease",
      position: "relative", zIndex: 100,
    }}>
      {/* Left: Logo + Room info */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* CircleW Logo */}
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: "linear-gradient(135deg, #D4A574 0%, #8B5E3C 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, color: "#fff",
          boxShadow: "0 2px 8px rgba(212,165,116,0.25)",
          flexShrink: 0,
        }}>
          W
        </div>

        {/* Room details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#D4A574", display: "flex" }}>
              <LockIcon />
            </span>
            <span style={{
              color: "#F5EDE4", fontSize: 15, fontWeight: 600,
              letterSpacing: "-0.01em"
            }}>
              Connection Group
            </span>
          </div>
          <span style={{
            color: "rgba(245,237,228,0.45)", fontSize: 12, fontWeight: 400
          }}>
            PM to Founder Transition Circle
          </span>
        </div>

        {/* Subtle separator */}
        <div style={{
          width: 1, height: 32, background: "rgba(245,237,228,0.08)",
          margin: "0 6px"
        }} />

        {/* Meeting metadata pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Meeting ID */}
          <Tooltip text={copied ? "Copied!" : "Copy Meeting ID"} position="bottom">
            <button
              onClick={handleCopy}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(245,237,228,0.06)",
                border: "1px solid rgba(245,237,228,0.06)",
                borderRadius: 8, padding: "4px 10px",
                color: "rgba(245,237,228,0.5)", fontSize: 12, fontWeight: 500,
                cursor: "pointer", transition: "all 0.2s",
                fontFamily: "'DM Sans', sans-serif"
              }}
            >
              <span style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.02em" }}>
                connection-g...
              </span>
              <CopyIcon />
            </button>
          </Tooltip>

          {/* Duration */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 8,
            background: "rgba(245,237,228,0.06)",
            color: "rgba(245,237,228,0.5)", fontSize: 12, fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {formatTime(elapsed)}
          </div>

          {/* Participants */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 8,
            background: "rgba(245,237,228,0.06)",
            color: "rgba(245,237,228,0.5)", fontSize: 12, fontWeight: 500,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            2
          </div>

          {/* Connection quality */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 8,
            background: "rgba(245,237,228,0.06)",
            fontSize: 12, fontWeight: 500,
            color: connection === "Good" ? "#6BBF6A" : connection === "Fair" ? "#D4A574" : "#E85D4A",
          }}>
            <SignalIcon quality={connection} />
            {connection}
          </div>
        </div>
      </div>

      {/* Right: View toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* View mode selector */}
        <div ref={viewRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowViewMenu(!showViewMenu)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "rgba(245,237,228,0.08)",
              border: "1px solid rgba(245,237,228,0.08)",
              borderRadius: 10, padding: "7px 14px",
              color: "#F5EDE4", fontSize: 13, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s",
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            {viewMode === "speaker" ? <SpeakerViewIcon /> : <GridIcon />}
            <span>{viewMode === "speaker" ? "Speaker" : "Grid"}</span>
            <ChevronDown />
          </button>
          {showViewMenu && (
            <DropdownMenu
              anchorRef={viewRef}
              onClose={() => setShowViewMenu(false)}
              position="bottom"
              items={[
                {
                  icon: <SpeakerViewIcon />,
                  label: "Speaker View",
                  active: viewMode === "speaker",
                  onClick: () => setViewMode("speaker")
                },
                {
                  icon: <GridIcon />,
                  label: "Grid View",
                  active: viewMode === "grid",
                  onClick: () => setViewMode("grid")
                }
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   ══  BOTTOM CONTROL BAR
   ════════════════════════════════════════════════════ */
const BottomControlBar = () => {
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

  const moreMenuItems = [
    { icon: <RecordIcon recording={recording} />, label: recording ? "Stop Recording" : "Record Meeting", active: recording, onClick: () => setRecording(!recording), danger: recording },
    { icon: <CaptionIcon />, label: "Captions", active: captions, onClick: () => setCaptions(!captions) },
    { icon: <LanguageIcon />, label: "Language: EN", onClick: () => {} },
    { icon: <HandIcon />, label: handRaised ? "Lower Hand" : "Raise Hand", active: handRaised, onClick: () => setHandRaised(!handRaised) }
  ];

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 6, padding: "14px 0",
    }}>
      {/* Status indicators */}
      <div style={{
        position: "absolute", bottom: 80,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        {recording && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(232,93,74,0.15)", padding: "4px 12px",
            borderRadius: 20, fontSize: 12, fontWeight: 600, color: "#E85D4A"
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E85D4A", animation: "pulse 1.5s ease infinite" }} />
            REC
          </div>
        )}
        {captions && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(245,237,228,0.45)", fontWeight: 500 }}>
            <CaptionIcon /> CC
          </div>
        )}
      </div>

      {/* Main control bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(45, 30, 20, 0.75)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        borderRadius: 20, padding: "8px 10px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(245,237,228,0.06), inset 0 1px 0 rgba(245,237,228,0.05)",
        position: "relative",
      }}>
        <ControlBtn icon={<MicIcon muted={!micOn} />} active={micOn} onClick={() => setMicOn(!micOn)} dropdown />
        <ControlBtn icon={<CameraIcon off={!camOn} />} active={camOn} onClick={() => setCamOn(!camOn)} />
        <VDivider />
        <ControlBtn icon={<ScreenShareIcon />} active={sharing} onClick={() => setSharing(!sharing)} />
        <ControlBtn icon={<ChatIcon badge={1} />} active={showChat} onClick={() => setShowChat(!showChat)} />
        <ControlBtn icon={<PeopleIcon />} active={showParticipants} onClick={() => setShowParticipants(!showParticipants)} label="2" />
        <VDivider />
        <div ref={moreRef} style={{ position: "relative" }}>
          <ControlBtn icon={<MoreIcon />} onClick={() => setShowMore(!showMore)} />
          {showMore && <DropdownMenu items={moreMenuItems} onClose={() => setShowMore(false)} anchorRef={moreRef} position="top" />}
        </div>
        <VDivider />
        <ControlBtn
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>}
          label="Leave" danger onClick={() => {}}
        />
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   ══  FULL VIDEO CALL PAGE
   ════════════════════════════════════════════════════ */
export default function VideoCallPage() {
  const [elapsed, setElapsed] = useState(0);
  const [viewMode, setViewMode] = useState("speaker");
  const connection = "Good";

  useEffect(() => {
    const t = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "linear-gradient(165deg, #1E1410 0%, #2D1E14 40%, #1A120E 100%)",
      fontFamily: "'DM Sans', sans-serif", overflow: "hidden",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes tooltipIn { from { opacity:0; transform:translateX(-50%) translateY(4px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes menuIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes avatarPulse { 0%,100% { box-shadow: 0 4px 20px rgba(212,165,116,0.2); } 50% { box-shadow: 0 4px 30px rgba(212,165,116,0.35); } }
        * { box-sizing: border-box; margin:0; padding:0; }
      `}</style>

      {/* ── Top Header ── */}
      <TopHeader elapsed={elapsed} viewMode={viewMode} setViewMode={setViewMode} connection={connection} />

      {/* ── Video Area ── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, gap: 16, animation: "fadeIn 0.5s ease 0.2s both",
      }}>
        {/* Main speaker */}
        <div style={{
          flex: 1, maxWidth: 800, aspectRatio: "16/9",
          background: "rgba(245,237,228,0.03)",
          borderRadius: 20, border: "1px solid rgba(245,237,228,0.06)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          position: "relative", overflow: "hidden"
        }}>
          {/* Subtle gradient overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 50% 40%, rgba(212,165,116,0.04) 0%, transparent 60%)"
          }} />
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg, #D4A574, #8B5E3C)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 700, color: "#fff",
            animation: "avatarPulse 3s ease infinite",
            position: "relative"
          }}>
            LW
          </div>
          <span style={{ color: "#F5EDE4", fontSize: 15, fontWeight: 600, position: "relative" }}>
            Ling W.
          </span>
          <div style={{
            position: "absolute", bottom: 14, left: 14,
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(30,20,15,0.7)", backdropFilter: "blur(8px)",
            padding: "5px 12px", borderRadius: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6BBF6A" }} />
            <span style={{ color: "rgba(245,237,228,0.7)", fontSize: 12, fontWeight: 500 }}>Speaking</span>
          </div>
        </div>

        {/* Sidebar thumbnail */}
        <div style={{
          width: 200, display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{
            aspectRatio: "16/10",
            background: "rgba(245,237,228,0.03)",
            borderRadius: 14, border: "1px solid rgba(245,237,228,0.06)",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 8, position: "relative"
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "linear-gradient(135deg, #7B9E87, #4A6B52)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, color: "#fff",
            }}>
              JD
            </div>
            <span style={{ color: "rgba(245,237,228,0.7)", fontSize: 12, fontWeight: 500 }}>
              Jane D.
            </span>
            <div style={{
              position: "absolute", bottom: 8, left: 8,
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(30,20,15,0.7)", backdropFilter: "blur(6px)",
              padding: "3px 8px", borderRadius: 6,
            }}>
              <MicIcon muted={false} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Control Bar ── */}
      <BottomControlBar />

      {/* ── Brand watermark ── */}
      <div style={{
        position: "absolute", bottom: 6, right: 16,
        fontSize: 10, fontWeight: 600, color: "rgba(245,237,228,0.12)",
        letterSpacing: 1.5, textTransform: "uppercase",
      }}>
        CircleW
      </div>
    </div>
  );
}

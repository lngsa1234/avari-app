import { useState, useEffect } from "react";

const COLORS = {
  bg: "#FAF6F1",
  bgCard: "#F5EDE4",
  bgCardHover: "#EDE3D7",
  brown900: "#3D2B1F",
  brown700: "#5C4033",
  brown600: "#6B4C3B",
  brown500: "#8B6F5E",
  brown400: "#A68B7B",
  brown300: "#C4A882",
  brown200: "#D4C4A8",
  brown100: "#E8DDD0",
  accent: "#7B5B3A",
  accentLight: "#A67C52",
  green: "#4A7C59",
  greenLight: "#E8F2EB",
  greenDot: "#5BA36B",
  white: "#FFFFFF",
  shadow: "rgba(61,43,31,0.08)",
  shadowMd: "rgba(61,43,31,0.12)",
  urgent: "#C4763B",
  urgentBg: "#FDF3EB",
  red: "#B85C4A",
  redBg: "#FDF0ED",
  blue: "#4A6A8B",
  blueLight: "#EBF1F7",
};

const FONT = `'DM Sans', 'Nunito', system-ui, sans-serif`;
const DISPLAY_FONT = `'Playfair Display', 'Georgia', serif`;

// ─── Icons (inline SVG components) ───
const Icons = {
  back: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  edit: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  camera: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M7 3L5.5 5H3C2.17 5 1.5 5.67 1.5 6.5V15C1.5 15.83 2.17 16.5 3 16.5H17C17.83 16.5 18.5 15.83 18.5 15V6.5C18.5 5.67 17.83 5 17 5H14.5L13 3H7Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  location: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1C5.24 1 3 3.24 3 6C3 9.75 8 15 8 15C8 15 13 9.75 13 6C13 3.24 10.76 1 8 1Z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
    </svg>
  ),
  briefcase: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5.5 5V3.5C5.5 2.67 6.17 2 7 2H9C9.83 2 10.5 2.67 10.5 3.5V5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  message: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 3H14V11.5C14 12.05 13.55 12.5 13 12.5H5L2 15V3Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  video: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M10.5 6.5L14.5 4V12L10.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  link: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M6.5 9.5L9.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M9 4L11 2C12.1 0.9 13.9 0.9 15 2C16.1 3.1 16.1 4.9 15 6L13 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M7 12L5 14C3.9 15.1 2.1 15.1 1 14C-0.1 12.9 -0.1 11.1 1 10L3 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  users: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M1.5 14C1.5 11.24 3.74 9 6.5 9C9.26 9 11.5 11.24 11.5 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="12" cy="5.5" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M14.5 14C14.5 12 13 10 11 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  calendar: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5 1.5V4.5M11 1.5V4.5M1.5 7H14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  sparkle: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L9.5 6.5L15 8L9.5 9.5L8 15L6.5 9.5L1 8L6.5 6.5L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ),
  chevron: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ─── Reusable Components ───

const Avatar = ({ name, size = 90, online, showCameraPrompt }) => {
  const [hovered, setHovered] = useState(false);
  const initial = name ? name[0].toUpperCase() : "?";
  return (
    <div
      style={{ position: "relative", width: size, height: size, cursor: showCameraPrompt ? "pointer" : "default" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: size, height: size, borderRadius: size / 2,
        background: `linear-gradient(145deg, ${COLORS.accent}, ${COLORS.brown700})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: COLORS.white, fontFamily: DISPLAY_FONT, fontWeight: 600,
        fontSize: size * 0.4, letterSpacing: 1,
        boxShadow: `0 4px 16px ${COLORS.shadowMd}`,
        transition: "all 0.3s ease",
      }}>
        {initial}
      </div>
      {showCameraPrompt && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: size / 2,
          background: "rgba(61,43,31,0.55)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 2,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.25s ease",
          color: COLORS.white,
        }}>
          <span style={{ color: COLORS.white }}>{Icons.camera}</span>
          <span style={{ fontSize: 10, fontFamily: FONT, fontWeight: 600 }}>Add photo</span>
        </div>
      )}
      {online && (
        <div style={{
          position: "absolute", bottom: 2, right: 2,
          width: 16, height: 16, borderRadius: 8,
          background: COLORS.greenDot,
          border: `3px solid ${COLORS.bg}`,
        }} />
      )}
    </div>
  );
};

const StatCard = ({ value, label, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, background: hovered ? COLORS.bgCardHover : COLORS.bgCard,
        borderRadius: 14, padding: "14px 8px", textAlign: "center",
        border: "none", cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: hovered ? `0 4px 12px ${COLORS.shadowMd}` : "none",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
    >
      <div style={{
        fontFamily: FONT, fontWeight: 800, fontSize: 22,
        color: COLORS.brown700, lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontFamily: FONT, fontSize: 11.5, color: COLORS.brown400,
        marginTop: 4, fontWeight: 500,
      }}>{label}</div>
    </button>
  );
};

const Tag = ({ children, color = COLORS.green, bg = COLORS.greenLight }) => (
  <span style={{
    fontFamily: FONT, fontSize: 12, fontWeight: 600,
    color, background: bg,
    borderRadius: 20, padding: "5px 14px",
    display: "inline-flex", alignItems: "center", gap: 4,
  }}>{children}</span>
);

const CircleChip = ({ name, members, hasUpcoming, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        background: hovered ? COLORS.bgCardHover : COLORS.bgCard,
        border: "none", borderRadius: 14, padding: "12px 16px",
        cursor: "pointer", transition: "all 0.2s ease",
        boxShadow: hovered ? `0 4px 12px ${COLORS.shadowMd}` : `0 1px 3px ${COLORS.shadow}`,
        transform: hovered ? "translateY(-1px)" : "none",
        width: "100%",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `linear-gradient(135deg, ${COLORS.brown200}, ${COLORS.brown100})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16,
      }}>🔮</div>
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, color: COLORS.brown700 }}>{name}</div>
        <div style={{ fontFamily: FONT, fontSize: 11.5, color: COLORS.brown400, marginTop: 1 }}>
          {members} members
          {hasUpcoming && (
            <span style={{ color: COLORS.urgent, fontWeight: 600 }}> · Next session tomorrow</span>
          )}
        </div>
      </div>
      <span style={{ color: COLORS.brown300 }}>{Icons.chevron}</span>
    </button>
  );
};

const ActionButton = ({ icon, children, variant = "default", onClick }) => {
  const [hovered, setHovered] = useState(false);
  const variants = {
    default: {
      bg: hovered ? COLORS.bgCardHover : COLORS.bgCard,
      color: COLORS.brown700,
      border: "none",
    },
    primary: {
      bg: hovered ? COLORS.brown700 : COLORS.accent,
      color: COLORS.white,
      border: "none",
    },
    outline: {
      bg: hovered ? COLORS.bgCard : "transparent",
      color: COLORS.brown600,
      border: `1.5px solid ${COLORS.brown200}`,
    },
  };
  const v = variants[variant];
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: 8, background: v.bg, color: v.color, border: v.border,
        borderRadius: 14, padding: "12px 22px",
        fontFamily: FONT, fontWeight: 600, fontSize: 14,
        cursor: "pointer", transition: "all 0.2s ease",
        boxShadow: hovered && variant === "primary" ? `0 4px 16px ${COLORS.shadowMd}` : "none",
      }}
    >
      <span style={{ display: "flex", color: v.color }}>{icon}</span>
      {children}
    </button>
  );
};

const SectionLabel = ({ children, icon }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 7,
    fontFamily: FONT, fontWeight: 700, fontSize: 14,
    color: COLORS.brown700, marginBottom: 12,
    textTransform: "uppercase", letterSpacing: 0.8,
  }}>
    {icon && <span style={{ color: COLORS.brown400, display: "flex" }}>{icon}</span>}
    {children}
  </div>
);

const Divider = () => (
  <div style={{
    height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.brown100}, transparent)`,
    margin: "24px 0",
  }} />
);

// ─── Activity Item ───
const ActivityItem = ({ emoji, text, time }) => (
  <div style={{
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: "10px 0",
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 10,
      background: COLORS.bgCard, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontSize: 15, flexShrink: 0,
    }}>{emoji}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: FONT, fontSize: 13, color: COLORS.brown700, lineHeight: 1.4 }}>{text}</div>
      <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.brown300, marginTop: 2 }}>{time}</div>
    </div>
  </div>
);

// ─── Main Profile Page ───
export default function ProfilePage() {
  const [loaded, setLoaded] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(true);

  useEffect(() => { setLoaded(true); }, []);

  const profile = {
    name: "Testing",
    headline: "Building smarter QA with AI & Machine Learning",
    role: "QA Engineer",
    domain: "AI / Machine Learning",
    location: "Bloomfield Hills, MI",
    careerStage: "Mid-Career",
    bio: "Passionate about platform product validation and verification. Exploring how AI can transform quality assurance workflows. Always open to learning from others on the same journey.",
    openTo: ["Mentorship", "Circle invites", "Coffee chats"],
    interests: ["AI Ethics", "Women in Tech", "Product Management", "Test Automation", "Career Growth"],
    stats: { meetups: 8, connections: 3, sharedCircles: 3 },
    circles: [
      { name: "Video Test", members: 3, hasUpcoming: true },
      { name: "Invite-only Circle Template", members: 1, hasUpcoming: false },
      { name: "UX Design", members: 4, hasUpcoming: true },
    ],
    links: [
      { label: "LinkedIn", url: "#" },
      { label: "Portfolio", url: "#" },
    ],
    activity: [
      { emoji: "🎥", text: "Attended Video Test circle session", time: "2 days ago" },
      { emoji: "🎨", text: "Joined UX Design circle", time: "5 days ago" },
      { emoji: "👋", text: "Connected with Xueting", time: "1 week ago" },
      { emoji: "🚀", text: "Completed 8th meetup milestone!", time: "2 weeks ago" },
    ],
    online: true,
  };

  const fadeIn = (delay = 0) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? "translateY(0)" : "translateY(12px)",
    transition: `all 0.45s ease ${delay}s`,
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${COLORS.bg}; }
        button { outline: none; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.brown200}; border-radius: 2px; }
      `}</style>

      <div style={{
        maxWidth: 520, margin: "0 auto", padding: "0 16px 60px",
        fontFamily: FONT, minHeight: "100vh",
        background: COLORS.bg,
      }}>

        {/* ─── Top Nav ─── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 0", position: "sticky", top: 0,
          background: COLORS.bg, zIndex: 10,
          ...fadeIn(0),
        }}>
          <button style={{
            background: "none", border: "none", cursor: "pointer",
            color: COLORS.brown500, display: "flex", padding: 4,
          }}>{Icons.back}</button>
          <span style={{
            fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 600,
            color: COLORS.brown900,
          }}>Profile</span>
          {isOwnProfile ? (
            <button
              onClick={() => setIsOwnProfile(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: COLORS.brown500, display: "flex", alignItems: "center",
                gap: 4, fontFamily: FONT, fontSize: 13, fontWeight: 600,
                padding: 4,
              }}
            >
              {Icons.edit} Edit
            </button>
          ) : (
            <button
              onClick={() => setIsOwnProfile(true)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: COLORS.brown500, fontFamily: FONT, fontSize: 13,
                fontWeight: 600, padding: 4,
              }}
            >
              ← Own view
            </button>
          )}
        </div>

        {/* ─── Hero Section ─── */}
        <div style={{
          textAlign: "center", paddingTop: 8, paddingBottom: 4,
          ...fadeIn(0.05),
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <Avatar
              name={profile.name}
              size={96}
              online={profile.online}
              showCameraPrompt={isOwnProfile}
            />
          </div>
          <h1 style={{
            fontFamily: DISPLAY_FONT, fontSize: 30, fontWeight: 700,
            color: COLORS.brown900, letterSpacing: -0.3,
          }}>{profile.name}</h1>
          <p style={{
            fontFamily: FONT, fontSize: 14.5, color: COLORS.brown400,
            marginTop: 6, lineHeight: 1.4, maxWidth: 340, margin: "6px auto 0",
            fontStyle: "italic",
          }}>{profile.headline}</p>

          {/* compact role + location */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 14, marginTop: 14, flexWrap: "wrap",
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontFamily: FONT, fontSize: 13, color: COLORS.brown500, fontWeight: 500,
            }}>
              <span style={{ color: COLORS.brown300, display: "flex" }}>{Icons.briefcase}</span>
              {profile.role} · {profile.domain}
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: FONT, fontSize: 13, color: COLORS.brown500, fontWeight: 500,
            }}>
              <span style={{ color: COLORS.brown300, display: "flex" }}>{Icons.location}</span>
              {profile.location}
            </span>
          </div>

          {/* Tags */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 8,
            marginTop: 16, flexWrap: "wrap",
          }}>
            <Tag>{profile.careerStage}</Tag>
            {profile.openTo.map((item, i) => (
              <Tag key={i} color={COLORS.blue} bg={COLORS.blueLight}>{item}</Tag>
            ))}
          </div>
        </div>

        {/* ─── Visitor CTA (when not own profile) ─── */}
        {!isOwnProfile && (
          <div style={{
            display: "flex", gap: 10, justifyContent: "center",
            marginTop: 20, ...fadeIn(0.1),
          }}>
            <ActionButton variant="primary" icon={Icons.users}>Connect</ActionButton>
            <ActionButton variant="outline" icon={Icons.message}>Message</ActionButton>
            <ActionButton variant="outline" icon={Icons.video}>Video</ActionButton>
          </div>
        )}

        {/* ─── Stats ─── */}
        <div style={{ marginTop: 24, ...fadeIn(0.12) }}>
          <div style={{ display: "flex", gap: 10 }}>
            <StatCard value={profile.stats.meetups} label="Meetups" onClick={() => {}} />
            <StatCard value={profile.stats.connections} label="Connections" onClick={() => {}} />
            <StatCard value={profile.stats.sharedCircles} label="Shared Circles" onClick={() => {}} />
          </div>
        </div>

        <Divider />

        {/* ─── About ─── */}
        <div style={fadeIn(0.15)}>
          <SectionLabel>About</SectionLabel>
          <p style={{
            fontFamily: FONT, fontSize: 14, color: COLORS.brown600,
            lineHeight: 1.65, background: COLORS.bgCard,
            borderRadius: 14, padding: "16px 18px",
          }}>{profile.bio}</p>
        </div>

        <Divider />

        {/* ─── Interests ─── */}
        <div style={fadeIn(0.18)}>
          <SectionLabel icon={Icons.sparkle}>Interests</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {profile.interests.map((interest, i) => (
              <span key={i} style={{
                fontFamily: FONT, fontSize: 12.5, fontWeight: 500,
                color: COLORS.brown600, background: COLORS.bgCard,
                borderRadius: 20, padding: "7px 16px",
                border: `1px solid ${COLORS.brown100}`,
                transition: "all 0.2s",
                cursor: "pointer",
              }}>{interest}</span>
            ))}
          </div>
        </div>

        <Divider />

        {/* ─── Shared Circles ─── */}
        <div style={fadeIn(0.21)}>
          <SectionLabel icon={Icons.users}>Shared Circles</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {profile.circles.map((circle, i) => (
              <CircleChip key={i} {...circle} onClick={() => {}} />
            ))}
          </div>
        </div>

        <Divider />

        {/* ─── Recent Activity ─── */}
        <div style={fadeIn(0.24)}>
          <SectionLabel icon={Icons.calendar}>Recent Activity</SectionLabel>
          <div style={{
            background: COLORS.bgCard, borderRadius: 14, padding: "6px 16px",
          }}>
            {profile.activity.map((item, i) => (
              <div key={i}>
                <ActivityItem {...item} />
                {i < profile.activity.length - 1 && (
                  <div style={{ height: 1, background: COLORS.brown100, marginLeft: 42 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <Divider />

        {/* ─── Links ─── */}
        <div style={fadeIn(0.27)}>
          <SectionLabel icon={Icons.link}>Links</SectionLabel>
          <div style={{ display: "flex", gap: 10 }}>
            {profile.links.map((link, i) => (
              <a key={i} href={link.url} style={{
                fontFamily: FONT, fontSize: 13, fontWeight: 600,
                color: COLORS.accent, textDecoration: "none",
                background: COLORS.bgCard, borderRadius: 12,
                padding: "10px 18px",
                display: "inline-flex", alignItems: "center", gap: 6,
                border: `1px solid ${COLORS.brown100}`,
                transition: "all 0.2s",
              }}>
                <span style={{ display: "flex", color: COLORS.brown400 }}>{Icons.link}</span>
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* ─── Footer (own profile only) ─── */}
        {isOwnProfile && (
          <>
            <Divider />
            <div style={{
              display: "flex", justifyContent: "center", gap: 24,
              ...fadeIn(0.3),
            }}>
              <button style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: FONT, fontSize: 13, color: COLORS.brown400,
                fontWeight: 500, display: "flex", alignItems: "center", gap: 5,
              }}>
                📖 App Tutorial
              </button>
              <button style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: FONT, fontSize: 13, color: COLORS.red,
                fontWeight: 500, display: "flex", alignItems: "center", gap: 5,
              }}>
                ↪ Log Out
              </button>
            </div>
          </>
        )}

        {/* ─── Tagline ─── */}
        <div style={{
          textAlign: "center", marginTop: 40,
          ...fadeIn(0.33),
        }}>
          <span style={{
            fontFamily: DISPLAY_FONT, fontSize: 16, color: COLORS.brown300,
            fontStyle: "italic",
          }}>Find your circle. Move forward.</span>
        </div>
      </div>
    </>
  );
}

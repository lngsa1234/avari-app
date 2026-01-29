import React, { useState } from 'react';

const MyCircles = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);

  const activeUsers = [
    { id: 1, name: 'Sarah Chen', avatar: '👩🏻', status: 'online', role: 'Mentor', lastActive: 'Now', mutualCircles: 3 },
    { id: 2, name: 'Maya Patel', avatar: '👩🏽', status: 'online', role: 'Founder', lastActive: 'Now', mutualCircles: 5 },
    { id: 3, name: 'Jordan Brooks', avatar: '👩🏿', status: 'online', role: 'Coach', lastActive: 'Now', mutualCircles: 2 },
    { id: 4, name: 'Emma Wilson', avatar: '👩🏼', status: 'away', role: 'Designer', lastActive: '5m ago', mutualCircles: 4 },
    { id: 5, name: 'Aisha Rahman', avatar: '🧕🏽', status: 'online', role: 'Advisor', lastActive: 'Now', mutualCircles: 6 },
    { id: 6, name: 'Lisa Kim', avatar: '👩🏻‍💼', status: 'away', role: 'PM Lead', lastActive: '12m ago', mutualCircles: 3 },
  ];

  const recentMessages = [
    { id: 1, from: 'Sarah Chen', avatar: '👩🏻', message: 'Loved our coffee chat yesterday! Let\'s connect again soon.', time: '2m ago', unread: true },
    { id: 2, from: 'Women in Tech Circle', avatar: '💼', message: 'Maya: The workshop resources are now available...', time: '15m ago', unread: true, isGroup: true },
    { id: 3, from: 'Maya Patel', avatar: '👩🏽', message: 'Thanks for the introduction! Really helpful.', time: '1h ago', unread: false },
    { id: 4, from: 'Founder\'s Journey', avatar: '🚀', message: 'Emma: Anyone attending the pitch event next week?', time: '3h ago', unread: false, isGroup: true },
    { id: 5, from: 'Jordan Brooks', avatar: '👩🏿', message: 'Your insights on product strategy were spot on!', time: '5h ago', unread: false },
  ];

  const circles = [
    { id: 1, name: 'Women in Tech', emoji: '💼', members: 128, activeNow: 12, color: '#8B6F5C', description: 'Tech leaders & innovators' },
    { id: 2, name: 'Founder\'s Journey', emoji: '🚀', members: 64, activeNow: 8, color: '#A67B5B', description: 'Startup founders & dreamers' },
    { id: 3, name: 'Working Moms', emoji: '💪', members: 256, activeNow: 23, color: '#6B4423', description: 'Balancing career & family' },
    { id: 4, name: 'Career Pivoters', emoji: '🔄', members: 89, activeNow: 6, color: '#D4A574', description: 'Embracing new paths' },
    { id: 5, name: 'Detroit Connectors', emoji: '🏙️', members: 45, activeNow: 4, color: '#C4956A', description: 'Local network' },
  ];

  return (
    <div style={styles.container}>
      {/* Ambient Background */}
      <div style={styles.ambientBg}></div>
      <div style={styles.grainOverlay}></div>
      
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoContainer}>
            <div style={styles.logoCircles}>
              <span style={styles.logoCircle1}></span>
              <span style={styles.logoCircle2}></span>
              <span style={styles.logoCircle3}></span>
            </div>
            <span style={styles.logoText}>CircleW</span>
          </div>
        </div>
        <nav style={styles.nav}>
          <a href="#" style={styles.navLink}>Discover</a>
          <a href="#" style={{...styles.navLink, ...styles.navLinkActive}}>My Circles</a>
          <a href="#" style={styles.navLink}>Events</a>
          <a href="#" style={styles.navLink}>Resources</a>
        </nav>
        <div style={styles.headerRight}>
          <div style={styles.notificationBadge}>
            <span style={styles.notificationDot}></span>
            🔔
          </div>
          <div style={styles.profilePill}>
            <span style={styles.profileAvatar}>👩🏻‍💻</span>
            <span style={styles.profileName}>Ling</span>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* Page Title Section */}
        <section style={styles.titleSection}>
          <div style={styles.titleContent}>
            <h1 style={styles.pageTitle}>My Circles</h1>
            <p style={styles.tagline}>Your community, your connections</p>
          </div>
          <div style={styles.quickStats}>
            <div style={styles.statItem}>
              <span style={styles.statNumber}>23</span>
              <span style={styles.statLabel}>Connections</span>
            </div>
            <div style={styles.statDivider}></div>
            <div style={styles.statItem}>
              <span style={styles.statNumber}>5</span>
              <span style={styles.statLabel}>Circles</span>
            </div>
            <div style={styles.statDivider}></div>
            <div style={styles.statItem}>
              <span style={styles.statNumber}>12</span>
              <span style={styles.statLabel}>Online Now</span>
            </div>
          </div>
        </section>

        {/* Main Grid */}
        <div style={styles.grid}>
          
          {/* Left Column - Active Connections */}
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>
                <span style={styles.cardIcon}>✨</span>
                Active Connections
              </h2>
              <span style={styles.onlineBadge}>
                <span style={styles.pulsingDot}></span>
                {activeUsers.filter(u => u.status === 'online').length} online
              </span>
            </div>
            
            <div style={styles.userGrid}>
              {activeUsers.map((user, index) => (
                <div 
                  key={user.id} 
                  style={{
                    ...styles.userCard,
                    animationDelay: `${index * 0.1}s`
                  }}
                  onClick={() => setSelectedUser(user)}
                >
                  <div style={styles.userAvatarContainer}>
                    <span style={styles.userAvatar}>{user.avatar}</span>
                    <span style={{
                      ...styles.statusIndicator,
                      backgroundColor: user.status === 'online' ? '#4CAF50' : '#FFA726'
                    }}></span>
                  </div>
                  <div style={styles.userInfo}>
                    <span style={styles.userName}>{user.name}</span>
                    <span style={styles.userRole}>{user.role}</span>
                  </div>
                  <div style={styles.mutualBadge}>
                    <span style={styles.mutualCount}>{user.mutualCircles}</span>
                    <span style={styles.mutualLabel}>mutual</span>
                  </div>
                </div>
              ))}
            </div>
            
            <button style={styles.seeAllBtn}>
              View All Connections →
            </button>
          </section>

          {/* Middle Column - Recent Communications */}
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>
                <span style={styles.cardIcon}>💬</span>
                Recent Conversations
              </h2>
              <div style={styles.tabGroup}>
                {['all', 'direct', 'groups'].map(tab => (
                  <button 
                    key={tab}
                    style={{
                      ...styles.tab,
                      ...(activeTab === tab ? styles.tabActive : {})
                    }}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.messageList}>
              {recentMessages
                .filter(msg => {
                  if (activeTab === 'all') return true;
                  if (activeTab === 'direct') return !msg.isGroup;
                  return msg.isGroup;
                })
                .map((msg, index) => (
                <div 
                  key={msg.id} 
                  style={{
                    ...styles.messageItem,
                    ...(msg.unread ? styles.messageUnread : {}),
                    animationDelay: `${index * 0.08}s`
                  }}
                >
                  <div style={styles.messageAvatar}>
                    <span style={styles.msgAvatarEmoji}>{msg.avatar}</span>
                    {msg.isGroup && <span style={styles.groupIndicator}>●●●</span>}
                  </div>
                  <div style={styles.messageContent}>
                    <div style={styles.messageHeader}>
                      <span style={styles.messageSender}>{msg.from}</span>
                      <span style={styles.messageTime}>{msg.time}</span>
                    </div>
                    <p style={styles.messagePreview}>{msg.message}</p>
                  </div>
                  {msg.unread && <span style={styles.unreadDot}></span>}
                </div>
              ))}
            </div>

            <div style={styles.composeBar}>
              <input 
                type="text" 
                placeholder="Start a new conversation..." 
                style={styles.composeInput}
              />
              <button style={styles.composeBtn}>✦</button>
            </div>
          </section>

          {/* Right Column - My Groups */}
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>
                <span style={styles.cardIcon}>🌸</span>
                My Groups
              </h2>
              <button style={styles.addGroupBtn}>+ Join</button>
            </div>

            <div style={styles.circlesList}>
              {circles.map((circle, index) => (
                <div 
                  key={circle.id} 
                  style={{
                    ...styles.circleCard,
                    animationDelay: `${index * 0.12}s`
                  }}
                >
                  <div style={{
                    ...styles.circleEmoji,
                    background: `linear-gradient(135deg, ${circle.color}22, ${circle.color}44)`
                  }}>
                    {circle.emoji}
                  </div>
                  <div style={styles.circleInfo}>
                    <h3 style={styles.circleName}>{circle.name}</h3>
                    <p style={styles.circleDesc}>{circle.description}</p>
                    <div style={styles.circleMeta}>
                      <span style={styles.memberCount}>
                        👥 {circle.members} members
                      </span>
                      <span style={styles.activeCount}>
                        <span style={styles.activeDot}></span>
                        {circle.activeNow} active
                      </span>
                    </div>
                  </div>
                  <button style={{
                    ...styles.enterBtn,
                    borderColor: circle.color,
                    color: circle.color
                  }}>
                    Enter
                  </button>
                </div>
              ))}
            </div>

            <button style={styles.exploreBtn}>
              <span style={styles.exploreBtnIcon}>🔍</span>
              Explore More Circles
            </button>
          </section>
        </div>

        {/* Bottom Motivational Banner */}
        <section style={styles.motivationalBanner}>
          <div style={styles.bannerContent}>
            <span style={styles.bannerQuote}>"</span>
            <p style={styles.bannerText}>Strong women lift each other up. Your next meaningful connection is just a conversation away.</p>
            <span style={styles.bannerQuoteEnd}>"</span>
          </div>
          <button style={styles.bannerBtn}>
            Find Your Circle
            <span style={styles.bannerArrow}>→</span>
          </button>
        </section>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(165deg, #FDF8F3 0%, #F5EDE6 50%, #EDE4DB 100%)',
    fontFamily: '"DM Sans", sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  ambientBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      radial-gradient(ellipse at 20% 20%, rgba(139, 111, 92, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(166, 123, 91, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(212, 165, 116, 0.04) 0%, transparent 70%)
    `,
    pointerEvents: 'none',
  },
  grainOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
    opacity: 0.03,
    pointerEvents: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 48px',
    borderBottom: '1px solid rgba(139, 111, 92, 0.1)',
    backgroundColor: 'rgba(253, 248, 243, 0.8)',
    backdropFilter: 'blur(20px)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoCircles: {
    position: 'relative',
    width: '36px',
    height: '36px',
  },
  logoCircle1: {
    position: 'absolute',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#8B6F5C',
    top: '0',
    left: '0',
  },
  logoCircle2: {
    position: 'absolute',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: '#A67B5B',
    top: '8px',
    left: '14px',
  },
  logoCircle3: {
    position: 'absolute',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#D4A574',
    top: '18px',
    left: '6px',
  },
  logoText: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '24px',
    fontWeight: '600',
    color: '#5C4033',
    letterSpacing: '-0.5px',
  },
  nav: {
    display: 'flex',
    gap: '8px',
  },
  navLink: {
    padding: '10px 20px',
    color: '#6B5344',
    textDecoration: 'none',
    fontSize: '15px',
    fontWeight: '500',
    borderRadius: '100px',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  navLinkActive: {
    backgroundColor: '#8B6F5C',
    color: '#FDF8F3',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  notificationBadge: {
    position: 'relative',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '8px',
  },
  notificationDot: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    width: '8px',
    height: '8px',
    backgroundColor: '#E57373',
    borderRadius: '50%',
  },
  profilePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 16px 6px 6px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    borderRadius: '100px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  profileAvatar: {
    fontSize: '28px',
  },
  profileName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#5C4033',
  },
  main: {
    maxWidth: '1440px',
    margin: '0 auto',
    padding: '32px 48px',
    position: 'relative',
    zIndex: 1,
  },
  titleSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid rgba(139, 111, 92, 0.1)',
  },
  titleContent: {},
  pageTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '42px',
    fontWeight: '600',
    color: '#3D2B1F',
    letterSpacing: '-1px',
    marginBottom: '4px',
  },
  tagline: {
    fontSize: '16px',
    color: '#8B7355',
    fontWeight: '400',
  },
  quickStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    padding: '16px 28px',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '28px',
    fontWeight: '600',
    color: '#5C4033',
  },
  statLabel: {
    fontSize: '12px',
    color: '#8B7355',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statDivider: {
    width: '1px',
    height: '32px',
    backgroundColor: 'rgba(139, 111, 92, 0.2)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr 1fr',
    gap: '24px',
    marginBottom: '32px',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 4px 24px rgba(139, 111, 92, 0.08)',
    border: '1px solid rgba(139, 111, 92, 0.08)',
    backdropFilter: 'blur(10px)',
    animation: 'fadeInUp 0.6s ease-out forwards',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  cardTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '20px',
    fontWeight: '600',
    color: '#3D2B1F',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardIcon: {
    fontSize: '18px',
  },
  onlineBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#4CAF50',
    fontWeight: '500',
  },
  pulsingDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#4CAF50',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
  },
  userGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px',
    backgroundColor: 'rgba(139, 111, 92, 0.04)',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  userAvatarContainer: {
    position: 'relative',
  },
  userAvatar: {
    fontSize: '36px',
    display: 'block',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: '2px',
    right: '2px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: '2px solid white',
  },
  userInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  userName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  userRole: {
    fontSize: '13px',
    color: '#8B7355',
  },
  mutualBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    borderRadius: '12px',
  },
  mutualCount: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#5C4033',
  },
  mutualLabel: {
    fontSize: '10px',
    color: '#8B7355',
    textTransform: 'uppercase',
  },
  seeAllBtn: {
    marginTop: '16px',
    padding: '14px',
    backgroundColor: 'transparent',
    border: '1.5px solid rgba(139, 111, 92, 0.3)',
    borderRadius: '14px',
    color: '#6B5344',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"DM Sans", sans-serif',
  },
  tabGroup: {
    display: 'flex',
    gap: '4px',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    padding: '4px',
    borderRadius: '12px',
  },
  tab: {
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#8B7355',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: '"DM Sans", sans-serif',
  },
  tabActive: {
    backgroundColor: 'white',
    color: '#5C4033',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  messageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
    overflow: 'auto',
  },
  messageItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '16px',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
    position: 'relative',
  },
  messageUnread: {
    backgroundColor: 'rgba(139, 111, 92, 0.06)',
  },
  messageAvatar: {
    position: 'relative',
  },
  msgAvatarEmoji: {
    fontSize: '32px',
    display: 'block',
  },
  groupIndicator: {
    position: 'absolute',
    bottom: '-2px',
    right: '-4px',
    fontSize: '8px',
    color: '#8B6F5C',
  },
  messageContent: {
    flex: 1,
    minWidth: 0,
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  messageSender: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  messageTime: {
    fontSize: '12px',
    color: '#A89080',
  },
  messagePreview: {
    fontSize: '13px',
    color: '#6B5344',
    lineHeight: '1.4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  unreadDot: {
    width: '10px',
    height: '10px',
    backgroundColor: '#8B6F5C',
    borderRadius: '50%',
    flexShrink: 0,
    alignSelf: 'center',
  },
  composeBar: {
    display: 'flex',
    gap: '10px',
    marginTop: '16px',
    padding: '6px',
    backgroundColor: 'rgba(139, 111, 92, 0.06)',
    borderRadius: '16px',
  },
  composeInput: {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    color: '#3D2B1F',
    outline: 'none',
    fontFamily: '"DM Sans", sans-serif',
  },
  composeBtn: {
    width: '44px',
    height: '44px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '18px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGroupBtn: {
    padding: '8px 16px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    border: 'none',
    borderRadius: '100px',
    color: '#6B5344',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"DM Sans", sans-serif',
  },
  circlesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
  },
  circleCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px',
    backgroundColor: 'rgba(139, 111, 92, 0.04)',
    borderRadius: '16px',
    transition: 'all 0.3s ease',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  circleEmoji: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  },
  circleInfo: {
    flex: 1,
    minWidth: 0,
  },
  circleName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '2px',
  },
  circleDesc: {
    fontSize: '12px',
    color: '#8B7355',
    marginBottom: '6px',
  },
  circleMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: '11px',
    color: '#A89080',
  },
  activeCount: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: '#4CAF50',
  },
  activeDot: {
    width: '6px',
    height: '6px',
    backgroundColor: '#4CAF50',
    borderRadius: '50%',
  },
  enterBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1.5px solid',
    borderRadius: '100px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"DM Sans", sans-serif',
  },
  exploreBtn: {
    marginTop: '16px',
    padding: '14px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '14px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"DM Sans", sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  exploreBtnIcon: {
    fontSize: '16px',
  },
  motivationalBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '32px 40px',
    background: 'linear-gradient(135deg, #5C4033 0%, #8B6F5C 100%)',
    borderRadius: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  bannerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    maxWidth: '70%',
  },
  bannerQuote: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '48px',
    color: 'rgba(255, 255, 255, 0.3)',
    lineHeight: 1,
  },
  bannerQuoteEnd: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '48px',
    color: 'rgba(255, 255, 255, 0.3)',
    lineHeight: 1,
    alignSelf: 'flex-end',
  },
  bannerText: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '20px',
    color: 'white',
    fontWeight: '400',
    fontStyle: 'italic',
    lineHeight: '1.5',
  },
  bannerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '16px 28px',
    backgroundColor: 'white',
    border: 'none',
    borderRadius: '100px',
    color: '#5C4033',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"DM Sans", sans-serif',
  },
  bannerArrow: {
    fontSize: '18px',
    transition: 'transform 0.3s ease',
  },
};

export default MyCircles;

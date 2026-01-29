import React, { useState } from 'react';

const DiscoverPage = () => {
  const [selectedVibe, setSelectedVibe] = useState(null);
  const [profileProgress] = useState(88);

  const vibes = [
    { id: 'advice', icon: '💭', label: 'I need advice', description: 'Get guidance from your circle', color: '#8B6F5C' },
    { id: 'vent', icon: '🫂', label: 'I want to vent', description: 'Find a listening ear', color: '#A67B5B' },
    { id: 'grow', icon: '🌱', label: 'I want to grow', description: 'Level up your skills', color: '#6B4423' },
    { id: 'celebrate', icon: '🎉', label: 'I want to celebrate', description: 'Share your wins', color: '#C4956A' },
  ];

  const featuredMeetups = [
    {
      id: 1,
      title: 'Michigan Networking Coffee Chat',
      date: 'Thu, Jan 29',
      time: '10:00 PM',
      attendees: 0,
      maxAttendees: 8,
      tags: ['Networking', 'Local'],
      gradient: 'linear-gradient(135deg, #8B6F5C 0%, #6B4423 100%)',
      isNew: true,
    },
    {
      id: 2,
      title: 'Women in Tech Virtual Lunch',
      date: 'Fri, Jan 30',
      time: '12:00 PM',
      attendees: 5,
      maxAttendees: 12,
      tags: ['Tech', 'Virtual'],
      gradient: 'linear-gradient(135deg, #A67B5B 0%, #8B6F5C 100%)',
      isNew: false,
    },
    {
      id: 3,
      title: 'Founder Friday Pitch Practice',
      date: 'Fri, Jan 30',
      time: '3:00 PM',
      attendees: 8,
      maxAttendees: 10,
      tags: ['Founders', 'Workshop'],
      gradient: 'linear-gradient(135deg, #C4956A 0%, #A67B5B 100%)',
      isNew: false,
    },
  ];

  const connectionGroups = [
    { id: 1, name: 'Career Changers Support', members: 3, maxMembers: 4, avatars: ['👩🏻', '👩🏽', '👩🏿'], spotsLeft: 1 },
    { id: 2, name: 'Working Moms AM Check-in', members: 4, maxMembers: 4, avatars: ['👩🏼', '🧕🏽', '👩🏻', '👩🏽'], spotsLeft: 0 },
    { id: 3, name: 'Tech Interview Prep', members: 2, maxMembers: 5, avatars: ['👩🏻‍💼', '👩🏿‍🦱'], spotsLeft: 3 },
  ];

  const communityWishlist = [
    { id: 1, title: 'Vibe Coding 101', votes: 1, category: 'Workshop' },
    { id: 2, title: 'Negotiation Skills for Women', votes: 4, category: 'Workshop' },
    { id: 3, title: 'Detroit Area Happy Hour', votes: 7, category: 'Social' },
  ];

  const peopleToMeet = [
    { id: 1, name: 'Sarah Chen', avatar: '👩🏻', role: 'PM @ Google', mutualCircles: 2, matchReason: 'Both in Career Pivoters' },
    { id: 2, name: 'Aisha Rahman', avatar: '🧕🏽', role: 'Founder @ TechStart', mutualCircles: 3, matchReason: 'Similar interests' },
    { id: 3, name: 'Jordan Brooks', avatar: '👩🏿', role: 'Executive Coach', mutualCircles: 1, matchReason: 'Recommended for you' },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.ambientBg}></div>
      
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoContainer}>
          <div style={styles.logoCircles}>
            <span style={styles.logoCircle1}></span>
            <span style={styles.logoCircle2}></span>
            <span style={styles.logoCircle3}></span>
          </div>
          <span style={styles.logoText}>CircleW</span>
        </div>
        <nav style={styles.nav}>
          <a href="#" style={styles.navLink}>Home</a>
          <a href="#" style={{...styles.navLink, ...styles.navLinkActive}}>Discover</a>
          <a href="#" style={styles.navLink}>Circles</a>
          <a href="#" style={styles.navLink}>Meetups</a>
          <a href="#" style={styles.navLink}>Profile</a>
        </nav>
        <div style={styles.headerRight}>
          <span style={styles.profileAvatar}>👩🏻‍💻</span>
        </div>
      </header>

      <main style={styles.main}>
        {/* Profile Completion Banner */}
        <div style={styles.profileBanner}>
          <div style={styles.bannerLeft}>
            <div style={styles.progressCircle}>
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(139, 111, 92, 0.15)" strokeWidth="4" />
                <circle 
                  cx="24" cy="24" r="20" 
                  fill="none" 
                  stroke="#8B6F5C" 
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${profileProgress * 1.26} 126`}
                  transform="rotate(-90 24 24)"
                />
                <text x="24" y="28" textAnchor="middle" fontSize="12" fontWeight="600" fill="#5C4033">
                  {profileProgress}%
                </text>
              </svg>
            </div>
            <div style={styles.bannerText}>
              <span style={styles.bannerTitle}>Complete your profile</span>
              <span style={styles.bannerSubtitle}>Add a photo to get 2x more connections</span>
            </div>
          </div>
          <button style={styles.bannerBtn}>Add Photo →</button>
        </div>

        {/* Page Title */}
        <section style={styles.titleSection}>
          <div style={styles.titleIcon}>🧭</div>
          <div>
            <h1 style={styles.pageTitle}>Discover</h1>
            <p style={styles.subtitle}>Find your community, your way</p>
          </div>
        </section>

        {/* What's Your Vibe Today */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>What's your vibe today?</h2>
          <div style={styles.vibeGrid}>
            {vibes.map((vibe) => (
              <button
                key={vibe.id}
                style={{
                  ...styles.vibeCard,
                  ...(selectedVibe === vibe.id ? {
                    borderColor: vibe.color,
                    backgroundColor: `${vibe.color}08`,
                    transform: 'scale(1.02)',
                  } : {})
                }}
                onClick={() => setSelectedVibe(vibe.id)}
              >
                <span style={styles.vibeIcon}>{vibe.icon}</span>
                <span style={styles.vibeLabel}>{vibe.label}</span>
                <span style={styles.vibeDesc}>{vibe.description}</span>
                {selectedVibe === vibe.id && (
                  <span style={{...styles.vibeCheck, backgroundColor: vibe.color}}>✓</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Action Cards */}
        <section style={styles.actionSection}>
          <div style={styles.actionCard}>
            <div style={styles.actionIconWrap}>
              <span style={styles.actionIcon}>📅</span>
            </div>
            <div style={styles.actionContent}>
              <h3 style={styles.actionTitle}>Host a Meetup</h3>
              <p style={styles.actionDesc}>Lead a session and connect with others</p>
            </div>
            <span style={styles.actionArrow}>→</span>
          </div>
          <div style={styles.actionCard}>
            <div style={{...styles.actionIconWrap, backgroundColor: 'rgba(166, 123, 91, 0.15)'}}>
              <span style={styles.actionIcon}>💡</span>
            </div>
            <div style={styles.actionContent}>
              <h3 style={styles.actionTitle}>Request a Meetup</h3>
              <p style={styles.actionDesc}>Suggest a topic you'd love to discuss</p>
            </div>
            <span style={styles.actionArrow}>→</span>
          </div>
        </section>

        {/* Featured Meetups */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Featured Meetups</h2>
            <button style={styles.seeAllBtn}>See all →</button>
          </div>
          <div style={styles.meetupsGrid}>
            {featuredMeetups.map((meetup, index) => (
              <div key={meetup.id} style={{...styles.meetupCard, animationDelay: `${index * 0.1}s`}}>
                <div style={{...styles.meetupHeader, background: meetup.gradient}}>
                  {meetup.isNew && <span style={styles.newBadge}>✨ Be first!</span>}
                  <div style={styles.meetupTags}>
                    {meetup.tags.map((tag, i) => (
                      <span key={i} style={styles.meetupTag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div style={styles.meetupBody}>
                  <h3 style={styles.meetupTitle}>{meetup.title}</h3>
                  <div style={styles.meetupMeta}>
                    <span style={styles.meetupDate}>📅 {meetup.date}</span>
                    <span style={styles.meetupTime}>🕐 {meetup.time}</span>
                  </div>
                  <div style={styles.meetupFooter}>
                    <div style={styles.attendeeInfo}>
                      {meetup.attendees > 0 ? (
                        <>
                          <div style={styles.attendeeAvatars}>
                            {['👩🏻', '👩🏽', '👩🏿'].slice(0, Math.min(meetup.attendees, 3)).map((a, i) => (
                              <span key={i} style={{...styles.miniAvatar, marginLeft: i > 0 ? '-8px' : 0}}>{a}</span>
                            ))}
                          </div>
                          <span style={styles.attendeeCount}>{meetup.attendees}/{meetup.maxAttendees}</span>
                        </>
                      ) : (
                        <span style={styles.attendeeCount}>Be the first to join!</span>
                      )}
                    </div>
                    <button style={styles.joinBtn}>Join</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Connection Groups */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Connection Groups</h2>
            <button style={styles.seeAllBtn}>See all →</button>
          </div>
          <p style={styles.sectionSubtitle}>Small groups for deeper connections (max 4-5 people)</p>
          <div style={styles.groupsGrid}>
            {connectionGroups.map((group, index) => (
              <div key={group.id} style={{...styles.groupCard, animationDelay: `${index * 0.1}s`}}>
                <h4 style={styles.groupName}>{group.name}</h4>
                <div style={styles.groupMembers}>
                  <div style={styles.memberAvatars}>
                    {group.avatars.map((avatar, i) => (
                      <span key={i} style={{
                        ...styles.groupAvatar,
                        marginLeft: i > 0 ? '-10px' : 0,
                        zIndex: group.avatars.length - i
                      }}>{avatar}</span>
                    ))}
                    {group.spotsLeft > 0 && (
                      <span style={styles.emptySpot}>+{group.spotsLeft}</span>
                    )}
                  </div>
                  <span style={styles.memberCount}>{group.members}/{group.maxMembers} members</span>
                </div>
                <button 
                  style={{
                    ...styles.claimBtn,
                    ...(group.spotsLeft === 0 ? styles.claimBtnFull : {})
                  }}
                  disabled={group.spotsLeft === 0}
                >
                  {group.spotsLeft === 0 ? 'Group Full' : 'Claim a Spot'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Community Wishlist */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Community Wishlist</h2>
            <button style={styles.suggestBtn}>+ Suggest</button>
          </div>
          <p style={styles.sectionSubtitle}>Vote for meetups you'd love to see, or host one yourself!</p>
          <div style={styles.wishlistGrid}>
            {communityWishlist.map((item, index) => (
              <div key={item.id} style={{...styles.wishlistCard, animationDelay: `${index * 0.1}s`}}>
                <div style={styles.wishlistContent}>
                  <span style={styles.wishlistCategory}>{item.category}</span>
                  <h4 style={styles.wishlistTitle}>{item.title}</h4>
                  <span style={styles.wishlistVotes}>
                    🙋‍♀️ {item.votes} {item.votes === 1 ? 'person wants' : 'people want'} this
                  </span>
                </div>
                <div style={styles.wishlistActions}>
                  <button style={styles.hostBtn}>Host This</button>
                  <button style={styles.meTooBtn}>
                    <span style={styles.meTooIcon}>👍</span>
                    Me Too
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* People to Meet */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>People to Meet</h2>
            <button style={styles.seeAllBtn}>See all →</button>
          </div>
          <p style={styles.sectionSubtitle}>Suggested connections based on your circles and interests</p>
          <div style={styles.peopleGrid}>
            {peopleToMeet.map((person, index) => (
              <div key={person.id} style={{...styles.personCard, animationDelay: `${index * 0.1}s`}}>
                <div style={styles.personTop}>
                  <span style={styles.personAvatar}>{person.avatar}</span>
                  <div style={styles.personInfo}>
                    <span style={styles.personName}>{person.name}</span>
                    <span style={styles.personRole}>{person.role}</span>
                  </div>
                </div>
                <div style={styles.matchReason}>
                  <span style={styles.matchIcon}>✨</span>
                  <span style={styles.matchText}>{person.matchReason}</span>
                </div>
                <div style={styles.mutualBadge}>
                  🔗 {person.mutualCircles} mutual {person.mutualCircles === 1 ? 'circle' : 'circles'}
                </div>
                <button style={styles.connectBtn}>Connect</button>
              </div>
            ))}
            
            {/* Empty state / CTA card */}
            <div style={styles.ctaCard}>
              <div style={styles.ctaIcon}>🤝</div>
              <h4 style={styles.ctaTitle}>Grow Your Network</h4>
              <p style={styles.ctaText}>Join more meetups to unlock personalized recommendations</p>
              <button style={styles.ctaBtn}>Find Meetups</button>
            </div>
          </div>
        </section>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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
  },
  ambientBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      radial-gradient(ellipse at 20% 20%, rgba(139, 111, 92, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(166, 123, 91, 0.04) 0%, transparent 50%)
    `,
    pointerEvents: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 48px',
    borderBottom: '1px solid rgba(139, 111, 92, 0.1)',
    backgroundColor: 'rgba(253, 248, 243, 0.9)',
    backdropFilter: 'blur(20px)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoCircles: {
    position: 'relative',
    width: '28px',
    height: '28px',
  },
  logoCircle1: {
    position: 'absolute',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: '#8B6F5C',
    top: '0',
    left: '0',
  },
  logoCircle2: {
    position: 'absolute',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#A67B5B',
    top: '6px',
    left: '10px',
  },
  logoCircle3: {
    position: 'absolute',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#D4A574',
    top: '14px',
    left: '4px',
  },
  logoText: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '20px',
    fontWeight: '600',
    color: '#5C4033',
  },
  nav: {
    display: 'flex',
    gap: '8px',
  },
  navLink: {
    padding: '10px 20px',
    color: '#6B5344',
    textDecoration: 'none',
    fontSize: '14px',
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
  },
  profileAvatar: {
    fontSize: '32px',
  },
  main: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '24px 48px 60px',
  },
  profileBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
    marginBottom: '28px',
    border: '1px solid rgba(139, 111, 92, 0.1)',
  },
  bannerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  progressCircle: {},
  bannerText: {
    display: 'flex',
    flexDirection: 'column',
  },
  bannerTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  bannerSubtitle: {
    fontSize: '13px',
    color: '#8B7355',
  },
  bannerBtn: {
    padding: '10px 20px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  titleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px',
  },
  titleIcon: {
    fontSize: '40px',
  },
  pageTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '32px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  subtitle: {
    fontSize: '15px',
    color: '#8B7355',
  },
  section: {
    marginBottom: '40px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  sectionTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '20px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '12px',
  },
  sectionSubtitle: {
    fontSize: '14px',
    color: '#8B7355',
    marginBottom: '16px',
  },
  seeAllBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B6F5C',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  vibeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
  },
  vibeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    border: '2px solid rgba(139, 111, 92, 0.1)',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    fontFamily: '"DM Sans", sans-serif',
  },
  vibeIcon: {
    fontSize: '32px',
    marginBottom: '10px',
  },
  vibeLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '4px',
    textAlign: 'center',
  },
  vibeDesc: {
    fontSize: '11px',
    color: '#8B7355',
    textAlign: 'center',
  },
  vibeCheck: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    color: 'white',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginBottom: '40px',
  },
  actionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    border: '2px dashed rgba(139, 111, 92, 0.2)',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  actionIconWrap: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: '24px',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '2px',
  },
  actionDesc: {
    fontSize: '13px',
    color: '#8B7355',
  },
  actionArrow: {
    fontSize: '20px',
    color: '#8B6F5C',
  },
  meetupsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  meetupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(139, 111, 92, 0.08)',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  meetupHeader: {
    padding: '16px',
    position: 'relative',
  },
  newBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#5C4033',
    marginBottom: '8px',
  },
  meetupTags: {
    display: 'flex',
    gap: '6px',
  },
  meetupTag: {
    padding: '4px 10px',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: '100px',
    fontSize: '11px',
    color: 'white',
    fontWeight: '500',
  },
  meetupBody: {
    padding: '16px',
  },
  meetupTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '10px',
    lineHeight: '1.3',
  },
  meetupMeta: {
    display: 'flex',
    gap: '12px',
    marginBottom: '14px',
  },
  meetupDate: {
    fontSize: '12px',
    color: '#6B5344',
  },
  meetupTime: {
    fontSize: '12px',
    color: '#6B5344',
  },
  meetupFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendeeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  attendeeAvatars: {
    display: 'flex',
  },
  miniAvatar: {
    fontSize: '18px',
    backgroundColor: 'white',
    borderRadius: '50%',
    padding: '2px',
    border: '2px solid white',
  },
  attendeeCount: {
    fontSize: '12px',
    color: '#8B7355',
  },
  joinBtn: {
    padding: '8px 20px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  groupsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  groupCard: {
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.06)',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  groupName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '14px',
  },
  groupMembers: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  memberAvatars: {
    display: 'flex',
    alignItems: 'center',
  },
  groupAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    border: '2px solid white',
    position: 'relative',
  },
  emptySpot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    border: '2px dashed rgba(139, 111, 92, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '600',
    color: '#8B7355',
    marginLeft: '-10px',
  },
  memberCount: {
    fontSize: '12px',
    color: '#8B7355',
  },
  claimBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  claimBtnFull: {
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    color: '#8B7355',
    cursor: 'not-allowed',
  },
  suggestBtn: {
    padding: '8px 16px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    border: 'none',
    borderRadius: '100px',
    color: '#5C4033',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  wishlistGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  wishlistCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '14px',
    border: '1px solid rgba(139, 111, 92, 0.08)',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  wishlistContent: {
    flex: 1,
  },
  wishlistCategory: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#A67B5B',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  wishlistTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
    margin: '4px 0',
  },
  wishlistVotes: {
    fontSize: '12px',
    color: '#8B7355',
  },
  wishlistActions: {
    display: 'flex',
    gap: '10px',
  },
  hostBtn: {
    padding: '8px 16px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  meTooBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1.5px solid rgba(139, 111, 92, 0.25)',
    borderRadius: '100px',
    color: '#5C4033',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  meTooIcon: {
    fontSize: '14px',
  },
  peopleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
  },
  personCard: {
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.06)',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  personTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  personAvatar: {
    fontSize: '36px',
  },
  personInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  personName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  personRole: {
    fontSize: '12px',
    color: '#8B7355',
  },
  matchReason: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '10px',
  },
  matchIcon: {
    fontSize: '12px',
  },
  matchText: {
    fontSize: '12px',
    color: '#6B5344',
    fontStyle: 'italic',
  },
  mutualBadge: {
    fontSize: '11px',
    color: '#8B7355',
    marginBottom: '14px',
  },
  connectBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: 'transparent',
    border: '1.5px solid #8B6F5C',
    borderRadius: '10px',
    color: '#8B6F5C',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  ctaCard: {
    padding: '24px 20px',
    backgroundColor: 'rgba(139, 111, 92, 0.06)',
    borderRadius: '16px',
    border: '2px dashed rgba(139, 111, 92, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  ctaIcon: {
    fontSize: '32px',
    marginBottom: '10px',
  },
  ctaTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#5C4033',
    marginBottom: '4px',
  },
  ctaText: {
    fontSize: '12px',
    color: '#8B7355',
    marginBottom: '14px',
    lineHeight: '1.4',
  },
  ctaBtn: {
    padding: '10px 20px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
};

export default DiscoverPage;

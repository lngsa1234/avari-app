import React, { useState } from 'react';

const MeetupsPage = () => {
  const [activeView, setActiveView] = useState('upcoming');
  const [activeFilter, setActiveFilter] = useState('all');

  const coffeChats = [
    { 
      id: 1, 
      type: 'coffee',
      with: 'Sarah Chen', 
      avatar: '👩🏻', 
      role: 'Mentor @ Google',
      date: 'Tomorrow',
      time: '10:00 AM',
      duration: '30 min',
      location: 'Zoom',
      status: 'confirmed',
      topic: 'Career transition to PM',
      mutualCircles: ['Women in Tech', 'Career Pivoters']
    },
    { 
      id: 2, 
      type: 'coffee',
      with: 'Maya Patel', 
      avatar: '👩🏽', 
      role: 'Founder @ StartupX',
      date: 'Thu, Jan 30',
      time: '2:00 PM',
      duration: '45 min',
      location: 'Blue Bottle Coffee, SF',
      status: 'pending',
      topic: 'Startup fundraising advice',
      mutualCircles: ['Founder\'s Journey']
    },
  ];

  const groupEvents = [
    {
      id: 3,
      type: 'group',
      title: 'Women in Tech Monthly Mixer',
      emoji: '💼',
      host: 'Women in Tech Circle',
      date: 'Sat, Feb 1',
      time: '6:00 PM',
      duration: '2 hours',
      location: 'The Innovation Hub, Detroit',
      attendees: 24,
      maxAttendees: 30,
      status: 'going',
      description: 'Network with fellow women in tech over drinks and appetizers.',
      tags: ['Networking', 'In-Person']
    },
    {
      id: 4,
      type: 'group',
      title: 'Pitch Practice Workshop',
      emoji: '🚀',
      host: 'Founder\'s Journey Circle',
      date: 'Wed, Feb 5',
      time: '12:00 PM',
      duration: '1.5 hours',
      location: 'Zoom',
      attendees: 12,
      maxAttendees: 15,
      status: 'interested',
      description: 'Practice your startup pitch and get feedback from fellow founders.',
      tags: ['Workshop', 'Virtual']
    },
    {
      id: 5,
      type: 'group',
      title: 'Morning Accountability Circle',
      emoji: '☀️',
      host: 'Working Moms Circle',
      date: 'Every Monday',
      time: '7:00 AM',
      duration: '30 min',
      location: 'Zoom',
      attendees: 8,
      maxAttendees: 10,
      status: 'going',
      description: 'Start your week with intention. Share goals and support each other.',
      tags: ['Recurring', 'Virtual']
    },
  ];

  const pastMeetups = [
    {
      id: 101,
      type: 'coffee',
      with: 'Jordan Brooks',
      avatar: '👩🏿',
      date: 'Jan 20',
      topic: 'Leadership coaching session',
      notes: 'Discussed imposter syndrome strategies',
      followUp: true
    },
    {
      id: 102,
      type: 'group',
      title: 'New Year Goal Setting Workshop',
      emoji: '🎯',
      date: 'Jan 15',
      attendees: 18,
      highlight: 'Set Q1 career goals'
    },
  ];

  const allUpcoming = [...coffeChats, ...groupEvents].sort((a, b) => a.id - b.id);

  const filteredItems = activeFilter === 'all' 
    ? allUpcoming 
    : activeFilter === 'coffee' 
      ? coffeChats 
      : groupEvents;

  const getStatusStyle = (status) => {
    switch(status) {
      case 'confirmed':
      case 'going':
        return { bg: 'rgba(76, 175, 80, 0.1)', color: '#2E7D32', text: status === 'confirmed' ? '✓ Confirmed' : '✓ Going' };
      case 'pending':
        return { bg: 'rgba(255, 167, 38, 0.1)', color: '#E65100', text: '⏳ Pending' };
      case 'interested':
        return { bg: 'rgba(139, 111, 92, 0.1)', color: '#5C4033', text: '♡ Interested' };
      default:
        return { bg: 'rgba(139, 111, 92, 0.1)', color: '#5C4033', text: status };
    }
  };

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
          <a href="#" style={styles.navLink}>Discover</a>
          <a href="#" style={styles.navLink}>Circles</a>
          <a href="#" style={{...styles.navLink, ...styles.navLinkActive}}>Meetups</a>
          <a href="#" style={styles.navLink}>Profile</a>
        </nav>
        <div style={styles.headerRight}>
          <span style={styles.profileAvatar}>👩🏻‍💻</span>
        </div>
      </header>

      <main style={styles.main}>
        {/* Page Title Section */}
        <section style={styles.titleSection}>
          <div style={styles.titleLeft}>
            <h1 style={styles.pageTitle}>Meetups</h1>
            <p style={styles.subtitle}>Your upcoming connections & events</p>
          </div>
          <button style={styles.scheduleBtn}>
            <span style={styles.scheduleBtnIcon}>+</span>
            Schedule a Coffee Chat
          </button>
        </section>

        {/* Quick Stats */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>☕</div>
            <div style={styles.statInfo}>
              <span style={styles.statNumber}>{coffeChats.length}</span>
              <span style={styles.statLabel}>Coffee Chats</span>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>🎉</div>
            <div style={styles.statInfo}>
              <span style={styles.statNumber}>{groupEvents.length}</span>
              <span style={styles.statLabel}>Group Events</span>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>📅</div>
            <div style={styles.statInfo}>
              <span style={styles.statNumber}>5</span>
              <span style={styles.statLabel}>This Month</span>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>🤝</div>
            <div style={styles.statInfo}>
              <span style={styles.statNumber}>23</span>
              <span style={styles.statLabel}>All Time</span>
            </div>
          </div>
        </div>

        {/* View Toggle & Filters */}
        <div style={styles.controlsRow}>
          <div style={styles.viewToggle}>
            <button 
              style={{...styles.viewBtn, ...(activeView === 'upcoming' ? styles.viewBtnActive : {})}}
              onClick={() => setActiveView('upcoming')}
            >
              Upcoming
            </button>
            <button 
              style={{...styles.viewBtn, ...(activeView === 'past' ? styles.viewBtnActive : {})}}
              onClick={() => setActiveView('past')}
            >
              Past
            </button>
          </div>
          
          {activeView === 'upcoming' && (
            <div style={styles.filterTabs}>
              {[
                { key: 'all', label: 'All', icon: '📋' },
                { key: 'coffee', label: 'Coffee Chats', icon: '☕' },
                { key: 'group', label: 'Group Events', icon: '👥' },
              ].map(filter => (
                <button
                  key={filter.key}
                  style={{...styles.filterTab, ...(activeFilter === filter.key ? styles.filterTabActive : {})}}
                  onClick={() => setActiveFilter(filter.key)}
                >
                  <span style={styles.filterIcon}>{filter.icon}</span>
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        {activeView === 'upcoming' ? (
          <div style={styles.meetupsList}>
            {filteredItems.map((item, index) => (
              item.type === 'coffee' ? (
                // Coffee Chat Card
                <div key={item.id} style={{...styles.meetupCard, animationDelay: `${index * 0.1}s`}}>
                  <div style={styles.cardLeft}>
                    <div style={styles.coffeeIcon}>☕</div>
                  </div>
                  
                  <div style={styles.cardContent}>
                    <div style={styles.cardHeader}>
                      <div style={styles.cardType}>Coffee Chat</div>
                      <div style={{
                        ...styles.statusBadge,
                        backgroundColor: getStatusStyle(item.status).bg,
                        color: getStatusStyle(item.status).color
                      }}>
                        {getStatusStyle(item.status).text}
                      </div>
                    </div>
                    
                    <div style={styles.personRow}>
                      <span style={styles.personAvatar}>{item.avatar}</span>
                      <div style={styles.personInfo}>
                        <span style={styles.personName}>{item.with}</span>
                        <span style={styles.personRole}>{item.role}</span>
                      </div>
                    </div>
                    
                    <div style={styles.topicRow}>
                      <span style={styles.topicLabel}>Topic:</span>
                      <span style={styles.topicText}>{item.topic}</span>
                    </div>
                    
                    <div style={styles.mutualCircles}>
                      {item.mutualCircles.map((circle, i) => (
                        <span key={i} style={styles.mutualTag}>{circle}</span>
                      ))}
                    </div>
                  </div>
                  
                  <div style={styles.cardRight}>
                    <div style={styles.dateBlock}>
                      <span style={styles.dateDay}>{item.date}</span>
                      <span style={styles.dateTime}>{item.time}</span>
                      <span style={styles.dateDuration}>{item.duration}</span>
                    </div>
                    <div style={styles.locationBlock}>
                      <span style={styles.locationIcon}>{item.location.includes('Zoom') ? '💻' : '📍'}</span>
                      <span style={styles.locationText}>{item.location}</span>
                    </div>
                    <div style={styles.cardActions}>
                      <button style={styles.actionBtnPrimary}>Join</button>
                      <button style={styles.actionBtnSecondary}>Reschedule</button>
                    </div>
                  </div>
                </div>
              ) : (
                // Group Event Card
                <div key={item.id} style={{...styles.meetupCard, ...styles.groupCard, animationDelay: `${index * 0.1}s`}}>
                  <div style={styles.cardLeft}>
                    <div style={styles.groupIcon}>{item.emoji}</div>
                  </div>
                  
                  <div style={styles.cardContent}>
                    <div style={styles.cardHeader}>
                      <div style={styles.cardTypeGroup}>Group Event</div>
                      <div style={{
                        ...styles.statusBadge,
                        backgroundColor: getStatusStyle(item.status).bg,
                        color: getStatusStyle(item.status).color
                      }}>
                        {getStatusStyle(item.status).text}
                      </div>
                    </div>
                    
                    <h3 style={styles.eventTitle}>{item.title}</h3>
                    <p style={styles.eventHost}>Hosted by {item.host}</p>
                    <p style={styles.eventDesc}>{item.description}</p>
                    
                    <div style={styles.tagsRow}>
                      {item.tags.map((tag, i) => (
                        <span key={i} style={styles.eventTag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  
                  <div style={styles.cardRight}>
                    <div style={styles.dateBlock}>
                      <span style={styles.dateDay}>{item.date}</span>
                      <span style={styles.dateTime}>{item.time}</span>
                      <span style={styles.dateDuration}>{item.duration}</span>
                    </div>
                    <div style={styles.locationBlock}>
                      <span style={styles.locationIcon}>{item.location.includes('Zoom') ? '💻' : '📍'}</span>
                      <span style={styles.locationText}>{item.location}</span>
                    </div>
                    <div style={styles.attendeesBlock}>
                      <div style={styles.attendeeAvatars}>
                        <span style={styles.miniAvatar}>👩🏻</span>
                        <span style={{...styles.miniAvatar, marginLeft: '-8px'}}>👩🏽</span>
                        <span style={{...styles.miniAvatar, marginLeft: '-8px'}}>👩🏿</span>
                        <span style={styles.moreCount}>+{item.attendees - 3}</span>
                      </div>
                      <span style={styles.attendeeText}>{item.attendees}/{item.maxAttendees} attending</span>
                    </div>
                    <div style={styles.cardActions}>
                      {item.status === 'going' ? (
                        <button style={styles.actionBtnGoing}>✓ You're Going</button>
                      ) : (
                        <button style={styles.actionBtnPrimary}>RSVP</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        ) : (
          // Past Meetups
          <div style={styles.pastList}>
            {pastMeetups.map((item, index) => (
              <div key={item.id} style={{...styles.pastCard, animationDelay: `${index * 0.1}s`}}>
                <div style={styles.pastIcon}>
                  {item.type === 'coffee' ? '☕' : item.emoji}
                </div>
                <div style={styles.pastContent}>
                  <div style={styles.pastHeader}>
                    <span style={styles.pastType}>
                      {item.type === 'coffee' ? `Coffee with ${item.with}` : item.title}
                    </span>
                    <span style={styles.pastDate}>{item.date}</span>
                  </div>
                  <p style={styles.pastDetail}>
                    {item.type === 'coffee' ? item.topic : `${item.attendees} attended`}
                  </p>
                  {item.notes && (
                    <p style={styles.pastNotes}>📝 {item.notes}</p>
                  )}
                </div>
                <div style={styles.pastActions}>
                  {item.followUp && (
                    <button style={styles.followUpBtn}>Schedule Follow-up</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Suggested Events */}
        <section style={styles.suggestedSection}>
          <h2 style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>✨</span>
            Suggested for You
          </h2>
          <div style={styles.suggestedGrid}>
            <div style={styles.suggestedCard}>
              <div style={styles.suggestedEmoji}>🧘‍♀️</div>
              <div style={styles.suggestedInfo}>
                <h4 style={styles.suggestedTitle}>Mindful Leadership</h4>
                <p style={styles.suggestedMeta}>Working Moms Circle · Feb 10</p>
              </div>
              <button style={styles.suggestedBtn}>View</button>
            </div>
            <div style={styles.suggestedCard}>
              <div style={styles.suggestedEmoji}>💡</div>
              <div style={styles.suggestedInfo}>
                <h4 style={styles.suggestedTitle}>AI in Product Workshop</h4>
                <p style={styles.suggestedMeta}>Women in Tech · Feb 12</p>
              </div>
              <button style={styles.suggestedBtn}>View</button>
            </div>
            <div style={styles.suggestedCard}>
              <div style={styles.suggestedEmoji}>🎤</div>
              <div style={styles.suggestedInfo}>
                <h4 style={styles.suggestedTitle}>Public Speaking Bootcamp</h4>
                <p style={styles.suggestedMeta}>Career Pivoters · Feb 15</p>
              </div>
              <button style={styles.suggestedBtn}>View</button>
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
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px 48px',
  },
  titleSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px',
  },
  titleLeft: {},
  pageTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '36px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#8B7355',
  },
  scheduleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 24px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 16px rgba(139, 111, 92, 0.25)',
  },
  scheduleBtnIcon: {
    fontSize: '18px',
    fontWeight: '400',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '28px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '18px 20px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.06)',
  },
  statIcon: {
    fontSize: '28px',
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  statNumber: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '24px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  statLabel: {
    fontSize: '12px',
    color: '#8B7355',
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  viewToggle: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    borderRadius: '12px',
  },
  viewBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#8B7355',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.2s ease',
  },
  viewBtnActive: {
    backgroundColor: 'white',
    color: '#5C4033',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  filterTabs: {
    display: 'flex',
    gap: '8px',
  },
  filterTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#6B5344',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(139, 111, 92, 0.15)',
    borderRadius: '100px',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.2s ease',
  },
  filterTabActive: {
    backgroundColor: '#5C4033',
    color: 'white',
    borderColor: '#5C4033',
  },
  filterIcon: {
    fontSize: '14px',
  },
  meetupsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '40px',
  },
  meetupCard: {
    display: 'flex',
    gap: '20px',
    padding: '24px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '20px',
    boxShadow: '0 4px 20px rgba(139, 111, 92, 0.08)',
    border: '1px solid rgba(139, 111, 92, 0.08)',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  groupCard: {
    borderLeft: '4px solid #A67B5B',
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'flex-start',
  },
  coffeeIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #D4A574 0%, #C4956A 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
  },
  groupIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #8B6F5C 0%, #6B4423 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  cardType: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#C4956A',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardTypeGroup: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#8B6F5C',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: '600',
  },
  personRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  personAvatar: {
    fontSize: '40px',
  },
  personInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  personName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  personRole: {
    fontSize: '13px',
    color: '#8B7355',
  },
  topicRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '10px',
  },
  topicLabel: {
    fontSize: '13px',
    color: '#8B7355',
  },
  topicText: {
    fontSize: '13px',
    color: '#5C4033',
    fontWeight: '500',
  },
  mutualCircles: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  mutualTag: {
    padding: '4px 10px',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    borderRadius: '100px',
    fontSize: '11px',
    color: '#6B5344',
  },
  eventTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '20px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '4px',
  },
  eventHost: {
    fontSize: '13px',
    color: '#8B7355',
    marginBottom: '8px',
  },
  eventDesc: {
    fontSize: '14px',
    color: '#5C4033',
    lineHeight: '1.5',
    marginBottom: '12px',
  },
  tagsRow: {
    display: 'flex',
    gap: '8px',
  },
  eventTag: {
    padding: '4px 10px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    borderRadius: '100px',
    fontSize: '11px',
    color: '#5C4033',
    fontWeight: '500',
  },
  cardRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '12px',
    minWidth: '160px',
  },
  dateBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  dateDay: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  dateTime: {
    fontSize: '14px',
    color: '#5C4033',
  },
  dateDuration: {
    fontSize: '12px',
    color: '#A89080',
  },
  locationBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  locationIcon: {
    fontSize: '14px',
  },
  locationText: {
    fontSize: '12px',
    color: '#6B5344',
  },
  attendeesBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  attendeeAvatars: {
    display: 'flex',
    alignItems: 'center',
  },
  miniAvatar: {
    fontSize: '18px',
    backgroundColor: 'white',
    borderRadius: '50%',
    padding: '2px',
  },
  moreCount: {
    marginLeft: '4px',
    fontSize: '11px',
    color: '#8B7355',
    fontWeight: '500',
  },
  attendeeText: {
    fontSize: '11px',
    color: '#8B7355',
  },
  cardActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: 'auto',
  },
  actionBtnPrimary: {
    padding: '10px 24px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  actionBtnGoing: {
    padding: '10px 24px',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    border: '1px solid rgba(76, 175, 80, 0.3)',
    borderRadius: '10px',
    color: '#2E7D32',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  actionBtnSecondary: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B7355',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  pastList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '40px',
  },
  pastCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '18px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '16px',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
  },
  pastIcon: {
    fontSize: '24px',
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    borderRadius: '12px',
  },
  pastContent: {
    flex: 1,
  },
  pastHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  pastType: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  pastDate: {
    fontSize: '13px',
    color: '#8B7355',
  },
  pastDetail: {
    fontSize: '13px',
    color: '#6B5344',
  },
  pastNotes: {
    fontSize: '12px',
    color: '#8B7355',
    marginTop: '6px',
    fontStyle: 'italic',
  },
  pastActions: {},
  followUpBtn: {
    padding: '8px 16px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    border: 'none',
    borderRadius: '100px',
    color: '#5C4033',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  suggestedSection: {
    padding: '28px',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: '24px',
    border: '1px solid rgba(139, 111, 92, 0.08)',
  },
  sectionTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '20px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  sectionIcon: {
    fontSize: '18px',
  },
  suggestedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  suggestedCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '14px',
    border: '1px solid rgba(139, 111, 92, 0.1)',
  },
  suggestedEmoji: {
    fontSize: '28px',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    borderRadius: '12px',
  },
  suggestedInfo: {
    flex: 1,
  },
  suggestedTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '2px',
  },
  suggestedMeta: {
    fontSize: '12px',
    color: '#8B7355',
  },
  suggestedBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1.5px solid rgba(139, 111, 92, 0.3)',
    borderRadius: '100px',
    color: '#5C4033',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
};

export default MeetupsPage;

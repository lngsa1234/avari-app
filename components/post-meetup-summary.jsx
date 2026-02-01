import React, { useState } from 'react';

const PostMeetupSummary = () => {
  const [activeTab, setActiveTab] = useState('summary');
  const [rating, setRating] = useState(0);
  const [followedUp, setFollowedUp] = useState([]);

  const meetup = {
    title: 'Michigan Networking Coffee Chat',
    date: 'Thu, Jan 23, 2025',
    time: '10:00 AM - 11:30 AM',
    location: 'Blue Bottle Coffee, Detroit',
    type: 'In-Person',
    host: 'Sarah Chen',
    hostAvatar: '👩🏻',
    circle: 'Women in Tech',
  };

  const attendees = [
    { id: 1, name: 'Sarah Chen', avatar: '👩🏻', role: 'Host · PM @ Google', connected: true },
    { id: 2, name: 'Maya Patel', avatar: '👩🏽', role: 'Founder @ StartupX', connected: true },
    { id: 3, name: 'Jordan Brooks', avatar: '👩🏿', role: 'Executive Coach', connected: false },
    { id: 4, name: 'Emma Wilson', avatar: '👩🏼', role: 'UX Designer', connected: false },
  ];

  const highlights = [
    { icon: '💬', text: 'Discussed career transitions into product management' },
    { icon: '📚', text: 'Sarah shared "Inspired" book recommendation' },
    { icon: '🎯', text: 'Group agreed to do mock interviews next month' },
  ];

  const toggleFollowUp = (id) => {
    setFollowedUp(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <button style={styles.backBtn}>← Back to Meetups</button>
        <span style={styles.headerTitle}>Meetup Recap</span>
        <div style={styles.headerRight}></div>
      </header>

      <main style={styles.main}>
        {/* Meetup Card */}
        <div style={styles.meetupCard}>
          <div style={styles.meetupBadge}>☕ Coffee Chat</div>
          <h1 style={styles.meetupTitle}>{meetup.title}</h1>
          
          <div style={styles.meetupMeta}>
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>📅</span>
              <span>{meetup.date}</span>
            </div>
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>🕐</span>
              <span>{meetup.time}</span>
            </div>
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>📍</span>
              <span>{meetup.location}</span>
            </div>
          </div>

          <div style={styles.hostRow}>
            <span style={styles.hostAvatar}>{meetup.hostAvatar}</span>
            <div style={styles.hostInfo}>
              <span style={styles.hostLabel}>Hosted by</span>
              <span style={styles.hostName}>{meetup.host}</span>
            </div>
            <span style={styles.circleBadge}>{meetup.circle}</span>
          </div>
        </div>

        {/* Stats Row */}
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <span style={styles.statNumber}>{attendees.length}</span>
            <span style={styles.statLabel}>Attended</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statNumber}>90</span>
            <span style={styles.statLabel}>Minutes</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statNumber}>{attendees.filter(a => a.connected).length}</span>
            <span style={styles.statLabel}>Connected</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={styles.tabRow}>
          {['summary', 'people', 'notes'].map(tab => (
            <button
              key={tab}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : {})
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'summary' && '✨ '}
              {tab === 'people' && '👥 '}
              {tab === 'notes' && '📝 '}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'summary' && (
          <div style={styles.tabContent}>
            {/* Highlights */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Key Highlights</h3>
              <div style={styles.highlightsList}>
                {highlights.map((h, i) => (
                  <div key={i} style={styles.highlightItem}>
                    <span style={styles.highlightIcon}>{h.icon}</span>
                    <span style={styles.highlightText}>{h.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rate Experience */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>How was it?</h3>
              <div style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    style={{
                      ...styles.starBtn,
                      ...(rating >= star ? styles.starActive : {})
                    }}
                    onClick={() => setRating(star)}
                  >
                    {rating >= star ? '★' : '☆'}
                  </button>
                ))}
                <span style={styles.ratingLabel}>
                  {rating === 0 && 'Tap to rate'}
                  {rating === 1 && 'Not great'}
                  {rating === 2 && 'Okay'}
                  {rating === 3 && 'Good'}
                  {rating === 4 && 'Great!'}
                  {rating === 5 && 'Amazing!'}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={styles.actionsRow}>
              <button style={styles.actionBtn}>
                <span>📸</span> Add Photos
              </button>
              <button style={styles.actionBtn}>
                <span>🔁</span> Attend Again
              </button>
            </div>
          </div>
        )}

        {activeTab === 'people' && (
          <div style={styles.tabContent}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>People You Met</h3>
              <p style={styles.sectionSub}>Follow up to strengthen your connection</p>
              
              <div style={styles.peopleList}>
                {attendees.map(person => (
                  <div key={person.id} style={styles.personRow}>
                    <span style={styles.personAvatar}>{person.avatar}</span>
                    <div style={styles.personInfo}>
                      <span style={styles.personName}>{person.name}</span>
                      <span style={styles.personRole}>{person.role}</span>
                    </div>
                    <div style={styles.personActions}>
                      {person.connected ? (
                        <span style={styles.connectedBadge}>✓ Connected</span>
                      ) : (
                        <button style={styles.connectBtn}>Connect</button>
                      )}
                      <button 
                        style={{
                          ...styles.followUpBtn,
                          ...(followedUp.includes(person.id) ? styles.followUpDone : {})
                        }}
                        onClick={() => toggleFollowUp(person.id)}
                      >
                        {followedUp.includes(person.id) ? '✓ Sent' : '💬 Follow up'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div style={styles.tabContent}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Your Notes</h3>
              <p style={styles.sectionSub}>Capture takeaways for yourself</p>
              
              <textarea 
                style={styles.notesInput}
                placeholder="What did you learn? Who do you want to follow up with? Any action items?"
                rows={5}
              />
              
              <div style={styles.noteTips}>
                <span style={styles.tipTitle}>💡 Prompt ideas:</span>
                <div style={styles.tipTags}>
                  <span style={styles.tipTag}>Key takeaway</span>
                  <span style={styles.tipTag}>Follow-up action</span>
                  <span style={styles.tipTag}>Resource shared</span>
                  <span style={styles.tipTag}>Question to explore</span>
                </div>
              </div>

              <button style={styles.saveBtn}>Save Notes</button>
            </div>
          </div>
        )}

        {/* Next Meetup Suggestion */}
        <div style={styles.nextMeetup}>
          <div style={styles.nextContent}>
            <span style={styles.nextLabel}>Up Next from {meetup.circle}</span>
            <span style={styles.nextTitle}>Tech Interview Prep Workshop</span>
            <span style={styles.nextDate}>Fri, Feb 7 · 12:00 PM</span>
          </div>
          <button style={styles.rsvpBtn}>RSVP</button>
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    maxWidth: '540px',
    margin: '0 auto',
    background: 'linear-gradient(180deg, #FDF8F3 0%, #F5EDE6 100%)',
    fontFamily: '"DM Sans", sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    backgroundColor: 'rgba(253,248,243,0.95)',
    borderBottom: '1px solid rgba(139,111,92,0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#8B6F5C',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  headerTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  headerRight: {
    width: '80px',
  },
  main: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  meetupCard: {
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(139,111,92,0.08)',
  },
  meetupBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: 'rgba(139,111,92,0.1)',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#6B5344',
    marginBottom: '10px',
  },
  meetupTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '22px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '14px',
    lineHeight: '1.3',
  },
  meetupMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '16px',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#5C4033',
  },
  metaIcon: {
    fontSize: '14px',
  },
  hostRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingTop: '14px',
    borderTop: '1px solid rgba(139,111,92,0.1)',
  },
  hostAvatar: {
    fontSize: '32px',
  },
  hostInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  hostLabel: {
    fontSize: '10px',
    color: '#8B7355',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  hostName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  circleBadge: {
    padding: '6px 12px',
    backgroundColor: 'rgba(139,111,92,0.08)',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: '500',
    color: '#6B5344',
  },
  statsRow: {
    display: 'flex',
    gap: '12px',
  },
  statBox: {
    flex: 1,
    padding: '14px',
    backgroundColor: 'white',
    borderRadius: '12px',
    textAlign: 'center',
    boxShadow: '0 1px 4px rgba(139,111,92,0.06)',
  },
  statNumber: {
    display: 'block',
    fontFamily: '"Playfair Display", serif',
    fontSize: '24px',
    fontWeight: '600',
    color: '#5C4033',
  },
  statLabel: {
    fontSize: '11px',
    color: '#8B7355',
  },
  tabRow: {
    display: 'flex',
    gap: '6px',
    padding: '4px',
    backgroundColor: 'rgba(139,111,92,0.08)',
    borderRadius: '12px',
  },
  tab: {
    flex: 1,
    padding: '10px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#8B7355',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    backgroundColor: 'white',
    color: '#5C4033',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  section: {
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '14px',
    boxShadow: '0 1px 4px rgba(139,111,92,0.06)',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '4px',
  },
  sectionSub: {
    fontSize: '12px',
    color: '#8B7355',
    marginBottom: '12px',
  },
  highlightsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  highlightItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: 'rgba(139,111,92,0.04)',
    borderRadius: '10px',
  },
  highlightIcon: {
    fontSize: '16px',
  },
  highlightText: {
    fontSize: '13px',
    color: '#3D2B1F',
    lineHeight: '1.4',
  },
  ratingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  starBtn: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    color: '#D4C4B5',
    cursor: 'pointer',
    padding: '4px',
    transition: 'transform 0.2s ease',
  },
  starActive: {
    color: '#D4A574',
  },
  ratingLabel: {
    marginLeft: '12px',
    fontSize: '13px',
    color: '#8B7355',
    fontWeight: '500',
  },
  actionsRow: {
    display: 'flex',
    gap: '10px',
  },
  actionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'white',
    border: '1.5px solid rgba(139,111,92,0.15)',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#5C4033',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  peopleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  personRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'rgba(139,111,92,0.04)',
    borderRadius: '12px',
  },
  personAvatar: {
    fontSize: '36px',
  },
  personInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  personName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  personRole: {
    fontSize: '11px',
    color: '#8B7355',
  },
  personActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'flex-end',
  },
  connectedBadge: {
    fontSize: '11px',
    color: '#4CAF50',
    fontWeight: '500',
  },
  connectBtn: {
    padding: '6px 14px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  followUpBtn: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(139,111,92,0.2)',
    borderRadius: '100px',
    color: '#6B5344',
    fontSize: '10px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  followUpDone: {
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderColor: 'rgba(76,175,80,0.3)',
    color: '#4CAF50',
  },
  notesInput: {
    width: '100%',
    padding: '14px',
    backgroundColor: 'rgba(139,111,92,0.04)',
    border: '1px solid rgba(139,111,92,0.1)',
    borderRadius: '12px',
    fontSize: '14px',
    fontFamily: '"DM Sans", sans-serif',
    color: '#3D2B1F',
    resize: 'none',
    outline: 'none',
    marginBottom: '12px',
  },
  noteTips: {
    marginBottom: '14px',
  },
  tipTitle: {
    display: 'block',
    fontSize: '12px',
    color: '#8B7355',
    marginBottom: '8px',
  },
  tipTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  tipTag: {
    padding: '5px 10px',
    backgroundColor: 'rgba(139,111,92,0.08)',
    borderRadius: '100px',
    fontSize: '11px',
    color: '#6B5344',
    cursor: 'pointer',
  },
  saveBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  nextMeetup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    background: 'linear-gradient(135deg, #5C4033 0%, #8B6F5C 100%)',
    borderRadius: '14px',
  },
  nextContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  nextLabel: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  nextTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'white',
  },
  nextDate: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.8)',
  },
  rsvpBtn: {
    padding: '10px 20px',
    backgroundColor: 'white',
    border: 'none',
    borderRadius: '100px',
    color: '#5C4033',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
};

export default PostMeetupSummary;

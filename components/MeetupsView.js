// components/MeetupsView.js
// Meetups page - Coffee chats and group events combined
// UX design based on meetups-page.jsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Video, Calendar, MapPin, Clock, Users, Plus } from 'lucide-react';

export default function MeetupsView({ currentUser, supabase, connections = [], meetups = [], userSignups = [], onNavigate }) {
  const [activeView, setActiveView] = useState('upcoming');
  const [activeFilter, setActiveFilter] = useState('all');
  const [coffeeChats, setCoffeeChats] = useState([]);
  const [groupEvents, setGroupEvents] = useState([]);
  const [pastMeetups, setPastMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState({
    coffeeChats: 0,
    circleInvites: 0
  });

  useEffect(() => {
    loadData();
  }, [currentUser.id, meetups, userSignups]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadCoffeeChats(),
      loadGroupEvents(),
      loadPastMeetups(),
      loadPendingRequests()
    ]);
    setLoading(false);
  };

  const loadCoffeeChats = useCallback(async () => {
    try {
      // Load all coffee chats for the user
      const { data, error } = await supabase
        .from('coffee_chats')
        .select(`
          id,
          requester_id,
          recipient_id,
          status,
          scheduled_time,
          notes,
          room_url,
          created_at
        `)
        .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .in('status', ['pending', 'accepted', 'scheduled'])
        .order('scheduled_time', { ascending: true });

      if (error) {
        // Silently handle missing table - feature not yet set up
        if (error.message.includes('does not exist') || error.code === '42P01') {
          setCoffeeChats([]);
          return;
        }
        console.log('Coffee chats error:', error.message);
        setCoffeeChats([]);
        return;
      }

      // Filter to only upcoming chats (client-side filter)
      // Allow 1 hour grace period for recently started chats
      const now = new Date();
      const gracePeriod = new Date(now.getTime() - 60 * 60 * 1000);

      const upcomingChats = (data || []).filter(chat => {
        if (!chat.scheduled_time) return false;
        const chatTime = new Date(chat.scheduled_time);
        return chatTime >= gracePeriod;
      });

      // Get profile info for the other person in each chat
      const otherUserIds = upcomingChats.map(chat =>
        chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id
      );

      let profiles = [];
      if (otherUserIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, name, career, profile_picture')
          .in('id', otherUserIds);
        profiles = profileData || [];
      }

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const chatsWithProfiles = upcomingChats.map(chat => {
        const otherId = chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id;
        const profile = profileMap.get(otherId);
        // Extract date and time from scheduled_time timestamp
        const scheduledDate = chat.scheduled_time ? new Date(chat.scheduled_time) : null;
        return {
          ...chat,
          type: 'coffee',
          with: profile?.name || 'Unknown',
          avatar: profile?.profile_picture,
          role: profile?.career || 'Professional',
          date: scheduledDate ? formatDate(scheduledDate.toISOString()) : 'TBD',
          time: scheduledDate ? formatTime(scheduledDate.toTimeString().slice(0, 5)) : 'TBD',
          duration: '30 min',
          scheduled_date: chat.scheduled_time // Keep for sorting
        };
      });

      setCoffeeChats(chatsWithProfiles);
    } catch (err) {
      console.error('Error loading coffee chats:', err);
      setCoffeeChats([]);
    }
  }, [currentUser.id, supabase]);

  const loadGroupEvents = useCallback(async () => {
    try {
      const signedUpMeetupIds = userSignups || [];

      // Fetch meetups user is signed up for OR created (for circle meetups)
      let query = supabase
        .from('meetups')
        .select('*, connection_groups(id, name)')
        .order('date', { ascending: true });

      // Get signed up meetups OR circle meetups created by user
      if (signedUpMeetupIds.length > 0) {
        query = query.or(`id.in.(${signedUpMeetupIds.join(',')}),created_by.eq.${currentUser.id}`);
      } else {
        query = query.eq('created_by', currentUser.id);
      }

      const { data: signedUpMeetups, error } = await query;

      if (error) {
        console.error('Error fetching signed up meetups:', error);
        setGroupEvents([]);
        return;
      }

      // Filter to upcoming ones
      const now = new Date();
      const upcomingEvents = (signedUpMeetups || []).filter(meetup => {
        try {
          let meetupDate;
          const dateStr = meetup.date;

          if (dateStr?.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            meetupDate = new Date(year, month - 1, day);
          } else if (dateStr) {
            const cleanDateStr = dateStr.replace(/^[A-Za-z]+,\s*/, '');
            meetupDate = new Date(`${cleanDateStr} ${new Date().getFullYear()}`);
          } else {
            return false;
          }

          if (meetup.time) {
            const [hours, minutes] = meetup.time.split(':').map(Number);
            meetupDate.setHours(hours, minutes, 0, 0);
          }

          // Include meetups within 4 hour grace period
          const gracePeriod = new Date(meetupDate.getTime() + (4 * 60 * 60 * 1000));
          return now < gracePeriod;
        } catch {
          return false;
        }
      }).map(meetup => {
        const isCircleMeetup = !!meetup.circle_id;
        const circleName = meetup.connection_groups?.name;

        return {
          ...meetup,
          type: 'group',
          title: meetup.topic || (isCircleMeetup ? `${circleName} Meetup` : 'Community Meetup'),
          emoji: isCircleMeetup ? '🔒' : getEventEmoji(meetup.topic),
          host: isCircleMeetup ? circleName : 'CircleW Community',
          originalDate: meetup.date,
          date: formatDate(meetup.date),
          time: formatTime(meetup.time),
          duration: `${meetup.duration || 60} min`,
          location: meetup.location || 'Virtual',
          attendees: meetup.signupCount || 0,
          maxAttendees: meetup.participantLimit || meetup.max_attendees || 100,
          status: 'going', // User is signed up
          description: meetup.description || (isCircleMeetup ? `Private meetup for ${circleName}` : 'Join us for meaningful connections.'),
          isCircleMeetup
        };
      });

      setGroupEvents(upcomingEvents);
    } catch (err) {
      console.error('Error loading group events:', err);
      setGroupEvents([]);
    }
  }, [userSignups, supabase]);

  const loadPastMeetups = useCallback(async () => {
    try {
      // Load all coffee chats for the user
      const { data, error } = await supabase
        .from('coffee_chats')
        .select('*')
        .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('scheduled_time', { ascending: false })
        .limit(20);

      if (error) {
        // Silently handle missing table
        if (error.message.includes('does not exist') || error.code === '42P01') {
          setPastMeetups([]);
          return;
        }
        console.log('Past meetups error:', error.message);
        setPastMeetups([]);
        return;
      }

      // Filter to only past chats (client-side)
      // Past = scheduled_time is before now (with 1 hour grace period)
      const now = new Date();
      const gracePeriod = new Date(now.getTime() - 60 * 60 * 1000);

      const pastChats = (data || []).filter(chat => {
        if (!chat.scheduled_time) return false;
        const chatTime = new Date(chat.scheduled_time);
        // Include completed status OR chats that are past the grace period
        return chat.status === 'completed' || chatTime < gracePeriod;
      });

      // Get profile info for other participants
      const otherUserIds = pastChats.map(chat =>
        chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id
      ).filter(Boolean);

      let profiles = [];
      if (otherUserIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', otherUserIds);
        profiles = profileData || [];
      }

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const pastWithProfiles = pastChats.map(chat => {
        const otherId = chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id;
        const profile = profileMap.get(otherId);
        return {
          id: chat.id,
          type: 'coffee',
          with: profile?.name || 'Unknown',
          title: `Coffee with ${profile?.name || 'Unknown'}`,
          emoji: '☕',
          date: formatDate(chat.scheduled_time || chat.created_at),
          topic: chat.notes || 'Coffee chat',
          notes: null,
          followUp: chat.status !== 'completed'
        };
      });

      setPastMeetups(pastWithProfiles);
    } catch (err) {
      console.error('Error loading past meetups:', err);
      setPastMeetups([]);
    }
  }, [currentUser.id, supabase]);

  const loadPendingRequests = useCallback(async () => {
    try {
      // Count pending coffee chat requests (where user is recipient)
      const { count: pendingCoffee, error: coffeeError } = await supabase
        .from('coffee_chats')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', currentUser.id)
        .eq('status', 'pending');

      // Count pending circle invites
      const { count: pendingCircles, error: circleError } = await supabase
        .from('connection_group_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('status', 'invited');

      setPendingRequests({
        coffeeChats: coffeeError ? 0 : (pendingCoffee || 0),
        circleInvites: circleError ? 0 : (pendingCircles || 0)
      });
    } catch (err) {
      // Silently handle errors
      setPendingRequests({ coffeeChats: 0, circleInvites: 0 });
    }
  }, [currentUser.id, supabase]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === now.toDateString()) return 'Today';
      if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'TBD';
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
      return timeStr;
    }
  };

  const getEventEmoji = (topic) => {
    if (!topic) return '🎯';
    const lower = topic.toLowerCase();
    if (lower.includes('network')) return '🤝';
    if (lower.includes('workshop')) return '🛠️';
    if (lower.includes('career')) return '💼';
    if (lower.includes('mentor')) return '🌟';
    if (lower.includes('coffee')) return '☕';
    if (lower.includes('social')) return '🎉';
    return '🎯';
  };

  const getStatusStyle = (status) => {
    switch(status) {
      case 'confirmed':
      case 'going':
        return { bg: 'rgba(92, 64, 51, 0.12)', color: '#5C4033', text: status === 'confirmed' ? '✓ Confirmed' : '✓ Going' };
      case 'pending':
      case 'scheduled':
        return { bg: 'rgba(196, 149, 106, 0.2)', color: '#8B6F5C', text: '⏳ Pending' };
      case 'open':
        return { bg: 'rgba(139, 111, 92, 0.1)', color: '#5C4033', text: 'Open' };
      default:
        return { bg: 'rgba(139, 111, 92, 0.1)', color: '#5C4033', text: status || 'Open' };
    }
  };

  const handleJoinCall = (meetupId) => {
    window.location.href = `/meeting/${meetupId}`;
  };

  const handleScheduleCoffeeChat = () => {
    // Navigate to unified schedule meetup page
    if (onNavigate) onNavigate('scheduleMeetup');
  };

  // Separate circle and public events
  const circleEvents = groupEvents.filter(e => e.isCircleMeetup);
  const publicEvents = groupEvents.filter(e => !e.isCircleMeetup);

  const allUpcoming = [...coffeeChats, ...groupEvents].sort((a, b) => {
    // Sort by date - use scheduled_date for coffee chats, original date for group events
    const dateA = a.scheduled_date ? new Date(a.scheduled_date) : new Date(a.originalDate || a.date);
    const dateB = b.scheduled_date ? new Date(b.scheduled_date) : new Date(b.originalDate || b.date);
    return dateA - dateB;
  });

  const filteredItems = activeFilter === 'all'
    ? allUpcoming
    : activeFilter === 'coffee'
      ? coffeeChats
      : activeFilter === 'circle'
        ? circleEvents
        : publicEvents;

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>Loading your meetups...</p>
        <style>{keyframeStyles}</style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.ambientBg}></div>

      {/* Page Title Section */}
      <section style={styles.titleSection}>
        <div style={styles.titleLeft}>
          <h1 style={styles.pageTitle}>Meetups</h1>
          <p style={styles.subtitle}>Your upcoming connections & events</p>
        </div>
        <button style={styles.scheduleBtn} onClick={handleScheduleCoffeeChat}>
          <Plus size={18} />
          Schedule Meetup
        </button>
      </section>

      {/* Quick Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statInfo}>
            <span style={styles.statNumber}>{coffeeChats.length}</span>
            <span style={styles.statLabel}>☕ 1:1 Chats</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statInfo}>
            <span style={styles.statNumber}>{circleEvents.length}</span>
            <span style={styles.statLabel}>🔒 Circle</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statInfo}>
            <span style={styles.statNumber}>{publicEvents.length}</span>
            <span style={styles.statLabel}>🌐 Public</span>
          </div>
        </div>
        {(pendingRequests.coffeeChats + pendingRequests.circleInvites) > 0 ? (
          <div
            style={{...styles.statCard, ...styles.pendingCard}}
            onClick={() => onNavigate && onNavigate(pendingRequests.coffeeChats > 0 ? 'coffeeChats' : 'connectionGroups')}
          >
            <div style={styles.statInfo}>
              <span style={styles.statNumber}>{pendingRequests.coffeeChats + pendingRequests.circleInvites}</span>
              <span style={styles.statLabel}>🔔 Pending</span>
            </div>
            <span style={styles.pendingBadge}>Action needed</span>
          </div>
        ) : (
          <div style={styles.statCard}>
            <div style={styles.statInfo}>
              <span style={styles.statNumber}>{allUpcoming.length}</span>
              <span style={styles.statLabel}>📋 Total</span>
            </div>
          </div>
        )}
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
              { key: 'all', label: 'All', icon: '📋', count: allUpcoming.length },
              { key: 'coffee', label: '1:1', icon: '☕', count: coffeeChats.length },
              { key: 'circle', label: 'Circle', icon: '🔒', count: circleEvents.length },
              { key: 'public', label: 'Public', icon: '🌐', count: publicEvents.length },
            ].map(filter => (
              <button
                key={filter.key}
                style={{...styles.filterTab, ...(activeFilter === filter.key ? styles.filterTabActive : {})}}
                onClick={() => setActiveFilter(filter.key)}
              >
                <span style={styles.filterIcon}>{filter.icon}</span>
                {filter.label}
                {filter.count > 0 && <span style={styles.filterCount}>{filter.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {activeView === 'upcoming' ? (
        <div style={styles.meetupsList}>
          {filteredItems.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📅</span>
              <h3 style={styles.emptyTitle}>No upcoming meetups</h3>
              <p style={styles.emptyText}>Schedule a coffee chat or join a group event!</p>
              <button style={styles.emptyBtn} onClick={() => onNavigate && onNavigate('home')}>
                Browse Events
              </button>
            </div>
          ) : (
            filteredItems.map((item, index) => (
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
                      {item.avatar ? (
                        <img src={item.avatar} alt={item.with} style={styles.personAvatarImg} />
                      ) : (
                        <span style={styles.personAvatar}>👤</span>
                      )}
                      <div style={styles.personInfo}>
                        <span style={styles.personName}>{item.with}</span>
                        <span style={styles.personRole}>{item.role}</span>
                      </div>
                    </div>

                    {item.topic && (
                      <div style={styles.topicRow}>
                        <span style={styles.topicLabel}>Topic:</span>
                        <span style={styles.topicText}>{item.topic}</span>
                      </div>
                    )}
                  </div>

                  <div style={styles.cardRight}>
                    <div style={styles.dateBlock}>
                      <span style={styles.dateDay}>{item.date}</span>
                      <span style={styles.dateTime}>{item.time}</span>
                      <span style={styles.dateDuration}>{item.duration}</span>
                    </div>
                    <div style={styles.locationBlock}>
                      <span style={styles.locationIcon}>{item.location?.includes('Zoom') || item.location?.includes('Virtual') ? '💻' : '📍'}</span>
                      <span style={styles.locationText}>{item.location || 'Virtual'}</span>
                    </div>
                    <div style={styles.cardActions}>
                      <button style={styles.actionBtnPrimary} onClick={() => handleJoinCall(item.id)}>
                        <Video size={14} style={{ marginRight: 6 }} />
                        Join
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Group Event Card (Circle or Public)
                <div key={item.id} style={{
                  ...styles.meetupCard,
                  ...styles.groupCard,
                  ...(item.isCircleMeetup ? styles.circleCard : styles.publicCard),
                  animationDelay: `${index * 0.1}s`
                }}>
                  <div style={styles.cardLeft}>
                    <div style={item.isCircleMeetup ? styles.circleIcon : styles.publicIcon}>
                      {item.isCircleMeetup ? '🔒' : '🌐'}
                    </div>
                  </div>

                  <div style={styles.cardContent}>
                    <div style={styles.cardHeader}>
                      <div style={item.isCircleMeetup ? styles.cardTypeCircle : styles.cardTypePublic}>
                        {item.isCircleMeetup ? 'Intimate Circle' : 'Public Event'}
                      </div>
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
                  </div>

                  <div style={styles.cardRight}>
                    <div style={styles.dateBlock}>
                      <span style={styles.dateDay}>{item.date}</span>
                      <span style={styles.dateTime}>{item.time}</span>
                      <span style={styles.dateDuration}>{item.duration}</span>
                    </div>
                    <div style={styles.locationBlock}>
                      <span style={styles.locationIcon}>{item.location?.includes('Zoom') || item.location === 'Virtual' ? '💻' : '📍'}</span>
                      <span style={styles.locationText}>{item.location}</span>
                    </div>
                    <div style={styles.attendeesBlock}>
                      <span style={styles.attendeeText}>{item.attendees}/{item.maxAttendees} attending</span>
                    </div>
                    <div style={styles.cardActions}>
                      {item.status === 'going' ? (
                        <button style={styles.actionBtnGoing} onClick={() => handleJoinCall(item.id)}>
                          <Video size={14} style={{ marginRight: 6 }} />
                          Join Room
                        </button>
                      ) : (
                        <button style={styles.actionBtnPrimary} onClick={() => onNavigate && onNavigate('home')}>
                          RSVP
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            ))
          )}
        </div>
      ) : (
        // Past Meetups
        <div style={styles.pastList}>
          {pastMeetups.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📚</span>
              <h3 style={styles.emptyTitle}>No past meetups yet</h3>
              <p style={styles.emptyText}>Your completed calls will appear here</p>
            </div>
          ) : (
            pastMeetups.map((item, index) => (
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
                  <p style={styles.pastDetail}>{item.topic}</p>
                  {item.notes && (
                    <p style={styles.pastNotes}>📝 {item.notes}</p>
                  )}
                </div>
                <div style={styles.pastActions}>
                  {item.followUp && (
                    <button style={styles.followUpBtn} onClick={handleScheduleCoffeeChat}>
                      Schedule Follow-up
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Suggested Section */}
      {activeView === 'upcoming' && groupEvents.length < 3 && (
        <section style={styles.suggestedSection}>
          <h2 style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>✨</span>
            Discover More Events
          </h2>
          <p style={styles.suggestedText}>
            Check out upcoming circle meetups and expand your network!
          </p>
          <button style={styles.suggestedBtn} onClick={() => onNavigate && onNavigate('home')}>
            Browse Events
          </button>
        </section>
      )}

      <style>{keyframeStyles}</style>
    </div>
  );
}

const keyframeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

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

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const styles = {
  container: {
    minHeight: '100%',
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
    zIndex: -1,
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(139, 111, 92, 0.2)',
    borderTopColor: '#8B6F5C',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },
  loadingText: {
    color: '#6B5344',
    fontSize: '16px',
  },
  titleSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  titleLeft: {},
  pageTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '32px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '4px',
    margin: 0,
  },
  subtitle: {
    fontSize: '15px',
    color: '#8B7355',
    margin: 0,
  },
  scheduleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
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
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(139, 111, 92, 0.06)',
  },
  statIcon: {
    fontSize: '24px',
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  statNumber: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '22px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  statLabel: {
    fontSize: '11px',
    color: '#8B7355',
  },
  pendingCard: {
    cursor: 'pointer',
    backgroundColor: 'rgba(196, 149, 106, 0.15)',
    border: '1px solid rgba(196, 149, 106, 0.3)',
    transition: 'all 0.2s ease',
    position: 'relative',
  },
  pendingBadge: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    backgroundColor: '#C4956A',
    color: 'white',
    fontSize: '9px',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '10px',
    textTransform: 'uppercase',
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
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
    padding: '8px 14px',
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
  filterCount: {
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: 'rgba(139, 111, 92, 0.2)',
    padding: '2px 6px',
    borderRadius: '10px',
    marginLeft: '4px',
  },
  meetupsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '32px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '20px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '20px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '8px',
    margin: 0,
  },
  emptyText: {
    fontSize: '14px',
    color: '#8B7355',
    marginBottom: '20px',
    margin: '0 0 20px 0',
  },
  emptyBtn: {
    padding: '12px 24px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  meetupCard: {
    display: 'flex',
    gap: '20px',
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '20px',
    boxShadow: '0 4px 20px rgba(139, 111, 92, 0.08)',
    border: '1px solid rgba(139, 111, 92, 0.08)',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
    flexWrap: 'wrap',
  },
  groupCard: {
  },
  circleCard: {
  },
  publicCard: {
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'flex-start',
  },
  coffeeIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #D4A574 0%, #C4956A 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
  },
  groupIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #8B6F5C 0%, #6B4423 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
  },
  circleIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #5C4033 0%, #3D2B1F 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
  },
  publicIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #C4956A 0%, #A67B5B 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    minWidth: '200px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
    flexWrap: 'wrap',
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
  cardTypeCircle: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#5C4033',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardTypePublic: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#A67B5B',
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
    fontSize: '36px',
  },
  personAvatarImg: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  personInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  personName: {
    fontSize: '17px',
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
    flexWrap: 'wrap',
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
  eventTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '18px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '4px',
    margin: '0 0 4px 0',
  },
  eventHost: {
    fontSize: '13px',
    color: '#8B7355',
    marginBottom: '8px',
    margin: '0 0 8px 0',
  },
  eventDesc: {
    fontSize: '14px',
    color: '#5C4033',
    lineHeight: '1.5',
    margin: 0,
  },
  cardRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '10px',
    minWidth: '140px',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    backgroundColor: 'rgba(92, 64, 51, 0.1)',
    border: '1px solid rgba(92, 64, 51, 0.3)',
    borderRadius: '10px',
    color: '#5C4033',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  pastList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '32px',
  },
  pastCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '18px 20px',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '16px',
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
    flexWrap: 'wrap',
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
    flexShrink: 0,
  },
  pastContent: {
    flex: 1,
    minWidth: '200px',
  },
  pastHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
    flexWrap: 'wrap',
    gap: '8px',
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
    margin: 0,
  },
  pastNotes: {
    fontSize: '12px',
    color: '#8B7355',
    marginTop: '6px',
    fontStyle: 'italic',
    margin: '6px 0 0 0',
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
    padding: '24px',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: '20px',
    border: '1px solid rgba(139, 111, 92, 0.08)',
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '18px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    margin: '0 0 8px 0',
  },
  sectionIcon: {
    fontSize: '18px',
  },
  suggestedText: {
    fontSize: '14px',
    color: '#8B7355',
    marginBottom: '16px',
    margin: '0 0 16px 0',
  },
  suggestedBtn: {
    padding: '12px 24px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
};

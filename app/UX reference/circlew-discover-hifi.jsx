import React, { useState } from 'react';
import { Search, MapPin, Calendar, Clock, ChevronRight } from 'lucide-react';

const DiscoverPage = () => {
  const [activeVibe, setActiveVibe] = useState('peers');

  // Font families
  const fonts = {
    serif: "'Playfair Display', Georgia, serif",
    sans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  // Color palette - Mocha Brown only
  const colors = {
    primary: '#8B6F5C',        // Mocha brown
    primaryDark: '#6B5344',    // Dark mocha
    primaryLight: '#A89080',   // Light mocha
    cream: '#FDF8F3',          // Warm cream background
    warmWhite: '#FFFAF5',      // Card backgrounds
    text: '#4A3728',           // Dark brown text
    textLight: '#7A6855',      // Secondary text
    textMuted: '#A89080',      // Muted text
    border: '#EDE6DF',         // Light border
  };

  const vibes = [
    { id: 'advice', emoji: '🧘', label: 'Get advice', description: 'Connect with mentors & leaders' },
    { id: 'peers', emoji: '🗣️', label: 'Find support', description: 'Find your community' },
    { id: 'grow', emoji: '🚀', label: 'Career Growth', description: 'Level up your skills' },
  ];

  // Best next step content based on vibe
  const bestNextStep = {
    advice: {
      title: 'Career Pivot AMA',
      subtitle: 'with Jennifer Wu, VP Engineering @ Stripe',
      groupSize: 'Small group (6-8)',
      frequency: null,
      date: 'Thu, Feb 6',
      time: '12 PM',
      location: 'Virtual',
      attendees: [
        { emoji: '👩🏻', name: 'Rachel' },
        { emoji: '👩🏾', name: 'Maya' },
        { emoji: '👩🏼', name: 'Emma' },
      ],
      extraCount: 2,
      matchReason: 'Advice',
      spots: 2,
      totalSpots: 8,
      isGroup: false,
    },
    peers: {
      title: 'Michigan Coffee Chat',
      subtitle: 'Career transition',
      groupSize: 'Small group (4-6)',
      frequency: '🔄 Weekly',
      date: 'Thu, Feb 6',
      time: '7 PM',
      location: 'Birmingham',
      attendees: [
        { emoji: '👩🏻', name: 'Sarah' },
        { emoji: '👩🏽', name: 'Priya' },
        { emoji: '👩🏼', name: 'Lisa' },
      ],
      extraCount: 1,
      matchReason: 'Support',
      spots: 2,
      totalSpots: 6,
      isGroup: true,
    },
    grow: {
      title: 'Negotiation Bootcamp',
      subtitle: '2-hour intensive session',
      groupSize: 'Interactive (12-15)',
      frequency: null,
      date: 'Sat, Feb 8',
      time: '10 AM',
      location: 'Virtual',
      attendees: [
        { emoji: '👩🏻‍💼', name: 'Amy' },
        { emoji: '👩🏿', name: 'Nicole' },
        { emoji: '👩🏻', name: 'Chen' },
      ],
      extraCount: 5,
      matchReason: 'Growth',
      spots: 3,
      totalSpots: 15,
      isGroup: false,
    },
  };

  const suggestedPeople = [
    { id: 1, name: 'Sarah Chen', role: 'PM at Ford', emoji: '👩🏻', tags: ['Nearby', 'Tech'], askMeAbout: 'Pivoting from Engineering to Product' },
    { id: 2, name: 'Maya Johnson', role: 'Startup Founder', emoji: '👩🏾', tags: ['Similar', 'Founder'], askMeAbout: 'Raising Your First Pre-Seed Round' },
    { id: 3, name: 'Emily Park', role: 'Tech Lead', emoji: '👩🏻‍💼', tags: ['In circle', 'Mentor'], askMeAbout: 'Managing Engineers as a New Lead' },
  ];

  const current = bestNextStep[activeVibe];

  return (
    <>
      {/* Google Fonts */}
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap');`}
      </style>
      
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.cream,
        fontFamily: fonts.sans,
      }}>
      {/* Header */}
      <header style={{
        backgroundColor: colors.warmWhite,
        borderBottom: `1px solid ${colors.border}`,
        padding: '12px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '700',
              fontSize: '14px',
            }}>
              W
            </div>
            <span style={{ fontWeight: '700', fontSize: '18px', color: colors.text }}>CircleW</span>
          </div>
          <nav style={{ display: 'flex', gap: '24px' }}>
            {['Home', 'Discover', 'Circles', 'Chats'].map((item) => (
              <a
                key={item}
                href="#"
                style={{
                  fontSize: '14px',
                  fontWeight: item === 'Discover' ? '600' : '400',
                  color: item === 'Discover' ? colors.primary : colors.textLight,
                  textDecoration: 'none',
                  borderBottom: item === 'Discover' ? `2px solid ${colors.primary}` : 'none',
                  paddingBottom: '4px',
                }}
              >
                {item}
              </a>
            ))}
          </nav>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            backgroundColor: colors.cream,
            border: `1px solid ${colors.border}`,
            borderRadius: '20px',
            fontSize: '13px',
            color: colors.textLight,
            cursor: 'pointer',
          }}>
            <Search size={14} />
            Search
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 20px 100px' }}>
        {/* Page Title */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '600', color: colors.text, margin: '0 0 6px', fontFamily: fonts.serif }}>
            Discover
          </h1>
          <p style={{ fontSize: '15px', color: colors.textLight, margin: 0 }}>
            Find your people. Take the next step.
          </p>
        </div>

        {/* ✨ VIBE BAR - "What are you here for today?" */}
        <div style={{
          backgroundColor: colors.warmWhite,
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
        }}>
          <p style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: colors.text, 
            marginBottom: '16px',
          }}>
            What are you here for today?
          </p>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            {vibes.map((vibe) => {
              const isActive = activeVibe === vibe.id;
              return (
                <button
                  key={vibe.id}
                  onClick={() => setActiveVibe(vibe.id)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '14px 12px',
                    borderRadius: '12px',
                    border: isActive ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                    backgroundColor: isActive ? colors.primaryLight : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{vibe.emoji}</span>
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: isActive ? '600' : '500',
                    color: isActive ? colors.primary : colors.text,
                  }}>
                    {vibe.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RECOMMENDED FOR YOU - Hero Feature */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, margin: '0 0 14px', fontFamily: fonts.serif }}>
            Recommended for you
          </h2>

          <div style={{
            backgroundColor: colors.warmWhite,
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 4px 20px rgba(139, 111, 92, 0.12)',
            border: `1px solid ${colors.primary}30`,
          }}>
            {/* Spots Badge */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <span style={{
                padding: '4px 10px',
                backgroundColor: `${colors.primary}15`,
                color: colors.primary,
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '8px',
              }}>
                {current.spots} spots left
              </span>
            </div>

            {/* Title */}
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: colors.text, margin: '0 0 4px', fontFamily: fonts.serif }}>
              {current.title}
            </h3>
            <p style={{ fontSize: '14px', color: colors.textLight, margin: '0 0 14px' }}>
              {current.subtitle}
            </p>

            {/* Group Size */}
            <p style={{ 
              fontSize: '13px', 
              color: colors.textLight, 
              margin: '0 0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              👥 {current.groupSize}{current.frequency ? ` · ${current.frequency}` : ''}
            </p>

            {/* Date, Time, Location */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              fontSize: '13px', 
              color: colors.textLight,
              marginBottom: '16px',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={14} /> {current.date}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={14} /> {current.time}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={14} /> {current.location}
              </span>
            </div>

            {/* Social Proof - Attendees */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              paddingTop: '14px',
              borderTop: `1px solid ${colors.border}`,
            }}>
              <div style={{ display: 'flex', marginRight: '10px' }}>
                {current.attendees.map((person, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: colors.primaryLight,
                      border: '2px solid white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      marginLeft: idx > 0 ? '-8px' : 0,
                    }}
                  >
                    {person.emoji}
                  </div>
                ))}
                {current.extraCount > 0 && (
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: colors.primary,
                    border: '2px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: '600',
                    color: 'white',
                    marginLeft: '-8px',
                  }}>
                    +{current.extraCount}
                  </div>
                )}
              </div>
              <span style={{ fontSize: '12px', color: colors.textLight }}>
                {current.isGroup 
                  ? `${current.attendees.length + current.extraCount} members`
                  : `${current.attendees[0].name} & ${current.attendees.length - 1 + current.extraCount} others going`
                }
              </span>
            </div>

            {/* Match Reason + CTA */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginTop: '16px',
            }}>
              <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                fontSize: '12px',
                fontWeight: '500',
                color: colors.primary,
                backgroundColor: `${colors.primary}15`,
                padding: '6px 12px',
                borderRadius: '16px',
              }}>
                🤎 {current.matchReason}
              </span>
              <button style={{
                padding: '12px 24px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: `0 4px 12px ${colors.primary}40`,
              }}>
                {current.isGroup ? 'Join group' : 'RSVP'}
              </button>
            </div>
          </div>
        </div>

        {/* HAPPENING THIS WEEK - Horizontal Scroll */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, margin: 0, fontFamily: fonts.serif }}>
              Happening This Week
            </h2>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: colors.primary,
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}>
              See all <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ 
            display: 'flex', 
            gap: '14px', 
            overflowX: 'auto', 
            paddingBottom: '8px',
            marginLeft: '-20px',
            marginRight: '-20px',
            paddingLeft: '20px',
            paddingRight: '20px',
            scrollbarWidth: 'none',
          }}>
            {/* Event Card 1 */}
            <div style={{
              minWidth: '280px',
              backgroundColor: colors.warmWhite,
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(139, 111, 92, 0.1)',
              flexShrink: 0,
            }}>
              <div style={{
                height: '90px',
                background: `linear-gradient(135deg, ${colors.primaryLight} 0%, ${colors.primary}30 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                position: 'relative',
              }}>
                ☕
                <span style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  padding: '4px 8px',
                  backgroundColor: colors.primary,
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: 'white',
                }}>
                  2 spots left
                </span>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '600', color: colors.text, margin: '0 0 4px', fontFamily: fonts.serif }}>
                  Career Transition Chat
                </h4>
                <p style={{ fontSize: '12px', color: colors.textLight, margin: '0 0 8px' }}>
                  Women in Tech Leadership
                </p>
                <p style={{ fontSize: '11px', color: colors.primary, margin: '0 0 10px', fontWeight: '500' }}>
                  👥 Small group (4-6) · 🔄 Weekly
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: colors.textLight, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} /> Thu, Feb 6
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} /> 7 PM
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={11} /> Birmingham
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', marginRight: '8px' }}>
                      {['👩🏻', '👩🏾', '👩🏼'].map((emoji, idx) => (
                        <div key={idx} style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: colors.cream,
                          border: '2px solid white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          marginLeft: idx > 0 ? '-6px' : 0,
                        }}>
                          {emoji}
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', color: colors.textLight }}>4 members</span>
                  </div>
                  <button style={{
                    padding: '6px 12px',
                    backgroundColor: colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}>
                    Join
                  </button>
                </div>
              </div>
            </div>

            {/* Event Card 2 */}
            <div style={{
              minWidth: '280px',
              backgroundColor: colors.warmWhite,
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(139, 111, 92, 0.1)',
              flexShrink: 0,
            }}>
              <div style={{
                height: '90px',
                background: `linear-gradient(135deg, ${colors.cream} 0%, #E8DFD8 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                position: 'relative',
              }}>
                🎯
                <span style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  padding: '4px 8px',
                  backgroundColor: colors.primary,
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: 'white',
                }}>
                  8 spots left
                </span>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '600', color: colors.text, margin: '0 0 4px', fontFamily: fonts.serif }}>
                  Interview Practice Roundtable
                </h4>
                <p style={{ fontSize: '12px', color: colors.textLight, margin: '0 0 8px' }}>
                  Career Crossroads Circle
                </p>
                <p style={{ fontSize: '11px', color: colors.primary, margin: '0 0 10px', fontWeight: '500' }}>
                  👥 Interactive group (10-15)
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: colors.textLight, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} /> Sat, Feb 8
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} /> 10 AM
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={11} /> Virtual
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', marginRight: '8px' }}>
                      {['👩🏻‍💼', '👩🏽', '👩🏻'].map((emoji, idx) => (
                        <div key={idx} style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: colors.cream,
                          border: '2px solid white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          marginLeft: idx > 0 ? '-6px' : 0,
                        }}>
                          {emoji}
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', color: colors.textLight }}>7 going</span>
                  </div>
                  <button style={{
                    padding: '6px 12px',
                    backgroundColor: colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}>
                    RSVP
                  </button>
                </div>
              </div>
            </div>

            {/* Event Card 3 */}
            <div style={{
              minWidth: '280px',
              backgroundColor: colors.warmWhite,
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(139, 111, 92, 0.1)',
              flexShrink: 0,
            }}>
              <div style={{
                height: '90px',
                background: `linear-gradient(135deg, #F5EDE8 0%, #EBE0D8 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                position: 'relative',
              }}>
                🍷
                <span style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  padding: '4px 8px',
                  backgroundColor: colors.primary,
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: 'white',
                }}>
                  3 spots left
                </span>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '600', color: colors.text, margin: '0 0 4px', fontFamily: fonts.serif }}>
                  Wine & Whine Wednesday
                </h4>
                <p style={{ fontSize: '12px', color: colors.textLight, margin: '0 0 8px' }}>
                  Working Moms Sanctuary
                </p>
                <p style={{ fontSize: '11px', color: colors.primary, margin: '0 0 10px', fontWeight: '500' }}>
                  👥 Casual hangout (6-10) · 🔄 Weekly
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: colors.textLight, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} /> Wed, Feb 5
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} /> 8 PM
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={11} /> Royal Oak
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', marginRight: '8px' }}>
                      {['👩🏼', '👩🏻', '👩🏽'].map((emoji, idx) => (
                        <div key={idx} style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: colors.cream,
                          border: '2px solid white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          marginLeft: idx > 0 ? '-6px' : 0,
                        }}>
                          {emoji}
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', color: colors.textLight }}>5 members</span>
                  </div>
                  <button style={{
                    padding: '6px 12px',
                    backgroundColor: colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}>
                    Join
                  </button>
                </div>
              </div>
            </div>

            {/* Event Card 4 */}
            <div style={{
              minWidth: '280px',
              backgroundColor: colors.warmWhite,
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(139, 111, 92, 0.1)',
              flexShrink: 0,
            }}>
              <div style={{
                height: '90px',
                background: `linear-gradient(135deg, #EDE6DF 0%, #E0D8D0 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                position: 'relative',
              }}>
                💼
                <span style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  padding: '4px 8px',
                  backgroundColor: colors.primary,
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: 'white',
                }}>
                  12 spots left
                </span>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '600', color: colors.text, margin: '0 0 4px', fontFamily: fonts.serif }}>
                  LinkedIn Personal Branding
                </h4>
                <p style={{ fontSize: '12px', color: colors.textLight, margin: '0 0 8px' }}>
                  Entrepreneur Founders
                </p>
                <p style={{ fontSize: '11px', color: colors.primary, margin: '0 0 10px', fontWeight: '500' }}>
                  👥 Masterclass (20-30)
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: colors.textLight, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} /> Sun, Feb 9
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} /> 2 PM
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={11} /> Virtual
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', marginRight: '8px' }}>
                      {['👩🏿‍💼', '👩🏻', '👩🏾'].map((emoji, idx) => (
                        <div key={idx} style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: colors.cream,
                          border: '2px solid white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          marginLeft: idx > 0 ? '-6px' : 0,
                        }}>
                          {emoji}
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', color: colors.textLight }}>13 going</span>
                  </div>
                  <button style={{
                    padding: '6px 12px',
                    backgroundColor: colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}>
                    RSVP
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CONNECT WITH PEOPLE */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, margin: '0 0 4px', fontFamily: fonts.serif }}>
                Connect with people
              </h2>
              <p style={{ fontSize: '13px', color: colors.textLight, margin: 0 }}>
                Find women you can start a conversation with
              </p>
            </div>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: colors.primary,
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}>
              See all <ChevronRight size={14} />
            </button>
          </div>

          {/* People Cards */}
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
            {suggestedPeople.map((person) => (
              <div
                key={person.id}
                style={{
                  minWidth: '260px',
                  backgroundColor: colors.text,
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 4px 16px rgba(74, 55, 40, 0.15)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: colors.primaryLight,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    flexShrink: 0,
                  }}>
                    {person.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ 
                      fontSize: '12px', 
                      color: 'rgba(255,255,255,0.7)', 
                      margin: '0 0 4px',
                    }}>
                      Ask me about:
                    </p>
                    <h4 style={{ 
                      fontSize: '15px', 
                      fontWeight: '600', 
                      color: 'white', 
                      margin: '0 0 8px',
                      lineHeight: '1.3',
                      fontFamily: fonts.serif,
                    }}>
                      {person.askMeAbout}
                    </h4>
                    <p style={{ 
                      fontSize: '12px', 
                      color: 'rgba(255,255,255,0.6)', 
                      margin: 0,
                    }}>
                      {person.name} | {person.role}
                    </p>
                  </div>
                </div>
                {/* Tags at bottom */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px',
                  marginTop: '14px',
                  paddingTop: '14px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                  {person.tags.map((tag, idx) => (
                    <span 
                      key={idx}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: '11px',
                        fontWeight: '500',
                        borderRadius: '6px',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Floating Action Button - Create */}
      <div style={{
        position: 'fixed',
        bottom: '32px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '12px',
      }}>
        <button style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primary} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(139, 111, 92, 0.35)',
          cursor: 'pointer',
          color: 'white',
          fontSize: '28px',
          fontWeight: '300',
        }}>
          +
        </button>
      </div>
    </div>
    </>
  );
};

export default DiscoverPage;

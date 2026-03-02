import { useState } from "react";

const TopicCard = ({ title, category, categoryEmoji, interested, hasHost }) => {
  const [isInterested, setIsInterested] = useState(false);
  const currentCount = interested.length + (isInterested ? 1 : 0);
  const displayAvatars = isInterested ? [...interested, 'you'] : interested;

  return (
    <div style={{
      background: '#FFFBF5',
      borderRadius: '20px',
      padding: '24px',
      width: '100%',
      maxWidth: '360px',
      boxShadow: '0 2px 16px rgba(120, 80, 40, 0.08)',
      border: '1px solid rgba(180, 140, 100, 0.12)',
      fontFamily: "'DM Sans', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top accent */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '3px',
        background: 'linear-gradient(90deg, #8B6914, #C4956A, #8B6914)',
        borderRadius: '20px 20px 0 0',
      }} />

      {/* Category tag */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(139, 105, 20, 0.08)',
        color: '#8B6914',
        fontSize: '12px',
        fontWeight: 600,
        padding: '5px 12px',
        borderRadius: '20px',
        letterSpacing: '0.3px',
        textTransform: 'uppercase',
        marginBottom: '16px',
      }}>
        <span>{categoryEmoji}</span>
        <span>{category}</span>
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: '20px',
        fontWeight: 700,
        color: '#3D2B1F',
        lineHeight: 1.35,
        margin: '0 0 18px 0',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {title}
      </h3>

      {/* Interested avatars */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '20px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(180, 140, 100, 0.15)',
      }}>
        <div style={{ display: 'flex' }}>
          {displayAvatars.map((s, i) => (
            <div key={i} style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: s === 'you' ? '#6B4F1D' : ['#C4956A', '#8B6914', '#D4B896', '#A67C2E', '#BFA27E'][i % 5],
              border: '2px solid #FFFBF5',
              marginLeft: i > 0 ? '-8px' : 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: s === 'you' ? '9px' : '12px',
              zIndex: displayAvatars.length - i,
              position: 'relative',
              color: s === 'you' ? '#FFF' : 'inherit',
              fontWeight: s === 'you' ? 700 : 400,
            }}>
              {s === 'you' ? 'You' : s}
            </div>
          ))}
        </div>
        <span style={{
          color: '#8C7B6B',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          {currentCount} interested
        </span>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '10px',
      }}>
        <button
          onClick={() => setIsInterested(!isInterested)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: isInterested
              ? 'transparent'
              : 'linear-gradient(135deg, #6B4F1D, #8B6914)',
            color: isInterested ? '#8B6914' : '#FFF',
            border: isInterested ? '1.5px solid #8B6914' : 'none',
            borderRadius: '14px',
            padding: '13px 20px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: isInterested ? 'none' : '0 2px 8px rgba(139, 105, 20, 0.25)',
            letterSpacing: '0.2px',
          }}
        >
          <span>{isInterested ? '✓' : '🙋‍♀️'}</span>
          <span>{isInterested ? "I'm in!" : 'I want this'}</span>
        </button>

        <button style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: 'transparent',
          color: '#6B4F1D',
          border: '1.5px solid rgba(139, 105, 20, 0.25)',
          borderRadius: '14px',
          padding: '13px 20px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          letterSpacing: '0.2px',
        }}>
          <span>🎙️</span>
          <span>Host this</span>
        </button>
      </div>
    </div>
  );
};

const TopicCardShowcase = () => {
  const topics = [
    {
      title: "How to negotiate a raise in tech",
      category: "Career",
      categoryEmoji: "💼",
      interested: ['👩‍💻', '👩', '👩‍🦰', '🧑‍💼', '👩‍🔬'],
      hasHost: false,
    },
    {
      title: "Surviving your first year as a founder",
      category: "Startup",
      categoryEmoji: "🚀",
      interested: ['👩‍💻', '👩'],
      hasHost: false,
    },
    {
      title: "Balancing motherhood and a startup",
      category: "Life & Work",
      categoryEmoji: "💛",
      interested: ['👩', '👩‍🦰', '🧑‍💼', '👩‍💻', '👩‍🔬', '👩', '👩‍💻', '👩‍🦰'],
      hasHost: true,
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #F5EDE3 0%, #EDE4D8 50%, #E8DDD0 100%)',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <h2 style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '14px',
        fontWeight: 600,
        color: '#8B6914',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        marginBottom: '8px',
      }}>
        CircleW — Topic Interest Cards
      </h2>

      {topics.map((topic, index) => (
        <TopicCard key={index} {...topic} />
      ))}
    </div>
  );
};

export default TopicCardShowcase;

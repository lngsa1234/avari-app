'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Calendar,
  MapPin,
  Users,
  X,
  Sparkles,
  Video,
  ChevronRight,
  RefreshCw,
  Clock
} from 'lucide-react';

/**
 * EventRecommendations Component
 *
 * Displays AI-powered event recommendations for the current user.
 * Shows match reasons and allows RSVP directly from the component.
 * Styled to match CircleW's warm brown color scheme.
 */
export default function EventRecommendations({
  className = '',
  maxItems = 3,
  showRefresh = false
}) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, []);

  async function loadRecommendations() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch recommendations without join
      const { data: recsData, error } = await supabase
        .from('event_recommendations')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'viewed'])
        .order('match_score', { ascending: false })
        .limit(maxItems + 2);

      if (error) {
        // Table may not exist yet - silently fail
        setLoading(false);
        return;
      }

      if (!recsData || recsData.length === 0) {
        setRecommendations([]);
        setLoading(false);
        return;
      }

      // Fetch meetups separately
      const meetupIds = recsData.map(r => r.meetup_id).filter(Boolean);
      let meetupMap = {};

      if (meetupIds.length > 0) {
        const { data: meetups, error: meetupError } = await supabase
          .from('meetups')
          .select('id, topic, description, date, time, location, created_by')
          .in('id', meetupIds);

        if (meetupError) {
          console.error('[EventRecs] Meetup fetch error:', meetupError);
        }

        // Fetch attendee counts
        const { data: attendeeCounts } = await supabase
          .from('meetup_attendees')
          .select('meetup_id')
          .in('meetup_id', meetupIds);

        // Count attendees per meetup
        const countMap = {};
        (attendeeCounts || []).forEach(a => {
          countMap[a.meetup_id] = (countMap[a.meetup_id] || 0) + 1;
        });

        // Build meetup map with attendee counts
        (meetups || []).forEach(m => {
          meetupMap[m.id] = {
            ...m,
            meetup_attendees: [{ count: countMap[m.id] || 0 }]
          };
        });
      }

      // Merge recommendations with meetups
      const recsWithMeetups = recsData.map(rec => ({
        ...rec,
        meetup: meetupMap[rec.meetup_id] || null
      }));

      // Filter out past events (keep today's events)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activeRecs = recsWithMeetups
        .filter(r => r.meetup && new Date(r.meetup.date) >= today)
        .slice(0, maxItems);

      setRecommendations(activeRecs);

      // Mark as viewed
      for (const rec of activeRecs.filter(r => r.status === 'pending')) {
        await supabase
          .from('event_recommendations')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', rec.id);
      }
    } catch (e) {
      console.error('[EventRecs] Error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await fetch('/api/agent/event-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      await loadRecommendations();
    } catch (e) {
      console.error('[EventRecs] Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRSVP(rec) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: attendeeError } = await supabase
        .from('meetup_attendees')
        .upsert({
          meetup_id: rec.meetup_id,
          user_id: user.id,
          status: 'confirmed'
        }, {
          onConflict: 'meetup_id,user_id'
        });

      if (attendeeError) {
        console.error('[EventRecs] RSVP error:', attendeeError);
        return;
      }

      await supabase
        .from('event_recommendations')
        .update({ status: 'rsvp', acted_at: new Date().toISOString() })
        .eq('id', rec.id);

      setRecommendations(prev => prev.filter(r => r.id !== rec.id));
    } catch (e) {
      console.error('[EventRecs] RSVP error:', e);
    }
  }

  async function handleDismiss(rec) {
    try {
      await supabase
        .from('event_recommendations')
        .update({ status: 'dismissed', acted_at: new Date().toISOString() })
        .eq('id', rec.id);

      setRecommendations(prev => prev.filter(r => r.id !== rec.id));
    } catch (e) {
      console.error('[EventRecs] Dismiss error:', e);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  // CircleW color scheme styles
  const styles = {
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      borderRadius: '24px',
      boxShadow: '0 4px 24px rgba(139, 111, 92, 0.08)',
      border: '1px solid rgba(139, 111, 92, 0.08)',
      backdropFilter: 'blur(10px)',
      overflow: 'hidden',
    },
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: '1px solid rgba(139, 111, 92, 0.1)',
    },
    cardTitle: {
      fontFamily: '"Playfair Display", serif',
      fontSize: '18px',
      fontWeight: '600',
      color: '#3D2B1F',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    eventItem: {
      padding: '16px 20px',
      borderBottom: '1px solid rgba(139, 111, 92, 0.06)',
    },
    eventTitle: {
      fontSize: '15px',
      fontWeight: '600',
      color: '#3D2B1F',
      margin: 0,
    },
    eventMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '13px',
      color: '#6B5344',
    },
    reasonTag: {
      fontSize: '11px',
      backgroundColor: 'rgba(139, 111, 92, 0.1)',
      color: '#5C4033',
      padding: '4px 10px',
      borderRadius: '100px',
    },
    matchTag: {
      fontSize: '11px',
      backgroundColor: 'rgba(139, 111, 92, 0.06)',
      color: '#8B7355',
      padding: '4px 10px',
      borderRadius: '100px',
    },
    rsvpBtn: {
      padding: '10px 20px',
      backgroundColor: '#8B6F5C',
      border: 'none',
      borderRadius: '100px',
      color: 'white',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
    },
    detailsBtn: {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#8B6F5C',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
    },
    dismissBtn: {
      background: 'none',
      border: 'none',
      color: '#A89080',
      cursor: 'pointer',
      padding: '4px',
    },
    footer: {
      padding: '12px 20px',
      backgroundColor: 'rgba(139, 111, 92, 0.04)',
      textAlign: 'center',
    },
    footerLink: {
      fontSize: '13px',
      color: '#8B6F5C',
      fontWeight: '600',
      textDecoration: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    },
  };

  if (loading) {
    return (
      <div style={styles.card} className={className}>
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(139, 111, 92, 0.2)',
            borderTopColor: '#8B6F5C',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#8B7355', fontSize: '14px' }}>Loading recommendations...</p>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div style={styles.card} className={className}>
      {/* Header */}
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>
          <Sparkles size={18} style={{ color: '#8B6F5C' }} />
          Recommended for You
        </h3>
        {showRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={styles.dismissBtn}
            aria-label="Refresh recommendations"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Recommendations list */}
      <div>
        {recommendations.map(rec => (
          <div key={rec.id} style={styles.eventItem}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Event title */}
                <h4 style={styles.eventTitle}>
                  {rec.meetup?.topic || 'Community Event'}
                </h4>

                {/* Event details */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                  <span style={styles.eventMeta}>
                    <Calendar size={14} />
                    {formatDate(rec.meetup?.date)}
                  </span>
                  {rec.meetup?.time && (
                    <span style={styles.eventMeta}>
                      <Clock size={14} />
                      {formatTime(rec.meetup?.time)}
                    </span>
                  )}
                  <span style={styles.eventMeta}>
                    <Users size={14} />
                    {rec.meetup?.meetup_attendees?.[0]?.count || 0} attending
                  </span>
                </div>

                {/* Match reasons */}
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(rec.match_reasons || []).slice(0, 2).map((reason, i) => (
                    <span key={i} style={styles.reasonTag}>
                      {reason.reason}
                    </span>
                  ))}
                  <span style={styles.matchTag}>
                    {Math.round(rec.match_score * 100)}% match
                  </span>
                </div>
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => handleDismiss(rec)}
                style={styles.dismissBtn}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button onClick={() => handleRSVP(rec)} style={styles.rsvpBtn}>
                Reserve my spot →
              </button>
              <button
                onClick={() => window.location.href = '/meetups'}
                style={styles.detailsBtn}
              >
                View details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <a href="/meetups" style={styles.footerLink}>
          View all events
          <ChevronRight size={14} />
        </a>
      </div>
    </div>
  );
}

/**
 * Compact card version for dashboard widgets
 */
export function EventRecommendationCard({ recommendation, onRSVP, onDismiss }) {
  const rec = recommendation;

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  const cardStyles = {
    container: {
      border: '1px solid rgba(139, 111, 92, 0.12)',
      borderRadius: '12px',
      padding: '12px',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    title: {
      fontWeight: '600',
      color: '#3D2B1F',
      fontSize: '14px',
      margin: 0,
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    dismissBtn: {
      background: 'none',
      border: 'none',
      color: '#A89080',
      cursor: 'pointer',
      padding: '2px',
    },
    meta: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '6px',
      fontSize: '12px',
      color: '#8B7355',
    },
    matchTag: {
      backgroundColor: 'rgba(139, 111, 92, 0.1)',
      color: '#5C4033',
      padding: '2px 8px',
      borderRadius: '100px',
      fontSize: '11px',
    },
    rsvpBtn: {
      marginTop: '10px',
      width: '100%',
      backgroundColor: '#8B6F5C',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '8px',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
    },
  };

  return (
    <div style={cardStyles.container}>
      <div style={cardStyles.header}>
        <h4 style={cardStyles.title}>
          {rec.meetup?.topic}
        </h4>
        <button onClick={() => onDismiss?.(rec)} style={cardStyles.dismissBtn}>
          <X size={14} />
        </button>
      </div>

      <div style={cardStyles.meta}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Calendar size={12} />
          {formatDate(rec.meetup?.date)}
        </span>
        <span style={cardStyles.matchTag}>
          {Math.round(rec.match_score * 100)}% match
        </span>
      </div>

      <button onClick={() => onRSVP?.(rec)} style={cardStyles.rsvpBtn}>
        Reserve my spot
      </button>
    </div>
  );
}

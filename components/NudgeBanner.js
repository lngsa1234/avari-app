'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, ArrowRight, Users, Calendar, Sparkles, UserPlus } from 'lucide-react';

/**
 * NudgeBanner Component
 *
 * Displays personalized nudges/prompts to encourage user engagement.
 * Shows one nudge at a time with action buttons.
 * Styled to match CircleW's warm brown color scheme.
 */
export default function NudgeBanner({ className = '' }) {
  const [nudge, setNudge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadNudge();
  }, []);

  async function loadNudge() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch pending nudges for this user
      const { data, error } = await supabase
        .from('user_nudges')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'delivered'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // Table may not exist yet - silently fail
        setLoading(false);
        return;
      }

      if (data) setNudge(data);

      // Mark as delivered
      if (data.status === 'pending') {
        await supabase
          .from('user_nudges')
          .update({
            status: 'delivered',
            delivered_at: new Date().toISOString()
          })
          .eq('id', data.id);
      }
    } catch (e) {
      console.error('[NudgeBanner] Error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleClick() {
    if (!nudge) return;

    try {
      await supabase
        .from('user_nudges')
        .update({
          status: 'clicked',
          clicked_at: new Date().toISOString()
        })
        .eq('id', nudge.id);

      // Navigate to action URL
      if (nudge.action_url) {
        window.location.href = nudge.action_url;
      }
    } catch (e) {
      console.error('[NudgeBanner] Click error:', e);
    }
  }

  async function handleDismiss() {
    if (!nudge) return;

    try {
      await supabase
        .from('user_nudges')
        .update({ status: 'dismissed' })
        .eq('id', nudge.id);

      setDismissed(true);
      setNudge(null);
    } catch (e) {
      console.error('[NudgeBanner] Dismiss error:', e);
    }
  }

  if (loading || !nudge || dismissed) {
    return null;
  }

  // CircleW color scheme
  const styles = {
    container: {
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      borderRadius: '16px',
      padding: '16px',
      boxShadow: '0 4px 24px rgba(139, 111, 92, 0.08)',
      border: '1px solid rgba(139, 111, 92, 0.15)',
      backdropFilter: 'blur(10px)',
    },
    iconWrapper: {
      width: '36px',
      height: '36px',
      backgroundColor: 'rgba(139, 111, 92, 0.12)',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    title: {
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: '600',
      fontSize: '15px',
      color: '#3D2B1F',
      margin: 0,
    },
    message: {
      fontSize: '14px',
      color: '#6B5344',
      margin: '4px 0 0 0',
    },
    dismissBtn: {
      background: 'none',
      border: 'none',
      color: '#A89080',
      cursor: 'pointer',
      padding: '4px',
    },
    actionBtn: {
      backgroundColor: '#8B6F5C',
      color: 'white',
      border: 'none',
      borderRadius: '100px',
      padding: '10px 20px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
  };

  return (
    <div style={styles.container} className={className}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
          <div style={styles.iconWrapper}>
            <Sparkles size={18} style={{ color: '#8B6F5C' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={styles.title}>{nudge.title}</p>
            <p style={styles.message}>{nudge.message}</p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          style={styles.dismissBtn}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {nudge.action_url && nudge.action_label && (
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleClick} style={styles.actionBtn}>
            {nudge.action_label}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for sidebars
 */
export function NudgeBannerCompact({ className = '' }) {
  const [nudge, setNudge] = useState(null);

  useEffect(() => {
    loadNudge();
  }, []);

  async function loadNudge() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_nudges')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'delivered'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) setNudge(data);
    } catch (e) {
      // Silently fail for compact version
    }
  }

  if (!nudge) return null;

  const compactStyles = {
    container: {
      display: 'block',
      padding: '12px',
      backgroundColor: 'rgba(139, 111, 92, 0.08)',
      borderRadius: '12px',
      textDecoration: 'none',
      cursor: 'pointer',
    },
    inner: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    text: {
      fontSize: '13px',
      fontWeight: '500',
      color: '#5C4033',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  };

  return (
    <a href={nudge.action_url || '#'} style={compactStyles.container} className={className}>
      <div style={compactStyles.inner}>
        <Sparkles size={14} style={{ color: '#8B6F5C', flexShrink: 0 }} />
        <span style={compactStyles.text}>{nudge.title}</span>
      </div>
    </a>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Search,
  Calendar,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  Filter,
  Sparkles,
  CheckCircle2,
  Circle,
  FileText,
  X,
  ListTodo,
  MessageSquare,
  Quote
} from 'lucide-react';

/**
 * MeetupRecapsPage
 *
 * Displays all meetup recaps with:
 * - Stats header (total, unreviewed, action items)
 * - Filter tabs (All, Unreviewed, Has action items)
 * - Advanced filters (date range, keyword search)
 * - Expandable recap cards with AI summary, takeaways, action items
 */
export default function MeetupRecapsPage() {
  const [recaps, setRecaps] = useState([]);
  const [filteredRecaps, setFilteredRecaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [participantProfiles, setParticipantProfiles] = useState({});

  // Filter state
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  // Expanded cards
  const [expandedCards, setExpandedCards] = useState(new Set());

  // Action items state (local tracking)
  const [completedActions, setCompletedActions] = useState(new Set());

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    unreviewed: 0,
    withActionItems: 0
  });

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadRecaps();
    }
  }, [currentUser]);

  useEffect(() => {
    applyFilters();
  }, [recaps, activeTab, searchQuery, dateFilter]);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  }

  async function loadRecaps() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('call_recaps')
        .select('*')
        .or(`created_by.eq.${currentUser.id},participant_ids.cs.{${currentUser.id}}`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const recapsData = data || [];

      // Extract IDs from channel_name and separate by call type
      const meetupIds = [];
      const groupIds = [];
      recapsData.forEach(recap => {
        const channelName = recap.channel_name || '';
        const uuidMatch = channelName.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch) {
          if (recap.call_type === 'group') {
            groupIds.push(uuidMatch[0]);
          } else {
            meetupIds.push(uuidMatch[0]);
          }
        }
      });

      // Fetch meetup details
      let meetupMap = {};
      if (meetupIds.length > 0) {
        const { data: meetups, error: meetupsError } = await supabase
          .from('meetups')
          .select('id, topic, description, date, time, location')
          .in('id', meetupIds);

        if (meetupsError) {
          console.error('Error fetching meetups:', meetupsError);
        }

        (meetups || []).forEach(m => {
          meetupMap[m.id] = m;
        });
      }

      // Fetch connection group details for group calls
      let groupMap = {};
      if (groupIds.length > 0) {
        const { data: groups, error: groupsError } = await supabase
          .from('connection_groups')
          .select('id, name')
          .in('id', groupIds);

        if (groupsError) {
          console.error('Error fetching connection groups:', groupsError);
        }

        (groups || []).forEach(g => {
          groupMap[g.id] = g;
        });
      }

      // Parse AI summaries and enrich with meetup/group data
      const enrichedRecaps = recapsData.map(recap => {
        const channelName = recap.channel_name || '';
        const uuidMatch = channelName.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        const entityId = uuidMatch ? uuidMatch[0] : null;

        // Get data from appropriate source based on call type
        const meetup = recap.call_type === 'group' ? null : (entityId ? meetupMap[entityId] : null);
        const group = recap.call_type === 'group' ? (entityId ? groupMap[entityId] : null) : null;
        const title = group?.name || meetup?.topic || null;

        return {
          ...recap,
          meetup,
          meetup_title: title,
          meetup_date: meetup?.date || null,
          meetup_time: meetup?.time || null,
          meetup_location: meetup?.location || null,
          parsed: parseAISummary(recap.ai_summary),
          viewed: localStorage.getItem(`recap_viewed_${recap.id}`) === 'true'
        };
      });

      setRecaps(enrichedRecaps);

      // Calculate stats
      const unreviewed = enrichedRecaps.filter(r => !r.viewed).length;
      const withActionItems = enrichedRecaps.filter(r => r.parsed.actionItems.length > 0).length;
      setStats({
        total: enrichedRecaps.length,
        unreviewed,
        withActionItems
      });

      // Load participant profiles
      const allParticipantIds = new Set();
      enrichedRecaps.forEach(recap => {
        (recap.participant_ids || []).forEach(id => allParticipantIds.add(id));
      });

      if (allParticipantIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, profile_picture, career')
          .in('id', Array.from(allParticipantIds));

        const profileMap = {};
        (profiles || []).forEach(p => {
          profileMap[p.id] = p;
        });
        setParticipantProfiles(profileMap);
      }

      // Load completed actions from localStorage
      const savedActions = localStorage.getItem('completed_recap_actions');
      if (savedActions) {
        setCompletedActions(new Set(JSON.parse(savedActions)));
      }

    } catch (error) {
      console.error('Error loading recaps:', error);
    } finally {
      setLoading(false);
    }
  }

  function parseAISummary(summary) {
    const emptyResult = {
      summary: '',
      sentiment: null,
      keyTakeaways: [],
      topicsDiscussed: [],
      memorableQuotes: [],
      actionItems: [],
      suggestedFollowUps: []
    };

    if (!summary) {
      return emptyResult;
    }

    // Try to parse as JSON first (structured AI response)
    try {
      const parsed = JSON.parse(summary);
      return {
        summary: parsed.summary || '',
        sentiment: parsed.sentiment || null,
        keyTakeaways: (parsed.keyTakeaways || []).map(t => typeof t === 'string' ? t : t.text || ''),
        topicsDiscussed: parsed.topicsDiscussed || [],
        memorableQuotes: parsed.memorableQuotes || [],
        actionItems: (parsed.actionItems || []).map(a => typeof a === 'string' ? a : a.text || ''),
        suggestedFollowUps: parsed.suggestedFollowUps || []
      };
    } catch (e) {
      // Not JSON, parse as text
    }

    const result = { ...emptyResult };

    // Try to extract sections from AI summary text
    const lines = summary.split('\n').filter(l => l.trim());
    let currentSection = 'summary';

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      if (lowerLine.includes('key takeaway') || lowerLine.includes('takeaways:') || lowerLine.includes('highlights:')) {
        currentSection = 'takeaways';
        continue;
      }
      if (lowerLine.includes('action item') || lowerLine.includes('next step') || lowerLine.includes('to-do') || lowerLine.includes('follow up')) {
        currentSection = 'actions';
        continue;
      }
      if (lowerLine.includes('topic') && lowerLine.includes('discussed')) {
        currentSection = 'topics';
        continue;
      }
      if (lowerLine.includes('quote') || lowerLine.includes('memorable')) {
        currentSection = 'quotes';
        continue;
      }

      const cleanLine = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();

      if (cleanLine) {
        if (currentSection === 'summary') {
          result.summary += (result.summary ? ' ' : '') + cleanLine;
        } else if (currentSection === 'takeaways') {
          if (cleanLine.length > 10) {
            result.keyTakeaways.push(cleanLine);
          }
        } else if (currentSection === 'actions') {
          if (cleanLine.length > 5) {
            result.actionItems.push(cleanLine);
          }
        } else if (currentSection === 'topics') {
          if (cleanLine.length > 3) {
            result.topicsDiscussed.push({ topic: cleanLine, mentions: 1 });
          }
        } else if (currentSection === 'quotes') {
          if (cleanLine.length > 10) {
            result.memorableQuotes.push({ quote: cleanLine, author: '' });
          }
        }
      }
    }

    // If no sections found, use whole text as summary
    if (!result.summary && result.keyTakeaways.length === 0) {
      result.summary = summary;
    }

    return result;
  }

  function applyFilters() {
    let filtered = [...recaps];

    // Tab filter
    if (activeTab === 'unreviewed') {
      filtered = filtered.filter(r => !r.viewed);
    } else if (activeTab === 'action-items') {
      filtered = filtered.filter(r => r.parsed.actionItems.length > 0);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();

      if (dateFilter === 'week') {
        cutoff.setDate(now.getDate() - 7);
      } else if (dateFilter === 'month') {
        cutoff.setMonth(now.getMonth() - 1);
      } else if (dateFilter === '3months') {
        cutoff.setMonth(now.getMonth() - 3);
      }

      filtered = filtered.filter(r => new Date(r.created_at) >= cutoff);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => {
        const parsed = r.parsed || {};
        const searchText = [
          r.meetup_title,
          r.ai_summary,
          r.channel_name,
          parsed.summary,
          ...(parsed.keyTakeaways || []),
          ...(parsed.topicsDiscussed || []).map(t => t.topic || t),
          ...(parsed.actionItems || []),
          ...(parsed.memorableQuotes || []).map(q => q.quote || q),
          ...(r.participant_ids || []).map(id => participantProfiles[id]?.name || ''),
          ...(r.participant_ids || []).map(id => participantProfiles[id]?.career || '')
        ].filter(Boolean).join(' ').toLowerCase();
        return searchText.includes(query);
      });
    }

    setFilteredRecaps(filtered);
  }

  function toggleCard(recapId) {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(recapId)) {
      newExpanded.delete(recapId);
    } else {
      newExpanded.add(recapId);
      // Mark as viewed
      localStorage.setItem(`recap_viewed_${recapId}`, 'true');
      setRecaps(prev => prev.map(r =>
        r.id === recapId ? { ...r, viewed: true } : r
      ));
    }
    setExpandedCards(newExpanded);
  }

  function toggleActionItem(recapId, actionIndex) {
    const key = `${recapId}_${actionIndex}`;
    const newCompleted = new Set(completedActions);

    if (newCompleted.has(key)) {
      newCompleted.delete(key);
    } else {
      newCompleted.add(key);
    }

    setCompletedActions(newCompleted);
    localStorage.setItem('completed_recap_actions', JSON.stringify([...newCompleted]));
  }

  function formatDate(dateStr) {
    if (!dateStr) return { month: '', day: '', full: '' };
    const date = new Date(dateStr);
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: date.getDate(),
      full: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    };
  }

  function formatDuration(seconds) {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m`;
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    try {
      const [hours, minutes] = timeStr.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return timeStr;
    }
  }

  function getCallTypeLabel(callType) {
    switch (callType) {
      case '1on1': return '1:1 Coffee Chat';
      case 'meetup':
      case 'group': return 'Circle Meetup';
      default: return 'Video Call';
    }
  }

  function highlightText(text, query) {
    if (!query.trim() || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} style={styles.highlight}>{part}</mark> : part
    );
  }

  function getParticipantAvatars(recap) {
    const ids = (recap.participant_ids || []).filter(id => id !== currentUser?.id);
    return ids.slice(0, 4).map(id => participantProfiles[id]).filter(Boolean);
  }

  // Styles matching CircleW design
  const styles = {
    container: {
      maxWidth: '900px',
      margin: '0 auto',
      padding: '24px',
      fontFamily: '"DM Sans", sans-serif',
    },
    header: {
      marginBottom: '24px',
    },
    title: {
      fontFamily: '"Playfair Display", serif',
      fontSize: '28px',
      fontWeight: '600',
      color: '#3D2B1A',
      marginBottom: '8px',
    },
    subtitle: {
      fontSize: '15px',
      color: '#7A5C42',
    },
    statsBar: {
      display: 'flex',
      gap: '16px',
      marginBottom: '24px',
      flexWrap: 'wrap',
    },
    statCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: '16px',
      padding: '16px 24px',
      boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
      border: '1px solid rgba(139, 111, 92, 0.1)',
      flex: '1',
      minWidth: '140px',
      textAlign: 'center',
    },
    statValue: {
      fontSize: '28px',
      fontWeight: '700',
      color: '#3D2B1A',
      fontFamily: '"Playfair Display", serif',
    },
    statLabel: {
      fontSize: '13px',
      color: '#7A5C42',
      marginTop: '4px',
    },
    filterBar: {
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: '16px',
      padding: '16px',
      marginBottom: '20px',
      boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
      border: '1px solid rgba(139, 111, 92, 0.1)',
    },
    tabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '12px',
    },
    tab: (active) => ({
      padding: '8px 16px',
      borderRadius: '100px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      border: 'none',
      backgroundColor: active ? '#8B6F5C' : 'rgba(139, 111, 92, 0.1)',
      color: active ? 'white' : '#5C4033',
      transition: 'all 0.2s ease',
    }),
    filterToggle: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 12px',
      borderRadius: '8px',
      border: '1px solid rgba(139, 111, 92, 0.2)',
      backgroundColor: 'transparent',
      color: '#7A5C42',
      fontSize: '13px',
      cursor: 'pointer',
    },
    filterPanel: {
      display: 'flex',
      gap: '16px',
      marginTop: '16px',
      paddingTop: '16px',
      borderTop: '1px solid rgba(139, 111, 92, 0.1)',
      flexWrap: 'wrap',
    },
    searchInput: {
      flex: '1',
      minWidth: '200px',
      padding: '10px 14px 10px 40px',
      borderRadius: '12px',
      border: '1px solid rgba(139, 111, 92, 0.2)',
      fontSize: '14px',
      outline: 'none',
      backgroundColor: 'white',
    },
    select: {
      padding: '10px 14px',
      borderRadius: '12px',
      border: '1px solid rgba(139, 111, 92, 0.2)',
      fontSize: '14px',
      outline: 'none',
      backgroundColor: 'white',
      color: '#3D2B1A',
      minWidth: '150px',
    },
    recapCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: '20px',
      marginBottom: '16px',
      boxShadow: '0 4px 20px rgba(139, 111, 92, 0.08)',
      border: '1px solid rgba(139, 111, 92, 0.1)',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
    },
    cardHeader: {
      display: 'flex',
      padding: '20px',
      cursor: 'pointer',
      alignItems: 'flex-start',
      gap: '16px',
    },
    dateBadge: {
      backgroundColor: '#FAF5EF',
      borderRadius: '12px',
      padding: '10px 14px',
      textAlign: 'center',
      minWidth: '60px',
      border: '1px solid rgba(139, 111, 92, 0.1)',
    },
    dateMonth: {
      fontSize: '11px',
      fontWeight: '600',
      color: '#8B6F5C',
      letterSpacing: '0.5px',
    },
    dateDay: {
      fontSize: '24px',
      fontWeight: '700',
      color: '#3D2B1A',
      fontFamily: '"Playfair Display", serif',
      lineHeight: '1.1',
    },
    cardContent: {
      flex: '1',
    },
    cardTitle: {
      fontSize: '17px',
      fontWeight: '600',
      color: '#3D2B1A',
      marginBottom: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    badge: (type) => ({
      fontSize: '11px',
      padding: '3px 10px',
      borderRadius: '100px',
      backgroundColor: type === 'meetup' ? 'rgba(139, 158, 126, 0.15)' : 'rgba(139, 111, 92, 0.1)',
      color: type === 'meetup' ? '#5C7A4E' : '#7A5C42',
      fontWeight: '500',
    }),
    unviewedBadge: {
      fontSize: '11px',
      padding: '3px 10px',
      borderRadius: '100px',
      backgroundColor: '#C9A96E',
      color: 'white',
      fontWeight: '600',
    },
    cardMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      fontSize: '13px',
      color: '#7A5C42',
      marginBottom: '10px',
    },
    metaItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
    },
    avatarStack: {
      display: 'flex',
    },
    avatar: (index) => ({
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      border: '2px solid white',
      marginLeft: index > 0 ? '-10px' : '0',
      backgroundColor: '#E8DDD4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      fontWeight: '600',
      color: '#8B6F5C',
      objectFit: 'cover',
    }),
    summaryPreview: {
      fontSize: '14px',
      color: '#5C4033',
      lineHeight: '1.5',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    },
    expandIcon: {
      color: '#A89080',
      flexShrink: 0,
    },
    expandedContent: {
      padding: '16px 20px 20px',
      borderTop: '1px solid rgba(139, 111, 92, 0.1)',
    },
    section: {
      marginTop: '20px',
    },
    sectionTitle: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#3D2B1A',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    aiSummary: {
      backgroundColor: 'rgba(139, 111, 92, 0.05)',
      borderRadius: '12px',
      padding: '16px',
      fontSize: '14px',
      color: '#5C4033',
      lineHeight: '1.6',
    },
    takeawayList: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
    },
    takeawayItem: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '10px 0',
      borderBottom: '1px solid rgba(139, 111, 92, 0.08)',
      fontSize: '14px',
      color: '#5C4033',
    },
    takeawayBullet: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      backgroundColor: '#8B9E7E',
      marginTop: '7px',
      flexShrink: 0,
    },
    actionItem: (completed) => ({
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '10px 14px',
      borderRadius: '10px',
      backgroundColor: completed ? 'rgba(139, 158, 126, 0.1)' : 'rgba(139, 111, 92, 0.05)',
      marginBottom: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
    actionText: (completed) => ({
      fontSize: '14px',
      color: completed ? '#8B9E7E' : '#5C4033',
      textDecoration: completed ? 'line-through' : 'none',
      flex: 1,
    }),
    checkIcon: (completed) => ({
      color: completed ? '#8B9E7E' : '#B8A089',
      flexShrink: 0,
    }),
    highlight: {
      backgroundColor: '#FEF3C7',
      padding: '1px 4px',
      borderRadius: '3px',
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: '20px',
      border: '1px solid rgba(139, 111, 92, 0.1)',
    },
    emptyIcon: {
      width: '64px',
      height: '64px',
      color: '#D4C4B5',
      margin: '0 auto 16px',
    },
    emptyTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#3D2B1A',
      marginBottom: '8px',
    },
    emptyText: {
      fontSize: '14px',
      color: '#7A5C42',
    },
    loadingSpinner: {
      width: '40px',
      height: '40px',
      border: '3px solid rgba(139, 111, 92, 0.2)',
      borderTopColor: '#8B6F5C',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '60px auto',
    },
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={styles.loadingSpinner}></div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        mark { background-color: #FEF3C7; padding: 1px 4px; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Meetup Recaps</h1>
        <p style={styles.subtitle}>Review insights and action items from your meetings</p>
      </div>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.total}</div>
          <div style={styles.statLabel}>Total Recaps</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: stats.unreviewed > 0 ? '#C9A96E' : '#3D2B1A' }}>
            {stats.unreviewed}
          </div>
          <div style={styles.statLabel}>Unreviewed</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#8B9E7E' }}>{stats.withActionItems}</div>
          <div style={styles.statLabel}>Has Action Items</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={styles.filterBar}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={styles.tabs}>
            <button
              style={styles.tab(activeTab === 'all')}
              onClick={() => setActiveTab('all')}
            >
              All ({recaps.length})
            </button>
            <button
              style={styles.tab(activeTab === 'unreviewed')}
              onClick={() => setActiveTab('unreviewed')}
            >
              Unreviewed ({stats.unreviewed})
            </button>
            <button
              style={styles.tab(activeTab === 'action-items')}
              onClick={() => setActiveTab('action-items')}
            >
              Has Action Items ({stats.withActionItems})
            </button>
          </div>

          <button
            style={styles.filterToggle}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} />
            Filters
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showFilters && (
          <div style={styles.filterPanel}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#A89080' }} />
              <input
                type="text"
                placeholder="Search recaps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A89080' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Time</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="3months">Last 3 Months</option>
            </select>
          </div>
        )}
      </div>

      {/* Recap Cards */}
      {filteredRecaps.length === 0 ? (
        <div style={styles.emptyState}>
          <FileText style={styles.emptyIcon} />
          <h3 style={styles.emptyTitle}>
            {searchQuery ? 'No matching recaps' : 'No recaps yet'}
          </h3>
          <p style={styles.emptyText}>
            {searchQuery
              ? 'Try adjusting your search or filters'
              : 'Recaps will appear here after your video calls end'}
          </p>
        </div>
      ) : (
        filteredRecaps.map(recap => {
          const isExpanded = expandedCards.has(recap.id);
          const date = formatDate(recap.started_at || recap.created_at);
          const avatars = getParticipantAvatars(recap);
          const parsed = recap.parsed;

          return (
            <div key={recap.id} style={styles.recapCard}>
              {/* Card Header */}
              <div
                style={styles.cardHeader}
                onClick={() => toggleCard(recap.id)}
              >
                {/* Date Badge */}
                <div style={styles.dateBadge}>
                  <div style={styles.dateMonth}>{date.month}</div>
                  <div style={styles.dateDay}>{date.day}</div>
                </div>

                {/* Content */}
                <div style={styles.cardContent}>
                  <div style={styles.cardTitle}>
                    {recap.meetup_title || getCallTypeLabel(recap.call_type)}
                    <span style={styles.badge(recap.call_type)}>
                      {recap.call_type === '1on1' ? '1:1' : 'Circle'}
                    </span>
                    {!recap.viewed && (
                      <span style={styles.unviewedBadge}>New</span>
                    )}
                  </div>

                  <div style={styles.cardMeta}>
                    <span style={styles.metaItem}>
                      <Clock size={14} />
                      {formatDuration(recap.duration_seconds)}
                    </span>
                    {recap.meetup_time && (
                      <span style={styles.metaItem}>
                        <Calendar size={14} />
                        {formatTime(recap.meetup_time)}
                      </span>
                    )}
                    <span style={styles.metaItem}>
                      <Users size={14} />
                      {recap.participant_count || 0} participants
                    </span>
                    <span style={{ ...styles.metaItem, color: parsed.keyTakeaways.length > 0 ? '#8B6F5C' : '#B8A089' }}>
                      <FileText size={14} />
                      {parsed.keyTakeaways.length} takeaways
                    </span>
                    <span style={{ ...styles.metaItem, color: parsed.actionItems.length > 0 ? '#8B9E7E' : '#B8A089' }}>
                      <ListTodo size={14} />
                      {parsed.actionItems.length} action items
                    </span>
                  </div>

                  {/* Meetup Location */}
                  {recap.meetup_location && (
                    <div style={{ fontSize: '13px', color: '#7A5C42', marginBottom: '8px' }}>
                      📍 {recap.meetup_location}
                    </div>
                  )}

                  {/* Attendee Avatars */}
                  {avatars.length > 0 && (
                    <div style={{ ...styles.avatarStack, marginBottom: '10px' }}>
                      {avatars.map((profile, index) => (
                        profile.profile_picture ? (
                          <img
                            key={profile.id}
                            src={profile.profile_picture}
                            alt={profile.name}
                            style={styles.avatar(index)}
                          />
                        ) : (
                          <div key={profile.id} style={styles.avatar(index)}>
                            {(profile.name || 'U')[0].toUpperCase()}
                          </div>
                        )
                      ))}
                      {(recap.participant_ids || []).length > 5 && (
                        <div style={{ ...styles.avatar(4), backgroundColor: '#8B6F5C', color: 'white' }}>
                          +{(recap.participant_ids || []).length - 4}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary Preview */}
                  {!isExpanded && parsed.summary && (
                    <p style={styles.summaryPreview}>
                      {highlightText(parsed.summary, searchQuery)}
                    </p>
                  )}
                </div>

                {/* Expand Icon */}
                <div style={styles.expandIcon}>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={styles.expandedContent}>
                  {/* Participants Section */}
                  <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>
                      <Users size={16} style={{ color: '#8B6F5C' }} />
                      Participants ({(recap.participant_ids || []).length})
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {(recap.participant_ids || []).map(id => {
                        const profile = participantProfiles[id];
                        return (
                          <div key={id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            backgroundColor: '#FAF5EF',
                            borderRadius: '20px',
                            fontSize: '13px',
                            color: '#5C4033'
                          }}>
                            {profile?.profile_picture ? (
                              <img
                                src={profile.profile_picture}
                                alt={profile.name}
                                style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: '#8B6F5C',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: '600'
                              }}>
                                {(profile?.name || 'U')[0].toUpperCase()}
                              </div>
                            )}
                            <span style={{ fontWeight: '500' }}>{profile?.name || 'Unknown'}</span>
                            {profile?.career && (
                              <span style={{ color: '#9C8068', fontSize: '12px' }}>• {profile.career}</span>
                            )}
                          </div>
                        );
                      })}
                      {(recap.participant_ids || []).length === 0 && (
                        <p style={{ fontSize: '14px', color: '#A89080', fontStyle: 'italic', margin: 0 }}>
                          No participant data available
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Meetup Details */}
                  {recap.meetup && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '16px',
                      padding: '16px',
                      backgroundColor: 'rgba(139, 111, 92, 0.05)',
                      borderRadius: '12px',
                      fontSize: '13px',
                      color: '#5C4033',
                    }}>
                      {recap.meetup_date && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} style={{ color: '#8B6F5C' }} />
                          <span>{new Date(recap.meetup_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      )}
                      {recap.meetup_time && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} style={{ color: '#8B6F5C' }} />
                          <span>{formatTime(recap.meetup_time)}</span>
                        </div>
                      )}
                      {recap.meetup_location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📍</span>
                          <span>{recap.meetup_location}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} style={{ color: '#8B6F5C' }} />
                        <span>Duration: {formatDuration(recap.duration_seconds)}</span>
                      </div>
                    </div>
                  )}

                  {/* Sentiment */}
                  {parsed.sentiment && (
                    <div style={styles.section}>
                      <h4 style={styles.sectionTitle}>
                        <span style={{ fontSize: '16px' }}>{parsed.sentiment.emoji || '✨'}</span>
                        Meeting Vibe
                      </h4>
                      <div style={{
                        padding: '16px',
                        backgroundColor: 'rgba(201, 169, 110, 0.1)',
                        borderRadius: '12px',
                        borderLeft: '4px solid #C9A96E'
                      }}>
                        <p style={{ fontSize: '16px', fontWeight: '600', color: '#5C4033', margin: '0 0 8px 0' }}>
                          {parsed.sentiment.overall}
                        </p>
                        {parsed.sentiment.highlights && parsed.sentiment.highlights.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                            {parsed.sentiment.highlights.map((h, i) => (
                              <span key={i} style={{
                                padding: '4px 10px',
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                fontSize: '12px',
                                color: '#7A5C42'
                              }}>
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Summary */}
                  <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>
                      <Sparkles size={16} style={{ color: '#C9A96E' }} />
                      AI Summary
                    </h4>
                    <div style={styles.aiSummary}>
                      {parsed.summary ? (
                        highlightText(parsed.summary, searchQuery)
                      ) : recap.ai_summary ? (
                        highlightText(recap.ai_summary, searchQuery)
                      ) : (
                        <span style={{ color: '#A89080', fontStyle: 'italic' }}>
                          No summary available for this call
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Topics Discussed */}
                  {parsed.topicsDiscussed && parsed.topicsDiscussed.length > 0 && (
                    <div style={styles.section}>
                      <h4 style={styles.sectionTitle}>
                        <MessageSquare size={16} style={{ color: '#6B8E7A' }} />
                        Topics Discussed
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {parsed.topicsDiscussed.map((t, i) => (
                          <span key={i} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            backgroundColor: 'rgba(107, 142, 122, 0.1)',
                            borderRadius: '16px',
                            fontSize: '13px',
                            color: '#5C4033'
                          }}>
                            {t.topic || t}
                            {t.mentions && t.mentions > 1 && (
                              <span style={{
                                backgroundColor: '#6B8E7A',
                                color: 'white',
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '10px'
                              }}>
                                {t.mentions}x
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Memorable Quotes */}
                  {parsed.memorableQuotes && parsed.memorableQuotes.length > 0 && (
                    <div style={styles.section}>
                      <h4 style={styles.sectionTitle}>
                        <Quote size={16} style={{ color: '#9B7EC4' }} />
                        Memorable Quotes
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {parsed.memorableQuotes.map((q, i) => (
                          <div key={i} style={{
                            padding: '12px 16px',
                            backgroundColor: 'rgba(155, 126, 196, 0.08)',
                            borderRadius: '12px',
                            borderLeft: '3px solid #9B7EC4'
                          }}>
                            <p style={{ fontSize: '14px', fontStyle: 'italic', color: '#5C4033', margin: 0 }}>
                              "{q.quote || q}"
                            </p>
                            {q.author && (
                              <p style={{ fontSize: '12px', color: '#7A5C42', margin: '6px 0 0 0' }}>
                                — {q.author}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Takeaways */}
                  <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>
                      <FileText size={16} style={{ color: '#8B6F5C' }} />
                      Key Takeaways
                    </h4>
                    {parsed.keyTakeaways.length > 0 ? (
                      <ul style={styles.takeawayList}>
                        {parsed.keyTakeaways.map((takeaway, i) => (
                          <li key={i} style={styles.takeawayItem}>
                            <div style={styles.takeawayBullet}></div>
                            <span>{highlightText(takeaway, searchQuery)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ fontSize: '14px', color: '#A89080', fontStyle: 'italic', margin: 0 }}>
                        No key takeaways from this call
                      </p>
                    )}
                  </div>

                  {/* Action Items */}
                  <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>
                      <ListTodo size={16} style={{ color: '#8B9E7E' }} />
                      Action Items
                    </h4>
                    {parsed.actionItems.length > 0 ? (
                      parsed.actionItems.map((item, i) => {
                        const isCompleted = completedActions.has(`${recap.id}_${i}`);
                        return (
                          <div
                            key={i}
                            style={styles.actionItem(isCompleted)}
                            onClick={() => toggleActionItem(recap.id, i)}
                          >
                            {isCompleted ? (
                              <CheckCircle2 size={18} style={styles.checkIcon(true)} />
                            ) : (
                              <Circle size={18} style={styles.checkIcon(false)} />
                            )}
                            <span style={styles.actionText(isCompleted)}>
                              {highlightText(item, searchQuery)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p style={{ fontSize: '14px', color: '#A89080', fontStyle: 'italic', margin: 0 }}>
                        No action items from this call
                      </p>
                    )}
                  </div>

                  {/* Suggested Follow-ups */}
                  {parsed.suggestedFollowUps && parsed.suggestedFollowUps.length > 0 && (
                    <div style={styles.section}>
                      <h4 style={styles.sectionTitle}>
                        <Users size={16} style={{ color: '#C9A96E' }} />
                        Suggested Follow-ups
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {parsed.suggestedFollowUps.map((followUp, i) => (
                          <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            backgroundColor: 'rgba(201, 169, 110, 0.08)',
                            borderRadius: '12px'
                          }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: '#C9A96E',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: '600'
                            }}>
                              {(followUp.personName || 'U')[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '14px', fontWeight: '600', color: '#3D2B1A', margin: 0 }}>
                                {followUp.personName}
                              </p>
                              {followUp.reason && (
                                <p style={{ fontSize: '12px', color: '#7A5C42', margin: '2px 0 0 0' }}>
                                  {followUp.reason}
                                </p>
                              )}
                              {followUp.suggestedTopic && (
                                <p style={{ fontSize: '12px', color: '#9C8068', margin: '2px 0 0 0' }}>
                                  Topic: {followUp.suggestedTopic}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

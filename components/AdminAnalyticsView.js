'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  UserPlus,
  Activity,
  Coffee,
  Calendar,
  MessageCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Minus,
  Video,
  Wifi
} from 'lucide-react';
import { colors as tokens } from '@/lib/designTokens';

export default function AdminAnalyticsView({ currentUser, supabase }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [daysBack, setDaysBack] = useState(90);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAnalytics();
  }, [daysBack]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await supabase.rpc('get_admin_analytics', {
        days_back: daysBack
      });
      if (rpcError) throw rpcError;
      setData(result);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-[#6B5344] animate-spin" />
        <span className="ml-2 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 font-medium">Failed to load analytics</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
        <button
          onClick={loadAnalytics}
          className="mt-3 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'acquisition', label: 'Acquisition', icon: UserPlus },
    { id: 'retention', label: 'Retention', icon: TrendingUp },
    { id: 'engagement', label: 'Engagement', icon: Activity },
    { id: 'video', label: 'Video', icon: Video },
  ];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1 text-sm text-[#8B6F5C] hover:text-[#6B5344] mb-4 transition-colors"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#F4EEE6] to-[#E8DDD0] rounded-lg p-6 border border-[#D4A574]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-[#6B5344]" />
              Analytics Dashboard
            </h3>
            <p className="text-sm text-gray-600 mt-1">Acquisition & retention metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="bg-white border border-[#D4A574] rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6B5344]"
            >
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 6 months</option>
              <option value={365}>Last year</option>
            </select>
            <button
              onClick={loadAnalytics}
              className="p-2 text-[#6B5344] hover:bg-[#E8DDD0] rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-[#6B5344] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab data={data} />}
      {activeTab === 'acquisition' && <AcquisitionTab data={data} />}
      {activeTab === 'retention' && <RetentionTab data={data} />}
      {activeTab === 'engagement' && <EngagementTab data={data} />}
      {activeTab === 'video' && <VideoTab data={data} />}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, subtitle, color = 'text-[#6B5344]' }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${color}`} />}
      </div>
      <p className="text-2xl font-bold text-gray-800">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Mini Bar Chart (text-based) ─────────────────────────────

function MiniBarChart({ data, labelKey, valueKey, maxBars = 12 }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No data yet</p>;
  }

  const displayData = data.slice(-maxBars);
  const maxVal = Math.max(...displayData.map(d => d[valueKey] || 0), 1);

  return (
    <div className="flex items-end gap-1 h-32">
      {displayData.map((d, i) => {
        const val = d[valueKey] || 0;
        const height = Math.max((val / maxVal) * 100, 4);
        const label = typeof d[labelKey] === 'string' ? d[labelKey].slice(5) : d[labelKey]; // trim year
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-gray-500">{val}</span>
            <div
              className="w-full bg-[#6B5344] rounded-t-sm min-w-[8px] transition-all"
              style={{ height: `${height}%` }}
              title={`${d[labelKey]}: ${val}`}
            />
            <span className="text-[9px] text-gray-400 truncate w-full text-center">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────

function OverviewTab({ data }) {
  const onboardingRate = data.total_users > 0
    ? Math.round(100 * data.total_onboarded / data.total_users)
    : 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={data.total_users} icon={Users} />
        <StatCard label="DAU" value={data.dau} icon={Activity} subtitle="Active today" />
        <StatCard label="WAU" value={data.wau} icon={TrendingUp} subtitle="Active this week" />
        <StatCard label="MAU" value={data.mau} icon={Users} subtitle="Active this month" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Onboarding Rate" value={`${onboardingRate}%`} icon={UserPlus} subtitle={`${data.total_onboarded} of ${data.total_users}`} />
        <StatCard label="Coffee Chats" value={data.total_coffee_chats} icon={Coffee} />
        <StatCard label="Meetup Signups" value={data.total_meetup_signups} icon={Calendar} />
        <StatCard label="Active Circles" value={data.total_circles} icon={Users} />
      </div>

      {/* Signup Trend */}
      <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Signups by Week</h4>
        <MiniBarChart data={data.signups_by_week} labelKey="week" valueKey="count" />
      </div>

      {/* Engagement Trend */}
      <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Weekly Engagement</h4>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center"><Coffee className="w-3 h-3 mr-1" /> Coffee Chats</p>
            <MiniBarChart data={data.engagement_by_week} labelKey="week" valueKey="coffee_chats" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center"><Calendar className="w-3 h-3 mr-1" /> Meetup Signups</p>
            <MiniBarChart data={data.engagement_by_week} labelKey="week" valueKey="meetup_signups" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center"><MessageCircle className="w-3 h-3 mr-1" /> Messages</p>
            <MiniBarChart data={data.engagement_by_week} labelKey="week" valueKey="messages" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Acquisition Tab ─────────────────────────────────────────

function AcquisitionTab({ data }) {
  const funnel = data.onboarding_funnel;
  const funnelSteps = [
    { label: 'Signed Up', value: funnel.total_signups, pct: 100 },
    { label: 'Onboarding Done', value: funnel.completed_onboarding, pct: funnel.total_signups > 0 ? Math.round(100 * funnel.completed_onboarding / funnel.total_signups) : 0 },
    { label: 'Profile 50%+', value: funnel.profile_50_plus, pct: funnel.total_signups > 0 ? Math.round(100 * funnel.profile_50_plus / funnel.total_signups) : 0 },
    { label: 'Profile Complete', value: funnel.profile_complete, pct: funnel.total_signups > 0 ? Math.round(100 * funnel.profile_complete / funnel.total_signups) : 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Signups by Day */}
      <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Daily Signups</h4>
        <MiniBarChart data={data.signups_by_day} labelKey="day" valueKey="count" maxBars={30} />
      </div>

      {/* Onboarding Funnel */}
      <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Onboarding Funnel</h4>
        <div className="space-y-3">
          {funnelSteps.map((step, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{step.label}</span>
                <span className="font-medium text-gray-800">{step.value} ({step.pct}%)</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${step.pct}%`,
                    backgroundColor: i === 0 ? '#6B5344' : i === 1 ? '#8B6F5F' : i === 2 ? '#AB8F7F' : '#D4A574'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Signups */}
      <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Weekly Signups</h4>
        <MiniBarChart data={data.signups_by_week} labelKey="week" valueKey="count" />
      </div>
    </div>
  );
}

// ─── Retention Tab ───────────────────────────────────────────

function RetentionTab({ data }) {
  const buckets = data.activity_buckets;
  const totalUsers = (buckets.active_today || 0) + (buckets.active_1_7d || 0) +
    (buckets.active_7_14d || 0) + (buckets.active_14_30d || 0) + (buckets.inactive_30d_plus || 0);

  const bucketData = [
    { label: 'Active today', value: buckets.active_today, color: '#22c55e' },
    { label: '1-7 days ago', value: buckets.active_1_7d, color: '#84cc16' },
    { label: '7-14 days ago', value: buckets.active_7_14d, color: '#eab308' },
    { label: '14-30 days ago', value: buckets.active_14_30d, color: '#f97316' },
    { label: '30+ days / never', value: buckets.inactive_30d_plus, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      {/* Activity Distribution */}
      <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-4">User Activity Distribution</h4>
        <div className="space-y-3">
          {bucketData.map((b, i) => {
            const pct = totalUsers > 0 ? Math.round(100 * b.value / totalUsers) : 0;
            return (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{b.label}</span>
                  <span className="font-medium text-gray-800">{b.value} ({pct}%)</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: b.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cohort Retention */}
      <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Weekly Cohort Retention</h4>
        <p className="text-xs text-gray-400 mb-4">% of each signup cohort active in the last 7 days</p>

        {data.cohort_retention.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No cohort data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Cohort Week</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Size</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Active (7d)</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Retention</th>
                </tr>
              </thead>
              <tbody>
                {data.cohort_retention.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 px-2 text-gray-600">{c.cohort_week}</td>
                    <td className="py-2 px-2 text-right text-gray-800">{c.cohort_size}</td>
                    <td className="py-2 px-2 text-right text-gray-800">{c.active_last_7d}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        c.retention_pct >= 50 ? 'bg-green-100 text-green-700' :
                        c.retention_pct >= 25 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {c.retention_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DAU/WAU/MAU */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="DAU" value={data.dau} icon={Activity} />
        <StatCard label="WAU" value={data.wau} icon={TrendingUp} />
        <StatCard label="MAU" value={data.mau} icon={Users} />
      </div>

      {/* Stickiness */}
      <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Stickiness Ratio</h4>
        <p className="text-xs text-gray-400 mb-3">DAU/MAU — higher is better (benchmark: 20%+ is good)</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-800">
            {data.mau > 0 ? Math.round(100 * data.dau / data.mau) : 0}%
          </span>
          <span className="text-sm text-gray-500">DAU/MAU</span>
        </div>
      </div>
    </div>
  );
}

// ─── Engagement Tab ──────────────────────────────────────────

function EngagementTab({ data }) {
  const eng = data.engagement;

  return (
    <div className="space-y-6">
      {/* Engagement Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Coffee Chats Done" value={eng.coffee_chats_completed} icon={Coffee} />
        <StatCard label="Pending Chats" value={eng.coffee_chats_pending} icon={Clock} />
        <StatCard label="Meetup Signups" value={eng.meetup_signups} icon={Calendar} />
        <StatCard label="Messages Sent" value={eng.messages_sent} icon={MessageCircle} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Circles Created" value={eng.circles_created} icon={Users} />
        <StatCard label="Circles Joined" value={eng.circles_joined} icon={UserPlus} />
        <StatCard label="Calls Made" value={eng.calls_made} icon={Activity} />
        <StatCard label="Call Minutes" value={Math.round(eng.total_call_minutes)} icon={Clock} />
      </div>

      {/* Engagement Trends */}
      <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Weekly Activity Trends</h4>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center"><Coffee className="w-3 h-3 mr-1" /> Coffee Chats</p>
            <MiniBarChart data={data.engagement_by_week} labelKey="week" valueKey="coffee_chats" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center"><Calendar className="w-3 h-3 mr-1" /> Meetup Signups</p>
            <MiniBarChart data={data.engagement_by_week} labelKey="week" valueKey="meetup_signups" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center"><MessageCircle className="w-3 h-3 mr-1" /> Messages</p>
            <MiniBarChart data={data.engagement_by_week} labelKey="week" valueKey="messages" />
          </div>
        </div>
      </div>

      {/* Top Users */}
      <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Top Engaged Users</h4>
        {data.top_users.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">User</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Chats</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Meetups</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Messages</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.top_users.map((u, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 px-2">
                      <div className="text-gray-800 font-medium">{u.name || 'Unnamed'}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">{u.coffee_chats}</td>
                    <td className="py-2 px-2 text-right text-gray-700">{u.meetup_signups}</td>
                    <td className="py-2 px-2 text-right text-gray-700">{u.messages_sent}</td>
                    <td className="py-2 px-2 text-right font-semibold text-[#6B5344]">{u.total_actions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Video Performance Tab ──────────────────────────────────

const PROVIDER_LABELS = { webrtc: 'WebRTC', livekit: 'LiveKit', agora: 'Agora' };
const PROVIDER_DESCRIPTIONS = {
  webrtc: 'Peer-to-peer · 1:1 Coffee Chats',
  livekit: 'SFU Server · Meetups & Fallback',
  agora: 'SFU Server · Connection Groups',
};

const QUALITY_COLORS = {
  excellent: '#22c55e',
  good: '#84cc16',
  fair: '#eab308',
  poor: '#ef4444',
};

function qualityScore(row) {
  const total = (row.excellent_count || 0) + (row.good_count || 0) + (row.fair_count || 0) + (row.poor_count || 0);
  if (total === 0) return 0;
  return Math.round(
    ((row.excellent_count * 4 + row.good_count * 3 + row.fair_count * 2 + row.poor_count * 1) / total) * 25
  ); // 0-100 scale
}

function VideoTab({ data }) {
  const providerSummary = data.provider_metrics_summary || [];
  const callsByProvider = data.calls_by_provider || [];
  const callsByWeek = data.calls_by_week_provider || [];

  // Merge metrics by provider (aggregate across call types)
  const byProvider = {};
  providerSummary.forEach(row => {
    if (!byProvider[row.provider]) {
      byProvider[row.provider] = {
        provider: row.provider,
        total_calls: 0, avg_latency: 0, avg_packet_loss: 0, avg_bitrate: 0,
        avg_duration_minutes: 0, excellent_count: 0, good_count: 0, fair_count: 0, poor_count: 0,
        _count: 0,
      };
    }
    const p = byProvider[row.provider];
    p.total_calls += row.total_calls;
    p.avg_latency += (row.avg_latency || 0) * row.total_calls;
    p.avg_packet_loss += (row.avg_packet_loss || 0) * row.total_calls;
    p.avg_bitrate += (row.avg_bitrate || 0) * row.total_calls;
    p.avg_duration_minutes += (row.avg_duration_minutes || 0) * row.total_calls;
    p.excellent_count += row.excellent_count || 0;
    p.good_count += row.good_count || 0;
    p.fair_count += row.fair_count || 0;
    p.poor_count += row.poor_count || 0;
    p._count += row.total_calls;
  });

  // Weighted averages
  Object.values(byProvider).forEach(p => {
    if (p._count > 0) {
      p.avg_latency = Math.round(p.avg_latency / p._count);
      p.avg_packet_loss = Math.round((p.avg_packet_loss / p._count) * 100) / 100;
      p.avg_bitrate = Math.round(p.avg_bitrate / p._count);
      p.avg_duration_minutes = Math.round((p.avg_duration_minutes / p._count) * 10) / 10;
    }
  });

  const providers = ['webrtc', 'livekit', 'agora'];
  const hasData = providerSummary.length > 0 || callsByProvider.length > 0;

  // Total calls from call_recaps
  const totalCalls = callsByProvider.reduce((sum, p) => sum + p.total_calls, 0);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Video Calls" value={totalCalls} icon={Video} />
        <StatCard
          label="Call Minutes"
          value={Math.round(callsByProvider.reduce((sum, p) => sum + (p.total_seconds || 0), 0) / 60)}
          icon={Clock}
        />
        <StatCard label="Providers Active" value={callsByProvider.length} icon={Wifi} />
        <StatCard
          label="Avg Duration"
          value={callsByProvider.length > 0
            ? `${Math.round(callsByProvider.reduce((s, p) => s + (p.avg_duration_minutes || 0), 0) / callsByProvider.length)}m`
            : '0m'}
          icon={Clock}
        />
      </div>

      {/* Provider Cards */}
      {providers.map(providerKey => {
        const p = byProvider[providerKey];
        const recap = callsByProvider.find(c => c.provider === providerKey);
        const totalQuality = p ? (p.excellent_count + p.good_count + p.fair_count + p.poor_count) : 0;

        return (
          <div key={providerKey} className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700">{PROVIDER_LABELS[providerKey]}</h4>
                <p className="text-xs text-gray-400">{PROVIDER_DESCRIPTIONS[providerKey]}</p>
              </div>
              {p && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  qualityScore(p) >= 75 ? 'bg-green-100 text-green-700' :
                  qualityScore(p) >= 50 ? 'bg-yellow-100 text-yellow-700' :
                  qualityScore(p) >= 25 ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  Score: {p ? qualityScore(p) : 0}/100
                </span>
              )}
            </div>

            {!p && !recap ? (
              <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Calls</p>
                    <p className="text-lg font-bold text-gray-800">{recap?.total_calls || p?.total_calls || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Latency</p>
                    <p className="text-lg font-bold text-gray-800">{p?.avg_latency || 0}<span className="text-xs font-normal text-gray-400">ms</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Packet Loss</p>
                    <p className="text-lg font-bold text-gray-800">{p?.avg_packet_loss || 0}<span className="text-xs font-normal text-gray-400">%</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Bitrate</p>
                    <p className="text-lg font-bold text-gray-800">{p?.avg_bitrate || 0}<span className="text-xs font-normal text-gray-400">kbps</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Duration</p>
                    <p className="text-lg font-bold text-gray-800">{p?.avg_duration_minutes || recap?.avg_duration_minutes || 0}<span className="text-xs font-normal text-gray-400">min</span></p>
                  </div>
                </div>

                {/* Connection Quality Distribution */}
                {totalQuality > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Connection Quality Distribution</p>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                      {['excellent', 'good', 'fair', 'poor'].map(q => {
                        const count = p[`${q}_count`] || 0;
                        const pct = (count / totalQuality) * 100;
                        if (pct === 0) return null;
                        return (
                          <div
                            key={q}
                            className="h-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: QUALITY_COLORS[q] }}
                            title={`${q}: ${count} (${Math.round(pct)}%)`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex gap-4 mt-2">
                      {['excellent', 'good', 'fair', 'poor'].map(q => {
                        const count = p[`${q}_count`] || 0;
                        if (count === 0) return null;
                        return (
                          <div key={q} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: QUALITY_COLORS[q] }} />
                            <span className="text-[10px] text-gray-500 capitalize">{q} {count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Provider Comparison Table */}
      {hasData && (
        <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Provider Comparison</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Metric</th>
                  {providers.map(p => (
                    <th key={p} className="text-right py-2 px-2 text-xs font-medium text-gray-500">
                      {PROVIDER_LABELS[p]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Total Calls', key: 'total_calls', fallbackKey: 'total_calls' },
                  { label: 'Avg Latency (ms)', key: 'avg_latency' },
                  { label: 'Packet Loss (%)', key: 'avg_packet_loss' },
                  { label: 'Avg Bitrate (kbps)', key: 'avg_bitrate' },
                  { label: 'Avg Duration (min)', key: 'avg_duration_minutes' },
                ].map((metric, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 px-2 text-gray-600">{metric.label}</td>
                    {providers.map(providerKey => {
                      const p = byProvider[providerKey];
                      const recap = callsByProvider.find(c => c.provider === providerKey);
                      let val = p ? p[metric.key] : 0;
                      if (!val && metric.fallbackKey && recap) val = recap[metric.fallbackKey];
                      return (
                        <td key={providerKey} className="py-2 px-2 text-right text-gray-800 font-medium">
                          {val || '\u2014'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-b border-gray-50">
                  <td className="py-2 px-2 text-gray-600">Quality Score</td>
                  {providers.map(providerKey => {
                    const p = byProvider[providerKey];
                    const score = p ? qualityScore(p) : 0;
                    return (
                      <td key={providerKey} className="py-2 px-2 text-right">
                        {p ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            score >= 75 ? 'bg-green-100 text-green-700' :
                            score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            score >= 25 ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {score}/100
                          </span>
                        ) : '\u2014'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Weekly Call Volume by Provider */}
      {callsByWeek.length > 0 && (
        <div className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Weekly Call Volume</h4>
          <MiniBarChart data={callsByWeek} labelKey="week" valueKey="total" />
          <div className="flex gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#6B5344]" />
              <span className="text-[10px] text-gray-500">Total calls per week</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

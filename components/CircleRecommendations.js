'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Sparkles, X, ChevronRight, RefreshCw } from 'lucide-react';

/**
 * CircleRecommendations Component
 *
 * Displays AI-powered circle/group recommendations for the current user.
 * Shows match reasons and allows users to join directly.
 */
export default function CircleRecommendations({
  className = '',
  maxItems = 3,
  showRefresh = false
}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('circle_match_scores')
        .select(`
          *,
          circle:connection_groups(
            id, name, is_active,
            connection_group_members(count)
          )
        `)
        .eq('user_id', user.id)
        .order('match_score', { ascending: false })
        .limit(maxItems + 2);

      if (error) {
        console.error('[CircleRecs] Load error:', error);
        setLoading(false);
        return;
      }

      // Filter active circles only
      const activeMatches = (data || [])
        .filter(m => m.circle?.is_active)
        .slice(0, maxItems);

      setMatches(activeMatches);
    } catch (e) {
      console.error('[CircleRecs] Error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Trigger new matching
      await fetch('/api/agent/circle-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      await loadMatches();
    } catch (e) {
      console.error('[CircleRecs] Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleJoin(match) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Request to join the circle
      const { error } = await supabase
        .from('connection_group_members')
        .insert({
          group_id: match.circle_id,
          user_id: user.id,
          status: 'pending' // or 'accepted' depending on circle settings
        });

      if (error) {
        // May already be a member or pending
        console.error('[CircleRecs] Join error:', error);
        return;
      }

      // Remove from recommendations
      setMatches(prev => prev.filter(m => m.id !== match.id));

      // Navigate to circle
      window.location.href = `/circles/${match.circle_id}`;
    } catch (e) {
      console.error('[CircleRecs] Join error:', e);
    }
  }

  async function handleDismiss(match) {
    try {
      // Remove from local state (optionally could mark in DB)
      setMatches(prev => prev.filter(m => m.id !== match.id));
    } catch (e) {
      console.error('[CircleRecs] Dismiss error:', e);
    }
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Users className="text-blue-500" size={18} />
          <h3 className="font-semibold text-gray-900">Circles for You</h3>
        </div>
        {showRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Refresh recommendations"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Matches list */}
      <div className="divide-y">
        {matches.map(match => (
          <div key={match.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                {/* Circle name */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users size={14} className="text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {match.circle?.name}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {match.circle?.connection_group_members?.[0]?.count || 0} members
                    </p>
                  </div>
                </div>

                {/* Match reasons */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {(match.match_reasons || []).slice(0, 2).map((reason, i) => (
                    <span
                      key={i}
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                    >
                      {reason.reason}
                    </span>
                  ))}
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {Math.round(match.match_score * 100)}% match
                  </span>
                </div>
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => handleDismiss(match)}
                className="text-gray-400 hover:text-gray-600 p-1 -mt-1"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleJoin(match)}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Join Circle
              </button>
              <a
                href={`/circles/${match.circle_id}`}
                className="border border-gray-300 text-gray-700 px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-1"
              >
                View
                <ChevronRight size={14} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* View all link */}
      <div className="p-3 border-t bg-gray-50">
        <a
          href="/circles"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
        >
          Browse all circles
          <ChevronRight size={14} />
        </a>
      </div>
    </div>
  );
}

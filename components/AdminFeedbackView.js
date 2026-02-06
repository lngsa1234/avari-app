'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Bug,
  Lightbulb,
  Wrench,
  HelpCircle,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Filter,
  RefreshCw,
  User,
  Calendar,
  X
} from 'lucide-react';

/**
 * AdminFeedbackView - Admin panel to view and manage user feedback
 */
export default function AdminFeedbackView({ currentUser, supabase }) {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const limit = 20;

  const categories = {
    bug: { label: 'Bug Report', icon: Bug, color: 'text-red-500', bg: 'bg-red-100' },
    feature: { label: 'Feature Request', icon: Lightbulb, color: 'text-yellow-500', bg: 'bg-yellow-100' },
    improvement: { label: 'Improvement', icon: Wrench, color: 'text-blue-500', bg: 'bg-blue-100' },
    other: { label: 'Other', icon: HelpCircle, color: 'text-gray-500', bg: 'bg-gray-100' }
  };

  const statuses = {
    new: { label: 'New', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
    reviewed: { label: 'Reviewed', color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
    in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700', icon: XCircle }
  };

  useEffect(() => {
    loadFeedback();
  }, [statusFilter, categoryFilter, page]);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      // Use Supabase client directly with user's auth context
      let query = supabase
        .from('user_feedback')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error loading feedback:', error);
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          // Table doesn't exist yet
          setFeedback([]);
          setTotal(0);
        }
      } else {
        // Fetch profiles separately for user and reviewer
        const feedbackData = data || [];
        const userIds = [...new Set([
          ...feedbackData.map(f => f.user_id).filter(Boolean),
          ...feedbackData.map(f => f.reviewed_by).filter(Boolean)
        ])];

        let profileMap = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, email, profile_picture')
            .in('id', userIds);
          (profiles || []).forEach(p => { profileMap[p.id] = p; });
        }

        // Merge profiles into feedback
        const feedbackWithProfiles = feedbackData.map(f => ({
          ...f,
          user: profileMap[f.user_id] || null,
          reviewer: profileMap[f.reviewed_by] || null
        }));

        setFeedback(feedbackWithProfiles);
        setTotal(count || 0);
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFeedbackStatus = async (feedbackId, newStatus) => {
    try {
      const { error } = await supabase
        .from('user_feedback')
        .update({
          status: newStatus,
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', feedbackId);

      if (!error) {
        // Update local state
        setFeedback(prev => prev.map(f =>
          f.id === feedbackId ? { ...f, status: newStatus } : f
        ));
        if (selectedFeedback?.id === feedbackId) {
          setSelectedFeedback(prev => ({ ...prev, status: newStatus }));
        }
      }
    } catch (error) {
      console.error('Error updating feedback:', error);
    }
  };

  const updateAdminNotes = async (feedbackId, notes) => {
    try {
      await supabase
        .from('user_feedback')
        .update({
          admin_notes: notes,
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', feedbackId);
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <MessageSquare className="w-7 h-7 mr-3 text-purple-500" />
            User Feedback
          </h1>
          <p className="text-gray-600 mt-1">Manage feedback from users</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
              showFilters || statusFilter || categoryFilter
                ? 'bg-purple-50 border-purple-300 text-purple-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(statusFilter || categoryFilter) && (
              <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                {[statusFilter, categoryFilter].filter(Boolean).length}
              </span>
            )}
          </button>
          <button
            onClick={loadFeedback}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow p-4 mb-6 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Statuses</option>
              {Object.entries(statuses).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Categories</option>
              {Object.entries(categories).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          {(statusFilter || categoryFilter) && (
            <div className="flex items-end">
              <button
                onClick={() => { setStatusFilter(''); setCategoryFilter(''); setPage(0); }}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {Object.entries(statuses).map(([key, { label, color, icon: Icon }]) => {
          const count = feedback.filter(f => f.status === key).length;
          return (
            <button
              key={key}
              onClick={() => { setStatusFilter(statusFilter === key ? '' : key); setPage(0); }}
              className={`p-4 rounded-xl border transition ${
                statusFilter === key ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                  {label}
                </span>
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-800 mt-2">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : feedback.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Feedback Yet</h3>
          <p className="text-gray-500">User feedback will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {feedback.map((item) => {
                const cat = categories[item.category] || categories.other;
                const status = statuses[item.status] || statuses.new;
                const CatIcon = cat.icon;

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedFeedback(item)}
                    className="hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {item.user?.profile_picture ? (
                          <img
                            src={item.user.profile_picture}
                            alt={item.user.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center">
                            <span className="text-purple-700 text-sm font-medium">
                              {(item.user?.name || 'U')[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-800">
                          {item.user?.name || item.user?.email || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cat.bg} ${cat.color}`}>
                        <CatIcon className="w-3 h-3" />
                        {cat.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-800 truncate max-w-xs">{item.subject}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      {item.rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm text-gray-700">{item.rating}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
              <p className="text-sm text-gray-600">
                Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback Detail Modal */}
      {selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          categories={categories}
          statuses={statuses}
          onClose={() => setSelectedFeedback(null)}
          onStatusChange={updateFeedbackStatus}
          onNotesChange={updateAdminNotes}
          formatDate={formatDate}
        />
      )}
    </div>
  );
}

/**
 * Feedback Detail Modal
 */
function FeedbackDetailModal({ feedback, categories, statuses, onClose, onStatusChange, onNotesChange, formatDate }) {
  const [notes, setNotes] = useState(feedback.admin_notes || '');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const cat = categories[feedback.category] || categories.other;
  const status = statuses[feedback.status] || statuses.new;
  const CatIcon = cat.icon;

  const handleNotesBlur = () => {
    if (notes !== feedback.admin_notes) {
      onNotesChange(feedback.id, notes);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CatIcon className="w-6 h-6" />
              <span className={`px-3 py-1 rounded-full text-sm font-medium bg-white bg-opacity-20`}>
                {cat.label}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <h2 className="text-xl font-bold mt-3">{feedback.subject}</h2>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* User & Meta */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {feedback.user?.profile_picture ? (
                <img
                  src={feedback.user.profile_picture}
                  alt={feedback.user.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-700" />
                </div>
              )}
              <div>
                <p className="font-medium text-gray-800">{feedback.user?.name || 'Unknown'}</p>
                <p className="text-sm text-gray-500">{feedback.user?.email}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-gray-500 text-sm">
                <Calendar className="w-4 h-4" />
                {formatDate(feedback.created_at)}
              </div>
              {feedback.rating && (
                <div className="flex items-center gap-1 mt-1 justify-end">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= feedback.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className={`flex items-center justify-between w-full px-4 py-2 rounded-lg border ${status.color}`}
            >
              <span className="font-medium">{status.label}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {showStatusDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {Object.entries(statuses).map(([key, { label, color }]) => (
                  <button
                    key={key}
                    onClick={() => {
                      onStatusChange(feedback.id, key);
                      setShowStatusDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      feedback.status === key ? 'bg-gray-50' : ''
                    }`}
                  >
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <div className="bg-gray-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">
              {feedback.message}
            </div>
          </div>

          {/* Page Context */}
          {feedback.page_context && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Page Context</label>
              <div className="bg-gray-50 rounded-lg px-4 py-2 text-gray-600 text-sm">
                {feedback.page_context}
              </div>
            </div>
          )}

          {/* Admin Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add internal notes about this feedback..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Reviewed Info */}
          {feedback.reviewed_by && feedback.reviewer && (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Reviewed by {feedback.reviewer.name} on {formatDate(feedback.reviewed_at)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

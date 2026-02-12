// components/MeetupProposalsView.js
// View for users to propose meetups (admin approval required)
'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Send, CheckCircle, XCircle, Eye, Trash2 } from 'lucide-react';
import { parseLocalDate } from '../lib/dateUtils';
import {
  submitMeetupProposal,
  getMyProposals,
  getPendingProposals,
  getAllProposals,
  approveProposal,
  rejectProposal,
  updateMyProposal,
  deleteMyProposal
} from '@/lib/meetupProposalHelpers';

export default function MeetupProposalsView({ currentUser, supabase, isAdmin }) {
  const [activeTab, setActiveTab] = useState(isAdmin ? 'pending' : 'myProposals');
  const [myProposals, setMyProposals] = useState([]);
  const [allProposals, setAllProposals] = useState([]);
  const [pendingProposals, setPendingProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);

  // Form states
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60'); // Default 60 minutes
  const [participantLimit, setParticipantLimit] = useState('100'); // Default 100
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [vibeCategory, setVibeCategory] = useState(''); // advice, vent, grow

  // Vibe categories
  const VIBE_OPTIONS = [
    { id: '', label: 'Select a vibe (optional)' },
    { id: 'advice', label: 'I need advice - Mentorship & guidance' },
    { id: 'vent', label: 'I want to vent - Support & casual' },
    { id: 'grow', label: 'I want to grow - Skills & learning' }
  ];

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        if (activeTab === 'pending') {
          const pending = await getPendingProposals(supabase);
          setPendingProposals(pending);
        } else if (activeTab === 'all') {
          const all = await getAllProposals(supabase);
          setAllProposals(all);
        }
      } else {
        const mine = await getMyProposals(supabase);
        setMyProposals(mine);
      }
    } catch (error) {
      console.error('Error loading proposals:', error);
    }
    setLoading(false);
  };

  const handleSubmitProposal = async () => {
    if (!topic.trim() || !date || !time || !duration) {
      alert('Please fill in all required fields (topic, date, time, duration)');
      return;
    }

    try {
      await submitMeetupProposal(supabase, {
        topic: topic.trim(),
        date,
        time,
        duration: parseInt(duration),
        participant_limit: participantLimit ? parseInt(participantLimit) : 100,
        description: description.trim() || null,
        vibe_category: vibeCategory || null
      });

      alert('✅ Proposal submitted! An admin will review it soon.');

      // Reset form
      setShowCreateModal(false);
      setTopic('');
      setDate('');
      setTime('');
      setDuration('60');
      setParticipantLimit('100');
      setDescription('');
      setVibeCategory('');

      // Reload data
      await loadData();
    } catch (error) {
      alert('Error submitting proposal: ' + error.message);
    }
  };

  const handleApprove = async (proposalId) => {
    try {
      await approveProposal(supabase, proposalId, location.trim() || null);
      alert('✅ Proposal approved and meetup created!');

      // Reset
      setShowReviewModal(false);
      setSelectedProposal(null);
      setLocation('');

      // Reload
      await loadData();
    } catch (error) {
      alert('Error approving proposal: ' + error.message);
    }
  };

  const handleReject = async (proposalId) => {
    if (!confirm('Reject this proposal?')) return;

    try {
      await rejectProposal(supabase, proposalId, rejectionReason.trim() || null);
      alert('Proposal rejected');

      // Reset
      setShowReviewModal(false);
      setSelectedProposal(null);
      setRejectionReason('');

      // Reload
      await loadData();
    } catch (error) {
      alert('Error rejecting proposal: ' + error.message);
    }
  };

  const handleDeleteMyProposal = async (proposalId) => {
    if (!confirm('Delete this proposal?')) return;

    try {
      await deleteMyProposal(supabase, proposalId);
      alert('Proposal deleted');
      await loadData();
    } catch (error) {
      alert('Error deleting proposal: ' + error.message);
    }
  };

  const openReviewModal = (proposal) => {
    setSelectedProposal(proposal);
    setShowReviewModal(true);
  };

  const formatDate = (dateStr) => {
    try {
      const date = parseLocalDate(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr) => {
    try {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Pending Review</span>;
      case 'approved':
        return <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center"><CheckCircle className="w-3 h-3 mr-1" />Approved</span>;
      case 'rejected':
        return <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full flex items-center"><XCircle className="w-3 h-3 mr-1" />Rejected</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading proposals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center mb-2">
          <Calendar className="w-6 h-6 mr-2 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">
            {isAdmin ? 'Meetup Proposals (Admin)' : 'Propose a Meetup'}
          </h3>
        </div>
        <p className="text-sm text-gray-600">
          {isAdmin
            ? 'Review and approve user-submitted meetup proposals'
            : 'Suggest a meetup topic - admins will review and create it if approved'}
        </p>
      </div>

      {/* User: Create Proposal Button */}
      {!isAdmin && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
        >
          <Send className="w-5 h-5 mr-2" />
          Propose New Meetup
        </button>
      )}

      {/* Admin Tabs */}
      {isAdmin && (
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'pending'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Pending ({pendingProposals.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'all'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            All Proposals ({allProposals.length})
          </button>
        </div>
      )}

      {/* User: My Proposals */}
      {!isAdmin && (
        <div className="space-y-4">
          {myProposals.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No proposals yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Submit a meetup idea and we'll review it!
              </p>
            </div>
          ) : (
            myProposals.map(proposal => (
              <div key={proposal.id} className="bg-white rounded-lg shadow p-5 border border-gray-200">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 text-lg">{proposal.topic || proposal.title}</h4>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(proposal.date)} at {formatTime(proposal.time)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      {proposal.duration && (
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {proposal.duration} min
                        </span>
                      )}
                      {proposal.participant_limit && (
                        <span>Max {proposal.participant_limit} participants</span>
                      )}
                    </div>
                    {proposal.description && (
                      <p className="text-sm text-gray-600 mt-2">{proposal.description}</p>
                    )}
                  </div>
                  <div>{getStatusBadge(proposal.status)}</div>
                </div>

                {proposal.status === 'rejected' && proposal.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                    <p className="text-xs font-medium text-red-800">Rejection Reason:</p>
                    <p className="text-sm text-red-700 mt-1">{proposal.rejection_reason}</p>
                  </div>
                )}

                {proposal.status === 'pending' && (
                  <button
                    onClick={() => handleDeleteMyProposal(proposal.id)}
                    className="mt-3 w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 rounded-lg transition-colors border border-red-200 text-sm flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Proposal
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Admin: Pending Proposals */}
      {isAdmin && activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingProposals.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No pending proposals</p>
            </div>
          ) : (
            pendingProposals.map(proposal => (
              <div key={proposal.id} className="bg-white rounded-lg shadow p-5 border-2 border-blue-200">
                <div className="mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-800 text-lg">{proposal.topic || proposal.title}</h4>
                    {getStatusBadge(proposal.status)}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mt-1">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDate(proposal.date)} at {formatTime(proposal.time)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    {proposal.duration && (
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {proposal.duration} min
                      </span>
                    )}
                    {proposal.participant_limit && (
                      <span>Max {proposal.participant_limit} participants</span>
                    )}
                  </div>
                  {proposal.description && (
                    <p className="text-sm text-gray-600 mt-2">{proposal.description}</p>
                  )}
                  <div className="bg-blue-50 rounded-lg p-2 mt-3">
                    <p className="text-xs text-blue-800">
                      Proposed by: <span className="font-medium">{proposal.proposer?.name || 'Unknown'}</span>
                      {proposal.proposer?.email && ` (${proposal.proposer.email})`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => openReviewModal(proposal)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Review & Approve/Reject
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Admin: All Proposals */}
      {isAdmin && activeTab === 'all' && (
        <div className="space-y-4">
          {allProposals.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No proposals yet</p>
            </div>
          ) : (
            allProposals.map(proposal => (
              <div key={proposal.id} className="bg-white rounded-lg shadow p-5 border border-gray-200">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 text-lg">{proposal.topic || proposal.title}</h4>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(proposal.date)} at {formatTime(proposal.time)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      {proposal.duration && (
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {proposal.duration} min
                        </span>
                      )}
                      {proposal.participant_limit && (
                        <span>Max {proposal.participant_limit} participants</span>
                      )}
                    </div>
                    {proposal.description && (
                      <p className="text-sm text-gray-600 mt-2">{proposal.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      By: {proposal.proposer?.name || 'Unknown'}
                    </p>
                  </div>
                  <div>{getStatusBadge(proposal.status)}</div>
                </div>

                {proposal.status === 'rejected' && proposal.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                    <p className="text-xs font-medium text-red-800">Rejection Reason:</p>
                    <p className="text-sm text-red-700 mt-1">{proposal.rejection_reason}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Proposal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Propose a Meetup</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setTopic('');
                  setDate('');
                  setTime('');
                  setDuration('60');
                  setParticipantLimit('100');
                  setDescription('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic *
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Product Manager Coffee Chat"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-blue-500"
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time *
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration *
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-blue-500"
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Participant Limit
                  </label>
                  <input
                    type="number"
                    value={participantLimit}
                    onChange={(e) => setParticipantLimit(e.target.value)}
                    placeholder="100"
                    min="2"
                    max="500"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional, default 100</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us more about your meetup idea..."
                  className="w-full border border-gray-300 rounded-lg p-3 h-24 resize-none focus:outline-none focus:border-blue-500"
                  maxLength={1000}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {description.length}/1000 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vibe Category (Optional)
                </label>
                <select
                  value={vibeCategory}
                  onChange={(e) => setVibeCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-blue-500"
                >
                  {VIBE_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Helps others find your meetup based on their mood
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setTopic('');
                  setDate('');
                  setTime('');
                  setDuration('60');
                  setParticipantLimit('100');
                  setDescription('');
                  setVibeCategory('');
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitProposal}
                disabled={!topic.trim() || !date || !time || !duration}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Submit Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal (Admin) */}
      {showReviewModal && selectedProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Review Proposal</h3>
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedProposal(null);
                  setLocation('');
                  setRejectionReason('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm font-medium text-gray-700">Topic:</p>
                <p className="text-gray-800">{selectedProposal.topic || selectedProposal.title}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Date & Time:</p>
                <p className="text-gray-800">
                  {formatDate(selectedProposal.date)} at {formatTime(selectedProposal.time)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Duration:</p>
                  <p className="text-gray-800">{selectedProposal.duration || 60} minutes</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Participant Limit:</p>
                  <p className="text-gray-800">{selectedProposal.participant_limit || 100}</p>
                </div>
              </div>

              {selectedProposal.description && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Description:</p>
                  <p className="text-gray-800">{selectedProposal.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700">Proposed By:</p>
                <p className="text-gray-800">
                  {selectedProposal.proposer?.name || 'Unknown'}
                  {selectedProposal.proposer?.email && ` (${selectedProposal.proposer.email})`}
                </p>
              </div>

              {/* Location (for approval) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location (Optional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Starbucks on Main St"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Set location now or add it later from the meetup management screen
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleApprove(selectedProposal.id)}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Approve & Create Meetup
              </button>

              <button
                onClick={() => handleReject(selectedProposal.id)}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
              >
                <XCircle className="w-5 h-5 mr-2" />
                Reject Proposal
              </button>

              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedProposal(null);
                  setLocation('');
                  setRejectionReason('');
                }}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { MessageSquarePlus, X, Send, Bug, Lightbulb, Wrench, HelpCircle, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * FeedbackButton - Floating button with modal for users to submit feedback
 */
export default function FeedbackButton({ currentUser, pageContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const categories = [
    { value: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-500' },
    { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-yellow-500' },
    { value: 'improvement', label: 'Improvement', icon: Wrench, color: 'text-blue-500' },
    { value: 'other', label: 'Other', icon: HelpCircle, color: 'text-gray-500' }
  ];

  const resetForm = () => {
    setCategory('');
    setSubject('');
    setMessage('');
    setRating(0);
    setSubmitted(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    // Reset form after animation
    setTimeout(resetForm, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!category || !subject || !message) {
      alert('Please fill in all required fields');
      return;
    }

    if (subject.length < 3) {
      alert('Subject must be at least 3 characters');
      return;
    }

    if (message.length < 10) {
      alert('Message must be at least 10 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit directly using Supabase client (has user auth context for RLS)
      const { data, error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: currentUser.id,
          category,
          subject,
          message,
          page_context: pageContext || null,
          rating: rating > 0 ? rating : null,
          status: 'new'
        })
        .select()
        .single();

      if (error) {
        console.error('Error submitting feedback:', error);
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          alert('Feedback system not yet configured. Please run the database migration.');
        } else {
          alert('Failed to submit feedback: ' + error.message);
        }
      } else {
        setSubmitted(true);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all z-40 group"
        title="Send Feedback"
      >
        <MessageSquarePlus className="w-6 h-6" />
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Send Feedback
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquarePlus className="w-6 h-6" />
                  <h2 className="text-xl font-bold">Send Feedback</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-purple-100 mt-1 text-sm">
                We'd love to hear your thoughts!
              </p>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">&#10003;</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Thank You!</h3>
                  <p className="text-gray-600 mb-6">
                    Your feedback has been submitted successfully. We appreciate you taking the time to help us improve.
                  </p>
                  <button
                    onClick={handleClose}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Category Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {categories.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => setCategory(cat.value)}
                            className={`flex items-center gap-2 p-3 rounded-lg border-2 transition ${
                              category === cat.value
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${cat.color}`} />
                            <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief summary of your feedback"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      maxLength={200}
                    />
                    <p className="text-xs text-gray-400 mt-1">{subject.length}/200</p>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Please describe your feedback in detail..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      rows={5}
                      maxLength={5000}
                    />
                    <p className="text-xs text-gray-400 mt-1">{message.length}/5000</p>
                  </div>

                  {/* Rating (Optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Overall Experience (Optional)
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 transition"
                        >
                          <Star
                            className={`w-8 h-8 transition ${
                              star <= (hoverRating || rating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                      {rating > 0 && (
                        <button
                          type="button"
                          onClick={() => setRating(0)}
                          className="ml-2 text-sm text-gray-400 hover:text-gray-600"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !category || !subject || !message}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Send Feedback
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { MessageCircle, RefreshCw, Sparkles } from 'lucide-react';

/**
 * IcebreakerDisplay Component
 *
 * Displays icebreaker questions for a meetup.
 * Can be used during meetups to facilitate conversation.
 */
export default function IcebreakerDisplay({
  meetupId,
  meetupTitle,
  meetupDescription,
  attendees = [],
  className = ''
}) {
  const [icebreakers, setIcebreakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAI, setIsAI] = useState(false);

  useEffect(() => {
    if (meetupId) {
      loadIcebreakers();
    }
  }, [meetupId]);

  async function loadIcebreakers() {
    setLoading(true);
    try {
      // First try to get cached icebreakers
      const getResponse = await fetch(`/api/agent/icebreakers?meetupId=${meetupId}`);
      const getData = await getResponse.json();

      if (getData.found && getData.icebreakers) {
        setIcebreakers(getData.icebreakers);
        setIsAI(getData.tier === 'light_ai' || getData.tier === 'ai');
        setLoading(false);
        return;
      }

      // Generate new icebreakers
      const postResponse = await fetch('/api/agent/icebreakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetupId,
          title: meetupTitle,
          description: meetupDescription,
          attendees: attendees.map(a => ({
            career: a.career,
            interests: a.interests
          }))
        })
      });

      const postData = await postResponse.json();
      if (postData.icebreakers) {
        setIcebreakers(postData.icebreakers);
        setIsAI(postData.tier === 'light_ai' || postData.tier === 'ai');
      }
    } catch (e) {
      console.error('[IcebreakerDisplay] Error:', e);
      // Set fallback icebreakers
      setIcebreakers([
        { question: "What brings you here today?", category: "intro" },
        { question: "What's something you're excited about right now?", category: "general" },
        { question: "What's the best advice you've received recently?", category: "learning" }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function nextQuestion() {
    setCurrentIndex((prev) => (prev + 1) % icebreakers.length);
  }

  function prevQuestion() {
    setCurrentIndex((prev) => (prev - 1 + icebreakers.length) % icebreakers.length);
  }

  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="text-purple-600" size={20} />
          <span className="font-medium text-gray-900">Loading icebreakers...</span>
        </div>
        <div className="animate-pulse h-20 bg-white/50 rounded-lg"></div>
      </div>
    );
  }

  if (icebreakers.length === 0) {
    return null;
  }

  const currentIcebreaker = icebreakers[currentIndex];

  return (
    <div className={`bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="text-purple-600" size={20} />
          <span className="font-medium text-gray-900">Icebreaker</span>
          {isAI && (
            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              <Sparkles size={10} />
              AI-generated
            </span>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {currentIndex + 1} / {icebreakers.length}
        </span>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <p className="text-lg text-gray-900 leading-relaxed">
          {currentIcebreaker.question}
        </p>
        {currentIcebreaker.category && (
          <span className="inline-block mt-3 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {currentIcebreaker.category}
          </span>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={prevQuestion}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
        >
          Previous
        </button>
        <button
          onClick={nextQuestion}
          className="flex items-center gap-1 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          <RefreshCw size={14} />
          Next Question
        </button>
      </div>
    </div>
  );
}

/**
 * Compact inline version for chat/call interfaces
 */
export function IcebreakerInline({ meetupId, className = '' }) {
  const [icebreaker, setIcebreaker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (meetupId) loadIcebreaker();
  }, [meetupId]);

  async function loadIcebreaker() {
    try {
      const response = await fetch(`/api/agent/icebreakers?meetupId=${meetupId}`);
      const data = await response.json();

      if (data.found && data.icebreakers?.length > 0) {
        // Pick a random one
        const randomIndex = Math.floor(Math.random() * data.icebreakers.length);
        setIcebreaker(data.icebreakers[randomIndex]);
      }
    } catch (e) {
      console.error('[IcebreakerInline] Error:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !icebreaker) return null;

  return (
    <div className={`flex items-start gap-2 p-3 bg-purple-50 rounded-lg ${className}`}>
      <MessageCircle size={16} className="text-purple-600 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-purple-900">{icebreaker.question}</p>
    </div>
  );
}

/**
 * List all icebreakers
 */
export function IcebreakerList({ meetupId, className = '' }) {
  const [icebreakers, setIcebreakers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (meetupId) loadIcebreakers();
  }, [meetupId]);

  async function loadIcebreakers() {
    try {
      const response = await fetch(`/api/agent/icebreakers?meetupId=${meetupId}`);
      const data = await response.json();

      if (data.found && data.icebreakers) {
        setIcebreakers(data.icebreakers);
      }
    } catch (e) {
      console.error('[IcebreakerList] Error:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded-lg"></div>;
  }

  if (icebreakers.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="font-medium text-gray-900 flex items-center gap-2">
        <MessageCircle size={16} className="text-purple-600" />
        Icebreaker Questions
      </h4>
      <ul className="space-y-2">
        {icebreakers.map((ib, i) => (
          <li
            key={i}
            className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700"
          >
            {ib.question}
          </li>
        ))}
      </ul>
    </div>
  );
}

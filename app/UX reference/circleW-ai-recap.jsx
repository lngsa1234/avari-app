import React, { useState } from 'react';
import { Sparkles, TrendingUp, Users, Coffee, Calendar, MessageCircle, Heart, ChevronRight, ArrowUp, Star, Lightbulb, Target } from 'lucide-react';

// Sample recap data
const recapData = {
  period: "January 2026",
  generatedAt: "Feb 1, 2026",
  
  highlights: {
    newConnections: 8,
    coffeeChats: 5,
    eventsAttended: 3,
    circlesJoined: 2,
    messagesExchanged: 47,
  },
  
  connectionGrowth: {
    current: 24,
    previous: 16,
    percentChange: 50,
  },

  topConnections: [
    { name: "Sarah M.", emoji: "👩‍💼", interactions: 12, bg: "bg-[#E6DCD4]" },
    { name: "Maya L.", emoji: "👩‍🦱", interactions: 8, bg: "bg-[#E2DDD8]" },
    { name: "Jessica R.", emoji: "👩", interactions: 6, bg: "bg-[#E8E0D8]" },
  ],

  topicsDiscussed: [
    { topic: "Career Growth", count: 15, emoji: "📈" },
    { topic: "Work-Life Balance", count: 12, emoji: "⚖️" },
    { topic: "Leadership", count: 8, emoji: "👑" },
    { topic: "Entrepreneurship", count: 6, emoji: "🚀" },
  ],

  memorableMoments: [
    {
      type: "event",
      title: "Women in Tech Brunch",
      description: "You connected with 5 new people at this event!",
      emoji: "🎉",
      date: "Jan 15",
    },
    {
      type: "coffee",
      title: "Coffee chat with Sarah M.",
      description: "Great discussion about career transitions",
      emoji: "☕",
      date: "Jan 20",
    },
    {
      type: "circle",
      title: "Joined Career Changers Circle",
      description: "Your first intimate circle!",
      emoji: "🦋",
      date: "Jan 22",
    },
  ],

  aiInsights: [
    {
      icon: "💡",
      title: "You're a connector!",
      description: "You've introduced 3 people to each other this month. Keep building bridges!",
    },
    {
      icon: "🎯",
      title: "Career focus",
      description: "Most of your conversations are about career growth. Consider joining the Leadership Circle.",
    },
    {
      icon: "⏰",
      title: "Morning person",
      description: "You're most active between 9-11 AM. Your connections appreciate your energy!",
    },
  ],

  suggestions: [
    {
      emoji: "👩‍🦰",
      title: "Connect with Priya K.",
      description: "You both attended Women in Tech Brunch but haven't chatted yet.",
      action: "Schedule Chat",
    },
    {
      emoji: "🧘‍♀️",
      title: "Try Wellness Warriors",
      description: "Based on your interest in work-life balance.",
      action: "View Circle",
    },
    {
      emoji: "📚",
      title: "Book Club meetup",
      description: "Happening this Sunday - matches your interests!",
      action: "RSVP",
    },
  ],

  quote: {
    text: "The richest people in the world look for and build networks. Everyone else looks for work.",
    author: "Robert Kiyosaki",
  },
};

export default function AIRecapPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("january");

  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#E6DCD4] to-[#D4C8BC] rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-[#6B5D52]" />
          </div>
          <h1 className="text-2xl font-semibold text-[#3D3D3D]" style={{ fontFamily: "'Playfair Display', serif" }}>
            Your AI Recap ✨
          </h1>
          <p className="text-[#8C7B6B] mt-1">{recapData.period}</p>
          <p className="text-xs text-[#8C7B6B]/60 mt-1">Generated {recapData.generatedAt}</p>
        </div>

        {/* Highlights Stats */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <StatCard number={recapData.highlights.newConnections} label="New Connections" emoji="👋" />
          <StatCard number={recapData.highlights.coffeeChats} label="Coffee Chats" emoji="☕" />
          <StatCard number={recapData.highlights.eventsAttended} label="Events" emoji="🎉" />
          <StatCard number={recapData.highlights.circlesJoined} label="Circles" emoji="🤝" />
          <StatCard number={recapData.highlights.messagesExchanged} label="Messages" emoji="💬" />
        </div>

        {/* Network Growth */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#3D3D3D] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#6B9080]" />
              Network Growth
            </h2>
            <div className="flex items-center gap-1 text-[#6B9080] text-sm font-medium">
              <ArrowUp className="w-4 h-4" />
              {recapData.connectionGrowth.percentChange}%
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-4xl font-bold text-[#3D3D3D]">{recapData.connectionGrowth.current}</p>
              <p className="text-sm text-[#8C7B6B]">total connections</p>
            </div>
            <div className="flex-1 h-16 flex items-end gap-1">
              {[40, 45, 50, 55, 60, 70, 85, 100].map((height, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-gradient-to-t from-[#8C7B6B] to-[#B89E8B] rounded-t-sm"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Top Connections */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
          <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-[#E57373]" />
            Top Connections
          </h2>
          <div className="space-y-3">
            {recapData.topConnections.map((person, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-lg font-semibold text-[#8C7B6B] w-6">{index + 1}</span>
                <div className={`w-10 h-10 ${person.bg} rounded-full flex items-center justify-center text-xl`}>
                  {person.emoji}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#3D3D3D]">{person.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[#5D4E42]">{person.interactions} interactions</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Topics Discussed */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
          <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#8C7B6B]" />
            What You Talked About
          </h2>
          <div className="space-y-3">
            {recapData.topicsDiscussed.map((topic, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-xl">{topic.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-[#3D3D3D]">{topic.topic}</p>
                    <p className="text-xs text-[#8C7B6B]">{topic.count} mentions</p>
                  </div>
                  <div className="h-2 bg-[#F5EDE5] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#8C7B6B] to-[#B89E8B] rounded-full"
                      style={{ width: `${(topic.count / 15) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Memorable Moments */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
          <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-[#F9A825]" />
            Memorable Moments
          </h2>
          <div className="space-y-3">
            {recapData.memorableMoments.map((moment, index) => (
              <div key={index} className="flex gap-3 p-3 bg-[#FAF6F3] rounded-xl">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {moment.emoji}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#3D3D3D] text-sm">{moment.title}</p>
                  <p className="text-xs text-[#8C7B6B]">{moment.description}</p>
                </div>
                <p className="text-xs text-[#8C7B6B]">{moment.date}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-gradient-to-br from-[#E6DCD4] to-[#DED4CA] rounded-3xl p-5 mb-4">
          <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-[#6B5D52]" />
            AI Insights
          </h2>
          <div className="space-y-3">
            {recapData.aiInsights.map((insight, index) => (
              <div key={index} className="bg-white/80 backdrop-blur rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{insight.icon}</span>
                  <div>
                    <p className="font-medium text-[#3D3D3D]">{insight.title}</p>
                    <p className="text-sm text-[#8C7B6B]">{insight.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
          <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#8C7B6B]" />
            Suggested for You
          </h2>
          <div className="space-y-3">
            {recapData.suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border border-[#E6DDD4] rounded-xl">
                <div className="w-10 h-10 bg-[#F5EDE5] rounded-full flex items-center justify-center text-xl">
                  {suggestion.emoji}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#3D3D3D] text-sm">{suggestion.title}</p>
                  <p className="text-xs text-[#8C7B6B]">{suggestion.description}</p>
                </div>
                <button className="px-3 py-1.5 bg-[#8C7B6B] text-white text-xs font-medium rounded-lg hover:bg-[#6B5D52] transition-colors">
                  {suggestion.action}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Inspirational Quote */}
        <div className="bg-[#FFFCFA] rounded-3xl p-6 border-2 border-dashed border-[#E6DDD4] text-center mb-4">
          <p className="text-lg text-[#5D4E42] italic mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
            "{recapData.quote.text}"
          </p>
          <p className="text-sm text-[#8C7B6B]">— {recapData.quote.author}</p>
        </div>

        {/* Share Button */}
        <div className="text-center">
          <button className="px-6 py-3 bg-[#8C7B6B] text-white font-medium rounded-full hover:bg-[#6B5D52] transition-colors">
            Share My Recap ✨
          </button>
          <p className="text-xs text-[#8C7B6B] mt-2">Show your network growth!</p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');
        
        * {
          font-family: 'DM Sans', sans-serif;
        }
      `}</style>
    </div>
  );
}

function StatCard({ number, label, emoji }) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-[#E6DDD4] text-center">
      <div className="text-xl mb-1">{emoji}</div>
      <p className="text-xl font-bold text-[#3D3D3D]">{number}</p>
      <p className="text-xs text-[#8C7B6B] leading-tight">{label}</p>
    </div>
  );
}

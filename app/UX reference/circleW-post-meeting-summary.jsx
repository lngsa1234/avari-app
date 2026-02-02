import React, { useState } from 'react';
import { Sparkles, Users, Clock, MapPin, MessageCircle, Lightbulb, UserPlus, Calendar, ChevronRight, Check, Share2, Download, ThumbsUp, Video } from 'lucide-react';

// Sample meeting summary data
const meetingSummaryData = {
  meeting: {
    title: "Women in Tech Leadership Brunch",
    type: "group",
    emoji: "👩‍💻",
    bg: "bg-[#E6DCD4]",
    date: "Saturday, Feb 1, 2026",
    time: "10:00 AM - 12:00 PM",
    duration: "2 hours",
    location: "The Gathering Café, Birmingham",
    host: "Sarah M.",
    attendees: 12,
  },

  yourStats: {
    peopleMetCount: 8,
    conversationsCount: 5,
    cardsExchanged: 4,
    followUpsScheduled: 2,
  },

  keyTakeaways: [
    {
      emoji: "💡",
      text: "Leadership isn't about titles — it's about impact and influence at any level.",
    },
    {
      emoji: "🎯",
      text: "Building a personal board of advisors can accelerate career growth.",
    },
    {
      emoji: "⚡",
      text: "Visibility matters: Share your wins and advocate for yourself.",
    },
    {
      emoji: "🤝",
      text: "Mentorship is a two-way street — reverse mentoring benefits both parties.",
    },
  ],

  topicsDiscussed: [
    { topic: "Career advancement strategies", mentions: 8 },
    { topic: "Work-life integration", mentions: 6 },
    { topic: "Building executive presence", mentions: 5 },
    { topic: "Negotiation skills", mentions: 4 },
    { topic: "Managing imposter syndrome", mentions: 3 },
  ],

  newConnections: [
    {
      name: "Jessica R.",
      emoji: "👩",
      role: "Founder & CEO",
      company: "TechVentures",
      bg: "bg-[#E8E0D8]",
      sharedInterests: ["Entrepreneurship", "Leadership"],
      connected: true,
    },
    {
      name: "Angela W.",
      emoji: "👩‍💻",
      role: "Financial Advisor",
      company: "Wealth Partners",
      bg: "bg-[#E0D8D0]",
      sharedInterests: ["Finance", "Career Growth"],
      connected: true,
    },
    {
      name: "Priya K.",
      emoji: "👩‍🦰",
      role: "Product Manager",
      company: "Fortune 500",
      bg: "bg-[#E6E0DA]",
      sharedInterests: ["Product", "Tech"],
      connected: false,
    },
    {
      name: "Emma T.",
      emoji: "👩‍🎨",
      role: "Creative Director",
      company: "Design Agency",
      bg: "bg-[#E4DAD4]",
      sharedInterests: ["Creativity", "Leadership"],
      connected: false,
    },
  ],

  suggestedFollowUps: [
    {
      person: { name: "Jessica R.", emoji: "👩", bg: "bg-[#E8E0D8]" },
      reason: "You both discussed entrepreneurship challenges",
      suggestedTopic: "Starting a business while employed",
    },
    {
      person: { name: "Priya K.", emoji: "👩‍🦰", bg: "bg-[#E6E0DA]" },
      reason: "Shared interest in product management",
      suggestedTopic: "PM career paths and transitions",
    },
  ],

  actionItems: [
    { text: "Read 'The First 90 Days' - recommended by Jessica", done: false },
    { text: "Connect with Priya on LinkedIn", done: false },
    { text: "Schedule coffee chat with Angela about financial planning", done: true },
    { text: "Share article on executive presence with the group", done: false },
  ],

  memorableQuotes: [
    {
      quote: "Your network is your net worth, but only if you nurture it.",
      author: "Jessica R.",
    },
    {
      quote: "Don't wait for permission to lead — start where you are.",
      author: "Sarah M.",
    },
  ],

  sentiment: {
    overall: "Energizing & Inspiring",
    emoji: "🔥",
    highlights: ["Great energy", "Actionable advice", "Authentic connections"],
  },
};

export default function PostMeetingSummaryPage() {
  const [actionItems, setActionItems] = useState(meetingSummaryData.actionItems);

  const toggleActionItem = (index) => {
    const updated = [...actionItems];
    updated[index].done = !updated[index].done;
    setActionItems(updated);
  };

  const summary = meetingSummaryData;

  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 border border-[#E6DDD4] mb-4">
          <div className="flex items-center gap-2 text-[#8C7B6B] text-sm mb-3">
            <Sparkles className="w-4 h-4" />
            <span>AI-Generated Summary</span>
          </div>
          
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 ${summary.meeting.bg} rounded-2xl flex items-center justify-center text-3xl flex-shrink-0`}>
              {summary.meeting.emoji}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-[#3D3D3D] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                {summary.meeting.title}
              </h1>
              <p className="text-sm text-[#8C7B6B]">Hosted by {summary.meeting.host}</p>
            </div>
          </div>

          {/* Meeting Details */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[#E6DDD4]">
            <div className="flex items-center gap-2 text-sm text-[#5D4E42]">
              <Calendar className="w-4 h-4 text-[#8C7B6B]" />
              <span>{summary.meeting.date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#5D4E42]">
              <Clock className="w-4 h-4 text-[#8C7B6B]" />
              <span>{summary.meeting.duration}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#5D4E42]">
              <MapPin className="w-4 h-4 text-[#8C7B6B]" />
              <span>{summary.meeting.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#5D4E42]">
              <Users className="w-4 h-4 text-[#8C7B6B]" />
              <span>{summary.meeting.attendees} attended</span>
            </div>
          </div>
        </div>

        {/* Your Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <StatCard number={summary.yourStats.peopleMetCount} label="People Met" emoji="👋" />
          <StatCard number={summary.yourStats.conversationsCount} label="Conversations" emoji="💬" />
          <StatCard number={summary.yourStats.cardsExchanged} label="Cards Exchanged" emoji="📇" />
          <StatCard number={summary.yourStats.followUpsScheduled} label="Follow-ups" emoji="📅" />
        </div>

        {/* Overall Sentiment */}
        <div className="bg-gradient-to-r from-[#E6DCD4] to-[#DED4CA] rounded-3xl p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#8C7B6B] mb-1">Meeting Vibe</p>
              <p className="text-xl font-semibold text-[#3D3D3D] flex items-center gap-2">
                {summary.sentiment.emoji} {summary.sentiment.overall}
              </p>
            </div>
            <div className="flex gap-2">
              {summary.sentiment.highlights.map((highlight, i) => (
                <span key={i} className="px-3 py-1 bg-white/60 text-[#5D4E42] text-xs font-medium rounded-full">
                  {highlight}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Key Takeaways */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
          <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-[#F9A825]" />
            Key Takeaways
          </h2>
          <div className="space-y-3">
            {summary.keyTakeaways.map((takeaway, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-[#FAF6F3] rounded-xl">
                <span className="text-xl">{takeaway.emoji}</span>
                <p className="text-sm text-[#3D3D3D]">{takeaway.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Topics Discussed */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
          <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#8C7B6B]" />
            Topics Discussed
          </h2>
          <div className="flex flex-wrap gap-2">
            {summary.topicsDiscussed.map((topic, index) => (
              <span 
                key={index} 
                className="px-3 py-2 bg-[#F5EDE5] text-[#5D4E42] text-sm rounded-full flex items-center gap-2"
              >
                {topic.topic}
                <span className="w-5 h-5 bg-[#E6DDD4] text-[#8C7B6B] text-xs rounded-full flex items-center justify-center">
                  {topic.mentions}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* New Connections */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
          <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#6B9080]" />
            People You Met
          </h2>
          <div className="space-y-3">
            {summary.newConnections.map((person, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border border-[#E6DDD4] rounded-xl">
                <div className={`w-12 h-12 ${person.bg} rounded-full flex items-center justify-center text-2xl`}>
                  {person.emoji}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[#3D3D3D]">{person.name}</p>
                    {person.connected && (
                      <span className="px-2 py-0.5 bg-[#E8F5E9] text-[#4CAF50] text-xs font-medium rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#8C7B6B]">{person.role} at {person.company}</p>
                  <div className="flex gap-1 mt-1">
                    {person.sharedInterests.map((interest, i) => (
                      <span key={i} className="text-xs text-[#8C7B6B] bg-[#F5EDE5] px-2 py-0.5 rounded">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
                {!person.connected && (
                  <button className="px-4 py-2 bg-[#8C7B6B] text-white text-sm font-medium rounded-xl hover:bg-[#6B5D52] transition-colors">
                    Connect
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Suggested Follow-ups */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
          <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#8C7B6B]" />
            Suggested Follow-ups
          </h2>
          <div className="space-y-3">
            {summary.suggestedFollowUps.map((followUp, index) => (
              <div key={index} className="p-4 bg-[#FAF6F3] rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 ${followUp.person.bg} rounded-full flex items-center justify-center text-xl`}>
                    {followUp.person.emoji}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[#3D3D3D]">Coffee chat with {followUp.person.name}</p>
                    <p className="text-xs text-[#8C7B6B]">{followUp.reason}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E6DDD4]">
                  <p className="text-sm text-[#5D4E42]">
                    <span className="text-[#8C7B6B]">Suggested topic:</span> {followUp.suggestedTopic}
                  </p>
                  <button className="flex items-center gap-1 px-3 py-1.5 bg-[#8C7B6B] text-white text-sm font-medium rounded-lg hover:bg-[#6B5D52] transition-colors">
                    Schedule <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Items */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
          <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
            <Check className="w-5 h-5 text-[#8C7B6B]" />
            Your Action Items
          </h2>
          <div className="space-y-2">
            {actionItems.map((item, index) => (
              <button
                key={index}
                onClick={() => toggleActionItem(index)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                  item.done ? 'bg-[#E8F5E9]' : 'bg-[#FAF6F3] hover:bg-[#F5EDE5]'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  item.done ? 'bg-[#4CAF50] border-[#4CAF50]' : 'border-[#8C7B6B]'
                }`}>
                  {item.done && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className={`text-sm ${item.done ? 'text-[#8C7B6B] line-through' : 'text-[#3D3D3D]'}`}>
                  {item.text}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Memorable Quotes */}
        <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
          <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
            <span className="text-lg">💬</span>
            Memorable Quotes
          </h2>
          <div className="space-y-3">
            {summary.memorableQuotes.map((quote, index) => (
              <div key={index} className="p-4 bg-[#FFFCFA] rounded-xl border-l-4 border-[#8C7B6B]">
                <p className="text-[#3D3D3D] italic mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                  "{quote.quote}"
                </p>
                <p className="text-sm text-[#8C7B6B]">— {quote.author}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#8C7B6B] text-white font-medium rounded-xl hover:bg-[#6B5D52] transition-colors">
            <Share2 className="w-5 h-5" />
            Share Summary
          </button>
          <button className="flex items-center justify-center gap-2 px-5 py-3.5 border-2 border-[#E6DDD4] text-[#5D4E42] font-medium rounded-xl hover:border-[#B89E8B] transition-colors">
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>

        {/* Feedback */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[#8C7B6B] mb-2">Was this summary helpful?</p>
          <div className="flex justify-center gap-2">
            <button className="px-4 py-2 bg-white border border-[#E6DDD4] rounded-full text-sm text-[#5D4E42] hover:border-[#B89E8B] transition-colors flex items-center gap-1">
              <ThumbsUp className="w-4 h-4" /> Yes
            </button>
            <button className="px-4 py-2 bg-white border border-[#E6DDD4] rounded-full text-sm text-[#5D4E42] hover:border-[#B89E8B] transition-colors flex items-center gap-1">
              <ThumbsUp className="w-4 h-4 rotate-180" /> No
            </button>
          </div>
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

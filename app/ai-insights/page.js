'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Sparkles, TrendingUp, Users, Coffee, Calendar, MessageCircle,
  Heart, ChevronLeft, ArrowUp, Star, Lightbulb, Target
} from 'lucide-react';

export default function AIInsightsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recapData, setRecapData] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/');
          return;
        }
        setUser(user);

        // Fetch user's profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();

        // Fetch connections (without profile join - profiles fetched separately if needed)
        const { data: connectionsAsUser } = await supabase
          .from('connections')
          .select('id, created_at, connected_user_id')
          .eq('user_id', user.id)
          .eq('status', 'accepted');

        const { data: connectionsAsConnected } = await supabase
          .from('connections')
          .select('id, created_at, user_id')
          .eq('connected_user_id', user.id)
          .eq('status', 'accepted');

        // Fetch profile details for connected users
        const connectedUserIds = [
          ...(connectionsAsUser || []).map(c => c.connected_user_id),
          ...(connectionsAsConnected || []).map(c => c.user_id)
        ].filter(Boolean);

        const { data: connectedProfiles } = connectedUserIds.length > 0
          ? await supabase.from('profiles').select('id, name, profile_picture, career').in('id', connectedUserIds)
          : { data: [] };

        const profileMap = Object.fromEntries((connectedProfiles || []).map(p => [p.id, p]));

        // Combine connections from both directions
        const connections = [
          ...(connectionsAsUser || []).map(c => ({
            id: c.id,
            created_at: c.created_at,
            profile: profileMap[c.connected_user_id] || null,
            other_user_id: c.connected_user_id,
          })),
          ...(connectionsAsConnected || []).map(c => ({
            id: c.id,
            created_at: c.created_at,
            profile: profileMap[c.user_id] || null,
            other_user_id: c.user_id,
          })),
        ];

        // Fetch coffee chats/meetings
        const { data: meetings } = await supabase
          .from('agora_rooms')
          .select('*, meetup:meetups(*)')
          .or(`created_by.eq.${user.id},participants.cs.{${user.id}}`)
          .not('ended_at', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20);

        // Fetch meetup signups
        const { data: signups } = await supabase
          .from('meetup_signups')
          .select('*, meetup:meetups(*)')
          .eq('user_id', user.id);

        // Fetch circles joined
        const { data: circles } = await supabase
          .from('connection_group_members')
          .select('*, group:connection_groups(*)')
          .eq('user_id', user.id);

        // Fetch messages sent
        const { data: messages } = await supabase
          .from('messages')
          .select('id')
          .eq('sender_id', user.id);

        // Calculate stats
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        const newConnectionsThisMonth = connections?.filter(c => {
          const date = new Date(c.created_at);
          return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
        }).length || 0;

        // Get message counts for each connection to determine top connections
        const connectionInteractions = await Promise.all(
          (connections || []).map(async (conn) => {
            const { count: sentCount } = await supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('sender_id', user.id)
              .eq('receiver_id', conn.other_user_id);

            const { count: receivedCount } = await supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('sender_id', conn.other_user_id)
              .eq('receiver_id', user.id);

            return {
              ...conn,
              interactionCount: (sentCount || 0) + (receivedCount || 0),
            };
          })
        );

        // Sort by interaction count and get top 5
        const sortedConnections = connectionInteractions
          .sort((a, b) => b.interactionCount - a.interactionCount)
          .slice(0, 5);

        const topConnections = sortedConnections.map(c => ({
          name: c.profile?.name || 'Anonymous',
          profilePicture: c.profile?.profile_picture,
          career: c.profile?.career,
          interactions: c.interactionCount,
          id: c.other_user_id,
        }));

        // Generate insights based on data
        const insights = generateInsights({
          connectionsCount: connections?.length || 0,
          meetingsCount: meetings?.length || 0,
          circlesCount: circles?.length || 0,
          messagesCount: messages?.length || 0,
        });

        // Build recap data
        setRecapData({
          period: getMonthName(thisMonth) + ' ' + thisYear,
          generatedAt: formatDate(now),
          userName: profile?.name || user.email?.split('@')[0],

          highlights: {
            newConnections: newConnectionsThisMonth,
            coffeeChats: meetings?.length || 0,
            eventsAttended: signups?.filter(s => s.meetup?.type === 'event').length || 0,
            circlesJoined: circles?.length || 0,
            messagesExchanged: messages?.length || 0,
          },

          connectionGrowth: {
            current: connections?.length || 0,
            previous: Math.max(0, (connections?.length || 0) - newConnectionsThisMonth),
            percentChange: newConnectionsThisMonth > 0 ? Math.round((newConnectionsThisMonth / Math.max(1, (connections?.length || 1) - newConnectionsThisMonth)) * 100) : 0,
          },

          topConnections,

          topicsDiscussed: [
            { topic: "Career Growth", count: 15, emoji: "📈" },
            { topic: "Work-Life Balance", count: 12, emoji: "⚖️" },
            { topic: "Networking", count: 8, emoji: "🤝" },
            { topic: "Personal Development", count: 6, emoji: "🌱" },
          ],

          memorableMoments: generateMemorableMoments(meetings, signups, circles),

          aiInsights: insights,

          suggestions: generateSuggestions(connections?.length || 0, circles?.length || 0),

          quote: getRandomQuote(),
        });

      } catch (error) {
        console.error('Error loading AI insights:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F0EB] flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-[#8B6F5C] animate-pulse mx-auto mb-4" />
          <p className="text-[#8C7B6B]">Generating your insights...</p>
        </div>
      </div>
    );
  }

  if (!recapData) {
    return (
      <div className="min-h-screen bg-[#F5F0EB] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#8C7B6B]">Unable to load insights</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-[#8B6F5C] text-white rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Back Button */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-[#8C7B6B] hover:text-[#5C4033] mb-6 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#E6DCD4] to-[#D4C8BC] rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-[#6B5D52]" />
          </div>
          <h1 className="text-2xl font-semibold text-[#3D3D3D]" style={{ fontFamily: "'Playfair Display', serif" }}>
            Your AI Recap
          </h1>
          <p className="text-[#8C7B6B] mt-1">{recapData.period}</p>
          <p className="text-xs text-[#8C7B6B]/60 mt-1">Generated {recapData.generatedAt}</p>
        </div>

        {/* Highlights Stats */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3 mb-6">
          <StatCard number={recapData.highlights.newConnections} label="New Connections" emoji="👋" />
          <StatCard number={recapData.highlights.coffeeChats} label="Meetings" emoji="☕" />
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
            {recapData.connectionGrowth.percentChange > 0 && (
              <div className="flex items-center gap-1 text-[#6B9080] text-sm font-medium">
                <ArrowUp className="w-4 h-4" />
                {recapData.connectionGrowth.percentChange}%
              </div>
            )}
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
        {recapData.topConnections.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-[#E6DDD4] mb-4">
            <h2 className="font-semibold text-[#3D3D3D] mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-[#E57373]" />
              Top Connections
            </h2>
            <div className="space-y-3">
              {recapData.topConnections.map((person, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-[#8C7B6B] w-6">{index + 1}</span>
                  {person.profilePicture ? (
                    <img
                      src={person.profilePicture}
                      alt={person.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-[#E6DDD4]"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-[#E6DCD4] to-[#D4C8BC] rounded-full flex items-center justify-center text-lg font-semibold text-[#6B5D52]">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#3D3D3D] truncate">{person.name}</p>
                    {person.career && (
                      <p className="text-xs text-[#8C7B6B] truncate">{person.career}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-[#5D4E42]">{person.interactions}</p>
                    <p className="text-xs text-[#8C7B6B]">messages</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
        {recapData.memorableMoments.length > 0 && (
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
        )}

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
                <button
                  onClick={() => router.push(suggestion.route || '/')}
                  className="px-3 py-1.5 bg-[#8C7B6B] text-white text-xs font-medium rounded-lg hover:bg-[#6B5D52] transition-colors"
                >
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
        <div className="text-center pb-8">
          <button className="px-6 py-3 bg-[#8C7B6B] text-white font-medium rounded-full hover:bg-[#6B5D52] transition-colors">
            Share My Recap
          </button>
          <p className="text-xs text-[#8C7B6B] mt-2">Show your network growth!</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ number, label, emoji }) {
  return (
    <div className="bg-white rounded-2xl p-2 sm:p-3 border border-[#E6DDD4] text-center">
      <div className="text-lg sm:text-xl mb-1">{emoji}</div>
      <p className="text-lg sm:text-xl font-bold text-[#3D3D3D]">{number}</p>
      <p className="text-[10px] sm:text-xs text-[#8C7B6B] leading-tight">{label}</p>
    </div>
  );
}

// Helper functions
function getMonthName(month) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month];
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRandomEmoji() {
  const emojis = ['👩‍💼', '👨‍💼', '👩', '👨', '👩‍🦱', '👨‍🦱', '👩‍🦰', '👨‍🦰'];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

function generateInsights({ connectionsCount, meetingsCount, circlesCount, messagesCount }) {
  const insights = [];

  if (connectionsCount >= 10) {
    insights.push({
      icon: "💡",
      title: "Growing network!",
      description: `You have ${connectionsCount} connections. You're building a strong professional network!`,
    });
  } else if (connectionsCount > 0) {
    insights.push({
      icon: "🌱",
      title: "Getting started",
      description: "Your network is growing! Keep connecting with new people to expand your circle.",
    });
  }

  if (meetingsCount >= 5) {
    insights.push({
      icon: "☕",
      title: "Active networker",
      description: `You've had ${meetingsCount} meetings! You're making the most of your connections.`,
    });
  }

  if (circlesCount > 0) {
    insights.push({
      icon: "🤝",
      title: "Circle member",
      description: `You're part of ${circlesCount} circle${circlesCount > 1 ? 's' : ''}. Great for deeper connections!`,
    });
  }

  if (messagesCount > 20) {
    insights.push({
      icon: "💬",
      title: "Great communicator",
      description: "You're actively engaging with your network through messages. Keep it up!",
    });
  }

  // Add default insight if none generated
  if (insights.length === 0) {
    insights.push({
      icon: "🎯",
      title: "Ready to grow",
      description: "Start connecting with people and attending events to see your insights grow!",
    });
  }

  return insights.slice(0, 3);
}

function generateMemorableMoments(meetings, signups, circles) {
  const moments = [];

  if (meetings?.length > 0) {
    const meeting = meetings[0];
    moments.push({
      type: "meeting",
      title: meeting.meetup?.topic || "Video meeting",
      description: "A great conversation with your network",
      emoji: "☕",
      date: new Date(meeting.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }

  if (signups?.length > 0) {
    const signup = signups[0];
    moments.push({
      type: "event",
      title: signup.meetup?.topic || "Event signup",
      description: "You signed up to connect!",
      emoji: "🎉",
      date: new Date(signup.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }

  if (circles?.length > 0) {
    const circle = circles[0];
    moments.push({
      type: "circle",
      title: `Joined ${circle.group?.name || 'a circle'}`,
      description: "Your intimate connection group!",
      emoji: "🦋",
      date: new Date(circle.joined_at || circle.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }

  return moments;
}

function generateSuggestions(connectionsCount, circlesCount) {
  const suggestions = [];

  if (connectionsCount < 5) {
    suggestions.push({
      emoji: "👋",
      title: "Expand your network",
      description: "Discover people with similar interests",
      action: "Discover",
      route: "/discover",
    });
  }

  if (circlesCount === 0) {
    suggestions.push({
      emoji: "🤝",
      title: "Join a Circle",
      description: "Connect deeply with a small group",
      action: "View Circles",
      route: "/circles",
    });
  }

  suggestions.push({
    emoji: "📅",
    title: "Schedule a meetup",
    description: "Keep your momentum going!",
    action: "Browse",
    route: "/meetups",
  });

  return suggestions.slice(0, 3);
}

function getRandomQuote() {
  const quotes = [
    {
      text: "The richest people in the world look for and build networks. Everyone else looks for work.",
      author: "Robert Kiyosaki",
    },
    {
      text: "Your network is your net worth.",
      author: "Porter Gale",
    },
    {
      text: "Networking is not about just connecting people. It's about connecting people with people, people with ideas, and people with opportunities.",
      author: "Michele Jennae",
    },
    {
      text: "The currency of real networking is not greed but generosity.",
      author: "Keith Ferrazzi",
    },
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

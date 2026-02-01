import React, { useState, useMemo } from 'react';
import { Search, Users, Calendar, Clock, MapPin, Lock, ChevronRight, X, Check, Heart } from 'lucide-react';

// Sample circles data
const circlesData = [
  {
    id: 1,
    name: "Career Changers Circle",
    description: "For women navigating career transitions and pivots",
    emoji: "🦋",
    gradient: "from-[#E8D5C4] to-[#D4C4B0]",
    category: "Career",
    cadence: "Every Tuesday",
    time: "12:00 PM",
    location: "Virtual",
    totalSpots: 8,
    members: [
      { avatar: "👩‍💼", name: "Sarah M." },
      { avatar: "👩‍🦰", name: "Priya K." },
      { avatar: "👩", name: "Jessica R." },
      { avatar: "👩‍🦱", name: "Maya L." },
      { avatar: "👩‍💻", name: "Angela W." },
    ],
    host: { avatar: "👩‍💼", name: "Sarah M." },
    spotsLeft: 3,
    isOpen: true,
  },
  {
    id: 2,
    name: "Tech Moms Mastermind",
    description: "Balancing tech careers and motherhood together",
    emoji: "👩‍💻",
    gradient: "from-[#D4E5F7] to-[#B8D4E8]",
    category: "Tech",
    cadence: "Every other Wednesday",
    time: "8:00 PM",
    location: "Virtual",
    totalSpots: 6,
    members: [
      { avatar: "👩‍💻", name: "Angela W." },
      { avatar: "👩", name: "Christina H." },
      { avatar: "👩‍🦰", name: "Emma T." },
      { avatar: "👩‍💼", name: "Nina S." },
      { avatar: "👩‍🦱", name: "Lisa P." },
      { avatar: "👩", name: "Rachel K." },
    ],
    host: { avatar: "👩‍💻", name: "Angela W." },
    spotsLeft: 0,
    isOpen: false,
  },
  {
    id: 3,
    name: "Wellness Warriors",
    description: "Supporting each other's wellness journeys",
    emoji: "🧘‍♀️",
    gradient: "from-[#E5F0E5] to-[#C8DEC8]",
    category: "Wellness",
    cadence: "Every Monday",
    time: "7:00 AM",
    location: "Troy, MI",
    totalSpots: 8,
    members: [
      { avatar: "👩‍🦱", name: "Maya L." },
      { avatar: "👩‍⚕️", name: "Nina S." },
      { avatar: "👩", name: "Kelly T." },
    ],
    host: { avatar: "👩‍🦱", name: "Maya L." },
    spotsLeft: 5,
    isOpen: true,
  },
  {
    id: 4,
    name: "Founder Friends",
    description: "Women founders sharing wins, struggles & advice",
    emoji: "🚀",
    gradient: "from-[#F5E6D3] to-[#E8D4BC]",
    category: "Business",
    cadence: "1st & 3rd Friday",
    time: "9:00 AM",
    location: "Detroit, MI",
    totalSpots: 10,
    members: [
      { avatar: "👩", name: "Jessica R." },
      { avatar: "👩‍💼", name: "Sarah M." },
      { avatar: "👩‍🦰", name: "Priya K." },
      { avatar: "👩‍🎨", name: "Emma T." },
      { avatar: "👩‍💻", name: "Angela W." },
      { avatar: "👩", name: "Christina H." },
      { avatar: "👩‍🦱", name: "Maya L." },
      { avatar: "👩‍⚕️", name: "Nina S." },
    ],
    host: { avatar: "👩", name: "Jessica R." },
    spotsLeft: 2,
    isOpen: true,
  },
  {
    id: 5,
    name: "Creative Souls",
    description: "Artists, designers & creatives fueling inspiration",
    emoji: "🎨",
    gradient: "from-[#F5E0E5] to-[#E8CCD4]",
    category: "Creative",
    cadence: "Every Thursday",
    time: "6:30 PM",
    location: "Royal Oak, MI",
    totalSpots: 8,
    members: [
      { avatar: "👩‍🎨", name: "Emma T." },
      { avatar: "👩", name: "Sophia L." },
      { avatar: "👩‍🦰", name: "Anna M." },
      { avatar: "👩‍🦱", name: "Grace K." },
    ],
    host: { avatar: "👩‍🎨", name: "Emma T." },
    spotsLeft: 4,
    isOpen: true,
  },
  {
    id: 6,
    name: "Money Mindset Circle",
    description: "Building wealth & financial confidence together",
    emoji: "💰",
    gradient: "from-[#E5E8D4] to-[#D4D8C0]",
    category: "Finance",
    cadence: "Every other Tuesday",
    time: "7:00 PM",
    location: "Virtual",
    totalSpots: 10,
    members: [
      { avatar: "👩‍💻", name: "Angela W." },
      { avatar: "👩‍💼", name: "Sarah M." },
      { avatar: "👩", name: "Jessica R." },
      { avatar: "👩‍🦰", name: "Priya K." },
      { avatar: "👩‍🦱", name: "Maya L." },
      { avatar: "👩", name: "Christina H." },
      { avatar: "👩‍🎨", name: "Emma T." },
      { avatar: "👩‍⚕️", name: "Nina S." },
      { avatar: "👩", name: "Kelly T." },
    ],
    host: { avatar: "👩‍💻", name: "Angela W." },
    spotsLeft: 1,
    isOpen: true,
  },
  {
    id: 7,
    name: "Book Lovers Circle",
    description: "Reading & discussing books that inspire growth",
    emoji: "📚",
    gradient: "from-[#F0E6F5] to-[#DED0E8]",
    category: "Learning",
    cadence: "Last Sunday of month",
    time: "3:00 PM",
    location: "Ann Arbor, MI",
    totalSpots: 12,
    members: [
      { avatar: "👩‍🦰", name: "Priya K." },
      { avatar: "👩", name: "Jessica R." },
      { avatar: "👩‍💼", name: "Sarah M." },
      { avatar: "👩‍🦱", name: "Maya L." },
      { avatar: "👩", name: "Christina H." },
    ],
    host: { avatar: "👩‍🦰", name: "Priya K." },
    spotsLeft: 7,
    isOpen: true,
  },
  {
    id: 8,
    name: "New Moms Support",
    description: "Navigating motherhood with grace & community",
    emoji: "👶",
    gradient: "from-[#FCE4EC] to-[#F8BBD9]",
    category: "Parenting",
    cadence: "Every Saturday",
    time: "10:00 AM",
    location: "Bloomfield, MI",
    totalSpots: 8,
    members: [
      { avatar: "👩", name: "Christina H." },
      { avatar: "👩‍🦰", name: "Amy R." },
      { avatar: "👩‍🦱", name: "Jen L." },
      { avatar: "👩", name: "Michelle K." },
      { avatar: "👩‍💼", name: "Tara S." },
      { avatar: "👩", name: "Lauren P." },
      { avatar: "👩‍🦰", name: "Kate M." },
      { avatar: "👩‍🦱", name: "Julie W." },
    ],
    host: { avatar: "👩", name: "Christina H." },
    spotsLeft: 0,
    isOpen: false,
  },
];

const categories = ["All", "Career", "Business", "Wellness", "Tech", "Creative", "Finance", "Learning", "Parenting"];

export default function IntimateCirclesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCircle, setSelectedCircle] = useState(null);

  const filteredCircles = useMemo(() => {
    return circlesData.filter(circle => {
      const matchesSearch = circle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           circle.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || circle.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const openCircles = filteredCircles.filter(c => c.isOpen);
  const waitlistCircles = filteredCircles.filter(c => !c.isOpen);

  const clearSearch = () => {
    setSearchQuery("");
    setSelectedCategory("All");
  };

  return (
    <div className="min-h-screen bg-[#FFFBF7]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FFFBF7]/95 backdrop-blur-sm border-b border-[#E8DED4]">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* Title */}
          <div className="text-center mb-5">
            <h1 className="text-2xl font-semibold text-[#5C4033] tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              Intimate Circles 🤝
            </h1>
            <p className="text-sm text-[#8B7355] mt-1">Small groups that meet regularly & grow together</p>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B7355]/50" />
            <input
              type="text"
              placeholder="Search circles by name or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 bg-white border-2 border-[#E8DED4] rounded-2xl text-[#5C4033] placeholder:text-[#8B7355]/40 focus:outline-none focus:border-[#C9A87C] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B7355]/50 hover:text-[#8B7355]"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#8B6F5C] text-white'
                    : 'bg-white text-[#5C4033] border-2 border-[#E8DED4] hover:border-[#C9A87C]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* What is an Intimate Circle */}
        <div className="bg-gradient-to-r from-[#FFF8F0] to-[#FDF5ED] rounded-2xl p-4 mb-6 border border-[#E8DED4]">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💫</span>
            <div>
              <h3 className="text-sm font-semibold text-[#5C4033] mb-1">What's an Intimate Circle?</h3>
              <p className="text-xs text-[#8B7355] leading-relaxed">
                A small group (6-10 women) that meets regularly around a shared interest. It's where "find your circle" really happens — lasting friendships built over time.
              </p>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[#8B7355]">
            {filteredCircles.length} circle{filteredCircles.length !== 1 ? 's' : ''} found
          </p>
          {(searchQuery || selectedCategory !== "All") && (
            <button onClick={clearSearch} className="text-sm text-[#C9A87C] hover:text-[#8B6F5C] font-medium">
              Clear filters
            </button>
          )}
        </div>

        {/* Open Circles */}
        {openCircles.length > 0 && (
          <section className="mb-8">
            <h2 className="text-base font-semibold text-[#5C4033] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-[#4DB6AC] rounded-full"></span>
              Open to Join
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {openCircles.map((circle) => (
                <CircleCard 
                  key={circle.id} 
                  circle={circle}
                  onClick={() => setSelectedCircle(circle)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Waitlist Circles */}
        {waitlistCircles.length > 0 && (
          <section className="mb-8">
            <h2 className="text-base font-semibold text-[#5C4033] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-[#FFB74D] rounded-full"></span>
              Waitlist
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {waitlistCircles.map((circle) => (
                <CircleCard 
                  key={circle.id} 
                  circle={circle}
                  onClick={() => setSelectedCircle(circle)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Start a Circle Card */}
        <div 
          className="relative bg-[#FFFDF9] rounded-3xl border-2 border-dashed border-[#E0D5C7] p-6 flex flex-col items-center justify-center text-center hover:border-[#C9A87C] transition-colors cursor-pointer group"
        >
          <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🌱</div>
          <h3 className="text-lg font-semibold text-[#5C4033] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            Start Your Own Circle
          </h3>
          <p className="text-sm text-[#8B7355] mb-5 leading-relaxed max-w-xs">
            Have a topic you're passionate about? Gather your people and create a space for connection.
          </p>
          <button className="flex items-center gap-2 px-5 py-3 bg-[#8B6F5C] text-white text-sm font-medium rounded-xl hover:bg-[#6B5344] transition-colors shadow-sm">
            <span className="text-lg">+</span>
            Create a Circle
          </button>
        </div>

        {/* Empty State */}
        {filteredCircles.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-[#5C4033] mb-2">No circles found</h3>
            <p className="text-sm text-[#8B7355] mb-4">Try a different search or start your own!</p>
            <button
              onClick={clearSearch}
              className="px-6 py-2.5 bg-[#8B6F5C] text-white text-sm font-medium rounded-xl hover:bg-[#6B5344] transition-colors"
            >
              Clear Search
            </button>
          </div>
        )}
      </main>

      {/* Circle Detail Modal */}
      {selectedCircle && (
        <CircleDetailModal 
          circle={selectedCircle}
          onClose={() => setSelectedCircle(null)}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');
        
        * {
          font-family: 'DM Sans', sans-serif;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

function CircleCard({ circle, onClick }) {
  const spotsColor = circle.spotsLeft === 0 
    ? 'bg-[#FFB74D] text-white' 
    : circle.spotsLeft <= 2 
      ? 'bg-[#E57373] text-white' 
      : 'bg-[#4DB6AC] text-white';

  return (
    <div 
      className="bg-white rounded-3xl overflow-hidden shadow-sm border border-[#F0E8E0] hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
      onClick={onClick}
    >
      {/* Header with Emoji */}
      <div className={`relative h-28 bg-gradient-to-br ${circle.gradient} flex items-center justify-center`}>
        <span className="text-5xl group-hover:scale-110 transition-transform duration-300">
          {circle.emoji}
        </span>
        {/* Spots Badge */}
        <span className={`absolute top-3 right-3 px-3 py-1 ${spotsColor} text-xs font-semibold rounded-full shadow-sm`}>
          {circle.spotsLeft === 0 ? 'Waitlist' : `${circle.spotsLeft} spot${circle.spotsLeft !== 1 ? 's' : ''} left`}
        </span>
        {/* Category Badge */}
        <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 text-[#5C4033] text-xs font-medium rounded-full">
          {circle.category}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-base font-semibold text-[#5C4033] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
          {circle.name}
        </h3>
        <p className="text-sm text-[#8B7355] mb-3 line-clamp-2">{circle.description}</p>

        {/* Meeting Info */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8B7355] mb-3">
          <div className="flex items-center gap-1">
            <span>🔄</span>
            <span>{circle.cadence}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🕐</span>
            <span>{circle.time}</span>
          </div>
        </div>

        {/* Members Preview & Join */}
        <div className="flex items-center justify-between pt-3 border-t border-[#F5EDE5]">
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {circle.members.slice(0, 4).map((member, i) => (
                <span 
                  key={i}
                  className="w-7 h-7 rounded-full bg-[#F5EDE5] flex items-center justify-center text-sm border-2 border-white"
                >
                  {member.avatar}
                </span>
              ))}
              {circle.members.length > 4 && (
                <span className="w-7 h-7 rounded-full bg-[#E8DED4] flex items-center justify-center text-xs text-[#5C4033] font-medium border-2 border-white">
                  +{circle.members.length - 4}
                </span>
              )}
            </div>
            <span className="text-xs text-[#8B7355] ml-2">
              {circle.members.length}/{circle.totalSpots}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#C9A87C]" />
        </div>
      </div>
    </div>
  );
}

function CircleDetailModal({ circle, onClose }) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const handleRequest = () => {
    setIsRequesting(true);
    setTimeout(() => {
      setIsRequesting(false);
      setRequestSent(true);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-[#FFFBF7] rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-auto shadow-2xl animate-slideUp">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white text-[#8B7355] transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Emoji */}
        <div className={`relative h-36 bg-gradient-to-br ${circle.gradient} flex items-center justify-center`}>
          <span className="text-6xl">{circle.emoji}</span>
          <span className="absolute bottom-3 left-3 px-3 py-1 bg-white/90 text-[#5C4033] text-xs font-medium rounded-full">
            {circle.category}
          </span>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Title & Description */}
          <div className="text-center mb-5">
            <h2 className="text-2xl font-semibold text-[#5C4033] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              {circle.name}
            </h2>
            <p className="text-[#8B7355]">{circle.description}</p>
          </div>

          {/* Meeting Details */}
          <div className="bg-white rounded-2xl p-4 mb-5 border border-[#F0E8E0]">
            <h3 className="text-sm font-semibold text-[#5C4033] mb-3 flex items-center gap-2">
              <span>📅</span> Meeting Schedule
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3 text-[#8B7355]">
                <span className="w-8 h-8 bg-[#F5EDE5] rounded-lg flex items-center justify-center">🔄</span>
                <span>{circle.cadence}</span>
              </div>
              <div className="flex items-center gap-3 text-[#8B7355]">
                <span className="w-8 h-8 bg-[#F5EDE5] rounded-lg flex items-center justify-center">🕐</span>
                <span>{circle.time}</span>
              </div>
              <div className="flex items-center gap-3 text-[#8B7355]">
                <span className="w-8 h-8 bg-[#F5EDE5] rounded-lg flex items-center justify-center">📍</span>
                <span>{circle.location}</span>
              </div>
            </div>
          </div>

          {/* Host */}
          <div className="flex items-center gap-3 p-3 bg-[#FFF8F0] rounded-xl mb-5 border border-[#E8DED4]">
            <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl border-2 border-[#E8DED4]">
              {circle.host.avatar}
            </span>
            <div>
              <p className="text-xs text-[#8B7355]">Hosted by</p>
              <p className="text-sm font-semibold text-[#5C4033]">{circle.host.name}</p>
            </div>
          </div>

          {/* Members */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-[#5C4033] mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>👥</span> Members ({circle.members.length}/{circle.totalSpots})
              </span>
              {circle.spotsLeft > 0 ? (
                <span className="text-xs font-normal text-[#4DB6AC]">{circle.spotsLeft} spots open</span>
              ) : (
                <span className="text-xs font-normal text-[#FFB74D]">Waitlist</span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {circle.members.map((member, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-[#F0E8E0]">
                  <span className="text-sm">{member.avatar}</span>
                  <span className="text-xs text-[#5C4033]">{member.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* What to Expect */}
          <div className="bg-[#F5EDE5] rounded-2xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-[#5C4033] mb-2 flex items-center gap-2">
              <span>✨</span> What to expect
            </h3>
            <ul className="text-sm text-[#8B7355] space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-[#6B8E7B]">•</span>
                <span>Regular meetups with the same core group</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#6B8E7B]">•</span>
                <span>Safe space to share and grow together</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#6B8E7B]">•</span>
                <span>Deeper connections over time</span>
              </li>
            </ul>
          </div>

          {/* Action Button */}
          {!requestSent ? (
            <button 
              onClick={handleRequest}
              disabled={isRequesting}
              className="w-full py-4 bg-[#8B6F5C] text-white font-semibold rounded-xl hover:bg-[#6B5344] transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isRequesting ? (
                <span className="animate-pulse">Sending request...</span>
              ) : circle.isOpen ? (
                <>
                  <Heart className="w-5 h-5" />
                  Request to Join
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5" />
                  Join Waitlist
                </>
              )}
            </button>
          ) : (
            <div className="text-center py-4 bg-[#E5F0E5] rounded-xl">
              <div className="flex items-center justify-center gap-2 text-[#4DB6AC] font-semibold">
                <Check className="w-5 h-5" />
                {circle.isOpen ? 'Request Sent!' : 'Added to Waitlist!'}
              </div>
              <p className="text-xs text-[#8B7355] mt-1">
                {circle.host.name.split(' ')[0]} will review your request
              </p>
            </div>
          )}

          {/* Footer Note */}
          <p className="text-xs text-[#8B7355]/70 text-center mt-4">
            Circle hosts review requests to ensure a good fit for everyone
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(100px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

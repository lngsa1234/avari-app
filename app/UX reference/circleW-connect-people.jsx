import React, { useState, useMemo } from 'react';
import { Search, MapPin, Briefcase, Sparkles, Heart, MessageCircle, X, ChevronRight, Filter } from 'lucide-react';

// Sample people data
const peopleData = [
  {
    id: 1,
    name: "Sarah M.",
    avatar: "👩‍💼",
    tagline: "Tech leader who loves mentoring",
    role: "VP of Engineering",
    company: "Startup",
    location: "Birmingham, MI",
    interests: ["Leadership", "Tech", "Mentorship"],
    lookingFor: "Coffee chats about career growth",
    mutualCircles: 3,
    gradient: "from-[#E8D5C4] to-[#D4C4B0]",
    isNew: false,
    verified: true,
  },
  {
    id: 2,
    name: "Maya L.",
    avatar: "👩‍🦱",
    tagline: "Wellness advocate & yoga instructor",
    role: "Wellness Coach",
    company: "Self-employed",
    location: "Troy, MI",
    interests: ["Wellness", "Mindfulness", "Yoga"],
    lookingFor: "Women interested in work-life balance",
    mutualCircles: 2,
    gradient: "from-[#E5F0E5] to-[#C8DEC8]",
    isNew: true,
    verified: true,
  },
  {
    id: 3,
    name: "Jessica R.",
    avatar: "👩",
    tagline: "Serial entrepreneur & mom of 3",
    role: "Founder & CEO",
    company: "TechVentures",
    location: "Detroit, MI",
    interests: ["Entrepreneurship", "Parenting", "Investing"],
    lookingFor: "Fellow founders to share experiences",
    mutualCircles: 5,
    gradient: "from-[#F5E6D3] to-[#E8D4BC]",
    isNew: false,
    verified: true,
  },
  {
    id: 4,
    name: "Priya K.",
    avatar: "👩‍🦰",
    tagline: "Bookworm & lifelong learner",
    role: "Product Manager",
    company: "Fortune 500",
    location: "Ann Arbor, MI",
    interests: ["Reading", "Product", "Learning"],
    lookingFor: "Book club buddies & PM peers",
    mutualCircles: 1,
    gradient: "from-[#F0E6F5] to-[#DED0E8]",
    isNew: false,
    verified: false,
  },
  {
    id: 5,
    name: "Emma T.",
    avatar: "👩‍🎨",
    tagline: "Creative director with a passion for design",
    role: "Creative Director",
    company: "Design Agency",
    location: "Royal Oak, MI",
    interests: ["Design", "Art", "Creativity"],
    lookingFor: "Creative collaborators",
    mutualCircles: 4,
    gradient: "from-[#F5E0E5] to-[#E8CCD4]",
    isNew: true,
    verified: true,
  },
  {
    id: 6,
    name: "Angela W.",
    avatar: "👩‍💻",
    tagline: "Finance whiz helping women build wealth",
    role: "Financial Advisor",
    company: "Wealth Partners",
    location: "Bloomfield, MI",
    interests: ["Finance", "Investing", "Education"],
    lookingFor: "Women wanting financial freedom",
    mutualCircles: 2,
    gradient: "from-[#E5E8D4] to-[#D4D8C0]",
    isNew: false,
    verified: true,
  },
  {
    id: 7,
    name: "Christina H.",
    avatar: "👩‍👧",
    tagline: "Mom entrepreneur balancing it all",
    role: "E-commerce Owner",
    company: "Handmade Co.",
    location: "Novi, MI",
    interests: ["E-commerce", "Parenting", "Crafts"],
    lookingFor: "Mom entrepreneurs to connect",
    mutualCircles: 3,
    gradient: "from-[#FCE4EC] to-[#F8BBD9]",
    isNew: false,
    verified: false,
  },
  {
    id: 8,
    name: "Nina S.",
    avatar: "👩‍⚕️",
    tagline: "Healthcare professional & wellness lover",
    role: "Physician",
    company: "Hospital",
    location: "Troy, MI",
    interests: ["Healthcare", "Wellness", "Running"],
    lookingFor: "Active women for fitness meetups",
    mutualCircles: 1,
    gradient: "from-[#D4E5F7] to-[#B8D4E8]",
    isNew: true,
    verified: true,
  },
];

const interestFilters = ["All", "Tech", "Entrepreneurship", "Wellness", "Finance", "Parenting", "Creative", "Leadership"];

export default function ConnectWithPeoplePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInterest, setSelectedInterest] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);

  const filteredPeople = useMemo(() => {
    return peopleData.filter(person => {
      const matchesSearch = person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           person.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           person.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           person.interests.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesInterest = selectedInterest === "All" || 
                             person.interests.some(i => i.toLowerCase().includes(selectedInterest.toLowerCase()));
      return matchesSearch && matchesInterest;
    });
  }, [searchQuery, selectedInterest]);

  const clearSearch = () => {
    setSearchQuery("");
    setSelectedInterest("All");
  };

  return (
    <div className="min-h-screen bg-[#FFFBF7]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FFFBF7]/95 backdrop-blur-sm border-b border-[#E8DED4]">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* Title */}
          <div className="text-center mb-5">
            <h1 className="text-2xl font-semibold text-[#5C4033] tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              Connect with Women 👋
            </h1>
            <p className="text-sm text-[#8B7355] mt-1">Find inspiring women in your community</p>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B7355]/50" />
            <input
              type="text"
              placeholder="Search by name, role, or interests..."
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

          {/* Interest Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {interestFilters.map(interest => (
              <button
                key={interest}
                onClick={() => setSelectedInterest(interest)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedInterest === interest
                    ? 'bg-[#8B6F5C] text-white'
                    : 'bg-white text-[#5C4033] border-2 border-[#E8DED4] hover:border-[#C9A87C]'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* How it works banner */}
        <div className="bg-gradient-to-r from-[#FFF8F0] to-[#FDF5ED] rounded-2xl p-4 mb-6 border border-[#E8DED4]">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div>
              <h3 className="text-sm font-semibold text-[#5C4033] mb-1">How connecting works</h3>
              <p className="text-xs text-[#8B7355] leading-relaxed">
                Attend a group meetup first to unlock 1-on-1 coffee chats. This helps build authentic connections!
              </p>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[#8B7355]">
            {filteredPeople.length} women to connect with
          </p>
          {(searchQuery || selectedInterest !== "All") && (
            <button onClick={clearSearch} className="text-sm text-[#C9A87C] hover:text-[#8B6F5C] font-medium">
              Clear filters
            </button>
          )}
        </div>

        {/* People Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {filteredPeople.map((person) => (
            <PersonCard 
              key={person.id} 
              person={person} 
              onClick={() => setSelectedPerson(person)}
            />
          ))}

          {/* Invite Card */}
          <div className="relative bg-[#FFFDF9] rounded-3xl border-2 border-dashed border-[#E0D5C7] p-6 flex flex-col items-center justify-center text-center min-h-[200px] hover:border-[#C9A87C] transition-colors cursor-pointer group">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">💌</div>
            <h3 className="text-base font-semibold text-[#5C4033] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              Know someone amazing?
            </h3>
            <p className="text-sm text-[#8B7355] mb-4">
              Invite her to join CircleW!
            </p>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#8B6F5C] text-white text-sm font-medium rounded-xl hover:bg-[#6B5344] transition-colors shadow-sm">
              Send Invite
            </button>
          </div>
        </div>

        {/* Empty State */}
        {filteredPeople.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-[#5C4033] mb-2">No matches found</h3>
            <p className="text-sm text-[#8B7355] mb-4">Try adjusting your search or filters</p>
            <button
              onClick={clearSearch}
              className="px-6 py-2.5 bg-[#8B6F5C] text-white text-sm font-medium rounded-xl hover:bg-[#6B5344] transition-colors"
            >
              Clear Search
            </button>
          </div>
        )}
      </main>

      {/* Profile Preview Modal */}
      {selectedPerson && (
        <ProfilePreviewModal 
          person={selectedPerson} 
          onClose={() => setSelectedPerson(null)} 
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

function PersonCard({ person, onClick }) {
  return (
    <div 
      className="bg-white rounded-3xl overflow-hidden shadow-sm border border-[#F0E8E0] hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
      onClick={onClick}
    >
      {/* Avatar Header */}
      <div className={`relative h-24 bg-gradient-to-br ${person.gradient} flex items-center justify-center`}>
        <span className="text-5xl group-hover:scale-110 transition-transform duration-300">
          {person.avatar}
        </span>
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {person.isNew && (
            <span className="px-2.5 py-1 bg-[#4DB6AC] text-white text-xs font-semibold rounded-full">
              New
            </span>
          )}
        </div>
        
        {person.verified && (
          <span className="absolute top-3 right-3 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
            <span className="text-sm">✓</span>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Name & Tagline */}
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-[#5C4033] mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>
            {person.name}
          </h3>
          <p className="text-sm text-[#8B7355]">{person.tagline}</p>
        </div>

        {/* Role & Location */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2 text-sm text-[#8B7355]">
            <Briefcase className="w-3.5 h-3.5 text-[#A89078]" />
            <span className="truncate">{person.role} • {person.company}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#8B7355]">
            <MapPin className="w-3.5 h-3.5 text-[#A89078]" />
            <span>{person.location}</span>
          </div>
        </div>

        {/* Interests */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {person.interests.map((interest, i) => (
            <span 
              key={i}
              className="px-2.5 py-1 bg-[#F5EDE5] text-[#5C4033] text-xs rounded-full"
            >
              {interest}
            </span>
          ))}
        </div>

        {/* Mutual Circles */}
        {person.mutualCircles > 0 && (
          <div className="flex items-center gap-2 text-xs text-[#6B8E7B] font-medium pt-3 border-t border-[#F5EDE5]">
            <span className="w-5 h-5 bg-[#E5F0E5] rounded-full flex items-center justify-center">
              <Heart className="w-3 h-3" />
            </span>
            <span>{person.mutualCircles} mutual circle{person.mutualCircles !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfilePreviewModal({ person, onClose }) {
  const [isRequesting, setIsRequesting] = useState(false);

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

        {/* Header with Avatar */}
        <div className={`relative h-32 bg-gradient-to-br ${person.gradient} flex items-center justify-center`}>
          <span className="text-6xl">{person.avatar}</span>
          {person.verified && (
            <span className="absolute bottom-3 right-3 px-2.5 py-1 bg-white/90 rounded-full text-xs font-medium text-[#5C4033] flex items-center gap-1">
              <span>✓</span> Verified
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Name & Tagline */}
          <div className="text-center mb-5">
            <h2 className="text-2xl font-semibold text-[#5C4033] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              {person.name}
            </h2>
            <p className="text-[#8B7355]">{person.tagline}</p>
          </div>

          {/* Info Cards */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#F0E8E0]">
              <span className="w-10 h-10 bg-[#F5EDE5] rounded-full flex items-center justify-center text-lg">💼</span>
              <div>
                <p className="text-sm font-medium text-[#5C4033]">{person.role}</p>
                <p className="text-xs text-[#8B7355]">{person.company}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#F0E8E0]">
              <span className="w-10 h-10 bg-[#F5EDE5] rounded-full flex items-center justify-center text-lg">📍</span>
              <div>
                <p className="text-sm font-medium text-[#5C4033]">{person.location}</p>
                <p className="text-xs text-[#8B7355]">Local to you</p>
              </div>
            </div>
          </div>

          {/* Looking For */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-[#5C4033] mb-2 flex items-center gap-2">
              <span>🎯</span> Looking for
            </h3>
            <p className="text-sm text-[#8B7355] bg-[#FFF8F0] p-3 rounded-xl border border-[#F0E8E0]">
              "{person.lookingFor}"
            </p>
          </div>

          {/* Interests */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-[#5C4033] mb-2 flex items-center gap-2">
              <span>💡</span> Interests
            </h3>
            <div className="flex flex-wrap gap-2">
              {person.interests.map((interest, i) => (
                <span 
                  key={i}
                  className="px-3 py-1.5 bg-white text-[#5C4033] text-sm rounded-full border-2 border-[#E8DED4]"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>

          {/* Mutual Circles */}
          {person.mutualCircles > 0 && (
            <div className="flex items-center gap-3 p-3 bg-[#E5F0E5] rounded-xl mb-6">
              <span className="text-lg">🤝</span>
              <p className="text-sm text-[#5C4033]">
                You share <span className="font-semibold">{person.mutualCircles} circle{person.mutualCircles !== 1 ? 's' : ''}</span> with {person.name.split(' ')[0]}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button 
              className="w-full py-3.5 bg-[#8B6F5C] text-white font-medium rounded-xl hover:bg-[#6B5344] transition-colors shadow-sm flex items-center justify-center gap-2"
              onClick={() => setIsRequesting(true)}
            >
              <MessageCircle className="w-5 h-5" />
              Request to Connect
            </button>
            
            <button className="w-full py-3.5 bg-white text-[#5C4033] font-medium rounded-xl border-2 border-[#E8DED4] hover:border-[#C9A87C] transition-colors flex items-center justify-center gap-2">
              <span>☕</span>
              See Shared Events
            </button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-[#8B7355]/70 text-center mt-4">
            Attend a meetup together to unlock 1-on-1 coffee chats
          </p>
        </div>

        {/* Request Sent Confirmation */}
        {isRequesting && (
          <div className="absolute inset-0 bg-[#FFFBF7] flex flex-col items-center justify-center p-6 animate-fadeIn rounded-3xl">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold text-[#5C4033] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              Connection Request Sent!
            </h3>
            <p className="text-sm text-[#8B7355] text-center mb-6">
              {person.name.split(' ')[0]} will be notified. We'll let you know when she responds!
            </p>
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-[#8B6F5C] text-white font-medium rounded-xl hover:bg-[#6B5344] transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(100px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

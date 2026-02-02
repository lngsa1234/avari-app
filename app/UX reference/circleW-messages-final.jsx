import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronLeft, Send, MoreVertical, X, CheckCheck, Plus, Users } from 'lucide-react';

// Current user
const currentUser = {
  id: "me",
  name: "You",
  avatar: "👩‍💻"
};

// Contacts - people/circles you can message
const contactsData = [
  { id: "c1", name: "Sarah M.", emoji: "👩‍💼", bg: "bg-[#E6DCD4]", isGroup: false, subtitle: "VP of Engineering" },
  { id: "c2", name: "Maya L.", emoji: "👩‍🦱", bg: "bg-[#E2DDD8]", isGroup: false, subtitle: "Wellness Coach" },
  { id: "c3", name: "Jessica R.", emoji: "👩", bg: "bg-[#E8E0D8]", isGroup: false, subtitle: "Founder & CEO" },
  { id: "c4", name: "Priya K.", emoji: "👩‍🦰", bg: "bg-[#E6E0DA]", isGroup: false, subtitle: "Product Manager" },
  { id: "c5", name: "Angela W.", emoji: "👩‍💻", bg: "bg-[#E0D8D0]", isGroup: false, subtitle: "Financial Advisor" },
  { id: "c6", name: "Emma T.", emoji: "👩‍🎨", bg: "bg-[#E4DAD4]", isGroup: false, subtitle: "Creative Director" },
  { id: "g1", name: "Career Changers Circle", emoji: "🦋", bg: "bg-[#E6DCD4]", isGroup: true, subtitle: "5 members" },
  { id: "g2", name: "Founder Friends", emoji: "🚀", bg: "bg-[#E8E0D8]", isGroup: true, subtitle: "8 members" },
  { id: "g3", name: "Wellness Warriors", emoji: "🧘‍♀️", bg: "bg-[#E2DDD8]", isGroup: true, subtitle: "3 members" },
  { id: "g4", name: "Women in Tech Brunch", emoji: "👩‍💻", bg: "bg-[#DED6CE]", isGroup: true, subtitle: "18 members" },
];

// All conversations - unified list sorted by recent
const initialConversations = [
  {
    id: "1",
    name: "Career Changers Circle",
    emoji: "🦋",
    bg: "bg-[#E6DCD4]",
    isGroup: true,
    memberCount: 5,
    lastMessage: {
      sender: "Sarah M.",
      text: "Looking forward to Tuesday's session! 🙌",
      time: "2:30 PM",
    },
    unread: 0,
    messages: [
      { id: 1, sender: { name: "Sarah M.", avatar: "👩‍💼" }, text: "Hey everyone! Quick reminder about our session tomorrow.", time: "Yesterday, 4:15 PM", isMe: false },
      { id: 2, sender: { name: "Priya K.", avatar: "👩‍🦰" }, text: "Thanks Sarah! I have a topic I'd love to discuss - anyone else feeling stuck in their current role?", time: "Yesterday, 4:20 PM", isMe: false },
      { id: 3, sender: currentUser, text: "Yes! I've been thinking about this a lot lately. Would love to hear everyone's perspective.", time: "Yesterday, 4:25 PM", isMe: true },
      { id: 4, sender: { name: "Maya L.", avatar: "👩‍🦱" }, text: "Same here. The job market feels so different now.", time: "Yesterday, 4:30 PM", isMe: false },
      { id: 5, sender: { name: "Sarah M.", avatar: "👩‍💼" }, text: "Great topic! Let's make that our focus tomorrow.", time: "Yesterday, 4:45 PM", isMe: false },
      { id: 6, sender: { name: "Sarah M.", avatar: "👩‍💼" }, text: "Looking forward to Tuesday's session! 🙌", time: "Today, 2:30 PM", isMe: false },
    ]
  },
  {
    id: "2",
    name: "Sarah M.",
    emoji: "👩‍💼",
    bg: "bg-[#E6DCD4]",
    isGroup: false,
    lastMessage: {
      text: "See you Tuesday! ☕",
      time: "1:15 PM",
      isMe: false,
    },
    unread: 0,
    messages: [
      { id: 1, sender: { name: "Sarah M.", avatar: "👩‍💼" }, text: "Hi! So glad we matched for a coffee chat.", time: "Yesterday, 9:00 AM", isMe: false },
      { id: 2, sender: currentUser, text: "Me too! I've been wanting to learn more about your career journey.", time: "Yesterday, 9:15 AM", isMe: true },
      { id: 3, sender: { name: "Sarah M.", avatar: "👩‍💼" }, text: "Happy to share! Tuesday works great for me. Virtual or in-person?", time: "Yesterday, 9:30 AM", isMe: false },
      { id: 4, sender: currentUser, text: "Let's do virtual - easier with my schedule this week.", time: "Yesterday, 10:00 AM", isMe: true },
      { id: 5, sender: { name: "Sarah M.", avatar: "👩‍💼" }, text: "Perfect! I'll send a Zoom link the morning of.", time: "Yesterday, 10:05 AM", isMe: false },
      { id: 6, sender: currentUser, text: "Sounds great, thanks!", time: "Yesterday, 10:10 AM", isMe: true },
      { id: 7, sender: { name: "Sarah M.", avatar: "👩‍💼" }, text: "See you Tuesday! ☕", time: "Today, 1:15 PM", isMe: false },
    ]
  },
  {
    id: "3",
    name: "Founder Friends",
    emoji: "🚀",
    bg: "bg-[#E8E0D8]",
    isGroup: true,
    memberCount: 8,
    lastMessage: {
      sender: "Jessica R.",
      text: "Who's coming to the Detroit meetup?",
      time: "11:45 AM",
    },
    unread: 3,
    messages: [
      { id: 1, sender: { name: "Jessica R.", avatar: "👩" }, text: "Hey founders! Our next meetup is this Friday at 9am.", time: "Yesterday, 10:00 AM", isMe: false },
      { id: 2, sender: { name: "Angela W.", avatar: "👩‍💻" }, text: "I'll be there! Should we bring anything?", time: "Yesterday, 10:15 AM", isMe: false },
      { id: 3, sender: { name: "Jessica R.", avatar: "👩" }, text: "Just yourselves and any wins/challenges to share!", time: "Yesterday, 10:20 AM", isMe: false },
      { id: 4, sender: { name: "Jessica R.", avatar: "👩" }, text: "Who's coming to the Detroit meetup?", time: "Today, 11:45 AM", isMe: false },
    ]
  },
  {
    id: "4",
    name: "Women in Tech Brunch",
    emoji: "👩‍💻",
    bg: "bg-[#DED6CE]",
    isGroup: true,
    memberCount: 18,
    lastMessage: {
      sender: "Emma T.",
      text: "Should we coordinate carpooling?",
      time: "10:30 AM",
    },
    unread: 2,
    messages: [
      { id: 1, sender: { name: "Host", avatar: "✨" }, text: "Welcome to the Women in Tech Brunch chat! Feel free to introduce yourselves.", time: "3 days ago", isMe: false, isSystem: true },
      { id: 2, sender: { name: "Christina H.", avatar: "👩" }, text: "Hi everyone! Christina here, PM at a fintech startup. Excited to meet you all!", time: "2 days ago, 11:00 AM", isMe: false },
      { id: 3, sender: currentUser, text: "Hey! Looking forward to Saturday. Anyone else coming from Birmingham?", time: "2 days ago, 11:30 AM", isMe: true },
      { id: 4, sender: { name: "Emma T.", avatar: "👩‍🎨" }, text: "I'm in Royal Oak - not too far!", time: "2 days ago, 11:45 AM", isMe: false },
      { id: 5, sender: { name: "Emma T.", avatar: "👩‍🎨" }, text: "Should we coordinate carpooling?", time: "Today, 10:30 AM", isMe: false },
    ]
  },
  {
    id: "5",
    name: "Maya L.",
    emoji: "👩‍🦱",
    bg: "bg-[#E2DDD8]",
    isGroup: false,
    lastMessage: {
      text: "Can't wait to chat about work-life balance!",
      time: "Yesterday",
      isMe: true,
    },
    unread: 0,
    messages: [
      { id: 1, sender: { name: "Maya L.", avatar: "👩‍🦱" }, text: "Hey! I saw we're both in Wellness Warriors. Would love to connect!", time: "2 days ago, 3:00 PM", isMe: false },
      { id: 2, sender: currentUser, text: "Yes! I'd love that. Your morning sessions have been so helpful.", time: "2 days ago, 3:30 PM", isMe: true },
      { id: 3, sender: { name: "Maya L.", avatar: "👩‍🦱" }, text: "That means so much! Want to grab a virtual coffee?", time: "2 days ago, 3:45 PM", isMe: false },
      { id: 4, sender: currentUser, text: "Definitely! Thursday morning works for me.", time: "2 days ago, 4:00 PM", isMe: true },
      { id: 5, sender: { name: "Maya L.", avatar: "👩‍🦱" }, text: "Perfect, 7:30am?", time: "2 days ago, 4:05 PM", isMe: false },
      { id: 6, sender: currentUser, text: "Can't wait to chat about work-life balance!", time: "Yesterday, 9:00 AM", isMe: true },
    ]
  },
  {
    id: "6",
    name: "Wellness Warriors",
    emoji: "🧘‍♀️",
    bg: "bg-[#E2DDD8]",
    isGroup: true,
    memberCount: 3,
    lastMessage: {
      sender: "Maya L.",
      text: "Monday morning session confirmed ✨",
      time: "Yesterday",
    },
    unread: 0,
    messages: [
      { id: 1, sender: { name: "Maya L.", avatar: "👩‍🦱" }, text: "Good morning everyone! How are we feeling today?", time: "Yesterday, 7:00 AM", isMe: false },
      { id: 2, sender: currentUser, text: "Ready for some mindfulness! 🧘‍♀️", time: "Yesterday, 7:05 AM", isMe: true },
      { id: 3, sender: { name: "Maya L.", avatar: "👩‍🦱" }, text: "Monday morning session confirmed ✨", time: "Yesterday, 8:00 PM", isMe: false },
    ]
  },
];

export default function MessagesPage() {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeChat, setActiveChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompose, setShowCompose] = useState(false);

  const filteredConversations = conversations.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  const handleStartNewChat = (contact, initialMessage) => {
    // Check if conversation already exists
    const existingConvo = conversations.find(c => c.name === contact.name);
    
    if (existingConvo) {
      // Add message to existing conversation
      const updatedConvo = {
        ...existingConvo,
        messages: [
          ...existingConvo.messages,
          {
            id: existingConvo.messages.length + 1,
            sender: currentUser,
            text: initialMessage,
            time: "Just now",
            isMe: true,
          }
        ],
        lastMessage: {
          text: initialMessage,
          time: "Just now",
          isMe: true,
        }
      };
      
      // Move to top of list
      setConversations([
        updatedConvo,
        ...conversations.filter(c => c.id !== existingConvo.id)
      ]);
      setActiveChat(updatedConvo);
    } else {
      // Create new conversation
      const newConvo = {
        id: `new-${Date.now()}`,
        name: contact.name,
        emoji: contact.emoji,
        bg: contact.bg,
        isGroup: contact.isGroup,
        memberCount: contact.isGroup ? parseInt(contact.subtitle) : undefined,
        lastMessage: {
          text: initialMessage,
          time: "Just now",
          isMe: true,
        },
        unread: 0,
        messages: [
          {
            id: 1,
            sender: currentUser,
            text: initialMessage,
            time: "Just now",
            isMe: true,
          }
        ]
      };
      
      setConversations([newConvo, ...conversations]);
      setActiveChat(newConvo);
    }
    
    setShowCompose(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {showCompose ? (
        <ComposeView 
          contacts={contactsData}
          onClose={() => setShowCompose(false)}
          onSend={handleStartNewChat}
        />
      ) : !activeChat ? (
        <InboxView 
          conversations={filteredConversations}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          totalUnread={totalUnread}
          onSelectChat={setActiveChat}
          onCompose={() => setShowCompose(true)}
        />
      ) : (
        <ChatView 
          conversation={activeChat}
          onBack={() => setActiveChat(null)}
          onUpdateConversation={(updated) => {
            setConversations(conversations.map(c => c.id === updated.id ? updated : c));
            setActiveChat(updated);
          }}
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

function ComposeView({ contacts, onClose, onSend }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [message, setMessage] = useState("");

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const people = filteredContacts.filter(c => !c.isGroup);
  const groups = filteredContacts.filter(c => c.isGroup);

  const handleSend = () => {
    if (selectedContact && message.trim()) {
      onSend(selectedContact, message.trim());
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FAF6F3] border-b border-[#E6DDD4]">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F0E8E0] text-[#5D4E42] transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold text-[#5D4E42]" style={{ fontFamily: "'Playfair Display', serif" }}>
              New Message
            </h1>
          </div>

          {/* Selected Contact or Search */}
          {selectedContact ? (
            <div className="flex items-center gap-2 p-3 bg-white border-2 border-[#E6DDD4] rounded-2xl">
              <span className="text-sm text-[#8C7B6B]">To:</span>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F5EDE5] rounded-full">
                <span className="text-lg">{selectedContact.emoji}</span>
                <span className="text-sm font-medium text-[#5D4E42]">{selectedContact.name}</span>
                <button 
                  onClick={() => setSelectedContact(null)}
                  className="text-[#8C7B6B] hover:text-[#5D4E42]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#8C7B6B]">To:</span>
              <input
                type="text"
                placeholder="Search people or circles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-[#E6DDD4] rounded-2xl text-[#5D4E42] placeholder:text-[#8C7B6B]/40 focus:outline-none focus:border-[#B89E8B] transition-colors"
              />
            </div>
          )}
        </div>
      </header>

      {/* Contact List or Message Input */}
      {!selectedContact ? (
        <main className="flex-1 max-w-3xl mx-auto w-full">
          {/* People */}
          {people.length > 0 && (
            <div className="px-4 pt-4">
              <p className="text-xs font-medium text-[#8C7B6B] mb-2 px-1">People</p>
              <div className="space-y-1">
                {people.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#F5EDE5] transition-colors text-left"
                  >
                    <div className={`w-11 h-11 ${contact.bg} rounded-full flex items-center justify-center text-xl`}>
                      {contact.emoji}
                    </div>
                    <div>
                      <p className="font-medium text-[#5D4E42]">{contact.name}</p>
                      <p className="text-sm text-[#8C7B6B]">{contact.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {groups.length > 0 && (
            <div className="px-4 pt-4">
              <p className="text-xs font-medium text-[#8C7B6B] mb-2 px-1">Circles & Groups</p>
              <div className="space-y-1">
                {groups.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#F5EDE5] transition-colors text-left"
                  >
                    <div className={`w-11 h-11 ${contact.bg} rounded-full flex items-center justify-center text-xl`}>
                      {contact.emoji}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#5D4E42]">{contact.name}</p>
                      <p className="text-sm text-[#8C7B6B]">{contact.subtitle}</p>
                    </div>
                    <Users className="w-4 h-4 text-[#8C7B6B]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredContacts.length === 0 && (
            <div className="text-center py-16 px-4">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-[#8C7B6B]">No results found</p>
            </div>
          )}
        </main>
      ) : (
        <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4">
          {/* Empty chat area */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className={`w-16 h-16 ${selectedContact.bg} rounded-full flex items-center justify-center text-3xl mx-auto mb-3`}>
                {selectedContact.emoji}
              </div>
              <p className="font-semibold text-[#5D4E42] mb-1">{selectedContact.name}</p>
              <p className="text-sm text-[#8C7B6B]">Start a new conversation</p>
            </div>
          </div>
        </main>
      )}

      {/* Message Input - only show when contact selected */}
      {selectedContact && (
        <footer className="sticky bottom-0 bg-[#FAF6F3] border-t border-[#E6DDD4] px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2">
              <div className="flex-1 bg-white border-2 border-[#E6DDD4] rounded-2xl px-4 py-2.5 focus-within:border-[#B89E8B] transition-colors">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  autoFocus
                  className="w-full resize-none bg-transparent text-[#5D4E42] placeholder:text-[#8C7B6B]/40 focus:outline-none"
                  style={{ maxHeight: '120px' }}
                />
              </div>
              <button 
                onClick={handleSend}
                disabled={!message.trim()}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                  message.trim() 
                    ? 'bg-[#8C7B6B] text-white hover:bg-[#6B5D52]' 
                    : 'bg-[#E6DDD4] text-[#8C7B6B]'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function InboxView({ conversations, searchQuery, setSearchQuery, totalUnread, onSelectChat, onCompose }) {
  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FAF6F3]/95 backdrop-blur-sm border-b border-[#E6DDD4]">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* Title */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-[#5D4E42]" style={{ fontFamily: "'Playfair Display', serif" }}>
                Messages 💬
              </h1>
              <p className="text-sm text-[#8C7B6B] mt-0.5">
                {totalUnread > 0 ? `${totalUnread} unread` : 'All caught up!'}
              </p>
            </div>
            <button
              onClick={onCompose}
              className="w-10 h-10 bg-[#8C7B6B] text-white rounded-full flex items-center justify-center hover:bg-[#6B5D52] transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8C7B6B]/50" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-white border-2 border-[#E6DDD4] rounded-2xl text-[#5D4E42] placeholder:text-[#8C7B6B]/40 focus:outline-none focus:border-[#B89E8B] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8C7B6B]/50 hover:text-[#8C7B6B]"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Conversation List */}
      <main className="max-w-3xl mx-auto">
        {conversations.length > 0 ? (
          <div className="divide-y divide-[#EBE3DB]">
            {conversations.map((convo) => (
              <ConversationRow key={convo.id} conversation={convo} onClick={() => onSelectChat(convo)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="text-5xl mb-4">💬</div>
            <h3 className="text-lg font-medium text-[#5D4E42] mb-2">No conversations</h3>
            <p className="text-sm text-[#8C7B6B] mb-4">Start a conversation with someone!</p>
            <button
              onClick={onCompose}
              className="px-5 py-2.5 bg-[#8C7B6B] text-white text-sm font-medium rounded-xl hover:bg-[#6B5D52] transition-colors"
            >
              New Message
            </button>
          </div>
        )}
      </main>
    </>
  );
}

function ConversationRow({ conversation, onClick }) {
  return (
    <div 
      className="flex items-center gap-3 px-4 py-3 hover:bg-[#F5EDE5] transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Avatar */}
      <div className={`relative w-12 h-12 ${conversation.bg} rounded-full flex items-center justify-center text-2xl flex-shrink-0`}>
        {conversation.emoji}
        {conversation.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#C4956A] text-white text-xs font-semibold rounded-full flex items-center justify-center">
            {conversation.unread}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className={`font-semibold truncate ${conversation.unread > 0 ? 'text-[#5D4E42]' : 'text-[#5D4E42]'}`}>
            {conversation.name}
          </h3>
          <span className={`text-xs flex-shrink-0 ml-2 ${conversation.unread > 0 ? 'text-[#C4956A] font-medium' : 'text-[#8C7B6B]'}`}>
            {conversation.lastMessage.time}
          </span>
        </div>
        
        {/* Last message */}
        <p className={`text-sm truncate ${conversation.unread > 0 ? 'text-[#5D4E42] font-medium' : 'text-[#8C7B6B]'}`}>
          {conversation.isGroup && conversation.lastMessage.sender && (
            <span className="text-[#8C7B6B] font-normal">{conversation.lastMessage.sender}: </span>
          )}
          {conversation.lastMessage.isMe && <span className="text-[#8C7B6B] font-normal">You: </span>}
          {conversation.lastMessage.text}
        </p>
      </div>
    </div>
  );
}

function ChatView({ conversation, onBack, onUpdateConversation }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(conversation.messages);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!message.trim()) return;
    
    const newMessage = {
      id: messages.length + 1,
      sender: currentUser,
      text: message,
      time: "Just now",
      isMe: true,
    };
    
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setMessage("");
    
    // Update parent conversation
    onUpdateConversation({
      ...conversation,
      messages: updatedMessages,
      lastMessage: {
        text: message,
        time: "Just now",
        isMe: true,
      }
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Chat Header */}
      <header className="sticky top-0 z-50 bg-[#FAF6F3] border-b border-[#E6DDD4]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F0E8E0] text-[#5D4E42] transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <div className={`w-10 h-10 ${conversation.bg} rounded-full flex items-center justify-center text-xl`}>
              {conversation.emoji}
            </div>
            
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-[#5D4E42] truncate">{conversation.name}</h2>
              {conversation.isGroup && (
                <p className="text-xs text-[#8C7B6B]">{conversation.memberCount} members</p>
              )}
            </div>

            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F0E8E0] text-[#8C7B6B] transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.map((msg, index) => (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              isGroup={conversation.isGroup}
              showAvatar={conversation.isGroup && !msg.isMe}
              showName={conversation.isGroup && !msg.isMe && (index === 0 || messages[index - 1].sender.name !== msg.sender.name)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Message Input */}
      <footer className="sticky bottom-0 bg-[#FAF6F3] border-t border-[#E6DDD4] px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-white border-2 border-[#E6DDD4] rounded-2xl px-4 py-2.5 focus-within:border-[#B89E8B] transition-colors">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                rows={1}
                className="w-full resize-none bg-transparent text-[#5D4E42] placeholder:text-[#8C7B6B]/40 focus:outline-none"
                style={{ maxHeight: '120px' }}
              />
            </div>
            <button 
              onClick={sendMessage}
              disabled={!message.trim()}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                message.trim() 
                  ? 'bg-[#8C7B6B] text-white hover:bg-[#6B5D52]' 
                  : 'bg-[#E6DDD4] text-[#8C7B6B]'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MessageBubble({ message, isGroup, showAvatar, showName }) {
  const isMe = message.isMe;
  
  if (message.isSystem) {
    return (
      <div className="flex justify-center my-4">
        <p className="text-xs text-[#8C7B6B] bg-[#F5EDE5] px-4 py-2 rounded-full">
          {message.text}
        </p>
      </div>
    );
  }
  
  return (
    <div className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar for group chats */}
      {showAvatar && (
        <div className="w-8 h-8 bg-[#F0E8E0] rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-auto">
          {message.sender.avatar}
        </div>
      )}
      {!showAvatar && !isMe && isGroup && <div className="w-8 flex-shrink-0" />}
      
      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Sender name for group chats */}
        {showName && (
          <p className="text-xs text-[#8C7B6B] mb-1 ml-1">{message.sender.name}</p>
        )}
        
        {/* Message bubble */}
        <div className={`px-4 py-2.5 rounded-2xl ${
          isMe 
            ? 'bg-[#8C7B6B] text-white rounded-br-md' 
            : 'bg-white border border-[#EBE3DB] text-[#5D4E42] rounded-bl-md'
        }`}>
          <p className="text-sm leading-relaxed">{message.text}</p>
        </div>
        
        {/* Time */}
        <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-[#8C7B6B]/60">{message.time}</span>
          {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#6B9080]" />}
        </div>
      </div>
    </div>
  );
}

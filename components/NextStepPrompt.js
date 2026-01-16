'use client';

import { X, ChevronRight, Calendar, UserPlus, Users, Coffee, Sparkles } from 'lucide-react';

/**
 * NextStepPrompt - Post-action modal guiding users to the next step
 *
 * Shows after key actions to guide users through the happy path:
 * - After signing up for meetup → Suggest exploring chat feature
 * - After meetup ends → Suggest connecting with participants
 * - After connecting → Suggest forming a group
 * - After joining group → Suggest 1:1 coffee chat
 */
export default function NextStepPrompt({
  type, // 'meetup_signup', 'meetup_end', 'connection_made', 'group_joined'
  onAction, // Function called with the action type
  onDismiss,
  data = {} // Additional context data
}) {
  const prompts = {
    meetup_signup: {
      icon: Calendar,
      color: 'rose',
      title: "You're signed up!",
      subtitle: data.meetupDate ? `See you on ${data.meetupDate}` : "We'll send you a reminder",
      message: "After the meetup, you'll be able to connect with people you meet and continue the conversation.",
      tip: "Pro tip: The video call option lets you join remotely if you can't make it in person!",
      actions: [
        { label: 'Got it!', primary: true, action: 'dismiss' }
      ]
    },
    meetup_end: {
      icon: UserPlus,
      color: 'purple',
      title: "Great meetup!",
      subtitle: `You met ${data.participantCount || 'some great'} people`,
      message: "Don't let those connections fade! Express interest in people you'd like to stay connected with.",
      nextStep: "Mutual interests become connections you can message and video chat with.",
      actions: [
        { label: 'View Connections', primary: true, action: 'connections' },
        { label: 'Maybe later', primary: false, action: 'dismiss' }
      ]
    },
    connection_made: {
      icon: Users,
      color: 'blue',
      title: "New connection!",
      subtitle: data.connectionName ? `You and ${data.connectionName} are now connected` : "You've made a new connection",
      message: "Want to take it further? Form a small group with your connections for regular video chats.",
      nextStep: "Groups of 3-4 people meet regularly and build deeper relationships.",
      actions: [
        { label: 'Explore Groups', primary: true, action: 'groups' },
        { label: 'Send a message first', primary: false, action: 'messages' }
      ]
    },
    group_joined: {
      icon: Coffee,
      color: 'amber',
      title: "Welcome to the group!",
      subtitle: data.groupName ? `You're now in "${data.groupName}"` : "You've joined a new group",
      message: "For even deeper conversations, schedule 1:1 coffee chats with your group members.",
      nextStep: "1:1 video calls are great for mentoring, advice, or just getting to know someone better.",
      actions: [
        { label: 'Schedule a Coffee Chat', primary: true, action: 'coffeeChats' },
        { label: 'Chat with the group first', primary: false, action: 'dismiss' }
      ]
    },
    first_meetup: {
      icon: Sparkles,
      color: 'rose',
      title: "First meetup signed up!",
      subtitle: "You're on your way",
      message: "This is the first step in your networking journey. After attending, you'll unlock the ability to connect with people 1:1.",
      nextStep: "Attend 3 meetups to unlock 1:1 coffee chats!",
      actions: [
        { label: "Can't wait!", primary: true, action: 'dismiss' }
      ]
    }
  };

  const prompt = prompts[type];
  if (!prompt) return null;

  const Icon = prompt.icon;

  const colorClasses = {
    rose: {
      bg: 'from-rose-500 to-pink-500',
      light: 'bg-rose-50 border-rose-200',
      text: 'text-rose-700',
      button: 'bg-rose-500 hover:bg-rose-600'
    },
    purple: {
      bg: 'from-purple-500 to-indigo-500',
      light: 'bg-purple-50 border-purple-200',
      text: 'text-purple-700',
      button: 'bg-purple-500 hover:bg-purple-600'
    },
    blue: {
      bg: 'from-blue-500 to-cyan-500',
      light: 'bg-blue-50 border-blue-200',
      text: 'text-blue-700',
      button: 'bg-blue-500 hover:bg-blue-600'
    },
    amber: {
      bg: 'from-amber-500 to-orange-500',
      light: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
      button: 'bg-amber-500 hover:bg-amber-600'
    }
  };

  const colors = colorClasses[prompt.color];

  const handleAction = (action) => {
    if (action === 'dismiss') {
      onDismiss?.();
    } else {
      onAction?.(action);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className={`bg-gradient-to-r ${colors.bg} p-6 relative`}>
          <button
            onClick={() => handleAction('dismiss')}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-white text-xl font-bold">{prompt.title}</h3>
              <p className="text-white/80 text-sm">{prompt.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-4">{prompt.message}</p>

          {prompt.nextStep && (
            <div className={`${colors.light} border rounded-lg p-3 mb-4`}>
              <div className="flex items-start gap-2">
                <ChevronRight className={`w-5 h-5 ${colors.text} flex-shrink-0 mt-0.5`} />
                <p className={`text-sm ${colors.text}`}>
                  <strong>Next step:</strong> {prompt.nextStep}
                </p>
              </div>
            </div>
          )}

          {prompt.tip && (
            <p className="text-gray-500 text-sm mb-4">
              <span className="text-amber-500 mr-1">*</span>
              {prompt.tip}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {prompt.actions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleAction(action.action)}
                className={`flex-1 py-2.5 rounded-lg font-medium transition ${
                  action.primary
                    ? `${colors.button} text-white`
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

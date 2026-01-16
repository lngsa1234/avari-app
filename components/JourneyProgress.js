'use client';

import { Calendar, Users, UserPlus, Coffee, ChevronRight, Check, Sparkles } from 'lucide-react';

/**
 * JourneyProgress - Visual progress indicator for the networking happy path
 *
 * Shows: Meetups → Connections → Groups → Coffee Chats
 * Highlights current step and guides users to the next action
 */
export default function JourneyProgress({
  meetupsAttended = 0,
  connectionsCount = 0,
  groupsCount = 0,
  coffeeChatsCount = 0,
  onNavigate // Function to navigate: (view) => setCurrentView(view)
}) {
  // Define the journey steps
  const steps = [
    {
      id: 'meetups',
      title: 'Attend Meetups',
      shortTitle: 'Meetups',
      icon: Calendar,
      count: meetupsAttended,
      target: 1, // Minimum to complete this step
      description: 'Join group meetups to meet new people',
      cta: 'Find Meetups',
      view: 'home',
      color: 'rose'
    },
    {
      id: 'connections',
      title: 'Make Connections',
      shortTitle: 'Connect',
      icon: UserPlus,
      count: connectionsCount,
      target: 1,
      description: 'Connect with people you meet',
      cta: 'View Connections',
      view: 'coffeeChats',
      color: 'purple'
    },
    {
      id: 'groups',
      title: 'Join Groups',
      shortTitle: 'Groups',
      icon: Users,
      count: groupsCount,
      target: 1,
      description: 'Form or join a recurring cohort',
      cta: 'Explore Groups',
      view: 'connectionGroups',
      color: 'blue'
    },
    {
      id: 'coffeeChats',
      title: '1:1 Coffee Chats',
      shortTitle: 'Coffee',
      icon: Coffee,
      count: coffeeChatsCount,
      target: 1,
      description: 'Schedule deeper 1-on-1 conversations',
      cta: 'Start Chatting',
      view: 'coffeeChats',
      color: 'amber',
      requiresMeetups: 3 // Need 3 meetups to unlock
    }
  ];

  // Determine which step is current (first incomplete one)
  const getCurrentStep = () => {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.count < step.target) {
        // Check if this step is locked
        if (step.requiresMeetups && meetupsAttended < step.requiresMeetups) {
          // This step is locked, but it's still the "goal"
          return i;
        }
        return i;
      }
    }
    return steps.length; // All complete
  };

  const currentStepIndex = getCurrentStep();
  const allComplete = currentStepIndex >= steps.length;

  // Get color classes for a step
  const getStepColors = (step, index) => {
    const isComplete = step.count >= step.target;
    const isCurrent = index === currentStepIndex;
    const isLocked = step.requiresMeetups && meetupsAttended < step.requiresMeetups;

    if (isComplete) {
      return {
        bg: 'bg-green-100',
        border: 'border-green-300',
        icon: 'bg-green-500 text-white',
        text: 'text-green-700',
        badge: 'bg-green-500'
      };
    }

    if (isLocked) {
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        icon: 'bg-gray-300 text-gray-500',
        text: 'text-gray-400',
        badge: 'bg-gray-400'
      };
    }

    if (isCurrent) {
      const colorMap = {
        rose: { bg: 'bg-rose-50', border: 'border-rose-300', icon: 'bg-rose-500 text-white', text: 'text-rose-700', badge: 'bg-rose-500' },
        purple: { bg: 'bg-purple-50', border: 'border-purple-300', icon: 'bg-purple-500 text-white', text: 'text-purple-700', badge: 'bg-purple-500' },
        blue: { bg: 'bg-blue-50', border: 'border-blue-300', icon: 'bg-blue-500 text-white', text: 'text-blue-700', badge: 'bg-blue-500' },
        amber: { bg: 'bg-amber-50', border: 'border-amber-300', icon: 'bg-amber-500 text-white', text: 'text-amber-700', badge: 'bg-amber-500' }
      };
      return colorMap[step.color] || colorMap.rose;
    }

    return {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      icon: 'bg-gray-200 text-gray-500',
      text: 'text-gray-500',
      badge: 'bg-gray-400'
    };
  };

  // Calculate overall progress percentage
  const completedSteps = steps.filter(s => s.count >= s.target).length;
  const progressPercent = (completedSteps / steps.length) * 100;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-white" />
            <h3 className="text-white font-semibold">Your Networking Journey</h3>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-white text-sm font-medium">
              {completedSteps}/{steps.length} complete
            </span>
          </div>
        </div>
        {/* Overall progress bar */}
        <div className="mt-2 h-1.5 bg-white/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="p-4">
        {/* Mobile: Vertical layout */}
        <div className="space-y-3 md:hidden">
          {steps.map((step, index) => {
            const colors = getStepColors(step, index);
            const isComplete = step.count >= step.target;
            const isCurrent = index === currentStepIndex;
            const isLocked = step.requiresMeetups && meetupsAttended < step.requiresMeetups;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={`${colors.bg} ${colors.border} border rounded-lg p-3 transition-all ${
                  isCurrent ? 'ring-2 ring-offset-1 ring-rose-300' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={`${colors.icon} w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}>
                    {isComplete ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium ${colors.text}`}>{step.title}</h4>
                      {isCurrent && !isLocked && (
                        <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">
                          Next
                        </span>
                      )}
                      {isLocked && (
                        <span className="bg-gray-400 text-white text-xs px-2 py-0.5 rounded-full">
                          {step.requiresMeetups - meetupsAttended} meetups to unlock
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm">{step.description}</p>
                  </div>

                  {/* Count badge */}
                  <div className={`${colors.badge} text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}>
                    {step.count}
                  </div>
                </div>

                {/* CTA for current step */}
                {isCurrent && !isLocked && (
                  <button
                    onClick={() => onNavigate(step.view)}
                    className="mt-3 w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-medium py-2 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {step.cta}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop: Horizontal layout */}
        <div className="hidden md:block">
          <div className="flex items-start gap-2">
            {steps.map((step, index) => {
              const colors = getStepColors(step, index);
              const isComplete = step.count >= step.target;
              const isCurrent = index === currentStepIndex;
              const isLocked = step.requiresMeetups && meetupsAttended < step.requiresMeetups;
              const Icon = step.icon;
              const isLast = index === steps.length - 1;

              return (
                <div key={step.id} className="flex items-start flex-1">
                  {/* Step card */}
                  <div
                    className={`${colors.bg} ${colors.border} border rounded-lg p-3 flex-1 transition-all cursor-pointer hover:shadow-md ${
                      isCurrent ? 'ring-2 ring-offset-1 ring-rose-300' : ''
                    }`}
                    onClick={() => !isLocked && onNavigate(step.view)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`${colors.icon} w-8 h-8 rounded-full flex items-center justify-center`}>
                        {isComplete ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <div className={`${colors.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
                        {step.count}
                      </div>
                    </div>
                    <h4 className={`font-medium text-sm ${colors.text}`}>{step.shortTitle}</h4>
                    {isCurrent && !isLocked && (
                      <span className="inline-block mt-1 bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">
                        Do this
                      </span>
                    )}
                    {isLocked && (
                      <span className="inline-block mt-1 bg-gray-400 text-white text-xs px-1.5 py-0.5 rounded-full">
                        Locked
                      </span>
                    )}
                  </div>

                  {/* Arrow connector */}
                  {!isLast && (
                    <div className="flex items-center px-1 pt-5">
                      <ChevronRight className={`w-5 h-5 ${isComplete ? 'text-green-400' : 'text-gray-300'}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Current step CTA */}
          {!allComplete && currentStepIndex < steps.length && (
            <div className="mt-4 flex items-center justify-between bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg p-3 border border-rose-200">
              <div>
                <p className="text-rose-800 font-medium">
                  {steps[currentStepIndex].requiresMeetups && meetupsAttended < steps[currentStepIndex].requiresMeetups
                    ? `Attend ${steps[currentStepIndex].requiresMeetups - meetupsAttended} more meetup${steps[currentStepIndex].requiresMeetups - meetupsAttended > 1 ? 's' : ''} to unlock 1:1 Coffee Chats`
                    : `Next: ${steps[currentStepIndex].description}`
                  }
                </p>
              </div>
              {!(steps[currentStepIndex].requiresMeetups && meetupsAttended < steps[currentStepIndex].requiresMeetups) && (
                <button
                  onClick={() => onNavigate(steps[currentStepIndex].view)}
                  className="bg-rose-500 hover:bg-rose-600 text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
                >
                  {steps[currentStepIndex].cta}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* All complete celebration */}
          {allComplete && (
            <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200 text-center">
              <div className="flex items-center justify-center gap-2 text-green-700">
                <Sparkles className="w-5 h-5" />
                <span className="font-semibold">Amazing! You've completed your networking journey!</span>
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-green-600 text-sm mt-1">Keep connecting and building meaningful relationships</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

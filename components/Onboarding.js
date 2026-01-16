'use client';

import { useState } from 'react';
import { Coffee, Users, Calendar, Video, MessageCircle, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';

/**
 * Onboarding - Step-by-step introduction for new users
 *
 * Shows after first login to explain key app features
 */
export default function Onboarding({ onComplete, userName }) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: <Sparkles className="w-16 h-16 text-pink-400" />,
      title: "Welcome to Avari!",
      subtitle: userName ? `Hey ${userName}, great to have you!` : "Great to have you!",
      description: "Your space for meaningful professional connections. Let's show you around.",
      color: "from-pink-500 to-rose-500"
    },
    {
      icon: <Coffee className="w-16 h-16 text-amber-400" />,
      title: "Coffee Chats",
      subtitle: "Meet someone new",
      description: "Get matched with interesting people for 1-on-1 video chats. It's like a virtual coffee date - casual, friendly, and a great way to expand your network.",
      tips: ["Matches refresh regularly", "Video calls are just a tap away", "Express interest to connect"],
      color: "from-amber-500 to-orange-500"
    },
    {
      icon: <Calendar className="w-16 h-16 text-purple-400" />,
      title: "Meetups",
      subtitle: "Join group gatherings",
      description: "Sign up for scheduled meetups to join group video calls. Meet multiple people at once in a relaxed, structured setting.",
      tips: ["Browse upcoming meetups", "Sign up with one tap", "Get reminders before they start"],
      color: "from-purple-500 to-indigo-500"
    },
    {
      icon: <Users className="w-16 h-16 text-blue-400" />,
      title: "Connection Groups",
      subtitle: "Build your community",
      description: "Form or join groups with people who share your interests. Stay connected with your cohort through group chats and calls.",
      tips: ["Create groups around topics you love", "Invite people you meet", "Schedule group video calls"],
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Video className="w-16 h-16 text-green-400" />,
      title: "Video Calls",
      subtitle: "Connect face-to-face",
      description: "All connections happen through video. After each call, you'll get an AI-powered recap with conversation highlights and connection suggestions.",
      tips: ["HD video with screen sharing", "In-call messaging", "AI summaries after calls"],
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: <MessageCircle className="w-16 h-16 text-rose-400" />,
      title: "You're All Set!",
      subtitle: "Start connecting",
      description: "Your profile is ready. Explore Coffee Chats to meet someone new, or check out upcoming Meetups. The community is waiting for you!",
      color: "from-rose-500 to-pink-500",
      isFinal: true
    }
  ];

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Progress bar */}
        <div className="h-1 bg-gray-700">
          <div
            className={`h-full bg-gradient-to-r ${currentStepData.color} transition-all duration-500`}
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Header with gradient */}
        <div className={`bg-gradient-to-br ${currentStepData.color} p-8 text-center`}>
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
              {currentStepData.icon}
            </div>
          </div>
          <h2 className="text-white text-2xl font-bold mb-1">
            {currentStepData.title}
          </h2>
          <p className="text-white/80 text-sm">
            {currentStepData.subtitle}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-300 text-center mb-6 leading-relaxed">
            {currentStepData.description}
          </p>

          {/* Tips */}
          {currentStepData.tips && (
            <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Quick Tips</p>
              <ul className="space-y-2">
                {currentStepData.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-gray-300 text-sm">
                    <span className="text-green-400">&#10003;</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? 'w-6 bg-white'
                    : idx < currentStep
                      ? 'bg-gray-500'
                      : 'bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {!isFirstStep && (
              <button
                onClick={handlePrev}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-medium transition"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>
            )}

            <button
              onClick={handleNext}
              className={`flex-1 flex items-center justify-center gap-2 bg-gradient-to-r ${currentStepData.color} hover:opacity-90 text-white py-3 rounded-xl font-semibold transition`}
            >
              {isLastStep ? "Let's Go!" : "Next"}
              {!isLastStep && <ChevronRight className="w-5 h-5" />}
            </button>
          </div>

          {/* Skip button */}
          {!isLastStep && (
            <button
              onClick={handleSkip}
              className="w-full mt-3 text-gray-500 hover:text-gray-400 text-sm transition"
            >
              Skip intro
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

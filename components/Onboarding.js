'use client';

import { useState } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, Compass, Users } from 'lucide-react';
import { colors as tokens } from '@/lib/designTokens';

/**
 * Onboarding - Step-by-step introduction for new users
 *
 * Shows after first login to explain key app features
 */
export default function Onboarding({ onComplete, userName }) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Welcome to CircleW!",
      subtitle: userName ? `Hey ${userName}, great to have you!` : "Great to have you!",
      description: "Find your circle. Move forward. Let's show you around.",
      isWelcome: true,
    },
    {
      title: "Discover",
      subtitle: "Browse what's happening",
      description: "Explore events, circles, and trending topics curated for your interests. There's always something new to check out.",
      icon: Compass,
      tips: ["Swipe through upcoming events", "See what's trending near you", "Find circles that match your vibe"],
    },
    {
      title: "Circles",
      subtitle: "Find your people",
      description: "Join intimate groups around shared interests. Stay connected through group chats, scheduled meetups, and collaborative activities.",
      icon: Users,
      tips: ["Browse circles by topic", "Create your own circle", "Invite people you meet"],
    },
    {
      title: "Coffee Chats",
      subtitle: "Meet someone new",
      description: "Get matched with interesting people for 1-on-1 video chats. It's like a virtual coffee date — casual, friendly, and a great way to expand your network.",
      thumbnail: "/thumbnails/start-coffee-chat.svg",
      tips: ["Matches refresh regularly", "Video calls are just a tap away", "Express interest to connect"],
    },
    {
      title: "You're All Set!",
      subtitle: "Start connecting",
      description: "Your profile is ready. Explore Coffee Chats to meet someone new, or check out upcoming events. The community is waiting for you!",
      isFinal: true,
    },
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

  // Step dots (shared across all steps)
  const stepDots = (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
      {steps.map((_, idx) => (
        <button
          key={idx}
          onClick={() => setCurrentStep(idx)}
          style={{
            width: idx === currentStep ? '24px' : '8px',
            height: '8px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: idx === currentStep ? tokens.primaryDark : 'rgba(94, 71, 47, 0.25)',
            transition: 'all 0.3s ease',
            padding: 0,
          }}
        />
      ))}
    </div>
  );

  // --- Welcome step (step 0) ---
  if (currentStepData.isWelcome) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', backgroundColor: 'rgba(0,0,0,0.85)',
      }}>
        <div style={{
          maxWidth: '420px', width: '100%', borderRadius: '35px',
          overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', minHeight: '580px',
        }}>
          {/* Top - dark brown with logo */}
          <div style={{
            background: tokens.primaryDark,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 32px 24px',
            minHeight: '220px',
          }}>
            <img
              src="/tutorial-logo.png"
              alt="CircleW"
              style={{
                width: '60%', maxWidth: '250px', height: 'auto',
                objectFit: 'contain', marginBottom: '20px',
              }}
            />
            <h2 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '28px', fontWeight: '700', color: '#FFFBF5',
              margin: '0 0 8px', textAlign: 'center',
            }}>
              {currentStepData.title}
            </h2>
            <p style={{
              fontSize: '16px', color: 'rgba(255, 251, 245, 0.75)',
              margin: 0, textAlign: 'center', fontWeight: '500',
            }}>
              {currentStepData.subtitle}
            </p>
          </div>

          {/* Bottom - warm gradient */}
          <div style={{
            background: 'linear-gradient(179.91deg, rgba(240, 225, 213, 0.98) -13.08%, rgba(197, 172, 150, 0.78) 99.92%)',
            padding: '28px 32px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            flex: 1, justifyContent: 'center',
          }}>
            <p style={{
              fontSize: '14px', color: tokens.textLight,
              margin: '0 0 32px', textAlign: 'center', lineHeight: '1.5',
            }}>
              {currentStepData.description}
            </p>

            {stepDots}

            <button onClick={handleNext} style={{
              width: '100%', padding: '16px', borderRadius: '16px', border: 'none',
              background: `linear-gradient(135deg, ${tokens.primaryDark}, ${tokens.primary})`,
              color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 12px rgba(94, 71, 47, 0.3)', letterSpacing: '0.3px',
            }}>
              Get Started
              <ChevronRight size={20} />
            </button>

            <button onClick={handleSkip} style={{
              marginTop: '12px', background: 'none', border: 'none',
              color: tokens.textLight, fontSize: '14px', cursor: 'pointer', padding: '4px',
            }}>
              Skip intro
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Final step ---
  if (currentStepData.isFinal) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', backgroundColor: 'rgba(0,0,0,0.85)',
      }}>
        <div style={{
          maxWidth: '420px', width: '100%', borderRadius: '35px',
          overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', minHeight: '580px',
        }}>
          {/* Top - dark brown with sparkle icon */}
          <div style={{
            background: tokens.primaryDark,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 32px 24px',
            minHeight: '220px',
          }}>
            <img
              src="/tutorial-logo.png"
              alt="CircleW"
              style={{
                width: '60%', maxWidth: '250px', height: 'auto',
                objectFit: 'contain', marginBottom: '20px',
              }}
            />
            <h2 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '28px', fontWeight: '700', color: '#FFFBF5',
              margin: '0 0 8px', textAlign: 'center',
            }}>
              {currentStepData.title}
            </h2>
            <p style={{
              fontSize: '16px', color: 'rgba(255, 251, 245, 0.75)',
              margin: 0, textAlign: 'center', fontWeight: '500',
            }}>
              {currentStepData.subtitle}
            </p>
          </div>

          {/* Bottom - warm gradient */}
          <div style={{
            background: 'linear-gradient(179.91deg, rgba(240, 225, 213, 0.98) -13.08%, rgba(197, 172, 150, 0.78) 99.92%)',
            padding: '28px 32px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            flex: 1, justifyContent: 'center',
          }}>
            <p style={{
              fontSize: '14px', color: tokens.textLight,
              margin: '0 0 32px', textAlign: 'center', lineHeight: '1.5',
            }}>
              {currentStepData.description}
            </p>

            {stepDots}

            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button onClick={handlePrev} style={{
                flex: 1, padding: '16px', borderRadius: '16px',
                border: '1.5px solid rgba(94, 71, 47, 0.3)',
                background: 'transparent', color: tokens.primaryDark,
                fontSize: '16px', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
                <ChevronLeft size={20} />
                Back
              </button>

              <button onClick={handleNext} style={{
                flex: 1, padding: '16px', borderRadius: '16px', border: 'none',
                background: `linear-gradient(135deg, ${tokens.primaryDark}, ${tokens.primary})`,
                color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 4px 12px rgba(94, 71, 47, 0.3)', letterSpacing: '0.3px',
              }}>
                Let's Go!
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Feature steps (1-3): icon or thumbnail + tips ---
  const IconComponent = currentStepData.icon;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', backgroundColor: 'rgba(0,0,0,0.85)',
    }}>
      <div style={{
        maxWidth: '420px', width: '100%', borderRadius: '35px',
        overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', minHeight: '580px',
      }}>
        {/* Top - dark brown with icon or background image, title, subtitle */}
        <div style={{
          background: currentStepData.thumbnail
            ? `url(${currentStepData.thumbnail}) center top / cover no-repeat, ${tokens.primaryDark}`
            : tokens.primaryDark,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 32px 24px',
          minHeight: '220px',
        }}>
          {!currentStepData.thumbnail && (
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '24px',
            }}>
              <IconComponent size={40} color="#FFFBF5" />
            </div>
          )}
          <h2 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: '28px', fontWeight: '700', color: '#FFFBF5',
            margin: '0 0 8px', textAlign: 'center',
          }}>
            {currentStepData.title}
          </h2>
          <p style={{
            fontSize: '16px', color: 'rgba(255, 251, 245, 0.75)',
            margin: 0, textAlign: 'center', fontWeight: '500',
          }}>
            {currentStepData.subtitle}
          </p>
        </div>

        {/* Bottom - warm gradient with title, description, tips, nav */}
        <div style={{
          background: 'linear-gradient(179.91deg, rgba(240, 225, 213, 0.98) -13.08%, rgba(197, 172, 150, 0.78) 99.92%)',
          padding: '28px 32px 32px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          flex: 1,
        }}>
          <p style={{
            fontSize: '14px', color: tokens.textLight,
            margin: '0 0 20px', textAlign: 'center', lineHeight: '1.5',
          }}>
            {currentStepData.description}
          </p>

          {/* Tips */}
          {currentStepData.tips && (
            <div style={{
              width: '100%',
              background: 'rgba(94, 71, 47, 0.07)',
              borderRadius: '14px',
              padding: '14px 18px',
              marginBottom: '24px',
            }}>
              <p style={{
                fontSize: '11px', color: tokens.textLight,
                textTransform: 'uppercase', letterSpacing: '0.8px',
                margin: '0 0 10px', fontWeight: '600',
              }}>
                Quick Tips
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {currentStepData.tips.map((tip, idx) => (
                  <li key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontSize: '13px', color: tokens.primaryDark,
                    marginBottom: idx < currentStepData.tips.length - 1 ? '8px' : 0,
                  }}>
                    <span style={{ color: tokens.primaryDark, fontSize: '13px', flexShrink: 0 }}>&#10003;</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stepDots}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button onClick={handlePrev} style={{
              flex: 1, padding: '16px', borderRadius: '16px',
              border: '1.5px solid rgba(94, 71, 47, 0.3)',
              background: 'transparent', color: tokens.primaryDark,
              fontSize: '16px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              <ChevronLeft size={20} />
              Back
            </button>

            <button onClick={handleNext} style={{
              flex: 1, padding: '16px', borderRadius: '16px', border: 'none',
              background: `linear-gradient(135deg, ${tokens.primaryDark}, ${tokens.primary})`,
              color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 12px rgba(94, 71, 47, 0.3)', letterSpacing: '0.3px',
            }}>
              Next
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Skip */}
          <button onClick={handleSkip} style={{
            marginTop: '12px', background: 'none', border: 'none',
            color: tokens.textLight, fontSize: '14px', cursor: 'pointer', padding: '4px',
          }}>
            Skip intro
          </button>
        </div>
      </div>
    </div>
  );
}

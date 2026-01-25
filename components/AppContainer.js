'use client'

import { useAuth } from './AuthProvider'
import MainApp from './MainApp'
import LandingPage from './LandingPage'
import ProfileSetupFlow from './ProfileSetupFlow'
import { supabase } from '@/lib/supabase'

export default function AppContainer() {
  const {
    user,
    profile,
    status,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshProfile
  } = useAuth()

  // Check if onboarding is incomplete
  // New flow: check onboarding_completed flag, or fallback to checking required fields
  const needsOnboarding = profile && (
    profile.onboarding_completed === false ||
    !profile.career ||
    !profile.vibe_category ||
    !profile.career_stage
  )

  const handleOnboardingComplete = async (profileData) => {
    try {
      console.log('✅ Onboarding completed')
      // Refresh the profile to get updated data
      await refreshProfile()
      console.log('✅ Profile refresh complete')
    } catch (error) {
      console.error('❌ Error refreshing profile:', error)
    }
  }

  switch (status) {
    case 'initializing':
    case 'loading_profile':
      if (user) {
        return (
          <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        )
      }
      break

    case 'profile_missing':
      return (
        <ProfileSetupFlow
          session={{ user, profile: { name: user?.user_metadata?.name || '' } }}
          supabase={supabase}
          onComplete={handleOnboardingComplete}
        />
      )

    case 'ready':
      if (profile) {
        // Show onboarding flow if incomplete
        if (needsOnboarding) {
          return (
            <ProfileSetupFlow
              session={{ user, profile }}
              supabase={supabase}
              onComplete={handleOnboardingComplete}
            />
          )
        }

        // Show main app if onboarding is complete
        return (
          <MainApp
            currentUser={profile}
            onSignOut={signOut}
          />
        )
      }
      break

    case 'signed_out':
    default:
      return (
        <LandingPage
          onGoogleSignIn={signInWithGoogle}
          onEmailSignUp={signUpWithEmail}
          onEmailSignIn={signInWithEmail}
        />
      )
  }
}

'use client'

import { useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import LandingPage from '@/components/LandingPage'
import ProfileSetup from '@/components/ProfileSetup'
import MainApp from '@/components/MainApp'

export default function AppContainer() {
  const { user, profile, authLoading, profileLoading, signOut, saveProfile } = useAuth()

  // MEMOIZED auth handlers
  const handleGoogleSignIn = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`
      }
    })

    if (error) {
      alert('Error signing in: ' + error.message)
    }
  }, [])

  const handleEmailSignUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}`
      }
    })

    if (error) {
      alert('Error signing up: ' + error.message)
    } else {
      if (data?.user?.identities?.length === 0) {
        alert('This email is already registered. Please log in instead.')
      } else if (data?.session) {
        alert('Account created! Setting up your profile...')
      } else {
        alert('Check your email for verification link!')
      }
    }
  }, [])

  const handleEmailSignIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert('Error signing in: ' + error.message)
    }
  }, [])

  const handleSaveProfile = useCallback(async (profileData) => {
    try {
      await saveProfile(profileData)
    } catch (error) {
      alert('Error saving profile: ' + error.message)
    }
  }, [saveProfile])

  // CRITICAL: Wait for BOTH auth AND profile to be ready
  // This prevents the "flash" during signup
  if (authLoading || (user && profileLoading)) {
    console.log('⏳ AppContainer: Loading... (auth:', authLoading, 'profile:', profileLoading, 'user:', !!user, ')')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-100 via-pink-50 to-purple-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // NOT LOGGED IN
  if (!user) {
    console.log('🔓 AppContainer: Rendering Landing (no user)')
    return (
      <LandingPage
        onGoogleSignIn={handleGoogleSignIn}
        onEmailSignUp={handleEmailSignUp}
        onEmailSignIn={handleEmailSignIn}
      />
    )
  }

  // LOGGED IN BUT NO PROFILE (or onboarding not complete)
  if (!profile || !profile.onboarding_complete) {
    console.log('📝 AppContainer: Rendering ProfileSetup (user exists, profile:', !!profile, 'onboarding:', profile?.onboarding_complete)
    return (
      <ProfileSetup
        session={{ user }}
        onSave={handleSaveProfile}
      />
    )
  }

  // LOGGED IN WITH COMPLETE PROFILE - MainApp stays mounted!
  console.log('✅ AppContainer: Rendering MainApp (user + complete profile)')
  return (
    <MainApp
      currentUser={profile}
      onSignOut={signOut}
      supabase={supabase}
    />
  )
}

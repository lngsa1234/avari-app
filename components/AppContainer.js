'use client'

import { useAuth } from './AuthProvider'
import MainApp from './MainApp'
import LandingPage from './LandingPage'
import ProfileSetup from './ProfileSetup'
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

  // Check if profile is incomplete (missing required fields)
  const isProfileIncomplete = profile && (!profile.career || !profile.city || !profile.state)

  const handleProfileSave = async (profileData) => {
    try {
      // Use upsert to handle both insert and update cases
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          name: profileData.name,
          career: profileData.career,
          city: profileData.city,
          state: profileData.state,
          bio: profileData.bio
        }, {
          onConflict: 'id'
        })

      if (error) throw error

      console.log('✅ Profile saved successfully')

      // Refresh the profile to get updated data
      await refreshProfile()

      console.log('✅ Profile refresh complete')
    } catch (error) {
      console.error('❌ Error saving profile:', error)
      alert('Failed to save profile: ' + error.message)
      throw error
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
        <ProfileSetup
          session={{ user, profile: { name: user?.user_metadata?.name || '' } }}
          onSave={handleProfileSave}
        />
      )

    case 'ready':
      if (profile) {
        // Show profile setup if incomplete
        if (isProfileIncomplete) {
          return (
            <ProfileSetup
              session={{ user, profile }}
              onSave={handleProfileSave}
            />
          )
        }

        // Show main app if profile is complete
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

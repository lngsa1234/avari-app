'use client'

import { useAuth } from './AuthProvider'
import MainApp from './MainApp'
import LandingPage from './LandingPage'

export default function AppContainer() {
  const {
    user,
    profile,
    status,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut
  } = useAuth()

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
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-md">
            <div className="text-5xl mb-4">👋</div>
            <h2 className="text-2xl font-bold mb-4">Welcome to Avari!</h2>
            <p className="text-gray-600 mb-6">
              Let's set up your profile to start connecting with people from your meetups.
            </p>
            <a 
              href="/profile/new"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Profile
            </a>
          </div>
        </div>
      )

    case 'ready':
      if (profile) {
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

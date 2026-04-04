'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import LandingPage from '@/components/LandingPage'

/**
 * Root page — landing page for unauthenticated users.
 * Authenticated users are redirected to /home.
 */
export default function RootPage() {
  const { user, profile, status, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const router = useRouter()

  // Redirect authenticated users to /home
  useEffect(() => {
    if (status === 'ready' && profile) {
      // Check for deep link params before redirecting
      const params = new URLSearchParams(window.location.search)
      const eventId = params.get('event')
      const next = params.get('next')
      if (eventId) {
        router.replace(`/events/${eventId}`)
      } else if (next) {
        router.replace(next)
      } else {
        router.replace('/home')
      }
    }
  }, [status, profile, router])

  // Show loading during auth initialization
  if (status === 'initializing' || status === 'loading_profile') {
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
    return null
  }

  // Authenticated — show nothing while redirect happens
  if (status === 'ready' && profile) {
    return null
  }

  // Not authenticated — show landing page
  return (
    <LandingPage
      onGoogleSignIn={signInWithGoogle}
      onEmailSignUp={signUpWithEmail}
      onEmailSignIn={signInWithEmail}
    />
  )
}

'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import AppNavBar from '@/components/AppNavBar'
import ProfileSetupFlow from '@/components/ProfileSetupFlow'
import { ToastContainer, useToast } from '@/components/Toast'
import { updateLastActiveThrottled } from '@/lib/activityHelpers'
import { fonts } from '@/lib/designTokens'
import { createOnNavigate } from '@/lib/navigationAdapter'

/**
 * Authenticated layout — wraps all pages under (app)/.
 *
 * Responsibilities:
 * 1. Auth gate: redirect to / if not signed in
 * 2. Onboarding gate: show ProfileSetupFlow if incomplete
 * 3. Render AppNavBar (persistent across page navigations)
 * 4. Realtime subscriptions (persistent across page navigations)
 * 5. Activity tracking
 */
export default function AuthenticatedLayout({ children }) {
  const { user, profile, status, refreshProfile } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const onNavigate = createOnNavigate(router)

  // Redirect to landing if not authenticated
  useEffect(() => {
    if (status === 'signed_out') {
      router.replace('/')
    }
  }, [status, router])

  // Track user activity
  useEffect(() => {
    if (profile?.id) {
      updateLastActiveThrottled(profile.id)
    }
  }, [profile?.id])

  // Realtime subscriptions — layout stays mounted across navigations
  useEffect(() => {
    if (!profile?.id) return

    const meetupsChannel = supabase
      .channel('rt-meetups')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'meetups' },
        () => { /* Pages using SWR will revalidate; for non-SWR pages this is a no-op for now */ }
      )
      .subscribe()

    const interestsChannel = supabase
      .channel('rt-interests')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_interests',
          filter: `interested_in_user_id=eq.${profile.id}` },
        () => {}
      )
      .subscribe()

    const messagesChannel = supabase
      .channel('rt-messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages',
          filter: `receiver_id=eq.${profile.id}` },
        () => {}
      )
      .subscribe()

    return () => {
      supabase.removeChannel(meetupsChannel)
      supabase.removeChannel(interestsChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [profile?.id])

  // Loading state
  if (status === 'initializing' || status === 'loading_profile') {
    if (user) {
      return (
        <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#FDF8F3' }}>
          <div className="text-center">
            <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 111, 92, 0.15)', borderTopColor: '#8B6F5C', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#A89080', fontSize: '14px', fontFamily: fonts.sans }}>Loading...</p>
          </div>
        </div>
      )
    }
    // No user yet during initialization — wait (will redirect when status becomes signed_out)
    return null
  }

  // Not authenticated
  if (status === 'signed_out' || !profile) {
    return null // useEffect above handles redirect
  }

  // Onboarding check
  const needsOnboarding = profile && (
    profile.onboarding_completed === false ||
    !profile.career ||
    !profile.vibe_category ||
    !profile.career_stage
  )

  if (needsOnboarding) {
    return (
      <ProfileSetupFlow
        session={{ user, profile }}
        supabase={supabase}
        onComplete={async () => {
          await refreshProfile()
        }}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FDF8F3' }}>
      <AppNavBar
        currentUser={profile}
        onNavigate={onNavigate}
      />
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {children}
      </div>
      <ToastContainer />
    </div>
  )
}

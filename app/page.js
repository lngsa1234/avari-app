'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import LandingPage from '@/components/LandingPage'
import ProfileSetup from '@/components/ProfileSetup'
import MainApp from '@/components/MainApp'

export default function Home() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [showProfileSetup, setShowProfileSetup] = useState(false)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        loadUserProfile(session.user.id)
      } else {
        setLoading(false)
        setCurrentUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) {
      setCurrentUser(data)
      setShowProfileSetup(false)
    } else {
      setShowProfileSetup(true)
    }
    setLoading(false)
  }

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`
      }
    })

    if (error) {
      alert('Error signing in: ' + error.message)
    }
  }

 // In app/page.js, update the handleEmailSignUp function: 
 const handleEmailSignUp = async (email, password) => {
   const { data, error } = await supabase.auth.signUp({
     email,
     password,
     options: {
       emailRedirectTo: `${window.location.origin}` // Redirect after email verification
     }
   })
 
   if (error) {
     alert('Error signing up: ' + error.message)
   } else {
     // Check if email confirmation is required
     if (data?.user?.identities?.length === 0) {
       alert('This email is already registered. Please log in instead.')
     } else if (data?.session) {
       // Session exists = no email confirmation required (instant login)
       // User will automatically be redirected via onAuthStateChange
       alert('Account created! Setting up your profile...')
     } else {
       // Email confirmation required
       alert('Check your email for verification link! After clicking it, you will be redirected to complete your profile.')
     }
   }
 }

  const handleEmailSignIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert('Error signing in: ' + error.message)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setCurrentUser(null)
    setSession(null)
  }

  const saveProfile = async (profileData) => {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        email: session.user.email,
        ...profileData,
        role: 'user',
        meetups_attended: 0
      })
      .select()
      .single()

    if (error) {
      alert('Error saving profile: ' + error.message)
    } else {
      setCurrentUser(data)
      setShowProfileSetup(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-100 via-pink-50 to-purple-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <LandingPage
        onGoogleSignIn={handleGoogleSignIn}
        onEmailSignUp={handleEmailSignUp}
        onEmailSignIn={handleEmailSignIn}
      />
    )
  }

  if (showProfileSetup) {
    return (
      <ProfileSetup
        session={session}
        onSave={saveProfile}
      />
    )
  }

  return (
    <MainApp
      currentUser={currentUser}
      onSignOut={handleSignOut}
      supabase={supabase}
    />
  )
}

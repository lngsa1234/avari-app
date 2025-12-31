'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  
  // Prevent duplicate profile loads
  const loadingProfileRef = useRef(false)
  const lastLoadedUserIdRef = useRef(null)

  // Load user profile - MEMOIZED and GUARDED
  const loadUserProfile = useCallback(async (userId) => {
    // Guard: Don't reload if already loading this user
    if (loadingProfileRef.current && lastLoadedUserIdRef.current === userId) {
      console.log('⏭️ AuthProvider: Already loading profile for', userId)
      return
    }

    console.log('🔄 AuthProvider: Loading profile for', userId)
    loadingProfileRef.current = true
    lastLoadedUserIdRef.current = userId
    setProfileLoading(true)
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('❌ AuthProvider: Error loading profile:', error)
      setProfile(null)
    } else {
      console.log('✅ AuthProvider: Profile loaded')
      setProfile(data)
    }
    
    setProfileLoading(false)
    loadingProfileRef.current = false
  }, [])

  // Set up auth listener - runs ONCE
  useEffect(() => {
    console.log('🔐 AuthProvider: Setting up auth listener')

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔐 AuthProvider: Initial session:', session?.user?.id || 'none')
      setUser(session?.user ?? null)
      
      if (session?.user) {
        loadUserProfile(session.user.id).finally(() => {
          setAuthLoading(false) // Set after profile loads
        })
      } else {
        setAuthLoading(false) // No user, done loading
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 AuthProvider: Auth event:', event)
      
      // Ignore duplicate INITIAL_SESSION events
      if (event === 'INITIAL_SESSION') {
        console.log('⏭️ AuthProvider: Ignoring INITIAL_SESSION duplicate')
        return
      }
      
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await loadUserProfile(session.user.id)
      } else {
        setProfile(null)
        setProfileLoading(false)
        lastLoadedUserIdRef.current = null
      }
      
      setAuthLoading(false)
    })

    return () => {
      console.log('🧹 AuthProvider: Cleaning up auth listener')
      subscription.unsubscribe()
    }
  }, [loadUserProfile])

  // MEMOIZED sign out
  const signOut = useCallback(async () => {
    console.log('👋 AuthProvider: Signing out')
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  // MEMOIZED save profile
  const saveProfile = useCallback(async (profileData) => {
    if (!user) return

    console.log('💾 AuthProvider: Saving profile')
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        ...profileData,
        role: 'user',
        meetups_attended: 0,
        onboarding_complete: true  // Mark onboarding as complete
      })
      .select()
      .single()

    if (error) {
      console.error('❌ AuthProvider: Error saving profile:', error)
      throw error
    } else {
      console.log('✅ AuthProvider: Profile saved with onboarding complete')
      setProfile(data)
      return data
    }
  }, [user])

  const value = {
    user,
    profile,
    authLoading,
    profileLoading,
    signOut,
    saveProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

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
  const [initialized, setInitialized] = useState(false) // 🔥 NEW - Track if auth has initialized
  const [profileStatus, setProfileStatus] = useState('idle') // 🔥 NEW - 'idle' | 'loading' | 'ready' | 'missing'
  
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

    // Guard: Don't reload if profile already exists for this user
    if (profile && profile.id === userId && profileStatus === 'ready') {
      console.log('✅ AuthProvider: Profile already loaded for', userId)
      return
    }

    console.log('🔄 AuthProvider: Loading profile for', userId)
    loadingProfileRef.current = true
    lastLoadedUserIdRef.current = userId
    setProfileLoading(true)
    setProfileStatus('loading')
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // Check if error is "no rows found" (PGRST116)
        if (error.code === 'PGRST116') {
          console.log('⚠️ AuthProvider: No profile found - user needs to create one')
          setProfile(null)
          setProfileStatus('missing')
          return
        }
        
        console.error('❌ AuthProvider: Error loading profile:', error)
        setProfile(null)
        setProfileStatus('missing')
      } else {
        console.log('✅ AuthProvider: Profile loaded:', data)
        setProfile(data)
        setProfileStatus('ready')
      }
    } catch (error) {
      console.error('💥 AuthProvider: Unexpected error loading profile:', error)
      setProfile(null)
      setProfileStatus('missing')
    } finally {
      // CRITICAL: Always clear loading state
      setProfileLoading(false)
      loadingProfileRef.current = false
      console.log('🏁 AuthProvider: Profile loading complete, status:', profileStatus)
    }
  }, [profile, profileStatus, supabase])

  // Set up auth listener - runs ONCE
  useEffect(() => {
    console.log('🔐 AuthProvider: Setting up auth listener')

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📱 AuthProvider: Initial session:', session?.user?.id || 'none')
      setUser(session?.user ?? null)
      
      if (session?.user) {
        loadUserProfile(session.user.id).finally(() => {
          setAuthLoading(false)
          setInitialized(true) // 🔥 Mark as initialized
        })
      } else {
        setAuthLoading(false)
        setInitialized(true) // 🔥 Mark as initialized
        setProfileStatus('idle')
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 AuthProvider: Auth event:', event)
      
      // 🔥 CRITICAL FIX: Ignore events that don't require action
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        console.log('⏭️ AuthProvider: Ignoring', event, '- no action needed')
        return
      }
      
      // Only handle real auth changes (SIGNED_IN, SIGNED_OUT, USER_UPDATED)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // Only load profile if not already initialized or on explicit sign-in
        if (!initialized || event === 'SIGNED_IN') {
          await loadUserProfile(session.user.id)
        }
      } else {
        setProfile(null)
        setProfileLoading(false)
        setProfileStatus('idle')
        lastLoadedUserIdRef.current = null
      }
      
      setAuthLoading(false)
      if (!initialized) {
        setInitialized(true)
      }
    })

    return () => {
      console.log('🧹 AuthProvider: Cleaning up auth listener')
      subscription.unsubscribe()
    }
  }, [loadUserProfile, initialized])

  // MEMOIZED sign out
  const signOut = useCallback(async () => {
    console.log('👋 AuthProvider: Signing out')
    
    // 🔥 Use 'global' scope to clear session from all tabs/windows (important for Safari)
    await supabase.auth.signOut({ scope: 'global' })
    
    // 🔥 Clear all local state
    setUser(null)
    setProfile(null)
    setProfileStatus('idle')
    
    // 🔥 Optional: Clear storage to ensure clean slate on Safari
    // Uncomment if you want to clear all app data on sign out
    // localStorage.clear()
    // sessionStorage.clear()
  }, [supabase])

  // MEMOIZED save profile
  const saveProfile = useCallback(async (profileData) => {
    if (!user) return

    console.log('💾 AuthProvider: Saving profile')
    
    try {
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
      }
      
      console.log('✅ AuthProvider: Profile saved with onboarding complete')
      setProfile(data)
      setProfileStatus('ready') // 🔥 Mark profile as ready
      return data
    } catch (error) {
      console.error('💥 AuthProvider: Unexpected error saving profile:', error)
      throw error
    }
  }, [user, supabase])

  const value = {
    user,
    profile,
    authLoading,
    profileLoading,
    initialized,
    profileStatus,
    signOut,
    saveProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

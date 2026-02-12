'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState('initializing')
  
  const loadingUserIdRef = useRef(null)
  const mountedRef = useRef(true)

  // Stable profile loader with auto-creation
  const loadProfileRef = useRef(null)

  loadProfileRef.current = async (userId, userEmail = null, userName = null, force = false) => {
    if (loadingUserIdRef.current === userId) {
      console.log('⏭️ Profile already loading for', userId)
      return
    }

    if (!force && profile?.id === userId && status === 'ready') {
      console.log('✅ Profile already loaded for', userId)
      return
    }

    console.log('🔄 Loading profile for', userId)
    loadingUserIdRef.current = userId
    setStatus('loading_profile')

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (!mountedRef.current) return

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist - create it automatically
          console.log('📝 Profile not found, creating...')
          
          // Extract first name from email or use default
          const defaultName = userEmail 
            ? userEmail.split('@')[0].split('.')[0] 
            : 'User'
          
          const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: userEmail || user?.email,
              name: userName || defaultName, // ← Add name field!
              timezone: detectedTz,
            })
            .select()
            .single()

          if (createError) {
            console.error('❌ Profile creation error:', createError)
            // If auto-creation fails, show profile setup screen
            setStatus('profile_missing')
            setProfile(null)
          } else {
            console.log('✅ Profile created:', newProfile.email)
            setProfile(newProfile)
            setStatus('ready')
          }
        } else {
          console.error('❌ Profile error:', error.code)
          setStatus('signed_out')
          setProfile(null)
        }
      } else if (data) {
        console.log('✅ Profile loaded:', data.name || data.email)
        // Auto-detect timezone if not yet set
        if (!data.timezone) {
          const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          await supabase.from('profiles').update({ timezone: detectedTz }).eq('id', userId);
          data.timezone = detectedTz;
        }
        setProfile(data)
        setStatus('ready')
      }
    } catch (err) {
      if (!mountedRef.current) return
      console.error('❌ Exception:', err.message)
      setStatus('signed_out')
      setProfile(null)
    } finally {
      loadingUserIdRef.current = null
    }
  }

  // ============================================================
  // AUTH ACTIONS
  // ============================================================

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            prompt: 'select_account'
          }
        }
      })
      if (error) throw error
    } catch (error) {
      console.error('Google sign in error:', error)
      throw error
    }
  }, [])

  const signInWithEmail = useCallback(async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      console.log('✅ Email login successful')
    } catch (error) {
      console.error('Email login error:', error)
      throw error
    }
  }, [])

  const signUpWithEmail = useCallback(async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}`,
          data: {
            prompt: 'consent'
          }
        }
      })
      
      if (error) throw error
      
      if (data?.user?.identities?.length === 0) {
        throw new Error('This email is already registered. Please log in instead.')
      } else if (data?.session) {
        // Immediate sign in - profile will be created by auth listener
        console.log('✅ Account created with session')
        return { needsVerification: false }
      } else if (data?.user && !data?.session) {
        console.log('✅ Signup successful - verification email sent')
        return { needsVerification: true, email: data.user.email }
      }
    } catch (error) {
      console.error('Signup error:', error)
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    console.log('🚪 Signing out...')
    
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('❌ Sign out error:', error)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      console.log('🔄 Refreshing profile - forcing reload')
      loadingUserIdRef.current = null
      setStatus('loading_profile')
      await loadProfileRef.current(user.id, user.email, user.user_metadata?.name, true)
    }
  }, [user?.id, user?.email, user?.user_metadata?.name])

  // Auth listener
  useEffect(() => {
    console.log('🔐 Setting up auth listener')
    mountedRef.current = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log('📱 Initial session found:', session.user.id)
        setUser(session.user)
        loadProfileRef.current(
          session.user.id, 
          session.user.email,
          session.user.user_metadata?.name || session.user.user_metadata?.full_name
        )
      } else {
        console.log('📱 No initial session')
        setStatus('signed_out')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth event:', event)

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          loadProfileRef.current(
            session.user.id, 
            session.user.email,
            session.user.user_metadata?.name || session.user.user_metadata?.full_name
          )
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 Signed out - updating state')
          setUser(null)
          setProfile(null)
          setStatus('signed_out')
          loadingUserIdRef.current = null
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        } else if (event === 'INITIAL_SESSION') {
          console.log('⏭️ Ignoring INITIAL_SESSION - already handled by getSession()')
        }
      }
    )

    return () => {
      console.log('🧹 Cleaning up auth listener')
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  const contextValue = useMemo(
    () => ({
      user,
      profile,
      status,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshProfile,
    }),
    [user, profile, status, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, refreshProfile]
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

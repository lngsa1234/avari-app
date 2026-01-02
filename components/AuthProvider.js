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

  // Stable profile loader
  const loadProfileRef = useRef(null)
  
  loadProfileRef.current = async (userId) => {
    if (loadingUserIdRef.current === userId) {
      console.log('⏭️ Profile already loading for', userId)
      return
    }

    if (profile?.id === userId && status === 'ready') {
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
        console.error('❌ Profile error:', error.code)
        setStatus(error.code === 'PGRST116' ? 'profile_missing' : 'signed_out')
        setProfile(null)
      } else if (data) {
        console.log('✅ Profile loaded:', data.name || data.id)
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
        console.log('✅ Account created with session')
        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email,
            })
          
          if (profileError) {
            console.error('Profile creation error:', profileError)
          }
        }
      } else {
        throw new Error('Check your email for verification link!')
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
      // Don't use window.location.replace - let auth state handle it
      // The SIGNED_OUT event will update the state automatically
    } catch (error) {
      console.error('❌ Sign out error:', error)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      console.log('🔄 Refreshing profile')
      loadingUserIdRef.current = null
      await loadProfileRef.current(user.id)
    }
  }, [user?.id])

  // Auth listener
  useEffect(() => {
    console.log('🔐 Setting up auth listener')
    mountedRef.current = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log('📱 Initial session found:', session.user.id)
        setUser(session.user)
        loadProfileRef.current(session.user.id)
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
          loadProfileRef.current(session.user.id)
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

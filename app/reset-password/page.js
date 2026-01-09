'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hasSession, setHasSession] = useState(null) // null = checking, true = valid, false = invalid
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    // Handle the password recovery session
    const handlePasswordRecovery = async () => {
      try {
        // Check if we have an access_token in the URL (from email link)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        if (type === 'recovery' && accessToken) {
          console.log('🔑 Recovery tokens found in URL')
          
          // Set the session using the tokens from URL
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (error) {
            console.error('❌ Error setting session:', error)
            setHasSession(false)
            setMessage({
              type: 'error',
              text: 'Invalid or expired password reset link. Please request a new one.'
            })
          } else {
            console.log('✅ Session established successfully')
            setHasSession(true)
          }
        } else {
          console.log('🔍 No recovery token in URL, checking existing session')
          
          // No recovery token in URL, check if we already have a session
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session) {
            console.log('✅ Existing session found')
            setHasSession(true)
          } else {
            console.log('❌ No session found')
            setHasSession(false)
            setMessage({
              type: 'error',
              text: 'Invalid or expired password reset link. Please request a new one.'
            })
          }
        }
      } catch (error) {
        console.error('❌ Error in handlePasswordRecovery:', error)
        setHasSession(false)
        setMessage({
          type: 'error',
          text: 'An error occurred. Please try again.'
        })
      } finally {
        setIsInitializing(false)
      }
    }

    handlePasswordRecovery()
  }, [])

  const handleResetPassword = async () => {
    setMessage(null)

    // Validation
    if (!newPassword) {
      setMessage({ type: 'error', text: 'Please enter a new password' })
      return
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    setLoading(true)

    try {
      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setMessage({
        type: 'success',
        text: 'Password updated successfully! Please log in with your new password...'
      })

      // Sign out the user after successful password reset
      await supabase.auth.signOut()

      // Redirect to landing page after 2 seconds
      setTimeout(() => {
        router.push('/')
      }, 2000)

    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-100 via-pink-50 to-purple-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Reset Your Password</h2>
            <div className="mt-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4" />
              <p className="text-gray-600">Verifying reset link...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-100 via-pink-50 to-purple-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="mb-6">
          <div className="text-4xl mb-4 text-center">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Reset Your Password</h2>
          <p className="text-gray-600 text-center">Enter your new password below</p>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.type === 'error' 
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {message.text}
          </div>
        )}

        {hasSession ? (
          <div className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New Password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 pr-12"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={loading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !loading && handleResetPassword()}
                className="w-full border border-gray-300 rounded-lg p-3 pr-12"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={loading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Reset Password'}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Please request a new password reset link from the login page.
            </p>
          </div>
        )}

        <button
          onClick={() => router.push('/')}
          className="w-full text-gray-600 hover:text-gray-800 text-sm mt-4"
          disabled={loading}
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}

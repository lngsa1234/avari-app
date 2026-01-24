'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function LandingPage({ onGoogleSignIn, onEmailSignUp, onEmailSignIn }) {
  const [showLogin, setShowLogin] = useState(false)
  const [showEmailSignup, setShowEmailSignup] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState(null)

  const handleEmailSignUp = async () => {
    setMessage(null)
    try {
      const result = await onEmailSignUp(email, password)
      
      if (result?.needsVerification) {
        setMessage({
          type: 'success',
          text: `Check your email! We sent a verification link to ${result.email || email}.`
        })
        setEmail('')
        setPassword('')
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message
      })
    }
  }

  const handleEmailSignIn = async () => {
    setMessage(null)
    try {
      await onEmailSignIn(email, password)
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message
      })
    }
  }

  const handleGoogleSignIn = async () => {
    setMessage(null)
    try {
      await onGoogleSignIn()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message
      })
    }
  }

  const handleForgotPassword = async () => {
    setMessage(null)
    if (!email) {
      setMessage({
        type: 'error',
        text: 'Please enter your email address'
      })
      return
    }

    try {
      const { error } = await import('@/lib/supabase').then(mod => 
        mod.supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        })
      )
      
      if (error) throw error
      
      setMessage({
        type: 'success',
        text: `Password reset link sent to ${email}. Check your inbox!`
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message
      })
    }
  }

  // Forgot Password Screen
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Reset Password</h2>
            <p className="text-gray-600">Enter your email to receive a password reset link</p>
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

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3"
            />
            <button
              onClick={handleForgotPassword}
              className="w-full bg-stone-600 hover:bg-stone-700 text-white font-medium py-3 rounded-lg"
            >
              Send Reset Link
            </button>
            <button
              onClick={() => {
                setShowForgotPassword(false)
                setShowLogin(true)
                setMessage(null)
              }}
              className="w-full text-gray-600 hover:text-gray-800 text-sm"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Login Screen
  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Log in to your CircleW account</p>
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

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleEmailSignIn()}
                className="w-full border border-gray-300 rounded-lg p-3 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button
              onClick={handleEmailSignIn}
              className="w-full bg-stone-600 hover:bg-stone-700 text-white font-medium py-3 rounded-lg"
            >
              Log In
            </button>
            <button
              onClick={() => {
                setShowForgotPassword(true)
                setShowLogin(false)
                setMessage(null)
              }}
              className="w-full text-stone-600 hover:text-stone-700 text-sm"
            >
              Forgot password?
            </button>
            <button
              onClick={() => {
                setShowLogin(false)
                setMessage(null)
              }}
              className="w-full text-gray-600 hover:text-gray-800 text-sm"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Signup Screen
  if (showEmailSignup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign Up with Email</h2>
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

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleEmailSignUp()}
                className="w-full border border-gray-300 rounded-lg p-3 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button
              onClick={handleEmailSignUp}
              className="w-full bg-stone-600 hover:bg-stone-700 text-white font-medium py-3 rounded-lg"
            >
              Sign Up
            </button>
            <button
              onClick={() => {
                setShowEmailSignup(false)
                setMessage(null)
              }}
              className="w-full text-gray-600 hover:text-gray-800 text-sm"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main Landing Page
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          {/* CircleW Logo */}
          <div className="flex justify-center mb-4">
            <svg width="80" height="80" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#78716c" strokeWidth="4" strokeDasharray="220 60"/>
              <text x="50" y="62" textAnchor="middle" fontFamily="Georgia, serif" fontSize="40" fontWeight="bold" fill="#78716c">W</text>
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-stone-700 mb-2">CircleW</h1>
          <p className="text-stone-600">Connect and grow through coffee</p>
          <p className="text-xs text-stone-400 mt-1">Women's Networking Community</p>
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

        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            className="w-full bg-white border-2 border-gray-300 hover:border-rose-400 text-gray-700 font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <button
            onClick={() => setShowEmailSignup(true)}
            className="w-full bg-stone-600 hover:bg-stone-700 text-white font-medium py-3 rounded-lg"
          >
            Sign up with Email
          </button>

          <div className="text-center">
            <button
              onClick={() => setShowLogin(true)}
              className="text-stone-600 hover:text-stone-700 font-medium text-sm"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-stone-500 mb-4">Join a community of women building meaningful connections</p>
        </div>
      </div>
    </div>
  )
}

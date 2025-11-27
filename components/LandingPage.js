'use client'

import { useState } from 'react'

export default function LandingPage({ onGoogleSignIn, onEmailSignUp, onEmailSignIn }) {
  const [showLogin, setShowLogin] = useState(false)
  const [showEmailSignup, setShowEmailSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-100 via-pink-50 to-purple-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Log in to your Avari account</p>
          </div>
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3"
            />
            <button
              onClick={() => onEmailSignIn(email, password)}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-3 rounded-lg"
            >
              Log In
            </button>
            <button
              onClick={() => setShowLogin(false)}
              className="w-full text-gray-600 hover:text-gray-800 text-sm"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showEmailSignup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-100 via-pink-50 to-purple-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign Up with Email</h2>
          </div>
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3"
            />
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3"
            />
            <button
              onClick={() => onEmailSignUp(email, password)}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-3 rounded-lg"
            >
              Sign Up
            </button>
            <button
              onClick={() => setShowEmailSignup(false)}
              className="w-full text-gray-600 hover:text-gray-800 text-sm"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-100 via-pink-50 to-purple-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">☕</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Avari</h1>
          <p className="text-gray-600">Connect & Grow Through Coffee</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={onGoogleSignIn}
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
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-3 rounded-lg"
          >
            Sign up with Email
          </button>

          <div className="text-center">
            <button
              onClick={() => setShowLogin(true)}
              className="text-rose-500 hover:text-rose-600 font-medium text-sm"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 mb-4">Join a community of women building meaningful connections</p>
        </div>
      </div>
    </div>
  )
}

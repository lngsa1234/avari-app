'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const colors = {
  primary: '#8B6F5C',
  primaryDark: '#6B5344',
  cream: '#FDF8F3',
  warmWhite: '#FFFAF5',
  text: '#3F1906',
  textLight: '#584233',
  textMuted: 'rgba(107, 86, 71, 0.77)',
  textSoft: '#A89080',
  border: 'rgba(139, 111, 92, 0.15)',
  borderMedium: 'rgba(139, 111, 92, 0.25)',
  selectedBg: 'rgba(139, 111, 92, 0.08)',
  success: '#4CAF50',
  error: '#C0392B',
  errorBg: 'rgba(192, 57, 43, 0.06)',
  errorBorder: 'rgba(192, 57, 43, 0.15)',
  successBg: 'rgba(76, 175, 80, 0.06)',
  successBorder: 'rgba(76, 175, 80, 0.15)',
  gradient: 'linear-gradient(219.16deg, rgba(247, 242, 236, 0.96) 39.76%, rgba(240, 225, 213, 0.980157) 67.53%, rgba(236, 217, 202, 0.990231) 82.33%)',
}

const fonts = {
  serif: '"Lora", Georgia, serif',
  sans: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
  })

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth })
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return windowSize
}

export default function LandingPage({ onGoogleSignIn, onEmailSignUp, onEmailSignIn }) {
  const { width: windowWidth } = useWindowSize()
  const isMobile = windowWidth < 640

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

  // Shared styles
  const pageStyle = {
    minHeight: '100vh',
    background: colors.cream,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? 16 : 24,
  }

  const cardStyle = {
    maxWidth: 420,
    width: '100%',
    background: colors.cream,
    borderRadius: 24,
    boxShadow: 'none',
    padding: isMobile ? '28px 24px' : '36px 32px',
  }

  const inputStyle = {
    width: '100%',
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: '13px 16px',
    fontSize: 15,
    fontFamily: fonts.sans,
    color: colors.text,
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  const primaryButtonStyle = {
    width: '100%',
    background: colors.primary,
    color: '#fff',
    fontWeight: 600,
    fontFamily: fonts.sans,
    fontSize: 15,
    padding: '13px 0',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.2s',
  }

  const secondaryButtonStyle = {
    width: '100%',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    padding: '8px 0',
    transition: 'color 0.2s',
  }

  const renderMessage = () => {
    if (!message) return null
    const isError = message.type === 'error'
    return (
      <div style={{
        marginBottom: 16,
        padding: 12,
        borderRadius: 12,
        background: isError ? colors.errorBg : colors.successBg,
        border: `1px solid ${isError ? colors.errorBorder : colors.successBorder}`,
        color: isError ? colors.error : colors.success,
        fontSize: 14,
        fontFamily: fonts.sans,
        lineHeight: 1.5,
      }}>
        {message.text}
      </div>
    )
  }

  const renderPasswordInput = (onEnter) => (
    <div style={{ position: 'relative' }}>
      <input
        type={showPassword ? 'text' : 'password'}
        placeholder={showEmailSignup ? 'Password (min 6 characters)' : 'Password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && onEnter()}
        style={{ ...inputStyle, paddingRight: 48 }}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: colors.textSoft,
          display: 'flex',
          padding: 4,
        }}
      >
        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  )

  // Forgot Password Screen
  if (showForgotPassword) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: fonts.serif,
              color: colors.text,
              margin: '0 0 8px',
            }}>
              Reset Password
            </h2>
            <p style={{ color: colors.textLight, fontFamily: fonts.sans, fontSize: 15, margin: 0 }}>
              Enter your email to receive a password reset link
            </p>
          </div>

          {renderMessage()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <button onClick={handleForgotPassword} style={primaryButtonStyle}>
              Send Reset Link
            </button>
            <button
              onClick={() => {
                setShowForgotPassword(false)
                setShowLogin(true)
                setMessage(null)
              }}
              style={secondaryButtonStyle}
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
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: fonts.serif,
              color: colors.text,
              margin: '0 0 8px',
            }}>
              Welcome Back
            </h2>
            <p style={{ color: colors.textLight, fontFamily: fonts.sans, fontSize: 15, margin: 0 }}>
              Log in to your account
            </p>
          </div>

          {renderMessage()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            {renderPasswordInput(handleEmailSignIn)}
            <button onClick={handleEmailSignIn} style={primaryButtonStyle}>
              Log In
            </button>
            <button
              onClick={() => {
                setShowForgotPassword(true)
                setShowLogin(false)
                setMessage(null)
              }}
              style={{ ...secondaryButtonStyle, color: colors.primary, fontWeight: 500 }}
            >
              Forgot password?
            </button>
            <button
              onClick={() => {
                setShowLogin(false)
                setMessage(null)
              }}
              style={secondaryButtonStyle}
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
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: fonts.serif,
              color: colors.text,
              margin: '0 0 8px',
            }}>
              Create Account
            </h2>
            <p style={{ color: colors.textLight, fontFamily: fonts.sans, fontSize: 15, margin: 0 }}>
              Sign up with your email
            </p>
          </div>

          {renderMessage()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            {renderPasswordInput(handleEmailSignUp)}
            <button onClick={handleEmailSignUp} style={primaryButtonStyle}>
              Sign Up
            </button>
            <button
              onClick={() => {
                setShowEmailSignup(false)
                setMessage(null)
              }}
              style={secondaryButtonStyle}
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
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="72" height="72" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke={colors.primary} strokeWidth="4" strokeDasharray="220 60"/>
              <text x="50" y="62" textAnchor="middle" fontFamily="Georgia, serif" fontSize="40" fontWeight="bold" fill={colors.primary}>W</text>
            </svg>
          </div>
          <h1 style={{
            fontSize: 36,
            fontWeight: 700,
            fontFamily: fonts.serif,
            color: colors.text,
            margin: '0 0 8px',
          }}>
            CircleW
          </h1>
          <p style={{
            color: colors.textLight,
            fontFamily: fonts.sans,
            fontSize: 16,
            margin: '0 0 4px',
          }}>
            Connect and grow through coffee
          </p>
          <p style={{
            color: colors.textSoft,
            fontFamily: fonts.sans,
            fontSize: 12,
            margin: 0,
          }}>
            Women's Networking Community
          </p>
        </div>

        {renderMessage()}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Google button */}
          <button
            onClick={handleGoogleSignIn}
            style={{
              width: '100%',
              background: '#fff',
              border: `2px solid ${colors.border}`,
              borderRadius: 12,
              padding: '13px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              fontFamily: fonts.sans,
              fontWeight: 500,
              fontSize: 15,
              color: colors.text,
              transition: 'border-color 0.2s',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: colors.border }} />
            <span style={{ fontSize: 13, color: colors.textSoft, fontFamily: fonts.sans }}>or</span>
            <div style={{ flex: 1, height: 1, background: colors.border }} />
          </div>

          <button onClick={() => setShowEmailSignup(true)} style={primaryButtonStyle}>
            Sign up with Email
          </button>

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => setShowLogin(true)}
              style={{ ...secondaryButtonStyle, color: colors.primary, fontWeight: 500 }}
            >
              Already have an account? Log in
            </button>
          </div>
        </div>

        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: colors.textMuted, fontFamily: fonts.sans, margin: 0 }}>
            Join a community of women building meaningful connections
          </p>
        </div>
      </div>
    </div>
  )
}

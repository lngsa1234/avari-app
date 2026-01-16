'use client'

import { useState, useEffect } from 'react'

export default function ProfileSetup({ session, onSave }) {
  const [profile, setProfile] = useState({
    name: '',
    career: '',
    city: '',
    state: '',
    bio: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  // Pre-fill name from existing profile
  useEffect(() => {
    if (session?.profile?.name) {
      setProfile(prev => ({
        ...prev,
        name: session.profile.name
      }))
    }
  }, [session?.profile?.name])

  const handleSubmit = async () => {
    if (profile.name && profile.career && profile.city && profile.state) {
      setIsLoading(true)
      try {
        await onSave(profile)
      } catch (error) {
        console.error('Error saving profile:', error)
        alert('Failed to save profile. Please try again.')
      } finally {
        setIsLoading(false)
      }
    } else {
      alert('Please fill in all required fields')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-100 via-pink-50 to-purple-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Complete Your Profile</h2>
          <p className="text-gray-600">Tell us about yourself</p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Name *"
            value={profile.name}
            onChange={(e) => setProfile({...profile, name: e.target.value})}
            className="w-full border border-gray-300 rounded-lg p-3"
          />
          <input
            type="text"
            placeholder="Career *"
            value={profile.career}
            onChange={(e) => setProfile({...profile, career: e.target.value})}
            className="w-full border border-gray-300 rounded-lg p-3"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="City *"
              value={profile.city}
              onChange={(e) => setProfile({...profile, city: e.target.value})}
              className="w-full border border-gray-300 rounded-lg p-3"
            />
            <input
              type="text"
              placeholder="State *"
              value={profile.state}
              onChange={(e) => setProfile({...profile, state: e.target.value.toUpperCase()})}
              maxLength="2"
              className="w-full border border-gray-300 rounded-lg p-3 uppercase"
            />
          </div>
          <textarea
            placeholder="Bio (optional)"
            value={profile.bio}
            onChange={(e) => setProfile({...profile, bio: e.target.value})}
            className="w-full border border-gray-300 rounded-lg p-3 h-24 resize-none"
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              'Complete Profile'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

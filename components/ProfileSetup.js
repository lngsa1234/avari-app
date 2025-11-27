'use client'

import { useState } from 'react'

export default function ProfileSetup({ session, onSave }) {
  const [profile, setProfile] = useState({
    name: '',
    career: '',
    age: '',
    city: '',
    state: '',
    bio: ''
  })

  const handleSubmit = () => {
    if (profile.name && profile.career && profile.age && profile.city && profile.state) {
      onSave({
        ...profile,
        age: parseInt(profile.age)
      })
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
          <input
            type="number"
            placeholder="Age *"
            value={profile.age}
            onChange={(e) => setProfile({...profile, age: e.target.value})}
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
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-3 rounded-lg"
          >
            Complete Profile
          </button>
        </div>
      </div>
    </div>
  )
}

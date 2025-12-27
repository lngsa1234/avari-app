'use client'

import { useState, useEffect } from 'react'
import { Calendar, Coffee, Users, Star, MapPin, Clock, User, Heart, MessageCircle, Send, X, Video } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import VideoCallButton from './VideoCallButton'
import CoffeeChatsView from './CoffeeChatsView'

export default function MainApp({ currentUser, onSignOut, supabase }) {
  console.log('🔥 MainApp loaded - UPDATED VERSION with TIME ORDERING')
  
  const [currentView, setCurrentView] = useState('home')
  const [showChatModal, setShowChatModal] = useState(false)
  const [selectedChat, setSelectedChat] = useState(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showCreateMeetup, setShowCreateMeetup] = useState(false)
  const [showEditMeetup, setShowEditMeetup] = useState(false)
  const [editedProfile, setEditedProfile] = useState(null)
  const [newMeetup, setNewMeetup] = useState({ date: '', time: '', location: '' })
  const [selectedDate, setSelectedDate] = useState(null) // For DatePicker
  const [editingMeetup, setEditingMeetup] = useState(null)
  const [meetups, setMeetups] = useState([])
  const [loadingMeetups, setLoadingMeetups] = useState(true)
  const [signups, setSignups] = useState({}) // Store signups by meetup_id
  const [userSignups, setUserSignups] = useState([]) // Store current user's signups
  const [connections, setConnections] = useState([]) // Store user connections

  // Load meetups from Supabase on component mount
  useEffect(() => {
    loadMeetupsFromDatabase()
    loadUserSignups()
    loadConnections()
    updateAttendedCount()

    // Set up real-time subscription for meetups
    const meetupsSubscription = supabase
      .channel('meetups_changes')
      .on('postgres_changes', 
        { 
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'meetups'
        }, 
        (payload) => {
          console.log('Meetup changed:', payload)
          // Reload meetups when any change occurs
          loadMeetupsFromDatabase()
        }
      )
      .subscribe()

    // Set up real-time subscription for signups
    const signupsSubscription = supabase
      .channel('signups_changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public', 
          table: 'meetup_signups'
        }, 
        (payload) => {
          console.log('Signup changed:', payload)
          // Reload signups and user signups
          loadMeetupsFromDatabase()
          loadUserSignups()
        }
      )
      .subscribe()

    // Cleanup subscriptions on unmount
    return () => {
      meetupsSubscription.unsubscribe()
      signupsSubscription.unsubscribe()
    }
  }, [])

  const loadMeetupsFromDatabase = async () => {
    try {
      setLoadingMeetups(true)
      const { data, error } = await supabase
        .from('meetups')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      if (error) {
        console.error('Error loading meetups:', error)
      } else {
        setMeetups(data || [])
        // Load signups for all meetups
        await loadSignupsForMeetups(data || [])
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoadingMeetups(false)
    }
  }

  const loadSignupsForMeetups = async (meetupsList) => {
    try {
      console.log('Loading signups...')
      
      // Get all signups first
      const { data: signupsData, error: signupsError } = await supabase
        .from('meetup_signups')
        .select('*')

      console.log('Signups raw data:', signupsData)
      console.log('Signups error:', signupsError)

      if (signupsError) {
        console.error('Error loading signups:', signupsError)
        return
      }

      if (!signupsData || signupsData.length === 0) {
        console.log('No signups found')
        setSignups({})
        return
      }

      // Get user IDs from signups
      const userIds = [...new Set(signupsData.map(s => s.user_id))]
      
      // Get profiles for those users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      console.log('Profiles data:', profilesData)
      console.log('Profiles error:', profilesError)

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
      }

      // Create a map of user profiles
      const profilesMap = {}
      if (profilesData) {
        profilesData.forEach(profile => {
          profilesMap[profile.id] = profile
        })
      }

      // Combine signups with profiles and group by meetup_id
      const signupsByMeetup = {}
      signupsData.forEach(signup => {
        if (!signupsByMeetup[signup.meetup_id]) {
          signupsByMeetup[signup.meetup_id] = []
        }
        signupsByMeetup[signup.meetup_id].push({
          ...signup,
          profiles: profilesMap[signup.user_id] || null
        })
      })

      console.log('Signups by meetup:', signupsByMeetup)
      setSignups(signupsByMeetup)
    } catch (err) {
      console.error('Error loading signups:', err)
    }
  }

  const loadUserSignups = async () => {
    try {
      const { data, error } = await supabase
        .from('meetup_signups')
        .select('meetup_id')
        .eq('user_id', currentUser.id)

      if (error) {
        console.error('Error loading user signups:', error)
      } else {
        setUserSignups((data || []).map(s => s.meetup_id))
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const loadConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('connections')
        .select(`
          *,
          connected_user:profiles!connected_user_id(id, name, career, city, state)
        `)
        .eq('user_id', currentUser.id)

      if (error) {
        console.error('Error loading connections:', error)
      } else {
        setConnections(data || [])
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const updateAttendedCount = async () => {
    try {
      // Get user's signups with meetup dates
      const { data: signups, error } = await supabase
        .from('meetup_signups')
        .select(`
          meetup_id,
          meetups (date, time)
        `)
        .eq('user_id', currentUser.id)
      
      if (error || !signups) {
        console.log('No signups found or error:', error)
        return
      }
      
      console.log('Found signups:', signups)
      
      // Count how many meetups are in the past
      const now = new Date()
      const attendedCount = signups.filter(signup => {
        try {
          if (!signup.meetups) return false
          
          // Parse date - same logic as HomeView filter
          let dateStr = signup.meetups.date
          
          // Remove day of week if present
          dateStr = dateStr.replace(/^[A-Za-z]+,\s*/, '')
          
          // Add current year if not present
          if (!dateStr.includes('2024') && !dateStr.includes('2025')) {
            dateStr = `${dateStr}, ${new Date().getFullYear()}`
          }
          
          const meetupDate = new Date(dateStr)
          
          // Check if valid date and in the past
          if (isNaN(meetupDate.getTime())) {
            console.log('Invalid date:', signup.meetups.date)
            return false
          }
          
          const isPast = meetupDate < now
          console.log(`Meetup ${signup.meetups.date}: ${isPast ? 'PAST' : 'FUTURE'}`)
          
          return isPast
        } catch (err) {
          console.error('Error parsing date:', err)
          return false
        }
      }).length
      
      console.log(`Attended count: ${attendedCount}, Current: ${currentUser.meetups_attended}`)
      
      // Update profile if count changed
      if (attendedCount !== currentUser.meetups_attended) {
        console.log(`Updating meetups_attended from ${currentUser.meetups_attended} to ${attendedCount}`)
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ meetups_attended: attendedCount })
          .eq('id', currentUser.id)
        
        if (!updateError) {
          // Update local state
          currentUser.meetups_attended = attendedCount
          console.log(`✅ Updated meetups_attended to ${attendedCount}`)
          // Force re-render
          window.location.reload()
        } else {
          console.error('Error updating profile:', updateError)
        }
      } else {
        console.log('✅ Attended count already correct')
      }
    } catch (err) {
      console.error('Error updating attended count:', err)
    }
  }

  // Helper function to format time from 24hr to 12hr
  const formatTime = (time24) => {
    if (!time24) return ''
    try {
      const [hours, minutes] = time24.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const hour12 = hour % 12 || 12
      return `${hour12}:${minutes} ${ampm}`
    } catch {
      return time24 // Return original if parsing fails
    }
  }

  // Helper function to format date from ISO to friendly display
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      // Handle both ISO format (2024-12-28) and old format (Wednesday, Dec 3)
      let date
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // ISO format - parse as local timezone to avoid UTC issues
        const [year, month, day] = dateStr.split('-').map(Number)
        date = new Date(year, month - 1, day) // month is 0-indexed
      } else {
        // Old format - clean and parse
        const cleanDateStr = dateStr
          .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '')
          .trim()
        date = new Date(`${cleanDateStr} ${new Date().getFullYear()}`)
      }
      
      if (isNaN(date.getTime())) return dateStr // Return original if can't parse
      
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  // Safety check - if currentUser is not loaded yet, show loading
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  // Demo data - will be replaced with Supabase data later
  const upcomingMeetups = meetups

  const chats = [
    {
      id: 1,
      name: 'Jessica Lee',
      lastMessage: 'How about next Tuesday at 3pm?',
      timestamp: '10 min ago',
      unread: 2
    }
  ]

  const unreadCount = chats.reduce((sum, chat) => sum + chat.unread, 0)

  const handleSignUp = async (meetupId) => {
    try {
      const { error } = await supabase
        .from('meetup_signups')
        .insert([
          {
            meetup_id: meetupId,
            user_id: currentUser.id
          }
        ])

      if (error) {
        if (error.code === '23505') { // Unique violation
          alert('You have already signed up for this meetup!')
        } else {
          alert('Error signing up: ' + error.message)
        }
      } else {
        await loadUserSignups()
        await loadMeetupsFromDatabase()
        alert('Successfully signed up for meetup!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleCancelSignup = async (meetupId) => {
    if (!confirm('Are you sure you want to cancel your signup?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('meetup_signups')
        .delete()
        .eq('meetup_id', meetupId)
        .eq('user_id', currentUser.id)

      if (error) {
        alert('Error canceling signup: ' + error.message)
      } else {
        await loadUserSignups()
        await loadMeetupsFromDatabase()
        alert('Signup canceled successfully!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleCreateMeetup = async () => {
    if (!newMeetup.date || !newMeetup.time) {
      alert('Please fill in date and time')
      return
    }

    try {
      const { data, error } = await supabase
        .from('meetups')
        .insert([
          {
            date: newMeetup.date,
            time: newMeetup.time,
            location: newMeetup.location || null,
            created_by: currentUser.id
          }
        ])
        .select()

      if (error) {
        alert('Error creating meetup: ' + error.message)
      } else {
        // Real-time subscription will automatically reload meetups
        setNewMeetup({ date: '', time: '', location: '' })
        setSelectedDate(null)
        setShowCreateMeetup(false)
        alert('Meetup created successfully!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleEditMeetup = (meetup) => {
    setEditingMeetup({ ...meetup })
    setShowEditMeetup(true)
  }

  const handleUpdateMeetup = async () => {
    if (!editingMeetup.date || !editingMeetup.time) {
      alert('Please fill in date and time')
      return
    }

    try {
      const { error } = await supabase
        .from('meetups')
        .update({
          date: editingMeetup.date,
          time: editingMeetup.time,
          location: editingMeetup.location || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMeetup.id)

      if (error) {
        alert('Error updating meetup: ' + error.message)
      } else {
        // Real-time subscription will automatically reload meetups
        setShowEditMeetup(false)
        setEditingMeetup(null)
        alert('Meetup updated successfully!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleDeleteMeetup = async (meetupId) => {
    if (!confirm('Are you sure you want to delete this meetup?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('meetups')
        .delete()
        .eq('id', meetupId)

      if (error) {
        alert('Error deleting meetup: ' + error.message)
      } else {
        // Real-time subscription will automatically reload meetups
        alert('Meetup deleted successfully!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleSetLocation = async (meetupId, location) => {
    if (!location.trim()) {
      alert('Please enter a location')
      return
    }

    try {
      const { error } = await supabase
        .from('meetups')
        .update({
          location: location,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetupId)

      if (error) {
        alert('Error setting location: ' + error.message)
      } else {
        // Real-time subscription will automatically reload meetups
        alert('Location set successfully!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleSaveProfile = async () => {
    if (!editedProfile.name || !editedProfile.career || !editedProfile.age || !editedProfile.city || !editedProfile.state) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editedProfile.name,
          career: editedProfile.career,
          age: parseInt(editedProfile.age),
          city: editedProfile.city,
          state: editedProfile.state.toUpperCase(),
          bio: editedProfile.bio
        })
        .eq('id', currentUser.id)

      if (error) {
        alert('Error updating profile: ' + error.message)
      } else {
        // Update local state
        Object.assign(currentUser, editedProfile)
        setShowEditProfile(false)
        alert('Profile updated successfully!')
        window.location.reload() // Reload to fetch updated data
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const openEditProfile = () => {
    setEditedProfile({ ...currentUser })
    setShowEditProfile(true)
  }

  const ProgressBar = ({ current, total }) => {
    const percentage = (current / total) * 100
    return (
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div 
          className="bg-rose-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    )
  }

  const HomeView = () => {
    // Filter to only show UPCOMING meetups (not past ones)
    const now = new Date()
    const upcomingMeetups = meetups.filter(meetup => {
      try {
        let meetupDate
        const dateStr = meetup.date
        
        // Check if ISO format (YYYY-MM-DD)
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // ISO format - parse as local timezone to avoid UTC issues
          const [year, month, day] = dateStr.split('-').map(Number)
          meetupDate = new Date(year, month - 1, day) // month is 0-indexed
        } else {
          // Old format like "Wednesday, Dec 3" - remove day name
          const cleanDateStr = dateStr.replace(/^[A-Za-z]+,\s*/, '')
          meetupDate = new Date(`${cleanDateStr} ${new Date().getFullYear()}`)
        }
        
        // If can't parse, show it
        if (isNaN(meetupDate.getTime())) {
          console.log('Could not parse date:', meetup.date)
          return true
        }
        
        // Add time to the meetup date for accurate comparison
        if (meetup.time) {
          const [hours, minutes] = meetup.time.split(':').map(Number)
          meetupDate.setHours(hours, minutes, 0, 0)
        }
        
        // Compare full datetime (date + time)
        const isUpcoming = meetupDate > now
        
        if (!isUpcoming) {
          console.log(`Filtering out past meetup: ${meetup.date} at ${meetup.time}`)
        } else {
          console.log(`Showing upcoming meetup: ${meetup.date} at ${meetup.time}`)
        }
        
        return isUpcoming
        
      } catch (err) {
        console.error('Error parsing date:', meetup.date, err)
        return true
      }
    })

    return (
      <div className="space-y-6">
        {/* Progress Card */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg p-6 border border-rose-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Your Journey</h3>
              <p className="text-sm text-gray-600">Complete 5 meetups to unlock 1-on-1 chats</p>
            </div>
            <div className="text-3xl font-bold text-rose-500">{currentUser.meetups_attended}/5</div>
          </div>
          <ProgressBar current={currentUser.meetups_attended} total={5} />
          {currentUser.meetups_attended >= 5 && (
            <div className="mt-4 flex items-center text-green-600">
              <Star className="w-5 h-5 mr-2 fill-current" />
              <span className="font-medium">Unlocked! You can now schedule 1-on-1 coffee chats</span>
            </div>
          )}
        </div>

        {/* Upcoming Meetups */}
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4">Upcoming Meetups</h3>
          {loadingMeetups ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading meetups...</p>
            </div>
          ) : upcomingMeetups.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No upcoming meetups</p>
              <p className="text-sm text-gray-500 mt-2">
                {currentUser.meetups_attended > 0 
                  ? `You've attended ${currentUser.meetups_attended} meetup${currentUser.meetups_attended > 1 ? 's' : ''}! Check back for new events.`
                  : 'Check back soon for new events!'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMeetups.map(meetup => (
                <div key={meetup.id} className="bg-white rounded-lg shadow p-5 border border-gray-200">
                  <div className="mb-4">
                    <div className="flex items-center text-gray-800 font-semibold mb-1">
                      <Calendar className="w-5 h-5 mr-2 text-rose-500" />
                      {formatDate(meetup.date)}
                    </div>
                    <div className="flex items-center text-gray-600 text-sm ml-7">
                      <Clock className="w-4 h-4 mr-2" />
                      {formatTime(meetup.time)}
                    </div>
                    <div className="text-xs text-gray-500 ml-7 mt-1">
                      Location near {currentUser.city}, {currentUser.state}
                    </div>
                  </div>
                  
                  {userSignups.includes(meetup.id) ? (
                    <div className="space-y-2">
                      <div className="bg-green-50 border border-green-200 rounded px-4 py-2 text-green-700 text-sm font-medium">
                        ✓ You're signed up! Details will be sent the morning of the meetup
                      </div>
                      
                      <VideoCallButton meetup={meetup} />
                      
                      <button 
                        onClick={() => handleCancelSignup(meetup.id)}
                        className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 rounded transition-colors border border-red-200 text-sm"
                      >
                        Cancel Signup
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleSignUp(meetup.id)}
                      className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-2 rounded transition-colors"
                    >
                      Sign Up
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const ConnectionsView = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Your Network</h3>
        <p className="text-sm text-gray-600">People you've connected with at meetups</p>
      </div>

      {currentUser.meetups_attended < 5 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            🔒 Complete {5 - currentUser.meetups_attended} more meetups to unlock 1-on-1 chat requests
          </p>
        </div>
      )}

      <div className="space-y-4">
        {connections.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No connections yet</p>
            <p className="text-sm text-gray-500 mt-2">Meet people at meetups to build your network!</p>
          </div>
        ) : (
          connections.map(connection => {
            const person = connection.connected_user || connection;
            return (
              <div key={connection.id} className="bg-white rounded-lg shadow p-5 border border-gray-200">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <h4 className="font-semibold text-gray-800 text-lg">{person.name}</h4>
                      {connection.mutual_interest && (
                        <div className="ml-2 bg-rose-100 text-rose-600 text-xs px-2 py-1 rounded-full flex items-center">
                          <Heart className="w-3 h-3 mr-1 fill-current" />
                          Mutual
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{person.career}</p>
                    {person.city && person.state && (
                      <p className="text-xs text-gray-500">{person.city}, {person.state}</p>
                    )}
                    {connection.met_at && (
                      <p className="text-xs text-purple-600 mt-1">Met at: {connection.met_at}</p>
                    )}
                  </div>
                </div>
                
                {currentUser.meetups_attended >= 5 ? (
                  <button 
                    onClick={() => setCurrentView('coffeeChats')}
                    className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 rounded transition-colors flex items-center justify-center"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Schedule Video Chat
                  </button>
                ) : (
                  <button disabled className="w-full bg-gray-300 text-gray-500 font-medium py-2 rounded cursor-not-allowed">
                    🔒 Complete more meetups to unlock
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  )

  const MessagesView = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Messages</h3>
        <p className="text-sm text-gray-600">Chat with your connections</p>
      </div>

      {chats.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No active chats yet</p>
          <p className="text-sm text-gray-500 mt-2">Request a 1-on-1 from your Connections</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chats.map(chat => (
            <div 
              key={chat.id}
              onClick={() => setShowChatModal(true)}
              className="bg-white rounded-lg shadow p-4 border border-gray-200 cursor-pointer hover:border-rose-300 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    <h4 className="font-semibold text-gray-800">{chat.name}</h4>
                    {chat.unread > 0 && (
                      <span className="ml-2 bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {chat.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{chat.lastMessage}</p>
                </div>
                <span className="text-xs text-gray-500 ml-2">{chat.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const ProfileView = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-6">
          <div className="w-20 h-20 bg-rose-200 rounded-full flex items-center justify-center text-3xl text-rose-600 font-bold">
            {currentUser.name.charAt(0)}
          </div>
          <div className="ml-4">
            <h3 className="text-2xl font-bold text-gray-800">{currentUser.name}</h3>
            <p className="text-gray-600">{currentUser.career} • Age {currentUser.age}</p>
            <p className="text-sm text-gray-500">{currentUser.city}, {currentUser.state}</p>
            {currentUser.role === 'admin' && (
              <span className="inline-block mt-2 bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full font-medium">
                Admin
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
            <p className="text-gray-700">{currentUser.bio || 'No bio yet'}</p>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold text-gray-800 mb-2">Stats</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-rose-50 rounded p-3">
                <div className="text-2xl font-bold text-rose-600">{currentUser.meetups_attended}</div>
                <div className="text-sm text-gray-600">Meetups Attended</div>
              </div>
              <div className="bg-purple-50 rounded p-3">
                <div className="text-2xl font-bold text-purple-600">{connections.length}</div>
                <div className="text-sm text-gray-600">Connections</div>
              </div>
            </div>
          </div>

          <button 
            onClick={openEditProfile}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded transition-colors"
          >
            Edit Profile
          </button>

          <button 
            onClick={onSignOut}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 rounded transition-colors border border-red-200"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  )

  const AdminDashboard = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Admin Dashboard</h3>
        <p className="text-sm text-gray-600">Manage meetups and view signups</p>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">Manage Meetups</h3>
        <button 
          onClick={() => setShowCreateMeetup(true)}
          className="bg-purple-500 hover:bg-purple-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Create Meetup
        </button>
      </div>

      {meetups.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No meetups yet</p>
          <p className="text-sm text-gray-500 mt-2">Create your first meetup above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {meetups.map(meetup => {
            const meetupSignups = signups[meetup.id] || []
            const signupCount = meetupSignups.length

            return (
              <div key={meetup.id} className="bg-white rounded-lg shadow p-5 border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center text-gray-800 font-semibold mb-1">
                      <Calendar className="w-5 h-5 mr-2 text-purple-500" />
                      {formatDate(meetup.date)} at {formatTime(meetup.time)}
                    </div>
                    {meetup.location && (
                      <div className="flex items-center text-gray-600 text-sm ml-7 mt-1">
                        <MapPin className="w-4 h-4 mr-2" />
                        {meetup.location}
                      </div>
                    )}
                    <p className="text-sm text-gray-600 ml-7 mt-1">{signupCount} {signupCount === 1 ? 'signup' : 'signups'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditMeetup(meetup)}
                      className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteMeetup(meetup.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {!meetup.location && (
                  <div className="border-t pt-3 mb-3">
                    <p className="text-xs text-gray-500 mb-2">Set location (optional):</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g., Blue Bottle Coffee, 123 Main St"
                        className="flex-1 border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-purple-500"
                        id={'location-' + meetup.id}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('location-' + meetup.id)
                          if (input.value) {
                            handleSetLocation(meetup.id, input.value)
                          }
                        }}
                        className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded text-sm transition-colors"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                )}

                {signupCount > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Signups:</p>
                    <div className="space-y-2">
                      {meetupSignups.map((signup) => (
                        <div key={signup.id} className="bg-gray-50 rounded p-3">
                          <p className="font-medium text-gray-800">{signup.profiles?.name || 'Unknown'}</p>
                          <p className="text-sm text-gray-600">{signup.profiles?.email || 'N/A'}</p>
                          <p className="text-sm text-gray-600">
                            {signup.profiles?.career || 'N/A'} • Age {signup.profiles?.age || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {signup.profiles?.city || 'N/A'}, {signup.profiles?.state || 'N/A'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold flex items-center">
            <Coffee className="mr-3" />
            Avari
          </h1>
          <p className="text-rose-100 mt-1">Welcome back, {currentUser.name}!</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {currentView === 'home' && <HomeView />}
        {currentView === 'coffeeChats' && <CoffeeChatsView currentUser={currentUser} connections={connections} supabase={supabase} />}
        {currentView === 'connections' && <ConnectionsView />}
        {currentView === 'messages' && <MessagesView />}
        {currentView === 'profile' && <ProfileView />}
        {currentView === 'admin' && currentUser.role === 'admin' && <AdminDashboard />}
      </div>

      {/* Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full h-[600px] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">Jessica Lee</h3>
              <button onClick={() => setShowChatModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex justify-start">
                <div className="max-w-xs bg-gray-200 text-gray-800 rounded-lg p-3">
                  <p className="text-sm">Hey! I'd love to grab coffee and chat more about product management!</p>
                  <p className="text-xs text-gray-500 mt-1">2:30 PM</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-xs bg-rose-500 text-white rounded-lg p-3">
                  <p className="text-sm">Absolutely! When works for you?</p>
                  <p className="text-xs text-rose-100 mt-1">2:35 PM</p>
                </div>
              </div>
            </div>

            <div className="border-t p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-rose-500"
                />
                <button className="bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-full transition-colors">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && editedProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Edit Profile</h3>
              <button onClick={() => setShowEditProfile(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={editedProfile.name}
                  onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Career</label>
                <input
                  type="text"
                  value={editedProfile.career}
                  onChange={(e) => setEditedProfile({ ...editedProfile, career: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                <input
                  type="number"
                  value={editedProfile.age}
                  onChange={(e) => setEditedProfile({ ...editedProfile, age: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    value={editedProfile.city}
                    onChange={(e) => setEditedProfile({ ...editedProfile, city: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    value={editedProfile.state}
                    onChange={(e) => setEditedProfile({ ...editedProfile, state: e.target.value.toUpperCase() })}
                    maxLength="2"
                    className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-rose-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  value={editedProfile.bio || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 h-24 resize-none focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditProfile(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-medium py-2 rounded transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Meetup Modal */}
      {showCreateMeetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Create New Meetup</h3>
              <button onClick={() => setShowCreateMeetup(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* DATE PICKER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => {
                    setSelectedDate(date)
                    if (date) {
                      // Convert to ISO format for database
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      setNewMeetup({ ...newMeetup, date: `${year}-${month}-${day}` })
                    } else {
                      setNewMeetup({ ...newMeetup, date: '' })
                    }
                  }}
                  minDate={new Date()}
                  dateFormat="MMMM d, yyyy"
                  placeholderText="Click to select a date"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500 cursor-pointer"
                  wrapperClassName="w-full"
                  showPopperArrow={false}
                  required
                />
              </div>

              {/* TIME PICKER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                <input
                  type="time"
                  value={newMeetup.time}
                  onChange={(e) => setNewMeetup({ ...newMeetup, time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* LOCATION */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location (Optional)</label>
                <input
                  type="text"
                  value={newMeetup.location}
                  onChange={(e) => setNewMeetup({ ...newMeetup, location: e.target.value })}
                  placeholder="e.g., Starbucks on Main St"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">You can set the location after seeing who signs up</p>
              </div>
            </div>

            {/* PREVIEW */}
            {newMeetup.date && (
              <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-800 font-medium">Preview:</p>
                <p className="text-sm text-purple-700">
                  {formatDate(newMeetup.date)}
                  {newMeetup.time && ` at ${formatTime(newMeetup.time)}`}
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateMeetup(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMeetup}
                disabled={!newMeetup.date || !newMeetup.time}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Create Meetup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Meetup Modal */}
      {showEditMeetup && editingMeetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Edit Meetup</h3>
              <button onClick={() => setShowEditMeetup(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* DATE PICKER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <DatePicker
                  selected={editingMeetup.date ? new Date(editingMeetup.date) : null}
                  onChange={(date) => {
                    if (date) {
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      setEditingMeetup({ ...editingMeetup, date: `${year}-${month}-${day}` })
                    }
                  }}
                  minDate={new Date()}
                  dateFormat="MMMM d, yyyy"
                  placeholderText="Click to select a date"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500 cursor-pointer"
                  wrapperClassName="w-full"
                  showPopperArrow={false}
                  required
                />
              </div>

              {/* TIME PICKER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                <input
                  type="time"
                  value={editingMeetup.time}
                  onChange={(e) => setEditingMeetup({ ...editingMeetup, time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* LOCATION */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={editingMeetup.location || ''}
                  onChange={(e) => setEditingMeetup({ ...editingMeetup, location: e.target.value })}
                  placeholder="e.g., Blue Bottle Coffee, 123 Main St"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* PREVIEW */}
            {editingMeetup.date && (
              <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-800 font-medium">Preview:</p>
                <p className="text-sm text-purple-700">
                  {formatDate(editingMeetup.date)}
                  {editingMeetup.time && ` at ${formatTime(editingMeetup.time)}`}
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditMeetup(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateMeetup}
                disabled={!editingMeetup.date || !editingMeetup.time}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Update Meetup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-around py-3">
          <button
            onClick={() => setCurrentView('home')}
            className={`flex flex-col items-center px-4 py-2 ${
              currentView === 'home' ? 'text-rose-500' : 'text-gray-500'
            }`}
          >
            <Calendar className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Meetups</span>
          </button>
          <button
            onClick={() => setCurrentView('coffeeChats')}
            className={`flex flex-col items-center px-4 py-2 ${
              currentView === 'coffeeChats' ? 'text-rose-500' : 'text-gray-500'
            }`}
          >
            <Video className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Chats</span>
          </button>
          <button
            onClick={() => setCurrentView('connections')}
            className={`flex flex-col items-center px-4 py-2 ${
              currentView === 'connections' ? 'text-rose-500' : 'text-gray-500'
            }`}
          >
            <Users className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Network</span>
          </button>
          <button
            onClick={() => setCurrentView('messages')}
            className={`flex flex-col items-center px-4 py-2 relative ${
              currentView === 'messages' ? 'text-rose-500' : 'text-gray-500'
            }`}
          >
            <MessageCircle className="w-6 h-6 mb-1" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-2 bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
            <span className="text-xs font-medium">Messages</span>
          </button>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex flex-col items-center px-4 py-2 ${
                currentView === 'admin' ? 'text-rose-500' : 'text-gray-500'
              }`}
            >
              <Coffee className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">Admin</span>
            </button>
          )}
          <button
            onClick={() => setCurrentView('profile')}
            className={`flex flex-col items-center px-4 py-2 ${
              currentView === 'profile' ? 'text-rose-500' : 'text-gray-500'
            }`}
          >
            <User className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}

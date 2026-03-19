'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Loader } from 'lucide-react'
import { fetchFreeBusy, generateTimeSlots } from '@/lib/calendarHelpers'

export default function CalendarAvailability({ selectedDate, onTimeSelect, providerToken }) {
  const [busySlots, setBusySlots] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedTime, setSelectedTime] = useState('')
  const [slots, setSlots] = useState([])

  // Fetch busy slots when date changes
  useEffect(() => {
    if (!selectedDate || !providerToken) {
      setBusySlots(null)
      setSlots([])
      return
    }

    let cancelled = false
    setLoading(true)

    fetchFreeBusy(providerToken, selectedDate).then(result => {
      if (cancelled) return
      setBusySlots(result)
      if (result) {
        setSlots(generateTimeSlots(selectedDate, result))
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [selectedDate, providerToken])

  const handleSelectSlot = (time) => {
    setSelectedTime(time)
    onTimeSelect(time)
  }

  // Fallback: no provider token — show regular time input with connect prompt
  if (!providerToken) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time *
        </label>
        <input
          type="time"
          value={selectedTime}
          onChange={(e) => {
            setSelectedTime(e.target.value)
            onTimeSelect(e.target.value)
          }}
          className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
        />
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>Sign in with Google to see your calendar availability</span>
        </div>
      </div>
    )
  }

  if (!selectedDate) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time *
        </label>
        <p className="text-sm text-gray-400 py-3">Select a date first to see available times</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time *
        </label>
        <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
          <Loader className="w-4 h-4 animate-spin" />
          <span>Checking your calendar...</span>
        </div>
      </div>
    )
  }

  // If fetch failed, fall back to regular input
  if (busySlots === null) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time *
        </label>
        <input
          type="time"
          value={selectedTime}
          onChange={(e) => {
            setSelectedTime(e.target.value)
            onTimeSelect(e.target.value)
          }}
          className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
        />
        <p className="text-xs text-gray-400 mt-1">Could not load calendar — pick a time manually</p>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Time * <span className="text-xs text-gray-400 font-normal ml-1">from your Google Calendar</span>
      </label>
      <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
        {slots.map(slot => (
          <button
            key={slot.time}
            type="button"
            disabled={!slot.available}
            onClick={() => handleSelectSlot(slot.time)}
            className={`text-xs py-2 px-1 rounded-md transition-colors ${
              !slot.available
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : selectedTime === slot.time
                  ? 'bg-purple-500 text-white'
                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
            }`}
          >
            {slot.time}
          </button>
        ))}
      </div>
      {selectedTime && (
        <p className="text-xs text-purple-600 mt-2">Selected: {selectedTime}</p>
      )}
    </div>
  )
}

/**
 * Tests for meetup business logic.
 */

describe('Meetup Logic', () => {
  describe('Date calculation', () => {
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    function getNextDayOfWeek(dayName, fromDate = new Date()) {
      const targetDay = DAY_NAMES.indexOf(dayName)
      if (targetDay === -1) return null
      const date = new Date(fromDate)
      const currentDay = date.getDay()
      let daysUntil = targetDay - currentDay
      if (daysUntil <= 0) daysUntil += 7
      date.setDate(date.getDate() + daysUntil)
      return date
    }

    function calculateUpcomingDates(dayName, cadence, count = 4, fromDate = new Date()) {
      const dates = []
      let current = getNextDayOfWeek(dayName, fromDate)
      if (!current) return dates

      const intervals = {
        'Weekly': 7,
        'Biweekly': 14,
        'Monthly': 28,
      }
      const interval = intervals[cadence] || 7

      for (let i = 0; i < count; i++) {
        dates.push(new Date(current))
        current.setDate(current.getDate() + interval)
      }
      return dates
    }

    test('generates correct number of dates', () => {
      const dates = calculateUpcomingDates('Monday', 'Weekly', 4)
      expect(dates).toHaveLength(4)
    })

    test('weekly dates are 7 days apart', () => {
      const dates = calculateUpcomingDates('Monday', 'Weekly', 3)
      const diff1 = dates[1] - dates[0]
      const diff2 = dates[2] - dates[1]
      expect(diff1).toBe(7 * 24 * 60 * 60 * 1000)
      expect(diff2).toBe(7 * 24 * 60 * 60 * 1000)
    })

    test('biweekly dates are 14 days apart', () => {
      const dates = calculateUpcomingDates('Wednesday', 'Biweekly', 2)
      const diff = dates[1] - dates[0]
      expect(diff).toBe(14 * 24 * 60 * 60 * 1000)
    })

    test('monthly dates are 28 days apart', () => {
      const dates = calculateUpcomingDates('Friday', 'Monthly', 2)
      const diffDays = Math.round((dates[1] - dates[0]) / (24 * 60 * 60 * 1000))
      expect(diffDays).toBe(28)
    })

    test('all generated dates are in the future', () => {
      const now = new Date()
      const dates = calculateUpcomingDates('Tuesday', 'Weekly', 4)
      dates.forEach(date => {
        expect(date.getTime()).toBeGreaterThan(now.getTime())
      })
    })

    test('all generated dates fall on the correct day', () => {
      const dates = calculateUpcomingDates('Thursday', 'Weekly', 4)
      dates.forEach(date => {
        expect(date.getDay()).toBe(4) // Thursday
      })
    })
  })

  describe('Meetup filtering', () => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const futureStr = '2027-12-31'
    const pastStr = '2025-01-01'

    test('filters future active meetups', () => {
      const meetups = [
        { id: '1', date: futureStr, status: 'active' },
        { id: '2', date: futureStr, status: 'cancelled' },
        { id: '3', date: pastStr, status: 'active' },
        { id: '4', date: futureStr, status: 'completed' },
      ]

      const active = meetups.filter(
        m => m.date >= todayStr && !['cancelled', 'completed'].includes(m.status)
      )

      expect(active).toHaveLength(1)
      expect(active[0].id).toBe('1')
    })

    test('sorts meetups by date ascending', () => {
      const meetups = [
        { id: '1', date: '2027-03-15', time: '10:00' },
        { id: '2', date: '2027-01-10', time: '14:00' },
        { id: '3', date: '2027-06-20', time: '09:00' },
      ]

      const sorted = [...meetups].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.time || '').localeCompare(b.time || '')
      })

      expect(sorted.map(m => m.id)).toEqual(['2', '1', '3'])
    })
  })

  describe('RSVP logic', () => {
    test('builds RSVP status map from signups', () => {
      const signups = [
        { meetup_id: 'meetup-1' },
        { meetup_id: 'meetup-3' },
      ]

      const rsvpMap = {}
      signups.forEach(s => { rsvpMap[s.meetup_id] = true })

      expect(rsvpMap['meetup-1']).toBe(true)
      expect(rsvpMap['meetup-2']).toBeUndefined()
      expect(rsvpMap['meetup-3']).toBe(true)
    })

    test('prevents duplicate RSVP', () => {
      const existingSignups = [{ meetup_id: 'm1', user_id: 'u1' }]
      const alreadySignedUp = existingSignups.some(
        s => s.meetup_id === 'm1' && s.user_id === 'u1'
      )
      expect(alreadySignedUp).toBe(true)
    })
  })

  describe('Proximity check for rescheduled meetups', () => {
    test('skips dates within 3 days of existing meetup', () => {
      const existingDate = new Date('2027-03-10')
      const candidateDates = [
        new Date('2027-03-08'), // 2 days before - too close
        new Date('2027-03-12'), // 2 days after - too close
        new Date('2027-03-17'), // 7 days after - OK
      ]

      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

      const valid = candidateDates.filter(candidate => {
        const diff = Math.abs(candidate - existingDate)
        return diff > THREE_DAYS_MS
      })

      expect(valid).toHaveLength(1)
      expect(valid[0].toISOString()).toContain('2027-03-17')
    })
  })

  describe('Circle-specific meetup visibility', () => {
    test('shows public meetups and user circle meetups', () => {
      const userCircleIds = ['circle-1', 'circle-3']
      const meetups = [
        { id: '1', circle_id: null },       // public
        { id: '2', circle_id: 'circle-1' }, // user's circle
        { id: '3', circle_id: 'circle-2' }, // other circle
        { id: '4', circle_id: 'circle-3' }, // user's circle
      ]

      const visible = meetups.filter(
        m => m.circle_id === null || userCircleIds.includes(m.circle_id)
      )

      expect(visible).toHaveLength(3)
      expect(visible.map(m => m.id)).toEqual(['1', '2', '4'])
    })
  })

  describe('Soft delete pattern', () => {
    test('cancelling sets status instead of deleting', () => {
      const meetup = { id: '1', status: 'active', updated_at: null }

      // Simulate cancel
      const cancelled = {
        ...meetup,
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      }

      expect(cancelled.status).toBe('cancelled')
      expect(cancelled.updated_at).toBeDefined()
    })
  })
})

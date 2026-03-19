/**
 * Fetch free/busy data from Google Calendar for a given date.
 * Returns an array of { start, end } busy slots, or null on failure.
 */
export async function fetchFreeBusy(providerToken, dateStr) {
  try {
    const timeMin = new Date(`${dateStr}T00:00:00`).toISOString()
    const timeMax = new Date(`${dateStr}T23:59:59`).toISOString()

    const res = await fetch('/api/calendar/freebusy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerToken, timeMin, timeMax }),
    })

    const data = await res.json()

    if (data.available === false) return null
    return data.busy || []
  } catch (err) {
    console.error('fetchFreeBusy error:', err)
    return null
  }
}

/**
 * Generate 30-minute time slots between startHour and endHour,
 * marking each as available or busy based on busySlots.
 */
export function generateTimeSlots(dateStr, busySlots = []) {
  const slots = []
  const startHour = 8
  const endHour = 20

  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const timeStr = `${hh}:${mm}`
      const slotStart = new Date(`${dateStr}T${timeStr}:00`)
      const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000)

      const available = !busySlots.some(busy => {
        const busyStart = new Date(busy.start)
        const busyEnd = new Date(busy.end)
        return slotStart < busyEnd && slotEnd > busyStart
      })

      slots.push({ time: timeStr, available })
    }
  }

  return slots
}

/**
 * Check if a specific time slot overlaps any busy period.
 */
export function isSlotAvailable(slotTime, dateStr, busySlots = []) {
  const slotStart = new Date(`${dateStr}T${slotTime}:00`)
  const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000)

  return !busySlots.some(busy => {
    const busyStart = new Date(busy.start)
    const busyEnd = new Date(busy.end)
    return slotStart < busyEnd && slotEnd > busyStart
  })
}

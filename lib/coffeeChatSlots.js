const DAY_LABELS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const TIME_LABELS = { morning: 'Mornings (8-12)', afternoon: 'Afternoons (12-5)', evening: 'Evenings (5-8)' }
const TIME_SHORT = { morning: 'Mornings', afternoon: 'Afternoons', evening: 'Evenings' }

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const TIMES = ['morning', 'afternoon', 'evening']

export function formatCoffeeSlots(slots, short = false) {
  if (!slots?.days?.length && !slots?.times?.length) return null
  const days = (slots.days || []).map(d => DAY_LABELS[d]).join(', ')
  const times = (slots.times || []).map(t => (short ? TIME_SHORT : TIME_LABELS)[t]).join(' & ')
  return [days, times].filter(Boolean).join(' · ')
}

export function getDayLabel(day) {
  return DAY_LABELS[day] || day
}

export function getTimeLabel(time) {
  return TIME_LABELS[time] || time
}

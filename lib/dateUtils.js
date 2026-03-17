/**
 * Shared date parsing/formatting utilities.
 *
 * Meetup dates are stored as "YYYY-MM-DD" strings with a separate "HH:MM"
 * time field and an IANA timezone string (e.g. "America/New_York").
 *
 * When parsed with `new Date("2026-02-12")`, JavaScript treats this as UTC
 * midnight, which shifts to the previous day in US timezones. These utilities
 * ensure dates are parsed correctly across timezones.
 */

/**
 * Parse a "YYYY-MM-DD" string as local midnight (not UTC).
 * Falls back to new Date(dateStr) for other formats.
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(dateStr);
}

/**
 * Return today's date as a "YYYY-MM-DD" string in local time.
 * Avoids the UTC pitfall of `new Date().toISOString().split('T')[0]`
 * which shifts to tomorrow in US evening hours.
 */
export function toLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert an event's date + time + timezone into a UTC Date object.
 * This allows correct cross-timezone comparisons (e.g. a Beijing user
 * viewing an event created in New York).
 *
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {string} [timeStr] - "HH:MM" (defaults to "23:59" so date-only comparisons are generous)
 * @param {string} [eventTimezone] - IANA timezone (e.g. "America/New_York"). If absent, treats time as viewer's local.
 * @returns {Date} The event datetime as a UTC-correct Date object
 */
export function eventDateTimeToUTC(dateStr, timeStr, eventTimezone) {
  if (!dateStr) return new Date(NaN);
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = (timeStr || '23:59').split(':').map(Number);

  if (!eventTimezone) {
    // No timezone stored — treat as viewer's local time (legacy behavior)
    return new Date(y, mo - 1, d, h, mi);
  }

  // Create a UTC date with the event's numbers
  const utcGuess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  // Determine the timezone's offset by formatting the same instant in both zones
  const inTz = new Date(utcGuess.toLocaleString('en-US', { timeZone: eventTimezone }));
  const inUTC = new Date(utcGuess.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = inTz.getTime() - inUTC.getTime();
  // Actual UTC time = guessed UTC - offset
  return new Date(utcGuess.getTime() - offsetMs);
}

/**
 * Check if an event is past (ended), accounting for timezone and duration.
 * Returns true only after the event's end time (start + duration) has passed.
 *
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {string} [timeStr] - "HH:MM"
 * @param {string} [eventTimezone] - IANA timezone
 * @param {number} [durationMinutes=60] - Event duration
 * @returns {boolean}
 */
export function isEventPast(dateStr, timeStr, eventTimezone, durationMinutes = 60, graceMinutes = 30) {
  const eventStart = eventDateTimeToUTC(dateStr, timeStr, eventTimezone);
  if (isNaN(eventStart.getTime())) return false;
  const eventEndWithGrace = new Date(eventStart.getTime() + (durationMinutes + graceMinutes) * 60000);
  return new Date() > eventEndWithGrace;
}

/**
 * Check if an event is currently live.
 *
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {string} [timeStr] - "HH:MM"
 * @param {string} [eventTimezone] - IANA timezone
 * @param {number} [durationMinutes=60] - Event duration
 * @returns {boolean}
 */
export function isEventLive(dateStr, timeStr, eventTimezone, durationMinutes = 60) {
  if (!timeStr) return false;
  const eventStart = eventDateTimeToUTC(dateStr, timeStr, eventTimezone);
  if (isNaN(eventStart.getTime())) return false;
  const eventEnd = new Date(eventStart.getTime() + durationMinutes * 60000);
  const now = new Date();
  return now >= eventStart && now <= eventEnd;
}

/**
 * Format an event's time for display in the viewer's local timezone.
 * If the event has a timezone and it differs from the viewer's, converts
 * the time and shows the viewer's timezone abbreviation.
 *
 * @param {string} dateStr - "YYYY-MM-DD" (needed for correct DST conversion)
 * @param {string} timeStr - "HH:MM"
 * @param {string} [eventTimezone] - IANA timezone the event was created in
 * @returns {string} e.g. "9:00 AM CST" or "8:00 PM EST"
 */
/**
 * Get a friendly timezone label from an IANA timezone string.
 * For US timezones, returns abbreviation (EST, PST, etc.).
 * For others, returns the city name (e.g. "Asia/Shanghai" → "Shanghai time").
 */
function getTimezoneLabel(tz, refDate = new Date()) {
  try {
    const abbr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(refDate).find(p => p.type === 'timeZoneName')?.value;

    // If it's a recognizable abbreviation (not GMT+X), use it directly
    if (abbr && !abbr.startsWith('GMT')) return abbr;

    // Extract city from IANA timezone (e.g. "Asia/Shanghai" → "Shanghai")
    const city = tz.split('/').pop()?.replace(/_/g, ' ');
    return city ? `${city} time` : abbr || tz;
  } catch {
    return tz.split('/').pop()?.replace(/_/g, ' ') || tz;
  }
}

export function formatEventTime(dateStr, timeStr, eventTimezone) {
  if (!timeStr) return '';

  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (eventTimezone && eventTimezone !== viewerTz) {
    // Convert event time from event timezone to viewer's local time
    try {
      const eventUTC = eventDateTimeToUTC(dateStr, timeStr, eventTimezone);
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: viewerTz,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(eventUTC);
      return `${formatted} ${getTimezoneLabel(viewerTz, eventUTC)}`;
    } catch {
      // Fall through to default formatting
    }
  }

  // Same timezone or no event timezone — format as-is with viewer's tz label
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  const displayM = `:${String(m).padStart(2, '0')}`;
  const timeFormatted = `${displayH}${displayM} ${period}`;

  return `${timeFormatted} ${getTimezoneLabel(viewerTz)}`;
}

/**
 * Format an event's date for display in the viewer's local timezone.
 * Handles date shifts across midnight (e.g. March 15 5:30 PM Detroit = March 16 Beijing).
 *
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {string} [timeStr] - "HH:MM"
 * @param {string} [eventTimezone] - IANA timezone
 * @param {Object} [options] - Intl.DateTimeFormat options for date display
 * @returns {string} Formatted date in viewer's timezone
 */
export function formatEventDate(dateStr, timeStr, eventTimezone, options = {}) {
  if (!dateStr) return 'TBD';

  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (eventTimezone && eventTimezone !== viewerTz && timeStr) {
    try {
      const eventUTC = eventDateTimeToUTC(dateStr, timeStr, eventTimezone);
      const {
        weekday = 'short',
        month = 'short',
        day = 'numeric',
        year,
      } = options;
      const formatOpts = { timeZone: viewerTz, weekday, month, day };
      if (year) formatOpts.year = year;
      return new Intl.DateTimeFormat('en-US', formatOpts).format(eventUTC);
    } catch {
      // Fall through to default
    }
  }

  // Same timezone or no event timezone — use local date parsing
  return formatDate(dateStr, options);
}

/**
 * Format a date string for display.
 * Handles "YYYY-MM-DD" (parsed as local) and legacy "Wednesday, Dec 3" (returned as-is).
 */
export function formatDate(dateStr, options = {}) {
  if (!dateStr) return 'TBD';
  try {
    const date = parseLocalDate(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const {
      weekday = 'short',
      month = 'short',
      day = 'numeric',
      year,
      timeZone,
    } = options;

    const formatOptions = { weekday, month, day };
    if (year) formatOptions.year = year;
    if (timeZone) formatOptions.timeZone = timeZone;

    return date.toLocaleDateString('en-US', formatOptions);
  } catch {
    return dateStr;
  }
}

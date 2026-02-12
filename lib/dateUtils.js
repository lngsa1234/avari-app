/**
 * Shared date parsing/formatting utilities.
 *
 * Meetup dates are stored as "YYYY-MM-DD" strings. When parsed with
 * `new Date("2026-02-12")`, JavaScript treats this as UTC midnight,
 * which shifts to the previous day in US timezones. These utilities
 * ensure dates are parsed as local midnight instead.
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

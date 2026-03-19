const { TRANSIT_TYPE_LABELS } = require('../config/constants');

/**
 * GTFS Helper utilities — parsing and formatting GTFS-specific data.
 */

/**
 * Parse a GTFS time string (HH:MM:SS, possibly > 24:00:00) to total seconds.
 * GTFS allows times like 25:30:00 for trips running past midnight.
 */
function gtfsTimeToSeconds(timeStr) {
  if (!timeStr) return null;
  const [h, m, s] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

/**
 * Convert seconds since midnight to a GTFS time string.
 */
function secondsToGtfsTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Get the human-readable label for a GTFS route_type.
 */
function getTransitTypeLabel(routeType) {
  return TRANSIT_TYPE_LABELS[routeType] || 'Transit';
}

/**
 * Determine the emoji icon for a transit type.
 */
function getTransitTypeIcon(routeType) {
  const icons = { 0: '🚋', 1: '🚇', 2: '🚆', 3: '🚌', 4: '⛴️', 5: '🚡', 6: '🚠', 7: '🚞' };
  return icons[routeType] || '🚌';
}

/**
 * Format a GTFS time string for display (strips seconds, handles > 24h).
 * e.g. "08:30:00" → "08:30", "25:10:00" → "01:10 (next day)"
 */
function formatGtfsTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  if (h >= 24) {
    const realH = h - 24;
    return `${String(realH).padStart(2, '0')}:${String(m).padStart(2, '0')} (+1)`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Check if a service operates on a given day of the week.
 * @param {object} calendar - GTFS calendar row
 * @param {Date} date
 */
function serviceRunsOnDate(calendar, date) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = days[date.getDay()];
  return calendar[dayName] === '1' || calendar[dayName] === 1;
}

/**
 * Determine the "current time" in GTFS format (HH:MM:SS),
 * accounting for the service day convention (after midnight = 24+).
 */
function getCurrentGtfsTime(date = new Date()) {
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Calculate headway (frequency) stats for a route at a stop.
 * Given an array of departure times, return min/max/avg gap in minutes.
 */
function calculateHeadways(departureTimes) {
  if (departureTimes.length < 2) return null;
  const seconds = departureTimes.map(gtfsTimeToSeconds).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < seconds.length; i++) {
    gaps.push((seconds[i] - seconds[i - 1]) / 60);
  }
  return {
    min: Math.min(...gaps),
    max: Math.max(...gaps),
    avg: gaps.reduce((a, b) => a + b, 0) / gaps.length,
  };
}

module.exports = {
  gtfsTimeToSeconds,
  secondsToGtfsTime,
  getTransitTypeLabel,
  getTransitTypeIcon,
  formatGtfsTime,
  serviceRunsOnDate,
  getCurrentGtfsTime,
  calculateHeadways,
};

/**
 * Distance utilities — pure JS spatial math.
 * Used for quick client-side estimates before hitting PostGIS.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Haversine formula — great-circle distance between two lat/lng points (meters).
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate walking time in seconds from distance in meters.
 * Average walking speed: 1.4 m/s (~5 km/h)
 */
function walkingDuration(distanceMeters) {
  return Math.round(distanceMeters / 1.4);
}

/**
 * Estimate driving time in seconds from distance in meters.
 * Rough urban average: ~30 km/h = 8.33 m/s
 */
function drivingDuration(distanceMeters) {
  return Math.round(distanceMeters / 8.33);
}

/**
 * Format a distance in meters to a human-readable string.
 */
function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Format duration in seconds to a human-readable string.
 */
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min`;
  return `${seconds}s`;
}

/**
 * Check if a point is within a bounding box.
 */
function isInBbox(lat, lng, minLat, minLng, maxLat, maxLng) {
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/**
 * Calculate the total length of a GeoJSON LineString in meters.
 */
function lineStringLength(geojson) {
  if (geojson.type !== 'LineString' || !geojson.coordinates?.length) return 0;
  let total = 0;
  for (let i = 1; i < geojson.coordinates.length; i++) {
    const [lng1, lat1] = geojson.coordinates[i - 1];
    const [lng2, lat2] = geojson.coordinates[i];
    total += haversineDistance(lat1, lng1, lat2, lng2);
  }
  return total;
}

module.exports = {
  haversineDistance,
  walkingDuration,
  drivingDuration,
  formatDistance,
  formatDuration,
  isInBbox,
  lineStringLength,
};

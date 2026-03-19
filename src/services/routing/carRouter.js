const axios = require('axios');
const { buildOsrmRouteUrl, buildOsrmNearestUrl } = require('../../config/osrm');
const { MAX_SNAP_DISTANCE_METERS } = require('../../config/constants');

/**
 * Car Router — wraps OSRM's car profile.
 *
 * Key safety feature: before routing, both origin and destination are
 * snapped to the nearest drivable road node via OSRM's /nearest endpoint.
 * This prevents impossible routes (e.g. user taps on a lake or inside a building).
 */

/**
 * Snap a coordinate to the nearest car-accessible road.
 * @param {number} lng
 * @param {number} lat
 * @returns {Promise<{lng, lat, distance, snapped}>}
 */
async function snapToCarRoad(lng, lat) {  
  const url = buildOsrmNearestUrl('car', lng, lat);
  const response = await axios.get(url, { timeout: 5000 });
  const data = response.data;

  if (data.code !== 'Ok' || !data.waypoints?.length) {
    throw new Error(`No drivable road found near [${lng}, ${lat}]`);
  }

  const waypoint = data.waypoints[0];
  const snappedLng = waypoint.location[0];
  const snappedLat = waypoint.location[1];
  const distance = waypoint.distance; // meters to nearest road

  if (distance > MAX_SNAP_DISTANCE_METERS) {
    throw new Error(
      `Nearest road is ${Math.round(distance)}m away — location may be on water or inaccessible. ` +
      `Maximum allowed: ${MAX_SNAP_DISTANCE_METERS}m`
    );
  }

  return {
    lng: snappedLng,
    lat: snappedLat,
    originalLng: lng,
    originalLat: lat,
    snapDistance: distance,
    snapped: distance > 5, // only flag as snapped if moved more than 5m
  };
}

/**
 * Get a car driving route between origin and destination.
 * @param {object} origin - { lat, lng }
 * @param {object} destination - { lat, lng }
 * @param {object} options - { steps, avoidHazards, waypoints }
 * @returns {Promise<object>} Route response
 */
async function getCarRoute(origin, destination, options = {}) {
  // Step 1: Snap both points to nearest drivable road
  const [snappedOrigin, snappedDest] = await Promise.all([
    snapToCarRoad(origin.lng, origin.lat),
    snapToCarRoad(destination.lng, destination.lat),
  ]);

  // Step 2: Build coordinate list (origin → optional waypoints → destination)
  const waypoints = options.waypoints || [];
  const snappedWaypoints = await Promise.all(
    waypoints.map((wp) => snapToCarRoad(wp.lng, wp.lat))
  );

  const coordinates = [
    [snappedOrigin.lng, snappedOrigin.lat],
    ...snappedWaypoints.map((wp) => [wp.lng, wp.lat]),
    [snappedDest.lng, snappedDest.lat],
  ];

  // Step 3: Call OSRM
  const url = buildOsrmRouteUrl('car', coordinates, { steps: options.steps });
  const response = await axios.get(url, { timeout: 10000 });
  const data = response.data;

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(`No car route found: ${data.message || data.code}`);
  }

  const route = data.routes[0];

  return {
    mode: 'car',
    distance: route.distance,       // meters
    duration: route.duration,       // seconds
    geometry: route.geometry,       // GeoJSON LineString
    legs: route.legs,
    snapping: {
      origin: snappedOrigin,
      destination: snappedDest,
    },
  };
}

module.exports = { getCarRoute, snapToCarRoad };
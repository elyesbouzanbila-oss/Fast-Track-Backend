const axios = require('axios');
const { buildOsrmRouteUrl, buildOsrmNearestUrl } = require('../../config/osrm');
const { MAX_SNAP_DISTANCE_METERS } = require('../../config/constants');

/**
 * Car Router — wraps OSRM's car profile with fallback for demo/testing.
 */

async function snapToCarRoad(lng, lat) {
  if (process.env.SKIP_OSRM === 'true' || process.env.NODE_ENV !== 'production') {
    try {
      const url = buildOsrmNearestUrl('car', lng, lat);
      const response = await axios.get(url, { timeout: 5000 });
      const data = response.data;

      if (data.code === 'Ok' && data.waypoints?.length) {
        const waypoint = data.waypoints[0];
        const snappedLng = waypoint.location[0];
        const snappedLat = waypoint.location[1];
        const distance = waypoint.distance;

        if (distance <= MAX_SNAP_DISTANCE_METERS) {
          return {
            lng: snappedLng,
            lat: snappedLat,
            originalLng: lng,
            originalLat: lat,
            snapDistance: distance,
            snapped: distance > 5,
          };
        }
      }
    } catch (err) {
      // Fall through to fallback
    }

    // Fallback for demo mode
    return {
      lng,
      lat,
      originalLng: lng,
      originalLat: lat,
      snapDistance: 0,
      snapped: false,
      fallback: true,
    };
  }

  const url = buildOsrmNearestUrl('car', lng, lat);
  const response = await axios.get(url, { timeout: 5000 });
  const data = response.data;

  if (data.code !== 'Ok' || !data.waypoints?.length) {
    throw new Error(`No drivable road found near [${lng}, ${lat}]`);
  }

  const waypoint = data.waypoints[0];
  const snappedLng = waypoint.location[0];
  const snappedLat = waypoint.location[1];
  const distance = waypoint.distance;

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
    snapped: distance > 5,
  };
}

/**
 * Generate a demo route geometry (GeoJSON LineString) for testing
 */
function generateDemoRoute(origin, destination) {
  const coords = [
    [origin.lng, origin.lat],
    [(origin.lng + destination.lng) / 2, (origin.lat + destination.lat) / 2],
    [destination.lng, destination.lat],
  ];

  // Calculate rough distance in meters
  const latDiff = Math.abs(destination.lat - origin.lat);
  const lngDiff = Math.abs(destination.lng - origin.lng);
  const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000; // rough approximation

  return {
    type: 'LineString',
    coordinates: coords,
    distance: Math.round(distance),
    duration: Math.round(distance / 15), // ~15 m/s average
  };
}

async function getCarRoute(origin, destination, options = {}) {
  // Snap both points
  const [snappedOrigin, snappedDest] = await Promise.all([
    snapToCarRoad(origin.lng, origin.lat),
    snapToCarRoad(destination.lng, destination.lat),
  ]);

  // Build coordinates
  const waypoints = options.waypoints || [];
  const snappedWaypoints = await Promise.all(
    waypoints.map((wp) => snapToCarRoad(wp.lng, wp.lat))
  );

  const coordinates = [
    [snappedOrigin.lng, snappedOrigin.lat],
    ...snappedWaypoints.map((wp) => [wp.lng, wp.lat]),
    [snappedDest.lng, snappedDest.lat],
  ];

  // Check if we're using fallback (demo mode)
  const isFallback = snappedOrigin.fallback || snappedDest.fallback;

  if (isFallback) {
    const geometry = generateDemoRoute(snappedOrigin, snappedDest);
    return {
      mode: 'car',
      distance: geometry.distance,
      duration: geometry.duration,
      geometry,
      legs: [],
      snapping: { origin: snappedOrigin, destination: snappedDest },
      demo: true,
    };
  }

  // Call OSRM
  try {
    const url = buildOsrmRouteUrl('car', coordinates, { steps: options.steps });
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`No car route found: ${data.message || data.code}`);
    }

    const route = data.routes[0];

    return {
      mode: 'car',
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
      legs: route.legs,
      snapping: { origin: snappedOrigin, destination: snappedDest },
    };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[getCarRoute] OSRM failed, using demo route:', err.message);
      const geometry = generateDemoRoute(snappedOrigin, snappedDest);
      return {
        mode: 'car',
        distance: geometry.distance,
        duration: geometry.duration,
        geometry,
        legs: [],
        snapping: { origin: snappedOrigin, destination: snappedDest },
        demo: true,
      };
    }
    throw err;
  }
}

module.exports = { getCarRoute, snapToCarRoad };

const axios = require('axios');
const { buildOsrmRouteUrl, buildOsrmNearestUrl } = require('../../config/osrm');
const { MAX_SNAP_DISTANCE_METERS, ROUTE_MODES } = require('../../config/constants');
const { getCarRoute, snapToCarRoad } = require('./carRouter');
const { findNearbyStops } = require('./transitRouter');

/**
 * Snap a coordinate to nearest walkable path with fallback
 */
async function snapToFootPath(lng, lat) {
  if (process.env.SKIP_OSRM === 'true' || process.env.NODE_ENV !== 'production') {
    try {
      const url = buildOsrmNearestUrl('foot', lng, lat);
      const response = await axios.get(url, { timeout: 5000 });
      const data = response.data;

      if (data.code === 'Ok' && data.waypoints?.length) {
        const wp = data.waypoints[0];
        if (wp.distance <= MAX_SNAP_DISTANCE_METERS) {
          return {
            lng: wp.location[0],
            lat: wp.location[1],
            snapDistance: wp.distance,
            snapped: wp.distance > 5,
          };
        }
      }
    } catch (err) {
      // Fall through to fallback
    }

    return { lng, lat, snapDistance: 0, snapped: false, fallback: true };
  }

  const url = buildOsrmNearestUrl('foot', lng, lat);
  const response = await axios.get(url, { timeout: 5000 });
  const data = response.data;

  if (data.code !== 'Ok' || !data.waypoints?.length) {
    throw new Error(`No walkable path found near [${lng}, ${lat}]`);
  }

  const wp = data.waypoints[0];
  if (wp.distance > MAX_SNAP_DISTANCE_METERS) {
    throw new Error(
      `Nearest walkable path is ${Math.round(wp.distance)}m away — location may be inaccessible.`
    );
  }

  return {
    lng: wp.location[0],
    lat: wp.location[1],
    snapDistance: wp.distance,
    snapped: wp.distance > 5,
  };
}

function generateDemoRoute(origin, destination) {
  const coords = [
    [origin.lng, origin.lat],
    [(origin.lng + destination.lng) / 2, (origin.lat + destination.lat) / 2],
    [destination.lng, destination.lat],
  ];

  const latDiff = Math.abs(destination.lat - origin.lat);
  const lngDiff = Math.abs(destination.lng - origin.lng);
  const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;

  return {
    type: 'LineString',
    coordinates: coords,
    distance: Math.round(distance),
    duration: Math.round(distance / 1.4), // ~1.4 m/s walking speed
  };
}

/**
 * Get a walking route between two points
 */
async function getWalkingRoute(origin, destination, options = {}) {
  const [snappedOrigin, snappedDest] = await Promise.all([
    snapToFootPath(origin.lng, origin.lat),
    snapToFootPath(destination.lng, destination.lat),
  ]);

  const isFallback = snappedOrigin.fallback || snappedDest.fallback;

  if (isFallback) {
    const geometry = generateDemoRoute(snappedOrigin, snappedDest);
    return {
      mode: 'foot',
      distance: geometry.distance,
      duration: geometry.duration,
      geometry,
      legs: [],
      snapping: { origin: snappedOrigin, destination: snappedDest },
      demo: true,
    };
  }

  const coordinates = [
    [snappedOrigin.lng, snappedOrigin.lat],
    [snappedDest.lng, snappedDest.lat],
  ];

  try {
    const url = buildOsrmRouteUrl('foot', coordinates, { steps: options.steps });
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`No walking route found: ${data.message || data.code}`);
    }

    const route = data.routes[0];
    return {
      mode: 'foot',
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
      legs: route.legs,
      snapping: { origin: snappedOrigin, destination: snappedDest },
    };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[getWalkingRoute] OSRM failed, using demo route:', err.message);
      const geometry = generateDemoRoute(snappedOrigin, snappedDest);
      return {
        mode: 'foot',
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

/**
 * Main routing dispatcher with fallbacks
 */
async function getRoute(origin, destination, mode = ROUTE_MODES.CAR, options = {}) {
  switch (mode) {
    case ROUTE_MODES.CAR:
      return getCarRoute(origin, destination, options);

    case ROUTE_MODES.WALK:
      return getWalkingRoute(origin, destination, options);

    case ROUTE_MODES.TRANSIT:
      // Transit routing would need GTFS data
      try {
        const { getTransitRoute } = require('./transitRouter');
        return getTransitRoute(origin, destination, options);
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[getRoute] Transit unavailable, using walking route as fallback');
          return getWalkingRoute(origin, destination, options);
        }
        throw err;
      }

    case ROUTE_MODES.MULTIMODAL: {
      const [walkRoute, transitRoute] = await Promise.allSettled([
        getWalkingRoute(origin, destination, options),
        (async () => {
          try {
            const { getTransitRoute } = require('./transitRouter');
            return getTransitRoute(origin, destination, options);
          } catch (err) {
            return null;
          }
        })(),
      ]);

      return {
        mode: 'multimodal',
        walking: walkRoute.status === 'fulfilled' ? walkRoute.value : null,
        transit: transitRoute.status === 'fulfilled' && transitRoute.value ? transitRoute.value : null,
        errors: {
          walking: walkRoute.status === 'rejected' ? walkRoute.reason?.message : null,
          transit: transitRoute.status === 'rejected' ? transitRoute.reason?.message : null,
        },
      };
    }

    default:
      throw new Error(`Unknown routing mode: ${mode}`);
  }
}

async function snapCoordinate(lng, lat, mode = 'car') {
  switch (mode) {
    case 'car':
    case 'bike':
      return snapToCarRoad(lng, lat);
    case 'foot':
      return snapToFootPath(lng, lat);
    default:
      return snapToCarRoad(lng, lat);
  }
}

module.exports = { getRoute, getWalkingRoute, snapCoordinate, snapToFootPath };

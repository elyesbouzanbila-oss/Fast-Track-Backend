const axios = require('axios');
const { buildOsrmRouteUrl, buildOsrmNearestUrl } = require('../../config/osrm');
const { ROUTE_MODES, MAX_SNAP_DISTANCE_METERS } = require('../../config/constants');
const { getCarRoute, snapToCarRoad } = require('./carRouter');
const { getTransitRoute } = require('./transitRouter');

/**
 * Routing index — unified entry point for all routing modes.
 * Handles: car, foot (walking), bike, transit, multimodal.
 */

/**
 * Snap a coordinate to nearest walkable path.
 */
async function snapToFootPath(lng, lat) {
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

/**
 * Get a walking route between two points via OSRM foot profile.
 */
async function getWalkingRoute(origin, destination, options = {}) {
  const [snappedOrigin, snappedDest] = await Promise.all([
    snapToFootPath(origin.lng, origin.lat),
    snapToFootPath(destination.lng, destination.lat),
  ]);

  const coordinates = [
    [snappedOrigin.lng, snappedOrigin.lat],
    [snappedDest.lng, snappedDest.lat],
  ];

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
}

/**
 * Main routing dispatcher.
 * @param {object} origin - { lat, lng }
 * @param {object} destination - { lat, lng }
 * @param {string} mode - car | foot | bike | transit | multimodal
 * @param {object} options
 */
async function getRoute(origin, destination, mode = ROUTE_MODES.CAR, options = {}) {
  switch (mode) {
    case ROUTE_MODES.CAR:
      return getCarRoute(origin, destination, options);

    case ROUTE_MODES.WALK:
      return getWalkingRoute(origin, destination, options);

    case ROUTE_MODES.TRANSIT:
      return getTransitRoute(origin, destination, options);

    case ROUTE_MODES.MULTIMODAL: {
      // Get both walking and transit options in parallel
      const [walkRoute, transitRoute] = await Promise.allSettled([
        getWalkingRoute(origin, destination, options),
        getTransitRoute(origin, destination, options),
      ]);

      return {
        mode: 'multimodal',
        walking: walkRoute.status === 'fulfilled' ? walkRoute.value : null,
        transit: transitRoute.status === 'fulfilled' ? transitRoute.value : null,
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

/**
 * Snap a coordinate to the nearest road/path for a given mode.
 */
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

const { getRoute, snapCoordinate } = require('../services/routing/index');
const { findNearbyStops } = require('../services/routing/transitRouter');
const { checkRouteForHazards } = require('../services/hazardService');
const { geocode, reverseGeocode, autocomplete } = require('../services/geocoder');
const { ROUTE_MODES } = require('../config/constants');

/**
 * Route Controller — handles all routing and geocoding HTTP requests.
 */

/**
 * POST /api/route
 * Main routing endpoint. Accepts origin, destination, mode, and options.
 *
 * Body:
 * {
 *   "origin":      { "lat": 36.8065, "lng": 10.1815 },
 *   "destination": { "lat": 36.8190, "lng": 10.1658 },
 *   "mode":        "car" | "foot" | "transit" | "multimodal",
 *   "options": {
 *     "avoidHazards":     true,
 *     "maxWalkDistance":  800,
 *     "departureTime":    "14:30:00",
 *     "steps":            true
 *   }
 * }
 */
async function calculateRoute(req, res, next) {
  try {
    const { origin, destination, mode = ROUTE_MODES.CAR, options = {} } = req.body;

    const route = await getRoute(origin, destination, mode, options);

    // If hazard checking is enabled and we have a geometry, overlay hazards
    let hazardInfo = null;
    if (options.avoidHazards !== false) {
      const geometry = extractRouteGeometry(route);
      if (geometry) {
        hazardInfo = await checkRouteForHazards(geometry);
      }
    }

    res.json({
      success: true,
      data: {
        route,
        hazards: hazardInfo,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/route/snap?lng=10.18&lat=36.80&mode=car
 * Snap a coordinate to the nearest road/path.
 * Use this to validate a user-tapped coordinate before routing.
 */
async function snapPoint(req, res, next) {
  try {
    const { lng, lat, mode = 'car' } = req.query;

    const snapped = await snapCoordinate(parseFloat(lng), parseFloat(lat), mode);

    res.json({
      success: true,
      data: snapped,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/route/transit-stops?lng=10.18&lat=36.80&radius=600
 * Find nearby transit stops (used for map display and journey planning UI).
 */
async function getNearbyTransitStops(req, res, next) {
  try {
    const { lng, lat, radius = 600 } = req.query;

    const stops = await findNearbyStops(
      parseFloat(lng),
      parseFloat(lat),
      parseInt(radius)
    );

    res.json({
      success: true,
      data: { stops, count: stops.length },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/route/geocode?q=Avenue+Habib+Bourguiba
 * Forward geocoding — address to coordinates.
 */
async function geocodeAddress(req, res, next) {
  try {
    const { q, countrycodes, limit } = req.query;
    if (!q) return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });

    const results = await geocode(q, { countrycodes, limit: parseInt(limit) || 5 });

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/route/reverse-geocode?lat=36.80&lng=10.18
 * Reverse geocoding — coordinates to address.
 */
async function reverseGeocodePoint(req, res, next) {
  try {
    const { lat, lng } = req.query;
    const result = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/route/autocomplete?q=Avenue
 * Address autocomplete for search UI.
 */
async function autocompleteAddress(req, res, next) {
  try {
    const { q, countrycodes } = req.query;
    const results = await autocomplete(q, { countrycodes });
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

// --- Helpers ---

function extractRouteGeometry(route) {
  if (route?.geometry) return route.geometry;
  if (route?.walking?.geometry) return route.walking.geometry;
  return null;
}

module.exports = {
  calculateRoute,
  snapPoint,
  getNearbyTransitStops,
  geocodeAddress,
  reverseGeocodePoint,
  autocompleteAddress,
};

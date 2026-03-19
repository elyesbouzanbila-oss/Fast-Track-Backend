const router = require('express').Router();
const {
  calculateRoute,
  snapPoint,
  getNearbyTransitStops,
  geocodeAddress,
  reverseGeocodePoint,
  autocompleteAddress,
} = require('../controllers/routeController');
const { optionalAuth } = require('../middleware/auth');
const { validateRouteRequest, validateSnapRequest } = require('../middleware/validation');

/**
 * Route endpoints
 */

// POST /api/route — main routing (car / walk / transit / multimodal)
router.post('/', optionalAuth, validateRouteRequest, calculateRoute);

// GET /api/route/snap — snap coordinate to nearest road
router.get('/snap', validateSnapRequest, snapPoint);

// GET /api/route/transit-stops — nearby transit stops
router.get('/transit-stops', getNearbyTransitStops);

// GET /api/route/geocode — forward geocoding
router.get('/geocode', geocodeAddress);

// GET /api/route/reverse-geocode — reverse geocoding
router.get('/reverse-geocode', reverseGeocodePoint);

// GET /api/route/autocomplete — address autocomplete
router.get('/autocomplete', autocompleteAddress);

module.exports = router;

const router = require('express').Router();
const {
  listHazards,
  getHazard,
  reportHazard,
  updateHazard,
  deleteHazard,
  confirmHazardReport,
} = require('../controllers/hazardController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateHazardReport } = require('../middleware/validation');
const { ROLES } = require('../config/constants');

/**
 * Hazard endpoints
 */

// GET /api/hazards?minLng=&minLat=&maxLng=&maxLat=
router.get('/', listHazards);

// GET /api/hazards/:id
router.get('/:id', getHazard);

// POST /api/hazards — report a hazard (auth required)
router.post('/', authenticate, validateHazardReport, reportHazard);

// PUT /api/hazards/:id — update (reporter or admin)
router.put('/:id', authenticate, updateHazard);

// DELETE /api/hazards/:id — admin only
router.delete('/:id', authenticate, requireRole(ROLES.ADMIN), deleteHazard);

// POST /api/hazards/:id/confirm — community confirmation
router.post('/:id/confirm', authenticate, confirmHazardReport);

module.exports = router;

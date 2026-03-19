const {
  getHazardsInBbox,
  createHazard,
  confirmHazard,
  getHazardsAlongRoute,
} = require('../services/hazardService');
const Hazard = require('../models/Hazard');
const { ROLES } = require('../config/constants');

/**
 * Hazard Controller — CRUD for hazard reports.
 */

/**
 * GET /api/hazards?minLng=&minLat=&maxLng=&maxLat=
 * List hazards within a bounding box (for map display).
 */
async function listHazards(req, res, next) {
  try {
    const { minLng, minLat, maxLng, maxLat } = req.query;

    if (!minLng || !minLat || !maxLng || !maxLat) {
      return res.status(400).json({
        success: false,
        error: 'Bounding box parameters required: minLng, minLat, maxLng, maxLat',
      });
    }

    const hazards = await getHazardsInBbox(
      parseFloat(minLng),
      parseFloat(minLat),
      parseFloat(maxLng),
      parseFloat(maxLat)
    );

    res.json({ success: true, data: hazards, count: hazards.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/hazards/:id
 * Get a single hazard by ID.
 */
async function getHazard(req, res, next) {
  try {
    const hazard = await Hazard.findByPk(req.params.id);
    if (!hazard) {
      return res.status(404).json({ success: false, error: 'Hazard not found' });
    }
    res.json({ success: true, data: hazard });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/hazards
 * Report a new hazard. Requires authentication.
 *
 * Body: { type, severity, description, lat, lng, radius_meters, expires_at }
 */
async function reportHazard(req, res, next) {
  try {
    const hazard = await createHazard(req.body, req.user.id);
    res.status(201).json({ success: true, data: hazard });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/hazards/:id
 * Update a hazard. Only the reporter or an admin can update.
 */
async function updateHazard(req, res, next) {
  try {
    const hazard = await Hazard.findByPk(req.params.id);
    if (!hazard) {
      return res.status(404).json({ success: false, error: 'Hazard not found' });
    }

    // Only reporter or admin
    if (hazard.reported_by !== req.user.id && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const allowed = ['severity', 'description', 'radius_meters', 'expires_at', 'is_active'];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    await hazard.update(updates);
    res.json({ success: true, data: hazard });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/hazards/:id
 * Soft-delete a hazard (set is_active = false). Admin only.
 */
async function deleteHazard(req, res, next) {
  try {
    if (req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, error: 'Admin role required' });
    }

    const hazard = await Hazard.findByPk(req.params.id);
    if (!hazard) {
      return res.status(404).json({ success: false, error: 'Hazard not found' });
    }

    await hazard.update({ is_active: false });
    res.json({ success: true, message: 'Hazard deactivated' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/hazards/:id/confirm
 * Community confirmation that a hazard is still present.
 */
async function confirmHazardReport(req, res, next) {
  try {
    const updated = await confirmHazard(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Hazard not found or inactive' });
    }
    res.json({ success: true, message: 'Hazard confirmed' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listHazards,
  getHazard,
  reportHazard,
  updateHazard,
  deleteHazard,
  confirmHazardReport,
};

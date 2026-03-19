const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const Hazard = require('../models/Hazard');

/**
 * Hazard Service — manages road hazard data and filtering.
 * Hazards are used to avoid or penalize dangerous route segments.
 */

/**
 * Get all active hazards within a bounding box.
 * Used to overlay hazards on a map view.
 */
async function getHazardsInBbox(minLng, minLat, maxLng, maxLat) {
  const hazards = await sequelize.query(
    `
    SELECT
      h.id, h.type, h.severity, h.description,
      ST_X(h.location::geometry) AS lng,
      ST_Y(h.location::geometry) AS lat,
      h.radius_meters,
      h.confirmation_count,
      h.expires_at,
      h.created_at
    FROM hazards h
    WHERE h.is_active = true
      AND (h.expires_at IS NULL OR h.expires_at > NOW())
      AND h.location && ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326)
    ORDER BY h.severity DESC, h.created_at DESC
    `,
    {
      replacements: { minLng, minLat, maxLng, maxLat },
      type: QueryTypes.SELECT,
    }
  );
  return hazards;
}

/**
 * Get hazards along a route geometry.
 * Takes a GeoJSON LineString and returns hazards within a buffer of the route.
 * @param {object} routeGeometry - GeoJSON LineString
 * @param {number} bufferMeters - how close to the route to check
 */
async function getHazardsAlongRoute(routeGeometry, bufferMeters = 100) {
  const geojsonStr = JSON.stringify(routeGeometry);

  const hazards = await sequelize.query(
    `
    SELECT
      h.id, h.type, h.severity, h.description,
      ST_X(h.location::geometry) AS lng,
      ST_Y(h.location::geometry) AS lat,
      h.radius_meters,
      h.confirmation_count,
      ST_Distance(
        h.location::geography,
        ST_GeomFromGeoJSON(:routeGeom)::geography
      ) AS distance_to_route
    FROM hazards h
    WHERE h.is_active = true
      AND (h.expires_at IS NULL OR h.expires_at > NOW())
      AND ST_DWithin(
        h.location::geography,
        ST_GeomFromGeoJSON(:routeGeom)::geography,
        :buffer
      )
    ORDER BY h.severity DESC
    `,
    {
      replacements: { routeGeom: geojsonStr, buffer: bufferMeters },
      type: QueryTypes.SELECT,
    }
  );

  return hazards;
}

/**
 * Create a new hazard report.
 */
async function createHazard(data, userId) {
  const hazard = await Hazard.create({
    type: data.type,
    severity: data.severity,
    description: data.description,
    location: {
      type: 'Point',
      coordinates: [data.lng, data.lat],
    },
    radius_meters: data.radius_meters || 50,
    reported_by: userId,
    expires_at: data.expires_at || null,
  });
  return hazard;
}

/**
 * Confirm a hazard (community upvote).
 */
async function confirmHazard(hazardId) {
  const [updated] = await Hazard.update(
    { confirmation_count: sequelize.literal('confirmation_count + 1') },
    { where: { id: hazardId, is_active: true } }
  );
  return updated > 0;
}

/**
 * Check if a route passes through any critical hazards.
 * Returns a warning flag and list of blocking hazards.
 */
async function checkRouteForHazards(routeGeometry) {
  const hazards = await getHazardsAlongRoute(routeGeometry, 50);
  const critical = hazards.filter((h) => h.severity === 'critical' || h.severity === 'high');
  return {
    hasHazards: hazards.length > 0,
    hasCriticalHazards: critical.length > 0,
    hazards,
    criticalHazards: critical,
  };
}

module.exports = {
  getHazardsInBbox,
  getHazardsAlongRoute,
  createHazard,
  confirmHazard,
  checkRouteForHazards,
};

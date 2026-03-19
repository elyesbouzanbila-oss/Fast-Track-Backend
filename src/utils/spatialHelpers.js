const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Spatial Helpers — PostGIS utility functions.
 * These functions leverage PostGIS for server-side spatial operations,
 * which is more accurate and efficient than doing them in JavaScript.
 */

/**
 * Check if a point falls inside a water body (lake, ocean, river).
 * Uses PostGIS with a pre-loaded water polygon layer (e.g. from OSM).
 * Returns true if the point is on water — used to reject invalid routing targets.
 *
 * NOTE: Requires a 'water_polygons' table loaded from OSM data.
 * If the table doesn't exist, defaults to false (no check).
 */
async function isPointOnWater(lng, lat) {
  try {
    const [result] = await sequelize.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM water_polygons
        WHERE ST_Within(
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
          geom
        )
      ) AS on_water
      `,
      { replacements: { lng, lat }, type: QueryTypes.SELECT }
    );
    return result?.on_water === true;
  } catch (_) {
    // Table may not exist — skip check
    return false;
  }
}

/**
 * Check if a point is on a motorway/highway where pedestrians are forbidden.
 * Uses PostGIS with OSM road data.
 *
 * NOTE: Requires an 'osm_roads' table with highway type.
 */
async function isPointOnHighwayOnly(lng, lat, bufferMeters = 20) {
  try {
    const [result] = await sequelize.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM osm_roads
        WHERE highway IN ('motorway', 'motorway_link', 'trunk', 'trunk_link')
          AND ST_DWithin(
            geom::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            :buffer
          )
      ) AS on_highway
      `,
      { replacements: { lng, lat, buffer: bufferMeters }, type: QueryTypes.SELECT }
    );
    return result?.on_highway === true;
  } catch (_) {
    return false;
  }
}

/**
 * Snap a point to the nearest road in the database.
 * Fallback for when OSRM is unavailable.
 */
async function snapToNearestRoad(lng, lat) {
  try {
    const [result] = await sequelize.query(
      `
      SELECT
        ST_X(ST_ClosestPoint(geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))) AS snapped_lng,
        ST_Y(ST_ClosestPoint(geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))) AS snapped_lat,
        ST_Distance(
          geom::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        ) AS distance
      FROM osm_roads
      ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
      LIMIT 1
      `,
      { replacements: { lng, lat }, type: QueryTypes.SELECT }
    );
    return result;
  } catch (_) {
    return null;
  }
}

/**
 * Calculate bounding box from a GeoJSON geometry.
 * @param {object} geojson - GeoJSON geometry
 * @returns {{ minLng, minLat, maxLng, maxLat }}
 */
function getBoundingBox(geojson) {
  const coords = extractCoordinates(geojson);
  const lngs = coords.map(([lng]) => lng);
  const lats = coords.map(([, lat]) => lat);
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

function extractCoordinates(geojson) {
  if (geojson.type === 'Point') return [geojson.coordinates];
  if (geojson.type === 'LineString') return geojson.coordinates;
  if (geojson.type === 'Polygon') return geojson.coordinates.flat();
  if (geojson.type === 'MultiLineString') return geojson.coordinates.flat();
  return [];
}

/**
 * Build a PostGIS point expression string.
 */
function makePointExpr(lng, lat) {
  return `ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)`;
}

module.exports = {
  isPointOnWater,
  isPointOnHighwayOnly,
  snapToNearestRoad,
  getBoundingBox,
  makePointExpr,
};

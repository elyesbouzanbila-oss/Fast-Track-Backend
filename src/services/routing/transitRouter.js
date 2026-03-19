const { sequelize } = require('../../config/database');
const { QueryTypes } = require('sequelize');
const { TRANSIT_STOP_SEARCH_RADIUS, DEFAULT_MAX_WALK_DISTANCE } = require('../../config/constants');

/**
 * Transit Router — plans journeys using public transit (Bus, Train, Metro).
 *
 * Strategy:
 * 1. Find transit stops near origin (within walking distance)
 * 2. Find transit stops near destination
 * 3. Query the DB for trips that connect origin-area stops to destination-area stops
 * 4. Sort by earliest arrival
 * 5. Build multimodal leg: Walk → Transit → Walk
 *
 * This uses a simplified Connection Scan Algorithm (CSA) approach.
 * For production, replace with a full CSA or Raptor implementation.
 */

/**
 * Find all transit stops within a given radius of a point.
 * Uses PostGIS ST_DWithin for fast spatial query.
 */
async function findNearbyStops(lng, lat, radiusMeters = TRANSIT_STOP_SEARCH_RADIUS) {
  const stops = await sequelize.query(
    `
    SELECT
      s.id,
      s.name,
      s.location_type,
      ST_X(s.location::geometry) AS lng,
      ST_Y(s.location::geometry) AS lat,
      ST_Distance(
        s.location::geography,
        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
      ) AS distance_meters
    FROM transit_stops s
    WHERE ST_DWithin(
      s.location::geography,
      ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
      :radius
    )
    ORDER BY distance_meters ASC
    LIMIT 10
    `,
    {
      replacements: { lng, lat, radius: radiusMeters },
      type: QueryTypes.SELECT,
    }
  );
  return stops;
}

/**
 * Find transit connections between a set of origin stops and destination stops
 * for a given departure time window.
 *
 * @param {string[]} originStopIds
 * @param {string[]} destStopIds
 * @param {string} departureTime - HH:MM:SS
 * @param {string} serviceDate - YYYY-MM-DD (to filter by operating day)
 */
async function findConnections(originStopIds, destStopIds, departureTime, serviceDate) {
  if (!originStopIds.length || !destStopIds.length) return [];

  // Find trips that visit an origin stop AND a destination stop,
  // where the origin stop is visited BEFORE the destination stop,
  // and departure is after the requested time.
  const connections = await sequelize.query(
    `
    SELECT
      ost.trip_id,
      ost.stop_id          AS board_stop_id,
      bs.name              AS board_stop_name,
      ST_X(bs.location::geometry) AS board_stop_lng,
      ST_Y(bs.location::geometry) AS board_stop_lat,
      ost.departure_time   AS departure_time,
      dst.stop_id          AS alight_stop_id,
      als.name             AS alight_stop_name,
      ST_X(als.location::geometry) AS alight_stop_lng,
      ST_Y(als.location::geometry) AS alight_stop_lat,
      dst.arrival_time     AS arrival_time,
      tr.short_name        AS route_short_name,
      tr.long_name         AS route_long_name,
      tr.route_type,
      tr.color             AS route_color,
      t.headsign
    FROM transit_stop_times ost
    JOIN transit_stop_times dst
      ON ost.trip_id = dst.trip_id
      AND dst.stop_sequence > ost.stop_sequence
    JOIN transit_trips t ON ost.trip_id = t.id
    JOIN transit_routes tr ON t.route_id = tr.id
    JOIN transit_stops bs ON ost.stop_id = bs.id
    JOIN transit_stops als ON dst.stop_id = als.id
    WHERE ost.stop_id = ANY(:originStops)
      AND dst.stop_id = ANY(:destStops)
      AND ost.departure_time >= :departureTime
    ORDER BY ost.departure_time ASC
    LIMIT 20
    `,
    {
      replacements: {
        originStops: originStopIds,
        destStops: destStopIds,
        departureTime,
      },
      type: QueryTypes.SELECT,
    }
  );

  return connections;
}

/**
 * Plan a transit journey between origin and destination.
 * Returns a list of transit options sorted by arrival time.
 */
async function getTransitRoute(origin, destination, options = {}) {
  const maxWalkDistance = options.maxWalkDistance || DEFAULT_MAX_WALK_DISTANCE;
  const departureTime = options.departureTime || getCurrentTimeString();

  // Step 1: Find nearby stops
  const [originStops, destStops] = await Promise.all([
    findNearbyStops(origin.lng, origin.lat, maxWalkDistance),
    findNearbyStops(destination.lng, destination.lat, maxWalkDistance),
  ]);

  if (!originStops.length) {
    throw new Error('No transit stops found near your origin within walking distance.');
  }
  if (!destStops.length) {
    throw new Error('No transit stops found near your destination within walking distance.');
  }

  // Step 2: Find transit connections
  const originStopIds = originStops.map((s) => s.id);
  const destStopIds = destStops.map((s) => s.id);

  const connections = await findConnections(
    originStopIds,
    destStopIds,
    departureTime,
    options.serviceDate
  );

  if (!connections.length) {
    throw new Error('No transit connections found for the requested time. Try a different departure time.');
  }

  // Step 3: Build journey legs for top results
  const journeys = await Promise.all(
    connections.slice(0, 5).map(async (conn) => {
      // Walk to board stop
      const walkToBoard = {
        mode: 'walk',
        from: origin,
        to: { lat: conn.board_stop_lat, lng: conn.board_stop_lng, name: conn.board_stop_name },
        distance: originStops.find((s) => s.id === conn.board_stop_id)?.distance_meters || 0,
        duration: estimateWalkDuration(
          originStops.find((s) => s.id === conn.board_stop_id)?.distance_meters || 0
        ),
      };

      // Transit leg
      const transitLeg = {
        mode: 'transit',
        from: { lat: conn.board_stop_lat, lng: conn.board_stop_lng, name: conn.board_stop_name, stop_id: conn.board_stop_id },
        to: { lat: conn.alight_stop_lat, lng: conn.alight_stop_lng, name: conn.alight_stop_name, stop_id: conn.alight_stop_id },
        trip_id: conn.trip_id,
        route: {
          short_name: conn.route_short_name,
          long_name: conn.route_long_name,
          type: conn.route_type,
          color: conn.route_color,
          headsign: conn.headsign,
        },
        departure_time: conn.departure_time,
        arrival_time: conn.arrival_time,
        duration: timeDiffSeconds(conn.departure_time, conn.arrival_time),
      };

      // Walk from alight stop to destination
      const walkFromAlight = {
        mode: 'walk',
        from: { lat: conn.alight_stop_lat, lng: conn.alight_stop_lng, name: conn.alight_stop_name },
        to: destination,
        distance: destStops.find((s) => s.id === conn.alight_stop_id)?.distance_meters || 0,
        duration: estimateWalkDuration(
          destStops.find((s) => s.id === conn.alight_stop_id)?.distance_meters || 0
        ),
      };

      const totalDuration =
        walkToBoard.duration + transitLeg.duration + walkFromAlight.duration;

      return {
        legs: [walkToBoard, transitLeg, walkFromAlight],
        departure_time: conn.departure_time,
        arrival_time: conn.arrival_time,
        total_duration: totalDuration,
        total_walk_distance: walkToBoard.distance + walkFromAlight.distance,
      };
    })
  );

  return {
    mode: 'transit',
    journeys,
    nearby_origin_stops: originStops,
    nearby_dest_stops: destStops,
  };
}

// --- Helpers ---

function getCurrentTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
}

function timeDiffSeconds(timeA, timeB) {
  const toSecs = (t) => {
    const [h, m, s] = t.split(':').map(Number);
    return h * 3600 + m * 60 + (s || 0);
  };
  return Math.max(0, toSecs(timeB) - toSecs(timeA));
}

// Average walking speed: 1.4 m/s
function estimateWalkDuration(distanceMeters) {
  return Math.round(distanceMeters / 1.4);
}

module.exports = { getTransitRoute, findNearbyStops };

require('dotenv').config();

/**
 * OSRM instance configuration.
 * Each profile (car, foot, bike) points to its own OSRM server.
 * OSRM is the routing engine — it computes actual turn-by-turn road routes
 * using pre-processed OpenStreetMap data.
 */
const osrmConfig = {
  car: {
    url: process.env.OSRM_CAR_URL || 'http://localhost:5000',
    profile: 'car',
    // Car-specific options: avoids pedestrian ways, respects one-ways, etc.
  },
  foot: {
    url: process.env.OSRM_FOOT_URL || 'http://localhost:5001',
    profile: 'foot',
    // Foot profile: uses footpaths, pedestrian zones, avoids highways
  },
  bike: {
    url: process.env.OSRM_BIKE_URL || 'http://localhost:5002',
    profile: 'bike',
  },
};

/**
 * Build an OSRM route URL for a given profile.
 * @param {string} profile - 'car' | 'foot' | 'bike'
 * @param {Array} coordinates - [[lng, lat], [lng, lat], ...]
 * @param {object} options
 */
function buildOsrmRouteUrl(profile, coordinates, options = {}) {
  const base = osrmConfig[profile]?.url;
  if (!base) throw new Error(`Unknown OSRM profile: ${profile}`);

  const coordStr = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';');

  const params = new URLSearchParams({
    overview: options.overview || 'full',
    geometries: 'geojson',
    steps: options.steps ? 'true' : 'false',
    annotations: 'false',
  });

  return `${base}/route/v1/${profile}/${coordStr}?${params.toString()}`;
}

/**
 * Build an OSRM nearest URL — snaps a coordinate to the closest road node.
 * This is critical for preventing routing to impossible locations.
 * @param {string} profile
 * @param {number} lng
 * @param {number} lat
 */
function buildOsrmNearestUrl(profile, lng, lat) {
  const base = osrmConfig[profile]?.url;
  if (!base) throw new Error(`Unknown OSRM profile: ${profile}`);
  return `${base}/nearest/v1/${profile}/${lng},${lat}?number=1`;
}

module.exports = { osrmConfig, buildOsrmRouteUrl, buildOsrmNearestUrl };

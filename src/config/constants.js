/**
 * Application-wide constants.
 */

module.exports = {
  // Routing modes
  ROUTE_MODES: {
    CAR: 'car',
    WALK: 'foot',
    BIKE: 'bike',
    TRANSIT: 'transit',       // Pure public transit
    MULTIMODAL: 'multimodal', // Walk + Transit combinations
  },

  // Transit vehicle types (matching GTFS route_type values)
  TRANSIT_TYPES: {
    TRAM: 0,
    METRO: 1,
    RAIL: 2,
    BUS: 3,
    FERRY: 4,
    CABLE_CAR: 5,
    GONDOLA: 6,
    FUNICULAR: 7,
  },

  TRANSIT_TYPE_LABELS: {
    0: 'Tram',
    1: 'Metro',
    2: 'Train',
    3: 'Bus',
    4: 'Ferry',
    5: 'Cable Car',
    6: 'Gondola',
    7: 'Funicular',
  },

  // Hazard severity levels
  HAZARD_SEVERITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },

  // Hazard types
  HAZARD_TYPES: {
    ROAD_CLOSURE: 'road_closure',
    FLOODING: 'flooding',
    CONSTRUCTION: 'construction',
    ACCIDENT: 'accident',
    POTHOLE: 'pothole',
    LANDSLIDE: 'landslide',
    UNSAFE_AREA: 'unsafe_area',
    OTHER: 'other',
  },

  // Maximum walking distance to a transit stop (meters)
  DEFAULT_MAX_WALK_DISTANCE: 800,

  // Maximum snap distance to nearest road (meters)
  // If no road is found within this distance, the point is considered unreachable
  MAX_SNAP_DISTANCE_METERS: 500,

  // Radius for nearby transit stop search (meters)
  TRANSIT_STOP_SEARCH_RADIUS: 600,

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // JWT
  JWT_ALGORITHM: 'HS256',

  // User roles
  ROLES: {
    USER: 'user',
    ADMIN: 'admin',
  },
};

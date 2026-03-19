const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { HAZARD_TYPES, HAZARD_SEVERITY } = require('../config/constants');

/**
 * Hazard model — stores user-reported or imported road hazards.
 * Location is stored as a PostGIS POINT geometry for spatial queries.
 * The routing engine uses hazards to penalize or avoid dangerous segments.
 */
const Hazard = sequelize.define('Hazard', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM(...Object.values(HAZARD_TYPES)),
    allowNull: false,
  },
  severity: {
    type: DataTypes.ENUM(...Object.values(HAZARD_SEVERITY)),
    defaultValue: HAZARD_SEVERITY.MEDIUM,
  },
  description: {
    type: DataTypes.TEXT,
  },
  // PostGIS geometry column — stored as WKT string from Sequelize's perspective
  // The actual column type is geometry(Point, 4326) set via migration/raw SQL
  location: {
    type: DataTypes.GEOMETRY('POINT', 4326),
    allowNull: false,
  },
  // Radius of effect in meters (default 50m)
  radius_meters: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
  },
  reported_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' },
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  expires_at: {
    type: DataTypes.DATE,
  },
  // Upvotes from community confirming the hazard
  confirmation_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'hazards',
  underscored: true,
  timestamps: true,
  indexes: [
    // Spatial index for fast bounding-box queries
    {
      fields: ['location'],
      using: 'GIST',
      name: 'hazards_location_gist',
    },
  ],
});

module.exports = Hazard;

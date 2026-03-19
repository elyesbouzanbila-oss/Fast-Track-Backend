const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { TRANSIT_TYPES } = require('../config/constants');

/**
 * TransitRoute — a named public transit line (e.g. "Bus 12", "Metro Line A").
 * Maps to GTFS routes.txt.
 */
const TransitRoute = sequelize.define('TransitRoute', {
  id: {
    type: DataTypes.STRING(50),
    primaryKey: true, // GTFS route_id
  },
  agency_id: {
    type: DataTypes.STRING(50),
  },
  short_name: {
    type: DataTypes.STRING(50), // e.g. "12", "A", "Red Line"
  },
  long_name: {
    type: DataTypes.STRING(255), // e.g. "City Center - Airport"
  },
  description: {
    type: DataTypes.TEXT,
  },
  // GTFS route_type: 0=Tram, 1=Metro, 2=Rail, 3=Bus, etc.
  route_type: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      isIn: [Object.values(TRANSIT_TYPES)],
    },
  },
  color: {
    type: DataTypes.STRING(6), // Hex color without #
    defaultValue: '000000',
  },
  text_color: {
    type: DataTypes.STRING(6),
    defaultValue: 'FFFFFF',
  },
  url: {
    type: DataTypes.STRING(500),
  },
}, {
  tableName: 'transit_routes',
  underscored: true,
  timestamps: false,
  indexes: [
    { fields: ['route_type'] },
    { fields: ['agency_id'] },
  ],
});

module.exports = TransitRoute;

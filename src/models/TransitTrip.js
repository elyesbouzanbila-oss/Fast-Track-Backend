const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * TransitTrip — a specific scheduled run of a route.
 * Maps to GTFS trips.txt.
 * A route can have many trips (e.g. "Bus 12" at 08:00, 08:30, 09:00...).
 */
const TransitTrip = sequelize.define('TransitTrip', {
  id: {
    type: DataTypes.STRING(50),
    primaryKey: true, // GTFS trip_id
  },
  route_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: { model: 'transit_routes', key: 'id' },
  },
  service_id: {
    type: DataTypes.STRING(50),
    allowNull: false, // Links to GTFS calendar.txt for operating days
  },
  headsign: {
    type: DataTypes.STRING(255), // Display text, e.g. "Airport Terminal 2"
  },
  short_name: {
    type: DataTypes.STRING(50),
  },
  direction_id: {
    type: DataTypes.INTEGER, // 0 or 1 (outbound/inbound)
    defaultValue: 0,
  },
  block_id: {
    type: DataTypes.STRING(50),
  },
  shape_id: {
    type: DataTypes.STRING(50), // Links to GTFS shapes.txt
  },
  wheelchair_accessible: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  bikes_allowed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'transit_trips',
  underscored: true,
  timestamps: false,
  indexes: [
    { fields: ['route_id'] },
    { fields: ['service_id'] },
  ],
});

module.exports = TransitTrip;

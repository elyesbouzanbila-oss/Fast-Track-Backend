const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * TransitStop — a physical location where passengers board/alight.
 * Maps to GTFS stops.txt.
 * Location stored as PostGIS POINT for spatial proximity queries.
 */
const TransitStop = sequelize.define('TransitStop', {
  id: {
    type: DataTypes.STRING(50),
    primaryKey: true, // GTFS stop_id
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  location: {
    type: DataTypes.GEOMETRY('POINT', 4326),
    allowNull: false,
  },
  // 0=stop, 1=station, 2=entrance
  location_type: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // If this stop belongs to a parent station
  parent_station_id: {
    type: DataTypes.STRING(50),
  },
  wheelchair_boarding: {
    type: DataTypes.INTEGER, // 0=unknown, 1=accessible, 2=not accessible
    defaultValue: 0,
  },
  platform_code: {
    type: DataTypes.STRING(20),
  },
  timezone: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'transit_stops',
  underscored: true,
  timestamps: false,
  indexes: [
    {
      fields: ['location'],
      using: 'GIST',
      name: 'transit_stops_location_gist',
    },
    {
      fields: ['name'],
      name: 'transit_stops_name_idx',
    },
  ],
});

module.exports = TransitStop;

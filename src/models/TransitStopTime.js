const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * TransitStopTime — the scheduled arrival/departure at each stop for a trip.
 * Maps to GTFS stop_times.txt.
 * This is the most data-heavy table — millions of rows for real networks.
 *
 * Note on times: GTFS times can exceed 24:00:00 (e.g. 25:30:00 means
 * 01:30 the next service day). We store as strings to preserve this.
 */
const TransitStopTime = sequelize.define('TransitStopTime', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  trip_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: { model: 'transit_trips', key: 'id' },
  },
  stop_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: { model: 'transit_stops', key: 'id' },
  },
  // HH:MM:SS — may exceed 24:00:00
  arrival_time: {
    type: DataTypes.STRING(8),
    allowNull: false,
  },
  departure_time: {
    type: DataTypes.STRING(8),
    allowNull: false,
  },
  stop_sequence: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  stop_headsign: {
    type: DataTypes.STRING(255),
  },
  // 0=regular, 1=no pickup, 2=must phone, 3=must coordinate with driver
  pickup_type: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  drop_off_type: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  shape_dist_traveled: {
    type: DataTypes.FLOAT,
  },
  timepoint: {
    type: DataTypes.INTEGER,
    defaultValue: 1, // 1=exact time, 0=approximate
  },
}, {
  tableName: 'transit_stop_times',
  underscored: true,
  timestamps: false,
  indexes: [
    { fields: ['trip_id', 'stop_sequence'] },
    { fields: ['stop_id'] },
    { fields: ['departure_time'] },
  ],
});

module.exports = TransitStopTime;

/**
 * Database migration script.
 * Creates all tables, PostGIS extensions, and indexes from scratch.
 * Run once before starting the server for the first time.
 *
 * Usage: node scripts/migrate.js
 */
require('dotenv').config();
const { sequelize, initDatabase } = require('../src/config/database');

require('../src/models/User');
require('../src/models/Hazard');
require('../src/models/TransitStop');
require('../src/models/TransitRoute');
require('../src/models/TransitTrip');
require('../src/models/TransitStopTime');

async function migrate() {
  console.log('🔄 Running database migrations...\n');

  await initDatabase();

  // force: false means it won't drop existing tables
  // alter: true means it will ADD new columns if the model changes
  await sequelize.sync({ alter: true });

  // Ensure GIST spatial indexes exist (Sequelize may not create them automatically)
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS hazards_location_gist
    ON hazards USING GIST (location);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS transit_stops_location_gist
    ON transit_stops USING GIST (location);
  `);

  // Index for fast time-based transit queries
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS stop_times_departure_idx
    ON transit_stop_times (departure_time);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS stop_times_trip_seq_idx
    ON transit_stop_times (trip_id, stop_sequence);
  `);

  console.log('\n✅ Migrations complete.');
  await sequelize.close();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

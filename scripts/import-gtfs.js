/**
 * import-gtfs.js
 * CLI script to import a GTFS dataset into the database.
 *
 * Usage:
 *   node scripts/import-gtfs.js [path/to/gtfs/folder]
 *
 * If no path is given, uses GTFS_DATA_PATH from .env (default: ./data/gtfs)
 */
require('dotenv').config();
const path = require('path');
const { initDatabase, sequelize } = require('../src/config/database');
const { importGtfs } = require('../src/services/gtfsImporter');

async function main() {
  const gtfsDir = process.argv[2] || process.env.GTFS_DATA_PATH || './data/gtfs';
  const absolutePath = path.resolve(gtfsDir);

  console.log(`\n📦 GTFS Importer`);
  console.log(`   Source: ${absolutePath}\n`);

  await initDatabase();

  // Sync models so tables exist
  const { sequelize: db } = require('../src/config/database');
  require('../src/models/TransitStop');
  require('../src/models/TransitRoute');
  require('../src/models/TransitTrip');
  require('../src/models/TransitStopTime');
  await db.sync({ alter: true });

  await importGtfs(absolutePath);

  await sequelize.close();
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});

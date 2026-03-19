const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { sequelize } = require('../config/database');
const TransitStop = require('../models/TransitStop');
const TransitRoute = require('../models/TransitRoute');
const TransitTrip = require('../models/TransitTrip');
const TransitStopTime = require('../models/TransitStopTime');

/**
 * GTFS Importer — reads GTFS text files and bulk-inserts into PostgreSQL.
 *
 * GTFS (General Transit Feed Specification) is the universal format for
 * public transit data. Transit agencies publish their schedules as GTFS feeds.
 *
 * Files processed:
 *   stops.txt       → TransitStop
 *   routes.txt      → TransitRoute
 *   trips.txt       → TransitTrip
 *   stop_times.txt  → TransitStopTime (largest file — streamed in batches)
 */

const BATCH_SIZE = 1000;

/**
 * Parse a CSV file into an array of objects.
 */
function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    if (!fs.existsSync(filePath)) {
      return resolve([]); // File optional in some GTFS feeds
    }
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

/**
 * Insert rows in batches to avoid overwhelming the DB.
 */
async function batchInsert(model, rows, options = {}) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await model.bulkCreate(batch, {
      ignoreDuplicates: true,
      ...options,
    });
    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${rows.length}`);
  }
  console.log('');
  return inserted;
}

/**
 * Import stops.txt
 */
async function importStops(gtfsDir) {
  console.log('📍 Importing stops...');
  const rows = await parseCsv(path.join(gtfsDir, 'stops.txt'));

  const stops = rows.map((r) => ({
    id: r.stop_id,
    name: r.stop_name,
    description: r.stop_desc || null,
    location: {
      type: 'Point',
      coordinates: [parseFloat(r.stop_lon), parseFloat(r.stop_lat)],
    },
    location_type: parseInt(r.location_type) || 0,
    parent_station_id: r.parent_station || null,
    wheelchair_boarding: parseInt(r.wheelchair_boarding) || 0,
    platform_code: r.platform_code || null,
    timezone: r.stop_timezone || null,
  }));

  return batchInsert(TransitStop, stops);
}

/**
 * Import routes.txt
 */
async function importRoutes(gtfsDir) {
  console.log('🚌 Importing routes...');
  const rows = await parseCsv(path.join(gtfsDir, 'routes.txt'));

  const routes = rows.map((r) => ({
    id: r.route_id,
    agency_id: r.agency_id || null,
    short_name: r.route_short_name || null,
    long_name: r.route_long_name || null,
    description: r.route_desc || null,
    route_type: parseInt(r.route_type),
    color: r.route_color || '000000',
    text_color: r.route_text_color || 'FFFFFF',
    url: r.route_url || null,
  }));

  return batchInsert(TransitRoute, routes);
}

/**
 * Import trips.txt
 */
async function importTrips(gtfsDir) {
  console.log('🗓️  Importing trips...');
  const rows = await parseCsv(path.join(gtfsDir, 'trips.txt'));

  const trips = rows.map((r) => ({
    id: r.trip_id,
    route_id: r.route_id,
    service_id: r.service_id,
    headsign: r.trip_headsign || null,
    short_name: r.trip_short_name || null,
    direction_id: parseInt(r.direction_id) || 0,
    block_id: r.block_id || null,
    shape_id: r.shape_id || null,
    wheelchair_accessible: parseInt(r.wheelchair_accessible) || 0,
    bikes_allowed: parseInt(r.bikes_allowed) || 0,
  }));

  return batchInsert(TransitTrip, trips);
}

/**
 * Import stop_times.txt — streamed due to potentially millions of rows.
 */
async function importStopTimes(gtfsDir) {
  console.log('⏱️  Importing stop times (this may take a while)...');
  const filePath = path.join(gtfsDir, 'stop_times.txt');
  if (!fs.existsSync(filePath)) {
    console.log('  stop_times.txt not found, skipping.');
    return 0;
  }

  return new Promise((resolve, reject) => {
    let batch = [];
    let total = 0;

    const processBatch = async () => {
      if (!batch.length) return;
      await TransitStopTime.bulkCreate(batch, { ignoreDuplicates: true });
      total += batch.length;
      process.stdout.write(`\r  Inserted ${total} stop times...`);
      batch = [];
    };

    const stream = fs.createReadStream(filePath).pipe(csv());

    stream.on('data', async (r) => {
      batch.push({
        trip_id: r.trip_id,
        stop_id: r.stop_id,
        arrival_time: r.arrival_time,
        departure_time: r.departure_time,
        stop_sequence: parseInt(r.stop_sequence),
        stop_headsign: r.stop_headsign || null,
        pickup_type: parseInt(r.pickup_type) || 0,
        drop_off_type: parseInt(r.drop_off_type) || 0,
        shape_dist_traveled: r.shape_dist_traveled ? parseFloat(r.shape_dist_traveled) : null,
        timepoint: parseInt(r.timepoint) || 1,
      });

      if (batch.length >= BATCH_SIZE) {
        stream.pause();
        await processBatch();
        stream.resume();
      }
    });

    stream.on('end', async () => {
      await processBatch();
      console.log(`\n  ✅ Done: ${total} stop times`);
      resolve(total);
    });

    stream.on('error', reject);
  });
}

/**
 * Run a full GTFS import.
 * @param {string} gtfsDir - path to directory containing GTFS .txt files
 */
async function importGtfs(gtfsDir) {
  console.log(`\n🚀 Starting GTFS import from: ${gtfsDir}\n`);

  const stopsCount = await importStops(gtfsDir);
  console.log(`  ✅ ${stopsCount} stops imported`);

  const routesCount = await importRoutes(gtfsDir);
  console.log(`  ✅ ${routesCount} routes imported`);

  const tripsCount = await importTrips(gtfsDir);
  console.log(`  ✅ ${tripsCount} trips imported`);

  await importStopTimes(gtfsDir);

  console.log('\n✅ GTFS import complete.');
}

module.exports = { importGtfs, importStops, importRoutes, importTrips, importStopTimes };

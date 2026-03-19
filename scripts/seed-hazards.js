/**
 * seed-hazards.js
 * Seeds the database with sample hazard data for development/testing.
 * Demonstrates all hazard types and severity levels.
 */
require('dotenv').config();
const { initDatabase, sequelize } = require('../src/config/database');
const Hazard = require('../src/models/Hazard');
const User = require('../src/models/User');

const SAMPLE_HAZARDS = [
  {
    type: 'road_closure',
    severity: 'critical',
    description: 'Full road closure due to bridge repair',
    lat: 36.8192,
    lng: 10.1659,
    radius_meters: 200,
  },
  {
    type: 'flooding',
    severity: 'high',
    description: 'Road flooded after heavy rain — impassable',
    lat: 36.8050,
    lng: 10.1790,
    radius_meters: 100,
  },
  {
    type: 'construction',
    severity: 'medium',
    description: 'Lane narrowing due to utility works',
    lat: 36.8120,
    lng: 10.1710,
    radius_meters: 80,
  },
  {
    type: 'accident',
    severity: 'high',
    description: 'Multi-vehicle accident, emergency services present',
    lat: 36.8085,
    lng: 10.1825,
    radius_meters: 60,
  },
  {
    type: 'pothole',
    severity: 'low',
    description: 'Large pothole — avoid or slow down',
    lat: 36.8145,
    lng: 10.1740,
    radius_meters: 10,
  },
  {
    type: 'unsafe_area',
    severity: 'medium',
    description: 'Poor lighting and uneven pavement',
    lat: 36.8170,
    lng: 10.1780,
    radius_meters: 150,
  },
];

async function seed() {
  console.log('\n🌱 Seeding hazard data...\n');

  await initDatabase();
  await sequelize.sync({ alter: true });

  // Create a system user for seeded hazards if not exists
  const [systemUser] = await User.findOrCreate({
    where: { email: 'system@navbackend.local' },
    defaults: {
      name: 'System',
      password_hash: 'system_not_for_login_' + Math.random(),
      role: 'admin',
    },
  });

  let created = 0;
  for (const h of SAMPLE_HAZARDS) {
    await Hazard.create({
      type: h.type,
      severity: h.severity,
      description: h.description,
      location: { type: 'Point', coordinates: [h.lng, h.lat] },
      radius_meters: h.radius_meters,
      reported_by: systemUser.id,
      confirmation_count: Math.floor(Math.random() * 10),
    });
    console.log(`  ✅ ${h.severity.toUpperCase()} ${h.type}: ${h.description}`);
    created++;
  }

  console.log(`\n✅ Seeded ${created} hazards.`);
  await sequelize.close();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

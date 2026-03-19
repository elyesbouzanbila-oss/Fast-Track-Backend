const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      // Required for PostGIS geometry types to be returned as strings
      // so we can parse them manually
      typeCast: true,
    },
  }
);

/**
 * Initialize the database connection and enable PostGIS extension.
 */
async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection established.');

    // Ensure PostGIS extension is enabled
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis_topology;');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;');

    console.log('✅ PostGIS extensions enabled.');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

module.exports = { sequelize, initDatabase };

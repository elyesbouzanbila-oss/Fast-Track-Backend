require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const { initDatabase, sequelize } = require('./config/database');
const apiRoutes = require('./routes/index');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Import models to register them with Sequelize
require('./models/User');
require('./models/Hazard');
require('./models/TransitStop');
require('./models/TransitRoute');
require('./models/TransitTrip');
require('./models/TransitStopTime');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security & Performance ──────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Request Logging ─────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Global Rate Limiting ────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please slow down.' },
  })
);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── Root ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'Navigation API',
    version: '1.0.0',
    docs: '/api/health',
    endpoints: {
      health:         'GET  /api/health',
      register:       'POST /api/auth/register',
      login:          'POST /api/auth/login',
      route:          'POST /api/route',
      snap:           'GET  /api/route/snap',
      transitStops:   'GET  /api/route/transit-stops',
      geocode:        'GET  /api/route/geocode',
      reverseGeocode: 'GET  /api/route/reverse-geocode',
      autocomplete:   'GET  /api/route/autocomplete',
      hazards:        'GET  /api/hazards',
    },
  });
});

// ── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function start() {
  await init();
  app.listen(PORT, () => {
    logger.info(`🚀 Navigation API running on http://localhost:${PORT}`);
    logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

/**
 * Initialize DB and sync models without starting the HTTP server.
 * Called by tests directly.
 */
async function init() {
  await initDatabase();
  if (process.env.NODE_ENV !== 'production') {
    await sequelize.sync({ alter: true });
    logger.info('Database models synchronized.');
  }
}

// Only start the server when run directly (not when required by tests)
if (require.main === module) {
  start().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, init }; // Export for testing

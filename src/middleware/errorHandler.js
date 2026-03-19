const logger = require('../utils/logger');

/**
 * Global error handler middleware.
 * Catches all errors thrown in route handlers and services.
 * Returns a consistent JSON error response.
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error({
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Handle known error types
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      error: 'A record with this value already exists',
      field: err.errors?.[0]?.path,
    });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(422).json({
      success: false,
      error: 'Validation error',
      details: err.errors?.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(422).json({
      success: false,
      error: 'Referenced record does not exist',
    });
  }

  // OSRM or routing errors (connection refused, no route found)
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      error: 'Routing service unavailable. Please try again later.',
    });
  }

  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return res.status(504).json({
      success: false,
      error: 'Routing service timed out. Please try again.',
    });
  }

  // Location/snapping errors (impossible route locations)
  if (
    err.message?.includes('No drivable road') ||
    err.message?.includes('No walkable path') ||
    err.message?.includes('inaccessible') ||
    err.message?.includes('on water')
  ) {
    return res.status(422).json({
      success: false,
      error: err.message,
      code: 'LOCATION_UNREACHABLE',
    });
  }

  // No route found
  if (err.message?.includes('No car route') || err.message?.includes('No transit connections')) {
    return res.status(404).json({
      success: false,
      error: err.message,
      code: 'NO_ROUTE_FOUND',
    });
  }

  // Default 500
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An internal error occurred'
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * 404 handler — must be registered AFTER all routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}

module.exports = { errorHandler, notFoundHandler };

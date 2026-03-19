const { body, query, validationResult } = require('express-validator');
const { ROUTE_MODES, HAZARD_TYPES, HAZARD_SEVERITY } = require('../config/constants');

/**
 * Run validators and return 422 if any fail.
 */
function validate(validations) {
  return async (req, res, next) => {
    for (const validation of validations) {
      await validation.run(req);
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    next();
  };
}

// --- Route validation ---
const validateRouteRequest = validate([
  body('origin').isObject().withMessage('origin must be an object'),
  body('origin.lat').isFloat({ min: -90, max: 90 }).withMessage('origin.lat must be a valid latitude'),
  body('origin.lng').isFloat({ min: -180, max: 180 }).withMessage('origin.lng must be a valid longitude'),
  body('destination').isObject().withMessage('destination must be an object'),
  body('destination.lat').isFloat({ min: -90, max: 90 }).withMessage('destination.lat must be valid'),
  body('destination.lng').isFloat({ min: -180, max: 180 }).withMessage('destination.lng must be valid'),
  body('mode')
    .optional()
    .isIn(Object.values(ROUTE_MODES))
    .withMessage(`mode must be one of: ${Object.values(ROUTE_MODES).join(', ')}`),
  body('options.maxWalkDistance').optional().isInt({ min: 100, max: 5000 }),
  body('options.departureTime')
    .optional()
    .matches(/^\d{2}:\d{2}(:\d{2})?$/)
    .withMessage('departureTime must be HH:MM or HH:MM:SS'),
]);

const validateSnapRequest = validate([
  query('lat').isFloat({ min: -90, max: 90 }),
  query('lng').isFloat({ min: -180, max: 180 }),
  query('mode').optional().isIn(['car', 'foot', 'bike']),
]);

// --- Hazard validation ---
const validateHazardReport = validate([
  body('type').isIn(Object.values(HAZARD_TYPES)).withMessage('Invalid hazard type'),
  body('severity').optional().isIn(Object.values(HAZARD_SEVERITY)),
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lng').isFloat({ min: -180, max: 180 }),
  body('description').optional().isLength({ max: 500 }),
  body('radius_meters').optional().isInt({ min: 5, max: 5000 }),
]);

// --- Auth validation ---
const validateRegister = validate([
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
]);

const validateLogin = validate([
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
]);

module.exports = {
  validate,
  validateRouteRequest,
  validateSnapRequest,
  validateHazardReport,
  validateRegister,
  validateLogin,
};

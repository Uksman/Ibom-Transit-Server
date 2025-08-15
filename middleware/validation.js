const { body, check, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Helper function to validate MongoDB ObjectId
 * @param {string} value - The ObjectId to validate
 * @returns {boolean} - Whether the ObjectId is valid
 */
const isValidObjectId = (value) => {
  return value ? mongoose.Types.ObjectId.isValid(value) : true;
};

/**
 * Middleware to handle validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Validation rules for routes
 */
exports.routeValidation = [
  body("routeCode").trim().notEmpty().withMessage("Route Code is required"),
  body("name").trim().notEmpty().withMessage("Route name is required"),
  body("source").trim().notEmpty().withMessage("Source location is required"),
  body("destination")
    .trim()
    .notEmpty()
    .withMessage("Destination location is required")
    .custom((value, { req }) => {
      return value !== req.body.source;
    })
    .withMessage("Destination must be different from source"),
  body("distance")
    .isNumeric()
    .withMessage("Distance must be a number")
    .custom((value) => value > 0)
    .withMessage("Distance must be greater than 0"),
  body("estimatedDuration")
    .isNumeric()
    .withMessage("Estimated duration must be a number")
    .custom((value) => value > 0)
    .withMessage("Estimated duration must be greater than 0"),
  body("departureTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage(
      "Departure time must be in HH:MM format (24-hour, e.g., 06:30 or 14:45)"
    ),
  body("arrivalTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage(
      "Arrival time must be in HH:MM format (24-hour, e.g., 06:30 or 14:45)"
    )
    .custom((value, { req }) => {
      if (req.body.departureTime && value && req.body.estimatedDuration) {
        const [depHours, depMinutes] = req.body.departureTime
          .split(":")
          .map(Number);
        const [arrHours, arrMinutes] = value.split(":").map(Number);
        const depTotalMinutes = depHours * 60 + depMinutes;
        const arrTotalMinutes = arrHours * 60 + arrMinutes;
        const durationMinutes = Number(req.body.estimatedDuration);

        // Check if the route crosses midnight
        const crossesMidnight = arrTotalMinutes < depTotalMinutes;
        if (crossesMidnight) {
          // For midnight-crossing routes, duration should account for the next day
          const timeDiff = arrTotalMinutes + 24 * 60 - depTotalMinutes;
          // Allow a reasonable buffer (e.g., ±30 minutes) for duration
          return Math.abs(timeDiff - durationMinutes) <= 30;
        } else {
          // Same-day route: arrival must be after departure
          const timeDiff = arrTotalMinutes - depTotalMinutes;
          return timeDiff > 0 && Math.abs(timeDiff - durationMinutes) <= 30;
        }
      }
      return true;
    })
    .withMessage(
      "Arrival time must be consistent with departure time and estimated duration"
    ),
  body("operatingDays")
    .isArray()
    .withMessage("Days of operation must be an array"),
  body("operatingDays.*")
    .isIn([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ])
    .withMessage("Invalid day of operation"),
  body("bus")
    .custom(isValidObjectId)
    .withMessage("Invalid bus ID format")
    .custom((value) => value && value.trim() !== "")
    .withMessage("Bus assignment is required"),
  body("baseFare")
    .isNumeric()
    .withMessage("Base fare must be a number")
    .custom((value) => value >= 0)
    .withMessage("Base fare cannot be negative"),
  body("status")
    .optional()
    .isIn(["Active", "Inactive", "Seasonal", "Discontinued"])
    .withMessage("Invalid route status"),
  body("regularity")
    .optional()
    .isIn(["Daily", "Weekdays", "Weekends", "Weekly", "Monthly", "Custom"])
    .withMessage("Invalid regularity value"),
  body("stops").optional().isArray().withMessage("Stops must be an array"),
  body("stops.*.name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Stop name is required"),
  body("stops.*.coordinates.latitude")
    .optional()
    .isFloat()
    .withMessage("Latitude must be a valid float"),
  body("stops.*.coordinates.longitude")
    .optional()
    .isFloat()
    .withMessage("Longitude must be a valid float"),
];

/**
 * Validation rules for buses
 */
exports.busValidation = [
  body('busNumber').trim().notEmpty().withMessage('Bus number is required'),
  body('registrationNumber').trim().notEmpty().withMessage('Registration number is required'),
  body('type').isIn(['Standard', 'Luxury', 'Mini', 'Double-Decker', 'Sleeper'])
    .withMessage('Invalid bus type'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be a positive integer'),
  body('manufacturer').trim().notEmpty().withMessage('Manufacturer is required'),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('year').isInt({ min: 1950, max: new Date().getFullYear() + 1 })
    .withMessage(`Year must be between 1950 and ${new Date().getFullYear() + 1}`),
  body('status').optional().isIn(['Active', 'Maintenance', 'Repair', 'Retired'])
    .withMessage('Invalid bus status'),
  body('amenities').optional().isArray().withMessage('Amenities must be an array'),
  body('amenities.*').optional().isString().withMessage('Each amenity must be a string'),
  body('seatingArrangement.rows').optional().isInt({ min: 1 }).withMessage('Rows must be a positive integer'),
  body('seatingArrangement.columns').optional().isInt({ min: 1 }).withMessage('Columns must be a positive integer')
];

/**
 * Validation rules for bookings
 */
exports.bookingValidation = [
  body('user').custom(isValidObjectId).withMessage('Invalid user ID format'),
  body('route').custom(isValidObjectId).withMessage('Invalid route ID format'),
  body('bus').custom(isValidObjectId).withMessage('Invalid bus ID format'),
  body('departureDate').isISO8601().withMessage('Departure date must be a valid date/time'),
  body('returnDate')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      // Skip validation if value is null, undefined, or empty for one-way bookings
      if (!value || value === null) {
        return true;
      }
      
      // If return date is provided, it must be a valid ISO8601 date
      if (value && !new Date(value).getTime()) {
        throw new Error('Return date must be a valid date');
      }
      
      // If both departure date and return date are provided, return date must be after departure
      if (req.body.departureDate && value) {
        const departureDate = new Date(req.body.departureDate);
        const returnDate = new Date(value);
        if (returnDate <= departureDate) {
          throw new Error('Return date must be after departure date');
        }
      }
      return true;
    }).withMessage('Return date validation failed'),
  body('bookingType').isIn(['One-Way', 'Round-Trip']).withMessage('Invalid booking type'),
  body('passengers').isArray().withMessage('Passengers must be an array')
    .custom(value => value.length > 0).withMessage('At least one passenger is required'),
  body('passengers.*.name').notEmpty().withMessage('Passenger name is required'),
  body('passengers.*.age').isInt({ min: 0, max: 120 }).withMessage('Age must be between 0 and 120'),
  body('passengers.*.seatNumber').notEmpty().withMessage('Seat number is required'),
  body('passengers.*.gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
  body('passengers.*.passengerType').optional().isIn(['Adult', 'Child', 'Student', 'Senior'])
    .withMessage('Invalid passenger type'),
  body('totalFare').isNumeric().withMessage('Total fare must be a number')
    .custom(value => value >= 0).withMessage('Total fare cannot be negative')
];

/**
 * Validation rules for hiring
 */
exports.hiringValidation = [
  // User is automatically set from req.user.id in the controller, no need to validate from body
  body("bus").custom(isValidObjectId).withMessage("Invalid bus ID format"),
  body("route").optional().custom(isValidObjectId).withMessage("Invalid route ID format"),
  body("startDate")
    .isISO8601()
    .withMessage("Start date must be a valid date/time"),
  body("endDate")
    .isISO8601()
    .custom((value, { req }) => {
      if (req.body.startDate && value) {
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(value);
        return endDate > startDate;
      }
      return true;
    })
    .withMessage("End date must be after start date"),
  body("tripType")
    .optional()
    .isIn(['One-Way', 'Round-Trip'])
    .withMessage("Trip type must be either One-Way or Round-Trip"),
  body("returnDate")
    .optional({ nullable: true })
    .custom((value, { req }) => {
      // If tripType is Round-Trip, returnDate is required
      if (req.body.tripType === 'Round-Trip' && !value) {
        throw new Error('Return date is required for round trips');
      }
      // If returnDate is provided, validate it's a valid date and after startDate
      if (value) {
        // Check if it's a valid ISO8601 date
        if (!new Date(value).getTime()) {
          throw new Error('Return date must be a valid date');
        }
        // Check if it's after start date
        if (req.body.startDate) {
          const startDate = new Date(req.body.startDate);
          const returnDate = new Date(value);
          if (returnDate <= startDate) {
            throw new Error('Return date must be after start date');
          }
        }
      }
      return true;
    })
    .withMessage("Return date validation failed"),
  body("startLocation")
    .custom((value, { req }) => {
      // Required only if no route is specified
      if (!req.body.route && !value) {
        throw new Error('Start location is required when no route is specified');
      }
      return true;
    }),
  body("endLocation")
    .custom((value, { req }) => {
      // Required only if no route is specified
      if (!req.body.route && !value) {
        throw new Error('End location is required when no route is specified');
      }
      return true;
    }),
  body("purpose").notEmpty().withMessage("Purpose is required"),
  body("passengerCount")
    .isInt({ min: 1 })
    .withMessage("Passenger count must be a positive integer"),
  body("rateType")
    .optional()
    .isIn(['Per Day', 'Per Hour', 'Per Kilometer', 'Fixed', 'Route-Based'])
    .withMessage("Invalid rate type"),
  body("routePriceMultiplier")
    .optional()
    .isNumeric()
    .custom((value) => value >= 1)
    .withMessage("Route price multiplier must be at least 1"),
  body("baseRate")
    .isNumeric()
    .withMessage("Base rate must be a number")
    .custom((value) => value > 0)
    .withMessage("Base rate must be greater than 0"),
  body("estimatedDistance")
    .isNumeric()
    .withMessage("Estimated distance must be a number")
    .custom((value) => value > 0)
    .withMessage("Estimated distance must be greater than 0"),
  body("totalCost")
    .optional()
    .isNumeric()
    .withMessage("Total cost must be a number")
    .custom((value) => value >= 0)
    .withMessage("Total cost cannot be negative"),
];

/**
 * Validation rules for users
 */
exports.userValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please include a valid email')
    .normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('phone').optional().isMobilePhone().withMessage('Please include a valid phone number'),
  body('role').optional().isIn(['client', 'admin', 'driver']).withMessage('Invalid role')
];

/**
 * Validation rules for password reset
 */
exports.passwordResetValidation = [
  body('email').isEmail().withMessage('Please include a valid email')
    .normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    return value === req.body.password;
  }).withMessage('Passwords do not match')
];

/**
 * ID validation middleware factory
 * @param {string} paramName - The parameter name containing the ID
 * @param {string} modelName - Human-readable name of the model for error message
 * @returns {Array} - Express-validator middleware array
 */
exports.validateId = (paramName = 'id', modelName = 'resource') => [
  param(paramName)
    .custom(isValidObjectId)
    .withMessage(`Invalid ${modelName} ID format`)
];


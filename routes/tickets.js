const express = require('express');
const router = express.Router();

// Import controllers
const ticketVerificationController = require('../controllers/ticketVerificationController');

// Import middleware
const { protect, authorize } = require('../middleware/auth');
const { ticketVerificationLimiter } = require('../middleware/rateLimit');

/**
 * @route   POST /api/tickets/verify
 * @desc    Verify ticket using QR code data
 * @access  Public (for conductors/drivers with basic authentication)
 */
router.post(
  '/verify',
  ticketVerificationLimiter,
  ticketVerificationController.verifyTicketQR
);

/**
 * @route   GET /api/tickets/:id/verifications
 * @desc    Get verification history for a specific ticket
 * @access  Private/Admin
 */
router.get(
  '/:id/verifications',
  protect,
  authorize('admin', 'conductor'),
  ticketVerificationController.getTicketVerifications
);

/**
 * @route   GET /api/tickets/verification-stats
 * @desc    Get verification statistics and analytics
 * @access  Private/Admin
 */
router.get(
  '/verification-stats',
  protect,
  authorize('admin'),
  ticketVerificationController.getVerificationStats
);

/**
 * @route   POST /api/tickets/:id/validate
 * @desc    Manual ticket validation (for customer service)
 * @access  Private/Admin
 */
router.post(
  '/:id/validate',
  protect,
  authorize('admin'),
  ticketVerificationController.manualTicketValidation
);

module.exports = router;

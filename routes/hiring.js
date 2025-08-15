const express = require('express');
const router = express.Router();

// Import controllers
const hiringController = require('../controllers/hiringController');

// Import middleware
const { protect, authorize, checkOwnership } = require('../middleware/auth');
const { hiringValidation } = require('../middleware/validation');
const { bookingLimiter } = require('../middleware/rateLimit'); // Reuse booking limiter
const { requireFeature } = require('../middleware/apiVersion');
const { clearCache } = require('../middleware/cache');

/**
 * @route   GET /api/hiring
 * @desc    Get all hiring requests (with filtering) - Admin only
 * @access  Private/Admin
 */
router.get(
  '/',
  protect,
  authorize('admin'),
  hiringController.getHirings
);

/**
 * @route   GET /api/hiring/me
 * @desc    Get all hiring requests for the current user
 * @access  Private
 */
router.get(
  '/me',
  protect,
  hiringController.getUserHirings
);

/**
 * @route   GET /api/hiring/stats
 * @desc    Get hiring statistics
 * @access  Private/Admin
 */
router.get(
  '/stats',
  protect,
  authorize('admin'),
  requireFeature('route-analytics'),
  hiringController.getHiringStats
);

/**
 * @route   GET /api/hiring/availability
 * @desc    Check bus availability for hiring
 * @access  Public
 */
router.get(
  '/availability',
  hiringController.checkAvailability
);

/**
 * @route   GET /api/hiring/:id
 * @desc    Get hiring request by ID
 * @access  Private (own hiring or admin)
 */
router.get(
  '/:id',
  protect,
  checkOwnership(req => hiringController.getHiringUserId(req.params.id)),
  hiringController.getHiring
);

/**
 * @route   POST /api/hiring
 * @desc    Create a new hiring request
 * @access  Private
 */
router.post(
  '/',
  bookingLimiter,
  protect,
  hiringValidation,
  clearCache(['api/buses']), // Clear cache for related resources
  hiringController.createHiring
);

/**
 * @route   PUT /api/hiring/:id
 * @desc    Update hiring request details
 * @access  Private (own hiring or admin)
 */
router.put(
  '/:id',
  protect,
  hiringValidation,
  checkOwnership(req => hiringController.getHiringUserId(req.params.id)),
  clearCache(['api/buses']), // Clear cache for related resources
  hiringController.updateHiring
);

/**
 * @route   PATCH /api/hiring/:id/status
 * @desc    Update hiring status
 * @access  Private/Admin
 */
router.patch(
  '/:id/status',
  protect,
  authorize('admin'),
  clearCache(['api/buses']), // Clear cache for related resources
  hiringController.updateHiringStatus
);

/**
 * @route   DELETE /api/hiring/:id
 * @desc    Delete hiring request (permanently remove from database)
 * @access  Private/Admin only
 */
router.delete(
  '/:id',
  protect,
  authorize('admin'), // Only admins can permanently delete
  clearCache(['api/buses']), // Clear cache for related resources
  hiringController.deleteHiring
);

/**
 * @route   PATCH /api/hiring/:id/cancel
 * @desc    Cancel hiring request (change status to cancelled)
 * @access  Private (own hiring or admin)
 */
router.patch(
  '/:id/cancel',
  protect,
  checkOwnership(req => hiringController.getHiringUserId(req.params.id)),
  clearCache(['api/buses']), // Clear cache for related resources
  hiringController.cancelHiring
);

/**
 * @route   POST /api/hiring/:id/payment
 * @desc    Process payment for hiring
 * @access  Private (own hiring or admin)
 */
router.post(
  '/:id/payment',
  protect,
  bookingLimiter,
  checkOwnership(req => hiringController.getHiringUserId(req.params.id)),
  requireFeature('payment-integration'),
  hiringController.processHiringPayment
);

/**
 * @route   GET /api/hiring/:id/receipt
 * @desc    Get hiring ticket/receipt (JSON format)
 * @access  Private (own hiring or admin)
 */
router.get(
  '/:id/receipt',
  protect,
  checkOwnership(req => hiringController.getHiringUserId(req.params.id)),
  hiringController.getHiringReceipt
);

/**
 * @route   GET /api/hiring/:id/ticket/pdf
 * @desc    Download hiring ticket as PDF
 * @access  Private (own hiring or admin)
 */
router.get(
  '/:id/ticket/pdf',
  protect,
  checkOwnership(req => hiringController.getHiringUserId(req.params.id)),
  hiringController.downloadHiringTicketPDF
);

/**
 * @route   GET /api/hiring/:id/contract
 * @desc    Generate hiring contract (legacy endpoint)
 * @access  Private (own hiring or admin)
 */
router.get(
  '/:id/contract',
  protect,
  checkOwnership(req => hiringController.getHiringUserId(req.params.id)),
  hiringController.generateContract
);

/**
 * @route   POST /api/hiring/:id/approve
 * @desc    Approve hiring request
 * @access  Private/Admin
 */
router.post(
  '/:id/approve',
  protect,
  authorize('admin'),
  clearCache(['api/buses']), // Clear cache for related resources
  hiringController.approveHiring
);

/**
 * @route   POST /api/hiring/:id/reject
 * @desc    Reject hiring request
 * @access  Private/Admin
 */
router.post(
  '/:id/reject',
  protect,
  authorize('admin'),
  clearCache(['api/buses']), // Clear cache for related resources
  hiringController.rejectHiring
);

/**
 * @route   POST /api/hiring/:id/notify
 * @desc    Send hiring notification
 * @access  Private/Admin
 */
router.post(
  '/:id/notify',
  protect,
  authorize('admin'),
  requireFeature('real-time-notifications'),
  hiringController.sendHiringNotification
);

module.exports = router;


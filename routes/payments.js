const express = require("express");
const router = express.Router();
const {
  verifyPayment,
  initializePayment,
  getPaymentDetails,
} = require("../controllers/paymentController");

// Middleware imports
const { protect } = require("../middleware/auth");

/**
 * @route   POST /api/payments/verify
 * @desc    Verify Paystack payment
 * @access  Private
 */
router.post("/verify", verifyPayment);

/**
 * @route   POST /api/payments/initialize
 * @desc    Initialize Paystack payment
 * @access  Private
 */
router.post("/initialize", protect, initializePayment);

/**
 * @route   GET /api/payments/:reference
 * @desc    Get payment details by reference
 * @access  Private
 */
router.get("/:reference", protect, getPaymentDetails);

module.exports = router;

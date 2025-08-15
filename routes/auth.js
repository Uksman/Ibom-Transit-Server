const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const authController = require("../controllers/authController");
const auth = require("../middleware/auth");

// POST /api/auth/register
// Register user
// Public
router.post(
  "/register",
  [
    check("name", "Name is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
    check("phone", "Phone number is required").not().isEmpty(),
    check("role", "Role must be either client or admin")
      .optional()
      .isIn(["client", "admin"]),
  ],
  authController.register
);

// POST /api/auth/login
// Authenticate user & get token
// Public
router.post(
  "/login",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  authController.login
);

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get("/me", auth.protect, authController.getMe);

// @route   GET /api/auth/logout
// @desc    Logout user
// @access  Private
router.get("/logout", auth.protect, authController.logout);

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post(
  "/forgot-password",
  [check("email", "Please include a valid email").isEmail()],
  authController.forgotPassword
);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post(
  "/reset-password",
  [
    check("token", "Reset token is required").exists(),
    check(
      "newPassword",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
  ],
  authController.resetPassword
);

module.exports = router;

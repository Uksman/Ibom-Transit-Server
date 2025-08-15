const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { 
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getPreferences,
  updatePreferences,
  getAdminNotifications,
  getAdminNotificationStats,
  deleteAdminNotification
} = require('../controllers/notificationController');

// Apply authentication middleware to all routes
router.use(protect);

// @route   GET /api/notifications
// @desc    Get all notifications for the current user with pagination
// @access  Private
router.get('/', getNotifications);

// @route   GET /api/notifications/unread-count
// @desc    Get unread notification count for current user
// @access  Private
router.get('/unread-count', getUnreadCount);

// @route   GET /api/notifications/preferences
// @desc    Get notification preferences for current user
// @access  Private
router.get('/preferences', getPreferences);

// @route   PUT /api/notifications/preferences
// @desc    Update notification preferences for current user
// @access  Private
router.put('/preferences', updatePreferences);

// @route   PUT /api/notifications/mark-all-read
// @desc    Mark all notifications as read for current user
// @access  Private
router.put('/mark-all-read', markAllAsRead);

// @route   PUT /api/notifications/:id/read
// @desc    Mark a specific notification as read
// @access  Private
router.put('/:id/read', markAsRead);

// @route   DELETE /api/notifications/:id
// @desc    Delete a specific notification
// @access  Private
router.delete('/:id', deleteNotification);

// Admin only routes
// @route   GET /api/notifications/admin
// @desc    Get all notifications for admin with enhanced filtering
// @access  Private/Admin
router.get('/admin', authorize('admin'), getAdminNotifications);

// @route   GET /api/notifications/admin/stats
// @desc    Get notification statistics for admin dashboard
// @access  Private/Admin
router.get('/admin/stats', authorize('admin'), getAdminNotificationStats);

// @route   DELETE /api/notifications/admin/:id
// @desc    Delete notification (Admin only)
// @access  Private/Admin
router.delete('/admin/:id', authorize('admin'), deleteAdminNotification);

// @route   POST /api/notifications
// @desc    Create and send notification (Admin only)
// @access  Private/Admin
router.post('/', authorize('admin'), createNotification);

module.exports = router;

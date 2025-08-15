const Notification = require('../models/Notification');
const User = require('../models/User');
const Booking = require('../models/Booking');
const mongoose = require("mongoose");

// @desc    Get all notifications for the current user
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build filter based on query parameters
    const filter = { recipient: req.user.id };
    
    if (req.query.read !== undefined) {
      filter.read = req.query.read === 'true';
    }
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.type) {
      filter.type = req.query.type;
    }

    const notifications = await Notification.find(filter)
      .populate('relatedBooking', 'bookingNumber status departureDate')
      .populate('relatedBus', 'busNumber plateNumber')
      .populate('relatedRoute', 'origin destination')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasMore: skip + notifications.length < total
        },
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user.id);
    
    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting unread count',
      error: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.markAsRead();

    // Emit real-time update to user
    if (req.io) {
      req.io.to(`user:${req.user.id}`).emit('notification:read', {
        notificationId: notification._id,
        unreadCount: await Notification.getUnreadCount(req.user.id)
      });
    }

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.markAllAsRead(req.user.id);

    // Emit real-time update to user
    if (req.io) {
      req.io.to(`user:${req.user.id}`).emit('notifications:allRead', {
        modifiedCount: result.modifiedCount
      });
    }

    res.json({
      success: true,
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read',
      error: error.message
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Emit real-time update to user
    if (req.io) {
      req.io.to(`user:${req.user.id}`).emit('notification:deleted', {
        notificationId: req.params.id,
        unreadCount: await Notification.getUnreadCount(req.user.id)
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
      error: error.message
    });
  }
};

// @desc    Create and send notification (Admin only)
// @route   POST /api/notifications
// @access  Private/Admin
exports.createNotification = async (req, res) => {
  try {
    console.log("Request Body:", JSON.stringify(req.body, null, 2)); // Debug log
    const {
      recipient,
      recipients,
      recipientRole,
      title,
      message,
      type,
      category,
      priority,
      channels,
      data,
      scheduledFor,
    } = req.body;

    // Handle both 'recipient' (singular) and 'recipients' (plural) for backward compatibility
    const targetRecipients = recipients || recipient;

    let recipientIds = [];

    if (targetRecipients === "all" || recipientRole === "all") {
      const users = await User.find({
        role:
          recipientRole === "all"
            ? { $in: ["client", "admin"] }
            : recipientRole,
      }).select("_id");
      recipientIds = users.map((user) => user._id);
      console.log("Found users:", recipientIds);
    } else if (Array.isArray(targetRecipients)) {
      recipientIds = targetRecipients
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      const users = await User.find({ _id: { $in: recipientIds } }).select(
        "_id"
      );
      console.log("Validated users:", users);
      if (users.length !== recipientIds.length) {
        return res.status(400).json({
          success: false,
          message: "Some recipient IDs are invalid or do not exist",
        });
      }
    } else {
      if (!mongoose.Types.ObjectId.isValid(targetRecipients)) {
        return res.status(400).json({
          success: false,
          message: "Invalid recipient ID",
        });
      }
      const user = await User.findById(targetRecipients);
      console.log("Single user:", user);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Recipient does not exist",
        });
      }
      recipientIds = [new mongoose.Types.ObjectId(targetRecipients)];
    }

    const notifications = [];

    for (const recipientId of recipientIds) {
      const notificationData = {
        recipient: recipientId,
        recipientRole: recipientRole || "client",
        title,
        message,
        type,
        category,
        priority: priority || "normal",
        channels: channels || { push: { enabled: true } },
        data: data || {},
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        createdBy: new mongoose.Types.ObjectId(req.user.id),
      };

      console.log("Creating notification for:", recipientId);
      const notification = await Notification.createAndSend(notificationData);
      notifications.push(notification);

      if (!scheduledFor && req.io) {
        req.io.to(`user:${recipientId}`).emit("notification:new", {
          notification: {
            _id: notification._id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            category: notification.category,
            priority: notification.priority,
            createdAt: notification.createdAt,
            data: notification.data,
          },
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        message: `Notification sent to ${notifications.length} recipients`,
        notifications: notifications.slice(0, 5),
      },
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      message: "Error creating notification",
      error: error.message,
    });
  }
};

// @desc    Get notification preferences for current user
// @route   GET /api/notifications/preferences
// @access  Private
exports.getPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('notificationPreferences');
    
    // Default preferences if not set
    const defaultPreferences = {
      push: {
        booking: true,
        payment: true,
        system: true,
        promotional: false,
        alert: true
      },
      email: {
        booking: true,
        payment: true,
        system: false,
        promotional: false,
        alert: true
      },
      sms: {
        booking: false,
        payment: true,
        system: false,
        promotional: false,
        alert: true
      }
    };

    const preferences = user.notificationPreferences || defaultPreferences;

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting notification preferences',
      error: error.message
    });
  }
};

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
exports.updatePreferences = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { notificationPreferences: req.body },
      { new: true, runValidators: true }
    ).select('notificationPreferences');

    res.json({
      success: true,
      data: user.notificationPreferences
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification preferences',
      error: error.message
    });
  }
};

// @desc    Get all notifications for admin with enhanced filtering and stats
// @route   GET /api/notifications/admin
// @access  Private/Admin
exports.getAdminNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build filter based on query parameters
    const filter = {};
    
    if (req.query.read !== undefined) {
      filter.read = req.query.read === 'true';
    }
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.priority) {
      filter.priority = req.query.priority;
    }

    if (req.query.status) {
      if (req.query.status === 'delivered') {
        filter.delivered = true;
      } else if (req.query.status === 'pending') {
        filter.delivered = false;
      }
    }

    // Date range filter
    if (req.query.dateRange || (req.query.from && req.query.to)) {
      const from = req.query.from || req.query.dateRange?.from;
      const to = req.query.to || req.query.dateRange?.to;
      
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
      }
    }

    // Search functionality
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { message: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const notifications = await Notification.find(filter)
      .populate('recipient', 'name email')
      .populate('relatedBooking', 'bookingNumber status departureDate')
      .populate('relatedBus', 'busNumber plateNumber')
      .populate('relatedRoute', 'origin destination')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(filter);

    // Add recipient count for bulk notifications
    const notificationsWithStats = notifications.map(notification => {
      const notificationObj = notification.toObject();
      notificationObj.recipientCount = 1; // Individual notification
      return notificationObj;
    });

    res.json({
      success: true,
      data: {
        notifications: notificationsWithStats,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasMore: skip + notifications.length < total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
};

// @desc    Get notification statistics for admin dashboard
// @route   GET /api/notifications/admin/stats
// @access  Private/Admin
exports.getAdminNotificationStats = async (req, res) => {
  try {
    // Get basic counts
    const total = await Notification.countDocuments({});
    const unread = await Notification.countDocuments({ read: false });
    const delivered = await Notification.countDocuments({ delivered: true });
    
    // Get active users count (users who have received notifications in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeUsers = await Notification.distinct('recipient', {
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get counts by type
    const byType = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get counts by category
    const byCategory = await Notification.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get counts by priority
    const byPriority = await Notification.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Transform aggregation results to objects
    const typeStats = {};
    byType.forEach(item => {
      typeStats[item._id] = item.count;
    });

    const categoryStats = {};
    byCategory.forEach(item => {
      categoryStats[item._id] = item.count;
    });

    const priorityStats = {};
    byPriority.forEach(item => {
      priorityStats[item._id] = item.count;
    });

    res.json({
      success: true,
      data: {
        total,
        unread,
        delivered,
        activeUsers: activeUsers.length,
        byType: typeStats,
        byCategory: categoryStats,
        byPriority: priorityStats
      }
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification statistics',
      error: error.message
    });
  }
};

// @desc    Delete notification (Admin only)
// @route   DELETE /api/notifications/admin/:id
// @access  Private/Admin
exports.deleteAdminNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
      error: error.message
    });
  }
};

// Helper function to create booking-related notifications
exports.createBookingNotification = async (booking, type, io = null) => {
  try {
    let title, message;

    switch (type) {
      case 'booking_confirmed':
        title = 'Booking Confirmed';
        message = `Your booking ${booking.bookingNumber} has been confirmed. Have a safe journey!`;
        break;
      case 'booking_cancelled':
        title = 'Booking Cancelled';
        message = `Your booking ${booking.bookingNumber} has been cancelled. Refund will be processed if applicable.`;
        break;
      case 'booking_reminder':
        title = 'Journey Reminder';
        message = `Reminder: Your journey ${booking.bookingNumber} is scheduled for tomorrow. Please be at the departure point on time.`;
        break;
      case 'payment_successful':
        title = 'Payment Successful';
        message = `Payment for booking ${booking.bookingNumber} has been processed successfully.`;
        break;
      case 'payment_failed':
        title = 'Payment Failed';
        message = `Payment for booking ${booking.bookingNumber} failed. Please try again or contact support.`;
        break;
      case 'refund_processed':
        title = 'Refund Processed';
        message = `Refund for booking ${booking.bookingNumber} has been processed. It may take 3-5 business days to reflect in your account.`;
        break;
      default:
        title = 'Booking Update';
        message = `There's an update regarding your booking ${booking.bookingNumber}.`;
    }

    const notificationData = {
      recipient: booking.user,
      title,
      message,
      type,
      relatedBooking: booking._id,
      data: {
        actionUrl: `/bookings/${booking._id}`,
        bookingNumber: booking.bookingNumber
      }
    };

    const notification = await Notification.createAndSend(notificationData);

    // Send real-time notification
    if (io) {
      io.to(`user:${booking.user}`).emit('notification:new', {
        notification: {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          category: notification.category,
          priority: notification.priority,
          createdAt: notification.createdAt,
          data: notification.data
        }
      });
    }

    return notification;
  } catch (error) {
    console.error('Error creating booking notification:', error);
  }
};

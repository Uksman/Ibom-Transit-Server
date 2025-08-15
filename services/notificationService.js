const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Send notification to a user
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Created notification
   */
  async sendNotification(notificationData) {
    try {
      console.log('🔔 NotificationService: Creating notification...', {
        recipient: notificationData.recipient,
        title: notificationData.title,
        type: notificationData.type,
        hasSocketIO: !!this.io,
        scheduled: !!notificationData.scheduledFor
      });
      
      const notification = await Notification.createAndSend(notificationData);
      console.log('✅ NotificationService: Notification created in DB:', notification._id);
      
      // Send real-time notification if Socket.io is available
      if (this.io && !notificationData.scheduledFor) {
        const userRoom = `user:${notification.recipient}`;
        console.log('📡 NotificationService: Emitting to Socket.io room:', userRoom);
        
        this.io.to(userRoom).emit('notification:new', {
          notification: {
            _id: notification._id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            category: notification.category,
            priority: notification.priority,
            createdAt: notification.createdAt,
            data: notification.data,
            relatedBooking: notification.relatedBooking,
            relatedBus: notification.relatedBus,
            relatedRoute: notification.relatedRoute
          }
        });
        
        console.log('✅ NotificationService: Socket.io event emitted successfully');
      } else {
        console.log('⚠️ NotificationService: Socket.io not available or notification scheduled for later');
      }

      return notification;
    } catch (error) {
      console.error('❌ NotificationService: Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to multiple users
   * @param {Array} recipients - Array of user IDs
   * @param {Object} notificationData - Common notification data
   * @returns {Promise<Array>} Array of created notifications
   */
  async sendBulkNotification(recipients, notificationData) {
    try {
      const promises = recipients.map(recipientId => 
        this.sendNotification({
          ...notificationData,
          recipient: recipientId
        })
      );

      const notifications = await Promise.all(promises);
      return notifications;
    } catch (error) {
      console.error('Error sending bulk notification:', error);
      throw error;
    }
  }

  /**
   * Send booking-related notification
   * @param {Object} booking - Booking object
   * @param {string} type - Notification type
   * @param {Object} additionalData - Additional notification data
   * @returns {Promise<Object>} Created notification
   */
  async sendBookingNotification(booking, type, additionalData = {}) {
    try {
      let title, message, priority = 'normal';

      switch (type) {
        case 'booking_confirmed':
          title = 'Booking Confirmed';
          message = `Your booking ${booking.bookingNumber} has been confirmed. Have a safe journey!`;
          priority = 'high';
          break;
        case 'booking_cancelled':
          title = 'Booking Cancelled';
          message = `Your booking ${booking.bookingNumber} has been cancelled. ${additionalData.reason || 'Refund will be processed if applicable.'}`;
          priority = 'high';
          break;
        case 'booking_reminder':
          title = 'Journey Reminder';
          message = `Reminder: Your journey ${booking.bookingNumber} is scheduled for ${new Date(booking.departureDate).toLocaleDateString()}. Please be at the departure point on time.`;
          priority = 'high';
          break;
        case 'payment_successful':
          title = '💳 Payment Successful!';
          const paymentAmount = additionalData.amount || booking.totalFare || 0;
          const currencySymbol = additionalData.currency || '₦';
          const paymentMethod = additionalData.method || 'Card';
          const transactionId = additionalData.transactionId || 'N/A';
          
          message = `Your payment of ${currencySymbol}${paymentAmount.toLocaleString()} for booking ${booking.bookingNumber} has been successfully processed via ${paymentMethod}. Transaction ID: ${transactionId}. Your seats are now confirmed!`;
          priority = 'high';
          break;
        case 'payment_failed':
          title = 'Payment Failed';
          message = `Payment for booking ${booking.bookingNumber} failed. Please try again or contact support.`;
          priority = 'urgent';
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
        priority,
        relatedBooking: booking._id,
        data: {
          actionUrl: `/bookings/${booking._id}`,
          bookingNumber: booking.bookingNumber,
          ...additionalData
        }
      };

      return await this.sendNotification(notificationData);
    } catch (error) {
      console.error('Error sending booking notification:', error);
      throw error;
    }
  }

  /**
   * Send hiring-related notification
   * @param {Object} hiring - Hiring object
   * @param {string} type - Notification type
   * @param {Object} additionalData - Additional notification data
   * @returns {Promise<Object>} Created notification
   */
  async sendHiringNotification(hiring, type, additionalData = {}) {
    try {
      let title, message, priority = 'normal';

      switch (type) {
        case 'hiring_confirmed':
          title = 'Hiring Confirmed';
          message = `Your bus hiring request ${hiring.hiringNumber} has been confirmed. Have a safe journey!`;
          priority = 'high';
          break;
        case 'hiring_cancelled':
          title = 'Hiring Cancelled';
          message = `Your hiring request ${hiring.hiringNumber} has been cancelled. ${additionalData.reason || 'Refund will be processed if applicable.'}`;
          priority = 'high';
          break;
        case 'hiring_approved':
          title = 'Hiring Approved';
          message = `Your bus hiring request ${hiring.hiringNumber} has been approved. Please complete payment to confirm.`;
          priority = 'high';
          break;
        case 'payment_successful':
          title = '💳 Payment Successful!';
          const paymentAmount = additionalData.amount || hiring.totalCost || 0;
          const currencySymbol = additionalData.currency || '₦';
          const paymentMethod = additionalData.method || 'Card';
          const transactionId = additionalData.transactionId || 'N/A';
          
          message = `Your payment of ${currencySymbol}${paymentAmount.toLocaleString()} for hiring ${hiring.hiringNumber} has been successfully processed via ${paymentMethod}. Transaction ID: ${transactionId}. Your bus hire is now confirmed!`;
          priority = 'high';
          break;
        case 'payment_failed':
          title = 'Payment Failed';
          message = `Payment for hiring ${hiring.hiringNumber} failed. Please try again or contact support.`;
          priority = 'urgent';
          break;
        case 'refund_processed':
          title = 'Refund Processed';
          message = `Refund for hiring ${hiring.hiringNumber} has been processed. It may take 3-5 business days to reflect in your account.`;
          break;
        default:
          title = 'Hiring Update';
          message = `There's an update regarding your hiring request ${hiring.hiringNumber}.`;
      }

      const notificationData = {
        recipient: hiring.user,
        title,
        message,
        type,
        priority,
        data: {
          actionUrl: `/hirings/${hiring._id}`,
          hiringNumber: hiring.hiringNumber,
          ...additionalData
        }
      };

      return await this.sendNotification(notificationData);
    } catch (error) {
      console.error('Error sending hiring notification:', error);
      throw error;
    }
  }

  /**
   * Send bus-related notification to affected passengers
   * @param {Object} bus - Bus object
   * @param {string} type - Notification type
   * @param {Object} additionalData - Additional notification data
   * @returns {Promise<Array>} Array of created notifications
   */
  async sendBusNotification(bus, type, additionalData = {}) {
    try {
      const Booking = require('../models/Booking');
      
      // Find all active bookings for this bus for today and future dates
      const activeBookings = await Booking.find({
        bus: bus._id,
        status: { $in: ['Pending', 'Confirmed'] },
        departureDate: { $gte: new Date() }
      }).populate('user', '_id');

      if (activeBookings.length === 0) {
        return [];
      }

      let title, message, priority = 'normal';

      switch (type) {
        case 'bus_delayed':
          title = 'Bus Delayed';
          message = `Your bus ${bus.busNumber} is running late. ${additionalData.reason || 'We apologize for the inconvenience.'}`;
          priority = 'high';
          break;
        case 'bus_cancelled':
          title = 'Bus Trip Cancelled';
          message = `Unfortunately, your bus trip ${bus.busNumber} has been cancelled. ${additionalData.reason || 'Please contact support for rebooking or refund.'}`;
          priority = 'urgent';
          break;
        case 'bus_breakdown':
          title = 'Bus Breakdown';
          message = `Your bus ${bus.busNumber} has encountered a technical issue. Alternative arrangements are being made.`;
          priority = 'urgent';
          break;
        default:
          title = 'Bus Update';
          message = `There's an update regarding your bus ${bus.busNumber}.`;
      }

      const recipients = activeBookings.map(booking => booking.user._id);
      const notificationData = {
        title,
        message,
        type,
        priority,
        relatedBus: bus._id,
        data: {
          busNumber: bus.busNumber,
          ...additionalData
        }
      };

      return await this.sendBulkNotification(recipients, notificationData);
    } catch (error) {
      console.error('Error sending bus notification:', error);
      throw error;
    }
  }

  /**
   * Send promotional notification to all users or specific segments
   * @param {Object} promoData - Promotional notification data
   * @param {Object} filters - User segment filters
   * @returns {Promise<Array>} Array of created notifications
   */
  async sendPromotionalNotification(promoData, filters = {}) {
    try {
      const { title, message, imageUrl, actionUrl, validUntil } = promoData;
      
      // Find users based on filters
      const userQuery = { isActive: true };
      if (filters.role) userQuery.role = filters.role;
      if (filters.hasBookings) {
        const Booking = require('../models/Booking');
        const usersWithBookings = await Booking.distinct('user');
        userQuery._id = { $in: usersWithBookings };
      }

      const users = await User.find(userQuery).select('_id');
      const recipients = users.map(user => user._id);

      const notificationData = {
        title,
        message,
        type: 'promotional',
        priority: 'low',
        data: {
          imageUrl,
          actionUrl,
          validUntil
        },
        expiresAt: validUntil ? new Date(validUntil) : undefined
      };

      return await this.sendBulkNotification(recipients, notificationData);
    } catch (error) {
      console.error('Error sending promotional notification:', error);
      throw error;
    }
  }

  /**
   * Send system maintenance notification
   * @param {Object} maintenanceData - Maintenance notification data
   * @returns {Promise<Array>} Array of created notifications
   */
  async sendMaintenanceNotification(maintenanceData) {
    try {
      const { title, message, scheduledFor, duration } = maintenanceData;
      
      // Send to all active users
      const users = await User.find({ isActive: true }).select('_id');
      const recipients = users.map(user => user._id);

      const notificationData = {
        title: title || 'System Maintenance',
        message: message || 'The system will be under maintenance. We apologize for any inconvenience.',
        type: 'system_maintenance',
        priority: 'normal',
        data: {
          scheduledFor,
          duration
        }
      };

      return await this.sendBulkNotification(recipients, notificationData);
    } catch (error) {
      console.error('Error sending maintenance notification:', error);
      throw error;
    }
  }

  /**
   * Send scheduled reminders for upcoming journeys
   * @returns {Promise<Array>} Array of sent notifications
   */
  async sendJourneyReminders() {
    try {
      const Booking = require('../models/Booking');
      
      // Find bookings departing tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setHours(23, 59, 59, 999);

      const upcomingBookings = await Booking.find({
        status: 'Confirmed',
        departureDate: {
          $gte: tomorrow,
          $lte: endOfTomorrow
        }
      }).populate('user', '_id name');

      const notifications = [];
      
      for (const booking of upcomingBookings) {
        const notification = await this.sendBookingNotification(
          booking, 
          'booking_reminder',
          {
            departureTime: booking.departureDate.toLocaleTimeString(),
            departureDate: booking.departureDate.toLocaleDateString()
          }
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending journey reminders:', error);
      throw error;
    }
  }

  /**
   * Clean up old notifications
   * @param {number} daysOld - Number of days old to consider for cleanup
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        read: true // Only delete read notifications
      });

      console.log(`Cleaned up ${result.deletedCount} old notifications`);
      return result;
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;

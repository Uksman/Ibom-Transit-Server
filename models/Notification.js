const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  // Recipient information
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please specify the recipient']
  },
  recipientRole: {
    type: String,
    enum: ['client', 'admin', 'all'],
    default: 'client'
  },

  // Notification content
  title: {
    type: String,
    required: [true, 'Please provide a notification title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Please provide a notification message'],
    trim: true,
    maxlength: [500, 'Message cannot be more than 500 characters']
  },
  
  // Notification type and category
  type: {
    type: String,
    enum: [
      'booking_confirmed',
      'booking_cancelled', 
      'booking_reminder',
      'payment_successful',
      'payment_failed',
      'refund_processed',
      'bus_delayed',
      'bus_cancelled',
      'route_updated',
      'promotional',
      'system_maintenance',
      'security_alert',
      'general'
    ],
    required: [true, 'Please specify notification type']
  },
  category: {
    type: String,
    enum: ['booking', 'payment', 'system', 'promotional', 'alert'],
    required: [true, 'Please specify notification category']
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Related entities
  relatedBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  relatedBus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus'
  },
  relatedRoute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route'
  },

  // Notification status
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  delivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: {
    type: Date
  },

  // Delivery channels
  channels: {
    push: {
      enabled: { type: Boolean, default: true },
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    },
    email: {
      enabled: { type: Boolean, default: false },
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    },
    sms: {
      enabled: { type: Boolean, default: false },
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    }
  },

  // Additional data for rich notifications
  data: {
    actionUrl: String,
    imageUrl: String,
    buttons: [{
      text: String,
      action: String,
      url: String
    }]
  },

  // Scheduling
  scheduledFor: {
    type: Date
  },
  
  // Auto-expiry
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  },

  // System fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better performance
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ read: 1, recipient: 1 });
NotificationSchema.index({ scheduledFor: 1 });
NotificationSchema.index({ expiresAt: 1 });

// Method to mark notification as read
NotificationSchema.methods.markAsRead = async function() {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

// Method to mark notification as delivered
NotificationSchema.methods.markAsDelivered = async function(channel = 'push') {
  if (!this.delivered) {
    this.delivered = true;
    this.deliveredAt = new Date();
  }
  
  if (this.channels[channel]) {
    this.channels[channel].sent = true;
    this.channels[channel].sentAt = new Date();
  }
  
  await this.save();
  return this;
};

// Static method to create and send notification
NotificationSchema.statics.createAndSend = async function (notificationData) {
  try {
    console.log(
      "Notification Data:",
      JSON.stringify(notificationData, null, 2)
    );
    if (
      !notificationData.recipient ||
      !mongoose.Types.ObjectId.isValid(notificationData.recipient)
    ) {
      throw new Error("Invalid or missing recipient ID");
    }

    notificationData.recipient = new mongoose.Types.ObjectId(
      notificationData.recipient
    );

    if (!notificationData.expiresAt) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      notificationData.expiresAt = expiryDate;
    }

    const notification = new this(notificationData);
    await notification.save();

    await notification.populate({
      path: "recipient",
      select: "name email phone",
      strictPopulate: false,
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

// Static method to get unread count for a user
NotificationSchema.statics.getUnreadCount = async function(userId) {
  try {
    const count = await this.countDocuments({
      recipient: userId,
      read: false
    });
    return count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
};

// Static method to mark all notifications as read for a user
NotificationSchema.statics.markAllAsRead = async function(userId) {
  try {
    const result = await this.updateMany(
      { recipient: userId, read: false },
      { 
        read: true, 
        readAt: new Date() 
      }
    );
    return result;
  } catch (error) {
    console.error('Error marking all as read:', error);
    throw error;
  }
};

// Pre-save middleware to set category based on type
NotificationSchema.pre('save', function(next) {
  if (!this.category) {
    // Auto-set category based on type
    const typeToCategory = {
      'booking_confirmed': 'booking',
      'booking_cancelled': 'booking', 
      'booking_reminder': 'booking',
      'payment_successful': 'payment',
      'payment_failed': 'payment',
      'refund_processed': 'payment',
      'bus_delayed': 'alert',
      'bus_cancelled': 'alert',
      'route_updated': 'system',
      'promotional': 'promotional',
      'system_maintenance': 'system',
      'security_alert': 'alert',
      'general': 'system'
    };
    
    this.category = typeToCategory[this.type] || 'system';
  }
  next();
});

module.exports = mongoose.model('Notification', NotificationSchema);

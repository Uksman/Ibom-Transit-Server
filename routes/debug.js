const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');
const Booking = require('../models/Booking');
const Hiring = require('../models/Hiring');

// Apply authentication middleware to all routes
router.use(protect);

// @route   POST /api/debug/test-notification
// @desc    Test notification system
// @access  Private
router.post('/test-notification', async (req, res) => {
  try {
    console.log('🧪 Testing notification system...');
    console.log('User ID:', req.user.id);
    console.log('Socket.io available:', !!req.io);
    
    const notificationService = new NotificationService(req.io);
    
    // Test notification data
    const testNotification = {
      recipient: req.user.id,
      title: '🧪 Test Notification',
      message: 'This is a test notification to verify the system is working correctly.',
      type: 'general',
      priority: 'normal',
      data: {
        actionUrl: '/test',
        testData: true
      }
    };
    
    console.log('Creating test notification:', testNotification);
    
    const notification = await notificationService.sendNotification(testNotification);
    
    console.log('✅ Test notification created:', notification._id);
    
    res.status(200).json({
      status: 'success',
      message: 'Test notification sent successfully',
      data: {
        notificationId: notification._id,
        socketIoAvailable: !!req.io,
        userId: req.user.id
      }
    });
  } catch (error) {
    console.error('❌ Error testing notification:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send test notification',
      error: error.message
    });
  }
});

// @route   POST /api/debug/test-payment-notification
// @desc    Test payment success notification with a real booking
// @access  Private
router.post('/test-payment-notification', async (req, res) => {
  try {
    const { bookingId, hiringId } = req.body;
    
    console.log('🧪 Testing payment notification system...');
    console.log('User ID:', req.user.id);
    console.log('Booking ID:', bookingId);
    console.log('Hiring ID:', hiringId);
    console.log('Socket.io available:', !!req.io);
    
    const notificationService = new NotificationService(req.io);
    let result;
    
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          status: 'error',
          message: 'Booking not found'
        });
      }
      
      console.log('Testing booking notification for:', booking.bookingNumber);
      
      result = await notificationService.sendBookingNotification(
        booking,
        'payment_successful',
        {
          amount: booking.totalFare,
          method: 'Test Payment',
          transactionId: 'TEST-' + Date.now(),
          currency: '₦'
        }
      );
    } else if (hiringId) {
      const hiring = await Hiring.findById(hiringId);
      if (!hiring) {
        return res.status(404).json({
          status: 'error',
          message: 'Hiring not found'
        });
      }
      
      console.log('Testing hiring notification for:', hiring.hiringNumber);
      
      result = await notificationService.sendHiringNotification(
        hiring,
        'payment_successful',
        {
          amount: hiring.totalCost,
          method: 'Test Payment',
          transactionId: 'TEST-' + Date.now(),
          currency: '₦'
        }
      );
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide either bookingId or hiringId'
      });
    }
    
    console.log('✅ Test payment notification created:', result._id);
    
    res.status(200).json({
      status: 'success',
      message: 'Test payment notification sent successfully',
      data: {
        notificationId: result._id,
        socketIoAvailable: !!req.io,
        userId: req.user.id
      }
    });
  } catch (error) {
    console.error('❌ Error testing payment notification:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send test payment notification',
      error: error.message
    });
  }
});

// @route   GET /api/debug/socket-status
// @desc    Check socket connection status
// @access  Private
router.get('/socket-status', (req, res) => {
  const socketInfo = {
    socketIoAvailable: !!req.io,
    connectedClients: req.io ? req.io.engine.clientsCount : 0,
    userId: req.user.id
  };
  
  console.log('🔌 Socket status check:', socketInfo);
  
  res.json({
    status: 'success',
    data: socketInfo
  });
});

module.exports = router;

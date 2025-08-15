const Booking = require('../models/Booking');
const Hiring = require('../models/Hiring');
const { verifyTicket } = require('../utils/ticketGenerator');
const { validationResult } = require('express-validator');

/**
 * @desc    Verify ticket using QR code data
 * @route   POST /api/tickets/verify
 * @access  Public (for conductors/drivers)
 */
exports.verifyTicketQR = async (req, res) => {
  try {
    const { qrData, conductorId, busId, location } = req.body;

    if (!qrData) {
      return res.status(400).json({
        status: 'error',
        message: 'QR code data is required'
      });
    }

    // Basic QR code format validation
    const qrVerification = await verifyTicket(qrData);
    if (!qrVerification.valid) {
      return res.status(400).json({
        status: 'error',
        message: qrVerification.message,
        data: { 
          valid: false,
          reason: 'invalid_qr_format'
        }
      });
    }

    const ticketData = qrVerification.data;
    
    // Find the actual booking/hiring based on ticket data
    let record = null;
    let recordType = ticketData.type;

    if (recordType === 'booking') {
      record = await Booking.findById(ticketData.id)
        .populate('user', 'name email phone')
        .populate('route', 'source destination')
        .populate('bus', 'busNumber type');
    } else if (recordType === 'hiring') {
      record = await Hiring.findById(ticketData.id)
        .populate('user', 'name email phone')
        .populate('route', 'source destination')
        .populate('bus', 'busNumber type');
    }

    if (!record) {
      return res.status(404).json({
        status: 'error',
        message: 'Ticket record not found in database',
        data: { 
          valid: false,
          reason: 'record_not_found'
        }
      });
    }

    // Verify ticket status and payment
    const verificationResult = validateTicketStatus(record, recordType, ticketData);
    
    // Log verification attempt
    await logVerificationAttempt({
      ticketId: ticketData.ticketId,
      recordId: record._id,
      recordType,
      conductorId,
      busId,
      location,
      result: verificationResult.valid,
      reason: verificationResult.reason,
      timestamp: new Date()
    });

    // Update ticket usage if valid
    if (verificationResult.valid && !verificationResult.alreadyUsed) {
      await updateTicketUsage(record, recordType, {
        verifiedBy: conductorId,
        verifiedAt: new Date(),
        verificationLocation: location,
        busUsed: busId
      });
    }

    res.status(200).json({
      status: 'success',
      message: verificationResult.message,
      data: {
        valid: verificationResult.valid,
        ticket: {
          ticketId: ticketData.ticketId,
          type: recordType,
          number: recordType === 'booking' ? record.bookingNumber : record.hiringNumber,
          status: record.status,
          paymentStatus: record.paymentStatus,
          passenger: {
            name: record.user?.name,
            phone: record.user?.phone,
            email: record.user?.email
          },
          trip: {
            from: record.route?.source || record.startLocation,
            to: record.route?.destination || record.endLocation,
            date: recordType === 'booking' ? record.departureDate : record.startDate,
            bus: record.bus?.busNumber
          },
          passengers: recordType === 'booking' ? record.passengers : null,
          totalCost: record.totalFare || record.totalCost,
          verification: verificationResult.verification || null
        },
        reason: verificationResult.reason,
        alreadyUsed: verificationResult.alreadyUsed || false
      }
    });

  } catch (error) {
    console.error('Error verifying ticket:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while verifying ticket',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get verification history for a ticket
 * @route   GET /api/tickets/:id/verifications
 * @access  Private/Admin
 */
exports.getTicketVerifications = async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'booking' } = req.query;

    let record = null;
    if (type === 'booking') {
      record = await Booking.findById(id)
        .populate('user', 'name email')
        .populate('verifications.verifiedBy', 'name email');
    } else {
      record = await Hiring.findById(id)
        .populate('user', 'name email')
        .populate('verifications.verifiedBy', 'name email');
    }

    if (!record) {
      return res.status(404).json({
        status: 'error',
        message: `${type} not found`
      });
    }

    const verifications = record.verifications || [];

    res.status(200).json({
      status: 'success',
      data: {
        recordId: record._id,
        recordType: type,
        recordNumber: type === 'booking' ? record.bookingNumber : record.hiringNumber,
        verificationCount: verifications.length,
        verifications: verifications.map(v => ({
          verificationId: v._id,
          verifiedAt: v.verifiedAt,
          verifiedBy: v.verifiedBy?.name || 'Unknown',
          location: v.verificationLocation,
          busUsed: v.busUsed,
          result: v.result,
          notes: v.notes
        }))
      }
    });

  } catch (error) {
    console.error('Error getting ticket verifications:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching verification history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get verification statistics
 * @route   GET /api/tickets/verification-stats
 * @access  Private/Admin
 */
exports.getVerificationStats = async (req, res) => {
  try {
    const { 
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate = new Date(),
      busId,
      conductorId 
    } = req.query;

    // Build aggregation pipeline for booking verifications
    const bookingPipeline = [
      { $unwind: { path: '$verifications', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'verifications.verifiedAt': {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          ...(busId && { 'verifications.busUsed': busId }),
          ...(conductorId && { 'verifications.verifiedBy': conductorId })
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$verifications.verifiedAt' } },
            result: '$verifications.result'
          },
          count: { $sum: 1 },
          uniqueBookings: { $addToSet: '$_id' }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          date: { $first: '$_id.date' },
          validVerifications: {
            $sum: { $cond: [{ $eq: ['$_id.result', 'valid'] }, '$count', 0] }
          },
          invalidVerifications: {
            $sum: { $cond: [{ $eq: ['$_id.result', 'invalid'] }, '$count', 0] }
          },
          totalVerifications: { $sum: '$count' },
          uniqueTickets: { $sum: { $size: '$uniqueBookings' } }
        }
      },
      { $sort: { date: 1 } }
    ];

    const bookingStats = await Booking.aggregate(bookingPipeline);
    
    // Similar pipeline for hiring (if implemented)
    // const hiringStats = await Hiring.aggregate(hiringPipeline);

    // Get overall statistics
    const overallStats = await Promise.all([
      // Total verified tickets today
      Booking.countDocuments({
        'verifications.verifiedAt': {
          $gte: new Date().setHours(0, 0, 0, 0),
          $lt: new Date().setHours(23, 59, 59, 999)
        }
      }),
      
      // Total valid verifications this week
      Booking.aggregate([
        { $unwind: '$verifications' },
        {
          $match: {
            'verifications.verifiedAt': {
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            },
            'verifications.result': 'valid'
          }
        },
        { $count: 'validVerifications' }
      ]),

      // Most active conductors
      Booking.aggregate([
        { $unwind: '$verifications' },
        {
          $match: {
            'verifications.verifiedAt': {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: '$verifications.verifiedBy',
            verificationCount: { $sum: 1 },
            validCount: {
              $sum: { $cond: [{ $eq: ['$verifications.result', 'valid'] }, 1, 0] }
            }
          }
        },
        { $sort: { verificationCount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'conductor'
          }
        },
        {
          $project: {
            conductorName: { $arrayElemAt: ['$conductor.name', 0] },
            verificationCount: 1,
            validCount: 1,
            accuracy: {
              $multiply: [
                { $divide: ['$validCount', '$verificationCount'] },
                100
              ]
            }
          }
        }
      ])
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        dateRange: { startDate, endDate },
        dailyStats: bookingStats,
        overall: {
          todayVerifications: overallStats[0],
          weeklyValidVerifications: overallStats[1][0]?.validVerifications || 0,
          topConductors: overallStats[2]
        }
      }
    });

  } catch (error) {
    console.error('Error getting verification stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching verification statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Manual ticket validation (for customer service)
 * @route   POST /api/tickets/:id/validate
 * @access  Private/Admin
 */
exports.manualTicketValidation = async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'booking', action, notes } = req.body;

    if (!['validate', 'invalidate', 'reset'].includes(action)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid action. Must be validate, invalidate, or reset'
      });
    }

    let record = null;
    if (type === 'booking') {
      record = await Booking.findById(id).populate('user', 'name email');
    } else {
      record = await Hiring.findById(id).populate('user', 'name email');
    }

    if (!record) {
      return res.status(404).json({
        status: 'error',
        message: `${type} not found`
      });
    }

    // Initialize verifications array if it doesn't exist
    if (!record.verifications) {
      record.verifications = [];
    }

    const verification = {
      verifiedAt: new Date(),
      verifiedBy: req.user.id,
      verificationLocation: 'Customer Service',
      result: action === 'validate' ? 'valid' : action === 'invalidate' ? 'invalid' : 'reset',
      notes: notes || `Manual ${action} by customer service`,
      isManual: true
    };

    if (action === 'reset') {
      // Remove all previous verifications
      record.verifications = [];
    } else {
      // Add new verification
      record.verifications.push(verification);
    }

    await record.save();

    res.status(200).json({
      status: 'success',
      message: `Ticket ${action}d successfully`,
      data: {
        recordId: record._id,
        recordType: type,
        recordNumber: type === 'booking' ? record.bookingNumber : record.hiringNumber,
        action,
        verification: verification.isManual ? verification : null
      }
    });

  } catch (error) {
    console.error('Error in manual ticket validation:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while validating ticket',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Helper function to validate ticket status
 */
function validateTicketStatus(record, recordType, ticketData) {
  const now = new Date();
  const departureDate = new Date(recordType === 'booking' ? record.departureDate : record.startDate);
  
  // Check if ticket is expired
  if (departureDate < now.setHours(0, 0, 0, 0) - 24 * 60 * 60 * 1000) {
    return {
      valid: false,
      message: 'Ticket has expired',
      reason: 'expired'
    };
  }

  // Check payment status
  if (record.paymentStatus !== 'Paid') {
    return {
      valid: false,
      message: 'Ticket payment is not complete',
      reason: 'payment_incomplete',
      paymentStatus: record.paymentStatus
    };
  }

  // Check booking/hiring status
  if (!['Confirmed', 'Completed'].includes(record.status)) {
    return {
      valid: false,
      message: `${recordType} status is ${record.status}`,
      reason: 'invalid_status',
      status: record.status
    };
  }

  // Check if already used (has verification records)
  const hasVerifications = record.verifications && record.verifications.length > 0;
  const lastVerification = hasVerifications ? record.verifications[record.verifications.length - 1] : null;
  
  if (hasVerifications && lastVerification?.result === 'valid') {
    return {
      valid: true,
      message: 'Ticket is valid but has already been verified',
      reason: 'already_verified',
      alreadyUsed: true,
      verification: lastVerification
    };
  }

  return {
    valid: true,
    message: 'Ticket is valid',
    reason: 'valid',
    alreadyUsed: false
  };
}

/**
 * Helper function to log verification attempts
 */
async function logVerificationAttempt(logData) {
  try {
    // In a real app, you might want to store this in a separate VerificationLog collection
    console.log('Verification attempt:', logData);
    
    // For now, we'll add it to the booking/hiring record
    const { recordId, recordType, ...verificationData } = logData;
    
    if (recordType === 'booking') {
      await Booking.findByIdAndUpdate(recordId, {
        $push: { verificationAttempts: verificationData }
      });
    } else if (recordType === 'hiring') {
      await Hiring.findByIdAndUpdate(recordId, {
        $push: { verificationAttempts: verificationData }
      });
    }
  } catch (error) {
    console.error('Error logging verification attempt:', error);
  }
}

/**
 * Helper function to update ticket usage
 */
async function updateTicketUsage(record, recordType, usageData) {
  try {
    if (!record.verifications) {
      record.verifications = [];
    }

    record.verifications.push({
      ...usageData,
      result: 'valid'
    });

    await record.save();
  } catch (error) {
    console.error('Error updating ticket usage:', error);
  }
}

module.exports = exports;

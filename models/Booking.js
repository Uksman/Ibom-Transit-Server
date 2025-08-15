const mongoose = require('mongoose');
const crypto = require('crypto');

const BookingSchema = new mongoose.Schema({
  // Basic booking information
  bookingNumber: {
    type: String,
    unique: true,
    default: function() {
      // Generate a unique booking reference
      return 'BKG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    }
  },
  bookingType: {
    type: String,
    enum: ['One-Way', 'Round-Trip'],
    required: [true, 'Please specify booking type']
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed', 'No-Show', 'Refunded'],
    default: 'Pending'
  },
  passengers: [{
    name: {
      type: String,
      required: [true, 'Please provide passenger name']
    },
    age: {
      type: Number,
      required: [true, 'Please provide passenger age']
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
      required: [true, 'Please specify passenger gender']
    },
    seatNumber: {
      type: String,
      required: [true, 'Please select a seat number']
    },
    passengerType: {
      type: String,
      enum: ['Adult', 'Child', 'Senior'],
      default: 'Adult'
    },
    specialRequirements: String,
    documentType: {
      type: String,
      enum: ['ID Card', 'Passport', 'Driving License', 'None'],
      default: 'None'
    },
    documentNumber: String
  }],
  contactDetails: {
    email: String,
    phone: String,
    alternatePhone: String
  },
  
  // Trip information
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: [true, 'Please specify the route']
  },
  bus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: [true, 'Please specify the bus']
  },
  departureDate: {
    type: Date,
    required: [true, 'Please provide departure date']
  },
  returnDate: {
    type: Date,
    // Required only for round trips
    validate: {
      validator: function(returnDate) {
        if (this.bookingType === 'Round-Trip') {
          return !!returnDate;
        }
        return true;
      },
      message: 'Return date is required for round trips'
    }
  },
  selectedSeats: {
    outbound: [String],
    return: [String] // For round trips
  },
  
  // Payment information
  totalFare: {
    type: Number,
    required: [true, 'Please provide the total fare']
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded', 'Partially Paid', 'Partially Refunded'],
    default: 'Pending'
  },
  // Payment history - array of all payment attempts/transactions
  payments: [{
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'NGN'
    },
    method: {
      type: String,
      enum: ['Paystack', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Cash', 'Mobile Money', 'Other'],
      default: 'Paystack'
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      sparse: true // This allows multiple null values
    },
    reference: String, // Payment gateway reference
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', 'Cancelled', 'Refunded'],
      default: 'Pending'
    },
    gateway: {
      type: String,
      default: 'Paystack'
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed // Store full gateway response
    },
    date: {
      type: Date,
      default: Date.now
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Refund information
  refunds: [{
    amount: {
      type: Number,
      required: true
    },
    reason: String,
    refundTransactionId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed'],
      default: 'Pending'
    },
    date: {
      type: Date,
      default: Date.now
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Payment metadata
  paymentMetadata: {
    totalPaid: {
      type: Number,
      default: 0
    },
    totalRefunded: {
      type: Number,
      default: 0
    },
    lastPaymentDate: Date,
    lastPaymentMethod: String,
    paymentInitiatedAt: Date,
    paymentCompletedAt: Date
  },
  
  // Relationships
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please specify the user who made this booking']
  },
  
  // Metadata
  additionalInformation: {
    bookingSource: {
      type: String,
      enum: ['Website', 'Mobile App', 'Customer Service', 'Agent', 'Other'],
      default: 'Website'
    },
    promoCode: String,
    discountApplied: Number,
    ipAddress: String,
    userAgent: String
  },
  // Ticket verification tracking
  verifications: [{
    verifiedAt: {
      type: Date,
      default: Date.now
    },
    verifiedBy: {
      type: String, // Conductor ID or user ID
      required: true
    },
    verificationLocation: String,
    busUsed: String,
    result: {
      type: String,
      enum: ['valid', 'invalid', 'expired'],
      default: 'valid'
    },
    notes: String,
    isManual: {
      type: Boolean,
      default: false
    }
  }],
  verificationAttempts: [{
    ticketId: String,
    conductorId: String,
    busId: String,
    location: String,
    result: Boolean,
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // System fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate booking number before saving
BookingSchema.pre('save', function(next) {
  if (!this.bookingNumber) {
    this.bookingNumber = 'BKG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  next();
});

// Method to calculate total fare
BookingSchema.methods.calculateTotalFare = async function() {
  try {
    const Route = mongoose.model('Route');
    const route = await Route.findById(this.route);
    
    if (!route) {
      throw new Error('Route not found');
    }
    
    let totalFare = 0;
    
    // Calculate fare for each passenger
    for (const passenger of this.passengers) {
      const options = {
        isChild: passenger.passengerType === 'Child',
        isSenior: passenger.passengerType === 'Senior',
        // Additional options can be determined here
        isPeakTime: this._isPeakTime(),
        isWeekend: this._isWeekend(),
        isHoliday: false, // Would need a holiday service to determine this
      };
      
      let passengerFare = route.calculateFare(options);
      totalFare += passengerFare;
    }
    
    // For round trips, double the fare (excluding any special calculations)
    if (this.bookingType === 'Round-Trip') {
      totalFare *= 2;
    }
    
    // Apply any discounts from promo codes
    if (this.additionalInformation && this.additionalInformation.discountApplied) {
      totalFare = totalFare * (1 - this.additionalInformation.discountApplied);
    }
    
    this.totalFare = Math.round(totalFare * 100) / 100;
    return this.totalFare;
  } catch (error) {
    console.error('Error calculating fare:', error);
    throw error;
  }
};

// Check if time is peak time (typically morning and evening commute)
BookingSchema.methods._isPeakTime = function() {
  const departureHour = new Date(this.departureDate).getHours();
  return (departureHour >= 7 && departureHour <= 9) || (departureHour >= 16 && departureHour <= 19);
};

// Check if date is weekend
BookingSchema.methods._isWeekend = function() {
  const day = new Date(this.departureDate).getDay();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
};

// Method to check seat availability
BookingSchema.methods.checkSeatAvailability = async function() {
  try {
    const Booking = mongoose.model('Booking');
    
    // Find all confirmed and pending bookings for the same route, bus and date
    const bookings = await Booking.find({
      route: this.route,
      bus: this.bus,
      departureDate: {
        $gte: new Date(this.departureDate).setHours(0, 0, 0, 0),
        $lt: new Date(this.departureDate).setHours(23, 59, 59, 999)
      },
      status: { $in: ['Confirmed', 'Pending'] },
      _id: { $ne: this._id } // Exclude the current booking
    });
    
    // Get all selected seats from other bookings
    const bookedSeats = new Set();
    bookings.forEach(booking => {
      booking.passengers.forEach(passenger => {
        bookedSeats.add(passenger.seatNumber);
      });
    });
    
    // Check if any of the seats in this booking are already booked
    const conflictingSeats = [];
    this.passengers.forEach(passenger => {
      if (bookedSeats.has(passenger.seatNumber)) {
        conflictingSeats.push(passenger.seatNumber);
      }
    });
    
    // For round trips, check return journey seats too
    let returnConflictingSeats = [];
    if (this.bookingType === 'Round-Trip' && this.returnDate) {
      const returnBookings = await Booking.find({
        route: this.route,
        bus: this.bus,
        departureDate: {
          $gte: new Date(this.returnDate).setHours(0, 0, 0, 0),
          $lt: new Date(this.returnDate).setHours(23, 59, 59, 999)
        },
        status: { $in: ['Confirmed', 'Pending'] },
        _id: { $ne: this._id }
      });
      
      const returnBookedSeats = new Set();
      returnBookings.forEach(booking => {
        booking.passengers.forEach(passenger => {
          returnBookedSeats.add(passenger.seatNumber);
        });
      });
      
      // Check if our return seats conflict
      if (this.selectedSeats && this.selectedSeats.return) {
        this.selectedSeats.return.forEach(seat => {
          if (returnBookedSeats.has(seat)) {
            returnConflictingSeats.push(seat);
          }
        });
      }
    }
    
    return {
      isAvailable: conflictingSeats.length === 0 && returnConflictingSeats.length === 0,
      conflictingSeats,
      returnConflictingSeats
    };
  } catch (error) {
    console.error('Error checking seat availability:', error);
    throw error;
  }
};

// Method to update booking status
BookingSchema.methods.updateStatus = async function(newStatus, reason = '') {
  try {
    const validStatuses = ['Pending', 'Confirmed', 'Cancelled', 'Completed', 'No-Show', 'Refunded'];
    
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }
    
    const oldStatus = this.status;
    this.status = newStatus;
    
    // Add status change to history if we implement a statusHistory field
    
    // If the booking is cancelled or refunded, handle that process
    if (newStatus === 'Cancelled' || newStatus === 'Refunded') {
      await this.handleCancellation(reason);
    }
    
    // If status is completed, you might want to do some post-trip processing
    
    await this.save();
    
    return {
      success: true,
      oldStatus,
      newStatus
    };
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
};

// Method to add a payment to the booking
BookingSchema.methods.addPayment = function(paymentData) {
  try {
    const {
      amount,
      transactionId,
      reference,
      method = 'Paystack',
      gateway = 'Paystack',
      gatewayResponse,
      processedBy
    } = paymentData;

    // Check if payment with this transaction ID already exists
    const existingPayment = this.payments.find(p => p.transactionId === transactionId);
    if (existingPayment) {
      throw new Error('Payment with this transaction ID already exists');
    }

    // Add the payment
    const payment = {
      amount: parseFloat(amount),
      method,
      transactionId,
      reference,
      gateway,
      gatewayResponse,
      status: 'Completed',
      date: new Date(),
      processedBy
    };

    this.payments.push(payment);
    this.updatePaymentStatus();
    this.updatePaymentMetadata();

    return payment;
  } catch (error) {
    console.error('Error adding payment:', error);
    throw error;
  }
};

// Method to update payment status based on payments
BookingSchema.methods.updatePaymentStatus = function() {
  const totalPaid = this.getTotalPaid();
  const totalFare = this.totalFare || 0;
  const totalRefunded = this.getTotalRefunded();

  if (totalPaid >= totalFare && totalRefunded === 0) {
    this.paymentStatus = 'Paid';
  } else if (totalPaid > 0 && totalPaid < totalFare) {
    this.paymentStatus = 'Partially Paid';
  } else if (totalRefunded > 0 && totalRefunded < totalPaid) {
    this.paymentStatus = 'Partially Refunded';
  } else if (totalRefunded >= totalPaid && totalPaid > 0) {
    this.paymentStatus = 'Refunded';
  } else if (totalPaid === 0) {
    this.paymentStatus = 'Pending';
  }

  // Update booking status if payment is complete and booking is pending
  if (this.paymentStatus === 'Paid' && this.status === 'Pending') {
    this.status = 'Confirmed';
  }
};

// Method to get total paid amount
BookingSchema.methods.getTotalPaid = function() {
  return this.payments
    .filter(payment => payment.status === 'Completed')
    .reduce((total, payment) => total + payment.amount, 0);
};

// Method to get total refunded amount
BookingSchema.methods.getTotalRefunded = function() {
  return this.refunds
    .filter(refund => refund.status === 'Completed')
    .reduce((total, refund) => total + refund.amount, 0);
};

// Method to update payment metadata
BookingSchema.methods.updatePaymentMetadata = function() {
  if (!this.paymentMetadata) {
    this.paymentMetadata = {};
  }

  this.paymentMetadata.totalPaid = this.getTotalPaid();
  this.paymentMetadata.totalRefunded = this.getTotalRefunded();

  const lastPayment = this.payments
    .filter(p => p.status === 'Completed')
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  if (lastPayment) {
    this.paymentMetadata.lastPaymentDate = lastPayment.date;
    this.paymentMetadata.lastPaymentMethod = lastPayment.method;
  }

  // Set payment completion date if fully paid
  if (this.paymentStatus === 'Paid' && !this.paymentMetadata.paymentCompletedAt) {
    this.paymentMetadata.paymentCompletedAt = new Date();
  }
};

// Method to add a refund
BookingSchema.methods.addRefund = function(refundData) {
  try {
    const {
      amount,
      reason,
      refundTransactionId,
      processedBy
    } = refundData;

    const refund = {
      amount: parseFloat(amount),
      reason,
      refundTransactionId: refundTransactionId || `REF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      status: 'Completed',
      date: new Date(),
      processedBy
    };

    this.refunds.push(refund);
    this.updatePaymentStatus();
    this.updatePaymentMetadata();

    return refund;
  } catch (error) {
    console.error('Error adding refund:', error);
    throw error;
  }
};

// Method to handle cancellations
BookingSchema.methods.handleCancellation = async function(reason = '') {
  try {
    const now = new Date();
    const departureDate = new Date(this.departureDate);
    const hoursToDeparture = (departureDate - now) / (1000 * 60 * 60);
    
    // Different refund policies based on cancellation time
    let refundPercentage = 0;
    
    if (hoursToDeparture > 72) {
      // More than 72 hours before departure - full refund
      refundPercentage = 1.0;
    } else if (hoursToDeparture > 48) {
      // 48-72 hours before departure - 75% refund
      refundPercentage = 0.75;
    } else if (hoursToDeparture > 24) {
      // 24-48 hours before departure - 50% refund
      refundPercentage = 0.5;
    } else if (hoursToDeparture > 12) {
      // 12-24 hours before departure - 25% refund
      refundPercentage = 0.25;
    }
    // Less than 12 hours - no refund (refundPercentage remains 0)
    
    // Calculate refund amount based on what was actually paid
    const totalPaid = this.getTotalPaid();
    const refundAmount = Math.round(totalPaid * refundPercentage * 100) / 100;
    
    if (refundAmount > 0) {
      // Add refund record
      const refund = this.addRefund({
        amount: refundAmount,
        reason: `Cancellation: ${reason}`,
        refundTransactionId: `REF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
      });

      return {
        success: true,
        refundAmount,
        refundPercentage,
        refundTransactionId: refund.refundTransactionId
      };
    }
    
    return {
      success: true,
      refundAmount: 0,
      refundPercentage: 0,
      message: 'No refund applicable due to cancellation policy'
    };
  } catch (error) {
    console.error('Error handling cancellation:', error);
    throw error;
  }
};

// Method to validate payment amount
BookingSchema.methods.validatePaymentAmount = function(amount) {
  const totalPaid = this.getTotalPaid();
  const remainingAmount = this.totalFare - totalPaid;
  
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }
  
  if (amount > remainingAmount) {
    throw new Error(`Payment amount (${amount}) exceeds remaining balance (${remainingAmount})`);
  }
  
  return true;
};

module.exports = mongoose.model('Booking', BookingSchema);


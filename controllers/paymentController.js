const Booking = require("../models/Booking");
const Hiring = require("../models/Hiring");
const crypto = require('crypto');
const NotificationService = require('../services/notificationService');

// Initialize Paystack with error handling
let Paystack;
try {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }
  Paystack = require("paystack-api")(process.env.PAYSTACK_SECRET_KEY);
} catch (error) {
  console.error('Failed to initialize Paystack:', error.message);
}

/**
 * @desc    Verify Paystack payment
 * @route   POST /api/payments/verify
 * @access  Public (webhook) / Private (manual verification)
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { reference, bookingId } = req.body;

    // Validate required fields
    if (!reference) {
      return res.status(400).json({
        status: "error",
        message: "Payment reference is required",
      });
    }

    if (!Paystack) {
      return res.status(500).json({
        status: "error",
        message: "Payment gateway not configured",
      });
    }

    // Verify payment with Paystack
    const verification = await Paystack.transaction.verify({ reference });

    if (verification.status && verification.data.status === "success") {
      const paymentData = verification.data;
      const amount = paymentData.amount / 100; // Convert from kobo to NGN
      
      // Find booking or hiring by ID or by metadata
      let booking, hiring;
      if (bookingId) {
        booking = await Booking.findById(bookingId);
      } else if (paymentData.metadata && paymentData.metadata.bookingId) {
        booking = await Booking.findById(paymentData.metadata.bookingId);
      }
      
      // Check for hiring if no booking found
      const { hiringId } = req.body;
      if (!booking && hiringId) {
        hiring = await Hiring.findById(hiringId);
      } else if (!booking && paymentData.metadata && paymentData.metadata.hiringId) {
        hiring = await Hiring.findById(paymentData.metadata.hiringId);
      }

      if (!booking && !hiring) {
        // If no booking or hiring found, still return successful verification
        // This handles cases where payment verification is called independently
        return res.status(200).json({
          status: "success",
          message: "Payment verified successfully (no booking/hiring linked)",
          data: {
            reference,
            amount,
            status: paymentData.status,
            paidAt: paymentData.paid_at,
            customer: paymentData.customer,
          },
        });
      }

      // Validate payment amount against booking/hiring total
      const currentRecord = booking || hiring;
      const expectedAmount = booking ? booking.totalFare : hiring.totalCost;
      const totalPaid = booking ? booking.getTotalPaid() : hiring.totalPaid;
      const remainingAmount = expectedAmount - totalPaid;

      if (amount > remainingAmount + 0.01) { // Allow for small rounding differences
        return res.status(400).json({
          status: "error",
          message: `Payment amount (${amount}) exceeds remaining balance (${remainingAmount})`,
          data: {
            expectedAmount,
            totalPaid,
            remainingAmount,
            paymentAmount: amount
          }
        });
      }

      // Check if payment hasn't been processed already
      const existingPayment = currentRecord.payments.find(
        payment => payment.reference === reference || payment.transactionId === reference
      );

      if (existingPayment) {
        return res.status(200).json({
          status: "success",
          message: "Payment has already been processed",
          data: {
            [booking ? 'booking' : 'hiring']: {
              id: currentRecord._id,
              [booking ? 'bookingNumber' : 'hiringNumber']: booking ? booking.bookingNumber : hiring.hiringNumber,
              status: currentRecord.status,
              paymentStatus: currentRecord.paymentStatus,
            },
            payment: {
              reference,
              amount,
              status: "already_processed",
              paidAt: existingPayment.date,
            },
          },
        });
      }

      // Add payment to booking/hiring using the appropriate method
      try {
        let payment;
        if (booking) {
          payment = booking.addPayment({
            amount,
            transactionId: reference,
            reference,
            method: 'Paystack',
            gateway: 'Paystack',
            gatewayResponse: paymentData,
            processedBy: req.user?.id
          });
          await booking.save();
        } else {
          // For hiring, use the processPayment method
          const result = await hiring.processPayment({
            amount,
            method: 'Credit Card', // Use valid enum value instead of 'Paystack'
            transactionId: reference
          });
          payment = result.payment;
          
          // Update hiring status based on payment
          if (hiring.paymentStatus === 'Paid' && hiring.status === 'Pending') {
            hiring.status = 'Confirmed';
            await hiring.save();
          }
        }

        // Log successful payment
        console.log(`Payment processed successfully: ${reference} for ${booking ? 'booking' : 'hiring'} ${booking ? booking.bookingNumber : hiring.hiringNumber}`);

        // Send automatic payment success notification
        try {
          const notificationService = new NotificationService(req.io);
          const paymentDetails = {
            amount,
            method: 'Paystack',
            transactionId: reference,
            currency: 'NGN'
          };
          
          if (booking) {
            await notificationService.sendBookingNotification(
              booking,
              'payment_successful',
              paymentDetails
            );
          } else if (hiring) {
            await notificationService.sendHiringNotification(
              hiring,
              'payment_successful',
              paymentDetails
            );
          }
        } catch (notificationError) {
          console.error('Error sending payment success notification:', notificationError);
          // Don't fail the payment verification if notification fails
        }

        return res.status(200).json({
          status: "success",
          message: `Payment verified and ${booking ? 'booking' : 'hiring'} updated successfully`,
          data: {
            [booking ? 'booking' : 'hiring']: {
              id: currentRecord._id,
              [booking ? 'bookingNumber' : 'hiringNumber']: booking ? booking.bookingNumber : hiring.hiringNumber,
              status: currentRecord.status,
              paymentStatus: currentRecord.paymentStatus,
              totalPaid: booking ? booking.getTotalPaid() : hiring.totalPaid,
              remainingBalance: Math.max(0, (booking ? booking.totalFare : hiring.totalCost) - (booking ? booking.getTotalPaid() : hiring.totalPaid))
            },
            payment: {
              reference,
              amount,
              status: paymentData.status,
              paidAt: paymentData.paid_at,
              transactionId: payment.transactionId || reference
            },
          },
        });
      } catch (paymentError) {
        console.error('Error adding payment to booking:', paymentError);
        return res.status(400).json({
          status: "error",
          message: paymentError.message || "Failed to process payment",
        });
      }
    } else {
      return res.status(400).json({
        status: "error",
        message: "Payment verification failed",
        data: {
          reference,
          status: verification.data?.status || 'failed',
          message: verification.message || 'Payment not successful'
        },
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while verifying payment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Initialize Paystack payment
 * @route   POST /api/payments/initialize
 * @access  Private
 */
exports.initializePayment = async (req, res) => {
  try {
    const { email, amount, bookingId, hiringId, metadata } = req.body;

    if (!email || !amount) {
      return res.status(400).json({
        status: "error",
        message: "Email and amount are required",
      });
    }

    if (!Paystack) {
      return res.status(500).json({
        status: "error",
        message: "Payment gateway not configured",
      });
    }

    // Validate that either bookingId or hiringId is provided
    if (!bookingId && !hiringId) {
      return res.status(400).json({
        status: "error",
        message: "Either bookingId or hiringId is required",
      });
    }

    // Initialize payment with Paystack
    const paymentData = {
      email,
      amount: amount, // Amount should already be in kobo from client
      currency: "NGN",
      metadata: {
        bookingId,
        hiringId,
        userId: req.user?.id,
        ...metadata,
      },
    };

    const response = await Paystack.transaction.initialize(paymentData);

    if (response.status) {
      res.status(200).json({
        status: "success",
        message: "Payment initialized successfully",
        data: {
          authorizationUrl: response.data.authorization_url,
          accessCode: response.data.access_code,
          reference: response.data.reference,
        },
      });
    } else {
      res.status(400).json({
        status: "error",
        message: "Failed to initialize payment",
        error: response.message,
      });
    }
  } catch (error) {
    console.error("Error initializing payment:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while initializing payment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get payment details
 * @route   GET /api/payments/:reference
 * @access  Private
 */
exports.getPaymentDetails = async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await Paystack.transaction.verify({ reference });

    if (response.status) {
      res.status(200).json({
        status: "success",
        data: {
          reference: response.data.reference,
          amount: response.data.amount / 100,
          status: response.data.status,
          paidAt: response.data.paid_at,
          customer: response.data.customer,
          metadata: response.data.metadata,
        },
      });
    } else {
      res.status(404).json({
        status: "error",
        message: "Payment not found",
      });
    }
  } catch (error) {
    console.error("Error getting payment details:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while fetching payment details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

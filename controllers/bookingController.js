const Booking = require('../models/Booking');
const Route = require('../models/Route');
const Bus = require('../models/Bus');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const NotificationService = require('../services/notificationService');
const { generateTicket, generateTicketPDF } = require('../utils/ticketGenerator');
const TicketNotificationService = require('../services/ticketNotificationService');
const Paystack = require("paystack-api")(process.env.PAYSTACK_SECRET_KEY);
// Helper functions
const generatePDF = async (booking) => {
  // In a real application, this would generate a PDF
  // For now, just return booking data for demo purposes
  return {
    bookingNumber: booking.bookingNumber,
    generatedAt: new Date(),
    content: `Receipt for booking ${booking.bookingNumber}`,
    format: "pdf",
  };
};

const verifyPayment = async (transactionId) => {
  try {
    const response = await Paystack.transaction.verify({
      reference: transactionId,
    });
    return {
      success: response.data.status === "success",
      transactionId: response.data.reference,
      amount: response.data.amount / 100, // Convert from kobo to NGN
      timestamp: new Date(response.data.paid_at),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Helper method to get the user ID associated with a booking
 * Used by the checkOwnership middleware
 * @param {String} bookingId - The booking ID to check
 * @returns {Promise<String>} - The user ID who owns the booking
 */
exports.getBookingUserId = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return null;
    }
    return booking.user;
  } catch (error) {
    console.error("Error getting booking user ID:", error);
    return null;
  }
};

/**
 * Get all bookings (with filtering) - Admin only
 * GET /api/bookings
 * Private/Admin
 */
exports.getBookings = async (req, res) => {
  try {
    const {
      status,
      route,
      bus,
      startDate,
      endDate,
      user,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortDirection = "desc",
    } = req.query;

    // Build query
    const query = {};

    // Add filters if they exist
    if (status) query.status = status;
    if (route) query.route = route;
    if (bus) query.bus = bus;
    if (user) query.user = user;

    // Date range filter
    if (startDate || endDate) {
      query.departureDate = {};
      if (startDate) query.departureDate.$gte = new Date(startDate);
      if (endDate) query.departureDate.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortDirection === "desc" ? -1 : 1;

    // Execute query with pagination
    const bookings = await Booking.find(query)
      .populate("user", "name email phone")
      .populate("route", "source destination departureTime arrivalTime")
      .populate("bus", "busNumber type capacity")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Booking.countDocuments(query);

    res.status(200).json({
      status: "success",
      count: bookings.length,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
      data: bookings,
    });
  } catch (error) {
    console.error("Error getting bookings:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while fetching bookings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get all bookings for the current user
 * @route   GET /api/bookings/me
 * @access  Private
 */
exports.getUserBookings = async (req, res) => {
  try {
    const {
      status,
      type,
      page = 1,
      limit = 10,
      sortBy = "departureDate",
      sortDirection = "desc",
    } = req.query;
    
    // Build query
    const query = { user: req.user.id };

    // Add filters if they exist
    if (status) query.status = status;
    if (type) query.bookingType = type;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortDirection === "desc" ? -1 : 1;

    // Execute query with pagination
    const bookings = await Booking.find(query)
      .populate("route", "source destination departureTime arrivalTime")
      .populate("bus", "busNumber type capacity")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Booking.countDocuments(query);

    res.status(200).json({
      status: "success",
      count: bookings.length,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
      data: bookings,
    });
  } catch (error) {
    console.error("Error getting user bookings:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while fetching your bookings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get booking by ID
 * @route   GET /api/bookings/:id
 * @access  Private (own booking or admin)
 */
exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("user", "name email phone")
      .populate(
        "route",
        "source destination departureTime arrivalTime distance durationMinutes"
      )
      .populate("bus", "busNumber type capacity amenities");

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: booking,
    });
  } catch (error) {
    console.error("Error getting booking:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while fetching booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Create a new booking
 * POST /api/bookings
 * Private
 */
exports.createBooking = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        errors: errors.array(),
      });
    }

    const {
      route,
      bus,
      departureDate,
      returnDate,
      bookingType,
      selectedSeats,
      passengers,
      additionalInformation,
      specialRequests,
      promoCode,
    } = req.body;

    // Check if route exists
    const routeData = await Route.findById(route);
    if (!routeData) {
      return res.status(400).json({
        status: "error",
        message: "Route not found",
      });
    }

    // Check if bus exists
    const busData = await Bus.findById(bus);
    if (!busData) {
      return res.status(400).json({
        status: "error",
        message: "Bus not found",
      });
    }

    // Check bus availability
    const departureDateTime = new Date(departureDate);
    const returnDateTime = returnDate ? new Date(returnDate) : null;

    // Check for hiring conflicts first - if bus is hired, it's not available for booking
    const Hiring = require('../models/Hiring');
    const hiringConflicts = await Hiring.find({
      bus,
      $or: [
        // Check if hiring period overlaps with departure date
        {
          $and: [
            { startDate: { $lte: departureDateTime } },
            { endDate: { $gte: departureDateTime } }
          ]
        },
        // Check if hiring period overlaps with return date (if round trip)
        ...(returnDateTime ? [{
          $and: [
            { startDate: { $lte: returnDateTime } },
            { endDate: { $gte: returnDateTime } }
          ]
        }] : [])
      ],
      status: { $in: ['Confirmed', 'Pending', 'In Progress'] }
    });

    if (hiringConflicts.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Bus is not available for booking as it is hired during the selected period",
        conflictingHirings: hiringConflicts.map(h => h.hiringNumber),
      });
    }

    // Get all bookings for the same bus and dates (outbound and return)
    const existingBookings = await Booking.find({
      bus,
      $or: [
        { departureDate: departureDateTime },
        ...(returnDateTime ? [{ returnDate: returnDateTime }] : []),
      ],
      status: { $in: ["Pending", "Confirmed"] },
    });

    // Count total booked seats for outbound and return dates
    const bookedSeats = { outbound: new Set(), return: new Set() };
    existingBookings.forEach((booking) => {
      if (booking.departureDate.getTime() === departureDateTime.getTime()) {
        booking.passengers.forEach((p) =>
          bookedSeats.outbound.add(p.seatNumber)
        );
      }
      if (
        booking.returnDate &&
        booking.returnDate.getTime() === returnDateTime?.getTime()
      ) {
        booking.selectedSeats.return.forEach((seat) =>
          bookedSeats.return.add(seat)
        );
      }
    });

    // Check if there are enough seats available
    const requiredSeats = passengers.length;
    if (bookedSeats.outbound.size + requiredSeats > busData.capacity) {
      return res.status(400).json({
        status: "error",
        message: "Not enough seats available for the outbound trip",
        availableSeats: busData.capacity - bookedSeats.outbound.size,
        requiredSeats,
        conflictingBookings: existingBookings.map((b) => b.bookingNumber),
      });
    }
    if (
      bookingType === "Round-Trip" &&
      bookedSeats.return.size + requiredSeats > busData.capacity
    ) {
      return res.status(400).json({
        status: "error",
        message: "Not enough seats available for the return trip",
        availableSeats: busData.capacity - bookedSeats.return.size,
        requiredSeats,
        conflictingBookings: existingBookings.map((b) => b.bookingNumber),
      });
    }

    // Check for duplicate seats within the request
    const outboundSeats = selectedSeats?.outbound || [];
    const passengerSeats = passengers.map((p) => p.seatNumber);
    const uniqueOutboundSeats = new Set(outboundSeats);
    const uniquePassengerSeats = new Set(passengerSeats);

    if (
      uniqueOutboundSeats.size !== outboundSeats.length ||
      uniquePassengerSeats.size !== passengerSeats.length
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Duplicate seat selections are not allowed within the same booking",
        duplicateSeats: [
          ...outboundSeats.filter(
            (seat, index) => outboundSeats.indexOf(seat) !== index
          ),
          ...passengerSeats.filter(
            (seat, index) => passengerSeats.indexOf(seat) !== index
          ),
        ],
      });
    }

    // Ensure selectedSeats.outbound matches passenger seat numbers
    if (
      outboundSeats.length !== passengers.length ||
      !outboundSeats.every((seat) => passengerSeats.includes(seat))
    ) {
      return res.status(400).json({
        status: "error",
        message: "Selected seats must match passenger seat assignments",
      });
    }

    // Check seat conflicts
    if (selectedSeats?.outbound && selectedSeats.outbound.length > 0) {
      const existingSeatConflicts = await Booking.find({
        bus,
        $or: [
          { departureDate: departureDateTime },
          ...(returnDateTime ? [{ returnDate: returnDateTime }] : []),
        ],
        status: { $in: ["Pending", "Confirmed"] },
        "passengers.seatNumber": { $in: selectedSeats.outbound },
      });

      if (existingSeatConflicts.length > 0) {
        const bookedSeats = [];
        existingSeatConflicts.forEach((booking) => {
          booking.passengers.forEach((passenger) => {
            if (selectedSeats.outbound.includes(passenger.seatNumber)) {
              bookedSeats.push(passenger.seatNumber);
            }
          });
        });

        return res.status(400).json({
          status: "error",
          message:
            "The selected seats are already booked for the specified dates",
          bookedSeats: [...new Set(bookedSeats)], // Remove duplicates
          conflictingBookings: existingSeatConflicts.map(
            (b) => b.bookingNumber
          ),
        });
      }

      // Check return seats for round-trip
      if (
        bookingType === "Round-Trip" &&
        selectedSeats?.return &&
        selectedSeats.return.length > 0
      ) {
        const returnSeatConflicts = await Booking.find({
          bus,
          returnDate: returnDateTime,
          status: { $in: ["Pending", "Confirmed"] },
          "passengers.seatNumber": { $in: selectedSeats.return },
        });

        if (returnSeatConflicts.length > 0) {
          const bookedReturnSeats = [];
          returnSeatConflicts.forEach((booking) => {
            booking.passengers.forEach((passenger) => {
              if (selectedSeats.return.includes(passenger.seatNumber)) {
                bookedReturnSeats.push(passenger.seatNumber);
              }
            });
          });

          return res.status(400).json({
            status: "error",
            message: "The selected return seats are already booked",
            bookedSeats: [...new Set(bookedReturnSeats)],
            conflictingBookings: returnSeatConflicts.map(
              (b) => b.bookingNumber
            ),
          });
        }
      }
    }

    // Calculate fare
    let totalFare = 0;
    let baseFare = routeData.baseFare || 0;

    // Add passenger fare
    totalFare = baseFare * passengers.length;

    // Apply round trip pricing if applicable
    if (bookingType === "Round-Trip") {
      totalFare *= 2; // Round trip is 2x the one-way price
    }

    // Apply promo code discount if applicable
    if (promoCode) {
      // In a real application, validate promo code from database
      if (promoCode === "WELCOME10") {
        totalFare = totalFare * 0.9; // 10% discount
      }
    }

    // Create booking
    const newBooking = new Booking({
      user: req.user.id,
      route,
      bus,
      departureDate,
      returnDate,
      bookingType,
      selectedSeats: selectedSeats || { outbound: [], return: [] },
      passengers,
      specialRequests,
      promoCode,
      additionalInformation: {
        bookingSource: additionalInformation?.bookingSource || "Website",
        promoCode: additionalInformation?.promoCode || promoCode,
        discountApplied: additionalInformation?.discountApplied || 0,
        ipAddress: additionalInformation?.ipAddress,
        userAgent: additionalInformation?.userAgent,
      },
      totalFare: Math.round(totalFare * 100) / 100,
      status: "Pending",
    });

    await newBooking.save();

    // Emit real-time seat update to all users viewing this bus
    if (req.io) {
      req.io.to(`bus:${bus}`).emit('seat-updated', {
        busId: bus,
        date: departureDate,
        bookingId: newBooking._id,
        action: 'booking_created',
        affectedSeats: passengers.map(p => p.seatNumber),
        timestamp: new Date()
      });
      console.log(`🚌 Seat update emitted for bus ${bus}`);
    }

    // Notify user about booking (in a real app)
    // sendBookingConfirmationEmail(newBooking);

    res.status(201).json({
      status: "success",
      message: "Booking created successfully",
      data: newBooking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while creating booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Update booking
 * @route   PUT /api/bookings/:id
 * @access  Private (admin only for most fields, users can update limited fields)
 */
exports.updateBooking = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        errors: errors.array(),
      });
    }

    // Find the booking
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    // Check if the user is allowed to update this booking
    const isAdmin = req.user.role === "admin";
    const isOwner = booking.user.toString() === req.user.id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        status: "error",
        message: "You are not authorized to update this booking",
      });
    }

    // Check if booking status allows updates
    if (booking.status === "Completed" || booking.status === "Cancelled") {
      return res.status(400).json({
        status: "error",
        message: `Cannot update a booking with status: ${booking.status}`,
      });
    }

    // Determine which fields can be updated based on user role
    const {
      passengers,
      specialRequests,
      seatNumbers,
      departureDate,
      returnDate,
      route,
      bus,
      status,
      paymentStatus,
    } = req.body;

    // Regular users can only update certain fields
    if (!isAdmin) {
      const fieldsAllowedForUsers = [
        "passengers",
        "specialRequests",
        "seatNumbers",
      ];
      const attemptedFields = Object.keys(req.body);

      // Check if user is trying to update fields they're not allowed to
      const unauthorizedFields = attemptedFields.filter(
        (field) => !fieldsAllowedForUsers.includes(field)
      );

      if (unauthorizedFields.length > 0) {
        return res.status(403).json({
          status: "error",
          message: `You are not authorized to update the following fields: ${unauthorizedFields.join(
            ", "
          )}`,
        });
      }
    }

    // Update allowed fields
    if (passengers) booking.passengers = passengers;
    if (specialRequests !== undefined)
      booking.specialRequests = specialRequests;

    // Admin-only fields
    if (isAdmin) {
      if (departureDate) booking.departureDate = departureDate;
      if (returnDate) booking.returnDate = returnDate;
      if (route) booking.route = route;
      if (bus) booking.bus = bus;
      if (status) booking.status = status;
      if (paymentStatus) booking.paymentStatus = paymentStatus;

      // Recalculate fare if related fields changed
      if (route || passengers) {
        const routeData = await Route.findById(booking.route);
        if (routeData) {
          let baseFare = routeData.baseFare || 0;
          let totalFare = baseFare * booking.passengers.length;

          // Apply round trip pricing if applicable
          if (booking.bookingType === "Round-Trip") {
            totalFare *= 2; // Round trip is 2x the one-way price
          }

          // Apply promo code discount if applicable
          if (booking.promoCode) {
            if (booking.promoCode === "WELCOME10") {
              totalFare = totalFare * 0.9; // 10% discount
            }
          }

          booking.totalFare = Math.round(totalFare * 100) / 100;
        }
      }
    }

    // Save the updated booking
    await booking.save();

    res.status(200).json({
      status: "success",
      message: "Booking updated successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while updating booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Update booking status
 * @route   PATCH /api/bookings/:id/status
 * @access  Private/Admin
 */
exports.updateBookingStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    // Validate status
    const validStatuses = [
      "Pending",
      "Confirmed",
      "Cancelled",
      "Completed",
      "No-Show",
    ];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: `Status must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Find booking
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    // Prevent certain status transitions
    if (booking.status === "Cancelled" && status !== "Cancelled") {
      return res.status(400).json({
        status: "error",
        message: "Cannot change status of a cancelled booking",
      });
    }

    if (booking.status === "Completed" && status !== "Completed") {
      return res.status(400).json({
        status: "error",
        message: "Cannot change status of a completed booking",
      });
    }

    // Update status
    const oldStatus = booking.status;
    booking.status = status;

    // Add status history entry
    booking.statusHistory = booking.statusHistory || [];
    booking.statusHistory.push({
      status,
      date: new Date(),
      notes: notes || "",
      updatedBy: req.user.id,
    });

    // Additional logic for specific status changes
    if (status === "Cancelled") {
      // Handle cancellation - might involve refund logic in a real application
      booking.cancellationReason = notes || "Cancelled by admin";
      booking.cancelledAt = new Date();

      // In a real app, you might process refunds here
      // booking.refundAmount = calculateRefundAmount(booking);
    }

    await booking.save();

    // Send notifications based on status changes
    const notificationController = require('./notificationController');
    
    if (oldStatus !== "Confirmed" && status === "Confirmed") {
      // Send booking confirmation notification
      try {
        await notificationController.createBookingNotification(booking, 'booking_confirmed', req.io);
      } catch (error) {
        console.error('Error sending booking confirmation notification:', error);
      }
    }
    
    if (oldStatus !== "Completed" && status === "Completed") {
      // Send booking completion notification
      try {
        await notificationController.createBookingNotification(booking, 'booking_completed', req.io);
      } catch (error) {
        console.error('Error sending booking completion notification:', error);
      }
    }
    
    if (oldStatus !== "Cancelled" && status === "Cancelled") {
      // Send booking cancellation notification
      try {
        await notificationController.createBookingNotification(booking, 'booking_cancelled', req.io);
      } catch (error) {
        console.error('Error sending booking cancellation notification:', error);
      }
    }

    res.status(200).json({
      status: "success",
      message: `Booking status updated from ${oldStatus} to ${status}`,
      data: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        statusHistory: booking.statusHistory,
      },
    });
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while updating booking status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Cancel booking
 * @route   DELETE /api/bookings/:id
 * @access  Private (own booking or admin)
 */
exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;

    // Find booking
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    // Check if booking can be cancelled
    if (booking.status === "Cancelled") {
      return res.status(400).json({
        status: "error",
        message: "Booking is already cancelled",
      });
    }

    if (booking.status === "Completed") {
      return res.status(400).json({
        status: "error",
        message: "Cannot cancel a completed booking",
      });
    }

    // Check if it's too late to cancel
    const now = new Date();
    const departureDate = new Date(booking.departureDate);
    const hoursToDepature = (departureDate - now) / (1000 * 60 * 60);

    // Only admins can cancel last-minute (less than 24 hours to departure)
    const isAdmin = req.user.role === "admin";
    if (hoursToDepature < 24 && !isAdmin) {
      return res.status(400).json({
        status: "error",
        message:
          "Bookings cannot be cancelled less than 24 hours before departure",
        hoursToDepature,
      });
    }

    // Calculate refund amount (if any)
    let refundAmount = 0;
    let refundPercentage = 0;

    if (
      booking.paymentStatus === "Paid" ||
      booking.paymentStatus === "Partially Paid"
    ) {
      // Example refund policy
      if (hoursToDepature > 72) {
        // More than 3 days - full refund
        refundPercentage = 1.0;
      } else if (hoursToDepature > 48) {
        // 2-3 days - 75% refund
        refundPercentage = 0.75;
      } else if (hoursToDepature > 24) {
        // 1-2 days - 50% refund
        refundPercentage = 0.5;
      } else if (isAdmin) {
        // Less than 24 hours but admin is cancelling - 50% refund
        refundPercentage = 0.5;
      }

      // Calculate actual refund amount
      const totalPaid =
        booking.payments?.reduce((sum, payment) => sum + payment.amount, 0) ||
        0;
      refundAmount = Math.round(totalPaid * refundPercentage * 100) / 100;
    }

    // Update booking
    booking.status = "Cancelled";
    booking.cancellationReason = reason || "Cancelled by user";
    booking.cancelledAt = new Date();
    booking.cancelledBy = req.user.id;
    booking.refundAmount = refundAmount;

    // Add status history entry
    booking.statusHistory = booking.statusHistory || [];
    booking.statusHistory.push({
      status: "Cancelled",
      date: new Date(),
      notes: reason || "Cancelled by user",
      updatedBy: req.user.id,
    });

    await booking.save();

    // Emit real-time seat update to all users viewing this bus
    if (req.io) {
      req.io.to(`bus:${booking.bus}`).emit('seat-updated', {
        busId: booking.bus,
        date: booking.departureDate,
        bookingId: booking._id,
        action: 'booking_cancelled',
        affectedSeats: booking.passengers.map(p => p.seatNumber),
        timestamp: new Date()
      });
      console.log(`🚌 Seat update emitted for bus ${booking.bus} (booking cancelled)`);
    }

    // In a real app, process the refund here
    // const refundResult = await processRefund(booking, refundAmount);

    res.status(200).json({
      status: "success",
      message: "Booking cancelled successfully",
      data: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        refundAmount,
        refundPercentage,
      },
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while cancelling booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Check seat availability for a bus on a specific date
 * @route   GET /api/bookings/check-availability
 * @access  Public
 */
exports.checkSeatAvailability = async (req, res) => {
  try {
    const { busId, date } = req.query;

    if (!busId || !date) {
      return res.status(400).json({
        status: "error",
        message: "Bus ID and date are required",
      });
    }

    // Validate bus exists
    const Bus = require('../models/Bus');
    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({
        status: "error",
        message: "Bus not found",
      });
    }

    // Parse the date and get start/end of day
    const searchDate = new Date(date);
    const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

    // Get all confirmed and pending bookings for this bus on this date
    const existingBookings = await Booking.find({
      bus: busId,
      departureDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: { $in: ["Pending", "Confirmed"] },
    }).populate('passengers');

    // Extract booked seats
    const bookedSeats = new Set();
    existingBookings.forEach(booking => {
      booking.passengers.forEach(passenger => {
        if (passenger.seatNumber) {
          bookedSeats.add(passenger.seatNumber);
        }
      });
    });

    // Generate available seats based on bus capacity
    const availableSeats = [];
    for (let i = 1; i <= bus.capacity; i++) {
      const seatId = `S${i}`;
      if (!bookedSeats.has(seatId)) {
        availableSeats.push(seatId);
      }
    }

    res.status(200).json({
      status: "success",
      data: {
        busId,
        date,
        capacity: bus.capacity,
        totalBooked: bookedSeats.size,
        totalAvailable: availableSeats.length,
        bookedSeats: Array.from(bookedSeats),
        availableSeats,
      },
    });
  } catch (error) {
    console.error("Error checking seat availability:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while checking seat availability",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Process payment for booking
 * @route   POST /api/bookings/:id/payment
 * @access  Private (own booking or admin)
 */
exports.processPayment = async (req, res) => {
  try {
    const { amount, paymentMethod, cardDetails, transactionId } = req.body;

    // Find booking
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    // Check if booking can accept payments
    if (booking.status === "Cancelled") {
      return res.status(400).json({
        status: "error",
        message: "Cannot process payment for a cancelled booking",
      });
    }

    if (booking.paymentStatus === "Paid") {
      return res.status(400).json({
        status: "error",
        message: "Booking is already fully paid",
      });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid payment amount",
      });
    }

    // Validate payment amount
    try {
      booking.validatePaymentAmount(amount);
    } catch (validationError) {
      return res.status(400).json({
        status: "error",
        message: validationError.message,
      });
    }

    // In a real application, process payment through a payment gateway
    // For this example, we'll simulate a successful payment
    const paymentResult = {
      success: true,
      transactionId:
        transactionId ||
        `TXN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      timestamp: new Date(),
    };

    if (paymentResult.success) {
      try {
        // Add payment using the new method
        const payment = booking.addPayment({
          amount,
          transactionId: paymentResult.transactionId,
          reference: paymentResult.transactionId,
          method: paymentMethod || "Credit Card",
          gateway: "Manual",
          gatewayResponse: paymentResult,
          processedBy: req.user.id
        });

        await booking.save();

        // Send automatic payment success notification with payment details
        try {
          const notificationService = new NotificationService(req.io);
          await notificationService.sendBookingNotification(booking, 'payment_successful', {
            amount,
            method: paymentMethod || 'Credit Card',
            transactionId: paymentResult.transactionId,
            currency: '₦',
            timestamp: new Date()
          });
        } catch (notificationError) {
          console.error('Error sending payment success notification:', notificationError);
          // Don't fail the payment processing if notification fails
        }

        // Generate and send ticket notification after successful payment
        if (booking.paymentStatus === 'Paid') {
          try {
            // Generate ticket
            const ticket = await generateTicket(booking, 'booking');
            
            // Send ticket notification with email, in-app notification, and SMS
            await TicketNotificationService.sendTicketNotification(
              ticket, 
              booking.user, 
              'booking'
            );
            
            console.log(`Ticket notification sent for booking ${booking.bookingNumber}`);
          } catch (ticketError) {
            console.error('Error sending ticket notification:', ticketError);
            // Don't fail the payment processing if ticket notification fails
          }
        }

        // In a real app, send payment confirmation email
        // sendPaymentConfirmationEmail(booking, amount);

        res.status(200).json({
          status: "success",
          message: "Payment processed successfully",
          data: {
            id: booking._id,
            bookingNumber: booking.bookingNumber,
            paymentStatus: booking.paymentStatus,
            bookingStatus: booking.status,
            paymentDetails: {
              amount,
              method: paymentMethod || "Credit Card",
              transactionId: paymentResult.transactionId,
              date: new Date(),
              totalPaid: booking.getTotalPaid(),
              remainingBalance: Math.max(0, booking.totalFare - booking.getTotalPaid()),
            },
          },
        });
      } catch (paymentError) {
        return res.status(400).json({
          status: "error",
          message: paymentError.message || "Failed to process payment",
        });
      }
    } else {
      // Handle payment failure
      res.status(400).json({
        status: "error",
        message: "Payment processing failed",
        data: {
          reason: paymentResult.error || "Unknown payment processing error",
        },
      });
    }
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while processing payment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get booking receipt/ticket
 * @route   GET /api/bookings/:id/receipt
 * @access  Private (own booking or admin)
 */
exports.getBookingReceipt = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("user", "name email phone")
      .populate("route", "source destination departureTime arrivalTime")
      .populate("bus", "busNumber type capacity amenities");

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    if (booking.paymentStatus !== "Paid") {
      return res.status(400).json({
        status: "error",
        message: "Cannot generate ticket for unpaid booking",
      });
    }

    // Generate ticket with QR code
    const ticket = await generateTicket(booking, 'booking');

    res.status(200).json({
      status: "success",
      message: "Ticket generated successfully",
      data: {
        ticket,
        booking: {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          status: booking.status,
          paymentStatus: booking.paymentStatus
        }
      },
    });
  } catch (error) {
    console.error("Error generating ticket:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while generating ticket",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Download booking ticket as PDF
 * @route   GET /api/bookings/:id/ticket/pdf
 * @access  Private (own booking or admin)
 */
exports.downloadBookingTicketPDF = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("user", "name email phone")
      .populate("route", "source destination departureTime arrivalTime")
      .populate("bus", "busNumber type capacity amenities");

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    if (booking.paymentStatus !== "Paid") {
      return res.status(400).json({
        status: "error",
        message: "Cannot generate ticket PDF for unpaid booking",
      });
    }

    // Generate ticket with QR code
    const ticket = await generateTicket(booking, 'booking');
    
    // Generate PDF
    const pdfBuffer = await generateTicketPDF(ticket);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-${booking.bookingNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating ticket PDF:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while generating ticket PDF",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get booking statistics
 * @route   GET /api/bookings/stats
 * @access  Private/Admin
 */
exports.getBookingStats = async (req, res) => {
  try {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to last 30 days
      endDate = new Date(),
      groupBy = "day", // 'day', 'week', 'month'
    } = req.query;

    // Build the aggregation pipeline
    const pipeline = [
      // Match bookings within date range
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
      },
      // Group by specified time period and status
      {
        $group: {
          _id: {
            status: "$status",
            period:
              groupBy === "day"
                ? { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                : groupBy === "week"
                ? { $dateToString: { format: "%Y-%U", date: "$createdAt" } }
                : { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          },
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [
                { $in: ["$paymentStatus", ["Paid", "Partially Paid"]] },
                {
                  $sum: {
                    $map: {
                      input: "$payments",
                      as: "payment",
                      in: "$$payment.amount",
                    },
                  },
                },
                0,
              ],
            },
          },
        },
      },
      // Reshape for easier client consumption
      {
        $group: {
          _id: "$_id.period",
          period: { $first: "$_id.period" },
          stats: {
            $push: {
              status: "$_id.status",
              count: "$count",
              revenue: "$revenue",
            },
          },
          totalCount: { $sum: "$count" },
          totalRevenue: { $sum: "$revenue" },
        },
      },
      // Sort by period
      { $sort: { period: 1 } },
    ];

    // Execute aggregation
    const stats = await Booking.aggregate(pipeline);

    // Calculate overall totals
    const overall = {
      totalBookings: stats.reduce((sum, period) => sum + period.totalCount, 0),
      totalRevenue: stats.reduce((sum, period) => sum + period.totalRevenue, 0),
      averageBookingsPerPeriod:
        stats.length > 0
          ? stats.reduce((sum, period) => sum + period.totalCount, 0) /
            stats.length
          : 0,
      averageRevenuePerPeriod:
        stats.length > 0
          ? stats.reduce((sum, period) => sum + period.totalRevenue, 0) /
            stats.length
          : 0,
    };

    // Get status distribution
    const statusCounts = await Booking.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      data: {
        timeRange: {
          start: startDate,
          end: endDate,
          groupedBy: groupBy,
        },
        periodStats: stats,
        overall,
        statusDistribution: statusCounts,
      },
    });
  } catch (error) {
    console.error("Error getting booking stats:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while retrieving booking statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Search bookings
 * @route   GET /api/bookings/search
 * @access  Private/Admin
 */
exports.searchBookings = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;

    if (!query || query.trim().length < 3) {
      return res.status(400).json({
        status: "error",
        message: "Search query must be at least 3 characters long",
      });
    }

    // Build search criteria
    const searchCriteria = {
      $or: [
        { bookingNumber: { $regex: query, $options: "i" } },
        { "passengers.name": { $regex: query, $options: "i" } },
        { "passengers.phone": { $regex: query, $options: "i" } },
        { "passengers.email": { $regex: query, $options: "i" } },
      ],
    };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute search query
    const bookings = await Booking.find(searchCriteria)
      .populate("user", "name email phone")
      .populate("route", "source destination departureTime arrivalTime")
      .populate("bus", "busNumber type")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Get total count for pagination
    const total = await Booking.countDocuments(searchCriteria);

    res.status(200).json({
      status: "success",
      count: bookings.length,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
      data: bookings,
    });
  } catch (error) {
    console.error("Error searching bookings:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while searching bookings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Permanently delete booking
 * @route   DELETE /api/bookings/:id/permanent
 * @access  Private/Admin
 */
exports.deleteBooking = async (req, res) => {
  try {
    // Find booking
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    // Store booking details for response
    const bookingDetails = {
      id: booking._id,
      bookingNumber: booking.bookingNumber,
      user: booking.user,
      status: booking.status,
    };

    // Permanently delete the booking
    await Booking.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: "success",
      message: "Booking permanently deleted",
      data: bookingDetails,
    });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while deleting booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Send booking notification
 * @route   POST /api/bookings/:id/notify
 * @access  Private/Admin
 */
exports.sendBookingNotification = async (req, res) => {
  try {
    const {
      message,
      notificationType = "info",
      sendEmail = false,
      sendSms = false,
      sendPush = true,
    } = req.body;

    if (!message) {
      return res.status(400).json({
        status: "error",
        message: "Notification message is required",
      });
    }

    // Find booking
    const booking = await Booking.findById(req.params.id).populate(
      "user",
      "name email phone notificationPreferences deviceTokens"
    );

    if (!booking) {
      return res.status(404).json({
        status: "error",
        message: "Booking not found",
      });
    }

    // Prepare notification data
    const notification = {
      type: notificationType,
      message,
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
      },
      timestamp: new Date(),
    };

    // Channels to notify through
    const channels = [];

    // In a real app, you would send actual notifications
    // For now, we'll just log and track them

    // Track in booking's notification history
    booking.notifications = booking.notifications || [];
    booking.notifications.push({
      message,
      type: notificationType,
      timestamp: new Date(),
      sentBy: req.user.id,
      sentThrough: [],
    });

    // Real-time socket notification (always enabled if socket exists)
    if (req.io) {
      req.io
        .to(`booking:${booking._id}`)
        .emit("booking:notification", notification);
      channels.push("socket");
      booking.notifications[booking.notifications.length - 1].sentThrough.push(
        "socket"
      );
    }

    // Email notification
    if (sendEmail && booking.user && booking.user.email) {
      // In a real app: await sendEmail(booking.user.email, 'Booking Update', message);
      console.log(`Email would be sent to ${booking.user.email}`);
      channels.push("email");
      booking.notifications[booking.notifications.length - 1].sentThrough.push(
        "email"
      );
    }

    // SMS notification
    if (sendSms && booking.user && booking.user.phone) {
      // In a real app: await sendSms(booking.user.phone, message);
      console.log(`SMS would be sent to ${booking.user.phone}`);
      channels.push("sms");
      booking.notifications[booking.notifications.length - 1].sentThrough.push(
        "sms"
      );
    }

    // Push notification
    if (
      sendPush &&
      booking.user &&
      booking.user.deviceTokens &&
      booking.user.deviceTokens.length > 0
    ) {
      // In a real app: await sendPushNotification(booking.user.deviceTokens, notification);
      console.log(
        `Push notification would be sent to ${booking.user.deviceTokens.length} devices`
      );
      channels.push("push");
      booking.notifications[booking.notifications.length - 1].sentThrough.push(
        "push"
      );
    }

    await booking.save();

    res.status(200).json({
      status: "success",
      message: "Notification sent successfully",
      data: {
        notification,
        sentThrough: channels,
      },
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({
      status: "error",
      message: "Server error while sending notification",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

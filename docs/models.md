# Data Models

This service uses Mongoose models. Key fields and instance methods are listed.

## User
- Fields: name, email, password (hashed), role (client|admin), phone, isActive, notificationPreferences, deviceTokens
- Methods:
  - getSignedJwtToken()
  - matchPassword(enteredPassword)

## Bus
- Fields: busNumber, type, capacity, amenities[], registrationNumber, status, seatingArrangement { rows, columns, layout }
- Virtuals: routes, bookings, hirings
- Methods: isAvailable(startDate, endDate)

## Route
- Fields: routeCode, name, source, destination, distance, estimatedDuration, departureTime, arrivalTime, operatingDays[], baseFare, bus
- Methods:
  - checkAvailability(date)
  - calculateFare({ isChild, isSenior, isPeakTime, isWeekend, isHoliday, date }) -> { total, base, ... }
  - generateSchedule(startDate, endDate)
  - getAnalytics({ startDate, endDate })
  - statics: updatePopularity()

## Booking
- Fields: bookingNumber, bookingType, status, passengers[], route, bus, departureDate, returnDate, selectedSeats, totalFare, paymentStatus, payments[], refunds[], user, verifications[]
- Methods:
  - calculateTotalFare()
  - checkSeatAvailability()
  - updateStatus(newStatus)
  - addPayment({ amount, transactionId, reference, method, gateway, processedBy })
  - updatePaymentStatus(), getTotalPaid(), getTotalRefunded(), updatePaymentMetadata()
  - addRefund({ amount, reason, refundTransactionId })
  - handleCancellation(reason)
  - validatePaymentAmount(amount)

## Hiring
- Fields: hiringNumber, status, route?, startLocation, endLocation, startDate, endDate, tripType, returnDate?, estimatedDistance, baseRate, rateType, routePriceMultiplier, additionalCharges[], driverAllowance, totalCost, deposit, paymentStatus, payments[], user, bus
- Methods:
  - calculateTotalCost()
  - _isPeakTime(), _isWeekend()
  - checkBusAvailability()
  - updateStatus(newStatus)
  - handleCancellation(reason)
  - processPayment({ amount, method, transactionId }) -> { payment, paymentStatus, hiringStatus }
  - virtuals: totalPaid, remainingBalance, durationDays, durationHours

## Notification
- Fields: recipient, recipientRole, title, message, type, category, priority, relatedBooking, relatedBus, relatedRoute, read, delivered, channels, data, scheduledFor, expiresAt, createdBy
- Methods:
  - markAsRead(), markAsDelivered(channel)
  - statics: createAndSend(notificationData), getUnreadCount(userId), markAllAsRead(userId)
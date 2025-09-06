# Debug API (development only)

Base: /api/debug (auth required)

Available only when NODE_ENV=development.

## POST /test-notification
Creates a test notification for the current user; emits via Socket.io if available.

## POST /test-payment-notification
Sends a payment_successful notification for a booking or hiring.

Body: { bookingId?: string, hiringId?: string }

## GET /socket-status
Returns Socket.io status and connected clients.
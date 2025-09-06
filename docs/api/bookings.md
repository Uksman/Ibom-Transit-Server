# Bookings API

Base: /api/bookings

## GET /check-availability
Public. Query: busId, date. Returns booked and available seats.

## GET /me (auth)
List current user's bookings with filters and pagination.

## GET /stats (admin)
Aggregated stats with optional startDate, endDate, groupBy.

## GET /search (admin)
Search by bookingNumber or passenger fields.

## GET /
Admin-only. List all bookings with filters: status, route, bus, user, date range.

## GET /:id (auth owner|admin)
Get booking by ID.

## POST / (auth)
Create a booking. Validates seats, capacity, duplicates, conflicts with hirings.

Body example (minimal):
```json
{
  "route":"<routeId>",
  "bus":"<busId>",
  "departureDate":"2025-05-12T08:00:00.000Z",
  "bookingType":"One-Way",
  "selectedSeats":{"outbound":["S1","S2"]},
  "passengers":[{"name":"Ada","age":30,"gender":"Female","seatNumber":"S1"},{"name":"Tunde","age":32,"gender":"Male","seatNumber":"S2"}]
}
```

## PUT /:id (auth owner limited | admin full)
Update booking; non-admins can change limited fields.

## PATCH /:id/status (admin)
Update booking status with history; emits notifications for key transitions.

## DELETE /:id (auth owner|admin)
Cancel booking; computes refunds by policy and emits seat updates.

## DELETE /:id/permanent (admin)
Permanent delete.

## POST /:id/payment (auth owner|admin)
Process a payment; updates paymentStatus, emits notifications, may send ticket if fully paid.

## GET /:id/receipt (auth)
Generate ticket JSON with QR code (requires Paid).

## GET /:id/ticket/pdf (auth)
Download ticket PDF (requires Paid).
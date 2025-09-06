# Hiring API

Base: /api/hiring

## GET /
Admin-only. List hirings with filters and pagination.

## GET /me (auth)
List current user's hirings.

## GET /stats (admin)
Aggregated stats for hirings.

## GET /availability
Public. Check bus availability for hiring; filters by busType and seats.

## GET /:id (auth owner|admin)
Get hiring by ID.

## POST / (auth)
Create a hiring request; validates bus, conflicts, and computes cost.

## PUT /:id (auth owner limited | admin full)
Update request; admin may trigger price recalculation.

## PATCH /:id/status (admin)
Update status; records history and emits events.

## DELETE /:id (admin)
Permanent delete.

## PATCH /:id/cancel (auth owner|admin)
Cancel request; applies refund policy.

## POST /:id/payment (auth owner|admin)
Record a payment; updates payment and hiring status; emits notifications.

## GET /:id/receipt (auth)
Generate hiring ticket JSON with QR code (requires Paid).

## GET /:id/ticket/pdf (auth)
Download hiring ticket PDF (requires Paid).

## GET /:id/contract (auth)
Generate contract (legacy endpoint).

## POST /:id/approve (admin)
Approve pending request.

## POST /:id/reject (admin)
Reject pending request with reason.

## POST /:id/notify (admin)
Send custom notification for hiring.
# Tickets API

Base: /api/tickets

## POST /verify
Public. Verify ticket QR payload.

Body:
```json
{"qrData":"<stringified QR payload>","conductorId":"...","busId":"...","location":"..."}
```
Returns validity, ticket summary, and verification notes. Logs attempt and updates usage if valid.

## GET /:id/verifications (admin|conductor)
Get verification history for a specific ticket (booking or hiring).

Query: type=booking|hiring

## GET /verification-stats (admin)
Time-series stats and top conductors over a date range.

## POST /:id/validate (admin)
Manual validation control: action=validate|invalidate|reset.
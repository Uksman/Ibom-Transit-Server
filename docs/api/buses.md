# Buses API

Base: /api/buses

## GET /
List buses with filters: status, type, capacity>=, amenities (comma), manufacturer, search, page, limit, sortBy, sortDirection

## GET /:id
Get bus by ID.

## POST / (admin)
Create bus. Auth + role admin.

Body example:
```json
{
  "busNumber":"BUS-100",
  "type":"Standard",
  "capacity":40,
  "registrationNumber":"ABZ-1234",
  "manufacturer":"Toyota",
  "model":"Coaster",
  "yearOfManufacture":2019,
  "seatingArrangement":{"rows":10,"columns":4}
}
```

## PUT /:id (admin)
Update bus.

## DELETE /:id (admin)
Delete bus (fails if active bookings/hirings exist).

## GET /:id/availability
Query: startDate, endDate. Returns availability with conflicts if any.

## GET /:id/schedule
Query: startDate, endDate (defaults to current month). Returns booking/hiring events.
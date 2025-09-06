# Routes API

Base: /api/routes

## GET /
List routes with filters: source, destination, operatingDay, bus, minPrice, maxPrice, isActive, search, pagination and sorting.

## GET /search
Query: source, destination, date?, passengers?
Returns routes (optionally filtered by operating day) with availability and fare info.

## GET /popular
Popular routes by booking count.

## GET /:id
Get a route by ID.

## GET /:id/availability
Query: date. Check availability (seats) for a date.

## GET /:id/schedule
Query: startDate, endDate. Generate schedule within range.

## POST / (admin)
Create a route. Validates time formats and bus status.

## PUT /:id (admin)
Update a route (ensures unique routeCode, bus active).

## DELETE /:id (admin)
Delete a route (blocked if active bookings exist).

## POST /bulk-delete (admin)
Delete multiple routes; partially succeeds if some have active bookings.

## PUT /bulk-status (admin)
Activate/deactivate multiple routes; partial success if some have active bookings.
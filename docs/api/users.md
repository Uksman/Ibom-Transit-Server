# Users API

Base: /api/users

All endpoints require auth unless noted. Admin access is required where specified.

## GET /
Admin-only. List users with pagination and filters.

Query: page, limit, role, isActive

## GET /me
Get current user profile.

## PUT /me
Update current user profile.

Body example:
```json
{"name":"New Name","phone":"+234..."}
```

## GET /:id (admin)
Get user by ID.

## PUT /:id (admin)
Update user by ID.

## DELETE /:id (admin)
Delete user by ID.

## POST /
Admin creates a user.

## PUT /:id/role (admin)
Update user role.

## GET /stats (admin)
User statistics.

## POST /bulk-import (admin)
Bulk import users.

## Password management
- PUT /me/password (authLimiter)
- POST /forgot-password (public)
- POST /reset-password/:token (public)

## Preferences
- GET /me/preferences
- PUT /me/preferences

## Notifications (per-user array)
- GET /me/notifications
- PUT /me/notifications/:id/read
- DELETE /me/notifications/:id
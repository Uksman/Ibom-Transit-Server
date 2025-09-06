# Notifications API

Base: /api/notifications (auth required)

All routes require auth; admin-only routes are marked.

## GET /
List current user's notifications with pagination and filters: read, category, type.

## GET /unread-count
Get unread count.

## GET /preferences
Get notification preferences for current user.

## PUT /preferences
Update notification preferences.

## PUT /mark-all-read
Mark all notifications as read.

## PUT /:id/read
Mark one notification as read.

## DELETE /:id
Delete one notification.

## Admin
- GET /admin (admin): List notifications with filters and stats
- GET /admin/stats (admin)
- DELETE /admin/:id (admin)
- POST / (admin): Create notifications for one/many/all users
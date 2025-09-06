# WebSocket Events (Socket.io)

Connect to the Socket.io endpoint exposed by the HTTP server.

## Authenticate
Client emits:
```json
{"event":"authenticate","data":{"userId":"<id>","token":"<jwt>"}}
```
Server replies with `authenticated` event.

## Rooms
- join:booking <bookingId>
- join:bus <busId>

Examples (client):
```javascript
socket.emit('join:booking', bookingId);
socket.emit('join:bus', busId);
```

## Notifications
- Client marks a notification read:
```javascript
socket.emit('notification:read', notificationId);
```
- Server emits to user room when syncing reads: notification:syncRead

## Real-time updates
- Seat updates: server emits `seat-updated` to `bus:<busId>`
- Hiring updates: `hiring:status-update`, `hiring:payment`, etc.

See routes and controllers for exact payloads.
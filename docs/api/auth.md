# Auth API

Base: /api/auth

## POST /register
Register a new user.

Request
```json
{
  "name": "Ada",
  "email": "ada@example.com",
  "password": "secret12",
  "phone": "+2348000000000",
  "role": "client"
}
```
Response 201
```json
{
  "status": "success",
  "message": "User registered successfully",
  "token": "<jwt>",
  "user": {"id":"...","name":"Ada","email":"ada@example.com","role":"client","phone":"..."}
}
```

## POST /login
Login with credentials.

Request
```json
{"email":"ada@example.com","password":"secret12"}
```
Response 200 includes token and user.

## GET /me (auth)
Returns current user profile.

## GET /logout (auth)
Logs out (stateless response).

## POST /forgot-password
Body: { "email": "..." }

## POST /reset-password
Body: { "token": "<resetToken>", "newPassword": "..." }

Notes:
- Rate limits apply via authLimiter on some user routes.
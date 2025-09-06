# Quickstart

## Prerequisites
- Node.js 18+
- MongoDB connection string in MONGO_URI
- JWT_SECRET (required)
- Optional: PAYSTACK_SECRET_KEY for payments; SMTP vars for email

## Install and Run
```bash
npm install
npm run dev
# Server at http://localhost:5000
```

## Health Check
```bash
curl -s http://localhost:5000/api/health
```

## Register and Login
```bash
# Register
curl -s -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","password":"secret12","phone":"+2348000000000"}'

# Login
curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"secret12"}'
```
Use the returned token in requests:
```
Authorization: Bearer <token>
```

## Typical Flow
1. List GET /api/routes and GET /api/buses
2. Search routes GET /api/routes/search?source=A&destination=B&date=...
3. Create booking POST /api/bookings (auth)
4. Initialize payment POST /api/payments/initialize and verify POST /api/payments/verify
5. Download ticket GET /api/bookings/:id/ticket/pdf

See API docs for endpoint details and examples.
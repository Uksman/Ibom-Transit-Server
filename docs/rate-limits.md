# Rate Limits

Standard limits (may vary by deployment):
- General API (apiLimiter): 550 requests / 15 minutes per IP
- Auth (authLimiter): 10 requests / hour per IP
- Search (searchLimiter): 50 requests / 10 minutes per IP
- Booking ops (bookingLimiter): 20 requests / hour per IP
- Ticket verification (ticketVerificationLimiter): 100 requests / 5 minutes per IP
- Admin ops (adminLimiter): 1000 requests / hour

Headers:
- RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset

Redis-backed distributed limiting is used if REDIS is configured; otherwise in-memory.

Dynamic limiter example: createDynamicRateLimiter adjusts limits by user role.
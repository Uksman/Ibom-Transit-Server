# Middleware

## Auth
- protect: Validates JWT (Authorization: Bearer) or cookie, attaches req.user
- authorize(...roles): Ensures user role is in allowed set
- checkOwnership(getUserIdFromResource): Verifies resource ownership (admins bypass)
- refreshToken: Issues a fresh token in New-Token header when expiring soon

## API Versioning
- detectVersion: Extracts version (URL/header/accept/query) and sets headers
- deprecationCheck: Adds warnings and may 410 EOL versions
- versionedResponse: Wraps JSON for legacy versions (v1.x)
- requireFeature(feature): Returns 400 if feature not available in version

## Cache
- cacheControl(options): Sets Cache-Control, supports noCache/private/maxAge
- serverCache(options): Transparent GET response caching with ETag/Last-Modified
- clearCache(routes): Clears cached prefixes post-mutation

## Rate Limiting
- apiLimiter, authLimiter, searchLimiter, bookingLimiter, adminLimiter, ticketVerificationLimiter
- createUserRateLimiter(options), createDynamicRateLimiter()

## Logger & Performance
- logger: morgan-based HTTP logs + performance monitor (slow request warnings)
- errorLogger: detailed error logging
- performanceMonitor: response time, CPU/memory deltas
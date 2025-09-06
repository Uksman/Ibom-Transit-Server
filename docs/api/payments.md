# Payments API

Base: /api/payments

## POST /verify
Verify Paystack payment by reference. Optionally link to bookingId or hiringId.

Body example:
```json
{"reference":"PSK-REF-123","bookingId":"<id>"}
```
Response includes verified record status and payment details. Prevents duplicates.

## POST /initialize (auth)
Initialize Paystack transaction.

Body example:
```json
{"email":"ada@example.com","amount":500000,"bookingId":"<id>"}
```
- amount in kobo.
- Returns authorizationUrl, accessCode, reference.

## GET /:reference (auth)
Fetch payment details by reference via Paystack.
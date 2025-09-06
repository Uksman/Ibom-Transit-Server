# Utils

## ticketGenerator
- generateTicket(data, type = 'booking') -> ticketData
- generateTicketPDF(ticketData) -> Buffer (PDF)
- verifyTicket(qrData) -> { valid, data?, message }

Ticket QR payload includes: ticketId, type, id, number, userId, status, timestamp.

Example:
```javascript
const { generateTicket, generateTicketPDF } = require('../utils/ticketGenerator');
const ticket = await generateTicket(booking, 'booking');
const pdf = await generateTicketPDF(ticket);
```
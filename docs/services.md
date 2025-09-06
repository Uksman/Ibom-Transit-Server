# Services

## NotificationService
- Constructor(io)
- sendNotification(notificationData)
- sendBulkNotification(recipients, notificationData)
- sendBookingNotification(booking, type, additionalData)
- sendHiringNotification(hiring, type, additionalData)
- sendBusNotification(bus, type, additionalData)
- sendPromotionalNotification(promoData, filters)
- sendMaintenanceNotification(maintenanceData)
- sendJourneyReminders()
- cleanupOldNotifications(daysOld)

Example:
```javascript
const service = new NotificationService(io);
await service.sendBookingNotification(booking, 'payment_successful', { amount: 5000, currency: '₦' });
```

## TicketNotificationService
- sendTicketNotification(ticketData, userData, type)
- sendReminderNotification(ticketData, userData, type, hoursBeforeDeparture)

Notes:
- Generates PDF via utils/ticketGenerator
- Sends email via nodemailer using SMTP env vars
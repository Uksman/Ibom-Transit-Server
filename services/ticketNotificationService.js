const nodemailer = require('nodemailer');
const { generateTicketPDF } = require('../utils/ticketGenerator');
const NotificationService = require('./notificationService');

class TicketNotificationService {
  constructor() {
    // Initialize email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Send ticket notification after successful payment
   * @param {Object} ticketData - Generated ticket data
   * @param {Object} userData - User data
   * @param {String} type - 'booking' or 'hiring'
   */
  async sendTicketNotification(ticketData, userData, type = 'booking') {
    try {
      console.log('Sending ticket notification to:', userData.email);

      // Generate PDF attachment
      let pdfAttachment = null;
      try {
        const pdfBuffer = await generateTicketPDF(ticketData);
        pdfAttachment = {
          filename: `${type}-ticket-${ticketData.ticketId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        };
      } catch (pdfError) {
        console.warn('Failed to generate PDF for email:', pdfError);
      }

      // Prepare email content
      const emailContent = this.generateEmailContent(ticketData, userData, type);
      
      // Email options
      const mailOptions = {
        from: `"Bus Booking System" <${process.env.SMTP_USER}>`,
        to: userData.email,
        subject: emailContent.subject,
        html: emailContent.html,
        attachments: pdfAttachment ? [pdfAttachment] : []
      };

      // Send email
      const emailResult = await this.transporter.sendMail(mailOptions);
      console.log('Ticket email sent successfully:', emailResult.messageId);

      // Create in-app notification
      await this.createInAppNotification(ticketData, userData, type);

      // Send SMS notification if phone number is available
      if (userData.phone) {
        await this.sendSMSNotification(ticketData, userData, type);
      }

      return {
        success: true,
        emailSent: true,
        emailMessageId: emailResult.messageId
      };
    } catch (error) {
      console.error('Error sending ticket notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate email content for ticket notification
   */
  generateEmailContent(ticketData, userData, type) {
    const isBooking = type === 'booking';
    const ticketNumber = isBooking ? ticketData.bookingNumber : ticketData.hiringNumber;
    const startDate = new Date(ticketData.departureDate || ticketData.startDate);
    const endDate = ticketData.returnDate ? new Date(ticketData.returnDate) : 
                   (ticketData.endDate ? new Date(ticketData.endDate) : null);

    const subject = `🎫 Your ${isBooking ? 'Bus Ticket' : 'Hiring Receipt'} - ${ticketNumber}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your ${isBooking ? 'Bus Ticket' : 'Hiring Receipt'}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF7B00; color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px 20px; border-radius: 0 0 10px 10px; }
          .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF7B00; }
          .qr-section { text-align: center; margin: 20px 0; }
          .qr-code { max-width: 200px; height: auto; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          .status-badge { background: #10B981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
          .trip-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
          .detail-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isBooking ? '🎫' : '🚌'} ${isBooking ? 'Bus Ticket Confirmed!' : 'Hiring Confirmed!'}</h1>
            <p>Thank you for choosing our service</p>
          </div>
          
          <div class="content">
            <h2>Hello ${userData.name || 'Valued Customer'},</h2>
            
            <p>Great news! Your payment has been processed successfully and your ${isBooking ? 'bus ticket' : 'hiring booking'} is now confirmed.</p>
            
            <div class="ticket-info">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3>${isBooking ? 'Ticket' : 'Booking'} Details</h3>
                <span class="status-badge">${ticketData.status}</span>
              </div>
              
              <div class="detail-item">
                <strong>${isBooking ? 'Booking' : 'Hiring'} Number:</strong>
                <span>${ticketNumber}</span>
              </div>
              
              <div class="detail-item">
                <strong>Ticket ID:</strong>
                <span>${ticketData.ticketId}</span>
              </div>
              
              <div class="detail-item">
                <strong>Route:</strong>
                <span>${ticketData.route?.source || ticketData.startLocation} → ${ticketData.route?.destination || ticketData.endLocation}</span>
              </div>
              
              <div class="detail-item">
                <strong>${isBooking ? 'Departure' : 'Start'} Date:</strong>
                <span>${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString()}</span>
              </div>
              
              ${endDate ? `
              <div class="detail-item">
                <strong>${isBooking ? 'Return' : 'End'} Date:</strong>
                <span>${endDate.toLocaleDateString()} at ${endDate.toLocaleTimeString()}</span>
              </div>
              ` : ''}
              
              <div class="detail-item">
                <strong>Bus:</strong>
                <span>${ticketData.bus?.busNumber || 'To be assigned'}</span>
              </div>
              
              ${isBooking && ticketData.passengers ? `
              <div class="detail-item">
                <strong>Passengers:</strong>
                <span>${ticketData.passengers.length}</span>
              </div>
              
              <div class="detail-item">
                <strong>Seats:</strong>
                <span>${ticketData.selectedSeats?.outbound?.join(', ') || 'N/A'}</span>
              </div>
              ` : ''}
              
              ${!isBooking && ticketData.passengerCount ? `
              <div class="detail-item">
                <strong>Passenger Count:</strong>
                <span>${ticketData.passengerCount}</span>
              </div>
              ` : ''}
              
              <div class="detail-item">
                <strong>Total ${isBooking ? 'Fare' : 'Cost'}:</strong>
                <span style="color: #FF7B00; font-weight: bold;">₦${(ticketData.totalFare || ticketData.totalCost)?.toLocaleString() || '0'}</span>
              </div>
            </div>

            ${ticketData.qrCode ? `
            <div class="qr-section">
              <h3>Digital Verification</h3>
              <img src="${ticketData.qrCode}" alt="QR Code" class="qr-code" />
              <p style="font-size: 12px; color: #666;">Show this QR code when boarding</p>
            </div>
            ` : ''}
            
            <div style="background: #E6F3FF; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #0066CC; margin-top: 0;">Important Instructions:</h4>
              <ul style="color: #0066CC; margin-bottom: 0;">
                <li>Please arrive at the departure point at least 15 minutes early</li>
                <li>Bring a valid ID for verification</li>
                <li>Keep this ticket safe - you'll need it for boarding</li>
                <li>For any changes or cancellations, contact us at least 2 hours before departure</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>For support, contact us at: support@busbookingsystem.com | Phone: +234 xxx xxxx xxx</p>
              <p>&copy; 2024 Bus Booking System. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject, html };
  }

  /**
   * Create in-app notification for ticket generation
   */
  async createInAppNotification(ticketData, userData, type) {
    try {
      const isBooking = type === 'booking';
      const ticketNumber = isBooking ? ticketData.bookingNumber : ticketData.hiringNumber;
      
      const notification = {
        user: userData._id || userData.id,
        type: 'ticket_generated',
        title: `${isBooking ? 'Ticket' : 'Receipt'} Generated`,
        message: `Your ${isBooking ? 'bus ticket' : 'hiring receipt'} ${ticketNumber} is ready! Tap to view your digital ticket.`,
        data: {
          ticketId: ticketData.ticketId,
          bookingType: type,
          bookingId: ticketData.bookingId || ticketData.hiringId,
          qrCode: ticketData.qrCode
        },
        priority: 'high'
      };

      await NotificationService.createNotification(notification);
    } catch (error) {
      console.error('Error creating in-app notification:', error);
    }
  }

  /**
   * Send SMS notification for ticket generation
   */
  async sendSMSNotification(ticketData, userData, type) {
    try {
      const isBooking = type === 'booking';
      const ticketNumber = isBooking ? ticketData.bookingNumber : ticketData.hiringNumber;
      const startDate = new Date(ticketData.departureDate || ticketData.startDate);

      const message = `🎫 ${isBooking ? 'Ticket' : 'Receipt'} Confirmed! 
${ticketNumber}
${ticketData.route?.source || ticketData.startLocation} → ${ticketData.route?.destination || ticketData.endLocation}
Date: ${startDate.toLocaleDateString()}
Ticket ID: ${ticketData.ticketId}
Amount: ₦${(ticketData.totalFare || ticketData.totalCost)?.toLocaleString() || '0'}

Show your digital ticket when boarding. Safe travels!`;

      // Here you would integrate with SMS service (Twilio, etc.)
      console.log(`SMS notification would be sent to ${userData.phone}:`, message);
      
      return { success: true, message: 'SMS notification queued' };
    } catch (error) {
      console.error('Error sending SMS notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send ticket reminder notification before departure
   */
  async sendReminderNotification(ticketData, userData, type, hoursBeforeDeparture = 24) {
    try {
      const isBooking = type === 'booking';
      const ticketNumber = isBooking ? ticketData.bookingNumber : ticketData.hiringNumber;
      const startDate = new Date(ticketData.departureDate || ticketData.startDate);

      const subject = `🔔 Travel Reminder - ${ticketNumber} in ${hoursBeforeDeparture} hours`;
      
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #FF7B00;">Travel Reminder</h2>
          <p>Hello ${userData.name},</p>
          <p>This is a friendly reminder that your ${isBooking ? 'bus trip' : 'hired bus service'} is scheduled in ${hoursBeforeDeparture} hours.</p>
          
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>Trip Details:</strong><br>
            ${isBooking ? 'Booking' : 'Hiring'} Number: ${ticketNumber}<br>
            Route: ${ticketData.route?.source || ticketData.startLocation} → ${ticketData.route?.destination || ticketData.endLocation}<br>
            Departure: ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString()}<br>
            ${ticketData.bus?.busNumber ? `Bus: ${ticketData.bus.busNumber}<br>` : ''}
          </div>
          
          <p><strong>Don't forget to:</strong></p>
          <ul>
            <li>Arrive 15 minutes early</li>
            <li>Bring a valid ID</li>
            <li>Have your digital ticket ready</li>
          </ul>
          
          <p>Have a safe trip!</p>
        </div>
      `;

      const mailOptions = {
        from: `"Bus Booking System" <${process.env.SMTP_USER}>`,
        to: userData.email,
        subject: subject,
        html: html
      };

      await this.transporter.sendMail(mailOptions);
      
      return { success: true, message: 'Reminder sent successfully' };
    } catch (error) {
      console.error('Error sending reminder notification:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TicketNotificationService();

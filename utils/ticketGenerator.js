const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

/**
 * Generate a ticket for booking or hiring
 * @param {Object} data - Booking or hiring data
 * @param {String} type - 'booking' or 'hiring'
 * @returns {Object} - Ticket data with QR code
 */
exports.generateTicket = async (data, type = 'booking') => {
  try {
    // Generate unique ticket ID
    const ticketId = `TKT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    
    // Create verification data for QR code
    const verificationData = {
      ticketId,
      type,
      id: data._id,
      number: type === 'booking' ? data.bookingNumber : data.hiringNumber,
      userId: data.user._id || data.user,
      timestamp: new Date().toISOString(),
      status: data.status
    };

    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(verificationData), {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 200
    });

    // Prepare ticket data
    const ticketData = {
      ticketId,
      type,
      qrCode: qrCodeDataURL,
      verificationData,
      generatedAt: new Date(),
      ...getTicketDetails(data, type)
    };

    return ticketData;
  } catch (error) {
    console.error('Error generating ticket:', error);
    throw new Error('Failed to generate ticket');
  }
};

/**
 * Extract relevant details for ticket based on type
 */
function getTicketDetails(data, type) {
  if (type === 'booking') {
    return {
      bookingNumber: data.bookingNumber,
      bookingId: data._id,
      route: data.route,
      bus: data.bus,
      departureDate: data.departureDate,
      returnDate: data.returnDate,
      bookingType: data.bookingType,
      passengers: data.passengers,
      selectedSeats: data.selectedSeats,
      totalFare: data.totalFare,
      paymentStatus: data.paymentStatus,
      status: data.status,
      user: {
        name: data.user.name,
        email: data.user.email,
        phone: data.user.phone
      }
    };
  } else if (type === 'hiring') {
    return {
      hiringNumber: data.hiringNumber,
      hiringId: data._id,
      route: data.route,
      bus: data.bus,
      startDate: data.startDate,
      endDate: data.endDate,
      tripType: data.tripType,
      purpose: data.purpose,
      startLocation: data.startLocation,
      endLocation: data.endLocation,
      passengerCount: data.passengerCount,
      totalCost: data.totalCost,
      paymentStatus: data.paymentStatus,
      status: data.status,
      user: {
        name: data.user.name,
        email: data.user.email,
        phone: data.user.phone
      }
    };
  }
}

/**
 * Generate PDF ticket
 * @param {Object} ticketData - Ticket data from generateTicket
 * @returns {Buffer} - PDF buffer
 */
exports.generateTicketPDF = async (ticketData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 40,
        size: 'A4',
        info: {
          Title: `${ticketData.type === 'booking' ? 'Bus Ticket' : 'Hiring Receipt'} - ${ticketData.ticketId}`,
          Author: 'Bus Booking System',
          Subject: ticketData.type === 'booking' ? 'Bus Ticket' : 'Bus Hiring Receipt',
          Keywords: 'bus ticket transport travel',
        }
      });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', error => reject(error));

      // Company branding header with background
      doc.rect(0, 0, doc.page.width, 120)
         .fillAndStroke('#FF7B00', '#FF7B00');

      // Main title
      doc.fontSize(28)
         .fillColor('white')
         .font('Helvetica-Bold')
         .text(ticketData.type === 'booking' ? '🎫 DIGITAL BUS TICKET' : '🚌 BUS HIRING RECEIPT', 40, 35, { align: 'center' });

      // Subtitle
      doc.fontSize(14)
         .fillColor('white')
         .font('Helvetica')
         .text('Your journey starts here', 40, 75, { align: 'center' });

      // Ticket ID with better styling
      doc.fontSize(10)
         .fillColor('white')
         .font('Helvetica')
         .text(`Ticket ID: ${ticketData.ticketId}`, 40, 95, { align: 'center' });

      // Main content background
      doc.rect(40, 130, doc.page.width - 80, 400)
         .strokeColor('#E5E5E5')
         .stroke();

      const isBooking = ticketData.type === 'booking';
      const yStart = 150;
      let currentY = yStart;

      // Left column - Trip details with better styling
      doc.fillColor('#FF7B00')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('🚌 TRIP DETAILS', 60, currentY);

      doc.fillColor('#000')
         .fontSize(1)
         .text('', 60, currentY + 20); // spacing line

      currentY += 35;
      
      if (isBooking) {
        doc.fontSize(10)
           .text(`Booking Number: ${ticketData.bookingNumber}`, 50, currentY);
        currentY += 15;
        
        doc.text(`Route: ${ticketData.route?.source || ticketData.startLocation} → ${ticketData.route?.destination || ticketData.endLocation}`, 50, currentY);
        currentY += 15;
        
        doc.text(`Departure: ${new Date(ticketData.departureDate).toLocaleString()}`, 50, currentY);
        currentY += 15;
        
        if (ticketData.returnDate) {
          doc.text(`Return: ${new Date(ticketData.returnDate).toLocaleString()}`, 50, currentY);
          currentY += 15;
        }
        
        doc.text(`Bus: ${ticketData.bus?.busNumber || 'TBD'}`, 50, currentY);
        currentY += 15;
        
        doc.text(`Seats: ${ticketData.selectedSeats?.outbound?.join(', ') || 'N/A'}`, 50, currentY);
        currentY += 15;
        
        doc.text(`Passengers: ${ticketData.passengers?.length || 1}`, 50, currentY);
        currentY += 15;
        
        doc.text(`Total Fare: ₦${ticketData.totalFare?.toLocaleString() || '0'}`, 50, currentY);
      } else {
        doc.fontSize(10)
           .text(`Hiring Number: ${ticketData.hiringNumber}`, 50, currentY);
        currentY += 15;
        
        doc.text(`Purpose: ${ticketData.purpose}`, 50, currentY);
        currentY += 15;
        
        doc.text(`Route: ${ticketData.startLocation} → ${ticketData.endLocation}`, 50, currentY);
        currentY += 15;
        
        doc.text(`Start: ${new Date(ticketData.startDate).toLocaleString()}`, 50, currentY);
        currentY += 15;
        
        doc.text(`End: ${new Date(ticketData.endDate).toLocaleString()}`, 50, currentY);
        currentY += 15;
        
        doc.text(`Bus: ${ticketData.bus?.busNumber || 'TBD'}`, 50, currentY);
        currentY += 15;
        
        doc.text(`Passengers: ${ticketData.passengerCount}`, 50, currentY);
        currentY += 15;
        
        doc.text(`Total Cost: ₦${ticketData.totalCost?.toLocaleString() || '0'}`, 50, currentY);
      }

      // Right column - QR Code and status
      const qrX = 350;
      doc.fontSize(14)
         .fillColor('#000')
         .text('VERIFICATION', qrX, yStart);

      // Add QR code (if we can parse the data URL)
      if (ticketData.qrCode) {
        try {
          const qrBuffer = Buffer.from(ticketData.qrCode.split(',')[1], 'base64');
          doc.image(qrBuffer, qrX, yStart + 25, { width: 120, height: 120 });
        } catch (qrError) {
          console.warn('Could not embed QR code in PDF:', qrError);
          doc.fontSize(10)
             .text('QR Code: Available in digital version', qrX, yStart + 25);
        }
      }

      doc.fontSize(10)
         .text(`Status: ${ticketData.status}`, qrX, yStart + 160);

      doc.text(`Generated: ${new Date(ticketData.generatedAt).toLocaleString()}`, qrX, yStart + 175);

      // Passenger details (for bookings)
      if (isBooking && ticketData.passengers) {
        currentY += 40;
        doc.fontSize(14)
           .fillColor('#000')
           .text('PASSENGER DETAILS', 50, currentY);

        currentY += 20;
        ticketData.passengers.forEach((passenger, index) => {
          doc.fontSize(10)
             .text(`${index + 1}. ${passenger.name} - Seat ${passenger.seatNumber}`, 50, currentY);
          currentY += 15;
        });
      }

      // Footer
      const footerY = 700;
      doc.fontSize(8)
         .fillColor('#666')
         .text('This is a computer-generated ticket. Please present this ticket and a valid ID at boarding.', 50, footerY, { align: 'center' });

      doc.text('For support, contact: support@buscompany.com', 50, footerY + 15, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Verify ticket using QR code data
 * @param {String} qrData - QR code string data
 * @returns {Object} - Verification result
 */
exports.verifyTicket = async (qrData) => {
  try {
    const verificationData = JSON.parse(qrData);
    
    // Basic validation
    if (!verificationData.ticketId || !verificationData.type || !verificationData.id) {
      return {
        valid: false,
        message: 'Invalid ticket data'
      };
    }

    // Here you would typically check against database to verify the ticket is genuine
    // For now, we'll do basic structure validation
    return {
      valid: true,
      data: verificationData,
      message: 'Ticket is valid'
    };
  } catch (error) {
    return {
      valid: false,
      message: 'Invalid QR code format'
    };
  }
};

require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoURI: process.env.MONGO_URI ,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:8081',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:4173',
  emailFrom: process.env.EMAIL_FROM || 'noreply@busbooking.com',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT || 587,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  }
};
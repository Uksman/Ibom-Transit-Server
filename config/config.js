require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoURI: process.env.MONGO_URI ,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:8081',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:4173',
  // Proper CORS origins configuration
  corsOrigins: process.env.NODE_ENV === 'development'
    ? [
        process.env.CLIENT_URL || 'http://localhost:8081',
        process.env.ADMIN_URL || 'http://localhost:4173',
        'http://localhost:3000', // Common dev port
        'http://localhost:5173', // Vite default dev port
        'http://localhost:4174'  // Vite preview port
      ]
    : [
        process.env.CLIENT_URL,
        process.env.ADMIN_URL
      ].filter(Boolean), // Remove undefined values
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
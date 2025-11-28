const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Email configuration
const createTransporter = () => {
  // Check if environment variables are set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('❌ Email environment variables missing');
    return null;
  }
  
  return nodemailer.createTransporter({
    host: 'mail.privateemail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Store verification codes (in production, use a database)
const verificationCodes = new Map();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Monster Future AI Backend is running!',
    timestamp: new Date().toISOString(),
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
  });
});

// Test email configuration
app.get('/api/test-email', async (req, res) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return res.status(500).json({
        success: false,
        message: 'Email credentials not configured. Please check environment variables in Vercel.',
        configured: false
      });
    }

    // Test connection
    await transporter.verify();
    
    res.json({
      success: true,
      message: '✅ Email configuration is working!',
      configured: true,
      emailUser: process.env.EMAIL_USER
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Email test failed: ' + error.message,
      configured: true,
      error: error.message
    });
  }
});

// Send verification code
app.post('/api/send-verification', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(500).json({
        success: false,
        message: 'Email service not configured. Please contact support.'
      });
    }

    // Generate 6-digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code with expiration (10 minutes)
    verificationCodes.set(email, {
      code: verificationCode,
      expires: Date.now() + 10 * 60 * 1000
    });

    // Send email
    await transporter.sendMail({
      from: '"Monster Future AI" <noreply@monstertrading.site>',
      to: email,
      subject: 'Monster Future AI - Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #8B0000, #FF4500); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0;">MONSTER FUTURE AI</h1>
            <p style="margin: 10px 0 0 0;">Email Verification</p>
          </div>
          <div style="padding: 30px;">
            <h2>Hello Trader! 👋</h2>
            <p>Your verification code is:</p>
            <div style="background: #f8f9fa; border: 2px dashed #8B0000; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #8B0000; letter-spacing: 5px;">
                ${verificationCode}
              </span>
            </div>
            <p><strong>This code expires in 10 minutes.</strong></p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; border-top: 1px solid #ddd;">
            <p>&copy; 2023 Monster Future AI</p>
          </div>
        </div>
      `
    });

    console.log(`✅ Verification code sent to: ${email}`);

    res.json({
      success: true,
      message: 'Verification code sent to your email!'
    });

  } catch (error) {
    console.error('❌ Email error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please try again.'
    });
  }
});

// Verify code
app.post('/api/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }

    const storedData = verificationCodes.get(email);

    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found for this email. Please request a new code.'
      });
    }

    // Check expiration
    if (Date.now() > storedData.expires) {
      verificationCodes.delete(email);
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    // Check code match
    if (storedData.code !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please check and try again.'
      });
    }

    // Success - remove code
    verificationCodes.delete(email);

    res.json({
      success: true,
      message: '🎉 Email verified successfully! Welcome to Monster Future AI.'
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.'
    });
  }
});

// Handle all other routes
app.use('*', (req, res) => {
  res.json({
    success: false,
    message: 'Route not found. Available routes: /api/health, /api/send-verification, /api/verify-code, /api/test-email'
  });
});

// Export the app
module.exports = app;

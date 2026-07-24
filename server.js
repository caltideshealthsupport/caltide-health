import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Endpoint: Check Database Connection Status
app.get('/api/health', async (req, res) => {
  try {
    const connection = await db.getConnection();
    connection.release();
    return res.status(200).json({ status: 'online', database: 'connected' });
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    return res.status(500).json({ status: 'offline', database: 'disconnected' });
  }
});

// Endpoint: Validate Whitelist & Send OTP
app.post('/api/send-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Query tblwhitelist from MySQL
    const [rows] = await db.execute('SELECT * FROM tblwhitelist WHERE LOWER(EMAIL) = ?', [cleanEmail]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Access Denied: Email address is unregistered in system logs.'
      });
    }

    const user = rows[0];

    // Safe column matching (handles uppercase/lowercase keys)
    const userStatus = user.STATUS || user.status || '';
    const userRole = user.ROLE || user.role || 'CUSTOMER';
    const userReferredBy = user.REFERREDBY || user.referredby || user.REFERRED_BY || 'CALTIDES_DIRECT';

    // Check STATUS
    if (userStatus.toUpperCase() !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Email is registered but inactive.'
      });
    }

    // Send OTP via Resend
    await resend.emails.send({
      from: 'Caltide Health <no-reply@caltideshealth.online>',
      to: [cleanEmail],
      subject: 'Your Caltide Health Login OTP',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Caltide Health Verification Code</h2>
          <p>Your OTP code to sign in is:</p>
          <h1 style="color: #2563eb; letter-spacing: 4px;">${otp}</h1>
          <p>Role: <strong>${userRole}</strong></p>
          <p>This code expires shortly. If you did not request this, please ignore this email.</p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      role: userRole,
      referredBy: userReferredBy,
      message: 'OTP Token sent to email destination successfully!'
    });

  } catch (error) {
    console.error('Error during OTP request process:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing whitelist verification.'
    });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
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
    // 1. Query tblwhitelist from MySQL
    const [rows] = await db.execute('SELECT * FROM tblwhitelist WHERE LOWER(EMAIL) = ?', [cleanEmail]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Access Denied: Email address is unregistered in system logs.'
      });
    }

    const user = rows[0];

    // Safe column matching
    const userStatus = user.STATUS || user.status || '';
    const userRole = user.ROLE || user.role || 'CUSTOMER';
    const userReferredBy = user.REFERREDBY || user.referredby || user.REFERRED_BY || 'CALTIDES_DIRECT';

    // 2. Check STATUS
    if (userStatus.toUpperCase() !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Email is registered but inactive.'
      });
    }

    // 3. Send OTP via Resend
    try {
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
    } catch (emailError) {
      console.error('Resend API Error:', emailError);
      return res.status(500).json({
        success: false,
        message: `Email delivery failed: ${emailError.message}`
      });
    }

    return res.status(200).json({
      success: true,
      role: userRole,
      referredBy: userReferredBy,
      message: 'OTP Token sent to email destination successfully!'
    });

  } catch (dbError) {
    console.error('Database Query Error:', dbError);
    return res.status(500).json({
      success: false,
      message: `Database error: ${dbError.message}`
    });
  }
});

// =========================================================================
// WHITELIST MANAGEMENT ENDPOINTS
// =========================================================================

// 1. GET: Fetch all records from tblwhitelist
app.get('/api/whitelist', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM tblwhitelist ORDER BY id DESC');

    // Normalize DB column names to match front-end expectations
    const normalizedData = rows.map((item) => ({
      id: item.ID || item.id,
      email: item.EMAIL || item.email,
      role: item.ROLE || item.role,
      status: item.STATUS || item.status,
      referredBy: item.REFERREDBY || item.referredby || item.REFERRED_BY || item.referredBy || 'CALTIDES_DIRECT',
      datecreated: item.DATECREATED || item.datecreated || '',
      timecreated: item.TIMECREATED || item.timecreated || ''
    }));

    return res.status(200).json(normalizedData);
  } catch (error) {
    console.error('Error fetching whitelist:', error);
    return res.status(500).json({ error: 'Failed to retrieve whitelist records.' });
  }
});

// 2. POST: Add a new whitelist entry
app.post('/api/whitelist', async (req, res) => {
  const { email, role, status, referredBy, datecreated, timecreated } = req.body;

  try {
    const [result] = await db.execute(
      `INSERT INTO tblwhitelist (EMAIL, ROLE, STATUS, REFERREDBY, DATECREATED, TIMECREATED) VALUES (?, ?, ?, ?, ?, ?)`,
      [email, role, status, referredBy, datecreated, timecreated]
    );

    return res.status(201).json({
      id: result.insertId,
      email,
      role,
      status,
      referredBy,
      datecreated,
      timecreated
    });
  } catch (error) {
    console.error('Error creating whitelist entry:', error);
    return res.status(500).json({ error: 'Failed to insert whitelist record.' });
  }
});

// 3. PUT: Update an existing whitelist entry
app.put('/api/whitelist/:id', async (req, res) => {
  const { id } = req.params;
  const { email, role, status, referredBy } = req.body;

  try {
    await db.execute(
      `UPDATE tblwhitelist SET EMAIL = ?, ROLE = ?, STATUS = ?, REFERREDBY = ? WHERE ID = ?`,
      [email, role, status, referredBy, id]
    );

    return res.status(200).json({ success: true, message: 'Record updated successfully.' });
  } catch (error) {
    console.error('Error updating whitelist entry:', error);
    return res.status(500).json({ error: 'Failed to update whitelist record.' });
  }
});

// 4. DELETE: Remove a whitelist entry
app.delete('/api/whitelist/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.execute('DELETE FROM tblwhitelist WHERE ID = ?', [id]);
    return res.status(200).json({ success: true, message: 'Record deleted successfully.' });
  } catch (error) {
    console.error('Error deleting whitelist entry:', error);
    return res.status(500).json({ error: 'Failed to delete whitelist record.' });
  }
});

// =========================================================================
// SYSTEM MAINTENANCE ENDPOINTS
// =========================================================================

// GET: Check if Email OTP is globally enabled
app.get('/api/maintenance/isEmailOTPEnabled', async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT VALUE FROM tblmaintenance WHERE SETTING = 'EMAIL_OTP'");
    if (rows.length > 0) {
      return res.status(200).json({ value: rows[0].VALUE || rows[0].value });
    }
    return res.status(200).json({ value: 'YES' });
  } catch (error) {
    // Return default fallback if tblmaintenance is not set up yet
    return res.status(200).json({ value: 'YES' });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
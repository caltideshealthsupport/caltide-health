import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files (html, css, js, images)
app.use(express.static(__dirname));

// Endpoint to send OTP emails
app.post('/api/send-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  try {
    const data = await resend.emails.send({
      from: 'Caltide Health <onboarding@resend.dev>', // Replace with your verified domain in production
      to: [email],
      subject: 'Your Caltide Health Login OTP',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Caltide Health Verification Code</h2>
          <p>Your OTP code to sign in is:</p>
          <h1 style="color: #2563eb; letter-spacing: 4px;">${otp}</h1>
          <p>This code expires shortly. If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    return res.status(500).json({ error: 'Failed to send OTP email' });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
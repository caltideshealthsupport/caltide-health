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
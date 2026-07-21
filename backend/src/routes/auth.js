// backend/src/routes/auth.js
//
// Endpoints:
//   POST /api/auth/register                — submit a sign-up application + verification doc
//   POST /api/auth/login                   — login with username OR email + password
//   GET  /api/auth/me                      — current user (id, email, username, is_admin, must_change_password)
//   POST /api/auth/change-password/request — current user requests password change → emails OTP
//   POST /api/auth/change-password/verify  — verify OTP + set new password

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { randomUUID: uuidv4 } = require('crypto');

const db       = require('../db');
const protect  = require('../middleware/auth');
const email    = require('../services/email');
const { generateOtp } = require('../services/credentials');

const { uploadDocument } = require('../config/cloudinary');

function buildToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    is_admin: !!u.is_admin || !!u.is_super_admin,
    is_super_admin: !!u.is_super_admin,
    must_change_password: !!u.must_change_password,
  };
}

// =============================================================================
// POST /api/auth/register   — submit a signup application
// =============================================================================
//
// Body (multipart/form-data):
//   email, full_name, graduation_year, course, student_id, reason
//   verification_doc (file)  — required
//
// Behaviour: creates a row in `pending_registrations`. The admin reviews it,
// and once approved an account is created and credentials are emailed to the
// user. NO JWT is issued at this point — the user cannot log in yet.
router.post('/register', (req, res) => {
  uploadDocument.single('verification_doc')(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });

    const {
      email: rawEmail, full_name, graduation_year, course, student_id, reason,
    } = req.body;

    if (!req.file) return res.status(400).json({ error: 'Verification document is required' });
    if (!rawEmail || !full_name) {
      // Cleanup the uploaded file we won't be using
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: 'Email and full name are required' });
    }

    const emailNormalised = rawEmail.toLowerCase().trim();

    try {
      // Email already in users?
      const userExists = await db.query('SELECT 1 FROM users WHERE email = $1', [emailNormalised]);
      if (userExists.rows.length) {
        try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(400).json({ error: 'An account with this email already exists' });
      }

      // Pending application already exists? Replace document but keep status = pending.
      const pending = await db.query('SELECT id, status FROM pending_registrations WHERE email = $1', [emailNormalised]);
      
      // Cloudinary puts the public URL in req.file.path
      const verificationUrl = req.file.path;

      if (pending.rows.length) {
        const existing = pending.rows[0];
        if (existing.status === 'pending') {
          try { fs.unlinkSync(req.file.path); } catch {}
          return res.status(409).json({
            error: 'A registration request for this email is already under review.',
          });
        }
        if (existing.status === 'rejected') {
          // Allow a fresh resubmission — overwrite the existing row.
          await db.query(
            `UPDATE pending_registrations
                SET full_name = $1, graduation_year = $2, course = $3,
                    student_id = $4, reason = $5,
                    verification_doc_url = $6, status = 'pending',
                    reviewed_by = NULL, reviewed_at = NULL,
                    rejection_reason = NULL, created_at = NOW()
              WHERE id = $7`,
            [full_name, graduation_year ? parseInt(graduation_year) : null,
             course || null, student_id || null, reason || null,
             verificationUrl, existing.id]
          );
          return res.status(201).json({
            message: 'Your application has been resubmitted for review.',
          });
        }
      }

      await db.query(
        `INSERT INTO pending_registrations
           (id, email, full_name, graduation_year, course, student_id,
            reason, verification_doc_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          uuidv4(),
          emailNormalised,
          full_name.trim(),
          graduation_year ? parseInt(graduation_year) : null,
          course || null,
          student_id || null,
          reason || null,
          verificationUrl,
        ]
      );

      res.status(201).json({
        message:
          'Application received. An administrator will verify your details and ' +
          'email you your login credentials once approved.',
      });
    } catch (err) {
      console.error('Register error:', err.message);
      try { if (req.file) fs.unlinkSync(req.file.path); } catch {}
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// =============================================================================
// POST /api/auth/login   — accepts username OR email
// =============================================================================
router.post('/login', async (req, res) => {
  const { identifier, email: rawEmail, username, password } = req.body;
  const ident = (identifier || rawEmail || username || '').toString().toLowerCase().trim();
  if (!ident || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE email = $1 OR LOWER(username) = $1',
      [ident]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ token: buildToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// =============================================================================
// GET /api/auth/me
// =============================================================================
router.get('/me', protect, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, email, username, is_admin, is_super_admin, must_change_password FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// =============================================================================
// Password change with email OTP
// =============================================================================
//
// Step 1: POST /api/auth/change-password/request
//   Body: { current_password }
//   → validates current password, generates a 6-digit OTP, hashes it, stores
//     a single active OTP per user (any prior unused OTP is invalidated),
//     emails the code, and returns 200.
//
// Step 2: POST /api/auth/change-password/verify
//   Body: { otp, new_password }
//   → checks the latest unused OTP, sets new password, clears
//     must_change_password, returns 200.

const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

router.post('/change-password/request', protect, async (req, res) => {
  const { current_password } = req.body;
  if (!current_password) return res.status(400).json({ error: 'Current password is required' });

  try {
    const { rows } = await db.query(
      'SELECT id, email, password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(current_password, user.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Invalidate any prior unused OTPs of this purpose for this user
    await db.query(
      `UPDATE otps SET used = TRUE
        WHERE user_id = $1 AND purpose = 'change_password' AND used = FALSE`,
      [user.id]
    );

    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    await db.query(
      `INSERT INTO otps (id, user_id, code_hash, purpose, expires_at)
       VALUES ($1, $2, $3, 'change_password', $4)`,
      [uuidv4(), user.id, codeHash, expiresAt]
    );

    // Pull full_name for nicer email
    const { rows: prows } = await db.query(
      'SELECT full_name FROM profiles WHERE user_id = $1', [user.id]
    );
    const tpl = email.otpEmail({
      fullName: prows[0]?.full_name,
      code,
      purpose: 'change_password',
    });
    await email.sendMail({ to: user.email, subject: tpl.subject, text: tpl.text });

    res.json({
      message: `An OTP has been sent to your email. It expires in ${OTP_TTL_MINUTES} minutes.`,
    });
  } catch (err) {
    console.error('change-password/request:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/change-password/verify', protect, async (req, res) => {
  const { otp, new_password } = req.body;
  if (!otp || !new_password) return res.status(400).json({ error: 'OTP and new password are required' });
  if (String(new_password).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const { rows } = await db.query(
      `SELECT id, code_hash, expires_at, attempts, used
         FROM otps
        WHERE user_id = $1 AND purpose = 'change_password' AND used = FALSE
        ORDER BY created_at DESC
        LIMIT 1`,
      [req.user.id]
    );
    const rec = rows[0];
    if (!rec) return res.status(400).json({ error: 'No active OTP. Please request a new code.' });

    if (new Date(rec.expires_at).getTime() < Date.now()) {
      await db.query('UPDATE otps SET used = TRUE WHERE id = $1', [rec.id]);
      return res.status(400).json({ error: 'OTP has expired. Please request a new code.' });
    }

    if (rec.attempts >= MAX_OTP_ATTEMPTS) {
      await db.query('UPDATE otps SET used = TRUE WHERE id = $1', [rec.id]);
      return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
    }

    const ok = await bcrypt.compare(String(otp), rec.code_hash);
    if (!ok) {
      await db.query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [rec.id]);
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await db.query(
      `UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2`,
      [newHash, req.user.id]
    );
    await db.query('UPDATE otps SET used = TRUE WHERE id = $1', [rec.id]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('change-password/verify:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

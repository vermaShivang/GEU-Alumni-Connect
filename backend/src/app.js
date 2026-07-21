const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
require('dotenv').config();

const app = express();

// Trust reverse proxies (Render, AWS, Cloudflare) for accurate rate limiting and IP audit capture
app.set('trust proxy', 1);

// ─── Security Response Headers (Helmet) ─────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows uploaded avatars/resumes/images to be served safely across origins
  contentSecurityPolicy: false, // API servers don't serve HTML, allowing frontend SPAs full flexibility
}));

// ─── HTTP Parameter Pollution Defense ───────────────────────────────────────
app.use(hpp());

// ─── Rate Limiting (Brute-Force & DoS Prevention) ───────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 authentication attempts per window to prevent brute-force attacks
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts from this IP, please try again after 15 minutes.' },
});

// Apply global API rate limiting
app.use('/api/', apiLimiter);

// ─── Strict Cross-Origin Resource Sharing (CORS) Policy ─────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:8080',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, server-to-server, curl) or explicitly allowed domains/devtunnels/render
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.devtunnels.ms') ||
      origin.endsWith('.onrender.com') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy: Origin not allowed'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', email_mode: (process.env.SMTP_USER ? 'smtp' : 'console') })
);

// Strict Rate Limiting on Authentication Endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/request-password-reset', authLimiter);
app.use('/api/auth/verify-reset-otp', authLimiter);

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/profiles',    require('./routes/profiles'));
app.use('/api/posts',       require('./routes/posts'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/messages',    require('./routes/messages'));
app.use('/api/resumes',     require('./routes/resumes'));
app.use('/api/communities', require('./routes/communities'));
app.use('/api/jobs',        require('./routes/jobs'));

// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Generic error handler (catches multer errors etc. that escape route handlers)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Server error' });
});

module.exports = app;

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:8080',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow devtunnels and localhost during development
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

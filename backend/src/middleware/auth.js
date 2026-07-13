// backend/src/middleware/auth.js
//
// Verifies the JWT and *additionally* hydrates `req.user.is_admin` and
// `req.user.is_super_admin` from the DB on every request. This gives every
// route handler a cheap, reliable way to check admin status without each one
// duplicating a SELECT.
//
// We do this inline here (instead of in a separate middleware) because almost
// every route already chains through `protect`, and admin moderation actions
// piggy-back on the regular routes (e.g. DELETE /api/posts/:id should also
// succeed when an admin calls it). Hitting the DB once in `protect` is cheaper
// than re-querying inside each handler that does an authorization check.
//
// We also opportunistically `UPDATE users.last_seen = NOW()` once per request,
// no more often than every 30s, so the messages page can show online presence.

const jwt = require('jsonwebtoken');
const db  = require('../db');

const PRESENCE_INTERVAL_MS = 30_000;
const lastTouch = new Map(); // userId -> ms timestamp

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

function maybeTouchPresence(userId, ip) {
  const now = Date.now();
  const prev = lastTouch.get(userId) || 0;
  if (now - prev < PRESENCE_INTERVAL_MS) return;
  lastTouch.set(userId, now);
  // Fire and forget — never block the request on this.
  db.query('UPDATE users SET last_seen = NOW(), last_ip = $2 WHERE id = $1', [userId, ip || '127.0.0.1']).catch(() => {});
}

module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, email, is_admin, is_super_admin FROM users WHERE id = $1',
      [payload.id]
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: 'User no longer exists' });

    req.user = {
      id:             u.id,
      email:          u.email,
      is_admin:       !!u.is_admin || !!u.is_super_admin,
      is_super_admin: !!u.is_super_admin,
    };

    const clientIp = getClientIp(req);
    maybeTouchPresence(u.id, clientIp);
    next();
  } catch (err) {
    console.error('auth middleware:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const { Pool, types } = require('pg');
require('dotenv').config();

// ─── Timestamp fix ─────────────────────────────────────────────────────────
// PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` (OID 1114) values come back as a
// bare string like "2026-04-29 18:30:00.123" with no zone marker. By default
// node-postgres converts that string to a JS Date as if it were in the
// **server's local timezone** — which on an IST host produces a Date that is
// 5h30m off, so freshly created rows display as "5–6 hours ago".
//
// All our timestamps are stored in UTC (Neon's default), so we tell pg to
// parse OID 1114 as UTC. This is retroactive — existing rows fix themselves.
types.setTypeParser(1114, (str) => (str ? new Date(str.replace(' ', 'T') + 'Z') : null));
// Also normalize TIMESTAMPTZ (1184) just to be safe — pg already handles this
// correctly, but if the schema is migrated to TIMESTAMPTZ later this still
// returns a proper Date.
types.setTypeParser(1184, (str) => (str ? new Date(str) : null));

const isRemoteDb = process.env.DATABASE_URL && (
  process.env.DATABASE_URL.includes('neon.tech') ||
  process.env.DATABASE_URL.includes('supabase.co') ||
  process.env.DATABASE_URL.includes('render.com') ||
  process.env.DATABASE_URL.includes('sslmode=require') ||
  process.env.NODE_ENV === 'production'
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  // Uncomment to debug:
  // console.log('Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};

const router  = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const db      = require('../db');
const protect = require('../middleware/auth');

// ─── GET /api/messages/contacts ────────────────────────────────────────────
// Returns each accepted-connection profile with:
//   last_seen          — when the other user was last active
//   last_message       — the most recent message exchanged with them
//   last_message_at
//   last_message_mine  — true if I sent the last message
//   unread_count       — messages they sent me that I haven't read yet
// Ordered by last_message_at desc (so active conversations rise to the top),
// falling back to alphabetical when there's no history.
router.get('/contacts', protect, async (req, res) => {
  try {
    const { rows } = await db.query(
      `WITH peers AS (
         SELECT CASE WHEN c.requester_id = $1 THEN c.addressee_id
                     ELSE c.requester_id END AS user_id
           FROM connections c
          WHERE c.status = 'accepted'
            AND ($1 IN (c.requester_id, c.addressee_id))
       ),
       last_msg AS (
         SELECT DISTINCT ON (peer_id)
                peer_id, content, created_at, sender_id
           FROM (
             SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS peer_id,
                    content, created_at, sender_id
               FROM messages
              WHERE sender_id = $1 OR receiver_id = $1
           ) m
          ORDER BY peer_id, created_at DESC
       ),
       unread AS (
         SELECT sender_id AS peer_id, COUNT(*)::int AS n
           FROM messages
          WHERE receiver_id = $1 AND read = FALSE
          GROUP BY sender_id
       )
       SELECT p.id, p.user_id, p.full_name, p.headline, p.avatar_url,
              p.graduation_year,
              u.last_seen,
              lm.content    AS last_message,
              lm.created_at AS last_message_at,
              (lm.sender_id = $1) AS last_message_mine,
              COALESCE(un.n, 0) AS unread_count
         FROM peers
         JOIN profiles p ON p.user_id = peers.user_id
         LEFT JOIN users    u  ON u.id        = peers.user_id
         LEFT JOIN last_msg lm ON lm.peer_id  = peers.user_id
         LEFT JOIN unread   un ON un.peer_id  = peers.user_id
        ORDER BY lm.created_at DESC NULLS LAST, p.full_name ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /messages/contacts:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/messages/:userId ─────────────────────────────────────────────
// Conversation between current user and :userId. Also marks any messages
// sent BY the other user TO me as read.
router.get('/:userId', protect, async (req, res) => {
  try {
    // Mark inbound messages as read when conversation is opened
    await db.query(
      `UPDATE messages
          SET read = TRUE
        WHERE receiver_id = $1 AND sender_id = $2 AND read = FALSE`,
      [req.user.id, req.params.userId]
    );

    const { rows } = await db.query(
      `SELECT * FROM messages
        WHERE (sender_id=$1 AND receiver_id=$2)
           OR (sender_id=$2 AND receiver_id=$1)
        ORDER BY created_at ASC`,
      [req.user.id, req.params.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/messages ────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  const { receiver_id, content } = req.body;
  if (!receiver_id || !content?.trim()) {
    return res.status(400).json({ error: 'receiver_id and content are required' });
  }
  try {
    const { rows } = await db.query(
      'INSERT INTO messages (id, sender_id, receiver_id, content) VALUES ($1,$2,$3,$4) RETURNING *',
      [uuidv4(), req.user.id, receiver_id, content.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/messages/:userId/read ───────────────────────────────────────
// Force-mark all messages from :userId as read (used when the open chat
// receives new messages via polling).
router.post('/:userId/read', protect, async (req, res) => {
  try {
    await db.query(
      `UPDATE messages
          SET read = TRUE
        WHERE receiver_id = $1 AND sender_id = $2 AND read = FALSE`,
      [req.user.id, req.params.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/messages/heartbeat ──────────────────────────────────────────
// Lightweight presence ping — the auth middleware updates last_seen anyway,
// but having a dedicated endpoint lets the messages page poll explicitly.
router.post('/heartbeat', protect, async (req, res) => {
  try {
    await db.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/messages/presence/:userId ────────────────────────────────────
// Latest last_seen for one peer (used to live-update header status).
router.get('/presence/:userId', protect, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, last_seen FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const router  = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const db      = require('../db');
const protect = require('../middleware/auth');

// GET /api/connections — all connections involving the current user
router.get('/', protect, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM connections WHERE requester_id=$1 OR addressee_id=$1',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/connections — send a connection request
router.post('/', protect, async (req, res) => {
  const { addressee_id } = req.body;
  if (!addressee_id) return res.status(400).json({ error: 'addressee_id is required' });
  if (addressee_id === req.user.id) return res.status(400).json({ error: 'Cannot connect with yourself' });

  try {
    // Check if connection already exists in either direction
    const existing = await db.query(
      `SELECT id FROM connections
       WHERE (requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1)`,
      [req.user.id, addressee_id]
    );
    if (existing.rows.length) return res.status(400).json({ error: 'Connection already exists' });

    await db.query(
      'INSERT INTO connections (id, requester_id, addressee_id, status) VALUES ($1,$2,$3,$4)',
      [uuidv4(), req.user.id, addressee_id, 'pending']
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/connections/:requesterId/accept — accept a pending request
router.put('/:requesterId/accept', protect, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE connections SET status='accepted'
       WHERE requester_id=$1 AND addressee_id=$2
       RETURNING *`,
      [req.params.requesterId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Connection request not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

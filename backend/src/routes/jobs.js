// backend/src/routes/jobs.js
//
// Endpoints:
//   GET    /api/jobs               — list job openings (most recent first, optional ?search=, ?type=)
//   GET    /api/jobs/:id           — single job
//   POST   /api/jobs               — create job (auth)
//   PUT    /api/jobs/:id           — update own job (or any if site-admin)
//   DELETE /api/jobs/:id           — delete own job (or any if site-admin)
//   POST   /api/jobs/:id/toggle    — toggle is_open (own job, or any if site-admin)

const router  = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const db      = require('../db');
const protect = require('../middleware/auth');

const VALID_TYPES = new Set(['full-time', 'part-time', 'contract', 'internship', 'remote']);

router.get('/', protect, async (req, res) => {
  const { search, type, mine } = req.query;
  const args = [];
  const conds = [];

  if (mine === '1' || mine === 'true') {
    args.push(req.user.id); conds.push(`j.posted_by = $${args.length}`);
  } else {
    conds.push(`j.is_open = TRUE`);
  }
  if (search) {
    args.push(`%${String(search).toLowerCase()}%`);
    const i = args.length;
    conds.push(`(LOWER(j.title) LIKE $${i} OR LOWER(j.company) LIKE $${i} OR LOWER(j.description) LIKE $${i})`);
  }
  if (type && VALID_TYPES.has(String(type))) {
    args.push(type); conds.push(`j.job_type = $${args.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT j.*, p.full_name AS poster_name, p.avatar_url AS poster_avatar
         FROM jobs j
         LEFT JOIN profiles p ON p.user_id = j.posted_by
         ${where}
         ORDER BY j.created_at DESC
         LIMIT 200`,
      args
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT j.*, p.full_name AS poster_name, p.avatar_url AS poster_avatar
         FROM jobs j LEFT JOIN profiles p ON p.user_id = j.posted_by
        WHERE j.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', protect, async (req, res) => {
  const {
    title, company, location, job_type, experience, salary,
    description, apply_url, apply_email,
  } = req.body;
  if (!title?.trim() || !company?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'Title, company and description are required' });
  }
  if (job_type && !VALID_TYPES.has(job_type)) {
    return res.status(400).json({ error: 'Invalid job type' });
  }
  if (!apply_url && !apply_email) {
    return res.status(400).json({ error: 'Provide an apply URL or apply email' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO jobs
         (id, posted_by, title, company, location, job_type, experience, salary,
          description, apply_url, apply_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        uuidv4(), req.user.id,
        title.trim(), company.trim(),
        location?.trim() || null, job_type || null,
        experience?.trim() || null, salary?.trim() || null,
        description.trim(),
        apply_url?.trim() || null, apply_email?.trim() || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const { rows: existing } = await db.query('SELECT posted_by FROM jobs WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Job not found' });
    if (existing[0].posted_by !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const {
      title, company, location, job_type, experience, salary,
      description, apply_url, apply_email,
    } = req.body;
    const { rows } = await db.query(
      `UPDATE jobs
          SET title=$1, company=$2, location=$3, job_type=$4, experience=$5,
              salary=$6, description=$7, apply_url=$8, apply_email=$9
        WHERE id=$10 RETURNING *`,
      [
        title, company, location || null, job_type || null,
        experience || null, salary || null,
        description, apply_url || null, apply_email || null,
        req.params.id,
      ]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT posted_by FROM jobs WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Job not found' });
    if (rows[0].posted_by !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await db.query('DELETE FROM jobs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/toggle', protect, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT posted_by, is_open FROM jobs WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Job not found' });
    if (rows[0].posted_by !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { rows: updated } = await db.query(
      'UPDATE jobs SET is_open = NOT is_open WHERE id = $1 RETURNING is_open', [req.params.id]
    );
    res.json(updated[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

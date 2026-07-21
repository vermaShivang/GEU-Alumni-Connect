// backend/src/routes/posts.js
//
// Adds:
//   GET    /api/posts/:id/comments     — list comments with author profile
//   DELETE /api/posts/:postId/comments/:commentId  — delete own comment (or admin)
//
// Admin override:
//   Site admins / super-admins can DELETE any post, regardless of ownership.

const router  = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const db      = require('../db');
const protect = require('../middleware/auth');

const { uploadImage } = require('../config/cloudinary');

// GET /api/posts — all posts with profile, likes, comment count, & user-liked flag
router.get('/', protect, async (req, res) => {
  try {
    const { rows: postsData } = await db.query(
      'SELECT * FROM posts ORDER BY created_at DESC LIMIT 200'
    );
    if (!postsData.length) return res.json([]);

    const postIds = postsData.map(p => p.id);
    const userIds = [...new Set(postsData.map(p => p.user_id).filter(Boolean))];

    const [profilesRes, likesRes, commentsRes, userLikesRes] = await Promise.all([
      db.query(
        'SELECT user_id, full_name, headline, avatar_url FROM profiles WHERE user_id = ANY($1)',
        [userIds]
      ),
      db.query('SELECT post_id FROM post_likes WHERE post_id = ANY($1)', [postIds]),
      db.query('SELECT post_id FROM comments WHERE post_id = ANY($1)', [postIds]),
      db.query(
        'SELECT post_id FROM post_likes WHERE user_id = $1 AND post_id = ANY($2)',
        [req.user.id, postIds]
      ),
    ]);

    const profilesMap = {};
    profilesRes.rows.forEach(p => { profilesMap[p.user_id] = p; });
    const likesMap = {};
    likesRes.rows.forEach(l => { likesMap[l.post_id] = (likesMap[l.post_id] || 0) + 1; });
    const commentsMap = {};
    commentsRes.rows.forEach(c => { commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1; });
    const userLikedSet = new Set(userLikesRes.rows.map(l => l.post_id));

    const result = postsData.map(p => ({
      ...p,
      profiles:       profilesMap[p.user_id] || null,
      likes_count:    likesMap[p.id] || 0,
      comments_count: commentsMap[p.id] || 0,
      liked_by_user:  userLikedSet.has(p.id),
    }));
    res.json(result);
  } catch (err) {
    console.error('GET /posts:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/posts — create a post (with optional image)
router.post('/', protect, (req, res) => {
  uploadImage.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const { content } = req.body;
    let image_url = null;
    if (req.file) {
      image_url = req.file.path;
    }
    if (!content?.trim() && !image_url) {
      return res.status(400).json({ error: 'Post must have content or an image' });
    }
    try {
      const { rows } = await db.query(
        'INSERT INTO posts (id, user_id, content, image_url) VALUES ($1,$2,$3,$4) RETURNING *',
        [uuidv4(), req.user.id, content?.trim() || '', image_url]
      );
      res.status(201).json(rows[0]);
    } catch (dbErr) {
      console.error(dbErr.message);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// DELETE /api/posts/:id  — author OR site-admin
router.delete('/:id', protect, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT user_id FROM posts WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
    if (rows[0].user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await db.query('DELETE FROM post_likes WHERE post_id=$1', [req.params.id]);
    await db.query('DELETE FROM comments WHERE post_id=$1', [req.params.id]);
    await db.query('DELETE FROM posts WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/posts/:id/like — toggle like
router.post('/:id/like', protect, async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT id FROM post_likes WHERE post_id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (existing.rows.length) {
      await db.query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      res.json({ liked: false });
    } else {
      await db.query(
        'INSERT INTO post_likes (id, post_id, user_id) VALUES ($1,$2,$3)',
        [uuidv4(), req.params.id, req.user.id]
      );
      res.json({ liked: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Comments ───────────────────────────────────────────────────────────────

// GET /api/posts/:id/comments — list comments on a post (oldest first)
router.get('/:id/comments', protect, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.id, c.content, c.created_at, c.user_id,
              p.full_name, p.avatar_url, p.headline
         FROM comments c
         LEFT JOIN profiles p ON p.user_id = c.user_id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/posts/:id/comments — add a comment, return the comment with profile
router.post('/:id/comments', protect, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });
  try {
    const newId = uuidv4();
    await db.query(
      'INSERT INTO comments (id, post_id, user_id, content) VALUES ($1,$2,$3,$4)',
      [newId, req.params.id, req.user.id, content.trim()]
    );
    const { rows } = await db.query(
      `SELECT c.id, c.content, c.created_at, c.user_id,
              p.full_name, p.avatar_url, p.headline
         FROM comments c
         LEFT JOIN profiles p ON p.user_id = c.user_id
        WHERE c.id = $1`,
      [newId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/posts/:postId/comments/:commentId — author of comment OR site-admin
router.delete('/:postId/comments/:commentId', protect, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT user_id FROM comments WHERE id = $1', [req.params.commentId]);
    if (!rows[0]) return res.status(404).json({ error: 'Comment not found' });
    if (rows[0].user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await db.query('DELETE FROM comments WHERE id = $1', [req.params.commentId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;

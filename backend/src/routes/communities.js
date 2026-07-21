// backend/src/routes/communities.js
//
// Includes the WhatsApp-Communities-style posts feed plus role management.
// Site-admins / super-admins (req.user.is_admin === true) can:
//   - delete any community
//   - delete any community post or comment
// They do NOT auto-join communities or auto-promote themselves to community
// admin; they just bypass the ownership check on destructive actions.

const express = require('express');
const router = express.Router();
const { randomUUID: uuidv4 } = require('crypto');

const pool = require('../db');
const auth = require('../middleware/auth');

const VALID_ROLES = new Set(['admin', 'moderator', 'member']);

// ─── helpers ────────────────────────────────────────────────────────────────
async function getMembership(communityId, userId) {
  const r = await pool.query(
    `SELECT role, can_chat FROM community_members
      WHERE community_id = $1 AND user_id = $2`,
    [communityId, userId]
  );
  return r.rows[0] || null;
}
function isStaff(role) { return role === 'admin' || role === 'moderator'; }

const { uploadImage } = require('../config/cloudinary');

// ─── Communities CRUD + membership ──────────────────────────────────────────

router.post('/', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const result = await pool.query(
      `INSERT INTO communities (name, description, created_by, chat_enabled)
       VALUES ($1, $2, $3, true) RETURNING *`,
      [name.trim(), description || null, req.user.id]
    );
    await pool.query(
      `INSERT INTO community_members (community_id, user_id, role, can_chat)
       VALUES ($1, $2, 'admin', true)`,
      [result.rows[0].id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count,
        EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $1) as is_member,
        (SELECT role FROM community_members WHERE community_id = c.id AND user_id = $1) as my_role,
        p.full_name as creator_name
       FROM communities c
       LEFT JOIN profiles p ON p.user_id = c.created_by
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const community = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count,
        EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $1) as is_member,
        (SELECT role FROM community_members WHERE community_id = c.id AND user_id = $1) as my_role
       FROM communities c WHERE c.id = $2`,
      [req.user.id, req.params.id]
    );
    if (!community.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(community.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/join', auth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO community_members (community_id, user_id, role, can_chat)
       VALUES ($1, $2, 'member', true) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Joined' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/leave', auth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2 AND role != 'admin'`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Left' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/toggle-chat', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    const allowed = (me && me.role === 'admin') || req.user.is_admin;
    if (!allowed) return res.status(403).json({ error: 'Only admin can toggle chat' });
    const result = await pool.query(
      `UPDATE communities SET chat_enabled = NOT chat_enabled WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/members/:userId/toggle-chat', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    const allowed = (me && isStaff(me.role)) || req.user.is_admin;
    if (!allowed) return res.status(403).json({ error: 'Only admin/moderator can manage member chat' });
    const target = await getMembership(req.params.id, req.params.userId);
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'admin') return res.status(400).json({ error: 'Cannot toggle admin chat' });
    const result = await pool.query(
      `UPDATE community_members SET can_chat = NOT can_chat
        WHERE community_id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.params.userId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/members/:userId/role', auth, async (req, res) => {
  const { role } = req.body;
  if (!VALID_ROLES.has(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const me = await getMembership(req.params.id, req.user.id);
    const allowed = (me && me.role === 'admin') || req.user.is_admin;
    if (!allowed) return res.status(403).json({ error: 'Only admin can change roles' });

    if (req.user.id === req.params.userId && role !== 'admin') {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS c FROM community_members
          WHERE community_id = $1 AND role = 'admin'`,
        [req.params.id]
      );
      if (r.rows[0].c <= 1) {
        return res.status(400).json({ error: 'Cannot demote yourself — you are the only admin' });
      }
    }

    const target = await getMembership(req.params.id, req.params.userId);
    if (!target) return res.status(404).json({ error: 'Member not found' });

    const { rows } = await pool.query(
      `UPDATE community_members SET role = $1
        WHERE community_id = $2 AND user_id = $3 RETURNING *`,
      [role, req.params.id, req.params.userId]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    const allowed = (me && me.role === 'admin') || req.user.is_admin;
    if (!allowed) return res.status(403).json({ error: 'Only admin can remove members' });
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Use the Leave action instead' });
    const { rowCount } = await pool.query(
      `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2 AND role <> 'admin'`,
      [req.params.id, req.params.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Member not found or is admin' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    const allowed = (me && me.role === 'admin') || req.user.is_admin;
    if (!allowed) return res.status(403).json({ error: 'Only admin can delete' });
    await pool.query(`DELETE FROM communities WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/members', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cm.*, cm.can_chat, p.full_name, p.avatar_url, p.headline
       FROM community_members cm
       LEFT JOIN profiles p ON p.user_id = cm.user_id
       WHERE cm.community_id = $1
       ORDER BY (cm.role = 'admin') DESC, (cm.role = 'moderator') DESC, cm.joined_at`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Chat messages ──────────────────────────────────────────────────────────
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    if (!me && !req.user.is_admin) return res.status(403).json({ error: 'Join first' });

    const community = await pool.query(`SELECT chat_enabled FROM communities WHERE id = $1`, [req.params.id]);
    if (me && me.role !== 'admin' && !community.rows[0]?.chat_enabled && !me.can_chat && !req.user.is_admin) {
      return res.status(403).json({ error: 'Chat is disabled for you' });
    }
    const result = await pool.query(
      `SELECT m.*, p.full_name, p.avatar_url
         FROM community_messages m
         LEFT JOIN profiles p ON p.user_id = m.sender_id
        WHERE m.community_id = $1
        ORDER BY m.created_at ASC
        LIMIT 100`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/messages', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    if (!me) return res.status(403).json({ error: 'Join first' });
    const community = await pool.query(`SELECT chat_enabled FROM communities WHERE id = $1`, [req.params.id]);
    if (me.role !== 'admin') {
      if (!community.rows[0]?.chat_enabled && !me.can_chat) {
        return res.status(403).json({ error: 'Chat is disabled for you' });
      }
    }
    if (!req.body.content?.trim()) return res.status(400).json({ error: 'Content required' });
    const result = await pool.query(
      `INSERT INTO community_messages (community_id, sender_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.id, req.body.content.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Community Posts (admin/moderator announcements) ───────────────────────

router.get('/:id/posts', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    if (!me && !req.user.is_admin) return res.status(403).json({ error: 'Join first' });

    const { rows: posts } = await pool.query(
      `SELECT cp.*,
              p.full_name AS author_name, p.avatar_url AS author_avatar,
              cm.role     AS author_role,
              (SELECT COUNT(*)::int FROM community_post_likes WHERE post_id = cp.id) AS likes_count,
              (SELECT COUNT(*)::int FROM community_post_comments WHERE post_id = cp.id) AS comments_count,
              EXISTS(SELECT 1 FROM community_post_likes WHERE post_id = cp.id AND user_id = $2) AS liked_by_user
         FROM community_posts cp
         LEFT JOIN profiles p ON p.user_id = cp.author_id
         LEFT JOIN community_members cm
                ON cm.user_id = cp.author_id AND cm.community_id = cp.community_id
        WHERE cp.community_id = $1
        ORDER BY cp.pinned DESC, cp.created_at DESC
        LIMIT 100`,
      [req.params.id, req.user.id]
    );
    res.json(posts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/posts', auth, (req, res) => {
  uploadImage.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    try {
      const me = await getMembership(req.params.id, req.user.id);
      const allowed = (me && isStaff(me.role)) || req.user.is_admin;
      if (!allowed) return res.status(403).json({ error: 'Only admin/moderator can post announcements' });

      const { title, content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

      let image_url = null;
      if (req.file) {
        image_url = req.file.path;
      }

      const { rows } = await pool.query(
        `INSERT INTO community_posts (id, community_id, author_id, title, content, image_url)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [uuidv4(), req.params.id, req.user.id, title?.trim() || null, content.trim(), image_url]
      );
      res.status(201).json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
});

router.delete('/:id/posts/:postId', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    const { rows } = await pool.query(
      'SELECT author_id FROM community_posts WHERE id = $1 AND community_id = $2',
      [req.params.postId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });

    const isAuthor       = rows[0].author_id === req.user.id;
    const isCommunityAdm = me && me.role === 'admin';
    if (!isAuthor && !isCommunityAdm && !req.user.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM community_posts WHERE id = $1', [req.params.postId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/posts/:postId/pin', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    const allowed = (me && me.role === 'admin') || req.user.is_admin;
    if (!allowed) return res.status(403).json({ error: 'Only admin can pin' });
    const { rows } = await pool.query(
      `UPDATE community_posts SET pinned = NOT pinned
        WHERE id = $1 AND community_id = $2 RETURNING pinned`,
      [req.params.postId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/posts/:postId/like', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    if (!me && !req.user.is_admin) return res.status(403).json({ error: 'Join first' });
    const existing = await pool.query(
      'SELECT id FROM community_post_likes WHERE post_id = $1 AND user_id = $2',
      [req.params.postId, req.user.id]
    );
    if (existing.rows.length) {
      await pool.query(
        'DELETE FROM community_post_likes WHERE post_id = $1 AND user_id = $2',
        [req.params.postId, req.user.id]
      );
      return res.json({ liked: false });
    }
    await pool.query(
      `INSERT INTO community_post_likes (id, post_id, user_id)
       VALUES ($1, $2, $3)`,
      [uuidv4(), req.params.postId, req.user.id]
    );
    res.json({ liked: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/posts/:postId/comments', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    if (!me && !req.user.is_admin) return res.status(403).json({ error: 'Join first' });
    const { rows } = await pool.query(
      `SELECT c.id, c.content, c.created_at, c.user_id,
              p.full_name, p.avatar_url
         FROM community_post_comments c
         LEFT JOIN profiles p ON p.user_id = c.user_id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC`,
      [req.params.postId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/posts/:postId/comments', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    if (!me && !req.user.is_admin) return res.status(403).json({ error: 'Join first' });
    if (!req.body.content?.trim()) return res.status(400).json({ error: 'Content required' });

    const newId = uuidv4();
    await pool.query(
      `INSERT INTO community_post_comments (id, post_id, user_id, content)
       VALUES ($1, $2, $3, $4)`,
      [newId, req.params.postId, req.user.id, req.body.content.trim()]
    );
    const { rows } = await pool.query(
      `SELECT c.id, c.content, c.created_at, c.user_id,
              p.full_name, p.avatar_url
         FROM community_post_comments c
         LEFT JOIN profiles p ON p.user_id = c.user_id
        WHERE c.id = $1`,
      [newId]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/posts/:postId/comments/:cid', auth, async (req, res) => {
  try {
    const me = await getMembership(req.params.id, req.user.id);
    const { rows } = await pool.query(
      'SELECT user_id FROM community_post_comments WHERE id = $1', [req.params.cid]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Comment not found' });

    const isAuthor       = rows[0].user_id === req.user.id;
    const isCommunityAdm = me && me.role === 'admin';
    if (!isAuthor && !isCommunityAdm && !req.user.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM community_post_comments WHERE id = $1', [req.params.cid]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

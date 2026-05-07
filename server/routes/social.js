import express from 'express';
import { createId, nowIso } from '../lib/jsonStore.js';
import { jsonError, parseLimit, parseOffset, requireObjectBody } from '../lib/http.js';
import { db } from '../lib/postgres.js';
import { requireAuth, optionalAuth } from '../lib/userAuth.js';

function pickString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function createSocialRouter() {
  const router = express.Router();

  // GET /posts - List all posts
  router.get('/posts', optionalAuth, async (req, res) => {
    const limit = parseLimit(req.query.limit, 20, 100);
    const offset = parseOffset(req.query.offset, 0);
    const currentUserId = req.user ? req.user.id : null;

    try {
      const result = await db.query(
        `SELECT p.*, 
          u.username as author_name,
          u.avatar_url as author_avatar,
          (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = $3) > 0 as is_liked,
          (SELECT json_agg(c.*) FROM (
             SELECT c.id, c.content, c.user_id, c.created_at, u2.username as author_name 
             FROM comments c 
             LEFT JOIN users u2 ON c.user_id = u2.id
             WHERE c.post_id = p.id 
             ORDER BY c.created_at DESC LIMIT 3
           ) c) as latest_comments,
          (SELECT json_agg(m.*) FROM (
             SELECT id, url, mime_type, type FROM media WHERE id IN (SELECT jsonb_array_elements_text(p.media_ids))
           ) m) as media_items
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         WHERE p.is_approved = TRUE
         ORDER BY p.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset, currentUserId]
      );

      const totalResult = await db.query('SELECT COUNT(*) FROM posts WHERE is_approved = TRUE');
      const total = parseInt(totalResult.rows[0].count, 10);

      res.json({ ok: true, items: result.rows, total, limit, offset });
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // POST /posts - Create a new post
  router.post('/posts', requireAuth, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');

    const content = pickString(req.body.content);
    const userId = req.user.id;
    const mediaIds = Array.isArray(req.body.mediaIds) ? req.body.mediaIds : [];

    if (!content && mediaIds.length === 0) return jsonError(res, 400, 'Content or media is required');

    const id = createId('post');
    const now = nowIso();

    try {
      await db.query(
        `INSERT INTO posts (id, user_id, content, media_ids, likes_count, comments_count, is_approved, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 0, 0, TRUE, $5, $5) RETURNING *`,
        [id, userId, content, JSON.stringify(mediaIds), now]
      );

      res.status(201).json({ ok: true, item: { id, userId, content, mediaIds, likesCount: 0, commentsCount: 0, createdAt: now } });
    } catch (err) {
      console.error('Failed to create post:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // POST /posts/:id/like - Like a post
  router.post('/posts/:id/like', requireAuth, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;

    try {
      // Check if already liked
      const existing = await db.query('SELECT 1 FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      if (existing.rowCount > 0) {
        // Unlike if already liked
        await db.query('BEGIN');
        await db.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
        await db.query('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [postId]);
        await db.query('COMMIT');
        
        const updatedPost = await db.query('SELECT likes_count FROM posts WHERE id = $1', [postId]);
        return res.json({ ok: true, liked: false, likesCount: updatedPost.rows[0].likes_count });
      }

      await db.query('BEGIN');
      await db.query('INSERT INTO likes (id, post_id, user_id) VALUES ($1, $2, $3)', [createId('like'), postId, userId]);
      await db.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1', [postId]);
      await db.query('COMMIT');

      const updatedPost = await db.query('SELECT likes_count FROM posts WHERE id = $1', [postId]);
      res.json({ ok: true, liked: true, likesCount: updatedPost.rows[0].likes_count });
    } catch (err) {
      await db.query('ROLLBACK');
      console.error('Failed to like post:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // GET /posts/:id/comments - Get comments for a post
  router.get('/posts/:id/comments', async (req, res) => {
    const postId = req.params.id;
    try {
      const result = await db.query(
        `SELECT c.*, u.username as author_name, u.avatar_url as author_avatar
         FROM comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.post_id = $1 
         ORDER BY c.created_at ASC`, 
        [postId]
      );
      res.json({ ok: true, items: result.rows });
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // POST /posts/:id/comments - Add a comment
  router.post('/posts/:id/comments', requireAuth, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');

    const content = pickString(req.body.content);
    const userId = req.user.id;
    const postId = req.params.id;

    if (!content) return jsonError(res, 400, 'Content is required');

    const id = createId('cmt');

    try {
      await db.query('BEGIN');
      await db.query('INSERT INTO comments (id, post_id, user_id, content) VALUES ($1, $2, $3, $4)', [id, postId, userId, content]);
      await db.query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1', [postId]);
      await db.query('COMMIT');

      res.status(201).json({ ok: true, item: { id, postId, userId, content, createdAt: new Date().toISOString() } });
    } catch (err) {
      await db.query('ROLLBACK');
      console.error('Failed to create comment:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  return router;
}

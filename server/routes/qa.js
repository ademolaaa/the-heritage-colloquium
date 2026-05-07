import express from 'express';
import { db } from '../lib/postgres.js';
import { createId, nowIso } from '../lib/jsonStore.js';
import { jsonError, parseLimit, parseOffset, requireObjectBody } from '../lib/http.js';
import { optionalAuth, requireAuth } from '../lib/userAuth.js';

function pickString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function createQARouter() {
  const router = express.Router();

  // GET /questions - List public questions
  router.get('/questions', async (req, res) => {
    const limit = parseLimit(req.query.limit, 20, 100);
    const offset = parseOffset(req.query.offset, 0);
    const q = pickString(req.query.q);
    
    try {
      let query = `
        SELECT q.*, 
          (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answers_count
        FROM questions q
        WHERE q.is_public = TRUE
      `;
      const params = [];

      if (q) {
        query += ` AND (q.content ILIKE $${params.length + 1} OR q.user_name ILIKE $${params.length + 1})`;
        params.push(`%${q}%`);
      }

      query += ` ORDER BY q.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await db.query(query, params);
      const totalResult = await db.query('SELECT COUNT(*) FROM questions WHERE is_public = TRUE');
      
      res.json({ ok: true, items: result.rows, total: parseInt(totalResult.rows[0].count, 10), limit, offset });
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // POST /questions - Ask a question (auth optional — anonymous allowed)
  router.post('/questions', optionalAuth, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    
    const content = pickString(req.body.content);
    const category = pickString(req.body.category) || 'General';
    
    if (!content) return jsonError(res, 400, 'Content is required');
    
    // Accept name/email from body for anonymous users
    const userName = req.user?.username || pickString(req.body.name) || 'Anonymous';
    const userEmail = req.user?.email || pickString(req.body.email) || null;
    
    const id = createId('qst');
    const now = nowIso();
    
    try {
      await db.query(
        `INSERT INTO questions (id, user_name, user_email, content, category, is_public, created_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6) RETURNING *`,
        [id, userName, userEmail, content, category, now]
      );
      
      res.status(201).json({ ok: true, item: { id, content, category, createdAt: now } });
    } catch (err) {
      console.error('Failed to create question:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // GET /questions/:id/answers
  router.get('/questions/:id/answers', async (req, res) => {
    const questionId = req.params.id;
    try {
      const result = await db.query(
        'SELECT * FROM answers WHERE question_id = $1 ORDER BY created_at ASC',
        [questionId]
      );
      res.json({ ok: true, items: result.rows });
    } catch (err) {
      console.error('Failed to fetch answers:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // POST /questions/:id/answers - Answer a question
  router.post('/questions/:id/answers', requireAuth, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    
    const content = pickString(req.body.content);
    const questionId = req.params.id;
    
    if (!content) return jsonError(res, 400, 'Content is required');
    
    const id = createId('ans');
    const now = nowIso();
    
    try {
      // Verify question exists
      const qCheck = await db.query('SELECT 1 FROM questions WHERE id = $1', [questionId]);
      if (qCheck.rowCount === 0) return jsonError(res, 404, 'Question not found');

      await db.query(
        `INSERT INTO answers (id, question_id, responder_name, content, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, questionId, req.user.username || 'User', content, now]
      );
      
      await db.query('UPDATE questions SET is_answered = TRUE WHERE id = $1', [questionId]);
      
      res.status(201).json({ ok: true, item: { id, questionId, content, createdAt: now } });
    } catch (err) {
      console.error('Failed to create answer:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // POST /questions/:id/admin-answer - Answer a question as Ahiajoku Team (admin passcode required)
  router.post('/questions/:id/admin-answer', async (req, res) => {
    const passcode = String(req.header('x-admin-passcode') || '');
    if (!passcode || passcode !== process.env.ADMIN_PASSCODE) return jsonError(res, 401, 'Unauthorized');

    const content = pickString(req.body.content);
    if (!content) return jsonError(res, 400, 'Content is required');

    try {
      const qCheck = await db.query('SELECT 1 FROM questions WHERE id = $1', [req.params.id]);
      if (qCheck.rowCount === 0) return jsonError(res, 404, 'Question not found');

      const id = createId('ans');
      const now = nowIso();

      await db.query(
        'INSERT INTO answers (id, question_id, responder_name, content, created_at) VALUES ($1,$2,$3,$4,$5)',
        [id, req.params.id, 'Ahiajoku Team', content, now]
      );
      await db.query('UPDATE questions SET is_answered = TRUE, is_public = TRUE WHERE id = $1', [req.params.id]);

      res.status(201).json({ ok: true, item: { id, questionId: req.params.id, content, responderName: 'Ahiajoku Team', createdAt: now } });
    } catch (err) {
      console.error('Failed to create admin answer:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  return router;
}

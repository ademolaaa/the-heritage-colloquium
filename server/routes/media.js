import express from 'express';
import multer from 'multer';
import path from 'path';
import { createId, nowIso } from '../lib/jsonStore.js';
import { jsonError } from '../lib/http.js';
import { db } from '../lib/postgres.js';
import { requireAuth } from '../lib/userAuth.js';
import { uploadToStorage, deleteFromStorage } from '../lib/supabaseStorage.js';

export function createMediaRouter() {
  const router = express.Router();

  // Memory storage — no disk writes (Vercel/serverless compatible)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  });

  // POST /media/upload — Upload file to Supabase Storage
  router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) return jsonError(res, 400, 'No file uploaded');

    const { buffer, mimetype, originalname, size } = req.file;
    const category = req.body.category || null;
    const title = req.body.title || originalname;

    let type = 'file';
    if (mimetype.startsWith('image/')) type = 'image';
    else if (mimetype.startsWith('video/')) type = 'video';
    else if (mimetype.startsWith('audio/')) type = 'audio';
    else if (mimetype === 'application/pdf') type = 'pdf';

    const id = createId('med');
    const ext = path.extname(originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const storagePath = `${type}s/${id}${ext}`;
    const now = nowIso();

    try {
      const { publicUrl, bucket } = await uploadToStorage(buffer, storagePath, mimetype);

      await db.query(
        `INSERT INTO media
           (id, type, title, url, mime_type, size_bytes, category, storage_bucket, storage_path, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
        [id, type, title, publicUrl, mimetype, size, category, bucket, storagePath, now]
      );

      res.status(201).json({
        ok: true,
        item: { id, type, url: publicUrl, mimeType: mimetype, title, category },
      });
    } catch (err) {
      console.error('Upload failed:', err);
      jsonError(res, 500, err.message || 'Upload failed');
    }
  });

  // DELETE /media/:id — Remove record + storage file
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const r = await db.query('SELECT storage_path FROM media WHERE id=$1', [req.params.id]);
      if (r.rowCount === 0) return jsonError(res, 404, 'Not found');
      if (r.rows[0].storage_path) await deleteFromStorage(r.rows[0].storage_path);
      await db.query('DELETE FROM media WHERE id=$1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete failed:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // GET /media — List media, optionally filtered by type
  router.get('/', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const type = req.query.type;
    const category = req.query.category;

    try {
      const conditions = [];
      const params = [];

      if (type) { params.push(type); conditions.push(`type = $${params.length}`); }
      if (category) { params.push(category); conditions.push(`category = $${params.length}`); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit, offset);

      const result = await db.query(
        `SELECT * FROM media ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const totalResult = await db.query(
        `SELECT COUNT(*) FROM media ${where}`,
        params.slice(0, params.length - 2)
      );

      res.json({ ok: true, items: result.rows, total: parseInt(totalResult.rows[0].count) });
    } catch (err) {
      console.error('List media failed:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // GET /media/:id
  router.get('/:id', async (req, res) => {
    try {
      const r = await db.query('SELECT * FROM media WHERE id=$1', [req.params.id]);
      if (r.rowCount === 0) return jsonError(res, 404, 'Not found');
      res.json({ ok: true, item: r.rows[0] });
    } catch (err) {
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  return router;
}

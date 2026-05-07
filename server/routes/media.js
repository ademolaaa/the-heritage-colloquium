import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { createId, nowIso } from '../lib/jsonStore.js';
import { jsonError, requireObjectBody } from '../lib/http.js';
import { db } from '../lib/postgres.js';
import { requireAuth } from '../lib/userAuth.js';
import { generatePresignedUrl, getPublicUrl } from '../lib/s3.js';

export function createMediaRouter({ uploadsDir }) {
  const router = express.Router();
  
  const upload = multer({
    storage: multer.diskStorage({
      destination: async (_req, _file, cb) => {
        try {
          await fs.mkdir(uploadsDir, { recursive: true });
          cb(null, uploadsDir);
        } catch (e) {
          cb(e, uploadsDir);
        }
      },
      filename: (_req, file, cb) => {
        const rawExt = path.extname(String(file.originalname || '')).slice(0, 12);
        const ext = /^[a-z0-9.]+$/i.test(rawExt) ? rawExt : '';
        cb(null, `${createId('upload')}${ext}`);
      },
    }),
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB limit for video
    },
  });

  // POST /media/upload - Upload file (Local or S3)
  router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) return jsonError(res, 400, 'No file uploaded');

    const file = req.file;
    const mimeType = file.mimetype;
    const originalName = file.originalname;
    const sizeBytes = file.size;
    const category = req.body.category || null; // Capture category from body
    
    const id = createId('med');
    const now = nowIso();
    
    // Determine type
    let type = 'file';
    if (mimeType.startsWith('image/')) type = 'image';
    else if (mimeType.startsWith('video/')) type = 'video';
    else if (mimeType.startsWith('audio/')) type = 'audio';
    
    const url = `/uploads/${file.filename}`;
    
    try {
      await db.query(
        `INSERT INTO media (id, file_name, original_name, mime_type, size_bytes, url, status, category, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'uploaded', $7, $8, $8)`,
        [id, file.filename, originalName, mimeType, sizeBytes, url, category, now]
      );
      
      res.status(201).json({ ok: true, item: { id, url, type, mimeType, originalName, category } });
    } catch (err) {
      console.error('Media upload failed:', err);
      // Try to delete file if DB insert fails
      try { await fs.unlink(file.path); } catch (e) {}
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // GET /media - List media
  router.get('/', async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const ids = req.query.ids ? req.query.ids.split(',') : null;
    const category = req.query.category;

    try {
      let result;
      if (ids) {
        result = await db.query('SELECT * FROM media WHERE id = ANY($1) ORDER BY created_at DESC', [ids]);
      } else if (category) {
        result = await db.query('SELECT * FROM media WHERE category = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [category, limit, offset]);
      } else {
        result = await db.query('SELECT * FROM media ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
      }
      
      res.json({ ok: true, items: result.rows });
    } catch (err) {
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // GET /media/:id - Get media details
  router.get('/:id', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM media WHERE id = $1', [req.params.id]);
      if (result.rowCount === 0) return jsonError(res, 404, 'Not found');
      res.json({ ok: true, item: result.rows[0] });
    } catch (err) {
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // PATCH /media/:id - Update media metadata
  router.patch('/:id', requireAuth, async (req, res) => {
    const { title, category } = req.body;
    try {
      const result = await db.query(
        `UPDATE media SET 
           title = COALESCE($2, title),
           category = COALESCE($3, category),
           updated_at = $4
         WHERE id = $1
         RETURNING *`,
        [req.params.id, title, category, nowIso()]
      );
      
      if (result.rowCount === 0) return jsonError(res, 404, 'Not found');
      res.json({ ok: true, item: result.rows[0] });
    } catch (err) {
      console.error(err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  return router;
}

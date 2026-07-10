import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createId, nowIso } from '../lib/jsonStore.js';
import { jsonError, parseLimit, parseOffset, requireObjectBody } from '../lib/http.js';
import { matchesQuery, scoreMatch } from '../lib/search.js';
import { generatePresignedUrl, getPublicUrl } from '../lib/s3.js';
import { db as pgDb } from '../lib/postgres.js';
import AdmZip from 'adm-zip';
import { uploadToStorage } from '../lib/supabaseStorage.js';
import { requireAuth, authenticateToken } from '../lib/userAuth.js';
import { logAudit } from '../lib/audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function pickString(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return v;
}

function pickOptionalString(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return v || null;
}

function pickNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) && value.includes('T');
}

function getFolderCategory(filePath) {
  const parts = filePath.split('/').filter(p => p.trim() !== '');
  if (parts.length <= 1) return 'General Gallery';

  // The immediate parent folder
  let parentIndex = parts.length - 2;
  let folderName = parts[parentIndex];

  // If the parent folder is a generic term (like 'gallery', 'photos', 'images', 'speakers', 'lectures')
  // and there is a grandparent folder, use the grandparent instead
  const genericFolders = ['gallery', 'photos', 'images', 'speakers', 'lectures', 'uploads', 'media', 'general'];
  if (genericFolders.includes(folderName.toLowerCase()) && parentIndex > 0) {
    folderName = parts[parentIndex - 1];
  }

  // Also clean up any common zip/mac export suffixes or wrappers
  // e.g. "AHIAJOKU ARTS & CRAFTS-20260710T125851Z-2-001" -> "AHIAJOKU ARTS & CRAFTS"
  folderName = folderName
    .replace(/-\d{8}T\d{6}Z.*$/, '') // Remove Google Drive style archive export suffix
    .replace(/\.zip$/i, '')          // Remove any .zip suffix
    .trim();

  return folderName || 'General Gallery';
}

function requireAdmin(verifyAdminPasscode) {
  return async (req, res, next) => {
    const passcode = String(req.header('x-admin-passcode') || '');
    if (verifyAdminPasscode && passcode) {
      if (await verifyAdminPasscode(passcode)) {
        req.isAdmin = true;
        return next();
      }
    }
    
    // Fallback to JWT/Supabase Auth (role MUST be admin)
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const user = await authenticateToken(token);
        if (user && user.role === 'admin') {
          req.user = user;
          return next();
        }
      }
    } catch (err) {
      console.error('requireAdmin jwt error:', err);
    }
    
    jsonError(res, 401, 'Unauthorized');
  };
}

function listResponse(items, { total, limit, offset }) {
  return { ok: true, total, limit, offset, items };
}

function normalizeTableName(value) {
  const v = String(value || '').trim();
  const map = {
    lectures: 'lectures',
    events: 'events',
    media: 'media',
    publications: 'publications',
    pressReleases: 'pressReleases',
    pressreleases: 'pressReleases',
    'press-releases': 'pressReleases',
    socialLinks: 'socialLinks',
    sociallinks: 'socialLinks',
    'social-links': 'socialLinks',
    gallery: 'gallery',
    contributors: 'contributors',
    navigationMenu: 'navigationMenu',
    navigationmenu: 'navigationMenu',
    'navigation-menu': 'navigationMenu',
    siteSettings: 'siteSettings',
    sitesettings: 'siteSettings',
    'site-settings': 'siteSettings',
  };
  return map[v] || null;
}

function findById(items, id) {
  const idx = items.findIndex((x) => x && typeof x === 'object' && x.id === id);
  if (idx < 0) return { idx: -1, item: null };
  return { idx, item: items[idx] };
}

function getTextIndex(doc) {
  if (!doc || typeof doc !== 'object') return '';
  return Object.values(doc)
    .flatMap((v) => {
      if (v === null || v === undefined) return [];
      if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
      if (typeof v === 'string') return [v];
      return [];
    })
    .join(' ');
}

function sortByUpdatedAtDesc(a, b) {
  const aa = typeof a?.updatedAt === 'string' ? a.updatedAt : '';
  const bb = typeof b?.updatedAt === 'string' ? b.updatedAt : '';
  return bb.localeCompare(aa);
}

export function createV1Router({ verifyAdminPasscode, uploadsDir }) {
  const db = pgDb;
  const router = express.Router();
  const adminOnly = requireAdmin(verifyAdminPasscode);
  const upload =
    uploadsDir &&
    multer({
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
        fileSize: Number(process.env.MAX_UPLOAD_BYTES || 250 * 1024 * 1024),
      },
    });

  router.get('/health', (_req, res) => {
    res.json({ ok: true, v: 1 });
  });

  router.get('/lectures', async (req, res) => {
    const q = pickString(req.query.q);
    const year = pickNumber(req.query.year);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);
    
    try {
      let query = 'SELECT * FROM lectures';
      const params = [];
      const conditions = [];

      if (Number.isFinite(year)) {
        params.push(year);
        conditions.push(`year = $${params.length}`);
      }

      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(title ILIKE $${params.length} OR speaker ILIKE $${params.length} OR theme ILIKE $${params.length})`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY year DESC';
      
      const totalResult = await db.query(`SELECT COUNT(*) FROM (${query}) AS t`, params);
      const total = parseInt(totalResult.rows[0].count);

      params.push(limit, offset);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
      
      const result = await db.query(query, params);
      res.json(listResponse(result.rows, { total, limit, offset }));
    } catch (err) {
      console.error('Failed to fetch lectures:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.post('/lectures', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const year = pickNumber(req.body.year);
    const title = pickString(req.body.title);
    if (!Number.isFinite(year) || !title) return jsonError(res, 400, 'Missing required fields');

    try {
      const id = createId('lec');
      const now = nowIso();
      const record = {
        id,
        year,
        theme: pickOptionalString(req.body.theme),
        speaker: pickOptionalString(req.body.speaker),
        title,
        description: pickOptionalString(req.body.description),
        image: pickOptionalString(req.body.image),
        role: pickOptionalString(req.body.role),
        createdAt: now,
        updatedAt: now,
      };

      await db.query(
        `INSERT INTO lectures (id, year, theme, speaker, title, description, image, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, year, record.theme, record.speaker, title, record.description, record.image, record.role, now, now]
      );

      res.status(201).json({ ok: true, item: record });
    } catch (err) {
      console.error('Failed to create lecture:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/lectures/:id', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM lectures WHERE id = $1', [req.params.id]);
      if (result.rowCount === 0) return jsonError(res, 404, 'Not found');
      res.json({ ok: true, item: result.rows[0] });
    } catch (err) {
      console.error('Failed to fetch lecture:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.put('/lectures/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    try {
      const existing = await db.query('SELECT * FROM lectures WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) return jsonError(res, 404, 'Not found');
      
      const item = existing.rows[0];
      const now = nowIso();
      const next = {
        year: pickNumber(req.body.year) ?? item.year,
        theme: pickOptionalString(req.body.theme) ?? item.theme,
        speaker: pickOptionalString(req.body.speaker) ?? item.speaker,
        title: pickString(req.body.title) || item.title,
        description: pickOptionalString(req.body.description) ?? item.description,
        image: pickOptionalString(req.body.image) ?? item.image,
        role: pickOptionalString(req.body.role) ?? item.role,
        updated_at: now,
      };

      await db.query(
        `UPDATE lectures SET year = $1, theme = $2, speaker = $3, title = $4, description = $5, image = $6, role = $7, updated_at = $8
         WHERE id = $9`,
        [next.year, next.theme, next.speaker, next.title, next.description, next.image, next.role, now, req.params.id]
      );

      res.json({ ok: true, item: { ...item, ...next } });
    } catch (err) {
      console.error('Failed to update lecture:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.delete('/lectures/:id', adminOnly, async (req, res) => {
    try {
      const result = await db.query('DELETE FROM lectures WHERE id = $1', [req.params.id]);
      if (result.rowCount === 0) return jsonError(res, 404, 'Not found');
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete lecture:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/events', async (req, res) => {
    const q = pickString(req.query.q);
    const status = pickOptionalString(req.query.status);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);

    try {
      let query = 'SELECT * FROM events';
      const params = [];
      const conditions = [];

      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }

      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length} OR location ILIKE $${params.length})`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY start_at DESC NULLS LAST, created_at DESC';
      
      const totalResult = await db.query(`SELECT COUNT(*) FROM (${query}) AS t`, params);
      const total = parseInt(totalResult.rows[0].count);

      params.push(limit, offset);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
      
      const result = await db.query(query, params);
      res.json(listResponse(result.rows, { total, limit, offset }));
    } catch (err) {
      console.error('Failed to fetch events:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.post('/events', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const title = pickString(req.body.title);
    const startAt = pickOptionalString(req.body.startAt);
    const status = pickString(req.body.status) || 'scheduled';
    if (!title) return jsonError(res, 400, 'Missing required fields');
    if (startAt && !isIsoDate(startAt)) return jsonError(res, 400, 'startAt must be ISO datetime');

    try {
      const id = createId('evt');
      const now = nowIso();
      const statusHistory = [{ at: now, status, note: pickOptionalString(req.body.statusNote) }];
      
      const record = {
        id,
        title,
        description: pickOptionalString(req.body.description),
        location: pickOptionalString(req.body.location),
        startAt,
        endAt: pickOptionalString(req.body.endAt),
        status,
        statusHistory,
        createdAt: now,
        updatedAt: now,
      };

      await db.query(
        `INSERT INTO events (id, title, description, location, start_at, end_at, status, status_history, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, title, record.description, record.location, startAt, record.endAt, status, JSON.stringify(statusHistory), now, now]
      );

      res.status(201).json({ ok: true, item: record });
    } catch (err) {
      console.error('Failed to create event:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/events/:id', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
      if (result.rowCount === 0) return jsonError(res, 404, 'Not found');
      res.json({ ok: true, item: result.rows[0] });
    } catch (err) {
      console.error('Failed to fetch event:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.put('/events/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    try {
      const existing = await db.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) return jsonError(res, 404, 'Not found');
      
      const item = existing.rows[0];
      const nextStatus = pickString(req.body.status) || item.status;
      const now = nowIso();
      
      const next = {
        title: pickString(req.body.title) || item.title,
        description: pickOptionalString(req.body.description) ?? item.description,
        location: pickOptionalString(req.body.location) ?? item.location,
        start_at: pickOptionalString(req.body.startAt) ?? item.start_at,
        end_at: pickOptionalString(req.body.endAt) ?? item.end_at,
        status: nextStatus,
        updated_at: now,
      };

      if (next.start_at && !isIsoDate(next.start_at)) return jsonError(res, 400, 'startAt must be ISO datetime');
      if (next.end_at && !isIsoDate(next.end_at)) return jsonError(res, 400, 'endAt must be ISO datetime');

      let statusHistory = Array.isArray(item.status_history) ? item.status_history : [];
      if (nextStatus !== item.status) {
        statusHistory.push({ at: now, status: nextStatus, note: pickOptionalString(req.body.statusNote) });
      }

      await db.query(
        `UPDATE events SET title = $1, description = $2, location = $3, start_at = $4, end_at = $5, status = $6, status_history = $7, updated_at = $8
         WHERE id = $9`,
        [next.title, next.description, next.location, next.start_at, next.end_at, next.status, JSON.stringify(statusHistory), now, req.params.id]
      );

      res.json({ ok: true, item: { ...item, ...next, status_history: statusHistory } });
    } catch (err) {
      console.error('Failed to update event:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.delete('/events/:id', adminOnly, async (req, res) => {
    try {
      const result = await db.query('DELETE FROM events WHERE id = $1', [req.params.id]);
      if (result.rowCount === 0) return jsonError(res, 404, 'Not found');
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete event:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/media', async (req, res) => {
    const q = pickString(req.query.q);
    const type = pickOptionalString(req.query.type);
    const ids = pickOptionalString(req.query.ids);
    const category = pickOptionalString(req.query.category);
    const wantCategories = pickOptionalString(req.query.categories);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);

    try {
      if (wantCategories === '1') {
        const result = await db.query('SELECT DISTINCT category FROM media WHERE category IS NOT NULL ORDER BY category ASC');
        const cats = result.rows.map(r => r.category);
        const total = cats.length;
        res.json(listResponse(cats.slice(offset, offset + limit), { total, limit, offset }));
        return;
      }

      let query = 'SELECT * FROM media';
      const params = [];
      const conditions = [];

      if (ids) {
        const idList = ids.split(',').map(s => s.trim()).filter(Boolean);
        if (idList.length > 0) {
          params.push(idList);
          conditions.push(`id = ANY($${params.length})`);
        }
      }

      if (category) {
        params.push(category);
        conditions.push(`category = $${params.length}`);
      }

      if (type) {
        params.push(type);
        conditions.push(`type = $${params.length}`);
      }

      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC';
      
      const totalResult = await db.query(`SELECT COUNT(*) FROM (${query}) AS t`, params);
      const total = parseInt(totalResult.rows[0].count);

      params.push(limit, offset);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
      
      const result = await db.query(query, params);
      res.json(listResponse(result.rows, { total, limit, offset }));
    } catch (err) {
      console.error('Failed to fetch media:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.post('/media/presigned', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const fileName = pickString(req.body.fileName);
    const contentType = pickString(req.body.contentType);
    
    if (!fileName || !contentType) return jsonError(res, 400, 'Missing fileName or contentType');
    
    // Create a unique key
    const rawExt = path.extname(fileName).slice(0, 12);
    const ext = /^[a-z0-9.]+$/i.test(rawExt) ? rawExt : '';
    const key = `${createId('upload')}${ext}`;
    
    try {
      const url = await generatePresignedUrl(key, contentType);
      res.json({ ok: true, url, key, publicUrl: getPublicUrl(key) });
    } catch (e) {
      jsonError(res, 500, e instanceof Error ? e.message : 'Failed to generate presigned URL');
    }
  });

  router.post('/media', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const type = pickString(req.body.type);
    const title = pickString(req.body.title);
    const url = pickString(req.body.url);
    const s3Key = pickOptionalString(req.body.s3Key);
    const category = pickOptionalString(req.body.category);
    
    if (!type || !title || !url) return jsonError(res, 400, 'Missing required fields');
    const id = createId('med');
    const now = nowIso();

    try {
      await pgDb.query(
        `INSERT INTO media (id, type, title, url, file_path, storage_bucket, storage_path, category, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        [id, type, title, url, pickOptionalString(req.body.filePath), 'heritage-media', s3Key, category, now]
      );
      res.status(201).json({
        ok: true,
        item: {
          id, type, title, url, category, createdAt: now, updatedAt: now
        }
      });
    } catch (err) {
      console.error('Failed to create media:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.post('/media/upload', adminOnly, async (req, res, next) => {
    if (!upload) return jsonError(res, 501, 'Uploads not configured');
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'files', maxCount: 20 },
      { name: 'files[]', maxCount: 20 },
    ])(req, res, (err) => {
      if (err) {
        jsonError(res, 400, err instanceof Error ? err.message : 'Upload failed');
        return;
      }
      next();
    });
  }, async (req, res) => {
    const fileGroups = req.files && typeof req.files === 'object' ? req.files : null;
    const candidates = [];
    if (fileGroups && Array.isArray(fileGroups.file)) candidates.push(...fileGroups.file);
    if (fileGroups && Array.isArray(fileGroups.files)) candidates.push(...fileGroups.files);
    if (fileGroups && Array.isArray(fileGroups['files[]'])) candidates.push(...fileGroups['files[]']);
    if (req.file) candidates.push(req.file);

    const files = candidates.filter((x) => x && typeof x === 'object' && typeof x.filename === 'string');
    if (files.length === 0) return jsonError(res, 400, 'Missing file');

    const baseType = pickString(req.body?.type);
    const baseTitle = pickString(req.body?.title);
    const description = pickOptionalString(req.body?.description);
    const relatedLectureId = pickOptionalString(req.body?.relatedLectureId);
    const relatedEventId = pickOptionalString(req.body?.relatedEventId);
    const category = pickOptionalString(req.body?.category);

    try {
      const created = [];
      const now = nowIso();
      for (const file of files) {
        const mimeType = String(file.mimetype || '');
        const inferredType =
          mimeType.startsWith('image/')
            ? 'image'
            : mimeType.startsWith('video/')
              ? 'video'
              : mimeType.startsWith('audio/')
                ? 'audio'
                : mimeType === 'application/pdf'
                  ? 'pdf'
                  : 'file';

        const type = baseType || inferredType;
        const title = baseTitle || String(file.originalname || 'Upload');
        const url = `/uploads/${encodeURIComponent(file.filename)}`;
        const id = createId('med');

        await pgDb.query(
          `INSERT INTO media (id, type, title, url, file_path, mime_type, size_bytes, category, related_lecture_id, related_event_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
          [id, type, title, url, file.filename, mimeType || null, Number.isFinite(Number(file.size)) ? Number(file.size) : null, category != null ? category : null, relatedLectureId, relatedEventId, now]
        );

        created.push({
          id, type, title, url, filePath: file.filename, mimeType, sizeBytes: file.size, category, relatedLectureId, relatedEventId, createdAt: now, updatedAt: now
        });
      }
      res.status(201).json({ ok: true, items: created, item: created[0] || null });
    } catch (err) {
      console.error('Local upload db error:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/media/:id', async (req, res) => {
    try {
      const result = await pgDb.query('SELECT * FROM media WHERE id = $1', [req.params.id]);
      if (result.rowCount === 0) return jsonError(res, 404, 'Not found');
      res.json({ ok: true, item: result.rows[0] });
    } catch (err) {
      console.error('Failed to get media:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.put('/media/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    try {
      const existing = await pgDb.query('SELECT * FROM media WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) return jsonError(res, 404, 'Not found');
      
      const item = existing.rows[0];
      const title = pickOptionalString(req.body.title);
      const description = pickOptionalString(req.body.description);
      const category = pickOptionalString(req.body.category);

      const nextTitle = title != null ? title.trim() : item.title;
      if (title != null && !nextTitle) return jsonError(res, 400, 'title is required');

      const nextDescription = description != null ? description : item.description;
      const nextCategory = category != null ? category : item.category;
      const now = nowIso();

      await pgDb.query(
        `UPDATE media SET title = $1, description = $2, category = $3, updated_at = $4 WHERE id = $5`,
        [nextTitle, nextDescription, nextCategory, now, req.params.id]
      );

      res.json({
        ok: true,
        item: {
          ...item,
          title: nextTitle,
          description: nextDescription,
          category: nextCategory,
          updatedAt: now
        }
      });
    } catch (err) {
      console.error('Failed to update media:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.delete('/media/:id', adminOnly, async (req, res) => {
    try {
      const existing = await pgDb.query('SELECT * FROM media WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) return jsonError(res, 404, 'Not found');
      
      const item = existing.rows[0];
      
      if (item.storage_path) {
        await deleteFromStorage(item.storage_path).catch((err) => {
          console.error(`Failed to delete from storage: ${item.storage_path}`, err);
        });
      }

      await pgDb.query('DELETE FROM media WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete media:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/publications', async (req, res) => {
    const q = pickString(req.query.q);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);
    
    try {
      let result;
      let params = [];
      let queryStr = 'SELECT * FROM publications';
      if (q) {
        queryStr += ' WHERE title ILIKE $1 OR abstract ILIKE $1';
        params.push(`%${q}%`);
      }
      queryStr += ' ORDER BY updated_at DESC';
      
      result = await pgDb.query(queryStr, params);
      const items = result.rows.map(r => ({
        id: r.id,
        title: r.title,
        authors: r.authors || [],
        publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
        abstract: r.abstract,
        url: r.url,
        mediaId: r.media_id,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      }));
      const total = items.length;
      res.json(listResponse(items.slice(offset, offset + limit), { total, limit, offset }));
    } catch (err) {
      console.error('Failed to get publications:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.post('/publications', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const title = pickString(req.body.title);
    if (!title) return jsonError(res, 400, 'Missing required fields');

    const id = createId('pub');
    const authors = Array.isArray(req.body.authors) ? req.body.authors.filter((x) => typeof x === 'string') : [];
    const publishedAt = pickOptionalString(req.body.publishedAt);
    const abstract = pickOptionalString(req.body.abstract);
    const url = pickOptionalString(req.body.url);
    const mediaId = pickOptionalString(req.body.mediaId);
    const now = nowIso();

    try {
      await pgDb.query(
        `INSERT INTO publications (id, title, authors, published_at, abstract, url, media_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [id, title, JSON.stringify(authors), publishedAt, abstract, url, mediaId, now]
      );
      res.status(201).json({
        ok: true,
        item: {
          id, title, authors, publishedAt, abstract, url, mediaId, createdAt: now, updatedAt: now
        }
      });
    } catch (err) {
      console.error('Failed to create publication:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.put('/publications/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    
    try {
      const existing = await pgDb.query('SELECT * FROM publications WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) return jsonError(res, 404, 'Not found');
      
      const item = existing.rows[0];
      const title = pickString(req.body.title) || item.title;
      const authors = Array.isArray(req.body.authors) ? req.body.authors.filter((x) => typeof x === 'string') : item.authors ?? [];
      const publishedAt = pickOptionalString(req.body.publishedAt) ?? (item.published_at ? new Date(item.published_at).toISOString() : null);
      const abstract = pickOptionalString(req.body.abstract) ?? item.abstract;
      const url = pickOptionalString(req.body.url) ?? item.url;
      const mediaId = pickOptionalString(req.body.media_id) ?? item.media_id;
      const now = nowIso();

      await pgDb.query(
        `UPDATE publications 
         SET title = $1, authors = $2, published_at = $3, abstract = $4, url = $5, media_id = $6, updated_at = $7 
         WHERE id = $8`,
        [title, JSON.stringify(authors), publishedAt, abstract, url, mediaId, now, req.params.id]
      );

      res.json({
        ok: true,
        item: {
          id: req.params.id,
          title,
          authors,
          publishedAt,
          abstract,
          url,
          mediaId,
          createdAt: item.created_at ? new Date(item.created_at).toISOString() : now,
          updatedAt: now
        }
      });
    } catch (err) {
      console.error('Failed to update publication:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.delete('/publications/:id', adminOnly, async (req, res) => {
    try {
      const result = await pgDb.query('DELETE FROM publications WHERE id = $1', [req.params.id]);
      if (result.rowCount === 0) return jsonError(res, 404, 'Not found');
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete publication:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/press-releases', async (req, res) => {
    const q = pickString(req.query.q);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);

    try {
      let result;
      let params = [];
      let queryStr = 'SELECT * FROM press_releases';
      if (q) {
        queryStr += ' WHERE title ILIKE $1 OR content ILIKE $1';
        params.push(`%${q}%`);
      }
      queryStr += ' ORDER BY updated_at DESC';

      result = await pgDb.query(queryStr, params);
      const items = result.rows.map(r => ({
        id: r.id,
        title: r.title,
        excerpt: r.source,
        body: r.content,
        publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
        mediaId: r.media_id,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      }));
      const total = items.length;
      res.json(listResponse(items.slice(offset, offset + limit), { total, limit, offset }));
    } catch (err) {
      console.error('Failed to get press releases:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.post('/press-releases', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const title = pickString(req.body.title);
    const body = pickString(req.body.body);
    if (!title || !body) return jsonError(res, 400, 'Missing required fields');

    const id = createId('pr');
    const excerpt = pickOptionalString(req.body.excerpt);
    const publishedAt = pickOptionalString(req.body.publishedAt);
    const mediaId = pickOptionalString(req.body.mediaId);
    const now = nowIso();

    try {
      await pgDb.query(
        `INSERT INTO press_releases (id, title, content, source, published_at, media_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [id, title, body, excerpt, publishedAt, mediaId, now]
      );
      res.status(201).json({
        ok: true,
        item: {
          id, title, excerpt, body, publishedAt, mediaId, createdAt: now, updatedAt: now
        }
      });
    } catch (err) {
      console.error('Failed to create press release:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.put('/press-releases/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');

    try {
      const existing = await pgDb.query('SELECT * FROM press_releases WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) return jsonError(res, 404, 'Not found');

      const item = existing.rows[0];
      const title = pickString(req.body.title) || item.title;
      const body = pickString(req.body.body) || item.content;
      const excerpt = pickOptionalString(req.body.excerpt) ?? item.source;
      const publishedAt = pickOptionalString(req.body.publishedAt) ?? (item.published_at ? new Date(item.published_at).toISOString() : null);
      const mediaId = pickOptionalString(req.body.mediaId) ?? item.media_id;
      const now = nowIso();

      await pgDb.query(
        `UPDATE press_releases 
         SET title = $1, content = $2, source = $3, published_at = $4, media_id = $5, updated_at = $6 
         WHERE id = $7`,
        [title, body, excerpt, publishedAt, mediaId, now, req.params.id]
      );

      res.json({
        ok: true,
        item: {
          id: req.params.id,
          title,
          excerpt,
          body,
          publishedAt,
          mediaId,
          createdAt: item.created_at ? new Date(item.created_at).toISOString() : now,
          updatedAt: now
        }
      });
    } catch (err) {
      console.error('Failed to update press release:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.delete('/press-releases/:id', adminOnly, async (req, res) => {
    try {
      const result = await pgDb.query('DELETE FROM press_releases WHERE id = $1', [req.params.id]);
      if (result.rowCount === 0) return jsonError(res, 404, 'Not found');
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete press release:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/social-links', async (_req, res) => {
    try {
      const result = await pgDb.query('SELECT * FROM social_links ORDER BY order_index ASC');
      const items = result.rows.map(r => ({
        id: r.id,
        platform: r.platform,
        url: r.url,
        handle: r.handle,
        order: r.order_index,
        active: r.active,
      }));
      res.json({ ok: true, items });
    } catch (err) {
      console.error('Failed to get social links:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.put('/social-links', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items) return jsonError(res, 400, 'items must be an array');
    const normalized = items
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({
        id: typeof x.id === 'string' ? x.id : createId('soc'),
        platform: pickString(x.platform) || 'other',
        url: pickString(x.url),
        handle: pickOptionalString(x.handle),
        order: Number.isFinite(Number(x.order)) ? Number(x.order) : 0,
        active: typeof x.active === 'boolean' ? x.active : true,
      }))
      .filter((x) => x.url);

    try {
      await pgDb.query('BEGIN');
      await pgDb.query('DELETE FROM social_links');
      for (const item of normalized) {
        await pgDb.query(
          `INSERT INTO social_links (id, platform, url, order_index, handle, active)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [item.id, item.platform, item.url, item.order, item.handle, item.active]
        );
      }
      await pgDb.query('COMMIT');
      res.json({ ok: true, items: normalized });
    } catch (err) {
      await pgDb.query('ROLLBACK');
      console.error('Failed to update social links:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/gallery', async (req, res) => {
    const q = pickString(req.query.q);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);
    
    try {
      const result = await pgDb.query('SELECT * FROM gallery');
      const rows = result.rows;
      
      const albums = rows.filter(r => r.media_id === null || r.media_id === undefined);
      const photos = rows.filter(r => r.media_id !== null && r.media_id !== undefined);

      let items = albums.map(album => {
        const albumPhotos = photos.filter(p => p.category === album.title);
        return {
          id: album.id,
          title: album.title,
          description: album.description,
          year: album.year,
          eventId: album.event_id,
          mediaIds: albumPhotos.map(p => p.media_id),
          createdAt: album.created_at ? new Date(album.created_at).toISOString() : nowIso(),
          updatedAt: album.updated_at ? new Date(album.updated_at).toISOString() : (album.created_at ? new Date(album.created_at).toISOString() : nowIso()),
        };
      });

      if (q) {
        items = items.filter((x) => matchesQuery(getTextIndex(x), q));
      }
      items.sort(sortByUpdatedAtDesc);

      const total = items.length;
      res.json(listResponse(items.slice(offset, offset + limit), { total, limit, offset }));
    } catch (err) {
      console.error('Failed to fetch gallery albums:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.post('/gallery', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const title = pickString(req.body.title);
    if (!title) return jsonError(res, 400, 'Missing required fields');

    const id = createId('gal');
    const description = pickOptionalString(req.body.description);
    const year = pickNumber(req.body.year);
    const eventId = pickOptionalString(req.body.eventId);
    const mediaIds = Array.isArray(req.body.mediaIds) ? req.body.mediaIds.filter((x) => typeof x === 'string') : [];
    const now = nowIso();

    try {
      await pgDb.query(
        `INSERT INTO gallery (id, title, description, year, event_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, title, description, year, eventId, now, now]
      );

      for (const mediaId of mediaIds) {
        const itemId = createId('gal_item');
        await pgDb.query(
          `INSERT INTO gallery (id, title, description, media_id, category, created_at, updated_at, year, event_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [itemId, `Photo`, `Album photo`, mediaId, title, now, now, year, eventId]
        );
      }

      res.status(201).json({
        ok: true,
        item: {
          id,
          title,
          description,
          year,
          eventId,
          mediaIds,
          createdAt: now,
          updatedAt: now
        }
      });
    } catch (err) {
      console.error('Failed to create gallery album:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.put('/gallery/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    try {
      const existing = await pgDb.query('SELECT * FROM gallery WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) return jsonError(res, 404, 'Not found');
      
      const album = existing.rows[0];
      const oldTitle = album.title;
      
      const title = pickString(req.body.title) || oldTitle;
      const description = pickOptionalString(req.body.description) ?? album.description;
      const year = pickNumber(req.body.year) ?? album.year;
      const eventId = pickOptionalString(req.body.eventId) ?? album.event_id;
      const mediaIds = Array.isArray(req.body.mediaIds) ? req.body.mediaIds.filter((x) => typeof x === 'string') : null;
      const now = nowIso();

      await pgDb.query(
        `UPDATE gallery SET title = $1, description = $2, year = $3, event_id = $4, updated_at = $5 WHERE id = $6`,
        [title, description, year, eventId, now, req.params.id]
      );

      if (title !== oldTitle) {
        await pgDb.query(
          `UPDATE gallery SET category = $1 WHERE category = $2 AND media_id IS NOT NULL`,
          [title, oldTitle]
        );
      }

      let finalMediaIds = mediaIds;
      if (mediaIds !== null) {
        await pgDb.query(
          `DELETE FROM gallery WHERE category = $1 AND media_id IS NOT NULL`,
          [title]
        );
        for (const mediaId of mediaIds) {
          const itemId = createId('gal_item');
          await pgDb.query(
            `INSERT INTO gallery (id, title, description, media_id, category, created_at, updated_at, year, event_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [itemId, `Photo`, `Album photo`, mediaId, title, now, now, year, eventId]
          );
        }
      } else {
        const currentItems = await pgDb.query(
          `SELECT media_id FROM gallery WHERE category = $1 AND media_id IS NOT NULL`,
          [title]
        );
        finalMediaIds = currentItems.rows.map(r => r.media_id);
      }

      res.json({
        ok: true,
        item: {
          id: req.params.id,
          title,
          description,
          year,
          eventId,
          mediaIds: finalMediaIds,
          createdAt: album.created_at ? new Date(album.created_at).toISOString() : now,
          updatedAt: now
        }
      });
    } catch (err) {
      console.error('Failed to update gallery album:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.delete('/gallery/:id', adminOnly, async (req, res) => {
    try {
      const existing = await pgDb.query('SELECT * FROM gallery WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) return jsonError(res, 404, 'Not found');
      
      const album = existing.rows[0];
      const title = album.title;

      await pgDb.query('DELETE FROM gallery WHERE category = $1 AND media_id IS NOT NULL', [title]);
      await pgDb.query('DELETE FROM gallery WHERE id = $1', [req.params.id]);

      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete gallery album:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/contributors', async (req, res) => {
    const q = pickString(req.query.q);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);

    try {
      let query = 'SELECT * FROM contributors';
      const params = [];
      const conditions = [];

      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(name ILIKE $${params.length} OR role ILIKE $${params.length} OR bio ILIKE $${params.length})`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY order_index ASC, created_at DESC';
      
      const totalResult = await pgDb.query(`SELECT COUNT(*) FROM (${query}) AS t`, params);
      const total = parseInt(totalResult.rows[0].count);

      params.push(limit, offset);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
      
      const result = await pgDb.query(query, params);
      const items = result.rows.map(r => ({
        id: r.id,
        name: r.name,
        role: r.role,
        bio: r.bio,
        imageUrl: r.image_url,
        orderIndex: r.order_index,
        photoMediaId: r.photo_media_id,
        socials: typeof r.socials === 'string' ? JSON.parse(r.socials) : r.socials || [],
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : nowIso(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : (r.created_at ? new Date(r.created_at).toISOString() : nowIso()),
      }));
      res.json(listResponse(items, { total, limit, offset }));
    } catch (err) {
      console.error('Failed to fetch contributors:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.post('/contributors', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const name = pickString(req.body.name);
    if (!name) return jsonError(res, 400, 'Missing required fields');

    const id = createId('ctr');
    const role = pickOptionalString(req.body.role);
    const bio = pickOptionalString(req.body.bio);
    const photoMediaId = pickOptionalString(req.body.photoMediaId);
    const orderIndex = pickNumber(req.body.orderIndex) || 0;
    const socials = Array.isArray(req.body.socials)
      ? req.body.socials.filter((x) => x && typeof x === 'object').map((x) => ({ platform: pickString(x.platform), url: pickString(x.url) }))
      : [];
    const now = nowIso();

    try {
      let imageUrl = pickOptionalString(req.body.imageUrl);
      if (photoMediaId && !imageUrl) {
        const mediaRes = await pgDb.query('SELECT url FROM media WHERE id = $1', [photoMediaId]);
        if (mediaRes.rowCount > 0) {
          imageUrl = mediaRes.rows[0].url;
        }
      }

      await pgDb.query(
        `INSERT INTO contributors (id, name, role, bio, image_url, order_index, photo_media_id, socials, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, name, role, bio, imageUrl, orderIndex, photoMediaId, JSON.stringify(socials), now, now]
      );

      res.status(201).json({
        ok: true,
        item: {
          id,
          name,
          role,
          bio,
          imageUrl,
          orderIndex,
          photoMediaId,
          socials,
          createdAt: now,
          updatedAt: now
        }
      });
    } catch (err) {
      console.error('Failed to create contributor:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.put('/contributors/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    try {
      const existing = await pgDb.query('SELECT * FROM contributors WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) return jsonError(res, 404, 'Not found');

      const contributor = existing.rows[0];
      const name = pickString(req.body.name) || contributor.name;
      const role = pickOptionalString(req.body.role) ?? contributor.role;
      const bio = pickOptionalString(req.body.bio) ?? contributor.bio;
      const photoMediaId = pickOptionalString(req.body.photoMediaId) ?? contributor.photo_media_id;
      const orderIndex = pickNumber(req.body.orderIndex) ?? contributor.order_index ?? 0;
      const socials = Array.isArray(req.body.socials)
        ? req.body.socials.filter((x) => x && typeof x === 'object').map((x) => ({ platform: pickString(x.platform), url: pickString(x.url) }))
        : (typeof contributor.socials === 'string' ? JSON.parse(contributor.socials) : contributor.socials || []);
      const now = nowIso();

      let imageUrl = pickOptionalString(req.body.imageUrl) ?? contributor.image_url;
      if (photoMediaId && photoMediaId !== contributor.photo_media_id) {
        const mediaRes = await pgDb.query('SELECT url FROM media WHERE id = $1', [photoMediaId]);
        if (mediaRes.rowCount > 0) {
          imageUrl = mediaRes.rows[0].url;
        }
      }

      await pgDb.query(
        `UPDATE contributors SET name = $1, role = $2, bio = $3, image_url = $4, order_index = $5, photo_media_id = $6, socials = $7, updated_at = $8
         WHERE id = $9`,
        [name, role, bio, imageUrl, orderIndex, photoMediaId, JSON.stringify(socials), now, req.params.id]
      );

      res.json({
        ok: true,
        item: {
          id: req.params.id,
          name,
          role,
          bio,
          imageUrl,
          orderIndex,
          photoMediaId,
          socials,
          createdAt: contributor.created_at ? new Date(contributor.created_at).toISOString() : now,
          updatedAt: now
        }
      });
    } catch (err) {
      console.error('Failed to update contributor:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.delete('/contributors/:id', adminOnly, async (req, res) => {
    try {
      const result = await pgDb.query('DELETE FROM contributors WHERE id = $1', [req.params.id]);
      if (result.rowCount === 0) return jsonError(res, 404, 'Not found');
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete contributor:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/navigation-menu', async (_req, res) => {
    try {
      const result = await pgDb.query('SELECT * FROM navigation_menu ORDER BY order_index ASC');
      const items = result.rows.map(r => ({
        id: r.id,
        label: r.label,
        path: r.path,
        parentId: r.parent_id,
        order: r.order_index,
        visible: r.is_visible,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : nowIso(),
      }));
      res.json({ ok: true, items });
    } catch (e) {
      console.error('Failed to fetch navigation menu:', e);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.put('/navigation-menu', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items) return jsonError(res, 400, 'items must be an array');
    
    try {
      await pgDb.query('DELETE FROM navigation_menu');

      const normalized = [];
      for (const x of items) {
        if (!x || typeof x !== 'object') continue;
        const id = typeof x.id === 'string' ? x.id : createId('nav');
        const label = pickString(x.label);
        const pathVal = pickString(x.path);
        const order = Number.isFinite(Number(x.order)) ? Number(x.order) : 0;
        const visible = typeof x.visible === 'boolean' ? x.visible : true;
        
        if (!label || !pathVal) continue;

        await pgDb.query(
          `INSERT INTO navigation_menu (id, label, path, order_index, is_visible)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, label, pathVal, order, visible]
        );

        normalized.push({ id, label, path: pathVal, order, visible });
      }

      res.json({ ok: true, items: normalized });
    } catch (e) {
      console.error('Failed to update navigation menu:', e);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.get('/site-settings', async (_req, res) => {
    try {
      const result = await pgDb.query("SELECT value, updated_at FROM site_settings WHERE key = $1", ['main']);
      const data = result.rowCount > 0 ? result.rows[0].value : {};
      res.json({
        ok: true,
        item: {
          id: 'site',
          updatedAt: result.rowCount > 0 && result.rows[0].updated_at ? new Date(result.rows[0].updated_at).toISOString() : nowIso(),
          data
        }
      });
    } catch (e) {
      console.error('Failed to fetch site settings:', e);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.put('/site-settings', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    try {
      const result = await pgDb.query("SELECT value FROM site_settings WHERE key = $1", ['main']);
      const currentData = result.rowCount > 0 ? result.rows[0].value : {};
      const nextData = typeof req.body.data === 'object' && req.body.data !== null ? req.body.data : currentData;
      const now = nowIso();

      await pgDb.query(
        `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        ['main', nextData]
      );

      res.json({
        ok: true,
        item: {
          id: 'site',
          updatedAt: now,
          data: nextData
        }
      });
    } catch (e) {
      console.error('Failed to update site settings:', e);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // Cloud Integrations Endpoints
  router.get('/integrations', adminOnly, async (req, res) => {
    try {
      const result = await pgDb.query("SELECT value FROM site_settings WHERE key = $1", ['integrations']);
      const integrations = result.rowCount > 0 ? result.rows[0].value : {};
      res.json({ ok: true, integrations });
    } catch (e) {
      jsonError(res, 500, e.message);
    }
  });

  router.post('/integrations', adminOnly, async (req, res) => {
    try {
      const value = req.body || {};
      await pgDb.query(
        "INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP",
        ['integrations', value]
      );
      res.json({ ok: true });
    } catch (e) {
      jsonError(res, 500, e.message);
    }
  });

  router.post('/integrations/test-browserless', adminOnly, async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) {
        return jsonError(res, 400, 'Browserless API Key is required');
      }

      // Dynamically import puppeteer-core to run a remote connection
      const { default: puppeteer } = await import('puppeteer-core');
      
      const wsUrl = `wss://chrome.browserless.io?token=${apiKey}`;
      const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });
      const version = await browser.version();
      await browser.close();

      res.json({ ok: true, version });
    } catch (e) {
      console.error('Browserless connection failed:', e);
      jsonError(res, 500, `Connection failed: ${e.message}`);
    }
  });

  router.post('/integrations/run-dns-sync', adminOnly, async (req, res) => {
    try {
      // Trigger scripts/dns_configure_whogohost.js as a subprocess
      // We will read the Whogohost credentials and Browserless token from the DB integrations entry
      const result = await pgDb.query("SELECT value FROM site_settings WHERE key = $1", ['integrations']);
      const integrations = result.rowCount > 0 ? result.rows[0].value : {};
      
      const browserlessToken = integrations.browserless_api_key || '';
      const whogohostEmail = integrations.whogohost_email || '';
      const whogohostPassword = integrations.whogohost_password || '';

      if (!browserlessToken) {
        return jsonError(res, 400, 'Missing Browserless API Key in integrations settings');
      }
      if (!whogohostEmail || !whogohostPassword) {
        return jsonError(res, 400, 'Missing Whogohost email or password in integrations settings');
      }

      // Execute the script using child_process
      const { exec } = await import('child_process');
      const scriptPath = path.resolve(__dirname, '../../scripts/dns_configure_whogohost.js');
      
      // Let's pass the parameters as env variables or arguments
      const child = exec(`node "${scriptPath}"`, {
        env: {
          ...process.env,
          BROWSERLESS_TOKEN: browserlessToken,
          WHOGOHOST_EMAIL: whogohostEmail,
          WHOGOHOST_PASSWORD: whogohostPassword,
          RUN_REMOTE: 'true'
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        res.json({
          ok: code === 0,
          code,
          stdout,
          stderr
        });
      });
    } catch (e) {
      jsonError(res, 500, e.message);
    }
  });

  router.post('/integrations/run-drive-sync', adminOnly, async (req, res) => {
    try {
      const result = await pgDb.query("SELECT value FROM site_settings WHERE key = $1", ['integrations']);
      const integrations = result.rowCount > 0 ? result.rows[0].value : {};
      
      const folderId = integrations.google_drive_folder_id || '';
      const apiKey = integrations.google_api_key || '';
      const serviceAccountJson = integrations.google_service_account_json || '';

      if (!folderId) {
        return jsonError(res, 400, 'Missing Google Drive Folder ID in integrations settings');
      }

      // Execute the sync script using child_process
      const { exec } = await import('child_process');
      const scriptPath = path.resolve(__dirname, '../../scripts/sync_google_drive.js');
      
      const child = exec(`node "${scriptPath}"`, {
        env: {
          ...process.env,
          GOOGLE_DRIVE_FOLDER_ID: folderId,
          GOOGLE_API_KEY: apiKey,
          GOOGLE_SERVICE_ACCOUNT_JSON: serviceAccountJson,
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        res.json({
          ok: code === 0,
          code,
          stdout,
          stderr
        });
      });
    } catch (e) {
      jsonError(res, 500, e.message);
    }
  });

  router.post('/integrations/run-public-drive-sync', adminOnly, async (req, res) => {
    try {
      const result = await pgDb.query("SELECT value FROM site_settings WHERE key = $1", ['integrations']);
      const integrations = result.rowCount > 0 ? result.rows[0].value : {};
      
      const folderId = integrations.google_drive_folder_id || '';
      const browserlessToken = integrations.browserless_api_key || '';

      if (!folderId) {
        return jsonError(res, 400, 'Missing Google Drive Folder ID in integrations settings');
      }

      // Execute the sync script using child_process
      const { exec } = await import('child_process');
      const scriptPath = path.resolve(__dirname, '../../scripts/sync_public_gdrive.js');
      
      const child = exec(`node "${scriptPath}"`, {
        env: {
          ...process.env,
          GOOGLE_DRIVE_FOLDER_ID: folderId,
          BROWSERLESS_TOKEN: browserlessToken
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        res.json({
          ok: code === 0,
          code,
          stdout,
          stderr
        });
      });
    } catch (e) {
      jsonError(res, 500, e.message);
    }
  });

  const zipUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB max ZIP size
  });

  router.post('/integrations/upload-zip', adminOnly, zipUpload.single('zipFile'), async (req, res) => {
    if (!req.file) {
      return jsonError(res, 400, 'No ZIP file uploaded');
    }
    
    let logs = [];
    const log = (msg) => {
      console.log(msg);
      logs.push(msg);
    };

    log(`[ZIP INGEST] Starting processing of uploaded ZIP archive: "${req.file.originalname}" (${(req.file.size / 1024 / 1024).toFixed(2)} MB)...`);

    try {
      const zip = new AdmZip(req.file.buffer);
      const zipEntries = zip.getEntries();
      
      let uploadCount = 0;
      let skippedCount = 0;
      let linkedLectures = 0;
      let addedToGallery = 0;

      // Filter and collect non-directory entries
      const files = zipEntries.filter(entry => !entry.isDirectory && !entry.entryName.startsWith('__MACOSX/') && !entry.entryName.includes('/.DS_Store'));
      log(`[ZIP INGEST] Found ${files.length} valid file entries in the archive.`);

      for (const entry of files) {
        const filePath = entry.entryName;
        const filename = path.basename(filePath);
        const fileBuffer = entry.getData();
        const sizeBytes = fileBuffer.length;
        const ext = path.extname(filename).toLowerCase();
        
        const zipPath = `zip://${req.file.originalname}/${filePath}`;
        
        log(`📦 Extracting file: "${filePath}" (filename: "${filename}")`);

        let id;
        let publicUrl;
        let type = 'file';
        let category = 'general';
        let isDuplicate = false;

        // Deduplication check: match exact zipPath or same filename and size in database
        const dupCheck = await pgDb.query(
          'SELECT id, url, category, type FROM media WHERE file_path = $1 OR (title = $2 AND size_bytes = $3)', 
          [zipPath, filename, sizeBytes]
        );

        if (dupCheck.rowCount > 0) {
          const existingMedia = dupCheck.rows[0];
          id = existingMedia.id;
          publicUrl = existingMedia.url;
          category = existingMedia.category || 'general';
          type = existingMedia.type || 'file';
          log(`⏭️ Skipping upload for duplicate "${filename}" (already registered as ${id}).`);
          skippedCount++;
          isDuplicate = true;

          // If the file was previously classified as general, but should be gallery, upgrade it
          const folderName = getFolderCategory(filePath);
          if (category === 'general' && type === 'image' && folderName !== 'General Gallery') {
            category = 'gallery';
            await pgDb.query("UPDATE media SET category = 'gallery', updated_at = NOW() WHERE id = $1", [id]);
            log(`   🔄 Upgraded duplicate media "${filename}" category to 'gallery'.`);
          }
        } else {
          // Map types and mime
          let mime = 'application/octet-stream';
          const mimeMap = {
            '.jpg': { type: 'image', mime: 'image/jpeg' },
            '.jpeg': { type: 'image', mime: 'image/jpeg' },
            '.png': { type: 'image', mime: 'image/png' },
            '.gif': { type: 'image', mime: 'image/gif' },
            '.svg': { type: 'image', mime: 'image/svg+xml' },
            '.webp': { type: 'image', mime: 'image/webp' },
            '.pdf': { type: 'pdf', mime: 'application/pdf' },
            '.mp4': { type: 'video', mime: 'video/mp4' },
            '.webm': { type: 'video', mime: 'video/webm' },
            '.mp3': { type: 'audio', mime: 'audio/mpeg' },
            '.wav': { type: 'audio', mime: 'audio/wav' },
          };
          if (mimeMap[ext]) {
            type = mimeMap[ext].type;
            mime = mimeMap[ext].mime;
          }

          // Categorize based on folder structure
          const pathLower = filePath.toLowerCase();
          const folderName = getFolderCategory(filePath);
          if (pathLower.includes('speaker') || pathLower.includes('portrait')) {
            category = 'speaker_portrait';
          } else if (pathLower.includes('lecture') || pathLower.includes('paper')) {
            category = 'lecture_paper';
          } else if (pathLower.includes('gallery') || pathLower.includes('photo') || pathLower.includes('picture')) {
            category = 'gallery';
          } else if (pathLower.includes('resource') || pathLower.includes('download')) {
            category = 'resource';
          } else if (type === 'image' && folderName !== 'General Gallery') {
            // Default image files nested inside a folder to 'gallery'
            category = 'gallery';
          }

          log(`⏳ Uploading [${category.toUpperCase()}] "${filename}"...`);

          id = createId('med');
          const cleanExt = ext.replace(/[^a-z0-9.]/g, '');
          const storagePath = `${type}s/${id}${cleanExt}`;
          const bucket = 'media';

          // 1. Upload to Supabase Storage
          const uploadResult = await uploadToStorage(fileBuffer, storagePath, mime);
          publicUrl = uploadResult.publicUrl;

          // 2. Register in PostgreSQL
          await pgDb.query(
            `INSERT INTO media 
              (id, type, title, url, file_path, storage_bucket, storage_path, mime_type, size_bytes, category, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
            [id, type, filename, publicUrl, zipPath, bucket, storagePath, mime, sizeBytes, category]
          );
          log(`   ✅ Uploaded and registered: ${publicUrl}`);
          uploadCount++;
        }

        // 3. Smart Matching: Lectures
        const yearMatch = filename.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          const lectureResult = await pgDb.query(`SELECT id, speaker, title FROM lectures WHERE year = $1`, [year]);
          if (lectureResult.rowCount > 0) {
            const lecture = lectureResult.rows[0];
            if (category === 'speaker_portrait' || type === 'image') {
              await pgDb.query(`UPDATE lectures SET image = $1, updated_at = NOW() WHERE id = $2`, [publicUrl, lecture.id]);
              log(`   🔗 Linked speaker portrait to Lecture of ${year} ("${lecture.speaker}")`);
              if (!isDuplicate) linkedLectures++;
            } else if (category === 'lecture_paper' || type === 'pdf') {
              await pgDb.query(`UPDATE lectures SET pdf_url = $1, updated_at = NOW() WHERE id = $2`, [publicUrl, lecture.id]);
              log(`   🔗 Linked lecture paper PDF to Lecture of ${year} ("${lecture.title}")`);
              if (!isDuplicate) linkedLectures++;
            }
          }
        }

        // 4. Smart Matching: Galleries
        if (category === 'gallery') {
          const folderName = getFolderCategory(filePath);
          
          let albumResult = await pgDb.query(`SELECT id FROM gallery WHERE title = $1`, [folderName]);
          let albumId;
          if (albumResult.rowCount === 0) {
            albumId = createId('gal');
            await pgDb.query(
              `INSERT INTO gallery (id, title, description, category, created_at) VALUES ($1, $2, $3, $4, NOW())`,
              [albumId, folderName, 'Click to open and view the full gallery collection.', 'Events']
            );
            log(`   🖼️ Created new Gallery Album: "${folderName}"`);
          } else {
            albumId = albumResult.rows[0].id;
          }

          // Check if photo is already linked to this album to prevent duplicate links
          const galleryLinkCheck = await pgDb.query(
            `SELECT id FROM gallery WHERE media_id = $1 AND category = $2`,
            [id, folderName]
          );
          if (galleryLinkCheck.rowCount === 0) {
            const galleryItemId = createId('gal_item');
            await pgDb.query(
              `INSERT INTO gallery (id, title, description, media_id, category, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
              [galleryItemId, filename, `Photo from ZIP archive folder ${folderName}`, id, folderName]
            );
            log(`   🖼️ Linked photo to album "${folderName}"`);
            if (!isDuplicate) addedToGallery++;
          } else {
            log(`   ⏭️ Photo already linked to album "${folderName}". Skipping duplicate link.`);
          }
        }
      }

      log(`\n🎉 ZIP Ingest Completed Successfully!`);
      log(`======================`);
      log(`Uploaded:            ${uploadCount}`);
      log(`Skipped (Dedupped):  ${skippedCount}`);
      log(`Linked to Lectures:  ${linkedLectures}`);
      log(`Added to Galleries:  ${addedToGallery}`);
      log(`======================`);

      res.json({
        ok: true,
        stdout: logs.join('\n'),
        stderr: ''
      });

    } catch (e) {
      console.error(e);
      log(`❌ Critical Error: ${e.message}`);
      res.json({
        ok: false,
        stdout: logs.join('\n'),
        stderr: e.message
      });
    }
  });

  router.post('/integrations/run-link-sync', adminOnly, async (req, res) => {
    const urls = req.body.urls;
    if (!Array.isArray(urls) || urls.length === 0) {
      return jsonError(res, 400, 'Invalid or empty urls list');
    }

    let logs = [];
    const log = (msg) => {
      console.log(msg);
      logs.push(msg);
    };

    log(`[LINK SYNC] Starting ingestion of ${urls.length} URLs...`);

    try {
      let uploadCount = 0;
      let skippedCount = 0;
      let linkedLectures = 0;
      let addedToGallery = 0;

      for (const rawUrl of urls) {
        const urlStr = rawUrl.trim();
        if (!urlStr) continue;

        log(`\n⏳ Ingesting URL: "${urlStr}"`);

        // Check for deduplication
        const dupCheck = await pgDb.query('SELECT id FROM media WHERE file_path = $1 OR url = $2', [urlStr, urlStr]);
        if (dupCheck.rowCount > 0) {
          log(`⏭️ Skipping (already exists in media library).`);
          skippedCount++;
          continue;
        }

        // Fetch file details (stream / response)
        const fileRes = await fetch(urlStr);
        if (!fileRes.ok) {
          log(`❌ Error: HTTP Status ${fileRes.status} for URL "${urlStr}"`);
          continue;
        }

        // Extract filename from headers or URL
        let filename = '';
        const cd = fileRes.headers.get('content-disposition');
        if (cd && cd.includes('filename=')) {
          const match = cd.match(/filename="?([^"]+)"?/);
          if (match) filename = match[1];
        }
        if (!filename) {
          filename = path.basename(new URL(urlStr).pathname) || `link_file_${createId('')}`;
        }

        const arrayBuffer = await fileRes.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        const sizeBytes = fileBuffer.length;
        const mime = fileRes.headers.get('content-type') || 'application/octet-stream';
        const ext = path.extname(filename).toLowerCase();

        // Determine media type
        let type = 'file';
        if (mime.startsWith('image/')) type = 'image';
        else if (mime.startsWith('video/')) type = 'video';
        else if (mime.startsWith('audio/')) type = 'audio';
        else if (mime === 'application/pdf') type = 'pdf';

        // Categorize
        let category = 'general';
        const filenameLower = filename.toLowerCase();
        if (filenameLower.includes('speaker') || filenameLower.includes('portrait')) {
          category = 'speaker_portrait';
        } else if (filenameLower.includes('lecture') || filenameLower.includes('paper')) {
          category = 'lecture_paper';
        } else if (filenameLower.includes('gallery') || filenameLower.includes('photo')) {
          category = 'gallery';
        }

        const id = createId('med');
        const cleanExt = ext.replace(/[^a-z0-9.]/g, '');
        const storagePath = `${type}s/${id}${cleanExt}`;
        const bucket = 'media';

        // 1. Upload to Supabase Storage
        const { publicUrl } = await uploadToStorage(fileBuffer, storagePath, mime);

        // 2. Register in PostgreSQL
        await pgDb.query(
          `INSERT INTO media 
            (id, type, title, url, file_path, storage_bucket, storage_path, mime_type, size_bytes, category, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [id, type, filename, publicUrl, urlStr, bucket, storagePath, mime, sizeBytes, category]
        );
        log(`   ✅ Uploaded and registered: ${publicUrl}`);
        uploadCount++;

        // 3. Smart Matching: Lectures
        const yearMatch = filename.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          const lectureResult = await pgDb.query(`SELECT id, speaker, title FROM lectures WHERE year = $1`, [year]);
          if (lectureResult.rowCount > 0) {
            const lecture = lectureResult.rows[0];
            if (category === 'speaker_portrait' || type === 'image') {
              await pgDb.query(`UPDATE lectures SET image = $1, updated_at = NOW() WHERE id = $2`, [publicUrl, lecture.id]);
              log(`   🔗 Linked speaker portrait to Lecture of ${year} ("${lecture.speaker}")`);
              linkedLectures++;
            } else if (category === 'lecture_paper' || type === 'pdf') {
              await pgDb.query(`UPDATE lectures SET pdf_url = $1, updated_at = NOW() WHERE id = $2`, [publicUrl, lecture.id]);
              log(`   🔗 Linked lecture paper PDF to Lecture of ${year} ("${lecture.title}")`);
              linkedLectures++;
            }
          }
        }
      }

      log(`\n🎉 Bulk Link Ingest Completed!`);
      log(`======================`);
      log(`Uploaded:            ${uploadCount}`);
      log(`Skipped (Dedupped):  ${skippedCount}`);
      log(`Linked to Lectures:  ${linkedLectures}`);
      log(`======================`);

      res.json({
        ok: true,
        stdout: logs.join('\n'),
        stderr: ''
      });
    } catch (e) {
      console.error(e);
      log(`❌ Critical Error: ${e.message}`);
      res.json({
        ok: false,
        stdout: logs.join('\n'),
        stderr: e.message
      });
    }
  });

  router.get('/search', async (req, res) => {
    const q = pickString(req.query.q);
    if (!q) return jsonError(res, 400, 'q is required');
    const types = pickString(req.query.types);
    const requested = types
      ? new Set(
          types
            .split(',')
            .map((t) => normalizeTableName(t))
            .filter(Boolean)
        )
      : null;
    const limit = parseLimit(req.query.limit, 25, 200);
    const results = [];

    try {
      if (!requested || requested.has('lectures')) {
        const lecturesRes = await pgDb.query('SELECT id, title, speaker, theme, description, updated_at FROM lectures');
        for (const r of lecturesRes.rows) {
          const text = `${r.title} ${r.speaker} ${r.theme} ${r.description}`;
          if (!matchesQuery(text, q)) continue;
          results.push({
            type: 'lecture',
            id: r.id,
            title: r.title || '',
            score: scoreMatch(`${r.title} ${text}`, q),
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
          });
        }
      }

      if (!requested || requested.has('events')) {
        const eventsRes = await pgDb.query('SELECT id, title, description, updated_at FROM events');
        for (const r of eventsRes.rows) {
          const text = `${r.title} ${r.description}`;
          if (!matchesQuery(text, q)) continue;
          results.push({
            type: 'event',
            id: r.id,
            title: r.title || '',
            score: scoreMatch(`${r.title} ${text}`, q),
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
          });
        }
      }

      if (!requested || requested.has('media')) {
        const mediaRes = await pgDb.query('SELECT id, title, description, category, type, updated_at FROM media');
        for (const r of mediaRes.rows) {
          const text = `${r.title} ${r.description} ${r.category} ${r.type}`;
          if (!matchesQuery(text, q)) continue;
          results.push({
            type: 'media',
            id: r.id,
            title: r.title || '',
            score: scoreMatch(`${r.title} ${text}`, q),
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
          });
        }
      }

      if (!requested || requested.has('publications')) {
        const pubRes = await pgDb.query('SELECT id, title, abstract, url, updated_at FROM publications');
        for (const r of pubRes.rows) {
          const text = `${r.title} ${r.abstract} ${r.url}`;
          if (!matchesQuery(text, q)) continue;
          results.push({
            type: 'publication',
            id: r.id,
            title: r.title || '',
            score: scoreMatch(`${r.title} ${text}`, q),
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
          });
        }
      }

      if (!requested || requested.has('pressReleases') || requested.has('press_releases')) {
        const prRes = await pgDb.query('SELECT id, title, content, updated_at FROM press_releases');
        for (const r of prRes.rows) {
          const text = `${r.title} ${r.content}`;
          if (!matchesQuery(text, q)) continue;
          results.push({
            type: 'pressRelease',
            id: r.id,
            title: r.title || '',
            score: scoreMatch(`${r.title} ${text}`, q),
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
          });
        }
      }

      if (!requested || requested.has('gallery')) {
        const galRes = await pgDb.query('SELECT id, title, description, updated_at FROM gallery WHERE media_id IS NULL');
        for (const r of galRes.rows) {
          const text = `${r.title} ${r.description}`;
          if (!matchesQuery(text, q)) continue;
          results.push({
            type: 'gallery',
            id: r.id,
            title: r.title || '',
            score: scoreMatch(`${r.title} ${text}`, q),
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
          });
        }
      }

      if (!requested || requested.has('contributors')) {
        const conRes = await pgDb.query('SELECT id, name, bio, role, updated_at FROM contributors');
        for (const r of conRes.rows) {
          const text = `${r.name} ${r.bio} ${r.role}`;
          if (!matchesQuery(text, q)) continue;
          results.push({
            type: 'contributor',
            id: r.id,
            title: r.name || '',
            score: scoreMatch(`${r.name} ${text}`, q),
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
          });
        }
      }

      results.sort((a, b) => (b.score - a.score) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      res.json({ ok: true, q, items: results.slice(0, limit) });
    } catch (err) {
      console.error('Global search error:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  router.post('/import/:table', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const table = normalizeTableName(req.params.table);
    if (!table || table === 'siteSettings') return jsonError(res, 400, 'Invalid table');
    const mode = pickString(req.body.mode) || 'append';
    const incoming = Array.isArray(req.body.items) ? req.body.items : null;
    if (!incoming) return jsonError(res, 400, 'items must be an array');

    let sqlTable = table;
    if (table === 'pressReleases') sqlTable = 'press_releases';
    if (table === 'socialLinks') sqlTable = 'social_links';

    try {
      await pgDb.query('BEGIN');

      if (mode === 'replace') {
        await pgDb.query(`DELETE FROM ${sqlTable}`);
      }

      let inserted = 0;
      let updated = 0;

      for (const raw of incoming) {
        if (!raw || typeof raw !== 'object') continue;
        const id = typeof raw.id === 'string' ? raw.id : createId(table.slice(0, 3));
        const now = nowIso();

        if (mode === 'upsert') {
          const checkRes = await pgDb.query(`SELECT id FROM ${sqlTable} WHERE id = $1`, [id]);
          if (checkRes.rowCount > 0) {
            if (table === 'lectures') {
              await pgDb.query(
                `UPDATE lectures SET year = $1, theme = $2, speaker = $3, title = $4, description = $5, image = $6, role = $7, pdf_url = $8, updated_at = $9 WHERE id = $10`,
                [raw.year, raw.theme, raw.speaker, raw.title, raw.description, raw.image, raw.role, raw.pdfUrl, now, id]
              );
            } else if (table === 'events') {
              await pgDb.query(
                `UPDATE events SET title = $1, description = $2, location = $3, start_at = $4, end_at = $5, status = $6, updated_at = $7 WHERE id = $8`,
                [raw.title, raw.description, raw.location, raw.startAt, raw.endAt, raw.status || 'scheduled', now, id]
              );
            } else if (table === 'media') {
              await pgDb.query(
                `UPDATE media SET type = $1, title = $2, description = $3, url = $4, file_path = $5, storage_bucket = $6, storage_path = $7, mime_type = $8, size_bytes = $9, category = $10, related_lecture_id = $11, related_event_id = $12, status = $13, updated_at = $14 WHERE id = $15`,
                [raw.type, raw.title, raw.description, raw.url, raw.filePath, raw.storageBucket || 'heritage-media', raw.storagePath, raw.mimeType, raw.sizeBytes, raw.category, raw.relatedLectureId, raw.relatedEventId, raw.status || 'ready', now, id]
              );
            } else if (table === 'publications') {
              await pgDb.query(
                `UPDATE publications SET title = $1, authors = $2, published_at = $3, abstract = $4, url = $5, media_id = $6, updated_at = $7 WHERE id = $8`,
                [raw.title, JSON.stringify(raw.authors || []), raw.publishedAt, raw.abstract, raw.url, raw.mediaId, now, id]
              );
            } else if (table === 'pressReleases') {
              await pgDb.query(
                `UPDATE press_releases SET title = $1, content = $2, source = $3, published_at = $4, media_id = $5, updated_at = $6 WHERE id = $7`,
                [raw.title, raw.body, raw.excerpt, raw.publishedAt, raw.mediaId, now, id]
              );
            } else if (table === 'gallery') {
              await pgDb.query(
                `UPDATE gallery SET title = $1, description = $2, media_id = $3, category = $4, year = $5, event_id = $6, updated_at = $7 WHERE id = $8`,
                [raw.title, raw.description, raw.mediaId, raw.category, raw.year, raw.eventId, now, id]
              );
            } else if (table === 'contributors') {
              await pgDb.query(
                `UPDATE contributors SET name = $1, role = $2, bio = $3, image_url = $4, order_index = $5, photo_media_id = $6, socials = $7, updated_at = $8 WHERE id = $9`,
                [raw.name, raw.role, raw.bio, raw.imageUrl, raw.orderIndex || 0, raw.photoMediaId, JSON.stringify(raw.socials || []), now, id]
              );
            } else if (table === 'socialLinks') {
              await pgDb.query(
                `UPDATE social_links SET platform = $1, url = $2, order_index = $3, handle = $4, active = $5 WHERE id = $6`,
                [raw.platform, raw.url, raw.order || 0, raw.handle, raw.active !== false, id]
              );
            }
            updated += 1;
            continue;
          }
        }

        if (table === 'lectures') {
          await pgDb.query(
            `INSERT INTO lectures (id, year, theme, speaker, title, description, image, role, pdf_url, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
            [id, raw.year, raw.theme, raw.speaker, raw.title, raw.description, raw.image, raw.role, raw.pdfUrl, now]
          );
        } else if (table === 'events') {
          await pgDb.query(
            `INSERT INTO events (id, title, description, location, start_at, end_at, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
            [id, raw.title, raw.description, raw.location, raw.startAt, raw.endAt, raw.status || 'scheduled', now]
          );
        } else if (table === 'media') {
          await pgDb.query(
            `INSERT INTO media (id, type, title, description, url, file_path, storage_bucket, storage_path, mime_type, size_bytes, category, related_lecture_id, related_event_id, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)`,
            [id, raw.type, raw.title, raw.description, raw.url, raw.filePath, raw.storageBucket || 'heritage-media', raw.storagePath, raw.mimeType, raw.sizeBytes, raw.category, raw.relatedLectureId, raw.relatedEventId, raw.status || 'ready', now]
          );
        } else if (table === 'publications') {
          await pgDb.query(
            `INSERT INTO publications (id, title, authors, published_at, abstract, url, media_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
            [id, raw.title, JSON.stringify(raw.authors || []), raw.publishedAt, raw.abstract, raw.url, raw.mediaId, now]
          );
        } else if (table === 'pressReleases') {
          await pgDb.query(
            `INSERT INTO press_releases (id, title, content, source, published_at, media_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
            [id, raw.title, raw.body, raw.excerpt, raw.publishedAt, raw.mediaId, now]
          );
        } else if (table === 'gallery') {
          await pgDb.query(
            `INSERT INTO gallery (id, title, description, media_id, category, year, event_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
            [id, raw.title, raw.description, raw.mediaId, raw.category, raw.year, raw.eventId, now]
          );
        } else if (table === 'contributors') {
          await pgDb.query(
            `INSERT INTO contributors (id, name, role, bio, image_url, order_index, photo_media_id, socials, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
            [id, raw.name, raw.role, raw.bio, raw.imageUrl, raw.orderIndex || 0, raw.photoMediaId, JSON.stringify(raw.socials || []), now]
          );
        } else if (table === 'socialLinks') {
          await pgDb.query(
            `INSERT INTO social_links (id, platform, url, order_index, handle, active)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, raw.platform, raw.url, raw.order || 0, raw.handle, raw.active !== false]
          );
        }
        inserted += 1;
      }

      await pgDb.query('COMMIT');
      res.json({ ok: true, table, mode, inserted, updated });
    } catch (err) {
      await pgDb.query('ROLLBACK');
      console.error(`Failed to import items into ${table}:`, err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // ─── Admin User Management Routes ─────────────────────────────────────────

  // POST /admin/setup — Bootstrap the very first admin account.
  // Only works when NO admin exists in the DB yet.
  // Requires the ADMIN_PASSCODE env var as a one-time setup token.
  router.post('/admin/setup', async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const { email, setupToken } = req.body;
    if (!email || !setupToken) return jsonError(res, 400, 'email and setupToken required');

    const expectedToken = process.env.ADMIN_PASSCODE || '';
    if (!expectedToken || setupToken !== expectedToken) {
      return jsonError(res, 403, 'Invalid setup token');
    }

    try {
      // Block if any admin already exists
      const existing = await pgDb.query(
        `SELECT id FROM users WHERE role = 'admin' LIMIT 1`
      );
      if (existing.rowCount > 0) {
        return jsonError(res, 403, 'Admin already configured. Use the admin console to manage roles.');
      }

      const result = await pgDb.query(
        `UPDATE users SET role = 'admin', updated_at = CURRENT_TIMESTAMP
         WHERE email = $1
         RETURNING id, email, username, role`,
        [email.trim().toLowerCase()]
      );

      if (result.rowCount === 0) {
        return jsonError(res, 404, 'User not found. Register first then run setup.');
      }

      logAudit(result.rows[0].id, 'admin.bootstrap', { headers: {}, ip: req.ip }, { email });
      res.json({ ok: true, message: 'Admin access granted.', user: result.rows[0] });
    } catch (err) {
      console.error('Admin setup failed:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // Middleware: require the caller to be an admin (DB-verified via JWT)
  function requireAdminRole(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
      return jsonError(res, 403, 'Admin access required');
    }
    next();
  }

  // GET /admin/users — List all users (admin only)
  router.get('/admin/users', requireAuth, requireAdminRole, async (req, res) => {
    const limit = parseLimit(req.query.limit, 50, 200);
    const offset = parseOffset(req.query.offset, 0);
    const q = pickString(req.query.q);

    try {
      let where = '';
      const params = [];
      if (q) {
        params.push(`%${q}%`);
        where = `WHERE email ILIKE $1 OR username ILIKE $1`;
      }

      const countRes = await pgDb.query(
        `SELECT COUNT(*)::int AS total FROM users ${where}`, params
      );
      const total = countRes.rows[0].total;

      params.push(limit, offset);
      const usersRes = await pgDb.query(
        `SELECT id, email, username, full_name, avatar_url, role, created_at
         FROM users ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      res.json({ ok: true, total, limit, offset, items: usersRes.rows });
    } catch (err) {
      console.error('List users failed:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // PATCH /admin/users/:id/role — Promote or demote a user (admin only)
  router.patch('/admin/users/:id/role', requireAuth, requireAdminRole, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const { role } = req.body;
    const { id } = req.params;

    const allowedRoles = ['user', 'admin', 'moderator'];
    if (!allowedRoles.includes(role)) {
      return jsonError(res, 400, `role must be one of: ${allowedRoles.join(', ')}`);
    }

    // Prevent self-demotion
    if (id === req.user.id && role !== 'admin') {
      return jsonError(res, 400, 'You cannot remove your own admin access.');
    }

    try {
      // Safety: ensure at least 1 admin will remain
      if (role !== 'admin') {
        const adminCount = await pgDb.query(
          `SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'admin' AND id <> $1`, [id]
        );
        if (adminCount.rows[0].cnt < 1) {
          return jsonError(res, 400, 'Cannot demote the last admin.');
        }
      }

      const result = await pgDb.query(
        `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, email, username, role`,
        [role, id]
      );

      if (result.rowCount === 0) return jsonError(res, 404, 'User not found');

      logAudit(req.user.id, 'admin.role_change', req, { targetId: id, newRole: role });
      res.json({ ok: true, user: result.rows[0] });
    } catch (err) {
      console.error('Role change failed:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // GET /admin/check-setup — Returns whether any admin exists (for Setup page)
  router.get('/admin/check-setup', async (_req, res) => {
    try {
      const result = await pgDb.query(
        `SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'admin'`
      );
      res.json({ ok: true, hasAdmin: result.rows[0].cnt > 0 });
    } catch (err) {
      console.error('Check setup failed:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  return router;
}

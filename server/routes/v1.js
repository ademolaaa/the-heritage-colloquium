import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createId, nowIso } from '../lib/jsonStore.js';
import { jsonError, parseLimit, parseOffset, requireObjectBody } from '../lib/http.js';
import { matchesQuery, scoreMatch } from '../lib/search.js';
import { generatePresignedUrl, getPublicUrl } from '../lib/s3.js';

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

function requireAdmin(verifyAdminPasscode) {
  return async (req, res, next) => {
    const passcode = String(req.header('x-admin-passcode') || '');
    if (!(await verifyAdminPasscode(passcode))) {
      jsonError(res, 401, 'Unauthorized');
      return;
    }
    next();
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

export function createV1Router({ db, verifyAdminPasscode, uploadsDir }) {
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
    const all = await db.readTable('lectures');
    let items = Array.isArray(all) ? all : [];
    if (Number.isFinite(year)) items = items.filter((x) => Number(x?.year) === year);
    if (q) items = items.filter((x) => matchesQuery(getTextIndex(x), q));
    items = items.slice().sort((a, b) => Number(b?.year || 0) - Number(a?.year || 0));
    const total = items.length;
    res.json(listResponse(items.slice(offset, offset + limit), { total, limit, offset }));
  });

  router.post('/lectures', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const year = pickNumber(req.body.year);
    const title = pickString(req.body.title);
    if (!Number.isFinite(year) || !title) return jsonError(res, 400, 'Missing required fields');
    const all = await db.readTable('lectures');
    const items = Array.isArray(all) ? all : [];
    const record = {
      id: createId('lec'),
      year,
      theme: pickOptionalString(req.body.theme),
      speaker: pickOptionalString(req.body.speaker),
      title,
      description: pickOptionalString(req.body.description),
      image: pickOptionalString(req.body.image),
      role: pickOptionalString(req.body.role),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    items.push(record);
    await db.writeTable('lectures', items);
    res.status(201).json({ ok: true, item: record });
  });

  router.get('/lectures/:id', async (req, res) => {
    const all = await db.readTable('lectures');
    const items = Array.isArray(all) ? all : [];
    const { item } = findById(items, req.params.id);
    if (!item) return jsonError(res, 404, 'Not found');
    res.json({ ok: true, item });
  });

  router.put('/lectures/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const all = await db.readTable('lectures');
    const items = Array.isArray(all) ? all : [];
    const { idx, item } = findById(items, req.params.id);
    if (!item) return jsonError(res, 404, 'Not found');
    const next = {
      ...item,
      year: pickNumber(req.body.year) ?? item.year,
      theme: pickOptionalString(req.body.theme) ?? item.theme ?? null,
      speaker: pickOptionalString(req.body.speaker) ?? item.speaker ?? null,
      title: pickString(req.body.title) || item.title,
      description: pickOptionalString(req.body.description) ?? item.description ?? null,
      image: pickOptionalString(req.body.image) ?? item.image ?? null,
      role: pickOptionalString(req.body.role) ?? item.role ?? null,
      updatedAt: nowIso(),
    };
    items[idx] = next;
    await db.writeTable('lectures', items);
    res.json({ ok: true, item: next });
  });

  router.delete('/lectures/:id', adminOnly, async (req, res) => {
    const all = await db.readTable('lectures');
    const items = Array.isArray(all) ? all : [];
    const { idx } = findById(items, req.params.id);
    if (idx < 0) return jsonError(res, 404, 'Not found');
    items.splice(idx, 1);
    await db.writeTable('lectures', items);
    res.json({ ok: true });
  });

  router.get('/events', async (req, res) => {
    const q = pickString(req.query.q);
    const status = pickOptionalString(req.query.status);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);
    const all = await db.readTable('events');
    let items = Array.isArray(all) ? all : [];
    if (status) items = items.filter((x) => String(x?.status || '') === status);
    if (q) items = items.filter((x) => matchesQuery(getTextIndex(x), q));
    items = items.slice().sort(sortByUpdatedAtDesc);
    const total = items.length;
    res.json(listResponse(items.slice(offset, offset + limit), { total, limit, offset }));
  });

  router.post('/events', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const title = pickString(req.body.title);
    const startAt = pickOptionalString(req.body.startAt);
    const status = pickString(req.body.status) || 'scheduled';
    if (!title) return jsonError(res, 400, 'Missing required fields');
    if (startAt && !isIsoDate(startAt)) return jsonError(res, 400, 'startAt must be ISO datetime');
    const all = await db.readTable('events');
    const items = Array.isArray(all) ? all : [];
    const record = {
      id: createId('evt'),
      title,
      description: pickOptionalString(req.body.description),
      location: pickOptionalString(req.body.location),
      startAt,
      endAt: pickOptionalString(req.body.endAt),
      status,
      statusHistory: [{ at: nowIso(), status, note: pickOptionalString(req.body.statusNote) }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    items.push(record);
    await db.writeTable('events', items);
    res.status(201).json({ ok: true, item: record });
  });

  router.get('/events/:id', async (req, res) => {
    const all = await db.readTable('events');
    const items = Array.isArray(all) ? all : [];
    const { item } = findById(items, req.params.id);
    if (!item) return jsonError(res, 404, 'Not found');
    res.json({ ok: true, item });
  });

  router.put('/events/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const all = await db.readTable('events');
    const items = Array.isArray(all) ? all : [];
    const { idx, item } = findById(items, req.params.id);
    if (!item) return jsonError(res, 404, 'Not found');

    const nextStatus = pickString(req.body.status) || item.status;
    const next = {
      ...item,
      title: pickString(req.body.title) || item.title,
      description: pickOptionalString(req.body.description) ?? item.description ?? null,
      location: pickOptionalString(req.body.location) ?? item.location ?? null,
      startAt: pickOptionalString(req.body.startAt) ?? item.startAt ?? null,
      endAt: pickOptionalString(req.body.endAt) ?? item.endAt ?? null,
      status: nextStatus,
      updatedAt: nowIso(),
    };

    if (next.startAt && !isIsoDate(next.startAt)) return jsonError(res, 400, 'startAt must be ISO datetime');
    if (next.endAt && !isIsoDate(next.endAt)) return jsonError(res, 400, 'endAt must be ISO datetime');

    const statusChanged = nextStatus !== item.status;
    if (statusChanged) {
      const history = Array.isArray(item.statusHistory) ? item.statusHistory : [];
      history.push({ at: nowIso(), status: nextStatus, note: pickOptionalString(req.body.statusNote) });
      next.statusHistory = history;
    }

    items[idx] = next;
    await db.writeTable('events', items);
    res.json({ ok: true, item: next });
  });

  router.delete('/events/:id', adminOnly, async (req, res) => {
    const all = await db.readTable('events');
    const items = Array.isArray(all) ? all : [];
    const { idx } = findById(items, req.params.id);
    if (idx < 0) return jsonError(res, 404, 'Not found');
    items.splice(idx, 1);
    await db.writeTable('events', items);
    res.json({ ok: true });
  });

  router.get('/media', async (req, res) => {
    const q = pickString(req.query.q);
    const type = pickOptionalString(req.query.type);
    const ids = pickOptionalString(req.query.ids);
    const category = pickOptionalString(req.query.category);
    const wantCategories = pickOptionalString(req.query.categories);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);
    const all = await db.readTable('media');
    let items = Array.isArray(all) ? all : [];
    if (wantCategories === '1') {
      const cats = Array.from(
        new Set(
          items
            .map((x) => (typeof x?.category === 'string' ? x.category.trim() : ''))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));
      const total = cats.length;
      res.json(listResponse(cats.slice(offset, offset + limit), { total, limit, offset }));
      return;
    }
    if (ids) {
      const set = new Set(ids.split(',').map(s => s.trim()).filter(Boolean));
      items = items.filter(x => set.has(x.id));
    }
    if (category) items = items.filter((x) => String(x?.category || '') === category);
    if (type) items = items.filter((x) => String(x?.type || '') === type);
    if (q) items = items.filter((x) => matchesQuery(getTextIndex(x), q));
    items = items.slice().sort(sortByUpdatedAtDesc);
    const total = items.length;
    res.json(listResponse(items.slice(offset, offset + limit), { total, limit, offset }));
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
    const all = await db.readTable('media');
    const items = Array.isArray(all) ? all : [];
    const record = {
      id: createId('med'),
      type,
      title,
      description: pickOptionalString(req.body.description),
      url,
      filePath: pickOptionalString(req.body.filePath),
      s3Key,
      mimeType: pickOptionalString(req.body.mimeType),
      sizeBytes: pickNumber(req.body.sizeBytes),
      category: category != null ? category : null,
      relatedLectureId: pickOptionalString(req.body.relatedLectureId),
      relatedEventId: pickOptionalString(req.body.relatedEventId),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    items.push(record);
    await db.writeTable('media', items);
    res.status(201).json({ ok: true, item: record });
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

    const all = await db.readTable('media');
    const items = Array.isArray(all) ? all : [];
    const created = files.map((file) => {
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

      const record = {
        id: createId('med'),
        type,
        title,
        description,
        url,
        filePath: file.filename,
        mimeType: mimeType || null,
        sizeBytes: Number.isFinite(Number(file.size)) ? Number(file.size) : null,
        category: category != null ? category : null,
        relatedLectureId,
        relatedEventId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      items.push(record);
      return record;
    });

    await db.writeTable('media', items);
    res.status(201).json({ ok: true, items: created, item: created[0] || null });
  });

  router.get('/media/:id', async (req, res) => {
    const all = await db.readTable('media');
    const items = Array.isArray(all) ? all : [];
    const { item } = findById(items, req.params.id);
    if (!item) return jsonError(res, 404, 'Not found');
    res.json({ ok: true, item });
  });

  router.put('/media/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const all = await db.readTable('media');
    const items = Array.isArray(all) ? all : [];
    const { idx, item } = findById(items, req.params.id);
    if (!item) return jsonError(res, 404, 'Not found');

    const title = pickOptionalString(req.body.title);
    const description = pickOptionalString(req.body.description);
    const category = pickOptionalString(req.body.category);

    const nextTitle = title != null ? title.trim() : item.title;
    if (title != null && !nextTitle) return jsonError(res, 400, 'title is required');

    const next = {
      ...item,
      title: nextTitle,
      description: description != null ? description : item.description ?? null,
      category: category != null ? category : item.category ?? null,
      updatedAt: nowIso(),
    };

    items[idx] = next;
    await db.writeTable('media', items);
    res.json({ ok: true, item: next });
  });

  router.delete('/media/:id', adminOnly, async (req, res) => {
    const all = await db.readTable('media');
    const items = Array.isArray(all) ? all : [];
    const { idx, item } = findById(items, req.params.id);
    if (idx < 0) return jsonError(res, 404, 'Not found');
    items.splice(idx, 1);
    await db.writeTable('media', items);
    const filePath = typeof item?.filePath === 'string' ? item.filePath : '';
    if (uploadsDir && filePath) {
      const safe = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
      const abs = path.join(uploadsDir, safe);
      await fs.unlink(abs).catch(() => {});
    }
    res.json({ ok: true });
  });

  router.get('/publications', async (req, res) => {
    const q = pickString(req.query.q);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);
    const all = await db.readTable('publications');
    let items = Array.isArray(all) ? all : [];
    if (q) items = items.filter((x) => matchesQuery(getTextIndex(x), q));
    items = items.slice().sort(sortByUpdatedAtDesc);
    const total = items.length;
    res.json(listResponse(items.slice(offset, offset + limit), { total, limit, offset }));
  });

  router.post('/publications', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const title = pickString(req.body.title);
    if (!title) return jsonError(res, 400, 'Missing required fields');
    const all = await db.readTable('publications');
    const items = Array.isArray(all) ? all : [];
    const record = {
      id: createId('pub'),
      title,
      authors: Array.isArray(req.body.authors) ? req.body.authors.filter((x) => typeof x === 'string') : [],
      publishedAt: pickOptionalString(req.body.publishedAt),
      abstract: pickOptionalString(req.body.abstract),
      url: pickOptionalString(req.body.url),
      mediaId: pickOptionalString(req.body.mediaId),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    items.push(record);
    await db.writeTable('publications', items);
    res.status(201).json({ ok: true, item: record });
  });

  router.put('/publications/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const all = await db.readTable('publications');
    const items = Array.isArray(all) ? all : [];
    const { idx, item } = findById(items, req.params.id);
    if (!item) return jsonError(res, 404, 'Not found');
    const next = {
      ...item,
      title: pickString(req.body.title) || item.title,
      authors: Array.isArray(req.body.authors) ? req.body.authors.filter((x) => typeof x === 'string') : item.authors ?? [],
      publishedAt: pickOptionalString(req.body.publishedAt) ?? item.publishedAt ?? null,
      abstract: pickOptionalString(req.body.abstract) ?? item.abstract ?? null,
      url: pickOptionalString(req.body.url) ?? item.url ?? null,
      mediaId: pickOptionalString(req.body.mediaId) ?? item.mediaId ?? null,
      updatedAt: nowIso(),
    };
    items[idx] = next;
    await db.writeTable('publications', items);
    res.json({ ok: true, item: next });
  });

  router.delete('/publications/:id', adminOnly, async (req, res) => {
    const all = await db.readTable('publications');
    const items = Array.isArray(all) ? all : [];
    const { idx } = findById(items, req.params.id);
    if (idx < 0) return jsonError(res, 404, 'Not found');
    items.splice(idx, 1);
    await db.writeTable('publications', items);
    res.json({ ok: true });
  });

  router.get('/press-releases', async (req, res) => {
    const q = pickString(req.query.q);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);
    const all = await db.readTable('pressReleases');
    let items = Array.isArray(all) ? all : [];
    if (q) items = items.filter((x) => matchesQuery(getTextIndex(x), q));
    items = items.slice().sort(sortByUpdatedAtDesc);
    const total = items.length;
    res.json(listResponse(items.slice(offset, offset + limit), { total, limit, offset }));
  });

  router.post('/press-releases', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const title = pickString(req.body.title);
    const body = pickString(req.body.body);
    if (!title || !body) return jsonError(res, 400, 'Missing required fields');
    const all = await db.readTable('pressReleases');
    const items = Array.isArray(all) ? all : [];
    const record = {
      id: createId('pr'),
      title,
      excerpt: pickOptionalString(req.body.excerpt),
      body,
      publishedAt: pickOptionalString(req.body.publishedAt),
      mediaId: pickOptionalString(req.body.mediaId),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    items.push(record);
    await db.writeTable('pressReleases', items);
    res.status(201).json({ ok: true, item: record });
  });

  router.put('/press-releases/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const all = await db.readTable('pressReleases');
    const items = Array.isArray(all) ? all : [];
    const { idx, item } = findById(items, req.params.id);
    if (!item) return jsonError(res, 404, 'Not found');
    const next = {
      ...item,
      title: pickString(req.body.title) || item.title,
      excerpt: pickOptionalString(req.body.excerpt) ?? item.excerpt ?? null,
      body: pickString(req.body.body) || item.body,
      publishedAt: pickOptionalString(req.body.publishedAt) ?? item.publishedAt ?? null,
      mediaId: pickOptionalString(req.body.mediaId) ?? item.mediaId ?? null,
      updatedAt: nowIso(),
    };
    items[idx] = next;
    await db.writeTable('pressReleases', items);
    res.json({ ok: true, item: next });
  });

  router.delete('/press-releases/:id', adminOnly, async (req, res) => {
    const all = await db.readTable('pressReleases');
    const items = Array.isArray(all) ? all : [];
    const { idx } = findById(items, req.params.id);
    if (idx < 0) return jsonError(res, 404, 'Not found');
    items.splice(idx, 1);
    await db.writeTable('pressReleases', items);
    res.json({ ok: true });
  });

  router.get('/social-links', async (_req, res) => {
    const all = await db.readTable('socialLinks');
    const items = Array.isArray(all) ? all : [];
    res.json({ ok: true, items: items.slice().sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0)) });
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
        updatedAt: nowIso(),
      }))
      .filter((x) => x.url);
    await db.writeTable('socialLinks', normalized);
    res.json({ ok: true, items: normalized });
  });

  router.get('/gallery', async (req, res) => {
    const q = pickString(req.query.q);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);
    const all = await db.readTable('gallery');
    let items = Array.isArray(all) ? all : [];
    if (q) items = items.filter((x) => matchesQuery(getTextIndex(x), q));
    items = items.slice().sort(sortByUpdatedAtDesc);
    const total = items.length;
    res.json(listResponse(items.slice(offset, offset + limit), { total, limit, offset }));
  });

  router.post('/gallery', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const title = pickString(req.body.title);
    if (!title) return jsonError(res, 400, 'Missing required fields');
    const all = await db.readTable('gallery');
    const items = Array.isArray(all) ? all : [];
    const record = {
      id: createId('gal'),
      title,
      description: pickOptionalString(req.body.description),
      year: pickNumber(req.body.year),
      eventId: pickOptionalString(req.body.eventId),
      mediaIds: Array.isArray(req.body.mediaIds) ? req.body.mediaIds.filter((x) => typeof x === 'string') : [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    items.push(record);
    await db.writeTable('gallery', items);
    res.status(201).json({ ok: true, item: record });
  });

  router.put('/gallery/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const all = await db.readTable('gallery');
    const items = Array.isArray(all) ? all : [];
    const { idx, item } = findById(items, req.params.id);
    if (!item) return jsonError(res, 404, 'Not found');
    const next = {
      ...item,
      title: pickString(req.body.title) || item.title,
      description: pickOptionalString(req.body.description) ?? item.description ?? null,
      year: pickNumber(req.body.year) ?? item.year ?? null,
      eventId: pickOptionalString(req.body.eventId) ?? item.eventId ?? null,
      mediaIds: Array.isArray(req.body.mediaIds) ? req.body.mediaIds.filter((x) => typeof x === 'string') : item.mediaIds ?? [],
      updatedAt: nowIso(),
    };
    items[idx] = next;
    await db.writeTable('gallery', items);
    res.json({ ok: true, item: next });
  });

  router.delete('/gallery/:id', adminOnly, async (req, res) => {
    const all = await db.readTable('gallery');
    const items = Array.isArray(all) ? all : [];
    const { idx } = findById(items, req.params.id);
    if (idx < 0) return jsonError(res, 404, 'Not found');
    items.splice(idx, 1);
    await db.writeTable('gallery', items);
    res.json({ ok: true });
  });

  router.get('/contributors', async (req, res) => {
    const q = pickString(req.query.q);
    const limit = parseLimit(req.query.limit, 50, 300);
    const offset = parseOffset(req.query.offset, 0);
    const all = await db.readTable('contributors');
    let items = Array.isArray(all) ? all : [];
    if (q) items = items.filter((x) => matchesQuery(getTextIndex(x), q));
    items = items.slice().sort(sortByUpdatedAtDesc);
    const total = items.length;
    res.json(listResponse(items.slice(offset, offset + limit), { total, limit, offset }));
  });

  router.post('/contributors', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const name = pickString(req.body.name);
    if (!name) return jsonError(res, 400, 'Missing required fields');
    const all = await db.readTable('contributors');
    const items = Array.isArray(all) ? all : [];
    const record = {
      id: createId('ctr'),
      name,
      role: pickOptionalString(req.body.role),
      bio: pickOptionalString(req.body.bio),
      photoMediaId: pickOptionalString(req.body.photoMediaId),
      socials: Array.isArray(req.body.socials)
        ? req.body.socials.filter((x) => x && typeof x === 'object').map((x) => ({ platform: pickString(x.platform), url: pickString(x.url) }))
        : [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    items.push(record);
    await db.writeTable('contributors', items);
    res.status(201).json({ ok: true, item: record });
  });

  router.put('/contributors/:id', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const all = await db.readTable('contributors');
    const items = Array.isArray(all) ? all : [];
    const { idx, item } = findById(items, req.params.id);
    if (!item) return jsonError(res, 404, 'Not found');
    const next = {
      ...item,
      name: pickString(req.body.name) || item.name,
      role: pickOptionalString(req.body.role) ?? item.role ?? null,
      bio: pickOptionalString(req.body.bio) ?? item.bio ?? null,
      photoMediaId: pickOptionalString(req.body.photoMediaId) ?? item.photoMediaId ?? null,
      socials: Array.isArray(req.body.socials)
        ? req.body.socials.filter((x) => x && typeof x === 'object').map((x) => ({ platform: pickString(x.platform), url: pickString(x.url) }))
        : item.socials ?? [],
      updatedAt: nowIso(),
    };
    items[idx] = next;
    await db.writeTable('contributors', items);
    res.json({ ok: true, item: next });
  });

  router.delete('/contributors/:id', adminOnly, async (req, res) => {
    const all = await db.readTable('contributors');
    const items = Array.isArray(all) ? all : [];
    const { idx } = findById(items, req.params.id);
    if (idx < 0) return jsonError(res, 404, 'Not found');
    items.splice(idx, 1);
    await db.writeTable('contributors', items);
    res.json({ ok: true });
  });

  router.get('/navigation-menu', async (_req, res) => {
    const all = await db.readTable('navigationMenu');
    const items = Array.isArray(all) ? all : [];
    res.json({ ok: true, items: items.slice().sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0)) });
  });

  router.put('/navigation-menu', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items) return jsonError(res, 400, 'items must be an array');
    const normalized = items
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({
        id: typeof x.id === 'string' ? x.id : createId('nav'),
        label: pickString(x.label),
        path: pickString(x.path),
        order: Number.isFinite(Number(x.order)) ? Number(x.order) : 0,
        visible: typeof x.visible === 'boolean' ? x.visible : true,
        updatedAt: nowIso(),
      }))
      .filter((x) => x.label && x.path);
    await db.writeTable('navigationMenu', normalized);
    res.json({ ok: true, items: normalized });
  });

  router.get('/site-settings', async (_req, res) => {
    const record = await db.readTable('siteSettings');
    res.json({ ok: true, item: record });
  });

  router.put('/site-settings', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const record = await db.readTable('siteSettings');
    const next = {
      id: 'site',
      updatedAt: nowIso(),
      data: typeof req.body.data === 'object' && req.body.data !== null ? req.body.data : record?.data ?? {},
    };
    await db.writeTable('siteSettings', next);
    res.json({ ok: true, item: next });
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

    const tablePlan = [
      { table: 'lectures', type: 'lecture', titleKey: 'title' },
      { table: 'events', type: 'event', titleKey: 'title' },
      { table: 'media', type: 'media', titleKey: 'title' },
      { table: 'publications', type: 'publication', titleKey: 'title' },
      { table: 'pressReleases', type: 'pressRelease', titleKey: 'title' },
      { table: 'gallery', type: 'gallery', titleKey: 'title' },
      { table: 'contributors', type: 'contributor', titleKey: 'name' },
    ];

    const results = [];
    for (const plan of tablePlan) {
      if (requested && !requested.has(plan.table)) continue;
      const all = await db.readTable(plan.table);
      const items = Array.isArray(all) ? all : [];
      for (const item of items) {
        const text = getTextIndex(item);
        if (!matchesQuery(text, q)) continue;
        const title = typeof item?.[plan.titleKey] === 'string' ? item[plan.titleKey] : '';
        results.push({
          type: plan.type,
          id: item?.id,
          title,
          score: scoreMatch(`${title} ${text}`, q),
          updatedAt: typeof item?.updatedAt === 'string' ? item.updatedAt : null,
        });
      }
    }

    results.sort((a, b) => (b.score - a.score) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    res.json({ ok: true, q, items: results.slice(0, limit) });
  });

  router.post('/import/:table', adminOnly, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    const table = normalizeTableName(req.params.table);
    if (!table || table === 'siteSettings') return jsonError(res, 400, 'Invalid table');
    const mode = pickString(req.body.mode) || 'append';
    const incoming = Array.isArray(req.body.items) ? req.body.items : null;
    if (!incoming) return jsonError(res, 400, 'items must be an array');
    const existing = await db.readTable(table);
    const current = Array.isArray(existing) ? existing : [];

    if (mode === 'replace') {
      const normalized = incoming.filter((x) => x && typeof x === 'object').map((x) => ({ ...x, id: typeof x.id === 'string' ? x.id : createId(table.slice(0, 3)), updatedAt: nowIso() }));
      await db.writeTable(table, normalized);
      res.json({ ok: true, table, mode, inserted: normalized.length, updated: 0 });
      return;
    }

    let inserted = 0;
    let updated = 0;
    const next = current.slice();
    for (const raw of incoming) {
      if (!raw || typeof raw !== 'object') continue;
      const id = typeof raw.id === 'string' ? raw.id : createId(table.slice(0, 3));
      const { idx } = findById(next, id);
      if (idx < 0) {
        next.push({ ...raw, id, createdAt: nowIso(), updatedAt: nowIso() });
        inserted += 1;
        continue;
      }
      if (mode === 'upsert') {
        next[idx] = { ...next[idx], ...raw, id, updatedAt: nowIso() };
        updated += 1;
      } else {
        next.push({ ...raw, id, createdAt: nowIso(), updatedAt: nowIso() });
        inserted += 1;
      }
    }
    await db.writeTable(table, next);
    res.json({ ok: true, table, mode, inserted, updated });
  });

  return router;
}

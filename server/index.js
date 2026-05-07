import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminAuth } from './lib/adminAuth.js';
import { createDb } from './lib/db.js';
import { initDb } from './lib/postgres.js';
import { createV1Router } from './routes/v1.js';
import { createSocialRouter } from './routes/social.js';
import { createQARouter } from './routes/qa.js';
import { createAuthRouter } from './routes/auth.js';
import { createChatbotRouter } from './routes/chatbot.js';
import { createMediaRouter } from './routes/media.js';
import { securityHeaders, globalLimiter } from './middleware/security.js';

dotenv.config();

// Initialize Database
initDb().catch(console.error);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.resolve(__dirname, 'db');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');

const app = express();

// Security Middleware
app.use(securityHeaders);
app.use(globalLimiter);

app.use(
  cors({
    origin: true,
    credentials: false,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { fallthrough: true }));

// Serve static frontend assets
const DIST_DIR = path.resolve(__dirname, '../dist');
app.use(express.static(DIST_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const adminAuth = createAdminAuth({ dataDir: DATA_DIR, envPasscode: process.env.ADMIN_PASSCODE });
const db = createDb({ dataDir: DATA_DIR });

app.use('/api/v1', createV1Router({ db, verifyAdminPasscode: adminAuth.verifyAdminPasscode, uploadsDir: UPLOADS_DIR }));
app.use('/api/auth', createAuthRouter());
app.use('/api/social', createSocialRouter());
app.use('/api/qa', createQARouter());
app.use('/api/chatbot', createChatbotRouter());
app.use('/api/media', createMediaRouter({ uploadsDir: UPLOADS_DIR }));

app.get('/api/content', async (_req, res) => {
  try {
    const record = await db.readTable('siteSettings');
    // Map the record to the expected 'content' structure
    res.json({ ok: true, content: record || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

app.put('/api/content', async (req, res) => {
  const passcode = String(req.header('x-admin-passcode') || '');
  if (!(await adminAuth.verifyAdminPasscode(passcode))) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  if (typeof req.body !== 'object' || req.body === null) {
    res.status(400).json({ ok: false, error: 'Invalid body' });
    return;
  }

  try {
    // Save to the 'site_settings' table in Postgres
    await db.writeTable('siteSettings', req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

app.put('/api/admin/passcode', async (req, res) => {
  res.status(400).json({ 
    ok: false, 
    error: 'Passcode rotation is disabled in Serverless mode. Please update the ADMIN_PASSCODE variable in your Vercel dashboard.' 
  });
});

// SPA Fallback: Serve index.html for any unknown non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

if (process.env.NODE_ENV !== 'test' && process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`[content-api] listening on :${PORT}`);
  });
}

export default app;


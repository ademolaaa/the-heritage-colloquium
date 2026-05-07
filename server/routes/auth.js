import express from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { db } from '../lib/postgres.js';
import { createId, nowIso } from '../lib/jsonStore.js';
import { jsonError, requireObjectBody } from '../lib/http.js';
import { generateToken, hashPassword, verifyPassword, requireAuth } from '../lib/userAuth.js';
import { authLimiter } from '../middleware/security.js';
import { logAudit } from '../lib/audit.js';

function checkPasswordStrength(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength || !hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    return false;
  }
  return true;
}

export function createAuthRouter() {
  const router = express.Router();

  // POST /register - Create a new user account
  router.post('/register', authLimiter, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');

    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const username = req.body.username?.trim();
    const fullName = req.body.fullName?.trim();

    if (!email || !password || !username) {
      return jsonError(res, 400, 'Email, password, and username are required');
    }

    if (!checkPasswordStrength(password)) {
      return jsonError(res, 400, 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
    }

    try {
      const existing = await db.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [email, username]
      );
      if (existing.rowCount > 0) {
        return jsonError(res, 409, 'User already exists');
      }

      const id = createId('usr');
      const passwordHash = await hashPassword(password);
      const now = nowIso();

      await db.query(
        `INSERT INTO users (id, email, password_hash, username, full_name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'user', $6, $6)`,
        [id, email, passwordHash, username, fullName || null, now]
      );

      logAudit(id, 'user.register', req, { email });

      const user = { id, email, username, role: 'user' };
      const token = generateToken(user);

      res.status(201).json({ ok: true, token, user });
    } catch (err) {
      console.error('Registration failed:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // POST /login - Authenticate user
  router.post('/login', authLimiter, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');

    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const twoFactorToken = req.body.token; // TOTP token

    if (!email || !password) {
      return jsonError(res, 400, 'Email and password are required');
    }

    try {
      const result = await db.query(
        'SELECT id, email, password_hash, username, role, two_factor_enabled, two_factor_secret FROM users WHERE email = $1',
        [email]
      );

      if (result.rowCount === 0) {
        // Log failed attempt (generic user)
        logAudit(null, 'user.login_failed', req, { email, reason: 'user_not_found' });
        return jsonError(res, 401, 'Invalid credentials');
      }

      const user = result.rows[0];
      const isValid = await verifyPassword(password, user.password_hash);

      if (!isValid) {
        logAudit(user.id, 'user.login_failed', req, { reason: 'bad_password' });
        return jsonError(res, 401, 'Invalid credentials');
      }

      // Check 2FA
      if (user.two_factor_enabled) {
        if (!twoFactorToken) {
          return res.status(403).json({ ok: false, error: '2FA required', require2fa: true });
        }

        const verified = speakeasy.totp.verify({
          secret: user.two_factor_secret,
          encoding: 'base32',
          token: twoFactorToken
        });

        if (!verified) {
          logAudit(user.id, 'user.login_failed', req, { reason: 'bad_2fa' });
          return jsonError(res, 401, 'Invalid 2FA token');
        }
      }

      logAudit(user.id, 'user.login_success', req);

      const token = generateToken({ id: user.id, email: user.email, username: user.username, role: user.role });
      
      delete user.password_hash;
      delete user.two_factor_secret;
      
      res.json({ ok: true, token, user });
    } catch (err) {
      console.error('Login failed:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // POST /2fa/setup - Generate secret
  router.post('/2fa/setup', requireAuth, async (req, res) => {
    try {
      const secret = speakeasy.generateSecret({ length: 20, name: `HeritageColloquium (${req.user.email})` });
      
      // Save secret temporarily (or permanently but not enabled)
      await db.query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [secret.base32, req.user.id]);

      const dataUrl = await QRCode.toDataURL(secret.otpauth_url);
      
      res.json({ ok: true, secret: secret.base32, qrCode: dataUrl });
    } catch (err) {
      console.error('2FA setup failed:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // POST /2fa/verify - Enable 2FA
  router.post('/2fa/verify', requireAuth, async (req, res) => {
    const { token } = req.body;
    if (!token) return jsonError(res, 400, 'Token required');

    try {
      const result = await db.query('SELECT two_factor_secret FROM users WHERE id = $1', [req.user.id]);
      const user = result.rows[0];

      if (!user || !user.two_factor_secret) {
        return jsonError(res, 400, '2FA setup not initiated');
      }

      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token
      });

      if (verified) {
        await db.query('UPDATE users SET two_factor_enabled = TRUE WHERE id = $1', [req.user.id]);
        logAudit(req.user.id, 'user.2fa_enabled', req);
        res.json({ ok: true });
      } else {
        res.status(400).json({ ok: false, error: 'Invalid token' });
      }
    } catch (err) {
      console.error('2FA verify failed:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  // GET /me - Get current user profile
  router.get('/me', requireAuth, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT id, email, username, full_name, avatar_url, role, two_factor_enabled, created_at FROM users WHERE id = $1',
        [req.user.id]
      );

      if (result.rowCount === 0) {
        return jsonError(res, 404, 'User not found');
      }

      res.json({ ok: true, user: result.rows[0] });
    } catch (err) {
      console.error('Fetch profile failed:', err);
      jsonError(res, 500, 'Internal Server Error');
    }
  });

  return router;
}

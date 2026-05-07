import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export function createAdminAuth({ dataDir, envPasscode }) {
  const adminFile = path.join(dataDir, 'admin.json');

  async function readAdminRecord() {
    const raw = await fs.readFile(adminFile, 'utf8').catch(() => '');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const salt = typeof parsed.salt === 'string' ? parsed.salt : '';
    const hash = typeof parsed.hash === 'string' ? parsed.hash : '';
    const keylen = typeof parsed.keylen === 'number' ? parsed.keylen : 64;
    if (!salt || !hash || !Number.isFinite(keylen) || keylen <= 0) return null;
    const saltBuf = Buffer.from(salt, 'base64');
    const hashBuf = Buffer.from(hash, 'base64');
    if (saltBuf.length === 0 || hashBuf.length === 0) return null;
    return { saltBuf, hashBuf, keylen };
  }

  async function writeAdminRecord(passcode) {
    const saltBuf = crypto.randomBytes(16);
    const keylen = 64;
    const hashBuf = crypto.scryptSync(passcode, saltBuf, keylen);
    const payload = {
      v: 1,
      algo: 'scrypt',
      salt: saltBuf.toString('base64'),
      hash: hashBuf.toString('base64'),
      keylen,
    };
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(adminFile, JSON.stringify(payload, null, 2), 'utf8');
    return { saltBuf, hashBuf, keylen };
  }

  async function getAdminRecord() {
    await fs.mkdir(dataDir, { recursive: true });
    if (String(process.env.ADMIN_PASSCODE_RESET || '') === '1') {
      const resetTo = String(envPasscode || 'heritage-admin');
      return await writeAdminRecord(resetTo);
    }
    const existing = await readAdminRecord();
    if (existing) return existing;
    const initial = String(envPasscode || 'heritage-admin');
    return await writeAdminRecord(initial);
  }

  async function verifyAdminPasscode(passcode) {
    const record = await getAdminRecord();
    const candidate = crypto.scryptSync(String(passcode), record.saltBuf, record.keylen);
    if (candidate.length !== record.hashBuf.length) return false;
    return crypto.timingSafeEqual(candidate, record.hashBuf);
  }

  async function rotatePasscode(currentPasscode, nextPasscode) {
    if (!(await verifyAdminPasscode(currentPasscode))) {
      return { ok: false, error: 'Unauthorized' };
    }
    const next = String(nextPasscode || '').trim();
    if (next.length < 8) return { ok: false, error: 'New passcode must be at least 8 characters' };
    if (next.length > 128) return { ok: false, error: 'New passcode is too long' };
    if (next === String(currentPasscode || '')) return { ok: false, error: 'New passcode must be different' };
    await writeAdminRecord(next);
    return { ok: true };
  }

  return { verifyAdminPasscode, rotatePasscode };
}

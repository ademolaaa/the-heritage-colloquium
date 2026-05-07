import { db } from './postgres.js';
import { createId } from './jsonStore.js';

export async function logAudit(userId, action, req, details = {}) {
  try {
    const id = createId('aud');
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await db.query(
      `INSERT INTO audit_logs (id, user_id, action, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, userId || null, action, ip, userAgent, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
    // Don't throw, just log error so main flow isn't interrupted
  }
}

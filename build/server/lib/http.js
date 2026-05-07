export function parseLimit(value, fallback = 50, max = 200) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export function parseOffset(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function jsonError(res, status, message) {
  res.status(status).json({ ok: false, error: message });
}

export function requireObjectBody(req) {
  return typeof req.body === 'object' && req.body !== null;
}


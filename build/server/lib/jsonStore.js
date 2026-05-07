import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJsonFile(filePath, fallbackValue) {
  const raw = await fs.readFile(filePath, 'utf8').catch(() => '');
  if (!raw) return fallbackValue;
  return JSON.parse(raw);
}

export async function writeJsonFileAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tempPath = path.join(dir, `.tmp-${path.basename(filePath)}-${crypto.randomUUID()}`);
  const payload = JSON.stringify(value, null, 2);
  await fs.writeFile(tempPath, payload, 'utf8');
  await fs.rename(tempPath, filePath);
}

export function createId(prefix) {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function nowIso() {
  return new Date().toISOString();
}


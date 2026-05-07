import * as ftp from 'basic-ftp';
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distDir = path.join(rootDir, 'dist');
const apiDir = path.join(rootDir, 'api');
const uploadDir = path.join(rootDir, 'domainking_upload');

const FTP_HOST = process.env.DK_FTP_HOST;
const FTP_USER = process.env.DK_FTP_USER;
const FTP_PASS = process.env.DK_FTP_PASS;
const FTP_REMOTE_DIR = process.env.DK_FTP_REMOTE_DIR;
const FTP_PORT = Number(process.env.DK_FTP_PORT || '21');
const FTP_SECURE = String(process.env.DK_FTP_SECURE || '').toLowerCase() === 'true';
const FTP_INSECURE_TLS = String(process.env.DK_FTP_INSECURE_TLS || '').toLowerCase() === 'true';

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest, { ignoreFileNames = [] } = {}) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreFileNames.includes(entry.name)) continue;
    
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDir(from, to, { ignoreFileNames });
      continue;
    }
    
    if (entry.isFile()) {
      await cp(from, to, { force: true });
    }
  }
}

async function prepareFiles() {
  console.log('🧹 Cleaning previous upload folder...');
  await rm(uploadDir, { recursive: true, force: true });
  await mkdir(uploadDir, { recursive: true });

  console.log('📂 Copying frontend files (dist) to root...');
  if (await exists(distDir)) {
    await copyDir(distDir, uploadDir);
  } else {
    throw new Error('❌ Missing dist/ folder. Run "npm run build:local" first.');
  }

  console.log('📂 Copying backend files (api) to /api...');
  if (await exists(apiDir)) {
    await copyDir(apiDir, path.join(uploadDir, 'api'), {
      ignoreFileNames: ['config.php', 'node_modules', '.git']
    });
  } else {
    console.warn('⚠️ api/ folder not found, skipping backend copy.');
  }

  // Ensure uploads directory exists for PHP
  const uploadsDir = path.join(uploadDir, 'uploads');
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, '.htaccess'), 'Options -Indexes\n', { encoding: 'utf8' });
}

function requiredEnv(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function ensureRemoteDir(client, preferred) {
  const candidates = [
    preferred,
    '/domains/ahiajoku.gov.ng/public_html',
    '/domains/ahiajoku.gov.ng',
    '/home/ahiajoku/domains/ahiajoku.gov.ng/public_html',
    '/home/ahiajoku/domains/ahiajoku.gov.ng',
    '/public_html',
    '/',
  ].filter(Boolean);

  const tried = new Set();
  for (const dir of candidates) {
    const normalized = dir.endsWith('/') ? dir.slice(0, -1) : dir;
    if (tried.has(normalized)) continue;
    tried.add(normalized);
    try {
      await client.ensureDir(normalized);
      return normalized;
    } catch {}
  }
  return preferred;
}

async function uploadFiles() {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  try {
    const host = requiredEnv('DK_FTP_HOST', FTP_HOST);
    const user = requiredEnv('DK_FTP_USER', FTP_USER);
    const pass = requiredEnv('DK_FTP_PASS', FTP_PASS);
    const preferredRemoteDir = requiredEnv('DK_FTP_REMOTE_DIR', FTP_REMOTE_DIR);

    console.log(`🚀 Connecting to FTP host: ${host}...`);
    await client.access({
      host,
      user,
      password: pass,
      port: FTP_PORT,
      secure: FTP_SECURE,
      secureOptions: FTP_SECURE && FTP_INSECURE_TLS ? { rejectUnauthorized: false } : undefined
    });
    
    const remoteDir = await ensureRemoteDir(client, preferredRemoteDir);
    console.log(`📂 Using remote directory: ${remoteDir}...`);
    
    console.log('📤 Uploading files...');
    await client.uploadFromDir(uploadDir);
    
    console.log('✅ Upload complete!');
  } catch (err) {
    console.error('❌ FTP Upload failed:', err);
    throw err;
  } finally {
    client.close();
  }
}

async function main() {
  await prepareFiles();
  await uploadFiles();
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});

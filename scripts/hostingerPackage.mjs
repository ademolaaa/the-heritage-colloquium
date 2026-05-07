import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const apiDir = path.join(rootDir, 'api');
const outDir = path.join(rootDir, 'hostinger_upload');
const zipPath = path.join(rootDir, 'hostinger_upload.zip');
const wantZip = process.argv.includes('--zip');

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

async function main() {
  if (!(await exists(distDir))) {
    throw new Error('Missing dist/. Run `npm run build:local` first.');
  }
  if (!(await exists(apiDir))) {
    throw new Error('Missing api/ folder.');
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await copyDir(distDir, outDir);
  await copyDir(apiDir, path.join(outDir, 'api'), { ignoreFileNames: ['config.php'] });

  const configExample = path.join(outDir, 'api', 'config.example.php');
  if (!(await exists(configExample))) {
    throw new Error('Missing api/config.example.php in output package.');
  }

  if (!wantZip) return;

  if (process.platform !== 'win32') {
    throw new Error('ZIP packaging is only implemented for Windows in this project. Upload hostinger_upload/ as a folder, or zip it manually.');
  }

  await rm(zipPath, { force: true }).catch(() => {});

  await new Promise((resolve, reject) => {
    const args = [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Force -Path "${outDir}\\*" -DestinationPath "${zipPath}"`,
    ];
    const child = spawn('powershell', args, { stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Compress-Archive failed (${code})`))));
    child.on('error', reject);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

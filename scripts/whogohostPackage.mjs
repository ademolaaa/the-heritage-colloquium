import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distDir = path.join(rootDir, 'dist');
const apiDir = path.join(rootDir, 'api');
const outDir = path.join(rootDir, 'whogohost_upload');
const zipPath = path.join(rootDir, 'whogohost_package.zip');

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
  console.log('📦 Starting Whogohost packaging...');
  
  if (!(await exists(distDir))) {
    console.error('❌ Missing dist/ directory. Please run "npm run build:local" first.');
    process.exit(1);
  }
  
  if (!(await exists(apiDir))) {
    console.error('❌ Missing api/ directory.');
    process.exit(1);
  }

  // Clean previous build
  console.log('🧹 Cleaning previous build...');
  await rm(outDir, { recursive: true, force: true });
  if (wantZip) {
    await rm(zipPath, { force: true }).catch(() => {});
  }
  
  await mkdir(outDir, { recursive: true });

  // Copy Frontend (dist) to root
  console.log('📂 Copying frontend files...');
  await copyDir(distDir, outDir);

  // Copy Backend (api) to /api
  console.log('📂 Copying backend files...');
  await copyDir(apiDir, path.join(outDir, 'api'), { 
    ignoreFileNames: ['config.php', 'node_modules', '.git'] 
  });

  // Ensure config.example.php exists
  const configExample = path.join(outDir, 'api', 'config.example.php');
  if (!(await exists(configExample))) {
    console.warn('⚠️ Warning: api/config.example.php is missing. You may need to create config.php manually on the server.');
  }

  if (wantZip) {
    console.log('compressing to zip...');
    if (process.platform === 'win32') {
       // PowerShell Compress-Archive
       const psCommand = `Compress-Archive -Force -Path "${outDir}\\*" -DestinationPath "${zipPath}"`;
       const child = spawn('powershell', ['-NoProfile', '-Command', psCommand], { stdio: 'inherit' });
       
       await new Promise((resolve, reject) => {
         child.on('exit', (code) => {
           if (code === 0) {
             console.log(`✅ Package created successfully: ${zipPath}`);
             resolve();
           } else {
             reject(new Error(`Compress-Archive failed with code ${code}`));
           }
         });
         child.on('error', reject);
       });
    } else {
       console.log('⚠️ ZIP creation is only supported on Windows automatically. Please zip the "whogohost_upload" folder manually.');
    }
  } else {
    console.log(`✅ Files ready in: ${outDir}`);
  }
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

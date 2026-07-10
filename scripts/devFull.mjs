import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(label, args) {
  const child = spawn(npm, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    if (typeof code === 'number' && code !== 0) process.exit(code);
  });
  return child;
}

const vite = run('vite', ['run', 'dev']);
const server = run('server', ['run', 'dev:server']);

function shutdown(signal) {
  vite.kill(signal);
  server.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));


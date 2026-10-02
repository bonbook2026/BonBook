import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) child.kill();
}

function start(directory, entry, args) {
  const child = spawn(process.execPath, [path.join(root, directory, entry), ...args], {
    cwd: path.join(root, directory),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0);
  });
}

start('server', 'node_modules/ts-node-dev/lib/bin.js', [
  '--respawn', '--transpile-only', 'src/local.ts',
]);
start('client', 'node_modules/vite/bin/vite.js', [
  '--host', '127.0.0.1', '--port', '5173', '--strictPort',
]);

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

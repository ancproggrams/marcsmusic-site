import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('production entrypoint persists API writes through SQLite', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'marcsmusic-sql-entrypoint-'));
  const port = await reservePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('../', import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      BOOKING_DB_PATH: join(directory, 'legacy.json'),
      BOOKING_SQLITE_PATH: join(directory, 'bookings.sqlite'),
      TRANSPARANTE_BROKER_SYNC_ENABLED: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  t.after(async () => {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await rm(directory, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitUntilReady(baseUrl, child, () => stderr);
  assert.equal((await fetch(`${baseUrl}/api/health/live`)).status, 200);
  const readiness = await fetch(`${baseUrl}/api/health/ready`);
  assert.equal(readiness.status, 503);
  assert.equal((await readiness.json()).storageReady, true);
  const write = await fetch(`${baseUrl}/api/tracks/plays`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trackId: 'man-den-man' })
  });
  assert.equal(write.status, 200);
  assert.equal((await write.json()).plays, 1);
  const read = await fetch(`${baseUrl}/api/tracks/plays`);
  assert.equal(read.status, 200);
  assert.equal((await read.json()).plays['man-den-man'], 1);
});

async function waitUntilReady(baseUrl, child, stderr) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early: ${stderr()}`);
    const response = await fetch(`${baseUrl}/api/health`).catch(() => null);
    if (response?.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error(`server did not become ready: ${stderr()}`);
}

async function reservePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

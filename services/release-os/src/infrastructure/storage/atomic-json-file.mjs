import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, resolve } from "node:path";

const DEFAULT_LOCK_TIMEOUT_MS = 10_000;
const DEFAULT_LOCK_LEASE_MS = 15_000;
const PROCESS_INSTANCE_ID = randomUUID();
const PROCESS_STARTED_AT = new Date(Date.now() - process.uptime() * 1_000).toISOString();
const queues = new Map();

export function withExclusiveFileMutation(filePath, work, options = {}) {
  if (typeof work !== "function") throw new TypeError("file mutation work must be a function");
  const canonicalPath = resolve(filePath);
  const previous = queues.get(canonicalPath) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const lock = await acquireFileLock(canonicalPath, options);
    try {
      await lock.assertOwned();
      const result = await work(lock);
      await lock.assertOwned();
      return result;
    } finally {
      await lock.release();
    }
  });
  queues.set(canonicalPath, next);
  void next.finally(() => {
    if (queues.get(canonicalPath) === next) queues.delete(canonicalPath);
  }).catch(() => {});
  return next;
}

export async function writeJsonAtomically(filePath, value, options = {}) {
  const destinationPath = resolve(filePath);
  const directoryPath = dirname(destinationPath);
  await mkdir(directoryPath, { recursive: true, mode: 0o700 });
  const temporaryPath = `${destinationPath}.${process.pid}.${randomUUID()}.tmp`;
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  let handle;
  try {
    handle = await open(
      temporaryPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0),
      0o600
    );
    await handle.writeFile(serialized, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await options.assertLease?.();
    await rename(temporaryPath, destinationPath);
    const directoryHandle = await open(directoryPath, fsConstants.O_RDONLY).catch(() => undefined);
    if (directoryHandle) {
      await directoryHandle.sync().catch(() => {});
      await directoryHandle.close().catch(() => {});
    }
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

export async function readJsonFile(filePath) {
  return JSON.parse(await readFile(resolve(filePath), "utf8"));
}

async function acquireFileLock(filePath, options) {
  const lockPath = `${filePath}.lock`;
  const timeoutMs = positiveInteger(options.lockTimeoutMs, DEFAULT_LOCK_TIMEOUT_MS);
  const leaseMs = positiveInteger(options.lockLeaseMs, DEFAULT_LOCK_LEASE_MS);
  const startedAt = Date.now();
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });

  while (true) {
    const token = randomUUID();
    let handle;
    let created = false;
    try {
      handle = await open(lockPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
      created = true;
      await handle.writeFile(`${JSON.stringify({
        token,
        pid: process.pid,
        hostname: hostname(),
        processInstanceId: PROCESS_INSTANCE_ID,
        processStartedAt: PROCESS_STARTED_AT,
        createdAt: new Date().toISOString(),
        leaseMs
      })}\n`, "utf8");
      await handle.sync();
      const heartbeat = setInterval(() => {
        const timestamp = new Date();
        void handle.utimes(timestamp, timestamp).catch(() => {});
      }, Math.max(25, Math.floor(leaseMs / 3)));
      heartbeat.unref?.();
      return {
        async assertOwned() {
          const owner = await readLockOwner(lockPath);
          if (owner?.token !== token || owner?.processInstanceId !== PROCESS_INSTANCE_ID) {
            throw Object.assign(new Error(`File lock lease was lost: ${lockPath}`), {
              code: "FILE_LOCK_LEASE_LOST",
              statusCode: 503,
              retryable: true
            });
          }
        },
        async release() {
          clearInterval(heartbeat);
          await handle.close().catch(() => {});
          const owner = await readLockOwner(lockPath);
          if (owner?.token === token) await unlink(lockPath).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
      };
    } catch (error) {
      await handle?.close().catch(() => {});
      if (created) await unlink(lockPath).catch(() => {});
      if (error.code !== "EEXIST") throw error;
      await recoverExpiredLock(lockPath, leaseMs);
      if (Date.now() - startedAt >= timeoutMs) {
        throw Object.assign(new Error(`Timed out waiting for file lock: ${lockPath}`), {
          code: "FILE_LOCK_TIMEOUT",
          statusCode: 503,
          retryable: true
        });
      }
      await delay(10 + Math.floor(Math.random() * 31));
    }
  }
}

async function recoverExpiredLock(lockPath, leaseMs) {
  const recoveryPath = `${lockPath}.recovery`;
  let recoveryHandle;
  try {
    recoveryHandle = await open(recoveryPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      const metadata = await lstat(recoveryPath).catch(() => undefined);
      if (metadata && Date.now() - metadata.mtimeMs > leaseMs) await unlink(recoveryPath).catch(() => {});
      return;
    }
    throw error;
  }

  try {
    const snapshot = await readLockSnapshot(lockPath);
    if (!isExpired(snapshot, leaseMs)) return;
    const current = await readLockSnapshot(lockPath);
    if (
      current?.owner?.token === snapshot.owner.token &&
      current.stat.dev === snapshot.stat.dev &&
      current.stat.ino === snapshot.stat.ino &&
      current.stat.mtimeMs === snapshot.stat.mtimeMs &&
      isExpired(current, leaseMs)
    ) await unlink(lockPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  } finally {
    await recoveryHandle.close().catch(() => {});
    await unlink(recoveryPath).catch(() => {});
  }
}

async function readLockSnapshot(lockPath) {
  try {
    const [owner, stat] = await Promise.all([readLockOwner(lockPath), lstat(lockPath)]);
    return owner ? { owner, stat } : undefined;
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

function isExpired(snapshot, fallbackLeaseMs) {
  if (!snapshot) return false;
  const declaredLease = positiveInteger(snapshot.owner.leaseMs, fallbackLeaseMs);
  return Date.now() - snapshot.stat.mtimeMs > declaredLease;
}

async function readLockOwner(lockPath) {
  try {
    const raw = await readFile(lockPath, "utf8");
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : undefined;
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

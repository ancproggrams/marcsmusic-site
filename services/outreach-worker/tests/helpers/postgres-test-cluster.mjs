import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import pg from "pg";

const execFileAsync = promisify(execFile);
const { Pool } = pg;

export async function startPostgresTestCluster() {
  const rootDirectory = await mkdtemp(join(tmpdir(), "marcsmusic-outreach-pg-"));
  const dataDirectory = join(rootDirectory, "data");
  const logFile = join(rootDirectory, "postgres.log");
  const port = await reservePort();
  let started = false;

  try {
    await run("initdb", [
      "--pgdata", dataDirectory,
      "--username", "postgres",
      "--auth-local", "trust",
      "--auth-host", "trust",
      "--encoding", "UTF8",
      "--no-locale"
    ]);
    await run("pg_ctl", [
      "--pgdata", dataDirectory,
      "--log", logFile,
      "--options", `-p ${port} -h 127.0.0.1 -F -c fsync=off -c synchronous_commit=off -c full_page_writes=off`,
      "--wait",
      "start"
    ]);
    started = true;
  } catch (error) {
    error.message = `${error.message}\nPostgreSQL log:\n${await readFile(logFile, "utf8").catch(() => "<not created>")}`;
    await rm(rootDirectory, { recursive: true, force: true });
    throw error;
  }

  const adminUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  const adminPool = new Pool({ connectionString: adminUrl, max: 2 });

  return Object.freeze({
    async createDatabase() {
      const databaseName = `outreach_test_${randomUUID().replaceAll("-", "")}`;
      await adminPool.query(`CREATE DATABASE ${databaseName}`);
      const url = `postgresql://postgres@127.0.0.1:${port}/${databaseName}`;
      return Object.freeze({ databaseName, url });
    },

    async stop() {
      await adminPool.end().catch(() => {});
      if (started) {
        await run("pg_ctl", ["--pgdata", dataDirectory, "--mode", "immediate", "--wait", "stop"]).catch(() => {});
        started = false;
      }
      await rm(rootDirectory, { recursive: true, force: true });
    }
  });
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : undefined;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("Failed to reserve a PostgreSQL test port");
  return port;
}

async function run(command, args) {
  return execFileAsync(command, args, { timeout: 30_000, maxBuffer: 1024 * 1024 });
}

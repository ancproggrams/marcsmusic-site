import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { ApplicationError } from "../errors.mjs";

const { Pool } = pg;
const migrationDirectory = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), "migrations");
const DEFAULT_DATABASE_LIMITS = Object.freeze({
  poolMax: 10,
  statementTimeoutMs: 15_000,
  queryTimeoutMs: 20_000,
  lockTimeoutMs: 2_000,
  idleInTransactionTimeoutMs: 20_000,
  advisoryLockTimeoutMs: 5_000,
  advisoryLockRetryMs: 50
});

export function createPostgresPool(config) {
  const limits = databaseLimits(config);
  return new Pool({
    connectionString: config.url,
    ssl: config.ssl ? { rejectUnauthorized: true } : false,
    max: limits.poolMax,
    min: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    maxUses: 7_500,
    application_name: "marcsmusic-outreach-worker",
    statement_timeout: limits.statementTimeoutMs,
    query_timeout: limits.queryTimeoutMs,
    lock_timeout: limits.lockTimeoutMs,
    idle_in_transaction_session_timeout: limits.idleInTransactionTimeoutMs,
    outreachAdvisoryLockTimeoutMs: limits.advisoryLockTimeoutMs,
    outreachAdvisoryLockRetryMs: limits.advisoryLockRetryMs
  });
}

export async function runMigrations(pool, directory = migrationDirectory, options = {}) {
  const client = await pool.connect();
  const limits = databaseLimits(pool.options ?? {});
  let locked = false;
  try {
    await acquireSessionAdvisoryLock(client, "marcsmusic-outreach-migrations", limits);
    locked = true;
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      checksum char(64),
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query("ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum char(64)");
    const files = (await readdir(directory)).filter((name) => /^\d+_.+\.sql$/u.test(name)).sort();
    for (const file of files) {
      const sql = await readFile(join(directory, file), "utf8");
      const checksum = createHash("sha256").update(sql, "utf8").digest("hex");
      const existing = await client.query("SELECT checksum FROM schema_migrations WHERE version = $1", [file]);
      if (existing.rowCount) {
        const recorded = existing.rows[0].checksum;
        if (recorded === checksum) continue;
        if (recorded) {
          throw migrationError("POSTGRES_MIGRATION_CHECKSUM_MISMATCH", `Applied migration ${file} differs from its recorded checksum`);
        }
        if (!checksumBaselineAllowed(options)) {
          throw migrationError(
            "POSTGRES_MIGRATION_CHECKSUM_BASELINE_REQUIRED",
            `Applied migration ${file} has no checksum; perform the reviewed one-time checksum baseline`
          );
        }
        await client.query("UPDATE schema_migrations SET checksum=$2 WHERE version=$1 AND checksum IS NULL", [file, checksum]);
        continue;
      }
      if (isNonTransactionalMigration(sql)) {
        // PostgreSQL deliberately rejects CREATE INDEX CONCURRENTLY inside a
        // transaction. The session advisory lock still serializes deploys and
        // every non-transactional migration must therefore be replay-safe.
        assertSingleSqlStatement(sql, file);
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version,checksum) VALUES ($1,$2)", [file, checksum]);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version,checksum) VALUES ($1,$2)", [file, checksum]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    if (locked) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["marcsmusic-outreach-migrations"]).catch(() => {});
    }
    client.release();
  }
}

function checksumBaselineAllowed(options) {
  return options.allowChecksumBaseline === true
    || process.env.OUTREACH_MIGRATION_CHECKSUM_BASELINE_CONFIRM === "reviewed-historical-migration-baseline";
}

function isNonTransactionalMigration(sql) {
  const firstNonEmptyLine = String(sql)
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);
  return firstNonEmptyLine === "-- migration: no-transaction";
}

function assertSingleSqlStatement(sql, file) {
  const executable = stripSqlNonCode(sql);
  const fragments = executable.split(";").map((fragment) => fragment.trim()).filter(Boolean);
  if (fragments.length !== 1) {
    throw migrationError(
      "POSTGRES_NO_TRANSACTION_MIGRATION_INVALID",
      `No-transaction migration ${file} must contain exactly one SQL statement`
    );
  }
}

// Preserve only executable separators outside strings, quoted identifiers,
// comments and dollar-quoted bodies. PostgreSQL still receives the original
// byte-for-byte SQL; this scanner is solely a fail-closed statement-count gate.
function stripSqlNonCode(sql) {
  let result = "";
  let index = 0;
  let mode = "code";
  let dollarTag = "";
  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1];
    if (mode === "line-comment") {
      if (current === "\n") { mode = "code"; result += "\n"; }
      index += 1;
      continue;
    }
    if (mode === "block-comment") {
      if (current === "*" && next === "/") { mode = "code"; index += 2; } else index += 1;
      continue;
    }
    if (mode === "single-quote") {
      if (current === "'" && next === "'") index += 2;
      else if (current === "'") { mode = "code"; result += "x"; index += 1; }
      else index += 1;
      continue;
    }
    if (mode === "double-quote") {
      if (current === "\"" && next === "\"") index += 2;
      else if (current === "\"") { mode = "code"; result += "i"; index += 1; }
      else index += 1;
      continue;
    }
    if (mode === "dollar-quote") {
      if (sql.startsWith(dollarTag, index)) {
        mode = "code";
        result += "x";
        index += dollarTag.length;
      } else index += 1;
      continue;
    }
    if (current === "-" && next === "-") { mode = "line-comment"; index += 2; continue; }
    if (current === "/" && next === "*") { mode = "block-comment"; index += 2; continue; }
    if (current === "'") { mode = "single-quote"; index += 1; continue; }
    if (current === "\"") { mode = "double-quote"; index += 1; continue; }
    if (current === "$") {
      const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/u);
      if (match) {
        dollarTag = match[0];
        mode = "dollar-quote";
        index += dollarTag.length;
        continue;
      }
    }
    result += current;
    index += 1;
  }
  if (mode !== "code" && mode !== "line-comment") {
    throw migrationError("POSTGRES_NO_TRANSACTION_MIGRATION_INVALID", "No-transaction migration contains an unterminated SQL construct");
  }
  return result;
}

function migrationError(code, message) {
  return Object.assign(new Error(message), { code, retryable: false });
}

export async function checkPostgres(pool) {
  const result = await pool.query({ text: "SELECT 1 AS healthy", query_timeout: 2_000 });
  return result.rows[0]?.healthy === 1;
}

export async function checkIngressSchema(pool) {
  const result = await pool.query({
    text: `WITH required(relation_name) AS (
             VALUES
               ('schema_migrations'),
               ('encrypted_event_inbox'),
               ('work_items'),
               ('safety_state'),
               ('human_review_items'),
               ('source_identity_bindings'),
               ('source_identity_claims'),
               ('source_identity_claim_items')
           )
           SELECT COALESCE(array_agg(relation_name ORDER BY relation_name)
                    FILTER (WHERE to_regclass('public.' || relation_name) IS NULL), '{}') AS missing
           FROM required`,
    query_timeout: 2_000
  });
  const missing = Object.freeze([...(result.rows[0]?.missing ?? [])]);
  return Object.freeze({ ready: missing.length === 0, missing });
}

export async function withTransaction(pool, work, options = {}) {
  const client = await pool.connect();
  const limits = databaseLimits({ ...(pool.options ?? {}), ...options });
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT set_config('statement_timeout',$1,true),
              set_config('lock_timeout',$2,true),
              set_config('idle_in_transaction_session_timeout',$3,true)`,
      [
        `${limits.statementTimeoutMs}ms`,
        `${limits.lockTimeoutMs}ms`,
        `${limits.idleInTransactionTimeoutMs}ms`
      ]
    );
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw normalizePostgresError(error);
  } finally {
    client.release();
  }
}

export function databaseLimits(config = {}) {
  return Object.freeze({
    poolMax: boundedInteger(config.poolMax ?? config.max, DEFAULT_DATABASE_LIMITS.poolMax, 2, 50),
    statementTimeoutMs: boundedInteger(
      config.statementTimeoutMs ?? config.statement_timeout,
      DEFAULT_DATABASE_LIMITS.statementTimeoutMs,
      250,
      60_000
    ),
    queryTimeoutMs: boundedInteger(
      config.queryTimeoutMs ?? config.query_timeout,
      DEFAULT_DATABASE_LIMITS.queryTimeoutMs,
      500,
      65_000
    ),
    lockTimeoutMs: boundedInteger(
      config.lockTimeoutMs ?? config.lock_timeout,
      DEFAULT_DATABASE_LIMITS.lockTimeoutMs,
      50,
      10_000
    ),
    idleInTransactionTimeoutMs: boundedInteger(
      config.idleInTransactionTimeoutMs ?? config.idle_in_transaction_session_timeout,
      DEFAULT_DATABASE_LIMITS.idleInTransactionTimeoutMs,
      1_000,
      60_000
    ),
    advisoryLockTimeoutMs: boundedInteger(
      config.advisoryLockTimeoutMs ?? config.outreachAdvisoryLockTimeoutMs,
      DEFAULT_DATABASE_LIMITS.advisoryLockTimeoutMs,
      50,
      30_000
    ),
    advisoryLockRetryMs: boundedInteger(
      config.advisoryLockRetryMs ?? config.outreachAdvisoryLockRetryMs,
      DEFAULT_DATABASE_LIMITS.advisoryLockRetryMs,
      10,
      500
    )
  });
}

export async function acquireSessionAdvisoryLock(client, lockName, options = {}) {
  return acquireAdvisoryLock(client, lockName, { ...options, transaction: false });
}

export async function acquireTransactionAdvisoryLock(client, lockName, options = {}) {
  return acquireAdvisoryLock(client, lockName, { ...options, transaction: true });
}

async function acquireAdvisoryLock(client, lockName, options) {
  const limits = databaseLimits(options);
  const query = options.transaction
    ? "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired"
    : "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired";
  const deadline = Date.now() + limits.advisoryLockTimeoutMs;
  do {
    const result = await client.query(query, [lockName]);
    if (result.rows[0]?.acquired === true) return true;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(limits.advisoryLockRetryMs, remaining));
  } while (Date.now() <= deadline);

  throw new ApplicationError("PostgreSQL advisory lock acquisition timed out", {
    code: "POSTGRES_ADVISORY_LOCK_TIMEOUT",
    statusCode: 503,
    retryable: true
  });
}

function normalizePostgresError(error) {
  if (error instanceof ApplicationError) return error;
  const codeBySqlState = {
    "55P03": "POSTGRES_LOCK_TIMEOUT",
    "57014": "POSTGRES_STATEMENT_TIMEOUT",
    "25P03": "POSTGRES_IDLE_TRANSACTION_TIMEOUT"
  };
  const code = codeBySqlState[error?.code];
  if (!code) return error;
  return new ApplicationError("PostgreSQL operation exceeded its bounded execution policy", {
    code,
    statusCode: 503,
    retryable: true,
    cause: error
  });
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

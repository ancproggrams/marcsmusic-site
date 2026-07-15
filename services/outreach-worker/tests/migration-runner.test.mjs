import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runMigrations } from "../src/infrastructure/postgres.mjs";

test("migration runner records checksums and executes one-statement no-transaction files byte-for-byte", async () => {
  const directory = await mkdtemp(join(tmpdir(), "outreach-migrations-"));
  const transactional = "SELECT 'inside;string';\n";
  const concurrent = "-- migration: no-transaction\nCREATE INDEX CONCURRENTLY example_idx ON example_table (id);\n";
  try {
    await writeFile(join(directory, "001_transactional.sql"), transactional);
    await writeFile(join(directory, "002_concurrent.sql"), concurrent);
    const database = fakeMigrationPool();
    await runMigrations(database.pool, directory);
    assert.ok(database.executed.includes(transactional));
    assert.ok(database.executed.includes(concurrent));
    assert.equal(database.recorded.length, 2);
    assert.ok(database.recorded.every(([, checksum]) => /^[0-9a-f]{64}$/u.test(checksum)));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("no-transaction migration rejects stacked SQL outside comments, strings and dollar quotes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "outreach-migrations-stacked-"));
  const stacked = "-- migration: no-transaction\nCREATE INDEX CONCURRENTLY x ON t (id); DROP TABLE t;\n";
  try {
    await writeFile(join(directory, "001_stacked.sql"), stacked);
    const database = fakeMigrationPool();
    await assert.rejects(
      () => runMigrations(database.pool, directory),
      (error) => error.code === "POSTGRES_NO_TRANSACTION_MIGRATION_INVALID"
    );
    assert.equal(database.executed.includes(stacked), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("historical checksum baseline is explicit and later drift fails closed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "outreach-migrations-baseline-"));
  try {
    await writeFile(join(directory, "001_history.sql"), "SELECT 1;\n");
    const missing = fakeMigrationPool({ existingChecksum: null });
    await assert.rejects(
      () => runMigrations(missing.pool, directory),
      (error) => error.code === "POSTGRES_MIGRATION_CHECKSUM_BASELINE_REQUIRED"
    );
    const baseline = fakeMigrationPool({ existingChecksum: null });
    await runMigrations(baseline.pool, directory, { allowChecksumBaseline: true });
    assert.equal(baseline.baselined.length, 1);
    const drift = fakeMigrationPool({ existingChecksum: "a".repeat(64) });
    await assert.rejects(
      () => runMigrations(drift.pool, directory),
      (error) => error.code === "POSTGRES_MIGRATION_CHECKSUM_MISMATCH"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function fakeMigrationPool({ existingChecksum = undefined } = {}) {
  const executed = [];
  const recorded = [];
  const baselined = [];
  const client = {
    async query(text, parameters = []) {
      const sql = typeof text === "string" ? text : text.text;
      if (sql.includes("pg_try_advisory_lock")) return { rows: [{ acquired: true }], rowCount: 1 };
      if (sql.includes("pg_advisory_unlock")) return { rows: [{ pg_advisory_unlock: true }], rowCount: 1 };
      if (sql.startsWith("SELECT checksum FROM schema_migrations")) {
        return existingChecksum === undefined
          ? { rows: [], rowCount: 0 }
          : { rows: [{ checksum: existingChecksum }], rowCount: 1 };
      }
      if (sql.startsWith("INSERT INTO schema_migrations")) {
        recorded.push(parameters);
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("UPDATE schema_migrations SET checksum")) {
        baselined.push(parameters);
        return { rows: [], rowCount: 1 };
      }
      if (!new Set(["BEGIN", "COMMIT", "ROLLBACK"]).has(sql)
        && !sql.startsWith("CREATE TABLE IF NOT EXISTS schema_migrations")
        && !sql.startsWith("ALTER TABLE schema_migrations")) executed.push(sql);
      return { rows: [], rowCount: 0 };
    },
    release() {}
  };
  return {
    executed,
    recorded,
    baselined,
    pool: { options: {}, async connect() { return client; } }
  };
}

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createContainer } from "../container.mjs";
import {
  acquireVerifiedLegacySnapshot,
  applyLegacyMigration,
  assertApprovedLegacyReport,
  LEGACY_MIGRATION_VERSION
} from "../application/legacy-lead-migration.mjs";
import { errorCode } from "../errors.mjs";
import { runMigrations } from "../infrastructure/postgres.mjs";

const apply = process.argv.includes("--apply");
const reportArgument = argumentValue("--report");
const limit = positiveIntegerArgument("--limit", Number.POSITIVE_INFINITY);
const batchSize = positiveIntegerArgument("--batch-size", 100, 500);
if (apply && !reportArgument) throw new Error("--apply requires --report <dry-run-report.json>");

const container = createContainer();
let migrationLockClient;
try {
  if (apply) {
    migrationLockClient = await container.pool.connect();
    const lock = await migrationLockClient.query("SELECT pg_try_advisory_lock(hashtext($1)) AS acquired", [`legacy-migration:${LEGACY_MIGRATION_VERSION}`]);
    if (lock.rows[0]?.acquired !== true) {
      throw Object.assign(new Error("Another legacy migration apply is already running"), {
        code: "LEGACY_MIGRATION_ALREADY_RUNNING",
        retryable: true
      });
    }
  }
  const analysis = await acquireVerifiedLegacySnapshot(container.espocrm);

  if (!apply) {
    const serialized = `${JSON.stringify(analysis.report, null, 2)}\n`;
    if (reportArgument) await writeFile(resolve(reportArgument), serialized, { encoding: "utf8", mode: 0o600 });
    process.stdout.write(serialized);
    process.exitCode = analysis.report.applyAllowed ? 0 : 2;
  } else {
    const approved = JSON.parse(await readFile(resolve(reportArgument), "utf8"));
    assertApprovedLegacyReport(approved, analysis.report);
    await runMigrations(container.pool);
    await container.hashKeyAttestationCheck();
    const runId = `${analysis.report.migrationRunId}:${Number.isFinite(limit) ? limit : "all"}`;
    const checkpoint = await container.repository.beginLegacyMigrationRun({
      runId,
      migrationVersion: LEGACY_MIGRATION_VERSION,
      sourceDigest: analysis.report.sourceDigest,
      scopeLimit: limit
    });
    if (checkpoint.status === "succeeded") {
      process.stdout.write(`${JSON.stringify({ runId, status: "already_succeeded", ...checkpoint.counters }, null, 2)}\n`);
    } else {
      let counters = checkpoint.counters ?? {};
      let successFinalizationStarted = false;
      try {
        const result = await applyLegacyMigration({
          analysis,
          espocrm: container.espocrm,
          repository: container.repository,
          logger: container.logger,
          limit,
          batchSize,
          startOffset: checkpoint.nextOffset,
          onCheckpoint: async (nextOffset, nextCounters) => {
            counters = nextCounters;
            await container.repository.checkpointLegacyMigration(runId, nextOffset, nextCounters);
          }
        });
        counters = result;
        successFinalizationStarted = true;
        await container.repository.finishLegacyMigrationRun(runId, { succeeded: true, counters });
        process.stdout.write(`${JSON.stringify({ runId, migrationVersion: LEGACY_MIGRATION_VERSION, sourceDigest: analysis.report.sourceDigest, ...result }, null, 2)}\n`);
      } catch (error) {
        if (!successFinalizationStarted) {
          await container.repository.finishLegacyMigrationRun(runId, { succeeded: false, counters, errorCode: errorCode(error) }).catch((checkpointError) => {
            container.logger.error({ errorCode: errorCode(checkpointError), runId }, "legacy migration failure checkpoint could not be finalized");
          });
        }
        throw error;
      }
    }
  }
} finally {
  if (migrationLockClient) {
    await migrationLockClient.query("SELECT pg_advisory_unlock(hashtext($1))", [`legacy-migration:${LEGACY_MIGRATION_VERSION}`]).catch(() => {});
    migrationLockClient.release();
  }
  await container.pool.end();
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveIntegerArgument(name, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const raw = argumentValue(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  return value;
}

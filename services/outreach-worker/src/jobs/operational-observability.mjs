import "dotenv/config";

import { createOperationalObservabilityService } from "../application/operational-observability-service.mjs";
import { loadOperationalObservabilityPolicy } from "../domain/operational-observability-policy.mjs";
import { OperationalMetricCollector } from "../infrastructure/operational-metric-collector.mjs";
import { OperationalObservabilityRepository } from "../infrastructure/operational-observability-repository.mjs";
import { createPostgresPool } from "../infrastructure/postgres.mjs";

const argumentsList = process.argv.slice(2);
const mode = parseMode(argumentsList);
const policy = loadOperationalObservabilityPolicy(process.env);
const pool = createPostgresPool({
  url: requiredEnvironment("DATABASE_URL"),
  ssl: booleanEnvironment("DATABASE_SSL", false),
  poolMax: 2,
  statementTimeoutMs: 15_000,
  queryTimeoutMs: 20_000,
  lockTimeoutMs: 2_000,
  idleInTransactionTimeoutMs: 20_000,
  advisoryLockTimeoutMs: 5_000,
  advisoryLockRetryMs: 50
});

try {
  const repository = new OperationalObservabilityRepository({ pool, policy });
  const service = createOperationalObservabilityService({ repository, policy });
  if (mode === "capture") {
    const observedAt = new Date();
    const collector = new OperationalMetricCollector({ pool });
    const result = await service.capture({
      observedAt,
      metrics: await collector.collect({ observedAt })
    });
    process.stdout.write(`${JSON.stringify({
      mode,
      policyVersion: service.policy.policyVersion,
      policyDigest: service.policy.policyDigest,
      snapshotDigest: result.snapshot.snapshotDigest,
      replayed: result.snapshot.replayed,
      evaluations: result.evaluations.map(({ ruleId, decision, eventKey, replayed }) => ({
        ruleId,
        decision,
        eventKey,
        replayed
      }))
    }, null, 2)}\n`);
  } else {
    const result = await service.prune({ maxBatches: optionalInteger(argumentsList, "--max-batches") ?? 10 });
    process.stdout.write(`${JSON.stringify({ mode, ...result }, null, 2)}\n`);
  }
} finally {
  await pool.end();
}

function parseMode(values) {
  const allowed = new Set(["--capture", "--prune", "--max-batches"]);
  const seen = new Set();
  let mode;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!allowed.has(value)) throw new Error(`Unsupported operational-observability argument: ${value}`);
    if (seen.has(value)) throw new Error(`Duplicate operational-observability argument: ${value}`);
    seen.add(value);
    if (value === "--capture" || value === "--prune") {
      if (mode) throw new Error("Choose exactly one of --capture or --prune");
      mode = value.slice(2);
      continue;
    }
    const optionValue = values[index + 1];
    if (!optionValue || optionValue.startsWith("--")) throw new Error(`${value} requires a value`);
    index += 1;
  }
  if (!mode) throw new Error("Choose exactly one of --capture or --prune");
  if (mode === "capture" && values.includes("--max-batches")) {
    throw new Error("--max-batches is valid only with --prune");
  }
  return mode;
}

function optionalInteger(values, name) {
  const index = values.indexOf(name);
  if (index < 0) return undefined;
  const raw = values[index + 1];
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1_000) {
    throw new Error(`${name} must be an integer between 1 and 1000`);
  }
  return parsed;
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.length < 1) throw new Error(`${name} is required`);
  return value;
}

function booleanEnvironment(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

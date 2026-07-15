import { runMigrations } from "../infrastructure/postgres.mjs";
import { createPrivacyRuntime } from "../privacy-runtime.mjs";

const CONFIRMATION = "approved-bounded-privacy-index-backfill";
const allowed = new Set(["--apply", "--actor-id", "--batch-size", "--max-batches"]);
assertKnownArguments(process.argv.slice(2));
const apply = process.argv.includes("--apply");
if (apply) {
  if (process.env.OUTREACH_PRIVACY_INDEX_CONFIRM !== CONFIRMATION) {
    throw new Error(`Refusing index backfill: OUTREACH_PRIVACY_INDEX_CONFIRM must equal ${CONFIRMATION}`);
  }
  if (process.env.OUTREACH_KILL_SWITCH !== "true" || process.env.OUTREACH_SEND_ENABLED !== "false") {
    throw new Error("Refusing index backfill unless outreach sending is fail-closed");
  }
}

const runtime = createPrivacyRuntime();
try {
  await runMigrations(runtime.pool);
  await runtime.hashKeyAttestationCheck();
  const result = await runtime.service.preparePrivacyIndex({
    actorId: requiredArgument("--actor-id"),
    apply,
    batchSize: optionalInteger("--batch-size") ?? 100,
    maxBatches: optionalInteger("--max-batches") ?? 10
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await runtime.pool.end();
}

function optionalArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredArgument(name) {
  const value = optionalArgument(name);
  if (!value || value.startsWith("--")) throw new Error(`${name} is required`);
  return value;
}

function optionalInteger(name) {
  const value = optionalArgument(name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function assertKnownArguments(values) {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!allowed.has(value)) throw new Error(`Unsupported privacy-index argument: ${value}`);
    if (value !== "--apply") index += 1;
  }
}

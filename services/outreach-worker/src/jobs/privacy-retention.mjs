import { runMigrations } from "../infrastructure/postgres.mjs";
import { createPrivacyRuntime } from "../privacy-runtime.mjs";

const CONFIRMATION = "approved-digest-bound-privacy-execution";
const EXECUTE_ARGUMENTS = new Set([
  "--execute", "--plan-id", "--expected-digest", "--approval-id", "--change-id",
  "--recovery-id", "--actor-id", "--batch-size", "--max-batches"
]);
const PLAN_ARGUMENTS = new Set(["--actor-id", "--snapshot-at"]);
const execute = process.argv.includes("--execute");
assertKnownArguments(process.argv.slice(2), execute ? EXECUTE_ARGUMENTS : PLAN_ARGUMENTS);

if (execute) {
  if (process.env.OUTREACH_PRIVACY_EXECUTION_CONFIRM !== CONFIRMATION) {
    throw new Error(`Refusing retention execution: OUTREACH_PRIVACY_EXECUTION_CONFIRM must equal ${CONFIRMATION}`);
  }
  if (process.env.OUTREACH_KILL_SWITCH !== "true" || process.env.OUTREACH_SEND_ENABLED !== "false") {
    throw new Error("Refusing retention execution unless outreach sending is fail-closed");
  }
}

const runtime = createPrivacyRuntime();
try {
  await runMigrations(runtime.pool);
  await runtime.hashKeyAttestationCheck();
  const actorId = requiredArgument("--actor-id");
  const result = execute
    ? await runtime.service.executeRetention({
      planId: requiredArgument("--plan-id"),
      expectedDigest: requiredArgument("--expected-digest"),
      approvalId: requiredArgument("--approval-id"),
      changeId: requiredArgument("--change-id"),
      recoveryId: requiredArgument("--recovery-id"),
      actorId,
      batchSize: optionalInteger("--batch-size"),
      maxBatches: optionalInteger("--max-batches") ?? 100
    })
    : await runtime.service.planRetention({
      actorId,
      snapshotAt: optionalArgument("--snapshot-at") ?? new Date()
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

function assertKnownArguments(values, allowed) {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!allowed.has(value)) throw new Error(`Unsupported retention argument: ${value}`);
    if (value !== "--execute") index += 1;
  }
}

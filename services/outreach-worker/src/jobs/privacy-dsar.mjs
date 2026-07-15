import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { runMigrations } from "../infrastructure/postgres.mjs";
import { createPrivacyRuntime } from "../privacy-runtime.mjs";

const create = process.argv.includes("--create");
const plan = process.argv.includes("--plan");
const close = process.argv.includes("--close");
const exportEspo = process.argv.includes("--export-espo-plan");
const exportArtifact = process.argv.includes("--export-artifact");
if ([create, plan, close, exportEspo, exportArtifact].filter(Boolean).length !== 1) {
  throw new Error("Exactly one of --create, --plan, --close, --export-artifact or --export-espo-plan is required");
}
assertKnownArguments(process.argv.slice(2), create
  ? new Set(["--create", "--input", "--actor-id"])
  : plan
    ? new Set(["--plan", "--request-id", "--actor-id", "--maximum-records"])
    : close
      ? new Set(["--close", "--request-id", "--closure-reference", "--actor-id"])
      : exportEspo
        ? new Set(["--export-espo-plan", "--plan-id", "--actor-id", "--output"])
        : new Set(["--export-artifact", "--request-id", "--artifact-id", "--actor-id", "--output"]));

const runtime = createPrivacyRuntime();
try {
  await runMigrations(runtime.pool);
  await runtime.hashKeyAttestationCheck();
  const actorId = requiredArgument("--actor-id");
  const result = create
    ? await runtime.service.createDsarRequest({ ...(await readSecureJson(requiredArgument("--input"))), actorId })
    : plan
      ? await runtime.service.planDsarRequest({
        requestId: requiredArgument("--request-id"),
        actorId,
        maximumRecords: optionalInteger("--maximum-records") ?? 5_000
      })
      : close
        ? await runtime.service.closeDsarRequest({
          requestId: requiredArgument("--request-id"),
          closureReference: requiredArgument("--closure-reference"),
          actorId
        })
        : exportEspo
          ? await runtime.service.exportEspoMutationPlan({
            planId: requiredArgument("--plan-id"), actorId
          })
          : await runtime.service.exportDsarArtifact({
            requestId: requiredArgument("--request-id"),
            artifactId: requiredArgument("--artifact-id"),
            actorId
          });
  if (exportEspo || exportArtifact) {
    await writeSecureJson(requiredArgument("--output"), result);
    process.stdout.write(`${JSON.stringify({ exported: true, manifest: result.manifest }, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
} finally {
  await runtime.pool.end();
}

async function writeSecureJson(path, value) {
  const handle = await open(
    resolve(path),
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
    0o600
  );
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readSecureJson(path) {
  const handle = await open(resolve(path), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || (stats.mode & 0o077) !== 0 || stats.size > 512 * 1_024) {
      throw new Error("DSAR input must be a regular, non-symlink file of at most 512 KiB with mode 0600 or stricter");
    }
    return JSON.parse(await handle.readFile("utf8"));
  } finally {
    await handle.close();
  }
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
    if (!allowed.has(value)) throw new Error(`Unsupported DSAR argument: ${value}`);
    if (!new Set(["--create", "--plan", "--close", "--export-artifact", "--export-espo-plan"]).has(value)) index += 1;
  }
}

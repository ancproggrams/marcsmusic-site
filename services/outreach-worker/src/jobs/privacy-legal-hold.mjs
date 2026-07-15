import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { runMigrations } from "../infrastructure/postgres.mjs";
import { createPrivacyRuntime } from "../privacy-runtime.mjs";

const create = process.argv.includes("--create");
const release = process.argv.includes("--release");
if (create === release) throw new Error("Exactly one of --create or --release is required");
assertKnownArguments(process.argv.slice(2), create
  ? new Set(["--create", "--input", "--actor-id"])
  : new Set(["--release", "--hold-id", "--release-reference", "--actor-id"]));

const runtime = createPrivacyRuntime();
try {
  await runMigrations(runtime.pool);
  await runtime.hashKeyAttestationCheck();
  const actorId = requiredArgument("--actor-id");
  const result = create
    ? await runtime.service.createLegalHold({ ...(await readSecureJson(requiredArgument("--input"))), actorId })
    : await runtime.service.releaseLegalHold({
      holdId: requiredArgument("--hold-id"),
      releaseReference: requiredArgument("--release-reference"),
      actorId
    });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await runtime.pool.end();
}

async function readSecureJson(path) {
  const handle = await open(resolve(path), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || (stats.mode & 0o077) !== 0 || stats.size > 512 * 1_024) {
      throw new Error("Legal-hold input must be a regular, non-symlink file of at most 512 KiB with mode 0600 or stricter");
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

function assertKnownArguments(values, allowed) {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!allowed.has(value)) throw new Error(`Unsupported legal-hold argument: ${value}`);
    if (!new Set(["--create", "--release"]).has(value)) index += 1;
  }
}

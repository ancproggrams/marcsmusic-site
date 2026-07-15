import { loadPrivacyConfig } from "../privacy-config.mjs";
import { CryptoBox } from "../infrastructure/crypto-box.mjs";
import { reencryptStoredData } from "../infrastructure/data-reencryption.mjs";
import { createPostgresPool } from "../infrastructure/postgres.mjs";
import { assertHashKeyAttestation } from "../infrastructure/hash-key-attestation.mjs";

const REQUIRED_CONFIRMATION = "reviewed-bounded-data-key-rotation";
const allowedArguments = new Set(["--apply", "--batch-size", "--max-batches"]);
assertKnownArguments(process.argv.slice(2));
const apply = process.argv.includes("--apply");
const batchSize = integerArgument("--batch-size", 100, 1, 500);
const maxBatches = integerArgument("--max-batches", 10, 1, 1_000);

if (apply) {
  if (process.env.OUTREACH_DATA_REENCRYPT_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(`Refusing data re-encryption: OUTREACH_DATA_REENCRYPT_CONFIRM must equal ${REQUIRED_CONFIRMATION}`);
  }
  if (process.env.OUTREACH_KILL_SWITCH !== "true" || process.env.OUTREACH_SEND_ENABLED !== "false") {
    throw new Error("Refusing data re-encryption unless sending is fail-closed");
  }
}

const config = loadPrivacyConfig();
const pool = createPostgresPool(config.database);
try {
  const cryptoBox = new CryptoBox(config.crypto);
  await assertHashKeyAttestation({
    pool,
    cryptoBox,
    bootstrapReference: config.crypto.hashKeyBootstrapReference,
    bootstrapConfirmation: config.crypto.hashKeyBootstrapConfirmation
  });
  const result = await reencryptStoredData({ pool, cryptoBox, apply, batchSize, maxBatches });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await pool.end();
}

function integerArgument(name, fallback, minimum, maximum) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const raw = process.argv[index + 1];
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function assertKnownArguments(argumentsList) {
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!allowedArguments.has(argument)) throw new Error(`Unsupported data re-encryption argument: ${argument}`);
    if (argument !== "--apply") index += 1;
  }
}

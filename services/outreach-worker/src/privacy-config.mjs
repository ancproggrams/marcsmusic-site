import "dotenv/config";
import { z } from "zod";

const booleanString = (fallback = "false") => z.enum(["true", "false"])
  .default(fallback)
  .transform((value) => value === "true");

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: booleanString(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(2).max(20).default(4),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(250).max(60_000).default(15_000),
  DATABASE_QUERY_TIMEOUT_MS: z.coerce.number().int().min(500).max(65_000).default(20_000),
  DATABASE_LOCK_TIMEOUT_MS: z.coerce.number().int().min(50).max(10_000).default(2_000),
  DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(20_000),
  DATABASE_ADVISORY_LOCK_TIMEOUT_MS: z.coerce.number().int().min(50).max(30_000).default(5_000),
  OUTREACH_DATA_ENCRYPTION_KEY: z.string().min(40),
  OUTREACH_DATA_KEY_VERSION: z.string().regex(/^[A-Za-z0-9._-]{1,32}$/u).default("v1"),
  OUTREACH_DATA_DECRYPTION_KEYS_JSON: z.string().default("{}"),
  OUTREACH_HASH_KEY: z.string().min(32),
  OUTREACH_HASH_KEY_EPOCH: z.string().regex(/^[A-Za-z0-9._-]{1,32}$/u).default("v1"),
  OUTREACH_HASH_KEY_BOOTSTRAP_REFERENCE: z.string().min(12).max(128).optional().or(z.literal("")),
  OUTREACH_HASH_KEY_BOOTSTRAP_CONFIRM: z.string().max(128).optional().or(z.literal(""))
});

export function loadPrivacyConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw Object.assign(new Error(`Invalid privacy runtime configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`), {
      code: "PRIVACY_CONFIGURATION_INVALID",
      issues: parsed.error.issues
    });
  }
  const activeKey = decodeKey(parsed.data.OUTREACH_DATA_ENCRYPTION_KEY, "OUTREACH_DATA_ENCRYPTION_KEY");
  const decryptionKeys = parseHistoricalKeys(
    parsed.data.OUTREACH_DATA_DECRYPTION_KEYS_JSON,
    parsed.data.OUTREACH_DATA_KEY_VERSION
  );
  if (parsed.data.DATABASE_QUERY_TIMEOUT_MS < parsed.data.DATABASE_STATEMENT_TIMEOUT_MS) {
    throw Object.assign(new Error("DATABASE_QUERY_TIMEOUT_MS must be at least DATABASE_STATEMENT_TIMEOUT_MS"), {
      code: "PRIVACY_CONFIGURATION_INVALID"
    });
  }
  return Object.freeze({
    database: Object.freeze({
      url: parsed.data.DATABASE_URL,
      ssl: parsed.data.DATABASE_SSL,
      poolMax: parsed.data.DATABASE_POOL_MAX,
      statementTimeoutMs: parsed.data.DATABASE_STATEMENT_TIMEOUT_MS,
      queryTimeoutMs: parsed.data.DATABASE_QUERY_TIMEOUT_MS,
      lockTimeoutMs: parsed.data.DATABASE_LOCK_TIMEOUT_MS,
      idleInTransactionTimeoutMs: parsed.data.DATABASE_IDLE_TRANSACTION_TIMEOUT_MS,
      advisoryLockTimeoutMs: parsed.data.DATABASE_ADVISORY_LOCK_TIMEOUT_MS
    }),
    crypto: Object.freeze({
      encryptionKey: activeKey,
      keyVersion: parsed.data.OUTREACH_DATA_KEY_VERSION,
      decryptionKeys,
      hashKey: parsed.data.OUTREACH_HASH_KEY,
      hashKeyEpoch: parsed.data.OUTREACH_HASH_KEY_EPOCH,
      hashKeyBootstrapReference: parsed.data.OUTREACH_HASH_KEY_BOOTSTRAP_REFERENCE || undefined,
      hashKeyBootstrapConfirmation: parsed.data.OUTREACH_HASH_KEY_BOOTSTRAP_CONFIRM || undefined
    })
  });
}

function parseHistoricalKeys(raw, activeVersion) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("OUTREACH_DATA_DECRYPTION_KEYS_JSON must be valid JSON"), { code: "PRIVACY_CONFIGURATION_INVALID" });
  }
  if (!value || Array.isArray(value) || typeof value !== "object" || Object.keys(value).length > 10) {
    throw Object.assign(new Error("OUTREACH_DATA_DECRYPTION_KEYS_JSON must be an object with at most 10 keys"), { code: "PRIVACY_CONFIGURATION_INVALID" });
  }
  const keys = Object.create(null);
  for (const [version, encoded] of Object.entries(value)) {
    if (!/^[A-Za-z0-9._-]{1,32}$/u.test(version) || version === activeVersion) {
      throw Object.assign(new Error("Historical privacy key version is invalid or redefines the active version"), { code: "PRIVACY_CONFIGURATION_INVALID" });
    }
    keys[version] = decodeKey(encoded, `OUTREACH_DATA_DECRYPTION_KEYS_JSON.${version}`);
  }
  return Object.freeze(keys);
}

function decodeKey(value, name) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) {
    throw Object.assign(new Error(`${name} must be valid base64`), { code: "PRIVACY_CONFIGURATION_INVALID" });
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw Object.assign(new Error(`${name} must decode to exactly 32 bytes`), { code: "PRIVACY_CONFIGURATION_INVALID" });
  }
  return key;
}

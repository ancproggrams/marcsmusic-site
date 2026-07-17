import "dotenv/config";
import { z } from "zod";
import { SOURCE_IDS } from "./domain/source-artifact.mjs";
import { loadOperationalObservabilityPolicy } from "./domain/operational-observability-policy.mjs";

const OFFICIAL_MAILGUN_API_ORIGINS = new Set([
  "https://api.mailgun.net",
  "https://api.eu.mailgun.net"
]);
const FORBIDDEN_PRODUCTION_PROVIDER_SUFFIXES = [
  ".example",
  ".invalid",
  ".internal",
  ".local",
  ".localhost",
  ".test"
];

const booleanString = (fallback = "false") =>
  z.enum(["true", "false"]).default(fallback).transform((value) => value === "true");

const positiveInteger = (fallback) =>
  z.coerce.number().int().positive().default(fallback);

const boundedRate = (fallback) =>
  z.coerce.number().min(0).max(1).default(fallback);

function currentBusinessDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  HTTP_MAX_IN_FLIGHT_REQUESTS: z.coerce.number().int().min(8).max(1_024).default(64),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  OUTREACH_PROCESS_MODE: z.enum(["all", "api", "worker"]).default("all"),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: booleanString(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(8).max(50).default(10),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(250).max(60_000).default(15_000),
  DATABASE_QUERY_TIMEOUT_MS: z.coerce.number().int().min(500).max(65_000).default(20_000),
  DATABASE_LOCK_TIMEOUT_MS: z.coerce.number().int().min(50).max(10_000).default(2_000),
  DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(20_000),
  DATABASE_ADVISORY_LOCK_TIMEOUT_MS: z.coerce.number().int().min(50).max(30_000).default(5_000),
  ESPOCRM_BASE_URL: z.string().url(),
  ESPOCRM_API_KEY: z.string().min(12),
  ESPOCRM_TIMEOUT_MS: positiveInteger(10_000),
  ESPOCRM_MAX_PAGE_SIZE: z.coerce.number().int().min(1).max(200).default(200),
  ESPOCRM_WEBHOOK_SECRETS_JSON: z.string().default("{}"),
  PROVIDER_CAPABILITY_CACHE_TTL_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  // Outbound mail is explicitly Plunk. Legacy MAILGUN_* values below remain
  // only for the staged inbound/outcome-reconciliation boundary and are never
  // used by the send service.
  EMAIL_PROVIDER: z.literal("plunk").default("plunk"),
  PLUNK_BASE_URL: z.string().url().default("https://mail.marcsmusic.nl"),
  PLUNK_SECRET_KEY: z.string().trim().min(1).optional().or(z.literal("")),
  PLUNK_FROM: z.string().trim().min(3).optional().or(z.literal("")),
  PLUNK_REPLY_TO: z.string().email().optional().or(z.literal("")),
  PLUNK_WEBHOOK_SECRET: z.string().trim().min(16).optional().or(z.literal("")),
  PLUNK_TIMEOUT_MS: z.coerce.number().int().min(250).max(30_000).default(15_000),
  PLUNK_MAX_RESPONSE_BYTES: z.coerce.number().int().min(1_024).max(4_194_304).default(65_536),
  MAILGUN_API_KEY: z.string().trim().min(1).optional().or(z.literal("")),
  MAILGUN_DOMAIN: z.string().trim().min(1).max(253).optional().or(z.literal("")),
  MAILGUN_BASE_URL: z.string().url().default("https://api.eu.mailgun.net"),
  MAILGUN_FROM: z.string().min(3).optional().or(z.literal("")),
  MAILGUN_REPLY_TO: z.string().email().optional().or(z.literal("")),
  MAILGUN_WEBHOOK_SIGNING_KEY: z.string().min(16).optional().or(z.literal("")),
  MAILGUN_HEALTH_TIMEOUT_MS: z.coerce.number().int().min(250).max(10_000).default(3_000),
  MAILGUN_HEALTH_MAX_RESPONSE_BYTES: z.coerce.number().int().min(1_024).max(65_536).default(16_384),
  MAILGUN_INBOUND_ROUTE_EVIDENCE: z.enum(["unknown", "configured"]).default("unknown"),
  MAILGUN_INBOUND_ROUTE_EVIDENCE_REFERENCE: z.string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u)
    .optional()
    .or(z.literal("")),
  OUTREACH_KILL_SWITCH: booleanString("true"),
  OUTREACH_SEND_ENABLED: booleanString(),
  OUTREACH_NEW_CONTACTS_ONLY_FROM: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).default(currentBusinessDate()),
  OUTREACH_PUBLIC_BASE_URL: z.string().url(),
  OUTREACH_DAILY_SEND_LIMIT: positiveInteger(40),
  OUTREACH_DOMAIN_DAILY_LIMIT: positiveInteger(2),
  OUTREACH_AUTOMATIC_RESPONSE_DAILY_LIMIT: positiveInteger(20),
  OUTREACH_AUTOMATIC_RESPONSE_CONTACT_LIMIT: positiveInteger(2),
  OUTREACH_MATCH_THRESHOLD: z.coerce.number().int().min(0).max(100).default(80),
  OUTREACH_WAITLIST_THRESHOLD: z.coerce.number().int().min(0).max(100).default(65),
  OUTREACH_COOLDOWN_DAYS: positiveInteger(21),
  OUTREACH_OUTLET_COOLDOWN_DAYS: positiveInteger(14),
  OUTREACH_MAX_FOLLOW_UPS: z.coerce.number().int().min(0).max(2).default(2),
  OUTREACH_RECONCILE_INTERVAL_MS: positiveInteger(21_600_000),
  OUTREACH_RECONCILE_OVERLAP_MINUTES: positiveInteger(5),
  OUTREACH_RECONCILE_LEASE_SECONDS: z.coerce.number().int().min(30).max(900).default(120),
  OUTREACH_RECONCILE_MAX_RECORDS_PER_ENTITY: z.coerce.number().int().min(1_000).max(10_000_000).default(10_000_000),
  OUTREACH_OUTCOME_RECONCILE_ENABLED: booleanString(),
  OUTREACH_OUTCOME_RECONCILE_MAILGUN_ENABLED: booleanString("true"),
  OUTREACH_OUTCOME_RECONCILE_ESPO_EMAIL_ENABLED: booleanString("true"),
  OUTREACH_OUTCOME_RECONCILE_DUE_MATCHES_ENABLED: booleanString("true"),
  OUTREACH_OUTCOME_RECONCILE_MAILGUN_STORED_REPLIES_ENABLED: booleanString(),
  OUTREACH_OUTCOME_RECONCILE_MAILGUN_MODE: z.enum(["logs", "events"]).default("logs"),
  OUTREACH_OUTCOME_RECONCILE_INTERVAL_MS: z.coerce.number().int().min(60_000).max(86_400_000).default(900_000),
  OUTREACH_OUTCOME_RECONCILE_OVERLAP_SECONDS: z.coerce.number().int().refine((value) => value === 300, {
    message: "Outcome reconciliation overlap is fixed at five minutes"
  }).default(300),
  OUTREACH_OUTCOME_RECONCILE_SETTLE_DELAY_SECONDS: z.coerce.number().int().min(60).max(3_600).default(300),
  OUTREACH_OUTCOME_RECONCILE_INITIAL_LOOKBACK_HOURS: z.coerce.number().int().min(1).max(72).default(24),
  OUTREACH_OUTCOME_RECONCILE_LEASE_SECONDS: z.coerce.number().int().min(30).max(900).default(120),
  OUTREACH_OUTCOME_RECONCILE_PAGE_SIZE: z.coerce.number().int().min(1).max(300).default(100),
  OUTREACH_OUTCOME_RECONCILE_MAX_PAGES: z.coerce.number().int().min(1).max(1_000).default(25),
  OUTREACH_OUTCOME_RECONCILE_MAX_BACKLOG: z.coerce.number().int().min(100).max(500_000).default(10_000),
  OUTREACH_OUTCOME_RECONCILE_MAX_RESPONSE_BYTES: z.coerce.number().int().min(16_384).max(4_194_304).default(2_097_152),
  OUTREACH_OUTCOME_RECONCILE_STORAGE_MAX_RESPONSE_BYTES: z.coerce.number().int().min(16_384).max(4_194_304).default(1_048_576),
  OUTREACH_WORK_POLL_MS: positiveInteger(2_000),
  OUTREACH_SEND_POLL_MS: positiveInteger(5_000),
  OUTREACH_SAFETY_EVENT_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  OUTREACH_PROJECTION_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  OUTREACH_MATCH_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  OUTREACH_MAINTENANCE_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  OUTREACH_SEND_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  OUTREACH_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(25_000).default(25_000),
  OUTREACH_HEALTH_INTERVAL_MS: positiveInteger(3_600_000),
  OUTREACH_OBSERVABILITY_POLICY_JSON: z.string().max(65_536).default(""),
  OUTREACH_OBSERVABILITY_RUNTIME_APPROVAL_REFERENCE: z.string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,127}$/u)
    .optional()
    .or(z.literal("")),
  OUTREACH_OBSERVABILITY_PRUNE_INTERVAL_MS: z.coerce.number().int().min(30_000).max(86_400_000).default(300_000),
  OUTREACH_OBSERVABILITY_RETRY_INTERVAL_MS: z.coerce.number().int().min(1_000).max(60_000).default(2_000),
  OUTREACH_OBSERVABILITY_PRUNE_MAX_BATCHES: z.coerce.number().int().min(1).max(1_000).default(10),
  OUTREACH_OBSERVABILITY_CAPACITY_HEADROOM_SAMPLES: z.coerce.number().int().min(1).max(10_000).default(10),
  OUTREACH_ALERT_PROJECTOR_INTERVAL_MS: z.coerce.number().int().min(1_000).max(300_000).default(5_000),
  OUTREACH_ALERT_PROJECTOR_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
  OUTREACH_ALERT_OUTBOX_MAX_BACKLOG: z.coerce.number().int().min(2).max(500_000).default(10_000),
  OUTREACH_MIN_HEALTH_SAMPLE: positiveInteger(20),
  OUTREACH_MAX_BOUNCE_RATE: boundedRate(0.05),
  OUTREACH_MAX_FAILURE_RATE: boundedRate(0.2),
  OUTREACH_DATA_ENCRYPTION_KEY: z.string().min(40),
  OUTREACH_DATA_KEY_VERSION: z.string().regex(/^[A-Za-z0-9._-]{1,32}$/u).default("v1"),
  OUTREACH_DATA_DECRYPTION_KEYS_JSON: z.string().default("{}"),
  OUTREACH_HASH_KEY: z.string().min(32),
  OUTREACH_HASH_KEY_EPOCH: z.string().regex(/^[A-Za-z0-9._-]{1,32}$/u).default("v1"),
  OUTREACH_HASH_KEY_BOOTSTRAP_REFERENCE: z.string().min(12).max(128).optional().or(z.literal("")),
  OUTREACH_HASH_KEY_BOOTSTRAP_CONFIRM: z.string().max(128).optional().or(z.literal("")),
  OUTREACH_UNSUBSCRIBE_KEYRING_JSON: z.string(),
  OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_KEY: z.string().max(512).optional().or(z.literal("")),
  OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_UNTIL: z.string().max(64).optional().or(z.literal("")),
  COPY_PROVIDER_ENABLED: booleanString(),
  COPY_PROVIDER_URL: z.string().url().optional().or(z.literal("")),
  COPY_PROVIDER_TOKEN: z.string().optional(),
  COPY_PROVIDER_MODEL: z.string().optional(),
  COPY_PROVIDER_TIMEOUT_MS: positiveInteger(15_000),
  COPY_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.85),
  COPY_LINK_CHECK_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(10_000),
  COPY_LINK_CHECK_MAX_REDIRECTS: z.coerce.number().int().min(0).max(5).default(3),
  COPY_LINK_CHECK_MAX_HEADER_BYTES: z.coerce.number().int().min(1_024).max(65_536).default(16_384),
  SOURCE_INGESTION_ENABLED: booleanString(),
  SOURCE_INGESTION_KEYRINGS_JSON: z.string().default('{"schemaVersion":2,"sources":{}}'),
  SOURCE_INGESTION_MAX_SKEW_SECONDS: z.coerce.number().int().min(30).max(3_600).default(300),
  SOURCE_INGESTION_MAX_ARTIFACT_AGE_SECONDS: z.coerce.number().int().min(300).max(604_800).default(86_400),
  SOURCE_INGESTION_MAX_EVIDENCE_AGE_SECONDS: z.coerce.number().int().min(86_400).max(31_536_000).default(7_776_000),
  SOURCE_INGESTION_PROCESSING_LEASE_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
  EMAIL_VALIDATION_PROVIDER_ENABLED: booleanString(),
  EMAIL_VALIDATION_PROVIDER_TYPE: z.enum(["http", "smtp", "mailgun"]).default("http"),
  EMAIL_VALIDATION_PROVIDER_URL: z.string().url().optional().or(z.literal("")),
  EMAIL_VALIDATION_PROVIDER_TOKEN: z.string().optional(),
  EMAIL_VALIDATION_PROVIDER_TIMEOUT_MS: positiveInteger(10_000),
  EMAIL_VALIDATION_PROVIDER_HEALTH_URL: z.string().url().optional().or(z.literal("")),
  EMAIL_VALIDATION_PROVIDER_HEALTH_TIMEOUT_MS: z.coerce.number().int().min(250).max(10_000).default(3_000),
  EMAIL_VALIDATION_PROVIDER_HEALTH_MAX_RESPONSE_BYTES: z.coerce.number().int().min(1_024).max(65_536).default(16_384),
  EMAIL_VALIDATION_SMTP_HELO_DOMAIN: z.string().trim().max(253).optional().or(z.literal("")),
  EMAIL_VALIDATION_SMTP_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(250).max(15_000).default(3_000),
  EMAIL_VALIDATION_SMTP_COMMAND_TIMEOUT_MS: z.coerce.number().int().min(250).max(15_000).default(3_000),
  EMAIL_VALIDATION_SMTP_TOTAL_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(12_000),
  EMAIL_VALIDATION_SMTP_MAX_MX_HOSTS: z.coerce.number().int().min(1).max(5).default(2),
  EMAIL_VALIDATION_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  METRICS_TOKEN: z.string().min(24)
});

export class ConfigurationError extends Error {
  constructor(issues) {
    super(`Invalid outreach-worker configuration: ${issues.map((issue) => issue.path.join(".")).join(", ")}`);
    this.name = "ConfigurationError";
    this.code = "CONFIGURATION_INVALID";
    this.issues = issues;
  }
}

export function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigurationError(parsed.error.issues);
  }

  const webhookSecrets = parseSecretMap(parsed.data.ESPOCRM_WEBHOOK_SECRETS_JSON);
  const unsubscribeSigning = parseUnsubscribeKeyring(
    parsed.data.OUTREACH_UNSUBSCRIBE_KEYRING_JSON,
    parsed.data.OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_KEY,
    parsed.data.OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_UNTIL
  );
  const sourceKeyrings = parseSourceKeyrings(parsed.data.SOURCE_INGESTION_KEYRINGS_JSON);
  const observabilityPolicy = parseObservabilityPolicy(parsed.data.OUTREACH_OBSERVABILITY_POLICY_JSON);
  const encryptionKey = decodeEncryptionKey(parsed.data.OUTREACH_DATA_ENCRYPTION_KEY);
  const decryptionKeys = parseDecryptionKeys(
    parsed.data.OUTREACH_DATA_DECRYPTION_KEYS_JSON,
    parsed.data.OUTREACH_DATA_KEY_VERSION
  );

  if (parsed.data.COPY_PROVIDER_ENABLED && !parsed.data.COPY_PROVIDER_URL) {
    throw new ConfigurationError([{ path: ["COPY_PROVIDER_URL"], message: "Required when copy provider is enabled" }]);
  }

  if (parsed.data.SOURCE_INGESTION_ENABLED && Object.keys(sourceKeyrings).length === 0) {
    throw new ConfigurationError([{ path: ["SOURCE_INGESTION_KEYRINGS_JSON"], message: "At least one source keyring is required when ingestion is enabled" }]);
  }

  if (parsed.data.MAILGUN_DOMAIN && !isDnsHostname(parsed.data.MAILGUN_DOMAIN)) {
    throw new ConfigurationError([{ path: ["MAILGUN_DOMAIN"], message: "A DNS hostname is required" }]);
  }

  if (parsed.data.EMAIL_PROVIDER !== "plunk") {
    throw new ConfigurationError([{
      path: ["EMAIL_PROVIDER"],
      message: "Outbound email provider must be explicitly set to plunk"
    }]);
  }
  const inboundRouteEvidenceReference = parsed.data.MAILGUN_INBOUND_ROUTE_EVIDENCE_REFERENCE || undefined;
  if (parsed.data.MAILGUN_INBOUND_ROUTE_EVIDENCE === "configured" && !inboundRouteEvidenceReference) {
    throw new ConfigurationError([{
      path: ["MAILGUN_INBOUND_ROUTE_EVIDENCE_REFERENCE"],
      message: "An opaque evidence reference is required when inbound routing is marked configured"
    }]);
  }
  if (parsed.data.MAILGUN_INBOUND_ROUTE_EVIDENCE === "unknown" && inboundRouteEvidenceReference) {
    throw new ConfigurationError([{
      path: ["MAILGUN_INBOUND_ROUTE_EVIDENCE_REFERENCE"],
      message: "Evidence references are only accepted when inbound routing is marked configured"
    }]);
  }

  if (
    parsed.data.EMAIL_VALIDATION_PROVIDER_ENABLED
    && parsed.data.EMAIL_VALIDATION_PROVIDER_TYPE === "http"
    && (!parsed.data.EMAIL_VALIDATION_PROVIDER_URL || !parsed.data.EMAIL_VALIDATION_PROVIDER_TOKEN)
  ) {
    throw new ConfigurationError([{ path: ["EMAIL_VALIDATION_PROVIDER_URL"], message: "Provider URL and token are required when email validation is enabled" }]);
  }
  if (
    parsed.data.EMAIL_VALIDATION_PROVIDER_ENABLED
    && parsed.data.EMAIL_VALIDATION_PROVIDER_TYPE === "mailgun"
    && (!parsed.data.MAILGUN_API_KEY || !parsed.data.MAILGUN_DOMAIN)
  ) {
    throw new ConfigurationError([{
      path: ["MAILGUN_API_KEY"],
      message: "Mailgun email validation requires the API key and configured Mailgun domain"
    }]);
  }
  if (
    parsed.data.EMAIL_VALIDATION_PROVIDER_HEALTH_URL
    && (!parsed.data.EMAIL_VALIDATION_PROVIDER_ENABLED || parsed.data.EMAIL_VALIDATION_PROVIDER_TYPE !== "http")
  ) {
    throw new ConfigurationError([{
      path: ["EMAIL_VALIDATION_PROVIDER_HEALTH_URL"],
      message: "A live health URL is only valid for an enabled HTTP validation provider"
    }]);
  }
  if (parsed.data.EMAIL_VALIDATION_PROVIDER_ENABLED && parsed.data.EMAIL_VALIDATION_PROVIDER_TYPE === "http") {
    const providerUrl = new URL(parsed.data.EMAIL_VALIDATION_PROVIDER_URL);
    assertCredentialFreeProviderUrl(providerUrl, "EMAIL_VALIDATION_PROVIDER_URL");
    if (parsed.data.EMAIL_VALIDATION_PROVIDER_HEALTH_URL) {
      const healthUrl = new URL(parsed.data.EMAIL_VALIDATION_PROVIDER_HEALTH_URL);
      assertCredentialFreeProviderUrl(healthUrl, "EMAIL_VALIDATION_PROVIDER_HEALTH_URL");
      if (healthUrl.origin !== providerUrl.origin) {
        throw new ConfigurationError([{
          path: ["EMAIL_VALIDATION_PROVIDER_HEALTH_URL"],
          message: "Health URL must use the exact configured validation-provider origin"
        }]);
      }
    }
  }

  if (parsed.data.OUTREACH_SEND_ENABLED && !parsed.data.OUTREACH_NEW_CONTACTS_ONLY_FROM) {
    throw new ConfigurationError([{
      path: ["OUTREACH_NEW_CONTACTS_ONLY_FROM"],
      message: "A new-contact start date is required before sending can be enabled"
    }]);
  }
  if (parsed.data.OUTREACH_SEND_ENABLED && !parsed.data.EMAIL_VALIDATION_PROVIDER_ENABLED) {
    throw new ConfigurationError([{
      path: ["EMAIL_VALIDATION_PROVIDER_ENABLED"],
      message: "Independent email validation must be enabled before sending can be enabled"
    }]);
  }

  if (parsed.data.PLUNK_SECRET_KEY && !parsed.data.PLUNK_FROM) {
    throw new ConfigurationError([{
      path: ["PLUNK_FROM"],
      message: "PLUNK_FROM is required when PLUNK_SECRET_KEY is configured"
    }]);
  }
  if (parsed.data.OUTREACH_SEND_ENABLED && (!parsed.data.PLUNK_SECRET_KEY || !parsed.data.PLUNK_FROM)) {
    throw new ConfigurationError([{
      path: ["PLUNK_SECRET_KEY"],
      message: "A Plunk secret and fixed sender are required before sending can be enabled"
    }]);
  }
  if (parsed.data.OUTREACH_SEND_ENABLED && !parsed.data.PLUNK_WEBHOOK_SECRET) {
    throw new ConfigurationError([{
      path: ["PLUNK_WEBHOOK_SECRET"],
      message: "A shared Plunk webhook secret is required before sending can be enabled"
    }]);
  }

  const smtpHeloDomain = parsed.data.EMAIL_VALIDATION_SMTP_HELO_DOMAIN
    || new URL(parsed.data.OUTREACH_PUBLIC_BASE_URL).hostname;
  if (
    parsed.data.EMAIL_VALIDATION_PROVIDER_ENABLED
    && parsed.data.EMAIL_VALIDATION_PROVIDER_TYPE === "smtp"
    && !isDnsHostname(smtpHeloDomain)
  ) {
    throw new ConfigurationError([{ path: ["EMAIL_VALIDATION_SMTP_HELO_DOMAIN"], message: "A DNS hostname is required for SMTP validation" }]);
  }

  if (parsed.data.OUTREACH_WAITLIST_THRESHOLD > parsed.data.OUTREACH_MATCH_THRESHOLD) {
    throw new ConfigurationError([{ path: ["OUTREACH_WAITLIST_THRESHOLD"], message: "Must not exceed match threshold" }]);
  }

  if (parsed.data.OUTREACH_OUTCOME_RECONCILE_ENABLED) {
    const enabledRoutes = [
      parsed.data.OUTREACH_OUTCOME_RECONCILE_MAILGUN_ENABLED,
      parsed.data.OUTREACH_OUTCOME_RECONCILE_ESPO_EMAIL_ENABLED,
      parsed.data.OUTREACH_OUTCOME_RECONCILE_DUE_MATCHES_ENABLED
    ].filter(Boolean);
    if (!enabledRoutes.length) {
      throw new ConfigurationError([{
        path: ["OUTREACH_OUTCOME_RECONCILE_ENABLED"],
        message: "At least one bounded reconciliation route must be enabled"
      }]);
    }
    if (parsed.data.OUTREACH_OUTCOME_RECONCILE_MAILGUN_ENABLED && (!parsed.data.MAILGUN_API_KEY || !parsed.data.MAILGUN_DOMAIN)) {
      throw new ConfigurationError([{
        path: ["MAILGUN_API_KEY"],
        message: "Mailgun reconciliation requires the legacy Mailgun API key and domain"
      }]);
    }
    if (
      parsed.data.OUTREACH_OUTCOME_RECONCILE_MAILGUN_STORED_REPLIES_ENABLED
      && !parsed.data.OUTREACH_OUTCOME_RECONCILE_MAILGUN_ENABLED
    ) {
      throw new ConfigurationError([{
        path: ["OUTREACH_OUTCOME_RECONCILE_MAILGUN_STORED_REPLIES_ENABLED"],
        message: "Stored reply recovery requires the Mailgun reconciliation route"
      }]);
    }
    if (
      parsed.data.OUTREACH_OUTCOME_RECONCILE_MAILGUN_STORED_REPLIES_ENABLED
      && parsed.data.MAILGUN_INBOUND_ROUTE_EVIDENCE !== "configured"
    ) {
      throw new ConfigurationError([{
        path: ["MAILGUN_INBOUND_ROUTE_EVIDENCE"],
        message: "Configured inbound storage evidence is required before stored replies can be recovered"
      }]);
    }
    if (
      !parsed.data.OUTREACH_OUTCOME_RECONCILE_MAILGUN_STORED_REPLIES_ENABLED
      && !parsed.data.OUTREACH_OUTCOME_RECONCILE_ESPO_EMAIL_ENABLED
    ) {
      throw new ConfigurationError([{
        path: ["OUTREACH_OUTCOME_RECONCILE_ESPO_EMAIL_ENABLED"],
        message: "Espo incoming Email polling is required when Mailgun stored reply recovery is unavailable"
      }]);
    }
  }

  const workerConcurrency = parsed.data.OUTREACH_SAFETY_EVENT_CONCURRENCY
    + parsed.data.OUTREACH_PROJECTION_CONCURRENCY
    + parsed.data.OUTREACH_MATCH_CONCURRENCY
    + parsed.data.OUTREACH_MAINTENANCE_CONCURRENCY
    + parsed.data.OUTREACH_SEND_CONCURRENCY;
  const controlPlaneReserve = observabilityPolicy.enabled ? 3 : 2;
  if (workerConcurrency + controlPlaneReserve > parsed.data.DATABASE_POOL_MAX) {
    throw new ConfigurationError([{
      path: ["DATABASE_POOL_MAX"],
      message: `Must reserve ${controlPlaneReserve} connections beyond configured worker concurrency for ingress and control-plane checks`
    }]);
  }

  const observabilityRuntime = validateObservabilityRuntime(parsed.data, observabilityPolicy);

  if (parsed.data.DATABASE_QUERY_TIMEOUT_MS < parsed.data.DATABASE_STATEMENT_TIMEOUT_MS) {
    throw new ConfigurationError([{
      path: ["DATABASE_QUERY_TIMEOUT_MS"],
      message: "Must be greater than or equal to DATABASE_STATEMENT_TIMEOUT_MS"
    }]);
  }

  if (parsed.data.NODE_ENV === "production") {
    for (const [path, value] of [
      ["ESPOCRM_BASE_URL", parsed.data.ESPOCRM_BASE_URL],
      ["PLUNK_BASE_URL", parsed.data.PLUNK_BASE_URL],
      ["MAILGUN_BASE_URL", parsed.data.MAILGUN_BASE_URL],
      ["OUTREACH_PUBLIC_BASE_URL", parsed.data.OUTREACH_PUBLIC_BASE_URL],
      ...(parsed.data.EMAIL_VALIDATION_PROVIDER_ENABLED && parsed.data.EMAIL_VALIDATION_PROVIDER_TYPE === "http"
        ? [
            ["EMAIL_VALIDATION_PROVIDER_URL", parsed.data.EMAIL_VALIDATION_PROVIDER_URL],
            ...(parsed.data.EMAIL_VALIDATION_PROVIDER_HEALTH_URL
              ? [["EMAIL_VALIDATION_PROVIDER_HEALTH_URL", parsed.data.EMAIL_VALIDATION_PROVIDER_HEALTH_URL]]
              : [])
          ]
        : [])
    ]) {
      if (new URL(value).protocol !== "https:") {
        throw new ConfigurationError([{ path: [path], message: "HTTPS is required in production" }]);
      }
    }
    const mailgunBaseUrl = new URL(parsed.data.MAILGUN_BASE_URL);
    if (
      !OFFICIAL_MAILGUN_API_ORIGINS.has(mailgunBaseUrl.origin)
      || mailgunBaseUrl.pathname !== "/"
      || mailgunBaseUrl.username
      || mailgunBaseUrl.password
      || mailgunBaseUrl.search
      || mailgunBaseUrl.hash
    ) {
      throw new ConfigurationError([{
        path: ["MAILGUN_BASE_URL"],
        message: "Production Mailgun traffic must use an exact official US or EU API origin"
      }]);
    }
    const plunkBaseUrl = new URL(parsed.data.PLUNK_BASE_URL);
    if (
      plunkBaseUrl.protocol !== "https:"
      || plunkBaseUrl.username
      || plunkBaseUrl.password
      || plunkBaseUrl.search
      || plunkBaseUrl.hash
    ) {
      throw new ConfigurationError([{
        path: ["PLUNK_BASE_URL"],
        message: "Production Plunk traffic must use an HTTPS origin without credentials or query parameters"
      }]);
    }
    if (parsed.data.EMAIL_VALIDATION_PROVIDER_ENABLED && parsed.data.EMAIL_VALIDATION_PROVIDER_TYPE === "http") {
      const validationHostname = new URL(parsed.data.EMAIL_VALIDATION_PROVIDER_URL).hostname;
      if (!isPublicProductionProviderHostname(validationHostname)) {
        throw new ConfigurationError([{
          path: ["EMAIL_VALIDATION_PROVIDER_URL"],
          message: "Production validation provider must use a public DNS hostname"
        }]);
      }
    }
    if (Object.keys(webhookSecrets).length === 0) {
      throw new ConfigurationError([{ path: ["ESPOCRM_WEBHOOK_SECRETS_JSON"], message: "At least one webhook secret is required in production" }]);
    }
    if (parsed.data.SOURCE_INGESTION_ENABLED) {
      const missingSources = SOURCE_IDS.filter((id) => !sourceKeyrings[id]);
      if (missingSources.length) {
        throw new ConfigurationError([{ path: ["SOURCE_INGESTION_KEYRINGS_JSON"], message: `Missing production sources: ${missingSources.join(", ")}` }]);
      }
    }
  }

  if (unsubscribeKeyValues(unsubscribeSigning).includes(parsed.data.OUTREACH_HASH_KEY)) {
    throw new ConfigurationError([{ path: ["OUTREACH_HASH_KEY"], message: "Hash and unsubscribe signing keys must be independent" }]);
  }
  const reservedSigningKeys = new Set([parsed.data.OUTREACH_HASH_KEY, ...unsubscribeKeyValues(unsubscribeSigning)]);
  for (const [sourceId, ring] of Object.entries(sourceKeyrings)) {
    if (signingKeyValues(ring).some((key) => reservedSigningKeys.has(key))) {
      throw new ConfigurationError([{
        path: ["SOURCE_INGESTION_KEYRINGS_JSON", "sources", sourceId],
        message: "Source signing keys must be independent from hash and unsubscribe keys"
      }]);
    }
  }

  return Object.freeze({
    environment: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    logLevel: parsed.data.LOG_LEVEL,
    processMode: parsed.data.OUTREACH_PROCESS_MODE,
    http: Object.freeze({
      maxInFlightRequests: parsed.data.HTTP_MAX_IN_FLIGHT_REQUESTS
    }),
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
    espocrm: Object.freeze({
      baseUrl: stripTrailingSlash(parsed.data.ESPOCRM_BASE_URL),
      apiKey: parsed.data.ESPOCRM_API_KEY,
      timeoutMs: parsed.data.ESPOCRM_TIMEOUT_MS,
      maxPageSize: parsed.data.ESPOCRM_MAX_PAGE_SIZE,
      webhookSecrets
    }),
    providerCapabilities: Object.freeze({
      cacheTtlMs: parsed.data.PROVIDER_CAPABILITY_CACHE_TTL_MS
    }),
    mailgun: Object.freeze({
      apiKey: parsed.data.MAILGUN_API_KEY || undefined,
      domain: parsed.data.MAILGUN_DOMAIN || undefined,
      baseUrl: stripTrailingSlash(parsed.data.MAILGUN_BASE_URL),
      from: parsed.data.MAILGUN_FROM || undefined,
      replyTo: parsed.data.MAILGUN_REPLY_TO || undefined,
      webhookSigningKey: parsed.data.MAILGUN_WEBHOOK_SIGNING_KEY || undefined,
      healthTimeoutMs: parsed.data.MAILGUN_HEALTH_TIMEOUT_MS,
      healthMaxResponseBytes: parsed.data.MAILGUN_HEALTH_MAX_RESPONSE_BYTES,
      inboundRouteEvidence: parsed.data.MAILGUN_INBOUND_ROUTE_EVIDENCE,
      inboundRouteEvidenceReference,
      outcomeReconcile: Object.freeze({
        maxResponseBytes: parsed.data.OUTREACH_OUTCOME_RECONCILE_MAX_RESPONSE_BYTES,
        storageMaxResponseBytes: parsed.data.OUTREACH_OUTCOME_RECONCILE_STORAGE_MAX_RESPONSE_BYTES
      })
    }),
    plunk: Object.freeze({
      baseUrl: stripTrailingSlash(parsed.data.PLUNK_BASE_URL),
      apiKey: parsed.data.PLUNK_SECRET_KEY || undefined,
      from: parsed.data.PLUNK_FROM || undefined,
      replyTo: parsed.data.PLUNK_REPLY_TO || undefined,
      webhookSecret: parsed.data.PLUNK_WEBHOOK_SECRET || undefined,
      timeoutMs: parsed.data.PLUNK_TIMEOUT_MS,
      maxResponseBytes: parsed.data.PLUNK_MAX_RESPONSE_BYTES
    }),
    safety: Object.freeze({
      killSwitch: parsed.data.OUTREACH_KILL_SWITCH,
      sendEnabled: parsed.data.OUTREACH_SEND_ENABLED,
      newContactsOnlyFrom: parsed.data.OUTREACH_NEW_CONTACTS_ONLY_FROM,
      dailySendLimit: parsed.data.OUTREACH_DAILY_SEND_LIMIT,
      domainDailyLimit: parsed.data.OUTREACH_DOMAIN_DAILY_LIMIT,
      automaticResponseDailyLimit: parsed.data.OUTREACH_AUTOMATIC_RESPONSE_DAILY_LIMIT,
      automaticResponseContactLimit: parsed.data.OUTREACH_AUTOMATIC_RESPONSE_CONTACT_LIMIT,
      minHealthSample: parsed.data.OUTREACH_MIN_HEALTH_SAMPLE,
      maxBounceRate: parsed.data.OUTREACH_MAX_BOUNCE_RATE,
      maxFailureRate: parsed.data.OUTREACH_MAX_FAILURE_RATE
    }),
    policy: Object.freeze({
      matchThreshold: parsed.data.OUTREACH_MATCH_THRESHOLD,
      waitlistThreshold: parsed.data.OUTREACH_WAITLIST_THRESHOLD,
      cooldownDays: parsed.data.OUTREACH_COOLDOWN_DAYS,
      outletCooldownDays: parsed.data.OUTREACH_OUTLET_COOLDOWN_DAYS,
      maxFollowUps: parsed.data.OUTREACH_MAX_FOLLOW_UPS
    }),
    schedules: Object.freeze({
      reconcileIntervalMs: parsed.data.OUTREACH_RECONCILE_INTERVAL_MS,
      reconcileOverlapMinutes: parsed.data.OUTREACH_RECONCILE_OVERLAP_MINUTES,
      reconcileLeaseSeconds: parsed.data.OUTREACH_RECONCILE_LEASE_SECONDS,
      reconcileMaxRecordsPerEntity: parsed.data.OUTREACH_RECONCILE_MAX_RECORDS_PER_ENTITY,
      outcomeReconcileIntervalMs: parsed.data.OUTREACH_OUTCOME_RECONCILE_INTERVAL_MS,
      workPollMs: parsed.data.OUTREACH_WORK_POLL_MS,
      sendPollMs: parsed.data.OUTREACH_SEND_POLL_MS,
      healthIntervalMs: parsed.data.OUTREACH_HEALTH_INTERVAL_MS,
      shutdownTimeoutMs: parsed.data.OUTREACH_SHUTDOWN_TIMEOUT_MS
    }),
    outcomeReconcile: Object.freeze({
      enabled: parsed.data.OUTREACH_OUTCOME_RECONCILE_ENABLED,
      mailgunEnabled: parsed.data.OUTREACH_OUTCOME_RECONCILE_MAILGUN_ENABLED,
      espoEmailEnabled: parsed.data.OUTREACH_OUTCOME_RECONCILE_ESPO_EMAIL_ENABLED,
      dueMatchesEnabled: parsed.data.OUTREACH_OUTCOME_RECONCILE_DUE_MATCHES_ENABLED,
      mailgunStoredRepliesEnabled: parsed.data.OUTREACH_OUTCOME_RECONCILE_MAILGUN_STORED_REPLIES_ENABLED,
      mailgunMode: parsed.data.OUTREACH_OUTCOME_RECONCILE_MAILGUN_MODE,
      intervalMs: parsed.data.OUTREACH_OUTCOME_RECONCILE_INTERVAL_MS,
      overlapSeconds: parsed.data.OUTREACH_OUTCOME_RECONCILE_OVERLAP_SECONDS,
      settleDelaySeconds: parsed.data.OUTREACH_OUTCOME_RECONCILE_SETTLE_DELAY_SECONDS,
      initialLookbackHours: parsed.data.OUTREACH_OUTCOME_RECONCILE_INITIAL_LOOKBACK_HOURS,
      leaseSeconds: parsed.data.OUTREACH_OUTCOME_RECONCILE_LEASE_SECONDS,
      pageSize: parsed.data.OUTREACH_OUTCOME_RECONCILE_PAGE_SIZE,
      maxPagesPerInvocation: parsed.data.OUTREACH_OUTCOME_RECONCILE_MAX_PAGES,
      maximumBacklog: parsed.data.OUTREACH_OUTCOME_RECONCILE_MAX_BACKLOG,
      maxResponseBytes: parsed.data.OUTREACH_OUTCOME_RECONCILE_MAX_RESPONSE_BYTES,
      storageMaxResponseBytes: parsed.data.OUTREACH_OUTCOME_RECONCILE_STORAGE_MAX_RESPONSE_BYTES,
      replyRecoveryCapability: !parsed.data.OUTREACH_OUTCOME_RECONCILE_ENABLED
        ? "external"
        : parsed.data.OUTREACH_OUTCOME_RECONCILE_MAILGUN_STORED_REPLIES_ENABLED
          ? "mailgun_storage"
          : parsed.data.OUTREACH_OUTCOME_RECONCILE_ESPO_EMAIL_ENABLED
            ? "espocrm_incoming_email"
            : "external"
    }),
    observability: observabilityRuntime,
    concurrency: Object.freeze({
      safetyEvents: parsed.data.OUTREACH_SAFETY_EVENT_CONCURRENCY,
      projections: parsed.data.OUTREACH_PROJECTION_CONCURRENCY,
      matching: parsed.data.OUTREACH_MATCH_CONCURRENCY,
      maintenance: parsed.data.OUTREACH_MAINTENANCE_CONCURRENCY,
      sending: parsed.data.OUTREACH_SEND_CONCURRENCY
    }),
    crypto: Object.freeze({
      encryptionKey,
      keyVersion: parsed.data.OUTREACH_DATA_KEY_VERSION,
      decryptionKeys,
      hashKey: parsed.data.OUTREACH_HASH_KEY,
      hashKeyEpoch: parsed.data.OUTREACH_HASH_KEY_EPOCH,
      hashKeyBootstrapReference: parsed.data.OUTREACH_HASH_KEY_BOOTSTRAP_REFERENCE || undefined,
      hashKeyBootstrapConfirmation: parsed.data.OUTREACH_HASH_KEY_BOOTSTRAP_CONFIRM || undefined,
      unsubscribeSigning
    }),
    copyProvider: Object.freeze({
      enabled: parsed.data.COPY_PROVIDER_ENABLED,
      url: parsed.data.COPY_PROVIDER_URL || undefined,
      token: parsed.data.COPY_PROVIDER_TOKEN,
      model: parsed.data.COPY_PROVIDER_MODEL,
      timeoutMs: parsed.data.COPY_PROVIDER_TIMEOUT_MS,
      minConfidence: parsed.data.COPY_MIN_CONFIDENCE
    }),
    copyLinkCheck: Object.freeze({
      timeoutMs: parsed.data.COPY_LINK_CHECK_TIMEOUT_MS,
      maxRedirects: parsed.data.COPY_LINK_CHECK_MAX_REDIRECTS,
      maxHeaderBytes: parsed.data.COPY_LINK_CHECK_MAX_HEADER_BYTES
    }),
    sourceIngestion: Object.freeze({
      enabled: parsed.data.SOURCE_INGESTION_ENABLED,
      keyrings: sourceKeyrings,
      maxSkewSeconds: parsed.data.SOURCE_INGESTION_MAX_SKEW_SECONDS,
      maxArtifactAgeSeconds: parsed.data.SOURCE_INGESTION_MAX_ARTIFACT_AGE_SECONDS,
      maxEvidenceAgeSeconds: parsed.data.SOURCE_INGESTION_MAX_EVIDENCE_AGE_SECONDS,
      processingLeaseSeconds: parsed.data.SOURCE_INGESTION_PROCESSING_LEASE_SECONDS
    }),
    emailValidation: Object.freeze({
      enabled: parsed.data.EMAIL_VALIDATION_PROVIDER_ENABLED,
      type: parsed.data.EMAIL_VALIDATION_PROVIDER_TYPE,
      url: parsed.data.EMAIL_VALIDATION_PROVIDER_URL || undefined,
      token: parsed.data.EMAIL_VALIDATION_PROVIDER_TOKEN,
      timeoutMs: parsed.data.EMAIL_VALIDATION_PROVIDER_TIMEOUT_MS,
      healthUrl: parsed.data.EMAIL_VALIDATION_PROVIDER_HEALTH_URL || undefined,
      healthTimeoutMs: parsed.data.EMAIL_VALIDATION_PROVIDER_HEALTH_TIMEOUT_MS,
      healthMaxResponseBytes: parsed.data.EMAIL_VALIDATION_PROVIDER_HEALTH_MAX_RESPONSE_BYTES,
      heloDomain: smtpHeloDomain,
      connectTimeoutMs: parsed.data.EMAIL_VALIDATION_SMTP_CONNECT_TIMEOUT_MS,
      commandTimeoutMs: parsed.data.EMAIL_VALIDATION_SMTP_COMMAND_TIMEOUT_MS,
      totalTimeoutMs: parsed.data.EMAIL_VALIDATION_SMTP_TOTAL_TIMEOUT_MS,
      maxMxHosts: parsed.data.EMAIL_VALIDATION_SMTP_MAX_MX_HOSTS,
      cacheTtlDays: parsed.data.EMAIL_VALIDATION_CACHE_TTL_DAYS,
      mailgunBaseUrl: stripTrailingSlash(parsed.data.MAILGUN_BASE_URL),
      mailgunApiKey: parsed.data.MAILGUN_API_KEY || undefined,
      mailgunDomain: parsed.data.MAILGUN_DOMAIN || undefined
    }),
    publicBaseUrl: stripTrailingSlash(parsed.data.OUTREACH_PUBLIC_BASE_URL),
    metricsToken: parsed.data.METRICS_TOKEN
  });
}

function parseObservabilityPolicy(serialized) {
  try {
    return loadOperationalObservabilityPolicy({ OUTREACH_OBSERVABILITY_POLICY_JSON: serialized });
  } catch (cause) {
    throw new ConfigurationError([{
      path: ["OUTREACH_OBSERVABILITY_POLICY_JSON"],
      message: cause?.message ?? "Approved observability policy is invalid"
    }]);
  }
}

function validateObservabilityRuntime(data, policy) {
  const approvalReference = data.OUTREACH_OBSERVABILITY_RUNTIME_APPROVAL_REFERENCE || undefined;
  const runtime = {
    enabled: policy.enabled === true,
    policy,
    approvalReference,
    captureIntervalMs: policy.enabled === true ? policy.sampleIntervalSeconds * 1_000 : undefined,
    pruneIntervalMs: data.OUTREACH_OBSERVABILITY_PRUNE_INTERVAL_MS,
    retryIntervalMs: data.OUTREACH_OBSERVABILITY_RETRY_INTERVAL_MS,
    pruneMaxBatches: data.OUTREACH_OBSERVABILITY_PRUNE_MAX_BATCHES,
    capacityHeadroomSamples: data.OUTREACH_OBSERVABILITY_CAPACITY_HEADROOM_SAMPLES,
    projector: Object.freeze({
      intervalMs: data.OUTREACH_ALERT_PROJECTOR_INTERVAL_MS,
      batchSize: data.OUTREACH_ALERT_PROJECTOR_BATCH_SIZE,
      maximumBacklog: data.OUTREACH_ALERT_OUTBOX_MAX_BACKLOG
    }),
    alertRouter: Object.freeze({
      mode: "durable_outbox",
      configured: policy.enabled === true,
      available: policy.enabled === true,
      ...(policy.enabled === true ? { reference: approvalReference } : { reason: "approved_policy_unconfigured" })
    }),
    dashboard: Object.freeze({
      mode: "protected_prometheus",
      configured: policy.enabled === true,
      available: policy.enabled === true,
      ...(policy.enabled === true ? { reference: approvalReference } : { reason: "approved_policy_unconfigured" })
    })
  };
  if (!policy.enabled) return Object.freeze(runtime);
  if (!approvalReference) {
    throw new ConfigurationError([{
      path: ["OUTREACH_OBSERVABILITY_RUNTIME_APPROVAL_REFERENCE"],
      message: "An approved runtime reference is required for enabled observability"
    }]);
  }
  const captureIntervalMs = policy.sampleIntervalSeconds * 1_000;
  if (data.OUTREACH_OBSERVABILITY_PRUNE_INTERVAL_MS % captureIntervalMs !== 0) {
    throw new ConfigurationError([{
      path: ["OUTREACH_OBSERVABILITY_PRUNE_INTERVAL_MS"],
      message: "Must be an exact multiple of the approved sample interval"
    }]);
  }
  if (data.OUTREACH_OBSERVABILITY_RETRY_INTERVAL_MS >= Math.min(
    captureIntervalMs,
    data.OUTREACH_OBSERVABILITY_PRUNE_INTERVAL_MS,
    data.OUTREACH_ALERT_PROJECTOR_INTERVAL_MS
  )) {
    throw new ConfigurationError([{
      path: ["OUTREACH_OBSERVABILITY_RETRY_INTERVAL_MS"],
      message: "Retry interval must be shorter than every supervised cadence"
    }]);
  }
  const capturesBetweenPrunes = data.OUTREACH_OBSERVABILITY_PRUNE_INTERVAL_MS / captureIntervalMs;
  const requiredSampleCapacity = capturesBetweenPrunes + data.OUTREACH_OBSERVABILITY_CAPACITY_HEADROOM_SAMPLES;
  for (const [path, capacity] of [
    ["maximumSnapshots", policy.maximumSnapshots],
    ["maximumEvaluationsPerRule", policy.maximumEvaluationsPerRule],
    ["maximumEventsPerRule", policy.maximumEventsPerRule]
  ]) {
    if (capacity < requiredSampleCapacity) {
      throw new ConfigurationError([{
        path: ["OUTREACH_OBSERVABILITY_POLICY_JSON", path],
        message: `Must reserve at least ${requiredSampleCapacity} rows for prune cadence and approved headroom`
      }]);
    }
  }
  const approvedWindowMs = data.OUTREACH_OBSERVABILITY_PRUNE_INTERVAL_MS
    + data.OUTREACH_OBSERVABILITY_CAPACITY_HEADROOM_SAMPLES * captureIntervalMs;
  const requiredRollupCapacity = Math.ceil(approvedWindowMs / (policy.rollupBucketSeconds * 1_000));
  if (policy.maximumRollupBucketsPerMetric < requiredRollupCapacity) {
    throw new ConfigurationError([{
      path: ["OUTREACH_OBSERVABILITY_POLICY_JSON", "maximumRollupBucketsPerMetric"],
      message: `Must reserve at least ${requiredRollupCapacity} rollup buckets for prune cadence and approved headroom`
    }]);
  }
  const maximumPruneRows = policy.pruneBatchSize * data.OUTREACH_OBSERVABILITY_PRUNE_MAX_BATCHES;
  if (maximumPruneRows < requiredSampleCapacity) {
    throw new ConfigurationError([{
      path: ["OUTREACH_OBSERVABILITY_PRUNE_MAX_BATCHES"],
      message: `A prune run must process at least ${requiredSampleCapacity} rows per evidence stream`
    }]);
  }
  if (data.OUTREACH_ALERT_OUTBOX_MAX_BACKLOG < data.OUTREACH_ALERT_PROJECTOR_BATCH_SIZE + data.OUTREACH_OBSERVABILITY_CAPACITY_HEADROOM_SAMPLES) {
    throw new ConfigurationError([{
      path: ["OUTREACH_ALERT_OUTBOX_MAX_BACKLOG"],
      message: "Outbox backlog must exceed one projector batch by the approved headroom"
    }]);
  }
  return Object.freeze(runtime);
}

function parseSecretMap(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ConfigurationError([{ path: ["ESPOCRM_WEBHOOK_SECRETS_JSON"], message: "Must be valid JSON" }]);
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new ConfigurationError([{ path: ["ESPOCRM_WEBHOOK_SECRETS_JSON"], message: "Must be an object" }]);
  }

  for (const [id, secret] of Object.entries(parsed)) {
    if (!id || typeof secret !== "string" || secret.length < 16) {
      throw new ConfigurationError([{ path: ["ESPOCRM_WEBHOOK_SECRETS_JSON", id], message: "Secret must be at least 16 characters" }]);
    }
  }

  return Object.freeze({ ...parsed });
}

function parseUnsubscribeKeyring(value, legacyV1VerifyKey, legacyV1VerifyUntil) {
  const parsed = parseJsonObject(value, "OUTREACH_UNSUBSCRIBE_KEYRING_JSON");
  assertExactKeys(parsed, ["schemaVersion", "active", "verifyOnly"], ["OUTREACH_UNSUBSCRIBE_KEYRING_JSON"]);
  if (parsed.schemaVersion !== 2) {
    throw new ConfigurationError([{ path: ["OUTREACH_UNSUBSCRIBE_KEYRING_JSON", "schemaVersion"], message: "Must equal 2" }]);
  }
  const ring = parseSigningKeyring(
    { active: parsed.active, verifyOnly: parsed.verifyOnly },
    ["OUTREACH_UNSUBSCRIBE_KEYRING_JSON"]
  );
  const legacy = legacyV1VerifyKey || undefined;
  const legacyUntil = legacyV1VerifyUntil || undefined;
  if (Boolean(legacy) !== Boolean(legacyUntil)) {
    throw new ConfigurationError([{
      path: ["OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_UNTIL"],
      message: "Legacy verification key and deadline must be configured together"
    }]);
  }
  if (legacy && (legacy.length < 32 || legacy.length > 512)) {
    throw new ConfigurationError([{ path: ["OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_KEY"], message: "Legacy verification key must contain 32-512 characters" }]);
  }
  if (legacy && signingKeyValues(ring).includes(legacy)) {
    throw new ConfigurationError([{ path: ["OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_KEY"], message: "Legacy verification key must be independent from v2 keys" }]);
  }
  if (legacyUntil) {
    const cutoff = Date.parse(legacyUntil);
    const maximum = new Date();
    maximum.setUTCFullYear(maximum.getUTCFullYear() + 2);
    if (!Number.isFinite(cutoff) || new Date(cutoff).toISOString() !== legacyUntil || cutoff > maximum.getTime()) {
      throw new ConfigurationError([{
        path: ["OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_UNTIL"],
        message: "Legacy verification deadline must be an exact ISO timestamp no more than two years ahead"
      }]);
    }
  }
  return Object.freeze({ ...ring, legacyV1VerifyKey: legacy, legacyV1VerifyUntil: legacyUntil });
}

function parseSourceKeyrings(value) {
  const parsed = parseJsonObject(value, "SOURCE_INGESTION_KEYRINGS_JSON");
  assertExactKeys(parsed, ["schemaVersion", "sources"], ["SOURCE_INGESTION_KEYRINGS_JSON"]);
  if (parsed.schemaVersion !== 2) {
    throw new ConfigurationError([{ path: ["SOURCE_INGESTION_KEYRINGS_JSON", "schemaVersion"], message: "Must equal 2" }]);
  }
  if (!parsed.sources || Array.isArray(parsed.sources) || typeof parsed.sources !== "object") {
    throw new ConfigurationError([{ path: ["SOURCE_INGESTION_KEYRINGS_JSON", "sources"], message: "Must be an object" }]);
  }
  const entries = Object.entries(parsed.sources);
  if (entries.length > SOURCE_IDS.length) {
    throw new ConfigurationError([{ path: ["SOURCE_INGESTION_KEYRINGS_JSON", "sources"], message: `At most ${SOURCE_IDS.length} sources are allowed` }]);
  }
  const result = Object.create(null);
  const keyOwners = new Map();
  for (const [sourceId, rawRing] of entries) {
    const path = ["SOURCE_INGESTION_KEYRINGS_JSON", "sources", sourceId];
    if (!SOURCE_IDS.includes(sourceId)) throw new ConfigurationError([{ path, message: "Unknown source ID" }]);
    const ring = parseSigningKeyring(rawRing, path);
    for (const key of signingKeyValues(ring)) {
      const owner = keyOwners.get(key);
      if (owner && owner !== sourceId) {
        throw new ConfigurationError([{ path, message: `Signing key material must be unique per source; already used by ${owner}` }]);
      }
      keyOwners.set(key, sourceId);
    }
    result[sourceId] = ring;
  }
  return Object.freeze(result);
}

function parseSigningKeyring(input, path) {
  if (!input || Array.isArray(input) || typeof input !== "object") {
    throw new ConfigurationError([{ path, message: "Keyring must be an object" }]);
  }
  assertExactKeys(input, ["active", "verifyOnly"], path);
  const active = parseSigningKey(input.active, [...path, "active"]);
  if (!Array.isArray(input.verifyOnly) || input.verifyOnly.length > 5) {
    throw new ConfigurationError([{ path: [...path, "verifyOnly"], message: "Must contain at most 5 historical keys" }]);
  }
  const historical = input.verifyOnly.map((item, index) => parseSigningKey(item, [...path, "verifyOnly", String(index)]));
  const kids = new Set([active.kid]);
  const keys = new Set([active.key]);
  for (const item of historical) {
    if (kids.has(item.kid)) throw new ConfigurationError([{ path: [...path, "verifyOnly"], message: `Duplicate key ID ${item.kid}` }]);
    if (keys.has(item.key)) throw new ConfigurationError([{ path: [...path, "verifyOnly"], message: "Duplicate signing key material" }]);
    kids.add(item.kid);
    keys.add(item.key);
  }
  return Object.freeze({ schemaVersion: 2, active, verifyOnly: Object.freeze(historical) });
}

function parseSigningKey(input, path) {
  if (!input || Array.isArray(input) || typeof input !== "object") {
    throw new ConfigurationError([{ path, message: "Signing key must be an object" }]);
  }
  assertExactKeys(input, ["kid", "key"], path);
  if (typeof input.kid !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/u.test(input.kid)) {
    throw new ConfigurationError([{ path: [...path, "kid"], message: "Key ID must contain 1-32 safe identifier characters" }]);
  }
  if (typeof input.key !== "string" || input.key.length < 32 || input.key.length > 512) {
    throw new ConfigurationError([{ path: [...path, "key"], message: "Signing key must contain 32-512 characters" }]);
  }
  return Object.freeze({ kid: input.kid, key: input.key });
}

function parseJsonObject(value, environmentName) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ConfigurationError([{ path: [environmentName], message: "Must be valid JSON" }]);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new ConfigurationError([{ path: [environmentName], message: "Must be an object" }]);
  }
  return parsed;
}

function assertExactKeys(value, expected, path) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new ConfigurationError([{ path, message: `Expected exact keys: ${wanted.join(", ")}` }]);
  }
}

function signingKeyValues(ring) {
  return [ring.active.key, ...ring.verifyOnly.map((item) => item.key)];
}

function unsubscribeKeyValues(ring) {
  return [...signingKeyValues(ring), ring.legacyV1VerifyKey].filter(Boolean);
}

function decodeEncryptionKey(value, path = ["OUTREACH_DATA_ENCRYPTION_KEY"]) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) {
    throw new ConfigurationError([{ path, message: "Must be valid base64" }]);
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new ConfigurationError([{ path, message: "Must decode to exactly 32 bytes" }]);
  }
  return key;
}

function parseDecryptionKeys(value, activeVersion) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ConfigurationError([{ path: ["OUTREACH_DATA_DECRYPTION_KEYS_JSON"], message: "Must be valid JSON" }]);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new ConfigurationError([{ path: ["OUTREACH_DATA_DECRYPTION_KEYS_JSON"], message: "Must be an object" }]);
  }
  const entries = Object.entries(parsed);
  if (entries.length > 10) {
    throw new ConfigurationError([{ path: ["OUTREACH_DATA_DECRYPTION_KEYS_JSON"], message: "At most 10 historical keys are allowed" }]);
  }
  const keys = Object.create(null);
  for (const [version, encodedKey] of entries) {
    const path = ["OUTREACH_DATA_DECRYPTION_KEYS_JSON", version];
    if (!/^[A-Za-z0-9._-]{1,32}$/u.test(version)) {
      throw new ConfigurationError([{ path, message: "Key version must contain 1-32 safe identifier characters" }]);
    }
    if (version === activeVersion) {
      throw new ConfigurationError([{ path, message: "Historical key map must not redefine the active key version" }]);
    }
    keys[version] = decodeEncryptionKey(encodedKey, path);
  }
  return Object.freeze(keys);
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/u, "");
}

function isDnsHostname(value) {
  return typeof value === "string"
    && /^(?=.{1,253}\.?$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.?$/iu.test(value);
}

function assertCredentialFreeProviderUrl(url, environmentName) {
  if (url.username || url.password || url.hash || url.search) {
    throw new ConfigurationError([{
      path: [environmentName],
      message: "Provider URLs must not contain credentials, query parameters, or fragments"
    }]);
  }
}

function isPublicProductionProviderHostname(value) {
  const hostname = String(value).toLowerCase().replace(/\.$/u, "");
  return isDnsHostname(hostname)
    && !FORBIDDEN_PRODUCTION_PROVIDER_SUFFIXES.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix));
}

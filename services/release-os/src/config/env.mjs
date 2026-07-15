import { isProductionRuntime } from "./runtime-environment.mjs";

const REGION_BASE_URLS = Object.freeze({
  us: "https://api.mailgun.net",
  eu: "https://api.eu.mailgun.net"
});

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_EMAIL_TIMEOUT_SECONDS = 15;
const DEFAULT_EMAIL_MAX_ATTEMPTS = 2;
const DEFAULT_PLUNK_BASE_URL = "https://mail.marcsmusic.nl";

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Resolve the provider-neutral application email contract.
 *
 * Release OS deliberately does not infer a provider from legacy MAILGUN_*
 * variables. A production process must opt into Plunk explicitly and provide
 * a secret and HTTPS API endpoint; otherwise campaign sends fail closed.
 */
export function resolvePlunkConfig(env = process.env) {
  const provider = optionalEnv(env, "EMAIL_PROVIDER") ?? "plunk";
  if (provider !== "plunk") {
    throw new ConfigError("EMAIL_PROVIDER must be 'plunk'");
  }

  const secretKey = requireEnv(env, "PLUNK_SECRET_KEY");
  const baseUrl = normalizePlunkBaseUrl(
    optionalEnv(env, "PLUNK_BASE_URL") ?? DEFAULT_PLUNK_BASE_URL,
    env
  );
  const defaultFrom = optionalEnv(env, "EMAIL_FROM") ?? optionalEnv(env, "PLUNK_FROM");
  if (!defaultFrom) {
    throw new ConfigError("EMAIL_FROM or PLUNK_FROM is required");
  }
  const fromName = optionalEnv(env, "EMAIL_FROM_NAME") ?? "MarcsMusic";
  const timeoutMs = env.EMAIL_TIMEOUT_SECONDS !== undefined && env.EMAIL_TIMEOUT_SECONDS !== ""
    ? parsePositiveInteger(env.EMAIL_TIMEOUT_SECONDS, DEFAULT_EMAIL_TIMEOUT_SECONDS, "EMAIL_TIMEOUT_SECONDS") * 1_000
    : parsePositiveInteger(env.PLUNK_TIMEOUT_MS, DEFAULT_EMAIL_TIMEOUT_SECONDS * 1_000, "PLUNK_TIMEOUT_MS");
  const maxAttempts = parsePositiveInteger(
    env.EMAIL_MAX_ATTEMPTS,
    DEFAULT_EMAIL_MAX_ATTEMPTS,
    "EMAIL_MAX_ATTEMPTS"
  );
  const sendEnabled = parseBoolean(env.PLUNK_SEND_ENABLED, false, "PLUNK_SEND_ENABLED");

  return Object.freeze({
    provider,
    secretKey,
    baseUrl,
    sendPath: "/v1/send",
    defaultFrom,
    fromName,
    timeoutMs,
    maxAttempts,
    sendEnabled,
    maxResponseBytes: configuredPositiveInteger(
      env.EMAIL_MAX_RESPONSE_BYTES ?? env.PLUNK_MAX_RESPONSE_BYTES,
      64 * 1024
    ),
    ...(optionalEnv(env, "PLUNK_REPLY_TO") ?? optionalEnv(env, "EMAIL_REPLY_TO")
      ? { replyTo: optionalEnv(env, "PLUNK_REPLY_TO") ?? optionalEnv(env, "EMAIL_REPLY_TO") }
      : {})
  });
}

export function resolveMailgunConfig(env = process.env) {
  const apiKey = requireEnv(env, "MAILGUN_API_KEY");
  const domain = requireEnv(env, "MAILGUN_DOMAIN");
  const region = normalizeRegion(env.MAILGUN_REGION ?? "us");
  const baseUrl = normalizeBaseUrl(env.MAILGUN_BASE_URL ?? REGION_BASE_URLS[region]);
  const timeoutMs = parsePositiveInteger(
    env.MAILGUN_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    "MAILGUN_TIMEOUT_MS"
  );

  return Object.freeze({
    apiKey,
    domain,
    region,
    baseUrl,
    defaultFrom: optionalEnv(env, "MAILGUN_FROM"),
    timeoutMs
  });
}

export function requireEnv(env, key) {
  const value = optionalEnv(env, key);

  if (!value) {
    throw new ConfigError(`${key} is required`);
  }

  return value;
}

function optionalEnv(env, key) {
  const value = env[key];
  return typeof value === "string" ? value.trim() : undefined;
}

function normalizeRegion(value) {
  const region = String(value).trim().toLowerCase();

  if (!Object.hasOwn(REGION_BASE_URLS, region)) {
    throw new ConfigError("MAILGUN_REGION must be either 'us' or 'eu'");
  }

  return region;
}

function normalizeBaseUrl(value) {
  const baseUrl = String(value).trim().replace(/\/+$/u, "");

  if (!baseUrl) {
    throw new ConfigError("MAILGUN_BASE_URL cannot be empty");
  }

  try {
    const parsedUrl = new URL(baseUrl);

    if (parsedUrl.protocol !== "https:") {
      throw new ConfigError("MAILGUN_BASE_URL must use https");
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }

    throw new ConfigError("MAILGUN_BASE_URL must be a valid URL");
  }

  return baseUrl;
}

function normalizePlunkBaseUrl(value, env) {
  const baseUrl = String(value).trim().replace(/\/+$/u, "");

  if (!baseUrl) {
    throw new ConfigError("PLUNK_BASE_URL cannot be empty");
  }

  try {
    const parsedUrl = new URL(baseUrl);
    const localHttp = parsedUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname);

    if (parsedUrl.protocol !== "https:" && !(localHttp && !isProductionRuntime(env))) {
      throw new ConfigError("PLUNK_BASE_URL must use https in production");
    }
    if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
      throw new ConfigError("PLUNK_BASE_URL must not contain credentials or query parameters");
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }

    throw new ConfigError("PLUNK_BASE_URL must be a valid URL");
  }

  return baseUrl;
}

function parsePositiveInteger(value, fallback, key) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ConfigError(`${key} must be a positive integer`);
  }

  return parsed;
}

function configuredPositiveInteger(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value, fallback, key) {
  if (value === undefined || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new ConfigError(`${key} must be either 'true' or 'false'`);
}

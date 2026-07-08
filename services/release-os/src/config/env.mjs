const REGION_BASE_URLS = Object.freeze({
  us: "https://api.mailgun.net",
  eu: "https://api.eu.mailgun.net"
});

const DEFAULT_TIMEOUT_MS = 10_000;

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
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

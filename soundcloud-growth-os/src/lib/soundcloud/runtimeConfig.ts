export type SoundCloudRuntimeEnv = Record<string, string | undefined>;

const DEFAULT_API_DEADLINE_MS = 15_000;
const DEFAULT_API_MAX_RESPONSE_BYTES = 1_048_576;
const DEFAULT_REFRESH_LOCK_WAIT_MS = 1_500;
const DEFAULT_HEALTH_DB_TIMEOUT_MS = 2_000;

export class SoundCloudRuntimeConfigurationError extends Error {
  constructor() {
    super("SoundCloud runtime limits are not configured safely.");
    this.name = "SoundCloudRuntimeConfigurationError";
  }
}

function boundedInteger(
  env: SoundCloudRuntimeEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  if (!/^[0-9]+$/u.test(raw)) throw new SoundCloudRuntimeConfigurationError();

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new SoundCloudRuntimeConfigurationError();
  }
  return value;
}

export function getSoundCloudApiReliabilityConfig(env: SoundCloudRuntimeEnv = process.env) {
  const deadlineMs = boundedInteger(env, "SOUNDCLOUD_API_DEADLINE_MS", DEFAULT_API_DEADLINE_MS, 1_000, 30_000);
  const maxResponseBytes = boundedInteger(
    env,
    "SOUNDCLOUD_API_MAX_RESPONSE_BYTES",
    DEFAULT_API_MAX_RESPONSE_BYTES,
    1_024,
    4_194_304
  );

  return {
    deadlineMs,
    attemptTimeoutMs: Math.min(5_000, deadlineMs),
    maxResponseBytes,
    maxRetryDelayMs: Math.min(5_000, Math.max(250, Math.floor(deadlineMs / 3))),
    retryJitterMs: 250
  };
}

export function getSoundCloudRefreshLeaseConfig(env: SoundCloudRuntimeEnv = process.env) {
  const lockWaitMs = boundedInteger(
    env,
    "SOUNDCLOUD_REFRESH_LOCK_WAIT_MS",
    DEFAULT_REFRESH_LOCK_WAIT_MS,
    0,
    5_000
  );

  return {
    lockWaitMs,
    pollIntervalMs: 50,
    transactionMaxWaitMs: 2_000,
    // The provider refresh request has a hard 10 second deadline. Keep the
    // transaction envelope comfortably above that while still bounding it.
    transactionTimeoutMs: 20_000 + lockWaitMs
  };
}

export function getSoundCloudHealthConfig(env: SoundCloudRuntimeEnv = process.env) {
  return {
    databaseTimeoutMs: boundedInteger(
      env,
      "SOUNDCLOUD_HEALTH_DB_TIMEOUT_MS",
      DEFAULT_HEALTH_DB_TIMEOUT_MS,
      100,
      5_000
    )
  };
}

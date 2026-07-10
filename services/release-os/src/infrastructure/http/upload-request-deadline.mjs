const DEFAULT_BODY_TIMEOUT_MS = 120_000;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 10 * 60_000;

export function resolveUploadRequestDeadlines(options = {}) {
  const bodyTimeoutMs = parseTimeout(options.bodyTimeoutMs, DEFAULT_BODY_TIMEOUT_MS, "bodyTimeoutMs");
  const idleTimeoutMs = parseTimeout(options.idleTimeoutMs, DEFAULT_IDLE_TIMEOUT_MS, "idleTimeoutMs");

  if (idleTimeoutMs > bodyTimeoutMs) {
    throw new RangeError("idleTimeoutMs must not exceed bodyTimeoutMs");
  }

  return Object.freeze({ bodyTimeoutMs, idleTimeoutMs });
}

function parseTimeout(value, fallback, name) {
  const candidate = value ?? fallback;
  const parsed =
    typeof candidate === "string" && /^\d+$/u.test(candidate.trim())
      ? Number(candidate)
      : candidate;

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_TIMEOUT_MS) {
    throw new RangeError(`${name} must be an integer between 1 and ${MAX_TIMEOUT_MS}`);
  }

  return parsed;
}

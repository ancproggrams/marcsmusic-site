import { ApplicationError } from "../errors.mjs";
import { parseApprovedHttpsOrigins } from "../domain/epk-verification.mjs";

export function loadEpkVerifierConfig(env = process.env) {
  const enabledRaw = env.EPK_VERIFIER_ENABLED ?? "false";
  if (!new Set(["true", "false"]).has(enabledRaw)) throw configError("EPK_VERIFIER_ENABLED");
  if (enabledRaw !== "true") return Object.freeze({ enabled: false });

  const baseUrl = exactHttpsOrigin(env.ESPOCRM_BASE_URL, "ESPOCRM_BASE_URL");
  const apiKey = String(env.ESPOCRM_API_KEY ?? "");
  if (apiKey.length < 12) throw configError("ESPOCRM_API_KEY");
  const approvedOrigins = parseApprovedHttpsOrigins(env.EPK_VERIFIER_APPROVED_HTTPS_ORIGINS);

  return Object.freeze({
    enabled: true,
    espocrm: Object.freeze({
      baseUrl,
      apiKey,
      timeoutMs: boundedInteger(env.ESPOCRM_TIMEOUT_MS, 10_000, 500, 30_000, "ESPOCRM_TIMEOUT_MS"),
      maxPageSize: 50
    }),
    verifier: Object.freeze({
      approvedOrigins,
      totalTimeoutMs: boundedInteger(env.EPK_VERIFIER_TOTAL_TIMEOUT_MS, 20_000, 1_000, 60_000, "EPK_VERIFIER_TOTAL_TIMEOUT_MS"),
      maxRedirects: boundedInteger(env.EPK_VERIFIER_MAX_REDIRECTS, 2, 0, 3, "EPK_VERIFIER_MAX_REDIRECTS"),
      maxHeaderBytes: boundedInteger(env.EPK_VERIFIER_MAX_HEADER_BYTES, 16_384, 4_096, 65_536, "EPK_VERIFIER_MAX_HEADER_BYTES"),
      maxJsonBodyBytes: boundedInteger(env.EPK_VERIFIER_MAX_JSON_BODY_BYTES, 262_144, 16_384, 1_048_576, "EPK_VERIFIER_MAX_JSON_BODY_BYTES"),
      maxHtmlBodyBytes: boundedInteger(env.EPK_VERIFIER_MAX_HTML_BODY_BYTES, 524_288, 16_384, 1_048_576, "EPK_VERIFIER_MAX_HTML_BODY_BYTES"),
      maxAssetBytes: boundedInteger(env.EPK_VERIFIER_MAX_ASSET_BYTES, 1_073_741_824, 1_024, 2_147_483_648, "EPK_VERIFIER_MAX_ASSET_BYTES"),
      maxBatchSize: boundedInteger(env.EPK_VERIFIER_MAX_BATCH_SIZE, 10, 1, 25, "EPK_VERIFIER_MAX_BATCH_SIZE")
    })
  });
}

function boundedInteger(value, fallback, minimum, maximum, path) {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw configError(path);
  return parsed;
}

function exactHttpsOrigin(value, path) {
  const raw = String(value ?? "");
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw configError(path);
  }
  if (
    parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port ||
    parsed.pathname !== "/" || parsed.search || parsed.hash || raw !== parsed.origin
  ) {
    throw configError(path);
  }
  return parsed.origin;
}

function configError(path) {
  return new ApplicationError("EPK verifier configuration is invalid", {
    code: "EPK_VERIFIER_CONFIGURATION_INVALID",
    statusCode: 500,
    retryable: false,
    details: { fields: [path] }
  });
}

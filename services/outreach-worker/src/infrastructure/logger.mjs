import pino from "pino";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.x-api-key",
  "*.apiKey",
  "*.token",
  "*.email",
  "*.emailAddress",
  "*.bodyText",
  "*.bodyHtml",
  "*.contactEvidence"
];

export function createLogger(level = "info") {
  return pino({
    level,
    base: { service: "marcsmusic-outreach-worker" },
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    serializers: {
      err(error) {
        return { type: error?.name, message: error?.message, code: error?.code, stack: error?.stack };
      }
    }
  });
}

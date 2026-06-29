import { createHash, timingSafeEqual } from "node:crypto";

export class OutreachPolicyError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "OutreachPolicyError";
    this.status = status;
    this.code = code;
  }
}

type Env = Record<string, string | undefined>;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function digestHex(value: string) {
  return digest(value).toString("hex");
}

function constantTimeEquals(actual: string, expected: string) {
  return timingSafeEqual(digest(actual), digest(expected));
}

export function requireOutreachMailToken(headers: Headers, env: Env = process.env) {
  const expectedToken = env.OUTREACH_MAIL_TOKEN?.trim();
  if (!expectedToken) {
    throw new OutreachPolicyError("Outreach mail token is not configured.", 503, "OUTREACH_TOKEN_NOT_CONFIGURED");
  }

  const authorization = headers.get("authorization") ?? "";
  const bearerToken = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  const headerToken = headers.get("x-outreach-mail-token")?.trim() ?? "";
  const providedToken = bearerToken || headerToken;

  if (!providedToken || !constantTimeEquals(providedToken, expectedToken)) {
    throw new OutreachPolicyError("Valid outreach mail token is required.", 401, "OUTREACH_TOKEN_REQUIRED");
  }

  return digestHex(providedToken);
}

export function assertHumanApprovedOutreach(approved: boolean) {
  if (!approved) {
    throw new OutreachPolicyError("Outreach email must be explicitly human-approved.", 400, "OUTREACH_APPROVAL_REQUIRED");
  }
}

function parseAllowedDomains(value?: string) {
  return (value ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function assertRecipientAllowed(email: string, allowedDomains = process.env.OUTREACH_ALLOWED_RECIPIENT_DOMAINS) {
  const domains = parseAllowedDomains(allowedDomains);
  if (!domains.length) return;

  const recipientDomain = email.split("@").at(-1)?.toLowerCase();
  if (!recipientDomain || !domains.includes(recipientDomain)) {
    throw new OutreachPolicyError("Recipient domain is not allowed for outreach email.", 403, "RECIPIENT_DOMAIN_NOT_ALLOWED");
  }
}

type RateLimitWindow = {
  count: number;
  windowStart: number;
};

const rateLimitWindowMs = 60 * 60 * 1000;
const outreachRateLimits = new Map<string, RateLimitWindow>();

function parseHourlyLimit(env: Env) {
  const rawLimit = env.OUTREACH_MAX_EMAILS_PER_HOUR?.trim();
  if (!rawLimit) return 20;

  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1000) {
    throw new OutreachPolicyError("OUTREACH_MAX_EMAILS_PER_HOUR must be an integer from 1 to 1000.", 503, "OUTREACH_RATE_LIMIT_INVALID");
  }

  return parsed;
}

export function assertOutreachRateLimit(identifier: string, env: Env = process.env, now = Date.now()) {
  const limit = parseHourlyLimit(env);
  const key = digestHex(identifier);
  const current = outreachRateLimits.get(key);
  const windowState =
    current && now - current.windowStart < rateLimitWindowMs
      ? current
      : {
          count: 0,
          windowStart: now
        };

  if (windowState.count >= limit) {
    throw new OutreachPolicyError("Outreach hourly send limit exceeded.", 429, "OUTREACH_RATE_LIMITED");
  }

  windowState.count += 1;
  outreachRateLimits.set(key, windowState);

  return {
    limit,
    remaining: Math.max(0, limit - windowState.count),
    resetAt: new Date(windowState.windowStart + rateLimitWindowMs).toISOString()
  };
}

export function resetOutreachRateLimits() {
  outreachRateLimits.clear();
}

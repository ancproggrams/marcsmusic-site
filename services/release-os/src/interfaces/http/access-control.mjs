import { timingSafeEqual } from "node:crypto";

const HUMAN_GRANTS = Object.freeze({
  viewer: ["read"],
  editor: ["read", "edit"],
  publisher: ["read", "publish"],
  "campaign-sender": ["read", "campaign"],
  administrator: ["*"]
});
const SERVICE_PERMISSIONS = new Set([
  "ops:read",
  "releases:read",
  "releases:write",
  "releases:publish",
  "player:sync",
  "campaigns:read",
  "campaigns:send"
]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isPublicLiveness(request, pathname) {
  return request.method === "GET" && pathname === "/livez" && !requestHasBody(request);
}

export function requestHasBody(request) {
  if (request.headers["transfer-encoding"] != null) return true;
  const contentLength = request.headers["content-length"];
  return contentLength != null && Number(contentLength) !== 0;
}

export function normalizeAllowedOrigins(value) {
  const entries = value instanceof Set || Array.isArray(value) ? [...value] : String(value ?? "").split(",");
  const origins = new Set();
  for (const entry of entries.map((item) => String(item).trim()).filter(Boolean)) {
    const url = new URL(entry);
    if (entry !== url.origin) throw new TypeError("Release OS allowed origins must be exact origins");
    origins.add(url.origin);
  }
  return origins;
}

export async function authorizeRequest(request, url, options = {}) {
  const isMutation = MUTATING_METHODS.has(request.method);
  const closeConnection = true;
  if (typeof options.authenticateRequest !== "function") {
    throw accessError(503, "Authentication is unavailable.", "AUTHENTICATION_UNAVAILABLE", closeConnection);
  }

  let rawPrincipal;
  try {
    rawPrincipal = await options.authenticateRequest(request);
  } catch {
    throw accessError(503, "Authentication is unavailable.", "AUTHENTICATION_UNAVAILABLE", closeConnection);
  }
  if (rawPrincipal == null) {
    throw accessError(401, "Authentication is required.", "AUTHENTICATION_REQUIRED", closeConnection);
  }

  const principal = normalizePrincipal(rawPrincipal, closeConnection);
  const policy = policyFor(request.method, url.pathname);
  if (!isAuthorized(principal, policy)) {
    throw accessError(403, "Access is forbidden.", "AUTHORIZATION_FORBIDDEN", closeConnection);
  }
  if (principal.kind === "human" && isMutation) {
    enforceHumanMutation(request, principal, options.allowedOrigins, closeConnection);
  }
  return principal;
}

function normalizePrincipal(principal, closeConnection) {
  const subject = typeof principal?.subject === "string" ? principal.subject.trim() : "";
  if (!subject || subject.length > 300) throw invalidPrincipal(closeConnection);

  if (principal.kind === "human") {
    const roles = normalizeClaims(principal.roles, new Set(Object.keys(HUMAN_GRANTS)));
    const csrfToken = typeof principal.csrfToken === "string" ? principal.csrfToken : "";
    if (!roles.length || !csrfToken || csrfToken.length > 2_048) throw invalidPrincipal(closeConnection);
    return Object.freeze({ kind: "human", subject, roles: Object.freeze(roles), csrfToken });
  }
  if (principal.kind === "service") {
    const permissions = normalizeClaims(principal.permissions, SERVICE_PERMISSIONS);
    if (!permissions.length) throw invalidPrincipal(closeConnection);
    return Object.freeze({ kind: "service", subject, permissions: Object.freeze(permissions) });
  }
  throw invalidPrincipal(closeConnection);
}

function normalizeClaims(value, allowed) {
  if (!Array.isArray(value)) return [];
  const claims = [...new Set(value)];
  return claims.every((claim) => typeof claim === "string" && allowed.has(claim)) ? claims : [];
}

function policyFor(method, pathname) {
  if (method === "GET" && pathname === "/health") return { admin: true, service: "ops:read" };
  if (method === "GET" && pathname === "/music/app") return { human: "read" };
  if (
    method === "GET" &&
    (pathname.startsWith("/assets/audio/") ||
      pathname.startsWith("/assets/artwork/") ||
      pathname === "/music/platforms" ||
      pathname === "/music/artists" ||
      /^\/music\/artists\/[^/]+$/u.test(pathname) ||
      /^\/music\/releases\/[^/]+$/u.test(pathname))
  ) {
    return { human: "read", service: "releases:read" };
  }
  if (method === "GET" && /^\/music\/email-campaigns\/[^/]+(?:\/recipients)?$/u.test(pathname)) {
    return { human: "campaign", service: "campaigns:read" };
  }
  if (method === "POST" && /^\/music\/releases\/[^/]+\/email-campaigns\/(?:preview|test|send)$/u.test(pathname)) {
    return { human: "campaign", service: "campaigns:send" };
  }
  if (method === "POST" && (pathname === "/music/releases/publish" || /^\/music\/releases\/[^/]+\/publish$/u.test(pathname))) {
    return { human: "publish", service: "releases:publish" };
  }
  if (method === "POST" && /^\/music\/releases\/[^/]+\/player-sync$/u.test(pathname)) {
    return { human: "publish", service: "player:sync" };
  }
  if (
    (method === "POST" && ["/music/artists", "/music/releases", "/music/releases/plan"].includes(pathname)) ||
    (method === "PATCH" && /^\/music\/artists\/[^/]+$/u.test(pathname)) ||
    (method === "POST" && /^\/music\/releases\/[^/]+\/plan$/u.test(pathname))
  ) {
    return { human: "edit", service: "releases:write" };
  }
  if (method === "POST" && pathname === "/graphql") return { admin: true };
  return null;
}

function isAuthorized(principal, policy) {
  if (!policy) return false;
  if (principal.kind === "human") {
    if (principal.roles.includes("administrator")) return true;
    if (policy.admin || !policy.human) return false;
    return principal.roles.some((role) => HUMAN_GRANTS[role].includes(policy.human));
  }
  return Boolean(policy.service && principal.permissions.includes(policy.service));
}

function enforceHumanMutation(request, principal, allowedOrigins, closeConnection) {
  if (!(allowedOrigins instanceof Set) || allowedOrigins.size === 0) {
    throw accessError(503, "Origin protection is unavailable.", "ORIGIN_POLICY_UNAVAILABLE", closeConnection);
  }
  const origin = request.headers.origin;
  if (typeof origin !== "string" || !allowedOrigins.has(origin)) {
    throw accessError(403, "Access is forbidden.", "ORIGIN_FORBIDDEN", closeConnection);
  }
  const token = request.headers["x-csrf-token"];
  if (typeof token !== "string" || !safeEqual(token, principal.csrfToken)) {
    throw accessError(403, "Access is forbidden.", "CSRF_FORBIDDEN", closeConnection);
  }
}

function safeEqual(provided, expected) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function invalidPrincipal(closeConnection) {
  return accessError(503, "Authentication is unavailable.", "INVALID_PRINCIPAL", closeConnection);
}

function accessError(statusCode, message, code, closeConnection = false) {
  return Object.assign(new Error(message), { statusCode, code, closeConnection });
}

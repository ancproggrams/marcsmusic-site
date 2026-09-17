import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const MAX_AUTHORIZATION_HEADER_BYTES = 1_024;
const MAX_DECODED_CREDENTIAL_BYTES = 512;
const MIN_PASSWORD_BYTES = 32;
const MAX_PASSWORD_BYTES = 256;
const MAX_USERNAME_BYTES = 64;
const BASIC_CHALLENGE = 'Basic realm="SoundCloud Growth OS", charset="UTF-8"';

type Env = Record<string, string | undefined>;

type AdminAuthDecision =
  | { ok: true }
  | { ok: false; reason: "misconfigured" | "unauthorized" };

type AdminCredentials = {
  username: string;
  password: string;
};

function byteLength(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/u.test(value);
}

function getConfiguredCredentials(env: Env): AdminCredentials | null {
  const username = env.GROWTH_OS_ADMIN_USERNAME;
  const password = env.GROWTH_OS_ADMIN_PASSWORD;

  if (!username || !password) return null;

  const usernameBytes = byteLength(username);
  const passwordBytes = byteLength(password);
  const passwordLooksLikePlaceholder = /^(?:change[-_ ]?me|password|secret|admin|example|todo|generate|replace)/iu.test(password);

  if (
    usernameBytes < 1 ||
    usernameBytes > MAX_USERNAME_BYTES ||
    passwordBytes < MIN_PASSWORD_BYTES ||
    passwordBytes > MAX_PASSWORD_BYTES ||
    new Set(password).size < 12 ||
    username.includes(":") ||
    hasControlCharacters(username) ||
    hasControlCharacters(password) ||
    passwordLooksLikePlaceholder ||
    /^(.)(?:\1){31,}$/u.test(password)
  ) {
    return null;
  }

  return { username, password };
}

function decodeBasicCredentials(value: string | null): AdminCredentials | null {
  if (!value || byteLength(value) > MAX_AUTHORIZATION_HEADER_BYTES) return null;

  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/iu.exec(value);
  if (!match) return null;

  const encoded = match[1];
  let decoded: Buffer;
  try {
    decoded = Buffer.from(encoded, "base64");
  } catch {
    return null;
  }

  if (
    decoded.length < 3 ||
    decoded.length > MAX_DECODED_CREDENTIAL_BYTES ||
    decoded.toString("base64") !== encoded
  ) {
    return null;
  }

  let credentials: string;
  try {
    credentials = new TextDecoder("utf-8", { fatal: true }).decode(decoded);
  } catch {
    return null;
  }

  const separator = credentials.indexOf(":");
  if (separator <= 0) return null;

  return {
    username: credentials.slice(0, separator),
    password: credentials.slice(separator + 1)
  };
}

function digestCredential(label: string, value: string) {
  return createHash("sha256").update(`soundcloud-growth-os:${label}\0`, "utf8").update(value, "utf8").digest();
}

function constantTimeCredentialsEqual(actual: AdminCredentials, expected: AdminCredentials) {
  const actualUsername = digestCredential("username", actual.username);
  const expectedUsername = digestCredential("username", expected.username);
  const actualPassword = digestCredential("password", actual.password);
  const expectedPassword = digestCredential("password", expected.password);

  const usernameMatches = timingSafeEqual(actualUsername, expectedUsername);
  const passwordMatches = timingSafeEqual(actualPassword, expectedPassword);
  return usernameMatches && passwordMatches;
}

export function authenticateAdminRequest(
  request: Pick<NextRequest, "headers" | "nextUrl">,
  env: Env = process.env
): AdminAuthDecision {
  if (env.NODE_ENV === "production" && request.nextUrl.protocol !== "https:") {
    return { ok: false, reason: "misconfigured" };
  }

  return authenticateAdminHeaders(request.headers, env);
}

export function authenticateAdminHeaders(headers: Pick<Headers, "get">, env: Env = process.env): AdminAuthDecision {
  const configured = getConfiguredCredentials(env);
  if (!configured) return { ok: false, reason: "misconfigured" };

  const presented = decodeBasicCredentials(headers.get("authorization"));
  if (!presented || !constantTimeCredentialsEqual(presented, configured)) {
    return { ok: false, reason: "unauthorized" };
  }

  return { ok: true };
}

export function assertAdminPageAuth(headers: Pick<Headers, "get">, env: Env = process.env) {
  const forwardedProtocol = headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase();
  if (env.NODE_ENV === "production" && forwardedProtocol !== "https") {
    throw new Error("Admin authentication rejected the page request.");
  }

  const decision = authenticateAdminHeaders(headers, env);
  if (!decision.ok) throw new Error("Admin authentication rejected the page request.");
}

function failureHeaders(reason: "misconfigured" | "unauthorized") {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Vary: "Authorization",
    "X-Content-Type-Options": "nosniff"
  });

  if (reason === "unauthorized") headers.set("WWW-Authenticate", BASIC_CHALLENGE);
  return headers;
}

export function adminAuthFailureResponse(
  request: Pick<NextRequest, "nextUrl"> | { nextUrl: { pathname: string } },
  reason: "misconfigured" | "unauthorized"
) {
  const status = reason === "misconfigured" ? 503 : 401;
  const headers = failureHeaders(reason);

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: reason === "misconfigured" ? "Service authentication is unavailable." : "Authentication required." },
      { status, headers }
    );
  }

  return new NextResponse(reason === "misconfigured" ? "Service authentication is unavailable." : "Authentication required.", {
    status,
    headers
  });
}

export function requireAdminApiAuth(request: NextRequest, env: Env = process.env) {
  const decision = authenticateAdminRequest(request, env);
  return decision.ok ? null : adminAuthFailureResponse(request, decision.reason);
}

export function isAdminAuthPublicPath(pathname: string) {
  return (
    pathname === "/api/health" ||
    pathname === "/api/outreach/email" ||
    pathname.startsWith("/_next/static/")
  );
}

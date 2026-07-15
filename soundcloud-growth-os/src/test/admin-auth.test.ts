import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as oauthCallback } from "../app/api/auth/soundcloud/callback/route";
import { GET as oauthStart } from "../app/api/auth/soundcloud/start/route";
import { POST as createSnapshot } from "../app/api/metrics/snapshot/route";
import { GET as weeklyReport } from "../app/api/reports/weekly/route";
import { POST as syncTracks } from "../app/api/tracks/sync/route";
import {
  assertAdminPageAuth,
  authenticateAdminRequest,
  isAdminAuthPublicPath,
  requireAdminApiAuth
} from "../lib/security/adminAuth";
import { proxy } from "../proxy";

const strongEnv = {
  GROWTH_OS_ADMIN_USERNAME: "growth-admin",
  GROWTH_OS_ADMIN_PASSWORD: "J9-very-long-random-admin-secret-2026!x"
};

function basic(username = strongEnv.GROWTH_OS_ADMIN_USERNAME, password = strongEnv.GROWTH_OS_ADMIN_PASSWORD) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function request(pathname: string, authorization?: string) {
  return new NextRequest(`https://growth.example.test${pathname}`, {
    headers: authorization ? { authorization } : undefined
  });
}

describe("admin authentication", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts only the configured constant-time Basic credentials", () => {
    expect(authenticateAdminRequest(request("/dashboard", basic()), strongEnv)).toEqual({ ok: true });
    expect(authenticateAdminRequest(request("/dashboard", basic("other", strongEnv.GROWTH_OS_ADMIN_PASSWORD)), strongEnv)).toEqual({
      ok: false,
      reason: "unauthorized"
    });
    expect(authenticateAdminRequest(request("/dashboard", basic(strongEnv.GROWTH_OS_ADMIN_USERNAME, "x".repeat(40))), strongEnv)).toEqual({
      ok: false,
      reason: "unauthorized"
    });
  });

  it("keeps page data fail-closed if the optimistic proxy boundary is bypassed", () => {
    expect(() => assertAdminPageAuth(request("/dashboard").headers, strongEnv)).toThrow(
      "Admin authentication rejected the page request."
    );
    expect(() => assertAdminPageAuth(request("/dashboard", basic()).headers, strongEnv)).not.toThrow();

    const secureProductionHeaders = new Headers({
      authorization: basic(),
      "x-forwarded-proto": "https"
    });
    expect(() => assertAdminPageAuth(secureProductionHeaders, { ...strongEnv, NODE_ENV: "production" })).not.toThrow();
    expect(() =>
      assertAdminPageAuth(new Headers({ authorization: basic() }), { ...strongEnv, NODE_ENV: "production" })
    ).toThrow("Admin authentication rejected the page request.");
  });

  it.each([
    "",
    "Bearer secret",
    "Basic !!!",
    "Basic dXNlcg==",
    `Basic ${"A".repeat(1_100)}`,
    `Basic ${Buffer.from("user:\u0000password", "utf8").toString("base64")} trailing`
  ])("rejects malformed or oversized Authorization headers without echoing them (%s)", async (authorization) => {
    const req = request("/api/tracks/sync", authorization);
    const response = requireAdminApiAuth(req, strongEnv);
    expect(response?.status).toBe(401);
    expect(response?.headers.get("www-authenticate")).toContain("Basic");
    const body = await response?.text();
    if (authorization) expect(body).not.toContain(authorization);
  });

  it.each([
    {},
    { GROWTH_OS_ADMIN_USERNAME: "admin", GROWTH_OS_ADMIN_PASSWORD: "short" },
    { GROWTH_OS_ADMIN_USERNAME: "admin:name", GROWTH_OS_ADMIN_PASSWORD: "R4ndom-credential-that-is-long-enough!" },
    { GROWTH_OS_ADMIN_USERNAME: "admin", GROWTH_OS_ADMIN_PASSWORD: "change-me-this-is-not-a-real-secret-123" },
    { GROWTH_OS_ADMIN_USERNAME: "admin", GROWTH_OS_ADMIN_PASSWORD: "x".repeat(40) },
    { GROWTH_OS_ADMIN_USERNAME: "admin", GROWTH_OS_ADMIN_PASSWORD: `${"a".repeat(39)}B` }
  ])("fails closed with 503 when configuration is missing or weak", async (env) => {
    const req = request("/api/tracks/sync", basic());
    const response = requireAdminApiAuth(req, env);
    expect(response?.status).toBe(503);
    expect(response?.headers.get("www-authenticate")).toBeNull();
    expect(await response?.json()).toEqual({ error: "Service authentication is unavailable." });
  });

  it("never challenges for Basic credentials over plaintext transport in production", () => {
    const req = new NextRequest("http://growth.example.test/dashboard", { headers: { authorization: basic() } });
    expect(authenticateAdminRequest(req, { ...strongEnv, NODE_ENV: "production" })).toEqual({
      ok: false,
      reason: "misconfigured"
    });
  });

  it("exposes only the exact health route, exact independently protected outreach route, and Next static assets", () => {
    expect(isAdminAuthPublicPath("/api/health")).toBe(true);
    expect(isAdminAuthPublicPath("/api/outreach/email")).toBe(true);
    expect(isAdminAuthPublicPath("/_next/static/chunks/app.js")).toBe(true);

    expect(isAdminAuthPublicPath("/api/health/extra")).toBe(false);
    expect(isAdminAuthPublicPath("/api/outreach/email/extra")).toBe(false);
    expect(isAdminAuthPublicPath("/_next/image")).toBe(false);
    expect(isAdminAuthPublicPath("/_next/static-malicious/file")).toBe(false);
    expect(isAdminAuthPublicPath("/dashboard")).toBe(false);
  });

  it("protects pages optimistically in proxy while allowing the exact public boundary", () => {
    vi.stubEnv("GROWTH_OS_ADMIN_USERNAME", strongEnv.GROWTH_OS_ADMIN_USERNAME);
    vi.stubEnv("GROWTH_OS_ADMIN_PASSWORD", strongEnv.GROWTH_OS_ADMIN_PASSWORD);

    expect(proxy(request("/dashboard")).status).toBe(401);
    const authorized = proxy(request("/dashboard", basic()));
    expect(authorized.headers.get("x-middleware-next")).toBe("1");
    expect(authorized.headers.get("cache-control")).toBe("private, no-store");
    expect(authorized.headers.get("vary")).toBe("Authorization");
    expect(proxy(request("/api/health")).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request("/api/outreach/email")).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request("/_next/static/chunks/app.js")).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request("/api/health/extra")).status).toBe(401);
  });

  it("enforces route-level authentication on every sensitive API even without proxy", async () => {
    vi.stubEnv("GROWTH_OS_ADMIN_USERNAME", strongEnv.GROWTH_OS_ADMIN_USERNAME);
    vi.stubEnv("GROWTH_OS_ADMIN_PASSWORD", strongEnv.GROWTH_OS_ADMIN_PASSWORD);

    const responses = await Promise.all([
      oauthStart(request("/api/auth/soundcloud/start")),
      oauthCallback(request("/api/auth/soundcloud/callback?code=x&state=y")),
      syncTracks(request("/api/tracks/sync")),
      createSnapshot(request("/api/metrics/snapshot")),
      weeklyReport(request("/api/reports/weekly"))
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
    for (const response of responses) {
      expect(response.headers.get("www-authenticate")).toContain("Basic");
    }
  });

  it("does not begin OAuth when encrypted credential storage is unavailable", async () => {
    vi.stubEnv("GROWTH_OS_ADMIN_USERNAME", strongEnv.GROWTH_OS_ADMIN_USERNAME);
    vi.stubEnv("GROWTH_OS_ADMIN_PASSWORD", strongEnv.GROWTH_OS_ADMIN_PASSWORD);
    vi.stubEnv("SOUNDCLOUD_TOKEN_ACTIVE_KID", "");
    vi.stubEnv("SOUNDCLOUD_TOKEN_KEYS_JSON", "{}");

    const response = await oauthStart(request("/api/auth/soundcloud/start", basic()));
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
  });
});

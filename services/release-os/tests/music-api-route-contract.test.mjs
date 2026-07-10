import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { authorizeRequest, normalizeAllowedOrigins } from "../src/interfaces/http/access-control.mjs";
import { createMusicApiServer } from "../src/interfaces/http/music-api-server.mjs";

const ORIGIN = "https://release.test";
const ALLOWED_ORIGINS = normalizeAllowedOrigins([ORIGIN]);
const PRINCIPALS = Object.freeze({
  viewer: human("viewer"),
  editor: human("editor"),
  publisher: human("publisher"),
  campaign: human("campaign-sender"),
  administrator: human("administrator"),
  ops: service("ops:read")
});
const ROUTE_CONTRACTS = [
  "GET /health administrator viewer",
  "GET /music/app viewer ops",
  "GET /assets/audio/missing.mp3 viewer ops",
  "GET /assets/artwork/missing.jpg viewer ops",
  "GET /music/platforms viewer ops",
  "GET /music/artists viewer ops",
  "POST /music/artists editor viewer",
  "GET /music/artists/id viewer ops",
  "PATCH /music/artists/id editor viewer",
  "POST /music/releases/plan editor viewer",
  "POST /music/releases editor viewer",
  "POST /music/releases/publish publisher editor",
  "GET /music/releases/id viewer ops",
  "POST /music/releases/id/plan editor viewer",
  "POST /music/releases/id/publish publisher editor",
  "POST /music/releases/id/player-sync publisher editor",
  "POST /music/releases/id/email-campaigns/preview campaign publisher",
  "POST /music/releases/id/email-campaigns/test campaign publisher",
  "POST /music/releases/id/email-campaigns/send campaign publisher",
  "GET /music/email-campaigns/id campaign viewer",
  "GET /music/email-campaigns/id/recipients campaign viewer",
  "POST /graphql administrator publisher"
].map((contract) => contract.split(" "));
const SERVICE_CONTRACTS = [
  ["ops:read", "GET", "/health", "releases:read"],
  ["releases:read", "GET", "/music/releases/id", "ops:read"],
  ["releases:write", "POST", "/music/releases", "releases:read"],
  ["releases:publish", "POST", "/music/releases/id/publish", "releases:write"],
  ["player:sync", "POST", "/music/releases/id/player-sync", "releases:publish"],
  ["campaigns:read", "GET", "/music/email-campaigns/id", "releases:read"],
  ["campaigns:send", "POST", "/music/releases/id/email-campaigns/send", "campaigns:read"]
];

describe("Release OS route contracts", () => {
  it("aligns every current protected handler with an explicit human policy", async () => {
    await withContractServer(async (baseUrl) => {
      assert.equal((await fetch(`${baseUrl}/livez`)).status, 200);
      for (const [method, path, allowed, denied] of ROUTE_CONTRACTS) {
        const anonymous = await routeRequest(baseUrl, method, path);
        assert.equal(anonymous.status, 401, `anonymous ${method} ${path}`);

        const accepted = await routeRequest(baseUrl, method, path, allowed);
        await assertHandlerReached(accepted, `${allowed} ${method} ${path}`);

        const forbidden = await routeRequest(baseUrl, method, path, denied);
        assert.equal(forbidden.status, 403, `${denied} ${method} ${path}`);
        assert.equal((await forbidden.json()).error.code, "AUTHORIZATION_FORBIDDEN");
      }
    });
  });

  it("maps every service permission without implicit grants", async () => {
    for (const [permission, method, path, deniedPermission] of SERVICE_CONTRACTS) {
      await assert.doesNotReject(() => authorize(service(permission), method, path));
      await assert.rejects(
        () => authorize(service(deniedPermission), method, path),
        (error) => error.statusCode === 403
      );
    }
  });

  it("keeps non-routes default-deny even for administrators", async () => {
    for (const [method, path] of [["HEAD", "/livez"], ["POST", "/livez"], ["GET", "/unknown"]]) {
      await assert.rejects(() => authorize(PRINCIPALS.administrator, method, path), (error) => error.statusCode === 403);
    }
  });

  it("accepts only canonical configured browser origins", () => {
    assert.deepEqual([...normalizeAllowedOrigins(` ${ORIGIN} `)], [ORIGIN]);
    for (const value of [`${ORIGIN}/`, `${ORIGIN}/path`, "http://release.test/path"]) {
      assert.throws(() => normalizeAllowedOrigins(value), /exact origins/u);
    }
  });
});

function human(role) {
  return { kind: "human", subject: role, roles: [role], csrfToken: "csrf" };
}

function service(permission) {
  return { kind: "service", subject: permission, permissions: [permission] };
}

function authorize(principal, method, path) {
  return authorizeRequest(requestFor(principal, method), new URL(path, ORIGIN), {
    authenticateRequest: async () => principal,
    allowedOrigins: ALLOWED_ORIGINS
  });
}

function requestFor(principal, method) {
  return {
    method,
    headers: principal?.kind === "human" ? { origin: ORIGIN, "x-csrf-token": "csrf" } : {}
  };
}

function routeRequest(baseUrl, method, path, principalName) {
  const principal = PRINCIPALS[principalName];
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      connection: "close",
      ...(principalName ? { "x-test-principal": principalName } : {}),
      ...requestFor(principal, method).headers,
      ...(!["GET", "HEAD"].includes(method) ? { "content-type": "application/json" } : {})
    }
  });
}

async function assertHandlerReached(response, label) {
  assert.notEqual(response.status, 401, label);
  if (![403, 404].includes(response.status)) return;
  const code = (await response.json()).error?.code;
  assert.notEqual(code, "AUTHORIZATION_FORBIDDEN", label);
  assert.notEqual(code, "NOT_FOUND", label);
}

async function withContractServer(work) {
  const rootDir = await mkdtemp(join(tmpdir(), "release-route-contract-"));
  await mkdir(join(rootDir, "audio"));
  await mkdir(join(rootDir, "artwork"));
  const server = createMusicApiServer({
    ...fakeDependencies(rootDir),
    allowedOrigins: [ORIGIN],
    authenticateRequest: async (request) => PRINCIPALS[request.headers["x-test-principal"]] ?? null
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await work(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(rootDir, { recursive: true, force: true });
  }
}

function fakeDependencies(rootDir) {
  const release = { id: "id", primaryArtistId: "artist" };
  return {
    env: {},
    store: { read: async () => ({ playerEntries: [] }) },
    assetStorage: { rootDir, maxAudioBytes: 1, maxArtworkBytes: 1 },
    artistService: {
      listArtists: async () => [],
      getArtist: async () => ({ id: "artist" })
    },
    releaseService: {
      getRelease: async () => ({ release }),
      planRelease: async () => ({ release }),
      toPublicationInput: async () => ({ title: "Test", artist: "Artist", audioSource: "test.wav" })
    },
    playerClient: { manifestPath: "/non-secret/test-manifest.json" },
    playerSyncService: {},
    espocrmClient: { isConfigured: () => false },
    contactSegmentService: {},
    campaignService: {
      getCampaign: async () => ({}),
      getCampaignRecipients: async () => []
    }
  };
}

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createMusicApiServer } from "../src/interfaces/http/music-api-server.mjs";
import { AssetUrlSigner } from "../src/infrastructure/security/asset-url-signer.mjs";
import { JsonStore, createDefaultState } from "../src/infrastructure/storage/json-store.mjs";

const ADMIN_USERNAME = "release-admin";
const ADMIN_PASSWORD = "test-admin-password-with-at-least-32-bytes";
const ADMIN_AUTHORIZATION = `Basic ${Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString("base64")}`;
const ADMIN_HEADERS = Object.freeze({ authorization: ADMIN_AUTHORIZATION });
const SIGNING_SECRET = "private-asset-signing-key-with-at-least-32-bytes";

describe("uploaded asset security", () => {
  let server;
  let baseUrl;
  let root;
  let clock;
  let signer;
  before(async () => {
    root = await mkdtemp(join(tmpdir(), "marcsmusic-assets-"));
    const uploadDir = join(root, "uploads");
    await mkdir(join(uploadDir, "audio"), { recursive: true });
    await mkdir(join(uploadDir, "artwork"), { recursive: true });
    await writeFile(join(uploadDir, "audio", "safe.mp3"), "safe bytes");
    await writeFile(join(uploadDir, "audio", "unsafe.html"), "secret");
    const oldTime = (Date.now() - 2 * 60 * 60_000) / 1_000;
    await utimes(join(uploadDir, "audio", "unsafe.html"), oldTime, oldTime);
    await writeFile(join(root, "outside.mp3"), "outside secret");
    await symlink(join(root, "outside.mp3"), join(uploadDir, "audio", "escape.mp3"));
    const store = new JsonStore({ filePath: join(root, "store.json"), initialState: createDefaultState() });
    await store.update((state) => {
      state.assets.push({ id: "asset-safe", kind: "audio_mp3", storageFilename: "safe.mp3" });
    });
    clock = Date.UTC(2026, 6, 15, 10, 0, 0);
    signer = new AssetUrlSigner({ secret: SIGNING_SECRET, now: () => clock, defaultTtlSeconds: 60 });
    server = createMusicApiServer({
      store,
      uploadDir,
      playerManifestPath: join(root, "manifest.json"),
      assetUrlSigner: signer,
      env: {
        MUSIC_API_ADMIN_USERNAME: ADMIN_USERNAME,
        MUSIC_API_ADMIN_PASSWORD: ADMIN_PASSWORD,
        MUSIC_API_EXECUTION_TOKEN: "asset-cleanup-token"
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    const closed = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
    await rm(root, { recursive: true, force: true });
  });

  it("conceals unsigned assets and permits legitimate administrator access", async () => {
    const unsigned = await fetch(`${baseUrl}/assets/audio/safe.mp3`);
    assert.equal(unsigned.status, 404);
    assert.equal((await unsigned.json()).error.code, "ASSET_NOT_FOUND");

    const response = await fetch(`${baseUrl}/assets/audio/safe.mp3`, { headers: ADMIN_HEADERS });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "safe bytes");
    assert.equal(response.headers.get("content-length"), "10");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });

  it("issues signed URLs to administrators and accepts them without Basic credentials", async () => {
    const response = await fetch(`${baseUrl}/music/assets/asset-safe/signed-url?ttlSeconds=60`, {
      headers: ADMIN_HEADERS
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.assetId, "asset-safe");
    assert.match(body.url, /^\/assets\/audio\/safe\.mp3\?expires=\d+&signature=[A-Za-z0-9_-]{43}$/u);

    const asset = await fetch(`${baseUrl}${body.url}`);
    assert.equal(asset.status, 200);
    assert.equal(await asset.text(), "safe bytes");
  });

  it("rejects tampered, duplicated, extra, and expired signature evidence without touching the file", async () => {
    const signed = signer.signPath("/assets/audio/safe.mp3", { ttlSeconds: 60 });
    const variants = [
      signed.replace("safe.mp3", "other.mp3"),
      `${signed}&extra=1`,
      `${signed}&signature=${new URL(signed, baseUrl).searchParams.get("signature")}`
    ];
    for (const path of variants) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 404, path);
      assert.equal((await response.json()).error.code, "ASSET_NOT_FOUND", path);
    }

    clock += 61_000;
    const expired = await fetch(`${baseUrl}${signed}`);
    assert.equal(expired.status, 404);
    assert.equal((await expired.json()).error.code, "ASSET_NOT_FOUND");
    clock -= 61_000;
  });

  it("conceals invalid paths, extensions, malformed encoding and symlinks", async () => {
    for (const path of ["missing.mp3", "%2e%2e%2foutside.mp3", "%E0%A4%A.mp3", "unsafe.html", "escape.mp3"]) {
      const response = await fetch(`${baseUrl}/assets/audio/${path}`, { headers: ADMIN_HEADERS });
      const body = await response.json();
      assert.equal(response.status, 404);
      assert.equal(body.error.code, "ASSET_NOT_FOUND");
    }
  });

  it("requires both administrator and execution authorization for bounded orphan cleanup", async () => {
    const blocked = await fetch(`${baseUrl}/music/assets/cleanup`, {
      method: "POST",
      headers: { ...ADMIN_HEADERS, "content-type": "application/json" },
      body: "{}"
    });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).error.code, "ASSET_CLEANUP_FORBIDDEN");

    const allowed = await fetch(`${baseUrl}/music/assets/cleanup`, {
      method: "POST",
      headers: {
        ...ADMIN_HEADERS,
        "content-type": "application/json",
        "x-music-api-token": "asset-cleanup-token"
      },
      body: JSON.stringify({ graceMs: 60 * 60_000, maxDeletes: 10, maxScan: 100 })
    });
    const body = await allowed.json();
    assert.equal(allowed.status, 200);
    assert.ok(body.cleanup.deleted >= 1);

    const retained = await fetch(`${baseUrl}/assets/audio/safe.mp3`, { headers: ADMIN_HEADERS });
    assert.equal(retained.status, 200);
  });

  it("exposes a minimal liveness endpoint", async () => {
    const response = await fetch(`${baseUrl}/livez`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

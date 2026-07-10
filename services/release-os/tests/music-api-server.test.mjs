import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { get } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createMusicApiServer } from "../src/interfaces/http/music-api-server.mjs";
import { sendUploadedAsset } from "../src/interfaces/http/uploaded-asset-response.mjs";

const ADMIN_HEADERS = Object.freeze({ origin: "https://release.test", "x-csrf-token": "test-csrf" });

describe("music API server", () => {
  let server;
  let baseUrl;
  let dir;
  let uploadDir;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "marcsmusic-api-"));
    uploadDir = join(dir, "uploads");
    await mkdir(join(uploadDir, "audio"), { recursive: true });
    await mkdir(join(uploadDir, "artwork"), { recursive: true });
    await mkdir(join(uploadDir, "audio", "directory.mp3"));
    await writeFile(join(uploadDir, "audio", "safe-track.mp3"), "safe mp3 bytes");
    await writeFile(join(uploadDir, "audio", "large-track.mp3"), "");
    await truncate(join(uploadDir, "audio", "large-track.mp3"), 128 * 1024 * 1024);
    await writeFile(join(uploadDir, "audio", "unsafe.html"), "<script>unsafe()</script>");
    await writeFile(join(uploadDir, "artwork", "safe-cover.webp"), "safe webp bytes");
    server = createMusicApiServer({
      storeFilePath: join(dir, "store.json"),
      uploadDir,
      playerManifestPath: join(dir, "player-manifest.json"),
      env: {
        MUSIC_API_EXECUTION_TOKEN: "test-token"
      },
      allowedOrigins: ["https://release.test"],
      authenticateRequest: async () => ({
        kind: "human",
        subject: "test-admin",
        roles: ["administrator"],
        csrfToken: "test-csrf"
      }),
      contacts: [
        {
          id: "radio-1",
          email: "radio@example.com",
          type: "radio_station",
          language: "nl",
          tags: ["pop"],
          artistAudiences: ["marc-rene"],
          status: "active"
        }
      ]
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await rm(dir, { recursive: true, force: true });
  });

  it("lists platforms over REST", async () => {
    const response = await fetch(`${baseUrl}/music/platforms?autoPostOnly=true`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(response.headers.get("vary"), /Authorization/u);
    assert.ok(body.platforms.some((platform) => platform.id === "soundcloud"));
    assert.ok(body.platforms.every((platform) => platform.canAutoPost));
  });

  it("serves the internal music app HTML", async () => {
    const response = await fetch(`${baseUrl}/music/app`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /Release Control Panel/u);
    assert.match(body, /id="recipientTypeChecks"/u);
    assert.match(body, /id="recipientTagChecks"/u);
    assert.match(body, /id="recipientLanguageChecks"/u);
    assert.match(body, /value="radio_station" checked/u);
    assert.match(body, /value="pop"/u);
    assert.match(body, /value="nl" checked/u);
    assert.doesNotMatch(body, /id="recipientTypes"/u);
    assert.doesNotMatch(body, /id="recipientTags"/u);
    assert.doesNotMatch(body, /id="recipientLanguages"/u);
  });

  it("serves an opened asset with private response metadata", async () => {
    const response = await fetch(`${baseUrl}/assets/audio/safe-track.mp3`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(body, "safe mp3 bytes");
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.equal(response.headers.get("content-length"), String(Buffer.byteLength(body)));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("content-disposition"), null);
  });

  it("preserves the public artwork URL and inline MIME contract", async () => {
    const response = await fetch(`${baseUrl}/assets/artwork/safe-cover.webp`);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "safe webp bytes");
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("content-disposition"), null);
  });

  it("returns 404 for missing and invalid asset paths without poisoning the server", async () => {
    for (const pathname of [
      "/assets/audio/missing.mp3",
      "/assets/audio/%2e%2e%2foutside.mp3",
      "/assets/audio/%E0%A4%A.mp3",
      "/assets/audio/track%00.mp3",
      "/assets/audio/unsafe.html",
      "/assets/audio/directory.mp3"
    ]) {
      const response = await fetch(`${baseUrl}${pathname}`);
      const body = await response.json();
      assert.equal(response.status, 404);
      assert.equal(body.error.code, "ASSET_NOT_FOUND");
      assert.equal(body.error.message, "Asset not found");
    }

    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
  });

  it("does not serve asset symlinks outside the upload root", async () => {
    const outsidePath = join(dir, "outside.mp3");
    await writeFile(outsidePath, "private outside bytes");
    await symlink(outsidePath, join(uploadDir, "audio", "escape.mp3"));

    const response = await fetch(`${baseUrl}/assets/audio/escape.mp3`);
    const body = await response.text();

    assert.equal(response.status, 404);
    assert.doesNotMatch(body, /private outside bytes/u);
  });

  it("rejects an asset directory symlink outside the upload root", async () => {
    const isolatedRoot = join(dir, "isolated-uploads");
    const outsideAudio = join(dir, "outside-audio");
    await mkdir(isolatedRoot);
    await mkdir(outsideAudio);
    await writeFile(join(outsideAudio, "outside.mp3"), "private outside bytes");
    await symlink(outsideAudio, join(isolatedRoot, "audio"), "dir");

    await assert.rejects(
      () => sendUploadedAsset({ destroyed: false }, isolatedRoot, "audio", "/assets/audio/outside.mp3"),
      (error) => error.code === "ASSET_NOT_FOUND" && error.statusCode === 404
    );
  });

  it("survives an interrupted asset download", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await abortDownload(`${baseUrl}/assets/audio/large-track.mp3`);
    }

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
  });

  it("creates a release over multipart REST and guards player sync", async () => {
    const form = new FormData();
    form.set("title", "REST Upload");
    form.set("genre", "Pop");
    form.set("audio", new Blob([Buffer.from("mp3 bytes")], { type: "audio/mpeg" }), "rest-upload.mp3");
    form.set("artwork", new Blob([Buffer.from("jpg bytes")], { type: "image/jpeg" }), "cover.jpg");

    const createResponse = await fetch(`${baseUrl}/music/releases`, {
      method: "POST",
      headers: ADMIN_HEADERS,
      body: form
    });
    const created = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(created.release.title, "REST Upload");
    assert.ok(created.release.mp3AssetId);
    assert.equal(created.assets.length, 2);

    const blockedResponse = await fetch(`${baseUrl}/music/releases/${created.release.id}/player-sync`, {
      method: "POST",
      headers: ADMIN_HEADERS
    });
    const blocked = await blockedResponse.json();
    assert.equal(blockedResponse.status, 403);
    assert.equal(blocked.error.code, "PLAYER_SYNC_FORBIDDEN");

    const syncResponse = await fetch(`${baseUrl}/music/releases/${created.release.id}/player-sync`, {
      method: "POST",
      headers: {
        ...ADMIN_HEADERS,
        "x-music-api-token": "test-token"
      }
    });
    const synced = await syncResponse.json();

    assert.equal(syncResponse.status, 200);
    assert.equal(synced.playerEntry.title, "REST Upload");
    assert.match(synced.playerEntry.mp3DownloadUrl, /^\/assets\/audio\//u);
    const assetResponse = await fetch(`${baseUrl}${synced.playerEntry.mp3DownloadUrl}`);
    assert.equal(assetResponse.status, 200);
    assert.equal(assetResponse.headers.get("cache-control"), "private, no-store");
    await assetResponse.arrayBuffer();
  });

  it("plans a release over REST", async () => {
    const response = await fetch(`${baseUrl}/music/releases/plan`, {
      method: "POST",
      headers: {
        ...ADMIN_HEADERS,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: "Door De Storm",
        artist: "Marc Rene",
        audioSource: "file:///music/door-de-storm.wav",
        targetPlatforms: ["soundcloud", "mixcloud"]
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.summary.apiUploadReady, 2);
  });

  it("publishes a dry-run batch over REST without an execution token", async () => {
    const response = await fetch(`${baseUrl}/music/releases/publish`, {
      method: "POST",
      headers: {
        ...ADMIN_HEADERS,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: "Nieuwe Track",
        artist: "Marc Rene",
        audioSource: "s3://music/nieuwe-track.wav"
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.dryRun, true);
    assert.equal(body.summary.total, 15);
    assert.equal(body.summary.dryRun, 3);
    assert.equal(body.summary.manualTask, 11);
  });

  it("rejects executable publication over REST without the API execution token", async () => {
    const response = await fetch(`${baseUrl}/music/releases/publish`, {
      method: "POST",
      headers: {
        ...ADMIN_HEADERS,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: "Blocked",
        artist: "Marc Rene",
        audioSource: "/tmp/blocked.mp3",
        targetPlatforms: ["soundcloud"],
        dryRun: false
      })
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error.code, "MUSIC_PUBLICATION_FORBIDDEN");
  });

  it("executes GraphQL platform queries and release planning mutations", async () => {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: {
        ...ADMIN_HEADERS,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        query: `
          mutation Plan($input: ReleasePlanInput!) {
            planRelease(input: $input) {
              summary { apiUploadReady manualUploadRequired }
              actions { platformId mode operation }
            }
          }
        `,
        variables: {
          input: {
            title: "Geen Afscheid",
            artist: "Marc Rene",
            audioSource: "file:///music/geen-afscheid.wav",
            targetPlatforms: ["audius", "bandcamp"]
          }
        }
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.planRelease.summary.apiUploadReady, 1);
    assert.equal(body.data.planRelease.summary.manualUploadRequired, 1);
    assert.deepEqual(
      body.data.planRelease.actions.map((action) => action.platformId),
      ["audius", "bandcamp"]
    );
  });

  it("executes GraphQL dry-run publication mutations", async () => {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: {
        ...ADMIN_HEADERS,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        query: `
          mutation Publish($input: PublicationInput!) {
            publishRelease(input: $input) {
              dryRun
              summary { total dryRun manualTask blocked }
              results { platformId status manualTask { kind } }
            }
          }
        `,
        variables: {
          input: {
            title: "Graph Track",
            artist: "Marc Rene",
            audioSource: "s3://music/graph-track.wav",
            targetPlatforms: ["soundcloud", "spreaker", "linktree", "jamendo"]
          }
        }
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.publishRelease.dryRun, true);
    assert.equal(body.data.publishRelease.summary.total, 4);
    assert.equal(body.data.publishRelease.summary.dryRun, 2);
    assert.equal(body.data.publishRelease.summary.manualTask, 1);
    assert.equal(body.data.publishRelease.summary.blocked, 1);
  });
});

function abortDownload(url) {
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      response.once("close", resolve);
      response.once("error", reject);
      response.destroy();
    });
    request.once("error", reject);
  });
}

import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createMusicApiServer } from "../src/interfaces/http/music-api-server.mjs";

const ADMIN_USERNAME = "release-admin";
const ADMIN_PASSWORD = "test-admin-password-with-at-least-32-bytes";
const ADMIN_AUTHORIZATION = `Basic ${Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString("base64")}`;
const ADMIN_HEADERS = Object.freeze({ authorization: ADMIN_AUTHORIZATION });

describe("music API server", () => {
  let server;
  let baseUrl;
  const publicationCalls = new Map();

  before(async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-api-"));
    server = createMusicApiServer({
      storeFilePath: join(dir, "store.json"),
      uploadDir: join(dir, "uploads"),
      playerManifestPath: join(dir, "player-manifest.json"),
      publicationActionExecutor: async ({ action }) => {
        publicationCalls.set(action.platformId, (publicationCalls.get(action.platformId) ?? 0) + 1);
        const common = {
          platformId: action.platformId,
          platformName: action.platformName,
          idempotencyKey: action.idempotencyKey,
          mode: action.mode,
          operation: action.operation,
          dryRun: false,
          requiredCredentialEnv: action.requiredCredentialEnv,
          requirements: action.requirements
        };
        return action.platformId === "soundcloud"
          ? {
              ...common,
              status: "failed",
              message: "Provider outcome is unknown.",
              errorCode: "PROVIDER_REQUEST_TIMEOUT",
              retryable: true,
              outcomeUncertain: true
            }
          : { ...common, status: "manual_task", message: "Manual workflow created." };
      },
      env: {
        MUSIC_API_EXECUTION_TOKEN: "test-token",
        MUSIC_API_ADMIN_USERNAME: ADMIN_USERNAME,
        MUSIC_API_ADMIN_PASSWORD: ADMIN_PASSWORD,
        MUSIC_ASSET_SIGNING_KEY: "music-api-private-asset-test-key-longer-than-32-bytes"
      },
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
  });

  it("lists platforms over REST", async () => {
    const response = await fetch(`${baseUrl}/music/platforms?autoPostOnly=true`, { headers: ADMIN_HEADERS });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(body.platforms.some((platform) => platform.id === "soundcloud"));
    assert.ok(body.platforms.every((platform) => platform.canAutoPost));
  });

  it("serves the internal music app HTML", async () => {
    const response = await fetch(`${baseUrl}/music/app`, { headers: ADMIN_HEADERS });
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
    assert.doesNotMatch(body, /\.innerHTML\s*=/u);
    assert.match(body, /replaceChildren/u);
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/u);
  });

  it("protects every administrator route before parsing or storage work", async () => {
    for (const path of ["/music/app", "/music/artists", "/music/platforms", "/graphql"]) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: path === "/graphql" ? "POST" : "GET",
        headers: path === "/graphql" ? { "content-type": "application/json" } : undefined,
        body: path === "/graphql" ? "not-json" : undefined
      });
      const body = await response.json();

      assert.equal(response.status, 401, path);
      assert.equal(body.error.code, "MUSIC_ADMIN_AUTH_REQUIRED", path);
      assert.match(response.headers.get("www-authenticate"), /^Basic realm=/u, path);
    }
  });

  it("fails closed when administrator credentials are absent or weak", async () => {
    const unsafeServer = createMusicApiServer({
      env: {
        MUSIC_API_ADMIN_USERNAME: "admin",
        MUSIC_API_ADMIN_PASSWORD: "short"
      }
    });
    await new Promise((resolve) => unsafeServer.listen(0, "127.0.0.1", resolve));
    const address = unsafeServer.address();

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/music/platforms`, {
        headers: { authorization: "Basic YWRtaW46c2hvcnQ=" }
      });
      const body = await response.json();
      assert.equal(response.status, 503);
      assert.equal(body.error.code, "MUSIC_ADMIN_AUTH_NOT_CONFIGURED");
    } finally {
      await new Promise((resolve, reject) => unsafeServer.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it("keeps public health minimal and free of filesystem or integration configuration", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: "ok" });
    assert.equal(response.headers.get("cache-control"), "no-store");
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
        authorization: ADMIN_AUTHORIZATION,
        "x-music-api-token": "test-token"
      }
    });
    const synced = await syncResponse.json();

    assert.equal(syncResponse.status, 200);
    assert.equal(synced.playerEntry.title, "REST Upload");
    assert.match(
      synced.playerEntry.mp3DownloadUrl,
      /^\/assets\/audio\/[^?]+\?expires=\d+&signature=[A-Za-z0-9_-]{43}$/u
    );
  });

  it("plans a release over REST", async () => {
    const response = await fetch(`${baseUrl}/music/releases/plan`, {
      method: "POST",
      headers: {
        authorization: ADMIN_AUTHORIZATION,
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
        authorization: ADMIN_AUTHORIZATION,
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
        authorization: ADMIN_AUTHORIZATION,
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

  it("persists real publication state and protects operator reconciliation", async () => {
    const publishResponse = await fetch(`${baseUrl}/music/releases/publish`, {
      method: "POST",
      headers: {
        authorization: ADMIN_AUTHORIZATION,
        "content-type": "application/json",
        "x-music-api-token": "test-token"
      },
      body: JSON.stringify({
        releaseId: "api-durable-manual-release",
        title: "Durable Manual Release",
        artist: "Marc Rene",
        audioSource: "/managed/manual-release.mp3",
        targetPlatforms: ["bandcamp"],
        dryRun: false
      })
    });
    const published = await publishResponse.json();
    assert.equal(publishResponse.status, 200);
    assert.equal(published.results[0].status, "manual_task");

    const publicationId = published.results[0].idempotencyKey;
    const statusResponse = await fetch(`${baseUrl}/music/publications/${publicationId}`, {
      headers: ADMIN_HEADERS
    });
    const status = await statusResponse.json();
    assert.equal(statusResponse.status, 200);
    assert.equal(status.publication.status, "completed");
    assert.equal(status.publication.result.status, "manual_task");

    const blocked = await fetch(`${baseUrl}/music/publications/${publicationId}/reconcile`, {
      method: "POST",
      headers: { ...ADMIN_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({
        outcome: "failed",
        operator: "release-operator",
        reason: "Manual workflow was verified as failed."
      })
    });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).error.code, "MUSIC_PUBLICATION_FORBIDDEN");
  });

  it("binds reconciliation to the authenticated administrator and replays confirmed submissions", async () => {
    const input = {
      releaseId: "api-uncertain-soundcloud-release",
      title: "Uncertain SoundCloud Release",
      artist: "Marc Rene",
      audioSource: "/managed/uncertain.mp3",
      targetPlatforms: ["soundcloud"],
      dryRun: false
    };
    const executionHeaders = {
      authorization: ADMIN_AUTHORIZATION,
      "content-type": "application/json",
      "x-music-api-token": "test-token"
    };
    const publishResponse = await fetch(`${baseUrl}/music/releases/publish`, {
      method: "POST",
      headers: executionHeaders,
      body: JSON.stringify(input)
    });
    const uncertain = await publishResponse.json();
    assert.equal(publishResponse.status, 200);
    assert.equal(uncertain.results[0].status, "reconciliation_required");
    assert.equal(publicationCalls.get("soundcloud"), 1);

    const publicationId = uncertain.results[0].idempotencyKey;
    const reconcileResponse = await fetch(`${baseUrl}/music/publications/${publicationId}/reconcile`, {
      method: "POST",
      headers: executionHeaders,
      body: JSON.stringify({
        outcome: "submitted",
        operator: "spoofed-operator",
        reason: "Provider dashboard proves that the upload completed.",
        externalId: "confirmed-soundcloud-id",
        externalUrl: "https://soundcloud.com/marc-rene/confirmed-release"
      })
    });
    const reconciled = await reconcileResponse.json();
    assert.equal(reconcileResponse.status, 200);
    assert.equal(reconciled.publication.status, "succeeded");
    assert.equal(reconciled.publication.lastReconciliation.operator, ADMIN_USERNAME);

    const replayResponse = await fetch(`${baseUrl}/music/releases/publish`, {
      method: "POST",
      headers: executionHeaders,
      body: JSON.stringify(input)
    });
    const replay = await replayResponse.json();
    assert.equal(replayResponse.status, 200);
    assert.equal(replay.results[0].status, "submitted");
    assert.equal(replay.results[0].externalId, "confirmed-soundcloud-id");
    assert.equal(publicationCalls.get("soundcloud"), 1);
  });

  it("fails legacy campaign sends closed before parsing or provider work", async () => {
    for (const action of ["test", "send"]) {
      const response = await fetch(`${baseUrl}/music/releases/not-loaded/email-campaigns/${action}`, {
        method: "POST",
        headers: {
          authorization: ADMIN_AUTHORIZATION,
          "content-type": "application/json",
          "x-music-api-token": "test-token"
        },
        body: "not-json"
      });
      const body = await response.json();

      assert.equal(response.status, 503);
      assert.equal(body.error.code, "LEGACY_OUTREACH_SEND_DISABLED");
    }
  });

  it("executes GraphQL platform queries and release planning mutations", async () => {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: {
        authorization: ADMIN_AUTHORIZATION,
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
        authorization: ADMIN_AUTHORIZATION,
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

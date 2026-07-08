import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createMusicApiServer } from "../src/interfaces/http/music-api-server.mjs";

describe("music API server", () => {
  let server;
  let baseUrl;

  before(async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-api-"));
    server = createMusicApiServer({
      storeFilePath: join(dir, "store.json"),
      uploadDir: join(dir, "uploads"),
      playerManifestPath: join(dir, "player-manifest.json"),
      env: {
        MUSIC_API_EXECUTION_TOKEN: "test-token"
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
    const response = await fetch(`${baseUrl}/music/platforms?autoPostOnly=true`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(body.platforms.some((platform) => platform.id === "soundcloud"));
    assert.ok(body.platforms.every((platform) => platform.canAutoPost));
  });

  it("serves the internal music app HTML", async () => {
    const response = await fetch(`${baseUrl}/music/app`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /Release Control Panel/u);
  });

  it("creates a release over multipart REST and guards player sync", async () => {
    const form = new FormData();
    form.set("title", "REST Upload");
    form.set("genre", "Pop");
    form.set("audio", new Blob([Buffer.from("mp3 bytes")], { type: "audio/mpeg" }), "rest-upload.mp3");
    form.set("artwork", new Blob([Buffer.from("jpg bytes")], { type: "image/jpeg" }), "cover.jpg");

    const createResponse = await fetch(`${baseUrl}/music/releases`, {
      method: "POST",
      body: form
    });
    const created = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(created.release.title, "REST Upload");
    assert.ok(created.release.mp3AssetId);
    assert.equal(created.assets.length, 2);

    const blockedResponse = await fetch(`${baseUrl}/music/releases/${created.release.id}/player-sync`, {
      method: "POST"
    });
    const blocked = await blockedResponse.json();
    assert.equal(blockedResponse.status, 403);
    assert.equal(blocked.error.code, "PLAYER_SYNC_FORBIDDEN");

    const syncResponse = await fetch(`${baseUrl}/music/releases/${created.release.id}/player-sync`, {
      method: "POST",
      headers: {
        "x-music-api-token": "test-token"
      }
    });
    const synced = await syncResponse.json();

    assert.equal(syncResponse.status, 200);
    assert.equal(synced.playerEntry.title, "REST Upload");
    assert.match(synced.playerEntry.mp3DownloadUrl, /^\/assets\/audio\//u);
  });

  it("plans a release over REST", async () => {
    const response = await fetch(`${baseUrl}/music/releases/plan`, {
      method: "POST",
      headers: {
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

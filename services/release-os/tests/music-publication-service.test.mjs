import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { publishRelease } from "../src/application/music/publication-service.mjs";
import { MARCSMUSIC_RELEASE_PLATFORM_IDS } from "../src/domain/music/platform-capabilities.mjs";

describe("publishRelease", () => {
  it("creates a dry-run batch for the 15 MarcsMusic release platforms by default", async () => {
    const batch = await publishRelease({
      title: "Nieuwe Track",
      artist: "Marc Rene",
      audioSource: "s3://marcsmusic/releases/nieuwe-track.wav",
      coverArtSource: "s3://marcsmusic/releases/nieuwe-track.jpg",
      genre: "Pop",
      tags: ["dutch", "pop"]
    });

    assert.equal(batch.dryRun, true);
    assert.deepEqual(batch.targetPlatforms, MARCSMUSIC_RELEASE_PLATFORM_IDS);
    assert.equal(batch.summary.total, 15);
    assert.equal(batch.summary.dryRun, 3);
    assert.equal(batch.summary.manualTask, 11);
    assert.equal(batch.summary.blocked, 1);
    assert.equal(resultFor(batch, "soundcloud").status, "dry_run");
    assert.equal(resultFor(batch, "spreaker").status, "dry_run");
    assert.equal(resultFor(batch, "audius").status, "dry_run");
    assert.equal(resultFor(batch, "jamendo").status, "blocked");
    assert.equal(resultFor(batch, "bandcamp").manualTask.kind, "manual_store_release");
    assert.equal(resultFor(batch, "linktree").manualTask.kind, "manual_link_update");
  });

  it("submits a SoundCloud upload through the official adapter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-"));
    const audioPath = join(dir, "track.mp3");
    await writeFile(audioPath, Buffer.from("fake audio"));

    const captured = {};
    const batch = await publishRelease(
      {
        title: "Curacao",
        artist: "Marc Rene",
        audioSource: audioPath,
        description: "Radio edit",
        genre: "Pop",
        tags: "summer, dutch",
        targetPlatforms: ["soundcloud"],
        dryRun: false
      },
      {
        env: {
          SOUNDCLOUD_ACCESS_TOKEN: "soundcloud-token"
        },
        mediaRootDir: dir,
        fetch: async (url, options) => {
          captured.url = url;
          captured.options = options;

          return new Response(
            JSON.stringify({
              id: 12345,
              permalink_url: "https://soundcloud.com/marcrene/curacao"
            }),
            {
              status: 201,
              headers: {
                "content-type": "application/json"
              }
            }
          );
        }
      }
    );

    assert.equal(batch.summary.submitted, 1);
    assert.equal(captured.url, "https://api.soundcloud.com/tracks");
    assert.equal(captured.options.headers.Authorization, "OAuth soundcloud-token");
    assert.equal(captured.options.body.get("track[title]"), "Curacao");
    assert.equal(captured.options.body.get("track[description]"), "Radio edit");
    assert.equal(captured.options.body.get("track[genre]"), "Pop");
    assert.equal(captured.options.body.get("track[tag_list]"), "summer dutch");
    assert.equal(captured.options.body.get("track[sharing]"), "private");
    assert.equal(resultFor(batch, "soundcloud").externalUrl, "https://soundcloud.com/marcrene/curacao");
  });

  it("submits a Spreaker episode through the official adapter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-"));
    const audioPath = join(dir, "episode.mp3");
    await writeFile(audioPath, Buffer.from("fake episode"));

    const captured = {};
    const batch = await publishRelease(
      {
        title: "Curacao Podcast",
        artist: "Marc Rene",
        audioSource: audioPath,
        description: "Podcast version",
        targetPlatforms: ["spreaker"],
        dryRun: false
      },
      {
        env: {
          SPREAKER_ACCESS_TOKEN: "spreaker-token",
          SPREAKER_SHOW_ID: "98765"
        },
        mediaRootDir: dir,
        fetch: async (url, options) => {
          captured.url = url;
          captured.options = options;

          return new Response(
            JSON.stringify({
              response: {
                episode: {
                  episode_id: "ep-1",
                  site_url: "https://www.spreaker.com/episode/curacao-podcast--1"
                }
              }
            }),
            {
              status: 201,
              headers: {
                "content-type": "application/json"
              }
            }
          );
        }
      }
    );

    assert.equal(batch.summary.submitted, 1);
    assert.equal(captured.url, "https://api.spreaker.com/v2/shows/98765/episodes");
    assert.equal(captured.options.headers.Authorization, "Bearer spreaker-token");
    assert.equal(captured.options.body.get("title"), "Curacao Podcast");
    assert.equal(captured.options.body.get("description"), "Podcast version");
    assert.equal(
      resultFor(batch, "spreaker").externalUrl,
      "https://www.spreaker.com/episode/curacao-podcast--1"
    );
  });

  it("blocks executable uploads when required provider credentials are missing", async () => {
    let called = false;
    const batch = await publishRelease(
      {
        title: "Geen Token",
        artist: "Marc Rene",
        audioSource: "/tmp/geen-token.mp3",
        targetPlatforms: ["soundcloud"],
        dryRun: false
      },
      {
        env: {},
        fetch: async () => {
          called = true;
          return new Response("{}", { status: 200 });
        }
      }
    );

    assert.equal(called, false);
    assert.equal(resultFor(batch, "soundcloud").status, "blocked");
    assert.match(resultFor(batch, "soundcloud").message, /SOUNDCLOUD_ACCESS_TOKEN/u);
  });

  it("accepts only managed local assets and rejects file URLs, outside paths, and escaping symlinks", async () => {
    const directory = await mkdtemp(join(tmpdir(), "marcsmusic-managed-media-"));
    const uploadRoot = join(directory, "uploads");
    const audioDir = join(uploadRoot, "audio");
    const outsidePath = join(directory, "outside.mp3");
    await mkdir(audioDir, { recursive: true });
    await writeFile(outsidePath, "outside audio");
    await symlink(outsidePath, join(audioDir, "escape.mp3"));

    for (const [audioSource, expectedCode] of [
      [outsidePath, "MEDIA_SOURCE_PATH_FORBIDDEN"],
      [pathToFileURL(outsidePath).href, "MEDIA_SOURCE_FILE_URL_FORBIDDEN"],
      [join(audioDir, "escape.mp3"), "MEDIA_SOURCE_PATH_FORBIDDEN"]
    ]) {
      let calls = 0;
      const batch = await publishRelease({
        title: "Managed Boundary",
        artist: "Marc Rene",
        audioSource,
        targetPlatforms: ["soundcloud"],
        dryRun: false
      }, {
        mediaRootDir: uploadRoot,
        env: { SOUNDCLOUD_ACCESS_TOKEN: "token" },
        fetch: async () => { calls += 1; return new Response("{}", { status: 200 }); }
      });
      assert.equal(calls, 0);
      assert.equal(resultFor(batch, "soundcloud").status, "failed");
      assert.equal(resultFor(batch, "soundcloud").errorCode, expectedCode);
    }
  });

  it("downloads audio only from explicitly allow-listed HTTPS origins", async () => {
    const calls = [];
    const batch = await publishRelease({
      title: "Allow-listed Audio",
      artist: "Marc Rene",
      audioSource: "https://media.example.test/releases/track.mp3",
      targetPlatforms: ["soundcloud"],
      dryRun: false
    }, {
      env: {
        SOUNDCLOUD_ACCESS_TOKEN: "token",
        MUSIC_MEDIA_SOURCE_HTTPS_ORIGINS: "https://media.example.test"
      },
      fetch: async (url, options) => {
        calls.push({ url: String(url), options });
        if (String(url).startsWith("https://media.example.test/")) {
          return new Response("audio bytes", { status: 200, headers: { "content-type": "audio/mpeg" } });
        }
        return new Response(JSON.stringify({ id: "track-id" }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }
    });
    assert.equal(batch.summary.submitted, 1);
    assert.deepEqual(calls.map((call) => call.url), [
      "https://media.example.test/releases/track.mp3",
      "https://api.soundcloud.com/tracks"
    ]);
    assert.equal(calls[0].options.redirect, "error");

    let unlistedCalls = 0;
    const unlisted = await publishRelease({
      title: "Unlisted Audio",
      artist: "Marc Rene",
      audioSource: "https://unlisted.example.test/track.mp3",
      targetPlatforms: ["soundcloud"],
      dryRun: false
    }, {
      env: {
        SOUNDCLOUD_ACCESS_TOKEN: "token",
        MUSIC_MEDIA_SOURCE_HTTPS_ORIGINS: "https://media.example.test"
      },
      fetch: async () => { unlistedCalls += 1; return new Response("audio"); }
    });
    assert.equal(unlistedCalls, 0);
    assert.equal(resultFor(unlisted, "soundcloud").errorCode, "MEDIA_SOURCE_ORIGIN_FORBIDDEN");

    for (const marker of [{ NODE_ENV: "production" }, { RAILWAY_ENVIRONMENT: "staging" }]) {
      let productionCalls = 0;
      const productionRemote = await publishRelease({
        title: "Production Remote",
        artist: "Marc Rene",
        audioSource: "https://media.example.test/releases/track.mp3",
        targetPlatforms: ["soundcloud"],
        dryRun: false
      }, {
        env: {
          ...marker,
          SOUNDCLOUD_ACCESS_TOKEN: "token",
          MUSIC_MEDIA_SOURCE_HTTPS_ORIGINS: "https://media.example.test"
        },
        fetch: async () => { productionCalls += 1; return new Response("audio"); }
      });
      assert.equal(productionCalls, 0);
      assert.equal(resultFor(productionRemote, "soundcloud").errorCode, "MEDIA_SOURCE_REMOTE_DISABLED");
    }
  });

  it("bounds source and provider deadlines and provider response bytes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "marcsmusic-provider-bounds-"));
    const audioPath = join(directory, "track.mp3");
    await writeFile(audioPath, "managed audio");

    const sourceTimeout = await publishRelease({
      title: "Source Timeout",
      artist: "Marc Rene",
      audioSource: "https://media.example.test/hang.mp3",
      targetPlatforms: ["soundcloud"],
      dryRun: false
    }, {
      env: {
        SOUNDCLOUD_ACCESS_TOKEN: "token",
        MUSIC_MEDIA_SOURCE_HTTPS_ORIGINS: "https://media.example.test",
        MUSIC_MEDIA_SOURCE_TIMEOUT_MS: "25"
      },
      fetch: async () => new Promise(() => {})
    });
    assert.equal(resultFor(sourceTimeout, "soundcloud").errorCode, "MEDIA_SOURCE_TIMEOUT");

    for (const platformId of ["soundcloud", "spreaker"]) {
      const env = providerEnv(platformId, {
        MUSIC_PROVIDER_TIMEOUT_MS: "25",
        MUSIC_PROVIDER_MAX_RESPONSE_BYTES: "32"
      });
      const hung = await publishRelease({
        title: `${platformId} Timeout`,
        artist: "Marc Rene",
        audioSource: audioPath,
        targetPlatforms: [platformId],
        dryRun: false
      }, {
        mediaRootDir: directory,
        env,
        fetch: async () => new Response(new ReadableStream({ start() {} }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      });
      assert.equal(resultFor(hung, platformId).errorCode, "PROVIDER_REQUEST_TIMEOUT", platformId);

      const oversized = await publishRelease({
        title: `${platformId} Oversize`,
        artist: "Marc Rene",
        audioSource: audioPath,
        targetPlatforms: [platformId],
        dryRun: false
      }, {
        mediaRootDir: directory,
        env,
        fetch: async () => new Response(JSON.stringify({ payload: "x".repeat(80) }), {
          status: 200,
          headers: { "content-type": "application/json", "content-length": "100" }
        })
      });
      assert.equal(resultFor(oversized, platformId).errorCode, "PROVIDER_RESPONSE_TOO_LARGE", platformId);
    }
  });
});

function resultFor(batch, platformId) {
  return batch.results.find((result) => result.platformId === platformId);
}

function providerEnv(platformId, extra) {
  return platformId === "soundcloud"
    ? { SOUNDCLOUD_ACCESS_TOKEN: "token", ...extra }
    : { SPREAKER_ACCESS_TOKEN: "token", SPREAKER_SHOW_ID: "show", ...extra };
}

import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
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
});

function resultFor(batch, platformId) {
  return batch.results.find((result) => result.platformId === platformId);
}

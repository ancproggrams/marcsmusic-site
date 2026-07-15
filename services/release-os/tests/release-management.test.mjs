import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createArtistService } from "../src/application/artists/artist-service.mjs";
import { createPlayerSyncService } from "../src/application/music/player-sync-service.mjs";
import { createReleaseManagementService } from "../src/application/music/release-management-service.mjs";
import { DEFAULT_ARTIST } from "../src/domain/artists/artist-model.mjs";
import { PlayerManifestClient } from "../src/infrastructure/marcsmusic-site/player-client.mjs";
import { stageReleaseSourceOutbox } from "../src/infrastructure/outreach/release-source-publisher.mjs";
import { AssetUrlSigner } from "../src/infrastructure/security/asset-url-signer.mjs";
import { ReleaseAssetStorage } from "../src/infrastructure/storage/release-asset-storage.mjs";
import { JsonStore, createDefaultState } from "../src/infrastructure/storage/json-store.mjs";

describe("release management", () => {
  it("creates artists, uploads release assets, and syncs the player idempotently", async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-release-"));
    const store = new JsonStore({ filePath: join(dir, "store.json"), initialState: createDefaultState() });
    const artistService = createArtistService({ store });
    const assetStorage = new ReleaseAssetStorage({ rootDir: join(dir, "uploads") });
    const releaseService = createReleaseManagementService({ store, assetStorage, artistService });
    const playerClient = new PlayerManifestClient({
      manifestPath: join(dir, "player-manifest.json"),
      siteBaseUrl: "https://www.marcsmusic.nl",
      downloadBaseUrl: "/assets/audio",
      artworkBaseUrl: "/assets/artwork",
      assetUrlSigner: new AssetUrlSigner({
        secret: "player-manifest-signing-test-key-longer-than-32-bytes",
        now: () => Date.UTC(2026, 6, 15, 10, 0, 0)
      })
    });
    const playerSyncService = createPlayerSyncService({ store, playerClient, artistService });

    const artists = await artistService.listArtists();
    assert.equal(artists[0].id, DEFAULT_ARTIST.id);

    const artist = await artistService.createArtist({
      name: "Second Artist",
      primaryLanguage: "en",
      country: "US"
    });

    const result = await releaseService.createRelease({
      fields: {
        title: "Upload Track",
        primaryArtistId: artist.id,
        genre: "Pop",
        subGenres: "Tropical,World Fusion",
        territories: "nl,DE,NL",
        tags: "radio,pop"
      },
      files: [
        file("audio", "upload-track.mp3", "audio/mpeg", "mp3 bytes"),
        file("wav", "upload-track.wav", "audio/wav", "wav bytes"),
        file("artwork", "cover.jpg", "image/jpeg", "jpg bytes")
      ]
    });

    assert.equal(result.release.primaryArtistId, artist.id);
    assert.deepEqual(result.release.subGenres, ["Tropical", "World Fusion"]);
    assert.deepEqual(result.release.territories, ["NL", "DE"]);
    assert.ok(result.release.mp3AssetId);
    assert.ok(result.release.wavAssetId);
    assert.ok(result.release.artworkAssetId);
    assert.equal(result.assets.length, 3);
    assert.ok(result.assets.every((asset) => asset.checksumSha256.length === 64));

    const firstSync = await playerSyncService.syncRelease(result.release.id);
    const secondSync = await playerSyncService.syncRelease(result.release.id);

    assert.equal(firstSync.releaseId, result.release.id);
    assert.equal(secondSync.releaseId, result.release.id);
    assert.equal(firstSync.artistSlug, artist.slug);
    assert.match(firstSync.mp3DownloadUrl, /^\/assets\/audio\/[^?]+\?expires=\d+&signature=[A-Za-z0-9_-]{43}$/u);
    assert.match(firstSync.wavDownloadUrl, /^\/assets\/audio\/[^?]+\?expires=\d+&signature=[A-Za-z0-9_-]{43}$/u);

    const state = await store.read();
    assert.equal(state.playerEntries.length, 1);
  });

  it("rejects invalid upload files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-release-"));
    const store = new JsonStore({ filePath: join(dir, "store.json"), initialState: createDefaultState() });
    const artistService = createArtistService({ store });
    const assetStorage = new ReleaseAssetStorage({ rootDir: join(dir, "uploads") });
    const releaseService = createReleaseManagementService({ store, assetStorage, artistService });

    await assert.rejects(
      () =>
        releaseService.createRelease({
          fields: { title: "Bad File" },
          files: [file("audio", "bad.exe", "application/octet-stream", "bad")]
        }),
      /Audio file must be MP3 or WAV/u
    );
  });

  it("stages an eligible source artifact in the same release store commit", async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-release-"));
    const store = new JsonStore({ filePath: join(dir, "store.json"), initialState: createDefaultState() });
    const artistService = createArtistService({ store });
    const assetStorage = new ReleaseAssetStorage({ rootDir: join(dir, "uploads") });
    const releaseService = createReleaseManagementService({
      store,
      assetStorage,
      artistService,
      sourceOutboxStager: stageReleaseSourceOutbox
    });
    await releaseService.createRelease({
      fields: {
        title: "Signed Source Track",
        isrc: "NLABC1234567",
        epkUrl: "https://music.example/epk",
        sourceUrl: "https://music.example/releases/signed-source-track",
        sourceEvidence: "The owned release record and EPK identify this release.",
        sourceCapturedAt: new Date().toISOString(),
        subGenres: ["Tropical", "World Fusion"],
        territories: ["NL", "DE"]
      },
      files: [file("audio", "signed-source.mp3", "audio/mpeg", "mp3 bytes")]
    });
    const state = await store.read();
    assert.equal(state.releases.length, 1);
    assert.equal(state.outreachSourceOutbox.artifact.records.length, 1);
    assert.equal(state.outreachSourceOutbox.artifact.records[0].isrc, "NLABC1234567");
    assert.deepEqual(state.outreachSourceOutbox.artifact.records[0].subGenres, ["Tropical", "World Fusion"]);
    assert.deepEqual(state.outreachSourceOutbox.artifact.records[0].territories, ["NL", "DE"]);
  });

  it("rejects unknown or unbounded outreach taxonomy values", async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-release-"));
    const store = new JsonStore({ filePath: join(dir, "store.json"), initialState: createDefaultState() });
    const artistService = createArtistService({ store });
    const assetStorage = new ReleaseAssetStorage({ rootDir: join(dir, "uploads") });
    const releaseService = createReleaseManagementService({ store, assetStorage, artistService });

    await assert.rejects(() => releaseService.createRelease({
      fields: { title: "Unknown Taxonomy", subGenres: ["Invented Genre"] },
      files: [file("audio", "taxonomy.mp3", "audio/mpeg", "mp3 bytes")]
    }), (error) => error.code === "VALIDATION_ERROR");
    await assert.rejects(() => releaseService.createRelease({
      fields: { title: "Invalid Territory", territories: ["NLD"] },
      files: [file("audio", "territory.mp3", "audio/mpeg", "mp3 bytes")]
    }), (error) => error.code === "VALIDATION_ERROR");
  });

  it("compensates every saved file when release validation or the durable store commit fails", async () => {
    const validationDir = await mkdtemp(join(tmpdir(), "marcsmusic-release-compensation-"));
    const validationStore = new JsonStore({
      filePath: join(validationDir, "store.json"),
      initialState: createDefaultState()
    });
    const validationStorage = new ReleaseAssetStorage({ rootDir: join(validationDir, "uploads") });
    const validationService = createReleaseManagementService({
      store: validationStore,
      assetStorage: validationStorage,
      artistService: createArtistService({ store: validationStore })
    });
    await assert.rejects(
      () => validationService.createRelease({
        fields: { title: "Artwork Without Audio" },
        files: [file("artwork", "cover.jpg", "image/jpeg", "jpg bytes")]
      }),
      (error) => error.code === "AUDIO_REQUIRED"
    );
    assert.deepEqual(await readdir(join(validationDir, "uploads", "artwork")), []);

    const commitDir = await mkdtemp(join(tmpdir(), "marcsmusic-release-commit-compensation-"));
    const artistStore = new JsonStore({ filePath: join(commitDir, "artist-store.json"), initialState: createDefaultState() });
    const commitStorage = new ReleaseAssetStorage({ rootDir: join(commitDir, "uploads") });
    const commitFailure = Object.assign(new Error("durable store unavailable"), { code: "STORE_UNAVAILABLE" });
    const commitService = createReleaseManagementService({
      store: {
        read: artistStore.read.bind(artistStore),
        update: async () => { throw commitFailure; }
      },
      assetStorage: commitStorage,
      artistService: createArtistService({ store: artistStore })
    });
    await assert.rejects(
      () => commitService.createRelease({
        fields: { title: "Commit Failure" },
        files: [file("audio", "commit.mp3", "audio/mpeg", "mp3 bytes")]
      }),
      (error) => error === commitFailure
    );
    assert.deepEqual(await readdir(join(commitDir, "uploads", "audio")), []);
  });

  it("removes only old unreferenced files within bounded cleanup limits", async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-orphan-cleanup-"));
    const rootDir = join(dir, "uploads");
    const audioDir = join(rootDir, "audio");
    await mkdir(audioDir, { recursive: true });
    const fixedNow = Date.UTC(2026, 6, 15, 10, 0, 0);
    for (const name of ["old-a.mp3", "old-b.mp3", "referenced.mp3", "fresh.mp3"]) {
      await writeFile(join(audioDir, name), name);
    }
    const oldTime = (fixedNow - 2 * 60 * 60_000) / 1_000;
    for (const name of ["old-a.mp3", "old-b.mp3", "referenced.mp3"]) {
      await utimes(join(audioDir, name), oldTime, oldTime);
    }
    const freshTime = fixedNow / 1_000;
    await utimes(join(audioDir, "fresh.mp3"), freshTime, freshTime);

    const storage = new ReleaseAssetStorage({ rootDir });
    const referenced = [{ kind: "audio_mp3", storageFilename: "referenced.mp3" }];
    const first = await storage.cleanupOrphans(referenced, {
      graceMs: 60 * 60_000,
      maxDeletes: 1,
      maxScan: 10,
      now: () => fixedNow
    });
    assert.equal(first.deleted, 1);
    assert.equal(first.truncated, true);

    const second = await storage.cleanupOrphans(referenced, {
      graceMs: 60 * 60_000,
      maxDeletes: 10,
      maxScan: 10,
      now: () => fixedNow
    });
    assert.equal(second.deleted, 1);
    assert.deepEqual((await readdir(audioDir)).sort(), ["fresh.mp3", "referenced.mp3"]);
  });
});

function file(name, filename, contentType, data) {
  return {
    name,
    filename,
    contentType,
    data: Buffer.from(data)
  };
}

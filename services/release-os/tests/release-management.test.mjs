import assert from "node:assert/strict";
import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { describe, it } from "node:test";
import { createArtistService } from "../src/application/artists/artist-service.mjs";
import { createPlayerSyncService } from "../src/application/music/player-sync-service.mjs";
import { createReleaseManagementService } from "../src/application/music/release-management-service.mjs";
import { DEFAULT_ARTIST } from "../src/domain/artists/artist-model.mjs";
import { PlayerManifestClient } from "../src/infrastructure/marcsmusic-site/player-client.mjs";
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
      artworkBaseUrl: "/assets/artwork"
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
        tags: "radio,pop"
      },
      files: [
        file("audio", "upload-track.mp3", "audio/mpeg", "mp3 bytes"),
        file("wav", "upload-track.wav", "audio/wav", "wav bytes"),
        file("artwork", "cover.jpg", "image/jpeg", "jpg bytes")
      ]
    });

    assert.equal(result.release.primaryArtistId, artist.id);
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
    assert.match(firstSync.mp3DownloadUrl, /^\/assets\/audio\//u);
    assert.match(firstSync.wavDownloadUrl, /^\/assets\/audio\//u);

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

  it("generates release IDs server-side and keeps asset paths inside the upload root", async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-release-"));
    const uploadRoot = join(dir, "uploads");
    const store = new JsonStore({ filePath: join(dir, "store.json"), initialState: createDefaultState() });
    const artistService = createArtistService({ store });
    const assetStorage = new ReleaseAssetStorage({ rootDir: uploadRoot });
    const releaseService = createReleaseManagementService({ store, assetStorage, artistService });

    const result = await releaseService.createRelease({
      fields: { title: "Contained Track", releaseId: "../../escaped-release" },
      files: [file("audio", "contained-track.mp3", "audio/mpeg", "mp3 bytes")]
    });

    assert.notEqual(result.release.id, "../../escaped-release");
    assert.match(
      result.release.id,
      /^rel_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    );

    const canonicalUploadRoot = await realpath(uploadRoot);
    for (const asset of result.assets) {
      const pathFromRoot = relative(canonicalUploadRoot, asset.storagePath);
      assert.equal(isAbsolute(pathFromRoot), false);
      assert.doesNotMatch(pathFromRoot, /^\.\.(?:[/\\]|$)/u);
    }
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

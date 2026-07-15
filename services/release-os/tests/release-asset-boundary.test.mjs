import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { createArtistService } from "../src/application/artists/artist-service.mjs";
import { createReleaseManagementService } from "../src/application/music/release-management-service.mjs";
import { ReleaseAssetStorage } from "../src/infrastructure/storage/release-asset-storage.mjs";
import { JsonStore, createDefaultState } from "../src/infrastructure/storage/json-store.mjs";

describe("release asset write boundary", () => {
  it("rejects caller-provided release identifiers that are not safe storage identifiers", async () => {
    const directory = await mkdtemp(join(tmpdir(), "marcsmusic-release-id-"));
    const uploadRoot = join(directory, "uploads");
    const store = new JsonStore({ filePath: join(directory, "store.json"), initialState: createDefaultState() });
    const service = createReleaseManagementService({
      store,
      assetStorage: new ReleaseAssetStorage({ rootDir: uploadRoot }),
      artistService: createArtistService({ store })
    });

    for (const releaseId of ["..", "../outside", "nested/release", "nested\\release", ".hidden", "x".repeat(65)]) {
      await assert.rejects(
        () => service.createRelease({
          fields: { title: "Boundary Track", releaseId },
          files: [audioFile()]
        }),
        (error) => error.code === "INVALID_RELEASE_ID" && error.statusCode === 400,
        releaseId
      );
    }

    const uploadEntries = await readdir(uploadRoot).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error));
    assert.deepEqual(uploadEntries, []);
  });

  it("enforces the same identifier boundary when storage is called directly", async () => {
    const directory = await mkdtemp(join(tmpdir(), "marcsmusic-storage-id-"));
    const storage = new ReleaseAssetStorage({ rootDir: join(directory, "uploads") });
    await assert.rejects(
      () => storage.saveAsset({ releaseId: "../../outside", file: audioFile(), kind: "audio" }),
      (error) => error.code === "INVALID_RELEASE_ID"
    );
    await assert.rejects(access(join(directory, "outside-audio-track.mp3")));
  });

  it("rejects an upload subdirectory that resolves outside the configured root", async () => {
    const directory = await mkdtemp(join(tmpdir(), "marcsmusic-storage-link-"));
    const uploadRoot = join(directory, "uploads");
    const outside = join(directory, "outside");
    await mkdir(uploadRoot, { recursive: true });
    await mkdir(outside, { recursive: true });
    await symlink(outside, join(uploadRoot, "audio"));

    const storage = new ReleaseAssetStorage({ rootDir: uploadRoot });
    await assert.rejects(
      () => storage.saveAsset({ releaseId: "safe-release", file: audioFile(), kind: "audio" }),
      (error) => error.code === "ASSET_PATH_FORBIDDEN"
    );
    assert.deepEqual(await readdir(outside), []);
  });
});

function audioFile() {
  return {
    name: "audio",
    filename: "track.mp3",
    contentType: "audio/mpeg",
    data: Buffer.from("audio bytes")
  };
}

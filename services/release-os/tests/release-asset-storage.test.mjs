import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { describe, it } from "node:test";
import { ReleaseAssetStorage } from "../src/infrastructure/storage/release-asset-storage.mjs";

describe("release asset storage", () => {
  it("uses a UUID and checksum filename inside the configured root", async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-assets-"));
    const rootDir = join(dir, "uploads");
    const storage = new ReleaseAssetStorage({ rootDir });

    const upload = file("../untrusted name.mp3", "audio/mpeg", "mp3 bytes");
    const asset = await storage.saveAsset({
      releaseId: "../../untrusted-release-id",
      kind: "audio",
      file: upload
    });

    const filenameMatch = asset.storageFilename.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-([0-9a-f]{64})\.mp3$/u
    );
    assert.ok(filenameMatch);
    assert.equal(asset.id, `asset_${filenameMatch[1]}`);
    assert.equal(filenameMatch[2], createHash("sha256").update(upload.data).digest("hex"));
    assert.deepEqual(await readFile(asset.storagePath), upload.data);
    const pathFromRoot = relative(await realpath(rootDir), asset.storagePath);
    assert.equal(isAbsolute(pathFromRoot), false);
    assert.doesNotMatch(pathFromRoot, /^\.\.(?:[/\\]|$)/u);
  });

  it("rejects a symlinked asset directory that escapes the configured root", async () => {
    const dir = await mkdtemp(join(tmpdir(), "marcsmusic-assets-"));
    const rootDir = join(dir, "uploads");
    const outsideDir = join(dir, "outside");
    await mkdir(rootDir, { recursive: true });
    await mkdir(outsideDir, { recursive: true });
    await symlink(outsideDir, join(rootDir, "audio"), "dir");

    const storage = new ReleaseAssetStorage({ rootDir });
    await assert.rejects(
      () =>
        storage.saveAsset({
          releaseId: "rel_test",
          kind: "audio",
          file: file("track.mp3", "audio/mpeg", "mp3 bytes")
        }),
      (error) => error.code === "ASSET_STORAGE_ESCAPE"
    );
    assert.deepEqual(await readdir(outsideDir), []);
  });
});

function file(filename, contentType, data) {
  return { filename, contentType, data: Buffer.from(data) };
}

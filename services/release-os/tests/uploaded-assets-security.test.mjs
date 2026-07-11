import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createMusicApiServer } from "../src/interfaces/http/music-api-server.mjs";

describe("uploaded asset security", () => {
  let server;
  let baseUrl;
  let root;
  before(async () => {
    root = await mkdtemp(join(tmpdir(), "marcsmusic-assets-"));
    const uploadDir = join(root, "uploads");
    await mkdir(join(uploadDir, "audio"), { recursive: true });
    await mkdir(join(uploadDir, "artwork"), { recursive: true });
    await writeFile(join(uploadDir, "audio", "safe.mp3"), "safe bytes");
    await writeFile(join(uploadDir, "audio", "unsafe.html"), "secret");
    await writeFile(join(root, "outside.mp3"), "outside secret");
    await symlink(join(root, "outside.mp3"), join(uploadDir, "audio", "escape.mp3"));
    server = createMusicApiServer({ storeFilePath: join(root, "store.json"), uploadDir, playerManifestPath: join(root, "manifest.json"), env: {} });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    const closed = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
    await rm(root, { recursive: true, force: true });
  });

  it("serves valid files with immutable and nosniff metadata", async () => {
    const response = await fetch(`${baseUrl}/assets/audio/safe.mp3`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "safe bytes");
    assert.equal(response.headers.get("content-length"), "10");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });

  it("conceals invalid paths, extensions, malformed encoding and symlinks", async () => {
    for (const path of ["missing.mp3", "%2e%2e%2foutside.mp3", "%E0%A4%A.mp3", "unsafe.html", "escape.mp3"]) {
      const response = await fetch(`${baseUrl}/assets/audio/${path}`);
      const body = await response.json();
      assert.equal(response.status, 404);
      assert.equal(body.error.code, "ASSET_NOT_FOUND");
    }
  });

  it("exposes a minimal liveness endpoint", async () => {
    const response = await fetch(`${baseUrl}/livez`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, unlink, utimes, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PlayerManifestClient } from "../src/infrastructure/marcsmusic-site/player-client.mjs";
import { JsonStore } from "../src/infrastructure/storage/json-store.mjs";

describe("cross-instance JSON consistency", () => {
  it("serializes many JsonStore and player-manifest instances in one process", async () => {
    const directory = await mkdtemp(join(tmpdir(), "marcsmusic-instance-lock-"));
    const storePath = join(directory, "store.json");
    const manifestPath = join(directory, "manifest.json");
    const identifiers = Array.from({ length: 40 }, (_, index) => `entry-${index}`);

    await Promise.all(identifiers.map((identifier) => {
      const store = new JsonStore({ filePath: storePath, initialState: { values: [] } });
      return store.update((state) => {
        state.values ??= [];
        state.values.push(identifier);
      });
    }));
    await Promise.all(identifiers.map((identifier) => {
      const client = new PlayerManifestClient({ manifestPath });
      return client.upsertTrack({ releaseId: identifier, title: identifier });
    }));

    const store = JSON.parse(await readFile(storePath, "utf8"));
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.deepEqual([...store.values].sort(), [...identifiers].sort());
    assert.deepEqual(manifest.tracks.map((track) => track.releaseId).sort(), [...identifiers].sort());
    assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith(".tmp") || name.endsWith(".lock")), []);
  });

  it("preserves every update from independent writer processes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "marcsmusic-process-lock-"));
    const fixture = new URL("./fixtures/concurrent-json-writer.mjs", import.meta.url);

    for (const kind of ["store", "player"]) {
      const outputPath = join(directory, `${kind}.json`);
      const startPath = join(directory, `${kind}.start`);
      const identifiers = Array.from({ length: 8 }, (_, index) => `${kind}-${index}`);
      const children = identifiers.map((identifier) => runWriter(fileURLToPath(fixture), [kind, outputPath, identifier, startPath]));
      await writeFile(startPath, "start", "utf8");
      await Promise.all(children);

      const output = JSON.parse(await readFile(outputPath, "utf8"));
      const actual = kind === "store" ? output.values : output.tracks.map((track) => track.releaseId);
      assert.deepEqual([...actual].sort(), [...identifiers].sort(), kind);
      await unlink(startPath);
    }
  });

  it("releases a lock after callback failure and times out safely behind a live owner", async () => {
    const directory = await mkdtemp(join(tmpdir(), "marcsmusic-lock-recovery-"));
    const storePath = join(directory, "store.json");
    const store = new JsonStore({ filePath: storePath, initialState: { values: [] }, lockTimeoutMs: 60 });

    await assert.rejects(() => store.update(() => { throw new Error("expected callback failure"); }), /expected callback failure/u);
    await store.update((state) => { state.values.push("after-failure"); });
    assert.deepEqual((await store.read()).values, ["after-failure"]);

    await writeFile(`${storePath}.lock`, JSON.stringify({
      token: "live-owner",
      pid: process.pid,
      hostname: hostname(),
      createdAt: new Date().toISOString()
    }), "utf8");
    await assert.rejects(
      () => store.update((state) => { state.values.push("must-not-write"); }),
      (error) => error.code === "FILE_LOCK_TIMEOUT" && error.retryable === true
    );
    await unlink(`${storePath}.lock`);
    assert.deepEqual((await store.read()).values, ["after-failure"]);
  });

  it("recovers an expired lease across host restarts and PID reuse", async () => {
    const directory = await mkdtemp(join(tmpdir(), "marcsmusic-expired-lease-"));
    const staleTime = new Date(Date.now() - 5_000);

    for (const [name, owner] of [
      ["other-host", { hostname: "previous-railway-replica", pid: 1, processInstanceId: "old-host-instance" }],
      ["reused-pid", { hostname: hostname(), pid: process.pid, processInstanceId: "previous-process-instance" }]
    ]) {
      const storePath = join(directory, `${name}.json`);
      await writeFile(`${storePath}.lock`, JSON.stringify({
        token: `${name}-token`,
        createdAt: staleTime.toISOString(),
        leaseMs: 50,
        ...owner
      }), "utf8");
      await utimes(`${storePath}.lock`, staleTime, staleTime);
      if (name === "other-host") {
        await writeFile(`${storePath}.lock.recovery`, "abandoned recovery guard", "utf8");
        await utimes(`${storePath}.lock.recovery`, staleTime, staleTime);
      }
      const store = new JsonStore({
        filePath: storePath,
        initialState: { values: [] },
        lockTimeoutMs: 500,
        lockLeaseMs: 50
      });
      await store.update((state) => { state.values.push(name); });
      assert.deepEqual((await store.read()).values, [name]);
    }
  });

  it("keeps a long-running active lease while a competing instance waits", async () => {
    const directory = await mkdtemp(join(tmpdir(), "marcsmusic-active-lease-"));
    const storePath = join(directory, "store.json");
    const firstStore = new JsonStore({ filePath: storePath, initialState: { values: [] }, lockTimeoutMs: 1_000, lockLeaseMs: 90 });
    const secondStore = new JsonStore({ filePath: storePath, initialState: { values: [] }, lockTimeoutMs: 1_000, lockLeaseMs: 90 });
    let releaseFirst;
    let notifyEntered;
    const entered = new Promise((resolve) => { notifyEntered = resolve; });
    const release = new Promise((resolve) => { releaseFirst = resolve; });
    const first = firstStore.update(async (state) => {
      notifyEntered();
      await release;
      state.values.push("first");
    });
    await entered;
    let secondSettled = false;
    const second = secondStore.update((state) => { state.values.push("second"); })
      .finally(() => { secondSettled = true; });
    await new Promise((resolve) => setTimeout(resolve, 220));
    assert.equal(secondSettled, false, "the heartbeat keeps the lease active beyond one lease period");
    releaseFirst();
    await Promise.all([first, second]);
    assert.deepEqual((await firstStore.read()).values, ["first", "second"]);
  });

  it("readers observe valid old-or-new JSON during contended atomic replacement", async () => {
    const directory = await mkdtemp(join(tmpdir(), "marcsmusic-atomic-read-"));
    const storePath = join(directory, "store.json");
    const store = new JsonStore({ filePath: storePath, initialState: { values: [] } });
    await store.read();

    const writers = Array.from({ length: 30 }, (_, index) => store.update((state) => {
      state.values.push(`value-${index}`);
    }));
    let complete = false;
    const completion = Promise.all(writers).finally(() => { complete = true; });
    while (!complete) {
      assert.doesNotThrow(() => JSON.parse(readFileSync(storePath, "utf8")));
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    await completion;
    assert.equal(JSON.parse(await readFile(storePath, "utf8")).values.length, 30);
  });
});

function runWriter(fixturePath, args) {
  const child = spawn(process.execPath, [fixturePath, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk) => { output += chunk.toString("utf8"); });
  return new Promise((resolve, reject) => child.once("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`writer exited ${code}: ${output.slice(0, 1_000)}`));
  }));
}

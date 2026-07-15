import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, test } from "node:test";

import { createEpkUrlPolicy, EpkContractError, validateEpkManifest } from "../src/epk/epk-contract.mjs";
import { renderEpkPage } from "../src/epk/epk-page.mjs";
import { createEpkService } from "../src/epk/epk-service.mjs";

const execFileAsync = promisify(execFile);
const temporaryDirectories = [];
const SITE_ORIGIN = "https://www.marcsmusic.test";
const ALLOWED_ORIGINS = ["https://media.example.test", "https://evidence.example.test", "https://open.spotify.com"];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("the strict public EPK contract accepts complete owned, evidence-backed metadata", () => {
  const manifest = validateEpkManifest(validManifest(), { urlPolicy: urlPolicy() });
  assert.equal(manifest.releases[0].slug, "test-release");
  assert.equal(manifest.releases[0].artistBio.rights, "owned");
  assert.equal(manifest.releases[0].publicStream.access, "public");
  assert.deepEqual(manifest.releases[0].moods, ["Driving", "Focused"]);
  assert.equal(manifest.releases[0].spotifyUrl, "https://open.spotify.com/track/0123456789AbCdEfGhIjKl");
  assert.deepEqual(Object.keys(manifest.releases[0].downloads), ["mp3", "wav"]);

  const noTempo = validManifest();
  noTempo.releases[0].instrumental = true;
  noTempo.releases[0].tempo = { kind: "not-applicable", reason: "no-fixed-tempo" };
  assert.deepEqual(validateEpkManifest(noTempo, { urlPolicy: urlPolicy() }).releases[0].tempo, {
    kind: "not-applicable",
    reason: "no-fixed-tempo"
  });
});

test("missing required fields and incomplete download sets fail closed", () => {
  const missingIsrc = validManifest();
  delete missingIsrc.releases[0].isrc;
  assert.throws(
    () => validateEpkManifest(missingIsrc, { urlPolicy: urlPolicy() }),
    (error) => error instanceof EpkContractError && error.code === "EPK_FIELD_MISSING" && error.path.endsWith(".isrc")
  );

  const noBroadcastAsset = validManifest();
  delete noBroadcastAsset.releases[0].downloads.wav;
  assert.throws(
    () => validateEpkManifest(noBroadcastAsset, { urlPolicy: urlPolicy() }),
    (error) => error.code === "EPK_DOWNLOAD_SET_INCOMPLETE"
  );

  for (const field of ["moods", "spotifyUrl"]) {
    const incomplete = validManifest();
    delete incomplete.releases[0][field];
    assert.throws(
      () => validateEpkManifest(incomplete, { urlPolicy: urlPolicy() }),
      (error) => error.code === "EPK_FIELD_MISSING" && error.path.endsWith(`.${field}`),
      field
    );
  }

  const impossibleTimestamp = validManifest();
  impossibleTimestamp.generatedAt = "2026-02-30T12:00:00Z";
  assert.throws(
    () => validateEpkManifest(impossibleTimestamp, { urlPolicy: urlPolicy() }),
    (error) => error.code === "EPK_TIMESTAMP_INVALID"
  );

  assert.throws(
    () => createEpkUrlPolicy({ siteOrigin: "http://www.marcsmusic.test" }),
    (error) => error.code === "EPK_SITE_ORIGIN_INVALID"
  );
});

test("markup, private URL tokens, path traversal and non-allow-listed origins are rejected", () => {
  const cases = [
    ["markup", (manifest) => { manifest.releases[0].artist = '<script src="https://evil.test/x.js"></script>'; }, "EPK_TEXT_UNSAFE"],
    ["query token", (manifest) => { manifest.releases[0].publicStream.url += "?token=private"; }, "EPK_URL_PRIVATE_COMPONENT_FORBIDDEN"],
    ["path traversal", (manifest) => { manifest.releases[0].downloads.mp3.url = "/assets/epk/../private/file.mp3"; }, "EPK_URL_PATH_INVALID"],
    ["double encoded traversal", (manifest) => { manifest.releases[0].downloads.mp3.url = "/assets/epk/%252e%252e/private/file.mp3"; }, "EPK_URL_PATH_INVALID"],
    ["spotify query token", (manifest) => { manifest.releases[0].spotifyUrl += "?si=private"; }, "EPK_URL_PRIVATE_COMPONENT_FORBIDDEN"],
    ["duplicate Spotify and stream URL", (manifest) => { manifest.releases[0].spotifyUrl = manifest.releases[0].publicStream.url; }, "EPK_SPOTIFY_URL_DUPLICATE"],
    ["non-Spotify track origin", (manifest) => { manifest.releases[0].spotifyUrl = "https://media.example.test/track/0123456789AbCdEfGhIjKl"; }, "EPK_SPOTIFY_URL_INVALID"],
    ["Spotify album path", (manifest) => { manifest.releases[0].spotifyUrl = "https://open.spotify.com/album/0123456789AbCdEfGhIjKl"; }, "EPK_SPOTIFY_URL_INVALID"],
    ["Spotify playlist path", (manifest) => { manifest.releases[0].spotifyUrl = "https://open.spotify.com/playlist/0123456789AbCdEfGhIjKl"; }, "EPK_SPOTIFY_URL_INVALID"],
    ["malformed Spotify track ID", (manifest) => { manifest.releases[0].spotifyUrl = "https://open.spotify.com/track/too-short"; }, "EPK_SPOTIFY_URL_INVALID"],
    ["foreign origin", (manifest) => { manifest.releases[0].artwork.url = "https://evil.example/cover.jpg"; }, "EPK_URL_ORIGIN_FORBIDDEN"],
    ["insecure origin", (manifest) => { manifest.releases[0].artwork.url = "http://media.example.test/cover.jpg"; }, "EPK_URL_ORIGIN_FORBIDDEN"]
  ];
  for (const [name, mutate, code] of cases) {
    const manifest = validManifest();
    mutate(manifest);
    assert.throws(
      () => validateEpkManifest(manifest, { urlPolicy: urlPolicy() }),
      (error) => error.code === code,
      name
    );
  }
});

test("HTML rendering escapes text even after contract validation", () => {
  const release = structuredClone(validateEpkManifest(validManifest(), { urlPolicy: urlPolicy() }).releases[0]);
  release.title = 'A & "quoted" <unsafe> title';
  const html = renderEpkPage({ release, manifestGeneratedAt: new Date().toISOString(), siteOrigin: SITE_ORIGIN });
  assert.match(html, /A &amp; &quot;quoted&quot; &lt;unsafe&gt; title/u);
  assert.doesNotMatch(html, /<unsafe>/u);
  assert.doesNotMatch(html, /<script/iu);
});

test("HTML and JSON endpoints expose security headers and support conditional GET and HEAD", async (t) => {
  const fixture = await serviceFixture(t, validManifest());
  const html = await fetch(`${fixture.baseUrl}/epk/test-release`);
  assert.equal(html.status, 200);
  assert.match(html.headers.get("content-type"), /^text\/html/u);
  assert.match(html.headers.get("content-security-policy"), /script-src 'none'/u);
  assert.match(html.headers.get("content-security-policy"), /style-src 'sha256-/u);
  assert.doesNotMatch(html.headers.get("content-security-policy"), /unsafe-inline/u);
  assert.equal(html.headers.get("x-frame-options"), "DENY");
  assert.equal(html.headers.get("cross-origin-resource-policy"), "same-origin");
  const htmlBody = await html.text();
  assert.match(htmlBody, /Official electronic press kit/u);
  assert.match(htmlBody, /Open in Spotify/u);
  assert.match(htmlBody, /Driving/u);
  assert.match(htmlBody, /Machine-readable JSON/u);

  const json = await fetch(`${fixture.baseUrl}/api/epk/test-release`);
  assert.equal(json.status, 200);
  assert.match(json.headers.get("content-type"), /^application\/json/u);
  const payload = await json.json();
  assert.equal(payload.schemaVersion, "1.0");
  assert.equal(payload.release.isrc, "XXAAA0000001");
  assert.equal(payload.release.contact.email, "press@example.test");
  const etag = json.headers.get("etag");
  assert.ok(etag);

  const notModified = await fetch(`${fixture.baseUrl}/api/epk/test-release`, { headers: { "if-none-match": etag } });
  assert.equal(notModified.status, 304);
  assert.equal(await notModified.text(), "");

  const since = await fetch(`${fixture.baseUrl}/api/epk/test-release`, {
    headers: { "if-modified-since": json.headers.get("last-modified") }
  });
  assert.equal(since.status, 304);

  const head = await fetch(`${fixture.baseUrl}/epk/test-release`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.ok(Number(head.headers.get("content-length")) > 0);
  assert.equal(await head.text(), "");
});

test("invalid reloads retain the last-known-good manifest until an atomic valid replacement", async (t) => {
  const fixture = await serviceFixture(t, validManifest());
  const invalid = validManifest();
  invalid.releases[0].publicStream.url += "?private=token";
  await writeFile(fixture.manifestPath, JSON.stringify(invalid), "utf8");
  await fixture.service.refresh({ force: true });
  assert.deepEqual(fixture.service.capability(), {
    available: true,
    configured: true,
    stale: true,
    lastErrorCode: "EPK_URL_PRIVATE_COMPONENT_FORBIDDEN",
    lastLoadedAt: fixture.service.capability().lastLoadedAt,
    releaseCount: 1
  });
  const retained = await fetch(`${fixture.baseUrl}/api/epk/test-release`);
  assert.equal((await retained.json()).release.title, "Test & Verified Release");

  const replacement = validManifest();
  replacement.releases[0].title = "Atomically Replaced Release";
  const temporaryPath = `${fixture.manifestPath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(replacement), "utf8");
  await rename(temporaryPath, fixture.manifestPath);
  await fixture.service.refresh({ force: true });
  assert.equal(fixture.service.capability().stale, false);
  const updated = await fetch(`${fixture.baseUrl}/api/epk/test-release`);
  assert.equal((await updated.json()).release.title, "Atomically Replaced Release");
});

test("absent, example-only and out-of-root manifests keep capability false and routes at 404", async (t) => {
  const directory = await temporaryDirectory();
  const root = join(directory, "epk");
  await mkdir(root);
  const absent = createEpkService({
    manifestRoot: root,
    manifestPath: join(root, "missing.json"),
    siteOrigin: SITE_ORIGIN,
    allowedHttpsOrigins: ALLOWED_ORIGINS,
    reloadIntervalMs: 0
  });
  await absent.initialize();
  assert.equal(absent.capability().available, false);
  assert.equal(absent.capability().lastErrorCode, "EPK_MANIFEST_NOT_FOUND");
  const absentServer = await startServer(t, absent);
  assert.equal((await fetch(`${absentServer}/epk/test-release`)).status, 404);

  const examplePath = join(root, "example.json");
  const example = validManifest();
  example.exampleOnly = true;
  await writeFile(examplePath, JSON.stringify(example), "utf8");
  const exampleService = createEpkService({
    manifestRoot: root,
    manifestPath: examplePath,
    siteOrigin: SITE_ORIGIN,
    allowedHttpsOrigins: ALLOWED_ORIGINS,
    reloadIntervalMs: 0
  });
  await exampleService.initialize();
  assert.equal(exampleService.capability().available, false);
  assert.equal(exampleService.capability().lastErrorCode, "EPK_EXAMPLE_MANIFEST_FORBIDDEN");

  const outside = createEpkService({
    manifestRoot: root,
    manifestPath: join(directory, "outside.json"),
    siteOrigin: SITE_ORIGIN,
    allowedHttpsOrigins: ALLOWED_ORIGINS
  });
  await outside.initialize();
  assert.equal(outside.capability().available, false);
  assert.equal(outside.capability().lastErrorCode, "EPK_MANIFEST_PATH_FORBIDDEN");
});

test("the production site starts without a manifest and wires health and EPK routes when one becomes configured", async (t) => {
  const directory = await temporaryDirectory();
  const commonEnvironment = {
    ...process.env,
    APP_BASE_URL: SITE_ORIGIN,
    PRIVACY_HASH_SALT: "epk-server-test-privacy-salt",
    BOOKING_DB_PATH: join(directory, "bookings.json"),
    RAILWAY_ENVIRONMENT: ""
  };
  const disabled = await startSiteProcess(t, {
    ...commonEnvironment,
    EPK_MANIFEST_ROOT: "",
    EPK_MANIFEST_PATH: ""
  });
  const disabledHealth = await fetch(`${disabled.baseUrl}/api/health`);
  assert.equal(disabledHealth.status, 200);
  const disabledHealthBody = await disabledHealth.json();
  assert.deepEqual(disabledHealthBody, {
    status: "ok",
    service: "marcsmusic-booking",
    capabilities: { epk: false, epkStale: false }
  });
  assert.equal((await fetch(`${disabled.baseUrl}/api/admin/bookings`)).status, 503);
  assert.equal((await fetch(`${disabled.baseUrl}/epk/test-release`)).status, 404);

  const root = join(directory, "epk");
  const manifestPath = join(root, "public.json");
  await mkdir(root);
  await writeFile(manifestPath, JSON.stringify(validManifest()), "utf8");
  const enabled = await startSiteProcess(t, {
    ...commonEnvironment,
    ADMIN_TOKEN: "a-secure-test-administrator-token-1234567890",
    BOOKING_DB_PATH: join(directory, "enabled-bookings.json"),
    EPK_MANIFEST_ROOT: root,
    EPK_MANIFEST_PATH: manifestPath,
    EPK_ALLOWED_HTTPS_ORIGINS: ALLOWED_ORIGINS.join(",")
  });
  const enabledHealth = await fetch(`${enabled.baseUrl}/api/health`);
  assert.deepEqual((await enabledHealth.json()).capabilities, { epk: true, epkStale: false });
  assert.equal((await fetch(`${enabled.baseUrl}/api/admin/bookings`, {
    headers: { authorization: "Bearer wrong" }
  })).status, 401);
  assert.equal((await fetch(`${enabled.baseUrl}/api/admin/bookings`, {
    headers: { authorization: "Bearer a-secure-test-administrator-token-1234567890" }
  })).status, 200);
  assert.equal((await fetch(`${enabled.baseUrl}/epk/test-release`)).status, 200);
  assert.equal((await fetch(`${enabled.baseUrl}/api/epk/test-release`)).status, 200);
});

test("the builder validates examples explicitly and writes production manifests atomically inside the configured root", async () => {
  const directory = await temporaryDirectory();
  const root = join(directory, "root");
  const input = join(directory, "input.json");
  const output = join(root, "public.json");
  await writeFile(input, JSON.stringify(validManifest()), "utf8");
  const environment = {
    ...process.env,
    APP_BASE_URL: SITE_ORIGIN,
    EPK_MANIFEST_ROOT: root,
    EPK_ALLOWED_HTTPS_ORIGINS: ALLOWED_ORIGINS.join(",")
  };
  const result = await execFileAsync(process.execPath, ["scripts/build-epk-manifest.mjs", "--input", input, "--output", output], {
    cwd: process.cwd(),
    env: environment,
    timeout: 10_000
  });
  assert.deepEqual(JSON.parse(result.stdout), { ok: true, schemaVersion: "1.0", releases: 1, written: true });
  assert.equal(JSON.parse(await readFile(output, "utf8")).releases[0].slug, "test-release");

  const exampleResult = await execFileAsync(process.execPath, [
    "scripts/build-epk-manifest.mjs", "--input", "examples/epk-manifest.example.json", "--validate-only", "--allow-example"
  ], { cwd: process.cwd(), env: environment, timeout: 10_000 });
  assert.equal(JSON.parse(exampleResult.stdout).written, false);

  await assert.rejects(
    execFileAsync(process.execPath, ["scripts/build-epk-manifest.mjs", "--input", input, "--output", join(directory, "outside.json")], {
      cwd: process.cwd(), env: environment, timeout: 10_000
    }),
    (error) => JSON.parse(error.stderr).code === "EPK_MANIFEST_PATH_FORBIDDEN"
  );

  const symlinkInput = join(directory, "input-link.json");
  await symlink(input, symlinkInput);
  await assert.rejects(
    execFileAsync(process.execPath, ["scripts/build-epk-manifest.mjs", "--input", symlinkInput, "--validate-only"], {
      cwd: process.cwd(), env: environment, timeout: 10_000
    }),
    (error) => JSON.parse(error.stderr).code === "EPK_INPUT_FILE_UNSAFE"
  );
});

async function serviceFixture(t, manifest) {
  const directory = await temporaryDirectory();
  const root = join(directory, "epk");
  const manifestPath = join(root, "public.json");
  await mkdir(root);
  await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
  const service = createEpkService({
    manifestRoot: root,
    manifestPath,
    siteOrigin: SITE_ORIGIN,
    allowedHttpsOrigins: ALLOWED_ORIGINS,
    reloadIntervalMs: 0
  });
  await service.initialize();
  assert.equal(service.capability().available, true);
  const baseUrl = await startServer(t, service);
  return { directory, root, manifestPath, service, baseUrl };
}

async function startServer(t, service) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (!await service.handle(request, response, url)) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function startSiteProcess(t, environment) {
  const port = await reservePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...environment, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk) => { output += chunk.toString("utf8"); });
  t.after(async () => {
    if (child.exitCode !== null) return;
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2_000);
      child.once("exit", () => { clearTimeout(timeout); resolve(); });
      child.kill("SIGTERM");
    });
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`site process exited early: ${output.slice(0, 1_000)}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return { child, baseUrl };
    } catch {
      // Startup is expected to race the first few probes.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`site process did not become healthy: ${output.slice(0, 1_000)}`);
}

async function reservePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "marcsmusic-epk-"));
  temporaryDirectories.push(directory);
  return directory;
}

function urlPolicy() {
  return createEpkUrlPolicy({ siteOrigin: SITE_ORIGIN, allowedHttpsOrigins: ALLOWED_ORIGINS });
}

function validManifest() {
  const generatedAt = new Date(Date.now() - 60_000).toISOString();
  const capturedAt = new Date(Date.now() - 120_000).toISOString();
  return {
    schemaVersion: "1.0",
    generatedAt,
    releases: [{
      slug: "test-release",
      artist: "Test & Verified Artist",
      title: "Test & Verified Release",
      releaseDate: "2026-08-01",
      genres: ["Electronic", "Dance"],
      moods: ["Driving", "Focused"],
      instrumental: false,
      tempo: { kind: "bpm", bpm: 124 },
      isrc: "XXAAA0000001",
      artistBio: {
        text: "This test biography is explicitly owned fixture content and does not describe a real artist or release.",
        rights: "owned"
      },
      artwork: { url: "https://media.example.test/test-release.jpg", alt: "Test fixture artwork" },
      publicStream: { url: "https://media.example.test/test-release", provider: "Fixture Stream", access: "public" },
      spotifyUrl: "https://open.spotify.com/track/0123456789AbCdEfGhIjKl",
      downloads: {
        mp3: { url: "https://media.example.test/test-release.mp3", format: "mp3", label: "Test MP3" },
        wav: { url: "https://media.example.test/test-release.wav", format: "wav", label: "Test WAV" }
      },
      downloadRights: {
        owner: "Test Fixture Rights Owner",
        grant: "promotional-use",
        allowedUses: ["editorial-review", "radio-evaluation", "radio-airplay"],
        restrictions: "Use only for this automated test fixture; redistribution is not authorized."
      },
      label: { name: "Test Fixture Label", website: "https://evidence.example.test/label" },
      contact: { name: "Test Press Contact", role: "Press", email: "press@example.test" },
      evidence: {
        sourceUrl: "https://evidence.example.test/release",
        capturedAt,
        statement: "Owned test fixture metadata captured from an authoritative reserved example source."
      }
    }]
  };
}

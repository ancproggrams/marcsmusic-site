import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, lstat, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";

import { ensurePrivateDirectory, writePrivateFileAtomic } from "../src/film-leads/private-files.mjs";
import {
  fetchPublicText,
  isBlockedAddress,
  normalizePublicUrl,
  parsePublicUrl,
  resolvePublicTarget
} from "../src/film-leads/public-http.mjs";

const execFileAsync = promisify(execFile);
const CSV_HEADERS = "name,type_genre,location,recent_project,website,public_contact,social,interest_reason,opening_line,lead_temperature";

test("film discovery accepts only credential-free public HTTPS URLs", () => {
  assert.equal(parsePublicUrl("https://example.com/feed").toString(), "https://example.com/feed");
  for (const value of [
    "http://example.com/feed",
    "https://user:secret@example.com/feed",
    "https://example.com:8443/feed",
    "https://localhost/feed",
    "https://service.internal/feed",
    "https://127.0.0.1/feed",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::1]/feed"
  ]) {
    assert.throws(() => parsePublicUrl(value), (error) => error.code?.startsWith("PUBLIC_URL_"), value);
  }
  assert.equal(isBlockedAddress("10.1.2.3"), true);
  assert.equal(isBlockedAddress("2606:4700:4700::1111"), false);
  assert.equal(isBlockedAddress("8.8.8.8"), false);
});

test("DNS rebinding and redirect-to-metadata attempts are rejected before a second request", async () => {
  await assert.rejects(
    resolvePublicTarget(
      new URL("https://public.example/feed"),
      1_000,
      async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 }
      ]
    ),
    (error) => error.code === "PUBLIC_DNS_PRIVATE_ADDRESS"
  );

  let requests = 0;
  await assert.rejects(
    fetchPublicText("https://public.example/feed", {
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      requestOnce: async () => {
        requests += 1;
        return { status: 302, location: "https://169.254.169.254/latest/meta-data/", text: "" };
      }
    }),
    (error) => error.code === "PUBLIC_URL_PRIVATE_HOST"
  );
  assert.equal(requests, 1);
});

test("stored lead URLs remove fragments, tracking IDs, and token-like query values", () => {
  assert.equal(
    normalizePublicUrl("https://example.com/work?id=public&utm_source=mail&token=secret#private"),
    "https://example.com/work?id=public"
  );
  assert.equal(normalizePublicUrl("https://user:secret@example.com/work"), "");
});

test("temporary lead artifacts are private, atomic, and do not follow destination symlinks", async (t) => {
  const parent = await mkdtemp(join(tmpdir(), "marcsmusic-private-file-test-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const privateDirectory = join(parent, "runtime");
  await ensurePrivateDirectory(privateDirectory);
  assert.equal((await lstat(privateDirectory)).mode & 0o777, 0o700);

  const sensitive = join(parent, "sensitive.txt");
  const output = join(privateDirectory, "leads.csv");
  await writeFile(sensitive, "must-not-change", { mode: 0o600 });
  await symlink(sensitive, output);
  await writePrivateFileAtomic(output, "private lead data\n");
  assert.equal(await readFile(sensitive, "utf8"), "must-not-change");
  assert.equal(await readFile(output, "utf8"), "private lead data\n");
  const details = await lstat(output);
  assert.equal(details.isSymbolicLink(), false);
  assert.equal(details.mode & 0o777, 0o600);
});

test("discovery blocks literal SSRF sources, writes mode 0600, and never logs the rejected URL", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "marcsmusic-discovery-security-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const seed = join(directory, "seed.csv");
  const sources = join(directory, "sources.json");
  const shards = join(directory, "shards.json");
  const output = join(directory, "output.csv");
  await writeFile(seed, `${CSV_HEADERS}\n`, "utf8");
  await writeFile(sources, JSON.stringify([{
    name: "Rejected source",
    type: "generic-rss-feed",
    url: "https://169.254.169.254/latest/meta-data/",
    enabled: true
  }]), "utf8");
  await writeFile(shards, "[]", "utf8");

  const { stdout } = await execFileAsync(process.execPath, [
    "scripts/discover-film-director-leads.mjs",
    "--dry-run",
    "--seed", seed,
    "--sources", sources,
    "--country-shards", shards,
    "--output", output
  ], {
    cwd: process.cwd(),
    env: { ...process.env, FILM_DIRECTOR_FETCH_DELAY_MS: "1" }
  });
  assert.doesNotMatch(stdout, /169\.254\.169\.254/u);
  assert.match(stdout, /PUBLIC_URL_PRIVATE_HOST/u);
  assert.equal((await lstat(output)).mode & 0o777, 0o600);
});

test("CRM import dry-run validates records without emitting names or contact URLs", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "marcsmusic-import-privacy-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const csvPath = join(directory, "leads.csv");
  const personalName = "Privacy Testperson";
  const personalUrl = "https://portfolio.example/person";
  await writeFile(
    csvPath,
    `${CSV_HEADERS}\n${personalName},film,NL,project,${personalUrl},public source,,reason,hello,warm\n`,
    { mode: 0o600 }
  );
  await chmod(csvPath, 0o600);

  const { stdout } = await execFileAsync(process.execPath, [
    "scripts/import-film-director-leads-to-espocrm.mjs",
    csvPath,
    "--dry-run"
  ], {
    cwd: process.cwd(),
    env: { ...process.env, ESPOCRM_BASE_URL: "", ESPOCRM_API_KEY: "" }
  });
  assert.doesNotMatch(stdout, new RegExp(personalName, "u"));
  assert.doesNotMatch(stdout, /portfolio\.example/u);
  assert.match(stdout, /without emitting personal data/u);
});

test("the cron wrapper removes its generated personal-data CSV and lock after import", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "marcsmusic-cron-cleanup-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const seed = join(directory, "seed.csv");
  const sources = join(directory, "sources.json");
  const shards = join(directory, "shards.json");
  const output = join(directory, "generated.csv");
  const lock = join(directory, "run.lock");
  const personalName = "Cleanup Privacy Person";
  await writeFile(
    seed,
    `${CSV_HEADERS}\n${personalName},film,NL,project,https://example.com,public source,,reason,hello,warm\n`,
    { mode: 0o600 }
  );
  await writeFile(sources, "[]", "utf8");
  await writeFile(shards, "[]", "utf8");

  const { stdout } = await execFileAsync(process.execPath, [
    "scripts/run-film-director-search-action.mjs",
    "--dry-run"
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ESPOCRM_BASE_URL: "",
      ESPOCRM_API_KEY: "",
      FILM_DIRECTOR_LEADS_CSV: seed,
      FILM_DIRECTOR_SOURCE_CONFIG: sources,
      FILM_DIRECTOR_COUNTRY_SHARDS: shards,
      FILM_DIRECTOR_SEARCH_OUTPUT_CSV: output,
      SEARCH_ACTION_LOCK_PATH: lock,
      FILM_DIRECTOR_FETCH_DELAY_MS: "1"
    }
  });
  assert.doesNotMatch(stdout, new RegExp(personalName, "u"));
  await assert.rejects(stat(output), (error) => error.code === "ENOENT");
  await assert.rejects(stat(lock), (error) => error.code === "ENOENT");
});

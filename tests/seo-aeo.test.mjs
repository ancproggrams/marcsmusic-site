import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { XMLParser } from "fast-xml-parser";

import { TRACKS } from "../app.js";
import { buildLlmsTxt, buildRobotsTxt, buildSitemapXml } from "../src/seo/seo-documents.mjs";
import { FAQ_REGION, HEAD_REGION, readRegion } from "../src/seo/page-markup.mjs";
import {
  BOOKING_SERVICES,
  buildJsonLdGraph,
  canonicalUrl,
  FAQ_ENTRIES,
  isoDuration,
  SITE_ENTITY,
  SITE_PAGES
} from "../src/seo/site-seo.mjs";
import { generatedRegions, PRODUCTION_ORIGIN } from "../scripts/sync-seo-metadata.mjs";

const temporaryDirectories = [];
const TEST_ORIGIN = "https://seo.marcsmusic.test";

after(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("the generated page regions stay in sync with the SEO entity data", async () => {
  for (const page of SITE_PAGES) {
    const html = await readFile(join(process.cwd(), page.file), "utf8");
    for (const { region, markup } of generatedRegions(page.id)) {
      assert.equal(readRegion(html, region), markup, `${page.file} ${region.start}`);
    }
  }
});

test("each public page carries one canonical URL, sharing metadata and a parsable JSON-LD graph", async () => {
  for (const page of SITE_PAGES) {
    const html = await readFile(join(process.cwd(), page.file), "utf8");
    const canonical = canonicalUrl(PRODUCTION_ORIGIN, page);

    assert.equal((html.match(/<link rel="canonical"/gu) || []).length, 1, page.file);
    assert.match(html, new RegExp(`<link rel="canonical" href="${escapeRegExp(canonical)}">`, "u"));
    assert.equal((html.match(/<title>/gu) || []).length, 1, page.file);
    assert.match(html, new RegExp(`<title>${escapeRegExp(page.title)}</title>`, "u"));
    assert.match(html, /<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large/u);
    assert.match(html, /<meta property="og:locale" content="nl_NL">/u);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/u);
    assert.ok(page.title.length <= 65, `${page.file} title length ${page.title.length}`);
    assert.ok(page.description.length >= 70 && page.description.length <= 160, `${page.file} description length`);
    assert.match(page.lastModified, /^\d{4}-\d{2}-\d{2}$/u);

    const graph = JSON.parse(readJsonLd(html));
    assert.equal(graph["@context"], "https://schema.org");
    assert.deepEqual(graph, buildJsonLdGraph({ pageId: page.id, siteOrigin: PRODUCTION_ORIGIN }));

    const types = graph["@graph"].map((node) => node["@type"]);
    assert.deepEqual(types.slice(0, 3), ["WebSite", "MusicGroup", "WebPage"]);
    const webPage = graph["@graph"].find((node) => node["@type"] === "WebPage");
    assert.equal(webPage.url, canonical);
    assert.equal(webPage.description, page.description);
    assert.equal(webPage.inLanguage, "nl-NL");
  }
});

test("the homepage graph describes the artist entity and the complete playlist", async () => {
  const graph = JSON.parse(readJsonLd(await readFile(join(process.cwd(), "index.html"), "utf8")))["@graph"];
  const artist = graph.find((node) => node["@type"] === "MusicGroup");
  const playlist = graph.find((node) => node["@type"] === "MusicPlaylist");

  assert.deepEqual(artist.sameAs, [...SITE_ENTITY.sameAs]);
  assert.equal(artist.member.name, SITE_ENTITY.makerName);
  assert.equal(playlist.numTracks, TRACKS.length);
  assert.deepEqual(
    playlist.track.map((track) => track.name),
    TRACKS.map((track) => track.title)
  );
  assert.deepEqual(
    playlist.track.map((track) => track.duration),
    TRACKS.map((track) => isoDuration(track.duration))
  );
  for (const track of playlist.track) {
    assert.equal(track.byArtist["@id"], artist["@id"]);
    assert.match(track.image, /^https:\/\/www\.marcsmusic\.nl\/assets\//u);
  }
});

test("the booking graph publishes the bookable services, breadcrumb and FAQ", async () => {
  const graph = JSON.parse(readJsonLd(await readFile(join(process.cwd(), "booking.html"), "utf8")))["@graph"];
  const services = graph.filter((node) => node["@type"] === "Service");
  const faq = graph.find((node) => node["@type"] === "FAQPage");
  const breadcrumb = graph.find((node) => node["@type"] === "BreadcrumbList");

  assert.equal(services.length, BOOKING_SERVICES.length);
  for (const service of services) {
    assert.equal(service.provider["@id"], "https://www.marcsmusic.nl/#artist");
    assert.equal(service.availableChannel.serviceUrl, "https://www.marcsmusic.nl/booking");
    assert.equal(service.areaServed.name, SITE_ENTITY.countryName);
  }
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.item),
    ["https://www.marcsmusic.nl/", "https://www.marcsmusic.nl/booking"]
  );
  assert.equal(faq.mainEntity.length, FAQ_ENTRIES.length);
});

test("every answer block is visible on the page, quotable and free of configurable amounts", async () => {
  const html = await readFile(join(process.cwd(), "booking.html"), "utf8");
  const faqRegion = readRegion(html, FAQ_REGION);
  const graph = JSON.parse(readJsonLd(html))["@graph"];
  const questions = graph.find((node) => node["@type"] === "FAQPage").mainEntity;

  for (const entry of FAQ_ENTRIES) {
    const question = questions.find((candidate) => candidate.name === entry.question);
    assert.ok(question, entry.id);
    assert.equal(question.acceptedAnswer.text, entry.answer);
    assert.ok(faqRegion.includes(`id="vraag-${entry.id}"`), entry.id);
    assert.ok(faqRegion.includes(entry.question), entry.question);
    assert.ok(faqRegion.includes(entry.answer), entry.id);

    assert.match(entry.question, /\?$/u);
    assert.match(entry.question, /MarcsMusic/u);
    assert.ok(entry.answer.length >= 80 && entry.answer.length <= 320, `${entry.id} answer length`);
    assert.doesNotMatch(entry.answer, /€|\beuro\b|\d+[.,]\d{2}/iu, `${entry.id} contains a price`);
  }

  assert.equal(new Set(FAQ_ENTRIES.map((entry) => entry.id)).size, FAQ_ENTRIES.length);
});

test("robots.txt opens the public pages and closes admin, API and payment routes for every crawler group", () => {
  const robots = buildRobotsTxt({ siteOrigin: TEST_ORIGIN });
  const groups = robots
    .split(/\n(?=User-agent: )/u)
    .slice(1)
    .map((group) => group.split("\n").filter((line) => line && !line.startsWith("Sitemap:")));

  assert.ok(groups.length >= 10);
  for (const group of groups) {
    assert.ok(group.includes("Allow: /"), group[0]);
    for (const path of ["/admin", "/api/", "/booking/success", "/booking/cancelled"]) {
      assert.ok(group.includes(`Disallow: ${path}`), `${group[0]} misses ${path}`);
    }
  }

  for (const agent of ["*", "GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
    assert.match(robots, new RegExp(`^User-agent: ${escapeRegExp(agent)}$`, "mu"));
  }
  assert.doesNotMatch(robots, /^Disallow: \/$/mu);
  assert.match(robots, new RegExp(`^Sitemap: ${escapeRegExp(TEST_ORIGIN)}/sitemap\\.xml$`, "mu"));
});

test("the sitemap lists exactly the canonical pages with curated modification dates", () => {
  const parsed = new XMLParser().parse(buildSitemapXml({ siteOrigin: TEST_ORIGIN }));
  const urls = [parsed.urlset.url].flat();

  assert.equal(urls.length, SITE_PAGES.length);
  assert.deepEqual(
    urls.map((entry) => entry.loc),
    SITE_PAGES.map((page) => canonicalUrl(TEST_ORIGIN, page))
  );
  for (const entry of urls) {
    assert.match(String(entry.lastmod), /^\d{4}-\d{2}-\d{2}$/u);
    assert.ok(Number(entry.priority) > 0 && Number(entry.priority) <= 1);
  }
});

test("llms.txt briefs answer engines with the canonical pages, tracks and answers", () => {
  const llms = buildLlmsTxt({ siteOrigin: TEST_ORIGIN });

  assert.match(llms, /^# MarcsMusic\n/u);
  for (const page of SITE_PAGES) {
    assert.ok(llms.includes(canonicalUrl(TEST_ORIGIN, page)), page.path);
  }
  for (const track of TRACKS) {
    assert.ok(llms.includes(track.title), track.title);
  }
  for (const entry of FAQ_ENTRIES) {
    assert.ok(llms.includes(entry.question), entry.question);
    assert.ok(llms.includes(entry.answer), entry.id);
  }
  assert.doesNotMatch(llms, /€|\d+[.,]\d{2}/u);
});

test("crawl documents refuse an unsafe site origin", () => {
  for (const origin of ["https://user:pass@www.marcsmusic.nl", "https://www.marcsmusic.nl/?utm=1", "not-a-url"]) {
    assert.throws(() => buildRobotsTxt({ siteOrigin: origin }), Error, origin);
    assert.throws(() => buildSitemapXml({ siteOrigin: origin }), Error, origin);
  }
});

test("the running site serves the crawl documents, canonical redirects and noindex admin", async (t) => {
  const site = await startSiteProcess(t);

  const robots = await fetch(`${site.baseUrl}/robots.txt`);
  assert.equal(robots.status, 200);
  assert.equal(robots.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(robots.headers.get("x-content-type-options"), "nosniff");
  assert.match(await robots.text(), new RegExp(`^Sitemap: ${escapeRegExp(TEST_ORIGIN)}/sitemap\\.xml$`, "mu"));

  const sitemap = await fetch(`${site.baseUrl}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  assert.equal(sitemap.headers.get("content-type"), "application/xml; charset=utf-8");
  assert.ok((await sitemap.text()).includes(`${TEST_ORIGIN}/booking`));

  const llms = await fetch(`${site.baseUrl}/llms.txt`);
  assert.equal(llms.status, 200);
  assert.ok((await llms.text()).includes(`${TEST_ORIGIN}/booking`));

  const head = await fetch(`${site.baseUrl}/robots.txt`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.ok(Number(head.headers.get("content-length")) > 0);

  for (const [requested, expected] of [["/index.html", "/"], ["/booking.html", "/booking"], ["/admin.html", "/admin"]]) {
    const redirect = await fetch(`${site.baseUrl}${requested}`, { redirect: "manual" });
    assert.equal(redirect.status, 301, requested);
    assert.equal(redirect.headers.get("location"), expected, requested);
  }

  const admin = await fetch(`${site.baseUrl}/admin`);
  assert.equal(admin.status, 200);
  assert.equal(admin.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.match(await admin.text(), /<meta name="robots" content="noindex, nofollow, noarchive">/u);

  const api = await fetch(`${site.baseUrl}/api/health`);
  assert.equal(api.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");

  const homepage = await fetch(`${site.baseUrl}/`);
  assert.match(await homepage.text(), /<link rel="canonical" href="https:\/\/www\.marcsmusic\.nl\/">/u);
});

function readJsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/u);
  assert.ok(match, "the page must contain exactly one JSON-LD block");
  assert.equal((html.match(/application\/ld\+json/gu) || []).length, 1);
  return match[1];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function startSiteProcess(t) {
  const directory = await mkdtemp(join(tmpdir(), "marcsmusic-seo-"));
  temporaryDirectories.push(directory);
  const port = await reservePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      APP_BASE_URL: TEST_ORIGIN,
      RAILWAY_ENVIRONMENT: "",
      PRIVACY_HASH_SALT: "seo-test-privacy-salt",
      BOOKING_DB_PATH: join(directory, "bookings.json"),
      BOOKING_SQLITE_PATH: "",
      DATABASE_URL: "",
      EPK_MANIFEST_ROOT: "",
      EPK_MANIFEST_PATH: "",
      TRANSPARANTE_BROKER_SYNC_ENABLED: "false"
    },
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
      if (response.ok) return { baseUrl };
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
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

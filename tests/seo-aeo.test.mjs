import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { XMLParser } from "fast-xml-parser";

import { TRACKS } from "../app.js";
import { buildLlmsTxt, buildRobotsTxt, buildSitemapXml } from "../src/seo/seo-documents.mjs";
import { FAQ_REGION, HEAD_REGION, readRegion } from "../src/seo/page-markup.mjs";
import { buildBookingOfferGraph, verificationMetaTags } from "../src/seo/runtime-seo.mjs";
import {
  BOOKING_SERVICES,
  buildJsonLdGraph,
  canonicalUrl,
  FAQ_ENTRIES,
  isoDuration,
  serviceForBookingType,
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

test("the share image exists as a real landscape asset with matching metadata", async () => {
  const share = SITE_ENTITY.shareImage;
  const bytes = await readFile(join(process.cwd(), share.path.slice(1)));
  const dimensions = jpegDimensions(bytes);

  assert.deepEqual(dimensions, { width: share.width, height: share.height });
  assert.equal(share.width / share.height > 1.9, true, "a share image must be landscape");
  assert.ok(bytes.byteLength < 400_000, "a share image must stay small enough to preview quickly");

  for (const page of SITE_PAGES) {
    const html = await readFile(join(process.cwd(), page.file), "utf8");
    assert.match(html, new RegExp(`<meta property="og:image" content="[^"]*${escapeRegExp(share.path)}">`, "u"));
    assert.match(html, new RegExp(`<meta property="og:image:width" content="${share.width}">`, "u"));
    assert.match(html, new RegExp(`<meta property="og:image:height" content="${share.height}">`, "u"));
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

test("the offer graph publishes the live booking prices and links them to the services", () => {
  const bookingConfig = {
    bookingTypes: [
      { id: "dj", label: "DJ / muziek event", durationMinutes: 90, priceCents: 25_000 },
      { id: "studio", label: "Studio sessie", durationMinutes: 60, priceCents: 7_500 }
    ],
    currency: "EUR",
    travelRateCentsPerHour: 7_500,
    pricesExcludeVat: true
  };
  const { graph, skippedTypeIds } = buildBookingOfferGraph({ siteOrigin: TEST_ORIGIN, bookingConfig });
  const offers = graph["@graph"];

  assert.deepEqual(skippedTypeIds, []);
  assert.equal(offers.length, 2);
  assert.deepEqual(
    offers.map((offer) => offer.price),
    ["250.00", "75.00"]
  );
  for (const [index, offer] of offers.entries()) {
    const service = serviceForBookingType(bookingConfig.bookingTypes[index].id);
    assert.equal(offer["@type"], "Offer");
    assert.equal(offer.priceCurrency, "EUR");
    assert.equal(offer.valueAddedTaxIncluded, false);
    assert.equal(offer.itemOffered["@id"], `${TEST_ORIGIN}/booking#${service.id}`);
    assert.equal(offer.offeredBy["@id"], `${TEST_ORIGIN}/#artist`);
    assert.equal(offer.priceSpecification.referenceQuantity.value, bookingConfig.bookingTypes[index].durationMinutes);
    assert.equal(offer.priceSpecification.referenceQuantity.unitCode, "MIN");
    assert.equal(offer.addOn.price, "75.00");
    assert.equal(offer.addOn.priceSpecification.referenceQuantity.unitCode, "HUR");
  }
});

test("the offer graph omits unmapped booking types and rejects unusable configuration", () => {
  const unmapped = buildBookingOfferGraph({
    siteOrigin: TEST_ORIGIN,
    bookingConfig: {
      bookingTypes: [{ id: "workshop", durationMinutes: 60, priceCents: 5_000 }],
      currency: "EUR"
    }
  });
  assert.equal(unmapped.graph, null);
  assert.deepEqual(unmapped.skippedTypeIds, ["workshop"]);

  const withoutTravel = buildBookingOfferGraph({
    siteOrigin: TEST_ORIGIN,
    bookingConfig: { bookingTypes: [{ id: "dj", durationMinutes: 60, priceCents: 0 }], currency: "EUR" }
  });
  assert.equal(withoutTravel.graph["@graph"][0].price, "0.00");
  assert.equal(withoutTravel.graph["@graph"][0].addOn, undefined);
  assert.equal(withoutTravel.graph["@graph"][0].valueAddedTaxIncluded, undefined);

  for (const bookingConfig of [
    { bookingTypes: [{ id: "dj", durationMinutes: 60, priceCents: 1.5 }], currency: "EUR" },
    { bookingTypes: [{ id: "dj", durationMinutes: 0, priceCents: 100 }], currency: "EUR" },
    { bookingTypes: [{ id: "dj", durationMinutes: 60, priceCents: 100 }], currency: "euro" }
  ]) {
    assert.throws(() => buildBookingOfferGraph({ siteOrigin: TEST_ORIGIN, bookingConfig }), Error);
  }
});

test("search console verification only accepts a strict token", () => {
  assert.deepEqual(verificationMetaTags({}), []);
  assert.deepEqual(verificationMetaTags({ google: "abcd1234efgh", bing: "0123456789ABCDEF" }), [
    '<meta name="google-site-verification" content="abcd1234efgh">',
    '<meta name="msvalidate.01" content="0123456789ABCDEF">'
  ]);
  for (const token of ["short", 'x" foo="bar', "token with spaces", "a".repeat(129)]) {
    assert.throws(() => verificationMetaTags({ google: token }), Error, token);
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

test("the booking page publishes the live prices and the configured ownership proofs", async (t) => {
  const site = await startSiteProcess(t, {
    BOOKING_PRICE_DJ_CENTS: "25000",
    BOOKING_DURATION_DJ_MINUTES: "90",
    BOOKING_TRAVEL_RATE_CENTS_PER_HOUR: "8000",
    GOOGLE_SITE_VERIFICATION: "googletoken12345",
    BING_SITE_VERIFICATION: "bingtoken12345"
  });
  const html = await (await fetch(`${site.baseUrl}/booking`)).text();
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)].map((match) =>
    JSON.parse(match[1])
  );

  assert.equal(blocks.length, 2);
  const offers = blocks[1]["@graph"];
  const djOffer = offers.find((offer) => offer["@id"].endsWith("#aanbod-dj-set"));
  assert.equal(djOffer.price, "250.00");
  assert.equal(djOffer.priceSpecification.referenceQuantity.value, 90);
  assert.equal(djOffer.addOn.price, "80.00");
  assert.equal(offers.length, BOOKING_SERVICES.length);

  assert.match(html, /<meta name="google-site-verification" content="googletoken12345">/u);
  assert.match(html, /<meta name="msvalidate.01" content="bingtoken12345">/u);
  assert.doesNotMatch(html, /<!-- seo:runtime -->/u);

  const homepage = await (await fetch(`${site.baseUrl}/`)).text();
  assert.match(homepage, /<meta name="google-site-verification" content="googletoken12345">/u);
  assert.equal((homepage.match(/application\/ld\+json/gu) || []).length, 1);
});

test("the site refuses to start with an unusable verification token", async () => {
  const directory = await mkdtemp(join(tmpdir(), "marcsmusic-seo-"));
  temporaryDirectories.push(directory);
  const failure = await new Promise((resolve) => {
    const child = spawn(process.execPath, ["server.js"], {
      cwd: process.cwd(),
      env: { ...baseEnvironment(directory, 3_999), GOOGLE_SITE_VERIFICATION: 'broken" content="x' },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { output += chunk.toString("utf8"); });
    child.once("exit", (code) => resolve({ code, output }));
  });

  assert.notEqual(failure.code, 0);
  assert.match(failure.output, /GOOGLE_SITE_VERIFICATION must be 8-128 characters/u);
});

test("critical text responses are compressed, negotiated and cached deliberately", async (t) => {
  const site = await startSiteProcess(t);

  const brotli = await rawRequest(site.baseUrl, "/styles.css", { "accept-encoding": "br, gzip" });
  const gzip = await rawRequest(site.baseUrl, "/styles.css", { "accept-encoding": "gzip" });
  const plain = await rawRequest(site.baseUrl, "/styles.css", { "accept-encoding": "identity" });
  const rejected = await rawRequest(site.baseUrl, "/styles.css", { "accept-encoding": "br;q=0, gzip;q=0" });

  assert.equal(brotli.headers["content-encoding"], "br");
  assert.equal(gzip.headers["content-encoding"], "gzip");
  assert.equal(plain.headers["content-encoding"], undefined);
  assert.equal(rejected.headers["content-encoding"], undefined);
  assert.equal(brotli.headers.vary, "accept-encoding");
  assert.ok(brotli.body.byteLength < plain.body.byteLength / 3, "brotli must be far smaller than the source");
  assert.ok(gzip.body.byteLength < plain.body.byteLength / 3, "gzip must be far smaller than the source");
  assert.equal(Number(brotli.headers["content-length"]), brotli.body.byteLength);

  const page = await rawRequest(site.baseUrl, "/booking", { "accept-encoding": "br" });
  assert.equal(page.headers["content-encoding"], "br");

  const font = await rawRequest(site.baseUrl, "/assets/fonts/roboto-flex.ttf", {});
  assert.equal(font.headers["cache-control"], "public, max-age=2592000");
  assert.equal(font.headers["content-encoding"], undefined);

  const audio = await rawRequest(site.baseUrl, "/soundcloud-growth-os/outreach-mp3/06%20Carnival/Carnival.mp3", {
    range: "bytes=0-99",
    "accept-encoding": "br"
  });
  assert.equal(audio.status, 206);
  assert.equal(audio.headers["content-encoding"], undefined);
  assert.equal(audio.body.byteLength, 100);
  assert.equal(audio.headers["cache-control"], "public, max-age=2592000");
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

function jpegDimensions(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, "the share image must be a JPEG");
  let offset = 2;
  while (offset < bytes.byteLength - 9) {
    assert.equal(bytes[offset], 0xff, "unexpected JPEG structure");
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("the share image has no readable frame header");
}

function rawRequest(baseUrl, path, headers) {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const clientRequest = httpRequest(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) })
        );
      }
    );
    clientRequest.once("error", reject);
    clientRequest.end();
  });
}

function baseEnvironment(directory, port) {
  return {
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
    TRANSPARANTE_BROKER_SYNC_ENABLED: "false",
    GOOGLE_SITE_VERIFICATION: "",
    BING_SITE_VERIFICATION: ""
  };
}

async function startSiteProcess(t, environment = {}) {
  const directory = await mkdtemp(join(tmpdir(), "marcsmusic-seo-"));
  temporaryDirectories.push(directory);
  const port = await reservePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...baseEnvironment(directory, port), ...environment },
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

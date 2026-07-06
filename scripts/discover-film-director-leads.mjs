#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const DEFAULT_SEED_CSV_PATH = "data/film-director-leads-2026-07-06.csv";
const DEFAULT_SOURCE_CONFIG_PATH = "data/film-director-discovery-sources.json";
const DEFAULT_OUTPUT_CSV_PATH = `${tmpdir()}/marcsmusic-film-director-leads-combined.csv`;
const DEFAULT_MAX_SOURCE_ITEMS = 12;
const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const DEFAULT_FETCH_DELAY_MS = 250;
const DEFAULT_MIN_CONFIDENCE = 6;
const USER_AGENT = "MarcsMusicLeadResearchBot/1.0 (+https://www.marcsmusic.nl)";

const CSV_HEADERS = [
  "name",
  "type_genre",
  "location",
  "recent_project",
  "website",
  "public_contact",
  "social",
  "interest_reason",
  "opening_line",
  "lead_temperature"
];

const SPAM_TERMS = [
  "bitlife",
  "casino",
  "crypto",
  "eggy car",
  "geometry dash",
  "loan",
  "minecraft",
  "poki",
  "slot",
  "slope game",
  "unblocked"
];

const NON_COUNTRY_CATEGORIES = new Set([
  "award winners",
  "comedy",
  "documentary",
  "drama",
  "experimental",
  "fantasy",
  "female filmmakers",
  "friendship",
  "horror",
  "interview",
  "lgbtq",
  "live-action",
  "love",
  "news",
  "playlist",
  "romance",
  "sci-fi",
  "sexuality",
  "society",
  "stop-motion",
  "transformation"
]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const seedCsvPath = getArgValue("--seed") || process.env.FILM_DIRECTOR_LEADS_CSV || DEFAULT_SEED_CSV_PATH;
const sourceConfigPath =
  getArgValue("--sources") ||
  process.env.FILM_DIRECTOR_SOURCE_CONFIG ||
  DEFAULT_SOURCE_CONFIG_PATH;
const outputCsvPath =
  getArgValue("--output") ||
  process.env.FILM_DIRECTOR_SEARCH_OUTPUT_CSV ||
  DEFAULT_OUTPUT_CSV_PATH;
const maxSourceItems = parsePositiveInteger(
  process.env.FILM_DIRECTOR_MAX_SOURCE_ITEMS,
  DEFAULT_MAX_SOURCE_ITEMS
);
const fetchTimeoutMs = parsePositiveInteger(
  process.env.FILM_DIRECTOR_FETCH_TIMEOUT_MS,
  DEFAULT_FETCH_TIMEOUT_MS
);
const fetchDelayMs = parsePositiveInteger(
  process.env.FILM_DIRECTOR_FETCH_DELAY_MS,
  DEFAULT_FETCH_DELAY_MS
);
const defaultMinimumConfidence = parsePositiveInteger(
  process.env.FILM_DIRECTOR_MIN_CONFIDENCE,
  DEFAULT_MIN_CONFIDENCE
);

const seedRows = await readCsvRows(seedCsvPath);
const sources = await readJson(sourceConfigPath);
const knownNames = new Set(seedRows.map((row) => normalizeName(row.name)).filter(Boolean));

const discoveredCandidates = [];
const sourceResults = [];

for (const source of sources.filter((item) => item.enabled !== false)) {
  try {
    const candidates = await discoverFromSource(source);
    discoveredCandidates.push(...candidates);
    sourceResults.push({ source: source.name, candidates: candidates.length, status: "ok" });
  } catch (error) {
    sourceResults.push({
      source: source.name,
      candidates: 0,
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

const newRows = [];
const seenDiscoveredNames = new Set();

for (const candidate of discoveredCandidates) {
  const row = buildLeadRow(candidate);
  const normalizedName = normalizeName(row.name);

  if (!normalizedName || knownNames.has(normalizedName) || seenDiscoveredNames.has(normalizedName)) {
    continue;
  }

  if (!isQualifiedLead(row, candidate)) {
    continue;
  }

  seenDiscoveredNames.add(normalizedName);
  newRows.push(row);
}

const combinedRows = [...seedRows.map(normalizeCsvRow), ...newRows];
await writeCsvRows(outputCsvPath, combinedRows);

for (const row of newRows) {
  if (dryRun) {
    console.log(`[discovery] ${row.name} | ${row.recent_project} | ${row.website}`);
  }
}

log("info", "Film director discovery completed", {
  seedRecords: seedRows.length,
  discoveredCandidates: discoveredCandidates.length,
  newRecords: newRows.length,
  totalRecords: combinedRows.length,
  outputCsvPath,
  sourceResults
});

async function discoverFromSource(source) {
  if (source.type === "shortoftheweek-rss") {
    return discoverShortOfTheWeek(source);
  }

  if (source.type === "atom-author-feed") {
    return discoverAtomAuthorFeed(source);
  }

  throw new Error(`Unsupported discovery source type: ${source.type}`);
}

async function discoverShortOfTheWeek(source) {
  const feedXml = await fetchText(source.url);
  const items = parseRssItems(feedXml)
    .filter((item) => source.includeNews || !new URL(item.link).pathname.startsWith("/news/"))
    .slice(0, maxSourceItems);
  const candidates = [];

  for (const item of items) {
    await delay(fetchDelayMs);

    try {
      const pageHtml = await fetchText(item.link);
      const video = extractJsonAssignment(pageHtml, "json_video") || {};
      const fallback = extractShortOfTheWeekFallback(pageHtml);
      const filmmaker = cleanText(video.filmmaker || fallback.filmmaker, 250);
      const projectTitle = cleanText(video.post_title || fallback.title || item.title, 250);

      for (const name of splitFilmmakers(filmmaker)) {
        candidates.push({
          sourceName: source.name,
          sourceUrl: item.link,
          trustScore: source.trustScore || 0,
          name,
          projectTitle,
          pubDate: item.pubDate,
          summary: stripHtml(video.post_excerpt || item.description || ""),
          categories: item.categories,
          country: cleanText(video.country?.display_name || categoryLocation(item.categories), 120),
          genre: joinUnique([
            video.genre?.display_name,
            video.style?.display_name,
            ...item.categories.filter((category) => !isLocationCategory(category))
          ]),
          website: firstPublicLink(video.links) || fallback.website || item.link,
          social: socialLinkFromLinks(video.links),
          sourceType: "curated-short-film-review"
        });
      }
    } catch (error) {
      log("warn", "Could not process Short of the Week item", {
        source: source.name,
        url: item.link,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return candidates;
}

async function discoverAtomAuthorFeed(source) {
  const feedXml = await fetchText(source.url);
  const entries = parseAtomEntries(feedXml).slice(0, maxSourceItems);

  return entries.flatMap((entry) =>
    splitFilmmakers(entry.author).map((name) => ({
      sourceName: source.name,
      sourceUrl: entry.link,
      trustScore: source.trustScore || 0,
      minimumConfidence: source.minimumConfidence,
      name,
      projectTitle: entry.title,
      pubDate: entry.updated,
      summary: stripHtml(entry.summary || ""),
      categories: [],
      country: source.locationHint || "Unknown",
      genre: source.genreHint || "Short film",
      website: entry.link,
      social: "",
      sourceType: "public-film-feed"
    }))
  );
}

function buildLeadRow(candidate) {
  const firstName = firstGivenName(candidate.name);
  const project = cleanText(candidate.projectTitle || "recent short film", 250);
  const sourceName = cleanText(candidate.sourceName || "public film source", 120);
  const genre = cleanText(candidate.genre || "Short film", 200);
  const location = cleanText(candidate.country || "Unknown", 120);
  const website = normalizeUrl(candidate.website) || normalizeUrl(candidate.sourceUrl);
  const social = normalizeUrl(candidate.social);
  const projectYear = extractYear(candidate.pubDate);
  const recentProject = projectYear ? `${project} (${projectYear}, ${sourceName})` : `${project} (${sourceName})`;
  const soundAngle = soundDesignAngle(genre, candidate.summary);

  return normalizeCsvRow({
    name: titleCaseName(candidate.name),
    type_genre: `${genre} director`,
    location,
    recent_project: recentProject,
    website,
    public_contact: `Public source page: ${normalizeUrl(candidate.sourceUrl)}${
      website && website !== normalizeUrl(candidate.sourceUrl) ? `; linked project website: ${website}` : ""
    }`,
    social,
    interest_reason: `${project} is recent work found via ${sourceName}. ${soundAngle}`,
    opening_line: `Hi ${firstName}, I saw ${project} via ${sourceName}; the way the film uses tone and pacing feels like a strong starting point for music or sound collaboration.`,
    lead_temperature: website && website !== normalizeUrl(candidate.sourceUrl) ? "warm" : "medium"
  });
}

function isQualifiedLead(row, candidate) {
  if (!isHumanName(row.name)) {
    return false;
  }

  const haystack = `${row.name} ${row.recent_project} ${candidate.summary || ""}`.toLowerCase();

  if (SPAM_TERMS.some((term) => haystack.includes(term))) {
    return false;
  }

  const confidence = scoreCandidate(row, candidate);
  const threshold = candidate.minimumConfidence || defaultMinimumConfidence;
  return confidence >= threshold;
}

function scoreCandidate(row, candidate) {
  let score = candidate.trustScore || 0;

  if (row.website) {
    score += 1;
  }

  if (row.public_contact.includes("Public source page: https://")) {
    score += 1;
  }

  if (candidate.projectTitle && candidate.projectTitle.length >= 3) {
    score += 1;
  }

  if (isRecentDate(candidate.pubDate)) {
    score += 1;
  }

  if (/director|filmmaker|film|short|documentary|animation|live-action/i.test(row.type_genre)) {
    score += 1;
  }

  return score;
}

function parseRssItems(xml) {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => {
    const itemXml = match[1];
    return {
      title: xmlField(itemXml, "title"),
      link: normalizeUrl(xmlField(itemXml, "link")),
      pubDate: xmlField(itemXml, "pubDate"),
      categories: [...itemXml.matchAll(/<category\b[^>]*>([\s\S]*?)<\/category>/gi)].map((category) =>
        cleanText(decodeHtml(stripCdata(category[1])), 80)
      ),
      description: xmlField(itemXml, "description"),
      content: xmlField(itemXml, "content:encoded")
    };
  });
}

function parseAtomEntries(xml) {
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((match) => {
    const entryXml = match[1];
    return {
      title: xmlField(entryXml, "title"),
      link: normalizeUrl(attributeValue(entryXml.match(/<link\b[^>]*rel=["']alternate["'][^>]*>/i)?.[0] || "", "href")),
      author: xmlField(entryXml, "name"),
      summary: xmlField(entryXml, "summary"),
      updated: xmlField(entryXml, "updated")
    };
  });
}

function extractShortOfTheWeekFallback(html) {
  const title =
    metaContent(html, "og:title") ||
    html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    "";
  const titleMatch = cleanText(decodeHtml(stripHtml(title)), 250).match(/^(.+?)\s+-\s+a short film by\s+(.+)$/i);
  const directedByMatch = html.match(/Directed By[\s\S]{0,800}?<a\b[^>]*>([\s\S]*?)<\/a>/i);
  const websiteMatch = html.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Film Website\s*<\/a>/i);

  return {
    title: titleMatch?.[1] || "",
    filmmaker: titleMatch?.[2] || cleanText(stripHtml(directedByMatch?.[1] || ""), 250),
    website: normalizeUrl(decodeHtml(websiteMatch?.[1] || ""))
  };
}

function extractJsonAssignment(input, assignmentName) {
  const markerIndex = input.indexOf(assignmentName);

  if (markerIndex === -1) {
    return null;
  }

  const braceStart = input.indexOf("{", markerIndex);

  if (braceStart === -1) {
    return null;
  }

  const jsonText = readBalancedJson(input, braceStart);
  return jsonText ? JSON.parse(jsonText) : null;
}

function readBalancedJson(input, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return input.slice(startIndex, index + 1);
      }
    }
  }

  return "";
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/rss+xml, application/atom+xml, text/html, */*;q=0.8",
        "user-agent": USER_AGENT
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function readCsvRows(path) {
  const csv = await readFile(resolve(path), "utf8");
  return parseCsv(csv).map(normalizeCsvRow);
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function writeCsvRows(path, rows) {
  await mkdir(dirname(resolve(path)), { recursive: true });
  const csv = [
    CSV_HEADERS.join(","),
    ...rows.map((row) => CSV_HEADERS.map((header) => csvEscape(row[header] || "")).join(","))
  ].join("\n");
  await writeFile(resolve(path), `${csv}\n`, "utf8");
}

function parseCsv(input) {
  const records = [];
  let field = "";
  let record = [];
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      record.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      record.push(field);
      if (record.some((value) => value.length > 0)) {
        records.push(record);
      }
      field = "";
      record = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const [headers, ...rows] = records;

  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, cleanText(row[index] || "", 5000)]))
  );
}

function normalizeCsvRow(row) {
  return Object.fromEntries(CSV_HEADERS.map((header) => [header, cleanText(row[header] || "", 5000)]));
}

function splitFilmmakers(value) {
  const cleaned = cleanText(value, 250)
    .replace(/\s+(?:with|featuring)\s+.+$/iu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return [];
  }

  const possibleParts = cleaned
    .replace(/\s+\+\s+/g, " & ")
    .split(/\s+(?:&|and)\s+|,\s*/iu)
    .map((part) => part.trim())
    .filter(Boolean);

  if (possibleParts.length > 1 && possibleParts.every((part) => part.split(/\s+/u).length >= 2)) {
    return possibleParts;
  }

  return [cleaned];
}

function isHumanName(value) {
  const name = cleanText(value, 120);
  const words = name.split(/\s+/u).filter(Boolean);

  if (words.length < 2 || words.length > 6) {
    return false;
  }

  if (!/^[\p{L}][\p{L}'’. -]+$/u.test(name)) {
    return false;
  }

  if (/^(admin|anonymous|film|short|team|the)\b/iu.test(name)) {
    return false;
  }

  return words.every((word) => word.length > 1 || /^[A-Z]\.?$/u.test(word));
}

function titleCaseName(value) {
  const cleaned = cleanText(value, 120);

  if (/[A-Z][a-z]/.test(cleaned)) {
    return cleaned;
  }

  return cleaned.replace(/\b\p{L}[\p{L}'’-]*/gu, (word) => {
    if (word.length <= 2 && word === word.toUpperCase()) {
      return word;
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function firstGivenName(value) {
  return titleCaseName(value).split(/\s+/u)[0] || "there";
}

function normalizeName(value) {
  return cleanText(value, 120)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function joinUnique(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const cleaned = cleanText(value, 80);
    const key = cleaned.toLowerCase();

    if (!cleaned || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result.slice(0, 4).join(", ") || "Short film";
}

function categoryLocation(categories) {
  return categories.find(isLocationCategory) || "Unknown";
}

function isLocationCategory(category) {
  const key = cleanText(category, 80).toLowerCase();
  return Boolean(key) && !NON_COUNTRY_CATEGORIES.has(key) && /^[a-z][a-z .-]+$/i.test(key);
}

function firstPublicLink(links) {
  if (!Array.isArray(links)) {
    return "";
  }

  const preferred = links.find((link) => /website|portfolio|film/i.test(link.label || ""));
  const first = preferred || links[0];
  return normalizeUrl(first?.url || "");
}

function socialLinkFromLinks(links) {
  if (!Array.isArray(links)) {
    return "";
  }

  const social = links.find((link) =>
    /^https?:\/\/(?:www\.)?(?:instagram|linkedin|vimeo|youtube)\.com\//iu.test(link.url || "")
  );

  return normalizeUrl(social?.url || "");
}

function soundDesignAngle(genre, summary) {
  const text = `${genre} ${summary}`.toLowerCase();

  if (/animation|stop-motion|experimental|silent/.test(text)) {
    return "The visual language likely benefits from precise sonic world-building and a composer/sound designer who can shape rhythm, texture and emotional detail.";
  }

  if (/documentary|true story|real experience/.test(text)) {
    return "The documentary angle creates room for careful score, restraint and sound design that supports authenticity without overpowering the subject.";
  }

  if (/horror|sci-fi|fantasy|genre/.test(text)) {
    return "The genre setup gives sound and music a practical role in tension, atmosphere and audience immersion.";
  }

  return "The project is recent and director-led, which makes it a relevant outreach target for original music, sound design or production collaboration.";
}

function isRecentDate(value) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const ageMs = Date.now() - timestamp;
  return ageMs >= 0 && ageMs <= 180 * 24 * 60 * 60 * 1000;
}

function extractYear(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? String(new Date(timestamp).getUTCFullYear()) : "";
}

function xmlField(xml, tagName) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
  return cleanText(decodeHtml(stripHtml(stripCdata(match?.[1] || ""))), 5000);
}

function attributeValue(tag, attributeName) {
  const escapedAttribute = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`${escapedAttribute}=["']([^"']+)["']`, "i"));
  return decodeHtml(match?.[1] || "");
}

function metaContent(html, property) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escapedProperty}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i")
  );
  return decodeHtml(match?.[1] || "");
}

function stripCdata(value) {
  return String(value || "")
    .replace(/^<!\[CDATA\[/u, "")
    .replace(/\]\]>$/u, "");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-");
}

function normalizeUrl(value) {
  const cleaned = cleanText(decodeHtml(value), 500);

  if (!cleaned) {
    return "";
  }

  if (cleaned.startsWith("//")) {
    return `https:${cleaned}`;
  }

  if (!/^https?:\/\//i.test(cleaned)) {
    return "";
  }

  return cleaned.replace(/[),.;]+$/u, "");
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function csvEscape(value) {
  const text = cleanText(value, 5000);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getArgValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(ms) {
  return ms > 0 ? new Promise((resolvePromise) => setTimeout(resolvePromise, ms)) : Promise.resolve();
}

function log(level, message, context = {}) {
  console.log(
    JSON.stringify({
      level,
      message,
      time: new Date().toISOString(),
      ...context
    })
  );
}

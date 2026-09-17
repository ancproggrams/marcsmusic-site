import { createHash } from "node:crypto";

import { z } from "zod";

import { ApplicationError } from "../errors.mjs";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/iu;
const URL_LIMIT = 2_048;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;
const ALLOWED_USES = new Set(["editorial-review", "radio-evaluation", "radio-airplay"]);
const TRAVERSAL_ENCODING = /%(?:2e|2f|5c)/iu;
const INVALID_COMPARABLE = Symbol("invalid-comparable");

const safeText = (minimum, maximum, { multiline = false } = {}) => z.string()
  .min(minimum)
  .max(maximum)
  .refine((value) => !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))
  .transform((value) => normalizeText(value, { multiline }));

const urlText = z.string().min(1).max(URL_LIMIT);
const stringList = z.array(safeText(1, 40)).min(1).max(8).superRefine((values, context) => {
  const normalized = values.map((value) => value.toLocaleLowerCase("en-US"));
  if (new Set(normalized).size !== normalized.length) context.addIssue({ code: "custom", message: "duplicate values" });
});
const tempoSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bpm"), bpm: z.number().int().min(20).max(300) }).strict(),
  z.object({
    kind: z.literal("not-applicable"),
    reason: z.enum(["no-fixed-tempo", "spoken-word", "tempo-not-applicable"])
  }).strict()
]);
const downloadSchema = z.object({
  url: urlText,
  format: z.enum(["mp3", "wav"]),
  label: safeText(1, 120)
}).strict();
const releaseSchema = z.object({
  slug: z.string().regex(SLUG_PATTERN),
  artist: safeText(1, 160),
  title: safeText(1, 180),
  releaseDate: z.string().regex(DATE_PATTERN),
  genres: stringList,
  moods: stringList,
  instrumental: z.boolean(),
  tempo: tempoSchema,
  isrc: z.string().transform((value) => value.toUpperCase()).pipe(z.string().regex(ISRC_PATTERN)),
  artistBio: z.object({ text: safeText(40, 4_000, { multiline: true }), rights: z.literal("owned") }).strict(),
  artwork: z.object({ url: urlText, alt: safeText(3, 240) }).strict(),
  publicStream: z.object({ url: urlText, provider: safeText(1, 80), access: z.literal("public") }).strict(),
  spotifyUrl: urlText,
  downloads: z.object({
    mp3: downloadSchema,
    wav: downloadSchema.optional(),
    radioEdit: downloadSchema.optional()
  }).strict().refine((value) => Boolean(value.wav || value.radioEdit), { message: "wav or radioEdit is required" }),
  downloadRights: z.object({
    owner: safeText(1, 160),
    grant: z.literal("promotional-use"),
    allowedUses: z.array(z.enum([...ALLOWED_USES])).min(1).max(ALLOWED_USES.size),
    restrictions: safeText(10, 1_000, { multiline: true })
  }).strict(),
  label: z.object({ name: safeText(1, 160), website: urlText.optional() }).strict(),
  contact: z.object({
    name: safeText(1, 160),
    role: safeText(1, 120),
    email: safeText(3, 254).transform((value) => value.toLowerCase()).refine((value) => EMAIL_PATTERN.test(value))
  }).strict(),
  evidence: z.object({
    sourceUrl: urlText,
    capturedAt: z.string().regex(UTC_TIMESTAMP_PATTERN),
    statement: safeText(10, 1_000, { multiline: true })
  }).strict()
}).strict();

const responseSchema = z.object({
  schemaVersion: z.literal("1.0"),
  generatedAt: z.string().regex(UTC_TIMESTAMP_PATTERN),
  release: releaseSchema
}).strict();

export const MUSIC_RELEASE_EPK_SELECT = Object.freeze([
  "id", "versionNumber", "status", "epkUrl", "isrc", "artistName", "name", "releaseDate",
  "genres", "moods", "bpm", "instrumental", "artworkUrl", "spotifyUrl", "downloadUrl",
  "radioEditUrl", "privateStreamUrl", "epkAttestationState", "epkManifestSha256", "epkVerifiedAt",
  "epkEvidenceReference"
]);

export function parseApprovedHttpsOrigins(value) {
  const candidates = Array.isArray(value)
    ? value
    : String(value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!candidates.length) throw contractError("EPK_APPROVED_ORIGINS_REQUIRED", "At least one approved HTTPS origin is required");
  const origins = new Set();
  for (const candidate of candidates) {
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch {
      throw contractError("EPK_APPROVED_ORIGIN_INVALID", "An approved origin is invalid");
    }
    if (
      parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port ||
      parsed.pathname !== "/" || parsed.search || parsed.hash || candidate !== parsed.origin
    ) {
      throw contractError("EPK_APPROVED_ORIGIN_INVALID", "Approved origins must be exact credential-free HTTPS origins");
    }
    if (origins.has(parsed.origin)) throw contractError("EPK_APPROVED_ORIGIN_DUPLICATE", "Approved origins must be unique");
    origins.add(parsed.origin);
  }
  const snapshot = Object.freeze([...origins]);
  return Object.freeze({
    get size() { return snapshot.length; },
    has(value) { return origins.has(value); },
    values() { return snapshot.values(); },
    [Symbol.iterator]() { return snapshot[Symbol.iterator](); }
  });
}

export function parseEpkHtmlUrl(value, approvedOrigins) {
  const url = parseStrictHttpsUrl(value, approvedOrigins, "EPK_URL_INVALID");
  const match = url.pathname.match(/^\/epk\/([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)$/u);
  if (!match) throw contractError("EPK_HTML_ROUTE_INVALID", "EPK URL must use the strict /epk/:slug route");
  const slug = match[1];
  return Object.freeze({
    slug,
    origin: url.origin,
    htmlUrl: url.href,
    jsonUrl: new URL(`/api/epk/${slug}`, url.origin).href,
    healthUrl: new URL("/api/health", url.origin).href
  });
}

export function parseEpkResponse(input, { expectedSlug, siteOrigin, approvedOrigins, now = new Date() }) {
  const result = responseSchema.safeParse(input);
  if (!result.success) {
    throw new ApplicationError("EPK JSON does not satisfy the public contract", {
      code: "EPK_MANIFEST_INVALID",
      statusCode: 422,
      retryable: false,
      details: { fields: [...new Set(result.error.issues.map((issue) => issue.path.join(".")))].sort() }
    });
  }
  const parsed = result.data;
  if (parsed.release.slug !== expectedSlug) throw contractError("EPK_SLUG_MISMATCH", "EPK slug does not match the requested release");
  const generatedAt = strictTimestamp(parsed.generatedAt, "EPK_GENERATED_AT_INVALID");
  const capturedAt = strictTimestamp(parsed.release.evidence.capturedAt, "EPK_EVIDENCE_TIMESTAMP_INVALID");
  if (generatedAt.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS) {
    throw contractError("EPK_GENERATED_AT_FUTURE", "EPK generation timestamp is in the future");
  }
  if (capturedAt.getTime() > generatedAt.getTime() + MAX_FUTURE_SKEW_MS) {
    throw contractError("EPK_EVIDENCE_TIMESTAMP_INVALID", "EPK evidence timestamp is later than generation");
  }
  assertRealDate(parsed.release.releaseDate);
  assertUnique(parsed.release.downloadRights.allowedUses, "EPK_DOWNLOAD_RIGHTS_INVALID");

  const release = normalizeReleaseUrls(parsed.release, { siteOrigin, approvedOrigins });
  return deepFreeze({ schemaVersion: "1.0", generatedAt: generatedAt.toISOString(), release });
}

export function compareEpkToMusicRelease(record, remote, { htmlUrl }) {
  const expected = {
    epkUrl: htmlUrl,
    isrc: remote.release.isrc,
    artistName: remote.release.artist,
    name: remote.release.title,
    releaseDate: remote.release.releaseDate,
    genres: canonicalList(remote.release.genres),
    moods: canonicalList(remote.release.moods),
    bpm: remote.release.tempo.kind === "bpm" ? remote.release.tempo.bpm : undefined,
    instrumental: remote.release.instrumental,
    artworkUrl: remote.release.artwork.url,
    spotifyUrl: remote.release.spotifyUrl,
    downloadUrl: remote.release.downloads.mp3.url,
    radioEditUrl: remote.release.downloads.radioEdit?.url,
    privateStreamUrl: remote.release.publicStream.url
  };
  const actual = {
    epkUrl: canonicalCrmUrl(record.epkUrl),
    isrc: canonicalIsrc(record.isrc),
    artistName: normalizeComparableText(record.artistName),
    name: normalizeComparableText(record.name),
    releaseDate: optionalValue(record.releaseDate),
    genres: canonicalList(record.genres),
    moods: canonicalList(record.moods),
    bpm: optionalInteger(record.bpm),
    instrumental: typeof record.instrumental === "boolean" ? record.instrumental : undefined,
    artworkUrl: canonicalCrmUrl(record.artworkUrl),
    spotifyUrl: canonicalCrmUrl(record.spotifyUrl),
    downloadUrl: canonicalCrmUrl(record.downloadUrl),
    radioEditUrl: canonicalCrmUrl(record.radioEditUrl),
    privateStreamUrl: canonicalCrmUrl(record.privateStreamUrl)
  };
  const mismatches = Object.keys(expected).filter((field) => !sameValue(actual[field], expected[field]));
  if (mismatches.length) {
    throw new ApplicationError("EPK metadata does not match the CRM release", {
      code: "EPK_CRM_MISMATCH",
      statusCode: 422,
      retryable: false,
      details: { fields: mismatches.sort() }
    });
  }
  return true;
}

export function canonicalManifestDigest(remote) {
  return createHash("sha256").update(canonicalSerialize(remote), "utf8").digest("hex");
}

export function canonicalSerialize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalSerialize(entry)).join(",")}]`;
  if (!value || typeof value !== "object") throw new TypeError("Canonical JSON supports only JSON values");
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`).join(",")}}`;
}

export function epkAssetChecks(remote) {
  const assets = [
    { kind: "artwork", url: remote.release.artwork.url },
    { kind: "stream", url: remote.release.publicStream.url },
    { kind: "mp3", url: remote.release.downloads.mp3.url },
    ...(remote.release.downloads.wav ? [{ kind: "wav", url: remote.release.downloads.wav.url }] : []),
    ...(remote.release.downloads.radioEdit ? [{ kind: "radioEdit", url: remote.release.downloads.radioEdit.url }] : [])
  ];
  if (assets.length > 5) throw contractError("EPK_ASSET_COUNT_INVALID", "EPK asset count exceeds the verifier bound");
  if (new Set(assets.map((asset) => asset.url)).size !== assets.length) {
    throw contractError("EPK_ASSET_URL_DUPLICATE", "EPK assets must use distinct URLs");
  }
  return Object.freeze(assets.map((asset) => Object.freeze(asset)));
}

function normalizeReleaseUrls(release, { siteOrigin, approvedOrigins }) {
  const normalizedOrigin = parseStrictOrigin(siteOrigin, approvedOrigins);
  const artworkUrl = normalizeManifestUrl(release.artwork.url, normalizedOrigin, approvedOrigins, "EPK_ARTWORK_URL_INVALID");
  if (!/\.(?:jpe?g|png|webp)$/iu.test(new URL(artworkUrl).pathname)) {
    throw contractError("EPK_ARTWORK_FORMAT_INVALID", "EPK artwork must use jpg, png or webp");
  }
  const publicStreamUrl = normalizeManifestUrl(release.publicStream.url, normalizedOrigin, approvedOrigins, "EPK_STREAM_URL_INVALID");
  const spotifyUrl = normalizeManifestUrl(release.spotifyUrl, normalizedOrigin, approvedOrigins, "EPK_SPOTIFY_URL_INVALID");
  const spotify = new URL(spotifyUrl);
  if (spotify.origin !== "https://open.spotify.com" || !/^\/track\/[A-Za-z0-9]{22}$/u.test(spotify.pathname)) {
    throw contractError("EPK_SPOTIFY_URL_INVALID", "EPK Spotify URL must identify an exact public track");
  }
  if (spotifyUrl === publicStreamUrl) throw contractError("EPK_SPOTIFY_URL_DUPLICATE", "Spotify and public stream URLs must differ");

  const normalizeDownload = (download, key, requiredFormat) => {
    if (!download) return undefined;
    if (requiredFormat && download.format !== requiredFormat) {
      throw contractError("EPK_DOWNLOAD_FORMAT_INVALID", "EPK download format is invalid");
    }
    const url = normalizeManifestUrl(download.url, normalizedOrigin, approvedOrigins, "EPK_DOWNLOAD_URL_INVALID");
    if (!new URL(url).pathname.toLowerCase().endsWith(`.${download.format}`)) {
      throw contractError("EPK_DOWNLOAD_FORMAT_INVALID", `EPK ${key} URL extension is invalid`);
    }
    return { ...download, url };
  };

  return {
    ...release,
    artwork: { ...release.artwork, url: artworkUrl },
    publicStream: { ...release.publicStream, url: publicStreamUrl },
    spotifyUrl,
    downloads: {
      mp3: normalizeDownload(release.downloads.mp3, "mp3", "mp3"),
      ...(release.downloads.wav ? { wav: normalizeDownload(release.downloads.wav, "wav", "wav") } : {}),
      ...(release.downloads.radioEdit ? { radioEdit: normalizeDownload(release.downloads.radioEdit, "radioEdit") } : {})
    },
    label: {
      ...release.label,
      ...(release.label.website
        ? { website: normalizeManifestUrl(release.label.website, normalizedOrigin, approvedOrigins, "EPK_LABEL_URL_INVALID") }
        : {})
    },
    contact: { ...release.contact, email: release.contact.email.toLowerCase() },
    evidence: {
      ...release.evidence,
      sourceUrl: normalizeManifestUrl(release.evidence.sourceUrl, normalizedOrigin, approvedOrigins, "EPK_EVIDENCE_URL_INVALID"),
      capturedAt: strictTimestamp(release.evidence.capturedAt, "EPK_EVIDENCE_TIMESTAMP_INVALID").toISOString()
    }
  };
}

function normalizeManifestUrl(value, siteOrigin, approvedOrigins, code) {
  const raw = String(value ?? "");
  if (raw.includes("\\") || hasEncodedTraversal(raw) || raw.split("/").includes("..")) {
    throw contractError(code, "EPK URL contains a forbidden path representation");
  }
  const relative = raw.startsWith("/") && !raw.startsWith("//");
  let parsed;
  try {
    parsed = new URL(raw, siteOrigin);
  } catch {
    throw contractError(code, "EPK URL is invalid");
  }
  if (!relative && !raw.startsWith("https://")) throw contractError(code, "EPK external URLs must use HTTPS");
  assertStrictUrlComponents(parsed, approvedOrigins, code);
  return parsed.href;
}

function parseStrictOrigin(value, approvedOrigins) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw contractError("EPK_SITE_ORIGIN_INVALID", "EPK site origin is invalid");
  }
  if (value !== parsed.origin || !approvedOrigins.has(parsed.origin)) {
    throw contractError("EPK_SITE_ORIGIN_INVALID", "EPK site origin is not approved");
  }
  return parsed.origin;
}

function parseStrictHttpsUrl(value, approvedOrigins, code) {
  const raw = String(value ?? "");
  if (Buffer.byteLength(raw, "utf8") > URL_LIMIT || raw.includes("\\") || hasEncodedTraversal(raw)) {
    throw contractError(code, "EPK URL is invalid");
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw contractError(code, "EPK URL is invalid");
  }
  assertStrictUrlComponents(parsed, approvedOrigins, code);
  return parsed;
}

function assertStrictUrlComponents(parsed, approvedOrigins, code) {
  if (
    parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash ||
    !approvedOrigins.has(parsed.origin)
  ) {
    throw contractError(code, "EPK URL must be an approved credential-free HTTPS URL without query or fragment");
  }
}

function strictTimestamp(value, code) {
  if (typeof value !== "string" || !UTC_TIMESTAMP_PATTERN.test(value)) throw contractError(code, "EPK timestamp is invalid");
  const parsed = new Date(value);
  const normalizedInput = value.replace(/(?:\.(\d{1,3}))?Z$/u, (_match, fraction = "") => `.${fraction.padEnd(3, "0")}Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalizedInput) throw contractError(code, "EPK timestamp is invalid");
  return parsed;
}

function assertRealDate(value) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw contractError("EPK_RELEASE_DATE_INVALID", "EPK release date is invalid");
  }
}

function assertUnique(values, code) {
  if (new Set(values).size !== values.length) throw contractError(code, "EPK values must be unique");
}

function canonicalCrmUrl(value) {
  if (value === null || value === undefined || value === "") return undefined;
  try {
    const parsed = new URL(String(value));
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) return INVALID_COMPARABLE;
    return parsed.href;
  } catch {
    return INVALID_COMPARABLE;
  }
}

function canonicalIsrc(value) {
  const normalized = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/gu, "");
  return ISRC_PATTERN.test(normalized) ? normalized : undefined;
}

function canonicalList(values) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => normalizeComparableText(value)).filter(Boolean).sort((left, right) => left.localeCompare(right, "en"));
}

function normalizeComparableText(value) {
  return typeof value === "string" ? value.normalize("NFC").replace(/\s+/gu, " ").trim() : undefined;
}

function normalizeText(value, { multiline = false } = {}) {
  const normalized = value.normalize("NFC");
  return multiline
    ? normalized.replace(/\r\n?/gu, "\n").split("\n").map((line) => line.trim()).join("\n").trim()
    : normalized.replace(/\s+/gu, " ").trim();
}

function optionalValue(value) {
  return value === null || value === undefined || value === "" ? undefined : value;
}

function optionalInteger(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : INVALID_COMPARABLE;
}

function sameValue(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);
  }
  return left === right;
}

function hasEncodedTraversal(value) {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    if (TRAVERSAL_ENCODING.test(decoded)) return true;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return false;
      decoded = next;
    } catch {
      return true;
    }
  }
  return TRAVERSAL_ENCODING.test(decoded);
}

function contractError(code, message) {
  return new ApplicationError(message, { code, statusCode: 422, retryable: false });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

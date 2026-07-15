const SCHEMA_VERSION = "1.0";
const MAX_RELEASES = 100;
const MAX_URL_LENGTH = 2_048;
const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/u;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/iu;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const ALLOWED_USES = new Set(["editorial-review", "radio-evaluation", "radio-airplay"]);
const TEMPO_NA_REASONS = new Set(["no-fixed-tempo", "spoken-word", "tempo-not-applicable"]);
const ARTWORK_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const RESERVED_URL_ENCODING_PATTERN = /%(?:2e|2f|5c)/iu;

export const EPK_MANIFEST_MAX_BYTES = 256 * 1024;

export class EpkContractError extends Error {
  constructor(code, path, message) {
    super(`${path}: ${message}`);
    this.name = "EpkContractError";
    this.code = code;
    this.path = path;
  }
}

export function createEpkUrlPolicy({ siteOrigin, allowedHttpsOrigins = [], sameOriginAssetPrefixes = ["/assets/epk/"] }) {
  let normalizedSiteOrigin;
  try {
    const parsedSiteOrigin = new URL(siteOrigin);
    if (
      parsedSiteOrigin.protocol !== "https:" || parsedSiteOrigin.username || parsedSiteOrigin.password ||
      parsedSiteOrigin.pathname !== "/" || parsedSiteOrigin.search || parsedSiteOrigin.hash
    ) {
      throw new Error("not an origin");
    }
    normalizedSiteOrigin = parsedSiteOrigin.origin;
  } catch {
    throw contractError("EPK_SITE_ORIGIN_INVALID", "siteOrigin", "must be an absolute URL origin");
  }
  const origins = new Set([normalizedSiteOrigin]);
  for (const candidate of normalizeOriginInput(allowedHttpsOrigins)) {
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch {
      throw contractError("EPK_ALLOWED_ORIGIN_INVALID", "allowedHttpsOrigins", "contains an invalid URL");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw contractError("EPK_ALLOWED_ORIGIN_INVALID", "allowedHttpsOrigins", "origins must be credential-free HTTPS origins without paths");
    }
    origins.add(parsed.origin);
  }
  const prefixes = sameOriginAssetPrefixes.map((prefix, index) => {
    const normalized = readString(prefix, `sameOriginAssetPrefixes[${index}]`, { max: 200 });
    if (
      !normalized.startsWith("/") || normalized.startsWith("//") || normalized.includes("..") ||
      normalized.includes("\\") || normalized.includes("?") || normalized.includes("#") ||
      hasEncodedTraversal(normalized)
    ) {
      throw contractError("EPK_ASSET_PREFIX_INVALID", `sameOriginAssetPrefixes[${index}]`, "must be an absolute safe path prefix");
    }
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  });
  if (!prefixes.length) {
    throw contractError("EPK_ASSET_PREFIX_INVALID", "sameOriginAssetPrefixes", "at least one path prefix is required");
  }
  return Object.freeze({ siteOrigin: normalizedSiteOrigin, allowedOrigins: origins, sameOriginAssetPrefixes: Object.freeze(prefixes) });
}

export function validateEpkManifest(input, { urlPolicy, allowExample = false, now = new Date() } = {}) {
  if (!urlPolicy) throw new TypeError("urlPolicy is required");
  assertExactKeys(input, ["schemaVersion", "generatedAt", "releases"], ["exampleOnly"], "manifest");
  if (input.schemaVersion !== SCHEMA_VERSION) {
    throw contractError("EPK_SCHEMA_VERSION_UNSUPPORTED", "manifest.schemaVersion", `must equal ${SCHEMA_VERSION}`);
  }
  const exampleOnly = input.exampleOnly === true;
  if (input.exampleOnly !== undefined && typeof input.exampleOnly !== "boolean") {
    throw contractError("EPK_FIELD_INVALID", "manifest.exampleOnly", "must be boolean");
  }
  if (exampleOnly && !allowExample) {
    throw contractError("EPK_EXAMPLE_MANIFEST_FORBIDDEN", "manifest.exampleOnly", "example manifests cannot be activated");
  }
  const generatedAt = readTimestamp(input.generatedAt, "manifest.generatedAt");
  if (Date.parse(generatedAt) > now.getTime() + 5 * 60 * 1_000) {
    throw contractError("EPK_TIMESTAMP_FUTURE", "manifest.generatedAt", "must not be in the future");
  }
  if (!Array.isArray(input.releases) || input.releases.length < 1 || input.releases.length > MAX_RELEASES) {
    throw contractError("EPK_RELEASES_INVALID", "manifest.releases", `must contain 1 to ${MAX_RELEASES} releases`);
  }

  const slugs = new Set();
  const isrcs = new Set();
  const releases = input.releases.map((release, index) => {
    const normalized = validateRelease(release, index, { urlPolicy, generatedAt, exampleMode: exampleOnly && allowExample });
    if (slugs.has(normalized.slug)) {
      throw contractError("EPK_SLUG_DUPLICATE", `manifest.releases[${index}].slug`, "must be unique");
    }
    if (isrcs.has(normalized.isrc)) {
      throw contractError("EPK_ISRC_DUPLICATE", `manifest.releases[${index}].isrc`, "must be unique");
    }
    slugs.add(normalized.slug);
    isrcs.add(normalized.isrc);
    return normalized;
  });

  return deepFreeze({ schemaVersion: SCHEMA_VERSION, generatedAt, ...(exampleOnly ? { exampleOnly: true } : {}), releases });
}

function validateRelease(input, index, { urlPolicy, generatedAt, exampleMode }) {
  const path = `manifest.releases[${index}]`;
  assertExactKeys(input, [
    "slug", "artist", "title", "releaseDate", "genres", "moods", "instrumental", "tempo", "isrc",
    "artistBio", "artwork", "publicStream", "spotifyUrl", "downloads", "downloadRights", "label", "contact", "evidence"
  ], [], path);
  const slug = readString(input.slug, `${path}.slug`, { max: 64 }).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) throw contractError("EPK_SLUG_INVALID", `${path}.slug`, "must be a lowercase URL-safe slug");
  const artist = readString(input.artist, `${path}.artist`, { min: 1, max: 160 });
  const title = readString(input.title, `${path}.title`, { min: 1, max: 180 });
  const releaseDate = readDate(input.releaseDate, `${path}.releaseDate`);
  const genres = readStringArray(input.genres, `${path}.genres`, { minItems: 1, maxItems: 8, itemMax: 40 });
  const moods = readStringArray(input.moods, `${path}.moods`, { minItems: 1, maxItems: 8, itemMax: 40 });
  if (typeof input.instrumental !== "boolean") throw contractError("EPK_FIELD_INVALID", `${path}.instrumental`, "must be boolean");
  const tempo = validateTempo(input.tempo, `${path}.tempo`);
  const isrc = readString(input.isrc, `${path}.isrc`, { max: 12 }).toUpperCase();
  if (!ISRC_PATTERN.test(isrc)) throw contractError("EPK_ISRC_INVALID", `${path}.isrc`, "must be a canonical 12-character ISRC without separators");

  assertExactKeys(input.artistBio, ["text", "rights"], [], `${path}.artistBio`);
  if (input.artistBio.rights !== "owned") {
    throw contractError("EPK_BIO_RIGHTS_INVALID", `${path}.artistBio.rights`, "must explicitly equal owned");
  }
  const artistBio = {
    text: readString(input.artistBio.text, `${path}.artistBio.text`, { min: 40, max: 4_000, multiline: true }),
    rights: "owned"
  };

  assertExactKeys(input.artwork, ["url", "alt"], [], `${path}.artwork`);
  const artworkUrl = readPublicUrl(input.artwork.url, `${path}.artwork.url`, urlPolicy, { asset: true });
  if (!ARTWORK_EXTENSIONS.has(extensionOfUrl(artworkUrl, urlPolicy.siteOrigin))) {
    throw contractError("EPK_ARTWORK_FORMAT_INVALID", `${path}.artwork.url`, "must end in jpg, jpeg, png or webp");
  }
  const artwork = {
    url: artworkUrl,
    alt: readString(input.artwork.alt, `${path}.artwork.alt`, { min: 3, max: 240 })
  };

  assertExactKeys(input.publicStream, ["url", "provider", "access"], [], `${path}.publicStream`);
  if (input.publicStream.access !== "public") {
    throw contractError("EPK_STREAM_NOT_PUBLIC", `${path}.publicStream.access`, "must explicitly equal public");
  }
  const publicStream = {
    url: readPublicUrl(input.publicStream.url, `${path}.publicStream.url`, urlPolicy),
    provider: readString(input.publicStream.provider, `${path}.publicStream.provider`, { max: 80 }),
    access: "public"
  };
  const spotifyUrl = validateSpotifyUrl(input.spotifyUrl, `${path}.spotifyUrl`, urlPolicy, {
    exampleMode,
    publicStreamUrl: publicStream.url
  });

  const downloads = validateDownloads(input.downloads, `${path}.downloads`, urlPolicy);
  const downloadRights = validateDownloadRights(input.downloadRights, `${path}.downloadRights`);
  const label = validateLabel(input.label, `${path}.label`, urlPolicy);
  const contact = validateContact(input.contact, `${path}.contact`);
  const evidence = validateEvidence(input.evidence, `${path}.evidence`, urlPolicy, generatedAt);

  return {
    slug, artist, title, releaseDate, genres, moods, instrumental: input.instrumental, tempo, isrc,
    artistBio, artwork, publicStream, spotifyUrl, downloads, downloadRights, label, contact, evidence
  };
}

function validateTempo(input, path) {
  if (!isPlainObject(input)) throw contractError("EPK_TEMPO_INVALID", path, "must be an object");
  if (input.kind === "bpm") {
    assertExactKeys(input, ["kind", "bpm"], [], path);
    if (!Number.isInteger(input.bpm) || input.bpm < 20 || input.bpm > 300) {
      throw contractError("EPK_BPM_INVALID", `${path}.bpm`, "must be an integer between 20 and 300");
    }
    return { kind: "bpm", bpm: input.bpm };
  }
  if (input.kind === "not-applicable") {
    assertExactKeys(input, ["kind", "reason"], [], path);
    if (!TEMPO_NA_REASONS.has(input.reason)) {
      throw contractError("EPK_TEMPO_REASON_INVALID", `${path}.reason`, "must be an approved explicit reason");
    }
    return { kind: "not-applicable", reason: input.reason };
  }
  throw contractError("EPK_TEMPO_INVALID", `${path}.kind`, "must equal bpm or not-applicable");
}

function validateDownloads(input, path, urlPolicy) {
  assertExactKeys(input, ["mp3"], ["wav", "radioEdit"], path);
  if (!input.wav && !input.radioEdit) {
    throw contractError("EPK_DOWNLOAD_SET_INCOMPLETE", path, "requires MP3 and at least WAV or radioEdit");
  }
  const mp3 = validateDownload(input.mp3, `${path}.mp3`, urlPolicy, "mp3");
  const wav = input.wav ? validateDownload(input.wav, `${path}.wav`, urlPolicy, "wav") : undefined;
  const radioEdit = input.radioEdit ? validateDownload(input.radioEdit, `${path}.radioEdit`, urlPolicy) : undefined;
  return { mp3, ...(wav ? { wav } : {}), ...(radioEdit ? { radioEdit } : {}) };
}

function validateSpotifyUrl(input, path, urlPolicy, { exampleMode, publicStreamUrl }) {
  const spotifyUrl = readPublicUrl(input, path, urlPolicy);
  if (spotifyUrl === publicStreamUrl) {
    throw contractError("EPK_SPOTIFY_URL_DUPLICATE", path, "must be distinct from the public stream URL");
  }
  const parsed = new URL(spotifyUrl, urlPolicy.siteOrigin);
  if (exampleMode && parsed.hostname.endsWith(".test")) return spotifyUrl;
  if (parsed.origin !== "https://open.spotify.com" || !/^\/track\/[A-Za-z0-9]{22}$/u.test(parsed.pathname)) {
    throw contractError("EPK_SPOTIFY_URL_INVALID", path, "must be an exact public Spotify track URL");
  }
  return spotifyUrl;
}

function validateDownload(input, path, urlPolicy, requiredFormat) {
  assertExactKeys(input, ["url", "format", "label"], [], path);
  if (!new Set(["mp3", "wav"]).has(input.format) || (requiredFormat && input.format !== requiredFormat)) {
    throw contractError("EPK_DOWNLOAD_FORMAT_INVALID", `${path}.format`, requiredFormat ? `must equal ${requiredFormat}` : "must equal mp3 or wav");
  }
  const url = readPublicUrl(input.url, `${path}.url`, urlPolicy, { asset: true });
  if (extensionOfUrl(url, urlPolicy.siteOrigin) !== `.${input.format}`) {
    throw contractError("EPK_DOWNLOAD_FORMAT_INVALID", `${path}.url`, `must end in .${input.format}`);
  }
  return { url, format: input.format, label: readString(input.label, `${path}.label`, { max: 120 }) };
}

function validateDownloadRights(input, path) {
  assertExactKeys(input, ["owner", "grant", "allowedUses", "restrictions"], [], path);
  if (input.grant !== "promotional-use") {
    throw contractError("EPK_DOWNLOAD_RIGHTS_INVALID", `${path}.grant`, "must explicitly equal promotional-use");
  }
  if (!Array.isArray(input.allowedUses) || input.allowedUses.length < 1 || input.allowedUses.length > ALLOWED_USES.size) {
    throw contractError("EPK_DOWNLOAD_RIGHTS_INVALID", `${path}.allowedUses`, "must contain approved uses");
  }
  const allowedUses = [...new Set(input.allowedUses)];
  if (allowedUses.length !== input.allowedUses.length || allowedUses.some((value) => !ALLOWED_USES.has(value))) {
    throw contractError("EPK_DOWNLOAD_RIGHTS_INVALID", `${path}.allowedUses`, "contains duplicates or unsupported uses");
  }
  return {
    owner: readString(input.owner, `${path}.owner`, { max: 160 }),
    grant: "promotional-use",
    allowedUses,
    restrictions: readString(input.restrictions, `${path}.restrictions`, { min: 10, max: 1_000, multiline: true })
  };
}

function validateLabel(input, path, urlPolicy) {
  assertExactKeys(input, ["name"], ["website"], path);
  return {
    name: readString(input.name, `${path}.name`, { max: 160 }),
    ...(input.website ? { website: readPublicUrl(input.website, `${path}.website`, urlPolicy) } : {})
  };
}

function validateContact(input, path) {
  assertExactKeys(input, ["name", "role", "email"], [], path);
  const email = readString(input.email, `${path}.email`, { max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw contractError("EPK_CONTACT_EMAIL_INVALID", `${path}.email`, "must be a public contact email address");
  return {
    name: readString(input.name, `${path}.name`, { max: 160 }),
    role: readString(input.role, `${path}.role`, { max: 120 }),
    email
  };
}

function validateEvidence(input, path, urlPolicy, generatedAt) {
  assertExactKeys(input, ["sourceUrl", "capturedAt", "statement"], [], path);
  const capturedAt = readTimestamp(input.capturedAt, `${path}.capturedAt`);
  if (Date.parse(capturedAt) > Date.parse(generatedAt) + 5 * 60 * 1_000) {
    throw contractError("EPK_EVIDENCE_TIMESTAMP_INVALID", `${path}.capturedAt`, "must not be later than manifest generation");
  }
  return {
    sourceUrl: readPublicUrl(input.sourceUrl, `${path}.sourceUrl`, urlPolicy),
    capturedAt,
    statement: readString(input.statement, `${path}.statement`, { min: 10, max: 1_000, multiline: true })
  };
}

function readPublicUrl(value, path, policy, { asset = false } = {}) {
  const raw = readString(value, path, { max: MAX_URL_LENGTH });
  if (raw.includes("\\") || hasEncodedTraversal(raw) || raw.split("/").includes("..")) {
    throw contractError("EPK_URL_PATH_INVALID", path, "contains a forbidden path segment or encoding");
  }
  const isRelative = raw.startsWith("/") && !raw.startsWith("//");
  let parsed;
  try {
    parsed = new URL(raw, policy.siteOrigin);
  } catch {
    throw contractError("EPK_URL_INVALID", path, "must be an absolute HTTPS URL or a same-origin absolute path");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw contractError("EPK_URL_PRIVATE_COMPONENT_FORBIDDEN", path, "credentials, query strings and fragments are forbidden on public EPK URLs");
  }
  if (!policy.allowedOrigins.has(parsed.origin)) {
    throw contractError("EPK_URL_ORIGIN_FORBIDDEN", path, "origin is not allow-listed");
  }
  if (parsed.origin !== policy.siteOrigin && parsed.protocol !== "https:") {
    throw contractError("EPK_URL_HTTPS_REQUIRED", path, "external URLs must use HTTPS");
  }
  if (asset && parsed.origin === policy.siteOrigin && !policy.sameOriginAssetPrefixes.some((prefix) => parsed.pathname.startsWith(prefix))) {
    throw contractError("EPK_ASSET_PATH_FORBIDDEN", path, "same-origin assets must use an allow-listed public path prefix");
  }
  return isRelative && parsed.origin === policy.siteOrigin ? parsed.pathname : parsed.href;
}

function extensionOfUrl(value, siteOrigin) {
  const pathname = new URL(value, siteOrigin).pathname.toLowerCase();
  const filename = pathname.slice(pathname.lastIndexOf("/") + 1);
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index) : "";
}

function readString(value, path, { min = 1, max, multiline = false } = {}) {
  if (typeof value !== "string") throw contractError("EPK_FIELD_INVALID", path, "must be a string");
  if (/[<>]/u.test(value) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw contractError("EPK_TEXT_UNSAFE", path, "contains markup or control characters");
  }
  const normalized = multiline
    ? value.replace(/\r\n?/gu, "\n").split("\n").map((line) => line.trim()).join("\n").trim()
    : value.replace(/\s+/gu, " ").trim();
  if (normalized.length < min || (max && normalized.length > max)) {
    throw contractError("EPK_FIELD_LENGTH_INVALID", path, `must contain ${min}${max ? ` to ${max}` : "+"} characters`);
  }
  return normalized;
}

function readStringArray(value, path, { minItems, maxItems, itemMax }) {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) {
    throw contractError("EPK_FIELD_INVALID", path, `must contain ${minItems} to ${maxItems} values`);
  }
  const normalized = value.map((entry, index) => readString(entry, `${path}[${index}]`, { max: itemMax }));
  if (new Set(normalized.map((entry) => entry.toLowerCase())).size !== normalized.length) {
    throw contractError("EPK_FIELD_INVALID", path, "must not contain duplicates");
  }
  return normalized;
}

function readDate(value, path) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) throw contractError("EPK_DATE_INVALID", path, "must use YYYY-MM-DD");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw contractError("EPK_DATE_INVALID", path, "must be a real calendar date");
  }
  return value;
}

function readTimestamp(value, path) {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value)) {
    throw contractError("EPK_TIMESTAMP_INVALID", path, "must be a UTC ISO timestamp");
  }
  const parsed = new Date(value);
  const canonicalInput = value.replace(/(?:\.(\d{1,3}))?Z$/u, (_match, fraction = "") => `.${fraction.padEnd(3, "0")}Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== canonicalInput) {
    throw contractError("EPK_TIMESTAMP_INVALID", path, "must be a real UTC calendar timestamp");
  }
  return parsed.toISOString();
}

function hasEncodedTraversal(value) {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    if (RESERVED_URL_ENCODING_PATTERN.test(decoded)) return true;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return false;
      decoded = next;
    } catch {
      return true;
    }
  }
  return RESERVED_URL_ENCODING_PATTERN.test(decoded);
}

function assertExactKeys(value, required, optional, path) {
  if (!isPlainObject(value)) throw contractError("EPK_OBJECT_INVALID", path, "must be an object");
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.hasOwn(value, key)) throw contractError("EPK_FIELD_MISSING", `${path}.${key}`, "is required");
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw contractError("EPK_FIELD_UNKNOWN", `${path}.${key}`, "is not part of the public contract");
  }
}

function normalizeOriginInput(value) {
  if (Array.isArray(value)) return value;
  return String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function contractError(code, path, message) {
  return new EpkContractError(code, path, message);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

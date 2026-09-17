import { createHash, randomUUID } from "node:crypto";

export const DEFAULT_ARTIST = Object.freeze({
  id: "artist_marc_rene",
  name: "Marc Rene",
  slug: "marc-rene",
  displayName: "Marc Rene",
  primaryLanguage: "nl",
  country: "NL",
  genres: Object.freeze(["pop", "latin", "reggae", "world"]),
  tags: Object.freeze(["marcsmusic", "default"]),
  websiteUrl: "https://www.marcsmusic.nl",
  status: "active"
});

export function normalizeArtistInput(input, options = {}) {
  if (!input || typeof input !== "object") {
    throw new TypeError("artist input is required");
  }

  const name = requireString(input.name ?? input.displayName, "name");
  const slug = normalizeSlug(input.slug ?? name);
  const now = options.now ?? new Date().toISOString();

  return Object.freeze({
    id: optionalString(input.id) ?? createArtistId(slug),
    name,
    slug,
    displayName: optionalString(input.displayName) ?? name,
    legalName: optionalString(input.legalName),
    biographyByLanguage: normalizeRecord(input.biographyByLanguage),
    country: optionalString(input.country),
    primaryLanguage: optionalString(input.primaryLanguage) ?? "en",
    genres: Object.freeze(normalizeStringArray(input.genres)),
    tags: Object.freeze(normalizeStringArray(input.tags)),
    websiteUrl: optionalString(input.websiteUrl),
    pressEmail: optionalString(input.pressEmail),
    bookingEmail: optionalString(input.bookingEmail),
    managementEmail: optionalString(input.managementEmail),
    artworkLogoAssetId: optionalString(input.artworkLogoAssetId),
    pressPhotoAssetId: optionalString(input.pressPhotoAssetId),
    defaultVisibility: normalizeVisibility(input.defaultVisibility),
    status: input.status === "inactive" ? "inactive" : "active",
    createdAt: optionalString(input.createdAt) ?? now,
    updatedAt: now
  });
}

export function normalizeSlug(value) {
  const slug = requireString(value, "slug")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  if (!slug) {
    throw new TypeError("artist slug cannot be empty");
  }

  return slug;
}

function createArtistId(slug) {
  return `artist_${createHash("sha256").update(slug).digest("hex").slice(0, 12)}`;
}

export function createReleaseArtistDisplayName({ primaryArtist, featuredArtists = [] }) {
  if (!primaryArtist) {
    throw new TypeError("primaryArtist is required");
  }

  if (featuredArtists.length === 0) {
    return primaryArtist.displayName ?? primaryArtist.name;
  }

  return `${primaryArtist.displayName ?? primaryArtist.name} feat. ${featuredArtists
    .map((artist) => artist.displayName ?? artist.name)
    .join(", ")}`;
}

export function createEphemeralArtistFromName(name) {
  const displayName = requireString(name, "artist");
  const slug = normalizeSlug(displayName);
  return Object.freeze({
    ...DEFAULT_ARTIST,
    id: randomUUID(),
    name: displayName,
    slug,
    displayName
  });
}

function normalizeRecord(value) {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("biographyByLanguage must be an object");
  }

  return Object.freeze({ ...value });
}

function normalizeStringArray(value) {
  if (value === undefined || value === null) {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(/[,\n]/u);
  return [...new Set(values.map(optionalString).filter(Boolean))];
}

function normalizeVisibility(value) {
  const normalized = optionalString(value);
  if (!normalized) {
    return "private";
  }

  if (!["private", "public", "unlisted"].includes(normalized)) {
    throw new TypeError("defaultVisibility must be private, public, or unlisted");
  }

  return normalized;
}

function requireString(value, fieldName) {
  const normalized = optionalString(value);

  if (!normalized) {
    throw new TypeError(`${fieldName} is required`);
  }

  return normalized;
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}


import { createHash } from "node:crypto";
import { ApplicationError } from "../errors.mjs";
import {
  hasNegativeSubmissionEvidence as hasNoSubmissionsEvidence,
  hasPurposeEvidence,
  policyEvidenceCorpus
} from "./evidence-policy.mjs";
import { normalizeEmail } from "./normalization.mjs";
import { canonicalCountry, canonicalIanaTimezone, canonicalLanguage } from "./recipient-locale.mjs";
import { canonicalInstagramUrl, canonicalLinkedInUrl, canonicalSoundCloudUrl } from "./source-identity.mjs";
import { canonicalizeSourceHttpsUrl, canonicalizeSourceRecords } from "./source-url.mjs";

const GENRES = new Map([
  ["ambient", "Ambient"], ["dance", "Dance"], ["electronic", "Electronic"],
  ["hip hop", "Hip Hop"], ["hip-hop", "Hip Hop"], ["indie", "Indie"],
  ["latin", "Latin"], ["pop", "Pop"], ["reggae", "Reggae"], ["rock", "Rock"],
  ["world", "World"]
]);
const SUB_GENRES = new Map([
  ["afro", "Afro"], ["caribbean", "Caribbean"], ["club", "Club"],
  ["downtempo", "Downtempo"], ["indie dance", "Indie Dance"], ["indie-dance", "Indie Dance"],
  ["melodic", "Melodic"], ["reggaeton", "Reggaeton"], ["tropical", "Tropical"],
  ["world fusion", "World Fusion"], ["world-fusion", "World Fusion"]
]);
const FORMAT_GENRES = new Map([
  ["chr", "CHR"], ["college", "College"], ["community", "Community"],
  ["dance", "Dance"], ["electronic", "Electronic"], ["indie", "Indie"],
  ["latin", "Latin"], ["mainstream", "Mainstream"], ["specialist", "Specialist"],
  ["urban", "Urban"], ["world", "World"]
]);

export function adaptDjFinderRows(rows) {
  if (!Array.isArray(rows)) invalid("DJ Finder export must be an array");
  const records = [];
  for (const row of rows) {
    const website = secureUrl(row.website_url ?? row.source_url ?? row.contact_source_url, "DJ website/source URL");
    const capturedAt = isoDateTime(row.verification_timestamp ?? row.last_verified_on ?? row.verification_date, "DJ evidence timestamp");
    const name = requiredText(row.artist_name ?? row.dj_name ?? row.full_name ?? row.alias, "DJ name");
    const outletExternalId = stableExternalId("dj", row.source_id ?? `${name}\n${website}`);
    const evidenceText = requiredText(row.active_evidence ?? row.why_relevant ?? row.notes, "DJ source evidence");
    const mappedLanguage = canonicalLanguage(row.preferred_language ?? row.preferredLanguage ?? row.languages ?? row.language);
    const mappedCountry = canonicalCountry(row.country);
    const mappedTimezone = canonicalIanaTimezone(row.timezone);
    const instagramUrl = canonicalOptionalSocial(row.instagram_url ?? row.instagram, canonicalInstagramUrl, "Instagram profile URL");
    const linkedinUrl = canonicalOptionalSocial(row.linkedin_url ?? row.linkedin, canonicalLinkedInUrl, "LinkedIn profile URL");
    const soundcloudUrl = canonicalOptionalSocial(row.soundcloud_url ?? row.soundcloud, canonicalSoundCloudUrl, "SoundCloud profile URL");
    const denied = hasNoSubmissionsEvidence(row, evidenceText);
    const selected = denied ? undefined : allowedDjEmail(row, evidenceText);
    const explicitFormUrl = denied ? undefined : allowedDjSubmissionForm(row, evidenceText);
    const submissionUrl = explicitFormUrl
      ?? (selected ? firstSecureUrl(row.contact_source_url, row.source_url) : undefined);
    const routeAllowed = Boolean(selected || explicitFormUrl);
    records.push({
      kind: "mediaOutlet",
      externalId: outletExternalId,
      name,
      type: "DJ",
      website,
      ...(mappedCountry ? { country: mappedCountry } : {}),
      ...(mappedLanguage ? { language: mappedLanguage } : {}),
      ...(mappedTimezone ? { timezone: mappedTimezone } : {}),
      genres: mapGenres(row.genres ?? row.genre_match),
      subGenres: mapTaxonomy(row.sub_genres ?? row.subgenres ?? row.subgenre, SUB_GENRES),
      formatGenres: mapTaxonomy(row.format_genres ?? row.station_format ?? row.format, FORMAT_GENRES),
      submissionPolicy: denied ? "No Submissions" : selected?.policy ?? (explicitFormUrl ? "Explicit" : "General Contact"),
      ...(submissionUrl ? { submissionUrl } : {}),
      acceptsEmail: Boolean(selected),
      acceptsForms: Boolean(explicitFormUrl),
      acceptsUnreleased: !denied && routeAllowed && truthy(row.accepts_unreleased),
      qualityScore: boundedScore(row.confidence_score),
      verified: text(row.verification_status)?.toLowerCase() === "verified",
      evidence: { url: secureUrl(row.source_url ?? row.contact_source_url ?? website, "DJ evidence URL"), text: evidenceText, capturedAt }
    });
    if (!selected) continue;
    records.push({
      kind: "mediaContact",
      externalId: stableExternalId("dj-contact", selected.email),
      outletExternalId,
      fullName: requiredText(row.full_name ?? row.dj_name ?? row.artist_name ?? name, "DJ contact name"),
      ...(text(row.first_name ?? row.firstName) ? { firstName: text(row.first_name ?? row.firstName) } : {}),
      ...(text(row.last_name ?? row.lastName) ? { lastName: text(row.last_name ?? row.lastName) } : {}),
      email: selected.email,
      role: text(row.role ?? row.dj_type) ?? "DJ / music contact",
      ...(instagramUrl ? { instagramUrl } : {}),
      ...(linkedinUrl ? { linkedinUrl } : {}),
      ...(soundcloudUrl ? { soundcloudUrl } : {}),
      ...(text(row.show_name ?? row.radio_show ?? row.program_name) ? {
        showName: text(row.show_name ?? row.radio_show ?? row.program_name)
      } : {}),
      verified: text(row.verification_status)?.toLowerCase() === "verified",
      ...(mappedLanguage ? { preferredLanguage: mappedLanguage } : {}),
      ...(mappedTimezone ? { timezone: mappedTimezone } : {}),
      purpose: selected.purpose,
      basis: "Explicit Submission Address",
      evidence: { url: secureUrl(row.contact_source_url ?? row.source_url, "DJ contact evidence URL"), text: evidenceText, capturedAt }
    });
  }
  return records;
}

export function adaptMusicSubmissionPlatforms(platforms) {
  if (!Array.isArray(platforms)) invalid("Music Submission Agent export must be an array");
  return platforms.map((platform) => {
    const website = secureUrl(platform.websiteUrl, "platform website URL");
    const sourceUrl = secureUrl(platform.sourceUrl ?? platform.submissionUrl ?? platform.websiteUrl, "platform evidence URL");
    const capturedAt = isoDateTime(platform.lastVerifiedAt, "platform verification timestamp");
    const method = text(platform.submissionMethod)?.toLowerCase();
    const providedEvidenceText = text(
      platform.evidenceText ?? platform.sourceEvidence ?? platform.evidence?.text ?? platform.notes
    );
    const evidenceText = providedEvidenceText
      ?? "No source-provided submission-route evidence was included; route is quarantined.";
    const denied = hasNoSubmissionsEvidence(platform, evidenceText);
    const hasSubmissionProof = Boolean(providedEvidenceText)
      && !denied
      && Boolean(firstSecureUrl(platform.sourceUrl, platform.submissionUrl))
      && hasPurposeEvidence(policyEvidenceCorpus(platform, evidenceText), "submission");
    const submissionUrl = hasSubmissionProof ? secureOptionalUrl(platform.submissionUrl) : undefined;
    const acceptsEmail = method === "email" && hasSubmissionProof;
    const acceptsForms = method === "form" && hasSubmissionProof && Boolean(submissionUrl);
    const routeAllowed = acceptsEmail || acceptsForms;
    const mappedLanguage = canonicalLanguage(platform.language);
    const mappedCountry = canonicalCountry(platform.country);
    const mappedTimezone = canonicalIanaTimezone(platform.timezone);
    return {
      kind: "mediaOutlet",
      externalId: stableExternalId("platform", platform.canonicalKey ?? platform.id ?? website),
      name: requiredText(platform.name, "platform name"),
      type: "Submission Platform",
      website,
      ...(mappedCountry ? { country: mappedCountry } : {}),
      ...(mappedLanguage ? { language: mappedLanguage } : {}),
      ...(mappedTimezone ? { timezone: mappedTimezone } : {}),
      genres: mapGenres(platform.genres),
      subGenres: mapTaxonomy(platform.subGenres ?? platform.subgenres, SUB_GENRES),
      formatGenres: mapTaxonomy(platform.formatGenres ?? platform.formats, FORMAT_GENRES),
      submissionPolicy: denied ? "No Submissions" : routeAllowed ? "Explicit" : "General Contact",
      ...(submissionUrl && routeAllowed ? { submissionUrl } : {}),
      acceptsEmail,
      acceptsForms,
      acceptsUnreleased: !denied && routeAllowed && !truthy(platform.paymentRequired),
      qualityScore: boundedScore(platform.confidenceScore),
      verified: platform.verificationStatus === "verified" && platform.active !== false,
      evidence: {
        url: sourceUrl,
        text: evidenceText,
        capturedAt
      }
    };
  });
}

export function adaptReleaseOsReleases(releases) {
  if (!Array.isArray(releases)) invalid("Release OS export must be an array");
  return releases.map((release) => ({
    kind: "musicRelease",
    externalId: stableExternalId("release", release.id),
    isrc: requiredText(release.isrc, "release ISRC").replaceAll("-", "").toUpperCase(),
    name: requiredText(release.title, "release title"),
    artistName: requiredText(release.artistDisplayName ?? release.artist, "release artist"),
    ...(text(release.description) ? { description: text(release.description) } : {}),
    ...(text(release.releaseDate) ? { releaseDate: text(release.releaseDate) } : {}),
    ...(text(release.campaignStartDate) ? { campaignStartDate: text(release.campaignStartDate) } : {}),
    ...(text(release.campaignEndDate) ? { campaignEndDate: text(release.campaignEndDate) } : {}),
    genres: mapGenres(release.genre ?? release.genres),
    subGenres: mapTaxonomy(release.subGenres ?? release.subgenres, SUB_GENRES),
    languages: Array.isArray(release.languages) ? release.languages : [],
    territories: mapTerritories(release.territories),
    ...(secureOptionalUrl(release.spotifyUrl ?? release.primaryReleaseUrl) ? { spotifyUrl: secureOptionalUrl(release.spotifyUrl ?? release.primaryReleaseUrl) } : {}),
    ...(secureOptionalUrl(release.websiteUrl) ? { websiteUrl: secureOptionalUrl(release.websiteUrl) } : {}),
    ...(secureOptionalUrl(release.epkUrl) ? { epkUrl: secureOptionalUrl(release.epkUrl) } : {}),
    ...(secureOptionalUrl(release.privateStreamUrl) ? { privateStreamUrl: secureOptionalUrl(release.privateStreamUrl) } : {}),
    ...(secureOptionalUrl(release.downloadUrl) ? { downloadUrl: secureOptionalUrl(release.downloadUrl) } : {}),
    ...(secureOptionalUrl(release.artworkUrl) ? { artworkUrl: secureOptionalUrl(release.artworkUrl) } : {}),
    ...(secureOptionalUrl(release.radioEditUrl) ? { radioEditUrl: secureOptionalUrl(release.radioEditUrl) } : {}),
    priority: boundedScore(release.priority ?? 50),
    dailySendLimit: positiveBounded(release.dailySendLimit, 20, 1_000),
    evidence: {
      url: secureUrl(release.sourceUrl, "release evidence URL"),
      text: requiredText(release.sourceEvidence, "release source evidence"),
      capturedAt: isoDateTime(release.sourceCapturedAt ?? release.updatedAt, "release evidence timestamp")
    }
  }));
}

export function buildSourceArtifact({ sourceId, records, generatedAt = new Date().toISOString(), partition = "1-of-1" }) {
  const canonicalRecords = canonicalizeSourceRecords(records);
  const digest = createHash("sha256").update(JSON.stringify({ sourceId, generatedAt, partition, records: canonicalRecords })).digest("hex").slice(0, 24);
  return Object.freeze({
    schemaVersion: "1.0",
    sourceId,
    artifactId: `snapshot-${generatedAt.replace(/[^0-9]/gu, "").slice(0, 14)}-${partition}-${digest}`,
    generatedAt,
    records: canonicalRecords
  });
}

function allowedDjEmail(row, evidenceText) {
  const corpus = policyEvidenceCorpus(row, evidenceText);
  for (const [field, purpose, policy, evidenceType] of [
    ["music_submission_email", "Explicit Music Submission", "Explicit", "submission"],
    ["promo_email", "Promo Contact", "Promo Contact", "promo"],
    ["press_email", "Press Contact", "Press Contact", "press"]
  ]) {
    const email = normalizeEmail(row[field]);
    if (email && hasPurposeEvidence(corpus, evidenceType)) return { email, purpose, policy };
  }
  return undefined;
}

function allowedDjSubmissionForm(row, evidenceText) {
  const formUrl = firstSecureUrl(
    row.music_submission_form_url,
    row.submission_form_url,
    row.music_submission_url
  );
  if (!formUrl) return undefined;
  return hasPurposeEvidence(policyEvidenceCorpus(row, evidenceText), "submission") ? formUrl : undefined;
}

function firstSecureUrl(...values) {
  for (const value of values) {
    const url = secureOptionalUrl(value);
    if (url) return url;
  }
  return undefined;
}

function canonicalOptionalSocial(value, canonicalize, field) {
  if (!text(value)) return undefined;
  const canonical = canonicalize(value);
  if (!canonical) invalid(`${field} must be a canonical HTTPS profile URL`);
  return canonical;
}

function stableExternalId(prefix, value) {
  const input = requiredText(value, `${prefix} source identifier`);
  return `${prefix}-${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

function secureUrl(value, field) {
  const url = secureOptionalUrl(value);
  if (!url) invalid(`${field} must be a valid HTTPS URL`);
  return url;
}

function secureOptionalUrl(value) {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return canonicalizeSourceHttpsUrl(value);
  } catch {
    return undefined;
  }
}

function isoDateTime(value, field) {
  const timestamp = Date.parse(text(value) ?? "");
  if (!Number.isFinite(timestamp)) invalid(`${field} must be an ISO timestamp`);
  return new Date(timestamp).toISOString();
}

function mapGenres(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/[|,;]/u);
  const mapped = values.map((item) => GENRES.get(String(item).trim().toLowerCase()) ?? "Other");
  return [...new Set(mapped)].slice(0, 20);
}

function mapTaxonomy(value, taxonomy) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/[|,;]/u);
  return [...new Set(values.map((item) => taxonomy.get(String(item).trim().toLowerCase())).filter(Boolean))].slice(0, 20);
}

function mapTerritories(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/[|,;]/u);
  return [...new Set(values.map((item) => String(item).trim().toUpperCase()).filter((item) => /^[A-Z]{2}$/u.test(item)))].slice(0, 64);
}

function boundedScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 0;
}

function positiveBounded(value, fallback, max) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function truthy(value) {
  return value === true || ["true", "yes", "1"].includes(String(value ?? "").toLowerCase());
}

function requiredText(value, field) {
  const result = text(value);
  if (!result) invalid(`${field} is required`);
  return result;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function invalid(message) {
  throw new ApplicationError(message, { code: "SOURCE_ADAPTER_INPUT_INVALID", statusCode: 400, retryable: false });
}

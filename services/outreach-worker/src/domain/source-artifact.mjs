import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApplicationError } from "../errors.mjs";
import { normalizeDomain, normalizeEmail, normalizeIdentityText } from "./normalization.mjs";
import { canonicalIanaTimezone, SUPPORTED_COPY_LANGUAGES, SUPPORTED_COUNTRY_CODES } from "./recipient-locale.mjs";
import { canonicalLinkedInUrl, canonicalSoundCloudUrl } from "./social-profile.mjs";
import { canonicalizeSourceHttpsUrl } from "./source-url.mjs";

export const SOURCE_IDS = Object.freeze(["dj-finder", "music-submission-agent", "marcsmusic-release-os"]);

const httpsUrl = z.string().max(512).transform((value, context) => {
  try {
    const canonical = canonicalizeSourceHttpsUrl(value);
    if (canonical.length > 512) {
      context.addIssue({ code: "custom", message: "Canonical HTTPS URL exceeds 512 characters" });
      return z.NEVER;
    }
    return canonical;
  } catch (error) {
    context.addIssue({ code: "custom", message: error.reason ?? "A canonical HTTPS URL is required" });
    return z.NEVER;
  }
});
const instagramProfileUrl = httpsUrl.refine(isInstagramProfileUrl, {
  message: "A canonical Instagram profile URL is required"
});
const linkedinProfileUrl = canonicalProfileUrl(canonicalLinkedInUrl, "A canonical LinkedIn personal profile URL is required");
const soundcloudProfileUrl = canonicalProfileUrl(canonicalSoundCloudUrl, "A canonical SoundCloud profile URL is required");
const ianaTimezone = z.string().trim().max(80).transform((value, context) => {
  const canonical = canonicalIanaTimezone(value);
  if (!canonical) {
    context.addIssue({ code: "custom", message: "A valid IANA recipient timezone is required" });
    return z.NEVER;
  }
  return canonical;
});
const supportedLanguage = z.enum(SUPPORTED_COPY_LANGUAGES);
const supportedCountry = z.enum(SUPPORTED_COUNTRY_CODES);
const sourceId = z.enum(SOURCE_IDS);
const externalId = z.string().trim().min(1).max(180).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);
const evidence = z.object({
  url: httpsUrl,
  text: z.string().trim().min(10).max(2_000),
  capturedAt: z.iso.datetime()
}).strict();
const genres = z.array(z.enum([
  "Ambient", "Dance", "Electronic", "Hip Hop", "Indie", "Latin", "Pop", "Reggae", "Rock", "World", "Other"
])).max(20).default([]);
const subGenres = z.array(z.enum([
  "Afro", "Caribbean", "Club", "Downtempo", "Indie Dance", "Melodic", "Reggaeton", "Tropical", "World Fusion", "Other"
])).max(20).default([]);
const formatGenres = z.array(z.enum([
  "CHR", "College", "Community", "Dance", "Electronic", "Indie", "Latin", "Mainstream", "Specialist", "Urban", "World", "Other"
])).max(20).default([]);
const languages = z.array(z.enum(["nl", "en", "de", "fr", "es", "pt", "instrumental", "other"])).max(8).default([]);
const territories = z.array(z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/u)).max(64).default([]);

const outletRecord = z.object({
  kind: z.literal("mediaOutlet"),
  externalId,
  name: z.string().trim().min(1).max(180),
  type: z.enum(["Radio Station", "Radio Show", "DJ", "Music Blog", "Playlist Curator", "Label", "Submission Platform"]),
  website: httpsUrl,
  country: supportedCountry.optional(),
  language: supportedLanguage.optional(),
  timezone: ianaTimezone.optional(),
  genres,
  subGenres,
  formatGenres,
  submissionPolicy: z.enum(["Explicit", "Promo Contact", "Press Contact", "General Contact", "No Submissions", "Blocked"]),
  submissionUrl: httpsUrl.optional(),
  acceptsEmail: z.boolean().default(false),
  acceptsForms: z.boolean().default(false),
  acceptsUnreleased: z.boolean().default(false),
  qualityScore: z.number().int().min(0).max(100).default(0),
  verified: z.boolean().default(false),
  evidence
}).strict();

const contactRecord = z.object({
  kind: z.literal("mediaContact"),
  externalId,
  outletExternalId: externalId,
  fullName: z.string().trim().min(1).max(180),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().max(254),
  role: z.string().trim().min(1).max(160),
  instagramUrl: instagramProfileUrl.optional(),
  linkedinUrl: linkedinProfileUrl.optional(),
  soundcloudUrl: soundcloudProfileUrl.optional(),
  showName: z.string().trim().min(1).max(180).optional(),
  verified: z.boolean().default(false),
  preferredLanguage: supportedLanguage.optional(),
  timezone: ianaTimezone.optional(),
  purpose: z.enum(["Explicit Music Submission", "Promo Contact", "Press Contact"]),
  basis: z.enum(["Opt In", "Existing Relationship", "Explicit Submission Address"]),
  evidence
}).strict();

const releaseRecord = z.object({
  kind: z.literal("musicRelease"),
  externalId,
  isrc: z.string().trim().toUpperCase().regex(/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/u),
  name: z.string().trim().min(1).max(180),
  artistName: z.string().trim().min(1).max(180),
  description: z.string().trim().max(8_000).optional(),
  releaseDate: z.iso.date().optional(),
  campaignStartDate: z.iso.date().optional(),
  campaignEndDate: z.iso.date().optional(),
  genres,
  subGenres,
  languages,
  territories,
  spotifyUrl: httpsUrl.optional(),
  websiteUrl: httpsUrl.optional(),
  epkUrl: httpsUrl.optional(),
  privateStreamUrl: httpsUrl.optional(),
  downloadUrl: httpsUrl.optional(),
  artworkUrl: httpsUrl.optional(),
  radioEditUrl: httpsUrl.optional(),
  priority: z.number().int().min(0).max(100).default(50),
  dailySendLimit: z.number().int().min(1).max(1_000).default(20),
  evidence
}).strict().superRefine((record, context) => {
  if (!record.epkUrl && !record.privateStreamUrl) {
    context.addIssue({ code: "custom", path: ["epkUrl"], message: "An EPK or private stream URL is required" });
  }
  if (record.campaignStartDate && record.campaignEndDate && record.campaignEndDate < record.campaignStartDate) {
    context.addIssue({ code: "custom", path: ["campaignEndDate"], message: "Campaign end must not precede campaign start" });
  }
});

const artifactSchema = z.object({
  schemaVersion: z.literal("1.0"),
  sourceId,
  artifactId: externalId,
  generatedAt: z.iso.datetime(),
  records: z.array(z.union([outletRecord, contactRecord, releaseRecord])).min(1).max(500)
}).strict();

function canonicalProfileUrl(canonicalizer, message) {
  return z.string().max(512).transform((value, context) => {
    const canonical = canonicalizer(value);
    if (!canonical) {
      context.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return canonical;
  });
}

export function parseSourceArtifact(input, options = {}) {
  const parsed = artifactSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApplicationError("Source artifact violates the v1 contract", {
      code: "SOURCE_ARTIFACT_INVALID",
      statusCode: 400,
      retryable: false,
      details: { issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) }
    });
  }
  const now = options.now ?? new Date();
  const generatedAt = Date.parse(parsed.data.generatedAt);
  const maxAgeMs = (options.maxAgeSeconds ?? 86_400) * 1_000;
  const maxEvidenceAgeMs = (options.maxEvidenceAgeSeconds ?? 7_776_000) * 1_000;
  const futureSkewMs = (options.maxFutureSkewSeconds ?? 300) * 1_000;
  if (generatedAt < now.getTime() - maxAgeMs || generatedAt > now.getTime() + futureSkewMs) {
    throw new ApplicationError("Source artifact is outside the accepted time window", {
      code: "SOURCE_ARTIFACT_STALE", statusCode: 400, retryable: false
    });
  }
  const keys = new Set();
  for (const record of parsed.data.records) {
    const key = `${record.kind}:${record.externalId}`;
    if (keys.has(key)) {
      throw new ApplicationError("Source artifact contains duplicate record identifiers", {
        code: "SOURCE_ARTIFACT_DUPLICATE_RECORD", statusCode: 400, retryable: false, details: { key }
      });
    }
    keys.add(key);
    const evidenceCapturedAt = Date.parse(record.evidence.capturedAt);
    if (evidenceCapturedAt < now.getTime() - maxEvidenceAgeMs || evidenceCapturedAt > now.getTime() + futureSkewMs) {
      throw new ApplicationError("Source evidence is outside the accepted time window", {
        code: "SOURCE_EVIDENCE_STALE", statusCode: 400, retryable: false, details: { key }
      });
    }
  }
  return Object.freeze(parsed.data);
}

export function sourceRequestSignature({ sourceId: id, keyId, timestamp, nonce, rawBody }, secret) {
  const bodyDigest = createHash("sha256").update(rawBody).digest("hex");
  const canonical = `v2\n${id}\n${keyId}\n${timestamp}\n${nonce}\n${bodyDigest}`;
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function verifySourceRequestSignature(request, config, options = {}) {
  const id = String(request.sourceId ?? "");
  if (!config.enabled) throw sourceAuthError("SOURCE_INGESTION_DISABLED", 503);
  const keyring = config.keyrings?.[id];
  if (!keyring) throw sourceAuthError("SOURCE_ID_UNAUTHORIZED", 401);
  const keyId = String(request.keyId ?? "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/u.test(keyId)) throw sourceAuthError("SOURCE_KEY_ID_INVALID", 401);
  const signingKey = keyring.active?.kid === keyId
    ? keyring.active.key
    : keyring.verifyOnly?.find((entry) => entry.kid === keyId)?.key;
  if (!signingKey) throw sourceAuthError("SOURCE_KEY_ID_UNKNOWN", 401);
  const timestamp = String(request.timestamp ?? "");
  const nonce = String(request.nonce ?? "");
  const signatureHeader = String(request.signature ?? "");
  if (!signatureHeader.startsWith("v2=")) throw sourceAuthError("SOURCE_SIGNATURE_VERSION_UNSUPPORTED", 401);
  const supplied = signatureHeader.slice(3).toLowerCase();
  if (!/^[0-9]{10}$/u.test(timestamp) || !/^[A-Za-z0-9._:-]{16,128}$/u.test(nonce) || !/^[0-9a-f]{64}$/u.test(supplied)) {
    throw sourceAuthError("SOURCE_SIGNATURE_INVALID", 401);
  }
  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1_000);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > config.maxSkewSeconds) {
    throw sourceAuthError("SOURCE_SIGNATURE_EXPIRED", 401);
  }
  const expected = sourceRequestSignature({ sourceId: id, keyId, timestamp, nonce, rawBody: request.rawBody }, signingKey);
  const actualBuffer = Buffer.from(supplied, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw sourceAuthError("SOURCE_SIGNATURE_INVALID", 401);
  }
  return Object.freeze({ sourceId: id, keyId, nonce, timestamp: new Date(timestampSeconds * 1_000) });
}

export function outletFingerprint(sourceIdValue, record) {
  const domain = normalizeDomain(record.website);
  return createHash("sha256")
    .update(domain ? `domain:${domain}` : `source:${sourceIdValue}:${record.externalId}`)
    .digest("hex");
}

export function contactFingerprintFromArtifact(record, outletDomain) {
  const email = normalizeEmail(record.email);
  if (!email) throw new ApplicationError("Contact email cannot be normalized", { code: "SOURCE_CONTACT_EMAIL_INVALID", statusCode: 400 });
  const domain = normalizeDomain(outletDomain);
  const name = normalizeIdentityText(record.fullName);
  if (!domain || !name) {
    throw new ApplicationError("Contact fingerprint requires canonical outlet and contact identity", {
      code: "SOURCE_CONTACT_FINGERPRINT_INPUT_MISSING", statusCode: 409, retryable: true
    });
  }
  return createHash("sha256")
    .update(`email:${email}\ndomain:${domain}\nname:${name}`)
    .digest("hex");
}

export function legacyContactFingerprintFromArtifact(record) {
  const email = normalizeEmail(record.email);
  if (!email) throw new ApplicationError("Contact email cannot be normalized", { code: "SOURCE_CONTACT_EMAIL_INVALID", statusCode: 400 });
  return createHash("sha256").update(`email:${email}`).digest("hex");
}

export function evidenceDigest(record) {
  return createHash("sha256")
    .update(`${record.evidence.url}\n${record.evidence.capturedAt}\n${record.evidence.text}`)
    .digest("hex");
}

function sourceAuthError(code, statusCode) {
  return new ApplicationError("Source request authentication failed", { code, statusCode, retryable: false });
}

function isInstagramProfileUrl(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^www\./u, "");
  const segments = url.pathname.split("/").filter(Boolean);
  return host === "instagram.com" && segments.length === 1 && /^[A-Za-z0-9._]{1,30}$/u.test(segments[0]);
}

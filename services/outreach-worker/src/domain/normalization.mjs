import { createHash } from "node:crypto";
import { canonicalCountry, canonicalIanaTimezone, canonicalLanguage } from "./recipient-locale.mjs";

export function normalizeEmail(value) {
  const email = optionalText(value)?.toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return undefined;
  return email;
}

export function normalizeDomain(value) {
  const text = optionalText(value);
  if (!text) return undefined;
  try {
    const url = text.includes("://") ? new URL(text) : new URL(`https://${text}`);
    return url.hostname.toLowerCase().replace(/^www\./u, "");
  } catch {
    return text.toLowerCase().replace(/^www\./u, "").split(/[/:]/u)[0] || undefined;
  }
}

export function normalizeTags(value) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,\n]/u) : [];
  return [...new Set(items.map(optionalText).filter(Boolean).map((item) => item.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()))].sort();
}

export function normalizeIdentityText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function normalizeLanguage(value) {
  return canonicalLanguage(value);
}

export function normalizeCountry(value) {
  return canonicalCountry(value);
}

export function normalizeContact(raw) {
  const email = normalizeEmail(raw.emailAddress ?? raw.email);
  return Object.freeze({
    id: requireId(raw.id, "MediaContact"),
    versionNumber: Number.isInteger(raw.versionNumber) ? raw.versionNumber : undefined,
    name: optionalText(raw.name) ?? optionalText(`${raw.firstName ?? ""} ${raw.lastName ?? ""}`),
    firstName: optionalText(raw.firstName),
    lastName: optionalText(raw.lastName),
    showName: optionalText(raw.showName),
    instagramUrl: optionalText(raw.instagramUrl),
    linkedinUrl: optionalText(raw.linkedinUrl),
    soundcloudUrl: optionalText(raw.soundcloudUrl),
    email,
    status: optionalText(raw.status) ?? "New",
    role: optionalText(raw.role),
    preferredLanguage: normalizeLanguage(raw.preferredLanguage),
    timezone: canonicalIanaTimezone(raw.timezone),
    mediaOutletId: optionalText(raw.mediaOutletId),
    contactSourceUrl: optionalText(raw.contactSourceUrl) ?? optionalText(raw.proofUrl),
    contactEvidence: optionalText(raw.contactEvidence) ?? optionalText(raw.proofText),
    contactPurpose: optionalText(raw.contactPurpose) ?? "Unknown",
    contactBasis: optionalText(raw.contactBasis) ?? "Unknown",
    proofCapturedAt: optionalText(raw.proofCapturedAt),
    evidenceAttestation: raw.evidenceAttestation,
    emailValidationStatus: optionalText(raw.emailValidationStatus) ?? "Unknown",
    smtpValidationStatus: optionalText(raw.smtpValidationStatus),
    lastValidatedAt: optionalText(raw.lastValidatedAt),
    doNotContact: Boolean(raw.doNotContact),
    optedOut: Boolean(raw.optedOut),
    hardBounced: Boolean(raw.hardBounced),
    previousPositiveReply: Boolean(raw.previousPositiveReply),
    rejectedGenres: normalizeTags(raw.rejectedGenres)
  });
}

export function normalizeOutlet(raw) {
  return Object.freeze({
    id: requireId(raw.id, "MediaOutlet"),
    versionNumber: Number.isInteger(raw.versionNumber) ? raw.versionNumber : undefined,
    name: optionalText(raw.name),
    type: optionalText(raw.type),
    website: optionalText(raw.website),
    domain: normalizeDomain(raw.normalizedDomain ?? raw.website),
    country: normalizeCountry(raw.country),
    language: normalizeLanguage(raw.language),
    timezone: canonicalIanaTimezone(raw.timezone),
    genres: normalizeTags(raw.genres),
    subGenres: normalizeTags(raw.subGenres),
    formatGenres: normalizeTags(raw.formatGenres),
    submissionPolicy: optionalText(raw.submissionPolicy) ?? "Unknown",
    submissionUrl: optionalText(raw.submissionUrl),
    submissionEvidence: optionalText(raw.submissionEvidence),
    sourceUrl: optionalText(raw.sourceUrl),
    evidenceAttestation: raw.evidenceAttestation,
    acceptsEmail: Boolean(raw.acceptsEmail),
    activityStatus: optionalText(raw.activityStatus) ?? "Unknown",
    lastValidatedAt: optionalText(raw.lastValidatedAt),
    qualityScore: Number(raw.qualityScore ?? 0)
  });
}

export function normalizeRelease(raw) {
  return Object.freeze({
    id: requireId(raw.id, "MusicRelease"),
    name: optionalText(raw.name),
    artistName: optionalText(raw.artistName),
    releaseDate: optionalText(raw.releaseDate),
    campaignStartDate: optionalText(raw.campaignStartDate),
    campaignEndDate: optionalText(raw.campaignEndDate),
    status: optionalText(raw.status) ?? "Draft",
    genres: normalizeTags(raw.genres),
    subGenres: normalizeTags(raw.subGenres),
    languages: normalizeTags(raw.languages),
    moods: normalizeTags(raw.moods),
    territories: normalizeTags(raw.territories).map((item) => item.toUpperCase()),
    description: optionalText(raw.description),
    epkUrl: optionalText(raw.epkUrl),
    privateStreamUrl: optionalText(raw.privateStreamUrl),
    downloadUrl: optionalText(raw.downloadUrl),
    radioEditUrl: optionalText(raw.radioEditUrl),
    spotifyUrl: optionalText(raw.spotifyUrl),
    priority: Number(raw.priority ?? 0),
    dailySendLimit: Number(raw.dailySendLimit ?? 0)
  });
}

export function contactFingerprint({ email, outletDomain, name }) {
  const normalizedEmail = normalizeEmail(email);
  return createHash("sha256")
    .update(normalizedEmail ? `email:${normalizedEmail}` : `fallback:${normalizeDomain(outletDomain) ?? ""}|${optionalText(name)?.toLowerCase() ?? ""}`)
    .digest("hex");
}

export function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requireId(value, entityType) {
  const id = optionalText(value);
  if (!id) throw Object.assign(new Error(`${entityType} id is required`), { code: "ENTITY_ID_REQUIRED" });
  return id;
}

import { createHash } from "node:crypto";
import {
  contactFingerprintFromArtifact,
  legacyContactFingerprintFromArtifact
} from "./source-artifact.mjs";
import {
  canonicalInstagramUrl,
  canonicalLinkedInUrl,
  canonicalSoundCloudUrl,
  normalizeInstagramAccount,
  normalizeLinkedInAccount,
  normalizeSoundCloudAccount
} from "./source-identity.mjs";
import { normalizeDomain, normalizeEmail, normalizeIdentityText } from "./normalization.mjs";

export function directOutletIdentity(record, cryptoBox) {
  const domain = normalizeDomain(record.normalizedDomain ?? record.website);
  const name = normalizeIdentityText(record.name);
  const fingerprint = domain
    ? createHash("sha256").update(`domain:${domain}`).digest("hex")
    : validDigest(record.fingerprint)
      ? record.fingerprint
      : createHash("sha256").update(`direct-outlet:${record.id}`).digest("hex");
  const descriptors = [identity("fingerprint", fingerprint, cryptoBox)];
  if (domain) descriptors.push(identity("outlet_domain", domain, cryptoBox));
  if (domain && name) descriptors.push(identity("name_outlet", `${name}\n${domain}`, cryptoBox));
  if (domain && name && record.type === "Radio Show") {
    descriptors.push(identity("show_outlet", `${name}\n${domain}`, cryptoBox));
  }
  return Object.freeze({ domain, fingerprint, descriptors: unique(descriptors) });
}

export function directContactIdentity(record, outlet, cryptoBox) {
  const email = normalizeEmail(record.emailAddress ?? record.email);
  const outletDomain = normalizeDomain(outlet?.normalizedDomain ?? outlet?.website ?? outlet?.domain);
  const fullName = contactName(record);
  const artifactRecord = { email, fullName };
  const canonicalFingerprint = email && outletDomain && normalizeIdentityText(fullName)
    ? contactFingerprintFromArtifact(artifactRecord, outletDomain)
    : email
      ? legacyContactFingerprintFromArtifact(artifactRecord)
      : validDigest(record.fingerprint)
        ? record.fingerprint
        : createHash("sha256").update(`direct-contact:${record.id}`).digest("hex");
  const descriptors = [identity("fingerprint", canonicalFingerprint, cryptoBox)];
  if (validDigest(record.fingerprint)) descriptors.push(identity("fingerprint", record.fingerprint, cryptoBox));
  if (email) {
    descriptors.push(identity("email", email, cryptoBox));
    descriptors.push(identity("fingerprint", legacyContactFingerprintFromArtifact(artifactRecord), cryptoBox));
  }
  if (outlet?.id && normalizeIdentityText(fullName)) {
    descriptors.push(identity("name_outlet", `${normalizeIdentityText(fullName)}\n${outlet.id}`, cryptoBox));
  }
  const show = normalizeIdentityText(record.showName);
  if (show && outlet?.id) descriptors.push(identity("show_outlet", `${show}\n${outlet.id}`, cryptoBox));
  const instagram = normalizeInstagramAccount(record.instagramUrl);
  if (instagram) descriptors.push(identity("instagram", instagram, cryptoBox));
  const linkedin = normalizeLinkedInAccount(record.linkedinUrl);
  if (linkedin) descriptors.push(identity("linkedin", linkedin, cryptoBox));
  const soundcloud = normalizeSoundCloudAccount(record.soundcloudUrl);
  if (soundcloud) descriptors.push(identity("soundcloud", soundcloud, cryptoBox));
  return Object.freeze({
    email,
    outletDomain,
    fullName,
    fingerprint: canonicalFingerprint,
    instagramUrl: canonicalInstagramUrl(record.instagramUrl),
    linkedinUrl: canonicalLinkedInUrl(record.linkedinUrl),
    soundcloudUrl: canonicalSoundCloudUrl(record.soundcloudUrl),
    descriptors: unique(descriptors)
  });
}

export function contactName(record) {
  const explicit = String(record?.name ?? "").trim();
  if (explicit) return explicit;
  return `${record?.firstName ?? ""} ${record?.lastName ?? ""}`.trim();
}

function identity(type, value, cryptoBox) {
  if (!value) return undefined;
  if (typeof cryptoBox?.privacyHash !== "function") throw new TypeError("Contact intake identity requires privacy hashing");
  return Object.freeze({
    type,
    hash: cryptoBox.privacyHash(`source-identity:${type}:${value}`)
  });
}

function unique(values) {
  return Object.freeze([...new Map(
    values.filter(Boolean).map((descriptor) => [`${descriptor.type}:${descriptor.hash}`, descriptor])
  ).values()].sort((left, right) => left.type.localeCompare(right.type) || left.hash.localeCompare(right.hash)));
}

function validDigest(value) {
  return /^[0-9a-f]{64}$/u.test(String(value ?? ""));
}

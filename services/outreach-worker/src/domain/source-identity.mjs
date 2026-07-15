import {
  contactFingerprintFromArtifact,
  legacyContactFingerprintFromArtifact,
  outletFingerprint
} from "./source-artifact.mjs";
import { normalizeDomain, normalizeEmail, normalizeIdentityText } from "./normalization.mjs";
import { normalizeLinkedInAccount, normalizeSoundCloudAccount } from "./social-profile.mjs";

export {
  canonicalLinkedInUrl,
  canonicalSoundCloudUrl,
  normalizeLinkedInAccount,
  normalizeSoundCloudAccount
} from "./social-profile.mjs";

export { normalizeIdentityText } from "./normalization.mjs";

export function outletIdentityDescriptors(sourceId, record, cryptoBox) {
  const domain = normalizeDomain(record.website);
  const descriptors = [
    identity("fingerprint", outletFingerprint(sourceId, record), cryptoBox)
  ];
  if (domain) {
    descriptors.push(identity("outlet_domain", domain, cryptoBox));
    descriptors.push(identity("name_outlet", `${normalizeIdentityText(record.name)}\n${domain}`, cryptoBox));
    if (record.type === "Radio Show") {
      descriptors.push(identity("show_outlet", `${normalizeIdentityText(record.name)}\n${domain}`, cryptoBox));
    }
  }
  return uniqueDescriptors(descriptors);
}

export function contactIdentityDescriptors(record, outletId, outletDomain, cryptoBox) {
  const email = normalizeEmail(record.email);
  const descriptors = [
    identity("email", email, cryptoBox),
    identity("fingerprint", contactFingerprintFromArtifact(record, outletDomain), cryptoBox),
    identity("fingerprint", legacyContactFingerprintFromArtifact(record), cryptoBox),
    identity("name_outlet", `${normalizeIdentityText(record.fullName)}\n${outletId}`, cryptoBox)
  ];
  const instagram = normalizeInstagramAccount(record.instagramUrl);
  if (instagram) descriptors.push(identity("instagram", instagram, cryptoBox));
  const linkedin = normalizeLinkedInAccount(record.linkedinUrl);
  if (linkedin) descriptors.push(identity("linkedin", linkedin, cryptoBox));
  const soundcloud = normalizeSoundCloudAccount(record.soundcloudUrl);
  if (soundcloud) descriptors.push(identity("soundcloud", soundcloud, cryptoBox));
  const show = normalizeIdentityText(record.showName);
  if (show) descriptors.push(identity("show_outlet", `${show}\n${outletId}`, cryptoBox));
  return uniqueDescriptors(descriptors);
}

export function normalizeInstagramAccount(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./u, "");
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || host !== "instagram.com" || segments.length !== 1) return undefined;
    const handle = segments[0].toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/u.test(handle)) return undefined;
    return handle;
  } catch {
    return undefined;
  }
}

export function canonicalInstagramUrl(value) {
  const handle = normalizeInstagramAccount(value);
  return handle ? `https://www.instagram.com/${handle}/` : undefined;
}

function identity(type, value, cryptoBox) {
  if (!value) return undefined;
  return Object.freeze({
    type,
    hash: cryptoBox.privacyHash(`source-identity:${type}:${value}`)
  });
}

function uniqueDescriptors(descriptors) {
  return Object.freeze([...new Map(
    descriptors.filter(Boolean).map((descriptor) => [`${descriptor.type}:${descriptor.hash}`, descriptor])
  ).values()].sort((left, right) => left.type.localeCompare(right.type) || left.hash.localeCompare(right.hash)));
}

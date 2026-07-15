import { createHash, timingSafeEqual } from "node:crypto";
import { normalizeDomain, normalizeEmail } from "./normalization.mjs";
import { canonicalizeSourceHttpsUrl } from "./source-url.mjs";

export const EVIDENCE_ATTESTATION_VERSION = "purpose-bound-evidence:v1";
export const DEFAULT_MAX_EVIDENCE_AGE_SECONDS = 7_776_000;

const ALLOWED_CONTACT_BASES = new Set([
  "Opt In",
  "Existing Relationship",
  "Explicit Submission Address"
]);
const PURPOSE_TYPE = new Map([
  ["Explicit Music Submission", "submission"],
  ["Promo Contact", "promo"],
  ["Press Contact", "press"],
  ["Explicit", "submission"],
  ["Promo Contact", "promo"],
  ["Press Contact", "press"]
]);
const POLICY_EVIDENCE_FIELDS = Object.freeze([
  "active_evidence", "why_relevant", "notes", "contact_evidence", "verification_notes",
  "submission_policy", "submission_status", "accepts_submissions", "accepts_music_submissions",
  "evidenceText", "sourceEvidence"
]);
const NO_SUBMISSIONS_PATTERNS = Object.freeze([
  /\bno\s+(?:unsolicited\s+)?(?:(?:music|track|demo|promo)\s+)?submissions\b/iu,
  /\b(?:do\s+not|does\s+not|don['’]?t|not\s+currently)\s+accept(?:s|ing)?\s+(?:(?:music|track|demo|promo)\s+)?submissions?\b/iu,
  /\bsubmissions?\s+(?:are\s+|is\s+)?(?:closed|disabled|not\s+accepted)\b/iu,
  /\b(?:do\s+not|don['’]?t|please\s+do\s+not)\s+(?:send|submit|email)\s+(?:us\s+|me\s+)?(?:music|tracks?|songs?|demos?|promos?)\b/iu,
  /\bunsolicited\s+(?:music|tracks?|songs?|demos?|promos?)\s+(?:is\s+|are\s+)?not\s+accepted\b/iu,
  /\bgeen\s+(?:muziek\s+)?inzendingen\b/iu,
  /\b(?:accepteert|accepteren)\s+geen\s+(?:muziek|inzendingen|demo['’]?s|promo['’]?s)\b/iu,
  /\bstuur\s+geen\s+(?:muziek|tracks?|demo['’]?s|promo['’]?s)\b/iu,
  /\bkeine\s+(?:musik\s+)?einsendungen\b/iu,
  /\bkeine\s+(?:musik|tracks?|demos?|promos?)\s+(?:senden|einsenden)\b/iu,
  /\b(?:n['’]accepte\s+pas|ne\s+pas\s+envoyer)\b[^.\n]{0,80}\b(?:soumissions?|musique|d[ée]mos?|promos?)\b/iu,
  /\b(?:no\s+acepta|no\s+enviar)\b[^.\n]{0,80}\b(?:env[ií]os?|m[uú]sica|demos?|promos?)\b/iu,
  /\b(?:n[aã]o\s+aceita|n[aã]o\s+enviar)\b[^.\n]{0,80}\b(?:submiss(?:[õo]es)|m[uú]sica|demos?|promos?)\b/iu
]);
const PURPOSE_EVIDENCE_PATTERNS = Object.freeze({
  submission: Object.freeze([
    /\b(?:music|track|song|demo|release)\s+submissions?\b/iu,
    /\bsubmit(?:ting)?\s+(?:your\s+|new\s+|unreleased\s+)?(?:music|tracks?|songs?|demos?|releases?)\b/iu,
    /\b(?:send|email)\s+(?:us\s+|me\s+|your\s+)?(?:music|tracks?|songs?|demos?|releases?)\b/iu,
    /\b(?:invite|invites|inviting|accept|accepts|accepting)\b[^.\n]{0,80}\b(?:music|tracks?|songs?|demos?|releases?)\b/iu,
    /\bunreleased\s+(?:music|tracks?|songs?)\b[^.\n]{0,80}\b(?:email|submit|send)\b/iu,
    /\b(?:lists?|publishes?)\s+(?:this\s+|the\s+|an?\s+)?(?:email\s+)?address\b[^.\n]{0,80}\b(?:unreleased\s+)?(?:music|tracks?|songs?|demos?)\b/iu
  ]),
  promo: Object.freeze([
    /\b(?:send|submit|email)\s+(?:us\s+|me\s+|your\s+)?promos?\b/iu,
    /\bpromo(?:tional)?\s+(?:music\s+)?(?:submissions?|contact|email|inquiries|enquiries)\b/iu,
    /\bpromos?\s+(?:are\s+)?(?:accepted|welcome|invited)\b/iu
  ]),
  press: Object.freeze([
    /\bpress\s+(?:contact|email|inquiries|enquiries|submissions?)\b/iu,
    /\bmedia\s+(?:contact|email|inquiries|enquiries)\b/iu,
    /\bpublicity\s+(?:contact|email|inquiries|enquiries)\b/iu
  ])
});

export function evaluateContactEvidence({
  entityId,
  entityVersion,
  email,
  purpose,
  basis,
  sourceUrl,
  evidenceText,
  capturedAt,
  expectedDomain,
  now = new Date(),
  maxAgeSeconds = DEFAULT_MAX_EVIDENCE_AGE_SECONDS,
  sourceKind = "direct_crm"
}) {
  const common = evaluateCommonEvidence({
    entityType: "MediaContact",
    entityId,
    entityVersion,
    routeIdentity: normalizeEmail(email),
    purpose,
    basis,
    sourceUrl,
    evidenceText,
    capturedAt,
    expectedDomain,
    now,
    maxAgeSeconds,
    sourceKind
  });
  const reasons = [...common.reasons];
  const purposeType = PURPOSE_TYPE.get(purpose);
  if (!purposeType) reasons.push("purpose_not_supported");
  if (!ALLOWED_CONTACT_BASES.has(basis)) reasons.push("basis_not_supported");
  if (purposeType && !hasPurposeEvidence(common.corpus, purposeType)) reasons.push("purpose_evidence_missing");
  return finishEvaluation(common, reasons, purposeType);
}

export function evaluateOutletEvidence({
  entityId,
  entityVersion,
  submissionPolicy,
  sourceUrl,
  evidenceText,
  capturedAt,
  expectedDomain,
  now = new Date(),
  maxAgeSeconds = DEFAULT_MAX_EVIDENCE_AGE_SECONDS,
  sourceKind = "direct_crm"
}) {
  const common = evaluateCommonEvidence({
    entityType: "MediaOutlet",
    entityId,
    entityVersion,
    routeIdentity: normalizeDomain(expectedDomain),
    purpose: submissionPolicy,
    basis: "Published Submission Route",
    sourceUrl,
    evidenceText,
    capturedAt,
    expectedDomain,
    now,
    maxAgeSeconds,
    sourceKind
  });
  const reasons = [...common.reasons];
  const purposeType = PURPOSE_TYPE.get(submissionPolicy);
  if (!purposeType) reasons.push("submission_policy_not_supported");
  if (purposeType && !hasPurposeEvidence(common.corpus, purposeType)) reasons.push("purpose_evidence_missing");
  return finishEvaluation(common, reasons, purposeType);
}

export function verifyEvidenceAttestation(evaluation, attestation) {
  if (!evaluation?.allowed) return Object.freeze({ verified: false, reason: "evidence_not_allowed" });
  if (!attestation || attestation.status !== "active") {
    return Object.freeze({ verified: false, reason: "attestation_missing_or_revoked" });
  }
  if (attestation.digestVersion !== EVIDENCE_ATTESTATION_VERSION) {
    return Object.freeze({ verified: false, reason: "attestation_version_mismatch" });
  }
  if (String(attestation.entityId ?? "") !== evaluation.attestation.entityId
      || String(attestation.entityType ?? "") !== evaluation.attestation.entityType
      || Number(attestation.entityVersion) !== evaluation.attestation.entityVersion
      || String(attestation.evidenceCapturedAt ?? "") !== evaluation.attestation.evidenceCapturedAt
      || String(attestation.purpose ?? "") !== evaluation.attestation.purpose
      || String(attestation.basis ?? "") !== evaluation.attestation.basis) {
    return Object.freeze({ verified: false, reason: "attestation_subject_mismatch" });
  }
  return safeDigestEqual(attestation.evidenceDigest, evaluation.digest)
    ? Object.freeze({ verified: true })
    : Object.freeze({ verified: false, reason: "attestation_digest_mismatch" });
}

export function hasNegativeSubmissionEvidence(record, evidenceText) {
  const accepts = record?.accepts_submissions ?? record?.accepts_music_submissions;
  if (accepts === false || /^(?:0|false|no|closed|blocked)$/iu.test(String(accepts ?? "").trim())) return true;
  return NO_SUBMISSIONS_PATTERNS.some((pattern) => pattern.test(policyEvidenceCorpus(record, evidenceText)));
}

export function policyEvidenceCorpus(record, evidenceText) {
  const values = [evidenceText];
  for (const field of POLICY_EVIDENCE_FIELDS) values.push(record?.[field]);
  return values
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim().normalize("NFKC"))
    .join("\n");
}

export function hasPurposeEvidence(corpus, type) {
  const patterns = PURPOSE_EVIDENCE_PATTERNS[type];
  return Boolean(patterns?.some((pattern) => pattern.test(String(corpus ?? ""))));
}

function evaluateCommonEvidence({
  entityType,
  entityId,
  entityVersion,
  routeIdentity,
  purpose,
  basis,
  sourceUrl,
  evidenceText,
  capturedAt,
  expectedDomain,
  now,
  maxAgeSeconds,
  sourceKind
}) {
  const reasons = [];
  const corpus = policyEvidenceCorpus({}, evidenceText);
  const denied = purpose === "Blocked" || basis === "Blocked" || hasNegativeSubmissionEvidence({}, corpus);
  if (denied) reasons.push("negative_evidence");
  const normalizedText = typeof evidenceText === "string" ? evidenceText.trim().normalize("NFKC") : "";
  if (normalizedText.length < 10 || normalizedText.length > 2_000) reasons.push("evidence_text_invalid");
  let canonicalUrl;
  try {
    canonicalUrl = canonicalizeSourceHttpsUrl(sourceUrl);
  } catch {
    reasons.push("evidence_url_invalid");
  }
  const parsedCapturedAt = Date.parse(String(capturedAt ?? ""));
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(String(now));
  if (!Number.isFinite(parsedCapturedAt)
      || !Number.isFinite(nowMs)
      || !Number.isSafeInteger(maxAgeSeconds)
      || maxAgeSeconds < 1
      || parsedCapturedAt < nowMs - maxAgeSeconds * 1_000
      || parsedCapturedAt > nowMs + 300_000) {
    reasons.push("evidence_stale_or_future");
  }
  const normalizedExpectedDomain = normalizeDomain(expectedDomain);
  if (canonicalUrl && normalizedExpectedDomain && !domainMatches(new URL(canonicalUrl).hostname, normalizedExpectedDomain)) {
    reasons.push("evidence_domain_mismatch");
  }
  if (!entityId || !Number.isInteger(Number(entityVersion)) || Number(entityVersion) < 0) {
    reasons.push("entity_version_missing");
  }
  return {
    denied,
    reasons,
    corpus,
    canonicalUrl,
    normalizedText,
    capturedAt: Number.isFinite(parsedCapturedAt) ? new Date(parsedCapturedAt).toISOString() : undefined,
    entityType,
    entityId: String(entityId ?? ""),
    entityVersion: Number(entityVersion),
    routeIdentity: String(routeIdentity ?? ""),
    purpose: String(purpose ?? ""),
    basis: String(basis ?? ""),
    sourceKind
  };
}

function finishEvaluation(common, reasons, purposeType) {
  const uniqueReasons = Object.freeze([...new Set(reasons)]);
  const allowed = !common.denied && uniqueReasons.length === 0;
  const attestation = Object.freeze({
    digestVersion: EVIDENCE_ATTESTATION_VERSION,
    entityType: common.entityType,
    entityId: common.entityId,
    entityVersion: common.entityVersion,
    evidenceCapturedAt: common.capturedAt ?? "",
    purpose: common.purpose,
    basis: common.basis,
    sourceUrl: common.canonicalUrl ?? "",
    evidenceTextDigest: createHash("sha256").update(common.normalizedText).digest("hex"),
    routeIdentityDigest: createHash("sha256").update(common.routeIdentity).digest("hex"),
    purposeType: purposeType ?? "unsupported"
  });
  const digest = createHash("sha256").update(stableJson(attestation)).digest("hex");
  return Object.freeze({
    allowed,
    denied: common.denied,
    reasons: uniqueReasons,
    purposeType,
    digest,
    attestation
  });
}

function domainMatches(actual, expected) {
  const normalizedActual = normalizeDomain(actual);
  return normalizedActual === expected || normalizedActual?.endsWith(`.${expected}`);
}

function stableJson(value) {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))));
}

function safeDigestEqual(actual, expected) {
  if (!/^[0-9a-f]{64}$/u.test(String(actual ?? "")) || !/^[0-9a-f]{64}$/u.test(String(expected ?? ""))) return false;
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

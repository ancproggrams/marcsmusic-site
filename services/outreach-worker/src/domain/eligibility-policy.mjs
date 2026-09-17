import {
  canonicalCountry,
  isSupportedCopyLanguage,
  resolveRecipientTimezone
} from "./recipient-locale.mjs";
import {
  evaluateContactEvidence,
  evaluateOutletEvidence,
  verifyEvidenceAttestation
} from "./evidence-policy.mjs";
import { emailValidationAllowsOutreach } from "./email-validation-policy.mjs";

const ALLOWED_CONTACT_PURPOSES = new Set(["Explicit Music Submission", "Promo Contact", "Press Contact"]);
const ALLOWED_CONTACT_BASES = new Set(["Opt In", "Existing Relationship", "Explicit Submission Address"]);
const BLOCKED_SUBMISSION_POLICIES = new Set(["No Submissions", "Blocked"]);

export function evaluateEligibility({
  contact,
  outlet,
  release,
  activeSequence = false,
  cooldownUntil,
  now = new Date(),
  suppressed = false,
  genreDenied = false,
  maxEvidenceAgeSeconds
}) {
  const reasons = [];
  const block = (code, detail) => reasons.push(Object.freeze({ code, detail }));

  if (!contact.email) block("email_missing_or_invalid", "A normalized valid email address is required.");
  if (!isSupportedCopyLanguage(contact.preferredLanguage)) {
    block("preferred_language_missing_or_unsupported", "A supported explicit preferred language is required.");
  }
  if (!["Ready for Matching", "Active"].includes(contact.status)) block("contact_status_not_eligible", `Contact status ${contact.status} is not eligible.`);
  if (contact.doNotContact) block("contact_do_not_contact", "Contact is manually blocked.");
  if (contact.optedOut) block("contact_opted_out", "Contact opted out.");
  if (contact.hardBounced) block("contact_hard_bounced", "Contact hard bounced.");
  if (suppressed) block("suppression_match", "A deny-wins suppression record exists.");
  if (genreDenied || intersects(release?.genres, contact.rejectedGenres)) {
    block("release_genre_rejected", "The contact previously rejected at least one canonical release genre.");
  }
  if (!emailValidationAllowsOutreach(contact.emailValidationStatus)) {
    block("email_not_validated", "Only an exact Valid email validation status may be used for outreach; Risky, Invalid, Unknown and future statuses are never usable.");
  }
  if (!ALLOWED_CONTACT_PURPOSES.has(contact.contactPurpose)) block("contact_purpose_not_allowed", `Purpose ${contact.contactPurpose} is not eligible.`);
  if (!ALLOWED_CONTACT_BASES.has(contact.contactBasis)) block("contact_basis_not_allowed", `Contact basis ${contact.contactBasis} is not eligible.`);
  if (!contact.contactSourceUrl) block("source_url_missing", "Evidence source URL is required.");
  if (!contact.contactEvidence) block("contact_evidence_missing", "Evidence text is required.");
  const contactEvidence = evaluateContactEvidence({
    entityId: contact.id,
    entityVersion: contact.versionNumber,
    email: contact.email,
    purpose: contact.contactPurpose,
    basis: contact.contactBasis,
    sourceUrl: contact.contactSourceUrl,
    evidenceText: contact.contactEvidence,
    capturedAt: contact.proofCapturedAt,
    ...(contact.evidenceAttestation?.sourceKind === "direct_crm"
      ? { expectedDomain: outlet?.domain ?? outlet?.website }
      : {}),
    now,
    ...(maxEvidenceAgeSeconds ? { maxAgeSeconds: maxEvidenceAgeSeconds } : {})
  });
  const contactAttestation = verifyEvidenceAttestation(contactEvidence, contact.evidenceAttestation);
  if (contactEvidence.denied) block("contact_negative_evidence", "Negative contact evidence always blocks outreach.");
  if (!contact.evidenceAttestation?.originCompleted || !contactAttestation.verified) {
    block("contact_evidence_not_attested", `Contact evidence attestation failed: ${contactAttestation.reason ?? "origin_incomplete"}.`);
  }
  if (!outlet || outlet.activityStatus !== "Active") block("outlet_not_active", "Outlet must be active.");
  if (outlet && !canonicalCountry(outlet.country)) {
    block("outlet_country_missing_or_unsupported", "Outlet country must be a supported canonical ISO 3166-1 alpha-2 country.");
  }
  if (outlet && !resolveRecipientTimezone({ contactTimezone: contact.timezone, outletTimezone: outlet.timezone })) {
    block("recipient_timezone_missing_or_invalid", "A valid recipient IANA timezone is required.");
  }
  if (outlet && BLOCKED_SUBMISSION_POLICIES.has(outlet.submissionPolicy)) block("outlet_blocks_submissions", "Outlet blocks submissions.");
  if (outlet && !outlet.acceptsEmail) block("outlet_email_not_accepted", "Outlet does not accept email submissions.");
  if (outlet) {
    const outletEvidence = evaluateOutletEvidence({
      entityId: outlet.id,
      entityVersion: outlet.versionNumber,
      submissionPolicy: outlet.submissionPolicy,
      sourceUrl: outlet.sourceUrl,
      evidenceText: outlet.submissionEvidence,
      capturedAt: outlet.lastValidatedAt,
      ...(outlet.evidenceAttestation?.sourceKind === "direct_crm"
        ? { expectedDomain: outlet.domain ?? outlet.website }
        : {}),
      now,
      ...(maxEvidenceAgeSeconds ? { maxAgeSeconds: maxEvidenceAgeSeconds } : {})
    });
    const outletAttestation = verifyEvidenceAttestation(outletEvidence, outlet.evidenceAttestation);
    if (outletEvidence.denied) block("outlet_negative_evidence", "Negative outlet evidence always blocks outreach.");
    if (!outlet.evidenceAttestation?.originCompleted || !outletAttestation.verified) {
      block("outlet_evidence_not_attested", `Outlet evidence attestation failed: ${outletAttestation.reason ?? "origin_incomplete"}.`);
    }
  }
  if (activeSequence) block("active_sequence_exists", "Only one active sequence per contact is allowed.");
  if (cooldownUntil && Date.parse(cooldownUntil) > now.getTime()) block("cooldown_active", `Cooldown is active until ${cooldownUntil}.`);
  if (!release || release.status !== "Active") block("release_not_active", "Release must be active.");
  if (release?.campaignStartDate && Date.parse(release.campaignStartDate) > now.getTime()) block("campaign_not_started", "Campaign start date is in the future.");
  if (release?.campaignEndDate && Date.parse(release.campaignEndDate) < now.getTime()) block("campaign_ended", "Campaign end date has passed.");
  if (!release?.epkUrl && !release?.privateStreamUrl) block("release_link_missing", "An EPK or private stream URL is required.");

  return Object.freeze({ eligible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

function intersects(left = [], right = []) {
  const values = new Set((Array.isArray(right) ? right : []).map((value) => String(value).trim().toLowerCase()));
  return (Array.isArray(left) ? left : []).some((value) => values.has(String(value).trim().toLowerCase()));
}

export function isAllowedContactPurpose(value) {
  return ALLOWED_CONTACT_PURPOSES.has(value);
}

export function isAllowedContactBasis(value) {
  return ALLOWED_CONTACT_BASES.has(value);
}

import test from "node:test";
import assert from "node:assert/strict";

import { evaluateEligibility, isAllowedContactPurpose } from "../src/domain/eligibility-policy.mjs";
import { evaluateContactEvidence, evaluateOutletEvidence } from "../src/domain/evidence-policy.mjs";

const NOW = new Date("2026-07-15T10:00:00.000Z");

function validInput() {
  const input = {
    contact: {
      id: "contact-1",
      versionNumber: 7,
      email: "music@example.test",
      preferredLanguage: "en",
      timezone: "Europe/Amsterdam",
      status: "Active",
      doNotContact: false,
      optedOut: false,
      hardBounced: false,
      emailValidationStatus: "Valid",
      contactPurpose: "Explicit Music Submission",
      contactBasis: "Explicit Submission Address",
      contactSourceUrl: "https://station.example/submissions",
      contactEvidence: "The station publishes this address for music submissions.",
      proofCapturedAt: "2026-07-14T10:00:00.000Z"
    },
    outlet: {
      id: "outlet-1",
      versionNumber: 4,
      website: "https://station.example/",
      domain: "station.example",
      country: "NL",
      timezone: "Europe/Amsterdam",
      activityStatus: "Active",
      submissionPolicy: "Explicit",
      acceptsEmail: true,
      sourceUrl: "https://station.example/submissions",
      submissionEvidence: "The station accepts music submissions by email.",
      lastValidatedAt: "2026-07-14T10:00:00.000Z"
    },
    release: {
      status: "Active",
      campaignStartDate: "2026-07-01",
      campaignEndDate: "2026-08-01",
      epkUrl: "https://artist.example/epk"
    },
    now: NOW,
    activeSequence: false,
    suppressed: false
  };
  const contactEvidence = evaluateContactEvidence({
    entityId: input.contact.id,
    entityVersion: input.contact.versionNumber,
    email: input.contact.email,
    purpose: input.contact.contactPurpose,
    basis: input.contact.contactBasis,
    sourceUrl: input.contact.contactSourceUrl,
    evidenceText: input.contact.contactEvidence,
    capturedAt: input.contact.proofCapturedAt,
    now: NOW,
    sourceKind: "signed_source"
  });
  const outletEvidence = evaluateOutletEvidence({
    entityId: input.outlet.id,
    entityVersion: input.outlet.versionNumber,
    submissionPolicy: input.outlet.submissionPolicy,
    sourceUrl: input.outlet.sourceUrl,
    evidenceText: input.outlet.submissionEvidence,
    capturedAt: input.outlet.lastValidatedAt,
    now: NOW,
    sourceKind: "signed_source"
  });
  input.contact.evidenceAttestation = attestation(contactEvidence);
  input.outlet.evidenceAttestation = attestation(outletEvidence);
  return input;
}

test("an evidence-backed, validated contact is eligible", () => {
  const result = evaluateEligibility(validInput());

  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.reasons), true);
});

const gateCases = [
  ["missing email", (input) => delete input.contact.email, "email_missing_or_invalid"],
  ["missing preferred language", (input) => delete input.contact.preferredLanguage, "preferred_language_missing_or_unsupported"],
  ["unsupported preferred language", (input) => { input.contact.preferredLanguage = "eo"; }, "preferred_language_missing_or_unsupported"],
  ["blocked contact status", (input) => { input.contact.status = "Blocked"; }, "contact_status_not_eligible"],
  ["manual do-not-contact", (input) => { input.contact.doNotContact = true; }, "contact_do_not_contact"],
  ["opt-out", (input) => { input.contact.optedOut = true; }, "contact_opted_out"],
  ["hard bounce", (input) => { input.contact.hardBounced = true; }, "contact_hard_bounced"],
  ["deny-wins suppression", (input) => { input.suppressed = true; }, "suppression_match"],
  ["persisted contact genre rejection", (input) => {
    input.release.genres = ["Indie"];
    input.contact.rejectedGenres = ["INDIE"];
  }, "release_genre_rejected"],
  ["durable cross-store genre denial", (input) => {
    input.release.genres = ["Indie"];
    input.genreDenied = true;
  }, "release_genre_rejected"],
  ["unvalidated email", (input) => { input.contact.emailValidationStatus = "Risky"; }, "email_not_validated"],
  ["unsupported contact purpose", (input) => { input.contact.contactPurpose = "General Contact"; }, "contact_purpose_not_allowed"],
  ["unsupported contact basis", (input) => { input.contact.contactBasis = "Unknown"; }, "contact_basis_not_allowed"],
  ["missing source URL", (input) => delete input.contact.contactSourceUrl, "source_url_missing"],
  ["missing evidence text", (input) => delete input.contact.contactEvidence, "contact_evidence_missing"],
  ["inactive outlet", (input) => { input.outlet.activityStatus = "Inactive"; }, "outlet_not_active"],
  ["unknown outlet country", (input) => { input.outlet.country = "ZZ"; }, "outlet_country_missing_or_unsupported"],
  ["missing recipient timezone", (input) => { delete input.contact.timezone; delete input.outlet.timezone; }, "recipient_timezone_missing_or_invalid"],
  ["fixed-offset recipient timezone", (input) => { input.contact.timezone = "UTC+2"; delete input.outlet.timezone; }, "recipient_timezone_missing_or_invalid"],
  ["no-submissions policy", (input) => { input.outlet.submissionPolicy = "No Submissions"; }, "outlet_blocks_submissions"],
  ["email submissions disabled", (input) => { input.outlet.acceptsEmail = false; }, "outlet_email_not_accepted"],
  ["another active sequence", (input) => { input.activeSequence = true; }, "active_sequence_exists"],
  ["contact cooldown", (input) => { input.cooldownUntil = "2026-07-16T00:00:00.000Z"; }, "cooldown_active"],
  ["inactive release", (input) => { input.release.status = "Paused"; }, "release_not_active"],
  ["future campaign", (input) => { input.release.campaignStartDate = "2026-07-16"; }, "campaign_not_started"],
  ["ended campaign", (input) => { input.release.campaignEndDate = "2026-07-14"; }, "campaign_ended"],
  ["missing listening link", (input) => delete input.release.epkUrl, "release_link_missing"]
];

for (const [label, mutate, expectedCode] of gateCases) {
  test(`hard gate blocks ${label}`, () => {
    const input = validInput();
    mutate(input);

    const result = evaluateEligibility(input);

    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some(({ code }) => code === expectedCode), `${expectedCode} was not reported`);
  });
}

test("the policy reports every applicable denial for auditability", () => {
  const input = validInput();
  input.contact.email = undefined;
  input.contact.optedOut = true;
  input.contact.contactEvidence = undefined;
  input.outlet.acceptsEmail = false;

  const result = evaluateEligibility(input);

  assert.deepEqual(
    result.reasons.map(({ code }) => code),
    ["email_missing_or_invalid", "contact_opted_out", "contact_evidence_missing", "contact_evidence_not_attested", "outlet_email_not_accepted"]
  );
});

test("only explicitly approved contact purposes pass the purpose gate", () => {
  assert.equal(isAllowedContactPurpose("Explicit Music Submission"), true);
  assert.equal(isAllowedContactPurpose("Promo Contact"), true);
  assert.equal(isAllowedContactPurpose("Press Contact"), true);
  assert.equal(isAllowedContactPurpose("General Contact"), false);
  assert.equal(isAllowedContactPurpose("Unknown"), false);
});

function attestation(evaluation) {
  return {
    ...evaluation.attestation,
    evidenceDigest: evaluation.digest,
    status: "active",
    sourceKind: "signed_source",
    originCompleted: true
  };
}

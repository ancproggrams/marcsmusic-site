import { createHash } from "node:crypto";
import { ApplicationError, errorCode } from "../errors.mjs";
import {
  directContactIdentity,
  directOutletIdentity
} from "../domain/contact-intake-identity.mjs";
import {
  evaluateContactEvidence,
  evaluateOutletEvidence,
  verifyEvidenceAttestation
} from "../domain/evidence-policy.mjs";
import {
  normalizeDomain,
  normalizeEmail,
  normalizeIdentityText
} from "../domain/normalization.mjs";
import {
  normalizeInstagramAccount,
  normalizeLinkedInAccount,
  normalizeSoundCloudAccount
} from "../domain/source-identity.mjs";

const CONTACT_SELECT = Object.freeze([
  "id", "versionNumber", "createdAt", "modifiedAt", "name", "firstName", "lastName", "showName",
  "emailAddress", "role", "instagramUrl", "linkedinUrl", "soundcloudUrl", "preferredLanguage", "timezone",
  "contactSourceUrl", "contactEvidence", "contactPurpose", "contactBasis", "proofUrl", "proofText",
  "proofCapturedAt", "lastValidatedAt", "emailValidationStatus", "smtpValidationStatus", "status", "fingerprint",
  "mediaOutletId", "doNotContact", "optedOut", "hardBounced", "duplicateOfId"
]);
const OUTLET_SELECT = Object.freeze([
  "id", "versionNumber", "createdAt", "modifiedAt", "name", "type", "website", "normalizedDomain", "fingerprint",
  "country", "language", "timezone", "genres", "subGenres", "formatGenres", "submissionPolicy", "submissionUrl",
  "submissionEvidence", "acceptsEmail", "acceptsForms", "acceptsUnreleased", "activityStatus", "lastValidatedAt",
  "sourceUrl", "qualityScore"
]);
const MAX_CANDIDATES = 1_000;

export function createContactIntakeService({
  espocrm,
  intakeRepository,
  workflowRepository,
  emailValidationProvider,
  cryptoBox,
  config,
  logger,
  metrics
}) {
  if (!espocrm || !intakeRepository || !workflowRepository || !emailValidationProvider || !cryptoBox) {
    throw new TypeError("Contact intake service dependencies are required");
  }
  const leaseSeconds = Math.min(config.sourceIngestion?.processingLeaseSeconds ?? 120, 3_600);
  const maxEvidenceAgeSeconds = config.sourceIngestion?.maxEvidenceAgeSeconds;

  async function processContact(contactId, options = {}) {
    return intakeRepository.withEntityFence("MediaContact", contactId, async () => {
      const input = await readEntity("MediaContact", contactId, CONTACT_SELECT);
      const revisionDigest = crmRevisionDigest("MediaContact", input);
      const receipt = await intakeRepository.beginIntake({
        entityType: "MediaContact",
        entityId: contactId,
        revisionDigest,
        leaseSeconds
      });
      if (receipt.completed) {
        const replay = await hydrateContactResult(receipt.result, { replayed: true });
        await transferContactSuppressions(replay.record, [replay.record], replay.denied);
        return replay;
      }
      if (!receipt.claimed) throw intakeInProgress("MediaContact", contactId);
      const lease = receipt.lease;
      let identityClaim;
      try {
        if (input.duplicateOfId) {
          const result = Object.freeze({
            entityType: "MediaContact",
            entityId: contactId,
            canonicalId: input.duplicateOfId,
            duplicate: true,
            status: "Blocked"
          });
          await intakeRepository.completeIntake(lease, result);
          return hydrateContactResult(result);
        }

        const initialCandidates = await collectContactCandidates(input);
        const outlets = await loadCandidateOutlets(initialCandidates);
        const identities = unionDescriptors(initialCandidates.map((candidate) =>
          directContactIdentity(candidate, outlets.get(candidate.mediaOutletId), cryptoBox).descriptors
        ));
        const resolution = await intakeRepository.beginIdentityResolution({
          entityType: "MediaContact",
          identities,
          leaseSeconds
        });
        if (!resolution.claimed) throw identityInProgress("MediaContact");
        identityClaim = resolution.claim;
        const candidates = await includeBoundCandidate(
          "MediaContact",
          initialCandidates,
          resolution.boundCrmEntityId,
          CONTACT_SELECT
        );
        if (candidates.some(({ mediaOutletId }) => mediaOutletId && !outlets.has(mediaOutletId))) {
          for (const [outletId, outlet] of await loadCandidateOutlets(candidates)) outlets.set(outletId, outlet);
        }
        for (const outletId of new Set(candidates.map(({ mediaOutletId }) => mediaOutletId).filter(Boolean))) {
          if (!outlets.get(outletId)?.intakeResult) {
            const intakeResult = await processOutlet(outletId, { enqueueMatch: false });
            outlets.set(outletId, { ...intakeResult.record, intakeResult });
          }
        }
        const canonical = chooseCanonical(candidates, resolution.boundCrmEntityId);
        const result = await mergeContacts({
          input,
          candidates,
          canonical,
          outlets,
          identities,
          resolution,
          lease,
          revisionDigest,
          now: options.now ?? new Date()
        });
        identityClaim = undefined;
        if (options.enqueueMatch !== false) await enqueueAfterIntake("MediaContact", result.canonicalId, result.entityVersion);
        return result;
      } catch (error) {
        if (identityClaim) await intakeRepository.abandonIdentityResolution(identityClaim).catch(() => false);
        await intakeRepository.failIntake(lease, errorCode(error)).catch(() => false);
        throw error;
      }
    });
  }

  /**
   * Validate one CRM address without running the intake/merge pipeline.
   *
   * This path is deliberately separate from processContact: historical
   * Mailgun contacts are imported with doNotContact=true and must still be
   * technically validated, but a validation result may never clear a
   * suppression, consent, purpose, basis, or evidence gate.
   */
  async function validateContactEmail(contactId) {
    return intakeRepository.withEntityFence("MediaContact", contactId, async () => {
      const input = await readEntity("MediaContact", contactId, CONTACT_SELECT);
      const revisionDigest = crmRevisionDigest("MediaContact", input);
      const email = normalizeEmail(input.emailAddress);
      const validation = email
        ? await validateEmail(email, `mailgun-contact:${contactId}:${revisionDigest}`)
        : Object.freeze({ status: "Unknown", method: "not_present" });
      const payload = compactChanged(input, {
        emailValidationStatus: validation.status,
        ...(validation.method === "smtp" ? { smtpValidationStatus: validation.status } : {}),
        ...(validation.checkedAt ? { lastValidatedAt: toEspoDateTime(validation.checkedAt) } : {})
      });
      const record = await updateIfChanged("MediaContact", input, payload, CONTACT_SELECT);
      metrics?.increment("outreach_email_validation_total", {
        provider: validation.method,
        outcome: validation.status
      });
      logger?.info({
        contactId,
        provider: validation.method,
        validationStatus: validation.status,
        doNotContact: Boolean(record.doNotContact)
      }, "CRM contact email validation completed");
      return Object.freeze({
        entityType: "MediaContact",
        entityId: contactId,
        validationStatus: validation.status,
        method: validation.method,
        checkedAt: validation.checkedAt,
        record: Object.freeze(record),
        outreachEligible: false
      });
    });
  }

  async function processOutlet(outletId, options = {}) {
    return intakeRepository.withEntityFence("MediaOutlet", outletId, async () => {
      const input = await readEntity("MediaOutlet", outletId, OUTLET_SELECT);
      const revisionDigest = crmRevisionDigest("MediaOutlet", input);
      const receipt = await intakeRepository.beginIntake({
        entityType: "MediaOutlet",
        entityId: outletId,
        revisionDigest,
        leaseSeconds
      });
      if (receipt.completed) {
        const replay = await hydrateOutletResult(receipt.result, { replayed: true });
        await transferOutletSuppressions(replay.record, [replay.record], replay.denied);
        return replay;
      }
      if (!receipt.claimed) throw intakeInProgress("MediaOutlet", outletId);
      const lease = receipt.lease;
      let identityClaim;
      try {
        const initialCandidates = await collectOutletCandidates(input);
        const identities = unionDescriptors(initialCandidates.map((candidate) =>
          directOutletIdentity(candidate, cryptoBox).descriptors
        ));
        const resolution = await intakeRepository.beginIdentityResolution({
          entityType: "MediaOutlet",
          identities,
          leaseSeconds
        });
        if (!resolution.claimed) throw identityInProgress("MediaOutlet");
        identityClaim = resolution.claim;
        const candidates = await includeBoundCandidate(
          "MediaOutlet",
          initialCandidates,
          resolution.boundCrmEntityId,
          OUTLET_SELECT
        );
        const canonical = chooseCanonical(candidates, resolution.boundCrmEntityId);
        const result = await mergeOutlets({
          input,
          candidates,
          canonical,
          identities,
          resolution,
          lease,
          revisionDigest,
          now: options.now ?? new Date()
        });
        identityClaim = undefined;
        if (options.enqueueMatch !== false) await enqueueAfterIntake("MediaOutlet", result.canonicalId, result.entityVersion);
        return result;
      } catch (error) {
        if (identityClaim) await intakeRepository.abandonIdentityResolution(identityClaim).catch(() => false);
        await intakeRepository.failIntake(lease, errorCode(error)).catch(() => false);
        throw error;
      }
    });
  }

  async function mergeContacts({
    input,
    candidates,
    canonical,
    outlets,
    identities,
    resolution,
    lease,
    revisionDigest,
    now
  }) {
    const evidence = await Promise.all(candidates.map(async (record) => ({
      record,
      evaluation: await evaluateContactRecord(record, outlets.get(record.mediaOutletId), now)
    })));
    const winner = newestAllowed(evidence);
    const localDenied = evidence.some(({ record, evaluation }) => contactDenied(record) || evaluation.denied);
    const suppressionSubjects = contactSuppressionSubjects(candidates, outlets);
    const merged = await intakeRepository.withSuppressionFence(suppressionSubjects, async () => {
      const suppressed = await hasActiveSuppression(suppressionSubjects);
      const denied = localDenied || suppressed;
      let validation = Object.freeze({ status: "Unknown", method: "unknown" });
      if (!denied && winner) {
        const email = normalizeEmail(winner.record.emailAddress);
        if (email) validation = await validateEmail(email, `direct-crm:${input.id}:${revisionDigest}`);
      }
      const outlet = winner ? outlets.get(winner.record.mediaOutletId) : outlets.get(canonical.mediaOutletId);
      const outletReady = Boolean(outlet?.intakeResult?.attested)
        && outlet?.activityStatus === "Active"
        && !["No Submissions", "Blocked"].includes(outlet?.submissionPolicy)
        && outlet?.acceptsEmail === true;
      const ready = !denied && Boolean(winner) && validation.status === "Valid" && outletReady;
      const source = winner?.record;
      const identity = directContactIdentity(source ?? canonical, outlet, cryptoBox);
      const payload = compactChanged(canonical, {
        ...(source ? {
          name: source.name,
          firstName: source.firstName,
          lastName: source.lastName,
          showName: source.showName,
          role: source.role,
          emailAddress: validation.status === "Valid" ? normalizeEmail(source.emailAddress) : canonical.emailAddress,
          instagramUrl: identity.instagramUrl,
          linkedinUrl: identity.linkedinUrl,
          soundcloudUrl: identity.soundcloudUrl,
          preferredLanguage: source.preferredLanguage,
          timezone: source.timezone,
          mediaOutletId: source.mediaOutletId,
          contactSourceUrl: source.contactSourceUrl ?? source.proofUrl,
          contactEvidence: source.contactEvidence ?? source.proofText,
          contactPurpose: source.contactPurpose,
          contactBasis: source.contactBasis,
          proofUrl: source.proofUrl ?? source.contactSourceUrl,
          proofText: source.proofText ?? source.contactEvidence,
          proofCapturedAt: source.proofCapturedAt
        } : {}),
        fingerprint: identity.fingerprint,
        emailValidationStatus: denied ? canonical.emailValidationStatus ?? "Unknown" : validation.status,
        smtpValidationStatus: denied
          ? canonical.smtpValidationStatus ?? "Unknown"
          : validation.method === "smtp" ? validation.status : "Unknown",
        ...(!denied && validation.checkedAt ? { lastValidatedAt: toEspoDateTime(validation.checkedAt) } : {}),
        status: denied ? "Blocked" : canonical.status === "Inactive" ? "Inactive" : ready ? "Ready for Matching" : "Needs Validation",
        doNotContact: Boolean(candidates.some(({ doNotContact }) => doNotContact) || suppressed),
        optedOut: candidates.some(({ optedOut }) => optedOut),
        hardBounced: candidates.some(({ hardBounced }) => hardBounced),
        ...(candidates.some(({ contactPurpose }) => contactPurpose === "Blocked") ? { contactPurpose: "Blocked" } : {}),
        ...(candidates.some(({ contactBasis }) => contactBasis === "Blocked") ? { contactBasis: "Blocked" } : {})
      });
      await renewBoth(lease, resolution.claim);
      const updatedCanonical = await updateIfChanged("MediaContact", canonical, payload, CONTACT_SELECT);
      const acceptedIdentities = identityAliasesToAccept(identities, {
        denied,
        evidenceAllowed: Boolean(winner),
        emailValid: validation.status === "Valid"
      });
      await intakeRepository.completeIdentityResolution({
        ...resolution.claim,
        crmEntityId: updatedCanonical.id,
        sourceId: "direct-crm",
        externalId: input.id,
        evidenceCapturedAt: evidenceTimestamp(winner?.evaluation, input.modifiedAt),
        evidenceVerified: acceptedIdentities.length > 0,
        acceptedIdentities
      });

      let attested = false;
      if (denied) {
        await intakeRepository.revokeEvidenceAttestation({
          entityType: "MediaContact",
          entityId: updatedCanonical.id,
          entityVersion: updatedCanonical.versionNumber,
          revisionDigest,
          reason: suppressed ? "active_suppression" : "negative_contact_evidence"
        });
      } else if (ready) {
        const finalOutlet = outlets.get(updatedCanonical.mediaOutletId) ?? outlet;
        const finalEvaluation = directContactEvaluation(updatedCanonical, finalOutlet, now, "direct_crm");
        if (finalEvaluation.allowed) {
          attested = await intakeRepository.putEvidenceAttestation({
            evaluation: finalEvaluation,
            origin: { sourceKind: "direct_crm", entityId: input.id, revisionDigest }
          });
        }
      } else {
        await intakeRepository.invalidateEvidenceAttestation({
          entityType: "MediaContact",
          entityId: updatedCanonical.id,
          entityVersion: updatedCanonical.versionNumber,
          revisionDigest,
          reason: "validation_incomplete"
        });
      }

      const duplicates = candidates.filter(({ id }) => id !== updatedCanonical.id);
      for (const duplicate of duplicates) await tombstoneContact(duplicate, updatedCanonical.id);
      const receiptResult = Object.freeze({
        entityType: "MediaContact",
        entityId: input.id,
        canonicalId: updatedCanonical.id,
        entityVersion: updatedCanonical.versionNumber,
        status: payload.status ?? updatedCanonical.status,
        duplicateCount: duplicates.length,
        attested,
        denied
      });
      await intakeRepository.completeIntake(lease, receiptResult);
      const hydrated = await hydrateContactResult(receiptResult);
      metrics?.increment("outreach_direct_crm_intake_total", {
        entityType: "MediaContact",
        outcome: hydrated.attested ? "ready" : hydrated.record.status === "Blocked" ? "blocked" : "held"
      });
      logger?.info({ contactId: input.id, canonicalId: updatedCanonical.id, duplicateCount: duplicates.length, attested: hydrated.attested }, "direct CRM contact intake completed");
      return hydrated;
    });
    await transferContactSuppressions(merged.record, candidates, merged.denied);
    for (const duplicate of candidates.filter(({ id }) => id !== merged.canonicalId)) {
      await workflowRepository.suppress({
        subjectType: "contact", subject: duplicate.id, reason: "merged_duplicate_contact", source: "direct_crm_intake"
      });
    }
    return merged;
  }

  async function mergeOutlets({ input, candidates, canonical, identities, resolution, lease, revisionDigest, now }) {
    const evidence = await Promise.all(candidates.map(async (record) => ({
      record,
      evaluation: await evaluateOutletRecord(record, now)
    })));
    const winner = newestAllowed(evidence);
    const localDenied = evidence.some(({ record, evaluation }) => outletDenied(record) || evaluation.denied);
    const suppressionSubjects = outletSuppressionSubjects(candidates);
    const merged = await intakeRepository.withSuppressionFence(suppressionSubjects, async () => {
      const suppressed = await hasActiveSuppression(suppressionSubjects);
      const denied = localDenied || suppressed;
      const source = winner?.record;
      const identity = directOutletIdentity(source ?? canonical, cryptoBox);
      const validRoute = Boolean(winner) && !denied;
      const payload = compactChanged(canonical, {
        ...(source ? {
          name: source.name,
          type: source.type,
          website: source.website,
          normalizedDomain: identity.domain,
          country: source.country,
          language: source.language,
          timezone: source.timezone,
          genres: source.genres,
          subGenres: source.subGenres,
          formatGenres: source.formatGenres,
          submissionPolicy: source.submissionPolicy,
          submissionUrl: source.submissionUrl,
          submissionEvidence: source.submissionEvidence,
          sourceUrl: source.sourceUrl,
          qualityScore: source.qualityScore
        } : { normalizedDomain: identity.domain }),
        fingerprint: identity.fingerprint,
        activityStatus: denied ? "Blocked" : canonical.activityStatus === "Inactive" ? "Inactive" : validRoute ? "Active" : "Needs Validation",
        acceptsEmail: denied ? false : validRoute && source?.acceptsEmail === true,
        acceptsForms: denied ? false : validRoute && source?.acceptsForms === true,
        acceptsUnreleased: denied ? false : validRoute && source?.acceptsUnreleased === true,
        ...(denied ? {
          submissionPolicy: candidates.some(({ submissionPolicy }) => submissionPolicy === "No Submissions")
            ? "No Submissions"
            : "Blocked"
        } : {}),
        ...(source && validRoute ? { lastValidatedAt: toEspoDateTime(winner.evaluation.attestation.evidenceCapturedAt) } : {})
      });
      await renewBoth(lease, resolution.claim);
      const updatedCanonical = await updateIfChanged("MediaOutlet", canonical, payload, OUTLET_SELECT);
      const acceptedIdentities = denied || winner ? identities : [];
      await intakeRepository.completeIdentityResolution({
        ...resolution.claim,
        crmEntityId: updatedCanonical.id,
        sourceId: "direct-crm",
        externalId: input.id,
        evidenceCapturedAt: evidenceTimestamp(winner?.evaluation, input.modifiedAt),
        evidenceVerified: acceptedIdentities.length > 0,
        acceptedIdentities
      });

      let attested = false;
      if (denied) {
        await intakeRepository.revokeEvidenceAttestation({
          entityType: "MediaOutlet",
          entityId: updatedCanonical.id,
          entityVersion: updatedCanonical.versionNumber,
          revisionDigest,
          reason: suppressed ? "active_suppression" : "no_submissions_or_blocked"
        });
      } else if (validRoute) {
        const finalEvaluation = directOutletEvaluation(updatedCanonical, now, "direct_crm");
        if (finalEvaluation.allowed) {
          attested = await intakeRepository.putEvidenceAttestation({
            evaluation: finalEvaluation,
            origin: { sourceKind: "direct_crm", entityId: input.id, revisionDigest }
          });
        }
      } else {
        await intakeRepository.invalidateEvidenceAttestation({
          entityType: "MediaOutlet",
          entityId: updatedCanonical.id,
          entityVersion: updatedCanonical.versionNumber,
          revisionDigest,
          reason: "validation_incomplete"
        });
      }

      const duplicates = candidates.filter(({ id }) => id !== updatedCanonical.id);
      for (const duplicate of duplicates) await tombstoneOutlet(duplicate);
      const receiptResult = Object.freeze({
        entityType: "MediaOutlet",
        entityId: input.id,
        canonicalId: updatedCanonical.id,
        entityVersion: updatedCanonical.versionNumber,
        status: payload.activityStatus ?? updatedCanonical.activityStatus,
        duplicateCount: duplicates.length,
        attested,
        denied
      });
      await intakeRepository.completeIntake(lease, receiptResult);
      const hydrated = await hydrateOutletResult(receiptResult);
      metrics?.increment("outreach_direct_crm_intake_total", {
        entityType: "MediaOutlet",
        outcome: hydrated.attested ? "ready" : hydrated.record.activityStatus === "Blocked" ? "blocked" : "held"
      });
      logger?.info({ outletId: input.id, canonicalId: updatedCanonical.id, duplicateCount: duplicates.length, attested: hydrated.attested }, "direct CRM outlet intake completed");
      return hydrated;
    });
    await transferOutletSuppressions(merged.record, candidates, merged.denied);
    return merged;
  }

  async function hydrateContactResult(result, extra = {}) {
    const record = await readEntity("MediaContact", result.canonicalId, CONTACT_SELECT);
    const outlet = record.mediaOutletId
      ? await readEntity("MediaOutlet", record.mediaOutletId, OUTLET_SELECT).catch(() => undefined)
      : undefined;
    const attestation = await intakeRepository.getEvidenceAttestation("MediaContact", record.id);
    const evaluation = directContactEvaluation(
      record,
      outlet,
      new Date(),
      attestation?.sourceKind ?? "direct_crm"
    );
    const verification = verifyEvidenceAttestation(evaluation, attestation);
    return Object.freeze({
      ...result,
      ...extra,
      record: Object.freeze(record),
      attestation,
      attested: Boolean(attestation?.originCompleted && verification.verified)
    });
  }

  async function hydrateOutletResult(result, extra = {}) {
    const record = await readEntity("MediaOutlet", result.canonicalId, OUTLET_SELECT);
    const attestation = await intakeRepository.getEvidenceAttestation("MediaOutlet", record.id);
    const evaluation = directOutletEvaluation(record, new Date(), attestation?.sourceKind ?? "direct_crm");
    const verification = verifyEvidenceAttestation(evaluation, attestation);
    return Object.freeze({
      ...result,
      ...extra,
      record: Object.freeze(record),
      attestation,
      attested: Boolean(attestation?.originCompleted && verification.verified)
    });
  }

  async function evaluateContactRecord(record, outlet, now) {
    const attestation = await intakeRepository.getEvidenceAttestation("MediaContact", record.id);
    const evaluation = directContactEvaluation(record, outlet, now, attestation?.sourceKind ?? "direct_crm");
    if (evaluation.denied) return evaluation;
    const verification = verifyEvidenceAttestation(evaluation, attestation);
    if (attestation?.originCompleted && verification.verified) return evaluation;
    return directContactEvaluation(record, outlet, now, "direct_crm");
  }

  async function evaluateOutletRecord(record, now) {
    const attestation = await intakeRepository.getEvidenceAttestation("MediaOutlet", record.id);
    const evaluation = directOutletEvaluation(record, now, attestation?.sourceKind ?? "direct_crm");
    if (evaluation.denied) return evaluation;
    const verification = verifyEvidenceAttestation(evaluation, attestation);
    if (attestation?.originCompleted && verification.verified) return evaluation;
    return directOutletEvaluation(record, now, "direct_crm");
  }

  function directContactEvaluation(record, outlet, now, sourceKind) {
    return evaluateContactEvidence({
      entityId: record.id,
      entityVersion: record.versionNumber,
      email: record.emailAddress,
      purpose: record.contactPurpose,
      basis: record.contactBasis,
      sourceUrl: record.proofUrl ?? record.contactSourceUrl,
      evidenceText: record.proofText ?? record.contactEvidence,
      capturedAt: record.proofCapturedAt,
      ...(sourceKind === "direct_crm" ? { expectedDomain: outlet?.normalizedDomain ?? outlet?.website } : {}),
      now,
      maxAgeSeconds: maxEvidenceAgeSeconds,
      sourceKind
    });
  }

  function directOutletEvaluation(record, now, sourceKind) {
    return evaluateOutletEvidence({
      entityId: record.id,
      entityVersion: record.versionNumber,
      submissionPolicy: record.submissionPolicy,
      sourceUrl: record.sourceUrl,
      evidenceText: record.submissionEvidence,
      capturedAt: record.lastValidatedAt,
      ...(sourceKind === "direct_crm" ? { expectedDomain: record.normalizedDomain ?? record.website } : {}),
      now,
      maxAgeSeconds: maxEvidenceAgeSeconds,
      sourceKind
    });
  }

  async function collectContactCandidates(input) {
    const candidates = new Map([[input.id, input]]);
    const identity = directContactIdentity(input, undefined, cryptoBox);
    const queries = [];
    if (identity.email) queries.push([{ type: "equals", attribute: "emailAddress", value: identity.email }]);
    for (const fingerprint of new Set([input.fingerprint, identity.fingerprint].filter(Boolean))) {
      queries.push([{ type: "equals", attribute: "fingerprint", value: fingerprint }]);
    }
    for (const [attribute, value] of [
      ["instagramUrl", identity.instagramUrl ?? input.instagramUrl],
      ["linkedinUrl", identity.linkedinUrl ?? input.linkedinUrl],
      ["soundcloudUrl", identity.soundcloudUrl ?? input.soundcloudUrl]
    ]) if (value) queries.push([{ type: "equals", attribute, value }]);
    if (input.mediaOutletId) {
      queries.push([{ type: "equals", attribute: "mediaOutletId", value: input.mediaOutletId }]);
    }
    for (const records of await Promise.all(queries.map((where) => listWhere("MediaContact", where, CONTACT_SELECT)))) {
      for (const record of records) candidates.set(record.id, record);
    }
    const targetName = normalizeIdentityText(input.name ?? `${input.firstName ?? ""} ${input.lastName ?? ""}`);
    const targetShow = normalizeIdentityText(input.showName);
    const targetInstagram = normalizeInstagramAccount(input.instagramUrl);
    const targetLinkedIn = normalizeLinkedInAccount(input.linkedinUrl);
    const targetSoundCloud = normalizeSoundCloudAccount(input.soundcloudUrl);
    for (const [id, record] of [...candidates]) {
      const exact = normalizeEmail(record.emailAddress) === identity.email
        || record.fingerprint === input.fingerprint
        || record.fingerprint === identity.fingerprint
        || (targetInstagram && normalizeInstagramAccount(record.instagramUrl) === targetInstagram)
        || (targetLinkedIn && normalizeLinkedInAccount(record.linkedinUrl) === targetLinkedIn)
        || (targetSoundCloud && normalizeSoundCloudAccount(record.soundcloudUrl) === targetSoundCloud)
        || (record.mediaOutletId === input.mediaOutletId && targetName
          && normalizeIdentityText(record.name ?? `${record.firstName ?? ""} ${record.lastName ?? ""}`) === targetName)
        || (record.mediaOutletId === input.mediaOutletId && targetShow
          && normalizeIdentityText(record.showName) === targetShow);
      if (!exact && id !== input.id) candidates.delete(id);
    }
    return boundedCandidates(candidates);
  }

  async function collectOutletCandidates(input) {
    const candidates = new Map([[input.id, input]]);
    const identity = directOutletIdentity(input, cryptoBox);
    const queries = [];
    if (identity.domain) queries.push([{ type: "equals", attribute: "normalizedDomain", value: identity.domain }]);
    if (input.website) queries.push([{ type: "equals", attribute: "website", value: input.website }]);
    for (const fingerprint of new Set([input.fingerprint, identity.fingerprint].filter(Boolean))) {
      queries.push([{ type: "equals", attribute: "fingerprint", value: fingerprint }]);
    }
    for (const records of await Promise.all(queries.map((where) => listWhere("MediaOutlet", where, OUTLET_SELECT)))) {
      for (const record of records) {
        if (normalizeDomain(record.normalizedDomain ?? record.website) === identity.domain
            || record.fingerprint === input.fingerprint
            || record.fingerprint === identity.fingerprint) candidates.set(record.id, record);
      }
    }
    return boundedCandidates(candidates);
  }

  async function listWhere(entityType, where, select) {
    if (typeof espocrm.list !== "function") throw new TypeError("Contact intake requires bounded EspoCRM list queries");
    return espocrm.list(entityType, { where, select, maxRecords: MAX_CANDIDATES });
  }

  async function loadCandidateOutlets(candidates) {
    const outlets = new Map();
    for (const outletId of new Set(candidates.map(({ mediaOutletId }) => mediaOutletId).filter(Boolean))) {
      outlets.set(outletId, await readEntity("MediaOutlet", outletId, OUTLET_SELECT));
    }
    return outlets;
  }

  async function includeBoundCandidate(entityType, candidates, boundId, select) {
    if (!boundId || candidates.some(({ id }) => id === boundId)) return candidates;
    return boundedCandidates(new Map([
      ...candidates.map((record) => [record.id, record]),
      [boundId, await readEntity(entityType, boundId, select)]
    ]));
  }

  async function updateIfChanged(entityType, record, payload, select) {
    if (!Object.keys(payload).length) return record;
    const updated = typeof espocrm.updateConditional === "function"
      ? await espocrm.updateConditional(entityType, record.id, payload, record.versionNumber)
      : await espocrm.update(entityType, record.id, payload);
    if (!updated?.id || !Number.isInteger(updated.versionNumber)) return readEntity(entityType, record.id, select);
    return { ...record, ...payload, ...updated };
  }

  async function tombstoneContact(record, canonicalId) {
    const payload = compactChanged(record, {
      status: "Blocked",
      doNotContact: true,
      duplicateOfId: canonicalId,
      emailAddress: null,
      fingerprint: createHash("sha256").update(`merged-contact:${record.id}:${canonicalId}`).digest("hex"),
      mediaOutletId: null,
      instagramUrl: null,
      linkedinUrl: null,
      soundcloudUrl: null
    });
    await updateIfChanged("MediaContact", record, payload, CONTACT_SELECT);
  }

  async function tombstoneOutlet(record) {
    const payload = compactChanged(record, {
      activityStatus: "Inactive",
      acceptsEmail: false,
      acceptsForms: false,
      acceptsUnreleased: false,
      normalizedDomain: null,
      fingerprint: createHash("sha256").update(`merged-outlet:${record.id}`).digest("hex")
    });
    await updateIfChanged("MediaOutlet", record, payload, OUTLET_SELECT);
  }

  async function validateEmail(email, idempotencyKey) {
    const recipientHash = cryptoBox.privacyHash(email);
    // Validation results are provider-specific.  A cached SMTP result must
    // never satisfy a Mailgun validation request (and vice versa), otherwise
    // changing providers would silently leave CRM statuses stale.
    const validatorType = config.emailValidation?.type;
    const cached = await intakeRepository.getEmailValidation(recipientHash, validatorType);
    if (cached) return cached;
    const result = await emailValidationProvider.validate(
      email,
      createHash("sha256").update(idempotencyKey).digest("hex")
    );
    if (result.method !== "disabled") {
      await intakeRepository.putEmailValidation({
        recipientHash,
        ...result,
        ttlDays: config.emailValidation.cacheTtlDays
      });
    }
    return result;
  }

  async function hasActiveSuppression(subjects) {
    const checks = [...new Map(subjects.map(([subjectType, value]) => [
      `${subjectType}:${String(value).trim().toLowerCase()}`,
      { subjectType, subjectHash: cryptoBox.privacyHash(`${subjectType}:${value}`) }
    ])).values()];
    return intakeRepository.hasActiveSuppression(checks);
  }

  async function transferContactSuppressions(canonical, candidates, denied) {
    if (!denied) return;
    const subjects = new Map([[`contact:${canonical.id}`, ["contact", canonical.id]]]);
    for (const record of candidates) {
      const email = normalizeEmail(record.emailAddress);
      if (email) subjects.set(`email:${email}`, ["email", email]);
    }
    for (const [subjectType, subject] of subjects.values()) {
      await workflowRepository.suppress({
        subjectType, subject, reason: "deny_wins_canonical_merge", source: "direct_crm_intake"
      });
    }
  }

  async function transferOutletSuppressions(canonical, candidates, denied) {
    if (!denied) return;
    const subjects = new Map([[`outlet:${canonical.id}`, ["outlet", canonical.id]]]);
    for (const record of candidates) {
      const domain = normalizeDomain(record.normalizedDomain ?? record.website);
      if (domain) subjects.set(`domain:${domain}`, ["domain", domain]);
    }
    for (const [subjectType, subject] of subjects.values()) {
      await workflowRepository.suppress({
        subjectType, subject, reason: "no_submissions_canonical_merge", source: "direct_crm_intake"
      });
    }
  }

  async function renewBoth(lease, identityClaim) {
    const [intakeRenewed, identityRenewed] = await Promise.all([
      intakeRepository.renewIntakeLease(lease, leaseSeconds),
      intakeRepository.renewIdentityResolution({ ...identityClaim, leaseSeconds })
    ]);
    if (!intakeRenewed) throw intakeLeaseLost();
    if (!identityRenewed) throw identityClaimLost();
  }

  async function enqueueAfterIntake(entityType, entityId, entityVersion) {
    const workKind = entityType === "MediaContact" ? "match_contact" : "match_outlet";
    await workflowRepository.enqueueWork({
      kind: workKind,
      entityType,
      entityId,
      dedupeKey: `intake:${entityType}:${entityId}:v${entityVersion}:${workKind}`,
      payload: { intakeValidated: true, entityVersion },
      priority: 45
    });
  }

  async function readEntity(entityType, id, select) {
    const record = await espocrm.get(entityType, id, select);
    if (!record?.id || record.id !== id || !Number.isInteger(record.versionNumber)) {
      throw new ApplicationError("EspoCRM intake read omitted the fenced entity version", {
        code: "CRM_INTAKE_ENTITY_VERSION_MISSING", statusCode: 503, retryable: true,
        details: { entityType, entityId: id }
      });
    }
    return record;
  }

  return Object.freeze({ processContact, processOutlet, validateContactEmail });
}

export function crmRevisionDigest(entityType, record) {
  const fields = entityType === "MediaContact" ? CONTACT_SELECT : OUTLET_SELECT;
  return createHash("sha256").update(JSON.stringify([
    entityType,
    ...fields.map((field) => normalizeDigestValue(record?.[field]))
  ])).digest("hex");
}

function newestAllowed(entries) {
  return entries
    .filter(({ evaluation }) => evaluation.allowed)
    .sort((left, right) =>
      Date.parse(right.evaluation.attestation.evidenceCapturedAt) - Date.parse(left.evaluation.attestation.evidenceCapturedAt)
      || left.record.id.localeCompare(right.record.id)
    )[0];
}

function chooseCanonical(candidates, boundId) {
  if (boundId) {
    const bound = candidates.find(({ id }) => id === boundId);
    if (!bound) throw new ApplicationError("Bound canonical CRM entity cannot be read", {
      code: "CRM_INTAKE_BOUND_ENTITY_MISSING", statusCode: 503, retryable: true
    });
    return bound;
  }
  return [...candidates].sort((left, right) =>
    timestamp(left.createdAt) - timestamp(right.createdAt) || left.id.localeCompare(right.id)
  )[0];
}

function identityAliasesToAccept(identities, { denied, evidenceAllowed, emailValid }) {
  if (denied) return identities;
  if (!evidenceAllowed) return [];
  return identities.filter(({ type }) => emailValid || !["email", "fingerprint"].includes(type));
}

function unionDescriptors(groups) {
  return Object.freeze([...new Map(groups.flat().map((descriptor) => [
    `${descriptor.type}:${descriptor.hash}`,
    descriptor
  ])).values()].sort((left, right) => left.type.localeCompare(right.type) || left.hash.localeCompare(right.hash)));
}

function boundedCandidates(value) {
  const records = value instanceof Map ? [...value.values()] : [...value];
  if (!records.length || records.length > MAX_CANDIDATES) {
    throw new ApplicationError("Direct CRM identity candidate set is empty or exceeds its safety bound", {
      code: "CRM_INTAKE_CANDIDATE_BOUND_EXCEEDED", statusCode: 409, retryable: false
    });
  }
  return records;
}

function contactDenied(record) {
  return Boolean(record.doNotContact || record.optedOut || record.hardBounced)
    || record.status === "Blocked"
    || record.contactPurpose === "Blocked"
    || record.contactBasis === "Blocked";
}

function outletDenied(record) {
  return record.activityStatus === "Blocked" || ["No Submissions", "Blocked"].includes(record.submissionPolicy);
}

function contactSuppressionSubjects(candidates, outlets) {
  const subjects = [];
  for (const record of candidates) {
    const email = normalizeEmail(record.emailAddress);
    subjects.push(["contact", record.id], ["outlet", record.mediaOutletId], ["email", email]);
    if (email) subjects.push(["domain", email.split("@")[1]]);
    const outlet = outlets.get(record.mediaOutletId);
    subjects.push(["domain", normalizeDomain(outlet?.normalizedDomain ?? outlet?.website)]);
  }
  return cleanSubjects(subjects);
}

function outletSuppressionSubjects(candidates) {
  return cleanSubjects(candidates.flatMap((record) => [
    ["outlet", record.id],
    ["domain", normalizeDomain(record.normalizedDomain ?? record.website)]
  ]));
}

function cleanSubjects(subjects) {
  return [...new Map(subjects
    .filter(([, value]) => String(value ?? "").trim())
    .map(([type, value]) => [`${type}:${String(value).trim().toLowerCase()}`, [type, String(value).trim()]]))
    .values()];
}

function compactChanged(record, payload) {
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) =>
    value !== undefined && !sameValue(record?.[key], value)
  ));
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function normalizeDigestValue(value) {
  if (Array.isArray(value)) return [...value].map(normalizeDigestValue);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, normalizeDigestValue(item)])
  );
  return value ?? null;
}

function evidenceTimestamp(evaluation, fallback) {
  const parsed = Date.parse(evaluation?.attestation?.evidenceCapturedAt ?? fallback ?? "");
  return Number.isFinite(parsed) ? new Date(parsed) : new Date(0);
}

function timestamp(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function toEspoDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function intakeInProgress(entityType, entityId) {
  return new ApplicationError("Direct CRM intake is already processing this revision", {
    code: "CRM_INTAKE_IN_PROGRESS", statusCode: 409, retryable: true, details: { entityType, entityId }
  });
}

function identityInProgress(entityType) {
  return new ApplicationError("A matching direct or signed identity is already being resolved", {
    code: "CRM_INTAKE_IDENTITY_IN_PROGRESS", statusCode: 409, retryable: true, details: { entityType }
  });
}

function intakeLeaseLost() {
  return new ApplicationError("Direct CRM intake lost its processing lease", {
    code: "CRM_INTAKE_LEASE_LOST", statusCode: 409, retryable: true
  });
}

function identityClaimLost() {
  return new ApplicationError("Direct CRM intake lost its finite identity claim", {
    code: "SOURCE_IDENTITY_CLAIM_LOST", statusCode: 409, retryable: true
  });
}

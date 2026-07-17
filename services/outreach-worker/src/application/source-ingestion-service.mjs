import { createHash } from "node:crypto";
import { ApplicationError, errorCode } from "../errors.mjs";
import { evaluateContactEvidence, evaluateOutletEvidence } from "../domain/evidence-policy.mjs";
import { isAllowedContactBasis, isAllowedContactPurpose } from "../domain/eligibility-policy.mjs";
import {
  contactFingerprintFromArtifact,
  evidenceDigest,
  legacyContactFingerprintFromArtifact,
  outletFingerprint,
  parseSourceArtifact
} from "../domain/source-artifact.mjs";
import {
  canonicalInstagramUrl,
  contactIdentityDescriptors,
  normalizeInstagramAccount,
  outletIdentityDescriptors
} from "../domain/source-identity.mjs";
import { normalizeDomain, normalizeEmail } from "../domain/normalization.mjs";
import { emailValidationAllowsOutreach } from "../domain/email-validation-policy.mjs";

const ENTITY_TYPE = Object.freeze({
  mediaOutlet: "MediaOutlet",
  mediaContact: "MediaContact",
  musicRelease: "MusicRelease"
});

export function createSourceIngestionService({
  espocrm,
  repository,
  attestationRepository,
  emailValidationProvider,
  cryptoBox,
  config,
  logger,
  metrics
}) {
  if (!espocrm || !repository || !emailValidationProvider || !cryptoBox) {
    throw new TypeError("source ingestion service dependencies are required");
  }

  async function ingest({ sourceId, artifact: input, rawBody }) {
    const artifact = parseSourceArtifact(input, {
      maxAgeSeconds: config.sourceIngestion.maxArtifactAgeSeconds,
      maxEvidenceAgeSeconds: config.sourceIngestion.maxEvidenceAgeSeconds
    });
    if (artifact.sourceId !== sourceId) {
      throw new ApplicationError("Artifact source does not match its authenticated route", {
        code: "SOURCE_ID_MISMATCH", statusCode: 400, retryable: false
      });
    }
    const contentDigest = createHash("sha256").update(rawBody).digest("hex");
    const receipt = await repository.beginArtifact({
      sourceId,
      artifactId: artifact.artifactId,
      contentDigest,
      generatedAt: artifact.generatedAt,
      leaseSeconds: config.sourceIngestion.processingLeaseSeconds
    });
    if (receipt.completed) return Object.freeze({ ...receipt.result, replayed: true });
    if (!receipt.claimed) {
      throw new ApplicationError("Source artifact is already being processed", {
        code: "SOURCE_ARTIFACT_IN_PROGRESS", statusCode: 409, retryable: true
      });
    }
    if (!receipt.lease) {
      throw new ApplicationError("Source artifact receipt did not return a fenced lease", {
        code: "SOURCE_ARTIFACT_LEASE_LOST", statusCode: 409, retryable: true
      });
    }
    const lease = receipt.lease;
    const heartbeat = createLeaseHeartbeat({ repository, lease, leaseSeconds: config.sourceIngestion.processingLeaseSeconds });

    try {
      const counts = { MediaOutlet: 0, MediaContact: 0, MusicRelease: 0, contactsReady: 0, contactsHeld: 0 };
      const context = { outletDomains: new Map() };
      const ordered = [...artifact.records].sort((a, b) => recordOrder(a.kind) - recordOrder(b.kind));
      for (const record of ordered) {
        await heartbeat();
        const result = await ingestRecord(sourceId, artifact.artifactId, contentDigest, record, lease, context);
        counts[result.entityType] += 1;
        if (result.entityType === "MediaContact") counts[result.ready ? "contactsReady" : "contactsHeld"] += 1;
      }
      const result = Object.freeze({ sourceId, artifactId: artifact.artifactId, records: artifact.records.length, ...counts });
      await heartbeat(true);
      await repository.completeArtifact({ ...lease, result });
      metrics.increment("outreach_source_artifacts_total", { source: sourceId, outcome: "completed" });
      logger.info({ sourceId, artifactId: artifact.artifactId, records: artifact.records.length, counts }, "source artifact ingested");
      return result;
    } catch (error) {
      const failed = await repository.failArtifact({ ...lease, errorCode: errorCode(error) });
      metrics.increment("outreach_source_artifacts_total", { source: sourceId, outcome: "failed" });
      if (!failed && errorCode(error) !== "SOURCE_ARTIFACT_LEASE_LOST") {
        throw new ApplicationError("Source artifact receipt lost its processing lease", {
          code: "SOURCE_ARTIFACT_LEASE_LOST", statusCode: 409, retryable: true, cause: error
        });
      }
      throw error;
    }
  }

  async function ingestRecord(sourceId, artifactId, contentDigest, record, lease, context) {
    let operation;
    try {
      if (record.kind === "mediaOutlet") operation = await upsertOutlet(sourceId, record);
      if (record.kind === "mediaContact") operation = await upsertContact(sourceId, artifactId, record, context);
      if (record.kind === "musicRelease") operation = { entity: await upsertRelease(record) };
      const entity = operation?.entity;
      if (!entity?.id) {
        throw new ApplicationError("EspoCRM did not return an entity identifier", {
          code: "SOURCE_CRM_ID_MISSING", statusCode: 503, retryable: true
        });
      }
      await repository.linkRecord({
        sourceId,
        artifactId,
        leaseOwner: lease.leaseOwner,
        leaseVersion: lease.leaseVersion,
        externalId: record.externalId,
        entityType: ENTITY_TYPE[record.kind],
        crmEntityId: entity.id,
        evidenceDigest: evidenceDigest(record),
        evidenceCapturedAt: record.evidence.capturedAt,
        evidenceVerified: Boolean(record.verified),
        identityResolution: operation.identityResolution
      });
      await persistEvidenceAttestation({ sourceId, artifactId, contentDigest, record, operation, entity });
      if (record.kind === "mediaOutlet" && operation.outletDomain) {
        context.outletDomains.set(entity.id, operation.outletDomain);
      }
      return Object.freeze({ entityType: ENTITY_TYPE[record.kind], ready: Boolean(operation.ready) });
    } catch (error) {
      if (operation?.identityResolution) {
        await repository.abandonIdentityResolution?.(operation.identityResolution).catch(() => false);
      }
      throw error;
    }
  }

  async function withIdentityResolution(entityType, identities, work) {
    if (typeof repository.beginIdentityResolution !== "function") return work({ renew: async () => true });
    const started = await repository.beginIdentityResolution({
      entityType,
      identities,
      leaseSeconds: config.sourceIngestion.processingLeaseSeconds
    });
    if (!started.claimed) {
      throw new ApplicationError("A matching source identity is already being resolved", {
        code: "SOURCE_IDENTITY_IN_PROGRESS", statusCode: 409, retryable: true
      });
    }
    try {
      return await work({
        identityResolution: started.claim,
        boundCrmEntityId: started.boundCrmEntityId,
        boundEvidence: started.boundEvidence,
        renew: async () => {
          if (typeof repository.renewIdentityResolution !== "function") return true;
          const renewed = await repository.renewIdentityResolution({
            ...started.claim,
            leaseSeconds: config.sourceIngestion.processingLeaseSeconds
          });
          if (!renewed) {
            throw new ApplicationError("Source identity resolution lost its finite claim", {
              code: "SOURCE_IDENTITY_CLAIM_LOST", statusCode: 409, retryable: true
            });
          }
          return true;
        }
      });
    } catch (error) {
      await repository.abandonIdentityResolution?.(started.claim).catch(() => false);
      throw error;
    }
  }

  async function upsertOutlet(sourceId, record) {
    const fingerprint = outletFingerprint(sourceId, record);
    const normalizedDomain = normalizeDomain(record.website);
    const identities = outletIdentityDescriptors(sourceId, record, cryptoBox);
    return withIdentityResolution("MediaOutlet", identities, async (resolution) => {
      const select = [
        "id", "versionNumber", "name", "type", "website", "normalizedDomain", "fingerprint",
        "country", "language", "timezone", "genres", "subGenres", "formatGenres", "submissionPolicy", "submissionUrl",
        "submissionEvidence", "acceptsEmail", "acceptsForms", "acceptsUnreleased",
        "activityStatus", "lastValidatedAt", "sourceUrl", "qualityScore"
      ];
      const candidates = await Promise.all([
        findUnique("MediaOutlet", [{ type: "equals", attribute: "fingerprint", value: fingerprint }], select),
        findUnique("MediaOutlet", [{ type: "equals", attribute: "normalizedDomain", value: normalizedDomain }], select),
        findUnique("MediaOutlet", [
          { type: "equals", attribute: "name", value: record.name },
          { type: "equals", attribute: "normalizedDomain", value: normalizedDomain }
        ], select)
      ]);
      const existing = await canonicalCandidate("MediaOutlet", resolution.boundCrmEntityId, candidates, select);
      const suppressionSubjects = [
        ["outlet", existing?.id],
        ["domain", normalizedDomain],
        ["domain", normalizeDomain(existing?.normalizedDomain ?? existing?.website)]
      ];
      return withDenyFence(suppressionSubjects, async () => {
        const suppressed = await hasActiveSuppression(suppressionSubjects);
        const blockedPolicy = ["Blocked", "No Submissions"].includes(existing?.submissionPolicy);
        const incomingBlockedPolicy = ["Blocked", "No Submissions"].includes(record.submissionPolicy);
        const denied = suppressed || existing?.activityStatus === "Blocked" || blockedPolicy || incomingBlockedPolicy;
        const evidenceWins = !existing || verifiedEvidenceWins({
          incoming: record,
          existingTimestamp: existing?.lastValidatedAt,
          boundEvidence: resolution.boundEvidence
        });
        const evidenceAccepted = Boolean(record.verified && (!existing || evidenceWins));
        const payload = {};
        if (!existing || evidenceWins) {
          Object.assign(payload, compactObject({
            name: record.name,
            type: record.type,
            website: record.website,
            normalizedDomain,
            ...(!existing ? { fingerprint } : {}),
            country: record.country,
            language: record.language,
            timezone: record.timezone,
            genres: record.genres,
            subGenres: record.subGenres,
            formatGenres: record.formatGenres,
            submissionPolicy: record.submissionPolicy,
            submissionUrl: record.submissionUrl,
            submissionEvidence: record.evidence.text,
            acceptsEmail: record.acceptsEmail,
            acceptsForms: record.acceptsForms,
            acceptsUnreleased: record.acceptsUnreleased,
            activityStatus: record.verified ? "Active" : "Needs Validation",
            ...(record.verified ? { lastValidatedAt: toEspoDateTime(record.evidence.capturedAt) } : {}),
            sourceUrl: record.evidence.url,
            qualityScore: record.qualityScore
          }));
        }
        if (denied) {
          Object.assign(payload, {
            activityStatus: "Blocked",
            submissionPolicy: blockedPolicy
              ? existing.submissionPolicy
              : incomingBlockedPolicy ? record.submissionPolicy : "Blocked",
            acceptsEmail: false,
            acceptsForms: false,
            acceptsUnreleased: false
          });
        }
        await resolution.renew();
        const entity = existing
          ? Object.keys(payload).length
            ? await espocrm.updateConditional("MediaOutlet", existing.id, payload, existing.versionNumber)
            : existing
          : await espocrm.upsertByUnique("MediaOutlet", "fingerprint", fingerprint, payload);
        const projected = { ...existing, ...payload, ...entity };
        const attestationEvaluation = evaluateOutletEvidence({
          entityId: entity.id,
          entityVersion: projected.versionNumber,
          submissionPolicy: projected.submissionPolicy,
          sourceUrl: projected.sourceUrl,
          evidenceText: projected.submissionEvidence,
          capturedAt: record.evidence.capturedAt,
          maxAgeSeconds: config.sourceIngestion.maxEvidenceAgeSeconds,
          sourceKind: "signed_source"
        });
        return Object.freeze({
          entity,
          outletDomain: normalizeDomain(entity.normalizedDomain ?? entity.website) ?? normalizedDomain,
          attestationEvaluation,
          identityResolution: identityResolutionFor(
            resolution.identityResolution,
            evidenceAccepted ? identities : []
          )
        });
      });
    });
  }

  async function upsertContact(sourceId, artifactId, record, context) {
    const outletId = await repository.findLinkedEntity({
      sourceId,
      externalId: record.outletExternalId,
      entityType: "MediaOutlet"
    });
    if (!outletId) {
      throw new ApplicationError("Contact references an outlet that has not been ingested", {
        code: "SOURCE_CONTACT_OUTLET_MISSING",
        statusCode: 409,
        retryable: true,
        details: { outletExternalId: record.outletExternalId }
      });
    }
    const outletDomain = await linkedOutletDomain(outletId, context);
    const email = normalizeEmail(record.email);
    const fingerprint = contactFingerprintFromArtifact(record, outletDomain);
    const legacyFingerprint = legacyContactFingerprintFromArtifact(record);
    const identities = contactIdentityDescriptors(record, outletId, outletDomain, cryptoBox);
    return withIdentityResolution("MediaContact", identities, async (resolution) => {
      const select = [
        "id", "versionNumber", "name", "firstName", "lastName", "showName", "emailAddress", "role",
        "instagramUrl", "linkedinUrl", "soundcloudUrl", "preferredLanguage", "timezone",
        "contactSourceUrl", "contactEvidence", "contactPurpose", "contactBasis",
        "proofUrl", "proofText", "proofCapturedAt", "lastValidatedAt", "emailValidationStatus",
        "smtpValidationStatus", "status", "fingerprint", "mediaOutletId", "doNotContact",
        "optedOut", "hardBounced"
      ];
      const instagramLookups = instagramLookupUrls(record.instagramUrl).map((value) =>
        findUnique("MediaContact", [{ type: "equals", attribute: "instagramUrl", value }], select)
      );
      const candidates = await Promise.all([
        findUnique("MediaContact", [{ type: "equals", attribute: "fingerprint", value: fingerprint }], select),
        findUnique("MediaContact", [{ type: "equals", attribute: "fingerprint", value: legacyFingerprint }], select),
        findUnique("MediaContact", [{ type: "equals", attribute: "emailAddress", value: email }], select),
        findUnique("MediaContact", [
          { type: "equals", attribute: "name", value: record.fullName },
          { type: "equals", attribute: "mediaOutletId", value: outletId }
        ], select),
        ...instagramLookups
      ]);
      const existing = await canonicalCandidate("MediaContact", resolution.boundCrmEntityId, candidates, select);
      const existingEmail = normalizeEmail(existing?.emailAddress);
      const suppressionSubjects = [
        ["contact", existing?.id],
        ["outlet", outletId],
        ["outlet", existing?.mediaOutletId],
        ["email", email],
        ["email", existingEmail],
        ["domain", emailDomain(email)],
        ["domain", emailDomain(existingEmail)]
      ];
      const localDenied = Boolean(existing?.doNotContact)
        || Boolean(existing?.optedOut)
        || Boolean(existing?.hardBounced)
        || existing?.status === "Blocked"
        || existing?.contactPurpose === "Blocked"
        || existing?.contactBasis === "Blocked"
        || record.purpose === "Blocked"
        || record.basis === "Blocked";
      const initiallySuppressed = await hasActiveSuppression(suppressionSubjects);
      const incomingEvidenceEvaluation = evaluateContactEvidence({
        entityId: existing?.id ?? "pending-source-contact",
        entityVersion: existing?.versionNumber ?? 0,
        email: record.email,
        purpose: record.purpose,
        basis: record.basis,
        sourceUrl: record.evidence.url,
        evidenceText: record.evidence.text,
        capturedAt: record.evidence.capturedAt,
        maxAgeSeconds: config.sourceIngestion.maxEvidenceAgeSeconds,
        sourceKind: "signed_source"
      });
      const evidenceWins = !existing || verifiedEvidenceWins({
        incoming: record,
        existingTimestamp: existing?.proofCapturedAt,
        boundEvidence: resolution.boundEvidence
      });
      const canonicalEvidenceVerified = Boolean(
        (record.verified && incomingEvidenceEvaluation.allowed)
        || resolution.boundEvidence?.verified
      );

      let canonicalEmail = existingEmail ?? email;
      let effectiveValidation = existingValidation(existing);
      let applyValidation = !existing;
      let emailReplaced = false;
      if (!localDenied && !initiallySuppressed && (!existing || existingEmail === email)) {
        const checked = await validateEmail(email, `${sourceId}:${artifactId}:${record.externalId}`);
        effectiveValidation = preserveValidationWhenDisabled(checked, existing);
        applyValidation = true;
      } else if (!localDenied && !initiallySuppressed && existingEmail !== email && evidenceWins) {
        const checked = await validateEmail(email, `${sourceId}:${artifactId}:${record.externalId}`);
        if (emailValidationAllowsOutreach(checked.status)) {
          canonicalEmail = email;
          effectiveValidation = checked;
          applyValidation = true;
          emailReplaced = true;
        }
      }

      return withDenyFence(suppressionSubjects, async () => {
        const suppressed = await hasActiveSuppression(suppressionSubjects);
        const denied = localDenied || suppressed;
        const projectedPurpose = (!existing || evidenceWins) ? record.purpose : existing.contactPurpose;
        const projectedBasis = (!existing || evidenceWins) ? record.basis : existing.contactBasis;
        const validationReady = emailValidationAllowsOutreach(effectiveValidation.status)
          && canonicalEvidenceVerified
          && isAllowedContactPurpose(projectedPurpose)
          && isAllowedContactBasis(projectedBasis);
        const status = denied
          ? "Blocked"
          : existing?.status === "Inactive"
            ? "Inactive"
            : validationReady
              ? (existing?.status === "Active" ? "Active" : "Ready for Matching")
              : "Needs Validation";
        const ready = validationReady && !denied && status !== "Inactive";
        const payload = {};
        if (!existing || evidenceWins) {
          Object.assign(payload, compactObject({
            name: record.fullName,
            firstName: record.firstName,
            lastName: record.lastName,
            showName: record.showName,
            role: record.role,
            instagramUrl: canonicalInstagramUrl(record.instagramUrl),
            linkedinUrl: record.linkedinUrl,
            soundcloudUrl: record.soundcloudUrl,
            contactSourceUrl: record.evidence.url,
            contactEvidence: record.evidence.text,
            contactPurpose: record.purpose,
            contactBasis: record.basis,
            proofUrl: record.evidence.url,
            proofText: record.evidence.text,
            proofCapturedAt: toEspoDateTime(record.evidence.capturedAt),
            preferredLanguage: record.preferredLanguage,
            timezone: record.timezone,
            mediaOutletId: outletId
          }));
        }
        if (!existing || emailReplaced) {
          Object.assign(payload, { emailAddress: canonicalEmail, fingerprint });
        } else if (existingEmail === email && evidenceWins && existing.fingerprint !== fingerprint) {
          payload.fingerprint = fingerprint;
        }
        if (applyValidation) {
          Object.assign(payload, {
            emailValidationStatus: effectiveValidation.status,
            smtpValidationStatus: effectiveValidation.method === "smtp"
              ? effectiveValidation.status
              : emailReplaced ? "Unknown" : existing?.smtpValidationStatus ?? "Unknown",
            ...(effectiveValidation.method !== "disabled" && effectiveValidation.checkedAt
              ? { lastValidatedAt: toEspoDateTime(effectiveValidation.checkedAt) }
              : {})
          });
        }
        payload.status = status;
        if (!emailValidationAllowsOutreach(effectiveValidation.status)) payload.doNotContact = true;
        if (denied) {
          if (suppressed) payload.doNotContact = true;
          if (existing?.doNotContact) payload.doNotContact = true;
          if (existing?.optedOut) payload.optedOut = true;
          if (existing?.hardBounced) payload.hardBounced = true;
          if (existing?.contactPurpose === "Blocked") payload.contactPurpose = "Blocked";
          if (existing?.contactBasis === "Blocked") payload.contactBasis = "Blocked";
        }
        const evidenceAccepted = Boolean(
          record.verified
          && incomingEvidenceEvaluation.allowed
          && (!existing || evidenceWins)
        );
        const emailAccepted = evidenceAccepted
          && canonicalEmail === email
          && emailValidationAllowsOutreach(effectiveValidation.status);
        const acceptedIdentities = evidenceAccepted
          ? identities.filter(({ type }) => emailAccepted || !["email", "fingerprint"].includes(type))
          : [];
        await resolution.renew();
        const entity = existing
          ? await espocrm.updateConditional("MediaContact", existing.id, payload, existing.versionNumber)
          : await espocrm.upsertByUnique("MediaContact", "fingerprint", fingerprint, payload);
        const projected = { ...existing, ...payload, ...entity };
        const attestationEvaluation = evaluateContactEvidence({
          entityId: entity.id,
          entityVersion: projected.versionNumber,
          email: projected.emailAddress,
          purpose: projected.contactPurpose,
          basis: projected.contactBasis,
          sourceUrl: projected.proofUrl ?? projected.contactSourceUrl,
          evidenceText: projected.proofText ?? projected.contactEvidence,
          capturedAt: projected.proofCapturedAt ?? record.evidence.capturedAt,
          maxAgeSeconds: config.sourceIngestion.maxEvidenceAgeSeconds,
          sourceKind: "signed_source"
        });
        return Object.freeze({
          entity,
          ready,
          attestationEvaluation,
          identityResolution: identityResolutionFor(resolution.identityResolution, acceptedIdentities)
        });
      });
    });
  }

  async function findUnique(entityType, where, select) {
    try {
      if (typeof espocrm.findUniqueWhere === "function") {
        return await espocrm.findUniqueWhere(entityType, where, select);
      }
      if (where.length === 1 && where[0].type === "equals") {
        return await espocrm.findOne(entityType, where[0].attribute, where[0].value, select);
      }
      throw new ApplicationError("EspoCRM client cannot perform a compound unique lookup", {
        code: "SOURCE_DEDUP_LOOKUP_UNSUPPORTED", statusCode: 500, retryable: false
      });
    } catch (error) {
      if (error?.code === "ESPOCRM_UNIQUE_CONTRACT_VIOLATED") throw dedupAmbiguous(error);
      throw error;
    }
  }

  async function linkedOutletDomain(outletId, context) {
    const cached = context.outletDomains.get(outletId);
    if (cached) return cached;
    const outlet = await espocrm.get("MediaOutlet", outletId, ["id", "normalizedDomain", "website"]);
    const domain = outlet?.id === outletId ? normalizeDomain(outlet.normalizedDomain ?? outlet.website) : undefined;
    if (!domain) {
      throw new ApplicationError("Contact outlet has no canonical domain for fingerprinting", {
        code: "SOURCE_CONTACT_OUTLET_DOMAIN_MISSING", statusCode: 409, retryable: false,
        details: { outletId }
      });
    }
    context.outletDomains.set(outletId, domain);
    return domain;
  }

  async function canonicalCandidate(entityType, boundCrmEntityId, candidates, select) {
    const present = candidates.filter(Boolean);
    for (const candidate of present) {
      if (!candidate.id) {
        throw new ApplicationError("EspoCRM unique lookup omitted an entity identifier", {
          code: "SOURCE_CRM_ID_MISSING", statusCode: 503, retryable: true
        });
      }
    }
    const ids = new Set(present.map(({ id }) => id));
    if (boundCrmEntityId) ids.add(boundCrmEntityId);
    if (ids.size > 1) throw dedupAmbiguous();
    const canonicalId = ids.values().next().value;
    if (!canonicalId) return undefined;
    const candidate = present.find(({ id }) => id === canonicalId);
    if (candidate) return candidate;
    if (typeof espocrm.get !== "function") {
      throw new ApplicationError("Bound source identity cannot be read from EspoCRM", {
        code: "SOURCE_DEDUP_BOUND_RECORD_UNREADABLE", statusCode: 503, retryable: true
      });
    }
    const fetched = await espocrm.get(entityType, canonicalId, select);
    if (!fetched?.id || fetched.id !== canonicalId) {
      throw new ApplicationError("Bound source identity cannot be read from EspoCRM", {
        code: "SOURCE_DEDUP_BOUND_RECORD_UNREADABLE", statusCode: 503, retryable: true
      });
    }
    return fetched;
  }

  async function hasActiveSuppression(subjects) {
    if (typeof repository.hasActiveSuppression !== "function") return false;
    const unique = new Map();
    for (const [subjectType, value] of subjects) {
      const subject = String(value ?? "").trim();
      if (!subject) continue;
      unique.set(`${subjectType}:${subject}`, {
        subjectType,
        subjectHash: cryptoBox.privacyHash(`${subjectType}:${subject}`)
      });
    }
    return repository.hasActiveSuppression([...unique.values()]);
  }

  async function withDenyFence(subjects, work) {
    if (typeof repository.withSuppressionFence === "function") {
      return repository.withSuppressionFence(subjects, work);
    }
    return work();
  }

  async function upsertRelease(record) {
    const sourceEvidence = `Source: ${record.evidence.url}\nEvidence captured ${record.evidence.capturedAt}: ${record.evidence.text}`;
    const sourceEvidenceDigest = releaseSourceDigest(record);
    const sourceEvidenceCapturedAt = toEspoDateTime(record.evidence.capturedAt);
    const commonPayload = {
      name: record.name,
      artistName: record.artistName,
      description: [record.description, sourceEvidence].filter(Boolean).join("\n\n").slice(0, 10_000),
      releaseDate: record.releaseDate,
      campaignStartDate: record.campaignStartDate,
      campaignEndDate: record.campaignEndDate,
      genres: record.genres,
      subGenres: record.subGenres,
      languages: record.languages,
      territories: record.territories,
      spotifyUrl: record.spotifyUrl,
      websiteUrl: record.websiteUrl,
      epkUrl: record.epkUrl,
      privateStreamUrl: record.privateStreamUrl,
      downloadUrl: record.downloadUrl,
      artworkUrl: record.artworkUrl,
      radioEditUrl: record.radioEditUrl,
      isrc: record.isrc,
      sourceEvidenceCapturedAt,
      sourceEvidenceDigest,
      sourceEvidenceReference: record.evidence.url.slice(0, 512),
      priority: record.priority,
      dailySendLimit: record.dailySendLimit
    };
    const select = ["id", "versionNumber", "status", "sourceEvidenceCapturedAt", "sourceEvidenceDigest"];

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const existing = await espocrm.findOne("MusicRelease", "isrc", record.isrc, select);
      if (existing) {
        const existingAt = timestampMillis(existing.sourceEvidenceCapturedAt);
        const incomingAt = timestampMillis(sourceEvidenceCapturedAt);
        if (Number.isFinite(existingAt) && existingAt > incomingAt) return existing;
        if (Number.isFinite(existingAt) && existingAt === incomingAt && existing.sourceEvidenceDigest) {
          if (existing.sourceEvidenceDigest === sourceEvidenceDigest) return existing;
          throw new ApplicationError("Equal release evidence revisions contain different verified payloads", {
            code: "SOURCE_RELEASE_REVISION_COLLISION",
            statusCode: 409,
            retryable: false,
            details: { isrc: record.isrc }
          });
        }
        try {
          const { isrc: _sameImmutableIsrc, ...mutablePayload } = commonPayload;
          return await espocrm.updateConditional("MusicRelease", existing.id, {
            ...mutablePayload,
            status: existing.status ?? "Draft"
          }, existing.versionNumber);
        } catch (error) {
          if (!isCrmRevisionRace(error)) throw error;
          continue;
        }
      }

      try {
        return await espocrm.create("MusicRelease", { ...commonPayload, status: "Draft" });
      } catch (error) {
        if (!isCrmRevisionRace(error)) throw error;
      }
    }

    throw new ApplicationError("Music release revision did not converge after concurrent writes", {
      code: "SOURCE_RELEASE_REVISION_CONFLICT",
      statusCode: 409,
      retryable: true,
      details: { isrc: record.isrc }
    });
  }

  async function validateEmail(email, idempotencyKey) {
    const recipientHash = cryptoBox.privacyHash(email);
    const cached = await repository.getEmailValidation(recipientHash);
    if (cached) return cached;
    const validation = await emailValidationProvider.validate(
      email,
      createHash("sha256").update(idempotencyKey).digest("hex")
    );
    if (validation.method !== "disabled") {
      await repository.putEmailValidation({
        recipientHash,
        ...validation,
        ttlDays: config.emailValidation.cacheTtlDays
      });
    }
    return validation;
  }

  async function persistEvidenceAttestation({ sourceId, artifactId, contentDigest, record, operation, entity }) {
    if (!attestationRepository || !["mediaOutlet", "mediaContact"].includes(record.kind)) return;
    const evaluation = operation.attestationEvaluation;
    if (record.verified && evaluation?.allowed) {
      await attestationRepository.putEvidenceAttestation({
        evaluation,
        origin: {
          sourceKind: "signed_source",
          sourceId,
          artifactId,
          revisionDigest: contentDigest
        }
      });
      return;
    }
    const entityType = ENTITY_TYPE[record.kind];
    if (evaluation?.denied || ["No Submissions", "Blocked"].includes(record.submissionPolicy)) {
      await attestationRepository.revokeEvidenceAttestation({
        entityType,
        entityId: entity.id,
        entityVersion: entity.versionNumber,
        revisionDigest: contentDigest,
        reason: "signed_source_negative_evidence",
        capturedAt: record.evidence.capturedAt
      });
      return;
    }
    await attestationRepository.invalidateEvidenceAttestation({
      entityType,
      entityId: entity.id,
      entityVersion: entity.versionNumber,
      revisionDigest: contentDigest,
      reason: "signed_source_evidence_not_attestable",
      capturedAt: record.evidence.capturedAt
    });
  }

  return Object.freeze({ ingest });
}

function recordOrder(kind) {
  return ({ mediaOutlet: 0, musicRelease: 1, mediaContact: 2 })[kind] ?? 9;
}

function toEspoDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function instagramLookupUrls(value) {
  const handle = normalizeInstagramAccount(value);
  if (!handle) return [];
  return [
    `https://www.instagram.com/${handle}/`,
    `https://www.instagram.com/${handle}`,
    `https://instagram.com/${handle}/`,
    `https://instagram.com/${handle}`
  ];
}

export function verifiedEvidenceWins({ incoming, existingTimestamp, boundEvidence }) {
  if (!incoming.verified) return false;
  const incomingAt = timestampMillis(incoming.evidence.capturedAt);
  if (!Number.isFinite(incomingAt)) return false;
  const baselines = [
    timestampMillis(existingTimestamp),
    boundEvidence?.verified ? timestampMillis(boundEvidence.verifiedAt) : Number.NaN
  ].filter(Number.isFinite);
  return !baselines.length || incomingAt > Math.max(...baselines);
}

function timestampMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const text = typeof value === "string" ? value.trim() : "";
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/u.test(text)) {
    return Date.parse(`${text.replace(" ", "T")}Z`);
  }
  return Date.parse(text);
}

function releaseSourceDigest(record) {
  return createHash("sha256").update(JSON.stringify([
    record.isrc,
    record.name,
    record.artistName,
    record.description ?? null,
    record.releaseDate ?? null,
    record.campaignStartDate ?? null,
    record.campaignEndDate ?? null,
    record.genres,
    record.languages,
    record.spotifyUrl ?? null,
    record.websiteUrl ?? null,
    record.epkUrl ?? null,
    record.privateStreamUrl ?? null,
    record.downloadUrl ?? null,
    record.artworkUrl ?? null,
    record.radioEditUrl ?? null,
    record.priority,
    record.dailySendLimit,
    record.evidence.url,
    record.evidence.capturedAt,
    record.evidence.text
  ])).digest("hex");
}

function isCrmRevisionRace(error) {
  return Boolean(
    error?.deliveryUnknown ||
    error?.statusCode === 409 ||
    ["ESPOCRM_HTTP_409", "ESPOCRM_VERSION_CONFLICT", "ESPOCRM_UPDATE_UNCONFIRMED"].includes(error?.code)
  );
}

function existingValidation(existing) {
  return Object.freeze({
    status: existing?.emailValidationStatus ?? "Unknown",
    checkedAt: existing?.lastValidatedAt,
    method: emailValidationAllowsOutreach(existing?.smtpValidationStatus) ? "smtp" : "http"
  });
}

function preserveValidationWhenDisabled(validation, existing) {
  if (validation.method !== "disabled" || !emailValidationAllowsOutreach(existing?.emailValidationStatus)) return validation;
  return Object.freeze({
    ...validation,
    status: "Valid",
    checkedAt: undefined,
    method: emailValidationAllowsOutreach(existing.smtpValidationStatus) ? "smtp" : "http"
  });
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function identityResolutionFor(claim, acceptedIdentities) {
  return claim ? Object.freeze({ ...claim, acceptedIdentities: Object.freeze([...acceptedIdentities]) }) : undefined;
}

function emailDomain(email) {
  return normalizeEmail(email)?.split("@")[1];
}

function dedupAmbiguous(cause) {
  return new ApplicationError("Source identity criteria resolve to multiple CRM records", {
    code: "SOURCE_DEDUP_AMBIGUOUS", statusCode: 409, retryable: false, cause
  });
}

function createLeaseHeartbeat({ repository, lease, leaseSeconds = 900 }) {
  const heartbeatEveryMs = Math.max(1_000, Math.floor(leaseSeconds * 1_000 / 3));
  let lastHeartbeatAt = Number.NEGATIVE_INFINITY;
  return async (force = false) => {
    if (!force && Date.now() - lastHeartbeatAt < heartbeatEveryMs) return;
    const renewed = await repository.renewArtifactLease({ ...lease, leaseSeconds });
    if (!renewed) {
      throw new ApplicationError("Source artifact receipt lost its processing lease", {
        code: "SOURCE_ARTIFACT_LEASE_LOST", statusCode: 409, retryable: true
      });
    }
    lastHeartbeatAt = Date.now();
  };
}

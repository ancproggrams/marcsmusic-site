import { createHash } from "node:crypto";
import { normalizeDomain, normalizeEmail, optionalText } from "../domain/normalization.mjs";

export const LEGACY_MIGRATION_VERSION = "legacy-leads-v2";
export const LEGACY_CANARY_MAX_CONTACTS = 5;
export const LEGACY_CANARY_ENVIRONMENT = "outreach-staging";

const CONFLICT_FIELDS = Object.freeze([
  "firstName", "lastName", "role", "outletName", "outletFingerprint", "website", "country", "language", "timezone",
  "proofUrl", "proofText", "contactPurpose", "contactBasis", "submissionPolicy", "emailValidationStatus"
]);
const NEGATIVE_TYPES = new Set(["opt_out", "spam_complaint", "hard_bounce"]);
const SAMPLE_LIMIT = 10;

export function analyzeLegacyLeads(leads, campaignLogs = []) {
  const orderedLeads = stableRecordOrder(leads);
  const orderedCampaignLogs = stableRecordOrder(campaignLogs);
  const historicalByLeadId = historicalSignals(orderedCampaignLogs);
  const normalizedRows = orderedLeads.map((lead) => normalizeLegacyLead(lead, historicalByLeadId.get(String(lead.id))));
  const normalizedByLeadId = new Map(orderedLeads.map((lead, index) => [String(lead.id), normalizedRows[index]]));
  const contactGroups = new Map();
  const reasonCounts = new Map();

  for (const item of normalizedRows) {
    for (const reason of item.blockReasons) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    if (!item.email) continue;
    const group = contactGroups.get(item.contactFingerprint) ?? [];
    group.push(item);
    contactGroups.set(item.contactFingerprint, group);
  }

  const contacts = [...contactGroups.values()]
    .map(canonicalContact)
    .sort(compareSourceCursor);
  const contactsByFingerprint = new Map(contacts.map((item) => [item.contactFingerprint, item]));
  const outlets = [...new Map(contacts.map((item) => [item.outletFingerprint, item])).values()]
    .sort(compareSourceCursor);
  const history = analyzeCampaignHistory(orderedCampaignLogs, normalizedByLeadId, contactsByFingerprint);
  const sourceDigest = digestSource(orderedLeads, orderedCampaignLogs);
  const invalidOrMissingEmail = normalizedRows.filter((item) => !item.email).length;
  const duplicateRows = normalizedRows.length - invalidOrMissingEmail - contacts.length;
  const contactOutcomes = exclusiveContactOutcomes(contacts);
  const fieldConflicts = summarizeFieldConflicts(contacts);
  const reconciliation = reconciliationReport({
    sourceTotal: normalizedRows.length,
    invalidOrMissingEmail,
    canonicalContacts: contacts.length,
    duplicateRows,
    contactOutcomes,
    campaignTotal: orderedCampaignLogs.length,
    historyCategories: history.categories
  });
  const applyAllowed = Object.values(reconciliation).every((equation) => equation.balanced) && history.categories.identityConflictRows === 0;
  const reportBase = {
    migrationVersion: LEGACY_MIGRATION_VERSION,
    migrationRunId: `${LEGACY_MIGRATION_VERSION}-${sourceDigest.slice(0, 16)}`,
    snapshot: {
      ordering: "modifiedAt ASC, id ASC",
      digestAlgorithm: "SHA-256 over canonical full source records",
      sourceDigest,
      leadRows: orderedLeads.length,
      campaignLogRows: orderedCampaignLogs.length
    },
    sourceTotal: normalizedRows.length,
    sourceDigest,
    candidateContacts: contacts.length,
    candidateOutlets: outlets.length,
    historicalEventsToImport: history.events.length,
    duplicateRows,
    invalidOrMissingEmail,
    automaticEligibilityBlocked: contacts.filter((item) => item.contactBasis === "Unknown" || item.contactPurpose === "Unknown").length,
    allImportedContactsQuarantined: contacts.length,
    historicalCampaignRows: orderedCampaignLogs.length,
    priorSendContactsBlocked: contacts.filter((item) => item.priorSend).length,
    historicNegativeContactsBlocked: contacts.filter((item) => item.historicNegative).length,
    categoryCounts: {
      sourceRows: {
        canonicalContacts: contacts.length,
        duplicateRows,
        invalidOrMissingEmail
      },
      contactOutcomes,
      campaignHistory: history.categories,
      blockReasons: Object.fromEntries([...reasonCounts.entries()].sort(([a], [b]) => a.localeCompare(b)))
    },
    fieldConflicts,
    redactedSamples: redactedSamples(normalizedRows, contacts, history),
    reconciliation,
    applyAllowed
  };
  const reportDigest = calculateLegacyReportDigest(reportBase);
  const report = Object.freeze({
    ...reportBase,
    reportDigest,
    generatedAt: new Date().toISOString(),
    approval: Object.freeze({
      required: true,
      approved: false,
      approvedBy: null,
      approvedAt: null,
      approvedSourceDigest: sourceDigest,
      approvedReportDigest: reportDigest
    })
  });

  return Object.freeze({
    report,
    contacts: Object.freeze(contacts),
    outlets: Object.freeze(outlets),
    events: Object.freeze(history.events)
  });
}

export async function acquireVerifiedLegacySnapshot(espocrm) {
  const firstRead = await readLegacySource(espocrm);
  const firstAnalysis = analyzeLegacyLeads(firstRead.leads, firstRead.campaignLogs);
  const verifiedRead = await readLegacySource(espocrm);
  const analysis = analyzeLegacyLeads(verifiedRead.leads, verifiedRead.campaignLogs);
  if (firstAnalysis.report.sourceDigest !== analysis.report.sourceDigest) {
    throw Object.assign(new Error("Legacy source changed during snapshot acquisition; rerun the dry-run"), {
      code: "LEGACY_MIGRATION_UNSTABLE_SNAPSHOT",
      retryable: true
    });
  }
  return analysis;
}

export function calculateLegacyReportDigest(report) {
  const { generatedAt: _generatedAt, approval: _approval, reportDigest: _reportDigest, ...material } = report;
  return sha256(stableStringify(material));
}

export function assertApprovedLegacyReport(approved, currentReport) {
  const invalid = (message) => {
    throw Object.assign(new Error(message), { code: "LEGACY_MIGRATION_APPROVAL_INVALID", retryable: false });
  };
  if (!approved || approved.migrationVersion !== LEGACY_MIGRATION_VERSION) invalid("Dry-run report has an unsupported migration version");
  if (approved.applyAllowed !== true || currentReport.applyAllowed !== true) invalid("Dry-run reconciliation does not permit apply");
  if (calculateLegacyReportDigest(approved) !== approved.reportDigest) invalid("Dry-run report contents changed after digest generation");
  if (approved.sourceDigest !== currentReport.sourceDigest || approved.reportDigest !== currentReport.reportDigest) {
    invalid("Dry-run source snapshot changed before apply");
  }
  const approval = approved.approval;
  if (approval?.approved !== true || !optionalText(approval.approvedBy) || !validApprovalTime(approval.approvedAt)) {
    invalid("Dry-run report requires an explicit approver and approval timestamp");
  }
  if (approval.approvedSourceDigest !== currentReport.sourceDigest || approval.approvedReportDigest !== currentReport.reportDigest) {
    invalid("Approval does not bind the current source and report digests");
  }
  return true;
}

export function assertLegacyCanaryGate({
  report,
  expectedSourceDigest,
  expectedReportDigest,
  environmentName,
  killSwitch,
  sendEnabled,
  limit = LEGACY_CANARY_MAX_CONTACTS
}) {
  const invalid = (message) => {
    throw Object.assign(new Error(message), { code: "LEGACY_MIGRATION_CANARY_GATE_FAILED", retryable: false });
  };
  if (!/^[a-f0-9]{64}$/u.test(expectedSourceDigest ?? "") || !/^[a-f0-9]{64}$/u.test(expectedReportDigest ?? "")) {
    invalid("Canary requires independently supplied SHA-256 source and report digests");
  }
  assertApprovedLegacyReport(report, report);
  if (report.sourceDigest !== expectedSourceDigest || report.reportDigest !== expectedReportDigest) {
    invalid("Canary expected digests do not match the approved report");
  }
  if (environmentName !== LEGACY_CANARY_ENVIRONMENT) {
    invalid(`Canary is restricted to ${LEGACY_CANARY_ENVIRONMENT}`);
  }
  if (killSwitch !== "true" || sendEnabled !== "false") {
    invalid("Canary requires OUTREACH_KILL_SWITCH=true and OUTREACH_SEND_ENABLED=false");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > LEGACY_CANARY_MAX_CONTACTS) {
    invalid(`Canary contact limit must be between 1 and ${LEGACY_CANARY_MAX_CONTACTS}`);
  }
  return true;
}

export async function applyLegacyMigration({ analysis, espocrm, repository, logger, limit = Number.POSITIVE_INFINITY, batchSize = 100, startOffset = 0, onCheckpoint }) {
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new TypeError("batchSize must be a positive integer");
  if (!Number.isInteger(startOffset) || startOffset < 0) throw new TypeError("startOffset must be a non-negative integer");
  const selectionLimit = Number.isFinite(limit) ? limit : analysis.contacts.length;
  const contactSelection = analysis.contacts.slice(0, selectionLimit);
  const selectedContactFingerprints = new Set(contactSelection.map((item) => item.contactFingerprint));
  const selectedOutletFingerprints = new Set(contactSelection.map((item) => item.outletFingerprint));
  const outletSelection = analysis.outlets.filter((item) => selectedOutletFingerprints.has(item.outletFingerprint));
  const eventSelection = analysis.events.filter((item) => selectedContactFingerprints.has(item.contactFingerprint));
  const operations = [
    ...outletSelection.map((item) => ({ kind: "outlet", item })),
    ...contactSelection.map((item) => ({ kind: "contact", item })),
    ...eventSelection.map((item) => ({ kind: "event", item }))
  ];
  if (startOffset > operations.length) {
    throw Object.assign(new Error("Legacy migration checkpoint exceeds the approved operation set"), {
      code: "LEGACY_MIGRATION_CHECKPOINT_MISMATCH",
      retryable: false
    });
  }

  const outletIds = new Map();
  const contactIds = new Map();
  for (let offset = startOffset; offset < operations.length; offset += batchSize) {
    const batch = operations.slice(offset, offset + batchSize);
    for (const operation of batch) {
      if (operation.kind === "outlet") {
        const outlet = await espocrm.upsertByUnique("MediaOutlet", "fingerprint", operation.item.outletFingerprint, outletPayload(operation.item));
        outletIds.set(operation.item.outletFingerprint, outlet.id);
      } else if (operation.kind === "contact") {
        const mediaOutletId = await resolveEntityId({
          espocrm,
          cache: outletIds,
          entityType: "MediaOutlet",
          fingerprint: operation.item.outletFingerprint
        });
        const contact = await espocrm.upsertByUnique("MediaContact", "fingerprint", operation.item.contactFingerprint, contactPayload(operation.item, mediaOutletId));
        contactIds.set(operation.item.contactFingerprint, contact.id);
        await reconcilePermanentSuppression({ item: operation.item, contactId: contact.id, espocrm, repository });
      } else {
        const mediaContactId = await resolveEntityId({
          espocrm,
          cache: contactIds,
          entityType: "MediaContact",
          fingerprint: operation.item.contactFingerprint
        });
        await espocrm.upsertByUnique("OutreachEvent", "externalEventId", operation.item.externalEventId, eventPayload(operation.item, mediaContactId));
      }
    }
    const nextOffset = Math.min(offset + batch.length, operations.length);
    const counters = migrationCounters(nextOffset, outletSelection, contactSelection, eventSelection);
    await onCheckpoint?.(nextOffset, counters);
    logger.info({ completedOperations: nextOffset, totalOperations: operations.length, counters }, "legacy Lead migration batch completed");
  }

  const result = migrationCounters(operations.length, outletSelection, contactSelection, eventSelection);
  logger.info({ ...result, migrationVersion: LEGACY_MIGRATION_VERSION }, "legacy Lead migration applied");
  return Object.freeze(result);
}

export function normalizeLegacyLead(lead, historical = {}) {
  const fields = parseDescription(lead.description);
  const email = normalizeEmail(lead.emailAddress ?? lead.email);
  const website = urlValue(lead.website ?? fields.website ?? fields.url ?? fields.source_url);
  const domain = normalizeDomain(website ?? email?.split("@")[1]);
  const outletName = optionalText(lead.accountName ?? lead.companyName ?? fields.station ?? fields.outlet ?? fields.show ?? lead.name) ?? "Legacy media outlet";
  const proofUrl = urlValue(fields.proof_url ?? fields.source_url ?? fields.source ?? website);
  const proofText = optionalText(fields.proof_text ?? fields.contact_evidence ?? fields.evidence ?? fields.submission_policy);
  const inferred = inferPurposeAndBasis(fields, proofText, proofUrl);
  const emailValidationStatus = /^(verified|valid)$/iu.test(fields.verification_status ?? fields.email_validation_status ?? fields.validation ?? "") ? "Valid" : "Unknown";
  const blockReasons = [];
  if (!email) blockReasons.push("email_missing_or_invalid");
  if (!proofUrl) blockReasons.push("proof_url_missing");
  if (!proofText) blockReasons.push("proof_text_missing");
  if (inferred.contactPurpose === "Unknown") blockReasons.push("contact_purpose_unknown");
  if (inferred.contactBasis === "Unknown") blockReasons.push("contact_basis_unknown");
  if (emailValidationStatus !== "Valid") blockReasons.push("email_not_validated");
  if (/no submissions|do not send|blocked/iu.test(`${proofText ?? ""} ${fields.submission_policy ?? ""}`)) blockReasons.push("no_submissions");

  const contactFingerprint = sha256(`email:${email ?? `lead:${lead.id}`}`);
  const outletFingerprint = sha256(`outlet:${domain ?? ""}:${outletName.toLowerCase()}`);
  return Object.freeze({
    sourceIdHash: sha256(`lead:${lead.id}`),
    sourceCursor: Object.freeze({
      modifiedAt: String(lead.modifiedAt ?? lead.createdAt ?? ""),
      id: String(lead.id ?? "")
    }),
    contactFingerprint,
    outletFingerprint,
    email,
    firstName: optionalText(lead.firstName),
    lastName: optionalText(lead.lastName),
    role: optionalText(lead.title ?? fields.role ?? fields.contact_role),
    outletName,
    outletType: inferOutletType(fields, lead),
    website,
    domain,
    country: optionalText(fields.country ?? lead.addressCountry)?.toUpperCase(),
    language: normalizeLanguage(fields.language),
    timezone: optionalText(fields.timezone) ?? "Europe/Amsterdam",
    genres: normalizeGenres(fields.genres ?? fields.genre),
    proofUrl,
    proofText,
    proofCapturedAt: espoDateTime(fields.proof_captured_at ?? fields.captured_at),
    lastValidatedAt: espoDateTime(fields.last_validated_at ?? fields.verified_at ?? lead.modifiedAt),
    contactPurpose: inferred.contactPurpose,
    contactBasis: inferred.contactBasis,
    submissionPolicy: blockReasons.includes("no_submissions") ? "No Submissions" : inferred.submissionPolicy,
    emailValidationStatus,
    qualityScore: boundedInteger(fields.score ?? fields.quality_score),
    blockReasons: Object.freeze([...new Set(blockReasons)].sort()),
    priorSend: Boolean(historical.priorSend),
    historicNegative: Boolean(historical.negativeType),
    historicNegativeType: historical.negativeType,
    historicNegativeAt: historical.negativeAt,
    modifiedAt: lead.modifiedAt ?? lead.createdAt ?? ""
  });
}

export function parseDescription(description) {
  const fields = Object.create(null);
  for (const line of String(description ?? "").split(/\r?\n/u)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase().replace(/[^a-z0-9]+/gu, "_").replace(/^_|_$/gu, "");
    const value = line.slice(separator + 1).trim();
    if (key && value && !fields[key]) fields[key] = value;
  }
  return fields;
}

function inferPurposeAndBasis(fields, proofText, proofUrl) {
  const text = `${fields.contact_purpose ?? ""} ${fields.contact_basis ?? ""} ${proofText ?? ""}`.toLowerCase();
  if (!proofUrl || !proofText) return { contactPurpose: "Unknown", contactBasis: "Unknown", submissionPolicy: "Unknown" };
  if (/press|media enquiries|publicity/u.test(text)) return { contactPurpose: "Press Contact", contactBasis: "Explicit Submission Address", submissionPolicy: "Press Contact" };
  if (/promo|promos/u.test(text)) return { contactPurpose: "Promo Contact", contactBasis: "Explicit Submission Address", submissionPolicy: "Promo Contact" };
  if (/music submissions?|submit (?:your )?music|send (?:us )?music/u.test(text)) return { contactPurpose: "Explicit Music Submission", contactBasis: "Explicit Submission Address", submissionPolicy: "Explicit" };
  if (/opt[ -]?in|consent/u.test(text)) return { contactPurpose: "Explicit Music Submission", contactBasis: "Opt In", submissionPolicy: "Explicit" };
  if (/existing relationship/u.test(text)) return { contactPurpose: "Promo Contact", contactBasis: "Existing Relationship", submissionPolicy: "Promo Contact" };
  return { contactPurpose: "Unknown", contactBasis: "Unknown", submissionPolicy: "Unknown" };
}

function canonicalContact(group) {
  const candidates = [...group].sort(compareCanonicalCandidate);
  const chosen = candidates[0];
  const conflictFields = CONFLICT_FIELDS.filter((field) => new Set(group.map((item) => stableStringify(item[field]))).size > 1);
  let negativeType;
  let negativeAt;
  for (const item of group) {
    const combined = combineNegative(
      { type: negativeType, at: negativeAt },
      { type: item.historicNegativeType, at: item.historicNegativeAt }
    );
    negativeType = combined.type;
    negativeAt = combined.at;
  }
  return Object.freeze({
    ...chosen,
    blockReasons: Object.freeze([...new Set(group.flatMap((item) => item.blockReasons))].sort()),
    submissionPolicy: group.some((item) => item.submissionPolicy === "No Submissions") ? "No Submissions" : chosen.submissionPolicy,
    sourceRowCount: group.length,
    sourceIdHashes: Object.freeze(group.map((item) => item.sourceIdHash).sort()),
    conflictingFields: Object.freeze(conflictFields),
    priorSend: group.some((item) => item.priorSend),
    historicNegative: Boolean(negativeType),
    historicNegativeType: negativeType,
    historicNegativeAt: negativeAt
  });
}

function compareCanonicalCandidate(left, right) {
  return left.blockReasons.length - right.blockReasons.length
    || compareSourceCursor(right, left)
    || left.sourceIdHash.localeCompare(right.sourceIdHash);
}

function compareSourceCursor(left, right) {
  return String(left.sourceCursor?.modifiedAt ?? left.modifiedAt ?? "").localeCompare(String(right.sourceCursor?.modifiedAt ?? right.modifiedAt ?? ""))
    || String(left.sourceCursor?.id ?? "").localeCompare(String(right.sourceCursor?.id ?? ""));
}

function historicalSignals(campaignLogs) {
  const map = new Map();
  for (const record of campaignLogs) {
    if (!record.targetId || (record.targetType && record.targetType !== "Lead")) continue;
    const mapped = mapCampaignAction(record.action ?? record.type);
    if (!mapped) continue;
    const existing = map.get(String(record.targetId)) ?? {};
    const negative = combineNegative(
      { type: existing.negativeType, at: existing.negativeAt },
      { type: mapped.negativeType, at: espoDateTime(record.eventDate ?? record.actionDate ?? record.createdAt ?? record.modifiedAt) }
    );
    map.set(String(record.targetId), {
      priorSend: existing.priorSend || mapped.priorSend,
      negativeType: negative.type,
      negativeAt: negative.at
    });
  }
  return map;
}

function combineNegative(left, right) {
  const rank = { opt_out: 3, spam_complaint: 2, hard_bounce: 1 };
  if ((rank[right.type] ?? 0) > (rank[left.type] ?? 0)) return right;
  if ((rank[right.type] ?? 0) < (rank[left.type] ?? 0)) return left;
  if (!left.type) return { type: undefined, at: undefined };
  const at = [left.at, right.at].filter(Boolean).sort()[0];
  return { type: left.type, at };
}

function mapCampaignAction(value) {
  const action = String(value ?? "").trim().toLowerCase();
  if (/complaint|spam/u.test(action)) return { eventType: "Spam Complaint", negativeType: "spam_complaint", priorSend: true };
  if (/opted.?out|unsubscribe/u.test(action)) return { eventType: "Opted Out", negativeType: "opt_out", priorSend: true };
  if (/hard.?bounce/u.test(action)) return { eventType: "Hard Bounced", negativeType: "hard_bounce", priorSend: true };
  if (/soft.?bounce/u.test(action)) return { eventType: "Soft Bounced", priorSend: true };
  if (/deliver/u.test(action)) return { eventType: "Delivered", priorSend: true };
  if (/open/u.test(action)) return { eventType: "Opened", priorSend: true };
  if (/click/u.test(action)) return { eventType: "Clicked", priorSend: true };
  if (/repl(?:y|ied)/u.test(action)) return { eventType: "Replied", priorSend: true };
  if (/sent|send/u.test(action)) return { eventType: "Sent", priorSend: true };
  return undefined;
}

function analyzeCampaignHistory(campaignLogs, normalizedByLeadId, contactsByFingerprint) {
  const eventsByExternalId = new Map();
  const categories = {
    importableEvents: 0,
    duplicateEventRows: 0,
    identityConflictRows: 0,
    missingTargetRows: 0,
    nonLeadTargetRows: 0,
    unlinkedTargetRows: 0,
    invalidContactRows: 0,
    unsupportedActionRows: 0,
    missingEventDateRows: 0
  };

  for (const record of campaignLogs) {
    if (!record.targetId) {
      categories.missingTargetRows += 1;
      continue;
    }
    if (record.targetType && record.targetType !== "Lead") {
      categories.nonLeadTargetRows += 1;
      continue;
    }
    const normalized = normalizedByLeadId.get(String(record.targetId));
    if (!normalized) {
      categories.unlinkedTargetRows += 1;
      continue;
    }
    const mapped = mapCampaignAction(record.action ?? record.type);
    if (!mapped) {
      categories.unsupportedActionRows += 1;
      continue;
    }
    const eventDate = espoDateTime(record.eventDate ?? record.actionDate ?? record.createdAt ?? record.modifiedAt);
    if (!eventDate) {
      categories.missingEventDateRows += 1;
      continue;
    }
    if (!normalized.email || !contactsByFingerprint.has(normalized.contactFingerprint)) {
      categories.invalidContactRows += 1;
      continue;
    }
    const identityMaterial = record.id
      ? `id:${record.id}`
      : `record:${stableStringify(record)}`;
    const externalEventId = `legacy-campaign-log:${sha256(identityMaterial)}`;
    const event = Object.freeze({
      externalEventId,
      contactFingerprint: normalized.contactFingerprint,
      eventType: mapped.eventType,
      eventDate,
      sourceIdHash: sha256(`campaign-log:${record.id ?? stableStringify(record)}`),
      sourceCursor: Object.freeze({
        modifiedAt: String(record.modifiedAt ?? record.createdAt ?? ""),
        id: String(record.id ?? externalEventId)
      })
    });
    const existing = eventsByExternalId.get(externalEventId);
    if (existing) {
      categories.duplicateEventRows += 1;
      if (stableStringify(existing) !== stableStringify(event)) categories.identityConflictRows += 1;
      continue;
    }
    eventsByExternalId.set(externalEventId, event);
    categories.importableEvents += 1;
  }

  return Object.freeze({
    events: Object.freeze([...eventsByExternalId.values()].sort(compareSourceCursor)),
    categories: Object.freeze(categories)
  });
}

function exclusiveContactOutcomes(contacts) {
  const outcomes = {
    permanentSuppression: 0,
    priorSendQuarantine: 0,
    duplicateConflictQuarantine: 0,
    validationQuarantine: 0,
    baselineManualReviewQuarantine: 0
  };
  for (const contact of contacts) {
    if (NEGATIVE_TYPES.has(contact.historicNegativeType)) outcomes.permanentSuppression += 1;
    else if (contact.priorSend) outcomes.priorSendQuarantine += 1;
    else if (contact.conflictingFields.length) outcomes.duplicateConflictQuarantine += 1;
    else if (contact.blockReasons.length) outcomes.validationQuarantine += 1;
    else outcomes.baselineManualReviewQuarantine += 1;
  }
  return Object.freeze(outcomes);
}

function summarizeFieldConflicts(contacts) {
  const byField = new Map();
  let groupsWithConflicts = 0;
  let totalConflictingFields = 0;
  for (const contact of contacts) {
    if (!contact.conflictingFields.length) continue;
    groupsWithConflicts += 1;
    totalConflictingFields += contact.conflictingFields.length;
    for (const field of contact.conflictingFields) byField.set(field, (byField.get(field) ?? 0) + 1);
  }
  return Object.freeze({
    groupsWithConflicts,
    totalConflictingFields,
    byField: Object.freeze(Object.fromEntries([...byField.entries()].sort(([a], [b]) => a.localeCompare(b))))
  });
}

function redactedSamples(normalizedRows, contacts, history) {
  return Object.freeze({
    invalidRows: Object.freeze(normalizedRows.filter((item) => !item.email).slice(0, SAMPLE_LIMIT).map((item) => ({
      source: item.sourceIdHash.slice(0, 16),
      reasons: item.blockReasons
    }))),
    duplicateContacts: Object.freeze(contacts.filter((item) => item.sourceRowCount > 1).slice(0, SAMPLE_LIMIT).map((item) => ({
      contact: item.contactFingerprint.slice(0, 16),
      sourceRows: item.sourceRowCount,
      conflictingFields: item.conflictingFields
    }))),
    priorSendQuarantine: Object.freeze(contacts.filter((item) => item.priorSend && !item.historicNegative).slice(0, SAMPLE_LIMIT).map((item) => ({
      contact: item.contactFingerprint.slice(0, 16),
      category: "prior_send_quarantine"
    }))),
    permanentSuppressions: Object.freeze(contacts.filter((item) => item.historicNegative).slice(0, SAMPLE_LIMIT).map((item) => ({
      contact: item.contactFingerprint.slice(0, 16),
      reason: item.historicNegativeType
    }))),
    historicalEvents: Object.freeze(history.events.slice(0, SAMPLE_LIMIT).map((event) => ({
      source: event.sourceIdHash.slice(0, 16),
      type: event.eventType,
      date: event.eventDate
    })))
  });
}

function reconciliationReport({ sourceTotal, invalidOrMissingEmail, canonicalContacts, duplicateRows, contactOutcomes, campaignTotal, historyCategories }) {
  const sourceRight = invalidOrMissingEmail + canonicalContacts + duplicateRows;
  const contactRight = Object.values(contactOutcomes).reduce((sum, count) => sum + count, 0);
  const campaignRight = historyCategories.importableEvents
    + historyCategories.duplicateEventRows
    + historyCategories.missingTargetRows
    + historyCategories.nonLeadTargetRows
    + historyCategories.unlinkedTargetRows
    + historyCategories.invalidContactRows
    + historyCategories.unsupportedActionRows
    + historyCategories.missingEventDateRows;
  return Object.freeze({
    sourceRows: Object.freeze({
      equation: "sourceTotal = invalidOrMissingEmail + canonicalContacts + duplicateRows",
      left: sourceTotal,
      right: sourceRight,
      balanced: sourceTotal === sourceRight
    }),
    contactOutcomes: Object.freeze({
      equation: "canonicalContacts = permanentSuppression + priorSendQuarantine + duplicateConflictQuarantine + validationQuarantine + baselineManualReviewQuarantine",
      left: canonicalContacts,
      right: contactRight,
      balanced: canonicalContacts === contactRight
    }),
    campaignHistory: Object.freeze({
      equation: "campaignTotal = importableEvents + duplicateEventRows + missingTargetRows + nonLeadTargetRows + unlinkedTargetRows + invalidContactRows + unsupportedActionRows + missingEventDateRows",
      left: campaignTotal,
      right: campaignRight,
      balanced: campaignTotal === campaignRight
    })
  });
}

function digestSource(leads, campaignLogs) {
  return sha256(stableStringify({ leads, campaignLogs }));
}

async function readLegacySource(espocrm) {
  const [leads, campaignLogs] = await Promise.all([
    collectLegacyEntity(espocrm, "Lead"),
    collectLegacyEntity(espocrm, "CampaignLogRecord")
  ]);
  return Object.freeze({ leads, campaignLogs });
}

async function collectLegacyEntity(espocrm, entityType) {
  if (typeof espocrm.iterate !== "function") {
    return espocrm.list(entityType, { maxRecords: 10_000_000, orderBy: "modifiedAt", order: "asc" });
  }
  const records = [];
  for await (const page of espocrm.iterate(entityType, {
    maxRecords: 10_000_000,
    orderBy: "modifiedAt",
    order: "asc"
  })) records.push(...page);
  return records;
}

function stableRecordOrder(records) {
  return [...records].sort((left, right) => {
    const modifiedOrder = String(left.modifiedAt ?? left.createdAt ?? "").localeCompare(String(right.modifiedAt ?? right.createdAt ?? ""));
    if (modifiedOrder) return modifiedOrder;
    const idOrder = String(left.id ?? "").localeCompare(String(right.id ?? ""));
    return idOrder || stableStringify(left).localeCompare(stableStringify(right));
  });
}

function outletPayload(item) {
  return {
    name: item.outletName.slice(0, 180),
    type: item.outletType,
    website: item.website,
    normalizedDomain: item.domain,
    country: item.country?.slice(0, 100),
    language: item.language,
    timezone: item.timezone,
    genres: item.genres,
    submissionPolicy: item.submissionPolicy,
    submissionUrl: item.proofUrl,
    submissionEvidence: item.proofText,
    acceptsEmail: item.submissionPolicy !== "No Submissions" && (item.submissionPolicy === "Explicit" || item.contactPurpose === "Promo Contact" || item.contactPurpose === "Press Contact"),
    activityStatus: item.domain && item.submissionPolicy !== "No Submissions" ? "Active" : "Needs Validation",
    lastValidatedAt: item.lastValidatedAt,
    sourceUrl: item.proofUrl,
    qualityScore: item.qualityScore,
    fingerprint: item.outletFingerprint,
    description: `Migrated from legacy Lead staging by ${LEGACY_MIGRATION_VERSION}.`
  };
}

function contactPayload(item, mediaOutletId) {
  return {
    firstName: item.firstName?.slice(0, 100),
    lastName: String(item.lastName ?? item.outletName).slice(0, 100),
    emailAddress: item.email,
    role: item.role?.slice(0, 160),
    contactSourceUrl: item.proofUrl,
    contactEvidence: item.proofText,
    contactPurpose: item.contactPurpose,
    contactBasis: item.contactBasis,
    proofUrl: item.proofUrl,
    proofText: item.proofText,
    proofCapturedAt: item.proofCapturedAt,
    emailValidationStatus: item.emailValidationStatus,
    smtpValidationStatus: "Unknown",
    lastValidatedAt: item.lastValidatedAt,
    doNotContact: true,
    hardBounced: item.historicNegativeType === "hard_bounce",
    optedOut: item.historicNegativeType === "opt_out",
    preferredLanguage: item.language,
    timezone: item.timezone,
    status: "Needs Validation",
    fingerprint: item.contactFingerprint,
    mediaOutletId
  };
}

function eventPayload(item, mediaContactId) {
  return {
    name: `Legacy ${item.eventType}`.slice(0, 180),
    eventType: item.eventType,
    eventDate: item.eventDate,
    externalEventId: item.externalEventId,
    correlationId: `legacy:${item.sourceIdHash.slice(0, 32)}`,
    mediaContactId,
    details: stableStringify({
      migrationVersion: LEGACY_MIGRATION_VERSION,
      source: "CampaignLogRecord",
      sourceIdHash: item.sourceIdHash
    })
  };
}

async function reconcilePermanentSuppression({ item, contactId, espocrm, repository }) {
  if (!repository || !NEGATIVE_TYPES.has(item.historicNegativeType)) return;
  const reason = item.historicNegativeType;
  const subjectHash = await repository.suppress({ subjectType: "contact", subject: contactId, reason, source: LEGACY_MIGRATION_VERSION });
  await espocrm.upsertByUnique("OutreachSuppression", "subjectHash", subjectHash, {
    name: `${reason}: migrated contact`.slice(0, 180),
    subjectHash,
    subjectType: "contact",
    reason,
    source: LEGACY_MIGRATION_VERSION,
    active: true,
    suppressedAt: item.historicNegativeAt ?? espoDateTime(item.modifiedAt) ?? "1970-01-01 00:00:00",
    mediaContactId: contactId
  });
}

async function resolveEntityId({ espocrm, cache, entityType, fingerprint }) {
  const cached = cache.get(fingerprint);
  if (cached) return cached;
  if (typeof espocrm.findOne !== "function") {
    throw Object.assign(new Error(`${entityType} lookup is required to resume legacy migration`), {
      code: "LEGACY_MIGRATION_RESUME_LOOKUP_UNAVAILABLE",
      retryable: false
    });
  }
  const record = await espocrm.findOne(entityType, "fingerprint", fingerprint, ["id"]);
  if (!record?.id) {
    throw Object.assign(new Error(`${entityType} checkpoint dependency is missing`), {
      code: "LEGACY_MIGRATION_CHECKPOINT_DEPENDENCY_MISSING",
      retryable: false
    });
  }
  cache.set(fingerprint, record.id);
  return record.id;
}

function migrationCounters(nextOffset, outlets, contacts, events) {
  const outletsUpserted = Math.min(nextOffset, outlets.length);
  const contactsUpserted = Math.min(Math.max(nextOffset - outlets.length, 0), contacts.length);
  const eventsUpserted = Math.min(Math.max(nextOffset - outlets.length - contacts.length, 0), events.length);
  return Object.freeze({
    outletsUpserted,
    contactsUpserted,
    eventsUpserted,
    permanentSuppressionsUpserted: contacts.slice(0, contactsUpserted).filter((item) => NEGATIVE_TYPES.has(item.historicNegativeType)).length,
    completedOperations: nextOffset,
    totalOperations: outlets.length + contacts.length + events.length
  });
}

function validApprovalTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function stableStringify(value) {
  return JSON.stringify(canonicalValue(value));
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function urlValue(value) {
  const text = optionalText(value);
  if (!text) return undefined;
  try {
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/iu.test(key)) url.searchParams.delete(key);
    const normalized = url.toString();
    return normalized.length <= 512 ? normalized : undefined;
  } catch {
    return undefined;
  }
}

function inferOutletType(fields, lead) {
  const text = `${fields.type ?? ""} ${fields.category ?? ""} ${lead.description ?? ""}`.toLowerCase();
  if (/radio show|programme|program/u.test(text)) return "Radio Show";
  if (/radio|station/u.test(text)) return "Radio Station";
  if (/\bdj\b/u.test(text)) return "DJ";
  if (/blog/u.test(text)) return "Music Blog";
  if (/playlist/u.test(text)) return "Playlist Curator";
  if (/label/u.test(text)) return "Label";
  return "Submission Platform";
}

function normalizeLanguage(value) {
  const language = optionalText(value)?.toLowerCase().slice(0, 2);
  return ["nl", "en", "de", "fr", "es", "pt"].includes(language) ? language : "en";
}

function normalizeGenres(value) {
  const options = new Map([
    ["ambient", "Ambient"], ["dance", "Dance"], ["electronic", "Electronic"],
    ["hip hop", "Hip Hop"], ["hip-hop", "Hip Hop"], ["indie", "Indie"],
    ["latin", "Latin"], ["pop", "Pop"], ["reggae", "Reggae"],
    ["rock", "Rock"], ["world", "World"]
  ]);
  const mapped = String(value ?? "").split(/[;,|]/u).map((item) => options.get(item.trim().toLowerCase()) ?? (item.trim() ? "Other" : undefined)).filter(Boolean);
  return [...new Set(mapped)].slice(0, 20);
}

function espoDateTime(value) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 19).replace("T", " ") : undefined;
}

function boundedInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

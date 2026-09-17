import test from "node:test";
import assert from "node:assert/strict";

import { createCrmProjectionService } from "../src/application/crm-projection-service.mjs";
import { evaluateContactEvidence, evaluateOutletEvidence } from "../src/domain/evidence-policy.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";

const logger = Object.freeze({ info() {}, warn() {}, error() {} });
const config = Object.freeze({
  mailgun: Object.freeze({ from: "Marc Rene <outreach@mail.example.test>" }),
  policy: Object.freeze({ maxFollowUps: 2, cooldownDays: 21 })
});

function baseGraph() {
  const graph = {
    OutreachMatch: {
      id: "match-1",
      musicReleaseId: "release-1",
      mediaContactId: "contact-1",
      mediaOutletId: "outlet-1",
      campaignStatus: "Ready",
      versionNumber: 1
    },
    MusicRelease: {
      id: "release-1",
      name: "Northern Lights",
      artistName: "Marc Rene",
      status: "Active",
      genres: ["Indie"],
      epkUrl: "https://artist.example.test/epk/northern-lights",
      campaignStartDate: "2026-07-01",
      campaignEndDate: "2026-08-01"
    },
    MediaContact: {
      id: "contact-1",
      name: "Sam Editor",
      emailAddress: "editor@radio.example.test",
      preferredLanguage: "en",
      timezone: "Europe/Amsterdam",
      contactBasis: "Explicit Submission Address",
      contactPurpose: "Explicit Music Submission",
      contactSourceUrl: "https://radio.example.test/submissions",
      contactEvidence: "The station publishes this address for music submissions.",
      proofCapturedAt: "2026-07-15T09:00:00.000Z",
      emailValidationStatus: "Valid",
      status: "Active",
      doNotContact: false,
      optedOut: false,
      rejectedGenres: ["Rock"],
      versionNumber: 3
    },
    MediaOutlet: {
      id: "outlet-1",
      name: "Example Radio",
      website: "https://radio.example.test",
      country: "NL",
      timezone: "Europe/Amsterdam",
      submissionPolicy: "Explicit",
      sourceUrl: "https://radio.example.test/submissions",
      submissionEvidence: "The station accepts music submissions by email.",
      lastValidatedAt: "2026-07-15T09:00:00.000Z",
      acceptsEmail: true,
      activityStatus: "Active",
      versionNumber: 2
    }
  };
  graph.MediaContact.evidenceAttestation = activeAttestation(evaluateContactEvidence({
    entityId: graph.MediaContact.id,
    entityVersion: graph.MediaContact.versionNumber,
    email: graph.MediaContact.emailAddress,
    purpose: graph.MediaContact.contactPurpose,
    basis: graph.MediaContact.contactBasis,
    sourceUrl: graph.MediaContact.contactSourceUrl,
    evidenceText: graph.MediaContact.contactEvidence,
    capturedAt: graph.MediaContact.proofCapturedAt,
    now: new Date("2026-07-15T09:30:00.000Z"),
    sourceKind: "signed_source"
  }));
  graph.MediaOutlet.evidenceAttestation = activeAttestation(evaluateOutletEvidence({
    entityId: graph.MediaOutlet.id,
    entityVersion: graph.MediaOutlet.versionNumber,
    submissionPolicy: graph.MediaOutlet.submissionPolicy,
    sourceUrl: graph.MediaOutlet.sourceUrl,
    evidenceText: graph.MediaOutlet.submissionEvidence,
    capturedAt: graph.MediaOutlet.lastValidatedAt,
    now: new Date("2026-07-15T09:30:00.000Z"),
    sourceKind: "signed_source"
  }));
  return graph;
}

function activeAttestation(evaluation) {
  return Object.freeze({
    ...evaluation.attestation,
    evidenceDigest: evaluation.digest,
    status: "active",
    sourceKind: "signed_source",
    originCompleted: true
  });
}

function withContactAttestation(contact) {
  return {
    ...contact,
    evidenceAttestation: activeAttestation(evaluateContactEvidence({
      entityId: contact.id,
      entityVersion: contact.versionNumber,
      email: contact.emailAddress,
      purpose: contact.contactPurpose,
      basis: contact.contactBasis,
      sourceUrl: contact.contactSourceUrl,
      evidenceText: contact.contactEvidence,
      capturedAt: contact.proofCapturedAt,
      now: new Date("2026-07-15T09:30:00.000Z"),
      sourceKind: "signed_source"
    }))
  };
}

test("confirmed delivery replay creates exactly one Campaign, Email and immutable OutreachEvent", async () => {
  const graph = baseGraph();
  const sendQueueId = "11111111-1111-4111-8111-111111111111";
  const projection = {
    send_queue_id: sendQueueId,
    match_id: "match-1",
    release_id: "release-1",
    contact_id: "contact-1",
    outlet_id: "outlet-1",
    provider_message_id: "<provider-1@mailgun.test>",
    deterministic_message_id: "<deterministic-1@mail.example.test>",
    correlation_id: "correlation-1",
    accepted_at: "2026-07-15T09:30:00.000Z",
    campaign_projection_key: "music-release:release-1",
    email_projection_key: `send:${sendQueueId}`,
    event_projection_key: `sent:${sendQueueId}`,
    status: "pending"
  };
  const queueItem = {
    id: sendQueueId,
    match_id: "match-1",
    release_id: "release-1",
    contact_id: "contact-1",
    outlet_id: "outlet-1",
    status: "sent",
    sequence_step: 0,
    copy_artifact_id: "copy-1",
    provider_message_id: projection.provider_message_id,
    deterministic_message_id: projection.deterministic_message_id,
    sent_at: projection.accepted_at
  };
  const created = new Map();
  const entityRecords = new Map();
  const relations = new Set();
  const creates = [];
  const upserts = [];
  const repository = {
    async beginCrmDeliveryProjection() { return { ...projection }; },
    async getSend() { return queueItem; },
    async readCopyArtifact() {
      return {
        subject: "A safe subject",
        bodyText: "A safe body",
        templateVersion: "structured-template-v3",
        promptVersion: "outreach-copy-v3"
      };
    },
    async isSuppressed() { return false; },
    async hasContactGenreDenial() { return false; },
    async enqueueWork() {},
    async completeCrmDeliveryProjection(value) {
      return { ...projection, ...value };
    }
  };
  const espocrm = {
    async get(entityType) { return entityRecords.get(entityType) ?? graph[entityType]; },
    async findOne(entityType, _attribute, value) {
      return entityRecords.get(`${entityType}:${value}`);
    },
    async create(entityType, payload) {
      const key = `${entityType}:${payload.outreachProjectionKey}`;
      if (entityRecords.has(key)) {
        throw Object.assign(new Error("unique conflict"), { statusCode: 409, code: "ESPOCRM_HTTP_409" });
      }
      const record = {
        id: entityType === "TargetList" ? "target-list-1" : `${entityType.toLowerCase()}-1`,
        versionNumber: 1,
        ...payload
      };
      entityRecords.set(key, record);
      entityRecords.set(entityType, record);
      creates.push({ entityType, payload });
      return record;
    },
    async relateUnique(entityType, id, link, foreignId) {
      const key = `${entityType}:${id}:${link}:${foreignId}`;
      const added = !relations.has(key);
      relations.add(key);
      return added;
    },
    async countLinked(entityType, id, link) {
      return [...relations].filter((key) => key.startsWith(`${entityType}:${id}:${link}:`)).length;
    },
    async upsertByUnique(entityType, attribute, value, payload) {
      const key = `${entityType}:${value}`;
      if (created.has(key)) return created.get(key);
      const record = { id: `${entityType.toLowerCase()}-1`, ...payload };
      created.set(key, record);
      upserts.push({ entityType, attribute, value, payload });
      return record;
    },
    async updateConditional(entityType, id, patch, versionNumber) {
      if (entityType === "OutreachMatch") {
        assert.equal(versionNumber, graph.OutreachMatch.versionNumber);
        graph.OutreachMatch = { ...graph.OutreachMatch, ...patch, versionNumber: versionNumber + 1 };
        return graph.OutreachMatch;
      }
      const record = entityRecords.get(entityType);
      assert.equal(id, record.id);
      assert.equal(versionNumber, record.versionNumber);
      const updated = { ...record, ...patch, versionNumber: versionNumber + 1 };
      entityRecords.set(entityType, updated);
      entityRecords.set(`${entityType}:${updated.outreachProjectionKey}`, updated);
      return updated;
    }
  };
  const service = createCrmProjectionService({ espocrm, repository, config, logger, metrics: new Metrics() });
  const work = {
    entity_id: "match-1",
    payload: {
      sendQueueId,
      providerMessageId: projection.provider_message_id,
      correlationId: projection.correlation_id,
      sequenceStep: 0,
      acceptedAt: projection.accepted_at
    }
  };

  await service.syncDeliveryToCrm(work);
  await service.syncDeliveryToCrm(work);

  assert.deepEqual(creates.map(({ entityType }) => entityType), ["TargetList", "Campaign"]);
  assert.deepEqual(upserts.map(({ entityType }) => entityType), ["Email", "OutreachEvent"]);
  const campaign = creates.find(({ entityType }) => entityType === "Campaign").payload;
  assert.equal(campaign.musicReleaseId, "release-1");
  assert.equal(campaign.outreachTargetListId, "target-list-1");
  assert.equal(campaign.targetMembershipProjectionState, "Projected");
  assert.equal(campaign.targetMembershipCount, 1);
  assert.ok(relations.has("TargetList:target-list-1:mediaContacts:contact-1"));
  assert.ok(relations.has("Campaign:campaign-1:targetLists:target-list-1"));
  const email = upserts.find(({ entityType }) => entityType === "Email").payload;
  assert.equal(email.status, "Sent");
  assert.equal(email.outreachProviderMessageId, projection.provider_message_id);
  assert.equal(email.outreachDeterministicMessageId, projection.deterministic_message_id);
  assert.equal(email.outreachCorrelationId, projection.correlation_id);
  assert.equal(email.from, "outreach@mail.example.test");
  assert.equal(email.fromString, "outreach@mail.example.test");
  assert.equal(email.to, graph.MediaContact.emailAddress);
  assert.equal(email.parentType, "OutreachMatch");
  const event = upserts.find(({ entityType }) => entityType === "OutreachEvent").payload;
  assert.equal(event.messageId, projection.deterministic_message_id);
  assert.equal(event.providerMessageId, projection.provider_message_id);
  assert.equal(event.correlationId, projection.correlation_id);
  assert.equal(event.templateVersion, "structured-template-v3");
  assert.equal(event.aiPromptVersion, "outreach-copy-v3");
  assert.equal(JSON.parse(event.details).targetListStatus, "included");
  assert.equal(JSON.parse(event.details).targetListMembershipCount, 1);
  assert.equal(graph.OutreachMatch.campaignId, "campaign-1");
  assert.equal(graph.OutreachMatch.campaignStatus, "Sent 1");
});

test("concurrent deliveries converge on one TargetList and Campaign with only currently eligible contacts", async () => {
  const graph = baseGraph();
  const contacts = new Map([
    ["contact-1", graph.MediaContact],
    ["contact-2", withContactAttestation({ ...graph.MediaContact, id: "contact-2", emailAddress: "second@radio.example.test" })],
    ["contact-3", withContactAttestation({ ...graph.MediaContact, id: "contact-3", emailAddress: "opted-out@radio.example.test", optedOut: true })]
  ]);
  const matches = new Map([...contacts.keys()].map((contactId, index) => {
    const suffix = index + 1;
    return [`match-${suffix}`, {
      ...graph.OutreachMatch,
      id: `match-${suffix}`,
      mediaContactId: contactId,
      versionNumber: 1
    }];
  }));
  const acceptedAt = [
    "2026-07-15T09:30:00.000Z",
    "2026-07-15T09:31:00.000Z",
    "2026-07-15T09:32:00.000Z"
  ];
  const sends = new Map(acceptedAt.map((timestamp, index) => {
    const suffix = index + 1;
    return [`send-${suffix}`, {
      id: `send-${suffix}`,
      match_id: `match-${suffix}`,
      release_id: "release-1",
      contact_id: `contact-${suffix}`,
      outlet_id: "outlet-1",
      status: "sent",
      sequence_step: 0,
      copy_artifact_id: "copy-1",
      provider_message_id: `<provider-${suffix}@mailgun.test>`,
      deterministic_message_id: `<deterministic-${suffix}@mail.example.test>`,
      sent_at: timestamp
    }];
  }));
  const projections = new Map([...sends.values()].map((send, index) => [send.id, {
    send_queue_id: send.id,
    match_id: send.match_id,
    release_id: send.release_id,
    contact_id: send.contact_id,
    outlet_id: send.outlet_id,
    provider_message_id: send.provider_message_id,
    deterministic_message_id: send.deterministic_message_id,
    correlation_id: `correlation-${index + 1}`,
    accepted_at: send.sent_at,
    email_projection_key: `send:${send.id}`,
    event_projection_key: `sent:${send.id}`,
    status: "pending"
  }]));
  let targetList;
  let campaign;
  const immutable = new Map();
  const relations = new Set();
  const createAttempts = { TargetList: 0, Campaign: 0 };
  const createSuccesses = { TargetList: 0, Campaign: 0 };
  let targetInitialLookups = 0;
  let campaignInitialLookups = 0;
  let releaseTargetLookups;
  let releaseCampaignLookups;
  const targetLookupBarrier = new Promise((resolve) => { releaseTargetLookups = resolve; });
  const campaignLookupBarrier = new Promise((resolve) => { releaseCampaignLookups = resolve; });

  const repository = {
    async beginCrmDeliveryProjection(id) { return { ...projections.get(id) }; },
    async getSend(id) { return sends.get(id); },
    async readCopyArtifact() {
      return { subject: "Safe", bodyText: "Body", templateVersion: "template-v1", promptVersion: "prompt-v1" };
    },
    async isSuppressed() { return false; },
    async hasContactGenreDenial() { return false; },
    async completeCrmDeliveryProjection(value) { return value; },
    async enqueueWork() {}
  };
  const espocrm = {
    async get(entityType, id) {
      if (entityType === "TargetList") return targetList;
      if (entityType === "Campaign") return campaign;
      if (entityType === "OutreachMatch") return matches.get(id);
      if (entityType === "MediaContact") return contacts.get(id);
      if (entityType === "MusicRelease") return graph.MusicRelease;
      if (entityType === "MediaOutlet") return graph.MediaOutlet;
      throw new Error(`unexpected get ${entityType}`);
    },
    async findOne(entityType, _attribute, value) {
      if (entityType === "TargetList") {
        if (!targetList && targetInitialLookups < 2) {
          targetInitialLookups += 1;
          if (targetInitialLookups === 2) releaseTargetLookups();
          await targetLookupBarrier;
          return undefined;
        }
        return targetList?.outreachProjectionKey === value ? targetList : undefined;
      }
      if (entityType === "Campaign") {
        if (!campaign && campaignInitialLookups < 2) {
          campaignInitialLookups += 1;
          if (campaignInitialLookups === 2) releaseCampaignLookups();
          await campaignLookupBarrier;
          return undefined;
        }
        return campaign?.outreachProjectionKey === value ? campaign : undefined;
      }
      return undefined;
    },
    async create(entityType, payload) {
      createAttempts[entityType] += 1;
      if (entityType === "TargetList") {
        if (targetList) throw Object.assign(new Error("unique conflict"), { statusCode: 409, code: "ESPOCRM_HTTP_409" });
        createSuccesses.TargetList += 1;
        targetList = { id: "target-list-1", versionNumber: 1, ...payload };
        return targetList;
      }
      if (entityType === "Campaign") {
        if (campaign) throw Object.assign(new Error("unique conflict"), { statusCode: 409, code: "ESPOCRM_HTTP_409" });
        createSuccesses.Campaign += 1;
        campaign = { id: "campaign-1", versionNumber: 1, ...payload };
        return campaign;
      }
      throw new Error(`unexpected create ${entityType}`);
    },
    async upsertByUnique(entityType, _attribute, value, payload) {
      const key = `${entityType}:${value}`;
      if (!immutable.has(key)) immutable.set(key, { id: `${entityType.toLowerCase()}-${immutable.size + 1}`, ...payload });
      return immutable.get(key);
    },
    async relateUnique(entityType, id, link, foreignId) {
      const key = `${entityType}:${id}:${link}:${foreignId}`;
      const added = !relations.has(key);
      relations.add(key);
      return added;
    },
    async countLinked(entityType, id, link) {
      return [...relations].filter((key) => key.startsWith(`${entityType}:${id}:${link}:`)).length;
    },
    async updateConditional(entityType, id, patch, versionNumber) {
      if (entityType === "TargetList") {
        if (versionNumber !== targetList.versionNumber) {
          throw Object.assign(new Error("version conflict"), { statusCode: 409, code: "ESPOCRM_VERSION_CONFLICT" });
        }
        targetList = { ...targetList, ...patch, versionNumber: versionNumber + 1 };
        return targetList;
      }
      if (entityType === "Campaign") {
        if (versionNumber !== campaign.versionNumber) {
          throw Object.assign(new Error("version conflict"), { statusCode: 409, code: "ESPOCRM_VERSION_CONFLICT" });
        }
        campaign = { ...campaign, ...patch, versionNumber: versionNumber + 1 };
        return campaign;
      }
      const match = matches.get(id);
      if (versionNumber !== match.versionNumber) {
        throw Object.assign(new Error("version conflict"), { statusCode: 409, code: "ESPOCRM_VERSION_CONFLICT" });
      }
      const updated = { ...match, ...patch, versionNumber: versionNumber + 1 };
      matches.set(id, updated);
      return updated;
    }
  };
  const service = createCrmProjectionService({ espocrm, repository, config, logger, metrics: new Metrics() });
  const work = (suffix) => {
    const projection = projections.get(`send-${suffix}`);
    return {
      entity_id: `match-${suffix}`,
      payload: {
        sendQueueId: `send-${suffix}`,
        providerMessageId: projection.provider_message_id,
        correlationId: projection.correlation_id
      }
    };
  };

  await Promise.all([service.syncDeliveryToCrm(work(1)), service.syncDeliveryToCrm(work(2))]);
  await service.syncDeliveryToCrm(work(3));
  await Promise.all([service.syncDeliveryToCrm(work(1)), service.syncDeliveryToCrm(work(2)), service.syncDeliveryToCrm(work(3))]);

  assert.deepEqual(createSuccesses, { TargetList: 1, Campaign: 1 });
  assert.equal(createAttempts.TargetList, 2);
  assert.equal(createAttempts.Campaign, 2);
  assert.ok(relations.has("TargetList:target-list-1:mediaContacts:contact-1"));
  assert.ok(relations.has("TargetList:target-list-1:mediaContacts:contact-2"));
  assert.ok(!relations.has("TargetList:target-list-1:mediaContacts:contact-3"));
  assert.equal([...relations].filter((key) => key.startsWith("TargetList:target-list-1:mediaContacts:")).length, 2);
  assert.equal([...relations].filter((key) => key === "Campaign:campaign-1:targetLists:target-list-1").length, 1);
  assert.equal(campaign.targetMembershipCount, 2);
  assert.equal(campaign.targetMembershipProjectionState, "Projected");
  assert.equal(campaign.targetMembershipReasonCode, "eligibility_exclusion_applied");
  assert.equal(campaign.targetMembershipCheckedAt, "2026-07-15 09:32:00");
  assert.equal(targetList.outreachCampaignId, "campaign-1");
  assert.equal(targetList.membershipProjectedAt, "2026-07-15 09:32:00");
  assert.equal([...immutable.keys()].filter((key) => key.startsWith("Email:")).length, 3);
  assert.equal([...immutable.keys()].filter((key) => key.startsWith("OutreachEvent:")).length, 3);
});

test("every positive reply projects exactly one linked Opportunity without invented revenue", async () => {
  for (const [classification, interest] of [
    ["Interested", "Interested"],
    ["Send MP3/WAV", "Asset Requested"],
    ["Send Clean Version", "Asset Requested"],
    ["Placement Confirmed", "Placement Confirmed"],
    ["Will Consider", "Warm"]
  ]) {
    const graph = baseGraph();
    let opportunityRecord;
    const opportunityCreates = [];
    const repository = replyRepository();
    const espocrm = replyEspo(graph, {
      upsert(entityType, value, payload) {
        if (entityType === "Campaign") return { id: "campaign-1", ...payload };
        throw new Error(`unexpected ${entityType}:${value}`);
      },
      findOpportunity() {
        return opportunityRecord;
      },
      create(entityType, payload) {
        assert.equal(entityType, "Opportunity");
        opportunityRecord = { id: "opportunity-1", versionNumber: 1, ...payload };
        opportunityCreates.push(payload);
        return opportunityRecord;
      }
    });
    const service = createCrmProjectionService({ espocrm, repository, config, logger, metrics: new Metrics() });
    const work = replyWork(classification);

    await service.projectReplyBusinessAction(work);
    await service.projectReplyBusinessAction(work);

    assert.equal(opportunityCreates.length, 1, classification);
    const opportunityPayload = opportunityCreates[0];
    assert.equal(opportunityPayload.outreachProjectionKey, "match:match-1");
    assert.equal(opportunityPayload.outreachMatchId, "match-1");
    assert.equal(opportunityPayload.musicReleaseId, "release-1");
    assert.equal(opportunityPayload.mediaContactId, "contact-1");
    assert.equal(opportunityPayload.mediaOutletId, "outlet-1");
    assert.equal(opportunityPayload.campaignId, "campaign-1");
    assert.equal(opportunityPayload.sourceOutreachEventId, "event-1");
    assert.equal(opportunityPayload.latestOutreachEventId, "event-1");
    assert.equal(opportunityPayload.outreachInterestStatus, interest);
    assert.equal(opportunityPayload.outreachRevenueState, "Unspecified");
    assert.equal("amount" in opportunityPayload, false);
    assert.equal("probability" in opportunityPayload, false);
    assert.equal("closeDate" in opportunityPayload, false);
  }
});

test("a later stronger reply advances one Opportunity without replacing its origin or human revenue", async () => {
  const graph = baseGraph();
  let opportunity;
  let creates = 0;
  let updates = 0;
  const repository = replyRepository();
  const espocrm = replyEspo(graph, {
    upsert(entityType, _value, payload) {
      assert.equal(entityType, "Campaign");
      return { id: "campaign-1", ...payload };
    },
    findEvent(value) {
      return {
        id: value === "reply-placement" ? "event-2" : "event-1",
        eventDate: value === "reply-placement" ? "2026-07-16 10:00:00" : "2026-07-15 09:30:00"
      };
    },
    findOpportunity() {
      return opportunity;
    },
    create(entityType, payload) {
      assert.equal(entityType, "Opportunity");
      creates += 1;
      opportunity = { id: "opportunity-1", versionNumber: 1, ...payload };
      return opportunity;
    },
    updateConditional(entityType, id, patch, versionNumber) {
      assert.equal(entityType, "Opportunity");
      assert.equal(id, "opportunity-1");
      assert.equal(versionNumber, opportunity.versionNumber);
      updates += 1;
      opportunity = { ...opportunity, ...patch, versionNumber: versionNumber + 1 };
      return opportunity;
    }
  });
  const service = createCrmProjectionService({ espocrm, repository, config, logger, metrics: new Metrics() });

  await service.projectReplyBusinessAction(replyWork("Will Consider", { sourceEventId: "reply-warm" }));
  opportunity = { ...opportunity, outreachRevenueState: "Human Confirmed", amount: 750 };
  await service.projectReplyBusinessAction(replyWork("Placement Confirmed", { sourceEventId: "reply-placement" }));
  await service.projectReplyBusinessAction(replyWork("Placement Confirmed", { sourceEventId: "reply-placement" }));

  assert.equal(creates, 1);
  assert.equal(updates, 1);
  assert.equal(opportunity.sourceOutreachEventId, "event-1");
  assert.equal(opportunity.latestOutreachEventId, "event-2");
  assert.equal(opportunity.outreachInterestStatus, "Placement Confirmed");
  assert.equal(opportunity.outreachRevenueState, "Human Confirmed");
  assert.equal(opportunity.amount, 750);
});

test("concurrent positive replies converge on one strongest Opportunity", async () => {
  const graph = baseGraph();
  let opportunity;
  let initialLookups = 0;
  let releaseInitialLookups;
  const initialLookupBarrier = new Promise((resolve) => { releaseInitialLookups = resolve; });
  let createAttempts = 0;
  let createSuccesses = 0;
  const repository = replyRepository();
  const espocrm = replyEspo(graph, {
    upsert(entityType, _value, payload) {
      assert.equal(entityType, "Campaign");
      return { id: "campaign-1", ...payload };
    },
    findEvent(value) {
      return {
        id: value === "reply-placement" ? "event-placement" : "event-interested",
        eventDate: value === "reply-placement" ? "2026-07-16 10:00:00" : "2026-07-15 09:30:00"
      };
    },
    async findOpportunity() {
      if (!opportunity && initialLookups < 2) {
        initialLookups += 1;
        if (initialLookups === 2) releaseInitialLookups();
        await initialLookupBarrier;
        return undefined;
      }
      return opportunity;
    },
    create(entityType, payload) {
      assert.equal(entityType, "Opportunity");
      createAttempts += 1;
      if (opportunity) {
        throw Object.assign(new Error("unique conflict"), { statusCode: 409, code: "ESPOCRM_HTTP_409" });
      }
      createSuccesses += 1;
      opportunity = { id: "opportunity-1", versionNumber: 1, ...payload };
      return opportunity;
    },
    updateConditional(entityType, _id, patch, versionNumber) {
      assert.equal(entityType, "Opportunity");
      if (versionNumber !== opportunity.versionNumber) {
        throw Object.assign(new Error("version conflict"), { statusCode: 409, code: "ESPOCRM_VERSION_CONFLICT" });
      }
      opportunity = { ...opportunity, ...patch, versionNumber: versionNumber + 1 };
      return opportunity;
    }
  });
  const service = createCrmProjectionService({ espocrm, repository, config, logger, metrics: new Metrics() });

  await Promise.all([
    service.projectReplyBusinessAction(replyWork("Interested", { sourceEventId: "reply-interested" })),
    service.projectReplyBusinessAction(replyWork("Placement Confirmed", { sourceEventId: "reply-placement" }))
  ]);

  assert.equal(initialLookups, 2);
  assert.equal(createAttempts, 2);
  assert.equal(createSuccesses, 1);
  assert.equal(opportunity.outreachProjectionKey, "match:match-1");
  assert.equal(opportunity.outreachInterestStatus, "Placement Confirmed");
  assert.equal(opportunity.outreachRevenueState, "Unspecified");
  assert.equal("amount" in opportunity, false);
  assert.equal("closeDate" in opportunity, false);
});

test("concurrent Not Suitable projections preserve a deny-safe genre union under one contact fence", async () => {
  const graph = baseGraph();
  graph.OutreachMatch = {
    ...graph.OutreachMatch,
    campaignStatus: "Rejected"
  };
  graph.MusicRelease2 = { ...graph.MusicRelease, id: "release-2", genres: ["Electronic"] };
  const queues = new Map([
    ["send-1", { id: "send-1", status: "sent", match_id: "match-1", release_id: "release-1", contact_id: "contact-1", outlet_id: "outlet-1" }],
    ["send-2", { id: "send-2", status: "sent", match_id: "match-2", release_id: "release-2", contact_id: "contact-1", outlet_id: "outlet-1" }]
  ]);
  const matches = {
    "match-1": graph.OutreachMatch,
    "match-2": { ...graph.OutreachMatch, id: "match-2", musicReleaseId: "release-2" }
  };
  const denials = [];
  let fence = Promise.resolve();
  const repository = {
    async getSend(id) { return queues.get(id); },
    async enqueueHumanReview() { return "review-1"; },
    async recordContactGenreDenials(value) { denials.push(value); },
    withSendAuthorizationFence(_identity, work) {
      const next = fence.then(work);
      fence = next.catch(() => {});
      return next;
    }
  };
  const updates = [];
  const espocrm = {
    async get(entityType, id) {
      if (entityType === "OutreachMatch") return matches[id];
      if (entityType === "MusicRelease") return id === "release-2" ? graph.MusicRelease2 : graph.MusicRelease;
      return graph[entityType];
    },
    async findOne(_entityType, _attribute, value) { return { id: value.endsWith("2") ? "event-2" : "event-1", eventDate: "2026-07-15 09:30:00" }; },
    async updateConditional(entityType, id, patch, versionNumber) {
      assert.equal(entityType, "MediaContact");
      updates.push({ patch, versionNumber });
      graph.MediaContact = { ...graph.MediaContact, ...patch, versionNumber: versionNumber + 1 };
      return graph.MediaContact;
    }
  };
  const service = createCrmProjectionService({ espocrm, repository, config, logger, metrics: new Metrics() });

  await Promise.all([
    service.projectReplyBusinessAction({ entity_id: "match-1", payload: { sendQueueId: "send-1", sourceEventId: "reply-1", classification: "Not Suitable", replyAt: "2026-07-15T09:30:00Z" } }),
    service.projectReplyBusinessAction({ entity_id: "match-2", payload: { sendQueueId: "send-2", sourceEventId: "reply-2", classification: "Not Suitable", replyAt: "2026-07-15T09:31:00Z" } })
  ]);

  assert.equal(denials.length, 2);
  assert.deepEqual(graph.MediaContact.rejectedGenres, ["Electronic", "Indie", "Rock"]);
  assert.deepEqual(updates.map(({ versionNumber }) => versionNumber), [3, 4]);
});

test("Future Releases records a preference but never manufactures lawful basis or opt-in", async () => {
  const graph = baseGraph();
  let contactPatch;
  let opportunityCreates = 0;
  const repository = replyRepository();
  const espocrm = replyEspo(graph, {
    update(entityType, patch) {
      if (entityType === "MediaContact") contactPatch = patch;
    },
    create(entityType) {
      if (entityType === "Opportunity") opportunityCreates += 1;
      throw new Error(`unexpected ${entityType} create`);
    }
  });
  const service = createCrmProjectionService({ espocrm, repository, config, logger, metrics: new Metrics() });

  await service.projectReplyBusinessAction(replyWork("Future Releases"));

  assert.equal(contactPatch.futureReleaseInterest, "Interested");
  assert.deepEqual(contactPatch.futureReleaseGenres, ["Indie"]);
  assert.equal(contactPatch.futureReleaseInterestEventId, "event-1");
  assert.equal(opportunityCreates, 0);
  for (const forbidden of ["contactBasis", "contactPurpose", "proofUrl", "proofText", "proofCapturedAt", "doNotContact", "optedOut", "hardBounced"]) {
    assert.equal(forbidden in contactPatch, false, forbidden);
  }
});

test("delivery-unknown reconciliation creates review evidence but never a Sent Email", async () => {
  const upserts = [];
  const reviews = [];
  const events = new Map();
  const repository = {
    async getSend() {
      return {
        id: "send-unknown",
        status: "delivery_unknown",
        match_id: "match-1",
        release_id: "release-1",
        contact_id: "contact-1",
        outlet_id: "outlet-1",
        deterministic_message_id: "<unknown@mail.example.test>",
        attempts: 1,
        last_error_code: "MAILGUN_TIMEOUT"
      };
    },
    async getDeliveryUnknownEvidence() {
      return {
        occurred_at: "2026-07-15T09:29:45.000Z",
        correlation_id: "unknown-correlation-1",
        attempt_number: 1,
        error_code: "MAILGUN_TIMEOUT"
      };
    },
    async enqueueHumanReview(value) {
      if (!reviews.length) reviews.push(value);
      return "review-unknown";
    }
  };
  const espocrm = {
    async upsertByUnique(entityType, _attribute, value, payload) {
      if (events.has(value)) return events.get(value);
      upserts.push({ entityType, payload });
      const event = { id: "event-unknown", ...payload };
      events.set(value, event);
      return event;
    }
  };
  const service = createCrmProjectionService({ espocrm, repository, config, logger, metrics: new Metrics() });

  await service.syncDeliveryUnknownToCrm({ payload: { sendQueueId: "send-unknown" } });
  await service.syncDeliveryUnknownToCrm({ payload: { sendQueueId: "send-unknown" } });

  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].reviewType, "delivery_unknown_reconciliation");
  assert.deepEqual(upserts.map(({ entityType }) => entityType), ["OutreachEvent"]);
  assert.equal(upserts[0].payload.eventType, "Delivery Unknown");
  assert.equal(upserts[0].payload.eventDate, "2026-07-15 09:29:45");
  assert.equal(upserts[0].payload.correlationId, "unknown-correlation-1");
  assert.equal(JSON.parse(upserts[0].payload.details).sentEmailProjected, false);
});

function replyWork(classification, { sourceEventId = "reply-1" } = {}) {
  return {
    entity_id: "match-1",
    payload: {
      sendQueueId: "send-1",
      sourceEventId,
      classification,
      replyAt: "2026-07-15T09:30:00.000Z"
    }
  };
}

function replyRepository() {
  return {
    async getSend() {
      return { id: "send-1", status: "sent", match_id: "match-1", release_id: "release-1", contact_id: "contact-1", outlet_id: "outlet-1" };
    },
    async enqueueHumanReview() { return "review-1"; }
  };
}

function replyEspo(graph, hooks = {}) {
  let targetList;
  let campaign;
  const relations = new Set();
  return {
    async get(entityType) {
      if (entityType === "TargetList") return targetList;
      if (entityType === "Campaign") return campaign;
      return graph[entityType];
    },
    async findOne(entityType, _attribute, value) {
      if (entityType === "TargetList") return targetList?.outreachProjectionKey === value ? targetList : undefined;
      if (entityType === "Campaign") return campaign?.outreachProjectionKey === value ? campaign : undefined;
      if (entityType === "Opportunity") return hooks.findOpportunity?.(value);
      return hooks.findEvent?.(value) ?? { id: "event-1", eventDate: "2026-07-15 09:30:00" };
    },
    async upsertByUnique(entityType, _attribute, value, payload) {
      return hooks.upsert?.(entityType, value, payload) ?? { id: `${entityType.toLowerCase()}-1`, ...payload };
    },
    async create(entityType, payload) {
      if (entityType === "TargetList") {
        if (targetList) throw Object.assign(new Error("unique conflict"), { statusCode: 409, code: "ESPOCRM_HTTP_409" });
        targetList = { id: "target-list-1", versionNumber: 1, ...payload };
        return targetList;
      }
      if (entityType === "Campaign") {
        if (campaign) throw Object.assign(new Error("unique conflict"), { statusCode: 409, code: "ESPOCRM_HTTP_409" });
        campaign = { id: "campaign-1", versionNumber: 1, ...payload };
        return campaign;
      }
      if (hooks.create) return hooks.create(entityType, payload);
      return { id: `${entityType.toLowerCase()}-1`, versionNumber: 1, ...payload };
    },
    async relateUnique(entityType, id, link, foreignId) {
      const key = `${entityType}:${id}:${link}:${foreignId}`;
      const added = !relations.has(key);
      relations.add(key);
      return added;
    },
    async countLinked(entityType, id, link) {
      return [...relations].filter((key) => key.startsWith(`${entityType}:${id}:${link}:`)).length;
    },
    async updateConditional(entityType, id, patch, versionNumber) {
      if (entityType === "TargetList") {
        if (versionNumber !== targetList.versionNumber) {
          throw Object.assign(new Error("version conflict"), { statusCode: 409, code: "ESPOCRM_VERSION_CONFLICT" });
        }
        targetList = { ...targetList, ...patch, versionNumber: versionNumber + 1 };
        return targetList;
      }
      if (entityType === "Campaign") {
        if (versionNumber !== campaign.versionNumber) {
          throw Object.assign(new Error("version conflict"), { statusCode: 409, code: "ESPOCRM_VERSION_CONFLICT" });
        }
        campaign = { ...campaign, ...patch, versionNumber: versionNumber + 1 };
        return campaign;
      }
      if (hooks.updateConditional) return hooks.updateConditional(entityType, id, patch, versionNumber);
      hooks.update?.(entityType, patch);
      const record = graph[entityType];
      graph[entityType] = { ...record, ...patch, id, versionNumber: versionNumber + 1 };
      return graph[entityType];
    }
  };
}

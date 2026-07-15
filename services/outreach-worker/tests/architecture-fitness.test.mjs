import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CAMPAIGN_STATUS_VALUES,
  TERMINAL_CAMPAIGN_STATUS_VALUES,
  isCampaignStatus,
  isTerminalCampaignStatus
} from "../src/domain/campaign-state.mjs";
import { EspoCrmClient } from "../src/infrastructure/espocrm-client.mjs";

const matchMetadataUrl = new URL(
  "../../../deploy/espocrm/extensions/marcsmusic-outreach/files/custom/Espo/Modules/MarcsMusicOutreach/Resources/metadata/entityDefs/OutreachMatch.json",
  import.meta.url
);
const transitionPolicyUrl = new URL(
  "../../../deploy/espocrm/extensions/marcsmusic-outreach/files/custom/Espo/Modules/MarcsMusicOutreach/Resources/campaign-status-transitions.json",
  import.meta.url
);
const standardMetadataBaseUrl = new URL(
  "../../../deploy/espocrm/extensions/marcsmusic-outreach/files/custom/Espo/Modules/MarcsMusicOutreach/Resources/metadata/entityDefs/",
  import.meta.url
);
const extensionServiceBaseUrl = new URL(
  "../../../deploy/espocrm/extensions/marcsmusic-outreach/files/custom/Espo/Modules/MarcsMusicOutreach/Services/",
  import.meta.url
);
const extensionHookBaseUrl = new URL(
  "../../../deploy/espocrm/extensions/marcsmusic-outreach/files/custom/Espo/Modules/MarcsMusicOutreach/Hooks/",
  import.meta.url
);
const dailyReportAggregateServiceUrl = new URL(
  "../../../deploy/espocrm/extensions/marcsmusic-outreach/files/custom/Espo/Modules/MarcsMusicOutreach/Tools/DailyReport/AggregateService.php",
  import.meta.url
);

test("worker campaign states exactly match the EspoCRM extension contract", async () => {
  const metadata = JSON.parse(await readFile(matchMetadataUrl, "utf8"));
  assert.deepEqual(CAMPAIGN_STATUS_VALUES, metadata.fields.campaignStatus.options);
  assert.ok(CAMPAIGN_STATUS_VALUES.every(isCampaignStatus));
  assert.ok(TERMINAL_CAMPAIGN_STATUS_VALUES.every(isTerminalCampaignStatus));
  assert.equal(isTerminalCampaignStatus("Paused"), false);
  assert.equal(isTerminalCampaignStatus("Failed"), true);
  assert.equal(isCampaignStatus("invented-state"), false);
});

test("daily report aggregate keeps the derived-table identity stable across Espo SQL composition", async () => {
  const source = await readFile(dailyReportAggregateServiceUrl, "utf8");

  assert.match(source, /->select\('mediaContactId', 'id'\)\s*->distinct\(\)/u);
  assert.match(source, /->fromQuery\(\$distinctContacts, 'matches'\)\s*->select\('COUNT:\(matches\.id\)', 'value'\)/u);
  assert.doesNotMatch(
    source,
    /COUNT:\(matches\.mediaContactId\)/u,
    "Espo snake-cases an outer camelCase reference although the derived column retains its explicit alias"
  );
});

test("terminal campaign policy has one domain owner", async () => {
  const applicationFiles = [
    "event-service.mjs",
    "match-service.mjs",
    "send-service.mjs",
    "work-service.mjs"
  ];
  for (const file of applicationFiles) {
    const source = await readFile(new URL(`../src/application/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /TERMINAL[_A-Z]*\s*=\s*new Set/gu, `${file} must import the domain terminal-state policy`);
  }
});

test("server transition policy is complete and forbids bypass and terminal resume", async () => {
  const policy = JSON.parse(await readFile(transitionPolicyUrl, "utf8"));
  const statuses = new Set(CAMPAIGN_STATUS_VALUES);
  const terminalStatuses = new Set(TERMINAL_CAMPAIGN_STATUS_VALUES);
  const activeDeliveryStates = new Set(["Active", "Ready", "Sent 1", "Follow-Up 1", "Follow-Up 2", "Paused"]);

  assert.deepEqual(Object.keys(policy.transitions).sort(), [...statuses].sort());
  assert.ok(policy.createStates.every((status) => statuses.has(status)));
  assert.ok(policy.createStates.includes("New"));
  assert.ok(!policy.createStates.some((status) => activeDeliveryStates.has(status)));

  for (const [from, destinations] of Object.entries(policy.transitions)) {
    assert.ok(Array.isArray(destinations), `${from} transitions must be an array`);
    assert.equal(new Set(destinations).size, destinations.length, `${from} transitions must be unique`);
    assert.ok(destinations.every((status) => statuses.has(status)), `${from} has an unknown transition`);
    if (terminalStatuses.has(from)) {
      assert.ok(
        destinations.every((status) => !activeDeliveryStates.has(status)),
        `${from} must never resume automated delivery`
      );
    }
  }

  assert.ok(!policy.transitions.New.includes("Sent 1"));
  assert.ok(policy.transitions.New.includes("Eligible"));
  assert.ok(policy.transitions.Eligible.includes("Ready"));
  assert.ok(policy.transitions.Ready.includes("Sent 1"));
  assert.ok(policy.transitions["Sent 1"].includes("Follow-Up 1"));
  assert.ok(policy.transitions["Follow-Up 1"].includes("Follow-Up 2"));
  assert.deepEqual(policy.transitions.Unsubscribed, []);
});

test("CRM projection metadata owns deterministic uniqueness and verified target-list membership", async () => {
  const [email, campaign, opportunity, targetList, mediaContact] = await Promise.all(
    ["Email", "Campaign", "Opportunity", "TargetList", "MediaContact"].map(async (entityType) =>
      JSON.parse(await readFile(new URL(`${entityType}.json`, standardMetadataBaseUrl), "utf8"))
    )
  );
  const targetListScope = JSON.parse(await readFile(new URL(
    "../../../deploy/espocrm/extensions/marcsmusic-outreach/files/custom/Espo/Modules/MarcsMusicOutreach/Resources/metadata/scopes/TargetList.json",
    import.meta.url
  ), "utf8"));

  assert.equal(email.indexes.outreachProjectionKey.unique, true);
  assert.equal(email.indexes.outreachCorrelationId.unique, true);
  assert.ok(email.fields.parent.entityList.includes("OutreachMatch"));
  assert.equal(campaign.indexes.outreachProjectionKey.unique, true);
  assert.equal(campaign.indexes.musicRelease.unique, true);
  assert.ok(campaign.fields.targetMembershipProjectionState.options.includes("Projected"));
  assert.equal(campaign.links.outreachTargetList.entity, "TargetList");
  assert.equal(targetList.indexes.outreachProjectionKey.unique, true);
  assert.equal(targetList.indexes.musicRelease.unique, true);
  assert.equal(targetList.links.mediaContacts.foreign, "targetLists");
  assert.equal(mediaContact.links.targetLists.foreign, "mediaContacts");
  assert.deepEqual(mediaContact.fields.showName, {
    type: "varchar",
    maxLength: 180,
    audited: true,
    isPersonalData: true
  });
  assert.ok(targetListScope.targetLinkList.includes("mediaContacts"));
  assert.equal(opportunity.indexes.outreachProjectionKey.unique, true);
  assert.equal(opportunity.indexes.outreachMatch.unique, true);
  assert.equal(opportunity.fields.amount.required, false);
  assert.equal(opportunity.fields.closeDate.required, false);
  assert.deepEqual(opportunity.fields.outreachRevenueState.options, ["Unspecified", "Human Confirmed"]);
});

test("TargetList relationship writes are idempotent, verified and narrowly allow-listed", async () => {
  let related = false;
  let requests = 0;
  const client = new EspoCrmClient(
    { baseUrl: "https://crm.invalid", apiKey: "unused", timeoutMs: 1_000, maxPageSize: 25 },
    {
      fetch: async (url, options) => {
        requests += 1;
        if (options.method === "POST") {
          related = true;
          return new Response("true", { status: 200, headers: { "content-type": "application/json" } });
        }
        const searchParams = JSON.parse(new URL(url).searchParams.get("searchParams"));
        const list = related ? [{ id: "contact-1" }] : [];
        return new Response(JSON.stringify({ list, total: related ? 1 : 0 }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
    }
  );

  assert.equal(await client.relateUnique("TargetList", "target-1", "mediaContacts", "contact-1"), true);
  assert.equal(await client.relateUnique("TargetList", "target-1", "mediaContacts", "contact-1"), false);
  assert.equal(await client.countLinked("TargetList", "target-1", "mediaContacts"), 1);
  const beforeRejectedCall = requests;
  await assert.rejects(
    () => client.relateUnique("TargetList", "target-1", "contacts", "contact-1"),
    (error) => error?.code === "ESPOCRM_RELATION_NOT_ALLOWED"
  );
  assert.equal(requests, beforeRejectedCall);
});

test("MusicRelease identity and EPK activation are enforced by database metadata and a server hook", async () => {
  const metadata = JSON.parse(await readFile(new URL("MusicRelease.json", standardMetadataBaseUrl), "utf8"));
  const hook = await readFile(new URL(
    "../../../deploy/espocrm/extensions/marcsmusic-outreach/files/custom/Espo/Modules/MarcsMusicOutreach/Hooks/MusicRelease/ActivationIntegrity.php",
    import.meta.url
  ), "utf8");

  assert.deepEqual(metadata.indexes.isrc, { columns: ["isrc"], unique: true });
  assert.equal(metadata.fields.epkAttestationState.required, true);
  assert.deepEqual(metadata.fields.epkAttestationState.options, ["Unverified", "Verified", "Invalidated", "Failed"]);
  for (const field of [
    "epkUrl", "isrc", "artistName", "name", "releaseDate", "genres", "moods", "bpm",
    "instrumental", "artworkUrl", "spotifyUrl", "downloadUrl", "radioEditUrl", "privateStreamUrl"
  ]) {
    assert.match(hook, new RegExp(`'${field}'`, "u"), `${field} must invalidate the EPK attestation`);
  }
  assert.match(hook, /New Music Releases must begin without a self-asserted EPK attestation/u);
  assert.match(hook, /A verified EPK attestation is required before activation/u);
  assert.match(hook, /'Active'[\s\S]*?'Paused'/u);
  assert.match(hook, /'Ready'[\s\S]*?'Draft'/u);
  assert.match(hook, /FILTER_FLAG_NO_PRIV_RANGE \| FILTER_FLAG_NO_RES_RANGE/u);
});

test("every idempotent CRM create has an exact non-leaking unique-conflict service", async () => {
  const contracts = Object.freeze({
    Campaign: ["campaign.UNIQ_MUSIC_RELEASE", "campaign.UNIQ_OUTREACH_PROJECTION_KEY"],
    Email: ["email.UNIQ_OUTREACH_PROJECTION_KEY", "email.UNIQ_OUTREACH_CORRELATION_ID"],
    MediaContact: ["media_contact.UNIQ_FINGERPRINT"],
    MediaOutlet: ["media_outlet.UNIQ_FINGERPRINT"],
    MusicRelease: ["music_release.UNIQ_ISRC"],
    Opportunity: [
      "opportunity.UNIQ_OUTREACH_PROJECTION_KEY",
      "opportunity.UNIQ_OUTREACH_MATCH",
      "opportunity.UNIQ_SOURCE_OUTREACH_EVENT"
    ],
    OutreachDailyReport: ["outreach_daily_report.UNIQ_REPORT_DATE"],
    OutreachEvent: ["outreach_event.UNIQ_EXTERNAL_EVENT_ID"],
    OutreachMatch: ["outreach_match.UNIQ_IDEMPOTENCY_KEY"],
    OutreachSuppression: ["outreach_suppression.UNIQ_SUBJECT_HASH"],
    TargetList: ["target_list.UNIQ_MUSIC_RELEASE", "target_list.UNIQ_OUTREACH_PROJECTION_KEY"]
  });
  const mapper = await readFile(new URL("Concerns/MapsUniqueCreateConflicts.php", extensionServiceBaseUrl), "utf8");

  assert.match(mapper, /PDOException/u);
  assert.match(mapper, /ConflictSilent::createWithBody/u);
  assert.match(mapper, /'unique-conflict'/u);
  assert.match(mapper, /'23000'/u);
  assert.match(mapper, /!== 1062/u);
  assert.match(mapper, /static::UNIQUE_CONFLICT_KEYS/u);
  assert.match(mapper, /throw \$exception/u, "non-allowlisted database errors must remain internal errors");
  assert.doesNotMatch(mapper, /\$exception->getMessage\(\)/u, "database error text must never enter the public body");

  for (const [entityType, keys] of Object.entries(contracts)) {
    const service = await readFile(new URL(`${entityType}.php`, extensionServiceBaseUrl), "utf8");
    for (const key of keys) {
      assert.ok(service.includes(`'${key}'`), `${entityType} must allowlist only its reviewed ${key} race`);
    }
  }

  const emailService = await readFile(new URL("Email.php", extensionServiceBaseUrl), "utf8");
  assert.match(emailService, /use Espo\\Services\\Email as CoreEmail/u);
  assert.match(emailService, /final class Email extends CoreEmail/u, "custom Email must preserve the core send lifecycle");
});

test("managed projection hooks check fetched identity before every empty-key branch", async () => {
  for (const [entityType, hookName] of [
    ["Campaign", "OutreachProjectionIntegrity.php"],
    ["TargetList", "OutreachProjectionIntegrity.php"],
    ["Email", "OutreachProjectionIntegrity.php"],
    ["Opportunity", "OutreachProjectionIntegrity.php"]
  ]) {
    const hook = await readFile(new URL(`${entityType}/${hookName}`, extensionHookBaseUrl), "utf8");
    const fetchedGuard = hook.indexOf("managedKeyWasChanged($entity)");
    const emptyKeyBranch = hook.indexOf("if (!is_string($key) || $key === '')");

    assert.ok(fetchedGuard >= 0, `${entityType} must inspect the fetched managed identity`);
    assert.ok(emptyKeyBranch > fetchedGuard, `${entityType} cannot return on an empty incoming key before the fetched-key guard`);
    assert.match(hook, /getFetched\('outreachProjectionKey'\)/u);
    assert.match(hook, /isAttributeChanged\('outreachProjectionKey'\)/u);
    assert.match(hook, /projection fields require a managed projection key|identity fields require a managed projection key/u);
  }
});

test("read-only projection identity is rejected before Espo enters the save lifecycle", async () => {
  const guard = await readFile(
    new URL("Concerns/RejectsProjectionIdentityUpdateInput.php", extensionServiceBaseUrl),
    "utf8"
  );

  assert.match(guard, /public function update\(/u);
  assert.match(guard, /property_exists\(\$data, \$field\)/u);
  assert.match(guard, /throw new Forbidden/u);
  assert.ok(
    guard.indexOf("property_exists($data, $field)") < guard.indexOf("parent::update($id, $data, $params)"),
    "raw identity input must be rejected before the generic service filters and saves it"
  );

  const contracts = Object.freeze({
    MusicRelease: ["isrc"],
    MediaOutlet: ["fingerprint"],
    OutreachMatch: ["musicReleaseId", "mediaContactId", "mediaOutletId", "idempotencyKey"],
    OutreachEvent: [
      "outreachMatchId", "mediaContactId", "musicReleaseId", "mediaOutletId",
      "campaignId", "emailId", "externalEventId"
    ],
    OutreachSuppression: [
      "subjectHash", "subjectType", "emailAddress", "domain", "mediaContactId", "mediaOutletId"
    ],
    OutreachDailyReport: ["reportDate"],
    Campaign: ["outreachProjectionKey", "musicReleaseId"],
    TargetList: ["outreachProjectionKey", "musicReleaseId"],
    Email: [
      "outreachProjectionKey",
      "outreachCorrelationId",
      "outreachProviderMessageId",
      "outreachDeterministicMessageId",
      "outreachAcceptedAt",
      "outreachAutomaticResponse",
      "outreachMatchId",
      "outreachCampaignId",
      "musicReleaseId",
      "mediaContactId",
      "mediaOutletId"
    ],
    Opportunity: [
      "outreachProjectionKey",
      "outreachMatchId",
      "musicReleaseId",
      "mediaContactId",
      "mediaOutletId",
      "sourceOutreachEventId"
    ]
  });

  for (const [entityType, fields] of Object.entries(contracts)) {
    const service = await readFile(new URL(`${entityType}.php`, extensionServiceBaseUrl), "utf8");
    assert.match(service, /use RejectsProjectionIdentityUpdateInput/u);
    for (const field of fields) {
      assert.ok(service.includes(`'${field}'`), `${entityType} must reject raw updates to ${field}`);
    }
  }

  const client = await readFile(new URL("../src/infrastructure/espocrm-client.mjs", import.meta.url), "utf8");
  assert.match(client, /const PROJECTION_IDENTITY_FIELDS_BY_TYPE = new Map/u);
  assert.ok(
    client.indexOf("assertExpectedProjectionIdentity(existing") <
      client.indexOf("omitProjectionIdentityFields(payload, identityFields)"),
    "a reused record must pass identity verification before mutable update fields are derived"
  );
  for (const [entityType, fields] of Object.entries(contracts)) {
    const marker = `["${entityType}", Object.freeze([`;
    const start = client.indexOf(marker);
    const end = client.indexOf(")]", start) + 2;
    assert.ok(start >= 0 && end > start, `${entityType} is absent from the worker identity inventory`);
    const inventory = client.slice(start, end);
    for (const field of fields) {
      assert.ok(inventory.includes(`"${field}"`), `${entityType} worker lookup must select and verify ${field}`);
    }
  }

  const [release, outlet, contact, report] = await Promise.all(
    ["MusicRelease", "MediaOutlet", "MediaContact", "OutreachDailyReport"].map(async (entityType) =>
      JSON.parse(await readFile(new URL(`${entityType}.json`, standardMetadataBaseUrl), "utf8"))
    )
  );
  assert.equal(release.fields.isrc.readOnlyAfterCreate, true);
  assert.equal(outlet.fields.fingerprint.readOnlyAfterCreate, true);
  assert.equal(report.fields.reportDate.readOnlyAfterCreate, true);
  assert.notEqual(contact.fields.fingerprint.readOnlyAfterCreate, true,
    "contact fingerprint promotion is an evidence-governed canonicalization, not immutable record identity");
});

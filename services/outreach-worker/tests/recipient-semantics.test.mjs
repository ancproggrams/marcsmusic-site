import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createEventService } from "../src/application/event-service.mjs";
import { buildCopyFacts } from "../src/domain/copy-policy.mjs";
import {
  canonicalCountry,
  canonicalIanaTimezone,
  canonicalLanguage
} from "../src/domain/recipient-locale.mjs";
import { adaptDjFinderRows, buildSourceArtifact } from "../src/domain/source-adapters.mjs";
import { parseSourceArtifact } from "../src/domain/source-artifact.mjs";
import {
  canonicalLinkedInUrl,
  canonicalSoundCloudUrl
} from "../src/domain/source-identity.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";

const logger = Object.freeze({ info() {}, warn() {}, error() {} });

test("recipient locale normalization is canonical and never guesses from prefixes", () => {
  const languages = new Map([
    ["English", "en"], ["en-US", "en"], ["eng-US", "en"], ["en-u-ca-gregory", "en"],
    ["Nederlands", "nl"], ["nld", "nl"], ["Deutsch", "de"],
    ["Français", "fr"], ["Español", "es"], ["Português", "pt"]
  ]);
  for (const [input, expected] of languages) assert.equal(canonicalLanguage(input), expected, input);
  assert.equal(canonicalLanguage("Esperanto"), undefined, "Esperanto must not become Spanish");
  assert.equal(canonicalLanguage("Italian"), undefined);
  assert.equal(canonicalLanguage(undefined), undefined);

  assert.equal(canonicalCountry("Nederland"), "NL");
  assert.equal(canonicalCountry("United Kingdom"), "GB");
  assert.equal(canonicalCountry("États-Unis"), "US");
  assert.equal(canonicalCountry("America"), undefined, "ambiguous continent names must not select a country");
  assert.equal(canonicalCountry("ZZ"), undefined);
  assert.equal(canonicalCountry("Atlantis"), undefined);

  assert.equal(canonicalIanaTimezone("Europe/Amsterdam"), "Europe/Amsterdam");
  assert.equal(canonicalIanaTimezone("America/New_York"), "America/New_York");
  assert.equal(canonicalIanaTimezone("Etc/UTC"), "Etc/UTC");
  assert.equal(canonicalIanaTimezone("UTC"), undefined);
  assert.equal(canonicalIanaTimezone("+02:00"), undefined);
  assert.equal(canonicalIanaTimezone("Mars/Olympus"), undefined);
});

test("source adapters preserve names and canonical social profiles without locale fallbacks", () => {
  const capturedAt = new Date().toISOString();
  const records = adaptDjFinderRows([{
    source_id: "recipient-semantics-dj",
    artist_name: "DJ Canonical",
    full_name: "Alex Example",
    first_name: "Alex",
    last_name: "Example",
    show_name: "Night Signals",
    website_url: "https://radio.example/",
    source_url: "https://radio.example/submissions",
    contact_source_url: "https://radio.example/submissions",
    music_submission_email: "music@radio.example",
    linkedin_url: "https://www.linkedin.com/in/Alex-Example/?utm_source=test",
    soundcloud_url: "https://www.soundcloud.com/Alex_Example/",
    country: "United States",
    languages: "en-US",
    timezone: "America/New_York",
    active_evidence: "The official page explicitly invites music submissions by email.",
    verification_status: "verified",
    verification_timestamp: capturedAt
  }]);
  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    ...records[0],
    country: "US",
    language: "en",
    timezone: "America/New_York"
  });
  assert.equal(records[1].firstName, "Alex");
  assert.equal(records[1].lastName, "Example");
  assert.equal(records[1].showName, "Night Signals");
  assert.equal(records[1].preferredLanguage, "en");
  assert.equal(records[1].timezone, "America/New_York");
  assert.equal(records[1].linkedinUrl, "https://www.linkedin.com/in/alex-example/");
  assert.equal(records[1].soundcloudUrl, "https://soundcloud.com/alex_example");

  const parsed = parseSourceArtifact(buildSourceArtifact({
    sourceId: "dj-finder",
    generatedAt: capturedAt,
    records
  }));
  assert.equal(parsed.records[1].linkedinUrl, "https://www.linkedin.com/in/alex-example/");
  assert.equal(parsed.records[1].soundcloudUrl, "https://soundcloud.com/alex_example");

  const missing = adaptDjFinderRows([{
    source_id: "missing-locale-dj",
    artist_name: "DJ Unknown Locale",
    full_name: "Unknown Locale",
    website_url: "https://unknown.example/",
    source_url: "https://unknown.example/submissions",
    contact_source_url: "https://unknown.example/submissions",
    music_submission_email: "music@unknown.example",
    country: "Atlantis",
    languages: "Esperanto",
    timezone: "UTC+2",
    active_evidence: "The official page explicitly invites music submissions by email.",
    verification_status: "verified",
    verification_timestamp: capturedAt
  }]);
  assert.equal(missing[0].country, undefined);
  assert.equal(missing[0].language, undefined);
  assert.equal(missing[0].timezone, undefined);
  assert.equal(missing[1].preferredLanguage, undefined);
  assert.equal(missing[1].timezone, undefined);

  for (const [field, value] of [
    ["instagram_url", "https://instagram.evil.example/alex"],
    ["linkedin_url", "https://linkedin.evil.example/in/alex-example"],
    ["soundcloud_url", "https://soundcloud.com/alex-example/track"]
  ]) {
    assert.throws(() => adaptDjFinderRows([{
      source_id: `invalid-${field}`,
      artist_name: "DJ Invalid Social",
      full_name: "Invalid Social",
      website_url: "https://invalid-social.example/",
      source_url: "https://invalid-social.example/submissions",
      contact_source_url: "https://invalid-social.example/submissions",
      music_submission_email: "music@invalid-social.example",
      [field]: value,
      active_evidence: "The official page explicitly invites music submissions by email.",
      verification_status: "verified",
      verification_timestamp: capturedAt
    }]), (error) => error.code === "SOURCE_ADAPTER_INPUT_INVALID", field);
  }
});

test("social canonicalizers reject lookalikes, non-profile paths and insecure URLs", () => {
  assert.equal(canonicalLinkedInUrl("https://linkedin.com/in/Valid-Profile?trk=x"), "https://www.linkedin.com/in/valid-profile/");
  assert.equal(canonicalLinkedInUrl("https://linkedin.evil.example/in/valid-profile"), undefined);
  assert.equal(canonicalLinkedInUrl("http://linkedin.com/in/valid-profile"), undefined);
  assert.equal(canonicalLinkedInUrl("https://linkedin.com/company/example"), undefined);
  assert.equal(canonicalSoundCloudUrl("https://soundcloud.com/Valid_Profile?utm=x"), "https://soundcloud.com/valid_profile");
  assert.equal(canonicalSoundCloudUrl("https://soundcloud.com/artist/track"), undefined);
  assert.equal(canonicalSoundCloudUrl("https://soundcloud.com/discover"), undefined);
  assert.equal(canonicalSoundCloudUrl("https://on.soundcloud.com/short"), undefined);
});

test("copy facts preserve explicit first, last and show names", () => {
  const facts = buildCopyFacts({
    release: { artistName: "Marc Rene", name: "Track", genres: ["Dance"] },
    contact: {
      firstName: "Alex", lastName: "Example", showName: "Night Signals", role: "Presenter",
      preferredLanguage: "en", contactEvidence: "Published music submissions contact.",
      contactSourceUrl: "https://radio.example/submissions"
    },
    outlet: { name: "Radio", type: "Radio Station", genres: ["Dance"], submissionPolicy: "Explicit", submissionUrl: "https://radio.example/submissions" }
  });
  assert.deepEqual(facts.contact, {
    firstName: "Alex",
    lastName: "Example",
    showName: "Night Signals",
    role: "Presenter",
    language: "en"
  });
});

for (const scenario of [
  {
    name: "generic auto reply",
    subject: "Automatic reply",
    body: "Your message was received by our automated system.",
    expectedClassification: "Auto Reply",
    expectedReason: "auto_reply_indefinite"
  },
  {
    name: "out of office without a confident date",
    subject: "Out of office",
    body: "I am away until 03/04/2026.",
    expectedClassification: "Out Of Office",
    expectedReason: "out_of_office_indefinite"
  }
]) {
  test(`${scenario.name} pauses indefinitely without response or resume work`, async () => {
    const harness = replyHarness(scenario);
    await harness.service.processMailgunEvent({ payload: { eventInboxId: harness.inbox.id } });
    assert.deepEqual(harness.calls.cancellations, [{ matchId: "match-1", reason: scenario.expectedReason }]);
    assert.equal(harness.calls.pauses.length, 0);
    assert.equal(harness.calls.responses.length, 0);
    assert.equal(harness.calls.releases.length, 0);
    assert.equal(harness.calls.work.some(({ kind }) => kind === "resume_sequence"), false);
    const matchUpdate = harness.calls.updates.find(({ entityType }) => entityType === "OutreachMatch");
    assert.equal(matchUpdate.patch.campaignStatus, "Paused");
    assert.equal(matchUpdate.patch.activeSequence, true);
    assert.equal(matchUpdate.patch.replyStatus, scenario.expectedClassification);
    assert.equal(matchUpdate.patch.nextActionAt, null);
    assert.equal(matchUpdate.patch.stopReason, scenario.expectedReason);
  });
}

test("an explicit OOO return date schedules one future resume and no generated reply", async () => {
  const harness = replyHarness({
    subject: "Out of office",
    body: "I am out of the office and return on 2026-07-20."
  });
  await harness.service.processMailgunEvent({ payload: { eventInboxId: harness.inbox.id } });
  assert.equal(harness.calls.cancellations.length, 0);
  assert.equal(harness.calls.pauses.length, 1);
  assert.ok(harness.calls.pauses[0].resumeAt > new Date(harness.inbox.created_at));
  assert.equal(harness.calls.responses.length, 0);
  assert.equal(harness.calls.releases.length, 0);
  assert.equal(harness.calls.work.filter(({ kind }) => kind === "resume_sequence").length, 1);
});

test("architecture keeps locale defaults and arbitrary OOO resumes out of automatic-send boundaries", async () => {
  const [scheduler, normalization, copyPolicy, sourceAdapters, sourceArtifact, eventService] = await Promise.all([
    "scheduler.mjs", "normalization.mjs", "copy-policy.mjs", "source-adapters.mjs", "source-artifact.mjs", "../application/event-service.mjs"
  ].map((path) => readFile(new URL(`../src/domain/${path}`, import.meta.url), "utf8")));
  assert.doesNotMatch(scheduler, /["']UTC["']\s*;/u);
  assert.doesNotMatch(normalization, /\?\?\s*["']UTC["']/u);
  assert.doesNotMatch(copyPolicy, /value\s*\?\?\s*["']en["']/u);
  assert.doesNotMatch(sourceAdapters, /\?\?\s*["']Europe\/Amsterdam["']/u);
  assert.doesNotMatch(sourceArtifact, /default\(["']Europe\/Amsterdam["']\)/u);
  assert.doesNotMatch(eventService, /OUT_OF_OFFICE_DEFAULT_DAYS|default_seven_days/u);
});

function replyHarness({ subject, body }) {
  const queue = Object.freeze({
    id: "send-1",
    match_id: "match-1",
    release_id: "release-1",
    contact_id: "contact-1",
    outlet_id: "outlet-1",
    status: "sent",
    sequence_step: 0,
    provider_message_id: "<outbound@mail.example.test>"
  });
  const inbox = {
    id: "reply-inbox-1",
    external_id: "mailgun-reply-1",
    event_type: "inbound",
    created_at: "2026-07-15T09:00:00.000Z",
    payload: {
      "event-data": {
        event: "inbound",
        sender: "editor@radio.example",
        recipient: "replies@mail.example.test",
        subject,
        "stripped-text": body,
        "In-Reply-To": queue.provider_message_id,
        "Message-Id": "<reply@mail.example>"
      }
    }
  };
  const records = {
    OutreachMatch: { id: "match-1", campaignStatus: "Sent 1", versionNumber: 2 },
    MusicRelease: { id: "release-1", name: "Track", artistName: "Marc Rene", status: "Active", genres: ["Dance"], epkUrl: "https://artist.example/epk" },
    MediaContact: {
      id: "contact-1", name: "Editor", emailAddress: "editor@radio.example", status: "Active",
      preferredLanguage: "en", timezone: "Europe/Amsterdam", mediaOutletId: "outlet-1"
    },
    MediaOutlet: { id: "outlet-1", name: "Radio", website: "https://radio.example", timezone: "Europe/Amsterdam", country: "NL" }
  };
  const calls = { cancellations: [], pauses: [], responses: [], releases: [], work: [], updates: [] };
  const repository = {
    async readEvent() { return inbox; },
    async findSendByMessageId() { return queue; },
    async isSuppressed() { return false; },
    async cancelPendingForMatch(matchId, reason) { calls.cancellations.push({ matchId, reason }); },
    async pausePendingForMatch(matchId, resumeAt, reason) { calls.pauses.push({ matchId, resumeAt, reason }); },
    async releaseAllocation(value) { calls.releases.push(value); },
    async enqueueWork(value) { calls.work.push(value); },
    async enqueueResponse(value) { calls.responses.push(value); },
    async recordOutcome() {},
    async markEventProcessed() {}
  };
  const espocrm = {
    async get(entityType) { return records[entityType]; },
    async updateConditional(entityType, id, patch) {
      calls.updates.push({ entityType, id, patch });
      return { ...records[entityType], ...patch };
    },
    async upsertByUnique() { return { id: "event-1" }; }
  };
  return {
    inbox,
    calls,
    service: createEventService({
      espocrm,
      repository,
      config: { mailgun: { domain: "mail.example.test" }, policy: { cooldownDays: 21 } },
      logger,
      metrics: new Metrics(),
      clock: () => new Date("2026-07-15T09:00:00.000Z")
    })
  };
}

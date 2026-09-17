import test from "node:test";
import assert from "node:assert/strict";

import { buildCopyFacts, safeTemplate, validateGeneratedCopy } from "../src/domain/copy-policy.mjs";
import { deterministicMinute, scheduleSequenceStep } from "../src/domain/scheduler.mjs";

const UNSUBSCRIBE_URL = "https://outreach.example.test/unsubscribe?token=abc.def";

function localParts(date, timeZone) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value])
  );
  return values;
}

function factsFixture(preferredLanguage = "en", outletOverrides = {}) {
  const release = {
    artistName: "Marc Rene",
    name: "Northern Lights",
    genres: ["Indie"],
    subGenres: ["Dream Pop"],
    description: "An independent release.",
    epkUrl: "https://artist.example.test/epk",
    privateStreamUrl: "https://artist.example.test/private",
    spotifyUrl: "https://open.spotify.example.test/not-for-pitch",
    releaseDate: "2026-08-01"
  };
  const contact = {
    firstName: "Sam",
    role: "music editor",
    preferredLanguage,
    contactEvidence: "The outlet publishes this address for submissions.",
    contactSourceUrl: "https://radio.example.test/contact"
  };
  const outlet = {
    name: "Example Radio",
    type: "Radio Station",
    genres: ["Indie"],
    submissionPolicy: "Explicit",
    submissionUrl: "https://radio.example.test/submissions",
    ...outletOverrides
  };
  return buildCopyFacts({ release, contact, outlet });
}

test("deterministic minute stays inside the inclusive 09:30–11:30 window", () => {
  const first = deterministicMinute("same-idempotency-key");
  const second = deterministicMinute("same-idempotency-key");

  assert.equal(first, second);
  assert.ok(first >= 570 && first <= 690);
  assert.throws(() => deterministicMinute("key", 20, 10), /Invalid scheduling window/u);
});

test("initial outreach is scheduled Tuesday–Thursday in the contact timezone", () => {
  const scheduled = scheduleSequenceStep({
    sequenceStep: 0,
    timezone: "Europe/Amsterdam",
    idempotencyKey: "initial-release-contact",
    from: new Date("2026-07-13T06:00:00.000Z")
  });
  const local = localParts(scheduled, "Europe/Amsterdam");
  const minutes = Number(local.hour) * 60 + Number(local.minute);

  assert.equal(local.weekday, "Tue");
  assert.equal(`${local.year}-${local.month}-${local.day}`, "2026-07-14");
  assert.ok(minutes >= 570 && minutes <= 690);
});

test("a same-day time after the window rolls forward to the next allowed day", () => {
  const scheduled = scheduleSequenceStep({
    sequenceStep: 0,
    timezone: "Europe/Amsterdam",
    idempotencyKey: "after-window",
    from: new Date("2026-07-15T14:00:00.000Z")
  });
  const local = localParts(scheduled, "Europe/Amsterdam");

  assert.equal(local.weekday, "Thu");
  assert.equal(`${local.year}-${local.month}-${local.day}`, "2026-07-16");
});

test("follow-up offsets never land on Friday, Saturday, Sunday or Monday", () => {
  const sequenceStart = new Date("2026-07-13T08:00:00.000Z");
  for (const sequenceStep of [1, 2]) {
    const scheduled = scheduleSequenceStep({
      sequenceStep,
      timezone: "Europe/Amsterdam",
      idempotencyKey: `step-${sequenceStep}`,
      from: new Date("2026-07-13T06:00:00.000Z"),
      sequenceStart,
      previousAcceptedAt: sequenceStep === 1
        ? sequenceStart
        : new Date("2026-07-21T08:00:00.000Z")
    });
    const local = localParts(scheduled, "Europe/Amsterdam");
    assert.ok(["Tue", "Wed", "Thu"].includes(local.weekday));
  }
});

test("invalid zones are rejected without a UTC fallback and invalid steps are rejected", () => {
  assert.throws(() => scheduleSequenceStep({
    sequenceStep: 0,
    timezone: "Not/AZone",
    idempotencyKey: "invalid-zone",
    from: new Date("2026-07-13T06:00:00.000Z")
  }), (error) => error.code === "RECIPIENT_TIMEZONE_INVALID");
  assert.throws(
    () => scheduleSequenceStep({ sequenceStep: 3, timezone: "Etc/UTC", idempotencyKey: "invalid-step" }),
    /sequenceStep must be 0, 1, or 2/u
  );
  assert.throws(() => scheduleSequenceStep({
    sequenceStep: 1,
    timezone: "Europe/Amsterdam",
    idempotencyKey: "missing-acceptance",
    from: new Date("2026-07-13T06:00:00.000Z"),
    sequenceStart: new Date("2026-07-13T06:00:00.000Z"),
    previousAcceptedAt: null
  }), (error) => error.code === "PREVIOUS_ACCEPTANCE_UNAVAILABLE");
  assert.throws(() => scheduleSequenceStep({
    sequenceStep: 0,
    timezone: "Europe/Amsterdam",
    idempotencyKey: "missing-now",
    from: null
  }), (error) => error.code === "SCHEDULING_NOW_INVALID");
});

test("follow-ups honor the sequence offset, prior acceptance plus four days, and late replay now bound across DST", () => {
  const scheduled = scheduleSequenceStep({
    sequenceStep: 2,
    timezone: "Europe/Amsterdam",
    idempotencyKey: "dst-late-follow-up",
    sequenceStart: new Date("2026-03-25T10:00:00.000Z"),
    previousAcceptedAt: new Date("2026-04-02T10:00:00.000Z"),
    from: new Date("2026-04-07T10:00:17.000Z")
  });
  const local = localParts(scheduled, "Europe/Amsterdam");

  assert.ok(scheduled >= new Date("2026-04-07T10:00:17.000Z"), "late replay must never schedule in the past");
  assert.ok(scheduled >= new Date("2026-04-06T10:00:00.000Z"), "prior acceptance + four exact days is a hard bound");
  assert.equal(local.weekday, "Wed");
  assert.equal(`${local.year}-${local.month}-${local.day}`, "2026-04-08");
  assert.ok(Number(local.hour) * 60 + Number(local.minute) >= 570);
  assert.ok(Number(local.hour) * 60 + Number(local.minute) <= 690);
});

test("copy facts exclude Spotify and the safe template validates with a tokenized unsubscribe URL", () => {
  const facts = factsFixture();
  const copy = safeTemplate({ facts, sequenceStep: 0, unsubscribeUrl: UNSUBSCRIBE_URL });
  const validation = validateGeneratedCopy({ copy, facts, unsubscribeUrl: UNSUBSCRIBE_URL });

  assert.equal(Object.hasOwn(facts.release, "spotifyUrl"), false);
  assert.ok(!copy.bodyText.includes("spotify"));
  assert.equal(validation.valid, true, validation.errors.join(", "));
  assert.deepEqual(validation.errors, []);
  assert.match(validation.contentHash, /^[a-f0-9]{64}$/u);
});

test("deterministic copy localizes every supported language and keeps each sequence evidence-bound", () => {
  const locales = {
    en: { unsubscribe: "Unsubscribe", initial: "for", followUp: "Follow-up:", body: "Hi" },
    nl: { unsubscribe: "Afmelden", initial: "voor", followUp: "Opvolging:", body: "Hallo" },
    de: { unsubscribe: "Abmelden", initial: "für", followUp: "Nachfrage:", body: "Guten Tag" },
    fr: { unsubscribe: "Se désabonner", initial: "pour", followUp: "Suivi :", body: "Bonjour" },
    es: { unsubscribe: "Cancelar suscripción", initial: "para", followUp: "Seguimiento:", body: "Hola" },
    pt: { unsubscribe: "Cancelar subscrição", initial: "para", followUp: "Seguimento:", body: "Olá" }
  };

  for (const [language, expected] of Object.entries(locales)) {
    const facts = factsFixture(language);
    for (const sequenceStep of [0, 1, 2]) {
      const copy = safeTemplate({ facts, sequenceStep, unsubscribeUrl: UNSUBSCRIBE_URL });
      const validation = validateGeneratedCopy({ copy, facts, unsubscribeUrl: UNSUBSCRIBE_URL });
      const proseWithoutUrls = copy.bodyText.replace(/https?:\/\/[^\s<>()]+/gu, "");

      assert.equal(validation.valid, true, `${language}/${sequenceStep}: ${validation.errors.join(", ")}`);
      assert.ok(copy.bodyText.startsWith(expected.body), `${language}/${sequenceStep} greeting`);
      assert.ok(copy.bodyText.includes(`${expected.unsubscribe}: ${UNSUBSCRIBE_URL}`));
      assert.equal((proseWithoutUrls.match(/\?/gu) ?? []).length, 1);
      assert.ok(copy.bodyText.trim().split(/\s+/u).length <= 120);
      assert.deepEqual(copy.evidenceUsed, ["submission-policy"]);
      assert.ok(copy.bodyText.includes("Marc Rene"));
      assert.ok(copy.bodyText.includes("Northern Lights"));
      if (sequenceStep === 0) assert.ok(copy.subject.includes(` ${expected.initial} `));
      else assert.ok(copy.subject.startsWith(expected.followUp));
    }
  }

  assert.throws(
    () => safeTemplate({ facts: factsFixture("other"), sequenceStep: 0, unsubscribeUrl: UNSUBSCRIBE_URL }),
    (error) => error.code === "COPY_LANGUAGE_UNSUPPORTED"
  );
  assert.throws(
    () => safeTemplate({ facts: factsFixture(null), sequenceStep: 0, unsubscribeUrl: UNSUBSCRIBE_URL }),
    (error) => error.code === "COPY_LANGUAGE_UNSUPPORTED"
  );
});

test("submission claims require an explicit submission policy and otherwise use contact evidence", () => {
  const facts = factsFixture("en", { submissionPolicy: "Unknown" });
  const copy = safeTemplate({ facts, sequenceStep: 0, unsubscribeUrl: UNSUBSCRIBE_URL });
  const validation = validateGeneratedCopy({ copy, facts, unsubscribeUrl: UNSUBSCRIBE_URL });

  assert.equal(validation.valid, true, validation.errors.join(", "));
  assert.deepEqual(copy.evidenceUsed, ["contact-source"]);
  assert.match(copy.bodyText, /published contact information/u);
  assert.doesNotMatch(copy.bodyText, /says that Indie music is accepted/u);
});

test("copy validation rejects unapproved URLs", () => {
  const facts = factsFixture();
  const safe = safeTemplate({ facts, sequenceStep: 0, unsubscribeUrl: UNSUBSCRIBE_URL });
  const copy = { ...safe, bodyText: `${safe.bodyText}\nhttps://tracking.example.test/pixel` };

  const result = validateGeneratedCopy({ copy, facts, unsubscribeUrl: UNSUBSCRIBE_URL });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("url_not_allowed"));
});

test("copy validation counts calls-to-action, not query delimiters in URLs", () => {
  const facts = factsFixture();
  const safe = safeTemplate({ facts, sequenceStep: 0, unsubscribeUrl: UNSUBSCRIBE_URL });
  const copy = { ...safe, bodyText: `${safe.bodyText}\nCan you reply today?` };

  const result = validateGeneratedCopy({ copy, facts, unsubscribeUrl: UNSUBSCRIBE_URL });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("call_to_action_count_invalid"));
});

test("copy validation rejects unsupported claims and invented evidence", () => {
  const facts = factsFixture();
  const safe = safeTemplate({ facts, sequenceStep: 0, unsubscribeUrl: UNSUBSCRIBE_URL });
  const copy = {
    ...safe,
    bodyText: `${safe.bodyText}\nI've been a long-time listener.`,
    evidenceUsed: ["invented-source"]
  };

  const result = validateGeneratedCopy({ copy, facts, unsubscribeUrl: UNSUBSCRIBE_URL });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("unsupported_claim"));
  assert.ok(result.errors.includes("unknown_evidence_id"));
});

test("copy validation requires release identity, unsubscribe and a safe subject", () => {
  const facts = factsFixture();
  const copy = {
    subject: "Unsafe\nBcc: someone@example.test",
    bodyText: "A generic message without the required facts?",
    evidenceUsed: []
  };

  const result = validateGeneratedCopy({ copy, facts, unsubscribeUrl: UNSUBSCRIBE_URL });

  assert.deepEqual(new Set(result.errors), new Set(["subject_invalid", "release_identity_missing", "unsubscribe_missing", "evidence_required"]));
});

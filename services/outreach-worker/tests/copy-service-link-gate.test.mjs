import test from "node:test";
import assert from "node:assert/strict";

import { createCopyService } from "../src/application/copy-service.mjs";
import { ApplicationError } from "../src/errors.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";

const logger = Object.freeze({
  warn() {},
  info() {},
  error() {}
});

const TEST_UNSUBSCRIBE_KEY = Buffer.alloc(32, 0x41).toString("base64");

function configFixture() {
  return {
    publicBaseUrl: "https://outreach.example.test",
    crypto: {
      unsubscribeSigning: {
        schemaVersion: 2,
        active: { kid: "unsub-copy-2026-07", key: TEST_UNSUBSCRIBE_KEY },
        verifyOnly: []
      }
    },
    copyProvider: { enabled: false, minConfidence: 0.85 }
  };
}

function recordsFixture(overrides = {}) {
  return {
    match: { id: "match-1" },
    release: {
      id: "release-1",
      artistName: "Marc Rene",
      name: "Northern Lights",
      genres: ["Indie"],
      subGenres: ["Dream Pop"],
      description: "An independent release.",
      epkUrl: "https://artist.example.test/epk",
      privateStreamUrl: "https://artist.example.test/private",
      releaseDate: "2026-08-01",
      ...overrides.release
    },
    contact: {
      id: "contact-1",
      firstName: "Sam",
      role: "music editor",
      preferredLanguage: "nl",
      contactEvidence: "This address is published for submissions.",
      contactSourceUrl: "https://radio.example.test/contact",
      ...overrides.contact
    },
    outlet: {
      id: "outlet-1",
      name: "Example Radio",
      type: "Radio Station",
      genres: ["Indie"],
      submissionPolicy: "Explicit",
      submissionUrl: "https://radio.example.test/submissions",
      ...overrides.outlet
    }
  };
}

test("copy service checks only the selected release URL before persisting an artifact", async () => {
  const events = [];
  const checked = [];
  const artifacts = [];
  const records = recordsFixture();
  const service = createCopyService({
    repository: {
      async saveCopyArtifact(artifact) {
        events.push("save");
        artifacts.push(artifact);
        return "artifact-1";
      }
    },
    copyProvider: { async generate() { throw new Error("disabled provider must not run"); } },
    releaseLinkChecker: {
      async assertReachable(url) {
        events.push("check");
        checked.push(url);
      }
    },
    config: configFixture(),
    logger,
    metrics: new Metrics()
  });

  const result = await service.prepare({ ...records, sequenceStep: 0 });

  assert.equal(result.artifactId, "artifact-1");
  assert.deepEqual(events, ["check", "save"]);
  assert.deepEqual(checked, [records.release.epkUrl]);
  assert.ok(!checked[0].includes("unsubscribe"));
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].templateVersion, "safe-template-v2");
  assert.match(artifacts[0].copy.bodyText, /Afmelden:/u);
});

test("private stream is checked when no EPK URL is present", async () => {
  const checked = [];
  const records = recordsFixture({ release: { epkUrl: undefined } });
  const service = createCopyService({
    repository: { async saveCopyArtifact() { return "artifact-2"; } },
    copyProvider: {},
    releaseLinkChecker: { async assertReachable(url) { checked.push(url); } },
    config: configFixture(),
    logger,
    metrics: new Metrics()
  });

  await service.prepare({ ...records, sequenceStep: 1 });

  assert.deepEqual(checked, [records.release.privateStreamUrl]);
});

test("an unreachable release URL prevents artifact persistence and preserves failure classification", async () => {
  let saves = 0;
  const records = recordsFixture();
  const failure = new ApplicationError("not found", {
    code: "RELEASE_LINK_HTTP_404",
    statusCode: 422,
    retryable: false
  });
  const service = createCopyService({
    repository: {
      async saveCopyArtifact() {
        saves += 1;
        return "must-not-save";
      }
    },
    copyProvider: {},
    releaseLinkChecker: { async assertReachable() { throw failure; } },
    config: configFixture(),
    logger,
    metrics: new Metrics()
  });

  await assert.rejects(service.prepare({ ...records, sequenceStep: 0 }), (error) => error === failure);
  assert.equal(saves, 0);
});

test("copy service refuses construction without the mandatory reachability gate", () => {
  assert.throws(
    () => createCopyService({
      repository: {},
      copyProvider: {},
      config: configFixture(),
      logger,
      metrics: new Metrics()
    }),
    /releaseLinkChecker\.assertReachable is required/u
  );
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createSourceIngestionService } from "../src/application/source-ingestion-service.mjs";
import { buildSourceArtifact } from "../src/domain/source-adapters.mjs";
import { evidenceDigest, parseSourceArtifact } from "../src/domain/source-artifact.mjs";
import {
  canonicalizeSourceHttpsUrl,
  canonicalizeSourceRecordUrls
} from "../src/domain/source-url.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";

const CONFORMANCE = JSON.parse(readFileSync(
  new URL("../../../docs/outreach/source-url-conformance-v1.json", import.meta.url),
  "utf8"
));

test("worker canonicalizer satisfies the shared source URL conformance contract", () => {
  for (const fixture of CONFORMANCE.valid) {
    assert.equal(canonicalizeSourceHttpsUrl(fixture.input), fixture.output, fixture.name);
  }
  for (const fixture of CONFORMANCE.invalid) {
    assert.throws(
      () => canonicalizeSourceHttpsUrl(fixture.input),
      (error) => error.code === "SOURCE_HTTPS_URL_INVALID",
      fixture.name
    );
  }
  assert.throws(
    () => canonicalizeSourceHttpsUrl(`https://source.example/?token=${"x".repeat(CONFORMANCE.limits.maximumCharacters)}`),
    (error) => error.code === "SOURCE_HTTPS_URL_INVALID"
  );
});

test("source URLs remove only known tracking keys and deterministically retain functional parameters", () => {
  const canonical = canonicalizeSourceHttpsUrl(
    "https://EXAMPLE.COM.:443/catalog/./summer/../submit"
      + "?utm_source=newsletter&token=AbC%2B123%2F%3D&b=2&fbclid=click"
      + "&a=z&a=a&gclid=google&msclkid=bing&utm_campaign=launch"
  );

  assert.equal(
    canonical,
    "https://example.com/catalog/submit?a=a&a=z&b=2&token=AbC%2B123%2F%3D"
  );
  assert.equal(new URL(canonical).searchParams.get("token"), "AbC+123/=");

  assert.equal(
    canonicalizeSourceHttpsUrl(
      "https://source.example/path?UTM_Medium=email&mc_cid=keep&affiliate_id=42&ref=press&signature=z%2By"
    ),
    "https://source.example/path?affiliate_id=42&mc_cid=keep&ref=press&signature=z%2By"
  );
});

test("source URL canonicalization rejects ambiguous authority, fragments and unsafe encodings", () => {
  for (const value of [
    "http://source.example/path",
    "https:source.example/path",
    "https://user:secret@source.example/path",
    "https://@source.example/path",
    "https://source.example/path#section",
    "https://source.example/%",
    "https://source.example/%C3%28",
    "https://source.example/path?token=%0d%0aheader",
    "https://source.example\\@attacker.example/path"
  ]) {
    assert.throws(
      () => canonicalizeSourceHttpsUrl(value),
      (error) => error.code === "SOURCE_HTTPS_URL_INVALID",
      value
    );
  }
});

test("record canonicalization covers outlet, evidence and every release URL without mutating input", () => {
  const record = {
    kind: "musicRelease",
    websiteUrl: "https://ARTIST.example.:443/a/../home?utm_source=feed&lang=nl",
    spotifyUrl: "https://open.spotify.com/track/abc?si=functional&utm_medium=share",
    epkUrl: "https://artist.example/epk?access_token=keep&gclid=drop",
    privateStreamUrl: "https://artist.example/private?token=keep&fbclid=drop",
    downloadUrl: "https://artist.example/download?signature=keep&msclkid=drop",
    artworkUrl: "https://artist.example/art.jpg?size=large&utm_campaign=drop",
    radioEditUrl: "https://artist.example/radio.wav?disposition=download&utm_term=drop",
    evidence: {
      url: "https://ARTIST.example.:443/source/../proof?ref=keep&utm_content=drop",
      text: "Verified source evidence"
    }
  };

  const canonical = canonicalizeSourceRecordUrls(record);

  assert.notEqual(canonical, record);
  assert.notEqual(canonical.evidence, record.evidence);
  assert.equal(canonical.websiteUrl, "https://artist.example/home?lang=nl");
  assert.equal(canonical.spotifyUrl, "https://open.spotify.com/track/abc?si=functional");
  assert.equal(canonical.epkUrl, "https://artist.example/epk?access_token=keep");
  assert.equal(canonical.privateStreamUrl, "https://artist.example/private?token=keep");
  assert.equal(canonical.downloadUrl, "https://artist.example/download?signature=keep");
  assert.equal(canonical.artworkUrl, "https://artist.example/art.jpg?size=large");
  assert.equal(canonical.radioEditUrl, "https://artist.example/radio.wav?disposition=download");
  assert.equal(canonical.evidence.url, "https://artist.example/proof?ref=keep");
  assert.match(record.websiteUrl, /utm_source/u);
  assert.match(record.evidence.url, /utm_content/u);
});

test("artifact IDs are based on canonical source URLs while request authentication keeps exact bytes", async () => {
  const generatedAt = new Date().toISOString();
  const trackedRecord = outletRecord(generatedAt, {
    website: "https://RADIO.example.:443/shows/../?utm_source=directory&view=full",
    submissionUrl: "https://radio.example/submit?token=keep&fbclid=drop",
    evidence: {
      url: "https://radio.example/proof?utm_campaign=launch&revision=7",
      text: "The source explicitly publishes this music-submission route.",
      capturedAt: generatedAt
    }
  });
  const canonicalRecord = outletRecord(generatedAt, {
    website: "https://radio.example/?view=full",
    submissionUrl: "https://radio.example/submit?token=keep",
    evidence: {
      url: "https://radio.example/proof?revision=7",
      text: "The source explicitly publishes this music-submission route.",
      capturedAt: generatedAt
    }
  });

  const first = buildSourceArtifact({ sourceId: "dj-finder", records: [trackedRecord], generatedAt });
  const second = buildSourceArtifact({ sourceId: "dj-finder", records: [canonicalRecord], generatedAt });
  assert.equal(first.artifactId, second.artifactId);
  assert.deepEqual(first.records, second.records);

  const input = {
    ...first,
    artifactId: "url-boundary-projection",
    records: [trackedRecord]
  };
  const rawBody = Buffer.from(JSON.stringify(input));
  const receipt = {};
  const projected = {};
  const service = createSourceIngestionService({
    espocrm: {
      async findUniqueWhere() { return undefined; },
      async upsertByUnique(_entityType, _field, _value, payload) {
        Object.assign(projected, payload);
        return { id: "outlet-1", ...payload };
      }
    },
    repository: {
      async beginArtifact(value) {
        Object.assign(receipt, value);
        return {
          claimed: true,
          completed: false,
          lease: {
            sourceId: value.sourceId,
            artifactId: value.artifactId,
            leaseOwner: "source-url-test",
            leaseVersion: 1
          }
        };
      },
      async renewArtifactLease() { return true; },
      async completeArtifact() {},
      async failArtifact() { return true; },
      async linkRecord() {}
    },
    emailValidationProvider: { async validate() { throw new Error("not used"); } },
    cryptoBox: { privacyHash: (value) => createHash("sha256").update(value).digest("hex") },
    config: {
      sourceIngestion: {
        maxArtifactAgeSeconds: 86_400,
        maxEvidenceAgeSeconds: 7_776_000,
        processingLeaseSeconds: 900
      },
      emailValidation: { cacheTtlDays: 30 }
    },
    logger: { info() {} },
    metrics: new Metrics()
  });

  await service.ingest({ sourceId: "dj-finder", artifact: input, rawBody });
  assert.equal(projected.website, "https://radio.example/?view=full");
  assert.equal(projected.submissionUrl, "https://radio.example/submit?token=keep");
  assert.equal(projected.sourceUrl, "https://radio.example/proof?revision=7");
  assert.equal(receipt.contentDigest, createHash("sha256").update(rawBody).digest("hex"));
});

test("artifact parsing canonicalizes direct producer input and rejects unsafe URLs before projection", () => {
  const generatedAt = new Date().toISOString();
  const parsed = parseSourceArtifact({
    schemaVersion: "1.0",
    sourceId: "dj-finder",
    artifactId: "direct-source-url-input",
    generatedAt,
    records: [outletRecord(generatedAt, {
      website: "https://RADIO.example.:443/a/../?z=2&utm_source=feed&a=1",
      submissionUrl: "https://radio.example/submit?access_token=keep&gclid=drop",
      evidence: {
        url: "https://radio.example/proof?revision=7&msclkid=drop",
        text: "The source explicitly publishes this music-submission route.",
        capturedAt: generatedAt
      }
    })]
  });

  assert.equal(parsed.records[0].website, "https://radio.example/?a=1&z=2");
  assert.equal(parsed.records[0].submissionUrl, "https://radio.example/submit?access_token=keep");
  assert.equal(parsed.records[0].evidence.url, "https://radio.example/proof?revision=7");
  assert.equal(
    evidenceDigest(parsed.records[0]),
    createHash("sha256").update(
      `https://radio.example/proof?revision=7\n${generatedAt}\nThe source explicitly publishes this music-submission route.`
    ).digest("hex")
  );

  assert.throws(() => parseSourceArtifact({
    ...parsed,
    artifactId: "unsafe-source-url-input",
    records: [{ ...parsed.records[0], website: "https://user:secret@radio.example/" }]
  }), (error) => error.code === "SOURCE_ARTIFACT_INVALID");
});

function outletRecord(generatedAt, overrides = {}) {
  return {
    kind: "mediaOutlet",
    externalId: "radio-example",
    name: "Radio Example",
    type: "Radio Station",
    website: "https://radio.example/",
    genres: ["Dance"],
    submissionPolicy: "Explicit",
    acceptsEmail: true,
    verified: true,
    evidence: {
      url: "https://radio.example/proof",
      text: "The source explicitly publishes this music-submission route.",
      capturedAt: generatedAt
    },
    ...overrides
  };
}

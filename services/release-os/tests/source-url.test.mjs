import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stageReleaseSourceOutbox } from "../src/infrastructure/outreach/release-source-publisher.mjs";
import { canonicalizeSourceHttpsUrl } from "../src/infrastructure/outreach/source-url.mjs";

const CONFORMANCE = JSON.parse(readFileSync(
  new URL("../../../docs/outreach/source-url-conformance-v1.json", import.meta.url),
  "utf8"
));

test("Release OS canonicalizer satisfies the shared source URL conformance contract", () => {
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

test("Release OS canonicalizes every release and evidence URL before semantic digesting", () => {
  const generatedAt = new Date("2026-07-15T10:00:00.000Z");
  const trackedState = sourceState({
    spotifyUrl: "https://open.spotify.com/track/abc?si=keep&utm_source=share",
    websiteUrl: "https://ARTIST.example.:443/a/../home?lang=nl&fbclid=drop",
    epkUrl: "https://artist.example/epk?access_token=keep&gclid=drop",
    privateStreamUrl: "https://artist.example/private?token=keep&msclkid=drop",
    downloadUrl: "https://artist.example/download?signature=keep&utm_medium=drop",
    artworkUrl: "https://artist.example/art.jpg?size=large&utm_campaign=drop",
    radioEditUrl: "https://artist.example/radio.wav?disposition=download&utm_term=drop",
    sourceUrl: "https://ARTIST.example.:443/releases/../proof?revision=7&utm_content=drop"
  });
  const canonicalState = sourceState({
    spotifyUrl: "https://open.spotify.com/track/abc?si=keep",
    websiteUrl: "https://artist.example/home?lang=nl",
    epkUrl: "https://artist.example/epk?access_token=keep",
    privateStreamUrl: "https://artist.example/private?token=keep",
    downloadUrl: "https://artist.example/download?signature=keep",
    artworkUrl: "https://artist.example/art.jpg?size=large",
    radioEditUrl: "https://artist.example/radio.wav?disposition=download",
    sourceUrl: "https://artist.example/proof?revision=7"
  });

  const tracked = stageReleaseSourceOutbox(trackedState, generatedAt);
  const canonical = stageReleaseSourceOutbox(canonicalState, generatedAt);
  assert.equal(tracked.outbox.semanticDigest, canonical.outbox.semanticDigest);
  assert.equal(tracked.outbox.artifact.artifactId, canonical.outbox.artifact.artifactId);
  assert.deepEqual(tracked.outbox.artifact.records, canonical.outbox.artifact.records);

  const [record] = tracked.outbox.artifact.records;
  assert.equal(record.spotifyUrl, "https://open.spotify.com/track/abc?si=keep");
  assert.equal(record.websiteUrl, "https://artist.example/home?lang=nl");
  assert.equal(record.epkUrl, "https://artist.example/epk?access_token=keep");
  assert.equal(record.privateStreamUrl, "https://artist.example/private?token=keep");
  assert.equal(record.downloadUrl, "https://artist.example/download?signature=keep");
  assert.equal(record.artworkUrl, "https://artist.example/art.jpg?size=large");
  assert.equal(record.radioEditUrl, "https://artist.example/radio.wav?disposition=download");
  assert.equal(record.evidence.url, "https://artist.example/proof?revision=7");
  assert.equal(
    tracked.outbox.semanticDigest,
    createHash("sha256").update(JSON.stringify(tracked.outbox.artifact.records)).digest("hex")
  );
  assert.equal(tracked.outbox.rawBody, JSON.stringify(tracked.outbox.artifact));
});

function sourceState(urls) {
  return {
    releases: [{
      id: "release-source-url-test",
      title: "Source URL Test",
      artistDisplayName: "Artist",
      description: "A release used to verify canonical source URLs.",
      genre: "electronic",
      languages: ["en"],
      isrc: "NLABC1234567",
      sourceEvidence: "The owned release record and EPK identify this release.",
      sourceCapturedAt: "2026-07-15T09:59:00.000Z",
      updatedAt: "2026-07-15T09:59:00.000Z",
      ...urls
    }],
    outreachSourceOutbox: null,
    outreachSourceCheckpoint: null,
    audit: []
  };
}

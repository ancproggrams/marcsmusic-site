import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPlatformCapability,
  listPlatformCapabilities
} from "../src/domain/music/platform-capabilities.mjs";
import { createReleasePlan } from "../src/application/music/release-planner.mjs";

describe("music platform capabilities", () => {
  it("marks official direct upload platforms as auto-post capable", () => {
    const autoPostPlatforms = listPlatformCapabilities({ autoPostOnly: true }).map(
      (platform) => platform.id
    );

    assert.ok(autoPostPlatforms.includes("soundcloud"));
    assert.ok(autoPostPlatforms.includes("audius"));
    assert.ok(autoPostPlatforms.includes("mixcloud"));
    assert.ok(autoPostPlatforms.includes("spreaker"));
  });

  it("keeps distributor-only DSPs out of automatic upload", () => {
    const spotify = getPlatformCapability("spotify");

    assert.equal(spotify.canAutoPost, false);
    assert.equal(spotify.officialApiStatus, "distribution_only");
  });
});

describe("createReleasePlan", () => {
  it("builds an action plan for API, manual, and distributor targets", () => {
    const plan = createReleasePlan({
      releaseId: "rel-test",
      title: "Curacao",
      artist: "Marc Rene",
      audioSource: "s3://music/curacao.wav",
      targetPlatforms: ["soundcloud", "bandcamp", "spotify"]
    });

    assert.equal(plan.summary.total, 3);
    assert.equal(plan.summary.apiUploadReady, 1);
    assert.equal(plan.summary.manualUploadRequired, 1);
    assert.equal(plan.summary.distributorDeliveryRequired, 1);
    assert.deepEqual(
      plan.actions.map((action) => action.mode),
      ["api_upload", "manual_upload", "distributor_delivery"]
    );
  });

  it("defaults to Railway-observed MarcsMusic platforms", () => {
    const plan = createReleasePlan({
      title: "Weekend Mode",
      artist: "Marc Rene",
      audioSource: "file:///tmp/weekend-mode.wav"
    });

    assert.ok(plan.summary.total > 10);
    assert.ok(plan.actions.some((action) => action.platformId === "soundcloud"));
    assert.ok(plan.actions.some((action) => action.platformId === "bandcamp"));
    assert.ok(!plan.actions.some((action) => action.platformId === "spotify"));
  });

  it("rejects unknown platforms", () => {
    assert.throws(
      () =>
        createReleasePlan({
          title: "Unknown",
          artist: "Marc Rene",
          audioSource: "file:///tmp/unknown.wav",
          targetPlatforms: ["made-up-platform"]
        }),
      /Unsupported music platform/u
    );
  });

  it("requires a title, artist, and audio source", () => {
    assert.throws(
      () =>
        createReleasePlan({
          title: "No Audio",
          artist: "Marc Rene"
        }),
      /audioSource is required/u
    );
  });
});


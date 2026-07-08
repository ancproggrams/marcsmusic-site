import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPlatformRegistry, defaultPlatformRegistry } from "../src/domain/music/platform-registry.mjs";
import { MARCSMUSIC_RELEASE_PLATFORM_IDS } from "../src/domain/music/platform-capabilities.mjs";

describe("platform registry", () => {
  it("registers the default 15 MarcsMusic platform adapters", () => {
    const ids = defaultPlatformRegistry.listCapabilities().map((capability) => capability.id);

    assert.deepEqual(ids.sort(), [...MARCSMUSIC_RELEASE_PLATFORM_IDS].sort());
    assert.equal(defaultPlatformRegistry.requireAdapter("soundcloud").capability.id, "soundcloud");
    assert.equal(defaultPlatformRegistry.requireAdapter("spreaker").capability.id, "spreaker");
  });

  it("supports adding a fake platform without changing publication-service", async () => {
    const registry = createPlatformRegistry([
      {
        capability: {
          id: "fake",
          name: "Fake",
          requiredCredentialEnv: [],
          requirements: []
        },
        async publish({ action, dryRun }) {
          return {
            platformId: action.platformId,
            platformName: action.platformName,
            idempotencyKey: action.idempotencyKey,
            mode: action.mode,
            operation: action.operation,
            status: "dry_run",
            dryRun,
            message: "fake"
          };
        }
      }
    ]);

    assert.equal(registry.requireAdapter("fake").capability.name, "Fake");
  });

  it("throws a clear error for unknown adapters", () => {
    assert.throws(() => defaultPlatformRegistry.requireAdapter("missing"), /Unsupported music platform adapter/u);
  });
});


import { normalizePlatformId } from "./platform-capabilities.mjs";
import { platformAdapters } from "../../infrastructure/music/platforms/index.mjs";

export function createPlatformRegistry(adapters = platformAdapters) {
  const byId = new Map();

  for (const adapter of adapters) {
    validateAdapter(adapter);
    byId.set(adapter.capability.id, adapter);
  }

  return Object.freeze({
    listAdapters() {
      return Object.freeze([...byId.values()]);
    },

    listCapabilities() {
      return Object.freeze([...byId.values()].map((adapter) => adapter.capability));
    },

    getAdapter(platformId) {
      return byId.get(normalizePlatformId(platformId));
    },

    requireAdapter(platformId) {
      const adapter = byId.get(normalizePlatformId(platformId));

      if (!adapter) {
        throw new TypeError(`Unsupported music platform adapter: ${platformId}`);
      }

      return adapter;
    }
  });
}

export const defaultPlatformRegistry = createPlatformRegistry();

function validateAdapter(adapter) {
  if (!adapter?.capability?.id || typeof adapter.publish !== "function") {
    throw new TypeError("platform adapter must expose capability.id and publish()");
  }
}


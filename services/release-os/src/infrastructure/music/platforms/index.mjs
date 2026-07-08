import { MARCSMUSIC_RELEASE_PLATFORM_IDS } from "../../../domain/music/platform-capabilities.mjs";
import { audiusAdapter } from "./audius.mjs";
import { jamendoAdapter } from "./jamendo.mjs";
import { createManualPlatformAdapter } from "./manual-platform.mjs";
import { soundCloudAdapter } from "./soundcloud.mjs";
import { spreakerAdapter } from "./spreaker.mjs";

const explicitAdapters = [
  audiusAdapter,
  jamendoAdapter,
  soundCloudAdapter,
  spreakerAdapter
];

const explicitIds = new Set(explicitAdapters.map((adapter) => adapter.capability.id));
const manualAdapters = MARCSMUSIC_RELEASE_PLATFORM_IDS.filter((id) => !explicitIds.has(id)).map((id) =>
  createManualPlatformAdapter(id)
);

export const platformAdapters = Object.freeze([...explicitAdapters, ...manualAdapters]);


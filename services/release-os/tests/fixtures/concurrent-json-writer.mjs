import { readFile } from "node:fs/promises";

import { PlayerManifestClient } from "../../src/infrastructure/marcsmusic-site/player-client.mjs";
import { JsonStore } from "../../src/infrastructure/storage/json-store.mjs";

const [kind, filePath, identifier, startPath] = process.argv.slice(2);
if (!kind || !filePath || !identifier || !startPath) throw new Error("writer arguments are required");

while (true) {
  try {
    await readFile(startPath);
    break;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

if (kind === "store") {
  const store = new JsonStore({ filePath, initialState: { values: [] } });
  await store.update((state) => {
    state.values ??= [];
    state.values.push(identifier);
  });
} else if (kind === "player") {
  const client = new PlayerManifestClient({ manifestPath: filePath });
  await client.upsertTrack({ releaseId: identifier, title: identifier });
} else {
  throw new Error(`unknown writer kind: ${kind}`);
}

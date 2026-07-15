import { createMusicApiServer } from "../src/interfaces/http/music-api-server.mjs";
import { JsonStore, createDefaultState } from "../src/infrastructure/storage/json-store.mjs";
import {
  createReleaseSourcePublisher,
  loadReleaseSourceConfig,
  stageReleaseSourceOutbox,
  startReleaseSourcePublisherLoop
} from "../src/infrastructure/outreach/release-source-publisher.mjs";

const port = parsePort(process.env.PORT ?? process.env.MUSIC_API_PORT ?? "8787");
const host = process.env.MUSIC_API_HOST ?? "0.0.0.0";
const abortController = new AbortController();
const store = new JsonStore({ filePath: process.env.MUSIC_STORE_PATH, initialState: createDefaultState() });
const sourceConfig = loadReleaseSourceConfig();
const sourcePublisher = createReleaseSourcePublisher({ store, config: sourceConfig });
const server = createMusicApiServer({
  store,
  sourceOutboxStager: sourceConfig.enabled
    ? (state, generatedAt) => stageReleaseSourceOutbox(state, generatedAt, sourceConfig)
    : undefined
});
const sourcePublisherLoop = sourceConfig.enabled
  ? startReleaseSourcePublisherLoop({ publisher: sourcePublisher, intervalMs: sourceConfig.intervalMs, signal: abortController.signal })
  : undefined;

server.listen(port, host, () => {
  console.log(`MarcsMusic API listening on http://${host}:${port}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    abortController.abort();
    sourcePublisherLoop?.stop();
    server.close((error) => {
      if (error) process.exitCode = 1;
    });
  });
}

function parsePort(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new TypeError("PORT or MUSIC_API_PORT must be a valid TCP port");
  }

  return parsed;
}

import { JsonStore, createDefaultState } from "../src/infrastructure/storage/json-store.mjs";
import {
  loadReleaseSourceConfig,
  recoverReleaseSourceDeadLetter
} from "../src/infrastructure/outreach/release-source-publisher.mjs";

const operator = process.env.OUTREACH_SOURCE_RECOVERY_OPERATOR;
const reason = process.env.OUTREACH_SOURCE_RECOVERY_REASON;
const config = loadReleaseSourceConfig();
const store = new JsonStore({ filePath: process.env.MUSIC_STORE_PATH, initialState: createDefaultState() });

const result = await store.update((state) => recoverReleaseSourceDeadLetter(state, {
  operator,
  reason,
  maxAttempts: config.maxAttempts,
  maxReissues: config.maxReissues,
  maxOperatorRecoveries: config.maxOperatorRecoveries
}));

console.log(JSON.stringify({ recovered: true, ...result }));

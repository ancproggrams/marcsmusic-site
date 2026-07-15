import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { readJsonFile, withExclusiveFileMutation, writeJsonAtomically } from "./atomic-json-file.mjs";

const DEFAULT_STORE_FILE = "marcsmusic-release-os.json";

export class JsonStore {
  constructor(options = {}) {
    this.filePath = resolve(options.filePath ?? join(process.cwd(), "data", DEFAULT_STORE_FILE));
    this.initialState = options.initialState ?? {};
    this.lockOptions = {
      lockTimeoutMs: options.lockTimeoutMs ?? process.env.MUSIC_FILE_LOCK_TIMEOUT_MS,
      lockLeaseMs: options.lockLeaseMs ?? process.env.MUSIC_FILE_LOCK_LEASE_MS
    };
  }

  async read() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      return normalizeState(await readJsonFile(this.filePath), this.initialState);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      return withExclusiveFileMutation(this.filePath, async (lease) => {
        try {
          return normalizeState(await readJsonFile(this.filePath), this.initialState);
        } catch (currentError) {
          if (currentError.code !== "ENOENT") throw currentError;
          const state = normalizeState({}, this.initialState);
          await writeJsonAtomically(this.filePath, state, { assertLease: lease.assertOwned });
          return state;
        }
      }, this.lockOptions);
    }
  }

  async write(state) {
    return withExclusiveFileMutation(
      this.filePath,
      (lease) => writeJsonAtomically(this.filePath, state, { assertLease: lease.assertOwned }),
      this.lockOptions
    );
  }

  async update(work) {
    return withExclusiveFileMutation(this.filePath, async (lease) => {
      let state;
      try {
        state = normalizeState(await readJsonFile(this.filePath), this.initialState);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        state = normalizeState({}, this.initialState);
      }
      const result = await work(state);
      await writeJsonAtomically(this.filePath, state, { assertLease: lease.assertOwned });
      return result;
    }, this.lockOptions);
  }
}

export function createDefaultState() {
  return {
    artists: [],
    releases: [],
    assets: [],
    publicationOutbox: [],
    publicationAttempts: [],
    playerEntries: [],
    emailCampaigns: [],
    emailCampaignRecipients: [],
    outreachSourceOutbox: null,
    outreachSourceCheckpoint: null,
    audit: []
  };
}

export function audit(state, action, details = {}) {
  state.audit ??= [];
  state.audit.unshift({
    id: randomUUID(),
    action,
    at: new Date().toISOString(),
    details
  });
  state.audit = state.audit.slice(0, 1000);
}

function normalizeState(state, initialState) {
  return {
    ...createDefaultState(),
    ...initialState,
    ...state
  };
}

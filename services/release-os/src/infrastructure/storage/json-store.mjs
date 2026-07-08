import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const DEFAULT_STORE_FILE = "marcsmusic-release-os.json";

export class JsonStore {
  constructor(options = {}) {
    this.filePath = resolve(options.filePath ?? join(process.cwd(), "data", DEFAULT_STORE_FILE));
    this.initialState = options.initialState ?? {};
    this.queue = Promise.resolve();
  }

  async read() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      const raw = await readFile(this.filePath, "utf8");
      return normalizeState(JSON.parse(raw), this.initialState);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      const state = normalizeState({}, this.initialState);
      await this.write(state);
      return state;
    }
  }

  async write(state) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tmpPath, this.filePath);
  }

  async update(work) {
    const next = this.queue.then(async () => {
      const state = await this.read();
      const result = await work(state);
      await this.write(state);
      return result;
    });

    this.queue = next.catch(() => {});
    return next;
  }
}

export function createDefaultState() {
  return {
    artists: [],
    releases: [],
    assets: [],
    publicationAttempts: [],
    playerEntries: [],
    emailCampaigns: [],
    emailCampaignRecipients: [],
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

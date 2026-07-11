const DEFAULT_MAX_CONCURRENT_UPLOADS = 1;
const MAX_CONFIGURED_CONCURRENT_UPLOADS = 4;
const CAPACITY_RETRY_AFTER_SECONDS = 30;

export class UploadAdmissionController {
  #active = 0;

  constructor(options = {}) {
    this.maxConcurrent = parseConcurrencyLimit(options.maxConcurrent);
    Object.freeze(this);
  }

  get active() { return this.#active; }
  get atCapacity() { return this.#active >= this.maxConcurrent; }

  async run(operation) {
    if (typeof operation !== "function") throw new TypeError("Upload operation must be a function");
    if (this.atCapacity) {
      throw Object.assign(new Error("Upload capacity is temporarily exhausted"), {
        statusCode: 503,
        code: "UPLOAD_CAPACITY_EXCEEDED",
        retryAfterSeconds: CAPACITY_RETRY_AFTER_SECONDS,
        closeConnection: true
      });
    }
    this.#active += 1;
    try {
      return await operation();
    } finally {
      this.#active -= 1;
    }
  }
}

function parseConcurrencyLimit(value) {
  const candidate = value ?? DEFAULT_MAX_CONCURRENT_UPLOADS;
  const parsed = typeof candidate === "string" && /^\d+$/u.test(candidate.trim()) ? Number(candidate) : candidate;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_CONFIGURED_CONCURRENT_UPLOADS) {
    throw new RangeError(`maxConcurrent must be an integer between 1 and ${MAX_CONFIGURED_CONCURRENT_UPLOADS}`);
  }
  return parsed;
}

const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;

export class EspoCrmClient {
  constructor(options = {}) {
    const env = options.env ?? process.env;
    this.baseUrl = stripTrailingSlash(options.baseUrl ?? env.ESPOCRM_BASE_URL);
    this.apiKey = options.apiKey ?? env.ESPOCRM_API_KEY;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? parsePositiveInteger(env.ESPOCRM_TIMEOUT_MS, 10_000);
    this.maxResponseBytes = options.maxResponseBytes ?? parsePositiveInteger(
      env.ESPOCRM_MAX_RESPONSE_BYTES,
      DEFAULT_MAX_RESPONSE_BYTES
    );
    this.fixtureContacts = options.contacts;
  }

  isConfigured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async listContacts() {
    if (Array.isArray(this.fixtureContacts)) {
      return this.fixtureContacts.map(normalizeEspoContact);
    }

    if (!this.isConfigured()) {
      throw Object.assign(new Error("EspoCRM is not configured"), {
        statusCode: 503,
        code: "ESPOCRM_NOT_CONFIGURED"
      });
    }

    const controller = new AbortController();
    let timeout;
    const operation = (async () => {
      const response = await this.fetch(`${this.baseUrl}/api/v1/Contact?maxSize=200`, {
        headers: {
          "X-Api-Key": this.apiKey,
          accept: "application/json"
        },
        redirect: "error",
        signal: controller.signal
      });
      const body = await readBoundedJson(response, this.maxResponseBytes);
      if (!response.ok) throw espoError(`EspoCRM returned HTTP ${response.status}`, "ESPOCRM_REQUEST_FAILED");
      return (body.list ?? body.records ?? []).map(normalizeEspoContact);
    })();

    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(espoError("EspoCRM request timed out", "ESPOCRM_TIMEOUT", 504));
          }, this.timeoutMs);
        })
      ]);
    } catch (error) {
      if (error?.code?.startsWith?.("ESPOCRM_")) throw error;
      if (error?.name === "AbortError") throw espoError("EspoCRM request timed out", "ESPOCRM_TIMEOUT", 504);
      throw espoError("EspoCRM request failed", "ESPOCRM_REQUEST_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function readBoundedJson(response, maximumBytes) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) {
    throw espoError("EspoCRM response exceeded the configured byte limit", "ESPOCRM_RESPONSE_TOO_LARGE");
  }
  let bytes;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maximumBytes) {
          await reader.cancel().catch(() => {});
          throw espoError("EspoCRM response exceeded the configured byte limit", "ESPOCRM_RESPONSE_TOO_LARGE");
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock?.();
    }
    bytes = Buffer.concat(chunks, total);
  } else {
    const text = typeof response.text === "function"
      ? await response.text()
      : JSON.stringify(await response.json());
    bytes = Buffer.from(text, "utf8");
    if (bytes.byteLength > maximumBytes) {
      throw espoError("EspoCRM response exceeded the configured byte limit", "ESPOCRM_RESPONSE_TOO_LARGE");
    }
  }
  try {
    return bytes.byteLength ? JSON.parse(bytes.toString("utf8")) : {};
  } catch {
    throw espoError("EspoCRM returned invalid JSON", "ESPOCRM_RESPONSE_INVALID");
  }
}

function espoError(message, code, statusCode = 502) {
  return Object.assign(new Error(message), { statusCode, code, retryable: statusCode >= 500 });
}

export function normalizeEspoContact(contact) {
  const tags = normalizeTags(contact.tags ?? contact.tagList ?? contact.cTagList);
  return Object.freeze({
    id: String(contact.id ?? contact.emailAddress ?? contact.email ?? ""),
    email: normalizeEmail(contact.emailAddress ?? contact.email),
    name: optionalString(contact.name) ?? optionalString(`${contact.firstName ?? ""} ${contact.lastName ?? ""}`),
    organization: optionalString(contact.accountName ?? contact.organization),
    type: normalizeType(contact.type ?? contact.contactType ?? contact.cType),
    language: normalizeLanguage(contact.language ?? contact.preferredLanguage ?? contact.cLanguage),
    country: optionalString(contact.country ?? contact.cCountry),
    genres: normalizeTags(contact.genres ?? contact.genre ?? contact.cGenres),
    priority: optionalString(contact.priority ?? contact.cPriority),
    tags,
    status: normalizeStatus(contact),
    artistAudiences: normalizeTags(contact.artistAudiences ?? contact.artistTags ?? contact.cArtistAudiences),
    rawId: contact.id
  });
}

function normalizeStatus(contact) {
  if (contact.unsubscribed || contact.isUnsubscribed) return "unsubscribed";
  if (contact.bounced || contact.isBounced) return "bounced";
  if (contact.complained || contact.hasComplained) return "complained";
  if (contact.suppressed || contact.isSuppressed) return "suppressed";
  if (contact.status && String(contact.status).toLowerCase() !== "active") return String(contact.status).toLowerCase();
  return "active";
}

function normalizeType(value) {
  const normalized = optionalString(value)?.toLowerCase().replace(/[^a-z0-9]+/gu, "_");
  return normalized || "other";
}

function normalizeLanguage(value) {
  return optionalString(value)?.toLowerCase().slice(0, 2) || "en";
}

function normalizeTags(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : String(value).split(/[,\n]/u);
  return [...new Set(values.map(optionalString).filter(Boolean).map((item) => item.toLowerCase()))];
}

function normalizeEmail(value) {
  return optionalString(value)?.toLowerCase();
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stripTrailingSlash(value) {
  return value ? String(value).replace(/\/+$/u, "") : undefined;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

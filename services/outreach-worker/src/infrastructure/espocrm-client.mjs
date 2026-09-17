import { setTimeout as sleep } from "node:timers/promises";
import { ApplicationError } from "../errors.mjs";
import { createAbortScope } from "./abort-signal.mjs";
import { readBoundedResponseText, ResponseSizeLimitError } from "./bounded-response.mjs";

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_RESPONSE_BYTES = 4 * 1_024 * 1_024;
const ALLOWED_ENTITY_TYPES = new Set([
  "MusicRelease",
  "MediaOutlet",
  "MediaContact",
  "OutreachMatch",
  "OutreachEvent",
  "OutreachDailyReport",
  "OutreachSuppression",
  "Email",
  "Campaign",
  "TargetList",
  "Opportunity",
  "Lead",
  "CampaignLogRecord"
]);
const IMMUTABLE_UNIQUE_UPSERT_TYPES = new Set(["OutreachEvent", "Email"]);
const PROJECTION_IDENTITY_FIELDS_BY_TYPE = new Map([
  ["MusicRelease", Object.freeze(["isrc"])],
  ["MediaOutlet", Object.freeze(["fingerprint"])],
  ["OutreachMatch", Object.freeze([
    "musicReleaseId", "mediaContactId", "mediaOutletId", "idempotencyKey"
  ])],
  ["OutreachSuppression", Object.freeze([
    "subjectHash", "subjectType", "emailAddress", "domain", "mediaContactId", "mediaOutletId"
  ])],
  ["OutreachDailyReport", Object.freeze(["reportDate"])],
  ["TargetList", Object.freeze(["outreachProjectionKey", "musicReleaseId"])],
  ["Campaign", Object.freeze(["outreachProjectionKey", "musicReleaseId"])],
  ["Email", Object.freeze([
    "outreachProjectionKey",
    "outreachCorrelationId",
    "outreachProviderMessageId",
    "outreachDeterministicMessageId",
    "outreachAcceptedAt",
    "outreachAutomaticResponse",
    "outreachMatchId",
    "outreachCampaignId",
    "musicReleaseId",
    "mediaContactId",
    "mediaOutletId"
  ])],
  ["Opportunity", Object.freeze([
    "outreachProjectionKey",
    "outreachMatchId",
    "musicReleaseId",
    "mediaContactId",
    "mediaOutletId",
    "sourceOutreachEventId"
  ])],
  ["OutreachEvent", Object.freeze([
    "outreachMatchId",
    "mediaContactId",
    "musicReleaseId",
    "mediaOutletId",
    "campaignId",
    "emailId",
    "externalEventId"
  ])]
]);
const ALLOWED_RELATION_LINKS = new Map([
  ["Campaign", new Set(["targetLists"])],
  ["TargetList", new Set(["mediaContacts"])]
]);

export class EspoCrmClient {
  constructor(config, options = {}) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs;
    this.pageSize = config.maxPageSize;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.sleep = options.sleep ?? sleep;
    this.signal = options.signal;
  }

  async health() {
    await this.request("GET", "App/user", undefined, { attempts: 1 });
    return true;
  }

  async aggregateDailyReport({ start, end } = {}) {
    const normalizedStart = toEspoDateTime(start);
    const normalizedEnd = toEspoDateTime(end);
    if (normalizedEnd <= normalizedStart) {
      throw new ApplicationError("EspoCRM aggregate window is invalid", {
        code: "ESPOCRM_DAILY_REPORT_WINDOW_INVALID",
        statusCode: 500,
        retryable: false
      });
    }
    const query = new URLSearchParams({ start: normalizedStart, end: normalizedEnd });
    const response = await this.request("GET", `OutreachDailyReport/aggregate?${query.toString()}`);
    return validateDailyReportAggregate(response);
  }

  async probeEntity(entityType) {
    assertEntityType(entityType);
    const searchParams = { offset: 0, maxSize: 1, select: ["id"] };
    await this.request("GET", `${encodeURIComponent(entityType)}?searchParams=${encodeURIComponent(JSON.stringify(searchParams))}`, undefined, {
      headers: { "X-No-Total": "true" },
      attempts: 1
    });
    return true;
  }

  async get(entityType, id, select) {
    assertEntityType(entityType);
    const query = select?.length ? `?attributeSelect=${encodeURIComponent(select.join(","))}` : "";
    return this.request("GET", `${encodeURIComponent(entityType)}/${encodeURIComponent(id)}${query}`);
  }

  async list(entityType, options = {}) {
    assertEntityType(entityType);
    const records = [];
    for await (const page of this.iterate(entityType, options)) records.push(...page);
    return records;
  }

  iterate(entityType, options = {}) {
    assertEntityType(entityType);
    if (options.orderBy && (options.orderBy !== "modifiedAt" || (options.order ?? "asc") !== "asc")) {
      throw new ApplicationError("EspoCRM iteration requires ascending (modifiedAt,id) keyset order", {
        code: "ESPOCRM_UNSAFE_PAGINATION_ORDER",
        statusCode: 500,
        retryable: false
      });
    }
    const lowerWatermark = options.lowerWatermark ?? new Date(0);
    const upperWatermark = options.upperWatermark ?? new Date();
    return this.iterateModifiedBetween(entityType, lowerWatermark, upperWatermark, options);
  }

  iterateModifiedSince(entityType, since, options = {}) {
    return this.iterateModifiedBetween(entityType, since, options.upperWatermark ?? new Date(), options);
  }

  async *iterateModifiedBetween(entityType, since, until, options = {}) {
    assertEntityType(entityType);
    const lower = toEspoDateTime(since);
    const upper = toEspoDateTime(until);
    if (upper < lower) {
      throw new ApplicationError("EspoCRM upper watermark precedes the lower watermark", {
        code: "ESPOCRM_WATERMARK_INVALID",
        statusCode: 500,
        retryable: false
      });
    }
    const maxRecords = options.maxRecords ?? 10_000_000;
    const readLimit = maxRecords + 1;
    const selected = options.select
      ? [...new Set([...options.select, "id", "modifiedAt"])]
      : undefined;
    const baseWhere = options.where ?? [];
    const requestedCursor = options.cursor ?? { modifiedAt: lower, id: "" };
    let cursor = normalizeCursor(requestedCursor, lower, upper);
    let seen = 0;

    const emit = async function* (records) {
      if (!records.length) return;
      seen += records.length;
      if (seen > maxRecords) throw resultBoundExceeded(entityType);
      yield Object.freeze(records);
    };

    // A resumed cursor may be in the middle of a large equal-timestamp group.
    // Drain that group ordered by id before advancing modifiedAt.
    while (cursor.modifiedAt <= upper && seen < readLimit) {
      const exactMaxSize = Math.min(this.pageSize, readLimit - seen);
      const exact = await this.#readListPage(entityType, {
        maxSize: exactMaxSize,
        where: [
          ...baseWhere,
          { type: "equals", attribute: "modifiedAt", value: cursor.modifiedAt },
          ...(cursor.id ? [{ type: "greaterThan", attribute: "id", value: cursor.id }] : [])
        ],
        select: selected,
        orderBy: "id",
        order: "asc"
      });
      if (!exact.length) break;
      const ordered = validateAndOrderPage(exact, { exactModifiedAt: cursor.modifiedAt, afterId: cursor.id });
      cursor = recordCursor(ordered.at(-1));
      for await (const page of emit(ordered)) yield page;
      if (exact.length < exactMaxSize) break;
    }

    while (cursor.modifiedAt < upper && seen < readLimit) {
      const maxSize = Math.min(this.pageSize, readLimit - seen);
      const probe = await this.#readListPage(entityType, {
        maxSize,
        where: [
          ...baseWhere,
          { type: "greaterThan", attribute: "modifiedAt", value: cursor.modifiedAt },
          { type: "lessThanOrEquals", attribute: "modifiedAt", value: upper }
        ],
        select: selected,
        orderBy: "modifiedAt",
        order: "asc"
      });
      if (!probe.length) return;
      const orderedProbe = validateAndOrderPage(probe);
      if (probe.length < maxSize) {
        cursor = recordCursor(orderedProbe.at(-1));
        for await (const page of emit(orderedProbe)) yield page;
        return;
      }

      // EspoCRM supports one order attribute. Every row strictly before the
      // last timestamp is complete under ORDER BY modifiedAt; the boundary
      // timestamp is re-read separately with ORDER BY id to form a true pair
      // keyset and avoid offset/tie drift.
      const boundary = orderedProbe.at(-1).modifiedAt;
      const stablePrefix = orderedProbe.filter((record) => record.modifiedAt < boundary);
      if (stablePrefix.length) {
        cursor = recordCursor(stablePrefix.at(-1));
        for await (const page of emit(stablePrefix)) yield page;
      }
      cursor = { modifiedAt: boundary, id: "" };
      while (seen < readLimit) {
        const boundaryMaxSize = Math.min(this.pageSize, readLimit - seen);
        const boundaryPage = await this.#readListPage(entityType, {
          maxSize: boundaryMaxSize,
          where: [
            ...baseWhere,
            { type: "equals", attribute: "modifiedAt", value: boundary },
            ...(cursor.id ? [{ type: "greaterThan", attribute: "id", value: cursor.id }] : [])
          ],
          select: selected,
          orderBy: "id",
          order: "asc"
        });
        if (!boundaryPage.length) break;
        const orderedBoundary = validateAndOrderPage(boundaryPage, {
          exactModifiedAt: boundary,
          afterId: cursor.id
        });
        cursor = recordCursor(orderedBoundary.at(-1));
        for await (const page of emit(orderedBoundary)) yield page;
        if (boundaryPage.length < boundaryMaxSize) break;
      }
    }
  }

  async listModifiedSince(entityType, since, options = {}) {
    const records = [];
    for await (const page of this.iterateModifiedSince(entityType, since, options)) records.push(...page);
    return records;
  }

  async #readListPage(entityType, searchParams) {
    const response = await this.request(
      "GET",
      `${encodeURIComponent(entityType)}?searchParams=${encodeURIComponent(JSON.stringify(searchParams))}`,
      undefined,
      { headers: { "X-No-Total": "true" } }
    );
    const records = response.list ?? response.records ?? [];
    if (!Array.isArray(records)) {
      throw new ApplicationError("EspoCRM list response is malformed", {
        code: "ESPOCRM_LIST_RESPONSE_INVALID",
        statusCode: 502,
        retryable: false
      });
    }
    return records;
  }

  async findOne(entityType, attribute, value, select) {
    return this.findUniqueWhere(entityType, [{ type: "equals", attribute, value }], select);
  }

  async findUniqueWhere(entityType, where, select) {
    assertEntityType(entityType);
    if (!Array.isArray(where) || !where.length) {
      throw new ApplicationError("EspoCRM unique lookup requires criteria", {
        code: "ESPOCRM_UNIQUE_CRITERIA_MISSING",
        statusCode: 500,
        retryable: false
      });
    }
    const records = await this.#readListPage(entityType, {
      where,
      select: select ? [...new Set([...select, "id"])] : undefined,
      maxSize: 2
    });
    if (records.length > 1) {
      throw new ApplicationError(`Duplicate ${entityType} records for unique criteria`, {
        code: "ESPOCRM_UNIQUE_CONTRACT_VIOLATED",
        statusCode: 500,
        retryable: false
      });
    }
    return records[0];
  }

  create(entityType, payload) {
    assertEntityType(entityType);
    return this.request("POST", encodeURIComponent(entityType), payload, { attempts: 1 });
  }

  update(entityType, id, payload, options = {}) {
    assertEntityType(entityType);
    const versionNumber = options.versionNumber;
    return this.request("PUT", `${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`, payload, {
      ...(Number.isInteger(versionNumber) ? { headers: { "X-Version-Number": String(versionNumber) } } : {})
    });
  }

  async updateConditional(entityType, id, payload, versionNumber) {
    if (!Number.isInteger(versionNumber) || versionNumber < 0) {
      throw new ApplicationError("EspoCRM versionNumber is required for a conditional update", {
        code: "ESPOCRM_VERSION_REQUIRED",
        statusCode: 503,
        retryable: true
      });
    }
    try {
      return await this.update(entityType, id, payload, { versionNumber });
    } catch (error) {
      if (error.statusCode === 409) {
        throw new ApplicationError("EspoCRM record changed during a conditional update", {
          code: "ESPOCRM_VERSION_CONFLICT",
          statusCode: 409,
          retryable: true,
          details: error.details,
          cause: error
        });
      }
      if (!error.deliveryUnknown) throw error;
      try {
        const current = await this.get(entityType, id, [...Object.keys(payload), "versionNumber"]);
        if (payloadMatches(current, payload)) return current;
      } catch (readError) {
        if (readError.code !== "ESPOCRM_HTTP_404") {
          // The workflow retry will perform a fresh read and a new conditional transition.
        }
      }
      throw new ApplicationError("EspoCRM update outcome could not be confirmed", {
        code: "ESPOCRM_UPDATE_UNCONFIRMED",
        statusCode: 503,
        retryable: true,
        details: { entityType, id },
        cause: error
      });
    }
  }

  async upsertByUnique(entityType, attribute, value, payload) {
    const immutable = IMMUTABLE_UNIQUE_UPSERT_TYPES.has(entityType);
    const identityFields = PROJECTION_IDENTITY_FIELDS_BY_TYPE.get(entityType) ?? [];
    const selectedFields = [...new Set([
      "id",
      "versionNumber",
      attribute,
      ...identityFields,
      ...(immutable ? Object.keys(payload) : [])
    ])];
    const existing = await this.findOne(
      entityType,
      attribute,
      value,
      selectedFields
    );
    if (existing) {
      assertExpectedProjectionIdentity(existing, payload, entityType, attribute, value, identityFields);
      if (immutable) return assertImmutableProjection(existing, payload, entityType, attribute);
      const updatePayload = omitProjectionIdentityFields(payload, identityFields);
      if (!Object.keys(updatePayload).length) return existing;
      return this.updateConditional(entityType, existing.id, updatePayload, existing.versionNumber);
    }
    try {
      return await this.create(entityType, payload);
    } catch (error) {
      if (!error.deliveryUnknown && error.statusCode !== 409) throw error;
      const reconciled = await this.findOne(
        entityType,
        attribute,
        value,
        selectedFields
      );
      if (reconciled) {
        assertExpectedProjectionIdentity(reconciled, payload, entityType, attribute, value, identityFields);
        return immutable ? assertImmutableProjection(reconciled, payload, entityType, attribute) : reconciled;
      }
      throw error;
    }
  }

  async isRelated(entityType, id, link, foreignId) {
    const relatedId = requiredIdentifier(foreignId);
    const response = await this.#readLinked(entityType, id, link, {
      maxSize: 2,
      select: ["id"],
      where: [{ type: "equals", attribute: "id", value: relatedId }]
    }, { noTotal: true });
    const records = linkedRecords(response);
    if (records.length > 1) {
      throw new ApplicationError("EspoCRM relationship contains duplicate identities", {
        code: "ESPOCRM_RELATION_DUPLICATE",
        statusCode: 500,
        retryable: false,
        details: { entityType, id, link, foreignId }
      });
    }
    return records.length === 1 && records[0]?.id === relatedId;
  }

  async relateUnique(entityType, id, link, foreignId) {
    assertRelationLink(entityType, link);
    const recordId = requiredIdentifier(id);
    const relatedId = requiredIdentifier(foreignId);
    if (await this.isRelated(entityType, recordId, link, relatedId)) return false;

    try {
      await this.request(
        "POST",
        `${encodeURIComponent(entityType)}/${encodeURIComponent(recordId)}/${encodeURIComponent(link)}`,
        { id: relatedId },
        { attempts: 1 }
      );
    } catch (error) {
      if (!error.deliveryUnknown && error.statusCode !== 409) throw error;
      if (await this.isRelated(entityType, recordId, link, relatedId)) return false;
      throw new ApplicationError("EspoCRM relationship write could not be confirmed", {
        code: "ESPOCRM_RELATION_WRITE_UNCONFIRMED",
        statusCode: 503,
        retryable: true,
        details: { entityType, id: recordId, link, foreignId: relatedId },
        cause: error
      });
    }

    if (await this.isRelated(entityType, recordId, link, relatedId)) return true;
    throw new ApplicationError("EspoCRM relationship postcondition was not observed", {
      code: "ESPOCRM_RELATION_POSTCONDITION_FAILED",
      statusCode: 503,
      retryable: true,
      details: { entityType, id: recordId, link, foreignId: relatedId }
    });
  }

  async countLinked(entityType, id, link) {
    const response = await this.#readLinked(entityType, id, link, {
      maxSize: 1,
      select: ["id"]
    });
    if (!Number.isSafeInteger(response?.total) || response.total < 0) {
      throw new ApplicationError("EspoCRM relationship response omitted an exact total", {
        code: "ESPOCRM_RELATION_TOTAL_MISSING",
        statusCode: 502,
        retryable: true,
        details: { entityType, id, link }
      });
    }
    return response.total;
  }

  async #readLinked(entityType, id, link, searchParams, { noTotal = false } = {}) {
    assertRelationLink(entityType, link);
    const response = await this.request(
      "GET",
      `${encodeURIComponent(entityType)}/${encodeURIComponent(requiredIdentifier(id))}/${encodeURIComponent(link)}?searchParams=${encodeURIComponent(JSON.stringify(searchParams))}`,
      undefined,
      noTotal ? { headers: { "X-No-Total": "true" } } : undefined
    );
    linkedRecords(response);
    return response;
  }

  async request(method, path, payload, options = {}) {
    const attempts = options.attempts ?? (method === "POST" ? 1 : 3);
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const abortScope = createAbortScope({
        signals: [this.signal, options.signal],
        timeoutMs: this.timeoutMs
      });
      try {
        const response = await this.fetch(`${this.baseUrl}/api/v1/${path}`, {
          method,
          headers: {
            "X-Api-Key": this.apiKey,
            accept: "application/json",
            ...(payload ? { "content-type": "application/json" } : {}),
            ...(options.headers ?? {})
          },
          body: payload ? JSON.stringify(payload) : undefined,
          signal: abortScope.signal
        });
        const body = await readBody(response);
        if (!response.ok) {
          const deliveryUnknown = method === "POST" && response.status >= 500;
          const error = new ApplicationError(`EspoCRM returned HTTP ${response.status}`, {
            code: `ESPOCRM_HTTP_${response.status}`,
            statusCode: response.status === 409 ? 409 : 502,
            retryable: !deliveryUnknown && RETRYABLE_STATUS.has(response.status),
            deliveryUnknown,
            details: { status: response.status, response: body }
          });
          if (!error.retryable || attempt === attempts) throw error;
          lastError = error;
        } else {
          return body;
        }
      } catch (error) {
        if (error instanceof ApplicationError) {
          lastError = error;
          if (!error.retryable || attempt === attempts) throw error;
        } else {
          const deliveryUnknown = method === "POST" || method === "PUT";
          const aborted = abortScope.externallyAborted;
          const timedOut = abortScope.timedOut;
          lastError = new ApplicationError(aborted ? "EspoCRM request aborted during shutdown" : timedOut ? "EspoCRM request timed out" : "EspoCRM network request failed", {
            code: aborted ? "ESPOCRM_ABORTED" : timedOut ? "ESPOCRM_TIMEOUT" : "ESPOCRM_NETWORK_ERROR",
            statusCode: 502,
            retryable: !aborted && !deliveryUnknown,
            deliveryUnknown,
            cause: error
          });
          if (deliveryUnknown || attempt === attempts) throw lastError;
        }
      } finally {
        abortScope.cleanup();
      }
      if (this.signal?.aborted || options.signal?.aborted) throw lastError;
      await this.sleep(Math.min(2_000, 200 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 100));
    }
    throw lastError;
  }
}

function omitProjectionIdentityFields(payload, identityFields) {
  if (!identityFields.length) return payload;
  const immutableFields = new Set(identityFields);
  return Object.fromEntries(Object.entries(payload).filter(([field]) => !immutableFields.has(field)));
}

function assertEntityType(entityType) {
  if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
    throw new ApplicationError("EspoCRM entity type is not allowed", {
      code: "ESPOCRM_ENTITY_NOT_ALLOWED",
      statusCode: 400,
      retryable: false
    });
  }
}

function assertRelationLink(entityType, link) {
  assertEntityType(entityType);
  if (!ALLOWED_RELATION_LINKS.get(entityType)?.has(link)) {
    throw new ApplicationError("EspoCRM relationship link is not allowed", {
      code: "ESPOCRM_RELATION_NOT_ALLOWED",
      statusCode: 400,
      retryable: false,
      details: { entityType, link }
    });
  }
}

function requiredIdentifier(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 64 || !/^[A-Za-z0-9_-]+$/u.test(id)) {
    throw new ApplicationError("EspoCRM record identifier is invalid", {
      code: "ESPOCRM_IDENTIFIER_INVALID",
      statusCode: 400,
      retryable: false
    });
  }
  return id;
}

function linkedRecords(response) {
  const records = response?.list ?? response?.records ?? [];
  if (!Array.isArray(records)) {
    throw new ApplicationError("EspoCRM relationship response is malformed", {
      code: "ESPOCRM_RELATION_RESPONSE_INVALID",
      statusCode: 502,
      retryable: false
    });
  }
  return records;
}

const DAILY_REPORT_AGGREGATE_FIELDS = Object.freeze([
  "newContacts",
  "validatedContacts",
  "duplicateContacts",
  "eligibleContacts",
  "blockedContacts",
  "matchesCreated"
]);

function validateDailyReportAggregate(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw invalidDailyReportAggregate();
  }
  const result = {};
  for (const field of DAILY_REPORT_AGGREGATE_FIELDS) {
    const value = response[field];
    if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
      throw invalidDailyReportAggregate(field);
    }
    result[field] = value;
  }
  return Object.freeze(result);
}

function invalidDailyReportAggregate(field) {
  return new ApplicationError("EspoCRM daily report aggregate response is malformed", {
    code: "ESPOCRM_DAILY_REPORT_AGGREGATE_INVALID",
    statusCode: 502,
    retryable: false,
    details: field ? { field } : undefined
  });
}

function toEspoDateTime(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(text)) return text;
  const parsed = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u.test(text)
    ? new Date(`${text}Z`)
    : new Date(value);
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeCursor(cursor, lower, upper) {
  const modifiedAt = toEspoDateTime(cursor?.modifiedAt ?? lower);
  const id = String(cursor?.id ?? "");
  if (modifiedAt < lower || modifiedAt > upper) {
    throw new ApplicationError("EspoCRM keyset cursor is outside the fixed watermark range", {
      code: "ESPOCRM_CURSOR_INVALID",
      statusCode: 500,
      retryable: false
    });
  }
  return { modifiedAt, id };
}

function validateAndOrderPage(records, { exactModifiedAt, afterId = "" } = {}) {
  const normalized = records.map((record) => {
    const id = String(record?.id ?? "");
    if (!id || !record?.modifiedAt) {
      throw new ApplicationError("EspoCRM keyset page omitted id or modifiedAt", {
        code: "ESPOCRM_KEYSET_FIELDS_MISSING",
        statusCode: 502,
        retryable: false
      });
    }
    return { ...record, id, modifiedAt: toEspoDateTime(record.modifiedAt) };
  }).sort(compareRecordCursor);

  const seen = new Set();
  for (const record of normalized) {
    const pair = `${record.modifiedAt}\u0000${record.id}`;
    if (seen.has(pair)) {
      throw new ApplicationError("EspoCRM returned a duplicate keyset tuple", {
        code: "ESPOCRM_KEYSET_DUPLICATE",
        statusCode: 502,
        retryable: true
      });
    }
    seen.add(pair);
    if (exactModifiedAt && record.modifiedAt !== exactModifiedAt) {
      throw new ApplicationError("EspoCRM exact-timestamp keyset query returned an out-of-range record", {
        code: "ESPOCRM_KEYSET_RANGE_VIOLATED",
        statusCode: 502,
        retryable: true
      });
    }
    if (exactModifiedAt && record.id <= afterId) {
      throw new ApplicationError("EspoCRM id keyset did not advance", {
        code: "ESPOCRM_KEYSET_NOT_ADVANCING",
        statusCode: 502,
        retryable: true
      });
    }
  }
  return normalized;
}

function compareRecordCursor(left, right) {
  return left.modifiedAt.localeCompare(right.modifiedAt) || left.id.localeCompare(right.id);
}

function recordCursor(record) {
  return { modifiedAt: record.modifiedAt, id: record.id };
}

function resultBoundExceeded(entityType) {
  return new ApplicationError(`EspoCRM ${entityType} result exceeded the configured bound`, {
    code: "ESPOCRM_RESULT_BOUND_EXCEEDED",
    statusCode: 503,
    retryable: false
  });
}

async function readBody(response) {
  let text;
  try {
    text = await readBoundedResponseText(response, MAX_RESPONSE_BYTES);
  } catch (error) {
    if (!(error instanceof ResponseSizeLimitError)) throw error;
    throw new ApplicationError("EspoCRM response exceeded the configured byte limit", {
      code: "ESPOCRM_RESPONSE_TOO_LARGE",
      statusCode: 502,
      retryable: false
    });
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function payloadMatches(record, payload) {
  return Object.entries(payload).every(([key, expected]) => {
    const actual = record?.[key];
    if (expected === undefined) return true;
    if (expected === null) return actual === null || actual === undefined;
    if (typeof expected === "object") return JSON.stringify(actual) === JSON.stringify(expected);
    return actual === expected;
  });
}

function assertExpectedProjectionIdentity(
  record,
  payload,
  entityType,
  uniqueAttribute,
  uniqueValue,
  identityFields
) {
  const expectedFields = new Set([uniqueAttribute, ...identityFields]);
  for (const field of expectedFields) {
    const supplied = Object.hasOwn(payload, field) ? payload[field] : field === uniqueAttribute ? uniqueValue : null;
    if (
      field === uniqueAttribute &&
      Object.hasOwn(payload, field) &&
      canonicalProjectionIdentity(field, payload[field]) !== canonicalProjectionIdentity(field, uniqueValue)
    ) {
      throw projectionIdentityMismatch(entityType, uniqueAttribute, record, field);
    }
    if (canonicalProjectionIdentity(field, record?.[field]) !== canonicalProjectionIdentity(field, supplied)) {
      throw projectionIdentityMismatch(entityType, uniqueAttribute, record, field);
    }
  }
  return record;
}

function canonicalProjectionIdentity(field, value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  const text = String(value).trim();
  if (field === "isrc") return text.toUpperCase().replace(/[\s-]+/gu, "");
  if (field === "emailAddress") return text.toLowerCase();
  if (field === "domain") return text.toLowerCase().replace(/\.+$/u, "");
  return text;
}

function projectionIdentityMismatch(entityType, uniqueAttribute, record, field) {
  return new ApplicationError(`Existing ${entityType} projection has a conflicting immutable identity`, {
    code: "ESPOCRM_PROJECTION_IDENTITY_MISMATCH",
    statusCode: 409,
    retryable: false,
    details: { entityType, uniqueAttribute, id: record?.id, field }
  });
}

function assertImmutableProjection(record, payload, entityType, uniqueAttribute) {
  if (payloadMatches(record, payload)) return record;
  throw new ApplicationError(`Existing ${entityType} projection does not match its immutable receipt`, {
    code: "ESPOCRM_IMMUTABLE_PROJECTION_MISMATCH",
    statusCode: 409,
    retryable: false,
    details: { entityType, uniqueAttribute, id: record?.id }
  });
}

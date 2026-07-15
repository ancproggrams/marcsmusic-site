import { randomUUID } from "node:crypto";
import { canonicalEspoEventId, canonicalMailgunEventId } from "../domain/provider-event-identity.mjs";
import { normalizeContact, normalizeOutlet } from "../domain/normalization.mjs";
import { errorCode } from "../errors.mjs";

const ROUTE_MAILGUN = 0;
const ROUTE_ESPO_EMAIL = 1;
const ROUTE_DUE_MATCH = 2;
const ROUTE_COUNT = 3;

export function createOutcomeReconcileService({
  mailgun,
  espocrm,
  repository,
  inboxRepository,
  config,
  logger,
  metrics
}) {
  const runtime = config.outcomeReconcile;

  async function run({ now = new Date(), signal } = {}) {
    if (!runtime?.enabled) return Object.freeze({ succeeded: false, reason: "disabled" });
    const stableNow = validDate(now, "OUTCOME_RECONCILE_NOW_INVALID");
    const upper = new Date(stableNow.getTime() - runtime.settleDelaySeconds * 1_000);
    const initial = new Date(upper.getTime() - runtime.initialLookbackHours * 60 * 60 * 1_000);
    const watermark = validDate(await repository.getWatermark(initial), "OUTCOME_RECONCILE_WATERMARK_INVALID");
    const proposedFrom = new Date(Math.max(0, watermark.getTime() - runtime.overlapSeconds * 1_000));
    const ownerId = randomUUID();
    const lease = await repository.acquire({
      ownerId,
      watermarkFrom: proposedFrom,
      watermarkTo: upper,
      leaseSeconds: runtime.leaseSeconds
    });
    if (!lease.acquired) {
      metrics.increment("outreach_outcome_reconcile_runs_total", { outcome: "contended" });
      return Object.freeze({ succeeded: false, reason: lease.reason });
    }

    const counters = {
      mailgunSeen: 0,
      mailgunQueued: 0,
      mailgunRejected: 0,
      storedRepliesRecovered: 0,
      espoEmailsSeen: 0,
      espoEmailsQueued: 0,
      dueMatchesSeen: 0,
      dueMatchesRecovered: 0,
      pages: 0,
      ...lease.counters
    };
    const invocationBudget = { pages: 0 };
    let leaseLost = false;
    const heartbeat = setInterval(() => {
      repository.renew(lease, runtime.leaseSeconds)
        .then((renewed) => { leaseLost ||= !renewed; })
        .catch(() => { leaseLost = true; });
    }, Math.max(1_000, Math.floor(runtime.leaseSeconds * 1_000 / 3)));
    heartbeat.unref?.();

    try {
      for (let route = lease.routeIndex; route < ROUTE_COUNT; route += 1) {
        abortIfRequested(signal);
        if (leaseLost) throw lostLease();
        const cursor = route === lease.routeIndex ? lease.cursor : undefined;
        const pageToken = route === lease.routeIndex ? lease.pageToken : undefined;
        if (route === ROUTE_MAILGUN && runtime.mailgunEnabled) {
          await recoverMailgun(lease, counters, { cursor, pageToken, signal, invocationBudget });
        } else if (route === ROUTE_ESPO_EMAIL && runtime.espoEmailEnabled) {
          await recoverEspoEmails(lease, counters, { cursor, signal, invocationBudget });
        } else if (route === ROUTE_DUE_MATCH && runtime.dueMatchesEnabled) {
          await recoverDueMatches(lease, counters, { cursor, signal, invocationBudget });
        }
        await repository.checkpoint(lease, {
          routeIndex: route + 1,
          cursor: undefined,
          pageToken: undefined,
          counters,
          leaseSeconds: runtime.leaseSeconds
        });
      }
      if (leaseLost) throw lostLease();
      await repository.complete(lease, { routeIndex: ROUTE_COUNT, counters });
      metrics.increment("outreach_outcome_reconcile_runs_total", { outcome: "succeeded" });
      logger.info({
        runId: lease.runId,
        windowFrom: lease.watermarkFrom,
        windowTo: lease.watermarkTo,
        counters,
        resumed: lease.resumed,
        resumeCount: lease.resumeCount
      }, "provider outcome reconciliation completed");
      return Object.freeze({ succeeded: true, counters: Object.freeze({ ...counters }), resumed: lease.resumed });
    } catch (error) {
      await repository.fail(lease, { counters, errorCode: errorCode(error) }).catch(() => false);
      metrics.increment("outreach_outcome_reconcile_runs_total", { outcome: "failed" });
      logger.error({
        err: error,
        runId: lease.runId,
        routeIndex: lease.routeIndex,
        counters
      }, "provider outcome reconciliation failed");
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }

  async function recoverMailgun(lease, counters, { cursor: initialCursor, pageToken: initialPageToken, signal, invocationBudget }) {
    let cursor = initialCursor;
    let pageToken = initialPageToken;
    while (true) {
      await enforcePageBudgetAndBackpressure(invocationBudget, signal);
      const page = await mailgun.listOutcomeEvents({
        from: lease.watermarkFrom,
        to: lease.watermarkTo,
        pageToken,
        pageSize: runtime.pageSize,
        mode: runtime.mailgunMode,
        signal
      });
      counters.pages += 1;
      invocationBudget.pages += 1;
      counters.mailgunRejected += Number(page.rejected ?? 0);
      const ordered = page.events
        .filter((event) => afterCursor(event, cursor))
        .sort(compareEvents);
      for (const event of ordered) {
        abortIfRequested(signal);
        counters.mailgunSeen += 1;
        const queued = await ingestMailgunEvent(event, signal, counters);
        if (queued) counters.mailgunQueued += 1;
        cursor = eventCursor(event);
      }
      const nextPageToken = page.nextPageToken;
      await repository.checkpoint(lease, {
        routeIndex: ROUTE_MAILGUN,
        cursor,
        pageToken: nextPageToken,
        counters,
        leaseSeconds: runtime.leaseSeconds
      });
      if (!nextPageToken || page.events.length === 0) return;
      pageToken = nextPageToken;
    }
  }

  async function ingestMailgunEvent(event, signal, counters) {
    let payload = event;
    let identity;
    if (event.event === "stored") {
      if (!runtime.mailgunStoredRepliesEnabled) return false;
      try {
        payload = await mailgun.retrieveStoredMessage(event, { signal });
      } catch (error) {
        if (error?.retryable === false && String(error?.code ?? "").startsWith("MAILGUN_STORAGE_")) {
          metrics.increment("outreach_outcome_reconcile_events_total", { source: "mailgun", outcome: "storage_rejected" });
          return false;
        }
        throw error;
      }
      identity = await repository.findOutboundIdentity(inboundReferenceIds(payload));
      if (identity?.queue_type !== "send") return false;
      countersForStoredReply();
    } else {
      identity = await repository.findOutboundIdentity(outboundMessageIds(payload));
      if (!identity) return false;
    }
    const externalId = canonicalMailgunEventId(event);
    const complained = event.event === "complained";
    const result = await inboxRepository.receiveEvent({
      source: "mailgun",
      externalId,
      eventType: payload.event,
      entityType: "MailgunEvent",
      entityId: externalId,
      payload,
      workKind: "process_mailgun_event",
      priority: complained ? 0 : 5,
      openCircuitReason: complained ? `reconciled_mailgun_complaint:${externalId}` : undefined
    });
    metrics.increment("outreach_outcome_reconcile_events_total", {
      source: "mailgun",
      outcome: result.inserted ? "queued" : "duplicate"
    });
    return result.inserted;

    function countersForStoredReply() {
      counters.storedRepliesRecovered += 1;
    }
  }

  async function recoverEspoEmails(lease, counters, { cursor: initialCursor, signal, invocationBudget }) {
    let cursor = initialCursor;
    const pages = espocrm.iterateModifiedBetween("Email", new Date(0), lease.watermarkTo, {
      maxRecords: runtime.pageSize * (runtime.maxPagesPerInvocation + 1),
      ...(cursor ? { cursor: { modifiedAt: cursor.timestamp, id: cursor.id } } : {}),
      where: [
        { type: "greaterThan", attribute: "createdAt", value: toEspoDateTime(lease.watermarkFrom) },
        { type: "lessThanOrEquals", attribute: "createdAt", value: toEspoDateTime(lease.watermarkTo) },
        { type: "in", attribute: "status", value: ["Received", "Archived"] }
      ],
      select: ["id", "modifiedAt", "createdAt", "status", "sentBy"]
    });
    for await (const records of pages) {
      await enforcePageBudgetAndBackpressure(invocationBudget, signal);
      counters.pages += 1;
      invocationBudget.pages += 1;
      for (const record of records) {
        counters.espoEmailsSeen += 1;
        if (!isExplicitIncomingEmail(record)) continue;
        const externalId = canonicalEspoEventId({ eventName: "Email.created", record, bodyDigest: "reconcile" });
        const result = await inboxRepository.receiveEvent({
          source: "espocrm",
          externalId,
          eventType: "Email.created",
          entityType: "Email",
          entityId: record.id,
          payload: { event: "Email.created", record },
          workKind: "process_espocrm_event",
          priority: 10
        });
        if (result.inserted) counters.espoEmailsQueued += 1;
      }
      cursor = recordCursor(records.at(-1));
      await repository.checkpoint(lease, {
        routeIndex: ROUTE_ESPO_EMAIL,
        cursor,
        pageToken: undefined,
        counters,
        leaseSeconds: runtime.leaseSeconds
      });
    }
  }

  async function recoverDueMatches(lease, counters, { cursor: initialCursor, signal, invocationBudget }) {
    let cursor = initialCursor;
    const pages = espocrm.iterateModifiedBetween("OutreachMatch", new Date(0), lease.watermarkTo, {
      maxRecords: runtime.pageSize * (runtime.maxPagesPerInvocation + 1),
      ...(cursor ? { cursor: { modifiedAt: cursor.timestamp, id: cursor.id } } : {}),
      where: [
        { type: "equals", attribute: "activeSequence", value: true },
        { type: "lessThanOrEquals", attribute: "nextActionAt", value: toEspoDateTime(lease.watermarkTo) }
      ],
      select: [
        "id", "modifiedAt", "campaignStatus", "activeSequence", "currentSequenceStep",
        "nextActionAt", "replyStatus", "stopReason", "mediaContactId", "mediaOutletId"
      ]
    });
    for await (const records of pages) {
      await enforcePageBudgetAndBackpressure(invocationBudget, signal);
      counters.pages += 1;
      invocationBudget.pages += 1;
      for (const match of records) {
        counters.dueMatchesSeen += 1;
        const sequenceStep = dueSequenceStep(match, lease.watermarkTo);
        if (!sequenceStep) continue;
        if (await denyWinsForMatch(match)) continue;
        const recovered = await repository.recoverDueSequenceStep({ matchId: match.id, sequenceStep });
        if (recovered.queued) counters.dueMatchesRecovered += 1;
      }
      cursor = recordCursor(records.at(-1));
      await repository.checkpoint(lease, {
        routeIndex: ROUTE_DUE_MATCH,
        cursor,
        pageToken: undefined,
        counters,
        leaseSeconds: runtime.leaseSeconds
      });
    }
  }

  async function denyWinsForMatch(match) {
    if (!match.mediaContactId) return true;
    const [contactRaw, outletRaw] = await Promise.all([
      espocrm.get("MediaContact", match.mediaContactId),
      match.mediaOutletId ? espocrm.get("MediaOutlet", match.mediaOutletId) : undefined
    ]);
    const contact = normalizeContact(contactRaw);
    const outlet = outletRaw ? normalizeOutlet(outletRaw) : undefined;
    if (
      contact.doNotContact
      || contact.optedOut
      || contact.hardBounced
      || contact.status === "Blocked"
      || outlet?.doNotContact
      || outlet?.status === "Blocked"
    ) return true;
    return inboxRepository.isSuppressed({
      contactId: contact.id,
      outletId: outlet?.id,
      email: contact.email,
      domain: outlet?.domain
    });
  }

  async function enforcePageBudgetAndBackpressure(invocationBudget, signal) {
    abortIfRequested(signal);
    if (invocationBudget.pages >= runtime.maxPagesPerInvocation) {
      throw retryableError("OUTCOME_RECONCILE_PAGE_BUDGET_EXHAUSTED");
    }
    const backlog = await repository.backlog({ maximum: runtime.maximumBacklog });
    if (backlog.events >= runtime.maximumBacklog || backlog.work >= runtime.maximumBacklog) {
      metrics.increment("outreach_outcome_reconcile_runs_total", { outcome: "backpressured" });
      throw retryableError("OUTCOME_RECONCILE_BACKPRESSURE");
    }
  }

  return Object.freeze({ run });
}

function dueSequenceStep(match, upper) {
  if (match.activeSequence !== true || text(match.replyStatus) || text(match.stopReason)) return undefined;
  const mapping = new Map([["Sent 1", 1], ["Follow-Up 1", 2]]);
  const sequenceStep = mapping.get(String(match.campaignStatus));
  if (!sequenceStep || Number(match.currentSequenceStep) !== sequenceStep - 1) return undefined;
  const dueAt = new Date(match.nextActionAt);
  if (!Number.isFinite(dueAt.getTime()) || dueAt > upper) return undefined;
  return sequenceStep;
}

function isExplicitIncomingEmail(record) {
  return record?.status === "Received" || record?.status === "Archived";
}

function inboundReferenceIds(payload) {
  return messageIdCandidates(
    payload?.["In-Reply-To"],
    payload?.["in-reply-to"],
    payload?.message?.headers?.["in-reply-to"]
  );
}

function outboundMessageIds(payload) {
  return messageIdCandidates(
    payload?.message?.headers?.["message-id"],
    payload?.message?.headers?.["Message-Id"],
    payload?.["message-id"],
    payload?.MessageId
  );
}

function messageIdCandidates(...values) {
  const result = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const bracketed = value.match(/<[^<>\s]+@[^<>\s]+>/gu) ?? [];
    if (bracketed.length) result.push(...bracketed);
    else if (value.trim()) result.push(value.trim().slice(0, 500));
  }
  return [...new Set(result)].slice(0, 4);
}

function afterCursor(event, cursor) {
  if (!cursor) return true;
  const timestamp = eventDate(event);
  const boundary = validDate(cursor.timestamp, "OUTCOME_RECONCILE_CURSOR_INVALID");
  return timestamp > boundary || (timestamp.getTime() === boundary.getTime() && String(event.id) > String(cursor.id ?? ""));
}

function eventCursor(event) {
  return Object.freeze({ timestamp: eventDate(event).toISOString(), id: String(event.id) });
}

function recordCursor(record) {
  if (!record?.id || !record?.modifiedAt) throw permanentError("OUTCOME_RECONCILE_CURSOR_MISSING");
  return Object.freeze({ timestamp: validDate(normalizeEspoDate(record.modifiedAt), "OUTCOME_RECONCILE_CURSOR_INVALID").toISOString(), id: String(record.id) });
}

function compareEvents(left, right) {
  return eventDate(left) - eventDate(right) || String(left.id).localeCompare(String(right.id));
}

function eventDate(event) {
  const numeric = Number(event.timestamp);
  return validDate(Number.isFinite(numeric) ? numeric * 1_000 : event["@timestamp"], "OUTCOME_RECONCILE_PROVIDER_TIMESTAMP_INVALID");
}

function validDate(value, code) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw permanentError(code);
  return date;
}

function normalizeEspoDate(value) {
  const textValue = String(value);
  return textValue.includes("T") ? textValue : `${textValue.replace(" ", "T")}Z`;
}

function toEspoDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function text(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
}

function abortIfRequested(signal) {
  if (!signal?.aborted) return;
  throw Object.assign(new Error("Outcome reconciliation aborted"), {
    code: "OUTCOME_RECONCILE_ABORTED",
    retryable: true,
    cause: signal.reason
  });
}

function permanentError(code) {
  return Object.assign(new Error(code), { code, retryable: false });
}

function retryableError(code) {
  return Object.assign(new Error(code), { code, retryable: true });
}

function lostLease() {
  return retryableError("OUTCOME_RECONCILE_LEASE_LOST");
}

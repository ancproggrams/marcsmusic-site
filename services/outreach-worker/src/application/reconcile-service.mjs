import { randomUUID } from "node:crypto";
import { errorCode } from "../errors.mjs";

const ROUTES = Object.freeze([
  Object.freeze({ entityType: "MusicRelease", workKind: "match_release" }),
  Object.freeze({ entityType: "MediaOutlet", workKind: "validate_outlet" }),
  Object.freeze({ entityType: "MediaContact", workKind: "validate_contact" }),
  Object.freeze({ entityType: "OutreachMatch", workKind: "sync_match_state" }),
  Object.freeze({ entityType: "OutreachSuppression", workKind: "sync_suppression" })
]);
const MAILGUN_VALIDATION_ROUTES = Object.freeze([
  Object.freeze({ entityType: "MediaContact", workKind: "validate_contact_email" })
]);

export function createReconcileService({ espocrm, repository, config, logger, metrics }) {
  async function run({ now = new Date(), full = false, validationOnly = false } = {}) {
    if (validationOnly && !full) throw Object.assign(new Error("Mailgun validation reconciliation must be a full, explicit run"), {
      code: "MAILGUN_VALIDATION_RECONCILE_SCOPE_INVALID",
      retryable: false
    });
    const routes = validationOnly ? MAILGUN_VALIDATION_ROUTES : ROUTES;
    const workflowName = validationOnly
      ? "outreach-mailgun-validation-reconcile"
      : full ? "outreach-full-reconcile" : "outreach-incremental-reconcile";
    // Keep this one-time sweep independent from the normal reconciliation
    // watermark so it cannot make incremental business work disappear.
    const watermarkName = validationOnly ? "espocrm-mailgun-validation" : "espocrm-business-records";
    const fallback = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    const storedWatermark = full ? new Date(0) : new Date(await repository.getWatermark(watermarkName, fallback));
    const proposedFrom = new Date(storedWatermark.getTime() - config.schedules.reconcileOverlapMinutes * 60_000);
    const correlationId = randomUUID();
    if (typeof repository.acquireReconcileWorkflow !== "function") {
      return runCompatibilityWorkflow({
        now,
        full,
        routes,
        validationOnly,
        workflowName,
        watermarkName,
        from: proposedFrom,
        correlationId
      });
    }
    const leaseSeconds = config.schedules.reconcileLeaseSeconds ?? 120;
    const lease = await repository.acquireReconcileWorkflow({
      leaseName: workflowName,
      ownerId: correlationId,
      workflowName,
      scopeKind: full ? "full" : "incremental",
      watermarkFrom: proposedFrom,
      watermarkTo: now,
      leaseSeconds
    });
    if (!lease.acquired) throw leaseUnavailable(lease.reason);
    const from = lease.watermarkFrom;
    const to = lease.watermarkTo;
    const counters = {
      ...Object.fromEntries(routes.map(({ entityType }) => [entityType, 0])),
      ...lease.counters
    };
    let leaseLost = false;
    const heartbeat = setInterval(() => {
      repository.renewReconcileWorkflow(lease, leaseSeconds)
        .then((renewed) => { leaseLost ||= !renewed; })
        .catch(() => { leaseLost = true; });
    }, Math.max(1_000, Math.floor(leaseSeconds * 1_000 / 3)));
    heartbeat.unref?.();

    try {
      for (let routeIndex = lease.routeIndex; routeIndex < routes.length; routeIndex += 1) {
        const route = routes[routeIndex];
        const cursor = routeIndex === lease.routeIndex ? lease.cursor : undefined;
        const entityLimit = config.schedules.reconcileMaxRecordsPerEntity ?? 10_000_000;
        const remaining = entityLimit - counters[route.entityType];
        if (remaining <= 0) throw reconcileEntityBoundExceeded(route.entityType, entityLimit);
        const pages = espocrm.iterateModifiedBetween(route.entityType, from, to, {
          maxRecords: remaining,
          ...(cursor ? { cursor } : {})
        });
        for await (const records of pages) {
          if (leaseLost) throw reconcileLeaseLost();
          const workItems = records.map((record) => {
            const revision = recordRevision(record);
            return {
              kind: route.workKind,
              entityType: route.entityType,
              entityId: record.id,
              dedupeKey: `${validationOnly ? "mailgun-validation" : "reconcile"}:${route.entityType}:${record.id}:${revision}`,
              payload: { correlationId, revision },
              priority: 50
            };
          });
          if (repository.enqueueWorkBatch) await repository.enqueueWorkBatch(workItems);
          else await Promise.all(workItems.map((workItem) => repository.enqueueWork(workItem)));
          counters[route.entityType] += records.length;
          metrics.increment("outreach_reconciled_records_total", { entityType: route.entityType }, records.length);
          const checkpointCursor = cursorForRecord(records.at(-1));
          await repository.checkpointReconcileWorkflow(lease, {
            routeIndex,
            cursor: checkpointCursor,
            counters,
            leaseSeconds
          });
        }
        await repository.checkpointReconcileWorkflow(lease, {
          routeIndex: routeIndex + 1,
          cursor: undefined,
          counters,
          leaseSeconds
        });
      }
      if (leaseLost) throw reconcileLeaseLost();
      await repository.completeReconcileWorkflow(lease, {
        routeIndex: routes.length,
        counters,
        watermarkName,
        watermarkValue: to
      });
      logger.info({ workflowName, correlationId, from, to, counters, resumed: lease.resumed }, "outreach reconciliation completed");
      return Object.freeze({ succeeded: true, correlationId, counters: Object.freeze(counters), resumed: lease.resumed });
    } catch (error) {
      await repository.failReconcileWorkflow(lease, { counters, errorCode: errorCode(error) }).catch(() => false);
      logger.error({ err: error, workflowName, correlationId, counters }, "outreach reconciliation failed");
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }

  async function runCompatibilityWorkflow({ now, full, routes, validationOnly, workflowName, watermarkName, from, correlationId }) {
    const runId = await repository.startWorkflow(workflowName, correlationId, from, now);
    const counters = Object.fromEntries(routes.map(({ entityType }) => [entityType, 0]));
    try {
      for (const route of routes) {
        const records = full
          ? await espocrm.list(route.entityType, { maxRecords: 100_000, orderBy: "modifiedAt", order: "asc" })
          : await espocrm.listModifiedSince(route.entityType, from, { maxRecords: 100_000, upperWatermark: now });
        const workItems = records.map((record) => ({
          kind: route.workKind,
          entityType: route.entityType,
          entityId: record.id,
          dedupeKey: `${validationOnly ? "mailgun-validation" : "reconcile"}:${route.entityType}:${record.id}:${recordRevision(record)}`,
          payload: { correlationId, revision: recordRevision(record) },
          priority: 50
        }));
        if (repository.enqueueWorkBatch) await repository.enqueueWorkBatch(workItems);
        else await Promise.all(workItems.map((workItem) => repository.enqueueWork(workItem)));
        counters[route.entityType] += records.length;
      }
      await repository.setWatermark(watermarkName, now);
      await repository.finishWorkflow(runId, { succeeded: true, counters });
      return Object.freeze({ succeeded: true, correlationId, counters: Object.freeze(counters), resumed: false });
    } catch (error) {
      await repository.finishWorkflow(runId, { succeeded: false, counters, errorCode: errorCode(error) });
      throw error;
    }
  }

  return Object.freeze({ run });
}

function cursorForRecord(record) {
  if (!record?.id || !record?.modifiedAt) throw Object.assign(new Error("Reconciliation page has no keyset cursor"), {
    code: "RECONCILE_CURSOR_MISSING",
    retryable: false
  });
  const value = String(record.modifiedAt);
  const utcValue = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return Object.freeze({ modifiedAt: new Date(utcValue).toISOString(), id: String(record.id) });
}

function leaseUnavailable(reason) {
  return Object.assign(new Error("Another replica owns the reconciliation workflow"), {
    code: reason === "lease_held" ? "RECONCILE_LEASE_HELD" : "RECONCILE_CHECKPOINT_BUSY",
    retryable: true
  });
}

function reconcileLeaseLost() {
  return Object.assign(new Error("Reconciliation lease was fenced by another owner"), {
    code: "RECONCILE_LEASE_LOST",
    retryable: true
  });
}

function reconcileEntityBoundExceeded(entityType, limit) {
  return Object.assign(new Error(`Reconciliation ${entityType} scan exceeded its configured bound`), {
    code: "RECONCILE_ENTITY_BOUND_EXCEEDED",
    retryable: false,
    details: { entityType, limit }
  });
}

function recordRevision(record) {
  const timestamp = record.modifiedAt ?? record.createdAt ?? "unknown";
  return Number.isInteger(record.versionNumber) ? `${timestamp}:v${record.versionNumber}` : timestamp;
}

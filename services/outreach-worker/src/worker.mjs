import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { DateTime } from "luxon";
import { scheduleDailyReports } from "./application/daily-report-scheduler.mjs";

const WORK_LANES = Object.freeze([
  Object.freeze({
    name: "safety-events",
    concurrencyKey: "safetyEvents",
    kinds: Object.freeze(["process_mailgun_event", "process_plunk_event", "process_unsubscribe_event", "process_espocrm_event", "sync_suppression", "sync_match_state"])
  }),
  Object.freeze({
    name: "projections",
    concurrencyKey: "projections",
    kinds: Object.freeze(["sync_delivery_to_crm", "sync_response_to_crm", "sync_delivery_unknown_to_crm", "project_reply_business_action", "sync_stop_to_crm"])
  }),
  Object.freeze({
    name: "matching",
    concurrencyKey: "matching",
    kinds: Object.freeze(["validate_contact", "validate_outlet", "match_release", "match_contact", "match_contact_release", "match_outlet", "schedule_sequence_step", "resume_sequence"])
  }),
  Object.freeze({
    name: "maintenance",
    concurrencyKey: "maintenance",
    kinds: Object.freeze(["create_daily_report", "health_check", "run_incremental_reconcile", "run_full_reconcile", "run_outcome_reconcile", "reconcile_crm_projections"])
  })
]);

export function startWorker(container, { signal } = {}) {
  const workerId = `${process.env.RAILWAY_REPLICA_ID ?? "local"}:${process.pid}:${randomUUID().slice(0, 8)}`;
  const { config, logger } = container;
  const stopController = new AbortController();
  const stopFromParent = () => stopController.abort(signal?.reason ?? new Error("Worker shutdown requested"));
  if (signal?.aborted) stopFromParent();
  else signal?.addEventListener("abort", stopFromParent, { once: true });
  const workerSignal = stopController.signal;
  const today = DateTime.utc().setZone("Europe/Amsterdam").toISODate();
  const claimedWorkerIds = [];
  const loops = [
    ...WORK_LANES.flatMap((lane) => Array.from(
      { length: config.concurrency?.[lane.concurrencyKey] ?? 1 },
      (_, index) => {
        const laneWorkerId = `${workerId}:${lane.name}:${index}`;
        claimedWorkerIds.push(laneWorkerId);
        return drainLoop({
          name: lane.name,
          idleMs: config.schedules.workPollMs,
          signal: workerSignal,
          logger,
          task: () => container.workService.processOne(laneWorkerId, { signal: workerSignal, kinds: lane.kinds })
        });
      }
    )),
    ...Array.from({ length: config.concurrency?.sending ?? 1 }, (_, index) => {
      const sendWorkerId = `${workerId}:sending:${index}`;
      claimedWorkerIds.push(sendWorkerId);
      return drainLoop({
        name: "sending",
        idleMs: config.schedules.sendPollMs,
        signal: workerSignal,
        logger,
        task: async () => {
          const response = await container.sendService.sendResponseOne(sendWorkerId, { signal: workerSignal });
          return response.processed || workerSignal.aborted
            ? response
            : container.sendService.sendOne(sendWorkerId, { signal: workerSignal });
        }
      });
    }),
    intervalLoop({
      name: "reconcile",
      intervalMs: config.schedules.reconcileIntervalMs,
      signal: workerSignal,
      logger,
      task: () => container.repository.enqueueWork({
        kind: "run_incremental_reconcile",
        entityType: "System",
        entityId: "espocrm",
        dedupeKey: `incremental-reconcile:${Math.floor(Date.now() / config.schedules.reconcileIntervalMs)}`,
        priority: 60
      })
    }),
    intervalLoop({
      name: "crm-projection-reconcile",
      intervalMs: config.schedules.reconcileIntervalMs,
      signal: workerSignal,
      logger,
      task: () => container.repository.enqueueWork({
        kind: "reconcile_crm_projections",
        entityType: "System",
        entityId: "crm-projections",
        dedupeKey: `crm-projection-reconcile:${Math.floor(Date.now() / config.schedules.reconcileIntervalMs)}`,
        priority: 25
      })
    }),
    ...(config.outcomeReconcile?.enabled
      ? [intervalLoop({
          name: "provider-outcome-reconcile",
          intervalMs: config.schedules.outcomeReconcileIntervalMs,
          signal: workerSignal,
          logger,
          task: () => container.repository.enqueueWork({
            kind: "run_outcome_reconcile",
            entityType: "System",
            entityId: "provider-outcomes",
            dedupeKey: `provider-outcome-reconcile:${Math.floor(Date.now() / config.schedules.outcomeReconcileIntervalMs)}`,
            priority: 15
          })
        })]
      : []),
    intervalLoop({
      name: "health",
      intervalMs: config.schedules.healthIntervalMs,
      signal: workerSignal,
      logger,
      task: () => container.healthService.evaluate()
    }),
    ...(config.observability?.enabled
      ? [operationalObservabilitySupervisor(container, { signal: workerSignal })]
      : []),
    reportScheduler(container, { signal: workerSignal, workerId })
  ];
  if (!workerSignal.aborted) {
    container.repository.enqueueWork({
      kind: "run_full_reconcile",
      entityType: "System",
      entityId: "espocrm",
      dedupeKey: `full-reconcile:${today}`,
      priority: 55
    }).catch((error) => logger.error({ err: error }, "bootstrap full reconciliation scheduling failed"));
    container.repository.enqueueWork({
      kind: "reconcile_crm_projections",
      entityType: "System",
      entityId: "crm-projections",
      dedupeKey: `crm-projection-reconcile:bootstrap:${today}`,
      priority: 25
    }).catch((error) => logger.error({ err: error }, "bootstrap CRM projection reconciliation scheduling failed"));
  }
  const done = Promise.allSettled(loops).finally(() => signal?.removeEventListener("abort", stopFromParent));
  async function shutdown({ timeoutMs = Math.min(config.schedules.shutdownTimeoutMs ?? 25_000, 25_000) } = {}) {
    stopController.abort(new Error("Worker shutdown requested"));
    const drainBudgetMs = Math.max(1_000, Math.min(timeoutMs - 2_000, 22_000));
    const drained = await settlesWithin(done, drainBudgetMs);
    const relinquished = typeof container.repository.relinquishWorkerLeases === "function"
      ? await container.repository.relinquishWorkerLeases(claimedWorkerIds)
      : undefined;
    logger.info({ workerId, drained, relinquished }, "outreach worker shutdown completed");
    return Object.freeze({ drained, relinquished });
  }
  logger.info({ workerId, processMode: config.processMode, concurrency: config.concurrency }, "outreach worker loops started");
  return Object.freeze({ workerId, workerIds: Object.freeze([...claimedWorkerIds]), done, shutdown });
}

async function operationalObservabilitySupervisor(container, { signal }) {
  const { config, logger, metrics } = container;
  const runtime = config.observability;
  const schedules = [
    {
      name: "prune",
      intervalMs: runtime.pruneIntervalMs,
      run: async () => {
        const result = await container.operationalObservabilityService.prune({
          maxBatches: runtime.pruneMaxBatches
        });
        for (const [kind, count] of Object.entries(result.deleted)) {
          if (count > 0) metrics.increment("outreach_observability_pruned_total", { kind }, count);
        }
        return {
          outcome: result.completed ? "success" : "partial",
          fields: { completed: result.completed, batches: result.batches, deleted: result.deleted }
        };
      }
    },
    {
      name: "capture",
      intervalMs: runtime.captureIntervalMs,
      run: async () => {
        const observedAt = new Date();
        const collected = await container.operationalMetricCollector.collect({ observedAt });
        if (signal.aborted) return { outcome: "aborted", fields: {} };
        const result = await container.operationalObservabilityService.capture({ observedAt, metrics: collected });
        const decisions = Object.fromEntries(
          result.evaluations.map(({ ruleId, decision }) => [ruleId, decision])
        );
        return {
          outcome: "success",
          fields: {
            snapshotDigest: result.snapshot.snapshotDigest,
            replayed: result.snapshot.replayed,
            decisions
          }
        };
      }
    },
    {
      name: "project_alerts",
      intervalMs: runtime.projector.intervalMs,
      run: async () => {
        const result = await container.operationalAlertDeliveryRepository.projectBatch({
          limit: runtime.projector.batchSize,
          maximumBacklog: runtime.projector.maximumBacklog
        });
        metrics.gauge("outreach_alert_delivery_outbox_backlog", {}, result.backlog);
        metrics.gauge("outreach_alert_delivery_dead_letters", {}, result.deadLetters);
        metrics.gauge("outreach_alert_delivery_cursor_sequence", {}, result.cursor);
        return {
          outcome: result.backpressured ? "backpressured" : result.contended ? "contended" : "success",
          fields: {
            projected: result.projected,
            cursor: result.cursor,
            backlog: result.backlog,
            deadLetters: result.deadLetters,
            hasMore: result.hasMore
          }
        };
      }
    }
  ];
  const nextDue = new Map(schedules.map(({ name }) => [name, 0]));
  while (!signal.aborted) {
    const now = Date.now();
    const due = schedules.filter(({ name }) => now >= nextDue.get(name));
    if (!due.length) {
      const earliest = Math.min(...nextDue.values());
      await abortableDelay(Math.max(1, earliest - now), signal);
      continue;
    }
    for (const task of due) {
      if (signal.aborted) break;
      const outcome = await runOperationalObservabilityTask(container, task, signal);
      const successful = ["success", "partial", "backpressured"].includes(outcome);
      nextDue.set(task.name, Date.now() + (successful ? task.intervalMs : runtime.retryIntervalMs));
    }
  }
  logger.info({ policyVersion: runtime.policy.policyVersion }, "operational observability supervisor stopped");
}

async function runOperationalObservabilityTask(container, task, signal) {
  const { logger, metrics, operationalObservabilityRepository: repository } = container;
  const startedAt = Date.now();
  try {
    const exclusive = await repository.tryRunRuntimeExclusive(async () => {
      if (signal.aborted) return { outcome: "aborted", fields: {} };
      return task.run();
    });
    if (!exclusive.acquired) {
      metrics.increment("outreach_observability_runtime_runs_total", {
        operation: task.name,
        outcome: "contended"
      });
      return "contended";
    }
    const result = exclusive.value;
    const outcome = result?.outcome ?? "success";
    const durationSeconds = (Date.now() - startedAt) / 1_000;
    metrics.increment("outreach_observability_runtime_runs_total", { operation: task.name, outcome });
    metrics.gauge("outreach_observability_runtime_duration_seconds", { operation: task.name }, durationSeconds);
    if (outcome === "success" || outcome === "partial") {
      metrics.gauge("outreach_observability_runtime_last_success_unixtime", { operation: task.name }, Date.now() / 1_000);
    }
    const fields = {
      operation: task.name,
      outcome,
      durationSeconds,
      policyVersion: container.config.observability.policy.policyVersion,
      ...result?.fields
    };
    if (outcome === "backpressured" || outcome === "partial") {
      logger.warn(fields, "operational observability task requires operator attention");
    } else if (outcome !== "aborted") {
      logger.info(fields, "operational observability task completed");
    }
    return outcome;
  } catch (error) {
    metrics.increment("outreach_observability_runtime_runs_total", {
      operation: task.name,
      outcome: "failure"
    });
    logger.error({ err: error, operation: task.name }, "operational observability task failed");
    return "failure";
  }
}

async function drainLoop({ name, idleMs, task, signal, logger }) {
  while (!signal?.aborted) {
    try {
      const result = await task();
      if (!result?.processed) await abortableDelay(idleMs, signal);
    } catch (error) {
      logger.error({ err: error, loop: name }, "outreach worker loop iteration failed");
      await abortableDelay(Math.min(idleMs * 2, 30_000), signal);
    }
  }
}

async function intervalLoop({ name, intervalMs, task, signal, logger }) {
  while (!signal?.aborted) {
    try {
      await task();
    } catch (error) {
      logger.error({ err: error, loop: name }, "outreach interval job failed");
    }
    await abortableDelay(intervalMs, signal);
  }
}

async function reportScheduler(container, { signal }) {
  let lastDailyReportSchedulePhase;
  while (!signal?.aborted) {
    const instant = new Date();
    const now = DateTime.fromJSDate(instant, { zone: "utc" }).setZone("Europe/Amsterdam");
    const schedulePhase = now.hour === 23 && now.minute >= 30
      ? `${now.toISODate()}:preliminary-close`
      : `${now.toISODate()}:hour-${now.hour}`;
    if (schedulePhase !== lastDailyReportSchedulePhase) {
      try {
        await scheduleDailyReports(container.repository, { now: instant });
        lastDailyReportSchedulePhase = schedulePhase;
      } catch (error) {
        container.logger.error({ err: error }, "daily report scheduling failed");
      }
    }
    if (now.hour === 6 && now.minute < 5) {
      const reportDate = now.toISODate();
      await container.repository.enqueueWork({
        kind: "run_full_reconcile",
        entityType: "System",
        entityId: "espocrm",
        dedupeKey: `full-reconcile:${reportDate}`,
        priority: 55
      }).catch((error) => container.logger.error({ err: error, reportDate }, "daily full reconciliation scheduling failed"));
    }
    await abortableDelay(60_000, signal);
  }
}

async function abortableDelay(milliseconds, signal) {
  if (signal?.aborted) return;
  try {
    await delay(Math.min(milliseconds, 60_000), undefined, { signal });
  } catch (error) {
    if (error?.name !== "AbortError") throw error;
  }
  if (milliseconds > 60_000 && !signal?.aborted) await abortableDelay(milliseconds - 60_000, signal);
}

async function settlesWithin(promise, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref?.();
    promise.then(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

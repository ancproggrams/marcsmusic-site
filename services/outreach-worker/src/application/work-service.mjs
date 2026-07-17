import { isTerminalCampaignStatus } from "../domain/campaign-state.mjs";
import { errorCode } from "../errors.mjs";

export function createWorkService({ repository, contactIntakeService, matchService, eventService, sendService, crmProjectionService, reconcileService, outcomeReconcileService, dailyReportService, healthService, espocrm, logger, metrics }) {
  async function processOne(workerId, { signal, kinds } = {}) {
    if (signal?.aborted) return Object.freeze({ processed: false, reason: "worker_stopping" });
    const item = await repository.claimWork(workerId, 120, { kinds });
    if (!item) return Object.freeze({ processed: false, reason: "queue_empty" });
    if (signal?.aborted) {
      await repository.relinquishWork?.(item, "worker_shutdown");
      return Object.freeze({ processed: true, kind: item.kind, succeeded: false, error: "WORKER_SHUTDOWN" });
    }
    let leaseLost = false;
    const heartbeat = repository.renewWorkLease
      ? setInterval(() => {
        if (signal?.aborted) return;
        repository.renewWorkLease(item).then((renewed) => { leaseLost ||= !renewed; }).catch(() => { leaseLost = true; });
      }, 30_000)
      : undefined;
    heartbeat?.unref();
    try {
      switch (item.kind) {
        case "process_espocrm_event":
          await eventService.processEspoEvent(item);
          break;
        case "process_mailgun_event":
          await eventService.processMailgunEvent(item);
          break;
        case "process_plunk_event":
          if (typeof eventService.processPlunkEvent !== "function") {
            throw Object.assign(new Error("Plunk event processor is unavailable"), {
              code: "PLUNK_EVENT_PROCESSOR_UNAVAILABLE",
              retryable: false
            });
          }
          await eventService.processPlunkEvent(item);
          break;
        case "process_unsubscribe_event":
          await eventService.processUnsubscribeEvent(item);
          break;
        case "match_release":
          await matchService.processRelease(item.entity_id);
          break;
        case "validate_contact":
          await contactIntakeService.processContact(item.entity_id);
          break;
        case "validate_contact_email":
          if (typeof contactIntakeService.validateContactEmail !== "function") {
            throw Object.assign(new Error("Contact email validation is unavailable"), {
              code: "CONTACT_EMAIL_VALIDATION_UNAVAILABLE",
              retryable: false
            });
          }
          await contactIntakeService.validateContactEmail(item.entity_id);
          break;
        case "validate_outlet":
          await contactIntakeService.processOutlet(item.entity_id);
          break;
        case "match_contact":
          await matchService.processContact(item.entity_id);
          break;
        case "match_contact_release":
          await matchService.processContact(item.entity_id, { releaseId: item.payload.releaseId });
          break;
        case "match_outlet":
          await matchService.processOutlet(item.entity_id);
          break;
        case "sync_suppression":
          await eventService.syncSuppression(item.entity_id);
          break;
        case "sync_match_state":
          await eventService.syncMatchState(item.entity_id);
          break;
        case "sync_delivery_to_crm":
          await crmProjectionService.syncDeliveryToCrm(item);
          break;
        case "sync_response_to_crm":
          await crmProjectionService.syncResponseToCrm(item);
          break;
        case "sync_delivery_unknown_to_crm":
          await crmProjectionService.syncDeliveryUnknownToCrm(item);
          break;
        case "project_reply_business_action":
          await crmProjectionService.projectReplyBusinessAction(item);
          break;
        case "sync_stop_to_crm":
          await sendService.syncStopToCrm(item);
          break;
        case "schedule_sequence_step":
          await matchService.scheduleSequenceStepAfterAcceptance(item);
          break;
        case "resume_sequence":
          await resumeSequence(item);
          break;
        case "create_daily_report":
          if (
            !item.payload?.reportDate ||
            item.payload.reportDate !== item.entity_id ||
            item.dedupe_key !== `daily-report:${item.payload.reportDate}:${item.payload.scheduleSlot}`
          ) {
            throw Object.assign(new Error("Daily report work must bind reportDate to its entity identity"), {
              code: "DAILY_REPORT_WORK_IDENTITY_INVALID",
              retryable: false
            });
          }
          await dailyReportService.generate({
            reportDate: item.payload.reportDate,
            scheduleSlot: item.payload.scheduleSlot,
            slotRank: item.payload.slotRank
          });
          break;
        case "health_check":
          await healthService.evaluate();
          break;
        case "run_incremental_reconcile":
          await reconcileService.run();
          break;
        case "run_full_reconcile":
          await reconcileService.run({ full: true });
          break;
        case "run_mailgun_validation_reconcile":
          await reconcileService.run({ full: true, validationOnly: true });
          break;
        case "run_outcome_reconcile":
          if (!outcomeReconcileService) throw Object.assign(new Error("Outcome reconcile service is unavailable"), {
            code: "OUTCOME_RECONCILE_SERVICE_UNAVAILABLE",
            retryable: false
          });
          await outcomeReconcileService.run({ signal });
          break;
        case "reconcile_crm_projections":
          await crmProjectionService.reconcile();
          break;
        default:
          throw Object.assign(new Error(`Unsupported work kind ${item.kind}`), { code: "WORK_KIND_UNSUPPORTED", retryable: false });
      }
      if (leaseLost) {
        metrics.increment("outreach_work_lease_lost_total", { kind: item.kind });
        return Object.freeze({ processed: true, kind: item.kind, succeeded: false, error: "WORK_LEASE_LOST" });
      }
      const completed = await repository.completeWork(item);
      if (!completed) {
        metrics.increment("outreach_work_lease_lost_total", { kind: item.kind });
        logger.warn({ workItemId: item.id, kind: item.kind }, "work result not committed because the lease was lost");
        return Object.freeze({ processed: true, kind: item.kind, succeeded: false, error: "WORK_LEASE_LOST" });
      }
      metrics.increment("outreach_work_items_total", { kind: item.kind, outcome: "completed" });
      return Object.freeze({ processed: true, kind: item.kind, succeeded: true });
    } catch (error) {
      if (item.kind === "sync_delivery_to_crm" && item.payload?.sendQueueId) {
        await repository.failCrmDeliveryProjection?.(
          item.payload.sendQueueId,
          errorCode(error),
          error.retryable !== false
        ).catch(() => false);
      }
      if (signal?.aborted) await repository.relinquishWork?.(item, "worker_shutdown");
      else await repository.failWork(item, errorCode(error), error.retryable !== false);
      metrics.increment("outreach_work_items_total", { kind: item.kind, outcome: error.retryable === false ? "dead_letter" : "failed" });
      logger.error({ err: error, workItemId: item.id, kind: item.kind, entityType: item.entity_type, entityId: item.entity_id }, "outreach work item failed");
      return Object.freeze({ processed: true, kind: item.kind, succeeded: false, error: errorCode(error) });
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  }

  async function resumeSequence(item) {
    const match = await espocrm.get("OutreachMatch", item.entity_id);
    if (isTerminalCampaignStatus(match.campaignStatus)) return;
    if (match.campaignStatus !== "Paused") return;
    const payload = {
      campaignStatus: item.payload.previousStatus ?? "Sent 1",
      activeSequence: true,
      stopReason: null,
      nextActionAt: null
    };
    if (typeof espocrm.updateConditional === "function") {
      await espocrm.updateConditional("OutreachMatch", item.entity_id, payload, match.versionNumber);
    } else {
      await espocrm.update("OutreachMatch", item.entity_id, payload);
    }
  }

  return Object.freeze({ processOne });
}

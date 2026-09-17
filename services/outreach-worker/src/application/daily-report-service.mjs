import { businessDayUtcRange } from "./date-utils.mjs";
import { validateDailyReportWork } from "./daily-report-scheduler.mjs";

export function createDailyReportService({ espocrm, repository, logger, metrics }) {
  async function generate({ reportDate, scheduleSlot, slotRank, now = new Date() } = {}) {
    const validated = validateDailyReportWork({ reportDate, scheduleSlot, slotRank, now });
    if (typeof repository.withDailyReportProjectionFence !== "function") {
      throw Object.assign(new Error("Daily report projection fencing is unavailable"), {
        code: "DAILY_REPORT_FENCE_UNAVAILABLE",
        retryable: true
      });
    }
    const fenced = await repository.withDailyReportProjectionFence(validated, async () => {
      const { start, end } = businessDayUtcRange(reportDate);
      if (typeof espocrm.aggregateDailyReport !== "function") {
        throw Object.assign(new Error("EspoCRM server-side daily report aggregation is unavailable"), {
          code: "DAILY_REPORT_AGGREGATE_UNAVAILABLE",
          retryable: true
        });
      }
      const [crmSummary, outcomes, jobs] = await Promise.all([
        espocrm.aggregateDailyReport({ start, end }),
        repository.summaryForDate({ businessDate: reportDate, start, end }),
        repository.jobSummaryForDate({ businessDate: reportDate, start, end })
      ]);
      const generatedAt = toEspoDateTime(now);
      const payload = {
        name: `Outreach ${reportDate}`,
        reportDate,
        status: scheduleSlot === "final-next-day-v1" ? "Final" : "Generated",
        generatedAt,
        newContacts: crmSummary.newContacts,
        validatedContacts: crmSummary.validatedContacts,
        duplicateContacts: crmSummary.duplicateContacts,
        eligibleContacts: crmSummary.eligibleContacts,
        blockedContacts: crmSummary.blockedContacts,
        matchesCreated: crmSummary.matchesCreated,
        initialEmailsSent: Number(outcomes.initial_emails_sent ?? 0),
        followUpsSent: Number(outcomes.follow_ups_sent ?? 0),
        repliesReceived: Number(outcomes.replies_received ?? 0),
        positiveReplies: Number(outcomes.positive_replies ?? 0),
        hardBounces: Number(outcomes.hard_bounces ?? 0),
        softBounces: Number(outcomes.soft_bounces ?? 0),
        optOuts: Number(outcomes.opt_outs ?? 0),
        placements: Number(outcomes.placements ?? 0),
        failedJobs: Number(jobs.failed_jobs ?? 0),
        summary: Object.freeze({
          scheduleSlot,
          slotRank,
          businessDayStart: start.toISOString(),
          businessDayEnd: end.toISOString()
        })
      };
      const report = await espocrm.upsertByUnique("OutreachDailyReport", "reportDate", reportDate, payload);
      metrics.increment("outreach_daily_reports_total", { slot: scheduleSlot });
      logger.info({ reportDate, scheduleSlot, reportId: report.id, ...payload }, "daily outreach report written to EspoCRM");
      return Object.freeze({ ...payload, scheduleSlot, id: report.id });
    });
    if (fenced.skipped) {
      metrics.increment("outreach_daily_reports_skipped_total", { reason: "newer_slot_exists", slot: scheduleSlot });
      logger.info({ reportDate, scheduleSlot }, "daily outreach report skipped because a newer immutable slot exists");
      return Object.freeze({ reportDate, scheduleSlot, skipped: true, reason: "newer_slot_exists" });
    }
    return fenced.value;
  }

  return Object.freeze({ generate });
}

function toEspoDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

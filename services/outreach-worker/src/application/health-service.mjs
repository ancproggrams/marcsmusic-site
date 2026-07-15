export function createHealthService({ repository, config, logger, metrics }) {
  async function evaluate() {
    const quarantined = await repository.quarantineStaleDeliveryClaims();
    const [window, operations] = await Promise.all([
      repository.healthWindow(24),
      repository.operationalSnapshot?.() ?? {}
    ]);
    const sent = Number(window.sent ?? 0);
    const harmful = Number(window.harmful ?? 0);
    const failed = Number(window.failed ?? 0);
    const harmfulRate = sent > 0 ? harmful / sent : 0;
    const failureRate = sent + failed > 0 ? failed / (sent + failed) : 0;
    metrics.gauge("outreach_health_sent_24h", {}, sent);
    metrics.gauge("outreach_health_harmful_rate", {}, harmfulRate);
    metrics.gauge("outreach_health_failure_rate", {}, failureRate);
    for (const [key, metricName] of Object.entries({
      work_depth: "outreach_work_queue_depth",
      send_depth: "outreach_send_queue_depth",
      response_depth: "outreach_response_queue_depth",
      event_depth: "outreach_event_inbox_depth",
      oldest_work_seconds: "outreach_oldest_work_seconds",
      oldest_event_seconds: "outreach_oldest_event_seconds",
      work_dead_letters: "outreach_work_dead_letters",
      send_dead_letters: "outreach_send_dead_letters",
      response_dead_letters: "outreach_response_dead_letters",
      delivery_unknown: "outreach_delivery_unknown",
      full_reconcile_age_seconds: "outreach_full_reconcile_age_seconds",
      incremental_reconcile_age_seconds: "outreach_incremental_reconcile_age_seconds"
    })) {
      metrics.gauge(metricName, {}, Number(operations[key] ?? 0));
    }
    metrics.increment("outreach_stale_delivery_claims_total", { queue: "send" }, quarantined.sends);
    metrics.increment("outreach_stale_delivery_claims_total", { queue: "response" }, quarantined.responses);
    metrics.increment("outreach_stale_allocations_released_total", {}, quarantined.allocations ?? 0);

    const reasons = [];
    if (sent >= config.safety.minHealthSample && harmfulRate > config.safety.maxBounceRate) reasons.push("harmful_rate_exceeded");
    if (sent + failed >= config.safety.minHealthSample && failureRate > config.safety.maxFailureRate) reasons.push("failure_rate_exceeded");
    if (reasons.length) {
      await repository.setCircuit({ open: true, reason: reasons.join(","), pauseMinutes: 60 });
      logger.error({ sent, harmful, failed, harmfulRate, failureRate, reasons }, "outreach safety circuit opened");
    }
    const circuit = await repository.getCircuit();
    if (!reasons.length && circuit?.state === "open") {
      logger.warn(
        { sent, harmfulRate, failureRate, circuitReason: circuit.reason },
        "outreach safety circuit remains open until an explicit operator reset"
      );
    }
    metrics.gauge("outreach_send_circuit_open", {}, circuit?.state === "open" ? 1 : 0);
    return Object.freeze({ sent, harmful, failed, harmfulRate, failureRate, operations, quarantined, circuitState: circuit?.state ?? "unknown", reasons: Object.freeze(reasons) });
  }

  return Object.freeze({ evaluate });
}

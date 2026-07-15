const READINESS_CACHE_TTL_MS = 5_000;
const PUBLIC_REASON_CODES = new Set([
  "capability_check_failed",
  "capability_reason_redacted",
  "approved_policy_unconfigured",
  "email_validation_auth_rejected",
  "email_validation_disabled",
  "email_validation_health_unknown",
  "email_validation_probe_aborted",
  "email_validation_rate_limited",
  "email_validation_response_invalid",
  "email_validation_response_too_large",
  "email_validation_timeout",
  "email_validation_unavailable",
  "espocrm_unavailable",
  "external_alert_router_unconfigured",
  "external_dashboard_unconfigured",
  "inbound_route_configured_evidence",
  "inbound_route_evidence_unknown",
  "ingress_state_unavailable",
  "kill_switch_enabled",
  "mailgun_auth_rejected",
  "mailgun_domain_inactive",
  "mailgun_domain_mismatch",
  "mailgun_domain_not_found",
  "mailgun_not_configured",
  "mailgun_probe_aborted",
  "mailgun_rate_limited",
  "mailgun_response_invalid",
  "mailgun_response_too_large",
  "mailgun_timeout",
  "mailgun_unavailable",
  "plunk_auth_rejected",
  "plunk_health_not_found",
  "plunk_not_configured",
  "plunk_probe_aborted",
  "plunk_rate_limited",
  "plunk_response_invalid",
  "plunk_response_too_large",
  "plunk_timeout",
  "plunk_unavailable",
  "outcome_reconciliation_disabled",
  "postgres_or_schema_unavailable",
  "provider_recovery_unavailable",
  "runtime_probe_unavailable",
  "safety_circuit_open",
  "safety_circuit_unavailable",
  "send_not_enabled",
  "unavailable"
]);
const PROVIDER_HEALTH_STATES = new Set(["available", "disabled", "unavailable", "unknown"]);
const PROVIDER_TYPES = new Set(["http", "smtp"]);
const REPLY_RECOVERY_MODES = new Set(["mailgun_storage", "espocrm_incoming_email", "external"]);

export function registerHealthRoutes(server, { config, repository, readinessCheck, capabilitiesCheck }) {
  let cachedReadiness;
  let readinessInFlight;
  let cachedCapabilities;
  let capabilitiesInFlight;
  server.get("/livez", async () => ({ status: "alive" }));
  server.get("/readyz", async (request, reply) => {
    try {
      const result = await sharedReadinessCheck();
      if (result === false || result?.ready === false) {
        return reply.code(503).send({
          status: "not_ready",
          ingress: {
            database: result?.database === true ? "up" : "unavailable",
            schema: result?.schema?.ready === false ? "out_of_date" : "unknown",
            ...(result?.schema?.missing?.length ? { missing: result.schema.missing } : {})
          }
        });
      }
      return { status: "ready", ingress: { database: "up", schema: "current" } };
    } catch (error) {
      request.log.warn({ err: error, requestId: request.id }, "readiness_check_failed");
      return reply.code(503).send({
        status: "not_ready",
        ingress: { database: "unavailable", schema: "unknown" }
      });
    }
  });

  server.get("/capabilities", async (request) => {
    try {
      const result = await sharedCapabilitiesCheck();
      const capabilities = {
        crm_projection: normalizeCapability(result.crmProjection),
        matching: normalizeCapability(result.matching),
        sending: normalizeCapability(result.sending),
        outcome_recovery: normalizeOutcomeRecovery(result.outcomeRecovery)
      };
      const hasPlunkProvider = Object.hasOwn(result.providers ?? {}, "plunk");
      const providers = {
        ...(hasPlunkProvider ? { plunk: normalizeProvider(result.providers?.plunk) } : {}),
        mailgun: normalizeProvider(result.providers?.mailgun, { includeInboundRoute: true }),
        email_validation: normalizeProvider(result.providers?.emailValidation)
      };
      const observability = normalizeObservability(result.observability);
      const coreAvailable = capabilities.crm_projection.available
        && capabilities.matching.available
        && capabilities.sending.available
        && (!capabilities.outcome_recovery.configured || capabilities.outcome_recovery.available);
      const providersAvailable = hasPlunkProvider
        ? providers.plunk.available && providers.email_validation.available
        : Object.values(providers).every(({ available }) => available)
          && providers.mailgun.inbound_route.status === "configured";
      const observabilityAvailable = observability.available
        && observability.alert_router.available
        && observability.dashboard.available;
      return {
        status: coreAvailable && providersAvailable && observabilityAvailable ? "available" : "degraded",
        ingress: normalizeCapability(result.ingress),
        capabilities,
        observability,
        providers
      };
    } catch {
      request.log.warn({ requestId: request.id, errorCode: "CAPABILITY_CHECK_FAILED" }, "capabilities_check_failed");
      return {
        status: "degraded",
        ingress: { available: false, reason: "capability_check_failed" },
        capabilities: {
          crm_projection: { available: false, reason: "capability_check_failed" },
          matching: { available: false, reason: "capability_check_failed" },
          sending: { available: false, reason: "capability_check_failed" },
          outcome_recovery: {
            configured: config.outcomeReconcile?.enabled === true,
            available: false,
            reason: "capability_check_failed",
            reply_recovery: { mode: "external", available: false, reason: "capability_check_failed" }
          }
        },
        observability: normalizeObservability({
          configured: config.observability?.policy?.configured === true,
          available: false,
          reason: "capability_check_failed",
          alertRouter: config.observability?.alertRouter,
          dashboard: config.observability?.dashboard
        }),
        providers: {
          ...(config.plunk ? {
            plunk: {
              configured: Boolean(config.plunk.apiKey && config.plunk.from),
              available: false,
              health: "unknown",
              reason: "capability_check_failed"
            }
          } : {}),
          mailgun: {
            configured: false,
            available: false,
            health: "unknown",
            reason: "capability_check_failed",
            inbound_route: { status: "unknown", reason: "inbound_route_evidence_unknown" }
          },
          email_validation: {
            configured: false,
            available: false,
            health: "unknown",
            reason: "capability_check_failed"
          }
        }
      };
    }
  });

  async function sharedReadinessCheck() {
    const now = Date.now();
    if (cachedReadiness && cachedReadiness.expiresAt > now) {
      if (cachedReadiness.error) throw cachedReadiness.error;
      return cachedReadiness.result;
    }
    if (!readinessInFlight) {
      readinessInFlight = Promise.resolve()
        .then(() => (readinessCheck ?? (() => defaultReadinessCheck(repository)))())
        .then((result) => {
          cachedReadiness = { result, expiresAt: Date.now() + READINESS_CACHE_TTL_MS };
          return result;
        })
        .catch((error) => {
          cachedReadiness = { error, expiresAt: Date.now() + READINESS_CACHE_TTL_MS };
          throw error;
        })
        .finally(() => { readinessInFlight = undefined; });
    }
    return readinessInFlight;
  }

  async function sharedCapabilitiesCheck() {
    const now = Date.now();
    if (cachedCapabilities && cachedCapabilities.expiresAt > now) return cachedCapabilities.result;
    if (!capabilitiesInFlight) {
      capabilitiesInFlight = Promise.resolve()
        .then(async () => {
          if (capabilitiesCheck) return capabilitiesCheck();
          const ingress = await sharedReadinessCheck();
          const ingressAvailable = ingress !== false && ingress?.ready !== false;
          const sendingReason = config.safety.killSwitch
            ? "kill_switch_enabled"
            : !config.safety.sendEnabled
              ? "send_not_enabled"
              : "runtime_probe_unavailable";
          return {
            ingress: { available: ingressAvailable },
            crmProjection: { available: false, reason: "runtime_probe_unavailable" },
            matching: { available: false, reason: "runtime_probe_unavailable" },
            sending: { available: false, reason: sendingReason },
            outcomeRecovery: {
              configured: config.outcomeReconcile?.enabled === true,
              available: false,
              reason: config.outcomeReconcile?.enabled === true
                ? "runtime_probe_unavailable"
                : "outcome_reconciliation_disabled",
              replyRecovery: {
                mode: "external",
                available: false,
                reason: config.outcomeReconcile?.enabled === true
                  ? "runtime_probe_unavailable"
                  : "outcome_reconciliation_disabled"
              }
            },
            observability: {
              configured: config.observability?.policy?.configured === true,
              available: false,
              reason: config.observability?.enabled
                ? "runtime_probe_unavailable"
                : "approved_policy_unconfigured",
              alertRouter: config.observability?.alertRouter,
              dashboard: config.observability?.dashboard
            },
            providers: {
              mailgun: {
                configured: Boolean(config.mailgun?.apiKey && config.mailgun?.domain),
                available: false,
                health: "unknown",
                reason: "runtime_probe_unavailable",
                inboundRoute: inboundRouteFromConfig(config.mailgun)
              },
              emailValidation: {
                configured: config.emailValidation?.enabled === true,
                available: false,
                health: config.emailValidation?.enabled === true ? "unknown" : "disabled",
                reason: config.emailValidation?.enabled === true
                  ? "runtime_probe_unavailable"
                  : "email_validation_disabled",
                ...(PROVIDER_TYPES.has(config.emailValidation?.type)
                  ? { type: config.emailValidation.type }
                  : {})
              }
            }
          };
        })
        .then((result) => {
          cachedCapabilities = { result, expiresAt: Date.now() + READINESS_CACHE_TTL_MS };
          return result;
        })
        .finally(() => { capabilitiesInFlight = undefined; });
    }
    return capabilitiesInFlight;
  }
}

async function defaultReadinessCheck(repository) {
  const result = await repository.pool.query({ text: "SELECT 1 AS healthy", query_timeout: 2_000 });
  return result.rows[0]?.healthy === 1;
}

function normalizeCapability(value) {
  if (value?.available === true) return { available: true };
  return { available: false, reason: publicReason(value?.reason) };
}

function normalizeProvider(value, { includeInboundRoute = false } = {}) {
  const health = PROVIDER_HEALTH_STATES.has(value?.health)
    ? value.health
    : value?.available === true
      ? "available"
      : "unknown";
  const available = value?.available === true && health === "available";
  const checkedAt = normalizeTimestamp(value?.checkedAt);
  return {
    configured: value?.configured === true,
    available,
    health,
    ...(PROVIDER_TYPES.has(value?.type) ? { type: value.type } : {}),
    ...(!available ? { reason: publicReason(value?.reason) } : {}),
    ...(checkedAt ? { checked_at: checkedAt } : {}),
    ...(includeInboundRoute ? { inbound_route: normalizeInboundRoute(value?.inboundRoute) } : {})
  };
}

function normalizeOutcomeRecovery(value) {
  const configured = value?.configured === true;
  const available = configured && value?.available === true;
  const reply = value?.replyRecovery;
  const mode = REPLY_RECOVERY_MODES.has(reply?.mode) ? reply.mode : "external";
  const replyAvailable = reply?.available === true && mode !== "external";
  return {
    configured,
    available,
    ...(!available ? { reason: publicReason(value?.reason ?? "outcome_reconciliation_disabled") } : {}),
    reply_recovery: {
      mode,
      available: replyAvailable,
      ...(!replyAvailable ? { reason: publicReason(reply?.reason ?? "provider_recovery_unavailable") } : {})
    }
  };
}

function normalizeObservability(value) {
  const configured = value?.configured === true;
  const available = configured && value?.available === true;
  return {
    configured,
    available,
    ...(!available ? {
      reason: publicReason(value?.reason ?? "approved_policy_unconfigured")
    } : {}),
    alert_router: normalizeExternalCapability(
      value?.alertRouter,
      "external_alert_router_unconfigured"
    ),
    dashboard: normalizeExternalCapability(
      value?.dashboard,
      "external_dashboard_unconfigured"
    )
  };
}

function normalizeExternalCapability(value, unavailableReason) {
  const configured = value?.configured === true;
  const available = configured && value?.available === true;
  const mode = value?.mode === "durable_outbox" || value?.mode === "protected_prometheus"
    ? value.mode
    : "external";
  return {
    mode,
    configured,
    available,
    ...(typeof value?.reference === "string" && value.reference.length > 0 ? { reference: value.reference } : {}),
    ...(!available ? { reason: publicReason(value?.reason ?? unavailableReason) } : {})
  };
}

function normalizeInboundRoute(value) {
  if (value?.status === "configured") {
    return { status: "configured", reason: "inbound_route_configured_evidence" };
  }
  return { status: "unknown", reason: "inbound_route_evidence_unknown" };
}

function inboundRouteFromConfig(mailgun = {}) {
  if (
    mailgun.inboundRouteEvidence === "configured"
    && typeof mailgun.inboundRouteEvidenceReference === "string"
    && mailgun.inboundRouteEvidenceReference.length > 0
  ) {
    return { status: "configured", reason: "inbound_route_configured_evidence" };
  }
  return { status: "unknown", reason: "inbound_route_evidence_unknown" };
}

function publicReason(value) {
  const reason = typeof value === "string" ? value : "unavailable";
  return PUBLIC_REASON_CODES.has(reason) ? reason : "capability_reason_redacted";
}

function normalizeTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? value : undefined;
}

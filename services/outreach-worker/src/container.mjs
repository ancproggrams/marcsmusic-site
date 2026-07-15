import { loadConfig } from "./config.mjs";
import { CryptoBox } from "./infrastructure/crypto-box.mjs";
import { createPostgresPool, checkIngressSchema, checkPostgres } from "./infrastructure/postgres.mjs";
import { OutreachRepository } from "./infrastructure/outreach-repository.mjs";
import { OutcomeReconcileRepository } from "./infrastructure/outcome-reconcile-repository.mjs";
import { EspoCrmClient } from "./infrastructure/espocrm-client.mjs";
import { MailgunClient } from "./infrastructure/mailgun-client.mjs";
import { HttpCopyProvider } from "./infrastructure/copy-provider.mjs";
import { ReleaseLinkReachabilityChecker } from "./infrastructure/release-link-reachability-checker.mjs";
import {
  DisabledEmailValidationProvider,
  HttpEmailValidationProvider,
  SmtpMxEmailValidationProvider
} from "./infrastructure/email-validation-provider.mjs";
import {
  configuredInboundRouteEvidence,
  EmailValidationHealthProbe,
  MailgunDomainHealthProbe
} from "./infrastructure/provider-capability-probes.mjs";
import { Metrics } from "./infrastructure/metrics.mjs";
import { OperationalAlertDeliveryRepository } from "./infrastructure/operational-alert-delivery-repository.mjs";
import { SourceIngestionRepository } from "./infrastructure/source-ingestion-repository.mjs";
import { ContactIntakeRepository } from "./infrastructure/contact-intake-repository.mjs";
import { OperationalMetricCollector } from "./infrastructure/operational-metric-collector.mjs";
import { OperationalObservabilityRepository } from "./infrastructure/operational-observability-repository.mjs";
import { createLogger } from "./infrastructure/logger.mjs";
import { createCopyService } from "./application/copy-service.mjs";
import { createMatchService } from "./application/match-service.mjs";
import { createSendService } from "./application/send-service.mjs";
import { createReconcileService } from "./application/reconcile-service.mjs";
import { createOutcomeReconcileService } from "./application/outcome-reconcile-service.mjs";
import { createHealthService } from "./application/health-service.mjs";
import { createDailyReportService } from "./application/daily-report-service.mjs";
import { createEventService } from "./application/event-service.mjs";
import { createCrmProjectionService } from "./application/crm-projection-service.mjs";
import { createWorkService } from "./application/work-service.mjs";
import { createSourceIngestionService } from "./application/source-ingestion-service.mjs";
import { createContactIntakeService } from "./application/contact-intake-service.mjs";
import { createOperationalObservabilityService } from "./application/operational-observability-service.mjs";
import { assertHashKeyAttestation } from "./infrastructure/hash-key-attestation.mjs";

export function createContainer({ env = process.env, fetch, signal } = {}) {
  const config = loadConfig(env);
  const logger = createLogger(config.logLevel);
  const metrics = new Metrics();
  const pool = createPostgresPool(config.database);
  pool.on("error", (error) => logger.error({ err: error }, "unexpected idle PostgreSQL connection error"));
  const cryptoBox = new CryptoBox(config.crypto);
  const repository = new OutreachRepository({ pool, cryptoBox, database: config.database });
  const outcomeReconcileRepository = new OutcomeReconcileRepository({ pool });
  const sourceIngestionRepository = new SourceIngestionRepository({ pool });
  const contactIntakeRepository = new ContactIntakeRepository({ pool });
  const operationalMetricCollector = config.observability.enabled
    ? new OperationalMetricCollector({ pool })
    : undefined;
  const operationalObservabilityRepository = config.observability.enabled
    ? new OperationalObservabilityRepository({ pool, policy: config.observability.policy, database: config.database })
    : undefined;
  const operationalObservabilityService = config.observability.enabled
    ? createOperationalObservabilityService({
        repository: operationalObservabilityRepository,
        policy: config.observability.policy
      })
    : undefined;
  const operationalAlertDeliveryRepository = config.observability.enabled
    ? new OperationalAlertDeliveryRepository({ pool })
    : undefined;
  const espocrm = new EspoCrmClient(config.espocrm, { fetch, signal });
  const mailgun = new MailgunClient(config.mailgun, { fetch, signal });
  const copyProvider = new HttpCopyProvider(config.copyProvider, { fetch, signal });
  const releaseLinkChecker = new ReleaseLinkReachabilityChecker(config.copyLinkCheck, { signal });
  const emailValidationProvider = !config.emailValidation.enabled
    ? new DisabledEmailValidationProvider()
    : config.emailValidation.type === "smtp"
      ? new SmtpMxEmailValidationProvider(config.emailValidation, { signal })
      : new HttpEmailValidationProvider(config.emailValidation, { fetch, signal });
  const mailgunHealthProbe = new MailgunDomainHealthProbe(config.mailgun, {
    fetch,
    signal,
    cacheTtlMs: config.providerCapabilities.cacheTtlMs
  });
  const emailValidationHealthProbe = new EmailValidationHealthProbe(config.emailValidation, {
    fetch,
    signal,
    cacheTtlMs: config.providerCapabilities.cacheTtlMs
  });
  const inboundRouteEvidence = configuredInboundRouteEvidence(config.mailgun);
  const copyService = createCopyService({ repository, copyProvider, releaseLinkChecker, config, logger, metrics });
  const contactIntakeService = createContactIntakeService({
    espocrm,
    intakeRepository: contactIntakeRepository,
    workflowRepository: repository,
    emailValidationProvider,
    cryptoBox,
    config,
    logger,
    metrics
  });
  const matchService = createMatchService({ espocrm, repository, contactIntakeService, copyService, config, logger, metrics });
  const sendService = createSendService({
    espocrm,
    repository,
    contactIntakeRepository,
    mailgun,
    config,
    logger,
    metrics
  });
  const reconcileService = createReconcileService({ espocrm, repository, config, logger, metrics });
  const outcomeReconcileService = createOutcomeReconcileService({
    mailgun,
    espocrm,
    repository: outcomeReconcileRepository,
    inboxRepository: repository,
    config,
    logger,
    metrics
  });
  const healthService = createHealthService({ repository, config, logger, metrics });
  const dailyReportService = createDailyReportService({ espocrm, repository, logger, metrics });
  const eventService = createEventService({
    espocrm,
    repository,
    outcomeReconcileRepository,
    config,
    logger,
    metrics
  });
  const crmProjectionService = createCrmProjectionService({ espocrm, repository, config, logger, metrics });
  const sourceIngestionService = createSourceIngestionService({
    espocrm,
    repository: sourceIngestionRepository,
    attestationRepository: contactIntakeRepository,
    emailValidationProvider,
    cryptoBox,
    config,
    logger,
    metrics
  });
  const workService = createWorkService({
    repository,
    contactIntakeService,
    matchService,
    eventService,
    sendService,
    crmProjectionService,
    reconcileService,
    outcomeReconcileService,
    dailyReportService,
    healthService,
    espocrm,
    logger,
    metrics
  });

  async function hashKeyAttestationCheck() {
    return assertHashKeyAttestation({
      pool,
      cryptoBox,
      bootstrapReference: config.crypto.hashKeyBootstrapReference,
      bootstrapConfirmation: config.crypto.hashKeyBootstrapConfirmation
    });
  }

  async function readinessCheck() {
    const [database, schema] = await Promise.all([
      checkPostgres(pool),
      checkIngressSchema(pool)
    ]);
    return Object.freeze({ ready: database && schema.ready, database, schema });
  }

  async function capabilitiesCheck() {
    const [
      ingressResult,
      crmHealthResult,
      crmSchemaResult,
      circuitResult,
      mailgunHealthResult,
      emailValidationHealthResult,
      alertDeliveryStateResult
    ] = await Promise.allSettled([
      readinessCheck(),
      espocrm.health(),
      espocrm.probeEntity("MusicRelease"),
      repository.getCircuit(),
      mailgunHealthProbe.check(),
      emailValidationHealthProbe.check(),
      operationalAlertDeliveryRepository?.status()
    ]);
    const ingressAvailable = ingressResult.status === "fulfilled" && ingressResult.value.ready;
    const crmAvailable = crmHealthResult.status === "fulfilled"
      && crmSchemaResult.status === "fulfilled"
      && crmHealthResult.value === true
      && crmSchemaResult.value === true;
    const circuit = circuitResult.status === "fulfilled" ? circuitResult.value : undefined;
    const mailgunHealth = mailgunHealthResult.status === "fulfilled"
      ? mailgunHealthResult.value
      : providerCapability(false, "unavailable", "mailgun_unavailable", { configured: true });
    const emailValidationHealth = emailValidationHealthResult.status === "fulfilled"
      ? emailValidationHealthResult.value
      : providerCapability(false, "unavailable", "email_validation_unavailable", {
          configured: config.emailValidation.enabled,
          type: config.emailValidation.type
        });
    const durableObservabilityAvailable = config.observability.enabled && ingressAvailable;
    const alertDeliveryState = alertDeliveryStateResult.status === "fulfilled"
      ? alertDeliveryStateResult.value
      : undefined;
    const sendingDisabledReason = config.safety.killSwitch
      ? "kill_switch_enabled"
      : !config.safety.sendEnabled
        ? "send_not_enabled"
        : undefined;
    const sending = sendingDisabledReason
      ? capability(false, sendingDisabledReason)
      : !ingressAvailable
        ? capability(false, "ingress_state_unavailable")
        : circuit?.state !== "closed"
          ? capability(false, circuit?.state === "open" ? "safety_circuit_open" : "safety_circuit_unavailable")
          : !crmAvailable
            ? capability(false, "espocrm_unavailable")
            : !mailgunHealth.available
              ? capability(false, mailgunHealth.reason ?? "mailgun_unavailable")
              : capability(true);
    return Object.freeze({
      ingress: capability(ingressAvailable, ingressAvailable ? undefined : "postgres_or_schema_unavailable"),
      crmProjection: capability(ingressAvailable && crmAvailable, !ingressAvailable ? "ingress_state_unavailable" : crmAvailable ? undefined : "espocrm_unavailable"),
      matching: capability(ingressAvailable && crmAvailable, !ingressAvailable ? "ingress_state_unavailable" : crmAvailable ? undefined : "espocrm_unavailable"),
      sending,
      outcomeRecovery: outcomeRecoveryCapability({
        config,
        ingressAvailable,
        crmAvailable,
        mailgunAvailable: mailgunHealth.available,
        inboundRouteEvidence
      }),
      observability: Object.freeze({
        configured: config.observability.policy.configured === true,
        available: durableObservabilityAvailable,
        ...(durableObservabilityAvailable ? {} : {
          reason: config.observability.enabled ? "ingress_state_unavailable" : "approved_policy_unconfigured"
        }),
        ...(config.observability.enabled ? {
          policyVersion: config.observability.policy.policyVersion,
          approvedPolicyReference: config.observability.policy.approvedPolicyReference,
          runtimeApprovalReference: config.observability.approvalReference,
          outbox: alertDeliveryState
            ? Object.freeze({
                cursor: Number(alertDeliveryState.last_sequence_id),
                backlog: Number(alertDeliveryState.outstanding_count),
                deadLetters: Number(alertDeliveryState.dead_letter_count)
              })
            : Object.freeze({ available: false, reason: "ingress_state_unavailable" })
        } : {}),
        alertRouter: config.observability.alertRouter,
        dashboard: config.observability.dashboard
      }),
      providers: Object.freeze({
        mailgun: Object.freeze({ ...mailgunHealth, inboundRoute: inboundRouteEvidence }),
        emailValidation: emailValidationHealth
      })
    });
  }

  return Object.freeze({
    config,
    logger,
    metrics,
    pool,
    repository,
    outcomeReconcileRepository,
    sourceIngestionRepository,
    contactIntakeRepository,
    operationalMetricCollector,
    operationalObservabilityRepository,
    operationalObservabilityService,
    operationalAlertDeliveryRepository,
    espocrm,
    mailgun,
    copyProvider,
    releaseLinkChecker,
    emailValidationProvider,
    mailgunHealthProbe,
    emailValidationHealthProbe,
    copyService,
    contactIntakeService,
    matchService,
    sendService,
    reconcileService,
    outcomeReconcileService,
    healthService,
    dailyReportService,
    eventService,
    crmProjectionService,
    sourceIngestionService,
    workService,
    hashKeyAttestationCheck,
    readinessCheck,
    capabilitiesCheck
  });
}

function capability(available, reason) {
  return Object.freeze({ available: Boolean(available), ...(reason ? { reason } : {}) });
}

function providerCapability(available, health, reason, { configured, type } = {}) {
  return Object.freeze({
    configured: configured === true,
    available: Boolean(available),
    health,
    ...(type ? { type } : {}),
    ...(reason ? { reason } : {})
  });
}

function outcomeRecoveryCapability({ config, ingressAvailable, crmAvailable, mailgunAvailable, inboundRouteEvidence }) {
  const runtime = config.outcomeReconcile;
  if (!runtime.enabled) {
    return Object.freeze({
      configured: false,
      available: false,
      reason: "outcome_reconciliation_disabled",
      replyRecovery: Object.freeze({ available: false, mode: "external", reason: "outcome_reconciliation_disabled" })
    });
  }
  const mailgunRouteAvailable = !runtime.mailgunEnabled || mailgunAvailable;
  const crmRoutesAvailable = !(runtime.espoEmailEnabled || runtime.dueMatchesEnabled) || crmAvailable;
  const available = ingressAvailable && mailgunRouteAvailable && crmRoutesAvailable;
  const storedAvailable = runtime.mailgunStoredRepliesEnabled
    && mailgunAvailable
    && inboundRouteEvidence?.status === "configured";
  const espoReplyAvailable = runtime.espoEmailEnabled && crmAvailable;
  return Object.freeze({
    configured: true,
    available,
    ...(available ? {} : {
      reason: !ingressAvailable
        ? "ingress_state_unavailable"
        : !mailgunRouteAvailable
          ? "mailgun_unavailable"
          : "espocrm_unavailable"
    }),
    replyRecovery: Object.freeze(storedAvailable
      ? { available: true, mode: "mailgun_storage" }
      : espoReplyAvailable
        ? { available: true, mode: "espocrm_incoming_email" }
        : { available: false, mode: "external", reason: "provider_recovery_unavailable" })
  });
}

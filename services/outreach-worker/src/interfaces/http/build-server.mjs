import { randomUUID } from "node:crypto";
import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import Fastify, { LogController } from "fastify";
import { HttpError, publicError } from "./http-error.mjs";
import { registerEspoWebhookRoute } from "./routes/espocrm-webhook.mjs";
import { registerHealthRoutes } from "./routes/health.mjs";
import { registerMailgunWebhookRoute } from "./routes/mailgun-webhook.mjs";
import { registerPlunkWebhookRoute } from "./routes/plunk-webhook.mjs";
import { registerMetricsRoute } from "./routes/metrics.mjs";
import { registerSourceIngestionRoute } from "./routes/source-ingestion.mjs";
import { registerUnsubscribeRoutes } from "./routes/unsubscribe.mjs";

const BODY_LIMIT_BYTES = 1_048_576;
const MULTIPART_FIELD_LIMIT_BYTES = 65_536;
const DEFAULT_MAX_IN_FLIGHT_REQUESTS = 64;

export async function buildServer({
  config,
  repository,
  metrics,
  logger,
  readinessCheck,
  capabilitiesCheck,
  sourceIngestionRepository,
  sourceIngestionService
} = {}) {
  assertDependencies({ config, repository, metrics });

  const server = Fastify({
    bodyLimit: BODY_LIMIT_BYTES,
    connectionTimeout: 10_000,
    keepAliveTimeout: 72_000,
    requestTimeout: 20_000,
    routerOptions: { maxParamLength: 250 },
    trustProxy: false,
    exposeHeadRoutes: false,
    return503OnClosing: true,
    // Fastify's default request log contains the full URL, which would expose
    // the unsubscribe bearer token in query strings. Log only route templates.
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: generateRequestId,
    ...(logger ? { loggerInstance: logger } : {})
  });

  server.decorateRequest("rawBody", null);
  server.decorateRequest("capacityAdmission", false);
  installRawJsonParser(server);
  await registerBodyParsers(server);
  installResponseHooks(server, config, metrics);

  const dependencies = { config, repository, metrics };
  registerHealthRoutes(server, { ...dependencies, readinessCheck, capabilitiesCheck });
  registerMetricsRoute(server, dependencies);
  registerEspoWebhookRoute(server, dependencies);
  registerMailgunWebhookRoute(server, dependencies);
  registerPlunkWebhookRoute(server, dependencies);
  registerUnsubscribeRoutes(server, dependencies);
  if (sourceIngestionRepository && sourceIngestionService) {
    registerSourceIngestionRoute(server, { config, sourceIngestionRepository, sourceIngestionService });
  }
  installErrorHandling(server, metrics);

  await server.ready();
  return server;
}

async function registerBodyParsers(server) {
  await server.register(formbody, { bodyLimit: BODY_LIMIT_BYTES });
  await server.register(multipart, {
    throwFileSizeLimit: true,
    limits: {
      fieldNameSize: 128,
      fieldSize: MULTIPART_FIELD_LIMIT_BYTES,
      fields: 32,
      files: 4,
      fileSize: 262_144,
      parts: 36
    }
  });
}

function installRawJsonParser(server) {
  server.removeContentTypeParser("application/json");
  server.addContentTypeParser(
    "application/json",
    { parseAs: "buffer", bodyLimit: BODY_LIMIT_BYTES },
    (request, body, done) => {
      request.rawBody = body;
      try {
        done(null, JSON.parse(body.toString("utf8")));
      } catch {
        done(new HttpError(400, "INVALID_JSON", "Invalid JSON payload."));
      }
    }
  );
}

function installResponseHooks(server, config, metrics) {
  const maxInFlightRequests = config.http?.maxInFlightRequests ?? DEFAULT_MAX_IN_FLIGHT_REQUESTS;
  let inFlightRequests = 0;

  server.addHook("onRequest", async (request, reply) => {
    if (requiresCapacityAdmission(request)) {
      if (inFlightRequests >= maxInFlightRequests) {
        metrics.increment("outreach_http_capacity_rejected_total");
        reply.header("retry-after", "1");
        throw new HttpError(429, "HTTP_CAPACITY_EXCEEDED", "Request capacity is temporarily exhausted.");
      }
      inFlightRequests += 1;
      metrics.gauge("outreach_http_in_flight_requests", {}, inFlightRequests);
      request.capacityAdmission = true;
    }
    reply.header("x-request-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("cache-control", "no-store");
    reply.header("referrer-policy", "no-referrer");

    if (request.url.startsWith("/webhooks/mailgun") && request.isMultipart()) {
      const contentLength = Number(request.headers["content-length"]);
      if (Number.isFinite(contentLength) && contentLength > BODY_LIMIT_BYTES) {
        throw new HttpError(413, "REQUEST_BODY_TOO_LARGE", "Webhook payload is too large.");
      }
    }
  });

  server.addHook("onResponse", async (request, reply) => {
    releaseCapacityAdmission(request);
    request.log.info({
      requestId: request.id,
      method: request.method,
      route: request.routeOptions?.url ?? "unmatched",
      statusCode: reply.statusCode,
      responseTimeMs: reply.elapsedTime
    }, "http_request_completed");
  });

  server.addHook("onRequestAbort", async (request) => {
    releaseCapacityAdmission(request);
  });

  function releaseCapacityAdmission(request) {
    if (!request.capacityAdmission) return;
    request.capacityAdmission = false;
    inFlightRequests = Math.max(0, inFlightRequests - 1);
    metrics.gauge("outreach_http_in_flight_requests", {}, inFlightRequests);
  }
}

function requiresCapacityAdmission(request) {
  return String(request.url).split("?", 1)[0] !== "/livez";
}

function installErrorHandling(server, metrics) {
  server.setNotFoundHandler(async (request, reply) => {
    return reply.code(404).send({
      error: { code: "NOT_FOUND", message: "Resource not found.", requestId: request.id }
    });
  });

  server.setErrorHandler(async (error, request, reply) => {
    const outgoing = publicError(error);
    metrics.increment("outreach_http_errors_total", {
      status: outgoing.statusCode,
      code: outgoing.code
    });
    if (outgoing.statusCode >= 500) {
      request.log.error(
        { err: error, requestId: request.id, route: request.routeOptions?.url },
        "http_request_failed"
      );
    }
    return reply.code(outgoing.statusCode).send({
      error: { code: outgoing.code, message: outgoing.message, requestId: request.id }
    });
  });
}

function assertDependencies({ config, repository, metrics }) {
  if (
    !config?.espocrm?.webhookSecrets
    || (!config?.mailgun?.webhookSigningKey && !config?.plunk?.webhookSecret)
  ) {
    throw new TypeError("config with CRM and provider webhook secrets is required");
  }
  if (!config?.crypto?.unsubscribeSigning?.active?.key || !config?.metricsToken || !config?.safety) {
    throw new TypeError("config with safety and HTTP secrets is required");
  }
  for (const method of ["receiveEvent", "suppress", "cancelPendingForMatch"]) {
    if (typeof repository?.[method] !== "function") throw new TypeError(`repository.${method} is required`);
  }
  if (typeof metrics?.increment !== "function" || typeof metrics?.gauge !== "function" || typeof metrics?.render !== "function") {
    throw new TypeError("metrics is required");
  }
}

function generateRequestId(rawRequest) {
  const supplied = Array.isArray(rawRequest.headers["x-request-id"])
    ? rawRequest.headers["x-request-id"][0]
    : rawRequest.headers["x-request-id"];
  return supplied && /^[A-Za-z0-9._:-]{1,128}$/u.test(supplied) ? supplied : randomUUID();
}

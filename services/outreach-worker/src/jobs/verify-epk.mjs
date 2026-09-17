import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import { EpkVerificationService } from "../application/epk-verification-service.mjs";
import { errorCode } from "../errors.mjs";
import { EpkVerificationClient } from "../infrastructure/epk-verification-client.mjs";
import { EpkVerificationCrmGateway } from "../infrastructure/epk-verification-crm-gateway.mjs";
import { loadEpkVerifierConfig } from "../infrastructure/epk-verifier-config.mjs";
import { EspoCrmClient } from "../infrastructure/espocrm-client.mjs";

const RELEASE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
const RUN_ID_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/u;
const ALLOWED_ARGUMENTS = new Set(["--release-id", "--limit", "--run-id"]);

export async function runEpkVerificationJob({ env = process.env, argv = [], dependencies = {} } = {}) {
  const arguments_ = parseArguments(argv);
  const config = loadEpkVerifierConfig(env);
  if (!config.enabled) return Object.freeze({ enabled: false, selected: 0, verified: 0, failed: 0 });

  const runId = arguments_.runId ?? randomUUID();
  const client = dependencies.espocrmClient ?? new EspoCrmClient(config.espocrm, dependencies.espocrmOptions);
  const crm = dependencies.crm ?? new EpkVerificationCrmGateway(client);
  const epkClient = dependencies.epkClient ?? new EpkVerificationClient(config.verifier, dependencies.epkClientOptions);
  const service = dependencies.service ?? new EpkVerificationService({
    crm,
    epkClient,
    approvedOrigins: config.verifier.approvedOrigins,
    totalTimeoutMs: config.verifier.totalTimeoutMs,
    now: dependencies.now
  });

  if (arguments_.releaseId) {
    const result = await service.verifyRelease(arguments_.releaseId, { runId });
    return Object.freeze({ enabled: true, runId, selected: 1, verified: 1, failed: 0, results: Object.freeze([result]) });
  }
  const limit = arguments_.limit ?? config.verifier.maxBatchSize;
  if (limit > config.verifier.maxBatchSize) throw cliError("EPK_BATCH_LIMIT_EXCEEDS_CONFIGURATION");
  const result = await service.verifyBatch(limit, { runId });
  return Object.freeze({ enabled: true, runId, ...result });
}

export function parseArguments(argv) {
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!ALLOWED_ARGUMENTS.has(name) || !value || value.startsWith("--") || Object.hasOwn(values, name)) {
      throw cliError("EPK_ARGUMENT_INVALID");
    }
    values[name] = value;
  }
  if (values["--release-id"] && values["--limit"]) throw cliError("EPK_ARGUMENT_MODE_AMBIGUOUS");
  if (values["--release-id"] && !RELEASE_ID_PATTERN.test(values["--release-id"])) throw cliError("EPK_RELEASE_ID_INVALID");
  if (values["--run-id"] && !RUN_ID_PATTERN.test(values["--run-id"])) throw cliError("EPK_RUN_ID_INVALID");
  const limit = values["--limit"] === undefined ? undefined : Number(values["--limit"]);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 25)) throw cliError("EPK_BATCH_LIMIT_INVALID");
  return Object.freeze({ releaseId: values["--release-id"], limit, runId: values["--run-id"] });
}

if (isMain(import.meta.url)) {
  runEpkVerificationJob({ argv: process.argv.slice(2) }).then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.failed > 0) process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: errorCode(error), retryable: Boolean(error?.retryable) })}\n`);
    process.exitCode = 1;
  });
}

function isMain(moduleUrl) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === moduleUrl;
}

function cliError(code) {
  return Object.assign(new Error("EPK verifier CLI arguments are invalid"), { code, retryable: false });
}

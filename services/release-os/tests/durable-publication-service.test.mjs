import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createDurablePublicationService } from "../src/application/music/durable-publication-service.mjs";
import { JsonStore, createDefaultState } from "../src/infrastructure/storage/json-store.mjs";

describe("durable publication service", () => {
  it("durably stages and claims intent before provider I/O and persists the result before returning", async () => {
    const store = await temporaryStore();
    let calls = 0;
    const service = createDurablePublicationService({
      store,
      actionExecutor: async ({ action }) => {
        calls += 1;
        const duringExecution = await store.read();
        const record = duringExecution.publicationOutbox.find((entry) => entry.id === action.idempotencyKey);
        assert.equal(record.status, "processing");
        assert.equal(record.lease.fence, 1);
        assert.equal(duringExecution.publicationAttempts[0].status, "processing");
        return submittedResult(action, "provider-track-1");
      }
    });

    const batch = await service.publish(publicationInput(), { dryRun: false });
    assert.equal(calls, 1);
    assert.equal(batch.status, "submitted");
    assert.equal(batch.results[0].status, "submitted");

    const afterReturn = await store.read();
    assert.equal(afterReturn.publicationOutbox.length, 1);
    assert.equal(afterReturn.publicationOutbox[0].status, "succeeded");
    assert.deepEqual(afterReturn.publicationOutbox[0].result, batch.results[0]);
    assert.equal(afterReturn.publicationAttempts[0].status, "succeeded");
    assert.ok(afterReturn.audit.some((entry) => entry.action === "publication.intent_staged"));
    assert.ok(afterReturn.audit.some((entry) => entry.action === "publication.completed"));
  });

  it("allows only one provider call for concurrent duplicate requests and replays the durable result", async () => {
    const store = await temporaryStore();
    let calls = 0;
    let releaseProvider;
    let signalStarted;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const providerGate = new Promise((resolve) => { releaseProvider = resolve; });
    const service = createDurablePublicationService({
      store,
      actionExecutor: async ({ action }) => {
        calls += 1;
        signalStarted();
        await providerGate;
        return submittedResult(action, "provider-track-concurrent");
      }
    });

    const firstPromise = service.publish(publicationInput(), { dryRun: false });
    await started;
    const concurrent = await service.publish(publicationInput(), { dryRun: false });
    assert.equal(concurrent.status, "in_progress");
    assert.equal(concurrent.results[0].status, "in_progress");
    assert.equal(calls, 1);

    releaseProvider();
    const first = await firstPromise;
    assert.equal(first.status, "submitted");
    const replay = await service.publish(publicationInput(), { dryRun: false });
    assert.equal(replay.results[0].externalId, "provider-track-concurrent");
    assert.equal(calls, 1);
  });

  it("renews an owned lease while a bounded provider call is still alive", async () => {
    const store = await temporaryStore();
    let calls = 0;
    let releaseProvider;
    let signalStarted;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const providerGate = new Promise((resolve) => { releaseProvider = resolve; });
    const service = createDurablePublicationService({
      store,
      leaseMs: 1_000,
      actionExecutor: async ({ action }) => {
        calls += 1;
        signalStarted();
        await providerGate;
        return submittedResult(action, "provider-track-heartbeat");
      }
    });

    const firstPromise = service.publish(publicationInput(), { dryRun: false });
    await started;
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const concurrent = await service.publish(publicationInput(), { dryRun: false });
    assert.equal(concurrent.results[0].status, "in_progress");
    assert.equal(calls, 1);

    releaseProvider();
    const first = await firstPromise;
    assert.equal(first.results[0].status, "submitted");
  });

  it("rejects a changed payload that reuses the same release/platform idempotency key", async () => {
    const store = await temporaryStore();
    let calls = 0;
    const service = createDurablePublicationService({
      store,
      actionExecutor: async ({ action }) => {
        calls += 1;
        return submittedResult(action, "provider-track-conflict");
      }
    });

    await service.publish(publicationInput(), { dryRun: false });
    await assert.rejects(
      () => service.publish(publicationInput({ title: "Changed After Submission" }), { dryRun: false }),
      (error) => error.code === "PUBLICATION_IDEMPOTENCY_CONFLICT" && error.statusCode === 409
    );
    assert.equal(calls, 1);
  });

  it("allows an explicit retry after a provider-free blocked precondition", async () => {
    const store = await temporaryStore();
    let calls = 0;
    const service = createDurablePublicationService({
      store,
      actionExecutor: async ({ action }) => {
        calls += 1;
        return calls === 1
          ? {
              ...baseResult(action),
              status: "blocked",
              message: "Required provider credential is not configured.",
              retryable: false,
              outcomeUncertain: false
            }
          : submittedResult(action, "provider-track-after-credential");
      }
    });

    const blocked = await service.publish(publicationInput(), { dryRun: false });
    assert.equal(blocked.results[0].status, "blocked");
    assert.equal((await store.read()).publicationOutbox[0].status, "retryable");
    const submitted = await service.publish(publicationInput(), { dryRun: false });
    assert.equal(submitted.results[0].status, "submitted");
    assert.equal(calls, 2);
  });

  it("never blindly reclaims an expired lease and retries only after not_submitted reconciliation", async () => {
    const store = await temporaryStore();
    let clock = Date.UTC(2026, 6, 15, 10, 0, 0);
    let calls = 0;
    let releaseFirst;
    let signalStarted;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    const service = createDurablePublicationService({
      store,
      now: () => clock,
      leaseMs: 1_000,
      heartbeatEnabled: false,
      actionExecutor: async ({ action }) => {
        calls += 1;
        if (calls === 1) {
          signalStarted();
          await firstGate;
        }
        return submittedResult(action, `provider-track-${calls}`);
      }
    });

    const firstPromise = service.publish(publicationInput(), { dryRun: false });
    await started;
    clock += 1_001;
    const afterExpiry = await service.publish(publicationInput(), { dryRun: false });
    assert.equal(afterExpiry.status, "reconciliation_required");
    assert.equal(afterExpiry.results[0].status, "reconciliation_required");
    assert.equal(calls, 1);

    releaseFirst();
    const fencedFirst = await firstPromise;
    assert.equal(fencedFirst.results[0].status, "reconciliation_required");
    const publicationId = afterExpiry.results[0].idempotencyKey;
    const reconciled = await service.reconcile(publicationId, {
      outcome: "not_submitted",
      operator: "release-operator",
      reason: "Provider confirms that no release was created."
    });
    assert.equal(reconciled.status, "pending");

    const retried = await service.publish(publicationInput(), { dryRun: false });
    assert.equal(retried.results[0].status, "submitted");
    assert.equal(retried.results[0].externalId, "provider-track-2");
    assert.equal(calls, 2);
    const state = await store.read();
    assert.equal(state.publicationAttempts.filter((entry) => entry.status === "reconciled").length, 1);
    assert.equal(state.publicationOutbox[0].fence, 2);
  });

  it("accepts operator submission evidence and then replays without another provider call", async () => {
    const store = await temporaryStore();
    let clock = Date.UTC(2026, 6, 15, 10, 0, 0);
    let calls = 0;
    let releaseProvider;
    let signalStarted;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const gate = new Promise((resolve) => { releaseProvider = resolve; });
    const service = createDurablePublicationService({
      store,
      now: () => clock,
      leaseMs: 1_000,
      heartbeatEnabled: false,
      actionExecutor: async ({ action }) => {
        calls += 1;
        signalStarted();
        await gate;
        return submittedResult(action, "provider-unknown-at-crash");
      }
    });

    const firstPromise = service.publish(publicationInput(), { dryRun: false });
    await started;
    clock += 1_001;
    const uncertain = await service.publish(publicationInput(), { dryRun: false });
    releaseProvider();
    await firstPromise;

    const publicationId = uncertain.results[0].idempotencyKey;
    const reconciled = await service.reconcile(publicationId, {
      outcome: "submitted",
      operator: "release-operator",
      reason: "Provider dashboard proves the release was created.",
      externalId: "provider-confirmed-id",
      externalUrl: "https://provider.example/releases/provider-confirmed-id"
    });
    assert.equal(reconciled.status, "succeeded");

    const replay = await service.publish(publicationInput(), { dryRun: false });
    assert.equal(replay.results[0].externalId, "provider-confirmed-id");
    assert.equal(replay.results[0].reconciled, true);
    assert.equal(calls, 1);
  });

  it("blocks automatic retry after a timeout or otherwise uncertain provider result", async () => {
    const store = await temporaryStore();
    let calls = 0;
    const service = createDurablePublicationService({
      store,
      actionExecutor: async ({ action }) => {
        calls += 1;
        return {
          ...baseResult(action),
          status: "failed",
          message: "Provider timed out.",
          errorCode: "PROVIDER_REQUEST_TIMEOUT",
          retryable: true,
          outcomeUncertain: true
        };
      }
    });

    const first = await service.publish(publicationInput(), { dryRun: false });
    assert.equal(first.status, "reconciliation_required");
    assert.equal(first.results[0].outcomeUncertain, true);
    const replay = await service.publish(publicationInput(), { dryRun: false });
    assert.equal(replay.status, "reconciliation_required");
    assert.equal(calls, 1);
  });
});

async function temporaryStore() {
  const directory = await mkdtemp(join(tmpdir(), "marcsmusic-publication-outbox-"));
  return new JsonStore({ filePath: join(directory, "store.json"), initialState: createDefaultState() });
}

function publicationInput(overrides = {}) {
  return {
    releaseId: "release-durable-1",
    title: "Durable Release",
    artist: "Marc Rene",
    audioSource: "/managed/audio/durable.mp3",
    description: "Durable publication test",
    targetPlatforms: ["soundcloud"],
    ...overrides
  };
}

function submittedResult(action, externalId) {
  return {
    ...baseResult(action),
    status: "submitted",
    message: "Submitted exactly once.",
    externalId,
    externalUrl: `https://provider.example/releases/${externalId}`,
    retryable: false,
    outcomeUncertain: false
  };
}

function baseResult(action) {
  return {
    platformId: action.platformId,
    platformName: action.platformName,
    idempotencyKey: action.idempotencyKey,
    mode: action.mode,
    operation: action.operation,
    dryRun: false,
    requiredCredentialEnv: action.requiredCredentialEnv,
    requirements: action.requirements
  };
}

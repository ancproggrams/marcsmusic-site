import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, test } from "node:test";

import {
  evaluateContactEvidence,
  verifyEvidenceAttestation
} from "../src/domain/evidence-policy.mjs";
import { ContactIntakeRepository } from "../src/infrastructure/contact-intake-repository.mjs";
import { createPostgresPool, runMigrations } from "../src/infrastructure/postgres.mjs";
import { SourceIngestionRepository } from "../src/infrastructure/source-ingestion-repository.mjs";
import { startPostgresTestCluster } from "./helpers/postgres-test-cluster.mjs";

let cluster;

describe("direct CRM intake PostgreSQL contracts", { concurrency: 1 }, () => {
  before(async () => {
    cluster = await startPostgresTestCluster();
  });

  after(async () => {
    await cluster?.stop();
  });

  test("concurrent replicas claim one intake revision and completed replay returns the durable result", async (t) => {
    const { pool, repository } = await setup(t);
    const replica = new ContactIntakeRepository({ pool });
    const revisionDigest = digest("contact-revision-1");

    const attempts = await Promise.all([
      repository.beginIntake({
        entityType: "MediaContact",
        entityId: "contact-concurrent",
        revisionDigest,
        leaseOwner: "intake-replica-a",
        leaseSeconds: 120
      }),
      replica.beginIntake({
        entityType: "MediaContact",
        entityId: "contact-concurrent",
        revisionDigest,
        leaseOwner: "intake-replica-b",
        leaseSeconds: 120
      })
    ]);
    const winner = attempts.find(({ claimed }) => claimed);
    const follower = attempts.find(({ claimed }) => !claimed);
    assert.ok(winner?.lease);
    assert.deepEqual(follower, { claimed: false, completed: false, inProgress: true });

    const durableResult = { canonicalId: "contact-canonical", entityVersion: 7, attested: true };
    await repository.completeIntake(winner.lease, durableResult);
    const replay = await replica.beginIntake({
      entityType: "MediaContact",
      entityId: "contact-concurrent",
      revisionDigest,
      leaseOwner: "intake-replay",
      leaseSeconds: 120
    });

    assert.equal(replay.claimed, false);
    assert.equal(replay.completed, true);
    assert.deepEqual(replay.result, durableResult);
    assert.deepEqual(
      (await pool.query(
        "SELECT status,attempts,lease_owner,locked_until IS NULL AS unlocked FROM crm_intake_receipts"
      )).rows,
      [{ status: "completed", attempts: 1, lease_owner: null, unlocked: true }]
    );
  });

  test("a crashed intake lease is reclaimable while every stale worker mutation is fenced", async (t) => {
    const { pool, repository } = await setup(t);
    const revisionDigest = digest("contact-crash-revision");
    const first = await repository.beginIntake({
      entityType: "MediaContact",
      entityId: "contact-crash",
      revisionDigest,
      leaseOwner: "crashed-worker",
      leaseSeconds: 120
    });
    await pool.query(
      `UPDATE crm_intake_receipts
          SET locked_until=now()-interval '1 second'
        WHERE entity_type='MediaContact' AND entity_id='contact-crash' AND revision_digest=$1`,
      [revisionDigest]
    );

    const takeover = await repository.beginIntake({
      entityType: "MediaContact",
      entityId: "contact-crash",
      revisionDigest,
      leaseOwner: "takeover-worker",
      leaseSeconds: 120
    });
    assert.equal(takeover.claimed, true);
    assert.equal(takeover.lease.leaseVersion, first.lease.leaseVersion + 1);
    assert.equal(await repository.renewIntakeLease(first.lease, 120), false);
    await assert.rejects(
      repository.completeIntake(first.lease, { canonicalId: "stale-write" }),
      (error) => error.code === "CRM_INTAKE_LEASE_LOST" && error.retryable === true
    );

    await repository.completeIntake(takeover.lease, { canonicalId: "takeover-write" });
    assert.deepEqual(
      (await pool.query(
        "SELECT status,attempts,lease_version,result FROM crm_intake_receipts WHERE entity_id='contact-crash'"
      )).rows,
      [{ status: "completed", attempts: 2, lease_version: "2", result: { canonicalId: "takeover-write" } }]
    );
  });

  test("direct and signed-source identity contenders converge on one canonical binding", async (t) => {
    const { pool, repository } = await setup(t);
    const sourceRepository = new SourceIngestionRepository({ pool });
    const identities = Object.freeze([
      { type: "email", hash: digest("shared-contact@example.test") },
      { type: "linkedin", hash: digest("shared-linkedin-profile") }
    ]);
    const contenders = [repository, sourceRepository];
    const attempts = await Promise.all(contenders.map((candidate, index) => candidate.beginIdentityResolution({
      entityType: "MediaContact",
      identities,
      claimOwner: `identity-contender-${index}`,
      leaseSeconds: 120
    })));
    const winnerIndex = attempts.findIndex(({ claimed }) => claimed);
    const followerIndex = attempts.findIndex(({ claimed }) => !claimed);
    assert.notEqual(winnerIndex, -1);
    assert.deepEqual(attempts[followerIndex], { claimed: false, inProgress: true });

    await contenders[winnerIndex].completeIdentityResolution({
      ...attempts[winnerIndex].claim,
      crmEntityId: "contact-shared-canonical",
      sourceId: winnerIndex === 0 ? "direct-crm" : "signed-source",
      externalId: "shared-origin",
      evidenceCapturedAt: new Date(),
      evidenceVerified: true,
      acceptedIdentities: identities
    });
    const reconciled = await contenders[followerIndex].beginIdentityResolution({
      entityType: "MediaContact",
      identities,
      claimOwner: "identity-reconcile",
      leaseSeconds: 120
    });
    assert.equal(reconciled.claimed, true);
    assert.equal(reconciled.boundCrmEntityId, "contact-shared-canonical");
    assert.equal(reconciled.boundEvidence.verified, true);
    await contenders[followerIndex].abandonIdentityResolution(reconciled.claim);
    assert.deepEqual(
      (await pool.query(
        "SELECT DISTINCT crm_entity_id FROM source_identity_bindings ORDER BY crm_entity_id"
      )).rows,
      [{ crm_entity_id: "contact-shared-canonical" }]
    );
  });

  test("attestations remain unusable before origin completion, detect tampering, and cannot revive after revocation", async (t) => {
    const { pool, repository } = await setup(t);
    const entityId = "contact-evidence";
    const revisionDigest = digest("direct-evidence-origin");
    const receipt = await repository.beginIntake({
      entityType: "MediaContact",
      entityId,
      revisionDigest,
      leaseOwner: "evidence-worker",
      leaseSeconds: 120
    });
    const now = new Date();
    const evaluation = evaluateContactEvidence({
      entityId,
      entityVersion: 7,
      email: "music@radio.example",
      purpose: "Explicit Music Submission",
      basis: "Explicit Submission Address",
      sourceUrl: "https://radio.example/submissions",
      evidenceText: "The station publishes this address for music submissions.",
      capturedAt: now.toISOString(),
      expectedDomain: "radio.example",
      now,
      sourceKind: "direct_crm"
    });
    assert.equal(evaluation.allowed, true);
    assert.equal(await repository.putEvidenceAttestation({
      evaluation,
      origin: { sourceKind: "direct_crm", entityId, revisionDigest }
    }), true);

    const incomplete = await repository.getEvidenceAttestation("MediaContact", entityId);
    assert.equal(incomplete.originCompleted, false);
    assert.deepEqual(verifyEvidenceAttestation(evaluation, incomplete), { verified: true });

    await repository.completeIntake(receipt.lease, { canonicalId: entityId, entityVersion: 7, attested: true });
    const completed = await repository.getEvidenceAttestation("MediaContact", entityId);
    assert.equal(completed.originCompleted, true);
    assert.deepEqual(verifyEvidenceAttestation(evaluation, completed), { verified: true });

    await pool.query(
      "UPDATE purpose_bound_evidence_attestations SET evidence_digest=$1 WHERE entity_type='MediaContact' AND entity_id=$2",
      [digest("tampered-attestation"), entityId]
    );
    const tampered = await repository.getEvidenceAttestation("MediaContact", entityId);
    assert.deepEqual(verifyEvidenceAttestation(evaluation, tampered), {
      verified: false,
      reason: "attestation_digest_mismatch"
    });

    await repository.revokeEvidenceAttestation({
      entityType: "MediaContact",
      entityId,
      entityVersion: 8,
      revisionDigest: digest("deny-wins-revision"),
      reason: "hard_bounce",
      capturedAt: new Date(now.getTime() + 1_000)
    });
    assert.equal(await repository.putEvidenceAttestation({
      evaluation,
      origin: { sourceKind: "direct_crm", entityId, revisionDigest }
    }), false);
    const revoked = await repository.getEvidenceAttestation("MediaContact", entityId);
    assert.equal(revoked.status, "revoked");
    assert.equal(revoked.revocationReason, "hard_bounce");
    assert.deepEqual(verifyEvidenceAttestation(evaluation, revoked), {
      verified: false,
      reason: "attestation_missing_or_revoked"
    });
  });
});

async function setup(t) {
  const database = await cluster.createDatabase();
  const pool = createPostgresPool({ url: database.url, ssl: false });
  t.after(async () => pool.end());
  await runMigrations(pool);
  return { pool, repository: new ContactIntakeRepository({ pool }) };
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { createSourceIngestionService } from "../src/application/source-ingestion-service.mjs";
import { adaptDjFinderRows, buildSourceArtifact } from "../src/domain/source-adapters.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";
import { createPostgresPool, runMigrations } from "../src/infrastructure/postgres.mjs";
import { SourceIngestionRepository } from "../src/infrastructure/source-ingestion-repository.mjs";
import { startPostgresTestCluster } from "./helpers/postgres-test-cluster.mjs";

let cluster;

describe("source identity PostgreSQL contracts", { concurrency: 1 }, () => {
  before(async () => {
    cluster = await startPostgresTestCluster();
  });

  after(async () => {
    await cluster?.stop();
  });

  test("generic and no-submissions adapter output cannot create a contact or canonical contact alias", async (t) => {
    const { pool, repository } = await setup(t);
    const espo = sourceProjectionEspo();
    let validationCalls = 0;
    const service = createSourceIngestionService({
      espocrm: espo,
      repository,
      emailValidationProvider: {
        async validate() {
          validationCalls += 1;
          return { status: "Valid", checkedAt: new Date().toISOString(), providerReference: "must-not-run" };
        }
      },
      cryptoBox: { privacyHash: (value) => createHash("sha256").update(value).digest("hex") },
      config: {
        sourceIngestion: {
          maxArtifactAgeSeconds: 86_400,
          maxEvidenceAgeSeconds: 7_776_000,
          processingLeaseSeconds: 900
        },
        emailValidation: { cacheTtlDays: 30 }
      },
      logger: { info() {} },
      metrics: new Metrics()
    });
    const capturedAt = new Date().toISOString();
    const common = {
      artist_name: "DJ Source Contract",
      full_name: "DJ Source Contract",
      verification_status: "verified",
      verification_timestamp: capturedAt
    };

    for (const [partition, row, expectedPolicy, expectedActivity] of [
      ["generic", {
        ...common,
        website_url: "https://generic-source-contract.example/",
        source_url: "https://generic-source-contract.example/directory",
        contact_source_url: "https://generic-source-contract.example/directory",
        general_business_email: "info@generic-source-contract.example",
        active_evidence: "A directory lists a public address with no submission destination."
      }, "General Contact", "Active"],
      ["denied", {
        ...common,
        website_url: "https://denied-source-contract.example/",
        source_url: "https://denied-source-contract.example/submissions",
        contact_source_url: "https://denied-source-contract.example/submissions",
        music_submission_email: "music@denied-source-contract.example",
        active_evidence: "No music submissions accepted. Please do not send demos."
      }, "No Submissions", "Blocked"]
    ]) {
      const artifact = buildSourceArtifact({
        sourceId: "dj-finder",
        generatedAt: capturedAt,
        partition,
        records: adaptDjFinderRows([row])
      });
      const result = await service.ingest({
        sourceId: artifact.sourceId,
        artifact,
        rawBody: Buffer.from(JSON.stringify(artifact))
      });
      assert.equal(result.MediaContact, 0);
      assert.equal(result.contactsReady, 0);
      const projected = espo.byType.MediaOutlet.find(({ website }) => website === row.website_url);
      assert.equal(projected.submissionPolicy, expectedPolicy);
      assert.equal(projected.activityStatus, expectedActivity);
      assert.equal(projected.acceptsEmail, false);
    }

    assert.equal(validationCalls, 0);
    assert.equal(espo.byType.MediaContact.length, 0);
    assert.equal((await pool.query(
      "SELECT count(*)::int AS count FROM source_identity_bindings WHERE entity_type='MediaContact'"
    )).rows[0].count, 0);
  });

  test("overlapping identity sets have one finite winner and bind atomically with the artifact link", async (t) => {
    const { pool, repository } = await setup(t);
    const identities = [identity("email", "winner@example.com"), identity("instagram", "winner")];
    const artifact = await repository.beginArtifact({
      sourceId: "dj-finder",
      artifactId: "identity-concurrency",
      contentDigest: "a".repeat(64),
      generatedAt: new Date(),
      leaseOwner: "artifact-owner",
      leaseSeconds: 120
    });

    const attempts = await Promise.all([
      repository.beginIdentityResolution({
        entityType: "MediaContact", identities, claimOwner: "identity-owner-a", leaseSeconds: 120
      }),
      repository.beginIdentityResolution({
        entityType: "MediaContact", identities, claimOwner: "identity-owner-b", leaseSeconds: 120
      })
    ]);
    const winner = attempts.find(({ claimed }) => claimed);
    const follower = attempts.find(({ claimed }) => !claimed);
    assert.ok(winner?.claim);
    assert.deepEqual(follower, { claimed: false, inProgress: true });

    await repository.linkRecord({
      ...artifact.lease,
      sourceId: "dj-finder",
      artifactId: "identity-concurrency",
      externalId: "contact-winner",
      entityType: "MediaContact",
      crmEntityId: "crm-contact-winner",
      evidenceDigest: "b".repeat(64),
      evidenceCapturedAt: new Date(),
      evidenceVerified: true,
      identityResolution: winner.claim
    });
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM source_identity_bindings")).rows[0].count, 2);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM source_ingestion_record_links")).rows[0].count, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM source_identity_claims")).rows[0].count, 0);

    const replay = await repository.beginIdentityResolution({
      entityType: "MediaContact", identities, claimOwner: "identity-owner-replay", leaseSeconds: 120
    });
    assert.equal(replay.claimed, true);
    assert.equal(replay.boundCrmEntityId, "crm-contact-winner");
    assert.equal(replay.boundEvidence.verified, true);
    await repository.abandonIdentityResolution(replay.claim);
  });

  test("a stale artifact lease rolls back both identity binding and record link", async (t) => {
    const { pool, repository } = await setup(t);
    const artifact = await repository.beginArtifact({
      sourceId: "dj-finder",
      artifactId: "identity-stale-artifact",
      contentDigest: "c".repeat(64),
      generatedAt: new Date(),
      leaseOwner: "stale-artifact-owner",
      leaseSeconds: 120
    });
    const resolution = await repository.beginIdentityResolution({
      entityType: "MediaContact",
      identities: [identity("email", "stale@example.com")],
      claimOwner: "stale-identity-owner",
      leaseSeconds: 120
    });
    await assert.rejects(
      repository.linkRecord({
        ...artifact.lease,
        sourceId: "dj-finder",
        artifactId: "identity-stale-artifact",
        externalId: "wrong-type",
        entityType: "MediaOutlet",
        crmEntityId: "crm-wrong-type",
        evidenceDigest: "f".repeat(64),
        evidenceCapturedAt: new Date(),
        evidenceVerified: true,
        identityResolution: resolution.claim
      }),
      (error) => error.code === "SOURCE_IDENTITY_ENTITY_MISMATCH"
    );
    await pool.query(
      "UPDATE source_ingestion_receipts SET locked_until=now()-interval '1 second' WHERE source_id=$1 AND artifact_id=$2",
      ["dj-finder", "identity-stale-artifact"]
    );

    await assert.rejects(
      repository.linkRecord({
        ...artifact.lease,
        sourceId: "dj-finder",
        artifactId: "identity-stale-artifact",
        externalId: "stale-contact",
        entityType: "MediaContact",
        crmEntityId: "crm-stale-contact",
        evidenceDigest: "d".repeat(64),
        evidenceCapturedAt: new Date(),
        evidenceVerified: true,
        identityResolution: resolution.claim
      }),
      (error) => error.code === "SOURCE_ARTIFACT_LEASE_LOST"
    );
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM source_identity_bindings")).rows[0].count, 0);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM source_ingestion_record_links")).rows[0].count, 0);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM source_identity_claims")).rows[0].count, 1);
    assert.equal(await repository.abandonIdentityResolution(resolution.claim), true);
  });

  test("conflicting bound identities fail closed and expired claims can be taken over", async (t) => {
    const { pool, repository } = await setup(t);
    const emailIdentity = identity("email", "conflict@example.com");
    const instagramIdentity = identity("instagram", "conflict");
    await bind(repository, [emailIdentity], "crm-contact-a", {
      claimOwner: "bind-a", externalId: "contact-a"
    });
    await bind(repository, [instagramIdentity], "crm-contact-b", {
      claimOwner: "bind-b", externalId: "contact-b"
    });
    await assert.rejects(
      repository.beginIdentityResolution({
        entityType: "MediaContact",
        identities: [emailIdentity, instagramIdentity],
        claimOwner: "ambiguous-owner",
        leaseSeconds: 120
      }),
      (error) => error.code === "SOURCE_DEDUP_AMBIGUOUS" && error.retryable === false
    );

    const unbound = identity("show_outlet", "night-shift:outlet-a");
    const first = await repository.beginIdentityResolution({
      entityType: "MediaContact", identities: [unbound], claimOwner: "expired-owner", leaseSeconds: 120
    });
    assert.equal(await repository.renewIdentityResolution({ ...first.claim, leaseSeconds: 120 }), true);
    assert.deepEqual(await repository.beginIdentityResolution({
      entityType: "MediaContact", identities: [unbound], claimOwner: "blocked-takeover", leaseSeconds: 120
    }), { claimed: false, inProgress: true });
    await pool.query("UPDATE source_identity_claims SET locked_until=now()-interval '1 second' WHERE id=$1", [first.claim.claimId]);
    const takeover = await repository.beginIdentityResolution({
      entityType: "MediaContact", identities: [unbound], claimOwner: "takeover-owner", leaseSeconds: 120
    });
    assert.equal(takeover.claimed, true);
    assert.notEqual(takeover.claim.claimId, first.claim.claimId);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM source_identity_claims")).rows[0].count, 1);
    await repository.abandonIdentityResolution(takeover.claim);
  });

  test("only explicitly accepted verified claim identities become canonical aliases", async (t) => {
    const { pool, repository } = await setup(t);
    const email = identity("email", "selective@example.com");
    const instagram = identity("instagram", "selective");
    const name = identity("name_outlet", "selective:outlet");
    const resolution = await repository.beginIdentityResolution({
      entityType: "MediaContact",
      identities: [email, instagram, name],
      claimOwner: "selective-owner",
      leaseSeconds: 120
    });
    await repository.completeIdentityResolution({
      ...resolution.claim,
      crmEntityId: "crm-selective",
      sourceId: "dj-finder",
      externalId: "selective",
      evidenceCapturedAt: new Date(),
      evidenceVerified: true,
      acceptedIdentities: [instagram]
    });
    assert.deepEqual(
      (await pool.query("SELECT identity_type FROM source_identity_bindings ORDER BY identity_type")).rows,
      [{ identity_type: "instagram" }]
    );
    const emailProbe = await repository.beginIdentityResolution({
      entityType: "MediaContact", identities: [email], claimOwner: "email-probe", leaseSeconds: 120
    });
    assert.equal(emailProbe.boundCrmEntityId, undefined);
    await repository.abandonIdentityResolution(emailProbe.claim);
    const instagramProbe = await repository.beginIdentityResolution({
      entityType: "MediaContact", identities: [instagram], claimOwner: "instagram-probe", leaseSeconds: 120
    });
    assert.equal(instagramProbe.boundCrmEntityId, "crm-selective");
    await repository.abandonIdentityResolution(instagramProbe.claim);
  });

  test("targeted cleanup removes a requested stale claim beyond the generic 1000-row sweep", async (t) => {
    const { pool, repository } = await setup(t);
    const target = identity("email", "stale-target@example.com");
    await pool.query(
      `WITH inserted AS (
         INSERT INTO source_identity_claims(claim_owner,entity_type,locked_until)
         SELECT 'bulk-' || i,'MediaContact',now()-interval '10 seconds' + i * interval '1 microsecond'
           FROM generate_series(1,1001) AS i
         RETURNING id,claim_owner
       )
       INSERT INTO source_identity_claim_items(claim_id,entity_type,identity_type,identity_hash)
       SELECT id,'MediaContact','email',
              CASE WHEN claim_owner='bulk-1001' THEN $1 ELSE md5(claim_owner) || md5('x:' || claim_owner) END
         FROM inserted`,
      [target.hash]
    );
    const claimed = await repository.beginIdentityResolution({
      entityType: "MediaContact",
      identities: [target],
      claimOwner: "post-cleanup-owner",
      leaseSeconds: 120
    });
    assert.equal(claimed.claimed, true);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM source_identity_claims")).rows[0].count, 1);
    await repository.abandonIdentityResolution(claimed.claim);
  });

  test("canonical verified watermark spans every alias and advances monotonically", async (t) => {
    const { pool, repository } = await setup(t);
    const descriptor = identity("name_outlet", "canonical:outlet-a");
    const instagram = identity("instagram", "canonical");
    const base = Date.now() - 300_000;
    await bind(repository, [descriptor], "crm-canonical", {
      claimOwner: "unverified", externalId: "unverified", evidenceCapturedAt: new Date(base + 200_000), evidenceVerified: false
    });
    await bind(repository, [descriptor], "crm-canonical", {
      claimOwner: "verified-first", externalId: "verified-first", evidenceCapturedAt: new Date(base + 100_000), evidenceVerified: true
    });
    await bind(repository, [descriptor], "crm-canonical", {
      claimOwner: "unverified-newer", externalId: "unverified-newer", evidenceCapturedAt: new Date(base + 250_000), evidenceVerified: false
    });
    await bind(repository, [descriptor], "crm-canonical", {
      claimOwner: "verified-older", externalId: "verified-older", evidenceCapturedAt: new Date(base + 50_000), evidenceVerified: true
    });
    let stored = (await pool.query(
      "SELECT evidence_verified,evidence_captured_at,external_id FROM source_identity_bindings"
    )).rows[0];
    assert.equal(stored.evidence_verified, true);
    assert.equal(stored.evidence_captured_at.toISOString(), new Date(base + 100_000).toISOString());
    assert.equal(stored.external_id, "verified-first");

    await bind(repository, [instagram], "crm-canonical", {
      claimOwner: "older-alias", externalId: "older-alias", evidenceCapturedAt: new Date(base + 75_000), evidenceVerified: true
    });
    const aliasProbe = await repository.beginIdentityResolution({
      entityType: "MediaContact", identities: [instagram], claimOwner: "alias-probe", leaseSeconds: 120
    });
    assert.equal(aliasProbe.boundCrmEntityId, "crm-canonical");
    assert.equal(aliasProbe.boundEvidence.verifiedAt.toISOString(), new Date(base + 100_000).toISOString());
    await repository.abandonIdentityResolution(aliasProbe.claim);

    await bind(repository, [descriptor], "crm-canonical", {
      claimOwner: "verified-newest", externalId: "verified-newest", evidenceCapturedAt: new Date(base + 290_000), evidenceVerified: true
    });
    stored = (await pool.query(
      "SELECT evidence_verified,evidence_captured_at,external_id FROM source_identity_bindings WHERE identity_type='name_outlet'"
    )).rows[0];
    assert.equal(stored.evidence_captured_at.toISOString(), new Date(base + 290_000).toISOString());
    assert.equal(stored.external_id, "verified-newest");
  });

  test("record-link evidence never regresses when an older artifact arrives later", async (t) => {
    const { pool, repository } = await setup(t);
    const newest = new Date();
    const older = new Date(newest.getTime() - 60_000);
    for (const [artifactId, digest, capturedAt] of [
      ["link-newest", "1".repeat(64), newest],
      ["link-older", "2".repeat(64), older]
    ]) {
      const receipt = await repository.beginArtifact({
        sourceId: "dj-finder",
        artifactId,
        contentDigest: digest,
        generatedAt: new Date(),
        leaseOwner: `owner-${artifactId}`,
        leaseSeconds: 120
      });
      await repository.linkRecord({
        ...receipt.lease,
        sourceId: "dj-finder",
        artifactId,
        externalId: "stable-contact",
        entityType: "MediaContact",
        crmEntityId: "crm-stable-contact",
        evidenceDigest: digest,
        evidenceCapturedAt: capturedAt
      });
    }
    const stored = (await pool.query(
      "SELECT artifact_id,evidence_digest,evidence_captured_at FROM source_ingestion_record_links"
    )).rows[0];
    assert.equal(stored.artifact_id, "link-newest");
    assert.equal(stored.evidence_digest, "1".repeat(64));
    assert.equal(stored.evidence_captured_at.toISOString(), newest.toISOString());
  });

  test("source merges share the suppression advisory fence used by deny-wins writes", async (t) => {
    const { pool, repository } = await setup(t);
    const lockName = "outreach-send-authorization:email:race@example.com";
    await repository.withSuppressionFence([["email", "Race@Example.com"]], async () => {
      const competing = await pool.query(
        "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired",
        [lockName]
      );
      assert.equal(competing.rows[0].acquired, false);
    });
    const afterRelease = await pool.query(
      "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired",
      [lockName]
    );
    assert.equal(afterRelease.rows[0].acquired, true);
  });
});

async function setup(t) {
  const database = await cluster.createDatabase();
  const pool = createPostgresPool({ url: database.url, ssl: false });
  t.after(async () => pool.end());
  await runMigrations(pool);
  return { pool, repository: new SourceIngestionRepository({ pool }) };
}

async function bind(repository, identities, crmEntityId, {
  claimOwner,
  externalId,
  evidenceCapturedAt = new Date(),
  evidenceVerified = true
}) {
  const resolution = await repository.beginIdentityResolution({
    entityType: "MediaContact", identities, claimOwner, leaseSeconds: 120
  });
  assert.equal(resolution.claimed, true);
  await repository.completeIdentityResolution({
    ...resolution.claim,
    crmEntityId,
    sourceId: "dj-finder",
    externalId,
    evidenceCapturedAt,
    evidenceVerified
  });
}

function identity(type, value) {
  return Object.freeze({ type, hash: createHash("sha256").update(`${type}:${value}`).digest("hex") });
}

function sourceProjectionEspo() {
  const byType = { MediaOutlet: [], MediaContact: [], MusicRelease: [] };
  let sequence = 0;
  return {
    byType,
    async findUniqueWhere(entityType, where) {
      const matches = byType[entityType].filter((record) => where.every((criterion) =>
        criterion.type === "equals" && record[criterion.attribute] === criterion.value
      ));
      if (matches.length > 1) throw Object.assign(new Error("duplicate fake CRM result"), {
        code: "ESPOCRM_UNIQUE_CONTRACT_VIOLATED"
      });
      return matches[0];
    },
    async get(entityType, id) {
      return byType[entityType].find((record) => record.id === id);
    },
    async upsertByUnique(entityType, attribute, value, payload) {
      const existing = byType[entityType].find((record) => record[attribute] === value);
      if (existing) return this.updateConditional(entityType, existing.id, payload, existing.versionNumber);
      const created = { ...payload, id: `${entityType}-${++sequence}`, versionNumber: 1 };
      byType[entityType].push(created);
      return created;
    },
    async updateConditional(entityType, id, payload, versionNumber) {
      const record = byType[entityType].find((candidate) => candidate.id === id);
      assert.equal(record.versionNumber, versionNumber);
      Object.assign(record, payload, { versionNumber: versionNumber + 1 });
      return record;
    }
  };
}

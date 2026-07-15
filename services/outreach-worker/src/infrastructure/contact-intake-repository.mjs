import { randomUUID } from "node:crypto";
import { ApplicationError } from "../errors.mjs";
import {
  acquireSessionAdvisoryLock,
  databaseLimits,
  withTransaction
} from "./postgres.mjs";
import { SourceIngestionRepository } from "./source-ingestion-repository.mjs";

const ENTITY_TYPES = new Set(["MediaContact", "MediaOutlet"]);
const DEFAULT_LEASE_SECONDS = 120;

export class ContactIntakeRepository {
  constructor({ pool }) {
    if (!pool?.query || !pool?.connect) throw new TypeError("ContactIntakeRepository requires a PostgreSQL pool");
    this.pool = pool;
    this.identityRepository = new SourceIngestionRepository({ pool });
  }

  async withEntityFence(entityType, entityId, work) {
    assertEntity(entityType, entityId);
    if (typeof work !== "function") throw new TypeError("Contact intake fence requires work");
    const client = await this.pool.connect();
    const key = `direct-crm-intake:${entityType}:${entityId}`;
    try {
      await acquireSessionAdvisoryLock(client, key, databaseLimits(this.pool.options ?? {}));
      return await work();
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key]).catch(() => {});
      client.release();
    }
  }

  async beginIntake({
    entityType,
    entityId,
    revisionDigest,
    leaseOwner = randomUUID(),
    leaseSeconds = DEFAULT_LEASE_SECONDS
  }) {
    assertEntity(entityType, entityId);
    assertDigest(revisionDigest, "CRM intake revision");
    assertLease(leaseOwner, leaseSeconds);
    return withTransaction(this.pool, async (client) => {
      const inserted = await client.query(
        `INSERT INTO crm_intake_receipts(
           entity_type,entity_id,revision_digest,status,lease_owner,lease_version,locked_until
         ) VALUES($1,$2,$3,'processing',$4,1,now()+make_interval(secs => $5))
         ON CONFLICT DO NOTHING
         RETURNING entity_type,entity_id,revision_digest,lease_owner,lease_version,locked_until`,
        [entityType, entityId, revisionDigest, leaseOwner, leaseSeconds]
      );
      if (inserted.rowCount) return claimedReceipt(inserted.rows[0]);
      const current = await client.query(
        `SELECT entity_type,entity_id,revision_digest,status,result,lease_owner,lease_version,locked_until,
                locked_until > now() AS lease_fresh
           FROM crm_intake_receipts
          WHERE entity_type=$1 AND entity_id=$2 AND revision_digest=$3
          FOR UPDATE`,
        [entityType, entityId, revisionDigest]
      );
      const row = current.rows[0];
      if (!row) throw intakeLeaseLost();
      if (row.status === "completed") {
        return Object.freeze({ claimed: false, completed: true, result: Object.freeze(row.result ?? {}) });
      }
      if (row.status === "processing" && row.lease_fresh) {
        return Object.freeze({ claimed: false, completed: false, inProgress: true });
      }
      const reclaimed = await client.query(
        `UPDATE crm_intake_receipts
            SET status='processing',attempts=attempts+1,last_error_code=NULL,
                lease_owner=$4,lease_version=lease_version+1,
                locked_until=now()+make_interval(secs => $5),updated_at=now()
          WHERE entity_type=$1 AND entity_id=$2 AND revision_digest=$3
          RETURNING entity_type,entity_id,revision_digest,lease_owner,lease_version,locked_until`,
        [entityType, entityId, revisionDigest, leaseOwner, leaseSeconds]
      );
      return claimedReceipt(reclaimed.rows[0]);
    });
  }

  async renewIntakeLease(lease, leaseSeconds = DEFAULT_LEASE_SECONDS) {
    assertIntakeLease(lease);
    assertLease(lease.leaseOwner, leaseSeconds);
    const result = await this.pool.query(
      `UPDATE crm_intake_receipts
          SET locked_until=now()+make_interval(secs => $6),updated_at=now()
        WHERE entity_type=$1 AND entity_id=$2 AND revision_digest=$3
          AND status='processing' AND lease_owner=$4 AND lease_version=$5
          AND locked_until > now()
        RETURNING locked_until`,
      [lease.entityType, lease.entityId, lease.revisionDigest, lease.leaseOwner, lease.leaseVersion, leaseSeconds]
    );
    return result.rowCount === 1;
  }

  async completeIntake(lease, result) {
    assertIntakeLease(lease);
    const updated = await this.pool.query(
      `UPDATE crm_intake_receipts
          SET status='completed',result=$6::jsonb,last_error_code=NULL,
              lease_owner=NULL,locked_until=NULL,completed_at=now(),updated_at=now()
        WHERE entity_type=$1 AND entity_id=$2 AND revision_digest=$3
          AND status='processing' AND lease_owner=$4 AND lease_version=$5
          AND locked_until > now()`,
      [lease.entityType, lease.entityId, lease.revisionDigest, lease.leaseOwner, lease.leaseVersion, JSON.stringify(result ?? {})]
    );
    if (updated.rowCount !== 1) throw intakeLeaseLost();
  }

  async failIntake(lease, errorCode) {
    assertIntakeLease(lease);
    const updated = await this.pool.query(
      `UPDATE crm_intake_receipts
          SET status='failed',last_error_code=$6,lease_owner=NULL,locked_until=NULL,updated_at=now()
        WHERE entity_type=$1 AND entity_id=$2 AND revision_digest=$3
          AND status='processing' AND lease_owner=$4 AND lease_version=$5
          AND locked_until > now()`,
      [lease.entityType, lease.entityId, lease.revisionDigest, lease.leaseOwner, lease.leaseVersion, String(errorCode).slice(0, 120)]
    );
    return updated.rowCount === 1;
  }

  beginIdentityResolution(input) {
    return this.identityRepository.beginIdentityResolution(input);
  }

  renewIdentityResolution(input) {
    return this.identityRepository.renewIdentityResolution(input);
  }

  completeIdentityResolution(input) {
    return this.identityRepository.completeIdentityResolution(input);
  }

  abandonIdentityResolution(input) {
    return this.identityRepository.abandonIdentityResolution(input);
  }

  hasActiveSuppression(input) {
    return this.identityRepository.hasActiveSuppression(input);
  }

  withSuppressionFence(input, work) {
    return this.identityRepository.withSuppressionFence(input, work);
  }

  getEmailValidation(input) {
    return this.identityRepository.getEmailValidation(input);
  }

  putEmailValidation(input) {
    return this.identityRepository.putEmailValidation(input);
  }

  async putEvidenceAttestation({ evaluation, origin }) {
    assertAttestationEvaluation(evaluation);
    const normalizedOrigin = normalizeOrigin(origin);
    const { attestation } = evaluation;
    const result = await this.pool.query(
      `INSERT INTO purpose_bound_evidence_attestations(
         entity_type,entity_id,entity_version,digest_version,evidence_digest,evidence_captured_at,
         purpose,basis,source_kind,origin_revision_digest,origin_entity_id,origin_source_id,origin_artifact_id,status
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active')
       ON CONFLICT(entity_type,entity_id) DO UPDATE SET
         entity_version=EXCLUDED.entity_version,
         digest_version=EXCLUDED.digest_version,
         evidence_digest=EXCLUDED.evidence_digest,
         evidence_captured_at=EXCLUDED.evidence_captured_at,
         purpose=EXCLUDED.purpose,
         basis=EXCLUDED.basis,
         source_kind=EXCLUDED.source_kind,
         origin_revision_digest=EXCLUDED.origin_revision_digest,
         origin_entity_id=EXCLUDED.origin_entity_id,
         origin_source_id=EXCLUDED.origin_source_id,
         origin_artifact_id=EXCLUDED.origin_artifact_id,
         status='active',revocation_reason=NULL,updated_at=now()
       WHERE purpose_bound_evidence_attestations.status<>'revoked'
         AND (
           EXCLUDED.evidence_captured_at > purpose_bound_evidence_attestations.evidence_captured_at
           OR (
             EXCLUDED.evidence_captured_at = purpose_bound_evidence_attestations.evidence_captured_at
             AND EXCLUDED.evidence_digest < purpose_bound_evidence_attestations.evidence_digest
           )
           OR (
             EXCLUDED.evidence_digest = purpose_bound_evidence_attestations.evidence_digest
             AND EXCLUDED.entity_version >= purpose_bound_evidence_attestations.entity_version
           )
         )
       RETURNING entity_type,entity_id,evidence_digest`,
      [
        attestation.entityType,
        attestation.entityId,
        attestation.entityVersion,
        attestation.digestVersion,
        evaluation.digest,
        attestation.evidenceCapturedAt,
        attestation.purpose,
        attestation.basis,
        normalizedOrigin.sourceKind,
        normalizedOrigin.revisionDigest,
        normalizedOrigin.entityId,
        normalizedOrigin.sourceId,
        normalizedOrigin.artifactId
      ]
    );
    return result.rowCount === 1;
  }

  async revokeEvidenceAttestation({
    entityType,
    entityId,
    entityVersion,
    revisionDigest,
    reason,
    capturedAt = new Date()
  }) {
    assertEntity(entityType, entityId);
    assertDigest(revisionDigest, "Attestation revocation revision");
    const timestamp = new Date(capturedAt);
    if (!Number.isFinite(timestamp.getTime())) throw new TypeError("Attestation revocation timestamp is invalid");
    const version = Number.isInteger(Number(entityVersion)) && Number(entityVersion) >= 0 ? Number(entityVersion) : 0;
    const boundedReason = String(reason ?? "negative_evidence").slice(0, 120);
    await this.pool.query(
      `INSERT INTO purpose_bound_evidence_attestations(
         entity_type,entity_id,entity_version,digest_version,evidence_digest,evidence_captured_at,
         purpose,basis,source_kind,origin_revision_digest,origin_entity_id,status,revocation_reason
       ) VALUES($1,$2,$3,'purpose-bound-evidence:v1',$4,$5,'Blocked','Blocked','direct_crm',$4,$2,'revoked',$6)
       ON CONFLICT(entity_type,entity_id) DO UPDATE SET
         entity_version=GREATEST(purpose_bound_evidence_attestations.entity_version,EXCLUDED.entity_version),
         status='revoked',revocation_reason=EXCLUDED.revocation_reason,updated_at=now()`,
      [entityType, entityId, version, revisionDigest, timestamp.toISOString(), boundedReason]
    );
  }

  async invalidateEvidenceAttestation({
    entityType,
    entityId,
    entityVersion,
    revisionDigest,
    reason,
    capturedAt = new Date()
  }) {
    assertEntity(entityType, entityId);
    assertDigest(revisionDigest, "Attestation invalidation revision");
    const timestamp = new Date(capturedAt);
    if (!Number.isFinite(timestamp.getTime())) throw new TypeError("Attestation invalidation timestamp is invalid");
    const version = Number.isInteger(Number(entityVersion)) && Number(entityVersion) >= 0 ? Number(entityVersion) : 0;
    await this.pool.query(
      `INSERT INTO purpose_bound_evidence_attestations(
         entity_type,entity_id,entity_version,digest_version,evidence_digest,evidence_captured_at,
         purpose,basis,source_kind,origin_revision_digest,origin_entity_id,status,revocation_reason
       ) VALUES($1,$2,$3,'purpose-bound-evidence:v1',$4,$5,'Unknown','Unknown','direct_crm',$4,$2,'invalid',$6)
       ON CONFLICT(entity_type,entity_id) DO UPDATE SET
         entity_version=EXCLUDED.entity_version,digest_version=EXCLUDED.digest_version,
         evidence_digest=EXCLUDED.evidence_digest,evidence_captured_at=EXCLUDED.evidence_captured_at,
         purpose=EXCLUDED.purpose,basis=EXCLUDED.basis,source_kind=EXCLUDED.source_kind,
         origin_revision_digest=EXCLUDED.origin_revision_digest,origin_entity_id=EXCLUDED.origin_entity_id,
         origin_source_id=NULL,origin_artifact_id=NULL,status='invalid',
         revocation_reason=EXCLUDED.revocation_reason,updated_at=now()
       WHERE purpose_bound_evidence_attestations.status<>'revoked'`,
      [entityType, entityId, version, revisionDigest, timestamp.toISOString(), String(reason ?? "validation_incomplete").slice(0, 120)]
    );
  }

  async getEvidenceAttestation(entityType, entityId) {
    assertEntity(entityType, entityId);
    const result = await this.pool.query(
      `SELECT a.entity_type,a.entity_id,a.entity_version,a.digest_version,a.evidence_digest,
              a.evidence_captured_at,a.purpose,a.basis,a.source_kind,a.status,a.revocation_reason,
              CASE
                WHEN a.source_kind='direct_crm' THEN EXISTS(
                  SELECT 1 FROM crm_intake_receipts r
                   WHERE r.entity_type=a.entity_type AND r.entity_id=a.origin_entity_id
                     AND r.revision_digest=a.origin_revision_digest AND r.status='completed'
                )
                WHEN a.source_kind='signed_source' THEN EXISTS(
                  SELECT 1 FROM source_ingestion_receipts r
                   WHERE r.source_id=a.origin_source_id AND r.artifact_id=a.origin_artifact_id
                     AND r.content_digest=a.origin_revision_digest AND r.status='completed'
                )
                ELSE false
              END AS origin_completed
         FROM purpose_bound_evidence_attestations a
        WHERE a.entity_type=$1 AND a.entity_id=$2`,
      [entityType, entityId]
    );
    const row = result.rows[0];
    return row ? Object.freeze({
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityVersion: Number(row.entity_version),
      digestVersion: row.digest_version,
      evidenceDigest: row.evidence_digest,
      evidenceCapturedAt: new Date(row.evidence_captured_at).toISOString(),
      purpose: row.purpose,
      basis: row.basis,
      sourceKind: row.source_kind,
      status: row.status,
      revocationReason: row.revocation_reason ?? undefined,
      originCompleted: Boolean(row.origin_completed)
    }) : undefined;
  }
}

function claimedReceipt(row) {
  if (!row?.lease_owner || !row.locked_until) throw intakeLeaseLost();
  return Object.freeze({
    claimed: true,
    completed: false,
    lease: Object.freeze({
      entityType: row.entity_type,
      entityId: row.entity_id,
      revisionDigest: row.revision_digest,
      leaseOwner: row.lease_owner,
      leaseVersion: Number(row.lease_version),
      lockedUntil: row.locked_until
    })
  });
}

function normalizeOrigin(origin) {
  if (origin?.sourceKind === "direct_crm") {
    assertDigest(origin.revisionDigest, "Direct CRM origin revision");
    if (typeof origin.entityId !== "string" || !origin.entityId || origin.entityId.length > 24) {
      throw new TypeError("Direct CRM attestation origin entity is invalid");
    }
    return Object.freeze({ sourceKind: "direct_crm", revisionDigest: origin.revisionDigest, entityId: origin.entityId });
  }
  if (origin?.sourceKind === "signed_source") {
    assertDigest(origin.revisionDigest, "Signed source origin revision");
    if (!origin.sourceId || !origin.artifactId) throw new TypeError("Signed source attestation origin is incomplete");
    return Object.freeze({
      sourceKind: "signed_source",
      revisionDigest: origin.revisionDigest,
      sourceId: String(origin.sourceId).slice(0, 64),
      artifactId: String(origin.artifactId).slice(0, 180)
    });
  }
  throw new TypeError("Evidence attestation origin is invalid");
}

function assertAttestationEvaluation(evaluation) {
  if (!evaluation?.allowed || !evaluation.attestation || !/^[0-9a-f]{64}$/u.test(String(evaluation.digest ?? ""))) {
    throw new ApplicationError("Only allowed purpose-bound evidence can be attested", {
      code: "EVIDENCE_ATTESTATION_NOT_ALLOWED", statusCode: 409, retryable: false
    });
  }
}

function assertEntity(entityType, entityId) {
  if (!ENTITY_TYPES.has(entityType) || typeof entityId !== "string" || !entityId || entityId.length > 24) {
    throw new TypeError("CRM intake entity is invalid");
  }
}

function assertDigest(value, label) {
  if (!/^[0-9a-f]{64}$/u.test(String(value ?? ""))) throw new TypeError(`${label} must be a SHA-256 digest`);
}

function assertLease(owner, seconds) {
  if (typeof owner !== "string" || owner.length < 1 || owner.length > 64) throw new TypeError("CRM intake lease owner is invalid");
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 3_600) throw new TypeError("CRM intake lease must be 1-3600 seconds");
}

function assertIntakeLease(lease) {
  assertEntity(lease?.entityType, lease?.entityId);
  assertDigest(lease?.revisionDigest, "CRM intake revision");
  if (!lease?.leaseOwner || !Number.isSafeInteger(lease?.leaseVersion)) throw new TypeError("CRM intake lease is invalid");
}

function intakeLeaseLost() {
  return new ApplicationError("Direct CRM intake lost its fenced processing lease", {
    code: "CRM_INTAKE_LEASE_LOST", statusCode: 409, retryable: true
  });
}
